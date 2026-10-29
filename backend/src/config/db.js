import mongoose from 'mongoose';

let isConnected = false;

export async function connectToDatabase(uri) {
  if (isConnected) {
    return true;
  }

  const mongoUri = uri || process.env.MONGODB_URI;
  if (!mongoUri || (process.env.NODE_ENV === 'test' && !process.env.TEST_WITH_MONGO)) {
    console.info('[Database] Test mode or MONGODB_URI not set; using clean high-performance in-memory repository.');
    return false;
  }

  try {
    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 4000,
    });

    isConnected = conn.connection.readyState === 1;
    const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[Database] Successfully connected to MongoDB (${sanitizedUri})`);
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[Database] MongoDB connection not established: ${error.message}`);
    console.info(`[Database] Switching to clean high-performance fallback repository.`);
    return false;
  }
}

export function isDatabaseConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
