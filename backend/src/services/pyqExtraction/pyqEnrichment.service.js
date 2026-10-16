/**
 * Official GATE PYQ Enrichment Service (JS Implementation)
 */

import { sourceRegistry } from '../gateSources/sourceRegistry.js';
import { questionAnalysisService } from '../ai/questionAnalysis.service.js';

export function isOfficialPyq(q) {
  if (!q) return false;
  if (q.source?.type === 'MANUAL' || q.source?.type === 'SEED') {
    return false;
  }
  if (
    (q.source?.type === 'PYQ' || q.source?.type === 'OFFICIAL_PYQ') &&
    (q.source?.provider === 'OFFICIAL_GATE' || Boolean(q.provenance) || Boolean(q.source?.questionPaperSourceId))
  ) {
    return true;
  }
  if (q.source?.provider === 'OFFICIAL_GATE') {
    return true;
  }
  if (typeof q.id === 'string' && /^gate-\d{4}-[a-z0-9]+-q\d+/i.test(q.id) && q.source?.type !== 'MANUAL') {
    return true;
  }
  return false;
}

export class ContextCache {
  constructor() {
    this.cache = new Map();
  }

  makeKey(query) {
    const s = (query.subject || '').toLowerCase().trim();
    const t = (query.topic || '').toLowerCase().trim();
    const d = (query.difficulty || '').toLowerCase().trim();
    const lim = query.limit || 5;
    const ga = query.excludeGA !== false;
    const fb = query.allowDevelopmentFallback === true;
    const concepts = Array.isArray(query.concepts) ? query.concepts.map((c) => c.toLowerCase().trim()).sort().join(',') : '';
    const reasoning = Array.isArray(query.reasoningType) ? query.reasoningType.map((r) => r.toLowerCase().trim()).sort().join(',') : '';
    return `${s}|${t}|${d}|${lim}|${ga}|${fb}|${concepts}|${reasoning}`;
  }

  get(query) {
    return this.cache.get(this.makeKey(query));
  }

  set(query, results) {
    this.cache.set(this.makeKey(query), results);
  }

  invalidate() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

export class PyqEnrichmentService {
  constructor() {
    this.contextCache = new ContextCache();
    this.lastDb = null;
  }

  invalidateContextCache() {
    this.contextCache.invalidate();
  }

  getContextCacheSize() {
    return this.contextCache.size();
  }
  async enrichOfficialPyqs(sourceId, db, options = {}) {
    const sourceRecord = sourceRegistry.getSourceById(sourceId);
    if (!sourceRecord) {
      throw new Error(`Enrichment Error: Source '${sourceId}' is not registered in the official source registry.`);
    }

    if (sourceRecord.documentType !== 'QUESTION_PAPER') {
      throw new Error(`Enrichment Error: Source '${sourceId}' is a '${sourceRecord.documentType}', not a QUESTION_PAPER.`);
    }

    const allQuestions = typeof db.findAll === 'function' ? db.findAll() : [];
    let sourceQuestions = allQuestions.filter(
      (q) => q.source?.questionPaperSourceId === sourceId
    );

    if (sourceQuestions.length === 0) {
      sourceQuestions = allQuestions.filter(
        (q) =>
          q.source?.type === 'PYQ' &&
          String(q.source?.year) === String(sourceRecord.year) &&
          q.source?.paper?.toUpperCase() === sourceRecord.paper?.toUpperCase()
      );
    }

    if (sourceQuestions.length === 0) {
      return {
        sourceId,
        total: 0,
        analyzed: 0,
        skipped: 0,
        failed: 0,
        results: [],
      };
    }

    let targetQuestions = sourceQuestions;
    if (options.limit && options.limit > 0) {
      targetQuestions = targetQuestions.slice(0, options.limit);
    }

    const targetIds = targetQuestions.map((q) => q.id);

    const concurrency = Math.max(1, Math.min(4, options.concurrency || 2));
    const bulkResult = await questionAnalysisService.analyzeBulk(targetIds, db, {
      force: options.force,
      concurrency,
    });

    const enrichedResults = bulkResult.results.map((r) => {
      const q = typeof db.findById === 'function' ? db.findById(r.questionId) : null;
      return {
        questionId: r.questionId,
        status: r.status,
        subject: q?.subject || r.aiAnalysis?.subject,
        topic: q?.topic || r.aiAnalysis?.topic,
        error: r.error,
      };
    });

    return {
      sourceId,
      total: targetIds.length,
      analyzed: bulkResult.analyzed,
      skipped: bulkResult.skipped,
      failed: bulkResult.failed,
      results: enrichedResults,
    };
  }

