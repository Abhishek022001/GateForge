import { isDatabaseConnected } from '../config/db.js';
import { SEED_QUESTIONS } from '../data/seedQuestions.js';
import { IQuestionRepository } from './IQuestionRepository.js';
import { InMemoryQuestionRepository } from './InMemoryQuestionRepository.js';
import { MongoQuestionRepository } from './MongoQuestionRepository.js';

let mongoRepo: MongoQuestionRepository | null = null;
let inMemoryRepo: InMemoryQuestionRepository | null = null;

export function getQuestionRepository(): IQuestionRepository {
  if (isDatabaseConnected()) {
    if (!mongoRepo) {
      mongoRepo = new MongoQuestionRepository();
    }
    return mongoRepo;
  }

  if (!inMemoryRepo) {
    inMemoryRepo = new InMemoryQuestionRepository(SEED_QUESTIONS);
  }
  return inMemoryRepo;
}

export { IQuestionRepository, MongoQuestionRepository, InMemoryQuestionRepository };
