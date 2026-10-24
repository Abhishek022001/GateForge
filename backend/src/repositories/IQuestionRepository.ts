import { IQuestion, IQuestionInput } from '../types/question.types.js';

export interface IQuestionFilter {
  subject?: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
  year?: number | string;
}

export interface IQuestionRepository {
  findAll(filter?: IQuestionFilter): Promise<IQuestion[]>;
  findById(id: string): Promise<IQuestion | null>;
  create(question: IQuestionInput): Promise<IQuestion>;
  createMany(questions: IQuestionInput[]): Promise<IQuestion[]>;
  count(): Promise<number>;
  seedIfEmpty(seedData: IQuestionInput[]): Promise<number>;
}
