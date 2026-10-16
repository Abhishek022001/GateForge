# GATEForge Technical Interview Guide & Q&A

This document contains deep architectural, technical, and trade-off answers to questions an interviewer might ask about GATEForge.

---

### Q1: Why use prompt orchestration and multi-stage verification instead of fine-tuning an open-source model?
**Answer:**
1. **Target Distribution & Grounding:** Fine-tuning an LLM on exam questions often results in catastrophic forgetting or "style overfitting" without guaranteeing factual/mathematical correctness. GATE questions require rigorous mathematical proofs, multi-step code-tracing, and precise numerical ranges.
2. **Deterministic Verification:** A fine-tuned model is still a single probabilistic token generator. In high-stakes exam prep, hallucinations (e.g. wrong answers, flawed explanations) destroy user trust. Decoupling generation from an *independent semantic verifier* and a *deterministic schema validator* provides verifiable correctness bounds that fine-tuning alone cannot offer.
3. **Agility and Low Maintenance:** When syllabus boundaries or exam formats change (e.g. introducing new question types like MSQ), prompt templates, context retrieval scoring, and validation rules can be updated instantly without multi-thousand-dollar GPU training cycles.

---

### Q2: How do you guarantee zero client-side answer leakage?
**Answer:**
1. **Server-Side Ephemeral Session Management:** When a practice session is generated, the questions are stored in a secure server-side session registry (`practiceSession.service.ts`).
2. **Sanitized Projections:** The HTTP API sends only the sanitized question model to the client (`id`, `question`, `options`, `subject`, `topic`, `difficulty`, `questionType`). The `correctAnswer`, `numericalAnswer`, `numericalTolerance`, and `explanation` are stripped before serialization.
3. **Session Locking:** When the student submits answers via `POST /api/ai/practice/session/:id/submit`, the server evaluates the responses against its held copy, marks the session as `locked: true`, and returns the evaluated scorecard and explanations. Any subsequent submit attempts on that session ID are rejected with HTTP 409 `SESSION_ALREADY_SUBMITTED`.

---

### Q3: How does the similarity safeguard work, and why not use vector embeddings?
**Answer:**
1. **Algorithmic Transparency:** Vector embeddings are continuous representations that often suffer from false positives on technical math questions that share similar semantic topics (e.g. two completely different graph theory questions might have high cosine similarity in embedding space).
2. **Multi-Factor Deterministic Metrics:** We compute a composite similarity score using:
   - **Jaccard Token Similarity** on normalized, stop-word-filtered token sets with LaTeX variable abstraction.
   - **Cosine Similarity** on bag-of-words term-frequency vectors.
   - **Levenshtein Distance** on canonicalized problem strings to catch exact copies or trivial variable/number renamings.
3. **Performance & Overhead:** For comparing a candidate against a retrieved context set of 3–5 reference PYQs, token and vector math executes in < 5ms without requiring external vector database infrastructure, network round-trips, or embedding API costs.

---

### Q4: How do you manage LLM rate limits and non-determinism during multi-question generation?
**Answer:**
1. **Bounded Concurrency Worker Pool:** For a 3- or 5-question practice session, we do not launch all requests simultaneously. Instead, we use an in-memory worker queue with bounded concurrency (`maxConcurrent = 2`) and inter-request pacing (100ms) to respect provider rate limits.
2. **Controlled Automatic Regeneration:** If a generated question fails structural schema validation, semantic verification, or similarity checks, the pipeline feeds the failure reason back into the generator and retries up to `MAX_GENERATION_ATTEMPTS = 3`.
3. **Graceful Fallback:** If retries are exhausted or the AI provider experiences outages, the system does not crash or leave the user in limbo; it returns a clean, typed error response (`GENERATION_ATTEMPTS_EXHAUSTED` or `AI_SERVICE_UNAVAILABLE`) allowing the client UI to render a retry action.

---

### Q5: Why separate General Aptitude (GA) from the core Computer Science corpus?
**Answer:**
- GATE CS papers allocate 15 marks to General Aptitude (verbal and basic quantitative ability) and 85 marks to technical Computer Science (Discrete Mathematics, Data Structures, Algorithms, OS, DBMS, Computer Networks, Theory of Computation, Compiler Design, COA, Digital Logic).
- Mixing General Aptitude questions into the retrieval context for a technical query (e.g. *Operating Systems Memory Management*) introduces noise and degrades the pedagogical relevance of the retrieved patterns. Technical and aptitude questions have fundamentally distinct cognitive skill patterns and reasoning archetypes.

---

### Q6: What security safeguards are implemented across the API?
**Answer:**
1. **Bounded Request Payloads:** Both `Content-Length` headers and streaming request bodies are strictly bounded to `2 MB` (`MAX_BODY_SIZE_BYTES`). Excessively large payloads are terminated immediately with HTTP 413 `PAYLOAD_TOO_LARGE`.
2. **Sliding-Window Rate Limiting:** All AI generation endpoints are protected by an in-memory sliding window rate limiter (20 requests per minute per IP), returning HTTP 429 `RATE_LIMIT_EXCEEDED` with `Retry-After: 60`.
3. **Environment & Credential Isolation:** The `GEMINI_API_KEY` is strictly confined to backend server memory. All `.env` files are gitignored, and zero secrets are bundled into client-side Vite builds.
4. **Input Sanitization & Injection Prevention:** User requests are constrained to enumerated technical GATE subjects and difficulty parameters; arbitrary raw prompt injection strings are disallowed at the controller boundary.
