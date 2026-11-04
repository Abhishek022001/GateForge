import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from pymongo import MongoClient
import chromadb
from sentence_transformers import SentenceTransformer

from ai_tutor.config import config
from ai_tutor.models import IngestResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai_tutor.ingest")

_embedding_model: Optional[SentenceTransformer] = None

def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"Loading SentenceTransformer model '{config.embedding_model_name}'...")
        _embedding_model = SentenceTransformer(config.embedding_model_name)
    return _embedding_model

def get_mongo_questions() -> List[Dict[str, Any]]:
    """
    Fetches questions from MongoDB. Checks config database ('test' or 'gateforge').
    Gracefully falls back to local JSON datasets if MongoDB is unreachable or empty.
    """
    questions: List[Dict[str, Any]] = []
    
    # 1. Attempt MongoDB connection
    try:
        logger.info(f"Connecting to MongoDB at {config.mongodb_uri[:25]}...")
        with MongoClient(config.mongodb_uri, serverSelectionTimeoutMS=4000) as client:
            # Test candidate databases
            db_candidates = [config.mongodb_db_name, "test", "gateforge"]
            for db_name in db_candidates:
                col = client[db_name][config.mongodb_collection]
                count = col.count_documents({})
                if count > 0:
                    logger.info(f"Found {count} questions in MongoDB database '{db_name}'.'{config.mongodb_collection}'")
                    cursor = col.find({})
                    for doc in cursor:
                        doc["_id"] = str(doc["_id"])
                        questions.append(doc)
                    break
    except Exception as e:
        logger.warning(f"Could not load questions from MongoDB: {e}")

    # 2. Fallback to local files if MongoDB yielded 0 questions
    if not questions:
        logger.info("Attempting local JSON fallback for questions...")
        root_dir = Path(__file__).resolve().parent.parent
        candidate_paths = [
            root_dir / "backend" / "src" / "data" / "officialImportedPyqs.json",
            root_dir / "src" / "data" / "officialImportedPyqs.json"
        ]
        for p in candidate_paths:
            if p.exists():
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list) and len(data) > 0:
                            logger.info(f"Loaded {len(data)} questions from local fallback file: {p.name}")
                            questions = data
                            break
                except Exception as ex:
                    logger.warn(f"Failed to read local fallback {p}: {ex}")

    logger.info(f"Total candidate questions extracted for ingestion: {len(questions)}")
    return questions

def format_question_for_embedding(q: Dict[str, Any]) -> str:
    """Creates a high-signal, rich text representation for semantic embedding."""
    subject = q.get("subject", "General Computer Science") or "General Computer Science"
    topic = q.get("topic", "") or ""
    subtopic = q.get("subtopic", "") or ""
    year = q.get("year", "") or ""
    paper = q.get("paper", "") or ""
    q_type = q.get("questionType", "") or ""
    question_text = q.get("question", "") or ""
    explanation = q.get("explanation", "") or ""
    
    concepts = q.get("concepts", [])
    if isinstance(concepts, list):
        concepts_str = ", ".join(str(c) for c in concepts if c)
    else:
        concepts_str = str(concepts) if concepts else ""

    parts = [
        f"Subject: {subject}",
        f"Topic: {topic}",
    ]
    if subtopic:
        parts.append(f"Subtopic: {subtopic}")
    if year:
        parts.append(f"Exam: GATE CS {year} {paper}".strip())
    if q_type:
        parts.append(f"Type: {q_type}")
    if concepts_str:
        parts.append(f"Key Concepts: {concepts_str}")
        
    parts.append(f"Question: {question_text}")
    
    if explanation:
        parts.append(f"Explanation: {explanation}")
        
    return "\n".join(parts)

def clean_metadata_value(val: Any) -> Any:
    """Ensures metadata value is ChromaDB-compatible (str, int, float, bool)."""
    if val is None:
        return ""
    if isinstance(val, (int, float, bool, str)):
        return val
    if isinstance(val, (list, tuple)):
        return ", ".join(str(x) for x in val)
    return str(val)

