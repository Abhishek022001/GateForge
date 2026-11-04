import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Automatically load environment variables from backend/.env or root .env
root_dir = Path(__file__).resolve().parent.parent
backend_env = root_dir / "backend" / ".env"
root_env = root_dir / ".env"

if backend_env.exists():
    load_dotenv(backend_env)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()

class TutorConfig(BaseModel):
    # MongoDB Configuration
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/gateforge")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "test")
    mongodb_collection: str = os.getenv("MONGODB_COLLECTION", "questions")

    # LLM Provider Configuration (Supports both GROQ and GROK keys)
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    grok_api_key: str = os.getenv("GROK_API_KEY", "")
    ai_provider: str = os.getenv("AI_PROVIDER", "groq")
    ai_model: str = os.getenv("AI_MODEL", "llama-3.3-70b-versatile")
    ai_endpoint: str = os.getenv(
        "AI_ENDPOINT",
        "https://api.groq.com/openai/v1/chat/completions"
    )
    ai_timeout_seconds: float = float(os.getenv("AI_REQUEST_TIMEOUT_MS", "30000")) / 1000.0

    # ChromaDB & Embeddings Configuration
    chroma_persist_dir: str = os.getenv(
        "CHROMA_PERSIST_DIR",
        str(root_dir / "ai_tutor" / "chroma_db")
    )
    chroma_collection_name: str = os.getenv("CHROMA_COLLECTION_NAME", "gate_questions")
    embedding_model_name: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")

    # RAG Retrieval Controls
    min_similarity_threshold: float = float(os.getenv("MIN_SIMILARITY_THRESHOLD", "0.52"))
    top_k_default: int = int(os.getenv("TOP_K_DEFAULT", "3"))

    # Server Configuration
    host: str = os.getenv("TUTOR_HOST", "0.0.0.0")
    port: int = int(os.getenv("TUTOR_PORT", "8000"))

    @property
    def active_api_key(self) -> str:
        """Returns the active API key, prioritizing GROQ_API_KEY then GROK_API_KEY."""
        return self.groq_api_key or self.grok_api_key

    @property
    def is_llm_configured(self) -> bool:
        key = self.active_api_key
        return bool(key and len(key.strip()) > 5)

config = TutorConfig()
