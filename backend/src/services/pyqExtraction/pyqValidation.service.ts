/**
 * Official GATE PYQ Validation Service
 * Orchestrates:
 * 1. Matching official answer-key resolution (enforcing exam, year, paper, set alignment)
 * 2. Question-paper candidate extraction
 * 3. Answer-key extraction & normalization
 * 4. Merging candidates with official answer keys
 * 5. Producing final validated candidate records
 * Strictly does NOT import questions into MongoDB.
 */

import { sourceRegistry, IGateSourceRecord } from '../gateSources/sourceRegistry.js';
import { officialGateSourceService } from '../gateSources/officialGateSource.js';
import { pyqExtractionService } from './pyqExtraction.service.js';
import { extractAnswerKeyFromPdf, IOfficialAnswerKeyResult } from './answerKeyExtractor.js';
import { validateAndMapCandidates, IValidationRunResult } from './candidateValidator.js';

export interface IValidationServiceOptions {
  forceDownload?: boolean;
}

export class PyqValidationService {
  /**
   * Resolves the matching official answer-key record for a given question-paper record.
   * Enforces that year, paper, and set/session explicitly align.
   */
  public resolveMatchingAnswerKey(paperSource: IGateSourceRecord): IGateSourceRecord {
    const candidates = sourceRegistry.getSources({
      year: paperSource.year,
      paper: paperSource.paper,
      documentType: 'ANSWER_KEY',
    });

    if (candidates.length === 0) {
      throw new Error(
        `No registered official answer key found for paper '${paperSource.id}' (${paperSource.year} ${paperSource.paper}).`
      );
    }

    // If only one answer key exists for this year and paper, check if sets match
    if (candidates.length === 1) {
      const candidate = candidates[0];
      this.verifyPaperKeyCompatibility(paperSource, candidate);
      return candidate;
    }

    // If multiple exist (e.g. CS-1 vs CS-2), find the one with matching set/session
    const paperSet = this.extractSetIdentifier(paperSource.id + ' ' + paperSource.title);
    const matched = candidates.find((k) => {
      const keySet = this.extractSetIdentifier(k.id + ' ' + k.title);
      return paperSet && keySet && paperSet === keySet;
    });

    if (matched) {
      this.verifyPaperKeyCompatibility(paperSource, matched);
      return matched;
    }

    // Fallback: pick the first matching and verify compatibility
    const fallback = candidates[0];
    this.verifyPaperKeyCompatibility(paperSource, fallback);
    return fallback;
  }

  /**
   * Extracts set identifier (e.g. 'CS-1', 'CS1', 'CS-2', 'CS2') from string.
   */
  private extractSetIdentifier(str: string): string | null {
    const match = str.match(/\b(CS[-\s]?\d|CS\d)\b/i);
    return match ? match[1].replace(/[\s-]/g, '').toUpperCase() : null;
  }

  /**
   * Strictly verifies compatibility between question paper and answer key records.
   */
  public verifyPaperKeyCompatibility(paperSource: IGateSourceRecord, keySource: IGateSourceRecord): void {
    if (paperSource.documentType !== 'QUESTION_PAPER') {
      throw new Error(`Invalid source '${paperSource.id}': Expected documentType 'QUESTION_PAPER', got '${paperSource.documentType}'.`);
    }
    if (keySource.documentType !== 'ANSWER_KEY') {
      throw new Error(`Invalid answer key '${keySource.id}': Expected documentType 'ANSWER_KEY', got '${keySource.documentType}'.`);
    }
    if (paperSource.year !== keySource.year) {
      throw new Error(
        `Year mismatch: Question paper is from year ${paperSource.year}, but answer key is from year ${keySource.year}.`
      );
    }
    if (paperSource.paper.toUpperCase() !== keySource.paper.toUpperCase()) {
      throw new Error(
        `Paper mismatch: Question paper is '${paperSource.paper}', but answer key is '${keySource.paper}'.`
      );
    }

    const paperSet = this.extractSetIdentifier(paperSource.id + ' ' + paperSource.title);
    const keySet = this.extractSetIdentifier(keySource.id + ' ' + keySource.title);
    if (paperSet && keySet && paperSet !== keySet) {
      throw new Error(
        `Set mismatch: Question paper is for set '${paperSet}', but answer key is for set '${keySet}'.`
      );
    }
  }

  /**
   * Executes the full extraction and answer-key validation pipeline for a question paper.
   */
  public async validatePaper(
    paperSourceId: string,
    customKeySourceId?: string,
    options?: IValidationServiceOptions
  ): Promise<IValidationRunResult> {
    // 1. Retrieve question paper source
    const paperSource = sourceRegistry.getSourceById(paperSourceId);
    if (!paperSource) {
      throw new Error(`Validation Error: Question paper source '${paperSourceId}' is not registered.`);
    }

    // 2. Resolve or verify matching answer key
    let keySource: IGateSourceRecord;
    if (customKeySourceId) {
      const customKey = sourceRegistry.getSourceById(customKeySourceId);
      if (!customKey) {
        throw new Error(`Validation Error: Specified answer key source '${customKeySourceId}' is not registered.`);
      }
      this.verifyPaperKeyCompatibility(paperSource, customKey);
      keySource = customKey;
    } else {
      keySource = this.resolveMatchingAnswerKey(paperSource);
    }

    // 3. Extract candidate questions from question paper
    const extractionResponse = await pyqExtractionService.extractFromSource(paperSourceId, {
      forceDownload: options?.forceDownload,
    });

    // 4. Download and extract official answer key
    let keyBuffer = officialGateSourceService.getDownloadedBuffer(keySource.id);
    if (!keyBuffer || options?.forceDownload) {
      const dlResult = await officialGateSourceService.downloadSource(keySource.id, {
        force: options?.forceDownload,
      });
      if (!dlResult.success) {
        throw new Error(`Failed to download official answer key '${keySource.id}': ${dlResult.error}`);
      }
      keyBuffer = officialGateSourceService.getDownloadedBuffer(keySource.id);
    }

    if (!keyBuffer || keyBuffer.length === 0) {
      throw new Error(`Could not read downloaded buffer for answer key '${keySource.id}'.`);
    }

    const answerKeyResult: IOfficialAnswerKeyResult = await extractAnswerKeyFromPdf(keyBuffer);

    // 5. Checksums for provenance
    const paperChecksum = extractionResponse.source.checksum || officialGateSourceService.computeChecksum(
      officialGateSourceService.getDownloadedBuffer(paperSource.id) || Buffer.from('')
    );
    const keyChecksum = keySource.checksum || officialGateSourceService.computeChecksum(keyBuffer);

    // 6. Map and validate candidate questions against official answer key
    const validationResult: IValidationRunResult = validateAndMapCandidates(
      extractionResponse.questions,
      answerKeyResult.records,
      {
        paperSource,
        keySource,
        paperChecksum,
        keyChecksum,
      }
    );

    return validationResult;
  }
}

export const pyqValidationService = new PyqValidationService();
