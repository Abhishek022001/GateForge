function repairUnescapedBackslashes(jsonStr) {
  // Replace single backslashes that are NOT followed by valid JSON escape characters (", \, /, b, f, n, r, t, or uXXXX)
  return jsonStr.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\');
}

const badJson = '{"question": "Let $G = (V, E)$ with \\Delta(G) = 3 and \\underline{A} \\union B and \\theta = 0.5"}';
console.log('Original JSON:', badJson);
const repaired = repairUnescapedBackslashes(badJson);
console.log('Repaired JSON:', repaired);
const parsed = JSON.parse(repaired);
console.log('Parsed successfully:', parsed);
