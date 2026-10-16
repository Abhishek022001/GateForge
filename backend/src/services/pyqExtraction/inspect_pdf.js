import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function test() {
  const filePath = path.resolve('backend/data/gate_downloads/gate-2024-cs-paper.pdf');
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  console.log('Number of pages in array:', textResult.pages?.length);
  if (textResult.pages?.length > 0) {
    console.log('Page 0 keys:', Object.keys(textResult.pages[0]));
    console.log('Page 0 text preview:', textResult.pages[0].text?.slice(0, 150));
  }
}

test().catch(console.error);
