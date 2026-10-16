import { GoogleGenAI } from './backend/node_modules/@google/genai/dist/index.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const candidates = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-2.5-flash', 'gemini-2.5-pro'];
  for (const model of candidates) {
    try {
      console.log(`Testing model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: 'Respond with OK',
      });
      console.log(`✅ Success with model ${model}:`, response.text?.trim());
      break;
    } catch (err) {
      console.log(`❌ Failed ${model}:`, err.message?.slice(0, 140));
    }
  }
}

listModels();
