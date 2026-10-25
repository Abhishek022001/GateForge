export interface IClassifiedResult {
  subject: string;
  topic: string;
  concepts: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface ISubjectRule {
  subject: string;
  defaultTopic: string;
  concepts: string[];
  matcher: (text: string, q: any) => boolean;
}

const SUBJECT_RULES: ISubjectRule[] = [
  {
    subject: 'General Aptitude',
    defaultTopic: 'Verbal & Numerical Ability',
    concepts: ['numerical computation', 'logical reasoning', 'verbal comprehension'],
    matcher: (text, q) =>
      q.section === 'GA' ||
      /grammar|passage|sentence|vocabulary|synonym|antonym|proportion|percentage|train|speed|ratio/.test(text),
  },
  {
    subject: 'Databases',
    defaultTopic: 'Relational Model & Queries',
    concepts: ['sql', 'relational algebra', 'normalization', 'concurrency control', 'indexing'],
    matcher: (text) =>
      /sql|relation|relational|transaction|serializab|schedule|b\+\s*tree|b-tree|functional dependenc|lossless|foreign key|primary key|candidate key|super key|normaliz|normal form|2nf|3nf|bcnf|acid|concurrency control|lock|timestamp ordering|relational algebra|schema|relation schema|tuple/.test(
        text
      ),
  },
  {
    subject: 'Computer Networks',
    defaultTopic: 'Network Layer & Protocols',
    concepts: ['ip addressing', 'subnetting', 'routing protocols', 'tcp/udp', 'flow control'],
    matcher: (text) =>
      /tcp|udp|ip address|subnet|cidr|router|routing|packet|ethernet|sliding window|go-back-n|selective repeat|congestion control|flow control|dns|http|socket|osi|bandwidth-delay|propagation delay|transmission delay|crc|checksum|ipv4|ipv6|arp|mac address|stop-and-wait|datagram|frame|port number/.test(
        text
      ),
  },
  {
    subject: 'Operating Systems',
    defaultTopic: 'Process Management & Synchronization',
    concepts: ['cpu scheduling', 'process synchronization', 'deadlock', 'virtual memory', 'paging'],
    matcher: (text) =>
      /process|thread|cpu scheduling|deadlock|semaphore|mutex|paging|page table|virtual memory|page replacement|lru|fifo|tlb|fork\(\)|round robin|banker|critical section|turnaround time|waiting time|disk scheduling|fcfs|sstf|scan|c-scan|demand paging|page fault|fragmentation|inode|seek time|rotational latency|hard disk|sectors per track/.test(
        text
      ),
  },
  {
    subject: 'Theory of Computation',
    defaultTopic: 'Automata & Formal Languages',
    concepts: ['finite automata', 'regular expressions', 'context-free grammar', 'pushdown automata', 'turing machines'],
    matcher: (text) =>
      /regular expression|dfa|nfa|finite automat|context free|cfg|pda|pushdown|turing machine|decidab|undecidab|halting problem|pumping lemma|chomsky|regular language|cfl|automata|automaton|recursively enumerable|grammar|languages|language|transition/.test(
        text
      ),
  },
  {
    subject: 'Compiler Design',
    defaultTopic: 'Syntax Analysis & Parsing',
    concepts: ['lexical analysis', 'll/lr parsing', 'syntax directed translation', 'intermediate code generation'],
    matcher: (text) =>
      /parser|parsing|ll\(1\)|lr\(0\)|slr\(1\)|clr\(1\)|lalr\(1\)|first and follow|intermediate code|three address code|basic block|control flow graph|dead code|l-attributed|s-attributed|syntax directed|lexical analyzer|lexer|parse tree|shift-reduce|handle pruning|symbol table|live range/.test(
        text
      ),
  },
  {
    subject: 'Computer Organization and Architecture',
    defaultTopic: 'Processor & Memory Organization',
    concepts: ['instruction pipelining', 'cache memory', 'addressing modes', 'ieee-754', 'microarchitecture'],
    matcher: (text) =>
      /cache|pipelining|pipeline|instruction|hazard|branch prediction|direct mapped|set associative|clock cycle|cpi|mips|addressing mode|dma|interrupt|alu|microprogram|register|memory hierarchy|hit ratio|miss penalty|little endian|big endian|ieee[ -]754|floating point|execution time.*machine|storage surface/.test(
        text
      ),
  },
  {
    subject: 'Digital Logic',
    defaultTopic: 'Combinational & Sequential Circuits',
    concepts: ['boolean algebra', 'k-maps', 'multiplexers', 'flip-flops', 'counters'],
    matcher: (text) =>
      /k-map|karnaugh|boolean function|multiplexer|mux|demux|decoder|encoder|flip-flop|flip flop|counter|synchronous counter|ripple carry|adder|half adder|full adder|combinational circuit|sequential circuit|logic gate|nand|nor|xor|2’s complement|2's complement|two's complement|radix|minterm|maxterm|logic circuit diagram|boolean expression|boolean variable/.test(
        text
      ),
  },
  {
    subject: 'Algorithms',
    defaultTopic: 'Design & Analysis of Algorithms',
    concepts: ['asymptotic analysis', 'dynamic programming', 'greedy algorithms', 'graph algorithms', 'divide and conquer'],
    matcher: (text) =>
      /recurrence|master theorem|time complexity|space complexity|asymptotic|divide and conquer|greedy|dynamic programming|dijkstra|bellman-ford|floyd-warshall|kruskal|prim|binary search|merge sort|quick sort|heap sort|topological sort|dfs|bfs|graph traversal|minimum spanning tree|shortest path|np-complete|vertex cover|mst|spanning tree|worst-case|best-case|pseudocode/.test(
        text
      ),
  },
  {
    subject: 'Data Structures',
    defaultTopic: 'Trees & Abstract Data Types',
    concepts: ['binary search trees', 'heaps', 'stacks and queues', 'linked lists', 'hash tables'],
    matcher: (text) =>
      /binary search tree|bst|avl tree|binary tree|inorder|preorder|postorder|stack|queue|priority queue|heap|min heap|max heap|linked list|doubly linked list|tree|root node|leaf node|height of tree|traversal/.test(
        text
      ),
  },
  {
    subject: 'Programming',
    defaultTopic: 'Programming in C',
    concepts: ['pointers', 'functions and recursion', 'arrays and structures', 'memory management'],
    matcher: (text) =>
      /c program|pointer|recursion|recursive function|printf|scanf|struct|typedef|array of pointers|call by value|call by reference|macro|sizeof|loop invariant|while loop|for loop|void main|int main|char \*|int \*/.test(
        text
      ),
  },
  {
    subject: 'Discrete Mathematics',
    defaultTopic: 'Mathematical Logic & Combinatorics',
    concepts: ['predicate logic', 'relations and functions', 'graph theory', 'combinatorics', 'group theory'],
    matcher: (text) =>
      /propositional|predicate|tautology|equivalence|truth table|set theory|relation|reflexive|symmetric|transitive|partial order|poset|lattice|boolean algebra|graph theory|undirected graph|directed graph|eulerian|hamiltonian|chromatic number|planar graph|isomorphism|group theory|group of integers|subgroup|combinatorics|permutation|combination|generating function|pigeonhole|vertices|edges|connected components|clique|subgraph|arrangements|identical balls|conjecture about integers|quantifier/.test(
        text
      ),
  },
  {
    subject: 'Engineering Mathematics',
    defaultTopic: 'Linear Algebra & Probability',
    concepts: ['matrices and determinants', 'eigenvalues', 'calculus', 'probability distributions', 'random variables'],
    matcher: (text) =>
      /eigenvalue|eigenvector|matrix|matrices|determinant|rank of matrix|system of linear equations|calculus|definite integral|maxima|minima|limit|derivative|partial derivative|vector calculus|gradient|divergence|curl|taylor series|probability|conditional probability|bayes|random variable|mean|variance|normal distribution|poisson distribution|binomial distribution|expectation|coins are tossed|uniformly distributed|real numbers|interval/.test(
        text
      ),
  },
];

export function classifyGateQuestion(q: any): IClassifiedResult {
  const difficulty: 'Easy' | 'Medium' | 'Hard' =
    q?.marks === 2 ? 'Hard' : q?.marks === 1 ? 'Medium' : 'Medium';

  if (!q) {
    return {
      subject: 'Algorithms',
      topic: 'General Algorithms',
      concepts: ['algorithms'],
      difficulty,
    };
  }

  if (q.section === 'GA') {
    return {
      subject: 'General Aptitude',
      topic: 'General Aptitude',
      concepts: ['verbal ability', 'numerical ability'],
      difficulty,
    };
  }

  const text = (
    (q.question || '') +
    ' ' +
    (Array.isArray(q.options) ? q.options.map((o: any) => o?.text || '').join(' ') : '') +
    ' ' +
    (q.explanation || '')
  ).toLowerCase();

  for (const rule of SUBJECT_RULES) {
    if (rule.subject === 'General Aptitude') continue;
    if (rule.matcher(text, q)) {
      return {
        subject: rule.subject,
        topic: rule.defaultTopic,
        concepts: rule.concepts,
        difficulty,
      };
    }
  }

  return {
    subject: 'Algorithms',
    topic: 'Design & Analysis of Algorithms',
    concepts: ['algorithms', 'problem solving'],
    difficulty,
  };
}
