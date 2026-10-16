/**
 * Gemini Extraction Fallback Service
 * Converts noisy or irregular extracted PDF question text into structured candidate format.
 * STRICTLY constrained: only extracts information present in source text; never invents or generates new questions.
 */

import { AIService, aiService } from '../ai/ai.service.js';
import { IExtractedQuestionCandidate } from './questionSegmenter.js';

export interface IGeminiExtractionInput {
  questionNumber: number;
  rawText: string;
  pageNumber: number;
}

export class GeminiExtractionFallback {
  private ai: AIService;

  constructor(customAiService?: AIService) {
    this.ai = customAiService || aiService;
  }

  /**
   * Refines a difficult question extraction block using Gemini.
   * Enforces strict anti-fabrication guidelines.
   */
  public async refineQuestionCandidate(
    input: IGeminiExtractionInput
  ): Promise<IExtractedQuestionCandidate | null> {
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
      const response = await this.ai.generateStructured<{
        questionNumber: number;
        rawQuestionText: string;
        rawOptions: string[];
        requiresFigure?: boolean;
      }>(prompt, {
        temperature: 0.0, // Zero temperature for maximum deterministic extraction fidelity
        timeoutMs: 15000,
        systemInstruction,
      });

      const data = response.data;
      if (!data || typeof data.rawQuestionText !== 'string') {
        return null;
      }

      // Schema validation: Verify questionNumber matches requested questionNumber
      if (data.questionNumber !== input.questionNumber) {
        return null;
      }

      // Anti-fabrication check: Ensure extracted text shares tokens with the raw input text
      const rawWords = new Set(
        input.rawText.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
      );
      const extractedWords = data.rawQuestionText.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      let matchCount = 0;
      for (const w of extractedWords) {
        if (rawWords.has(w)) matchCount++;
      }
      const overlapRatio = extractedWords.length > 0 ? matchCount / extractedWords.length : 0;

      // If less than 20% overlap, the model likely hallucinated text not in the source
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
