import {
  ApiResponse,
  IAnswerEvaluation,
  IQuestion,
  IAIPracticeConfig,
  IAIPracticeGenerateResponse,
  IAIPracticeSessionConfig,
  IAIPracticeSessionCreateResponse,
  IAIPracticeSessionSubmitResponse,
} from '../types/question';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // 1. Query parameter override (?api=https://my-backend.onrender.com)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const apiParam = urlParams.get('api') || urlParams.get('backend');
      if (apiParam) {
        return apiParam.replace(/\/+$/, '');
      }
    } catch (_) {}

    // 2. Global window override
    if ((window as any).__API_BASE__) {
      return ((window as any).__API_BASE__ as string).replace(/\/+$/, '');
    }
  }
  return import.meta.env.VITE_API_URL || '';
};

export interface IQuestionFilter {
  subject?: string;
  topic?: string;
  subtopic?: string;
  year?: number | string;
  questionType?: string;
  difficulty?: string;
  sourceType?: string;
  concept?: string;
  reasoningType?: string;
  search?: string;
}

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IPaginatedResult<T> {
  success: boolean;
  data: T[];
  pagination: IPagination;
}

export interface IImportSummary {
  total: number;
  valid: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors: Array<{ index: number; id?: string; errors: string[]; snippet?: string }>;
  duplicateDetails: Array<{ index: number; id?: string; reason: string; snippet?: string }>;
}

