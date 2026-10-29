async function testSingleAnalysis() {
  console.log('🧠 Testing AI Question Analysis on gate-cs-ds-001 (AVL Tree Question)...\n');

  try {
    const res = await fetch('http://localhost:5000/api/ai/analyze-question/gate-cs-ds-001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Success:', data.success);
    console.log('Cached:', data.data?.cached);
    console.log('Latency:', data.data?.latencyMs + 'ms');
    console.log('\n--- Generated aiAnalysis ---');
    console.log('Concepts:', data.data?.aiAnalysis?.concepts);
    console.log('Sub-Concepts:', data.data?.aiAnalysis?.subConcepts);
    console.log('Reasoning Type:', data.data?.aiAnalysis?.reasoningType);
    console.log('Cognitive Skill:', data.data?.aiAnalysis?.cognitiveSkill);
    console.log('Question Pattern:', data.data?.aiAnalysis?.questionPattern);
    console.log('Solution Approach:', data.data?.aiAnalysis?.solutionApproach);
    console.log('Difficulty Assessment:', data.data?.aiAnalysis?.difficultyAssessment);
    console.log('Common Traps:', data.data?.aiAnalysis?.commonTraps);
    console.log('Required Knowledge:', data.data?.aiAnalysis?.requiredKnowledge);
    console.log('GATE Characteristics:', data.data?.aiAnalysis?.gateCharacteristics);
    console.log('Analysis Version:', data.data?.aiAnalysis?.analysisVersion);
    console.log('Analyzed At:', data.data?.aiAnalysis?.analyzedAt);

    // Test Caching: Call again without force
    console.log('\n--- Testing Caching (Second Call) ---');
    const secondRes = await (await fetch('http://localhost:5000/api/ai/analyze-question/gate-cs-ds-001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })).json();
    console.log('Second Call Cached:', secondRes.data?.cached);

    // Test Patterns Aggregation after 1 analysis
    console.log('\n--- Testing Patterns Aggregation ---');
    const patternsRes = await (await fetch('http://localhost:5000/api/ai/patterns')).json();
    console.log('Patterns Summary:', {
      total: patternsRes.data?.totalQuestions,
      analyzed: patternsRes.data?.analyzedQuestions,
      coverage: patternsRes.data?.coveragePercentage + '%',
      topConcepts: patternsRes.data?.conceptFrequencies?.topGlobal,
      reasoningTypes: patternsRes.data?.reasoningTypeDistribution,
    });
  } catch (err) {
    console.error('Analysis failed:', err);
  }
}

testSingleAnalysis();
