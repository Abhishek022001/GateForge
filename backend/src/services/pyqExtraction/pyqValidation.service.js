/**
 * Official GATE PYQ Validation Service (JS Implementation)
 */

import { sourceRegistry } from '../gateSources/sourceRegistry.js';
import { officialGateSourceService } from '../gateSources/officialGateSource.js';
import { pyqExtractionService } from './pyqExtraction.service.js';
import { extractAnswerKeyFromPdf } from './answerKeyExtractor.js';
import { validateAndMapCandidates } from './candidateValidator.js';

export class PyqValidationService {
  resolveMatchingAnswerKey(paperSource) {
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

    if (candidates.length === 1) {
      const candidate = candidates[0];
      this.verifyPaperKeyCompatibility(paperSource, candidate);
      return candidate;
    }

    const paperSet = this.extractSetIdentifier(paperSource.id + ' ' + paperSource.title);
    const matched = candidates.find((k) => {
      const keySet = this.extractSetIdentifier(k.id + ' ' + k.title);
      return paperSet && keySet && paperSet === keySet;
    });

    if (matched) {
      this.verifyPaperKeyCompatibility(paperSource, matched);
      return matched;
    }

    const fallback = candidates[0];
    this.verifyPaperKeyCompatibility(paperSource, fallback);
    return fallback;
  }

  extractSetIdentifier(str) {
    const match = str.match(/\b(CS[-\s]?\d|CS\d)\b/i);
    return match ? match[1].replace(/[\s-]/g, '').toUpperCase() : null;
  }

  verifyPaperKeyCompatibility(paperSource, keySource) {
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

  async validatePaper(paperSourceId, customKeySourceId, options) {
    const paperSource = sourceRegistry.getSourceById(paperSourceId);
    if (!paperSource) {
      throw new Error(`Validation Error: Question paper source '${paperSourceId}' is not registered.`);
    }

    let keySource;
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

    const extractionResponse = await pyqExtractionService.extractFromSource(paperSourceId, {
      forceDownload: options?.forceDownload,
    });

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

    const answerKeyResult = await extractAnswerKeyFromPdf(keyBuffer);

    const paperChecksum = extractionResponse.source.checksum || officialGateSourceService.computeChecksum(
      officialGateSourceService.getDownloadedBuffer(paperSource.id) || Buffer.from('')
    );
    const keyChecksum = keySource.checksum || officialGateSourceService.computeChecksum(keyBuffer);

    const validationResult = validateAndMapCandidates(
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
