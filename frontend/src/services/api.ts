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

  async getStats(): Promise<{
    totalQuestions: number;
    officialPyqs: number;
    analyzedQuestions: number;
    subjectsCovered: number;
    practiceModes: number;
    uniqueVisitors?: number;
    peopleVisitedSoFar?: number;
    totalVisits?: number;
  }> {
    const res = await this.request<{ success: boolean; data: any }>('/api/stats');
    return res.data;
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
}

export const api = new ApiService();
