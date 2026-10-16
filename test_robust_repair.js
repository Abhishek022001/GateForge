// Test: What happens when \\Delta is in jsonStr?
const badExample = '{"question": "Let $G = (V, E)$ and \\\\Delta = 4"}';
console.log('Original JSON string in memory:');
console.log(badExample);

function naiveRepair(jsonStr) {
  return jsonStr.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\');
}

const badRepaired = naiveRepair(badExample);
console.log('\nNaive Repaired:');
console.log(badRepaired);
try {
  JSON.parse(badRepaired);
  console.log('Naive Parse: SUCCESS');
} catch (e) {
  console.log('Naive Parse: FAILED ->', e.message);
}

// Proper repair: Parse through characters and tokenize properly
function robustRepair(jsonStr) {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < jsonStr.length) {
    const char = jsonStr[i];

    if (char === '"' && (i === 0 || jsonStr[i - 1] !== '\\')) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (inString && char === '\\') {
      const next = jsonStr[i + 1];
      // Check if it's already an escaped backslash
      if (next === '\\') {
        result += '\\\\';
        i += 2;
        continue;
      }
      // Check if it's a valid standard JSON escape
      if (['"', '/', 'b', 'f', 'n', 'r', 't'].includes(next)) {
        result += '\\' + next;
        i += 2;
        continue;
      }
      // Check if it's a valid unicode escape \uXXXX
      if (next === 'u') {
        const hex = jsonStr.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += '\\u' + hex;
          i += 6;
          continue;
        }
      }
      // Otherwise, it's an unescaped single backslash (e.g. \Delta, \le, \Theta, \in, \text)
      result += '\\\\';
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

const robustRepaired = robustRepair(badExample);
console.log('\nRobust Repaired:');
console.log(robustRepaired);
try {
  console.log('Robust Parse: SUCCESS ->', JSON.parse(robustRepaired));
} catch (e) {
  console.log('Robust Parse: FAILED ->', e.message);
}
