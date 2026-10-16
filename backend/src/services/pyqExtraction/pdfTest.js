import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export async function testPdfParse(buffer) {
  const data = await pdf(buffer);
  return {
    pages: data.numpages,
    text: data.text,
  };
}
