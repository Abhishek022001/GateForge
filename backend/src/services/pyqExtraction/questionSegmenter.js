/**
 * GATE Question Paper Segmenter (JS Implementation)
 */

const FIGURE_REGEX = /\b(figure|diagram|circuit|automaton|transition diagram|truth table|graph shown|shown in figure|refer to figure|shown below|given in the figure|given below)\b/i;
const QUESTION_HEADER_REGEX = /(?:^|\n)\s*(?:Q\.?\s*(\d{1,2})|Question\s+(\d{1,2}))\s*[:.-]?\s*(?:\[\s*(\d)\s*Mark[s]?\s*\])?/gi;
const OPTION_SPLIT_REGEX = /(?:^|\s)(?:\(([A-Da-d])\)|([A-Da-d])\.)\s+/g;

export function extractOptionsFromBlock(block) {
  const matches = [];
  let match;

  OPTION_SPLIT_REGEX.lastIndex = 0;
  while ((match = OPTION_SPLIT_REGEX.exec(block)) !== null) {
    const optId = (match[1] || match[2]).toUpperCase();
    matches.push({ id: optId, index: match.index });
  }

  if (matches.length >= 1 && matches[0].id === 'A') {
    const questionText = block.slice(0, matches[0].index).trim();
    const options = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : block.length;
      let optText = block.slice(start, end).trim();
      optText = optText.replace(/^(?:\(([A-Da-d])\)|([A-Da-d])\.)\s*/, '').trim();
      options.push(optText);
    }

    return { questionText, options };
  }

  return {
    questionText: block.trim(),
    options: [],
  };
}

export function segmentQuestions(pageTexts) {
  if (!pageTexts || pageTexts.length === 0) return [];

  let fullText = '';
  const pageOffsets = [];

  for (const page of pageTexts) {
    pageOffsets.push({ pageNumber: page.pageNumber, charOffset: fullText.length });
    fullText += page.text + '\n\n';
  }

  function getPageForOffset(offset) {
    for (let i = pageOffsets.length - 1; i >= 0; i--) {
      if (offset >= pageOffsets[i].charOffset) {
        return pageOffsets[i].pageNumber;
      }
    }
    return 1;
  }

  const headers = [];
  let headerMatch;

  QUESTION_HEADER_REGEX.lastIndex = 0;
  while ((headerMatch = QUESTION_HEADER_REGEX.exec(fullText)) !== null) {
    const qNum = parseInt(headerMatch[1] || headerMatch[2], 10);
    const marks = headerMatch[3] ? parseInt(headerMatch[3], 10) : undefined;
    if (!isNaN(qNum) && qNum >= 1 && qNum <= 65) {
      headers.push({ questionNumber: qNum, index: headerMatch.index, marks });
    }
  }

  headers.sort((a, b) => a.index - b.index);

  const uniqueHeaders = [];
  const seenNumbers = new Set();
  for (const h of headers) {
    if (!seenNumbers.has(h.questionNumber)) {
      seenNumbers.add(h.questionNumber);
      uniqueHeaders.push(h);
    }
  }

  const candidates = [];

  for (let i = 0; i < uniqueHeaders.length; i++) {
    const current = uniqueHeaders[i];
    const startIndex = current.index;
    const endIndex = i < uniqueHeaders.length - 1 ? uniqueHeaders[i + 1].index : fullText.length;

    let rawBlock = fullText.slice(startIndex, endIndex).trim();

    // Strip page headers and footers that may be embedded across page boundaries
    rawBlock = rawBlock
      .replace(/Computer Science and Information Technology Set \d+ \([A-Za-z0-9]+\)/gi, '')
      .replace(/Page \d+ of \d+/gi, '')
      .replace(/Organizing Institute:\s*IISc Bengaluru/gi, '')
      .replace(/Organizing Institute:\s*IIT [A-Za-z]+/gi, '')
      .replace(/General Aptitude \(GA\)/gi, '')
      .replace(/Q\.\d{1,2}\s*[–-]\s*Q\.\d{1,2}\s+Carry\s+(?:ONE|TWO|\d+)\s+mark[s]?\s*(?:Each)?/gi, '')
      .trim();

    // Strip leading question header from text
    rawBlock = rawBlock.replace(/^(?:Q\.?\s*\d{1,2}|Question\s+\d{1,2})\s*[:.-]?\s*(?:\[\s*\d\s*Mark[s]?\s*\])?\s*/i, '').trim();

    const pageNumber = getPageForOffset(startIndex);
    let { questionText, options } = extractOptionsFromBlock(rawBlock);

    // Clean any residual page header artifacts from questionText and options
    questionText = questionText
      .replace(/Computer Science and Information Technology Set \d+ \([A-Za-z0-9]+\)/gi, '')
      .replace(/Page \d+ of \d+/gi, '')
      .trim();

    options = options.map((opt) =>
      opt
        .replace(/Computer Science and Information Technology Set \d+ \([A-Za-z0-9]+\)/gi, '')
        .replace(/Page \d+ of \d+/gi, '')
        .trim()
    );

    const hasFigureCue = FIGURE_REGEX.test(questionText) || options.some((opt) => FIGURE_REGEX.test(opt));
    const isVeryShort = questionText.length < 25;
    const requiresFigure = hasFigureCue || (isVeryShort && options.length === 0);

    let confidence = 0.95;
    let requiresReview = false;
    const notes = [];

    if (requiresFigure) {
      confidence = 0.50;
      requiresReview = true;
      notes.push('Figure/diagram dependency detected.');
    }

    if (options.length > 0 && options.length !== 4) {
      confidence = Math.min(confidence, 0.45);
      requiresReview = true;
      notes.push(`Irregular options count (${options.length}/4 detected).`);
    }

    if (questionText.length < 20) {
      confidence = Math.min(confidence, 0.30);
      requiresReview = true;
      notes.push('Question text is unusually short.');
    }

    const marks = current.marks || (current.questionNumber <= 35 ? 1 : 2);

    candidates.push({
      questionNumber: current.questionNumber,
      rawQuestionText: questionText,
      rawOptions: options,
      pageNumber,
      extractionConfidence: parseFloat(confidence.toFixed(2)),
      requiresReview,
      requiresFigure,
      marks,
      notes: notes.length > 0 ? notes.join(' ') : undefined,
    });
  }

  return candidates;
}
