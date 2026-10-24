import { IQuestion, IQuestionInput } from '../types/question.types.js';
import { IQuestionFilter, IQuestionRepository } from './IQuestionRepository.js';

export class InMemoryQuestionRepository implements IQuestionRepository {
  private questions: Map<string, IQuestion> = new Map();

  constructor(initialData: IQuestionInput[] = []) {
    for (const q of initialData) {
      this.questions.set(q.id, {
        ...q,
        _id: `mem-${q.id}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async findAll(filter?: IQuestionFilter): Promise<IQuestion[]> {
    let result = Array.from(this.questions.values());

    if (filter?.subject) {
      result = result.filter(
        (q) => q.subject?.toLowerCase() === filter.subject?.toLowerCase()
      );
    }
    if (filter?.topic) {
      result = result.filter(
        (q) => q.topic?.toLowerCase() === filter.topic?.toLowerCase()
      );
    }
    if (filter?.difficulty) {
      result = result.filter(
        (q) => q.difficulty?.toLowerCase() === filter.difficulty?.toLowerCase()
      );
    }
    if (filter?.questionType) {
      result = result.filter(
        (q) => q.questionType?.toLowerCase() === filter.questionType?.toLowerCase()
      );
    }
    if (filter?.year) {
      result = result.filter(
        (q) => String(q.year) === String(filter.year)
      );
    }

    return result;
  }

  async findById(id: string): Promise<IQuestion | null> {
    const question = this.questions.get(id);
    if (!question) return null;
    return { ...question };
  }

  async create(questionInput: IQuestionInput): Promise<IQuestion> {
    const question: IQuestion = {
      ...questionInput,
      _id: `mem-${questionInput.id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.questions.set(question.id, question);
    return { ...question };
  }

  async createMany(questions: IQuestionInput[]): Promise<IQuestion[]> {
    const created: IQuestion[] = [];
    for (const q of questions) {
      const item = await this.create(q);
      created.push(item);
    }
    return created;
  }

  async count(): Promise<number> {
    return this.questions.size;
  }

  async seedIfEmpty(seedData: IQuestionInput[]): Promise<number> {
    if (this.questions.size === 0) {
      await this.createMany(seedData);
      return seedData.length;
    }
    return 0;
  }
}
