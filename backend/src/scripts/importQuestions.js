import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importService } from '../services/import.service.js';
import { SEED_QUESTIONS } from '../data/seedQuestions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standalone DB store for CLI script if running standalone
class StandaloneStore {
  constructor() {
    this.questions = new Map();
    for (const q of SEED_QUESTIONS) {
      this.questions.set(q.id, { ...q });
    }
  }
  findAll() {
    return Array.from(this.questions.values());
  }
  create(q) {
    this.questions.set(q.id, { ...q });
    return q;
  }
}

async function runCliImport() {
  const filePathArg = process.argv[2];

  if (!filePathArg) {
    console.error('❌ Error: Please provide a path to a JSON file to import.');
    console.log('Usage: npm run import:questions <path-to-json-file>');
    process.exit(1);
  }

  const resolvedPath = path.isAbsolute(filePathArg)
    ? filePathArg
    : path.resolve(process.cwd(), filePathArg);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: File not found at path: ${resolvedPath}`);
    process.exit(1);
  }

  let rawData;
  try {
    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    rawData = JSON.parse(fileContent);
  } catch (err) {
    console.error(`❌ Error parsing JSON file: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(rawData)) {
    console.error('❌ Error: Import file must contain a top-level JSON array of question objects.');
    process.exit(1);
  }

  console.log('\n=========================================');
  console.log('📦 GATEForge Question Import');
  console.log('=========================================');
  console.log(`Source File: ${path.basename(resolvedPath)}`);
  console.log(`Total records: ${rawData.length}\n`);

  const store = new StandaloneStore();
  const summary = await importService.importQuestions(rawData, store);

  console.log(`Valid: ${summary.valid}`);
  console.log(`Imported: ${summary.imported}`);
  console.log(`Duplicates: ${summary.duplicates}`);
  console.log(`Invalid: ${summary.failed}`);
  console.log('=========================================');

  if (summary.errors.length > 0) {
    console.log('\nValidation Failures:');
    summary.errors.forEach((err) => {
      console.log(` • [Index ${err.index}${err.id ? ` - ${err.id}` : ''}]: ${err.errors.join('; ')}`);
    });
  }

  if (summary.duplicateDetails.length > 0) {
    console.log('\nDuplicates Skipped:');
    summary.duplicateDetails.forEach((dup) => {
      console.log(` • [Index ${dup.index}${dup.id ? ` - ${dup.id}` : ''}]: ${dup.reason}`);
    });
  }

  console.log('\n✅ Import completed successfully.\n');
  process.exit(0);
}

runCliImport().catch((err) => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
