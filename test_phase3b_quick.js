async function testEndpoints() {
  try {
    const health = await (await fetch('http://localhost:5000/api/health')).json();
    console.log('Backend Health:', health);

    const patterns = await (await fetch('http://localhost:5000/api/ai/patterns')).json();
    console.log('Initial Patterns Summary:', {
      totalQuestions: patterns.data?.totalQuestions,
      analyzedQuestions: patterns.data?.analyzedQuestions,
      unanalyzedQuestions: patterns.data?.unanalyzedQuestions,
      coveragePercentage: patterns.data?.coveragePercentage,
    });
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testEndpoints();
