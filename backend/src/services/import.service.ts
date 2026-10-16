import crypto from 'node:crypto';
import { IQuestion, IQuestionInput, IImportSummary, IImportValidationFailure, IImportDuplicateDetail } from '../types/question.types.js';
import { validateAndNormalizeQuestion } from '../validators/questionValidator.js';
import { getQuestionRepository } from '../repositories/index.js';

export function computeQuestionHash(text: string): string {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function computeProvenanceKey(q: IQuestion | IQuestionInput): string | null {
  const source = q.source;
  const qNum = source?.questionNumber || q.questionNumber;
  const year = source?.year || q.year;
  const exam = source?.exam || q.exam || 'GATE';
  const paper = source?.paper || q.paper || 'CS';

  if (qNum && year) {
    return `${exam.toUpperCase()}-${year}-${paper.toUpperCase()}-Q${qNum}`;
  }
  return null;
}

export class ImportService {
  async importQuestions(rawQuestions: any[]): Promise<IImportSummary> {
    const summary: IImportSummary = {
      total: Array.isArray(rawQuestions) ? rawQuestions.length : 0,
      valid: 0,
      imported: 0,
      duplicates: 0,
      failed: 0,
      errors: [],
      duplicateDetails: [],
    };

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return summary;
    }

    const repo = getQuestionRepository();
    const existingQuestions = await repo.findAll();

    // Map existing hashes and provenance keys
    const existingHashes = new Set<string>();
    const existingProvenanceKeys = new Set<string>();
    const existingIds = new Set<string>();

    for (const eq of existingQuestions) {
      existingIds.add(eq.id);
      existingHashes.add(computeQuestionHash(eq.question));
      const provKey = computeProvenanceKey(eq);
      if (provKey) {
        existingProvenanceKeys.add(provKey);
      }
    }

    // Track within current batch to prevent duplicates inside the same import file
    const batchHashes = new Set<string>();
    const batchProvenanceKeys = new Set<string>();
    const batchIds = new Set<string>();

    const validQuestionsToInsert: IQuestionInput[] = [];

    for (let idx = 0; idx < rawQuestions.length; idx++) {
      const raw = rawQuestions[idx];
      const validation = validateAndNormalizeQuestion(raw, idx);

      if (!validation.isValid || !validation.normalized) {
        summary.failed++;
        summary.errors.push({
          index: idx,
          id: raw?.id,
          errors: validation.errors,
          snippet: typeof raw?.question === 'string' ? raw.question.slice(0, 80) : undefined,
        });
        continue;
      }

      summary.valid++;
      const normalized = validation.normalized;

      // 1. Check duplicate ID
      if (existingIds.has(normalized.id) || batchIds.has(normalized.id)) {
        summary.duplicates++;
        summary.duplicateDetails.push({
          index: idx,
          id: normalized.id,
          reason: `Question ID "${normalized.id}" already exists in the question bank.`,
          snippet: normalized.question.slice(0, 80),
        });
        continue;
      }

      // 2. Check duplicate Provenance Key (for PYQs e.g. GATE-2023-CS-Q42)
      const provKey = computeProvenanceKey(normalized);
      if (provKey && (existingProvenanceKeys.has(provKey) || batchProvenanceKeys.has(provKey))) {
        summary.duplicates++;
        summary.duplicateDetails.push({
          index: idx,
          id: normalized.id,
          reason: `Duplicate PYQ record with key "${provKey}" already exists.`,
          snippet: normalized.question.slice(0, 80),
        });
        continue;
      }

      // 3. Check duplicate Question Content Hash
      const qHash = computeQuestionHash(normalized.question);
      if (existingHashes.has(qHash) || batchHashes.has(qHash)) {
        summary.duplicates++;
        summary.duplicateDetails.push({
          index: idx,
          id: normalized.id,
          reason: `Duplicate question content detected (identical normalized text).`,
          snippet: normalized.question.slice(0, 80),
        });
        continue;
      }

      // Mark in batch tracker
      batchIds.add(normalized.id);
      if (provKey) batchProvenanceKeys.add(provKey);
      batchHashes.add(qHash);

      validQuestionsToInsert.push(normalized);
    }

    // Insert valid non-duplicate questions
    if (validQuestionsToInsert.length > 0) {
      await repo.createMany(validQuestionsToInsert);
      summary.imported = validQuestionsToInsert.length;
    }

    return summary;
  }
}

export const importService = new ImportService();
