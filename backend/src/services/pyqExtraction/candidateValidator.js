/**
 * Official GATE Candidate Question Validator & Answer Key Mapper (JS Implementation)
 */

export function validateAndMapCandidates(candidates, answerKeyRecords, options) {
  const { paperSource, keySource, paperChecksum, keyChecksum } = options;

  if (paperSource.year !== keySource.year || paperSource.paper.toUpperCase() !== keySource.paper.toUpperCase()) {
    throw new Error(
      `Paper/Key mismatch: Question paper is ${paperSource.year} ${paperSource.paper}, but answer key is ${keySource.year} ${keySource.paper}.`
    );
  }

  const keyMap = new Map();
  const duplicateKeyNumbers = [];

  for (const record of answerKeyRecords) {
    if (keyMap.has(record.questionNumber)) {
      duplicateKeyNumbers.push(record.questionNumber);
    }
    keyMap.set(record.questionNumber, record);
  }

  const candidateMap = new Map();
  const duplicateCandidateNumbers = [];

  for (const c of candidates) {
    if (candidateMap.has(c.questionNumber)) {
      duplicateCandidateNumbers.push(c.questionNumber);
    }
    candidateMap.set(c.questionNumber, c);
  }

  const validatedQuestions = [];
  const candidatesWithoutKey = [];
  let typeOverrideCount = 0;
  const questionTypeCounts = { MCQ: 0, MSQ: 0, NAT: 0 };
  let validCount = 0;
  let needsReviewCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    const qNum = candidate.questionNumber;
    const issues = [];
    let status = 'VALID';

    if (qNum <= 0 || !candidate.rawQuestionText || candidate.rawQuestionText.trim().length < 10) {
      status = 'FAILED';
      issues.push('Question text is missing, corrupt, or question number is invalid.');
    }

    const keyRecord = keyMap.get(qNum);

    const guessedType = candidate.rawOptions.length > 0 ? 'MCQ' : 'NAT';
    let officialType = guessedType;
    let typeOverridden = false;

    if (keyRecord) {
      officialType = keyRecord.questionType;
      if (officialType !== guessedType) {
        typeOverridden = true;
        typeOverrideCount++;
        issues.push(`Official question type '${officialType}' overrides extracted guess '${guessedType}'.`);
      }
    } else {
      issues.push(`No matching official answer key record found for Q.${qNum}.`);
      if (status !== 'FAILED') status = 'NEEDS_REVIEW';
      candidatesWithoutKey.push(qNum);
    }

    const formattedOptions = [];
    if (officialType !== 'NAT') {
      const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
      candidate.rawOptions.forEach((optText, idx) => {
        formattedOptions.push({
          id: optionLetters[idx] || String.fromCharCode(65 + idx),
          text: optText,
        });
      });
    }

    let correctAnswer = null;
    let numericalAnswer = null;
    const marks = keyRecord?.marks ?? candidate.marks ?? (qNum > 35 ? 2 : 1);

    if (keyRecord) {
      if (keyRecord.isMTA) {
        issues.push('Question marked as Marks to All (MTA) in official answer key.');
        if (status !== 'FAILED') status = 'NEEDS_REVIEW';
      }

      if (officialType === 'MCQ') {
        const ans = keyRecord.answers[0] || keyRecord.rawKey;
        correctAnswer = ans;

        const optionExists = formattedOptions.some((o) => o.id === ans);
        if (!optionExists) {
          issues.push(`MCQ official answer '${ans}' does not exist in extracted options.`);
          if (status !== 'FAILED') status = 'NEEDS_REVIEW';
        }
        if (formattedOptions.length < 2) {
          issues.push(`MCQ question has fewer than 2 extracted options (${formattedOptions.length}).`);
          if (status !== 'FAILED') status = 'NEEDS_REVIEW';
        }
      } else if (officialType === 'MSQ') {
        correctAnswer = keyRecord.answers;

        for (const ans of keyRecord.answers) {
          const optionExists = formattedOptions.some((o) => o.id === ans);
          if (!optionExists) {
            issues.push(`MSQ official answer '${ans}' does not exist in extracted options.`);
            if (status !== 'FAILED') status = 'NEEDS_REVIEW';
          }
        }
        if (formattedOptions.length < 2) {
          issues.push(`MSQ question has fewer than 2 extracted options (${formattedOptions.length}).`);
          if (status !== 'FAILED') status = 'NEEDS_REVIEW';
        }
        if (keyRecord.answers.length === 0) {
          issues.push('MSQ question has no valid option letters in official answer key.');
          if (status !== 'FAILED') status = 'NEEDS_REVIEW';
        }
      } else if (officialType === 'NAT') {
        correctAnswer = null;
        if (keyRecord.acceptedRange) {
          numericalAnswer = {
            min: keyRecord.acceptedRange.min,
            max: keyRecord.acceptedRange.max,
          };
        } else {
          issues.push('NAT question missing accepted numerical range in official answer key.');
          if (status !== 'FAILED') status = 'NEEDS_REVIEW';
        }
      }
    }

    if (candidate.requiresFigure) {
      if (candidate.imageUrl) {
        // Visual diagram has been extracted and attached successfully
      } else {
        issues.push('Question depends on a visual figure/circuit/diagram not captured in text extraction.');
        if (status !== 'FAILED') status = 'NEEDS_REVIEW';
      }
    }

    if (candidate.extractionConfidence < 0.7 && !candidate.imageUrl) {
      issues.push(`Low text extraction confidence (${Math.round(candidate.extractionConfidence * 100)}%).`);
      if (status !== 'FAILED') status = 'NEEDS_REVIEW';
    }

    if (status === 'VALID') validCount++;
    else if (status === 'NEEDS_REVIEW') needsReviewCount++;
    else if (status === 'FAILED') failedCount++;

    questionTypeCounts[officialType]++;

    validatedQuestions.push({
      questionNumber: qNum,
      question: candidate.rawQuestionText,
      options: formattedOptions,
      questionType: officialType,
      originalExtractedType: guessedType,
      typeOverridden,
      correctAnswer,
      numericalAnswer,
      marks,
      requiresFigure: candidate.requiresFigure,
      imageUrl: candidate.imageUrl,
      extractionConfidence: candidate.extractionConfidence,
      provenance: {
        type: 'PYQ',
        provider: 'OFFICIAL_GATE',
        exam: 'GATE',
        year: paperSource.year,
        paper: paperSource.paper,
        section: keyRecord?.section,
        questionPaperSourceId: paperSource.id,
        answerKeySourceId: keySource.id,
        questionPaperChecksum: paperChecksum || paperSource.checksum,
        answerKeyChecksum: keyChecksum || keySource.checksum,
      },
      validationStatus: status,
      validationIssues: issues,
    });
  }

  validatedQuestions.sort((a, b) => a.questionNumber - b.questionNumber);

  const keysWithoutCandidate = [];
  for (const [keyQNum] of keyMap) {
    if (!candidateMap.has(keyQNum)) {
      keysWithoutCandidate.push(keyQNum);
    }
  }

  const missingQuestionNumbers = [];
  const maxQ = Math.max(...candidates.map((c) => c.questionNumber), 0);
  for (let i = 1; i <= maxQ; i++) {
    if (!candidateMap.has(i)) {
      missingQuestionNumbers.push(i);
    }
  }

  const isConsistent =
    duplicateCandidateNumbers.length === 0 &&
    duplicateKeyNumbers.length === 0 &&
    missingQuestionNumbers.length === 0 &&
    candidatesWithoutKey.length === 0 &&
    keysWithoutCandidate.length === 0;

  return {
    paperSourceId: paperSource.id,
    answerKeySourceId: keySource.id,
    total: validatedQuestions.length,
    valid: validCount,
    needsReview: needsReviewCount,
    failed: failedCount,
    questionTypes: questionTypeCounts,
    consistencyReport: {
      duplicateQuestionNumbers: Array.from(new Set(duplicateCandidateNumbers.concat(duplicateKeyNumbers))),
      missingQuestionNumbers,
      candidatesWithoutKey,
      keysWithoutCandidate,
      typeOverrideCount,
      isConsistent,
    },
    questions: validatedQuestions,
  };
}
