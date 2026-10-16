import { AIResponseParsingError } from './ai.interface.js';

export function extractJsonFromText(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new AIResponseParsingError('Empty response text received from model.', text);
  }

  const trimmed = text.trim();

  // 1. Check for markdown json code fence
  const markdownJsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = markdownJsonRegex.exec(trimmed);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. Direct JSON object
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  // 3. Direct JSON array
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }

  return trimmed;
}

/**
 * Robustly repairs unescaped LaTeX backslashes and raw unescaped newlines in JSON strings.
 * Accurately preserves already-escaped sequences (\\, \", \n, \t, \uXXXX) while escaping single LaTeX backslashes.
 */
export function repairUnescapedBackslashes(jsonStr: string): string {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < jsonStr.length) {
    const char = jsonStr[i];

    // Toggle inString state if unescaped double quote
    if (char === '"' && (i === 0 || jsonStr[i - 1] !== '\\')) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      // Handle raw newlines inside string literals
      if (char === '\n') {
        result += '\\n';
        i++;
        continue;
      }
      if (char === '\r') {
        i++;
        continue;
      }

      // Handle backslashes
      if (char === '\\') {
        const next = jsonStr[i + 1];

        // 1. Already an escaped backslash (\\) -> keep both and advance 2
        if (next === '\\') {
          result += '\\\\';
          i += 2;
          continue;
        }

        // 2. Valid standard JSON escape (", /, b, f, n, r, t) -> keep and advance 2
        if (['"', '/', 'b', 'f', 'n', 'r', 't'].includes(next)) {
          result += '\\' + next;
          i += 2;
          continue;
        }

        // 3. Valid unicode escape (\uXXXX) -> keep and advance 6
        if (next === 'u') {
          const hex = jsonStr.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += '\\u' + hex;
            i += 6;
            continue;
          }
        }

        // 4. Single unescaped LaTeX backslash (e.g. \Delta, \Theta, \le, \ge, \frac, \underline, \in) -> double it
        result += '\\\\';
        i++;
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

export function parseStructuredJson<T>(rawText: string, validator?: (parsed: any) => boolean): T {
  const jsonString = extractJsonFromText(rawText);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (initialErr: any) {
    // Attempt recovery from unescaped LaTeX math formulas / single backslashes / unescaped newlines
    try {
      const repaired = repairUnescapedBackslashes(jsonString);
      parsed = JSON.parse(repaired);
    } catch (retryErr: any) {
      throw new AIResponseParsingError(`Failed to parse JSON from AI response: ${retryErr.message || initialErr.message}`, rawText);
    }
  }

  if (validator && !validator(parsed)) {
    throw new AIResponseParsingError('AI response parsed as JSON but failed schema validation.', rawText);
  }

  return parsed as T;
}