  getGenerationContext(query, db) {
    const limit = Math.max(1, Math.min(20, query.limit || 5));
    const excludeGA = query.excludeGA !== false;
    const allowDevFallback = query.allowDevelopmentFallback === true;

    if (typeof db?.findAll !== 'function') {
      return [];
    }

    if (this.lastDb && this.lastDb !== db) {
      this.contextCache.invalidate();
    }
    this.lastDb = db;

    const cached = this.contextCache.get(query);
    if (cached) {
      return cached;
    }

    const allQuestions = (typeof db.findAll === 'function' ? db.findAll() : []) || [];

    // Strict Grounding Filter: ONLY genuine official GATE PYQs are eligible by default
    let pool = allQuestions.filter((q) => {
      if (isOfficialPyq(q)) return true;
      if (allowDevFallback && (q.source?.type === 'MANUAL' || !q.source)) return true;
      return false;
    });

    // Exclude General Aptitude when generating technical CS context
    if (excludeGA) {
      pool = pool.filter(
        (q) =>
          (q.subject || '').toLowerCase() !== 'general aptitude' &&
          q.source?.section !== 'GA'
      );
    }

function normalizeSubject(s) {
  if (!s || typeof s !== 'string') return '';
  const lower = s.toLowerCase().trim();
  if (lower === 'dbms' || lower.includes('database')) return 'dbms';
  if (lower === 'os' || lower.includes('operating system')) return 'os';
  if (lower === 'toc' || lower.includes('theory of computation') || lower.includes('automata')) return 'toc';
  if (lower === 'coa' || lower.includes('computer organization') || lower.includes('architecture')) return 'coa';
  if (lower === 'cn' || lower.includes('computer network') || lower.includes('networking')) return 'cn';
  if (lower === 'ds' || lower.includes('data structure')) return 'ds';
  if (lower === 'algo' || lower.includes('algorithm')) return 'algo';
  if (lower === 'cd' || lower.includes('compiler')) return 'cd';
  if (lower === 'dl' || lower === 'dld' || lower.includes('digital logic')) return 'dl';
  if (lower.includes('discrete math')) return 'discrete_math';
  if (lower.includes('engineering math') || lower === 'math' || lower === 'maths') return 'eng_math';
  if (lower === 'ga' || lower.includes('general aptitude') || lower.includes('aptitude')) return 'ga';
  return lower;
}

    // If query.subject is specified, strictly filter to matching subject
    if (query.subject) {
      const qSubNorm = normalizeSubject(query.subject);
      const qSubLower = query.subject.toLowerCase();
      pool = pool.filter((q) => {
        if (!q.subject || typeof q.subject !== 'string' || !q.subject.trim()) {
          return false;
        }
        const sNorm = normalizeSubject(q.subject);
        const sLower = q.subject.toLowerCase();
        return (
          (sNorm && qSubNorm && sNorm === qSubNorm) ||
          sLower === qSubLower ||
          sLower.includes(qSubLower) ||
          qSubLower.includes(sLower)
        );
      });
    }

    // If no relevant official PYQs exist for this query, return empty context (triggers NO_GENERATION_CONTEXT)
    if (pool.length === 0) {
      return [];
    }

    // Prioritize analyzed questions for this selection; fallback to available questions if none are analyzed yet
    const analyzedPool = pool.filter((q) => Boolean(q.aiAnalysis?.analyzed));
    const candidatePool = analyzedPool.length > 0 ? analyzedPool : pool;

    const scored = [];

    for (const q of candidatePool) {
      let score = 0;
      const reasons = [];

      if (query.subject && q.subject) {
        const qSubNorm = normalizeSubject(query.subject);
        const sNorm = normalizeSubject(q.subject);
        if (sNorm === qSubNorm || q.subject.toLowerCase() === query.subject.toLowerCase()) {
          score += 100;
          reasons.push(`Subject match: ${q.subject}`);
        } else {
          score += 80;
          reasons.push(`Subject alias match: ${q.subject}`);
        }
      }

      if (query.topic && q.topic) {
        if (
          q.topic.toLowerCase().includes(query.topic.toLowerCase()) ||
          query.topic.toLowerCase().includes(q.topic.toLowerCase())
        ) {
          score += 50;
          reasons.push(`Topic match: ${q.topic}`);
        }
      }

      if (Array.isArray(query.concepts) && query.concepts.length > 0 && Array.isArray(q.concepts)) {
        const qConcepts = q.concepts.map((c) => c.toLowerCase());
        for (const c of query.concepts) {
          const cLower = c.toLowerCase();
          if (qConcepts.some((qc) => qc.includes(cLower) || cLower.includes(qc))) {
            score += 20;
            reasons.push(`Concept match: ${c}`);
          }
        }
      }

      if (Array.isArray(query.reasoningType) && query.reasoningType.length > 0 && Array.isArray(q.reasoningType)) {
        const qReasoning = q.reasoningType.map((r) => r.toLowerCase());
        for (const r of query.reasoningType) {
          if (qReasoning.includes(r.toLowerCase())) {
            score += 10;
            reasons.push(`Reasoning match: ${r}`);
          }
        }
      }

      if (query.difficulty && q.difficulty) {
        if (q.difficulty.toLowerCase() === query.difficulty.toLowerCase()) {
          score += 10;
          reasons.push(`Difficulty match: ${q.difficulty}`);
        }
      }

      scored.push({ question: q, score, matchReasons: reasons });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.question.questionNumber || 0) - (b.question.questionNumber || 0);
    });

    const results = scored.slice(0, limit).map((s) => s.question);
    this.contextCache.set(query, results);
    return results;
  }
}

export const pyqEnrichmentService = new PyqEnrichmentService();

export function invalidateContextCache() {
  pyqEnrichmentService.invalidateContextCache();
}

export function getContextCacheSize() {
  return pyqEnrichmentService.getContextCacheSize();
}
