/**
 * Official GATE PYQ Import Service
 * Safely persists ONLY valid official PYQs into the Question database.
 * Enforces:
 * - validationStatus === "VALID" requirement (NEEDS_REVIEW and FAILED are never persisted)
 * - Strict preservation of official answers, types, NAT ranges, marks, and dual provenance
 * - Does NOT invent topics, subtopics, concepts, difficulty, or AI analysis
 * - Stable, deterministic ID generation and duplicate protection
 * - Safe transaction / error handling per record
 */

import { sourceRegistry, IGateSourceRecord } from '../gateSources/sourceRegistry.js';
import { pyqValidationService } from './pyqValidation.service.js';
import { IValidatedCandidateQuestion, IValidationRunResult } from './candidateValidator.js';
import { IQuestion, IQuestionSource } from '../../types/question.types.js';

export interface IPyqImportReport {
  sourceId: string;
  answerKeySourceId: string;
  totalCandidates: number;
  validCandidates: number;
  imported: number;
  duplicates: number;
  needsReview: number;
  failed: number;
  importedQuestionIds: string[];
  excludedQuestions: Array<{
    questionNumber: number;
    questionType: string;
    status: string;
    reasons: string[];
  }>;
}

export interface IImportOptions {
  customKeySourceId?: string;
  forceDownload?: boolean;
}

export class OfficialPyqImportService {
  /**
   * Generates a deterministic, stable identifier for an official GATE question.
   * e.g. "gate-2024-cs-q01", "gate-2024-cs-q22"
   */
  public generateQuestionId(year: number | string, paper: string, questionNumber: number): string {
    const qPad = String(questionNumber).padStart(2, '0');
    return `gate-${year}-${paper.toLowerCase()}-q${qPad}`;
  }

  /**
   * Converts a validated candidate question into the standard Question schema.
   * Preserves all official metadata while strictly avoiding invented fields.
   */
  public mapCandidateToQuestion(
    candidate: IValidatedCandidateQuestion,
    sourceRecord: IGateSourceRecord
  ): IQuestion {
    const id = this.generateQuestionId(
      candidate.provenance.year,
      candidate.provenance.paper,
      candidate.questionNumber
    );

    const source: IQuestionSource = {
      type: 'PYQ',
      provider: 'OFFICIAL_GATE',
      exam: candidate.provenance.exam || 'GATE',
      year: candidate.provenance.year,
      paper: candidate.provenance.paper,
      section: candidate.provenance.section || (candidate.questionNumber <= 10 ? 'GA' : 'CS'),
      questionNumber: candidate.questionNumber,
      sourceUrl: sourceRecord.url,
      fetchedAt: sourceRecord.downloadedAt || new Date().toISOString(),
      checksum: candidate.provenance.questionPaperChecksum,
      questionPaperSourceId: candidate.provenance.questionPaperSourceId,
      answerKeySourceId: candidate.provenance.answerKeySourceId,
      questionPaperChecksum: candidate.provenance.questionPaperChecksum,
      answerKeyChecksum: candidate.provenance.answerKeyChecksum,
      notes: `Official GATE PYQ from ${sourceRecord.title}, validated against official master answer key.`,
    };

    return {
      id,
      question: candidate.question,
      questionType: candidate.questionType,
      options: candidate.options,
      correctAnswer: candidate.correctAnswer,
      numericalAnswer: candidate.numericalAnswer,
      marks: candidate.marks,
      year: candidate.provenance.year,
      exam: candidate.provenance.exam || 'GATE CS',
      paper: candidate.provenance.paper,
      section: candidate.provenance.section || (candidate.questionNumber <= 10 ? 'GA' : 'CS'),
      questionNumber: candidate.questionNumber,
      requiresFigure: candidate.requiresFigure,
      extractionConfidence: candidate.extractionConfidence,
      explanation: 'Explanation not available yet.',
      source,
      // Metadata fields left uninvented - to be enriched later via Phase 3B analysis
      subject: undefined,
      topic: undefined,
      subtopic: undefined,
      concepts: [],
      difficulty: undefined,
      aiAnalysis: undefined,
    };
  }

