import fs from 'node:fs';

const API_BASE = 'http://localhost:5000';

async function generateSample(title, context) {
  console.log(`\n======================================================`);
  console.log(`🚀 GENERATING: ${title}`);
  console.log(`======================================================`);
  console.log('Context:', JSON.stringify(context, null, 2));

  const start = Date.now();
  const res = await fetch(`${API_BASE}/api/ai/generation/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  });

  const latency = Date.now() - start;
  const json = await res.json();

  console.log(`\nHTTP Status: ${res.status} (${latency}ms)`);
  console.log('Generated Output:\n', JSON.stringify(json, null, 2));

  return json?.data?.data || json?.data;
}

async function main() {
  console.log('Running Manual Live Generation Checks for Task 3C.2...\n');

  // 1. Algorithms MCQ
  const algoMCQ = await generateSample('Algorithms MCQ (Dijkstra Shortest Path with Modified Weights)', {
    subject: 'Algorithms',
    topic: 'Graph Algorithms',
    subtopic: 'Shortest Paths',
    concepts: ["Dijkstra's algorithm", 'non-negative edge weights', 'edge weight transformation'],
    reasoningType: ['analytical', 'proof-based'],
    cognitiveSkill: 'analyze',
    questionPattern: 'Analyze the correctness of Dijkstra algorithm after adding a positive constant to all edge weights',
    difficulty: 'Medium',
    questionType: 'MCQ',
    relevantPYQs: [
      {
        question: 'Let G = (V, E) be a directed graph with non-negative edge weights. Which algorithm finds single-source shortest paths in O(|E| + |V| log |V|)?',
        questionType: 'MCQ',
        options: [
          { id: 'A', text: 'Bellman-Ford' },
          { id: 'B', text: "Dijkstra's algorithm with Fibonacci heap" },
          { id: 'C', text: 'Floyd-Warshall' },
          { id: 'D', text: 'Kruskal algorithm' },
        ],
        correctAnswer: 'B',
      },
    ],
  });

  // 2. DBMS MSQ
  const dbmsMSQ = await generateSample('DBMS MSQ (Relational Decomposition & Normal Forms)', {
    subject: 'Database Management Systems',
    topic: 'Relational Database Design',
    subtopic: 'Functional Dependencies & Normal Forms',
    concepts: ['Boyce-Codd Normal Form (BCNF)', 'Third Normal Form (3NF)', 'Lossless Join Decomposition', 'Dependency Preservation'],
    reasoningType: ['conceptual', 'analytical'],
    cognitiveSkill: 'evaluate',
    questionPattern: 'Evaluate properties of decomposition into 3NF and BCNF for a given relation and functional dependency set',
    difficulty: 'Hard',
    questionType: 'MSQ',
    relevantPYQs: [
      {
        question: 'Which of the following decomposition properties can ALWAYS be achieved simultaneously for any relational schema?',
        questionType: 'MSQ',
        options: [
          { id: 'A', text: 'Lossless join into 3NF' },
          { id: 'B', text: 'Dependency preservation into 3NF' },
          { id: 'C', text: 'Lossless join and dependency preservation into BCNF' },
          { id: 'D', text: 'Lossless join and dependency preservation into 3NF' },
        ],
        correctAnswer: ['A', 'B', 'D'],
      },
    ],
  });

  // 3. Operating Systems NAT
  const osNAT = await generateSample('Operating Systems NAT (Multi-level Paging & Memory Footprint)', {
    subject: 'Operating Systems',
    topic: 'Memory Management',
    subtopic: 'Paging & Multi-level Page Tables',
    concepts: ['multi-level paging', 'page table entry size', 'page size', 'virtual address translation'],
    reasoningType: ['calculation', 'numerical'],
    cognitiveSkill: 'apply',
    questionPattern: 'Compute the minimum number of page table pages required to map a specific virtual memory address range in a two-level paging scheme',
    difficulty: 'Medium',
    questionType: 'NAT',
    relevantPYQs: [
      {
        question: 'Consider a 32-bit virtual address space with 4 KB page size and 4-byte PTE. What is the size of the outer page table in bytes?',
        questionType: 'NAT',
        correctAnswer: 4096,
      },
    ],
  });

  // Write results to scratch file for detailed review
  fs.writeFileSync('manual_3c2_samples.json', JSON.stringify({ algoMCQ, dbmsMSQ, osNAT }, null, 2));
  console.log('\nAll 3 live samples generated and saved to manual_3c2_samples.json');
}

main().catch(console.error);
