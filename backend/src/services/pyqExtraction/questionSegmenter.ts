/**
 * GATE Question Paper Segmenter
 * Splits normalized text into individual candidate questions, identifies options,
 * detects figure dependencies, calculates extraction confidence, and flags review items.
 */

import { IPageTextChunk } from './pdfExtractor.js';

export interface IExtractedQuestionCandidate {
  questionNumber: number;
  rawQuestionText: string;
  rawOptions: string[];
  pageNumber: number;
  extractionConfidence: number;
  requiresReview: boolean;
  requiresFigure: boolean;
  imageUrl?: string;
  marks?: number;
  notes?: string;
}

// Regex to detect figure, diagram, circuit, or automaton dependencies
const FIGURE_REGEX = /\b(figure|diagram|circuit|automaton|transition diagram|truth table|graph shown|shown in figure|refer to figure|shown below|given in the figure|given below)\b/i;

// Regex to match question header: e.g. "Q.1", "Q. 1", "Q1.", "Question 1", "Q. 45"
const QUESTION_HEADER_REGEX = /(?:^|\n)\s*(?:Q\.?\s*(\d{1,2})|Question\s+(\d{1,2}))\s*[:.-]?\s*(?:\[\s*(\d)\s*Mark[s]?\s*\])?/gi;

// Regex to extract options (A), (B), (C), (D) or (a), (b), (c), (d)
const OPTION_SPLIT_REGEX = /(?:^|\s)(?:\(([A-Da-d])\)|([A-Da-d])\.)\s+/g;

/**
 * Extracts options from a raw question block if present.
 */
export function extractOptionsFromBlock(block: string): { questionText: string; options: string[] } {
  const matches: Array<{ id: string; index: number }> = [];
  let match: RegExpExecArray | null;

  OPTION_SPLIT_REGEX.lastIndex = 0;
  while ((match = OPTION_SPLIT_REGEX.exec(block)) !== null) {
    const optId = (match[1] || match[2]).toUpperCase();
    matches.push({ id: optId, index: match.index });
  }

  // Check if options starting with A are present
  if (matches.length >= 1 && matches[0].id === 'A') {
    const questionText = block.slice(0, matches[0].index).trim();
    const options: string[] = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : block.length;
      let optText = block.slice(start, end).trim();
      // Remove leading option marker like "(A) " or "A. "
      optText = optText.replace(/^(?:\(([A-Da-d])\)|([A-Da-d])\.)\s*/, '').trim();
      options.push(optText);
    }

    return { questionText, options };
  }

  // No options detected (NAT or open-ended format)
  return {
    questionText: block.trim(),
    options: [],
  };
}

/**
 * Segments page chunks into individual candidate questions.
 */
export function segmentQuestions(pageTexts: IPageTextChunk[]): IExtractedQuestionCandidate[] {
  if (!pageTexts || pageTexts.length === 0) return [];

  // Build combined text with page boundary markers
  let fullText = '';
  const pageOffsets: Array<{ pageNumber: number; charOffset: number }> = [];

  for (const page of pageTexts) {
    pageOffsets.push({ pageNumber: page.pageNumber, charOffset: fullText.length });
    fullText += page.text + '\n\n';
  }

  function getPageForOffset(offset: number): number {
    for (let i = pageOffsets.length - 1; i >= 0; i--) {
      if (offset >= pageOffsets[i].charOffset) {
        return pageOffsets[i].pageNumber;
      }
    }
    return 1;
  }

  // Locate all question headers
  const headers: Array<{ questionNumber: number; index: number; marks?: number }> = [];
  let headerMatch: RegExpExecArray | null;

  QUESTION_HEADER_REGEX.lastIndex = 0;
  while ((headerMatch = QUESTION_HEADER_REGEX.exec(fullText)) !== null) {
    const qNum = parseInt(headerMatch[1] || headerMatch[2], 10);
    const marks = headerMatch[3] ? parseInt(headerMatch[3], 10) : undefined;
    if (!isNaN(qNum) && qNum >= 1 && qNum <= 65) {
      headers.push({ questionNumber: qNum, index: headerMatch.index, marks });
    }
  }

  // Sort headers by index
  headers.sort((a, b) => a.index - b.index);

  // De-duplicate by questionNumber (keep first occurrence if duplicate index)
  const uniqueHeaders: Array<{ questionNumber: number; index: number; marks?: number }> = [];
  const seenNumbers = new Set<number>();
  for (const h of headers) {
    if (!seenNumbers.has(h.questionNumber)) {
      seenNumbers.add(h.questionNumber);
      uniqueHeaders.push(h);
    }
  }

  const candidates: IExtractedQuestionCandidate[] = [];

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
    const notes: string[] = [];

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

    // Default GATE marks mapping if not explicitly tagged: Q1-35 = 1 mark, Q36-65 = 2 marks
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
