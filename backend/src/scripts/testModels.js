import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../config/ai.config.js';

async function testAllModels() {
  const config = getAIConfig();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  
  const models = ['gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-pro-latest', 'gemini-flash-latest'];
  for (const m of models) {
    try {
      console.log(`Trying ${m}...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: 'In one sentence, what is an AVL tree?',
      });
      const txt = res.text || res.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ ${m} response:`, txt?.trim());
      break;
    } catch (err) {
      console.log(`❌ ${m}:`, err.message?.slice(0, 150));
    }
  }
}

testAllModels();
