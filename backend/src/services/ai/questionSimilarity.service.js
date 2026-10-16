/**
 * Question Similarity Service
 * Checkpoint 3C.5: Originality and Duplicate-Prevention Safeguard (ESM)
 * Combines token Jaccard, Sorensen-Dice coefficient, token containment,
 * bi-gram/tri-gram shingle overlap, and substitution-normalized structural analysis.
 */

import { SIMILARITY_THRESHOLDS, GENERIC_FRAMING_PHRASES } from '../../constants/similarity.js';

export class QuestionSimilarityService {
  constructor(threshold = SIMILARITY_THRESHOLDS.REJECT_THRESHOLD) {
    this.threshold = threshold;
  }

  getThreshold() {
    return this.threshold;
  }

  /**
   * Base normalization: lowercase, Unicode NFKC, strip LaTeX spacing, collapse whitespace,
   * remove superficial punctuation while preserving mathematical operators.
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') return '';

    let norm = text.normalize('NFKC').toLowerCase();

    // Remove LaTeX formatting commands that don't alter content (including \; \, \! \ )
    norm = norm.replace(/\\[a-zA-Z]+|\\[;,! ]/g, (match) => {
      const spacingCommands = new Set([
        '\\quad',
        '\\qquad',
        '\\;',
        '\\,',
        '\\!',
        '\\ ',
        '\\vfill',
        '\\hfill',
        '\\displaystyle',
        '\\text',
      ]);
      return spacingCommands.has(match) ? ' ' : match;
    });

    // Normalize LaTeX dollar signs
    norm = norm.replace(/\$\$/g, '$');

    // Remove trivial punctuation: commas, semicolons, colons, quotes, exclamation marks, question marks
    norm = norm.replace(/[.,;:!?'"`~]/g, ' ');

    // Normalize brackets and parentheses
    norm = norm.replace(/[\{\}]/g, '');

    // Collapse multiple whitespace
    norm = norm.replace(/\s+/g, ' ').trim();

    return norm;
  }

  /**
   * Strip generic GATE CS boilerplate framing phrases so they don't artificially inflate similarity.
   */
  stripFraming(text) {
    let result = this.normalizeText(text);
    for (const phrase of GENERIC_FRAMING_PHRASES) {
      const normPhrase = this.normalizeText(phrase);
      result = result.replace(new RegExp(`\\b${normPhrase}\\b`, 'gi'), ' ');
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  /**
   * Secondary substitution-normalized representation:
   * Replaces numbers with <NUM>, process identifiers with <PROC>,
   * graph notation with <GRAPH>, recurrence functions with <FUNC>(<VAR>),
   * and isolated single-letter variables with <VAR>.
   */
  normalizeSubstitutions(text) {
    let norm = this.normalizeText(text);

    // 1. Graph notation G(V, E) / H(V, E) -> <GRAPH>
    norm = norm.replace(/\b[a-zA-Z]\s*\(\s*v\s*,\s*e\s*\)/gi, '<GRAPH>');

    // 2. Recurrence relations like T(n/2) or S(m/2) or T(n)
    norm = norm.replace(/\b[a-zA-Z]\s*\(\s*([a-zA-Z0-9\/\s\*\+\-]+)\s*\)/g, (match, inner) => {
      const innerNorm = inner.replace(/\b[a-zA-Z]\b/g, '<VAR>').replace(/\b\d+(\.\d+)?\b/g, '<NUM>');
      return `<FUNC>(${innerNorm.replace(/\s+/g, '')})`;
    });

    // 3. Process / Thread identifiers like P1, P2, P_1, T1, T2
    norm = norm.replace(/\b[pt](_?\d+)\b/gi, '<PROC>');

    // 4. Numeric literals (integers, floats, hexadecimal)
    norm = norm.replace(/\b0x[0-9a-fA-F]+\b/g, '<NUM>');
    norm = norm.replace(/\b\d+(\.\d+)?\b/g, '<NUM>');

    // 5. Isolated single-letter variables in math context
    norm = norm.replace(/\b[a-z]\b/g, '<VAR>');

    return norm.replace(/\s+/g, ' ').trim();
  }

  /**
   * Tokenize normalized text into an array of words.
   */
  tokenize(text) {
    return text.split(/\s+/).filter((t) => t.length > 0);
  }

  /**
   * Compute Jaccard similarity over two token sets: |A ∩ B| / |A ∪ B|
   */
  calculateTokenJaccard(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersection++;
      }
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0.0 : intersection / union;
  }

  /**
   * Compute Sorensen-Dice coefficient over two token sets: 2|A ∩ B| / (|A| + |B|)
   */
  calculateTokenDice(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersection++;
      }
    }

