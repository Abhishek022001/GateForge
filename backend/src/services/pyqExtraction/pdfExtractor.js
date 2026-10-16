/**
 * PDF Text Extractor for Official GATE Question Papers (JS Implementation)
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export function normalizeExtractedText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  return (
    raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u00A0\u2000-\u200B\f]/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export async function extractPdfText(buffer) {
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

    const pageTexts = (textResult.pages || []).map((p, idx) => ({
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
  } catch (err) {
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
