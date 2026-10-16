/**
 * Official GATE Answer Key Extractor
 * Parses official GATE answer key PDF documents into structured question-answer records.
 * Extracts: questionNumber, session, questionType (MCQ/MSQ/NAT), section, rawKey,
 * answers array (MCQ/MSQ), accepted numerical range (NAT), and marks.
 * Does NOT invent missing values or use AI for official answers.
 */

import { extractPdfText, IPdfExtractionResult } from './pdfExtractor.js';

export interface IOfficialAnswerKeyRecord {
  questionNumber: number;
  session?: number;
  questionType: 'MCQ' | 'MSQ' | 'NAT';
  section?: string; // e.g. 'GA', 'CS-1', 'CS'
  rawKey: string;
  answers: string[]; // e.g. ['A'] or ['A', 'C']
  acceptedRange?: { min: number; max: number };
  marks: number;
  isMTA: boolean; // Marks to All
}

export interface IOfficialAnswerKeyResult {
  totalRecords: number;
  questionTypes: {
    MCQ: number;
    MSQ: number;
    NAT: number;
  };
  records: IOfficialAnswerKeyRecord[];
  rawTextLength: number;
  unparsedLines: string[];
}

/**
 * Standard GATE answer key row regex:
 * Matches tabular rows such as:
 * "1 5 MCQ GA A 1"
 * "22 5 MSQ CS-1 A;C 1"
 * "30 5 MSQ CS-1 A;B;C 1"
 * "32 5 NAT CS-1 2 to 2 1"
 * "63 5 NAT CS-1 0.370 to 0.380 2"
 * Also handles rows without session or without section:
 * "1 MCQ A 1" or "1 MCQ CS A 1"
 */
const ANSWER_KEY_ROW_REGEX = /^\s*(\d{1,3})\s+(?:(\d+)\s+)?(MCQ|MSQ|NAT)\s+(?:([A-Za-z0-9_-]+)\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*$/;

// Regex for NAT numerical range: e.g. "2 to 2", "0.370 to 0.380", "-5 to -2", "14 to 14"
const NAT_RANGE_REGEX = /^(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/i;

/**
 * Parses raw text extracted from an official GATE answer key PDF.
 */
export function parseAnswerKeyText(rawText: string): IOfficialAnswerKeyResult {
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
  const records: IOfficialAnswerKeyRecord[] = [];
  const unparsedLines: string[] = [];
  const questionTypes = { MCQ: 0, MSQ: 0, NAT: 0 };
  const seenQuestionNumbers = new Set<number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip known header / footer / metadata lines
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
      const qType = match[3].toUpperCase() as 'MCQ' | 'MSQ' | 'NAT';
      const section = match[4] ? match[4].trim() : undefined;
      const rawKey = match[5].trim();
      const marks = parseFloat(match[6]);

      let answers: string[] = [];
      let acceptedRange: { min: number; max: number } | undefined;
      let isMTA = false;

      // Handle Marks To All (MTA)
      if (rawKey.toUpperCase() === 'MTA') {
        isMTA = true;
      } else if (qType === 'NAT') {
        // Parse numerical range or single value
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
        // MCQ or MSQ: Parse option letters (e.g. 'A', 'A;C', 'A;B;C', 'A OR B')
        answers = rawKey
          .split(/[;,]|(?:\s+OR\s+)/i)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z]$/.test(s));
      }

      // Check for duplicate question numbers in answer key
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

  // Sort records by questionNumber
  records.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    totalRecords: records.length,
    questionTypes,
    records,
    rawTextLength: rawText.length,
    unparsedLines,
  };
}

/**
 * Extracts and parses official GATE answer key from PDF buffer.
 */
export async function extractAnswerKeyFromPdf(
  buffer: Buffer
): Promise<IOfficialAnswerKeyResult> {
  const pdfResult: IPdfExtractionResult = await extractPdfText(buffer);
  if (pdfResult.status === 'FAILED') {
    throw new Error(`Failed to extract text from Answer Key PDF: ${pdfResult.error}`);
  }

  return parseAnswerKeyText(pdfResult.text);
}
