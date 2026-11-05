import os
import sys
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from pymongo import MongoClient

from ai_tutor.config import config
from ai_tutor.models import (
    AskRequest,
    AskResponse,
    HealthResponse,
    IngestResponse,
    RetrievedQuestionRef,
)
from ai_tutor.rag_service import rag_service
from ai_tutor.ingest import ingest_questions

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_tutor.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing GateForge AI Tutor Service...")
    logger.info(f"Target ChromaDB directory: {config.chroma_persist_dir}")
    # Warm up embedding model and collection
    try:
        count = rag_service.collection.count()
        logger.info(f"ChromaDB ready with {count} questions indexed.")
        if count == 0:
            logger.info("Collection is empty. Running initial ingestion...")
            ingest_questions()
        # Pre-warm SentenceTransformer in RAM so first query does not hit cold-load lag
        get_embedding_model()
        logger.info("SentenceTransformer model pre-warmed successfully.")
    except Exception as e:
        logger.error(f"Error initializing ChromaDB / model on startup: {e}")
    yield
    logger.info("Shutting down GateForge AI Tutor Service.")

app = FastAPI(
    title="GateForge RAG AI Tutor API",
    description="Production RAG-powered AI Tutor grounded in authentic GATE Computer Science previous year questions.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/tutor/health", response_model=HealthResponse, tags=["Health"])
def get_health() -> HealthResponse:
    """Checks the health of ChromaDB, MongoDB, and the LLM provider configuration."""
    # 1. ChromaDB count
    chroma_status = "error"
    questions_count = 0
    try:
        questions_count = rag_service.collection.count()
        chroma_status = "connected"
    except Exception as ex:
        logger.error(f"ChromaDB health check failed: {ex}")

    # 2. MongoDB connection check
    mongo_connected = False
    try:
        with MongoClient(config.mongodb_uri, serverSelectionTimeoutMS=1500) as client:
            client.admin.command("ping")
            mongo_connected = True
    except Exception as ex:
        logger.warning(f"MongoDB ping check failed: {ex}")

    is_ready = chroma_status == "connected" and questions_count > 0
    status_str = "ready" if is_ready else ("degraded" if chroma_status == "connected" else "error")

    return HealthResponse(
        status=status_str,
        questions_indexed=questions_count,
        chroma_status=chroma_status,
        mongodb_connected=mongo_connected,
        llm_configured=config.is_llm_configured,
    )

@app.post("/api/tutor/ask", response_model=AskResponse, tags=["Tutor"])
async def ask_tutor(request: AskRequest) -> AskResponse:
    """
    Submits a student's GATE CS technical query to the RAG pipeline.
    Retrieves the top 3 authentic matching questions from ChromaDB and
    generates a grounded, LaTeX-formatted explanation using Groq/Grok.
    """
    try:
        response = await rag_service.ask(request)
        return response
    except Exception as e:
        logger.exception(f"Unhandled error in ask_tutor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while generating the tutor explanation: {str(e)}"
        )

@app.post("/api/tutor/ingest", response_model=IngestResponse, tags=["Ingestion"])
def trigger_ingest(force_reindex: bool = Query(False, description="Whether to re-embed and overwrite existing questions")) -> IngestResponse:
    """
    Triggers repeatable question ingestion from MongoDB into ChromaDB.
    Guarantees idempotency with zero duplicate records.
    """
    try:
        result = ingest_questions(force_reindex=force_reindex)
        return result
    except Exception as e:
        logger.exception(f"Ingest failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}"
        )

@app.get("/api/tutor/subjects", tags=["Taxonomy"])
def get_supported_subjects() -> List[str]:
    """Returns distinct GATE CS subjects available in the corpus."""
    try:
        # Get metadata from Chroma
        result = rag_service.collection.get(include=["metadatas"])
        subjects = set()
        for meta in result.get("metadatas", []):
            subj = meta.get("subject")
            if subj and isinstance(subj, str) and subj.strip():
                subjects.add(subj.strip())
        if subjects:
            return sorted(list(subjects))
    except Exception as e:
        logger.warning(f"Could not extract subjects from ChromaDB: {e}")
    
    # Standard GATE CS subjects fallback
    return [
        "Algorithms",
        "Computer Networks",
        "Computer Organization and Architecture",
        "Data Structures",
        "Database Management Systems",
        "Discrete Mathematics",
        "Engineering Mathematics",
        "Operating Systems",
        "Theory of Computation",
        "Compiler Design",
        "Digital Logic",
        "General Aptitude"
    ]

if __name__ == "__main__":
    uvicorn.run(
        "ai_tutor.main:app",
        host=config.host,
        port=config.port,
        reload=False,
        log_level="info"
    )
