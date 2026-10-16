async function test() {
  const res = await fetch('http://localhost:5000/api/ai/analyze-question/gate-cs-cn-005', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  console.log('CN Analysis Result:', JSON.stringify(data, null, 2));
}

test();