def ingest_questions(force_reindex: bool = False) -> IngestResponse:
    """
    Ingests questions into ChromaDB persistently and idempotently.
    Prevents duplicates by checking existing document IDs.
    """
    questions = get_mongo_questions()
    if not questions:
        return IngestResponse(
            total_found=0,
            newly_indexed=0,
            already_indexed=0,
            total_in_collection=0,
            message="No questions found in MongoDB or local corpus."
        )

    # Initialize Chroma client
    os.makedirs(config.chroma_persist_dir, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=config.chroma_persist_dir)
    collection = chroma_client.get_or_create_collection(
        name=config.chroma_collection_name,
        metadata={"hnsw:space": "cosine"}
    )

    # Check already indexed IDs for repeatability & zero duplicates
    existing_result = collection.get()
    existing_ids = set(existing_result.get("ids", []))
    logger.info(f"ChromaDB collection currently contains {len(existing_ids)} indexed items.")

    to_index: List[Dict[str, Any]] = []
    already_indexed_count = 0

    for q in questions:
        q_id = str(q.get("id") or q.get("_id"))
        if not q_id:
            continue
        if q_id in existing_ids and not force_reindex:
            already_indexed_count += 1
            continue
        to_index.append(q)

    if not to_index:
        total_now = collection.count()
        return IngestResponse(
            total_found=len(questions),
            newly_indexed=0,
            already_indexed=already_indexed_count,
            total_in_collection=total_now,
            message=f"All {already_indexed_count} questions are already indexed in ChromaDB. Zero duplicates added."
        )

    logger.info(f"Indexing {len(to_index)} questions with model '{config.embedding_model_name}'...")
    model = get_embedding_model()

    batch_size = 64
    newly_indexed_count = 0

    for i in range(0, len(to_index), batch_size):
        batch = to_index[i:i + batch_size]
        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[Dict[str, Any]] = []

        for q in batch:
            q_id = str(q.get("id") or q.get("_id"))
            text = format_question_for_embedding(q)
            
            raw_meta = {
                "id": q_id,
                "subject": q.get("subject", "General Computer Science") or "General Computer Science",
                "topic": q.get("topic", "") or "",
                "year": clean_metadata_value(q.get("year", "")),
                "exam": clean_metadata_value(q.get("exam", "GATE")),
                "paper": clean_metadata_value(q.get("paper", "CS")),
                "question_type": clean_metadata_value(q.get("questionType", "")),
                "question": str(q.get("question", ""))[:1000],  # Bound length for metadata
                "correct_answer": clean_metadata_value(q.get("correctAnswer", "")),
                "explanation": str(q.get("explanation", ""))[:1500],
                "concepts": clean_metadata_value(q.get("concepts", "")),
                "difficulty": clean_metadata_value(q.get("difficulty", "medium")),
            }
            # Clean all metadata to ensure ChromaDB compatibility
            clean_meta = {k: clean_metadata_value(v) for k, v in raw_meta.items()}

            ids.append(q_id)
            documents.append(text)
            metadatas.append(clean_meta)

        # Generate embeddings
        embeddings = model.encode(documents, show_progress_bar=False).tolist()

        # Upsert into Chroma (upsert handles both new and existing records cleanly)
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        newly_indexed_count += len(ids)
        logger.info(f"Indexed batch {i // batch_size + 1}: {newly_indexed_count}/{len(to_index)} questions")

    total_now = collection.count()
    return IngestResponse(
        total_found=len(questions),
        newly_indexed=newly_indexed_count,
        already_indexed=already_indexed_count,
        total_in_collection=total_now,
        message=f"Successfully indexed {newly_indexed_count} questions into ChromaDB. Collection now has {total_now} items."
    )

if __name__ == "__main__":
    resp = ingest_questions()
    print(resp.model_dump_json(indent=2))
