from typing import List, Optional, Union, Any
from pydantic import BaseModel, Field

class RetrievedQuestionRef(BaseModel):
    id: str = Field(..., description="Unique GATE question ID from the verified corpus")
    question: str = Field(..., description="The official question text")
    subject: Optional[str] = Field(None, description="GATE CS Subject")
    topic: Optional[str] = Field(None, description="Topic or syllabus classification")
    year: Optional[Union[int, str]] = Field(None, description="Year of the official GATE examination")
    question_type: Optional[str] = Field(None, description="MCQ, MSQ, or NAT")
    similarity_score: float = Field(..., description="Relevance similarity score (0.0 to 1.0)")
    correct_answer: Optional[Any] = Field(None, description="Verified master answer key")
    explanation: Optional[str] = Field(None, description="Authoritative reference solution explanation")

class AskRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=3,
        max_length=1500,
        description="The student's GATE CS technical question or concept inquiry"
    )
    subject: Optional[str] = Field(
        None,
        description="Optional subject filter to narrow down retrieval (e.g. 'Algorithms', 'Operating Systems')"
    )
    top_k: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Number of top relevant questions to retrieve from ChromaDB"
    )

class AskResponse(BaseModel):
    query: str
    answer: str
    is_grounded: bool = Field(
        ...,
        description="True if the response is verified and grounded in authentic retrieved GATE PYQs"
    )
    retrieved_references: List[RetrievedQuestionRef] = Field(
        default_factory=list,
        description="Top relevant GATE questions retrieved as context"
    )
    latency_ms: float
    model_used: str

class HealthResponse(BaseModel):
    status: str
    questions_indexed: int
    chroma_status: str
    mongodb_connected: bool
    llm_configured: bool

class IngestResponse(BaseModel):
    total_found: int
    newly_indexed: int
    already_indexed: int
    total_in_collection: int
    message: str
