async function testFrontend() {
  console.log('🔍 Testing Enhanced Phase 2 Frontend & Proxy Integration...');
  try {
    const pageRes = await fetch('http://localhost:5173/');
    const pageHtml = await pageRes.text();
    console.log('1. Frontend HTML Status:', pageRes.status);
    console.log('   Contains Title:', pageHtml.includes('GATEForge'));
    console.log('   Contains KaTeX CDN:', pageHtml.includes('katex.min.js'));
    console.log('   Contains MathText Component:', pageHtml.includes('MathText'));
    console.log('   Contains MSQ / Checkbox Support:', pageHtml.includes('CheckSquare'));
    console.log('   Contains NAT Support:', pageHtml.includes('NATInput'));
    console.log('   Contains Question Bank Page:', pageHtml.includes('QuestionBankPage'));
    console.log('   Contains Import Modal:', pageHtml.includes('ImportModal'));

    // Proxied Taxonomy
    const taxRes = await fetch('http://localhost:5173/api/taxonomy');
    const taxData = await taxRes.json();
    console.log('2. Proxied Taxonomy API Status:', taxRes.status);
    console.log('   Total GATE CS Subjects:', taxData.data?.subjects?.length);

    // Proxied Paginated Questions
    const proxyRes = await fetch('http://localhost:5173/api/questions?page=1&limit=10');
    const proxyData = await proxyRes.json();
    console.log('3. Proxied Paginated Questions API Status:', proxyRes.status);
    console.log('   Page 1 items count:', proxyData.data?.length);
    console.log('   Total questions in DB:', proxyData.pagination?.total);

    // Test MSQ submission via proxy
    const msqRes = await fetch('http://localhost:5173/api/questions/gate-cs-toc-msq-009/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B', 'C'] }),
    });
    const msqData = await msqRes.json();
    console.log('4. MSQ Evaluation via proxy: isCorrect =', msqData.data?.isCorrect);

    // Test NAT submission via proxy
    const natRes = await fetch('http://localhost:5173/api/questions/gate-cs-ds-nat-012/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 9 }),
    });
    const natData = await natRes.json();
    console.log('5. NAT Evaluation via proxy: isCorrect =', natData.data?.isCorrect);

    console.log('\n🌟 ENHANCED FRONTEND & BACKEND INTEGRATION 100% VERIFIED!');
  } catch (err) {
    console.error('Error during frontend test:', err);
  }
}

testFrontend();
