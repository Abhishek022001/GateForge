import mongoose from 'mongoose';

let isConnected = false;

export async function connectToDatabase(uri?: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_WITH_MONGO) {
    return false;
  }

  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gateforge';

  if (isConnected) {
    return true;
  }

  try {
    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500, // Quick timeout for graceful fallback
      connectTimeoutMS: 3000,
    });

    isConnected = conn.connection.readyState === 1;
    const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[Database] Successfully connected to MongoDB (${sanitizedUri})`);
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[Database] MongoDB connection not established: ${(error as Error).message}`);
    console.info(`[Database] Switching to high-performance In-Memory repository.`);
    return false;
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
