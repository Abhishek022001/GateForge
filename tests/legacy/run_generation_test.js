async function main() {
  const res = await fetch('http://localhost:5000/api/ai/generation/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Return a JSON object containing {"status":"ok"}.',
    }),
  });

  const json = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Response Body:\n', JSON.stringify(json, null, 2));
}

main();
