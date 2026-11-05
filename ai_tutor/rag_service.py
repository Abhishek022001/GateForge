import logging
import re
import time
from typing import List, Optional, Tuple, Any, Dict
import httpx
import chromadb
from sentence_transformers import SentenceTransformer

from ai_tutor.config import config
from ai_tutor.models import RetrievedQuestionRef, AskRequest, AskResponse
from ai_tutor.ingest import get_embedding_model

logger = logging.getLogger("ai_tutor.rag_service")

def normalize_latex_delimiters(text: str) -> str:
    r"""Normalizes all LaTeX math delimiters (\[ \] to $$ $$, and \( \) to $ $)."""
    if not text:
        return ""
    # Convert \[ ... \] to $$ ... $$
    text = re.sub(r'\\\[([\s\S]*?)\\\]', r'$$\n\1\n$$', text)
    # Convert \( ... \) to $ ... $
    text = re.sub(r'\\\(([\s\S]*?)\\\)', r'$\1$', text)
    # Clean up any trailing unclosed \[ or \( if generation was truncated at boundary
    text = re.sub(r'\\\[[^\]]*$', '', text)
    text = re.sub(r'\\\([^\)]*$', '', text)
    return text.strip()

FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
]

class RAGService:
    def __init__(self):
        self.chroma_client = chromadb.PersistentClient(path=config.chroma_persist_dir)
        self.collection = self.chroma_client.get_or_create_collection(
            name=config.chroma_collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        self._model: Optional[SentenceTransformer] = None

    @property
    def embedding_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = get_embedding_model()
        return self._model

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        subject: Optional[str] = None
    ) -> List[RetrievedQuestionRef]:
        """
        Retrieves top_k most relevant GATE questions from ChromaDB.
        Applies similarity threshold and optional subject filter.
        """
        count = self.collection.count()
        if count == 0:
            logger.warning("ChromaDB collection is empty. Ingest questions first.")
            return []

        # Generate query embedding with inference_mode for low RAM and high speed
        try:
            import torch
            with torch.inference_mode():
                query_emb = self.embedding_model.encode([query], show_progress_bar=False)[0].tolist()
        except Exception:
            query_emb = self.embedding_model.encode([query], show_progress_bar=False)[0].tolist()

        # Build filter if subject is provided
        where_filter = None
        if subject and subject.strip() and subject.lower() != "all":
            where_filter = {"subject": {"$eq": subject.strip()}}

        k = min(top_k, count)
        try:
            results = self.collection.query(
                query_embeddings=[query_emb],
                n_results=k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            logger.warning(f"Query with where_filter '{where_filter}' failed ({e}). Retrying without filter.")
            results = self.collection.query(
                query_embeddings=[query_emb],
                n_results=k,
                include=["documents", "metadatas", "distances"]
            )

        refs: List[RetrievedQuestionRef] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return refs

        ids = results["ids"][0]
        distances = results.get("distances", [[]])[0] if results.get("distances") else [0.5] * len(ids)
        metas = results.get("metadatas", [[]])[0] if results.get("metadatas") else [{}] * len(ids)

        for i, q_id in enumerate(ids):
            dist = distances[i] if i < len(distances) else 0.5
            # Cosine similarity in cosine distance space (where dist = 1 - cos_sim)
            similarity = max(0.0, min(1.0, 1.0 - dist))

            # Grounding filter: reject irrelevant questions below threshold
            if similarity < config.min_similarity_threshold:
                logger.info(f"Skipping {q_id} with similarity {similarity:.3f} below threshold {config.min_similarity_threshold}")
                continue

            meta = metas[i] if i < len(metas) else {}
            ref = RetrievedQuestionRef(
                id=str(meta.get("id") or q_id),
                question=str(meta.get("question") or ""),
                subject=meta.get("subject"),
                topic=meta.get("topic"),
                year=meta.get("year"),
                question_type=meta.get("question_type"),
                similarity_score=round(float(similarity), 4),
                correct_answer=meta.get("correct_answer"),
                explanation=meta.get("explanation"),
            )
            refs.append(ref)

        return refs

    async def generate_explanation(
        self,
        query: str,
        refs: List[RetrievedQuestionRef]
    ) -> Tuple[str, bool, str]:
        """
        Calls the Grok/Groq LLM with grounded retrieved question context.
        Returns: (answer_text, is_grounded, model_used)
        """
        is_grounded = len(refs) > 0

        if not config.is_llm_configured:
            # Fallback when LLM API key is not configured
            if is_grounded:
                summary_lines = [
                    "### GateForge Grounded Concept Overview (Offline AI Mode)",
                    "The AI LLM API key is not configured. However, our semantic retrieval engine successfully identified the following authentic GATE questions from the verified corpus:",
                    ""
                ]
                for r in refs:
                    summary_lines.append(f"**Question ID:** `{r.id}` ({r.subject} - {r.topic}, GATE {r.year})")
                    summary_lines.append(f"> {r.question}")
                    if r.correct_answer:
                        summary_lines.append(f"- **Official Answer Key:** {r.correct_answer}")
                    if r.explanation:
                        summary_lines.append(f"- **Explanation:** {r.explanation}")
                    summary_lines.append("")
                return "\n".join(summary_lines), True, "retrieval-offline"
            else:
                return (
                    "### AI Service Unavailable\n"
                    "Neither a valid GROQ_API_KEY nor GROK_API_KEY is configured in the environment, "
                    "and no matching GATE PYQ questions were found in the database for your query. "
                    "Please configure GROQ_API_KEY in backend/.env to enable generative tutoring.",
                    False,
                    "none"
                )

        # Build Context & Prompt
        if is_grounded:
            context_blocks = []
            for idx, r in enumerate(refs, 1):
                block = [
                    f"--- RETRIEVED GATE QUESTION #{idx} ---",
                    f"Question ID: {r.id}",
                    f"Subject: {r.subject or 'Computer Science'}",
                    f"Topic: {r.topic or 'General'}",
                    f"Exam: GATE {r.year or ''} ({r.question_type or 'Standard'})",
                    f"Relevance Similarity: {r.similarity_score:.2f}",
                    f"Question Text: {r.question}",
                ]
                if r.correct_answer:
                    block.append(f"Official Answer Key: {r.correct_answer}")
                if r.explanation:
                    block.append(f"Verified Reference Explanation: {r.explanation}")
                context_blocks.append("\n".join(block))

            retrieved_context_str = "\n\n".join(context_blocks)

            system_prompt = (
                "You are GateForge AI Tutor, an authoritative, master-level computer science educator "
                "for the GATE (Graduate Aptitude Test in Engineering) CS & IT examination.\n\n"
                "CRITICAL DIRECTIVES:\n"
                f"1. DIRECT INTENT FIDELITY: You MUST directly, accurately, and comprehensively answer the student's actual question: '{query}'. "
                "NEVER hijack, deflect, or warp the topic to match unrelated concepts or loosely related retrieved questions. "
                "For example, if the student asks to learn 'recursion', teach computer science recursion (what recursion is, how a function calls itself, "
                "base condition to stop infinite calls, recursive step, call stack & activation records, concrete C/pseudocode code example, "
                "time and space complexity, recursion tree method, and stack overflow pitfalls) — do NOT redefine it as sequence recurrence relations.\n"
                "2. GROUNDED CONTEXT INTEGRATION: Below are verified official GATE CS questions retrieved from our archive. "
                "Carefully evaluate if each question genuinely relates to what the student asked. "
                "If a retrieved question is genuinely relevant, cite it by its ID (e.g. `[gate-cs-...]`) and demonstrate how it applies the theory. "
                "If a retrieved question is only tangentially related or from a different subtopic, DO NOT force your explanation to revolve around it; "
                "focus 100% on answering the student's inquiry accurately, and mention the question only as an auxiliary application if appropriate.\n"
                "3. MATHEMATICAL & CODE NOTATION: Use clean standard LaTeX ($...$ for inline math and $$...$$ on separate lines for display math). "
                "Do NOT use raw backslash brackets like \\( or \\[. Use formatted code blocks (```c or ```python) for code.\n"
                "4. PEDAGOGICAL STRUCTURE:\n"
                "   - **Core Concept & Theoretical Foundation**: Clear intuition, formal definition, and mechanics.\n"
                "   - **Step-by-Step Problem Solving & Concrete Example**: Walk through a practical example or code trace.\n"
                "   - **GATE Problem-Solving Insights & Common Traps**: Edge cases, time/space trade-offs, and exam pitfalls.\n"
                "5. Never fabricate questions, answers, or data not supported by the context.\n\n"
                f"### RETRIEVED OFFICIAL GATE CONTEXT:\n{retrieved_context_str}"
            )
        else:
            system_prompt = (
                "You are GateForge AI Tutor, an authoritative, master-level computer science educator "
                "for the GATE (Graduate Aptitude Test in Engineering) CS & IT examination.\n\n"
                "GROUNDING NOTICE:\n"
                "No official GATE questions in the indexed archive met the high-confidence semantic similarity threshold for this specific query. "
                "Your role is to provide a master-class, comprehensive conceptual tutorial on the exact topic requested.\n\n"
                "CRITICAL DIRECTIVES:\n"
                "1. Begin your response with:\n"
                "   > **Corpus Notice:** No direct official GATE PYQ matches were found in our verified database for this inquiry. Below is a comprehensive conceptual explanation based on core GATE CS & IT curriculum principles.\n\n"
                f"2. DIRECT INTENT FIDELITY: Directly, thoroughly, and comprehensively teach the exact concept requested by the student ('{query}'). "
                "If the student asks to learn 'recursion', teach computer science recursion from first principles: "
                "definition, base case & recursive step, call stack execution & activation records, concrete code example (e.g. factorial, Fibonacci, or tree traversal) with stack trace, time/space complexity analysis (recurrence trees), and pitfalls like stack overflow.\n"
                "3. Use standard LaTeX ($...$ inline, $$...$$ display) for all math and formulas. Use formatted code blocks for code.\n"
                "4. Structure cleanly with headings, bullet points, and clear code/trace blocks.\n"
                "5. Never fabricate non-existent question IDs or claim questions exist in the archive."
            )

        user_content = f"Student Question: {query}"

        # Attempt LLM calls with fallback model chain
        last_error = None
        used_model = config.ai_model

        # Build unique candidate models list
        candidate_models = []
        for m in [config.ai_model] + FALLBACK_MODELS:
            if m and m not in candidate_models:
                candidate_models.append(m)

        async with httpx.AsyncClient(timeout=config.ai_timeout_seconds) as client:
            for model_name in candidate_models:
                try:
                    payload = {
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 2500,
                    }
                    headers = {
                        "Authorization": f"Bearer {config.active_api_key}",
                        "Content-Type": "application/json",
                    }
                    response = await client.post(
                        config.ai_endpoint,
                        headers=headers,
                        json=payload
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        choices = data.get("choices", [])
                        if choices:
                            msg = choices[0].get("message", {})
                            content = msg.get("content") or ""
                            # If content is empty (e.g. reasoning model allocated all tokens to reasoning), check reasoning
                            if not content.strip() and msg.get("reasoning"):
                                content = msg.get("reasoning")
                            if content.strip():
                                clean_text = normalize_latex_delimiters(content)
                                return clean_text, is_grounded, model_name
                    elif response.status_code == 429:
                        logger.warning(f"Rate limited on model '{model_name}'. Trying fallback...")
                        last_error = f"Rate limited on {model_name} (HTTP 429)"
                        continue
                    else:
                        logger.warning(f"LLM API returned {response.status_code} for '{model_name}': {response.text[:200]}")
                        last_error = f"HTTP {response.status_code}: {response.text[:150]}"
                except httpx.TimeoutException:
                    logger.warning(f"Timeout calling LLM model '{model_name}'. Trying fallback...")
                    last_error = f"Timeout calling {model_name}"
                except Exception as ex:
                    logger.warning(f"Error calling LLM model '{model_name}': {ex}")
                    last_error = str(ex)

        # Fallback if all API attempts failed
        fallback_msg = (
            f"### AI Tutor Generation Warning\n"
            f"The AI generation service encountered a temporary error ({last_error}).\n\n"
        )
        if is_grounded:
            fallback_msg += (
                "However, the following authentic GATE questions were successfully retrieved for your query:\n\n"
            )
            for r in refs:
                fallback_msg += f"- **[{r.id}]** ({r.subject} - {r.topic}, GATE {r.year}):\n"
                fallback_msg += f"  > {r.question}\n"
                if r.explanation:
                    fallback_msg += f"  *Explanation:* {r.explanation}\n\n"
        else:
            fallback_msg += "Please verify your network connection and API key quotas, then try again."

        return fallback_msg, is_grounded, f"error-fallback ({last_error})"

    async def ask(self, request: AskRequest) -> AskResponse:
        """
        Executes the full RAG pipeline:
        1. Retrieval from ChromaDB
        2. Grounding verification
        3. LLM generation with retrieved context
        4. Structured AskResponse return
        """
        start_time = time.perf_counter()
        
        # 1. Retrieve top relevant GATE questions
        refs = self.retrieve(
            query=request.query,
            top_k=request.top_k,
            subject=request.subject
        )

        # 2. Generate grounded explanation
        answer, is_grounded, model_used = await self.generate_explanation(
            query=request.query,
            refs=refs
        )

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return AskResponse(
            query=request.query,
            answer=answer,
            is_grounded=is_grounded,
            retrieved_references=refs,
            latency_ms=latency_ms,
            model_used=model_used
        )

# Global singleton
rag_service = RAGService()
