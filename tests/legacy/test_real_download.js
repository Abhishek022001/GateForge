import { officialGateSourceService } from './backend/src/services/gateSources/officialGateSource.js';

async function testDownload() {
  console.log('Testing official GATE 2024 CS download...');
  const res = await officialGateSourceService.downloadSource('gate-2024-cs-paper', { timeoutMs: 25000 });
  console.log('Download result:', {
    success: res.success,
    sizeBytes: res.sizeBytes,
    checksum: res.checksum,
    cached: res.cached,
    error: res.error,
  });
}

testDownload();
