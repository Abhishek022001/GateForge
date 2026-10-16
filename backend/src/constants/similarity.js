/**
 * Centrally Defined Similarity Thresholds and Bands
 * Checkpoint 3C.5: Originality and Duplicate-Prevention Safeguard (ESM)
 */

export const SIMILARITY_THRESHOLDS = {
  /**
   * Threshold at or above which a candidate is deemed TOO_SIMILAR and rejected.
   */
  REJECT_THRESHOLD: 0.72,

  /**
   * Similarity interpretation bands.
   */
  BANDS: {
    LOW_MAX: 0.45,      // < 0.45: Low similarity (distinct questions)
    MODERATE_MAX: 0.71, // 0.45 - 0.71: Moderate similarity (same topic/concepts, distinct problem)
    HIGH_MIN: 0.72,     // >= 0.72: High similarity (near-copy / paraphrase / trivial substitution)
  },
};

/**
 * Standard GATE CS boilerplate framing phrases that should not falsely inflate similarity.
 */
export const GENERIC_FRAMING_PHRASES = [
  'which of the following is true',
  'which of the following is false',
  'which of the following is correct',
  'which of the following is not correct',
  'which of the following statements is true',
  'which of the following statements is false',
  'which of the following statements is correct',
  'which of the following statements are true',
  'which of the following statements are correct',
  'which one of the following is true',
  'which one of the following is correct',
  'consider the following statements',
  'consider the following',
  'select the correct option',
  'choose the correct statement',
  'with respect to the above',
];
