import crypto from 'node:crypto';
import { validateAndNormalizeQuestion } from '../validators/questionValidator.js';

export function computeQuestionHash(text) {
  const normalized = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function computeProvenanceKey(q) {
  const source = q.source || {};
  const qNum = source.questionNumber || q.questionNumber;
  const year = source.year || q.year;
  const exam = source.exam || q.exam || 'GATE';
  const paper = source.paper || q.paper || 'CS';

  if (qNum && year) {
    return `${exam.toUpperCase()}-${year}-${paper.toUpperCase()}-Q${qNum}`;
  }
  return null;
}

export class ImportService {
  async importQuestions(rawQuestions, dbInstance) {
    const summary = {
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

    const existingQuestions = dbInstance.findAll({});

    const existingHashes = new Set();
    const existingProvenanceKeys = new Set();
    const existingIds = new Set();

    for (const eq of existingQuestions) {
      existingIds.add(eq.id);
      existingHashes.add(computeQuestionHash(eq.question));
      const provKey = computeProvenanceKey(eq);
      if (provKey) {
        existingProvenanceKeys.add(provKey);
      }
    }

    const batchHashes = new Set();
    const batchProvenanceKeys = new Set();
    const batchIds = new Set();

    const validQuestionsToInsert = [];

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

      // 2. Check duplicate Provenance Key (for PYQs)
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

      batchIds.add(normalized.id);
      if (provKey) batchProvenanceKeys.add(provKey);
      batchHashes.add(qHash);

      validQuestionsToInsert.push(normalized);
    }

    // Insert valid non-duplicate questions
    if (validQuestionsToInsert.length > 0) {
      for (const q of validQuestionsToInsert) {
        dbInstance.create(q);
      }
      summary.imported = validQuestionsToInsert.length;
    }

    return summary;
  }
}

export const importService = new ImportService();
