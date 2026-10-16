/**
 * Gemini Extraction Fallback Service (JS Implementation)
 */

import { aiService } from '../ai/ai.service.js';

export class GeminiExtractionFallback {
  constructor(customAiService) {
    this.ai = customAiService || aiService;
  }

  async refineQuestionCandidate(input) {
    if (!this.ai.isConfigured()) {
      return null;
    }

    const systemInstruction =
      'You are a strict data extraction parser. Your task is ONLY to extract text and options that literally exist in the provided source text. Never infer, guess, or fabricate missing text, options, or answers. Never create new questions.';

    const prompt = `SOURCE TEXT EXTRACTED FROM OFFICIAL GATE PAPER (Page ${input.pageNumber}, Question ${input.questionNumber}):
"""
${input.rawText}
"""

TASK:
Extract the exact question text and any multiple-choice options (A, B, C, D) present in the above text.
If the question is a Numerical Answer Type (NAT) without options, return an empty array for options.
If the question text refers to an image/diagram/circuit/figure, set "requiresFigure": true.

OUTPUT FORMAT:
Return ONLY a JSON object with this exact schema:
{
  "questionNumber": ${input.questionNumber},
  "rawQuestionText": "<exact text of the question without options>",
  "rawOptions": ["<text of option A>", "<text of option B>", "<text of option C>", "<text of option D>"],
  "requiresFigure": true or false
}`;

    try {
      const response = await this.ai.generateStructured(prompt, {
        temperature: 0.0,
        timeoutMs: 15000,
        systemInstruction,
      });

      const data = response.data;
      if (!data || typeof data.rawQuestionText !== 'string') {
        return null;
      }

      if (data.questionNumber !== input.questionNumber) {
        return null;
      }

      const rawWords = new Set(
        input.rawText.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
      );
      const extractedWords = data.rawQuestionText.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      let matchCount = 0;
      for (const w of extractedWords) {
        if (rawWords.has(w)) matchCount++;
      }
      const overlapRatio = extractedWords.length > 0 ? matchCount / extractedWords.length : 0;

      if (overlapRatio < 0.20 && extractedWords.length > 5) {
        return null;
      }

      const options = Array.isArray(data.rawOptions) ? data.rawOptions.map(String) : [];
      const requiresFigure = Boolean(data.requiresFigure);

      return {
        questionNumber: input.questionNumber,
        rawQuestionText: data.rawQuestionText.trim(),
        rawOptions: options,
        pageNumber: input.pageNumber,
        extractionConfidence: 0.88,
        requiresReview: requiresFigure || (options.length > 0 && options.length !== 4),
        requiresFigure,
        notes: 'Refined via validated AI extraction fallback.',
      };
    } catch {
      return null;
    }
  }
}

export const geminiExtractionFallback = new GeminiExtractionFallback();
