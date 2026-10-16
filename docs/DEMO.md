# GATEForge Interview Demo Script (60–90 Seconds)

## Objective
Demonstrate the end-to-end technical strengths of GATEForge: grounding in official GATE PYQs, dual-stage AI verification, anti-leakage architecture, and real-time execution in under 90 seconds.

---

## Script & Walkthrough

### 1. The Hook & Home Page (00:00 – 00:20)
- **What to show:** Open `http://localhost:5173` (or production build).
- **What to say:**
  > *"This is GATEForge, an AI-powered practice engine for GATE CS aspirants. Instead of treating LLMs as raw question generators—which often hallucinate wrong answers and inconsistent math—GATEForge grounds question generation in official GATE previous year questions through a 9-stage verified pipeline."*
- **Action:** Point out the **Live System Statistics** grid (Official PYQs, Analyzed Questions, Subjects Covered) and the **9-Stage Architecture Pipeline** card.

### 2. Official Grounding & Pattern Extraction (00:20 – 00:40)
- **What to show:** Click **"Explore Question Bank"** (or `/bank`).
- **What to say:**
  > *"Every question here is an official GATE PYQ. Notice the 'Official GATE PYQ • 2024' badge. Behind each question is an 11-dimensional pedagogical profile: extracted concepts, cognitive skill level, distractor patterns, and common traps. When a user requests new practice questions, the system retrieves relevant PYQs from this gold-standard corpus to condition the generation prompt."*
- **Action:** Filter by a subject (e.g. *Databases* or *Algorithms*). Show the badges and KaTeX math rendering.

### 3. AI Practice & Generation Safeguards (00:40 – 01:10)
- **What to show:** Click **"Start AI Practice"** (or `/ai-practice`).
- **What to say:**
  > *"Here in AI Practice, the learner configures their session—say, 3 questions on Databases across Mixed question types (MCQ, MSQ, NAT). Behind the scenes, GATEForge runs bounded generation: each candidate undergoes structural validation, independent semantic re-solving by a separate verifier prompt, and an originality check against the source PYQ corpus to prevent rote duplicates. If any check fails, it automatically regenerates with targeted feedback, up to 3 bounded attempts."*
- **Action:** Select Subject: *Databases*, Topic: *Normalization*, Count: *3*, Type: *Mixed*. Click **"Generate Practice Session"**.
- **Observation:** Notice the progress indicator displaying stage transitions (*Retrieving PYQ context* → *Generating candidates* → *Semantic verification* → *Originality check*).

### 4. Zero Answer Leakage & Submission (01:10 – 01:30)
- **What to show:** Generated questions display in the interactive practice viewer.
- **What to say:**
  > *"Crucially, the frontend never receives the answers or explanations upfront. Even if a user inspects the network payload or React state, answers are held strictly in server-side session memory. Once the user submits, the backend evaluates the session, locks it from replay attacks, and returns verified step-by-step solutions."*
- **Action:** Answer the questions, click **"Review & Submit"**, confirm submission. Show the instantaneous scorecard and the verified step-by-step solution cards.
- **Wrap-up:**
  > *"That’s GATEForge: a deterministic, verified, and secure application of generative AI to competitive engineering exams."*
