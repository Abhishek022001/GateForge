import { IQuestion } from '../../../types/question.types.js';

export interface IAIAnalysisPromptPayload {
  question: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  questionType: string;
  options?: Array<{ id: string; text: string }>;
  correctAnswer: string | string[] | number | null;
  explanation?: string;
  section?: string;
}

export function buildQuestionAnalysisPrompt(q: IQuestion | IAIAnalysisPromptPayload): string {
  const optionsText = q.options && q.options.length > 0
    ? q.options.map((opt) => `  (${opt.id}) ${opt.text}`).join('\n')
    : '(None - NAT/Numerical question)';

  const answerText = Array.isArray(q.correctAnswer)
    ? q.correctAnswer.join(', ')
    : String(q.correctAnswer ?? 'N/A');

  const qNum = (q as any).questionNumber || (q as any).source?.questionNumber;
  const isGA =
    (q as any).section === 'GA' ||
    (q as any).source?.section === 'GA' ||
    q.subject === 'General Aptitude' ||
    (typeof qNum === 'number' && qNum >= 1 && qNum <= 10);

  return `You are an expert GATE (Graduate Aptitude Test in Engineering) examiner and curriculum analyst.

Analyze the following official GATE question to extract structural, pedagogical, and cognitive reasoning patterns.

==================================================
QUESTION DATA:
${q.subject ? `Subject: ${q.subject}` : 'Subject: To be determined by analysis'}
${q.topic ? `Topic: ${q.topic}` : 'Topic: To be determined by analysis'}
Section: ${isGA ? 'General Aptitude (GA)' : 'Computer Science (CS)'}
Type: ${q.questionType}
Question Text:
${q.question}

Options:
${optionsText}

Correct Answer: ${answerText}
${q.explanation && q.explanation !== 'Explanation not available yet.' ? `Explanation:\n${q.explanation}` : ''}
==================================================

ANALYSIS RULES:
1. SUBJECT, TOPIC, and SUBTOPIC CLASSIFICATION:
${isGA
  ? `   - This question is from General Aptitude (GA). Set "subject": "General Aptitude".
   - Set "topic" to the specific aptitude area (e.g. "Verbal Ability", "Quantitative Aptitude", "Analytical Reasoning", "Spatial Aptitude").
   - Set "subtopic" to the specific aptitude skill (e.g. "Vocabulary Analogy", "Combinatorics", "Geometry and Symmetry", "Deductive Logic").`
  : `   - Classify "subject" into exactly one official GATE CS subject:
     ["Engineering Mathematics", "Discrete Mathematics", "Data Structures", "Algorithms", "Programming", "Digital Logic", "Computer Organization and Architecture", "Operating Systems", "DBMS", "Computer Networks", "Theory of Computation", "Compiler Design"].
   - Classify "topic" into the specific curriculum area (e.g. "Relational Model and Normalization", "Process Synchronization", "Binary Search Trees", "Cache Memory Hierarchy", "Regular Expressions and Finite Automata", "Eigenvalues and Linear Algebra").
   - Classify "subtopic" into the precise mechanism or sub-area (e.g. "First Normal Form", "Semaphores and Mutex", "AVL Tree Rotations", "Set-Associative Mapping", "Trace of Matrix").`
}
   - NEVER use generic topics like "CS" or "Computer Science".
2. CONCEPTS and SUB-CONCEPTS:
   - CONCEPTS: 2-5 specific theoretical constructs required to solve (e.g. ["first normal form", "candidate key", "multi-attribute key"]). NEVER output generic values like ["Computer Science"] or ["CS"]!
   - SUB-CONCEPTS: 2-4 granular mechanisms or properties.
3. QUESTION PATTERN:
   - Abstract structural reasoning archetype describing the logic task (e.g. "Given a relational schema with functional dependencies, identify all candidate keys and verify normal form violations.").
   - Must be at least 15 characters long. NEVER write generic text like "Answer the question" or "Solve the problem"!
4. SOLUTION APPROACH: Provide an abstract, step-by-step mathematical/logical strategy (not just the answer).
5. REASONING TYPE: Multi-select array from: ["conceptual", "numerical", "logical", "analytical", "code-tracing", "calculation", "proof-based", "interpretation", "comparison"].
6. COGNITIVE SKILL: Exactly one of: "recall" | "understand" | "apply" | "analyze" | "evaluate".
7. DIFFICULTY ASSESSMENT: Assess as "Easy" | "Medium" | "Hard" based on multi-step reasoning depth and conceptual subtleties.
8. DISTRACTOR PATTERNS: For MCQ/MSQ, explain what student misconceptions or calculation slips the incorrect options target. For NAT, provide an empty array [].
9. COMMON TRAPS: 2-4 specific mistakes a student is likely to make on this exact problem archetype.
10. REQUIRED KNOWLEDGE: 2-4 prerequisite topics or mathematical tools needed to solve this question.
11. GATE CHARACTERISTICS: 2-4 specific traits that make this a hallmark GATE question.

OUTPUT FORMAT:
Return ONLY a valid JSON object with the following exact keys and structure:
{
  "subject": "string",
  "topic": "string",
  "subtopic": "string",
  "concepts": ["string"],
  "subConcepts": ["string"],
  "reasoningType": ["string"],
  "cognitiveSkill": "recall" | "understand" | "apply" | "analyze" | "evaluate",
  "questionPattern": "string",
  "solutionApproach": "string",
  "difficultyAssessment": "Easy" | "Medium" | "Hard",
  "distractorPatterns": ["string"],
  "commonTraps": ["string"],
  "requiredKnowledge": ["string"],
  "gateCharacteristics": ["string"]
}`;
}