  /**
   * Checks if an official question already exists in the database.
   */
  public isDuplicate(
    candidate: IValidatedCandidateQuestion,
    db: any
  ): boolean {
    const targetId = this.generateQuestionId(
      candidate.provenance.year,
      candidate.provenance.paper,
      candidate.questionNumber
    );

    // 1. Direct ID check
    if (typeof db.findById === 'function' && db.findById(targetId)) {
      return true;
    }

    // 2. Provenance identity check across existing questions
    if (typeof db.findAll === 'function') {
      const allQuestions = db.findAll();
      const match = allQuestions.find(
        (q: any) =>
          q.id === targetId ||
          (q.source?.type === 'PYQ' &&
            String(q.source?.year) === String(candidate.provenance.year) &&
            q.source?.paper?.toUpperCase() === candidate.provenance.paper?.toUpperCase() &&
            q.source?.questionNumber === candidate.questionNumber)
      );
      if (match) return true;
    }

    return false;
  }

  /**
   * Executes the full extraction, answer-key validation, and selective import into Question database.
   * Only questions with validationStatus === "VALID" are inserted.
   */
  public async importOfficialPyqs(
    sourceId: string,
    db: any,
    options?: IImportOptions
  ): Promise<IPyqImportReport> {
    const sourceRecord = sourceRegistry.getSourceById(sourceId);
    if (!sourceRecord) {
      throw new Error(`Import Error: Source '${sourceId}' is not registered in the official source registry.`);
    }

    if (sourceRecord.documentType !== 'QUESTION_PAPER') {
      throw new Error(`Import Error: Source '${sourceId}' is a '${sourceRecord.documentType}', not a QUESTION_PAPER.`);
    }

    // 1. Run full extraction and answer-key validation
    const validationResult: IValidationRunResult = await pyqValidationService.validatePaper(
      sourceId,
      options?.customKeySourceId,
      { forceDownload: options?.forceDownload }
    );

    const importedQuestionIds: string[] = [];
    const excludedQuestions: Array<{
      questionNumber: number;
      questionType: string;
      status: string;
      reasons: string[];
    }> = [];

    let importedCount = 0;
    let duplicateCount = 0;

    // 2. Iterate through candidate questions
    for (const candidate of validationResult.questions) {
      // Exclude NEEDS_REVIEW and FAILED
      if (candidate.validationStatus !== 'VALID') {
        excludedQuestions.push({
          questionNumber: candidate.questionNumber,
          questionType: candidate.questionType,
          status: candidate.validationStatus,
          reasons: candidate.validationIssues,
        });
        continue;
      }

      // 3. Duplicate Detection
      if (this.isDuplicate(candidate, db)) {
        duplicateCount++;
        continue;
      }

      // 4. Map candidate to standard Question schema
      const questionRecord = this.mapCandidateToQuestion(candidate, sourceRecord);

      // 5. Persist safely
      try {
        if (typeof db.create === 'function') {
          db.create(questionRecord);
          importedQuestionIds.push(questionRecord.id);
          importedCount++;
        }
      } catch (err: any) {
        console.error(`[PYQ Import] Failed to insert Q.${candidate.questionNumber}:`, err.message);
        excludedQuestions.push({
          questionNumber: candidate.questionNumber,
          questionType: candidate.questionType,
          status: 'WRITE_ERROR',
          reasons: [err.message || 'Database write error'],
        });
      }
    }

    return {
      sourceId,
      answerKeySourceId: validationResult.answerKeySourceId,
      totalCandidates: validationResult.total,
      validCandidates: validationResult.valid,
      imported: importedCount,
      duplicates: duplicateCount,
      needsReview: validationResult.needsReview,
      failed: validationResult.failed,
      importedQuestionIds,
      excludedQuestions,
    };
  }
}

export const officialPyqImportService = new OfficialPyqImportService();
