/**
 * Official GATE Source Ingestion Service
 * Handles polite, allowlisted downloading of official GATE question papers and answer keys,
 * computes cryptographic checksums, detects duplicates, and records provenance metadata.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isApprovedDomain, IGateSourceRecord, sourceRegistry } from './sourceRegistry.js';
import { IQuestionSource } from '../../types/question.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory for downloaded official GATE PDF documents
const DOWNLOAD_DIR = path.resolve(__dirname, '../../../data/gate_downloads');

export interface IDownloadResult {
  success: boolean;
  sourceId: string;
  checksum?: string;
  sizeBytes?: number;
  localPath?: string;
  cached?: boolean;
  metadata?: IQuestionSource;
  error?: string;
  statusCode?: number;
}

export interface IDiscoverySummary {
  discoveredSources: IGateSourceRecord[];
  paperCount: number;
  answerKeyCount: number;
  years: number[];
}

export class OfficialGateSourceService {
  private downloadDir: string;
  private minRequestIntervalMs: number = 500; // Polite rate limiting between requests
  private lastRequestTime: number = 0;
  private defaultTimeoutMs: number = 15000;

  constructor(downloadDir?: string) {
    this.downloadDir = downloadDir || DOWNLOAD_DIR;
    this.ensureDownloadDir();
  }

  private ensureDownloadDir(): void {
    try {
      if (!fs.existsSync(this.downloadDir)) {
        fs.mkdirSync(this.downloadDir, { recursive: true });
      }
    } catch (err: any) {
      console.warn(`[GateSource] Could not create download directory: ${err.message}`);
    }
  }

  /**
   * Enforces a polite delay between outbound requests to avoid hammering official servers.
   */
  private async enforcePoliteDelay(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minRequestIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minRequestIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Discovers available official Computer Science papers and answer keys in the registry.
   */
  public async discoverSources(): Promise<IDiscoverySummary> {
    const csSources = sourceRegistry.getSources({ paper: 'CS' });
    const papers = csSources.filter((s) => s.documentType === 'QUESTION_PAPER');
    const keys = csSources.filter((s) => s.documentType === 'ANSWER_KEY');
    const years = Array.from(new Set(csSources.map((s) => s.year))).sort((a, b) => b - a);

    return {
      discoveredSources: csSources,
      paperCount: papers.length,
      answerKeyCount: keys.length,
      years,
    };
  }

  /**
   * Computes SHA-256 checksum for a buffer or string.
   */
  public computeChecksum(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Builds standardized provenance metadata from an official GATE source record.
   */
  public buildProvenance(
    record: IGateSourceRecord,
    questionNumber?: number,
    checksum?: string
  ): IQuestionSource {
    return {
      type: 'PYQ',
      provider: 'OFFICIAL_GATE',
      exam: 'GATE',
      paper: record.paper || 'CS',
      year: record.year,
      questionNumber,
      sourceUrl: record.url,
      fetchedAt: record.downloadedAt || new Date().toISOString(),
      checksum: checksum || record.checksum,
      notes: `Ingested from official GATE source: ${record.title}`,
    };
  }

  /**
   * Downloads an official GATE document with allowlist verification, timeout handling,
   * duplicate detection, and checksum tracking.
   */
  public async downloadSource(
    sourceId: string,
    options?: { timeoutMs?: number; force?: boolean }
  ): Promise<IDownloadResult> {
    const source = sourceRegistry.getSourceById(sourceId);
    if (!source) {
      return {
        success: false,
        sourceId,
        error: `Source '${sourceId}' is not registered in the official GATE source registry.`,
      };
    }

    // 1. Strict Domain Allowlist Check
    if (!isApprovedDomain(source.url)) {
      sourceRegistry.markFailed(sourceId, 'Domain rejected by official GATE allowlist.');
      return {
        success: false,
        sourceId,
        error: `Security Violation: Domain for '${source.url}' is not in the approved official GATE allowlist.`,
      };
    }

    // 2. Duplicate Detection: Check if already downloaded on disk or cached in registry
    const filename = `${source.id}.pdf`;
    const targetPath = path.join(this.downloadDir, filename);

    if (!options?.force && fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (stats.size > 0) {
        const existingChecksum = source.checksum || this.computeChecksum(fs.readFileSync(targetPath));
        const updated = sourceRegistry.markDownloaded(sourceId, {
          checksum: existingChecksum,
          localPath: targetPath,
          sizeBytes: stats.size,
          downloadedAt: source.downloadedAt || new Date().toISOString(),
        });
        return {
          success: true,
          sourceId,
          checksum: existingChecksum,
          sizeBytes: stats.size,
          localPath: targetPath,
          cached: true,
          metadata: this.buildProvenance(updated, undefined, existingChecksum),
        };
      }
    }

    // 3. Polite Rate Limiting
    await this.enforcePoliteDelay();

    // 4. Download with Timeout & Abort Signal
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(source.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'GATEForge-Official-Ingester/1.0 (+https://gateforge.internal; educational analysis)',
          Accept: 'application/pdf,application/octet-stream,*/*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        const errorMsg = `HTTP error ${response.status}: ${response.statusText}`;
        sourceRegistry.markFailed(sourceId, errorMsg);
        return {
          success: false,
          sourceId,
          statusCode: response.status,
          error: `Failed to download official source from ${source.url}: ${errorMsg}`,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const checksum = this.computeChecksum(buffer);
      const sizeBytes = buffer.length;

      // 5. Write to local storage
      this.ensureDownloadDir();
      fs.writeFileSync(targetPath, buffer);

      // 6. Update Registry with Checksum and Status
      const updated = sourceRegistry.markDownloaded(sourceId, {
        checksum,
        localPath: targetPath,
        sizeBytes,
        downloadedAt: new Date().toISOString(),
      });

      return {
        success: true,
        sourceId,
        checksum,
        sizeBytes,
        localPath: targetPath,
        cached: false,
        metadata: this.buildProvenance(updated, undefined, checksum),
      };
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
      const errorMsg = isTimeout
        ? `Request timed out after ${timeoutMs}ms while contacting ${source.url}`
        : `Network/IO error during official source download: ${err.message}`;

      sourceRegistry.markFailed(sourceId, errorMsg);
      return {
        success: false,
        sourceId,
        error: errorMsg,
      };
    }
  }

  /**
   * Loads the downloaded file buffer for a source if available locally.
   */
  public getDownloadedBuffer(sourceId: string): Buffer | null {
    const source = sourceRegistry.getSourceById(sourceId);
    if (!source) return null;

    const targetPath = source.localPath || path.join(this.downloadDir, `${source.id}.pdf`);
    if (fs.existsSync(targetPath)) {
      try {
        const buf = fs.readFileSync(targetPath);
        if (!source.localPath) {
          sourceRegistry.markDownloaded(sourceId, {
            checksum: source.checksum || this.computeChecksum(buf),
            localPath: targetPath,
            sizeBytes: buf.length,
          });
        }
        return buf;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const officialGateSourceService = new OfficialGateSourceService();