    return (2 * intersection) / (setA.size + setB.size);
  }

  /**
   * Compute Containment (subset ratio): |A ∩ B| / min(|A|, |B|)
   */
  calculateTokenContainment(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersection++;
      }
    }

    const minSize = Math.min(setA.size, setB.size);
    return minSize === 0 ? 0.0 : intersection / minSize;
  }

  /**
   * Extract consecutive n-gram shingles from a token array.
   */
  extractNgrams(tokens, n = 3) {
    if (tokens.length === 0) return [];
    if (tokens.length < n) {
      return [tokens.join(' ')];
    }
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  /**
   * Compute Jaccard similarity over n-gram shingles.
   */
  calculateNgramSimilarity(tokensA, tokensB, n = 3) {
    const ngramsA = this.extractNgrams(tokensA, n);
    const ngramsB = this.extractNgrams(tokensB, n);

    const setA = new Set(ngramsA);
    const setB = new Set(ngramsB);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const ng of setA) {
      if (setB.has(ng)) {
        intersection++;
      }
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0.0 : intersection / union;
  }

  /**
   * Compute option similarity for MCQ / MSQ questions.
   */
  calculateOptionSimilarity(optionsA, optionsB) {
    if (!Array.isArray(optionsA) || !Array.isArray(optionsB) || optionsA.length === 0 || optionsB.length === 0) {
      return undefined;
    }

    const textA = optionsA.map((o) => this.normalizeText(o.text || '')).join(' ');
    const textB = optionsB.map((o) => this.normalizeText(o.text || '')).join(' ');

    const tokensA = this.tokenize(textA);
    const tokensB = this.tokenize(textB);

    const jaccard = this.calculateTokenJaccard(tokensA, tokensB);
    const dice = this.calculateTokenDice(tokensA, tokensB);
    const ngram = this.calculateNgramSimilarity(tokensA, tokensB, 2);

    return Number((0.4 * dice + 0.3 * jaccard + 0.3 * ngram).toFixed(4));
  }

  /**
   * Compare candidate against a single source question.
   */
  compareSingle(candidate, source) {
    const sourceId = source.id || 'unknown-source';

    // 1. Direct Content Comparison (Framing stripped)
    const candStemClean = this.stripFraming(candidate.question || '');
    const srcStemClean = this.stripFraming(source.question || '');

    const candTokens = this.tokenize(candStemClean);
    const srcTokens = this.tokenize(srcStemClean);

    const tokenJaccard = this.calculateTokenJaccard(candTokens, srcTokens);
    const tokenDice = this.calculateTokenDice(candTokens, srcTokens);
    const tokenContainment = this.calculateTokenContainment(candTokens, srcTokens);
    const ngram2 = this.calculateNgramSimilarity(candTokens, srcTokens, 2);
    const ngram3 = this.calculateNgramSimilarity(candTokens, srcTokens, 3);
    const directStemSim = 0.35 * tokenDice + 0.25 * tokenContainment + 0.20 * tokenJaccard + 0.20 * ngram2;

    // 2. Substitution-Normalized Comparison (catches number / variable renames)
    const candSubst = this.normalizeSubstitutions(candidate.question || '');
    const srcSubst = this.normalizeSubstitutions(source.question || '');

    const candSubstTokens = this.tokenize(candSubst);
    const srcSubstTokens = this.tokenize(srcSubst);

    const substJaccard = this.calculateTokenJaccard(candSubstTokens, srcSubstTokens);
    const substDice = this.calculateTokenDice(candSubstTokens, srcSubstTokens);
    const substContainment = this.calculateTokenContainment(candSubstTokens, srcSubstTokens);
    const substNgram2 = this.calculateNgramSimilarity(candSubstTokens, srcSubstTokens, 2);
    const substNgram3 = this.calculateNgramSimilarity(candSubstTokens, srcSubstTokens, 3);
    const substStemSim = 0.35 * substDice + 0.25 * substContainment + 0.20 * substJaccard + 0.20 * substNgram2;

    // Effective Stem Similarity is the maximum of direct and substitution-normalized
    const stemSimilarity = Number(Math.max(directStemSim, substStemSim).toFixed(4));

    // 3. Option Similarity
    const optionSimilarity = this.calculateOptionSimilarity(candidate.options, source.options);

    // 4. Composite Similarity Score
    let compositeSimilarity;
    if (optionSimilarity !== undefined) {
      if (optionSimilarity >= 0.85 && stemSimilarity >= 0.40) {
        compositeSimilarity = 0.50 * stemSimilarity + 0.50 * optionSimilarity;
      } else {
        compositeSimilarity = 0.65 * stemSimilarity + 0.35 * optionSimilarity;
      }
    } else {
      // For NAT, composite is purely stem similarity
      compositeSimilarity = stemSimilarity;
    }

    compositeSimilarity = Number(compositeSimilarity.toFixed(4));

    // Determine Band
    let band;
    if (compositeSimilarity < SIMILARITY_THRESHOLDS.BANDS.LOW_MAX) {
      band = 'LOW';
    } else if (compositeSimilarity <= SIMILARITY_THRESHOLDS.BANDS.MODERATE_MAX) {
      band = 'MODERATE';
    } else {
      band = 'HIGH';
    }

    return {
      sourceId,
      similarity: compositeSimilarity,
      band,
      breakdown: {
        tokenJaccard: Number(tokenJaccard.toFixed(4)),
        tokenDice: Number(tokenDice.toFixed(4)),
        tokenContainment: Number(tokenContainment.toFixed(4)),
        ngramSimilarity: Number(ngram3.toFixed(4)),
        substJaccard: Number(substJaccard.toFixed(4)),
        substDice: Number(substDice.toFixed(4)),
        substNgram: Number(substNgram3.toFixed(4)),
        stemSimilarity,
        optionSimilarity,
        compositeSimilarity,
      },
    };
  }

  /**
   * Compare candidate against ALL reference PYQs from generation context.
   */
  checkSimilarity(candidate, sourcePYQs, threshold = this.threshold) {
    if (!candidate || typeof candidate !== 'object') {
      return {
        passed: false,
        maxSimilarity: 1.0,
        threshold,
        band: 'HIGH',
        mostSimilarQuestionId: null,
        comparisons: [],
      };
    }

    if (!Array.isArray(sourcePYQs) || sourcePYQs.length === 0) {
      return {
        passed: true,
        maxSimilarity: 0.0,
        threshold,
        band: 'LOW',
        mostSimilarQuestionId: null,
        comparisons: [],
      };
    }

    const comparisons = sourcePYQs.map((src) => this.compareSingle(candidate, src));

    // Find highest similarity
    let maxSimilarity = 0.0;
    let mostSimilarQuestionId = null;

    for (const comp of comparisons) {
      if (comp.similarity > maxSimilarity) {
        maxSimilarity = comp.similarity;
        mostSimilarQuestionId = comp.sourceId;
      }
    }

    maxSimilarity = Number(maxSimilarity.toFixed(4));
    const passed = maxSimilarity < threshold;

    let band;
    if (maxSimilarity < SIMILARITY_THRESHOLDS.BANDS.LOW_MAX) {
      band = 'LOW';
    } else if (maxSimilarity <= SIMILARITY_THRESHOLDS.BANDS.MODERATE_MAX) {
      band = 'MODERATE';
    } else {
      band = 'HIGH';
    }

    return {
      passed,
      maxSimilarity,
      threshold,
      band,
      mostSimilarQuestionId,
      comparisons,
    };
  }
}

export const questionSimilarityService = new QuestionSimilarityService();
