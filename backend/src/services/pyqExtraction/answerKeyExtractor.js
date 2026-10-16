/**
 * Official GATE Answer Key Extractor (JS Implementation)
 * Parses official GATE answer key PDF documents into structured question-answer records.
 */

import { extractPdfText } from './pdfExtractor.js';

const ANSWER_KEY_ROW_REGEX = /^\s*(\d{1,3})\s+(?:(\d+)\s+)?(MCQ|MSQ|NAT)\s+(?:([A-Za-z0-9_-]+)\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*$/;
const NAT_RANGE_REGEX = /^(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/i;

export function parseAnswerKeyText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      totalRecords: 0,
      questionTypes: { MCQ: 0, MSQ: 0, NAT: 0 },
      records: [],
      rawTextLength: 0,
      unparsedLines: [],
    };
  }

  const lines = rawText.split('\n');
  const records = [];
  const unparsedLines = [];
  const questionTypes = { MCQ: 0, MSQ: 0, NAT: 0 };
  const seenQuestionNumbers = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith('Q. No.') ||
      trimmed.startsWith('Type Section') ||
      trimmed.startsWith('Q.No.') ||
      trimmed.includes('Final Answer Key') ||
      trimmed.includes('Master Answer Key') ||
      trimmed.includes('Answer Key') ||
      trimmed.includes('Computer Science') ||
      trimmed.includes('Information Technology') ||
      trimmed.includes('Organizing Institute') ||
      trimmed.includes('Page ') ||
      trimmed.startsWith('-- ')
    ) {
      continue;
    }

    const match = trimmed.match(ANSWER_KEY_ROW_REGEX);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const session = match[2] ? parseInt(match[2], 10) : undefined;
      const qType = match[3].toUpperCase();
      const section = match[4] ? match[4].trim() : undefined;
      const rawKey = match[5].trim();
      const marks = parseFloat(match[6]);

      let answers = [];
      let acceptedRange = undefined;
      let isMTA = false;

      if (rawKey.toUpperCase() === 'MTA') {
        isMTA = true;
      } else if (qType === 'NAT') {
        const rangeMatch = rawKey.match(NAT_RANGE_REGEX);
        if (rangeMatch) {
          acceptedRange = {
            min: parseFloat(rangeMatch[1]),
            max: parseFloat(rangeMatch[2]),
          };
        } else {
          const singleNum = parseFloat(rawKey);
          if (!isNaN(singleNum)) {
            acceptedRange = { min: singleNum, max: singleNum };
          }
        }
      } else {
        answers = rawKey
          .split(/[;,]|(?:\s+OR\s+)/i)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z]$/.test(s));
      }

      if (seenQuestionNumbers.has(qNum)) {
        unparsedLines.push(`Duplicate entry for Q.${qNum}: ${trimmed}`);
        continue;
      }
      seenQuestionNumbers.add(qNum);

      records.push({
        questionNumber: qNum,
        session,
        questionType: qType,
        section,
        rawKey,
        answers,
        acceptedRange,
        marks,
        isMTA,
      });

      if (qType === 'MCQ') questionTypes.MCQ++;
      else if (qType === 'MSQ') questionTypes.MSQ++;
      else if (qType === 'NAT') questionTypes.NAT++;
    } else {
      unparsedLines.push(trimmed);
    }
  }

  records.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    totalRecords: records.length,
    questionTypes,
    records,
    rawTextLength: rawText.length,
    unparsedLines,
  };
}

export async function extractAnswerKeyFromPdf(buffer) {
  const pdfResult = await extractPdfText(buffer);
  if (pdfResult.status === 'FAILED') {
    throw new Error(`Failed to extract text from Answer Key PDF: ${pdfResult.error}`);
  }

  return parseAnswerKeyText(pdfResult.text);
}
