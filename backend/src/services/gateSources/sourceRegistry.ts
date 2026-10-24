/**
 * Official GATE Source Registry & Allowlist Verification
 * Defines approved official GATE domains and manages source registry records.
 */

import { URL } from 'node:url';

export const APPROVED_OFFICIAL_DOMAINS: ReadonlySet<string> = new Set([
  'gate2024.iisc.ac.in',
  'gate.iitk.ac.in',
  'gate.iitkgp.ac.in',
  'gate.iitb.ac.in',
  'gate.iitd.ac.in',
  'gate.iitm.ac.in',
  'gate2025.iitr.ac.in',
  'gate.iitr.ac.in',
  'gate.iitg.ac.in',
  'gate2026.iitg.ac.in',
  'gate.ac.in',
  'archive.gate.ac.in',
]);

/**
 * Validates whether a given URL belongs to an approved official GATE domain.
 * Strictly prevents SSRF, private network requests, and coaching/third-party websites.
 */
export function isApprovedDomain(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost, private/link-local IPv4 & IPv6
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname === '::1' ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false;
    }

    // Direct match against approved domain list
    if (APPROVED_OFFICIAL_DOMAINS.has(hostname)) {
      return true;
    }

    // Subdomain matching for official IITs/IISc GATE subdomains: e.g. gate2024.iisc.ac.in, gate.iit*.ac.in
    const officialPattern = /^(gate[0-9]{0,4}\.)?(iit[a-z]{1,4}|iisc)\.ac\.in$/;
    if (officialPattern.test(hostname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export type GateDocumentType = 'QUESTION_PAPER' | 'ANSWER_KEY';
export type GateSourceStatus = 'DISCOVERED' | 'DOWNLOADED' | 'PARSED' | 'FAILED';

export interface IGateSourceRecord {
  id: string;
  year: number;
  paper: string; // 'CS'
  title: string;
  documentType: GateDocumentType;
  url: string;
  provider: 'OFFICIAL_GATE';
  status: GateSourceStatus;
  downloadedAt?: string;
  checksum?: string;
  sizeBytes?: number;
  localPath?: string;
  notes?: string;
}

export interface ISourceFilter {
  year?: number;
  paper?: string;
  documentType?: GateDocumentType;
  status?: GateSourceStatus;
}

export class SourceRegistry {
  private sources: Map<string, IGateSourceRecord> = new Map();
  private checksumIndex: Map<string, string> = new Map(); // checksum -> sourceId

  constructor() {
    this.seedDefaultOfficialSources();
  }

  /**
   * Pre-configured repository of verified official GATE CS previous-year paper endpoints.
   */
  private seedDefaultOfficialSources(): void {
    const defaults: IGateSourceRecord[] = [
      {
        id: 'gate-2025-cs1-paper',
        year: 2025,
        paper: 'CS',
        title: 'GATE 2025 Computer Science and Information Technology Question Paper (CS-1)',
        documentType: 'QUESTION_PAPER',
        url: 'https://gate2025.iitr.ac.in/doc/2025/2025_QP/CS1.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2025-cs1-key',
        year: 2025,
        paper: 'CS',
        title: 'GATE 2025 Computer Science and Information Technology Final Answer Key (CS-1)',
        documentType: 'ANSWER_KEY',
        url: 'https://gate2025.iitr.ac.in/doc/2025/2025_Key/CS1_Keys.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2025-cs2-paper',
        year: 2025,
        paper: 'CS',
        title: 'GATE 2025 Computer Science and Information Technology Question Paper (CS-2)',
        documentType: 'QUESTION_PAPER',
        url: 'https://gate2025.iitr.ac.in/doc/2025/2025_QP/CS2.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2025-cs2-key',
        year: 2025,
        paper: 'CS',
        title: 'GATE 2025 Computer Science and Information Technology Final Answer Key (CS-2)',
        documentType: 'ANSWER_KEY',
        url: 'https://gate2025.iitr.ac.in/doc/2025/2025_Key/CS2_Keys.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2024-cs-paper',
        year: 2024,
        paper: 'CS',
        title: 'GATE 2024 Computer Science and Information Technology Question Paper (CS-1)',
        documentType: 'QUESTION_PAPER',
        url: 'https://gate2026.iitg.ac.in/doc/download/2024/CS124S5.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2024-cs-key',
        year: 2024,
        paper: 'CS',
        title: 'GATE 2024 Computer Science and Information Technology Final Answer Key (CS-1)',
        documentType: 'ANSWER_KEY',
        url: 'https://gate2026.iitg.ac.in/doc/download/2024/CS1FinalAnswerKey.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2024-cs2-paper',
        year: 2024,
        paper: 'CS',
        title: 'GATE 2024 Computer Science and Information Technology Question Paper (CS-2)',
        documentType: 'QUESTION_PAPER',
        url: 'https://gate2026.iitg.ac.in/doc/download/2024/CS224S6.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2024-cs2-key',
        year: 2024,
        paper: 'CS',
        title: 'GATE 2024 Computer Science and Information Technology Final Answer Key (CS-2)',
        documentType: 'ANSWER_KEY',
        url: 'https://gate2026.iitg.ac.in/doc/download/2024/CS2FinalAnswerKey.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2023-cs-paper',
        year: 2023,
        paper: 'CS',
        title: 'GATE 2023 Computer Science and Information Technology Question Paper',
        documentType: 'QUESTION_PAPER',
        url: 'https://gate2026.iitg.ac.in/doc/download/2023/cs_2023.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2023-cs-key',
        year: 2023,
        paper: 'CS',
        title: 'GATE 2023 Computer Science and Information Technology Official Master Answer Key',
        documentType: 'ANSWER_KEY',
        url: 'https://gate2026.iitg.ac.in/doc/download/Answer_keys2023/CS_ANS_GATE2023.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2022-cs-paper',
        year: 2022,
        paper: 'CS',
        title: 'GATE 2022 Computer Science and Information Technology Question Paper',
        documentType: 'QUESTION_PAPER',
        url: 'https://gate.iitkgp.ac.in/documents/CS_GATE2022.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
      {
        id: 'gate-2022-cs-key',
        year: 2022,
        paper: 'CS',
        title: 'GATE 2022 Computer Science and Information Technology Official Master Answer Key',
        documentType: 'ANSWER_KEY',
        url: 'https://gate.iitkgp.ac.in/documents/CS_AnswerKey_GATE2022.pdf',
        provider: 'OFFICIAL_GATE',
        status: 'DISCOVERED',
      },
    ];

    for (const item of defaults) {
      this.sources.set(item.id, item);
    }
  }

  public registerSource(record: IGateSourceRecord): void {
    if (!isApprovedDomain(record.url)) {
      throw new Error(`Cannot register source '${record.id}': Domain for '${record.url}' is not on the official GATE allowlist.`);
    }
    this.sources.set(record.id, record);
    if (record.checksum) {
      this.checksumIndex.set(record.checksum, record.id);
    }
  }

  public getSources(filter?: ISourceFilter): IGateSourceRecord[] {
    let list = Array.from(this.sources.values());
    if (!filter) return list;

    if (filter.year !== undefined) {
      list = list.filter((s) => s.year === filter.year);
    }
    if (filter.paper !== undefined) {
      list = list.filter((s) => s.paper.toUpperCase() === filter.paper?.toUpperCase());
    }
    if (filter.documentType !== undefined) {
      list = list.filter((s) => s.documentType === filter.documentType);
    }
    if (filter.status !== undefined) {
      list = list.filter((s) => s.status === filter.status);
    }
    return list;
  }

  public getSourceById(id: string): IGateSourceRecord | undefined {
    return this.sources.get(id);
  }

  public hasSource(id: string): boolean {
    return this.sources.has(id);
  }

  public isChecksumKnown(checksum: string): boolean {
    return this.checksumIndex.has(checksum);
  }

  public getSourceByChecksum(checksum: string): IGateSourceRecord | undefined {
    const id = this.checksumIndex.get(checksum);
    return id ? this.sources.get(id) : undefined;
  }

  public markDownloaded(
    id: string,
    metadata: { checksum: string; localPath?: string; sizeBytes?: number; downloadedAt?: string }
  ): IGateSourceRecord {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source with ID '${id}' not found in registry.`);
    }

    source.status = 'DOWNLOADED';
    source.checksum = metadata.checksum;
    source.localPath = metadata.localPath;
    source.sizeBytes = metadata.sizeBytes;
    source.downloadedAt = metadata.downloadedAt || new Date().toISOString();

    this.checksumIndex.set(metadata.checksum, id);
    return source;
  }

  public markFailed(id: string, errorNote: string): void {
    const source = this.sources.get(id);
    if (source) {
      source.status = 'FAILED';
      source.notes = errorNote;
    }
  }

  public reset(): void {
    this.sources.clear();
    this.checksumIndex.clear();
    this.seedDefaultOfficialSources();
  }
}

export const sourceRegistry = new SourceRegistry();
