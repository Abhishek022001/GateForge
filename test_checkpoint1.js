/**
 * Automated Verification Suite for GATEForge Checkpoint 1
 * (Official GATE Source Ingestion & Registry)
 */

import { isApprovedDomain, SourceRegistry, sourceRegistry } from './backend/src/services/gateSources/sourceRegistry.js';
import { OfficialGateSourceService, officialGateSourceService } from './backend/src/services/gateSources/officialGateSource.js';
import fs from 'node:fs';
import path from 'node:path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runCheckpoint1Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 1 VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: Domain Allowlist & SSRF Safeguards
  // ----------------------------------------------------
  console.log('🛡️ GROUP 1: Official Domain Allowlist & SSRF Safeguards');

  // Approved official GATE domains
  assert(isApprovedDomain('https://gate2024.iisc.ac.in/wp-content/uploads/2024/03/CS_GATE2024.pdf') === true, 'Approved: gate2024.iisc.ac.in');
  assert(isApprovedDomain('https://gate.iitk.ac.in/doc/2023/CS_GATE2023.pdf') === true, 'Approved: gate.iitk.ac.in');
  assert(isApprovedDomain('https://gate.iitkgp.ac.in/documents/CS_GATE2022.pdf') === true, 'Approved: gate.iitkgp.ac.in');
  assert(isApprovedDomain('https://gate2025.iitr.ac.in/papers/cs.pdf') === true, 'Approved: gate2025.iitr.ac.in');
  assert(isApprovedDomain('https://gate.iitb.ac.in/past-papers') === true, 'Approved: gate.iitb.ac.in');

  // Rejected coaching, commercial, or arbitrary third-party domains
  assert(isApprovedDomain('https://coaching-gate-prep.com/cs-2024.pdf') === false, 'Rejected: coaching-gate-prep.com');
  assert(isApprovedDomain('https://made-easy-solutions.org/gate2024.pdf') === false, 'Rejected: commercial solution site');
  assert(isApprovedDomain('https://random-blog.xyz/gate-pyqs.pdf') === false, 'Rejected: random-blog.xyz');
  assert(isApprovedDomain('https://google.com') === false, 'Rejected: non-gate general domain');

  // SSRF Protection: Localhost, private networks, cloud metadata
  assert(isApprovedDomain('http://localhost:5000/internal') === false, 'SSRF Block: localhost rejected');
  assert(isApprovedDomain('http://127.0.0.1:8080/admin') === false, 'SSRF Block: 127.0.0.1 rejected');
  assert(isApprovedDomain('http://169.254.169.254/latest/meta-data') === false, 'SSRF Block: AWS/cloud metadata IP rejected');
  assert(isApprovedDomain('http://192.168.1.1/router') === false, 'SSRF Block: private 192.168.x.x rejected');
  assert(isApprovedDomain('http://10.0.0.1/secrets') === false, 'SSRF Block: private 10.x.x.x rejected');
  assert(isApprovedDomain('ftp://gate.iitk.ac.in/file.pdf') === false, 'SSRF Block: non-http(s) protocol rejected');
  assert(isApprovedDomain('') === false, 'Empty string rejected');

  // ----------------------------------------------------
  // TEST GROUP 2: Source Registry Functionality
  // ----------------------------------------------------
  console.log('\n📋 GROUP 2: Source Registry Management');

  const testRegistry = new SourceRegistry();
  const initialSources = testRegistry.getSources();
  assert(initialSources.length >= 6, `Default registry seeds at least 6 official sources (found ${initialSources.length})`);

  const cs2024Paper = testRegistry.getSourceById('gate-2024-cs-paper');
  assert(cs2024Paper !== undefined, 'Can lookup gate-2024-cs-paper');
  assert(cs2024Paper?.year === 2024, 'gate-2024-cs-paper year is 2024');
  assert(cs2024Paper?.documentType === 'QUESTION_PAPER', 'Document type is QUESTION_PAPER');
  assert(cs2024Paper?.provider === 'OFFICIAL_GATE', 'Provider is OFFICIAL_GATE');

  const cs2024Key = testRegistry.getSourceById('gate-2024-cs-key');
  assert(cs2024Key?.documentType === 'ANSWER_KEY', 'gate-2024-cs-key document type is ANSWER_KEY');

  // Filter sources
  const year2023 = testRegistry.getSources({ year: 2023 });
  assert(year2023.length === 2, 'Filtering by year: 2023 returns paper and answer key');

  // Registering an official source
  testRegistry.registerSource({
    id: 'gate-2021-cs-paper',
    year: 2021,
    paper: 'CS',
    title: 'GATE 2021 CS Question Paper',
    documentType: 'QUESTION_PAPER',
    url: 'https://gate.iitb.ac.in/gate2021/CS.pdf',
    provider: 'OFFICIAL_GATE',
    status: 'DISCOVERED',
  });
  assert(testRegistry.hasSource('gate-2021-cs-paper') === true, 'Successfully registered new official source');

  // Registering an unapproved source throws an error
  let rejected = false;
  try {
    testRegistry.registerSource({
      id: 'fake-paper',
      year: 2024,
      paper: 'CS',
      title: 'Fake Question Paper',
      documentType: 'QUESTION_PAPER',
      url: 'https://unauthorized-site.com/paper.pdf',
      provider: 'OFFICIAL_GATE',
      status: 'DISCOVERED',
    });
  } catch (err) {
    rejected = true;
    assert(err.message.includes('not on the official GATE allowlist'), 'Throws error explaining domain is not allowlisted');
  }
  assert(rejected === true, 'Registry strictly blocks registering unapproved domains');

  // ----------------------------------------------------
  // TEST GROUP 3: Checksum & Provenance Metadata
  // ----------------------------------------------------
  console.log('\n🔒 GROUP 3: Checksum Calculation & Provenance Metadata');

  const service = new OfficialGateSourceService();
  const sampleBuffer = Buffer.from('OFFICIAL GATE CS QUESTION PAPER SAMPLE CONTENT FOR HASHING');
  const checksum = service.computeChecksum(sampleBuffer);
  assert(typeof checksum === 'string' && checksum.length === 64, `SHA-256 checksum computed (${checksum.slice(0, 16)}...)`);

  const mockRecord = {
    id: 'test-gate-source',
    year: 2024,
    paper: 'CS',
    title: 'GATE 2024 Computer Science Question Paper',
    documentType: 'QUESTION_PAPER',
    url: 'https://gate2024.iisc.ac.in/sample.pdf',
    provider: 'OFFICIAL_GATE',
    status: 'DOWNLOADED',
    checksum,
    downloadedAt: new Date().toISOString(),
  };

  const provenance = service.buildProvenance(mockRecord, 42, checksum);
  assert(provenance.type === 'PYQ', 'Provenance type is PYQ');
  assert(provenance.provider === 'OFFICIAL_GATE', 'Provenance provider is OFFICIAL_GATE');
  assert(provenance.exam === 'GATE', 'Provenance exam is GATE');
  assert(provenance.paper === 'CS', 'Provenance paper is CS');
  assert(provenance.year === 2024, 'Provenance year is 2024');
  assert(provenance.questionNumber === 42, 'Provenance question number is 42');
  assert(provenance.checksum === checksum, 'Provenance checksum matches computed SHA-256');
  assert(Boolean(provenance.fetchedAt), 'Provenance fetchedAt timestamp is recorded');

  // ----------------------------------------------------
  // TEST GROUP 4: Duplicate Source Detection & Caching
  // ----------------------------------------------------
  console.log('\n⚡ GROUP 4: Duplicate Source Detection & Caching');

  const testDir = path.resolve(process.cwd(), 'scratch/gate_test_downloads');
  fs.mkdirSync(testDir, { recursive: true });
  const testService = new OfficialGateSourceService(testDir);

  // Pre-seed a downloaded file to simulate previous successful download
  const testFileId = 'gate-2024-cs-paper';
  const dummyPdfPath = path.join(testDir, `${testFileId}.pdf`);
  const dummyContent = Buffer.from('%PDF-1.4 Mock Official GATE 2024 CS Content');
  fs.writeFileSync(dummyPdfPath, dummyContent);
  const testChecksum = testService.computeChecksum(dummyContent);

  sourceRegistry.markDownloaded(testFileId, {
    checksum: testChecksum,
    localPath: dummyPdfPath,
    sizeBytes: dummyContent.length,
    downloadedAt: new Date().toISOString(),
  });

  // Call downloadSource: should detect existing file + checksum and return cached: true without network call
  const cachedResult = await testService.downloadSource(testFileId);
  assert(cachedResult.success === true, 'Download request for existing source succeeds');
  assert(cachedResult.cached === true, 'Duplicate detection identifies already downloaded source (cached: true)');
  assert(cachedResult.checksum === testChecksum, 'Cached result preserves matching checksum');

  // ----------------------------------------------------
  // TEST GROUP 5: Network Failure & Error Handling
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 5: Network Failure & Safe Error Handling');

  // Non-existent source ID
  const invalidResult = await testService.downloadSource('non-existent-source-id');
  assert(invalidResult.success === false, 'Invalid source ID returns success: false');
  assert(invalidResult.error?.includes('not registered'), 'Provides descriptive error for unregistered source');

  // Source with rejected domain
  const unapprovedSource = {
    id: 'unapproved-source',
    year: 2024,
    paper: 'CS',
    title: 'Unapproved Source',
    documentType: 'QUESTION_PAPER',
    url: 'https://coaching-site.com/fake.pdf',
    provider: 'OFFICIAL_GATE',
    status: 'DISCOVERED',
  };
  // Directly insert into map to test downloadSource safeguard
  sourceRegistry['sources'].set(unapprovedSource.id, unapprovedSource);
  const unapprovedResult = await testService.downloadSource(unapprovedSource.id);
  assert(unapprovedResult.success === false, 'Download of unapproved domain fails security check');
  assert(unapprovedResult.error?.includes('Security Violation'), 'Returns Security Violation error message');

  // Clean up scratch test files
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 CHECKPOINT 1 TESTS COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCheckpoint1Tests().catch((err) => {
  console.error('Checkpoint 1 test suite execution failed:', err);
  process.exit(1);
});
