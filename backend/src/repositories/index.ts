import { isDatabaseConnected } from '../config/db.js';
import { SEED_QUESTIONS } from '../data/seedQuestions.js';
import { OFFICIAL_IMPORTED_PYQS } from '../data/officialImportedPyqs.js';
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
    const combined = [...SEED_QUESTIONS, ...(Array.isArray(OFFICIAL_IMPORTED_PYQS) ? OFFICIAL_IMPORTED_PYQS : [])];
    inMemoryRepo = new InMemoryQuestionRepository(combined);
  }
  return inMemoryRepo;
}

export { IQuestionRepository, MongoQuestionRepository, InMemoryQuestionRepository };
