/**
 * PDF Text Extractor for Official GATE Question Papers
 * Extracts raw text, preserves page boundaries, normalizes whitespace,
 * and maintains mathematical and formal notation without corruption.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export interface IPageTextChunk {
  pageNumber: number;
  text: string;
}

export interface IPdfExtractionResult {
  pages: number;
  rawTextLength: number;
  text: string;
  pageTexts: IPageTextChunk[];
  status: 'EXTRACTED' | 'FAILED';
  error?: string;
}

/**
 * Normalizes extracted text while strictly preserving mathematical notation,
 * LaTeX delimiters ($ and $$), backslashes, and question/option formatting.
 */
export function normalizeExtractedText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  return (
    raw
      // Normalize CRLF / CR to standard LF
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Replace non-breaking spaces and form feeds with standard space
      .replace(/[\u00A0\u2000-\u200B\f]/g, ' ')
      // Collapse horizontal whitespace runs while preserving line breaks
      .replace(/[ \t]{2,}/g, ' ')
      // Remove excessive blank lines (more than 2 consecutive line breaks)
      .replace(/\n{3,}/g, '\n\n')
      // Trim surrounding whitespace
      .trim()
  );
}

/**
 * Extracts text and page-by-page chunks from a PDF buffer.
 */
export async function extractPdfText(buffer: Buffer): Promise<IPdfExtractionResult> {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      pages: 0,
      rawTextLength: 0,
      text: '',
      pageTexts: [],
      status: 'FAILED',
      error: 'Invalid or empty PDF buffer provided.',
    };
  }

  try {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const fullNormalizedText = normalizeExtractedText(textResult.text || '');

    const pageTexts: IPageTextChunk[] = (textResult.pages || []).map((p: any, idx: number) => ({
      pageNumber: typeof p.num === 'number' ? p.num : idx + 1,
      text: normalizeExtractedText(p.text || ''),
    }));

    return {
      pages: textResult.total || pageTexts.length,
      rawTextLength: fullNormalizedText.length,
      text: fullNormalizedText,
      pageTexts,
      status: 'EXTRACTED',
    };
  } catch (err: any) {
    return {
      pages: 0,
      rawTextLength: 0,
      text: '',
      pageTexts: [],
      status: 'FAILED',
      error: `PDF extraction failed: ${err.message}`,
    };
  }
}
