/**
 * Official GATE PYQ Extraction Service
 * Coordinates PDF text extraction, question segmentation, figure detection,
 * confidence scoring, and optional validated AI fallback.
 * Strictly operates on trusted documents from sourceRegistry.
 * Does NOT persist extracted questions to MongoDB.
 */

import { sourceRegistry } from '../gateSources/sourceRegistry.js';
import { officialGateSourceService } from '../gateSources/officialGateSource.js';
import { extractPdfText, IPdfExtractionResult } from './pdfExtractor.js';
import { segmentQuestions, IExtractedQuestionCandidate } from './questionSegmenter.js';
import { geminiExtractionFallback } from './geminiExtractionFallback.js';

export interface IPyqExtractionResponse {
  source: {
    id: string;
    year: number;
    paper: string;
    checksum?: string;
    sourceUrl: string;
  };
  totalCandidates: number;
  requiresReview: number;
  questions: IExtractedQuestionCandidate[];
}

export interface IExtractionOptions {
  forceDownload?: boolean;
  useFallback?: boolean;
}

export class PyqExtractionService {
  /**
   * Extracts candidate questions from a trusted official GATE source document.
   */
  public async extractFromSource(
    sourceId: string,
    options?: IExtractionOptions
  ): Promise<IPyqExtractionResponse> {
    const sourceRecord = sourceRegistry.getSourceById(sourceId);
    if (!sourceRecord) {
      throw new Error(`Extraction Error: Source '${sourceId}' is not registered in the official source registry.`);
    }

    if (sourceRecord.documentType !== 'QUESTION_PAPER') {
      throw new Error(`Extraction Error: Source '${sourceId}' is a '${sourceRecord.documentType}', not a QUESTION_PAPER.`);
    }

    // 1. Ensure official document is downloaded into cache
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

    // 2. Extract PDF text and page structure
    const pdfResult: IPdfExtractionResult = await extractPdfText(buffer);
    if (pdfResult.status === 'FAILED') {
      throw new Error(`PDF text extraction failed: ${pdfResult.error}`);
    }

    // 3. Segment into candidate questions
    let candidates: IExtractedQuestionCandidate[] = segmentQuestions(pdfResult.pageTexts);

    // 4. Optional: Run Gemini fallback ONLY for low-confidence candidates (if enabled)
    if (options?.useFallback) {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        // Only run fallback for low confidence text that does not require a figure
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
