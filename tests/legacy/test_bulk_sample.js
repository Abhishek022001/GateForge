async function testBulkMultiSubject() {
  console.log('🧠 Testing Bulk Analysis on Multi-Subject Questions (DBMS, OS, TOC)...\n');

  try {
    const res = await fetch('http://localhost:5000/api/ai/analyze-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionIds: ['gate-cs-algo-002', 'gate-cs-dbms-003', 'gate-cs-os-004', 'gate-cs-toc-005'],
        force: true,
      }),
    });

    const data = await res.json();
    console.log('Bulk Analysis Status:', res.status);
    console.log('Summary:', data.message);
    console.log('Analyzed:', data.data?.analyzed);
    console.log('Skipped:', data.data?.skipped);
    console.log('Failed:', data.data?.failed);

    for (const r of data.data?.results || []) {
      console.log(`\n=== Question: ${r.questionId} ===`);
      console.log('Subject/Topic:', r.aiAnalysis?.concepts?.join(', '));
      console.log('Question Pattern:', r.aiAnalysis?.questionPattern);
      console.log('Solution Approach:', r.aiAnalysis?.solutionApproach);
      console.log('Cognitive Skill:', r.aiAnalysis?.cognitiveSkill);
      console.log('Reasoning:', r.aiAnalysis?.reasoningType?.join(', '));
      console.log('Common Traps:', r.aiAnalysis?.commonTraps);
    }

    console.log('\n--- Checking Aggregation Across 4 Distinct Questions ---');
    const pat = await (await fetch('http://localhost:5000/api/ai/patterns')).json();
    console.log('Aggregate Patterns:', {
      totalQuestions: pat.data?.totalQuestions,
      analyzedQuestions: pat.data?.analyzedQuestions,
      coveragePercentage: pat.data?.coveragePercentage + '%',
      topConcepts: pat.data?.conceptFrequencies?.topGlobal,
      bySubject: Object.keys(pat.data?.conceptFrequencies?.bySubject || {}),
      reasoningTypes: pat.data?.reasoningTypeDistribution,
      cognitiveSkills: pat.data?.cognitiveSkillDistribution,
    });
  } catch (err) {
    console.error('Bulk test failed:', err);
  }
}

testBulkMultiSubject();
