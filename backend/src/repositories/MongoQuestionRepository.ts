import { QuestionModel } from '../models/Question.model.js';
import { IQuestion, IQuestionInput } from '../types/question.types.js';
import { IQuestionFilter, IQuestionRepository } from './IQuestionRepository.js';

export class MongoQuestionRepository implements IQuestionRepository {
  async findAll(filter?: IQuestionFilter): Promise<IQuestion[]> {
    const query: Record<string, unknown> = {};
    if (filter?.subject) query.subject = filter.subject;
    if (filter?.topic) query.topic = filter.topic;
    if (filter?.difficulty) query.difficulty = filter.difficulty;
    if (filter?.questionType) query.questionType = filter.questionType;

    const docs = await QuestionModel.find(query).lean();
    return docs.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    })) as IQuestion[];
  }

  async findById(id: string): Promise<IQuestion | null> {
    const doc = await QuestionModel.findOne({ id }).lean();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id?.toString(),
    } as IQuestion;
  }

  async create(questionInput: IQuestionInput): Promise<IQuestion> {
    const doc = await QuestionModel.create(questionInput);
    const obj = doc.toObject();
    return {
      ...obj,
      _id: obj._id?.toString(),
    } as IQuestion;
  }

  async createMany(questions: IQuestionInput[]): Promise<IQuestion[]> {
    const docs = await QuestionModel.insertMany(questions);
    return docs.map((doc) => {
      const obj = doc.toObject();
      return {
        ...obj,
        _id: obj._id?.toString(),
      } as IQuestion;
    });
  }

  async count(): Promise<number> {
    return await QuestionModel.countDocuments();
  }

  async seedIfEmpty(seedData: IQuestionInput[]): Promise<number> {
    const currentCount = await this.count();
    if (currentCount === 0) {
      await this.createMany(seedData);
      return seedData.length;
    }
    return 0;
  }
}
