export const SEED_QUESTIONS = [
  // --- 1. DATA STRUCTURES (MCQ) ---
  {
    id: 'gate-cs-ds-001',
    subject: 'Data Structures',
    topic: 'Binary Search Trees & AVL Trees',
    subtopic: 'Tree Height and Node Properties',
    concepts: ['AVL tree', 'height-balanced BST', 'recurrence relations', 'minimum nodes'],
    year: 2024,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 1,
    questionType: 'MCQ',
    difficulty: 'Medium',
    question:
      'What is the minimum number of nodes in an AVL tree (height-balanced binary search tree) of height $h = 5$, assuming the height of an AVL tree with a single root node is defined as $h = 0$?',
    options: [
      { id: 'A', text: '12' },
      { id: 'B', text: '20' },
      { id: 'C', text: '17' },
      { id: 'D', text: '31' },
    ],
    correctAnswer: 'B',
    explanation:
      'For an AVL tree where the height of a single node is $h = 0$, the minimum number of nodes $N(h)$ for height $h$ satisfies the recurrence relation:\n\n' +
      '$$N(0) = 1$$\n' +
      '$$N(1) = 2$$\n' +
      '$$N(h) = N(h - 1) + N(h - 2) + 1 \\quad \\text{for } h \\ge 2$$\n\n' +
      'Calculating sequentially:\n' +
      '• $N(2) = N(1) + N(0) + 1 = 2 + 1 + 1 = 4$\n' +
      '• $N(3) = N(2) + N(1) + 1 = 4 + 2 + 1 = 7$\n' +
      '• $N(4) = N(3) + N(2) + 1 = 7 + 4 + 1 = 12$\n' +
      '• $N(5) = N(4) + N(3) + 1 = 12 + 7 + 1 = 20$\n\n' +
      'Therefore, the minimum number of nodes in an AVL tree of height $5$ is **20**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2024,
      paper: 'CS',
      questionNumber: 1,
      notes: 'Standard development question for AVL tree minimum node recurrence',
    },
    reasoningType: ['calculation', 'conceptual'],
  },

  // --- 2. ALGORITHMS (MCQ) ---
  {
    id: 'gate-cs-algo-002',
    subject: 'Algorithms',
    topic: 'Divide and Conquer & Recurrence Relations',
    subtopic: 'Master Theorem & Asymptotic Analysis',
    concepts: ['Master Theorem', 'asymptotic analysis', 'divide and conquer', 'recurrence bounds'],
    year: 2024,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 2,
    questionType: 'MCQ',
    difficulty: 'Medium',
    question:
      'Consider the recurrence relation:\n\n' +
      '$$T(n) = 3T\\left(\\frac{n}{2}\\right) + \\Theta(n \\log_2 n)$$\n\n' +
      'Which of the following describes the tight asymptotic bound for $T(n)$?',
    options: [
      { id: 'A', text: '$\\Theta(n \\log_2 n)$' },
      { id: 'B', text: '$\\Theta(n^{\\log_2 3})$' },
      { id: 'C', text: '$\\Theta(n^{\\log_2 3} \\cdot \\log_2 n)$' },
      { id: 'D', text: '$\\Theta(n^2)$' },
    ],
    correctAnswer: 'B',
    explanation:
      'We apply the Master Theorem for $T(n) = aT(n/b) + f(n)$ where $a = 3$, $b = 2$, and $f(n) = \\Theta(n \\log_2 n)$:\n\n' +
      '1. Calculate $n^{\\log_b a} = n^{\\log_2 3} \\approx n^{1.585}$.\n' +
      '2. Compare $f(n) = n \\log_2 n$ with $n^{\\log_2 3}$. Since $f(n) = O(n^{\\log_2 3 - \\epsilon})$ for $\\epsilon \\approx 0.585 > 0$, **Case 1** of the Master Theorem applies.\n\n' +
      'Therefore, the tight bound is:\n' +
      '$$T(n) = \\Theta(n^{\\log_2 3})$$',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2024,
      paper: 'CS',
      questionNumber: 2,
      notes: 'Master Theorem asymptotic bound calculation',
    },
    reasoningType: ['analytical', 'conceptual'],
  },

  // --- 3. DBMS (MCQ) ---
  {
    id: 'gate-cs-dbms-003',
    subject: 'DBMS',
    topic: 'Relational Model & Normalization',
    subtopic: 'Candidate Keys and Boyce-Codd Normal Form',
    concepts: ['functional dependency', 'candidate keys', 'prime attributes', '3NF', 'BCNF'],
    year: 2023,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 3,
    questionType: 'MCQ',
    difficulty: 'Hard',
    question:
      'Given a relation schema $R(A, B, C, D, E)$ with the functional dependency set:\n\n' +
      '$$F = \\{ A \\to BC, \\; CD \\to E, \\; B \\to D, \\; E \\to A \\}$$\n\n' +
      'What is the highest normal form satisfied by relation $R$?',
    options: [
      { id: 'A', text: '1NF only' },
      { id: 'B', text: '2NF but not 3NF' },
      { id: 'C', text: '3NF but not BCNF' },
      { id: 'D', text: 'BCNF' },
    ],
    correctAnswer: 'C',
    explanation:
      'Let us find candidate keys for $R(A, B, C, D, E)$:\n' +
      '1. $(A)^+ = \\{A, B, C, D, E\\} \\implies A$ is a candidate key.\n' +
      '2. Since $E \\to A$, $(E)^+ = \\{A, B, C, D, E\\} \\implies E$ is a candidate key.\n' +
      '3. Since $CD \\to E$, $(CD)^+ = \\{C, D, E, A, B\\} \\implies CD$ is a candidate key.\n' +
      '4. Since $B \\to D$, $(BC)^+ = \\{B, C, D, E, A\\} \\implies BC$ is a candidate key.\n\n' +
      'Prime attributes (attributes that belong to at least one candidate key) are: $\\{A, B, C, D, E\\}$. **All attributes in $R$ are prime!**\n\n' +
      '• **Checking 3NF:** For every FD $X \\to Y$, either $X$ is a superkey OR $Y$ is a prime attribute. Since every attribute in $R$ is prime, 3NF is satisfied by all dependencies.\n' +
      '• **Checking BCNF:** For $B \\to D$, $B$ is not a superkey of $R$ since $(B)^+ = \\{B, D\\} \\ne \\{A, B, C, D, E\\}$. Thus, $B \\to D$ violates BCNF.\n\n' +
      'Therefore, the highest normal form satisfied is **3NF but not BCNF**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2023,
      paper: 'CS',
      questionNumber: 3,
    },
    reasoningType: ['analytical', 'logical'],
  },

  // --- 4. OPERATING SYSTEMS (MCQ) ---
  {
    id: 'gate-cs-os-004',
    subject: 'Operating Systems',
    topic: 'Process Synchronization & Concurrency',
    subtopic: 'Counting Semaphores',
    concepts: ['counting semaphores', 'process synchronization', 'wait operation', 'signal operation'],
    year: 2023,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 4,
    questionType: 'MCQ',
    difficulty: 'Easy',
    question:
      'A counting semaphore $S$ is initialized to $12$. During the execution of a system, $18$ $P$ (wait / down) operations and $9$ $V$ (signal / up) operations were performed on $S$ in an arbitrary sequence. What is the final value of the semaphore $S$?',
    options: [
      { id: 'A', text: '3' },
      { id: 'B', text: '-3' },
      { id: 'C', text: '5' },
      { id: 'D', text: '0' },
    ],
    correctAnswer: 'A',
    explanation:
      'Each $P$ (wait) operation decrements the semaphore value by $1$.\n' +
      'Each $V$ (signal) operation increments the semaphore value by $1$.\n\n' +
      '$$\\text{Final Value} = S_{\\text{init}} - (\\text{Count of } P) + (\\text{Count of } V)$$\n' +
      '$$\\text{Final Value} = 12 - 18 + 9 = 3$$\n\n' +
      'Therefore, the final value of semaphore $S$ is **3**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2023,
      paper: 'CS',
      questionNumber: 4,
    },
    reasoningType: ['calculation'],
  },

  // --- 5. COMPUTER NETWORKS (MCQ) ---
  {
    id: 'gate-cs-cn-005',
    subject: 'Computer Networks',
    topic: 'Data Link Layer & Flow Control',
    subtopic: 'Selective Repeat & Go-Back-N Protocol',
    concepts: ['Selective Repeat', 'sliding window protocol', 'sequence number space', 'window size'],
    year: 2022,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 5,
    questionType: 'MCQ',
    difficulty: 'Medium',
    question:
      'In a Selective Repeat Sliding Window Protocol with a $k$-bit sequence number field, what are the maximum allowable sender window size ($W_s$) and receiver window size ($W_r$) respectively to prevent sequence number ambiguity?',
    options: [
      { id: 'A', text: '$W_s = 2^k - 1, \\; W_r = 1$' },
      { id: 'B', text: '$W_s = 2^{k-1}, \\; W_r = 2^{k-1}$' },
      { id: 'C', text: '$W_s = 2^k, \\; W_r = 2^k$' },
      { id: 'D', text: '$W_s = 2^{k-1}, \\; W_r = 1$' },
    ],
    correctAnswer: 'B',
    explanation:
      'In Selective Repeat (SR) protocol, the receiver maintains a window of size $W_r > 1$ to buffer out-of-order frames.\n\n' +
      'To prevent overlap between the current receiver window and the sender window upon unacknowledged retransmissions, the protocol requires:\n' +
      '$$W_s + W_r \\le 2^k$$\n\n' +
      'For maximum throughput with symmetric sender and receiver buffers:\n' +
      '$$W_s = W_r = 2^{k-1}$$\n\n' +
      'Hence, maximum sender and receiver window sizes are $2^{k-1}$ and $2^{k-1}$.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2022,
      paper: 'CS',
      questionNumber: 5,
    },
    reasoningType: ['conceptual', 'analytical'],
  },

  // --- 6. COMPUTER ORGANIZATION (MCQ) ---
  {
    id: 'gate-cs-coa-006',
    subject: 'Computer Organization and Architecture',
    topic: 'Memory Hierarchy & Cache Memory',
    subtopic: 'Direct Mapped and Set Associative Caches',
    concepts: ['set associative cache', 'tag bits', 'set index', 'block offset', 'memory hierarchy'],
    year: 2022,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 6,
    questionType: 'MCQ',
    difficulty: 'Hard',
    question:
      'A 4-way set-associative cache memory has a total capacity of $64\\text{ KB}$ with a cache block (line) size of $32\\text{ Bytes}$. The processor generates $32$-bit physical addresses. What are the bit allocations for the Tag, Set Index, and Block Offset fields respectively?',
    options: [
      { id: 'A', text: 'Tag = 18 bits, Index = 9 bits, Offset = 5 bits' },
      { id: 'B', text: 'Tag = 16 bits, Index = 11 bits, Offset = 5 bits' },
      { id: 'C', text: 'Tag = 17 bits, Index = 10 bits, Offset = 5 bits' },
      { id: 'D', text: 'Tag = 19 bits, Index = 8 bits, Offset = 5 bits' },
    ],
    correctAnswer: 'A',
    explanation:
      'Step-by-step bit field calculation:\n\n' +
      '1. **Block Offset:** Block size $= 32\\text{ Bytes} = 2^5\\text{ Bytes} \\implies \\text{Offset} = 5\\text{ bits}$.\n' +
      '2. **Total cache lines:** $\\frac{\\text{Cache Size}}{\\text{Block Size}} = \\frac{64 \\times 1024}{32} = 2048 = 2^{11}\\text{ lines}$.\n' +
      '3. **Number of Sets:** For a 4-way set-associative cache ($P = 4 = 2^2$ lines per set):\n' +
      '   $$\\text{Number of Sets} = \\frac{2048}{4} = 512 = 2^9 \\implies \\text{Set Index} = 9\\text{ bits}$$\n' +
      '4. **Tag bits:** $\\text{Tag} = 32 - 9 - 5 = 18\\text{ bits}$.\n\n' +
      'Result: **Tag = 18 bits, Index = 9 bits, Offset = 5 bits**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2022,
      paper: 'CS',
      questionNumber: 6,
    },
    reasoningType: ['calculation', 'analytical'],
  },

  // --- 7. THEORY OF COMPUTATION (MCQ) ---
  {
    id: 'gate-cs-toc-007',
    subject: 'Theory of Computation',
    topic: 'Regular Languages & Finite Automata',
    subtopic: 'DFA Minimization and Equivalence',
    concepts: ['DFA minimization', 'Myhill-Nerode theorem', 'state equivalence', 'regular language'],
    year: 2021,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 7,
    questionType: 'MCQ',
    difficulty: 'Medium',
    question:
      'What is the minimum number of states in a Deterministic Finite Automaton (DFA) that accepts the language over the alphabet $\\Sigma = \\{0, 1\\}$ consisting of all strings where the $3^{\\text{rd}}$ symbol from the right end is always $1$?',
    options: [
      { id: 'A', text: '4' },
      { id: 'B', text: '6' },
      { id: 'C', text: '8' },
      { id: 'D', text: '16' },
    ],
    correctAnswer: 'C',
    explanation:
      'For the formal language $L = \\{ w \\in \\{0,1\\}^* \\mid \\text{the } k\\text{-th symbol from the right end is } 1 \\}$:\n\n' +
      '• A DFA must remember the last $k$ symbols read in the input stream.\n' +
      '• Here $k = 3$, requiring tracking of all possible 3-bit suffixes: $\\{000, 001, 010, 011, 100, 101, 110, 111\\}$.\n' +
      '• By the Myhill-Nerode theorem, all $2^3 = 8$ right-equivalence classes are pairwise distinguishable.\n\n' +
      'Thus, the minimum number of states in the minimal DFA is $2^3 = \\mathbf{8}$ states.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2021,
      paper: 'CS',
      questionNumber: 7,
    },
    reasoningType: ['proof-based', 'conceptual'],
  },

  // --- 8. ENGINEERING MATHEMATICS (MCQ) ---
  {
    id: 'gate-cs-em-008',
    subject: 'Engineering Mathematics',
    topic: 'Linear Algebra',
    subtopic: 'Eigenvalues and Cayley-Hamilton Theorem',
    concepts: ['eigenvalues', 'Cayley-Hamilton theorem', 'matrix characteristic equation', 'matrix inverse'],
    year: 2024,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 8,
    questionType: 'MCQ',
    difficulty: 'Medium',
    question:
      'Let $A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}$. What are the eigenvalues of matrix $A^3 - 4A^2 + 5A$?',
    options: [
      { id: 'A', text: '0 and 6' },
      { id: 'B', text: '2 and 6' },
      { id: 'C', text: '0 and 12' },
      { id: 'D', text: '3 and 9' },
    ],
    correctAnswer: 'B',
    explanation:
      'Step-by-step spectral mapping calculation:\n\n' +
      '1. Find the eigenvalues of $A$:\n' +
      '   $$\\det(A - \\lambda I) = (2 - \\lambda)^2 - 1 = \\lambda^2 - 4\\lambda + 3 = (\\lambda - 3)(\\lambda - 1) = 0$$\n' +
      '   Eigenvalues of $A$ are $\\lambda_1 = 3$ and $\\lambda_2 = 1$.\n\n' +
      '2. By the Spectral Mapping Theorem, if $\\lambda$ is an eigenvalue of $A$, then $f(\\lambda) = \\lambda^3 - 4\\lambda^2 + 5\\lambda$ is an eigenvalue of $f(A)$:\n' +
      '   • For $\\lambda_1 = 3$: $f(3) = 3^3 - 4(3^2) + 5(3) = 27 - 36 + 15 = 6$\n' +
      '   • For $\\lambda_2 = 1$: $f(1) = 1^3 - 4(1^2) + 5(1) = 1 - 4 + 5 = 2$\n\n' +
      'Therefore, the eigenvalues of $f(A)$ are **2 and 6**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2024,
      paper: 'CS',
      questionNumber: 8,
    },
    reasoningType: ['calculation', 'analytical'],
  },

  // --- 9. MSQ: THEORY OF COMPUTATION ---
  {
    id: 'gate-cs-toc-msq-009',
    subject: 'Theory of Computation',
    topic: 'Regular Languages & Closure Properties',
    subtopic: 'Closure Operations and Formal Grammars',
    concepts: ['regular language closure', 'homomorphism', 'Kleene star', 'infinite union', 'complement'],
    year: 2024,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 9,
    questionType: 'MSQ',
    difficulty: 'Medium',
    question:
      'Which of the following operations are **closed** under the class of regular languages over an alphabet $\\Sigma$?',
    options: [
      { id: 'A', text: 'Finite union and intersection' },
      { id: 'B', text: 'Kleene star ($L^*$)' },
      { id: 'C', text: 'Homomorphism and inverse homomorphism' },
      { id: 'D', text: 'Countable infinite union' },
    ],
    correctAnswer: ['A', 'B', 'C'],
    explanation:
      'Let us review the closure properties of regular languages:\n\n' +
      '• **Option A (True):** Regular languages are closed under Boolean operations including finite union, intersection, and set difference.\n' +
      '• **Option B (True):** Regular languages are closed under Kleene closure ($L^*$) and positive closure ($L^+$).\n' +
      '• **Option C (True):** Regular languages are closed under string homomorphism and inverse homomorphism.\n' +
      '• **Option D (False):** Regular languages are NOT closed under infinite union (e.g., each singleton string $\{a^n b^n\}$ is regular, but their infinite union $\\bigcup_{n=0}^\\infty \\{a^n b^n\\} = \\{a^n b^n \\mid n \\ge 0\\}$ is context-free and non-regular).\n\n' +
      'Correct options are **A, B, and C**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2024,
      paper: 'CS',
      questionNumber: 9,
    },
    reasoningType: ['conceptual', 'proof-based'],
  },

  // --- 10. MSQ: OPERATING SYSTEMS ---
  {
    id: 'gate-cs-os-msq-010',
    subject: 'Operating Systems',
    topic: 'Deadlocks & Process Synchronization',
    subtopic: 'Coffman Conditions & Resource Allocation',
    concepts: ['deadlock conditions', 'Coffman conditions', 'mutual exclusion', 'hold and wait', 'circular wait'],
    year: 2023,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 10,
    questionType: 'MSQ',
    difficulty: 'Medium',
    question:
      'Which of the following are necessary Coffman conditions that MUST hold simultaneously for a system deadlock to occur?',
    options: [
      { id: 'A', text: 'Mutual Exclusion' },
      { id: 'B', text: 'Hold and Wait' },
      { id: 'C', text: 'Preemption of held resources' },
      { id: 'D', text: 'Circular Wait' },
    ],
    correctAnswer: ['A', 'B', 'D'],
    explanation:
      'The four necessary Coffman conditions for deadlock are:\n\n' +
      '1. **Mutual Exclusion (Option A):** At least one resource must be held in a non-shareable mode.\n' +
      '2. **Hold and Wait (Option B):** A process must be currently holding at least one resource and requesting additional resources held by other processes.\n' +
      '3. **No Preemption (Option C is incorrect because it specifies Preemption):** Resources cannot be preempted; a resource can be released only voluntarily by the process holding it.\n' +
      '4. **Circular Wait (Option D):** A closed cycle of processes must exist where each process waits for a resource held by the next process in the chain.\n\n' +
      'Hence, the necessary conditions among the choices are **A, B, and D**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2023,
      paper: 'CS',
      questionNumber: 10,
    },
    reasoningType: ['conceptual'],
  },

  // --- 11. MSQ: ALGORITHMS ---
  {
    id: 'gate-cs-algo-msq-011',
    subject: 'Algorithms',
    topic: 'Greedy Algorithms & Minimum Spanning Trees',
    subtopic: 'Kruskal, Prim, and Cut Properties',
    concepts: ['minimum spanning tree', 'Kruskal algorithm', 'cut property', 'unique MST', 'negative weights'],
    year: 2023,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 11,
    questionType: 'MSQ',
    difficulty: 'Hard',
    question:
      'Let $G = (V, E)$ be a connected, undirected, weighted graph. Which of the following statements regarding Minimum Spanning Trees (MST) are **always true**?',
    options: [
      { id: 'A', text: 'If all edge weights in $G$ are distinct, then $G$ has a unique MST.' },
      { id: 'B', text: 'Kruskal\'s algorithm finds a valid MST even if some edge weights are negative.' },
      { id: 'C', text: 'The shortest path between any two vertices $u, v \\in V$ is always a subset of every MST.' },
      { id: 'D', text: 'The minimum weight edge crossing any cut $(S, V \\setminus S)$ is always present in every MST.' },
    ],
    correctAnswer: ['A', 'B', 'D'],
    explanation:
      'Let us analyze each statement:\n\n' +
      '• **Statement A (True):** When all edge weights in a connected graph are strictly distinct, the MST is mathematically unique.\n' +
      '• **Statement B (True):** Kruskal\'s and Prim\'s algorithms rely only on relative edge weight comparisons (Cut and Cycle properties) and work correctly with negative weights.\n' +
      '• **Statement C (False):** An MST minimizes the sum of all tree edge weights, not pairwise path lengths (e.g., direct heavy edge of weight 10 vs path with two edges of weight 6, 6).\n' +
      '• **Statement D (True):** By the Cut Property of MSTs, the lightest edge crossing any cut must belong to every MST (assuming distinct weights or at least one MST if ties exist).\n\n' +
      'Correct options are **A, B, and D**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2023,
      paper: 'CS',
      questionNumber: 11,
    },
    reasoningType: ['proof-based', 'conceptual'],
  },

  // --- 12. NAT: DATA STRUCTURES ---
  {
    id: 'gate-cs-ds-nat-012',
    subject: 'Data Structures',
    topic: 'Binary Trees & Tree Properties',
    subtopic: 'Complete Binary Tree Height & Node Depth',
    concepts: ['complete binary tree', 'tree height', 'logarithmic depth', 'node count'],
    year: 2024,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 12,
    questionType: 'NAT',
    difficulty: 'Easy',
    question:
      'A complete binary tree has exactly $1000$ nodes. If the root node is at height (or level) $0$, what is the height of the complete binary tree?\n\n*(Enter integer value)*',
    correctAnswer: 9,
    numericalAnswer: 9,
    numericalTolerance: 0.001,
    explanation:
      'For a complete binary tree with $N$ nodes where the root node is at height $h = 0$:\n\n' +
      '$$\\text{Height } h = \\lfloor \\log_2 N \\rfloor$$\n\n' +
      'Given $N = 1000$:\n' +
      '$$2^9 = 512 \\le 1000 < 1024 = 2^{10}$$\n' +
      '$$h = \\lfloor \\log_2 1000 \\rfloor = \\lfloor 9.9657 \\rfloor = 9$$\n\n' +
      'Therefore, the height of the tree is **9**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2024,
      paper: 'CS',
      questionNumber: 12,
    },
    reasoningType: ['calculation'],
  },

  // --- 13. NAT: COMPUTER ORGANIZATION ---
  {
    id: 'gate-cs-coa-nat-013',
    subject: 'Computer Organization and Architecture',
    topic: 'Instruction Pipelining & Performance',
    subtopic: 'Speedup and Clock Period Analysis',
    concepts: ['pipelining speedup', 'CPI', 'cycle time', 'throughput'],
    year: 2023,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 13,
    questionType: 'NAT',
    difficulty: 'Medium',
    question:
      'Consider a 5-stage instruction pipeline where each stage takes $2\\text{ ns}$ of execution time with negligible buffer delays. An equivalent non-pipelined processor executes each instruction in $10\\text{ ns}$. What is the ideal speedup achieved by the pipelined processor for executing a program with a very large number of independent instructions $N \\to \\infty$?\n\n*(Enter numerical value to 1 decimal place)*',
    correctAnswer: 5.0,
    numericalAnswer: 5.0,
    numericalTolerance: 0.05,
    explanation:
      'The speedup $S$ of a $k$-stage pipeline for $N$ instructions is given by:\n\n' +
      '$$S = \\frac{\\text{Execution Time (Non-Pipelined)}}{\\text{Execution Time (Pipelined)}} = \\frac{N \\cdot t_{\\text{non-pipe}}}{(k + N - 1) \\cdot t_{\\text{cycle}}}$$\n\n' +
      'For a very large number of instructions ($N \\to \\infty$):\n' +
      '$$S_{\\text{ideal}} = \\frac{t_{\\text{non-pipe}}}{t_{\\text{cycle}}} = \\frac{10\\text{ ns}}{2\\text{ ns}} = 5.0$$\n\n' +
      'Therefore, the ideal speedup is **5.0** (or **5**).',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2023,
      paper: 'CS',
      questionNumber: 13,
    },
    reasoningType: ['calculation', 'analytical'],
  },

  // --- 14. NAT: DBMS ---
  {
    id: 'gate-cs-dbms-nat-014',
    subject: 'DBMS',
    topic: 'Indexing & B+ Trees',
    subtopic: 'B+ Tree Node Capacity & Fanout',
    concepts: ['B+ tree', 'block size', 'record pointer', 'search keys', 'tree order', 'fanout'],
    year: 2022,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 14,
    questionType: 'NAT',
    difficulty: 'Hard',
    question:
      'In a $B^+$-tree index on a disk with block size $B = 512\\text{ Bytes}$, an internal (non-leaf) index node stores search keys and child block pointers. Each search key is $K = 10\\text{ Bytes}$ and each block pointer is $P = 6\\text{ Bytes}$. What is the maximum number of search keys that can be accommodated in a single internal node?\n\n*(Enter integer value)*',
    correctAnswer: 31,
    numericalAnswer: 31,
    numericalTolerance: 0.001,
    explanation:
      'In an internal node of order $p$, there are $p$ block pointers and $(p - 1)$ search keys.\n\n' +
      'The space occupied by an internal node must satisfy the block size inequality:\n' +
      '$$p \\cdot P + (p - 1) \\cdot K \\le B$$\n\n' +
      'Substituting the given values ($P = 6\\text{ B}$, $K = 10\\text{ B}$, $B = 512\\text{ B}$):\n' +
      '$$6p + 10(p - 1) \\le 512$$\n' +
      '$$16p - 10 \\le 512$$\n' +
      '$$16p \\le 522$$\n' +
      '$$p \\le \\left\\lfloor \\frac{522}{16} \\right\\rfloor = \\lfloor 32.625 \\rfloor = 32$$\n\n' +
      'The maximum number of keys in the internal node is:\n' +
      '$$\\text{Max Keys} = p - 1 = 32 - 1 = 31$$\n\n' +
      'Therefore, the maximum number of keys is **31**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2022,
      paper: 'CS',
      questionNumber: 14,
    },
    reasoningType: ['calculation', 'analytical'],
  },

  // --- 15. DIGITAL LOGIC (MCQ) ---
  {
    id: 'gate-cs-dl-015',
    subject: 'Digital Logic',
    topic: 'Boolean Algebra & Minimization',
    subtopic: 'Karnaugh Maps & Prime Implicants',
    concepts: ['K-map minimization', 'prime implicants', 'essential prime implicants', 'Boolean algebra'],
    year: 2023,
    exam: 'GATE CS',
    paper: 'CS',
    questionNumber: 15,
    questionType: 'MCQ',
    difficulty: 'Medium',
    question:
      'For a 4-variable Boolean function $F(A, B, C, D) = \\sum m(0, 2, 5, 7, 8, 10, 13, 15)$, how many **essential prime implicants** does $F$ have?',
    options: [
      { id: 'A', text: '0' },
      { id: 'B', text: '2' },
      { id: 'C', text: '4' },
      { id: 'D', text: '8' },
    ],
    correctAnswer: 'B',
    explanation:
      'Let us group the minterms on a 4-variable K-Map:\n\n' +
      '1. Group 1 (Corners: $m_0, m_2, m_8, m_{10}$): Represents $B\'D\'$.\n' +
      '2. Group 2 (Center column: $m_5, m_7, m_{13}, m_{15}$): Represents $BD$.\n\n' +
      'Every minterm is covered by these two disjoint 4-cell groupings:\n' +
      '• $m_0$ is uniquely covered by $B\'D\' \\implies B\'D\'$ is an Essential Prime Implicant.\n' +
      '• $m_5$ is uniquely covered by $BD \\implies BD$ is an Essential Prime Implicant.\n\n' +
      'The minimal SOP form is $F = B\'D\' + BD$, with exactly **2 essential prime implicants**.',
    source: {
      type: 'MANUAL',
      exam: 'GATE CS',
      year: 2023,
      paper: 'CS',
      questionNumber: 15,
    },
    reasoningType: ['analytical', 'calculation'],
  },
];
