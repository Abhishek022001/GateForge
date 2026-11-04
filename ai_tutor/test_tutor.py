import unittest
from fastapi.testclient import TestClient
from ai_tutor.main import app

class TestAITutorAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        """GET /api/tutor/health should return system status and question count."""
        response = self.client.get("/api/tutor/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn(data["status"], ["ready", "degraded"])
        self.assertGreaterEqual(data["questions_indexed"], 1)
        self.assertEqual(data["chroma_status"], "connected")

    def test_subjects_endpoint(self):
        """GET /api/tutor/subjects should return list of syllabus subjects."""
        response = self.client.get("/api/tutor/subjects")
        self.assertEqual(response.status_code, 200)
        subjects = response.json()
        self.assertIsInstance(subjects, list)
        self.assertGreater(len(subjects), 0)

    def test_ask_validation_errors(self):
        """POST /api/tutor/ask should validate query length and bounds."""
        # Query too short
        res1 = self.client.post("/api/tutor/ask", json={"query": "ab"})
        self.assertEqual(res1.status_code, 422)

        # top_k too large (> 5)
        res2 = self.client.post("/api/tutor/ask", json={"query": "Valid query here", "top_k": 10})
        self.assertEqual(res2.status_code, 422)

    def test_ask_grounded_gate_query(self):
        """POST /api/tutor/ask should retrieve authentic questions and ground explanation."""
        query = "What is the minimum number of nodes in an AVL tree of height h?"
        response = self.client.post("/api/tutor/ask", json={"query": query, "top_k": 3})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["query"], query)
        self.assertTrue(data["is_grounded"])
        self.assertGreater(len(data["retrieved_references"]), 0)
        
        # Verify reference structure
        first_ref = data["retrieved_references"][0]
        self.assertIn("id", first_ref)
        self.assertIn("question", first_ref)
        self.assertIn("similarity_score", first_ref)
        self.assertGreater(first_ref["similarity_score"], 0.20)
        self.assertTrue(len(data["answer"]) > 50)

    def test_ask_ungrounded_safeguard(self):
        """POST /api/tutor/ask must not fabricate context or claim grounding for irrelevant queries."""
        query = "How to bake a chocolate chip cookie in an oven at home?"
        response = self.client.post("/api/tutor/ask", json={"query": query, "top_k": 3})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["is_grounded"])
        self.assertEqual(len(data["retrieved_references"]), 0)
        self.assertIn("Corpus Notice", data["answer"])

    def test_repeatable_ingestion_idempotency(self):
        """POST /api/tutor/ingest should not create duplicate records when re-run."""
        response = self.client.post("/api/tutor/ingest")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(data["total_found"], 1)
        self.assertEqual(data["newly_indexed"], 0)
        self.assertGreaterEqual(data["already_indexed"], 1)

if __name__ == "__main__":
    unittest.main()
