/**
 * Official GATE PYQ Import Service (JS Implementation)
 */

import { sourceRegistry } from '../gateSources/sourceRegistry.js';
import { pyqValidationService } from './pyqValidation.service.js';

export class OfficialPyqImportService {
  generateQuestionId(year, paper, questionNumber, sessionCode) {
    const qPad = String(questionNumber).padStart(2, '0');
    let paperCode = paper.toLowerCase();
    if (sessionCode) {
      const normSession = sessionCode.replace(/[\s-]/g, '').toLowerCase();
      if (normSession === 'cs2' || normSession === 's2' || normSession === '2') {
        paperCode = 'cs2';
      } else if ((normSession === 'cs1' || normSession === 's1' || normSession === '1') && String(year) === '2025') {
        paperCode = 'cs1';
      }
    }
    return `gate-${year}-${paperCode}-q${qPad}`;
  }

  mapCandidateToQuestion(candidate, sourceRecord) {
    const sessionMatch = (sourceRecord.id + ' ' + (sourceRecord.title || '')).match(/\b(CS[-\s]?[12]|CS[12])\b/i);
    const sessionCode = sessionMatch ? sessionMatch[1] : undefined;
    const id = this.generateQuestionId(
      candidate.provenance.year,
      candidate.provenance.paper,
      candidate.questionNumber,
      sessionCode
    );

    const source = {
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
      imageUrl: candidate.imageUrl,
      extractionConfidence: candidate.extractionConfidence,
      explanation: 'Explanation not available yet.',
      source,
      subject: undefined,
      topic: undefined,
      subtopic: undefined,
      concepts: [],
      difficulty: undefined,
      aiAnalysis: undefined,
    };
  }

  isDuplicate(candidate, db, sessionCode) {
    const targetId = this.generateQuestionId(
      candidate.provenance.year,
      candidate.provenance.paper,
      candidate.questionNumber,
      sessionCode
    );

    if (typeof db.findById === 'function' && db.findById(targetId)) {
      return true;
    }

    if (typeof db.findAll === 'function') {
      const allQuestions = db.findAll();
      const match = allQuestions.find(
        (q) =>
          q.id === targetId ||
          (q.source?.type === 'PYQ' &&
            String(q.source?.year) === String(candidate.provenance.year) &&
            q.source?.paper?.toUpperCase() === candidate.provenance.paper?.toUpperCase() &&
            q.source?.questionPaperSourceId === candidate.provenance.questionPaperSourceId &&
            q.source?.questionNumber === candidate.questionNumber)
      );
      if (match) return true;
    }

    return false;
  }

  async importOfficialPyqs(sourceId, db, options) {
    const sourceRecord = sourceRegistry.getSourceById(sourceId);
    if (!sourceRecord) {
      throw new Error(`Import Error: Source '${sourceId}' is not registered in the official source registry.`);
    }

    if (sourceRecord.documentType !== 'QUESTION_PAPER') {
      throw new Error(`Import Error: Source '${sourceId}' is a '${sourceRecord.documentType}', not a QUESTION_PAPER.`);
    }

    const validationResult = await pyqValidationService.validatePaper(
      sourceId,
      options?.customKeySourceId,
      { forceDownload: options?.forceDownload }
    );

    const importedQuestionIds = [];
    const excludedQuestions = [];

    let importedCount = 0;
    let duplicateCount = 0;

    const sessionMatch = (sourceRecord.id + ' ' + (sourceRecord.title || '')).match(/\b(CS[-\s]?[12]|CS[12])\b/i);
    const sessionCode = sessionMatch ? sessionMatch[1] : undefined;

    for (const candidate of validationResult.questions) {
      if (candidate.validationStatus !== 'VALID') {
        excludedQuestions.push({
          questionNumber: candidate.questionNumber,
          questionType: candidate.questionType,
          status: candidate.validationStatus,
          reasons: candidate.validationIssues,
        });
        continue;
      }

      if (this.isDuplicate(candidate, db, sessionCode)) {
        duplicateCount++;
        continue;
      }

      const questionRecord = this.mapCandidateToQuestion(candidate, sourceRecord);

      try {
        if (typeof db.create === 'function') {
          db.create(questionRecord);
          importedQuestionIds.push(questionRecord.id);
          importedCount++;
        }
      } catch (err) {
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
