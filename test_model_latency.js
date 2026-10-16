import { GoogleGenAI } from './backend/node_modules/@google/genai/dist/index.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const apiKey = process.env.GEMINI_API_KEY;
console.log('Testing Gemini models...');

async function testModel(modelName) {
  const client = new GoogleGenAI({ apiKey });
  const start = Date.now();
  try {
    const res = await client.models.generateContent({
      model: modelName,
      contents: 'Return a JSON object containing {"status":"ok"}.',
      config: {
        responseMimeType: 'application/json',
      },
    });
    console.log(`[${modelName}] Success in ${Date.now() - start}ms:`, res.text);
  } catch (err) {
    console.error(`[${modelName}] Failed in ${Date.now() - start}ms:`, err.message);
  }
}

async function run() {
  await testModel('gemini-2.5-flash');
  await testModel('gemini-flash-lite-latest');
}

run();
