/**
 * Official GATE PYQ Extraction Service (JS Implementation)
 */

import { sourceRegistry } from '../gateSources/sourceRegistry.js';
import { officialGateSourceService } from '../gateSources/officialGateSource.js';
import { extractPdfText } from './pdfExtractor.js';
import { segmentQuestions } from './questionSegmenter.js';
import { geminiExtractionFallback } from './geminiExtractionFallback.js';
import { extractFiguresForSource } from './figureExtractor.js';

export class PyqExtractionService {
  async extractFromSource(sourceId, options) {
    const sourceRecord = sourceRegistry.getSourceById(sourceId);
    if (!sourceRecord) {
      throw new Error(`Extraction Error: Source '${sourceId}' is not registered in the official source registry.`);
    }

    if (sourceRecord.documentType !== 'QUESTION_PAPER') {
      throw new Error(`Extraction Error: Source '${sourceId}' is a '${sourceRecord.documentType}', not a QUESTION_PAPER.`);
    }

    let buffer = officialGateSourceService.getDownloadedBuffer(sourceId);
    if (!buffer || options?.forceDownload) {
      const dlResult = await officialGateSourceService.downloadSource(sourceId, {
        force: options?.forceDownload,
      });
      if (!dlResult.success) {
        throw new Error(`Failed to acquire official PDF for source '${sourceId}': ${dlResult.error}`);
      }
      buffer = officialGateSourceService.getDownloadedBuffer(sourceId);
    }

    if (!buffer || buffer.length === 0) {
      throw new Error(`Could not read downloaded PDF buffer for source '${sourceId}'.`);
    }

    const pdfResult = await extractPdfText(buffer);
    if (pdfResult.status === 'FAILED') {
      throw new Error(`PDF text extraction failed: ${pdfResult.error}`);
    }

    let candidates = segmentQuestions(pdfResult.pageTexts);

    const localPdfPath = officialGateSourceService.getDownloadedPath(sourceId);
    if (localPdfPath) {
      try {
        const figureMap = extractFiguresForSource(localPdfPath, sourceId);
        for (const c of candidates) {
          if (c.requiresFigure && figureMap[c.questionNumber]) {
            c.imageUrl = figureMap[c.questionNumber];
          }
        }
      } catch (err) {
        console.warn(`[PYQ Extraction] Could not extract figures for ${sourceId}:`, err.message);
      }
    }

    if (options?.useFallback) {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c.extractionConfidence < 0.60 && !c.requiresFigure) {
          const refined = await geminiExtractionFallback.refineQuestionCandidate({
            questionNumber: c.questionNumber,
            rawText: c.rawQuestionText,
            pageNumber: c.pageNumber,
          });
          if (refined) {
            candidates[i] = refined;
          }
        }
      }
    }

    const requiresReviewCount = candidates.filter((q) => q.requiresReview).length;

    return {
      source: {
        id: sourceRecord.id,
        year: sourceRecord.year,
        paper: sourceRecord.paper,
        checksum: sourceRecord.checksum,
        sourceUrl: sourceRecord.url,
      },
      totalCandidates: candidates.length,
      requiresReview: requiresReviewCount,
      questions: candidates,
    };
  }
}

export const pyqExtractionService = new PyqExtractionService();
