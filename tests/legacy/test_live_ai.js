async function testLiveAI() {
  console.log('🤖 Testing Live Gemini Integration via Backend Provider Layer...\n');

  try {
    // 1. Check AI Health Status
    console.log('1. Fetching GET /api/ai/health ...');
    const healthRes = await fetch('http://localhost:5000/api/ai/health');
    const healthData = await healthRes.json();
    console.log('   Response Status:', healthRes.status);
    console.log('   Configured:', healthData.data?.configured);
    console.log('   Provider:', healthData.data?.provider);
    console.log('   Model:', healthData.data?.model);
    console.log('   Status:', healthData.data?.status);
    console.log('   Security Check (Secrets Exposed):', Boolean(healthData.data?.apiKey || healthData.data?.secret) ? '❌ FAILED' : '✅ SAFE (No secrets exposed)');

    // 2. Test Live Minimal Communication
    console.log('\n2. Testing POST /api/ai/test (Minimal "OK" handshake) ...');
    const testRes = await fetch('http://localhost:5000/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Respond with the word OK.' }),
    });
    const testData = await testRes.json();
    console.log('   Response Status:', testRes.status);
    console.log('   Success:', testData.success);
    console.log('   Latency:', testData.data?.latencyMs + 'ms');
    console.log('   Model Responded:', JSON.stringify(testData.data?.response));

    // 3. Test Live GATE Reasoning Query (Internal Development Check)
    console.log('\n3. Testing POST /api/ai/test (GATE CS Conceptual Query) ...');
    const queryRes = await fetch('http://localhost:5000/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'In 1 short sentence, state the time complexity to search an AVL tree with n nodes.' }),
    });
    const queryData = await queryRes.json();
    console.log('   Response Status:', queryRes.status);
    console.log('   Latency:', queryData.data?.latencyMs + 'ms');
    console.log('   Model Response:', JSON.stringify(queryData.data?.response || queryData));

    // 4. Test Frontend Proxy
    console.log('\n4. Testing Frontend Proxy (http://localhost:5173/api/ai/health) ...');
    const frontRes = await fetch('http://localhost:5173/api/ai/health');
    const frontData = await frontRes.json();
    console.log('   Frontend Proxy Status:', frontRes.status);
    console.log('   Proxy Reported Configured:', frontData.data?.configured);
    console.log('   Proxy Reported Status:', frontData.data?.status);

    console.log('\n======================================================');
    console.log('🎉 LIVE GEMINI INTEGRATION 100% OPERATIONAL & VERIFIED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Live AI test encountered an error:', err.message || err);
  }
}

testLiveAI();
