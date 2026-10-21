export class AIError extends Error {
  constructor(message, code = 'AI_ERROR', status = 500) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
  }
}

export class AIConfigurationError extends AIError {
  constructor(message = 'AI provider is not configured. Please set GROQ_API_KEY.') {
    super(message, 'AI_NOT_CONFIGURED', 503);
    this.name = 'AIConfigurationError';
  }
}

export class AIAuthenticationError extends AIError {
  constructor(message = 'Invalid AI API Key or unauthorized access.') {
    super(message, 'AI_AUTH_ERROR', 401);
    this.name = 'AIAuthenticationError';
  }
}

export class AIRateLimitError extends AIError {
  constructor(
    message = 'AI generation is temporarily rate-limited. Please try again shortly.',
    retryAfter
  ) {
    super(message, 'AI_RATE_LIMITED', 429);
    this.name = 'AIRateLimitError';
    this.retryAfter = typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : 60;
  }
}

export class AIQuotaExceededError extends AIError {
  constructor(
    message = 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.',
    retryAfter
  ) {
    super(message, 'AI_QUOTA_EXCEEDED', 429);
    this.name = 'AIQuotaExceededError';
    this.retryAfter = typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : undefined;
  }
}

export class AITimeoutError extends AIError {
  constructor(message = 'AI request timed out.') {
    super(message, 'AI_TIMEOUT', 504);
    this.name = 'AITimeoutError';
  }
}

export class AIResponseParsingError extends AIError {
  constructor(message = 'Failed to parse structured AI output.', rawResponse) {
    super(message, 'AI_PARSE_ERROR', 502);
    this.name = 'AIResponseParsingError';
    this.rawResponse = rawResponse;
  }
}