class ApiService {
  private getBaseUrl(): string {
    return getApiBaseUrl();
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status} (${response.statusText})`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error on [${endpoint}]:`, error);
      throw error;
    }
  }

  async getQuestions(filter?: IQuestionFilter): Promise<IQuestion[]> {
    const params = new URLSearchParams();
    if (filter?.subject) params.append('subject', filter.subject);
    if (filter?.topic) params.append('topic', filter.topic);
    if (filter?.year) params.append('year', String(filter.year));
    if (filter?.questionType) params.append('questionType', filter.questionType);
    if (filter?.difficulty) params.append('difficulty', filter.difficulty);
    if (filter?.sourceType) params.append('sourceType', filter.sourceType);
    if (filter?.concept) params.append('concept', filter.concept);
    if (filter?.search) params.append('search', filter.search);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<ApiResponse<IQuestion[]>>(`/api/questions${queryString}`);
    return res.data || [];
  }

  async getPaginatedQuestions(
    filter?: IQuestionFilter,
    page = 1,
    limit = 20,
    includeAnswer = true
  ): Promise<IPaginatedResult<IQuestion>> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (includeAnswer) params.append('includeAnswer', 'true');

    if (filter?.subject) params.append('subject', filter.subject);
    if (filter?.topic) params.append('topic', filter.topic);
    if (filter?.year) params.append('year', String(filter.year));
    if (filter?.questionType) params.append('questionType', filter.questionType);
    if (filter?.difficulty) params.append('difficulty', filter.difficulty);
    if (filter?.sourceType) params.append('sourceType', filter.sourceType);
    if (filter?.concept) params.append('concept', filter.concept);
    if (filter?.search) params.append('search', filter.search);

    return await this.request<IPaginatedResult<IQuestion>>(`/api/questions?${params.toString()}`);
  }

  async getQuestionById(id: string): Promise<IQuestion> {
    const res = await this.request<ApiResponse<IQuestion>>(`/api/questions/${encodeURIComponent(id)}`);
    if (!res.data) {
      throw new Error(`Question ${id} not found`);
    }
    return res.data;
  }

  async submitAnswer(
    questionId: string,
    answer: string | string[] | number
  ): Promise<IAnswerEvaluation> {
    const res = await this.request<ApiResponse<IAnswerEvaluation>>(
      `/api/questions/${encodeURIComponent(questionId)}/answer`,
      {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }
    );

    if (!res.data) {
      throw new Error('No evaluation data received');
    }
    return res.data;
  }

  async importBulkQuestions(questions: any[]): Promise<{
    success: boolean;
    message: string;
    summary: IImportSummary;
  }> {
    return await this.request('/api/questions/import', {
      method: 'POST',
      body: JSON.stringify({ questions }),
    });
  }

  async getTaxonomy(): Promise<{
    subjects: string[];
    questionTypes: string[];
    difficultyLevels: string[];
    sourceTypes: string[];
    reasoningTypes: string[];
  }> {
    const res = await this.request<{ success: boolean; data: any }>('/api/taxonomy');
    return res.data;
  }

  async getHealth(): Promise<{
    status: string;
    application: string;
    phase: number;
    database: string;
    questionCount: number;
  }> {
    return await this.request('/api/health');
  }

  async getStats(sessionId?: string): Promise<{
    totalQuestions: number;
    officialPyqs: number;
    analyzedQuestions: number;
    subjectsCovered: number;
    practiceModes: number;
    liveUsers?: number;
    uniqueVisitors?: number;
    peopleVisitedSoFar?: number;
    totalVisits?: number;
  }> {
    const url = sessionId ? `/api/stats?sessionId=${encodeURIComponent(sessionId)}` : '/api/stats';
    const headers = sessionId ? { 'x-session-id': sessionId } : undefined;
    const res = await this.request<{ success: boolean; data: any }>(url, { headers });
    return res.data;
  }

  async sendHeartbeat(sessionId: string): Promise<{
    liveUsers: number;
    peopleVisitedSoFar?: number;
    uniqueVisitors?: number;
    totalVisits?: number;
  }> {
    const res = await this.request<{ success: boolean; data: any }>('/api/stats/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
    });
    return res.data;
  }

  sendLeaveBeacon(sessionId: string): void {
    try {
      const url = `${getApiBaseUrl()}/api/stats/leave`;
      const payload = JSON.stringify({ sessionId });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else if (typeof fetch !== 'undefined') {
        fetch(url, {
          method: 'POST',
          body: payload,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
      }
    } catch (_) {}
  }

  async reseed(): Promise<{ success: boolean; message: string }> {
    return await this.request('/api/questions/seed', { method: 'POST' });
  }

  async getTopics(subject?: string): Promise<string[]> {
    const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    const res = await this.request<{ success: boolean; data: string[] }>(`/api/taxonomy/topics${params}`);
    return res.data || [];
  }

  async generatePracticeQuestion(config: IAIPracticeConfig): Promise<IAIPracticeGenerateResponse> {
    const payload: any = {
      subject: config.subject,
      difficulty: config.difficulty,
      questionType: config.questionType,
    };
    if (config.topic && config.topic !== 'Any Topic') {
      payload.topic = config.topic;
    }

    return await this.request<IAIPracticeGenerateResponse>('/api/ai/practice/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async submitPracticeAnswer(
    sessionQuestionId: string,
    answer: string | string[] | number
  ): Promise<IAnswerEvaluation> {
    const res = await this.request<{ success: boolean; sessionQuestionId: string; data: IAnswerEvaluation }>(
      `/api/ai/practice/${encodeURIComponent(sessionQuestionId)}/answer`,
      {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }
    );

    if (!res.data) {
      throw new Error('No evaluation data received for practice question');
    }
    return res.data;
  }

  async createPracticeSession(config: IAIPracticeSessionConfig): Promise<IAIPracticeSessionCreateResponse> {
    const payload: any = {
      subject: config.subject,
      difficulty: config.difficulty,
      questionType: config.questionType,
      questionCount: config.questionCount,
    };
    if (config.topic && config.topic !== 'Any Topic') {
      payload.topic = config.topic;
    }

    return await this.request<IAIPracticeSessionCreateResponse>('/api/ai/practice/session', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async submitPracticeSession(
    sessionId: string,
    answers: Record<string, any>
  ): Promise<IAIPracticeSessionSubmitResponse> {
    return await this.request<IAIPracticeSessionSubmitResponse>(
      `/api/ai/practice/session/${encodeURIComponent(sessionId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }
    );
  }

  async getPracticeSession(sessionId: string): Promise<any> {
    return await this.request<any>(
      `/api/ai/practice/session/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
      }
    );
  }

  async updatePracticeSessionProgress(
    sessionId: string,
    progress: { answers?: Record<string, any>; currentIndex?: number }
  ): Promise<any> {
    return await this.request<any>(
      `/api/ai/practice/session/${encodeURIComponent(sessionId)}/progress`,
      {
        method: 'PATCH',
        body: JSON.stringify(progress),
      }
    );
  }

  async askTutor(query: string, subject?: string, top_k = 3): Promise<IAskResponse> {
    const payload: any = { query, top_k };
    if (subject && subject !== 'All Subjects') {
      payload.subject = subject;
    }

    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/tutor/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));

          // If the service is warming up or experiencing cold start, wait and auto-retry
          const isWarmingUp =
            errData.code === 'TUTOR_SERVICE_WARMING_UP' ||
            ((res.status === 502 || res.status === 503 || res.status === 504) && !errData.error);

          if (isWarmingUp && attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 3500));
            continue;
          }

          let msg = '';
          if (typeof errData.error === 'string') {
            msg = errData.error;
            if (errData.detail && typeof errData.detail === 'string' && !msg.includes(errData.detail)) {
              msg += ` (${errData.detail})`;
            }
          } else if (typeof errData.message === 'string') {
            msg = errData.message;
          } else if (typeof errData.detail === 'string') {
            msg = errData.detail;
          } else if (Array.isArray(errData.detail) && errData.detail.length > 0) {
            const item = errData.detail[0];
            msg = typeof item === 'string' ? item : (item.msg || JSON.stringify(item));
          } else if (res.status === 502 || res.status === 503 || res.status === 504) {
            msg = 'The AI Tutor cloud service is currently waking up or busy on Render. Please wait 15–20 seconds and ask again.';
          } else {
            msg = `AI Tutor request failed with HTTP ${res.status}`;
          }
          throw new Error(msg);
        }

        return await res.json();
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || '').toLowerCase();
        const canRetry =
          attempt < maxRetries &&
          (errMsg.includes('waking up') || errMsg.includes('failed to fetch') || errMsg.includes('networkerror'));
        if (canRetry) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 3500));
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('AI Tutor request failed');
  }

  async getTutorHealth(): Promise<ITutorHealth> {
    const res = await fetch(`${this.getBaseUrl()}/api/tutor/health`);
    if (!res.ok) throw new Error(`Tutor health check failed (${res.status})`);
    return await res.json();
  }

  async getTutorSubjects(): Promise<string[]> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/tutor/subjects`);
      if (!res.ok) return [];
      return await res.json();
    } catch (_) {
      return [];
    }
  }
}

export interface IRetrievedQuestionRef {
  id: string;
  question: string;
  subject?: string;
  topic?: string;
  year?: number | string;
  question_type?: string;
  similarity_score: number;
  correct_answer?: any;
  explanation?: string;
}

export interface IAskResponse {
  query: string;
  answer: string;
  is_grounded: boolean;
  retrieved_references: IRetrievedQuestionRef[];
  latency_ms: number;
  model_used: string;
}

export interface ITutorHealth {
  status: string;
  questions_indexed: number;
  chroma_status: string;
  mongodb_connected: boolean;
  llm_configured: boolean;
}

export const api = new ApiService();
