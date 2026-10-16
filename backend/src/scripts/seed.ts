import dotenv from 'dotenv';
import { connectToDatabase, disconnectDatabase } from '../config/db.js';
import { SEED_QUESTIONS } from '../data/seedQuestions.js';
import { MongoQuestionRepository } from '../repositories/MongoQuestionRepository.js';

dotenv.config();

async function runSeed() {
  console.log('🌱 Starting GATEForge Database Seeding...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gateforge';

  const connected = await connectToDatabase(mongoUri);
  if (!connected) {
    console.error('❌ Could not connect to MongoDB. Ensure MongoDB is running to execute seed script.');
    process.exit(1);
  }

  const repo = new MongoQuestionRepository();
  const currentCount = await repo.count();
  console.log(`Current questions in DB: ${currentCount}`);

  for (const q of SEED_QUESTIONS) {
    const existing = await repo.findById(q.id);
    if (!existing) {
      await repo.create(q);
      console.log(`+ Seeded [${q.subject}] - ${q.topic} (${q.id})`);
    } else {
      console.log(`= Already exists: ${q.id}`);
    }
  }

  const finalCount = await repo.count();
  console.log(`✅ Seeding complete. Total questions in database: ${finalCount}`);
  await disconnectDatabase();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
