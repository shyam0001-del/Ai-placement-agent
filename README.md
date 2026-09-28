# AI Placement Agent 🚀

> An intelligent, production-quality placement preparation co-pilot designed for engineering students and tech job seekers.

---

## 1. Overview & Vision

The **AI Placement Agent** is not another generic chat wrapper. It is engineered from the ground up as a phased placement intelligence system that helps candidates prepare for competitive technical interviews (Software Engineering, Data Science, Data Analyst, Machine Learning, and DevOps).

A candidate can say:
> *"I have a Data Scientist interview at XYZ in 14 days."*

The agent's multi-phase architecture is designed to:
1. Understand student profile & background
2. Analyze target roles and company expectations
3. Benchmark student skills and surface exact gaps
4. Formulate personalized day-by-day roadmaps
5. Generate technical diagnostic drills (DSA, SQL, Python, System Design, Behavioral)
6. Deliver objective, rubric-based evaluation
7. Maintain long-term structured memory
8. Execute tool calls, search current tech stacks, and ground responses using RAG over student notes and resumes

---

## 2. Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons, React Markdown (GFM support)
- **Backend:** Node.js, Express.js (ES Modules), CORS, dotenv
- **AI Integration:** OpenAI-compatible official SDK (`openai`), dynamically configured through environment variables
- **Testing:** Node.js native test runner (`node --test`), Oxlint
- **Architecture Philosophy:** Decoupled client/server, clean layer separation, zero hardcoded model names, defensive error handling

---

## 3. Project Structure

```text
ai-placement-agent/
├── package.json               # Root scripts for client & server orchestration
├── .gitignore                 # Version control exclusions
├── .env.example               # Root environment variable template
├── README.md                  # Comprehensive architectural and usage documentation
│
├── client/                    # React + Vite Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/        # Modular UI components
│   │   │   ├── Header.jsx       # Top navigation, status indicator, model badge
│   │   │   ├── Sidebar.jsx      # Session history & roadmap tracker
│   │   │   ├── ChatArea.jsx     # Message list, auto-scrolling, typing skeleton
│   │   │   ├── ChatMessage.jsx  # Markdown-rendered bubbles with copy action
│   │   │   ├── ChatInput.jsx    # Auto-resizing textarea with keyboard shortcuts
│   │   │   ├── EmptyState.jsx   # Placement prep prompt starter cards
│   │   │   └── ErrorBanner.jsx  # Diagnostic error alerts & retry action
│   │   ├── hooks/
│   │   │   └── useChat.js       # Conversation state, error handling, health polling
│   │   ├── services/
│   │   │   └── api.js           # Fetch client for /api/chat and /api/health
│   │   ├── App.jsx              # Main dashboard layout
│   │   ├── index.css            # Tailwind CSS v4 entrypoint & typography
│   │   └── main.jsx             # React DOM entrypoint
│   ├── index.html
│   ├── package.json
│   └── vite.config.js         # Vite configuration with API reverse proxy
│
└── server/                    # Node.js + Express Backend
    ├── src/
    │   ├── config/
    │   │   └── env.js           # Centralized configuration & environment validation
    │   ├── controllers/
    │   │   └── chat.controller.js  # Request validation & AI invocation
    │   ├── middleware/
    │   │   ├── errorHandler.js  # Standardized error and 404 responses
    │   │   └── requestLogger.js # Request ID and latency logging
    │   ├── routes/
    │   │   └── chat.routes.js   # Route definitions (/api/chat)
    │   ├── services/
    │   │   └── ai/
    │   │       └── ai.service.js # LLM client singleton with fallback & options
    │   ├── utils/
    │   │   └── apiResponse.js   # Standardized JSON response envelope
    │   ├── app.js               # Express application pipeline
    │   └── server.js            # HTTP server bootstrap
    ├── test/
    │   └── api.test.js          # Automated endpoint and validation test suite
    ├── .env.example
    └── package.json
```

---

## 4. Environment Variables

Create `.env` in `server/` (or project root):

```env
# Server Port
PORT=5000

# Node Environment
NODE_ENV=development

# Allowed CORS Origin for Frontend
CORS_ORIGIN=http://localhost:5173

# OpenAI-Compatible LLM API Configuration
# Works with OpenAI, Groq, Ollama, OpenRouter, DeepSeek, etc.
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Optional base URL (leave commented for default OpenAI API)
# OPENAI_BASE_URL=https://api.openai.com/v1

# MongoDB Connection String (For Phase 2+)
MONGODB_URI=mongodb://localhost:27017/placement_agent
```

> **Crucial Rule:** The model name is **NEVER** hardcoded in the codebase. It must always be supplied through `OPENAI_MODEL`.

---

## 5. Getting Started & Running Locally

### Step 1: Clone and Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or install separately inside `server/` and `client/` using `npm install`)*

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp server/.env.example server/.env
```
Edit `server/.env` and provide your `OPENAI_API_KEY` and preferred `OPENAI_MODEL` (e.g., `gpt-4o-mini`, `gpt-4o`, `llama-3.3-70b-versatile`, etc.).

### Step 3: Run Backend Server
In a terminal:
```bash
npm run dev:server
```
The server starts on `http://localhost:5000`.

### Step 4: Run Frontend Client
In a second terminal:
```bash
npm run dev:client
```
The client starts on `http://localhost:5173`.

---

## 6. API Specifications (Phase 1)

### `GET /api/health`
Checks server status, configured model, and AI engine readiness.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "online",
    "service": "AI Placement Agent Server",
    "configuredModel": "gpt-4o-mini",
    "aiReady": true,
    "timestamp": "2026-09-28T17:00:00.000Z"
  }
}
```

### `POST /api/chat`
Sends a student query to the AI Placement Agent.

**Request:**
```json
{
  "message": "What should I study for a data analyst interview in 14 days?"
}
```

**Success Response (HTTP 200):**
```json
{
  "success": true,
  "message": "For a 14-day Data Analyst preparation sprint...",
  "data": {
    "message": "For a 14-day Data Analyst preparation sprint...",
    "model": "gpt-4o-mini",
    "usage": {
      "prompt_tokens": 85,
      "completion_tokens": 310,
      "total_tokens": 395
    }
  }
}
```

**Error Response (HTTP 400 / 500):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message cannot be blank."
  }
}
```

---

## 7. Testing & Verification

Run backend unit and integration tests:
```bash
npm run test:server
```
Run frontend linting check:
```bash
npm run lint:client
```
Build frontend production bundle:
```bash
npm run build:client
```

---

## 8. Multi-Phase Roadmap

| Phase | Milestone | Description | Status |
|---|---|---|---|
| **Phase 1** | **Core AI Chat** | Decoupled client/server, AI service, configurable LLM, responsive UI | **COMPLETED** |
| **Phase 2** | **User Profile** | MongoDB models for degree, skills, target role/companies, prep stats | *Upcoming* |
| **Phase 3** | **Tool Calling** | Tool system (`get_user_profile`, `generate_questions`, `get_progress`) | *Upcoming* |
| **Phase 4** | **Structured Memory** | Short-term context pruning + long-term explicit student memory | *Upcoming* |
| **Phase 5** | **Placement Intelligence** | Gap analysis, role benchmarking, personalized roadmaps | *Upcoming* |
| **Phase 6** | **Question Generation** | Categorized DSA, SQL, ML, System Design, and Behavioral drills | *Upcoming* |
| **Phase 7** | **Answer Evaluation** | Rubric-based scoring, missing concepts, structured feedback | *Upcoming* |
| **Phase 8** | **RAG Pipeline** | Resume & notes ingestion, vector embeddings, grounded retrieval | *Upcoming* |
| **Phase 9** | **Live Web Tools** | Current company tech stacks, hiring trends, job post analysis | *Upcoming* |
| **Phase 10**| **Evaluation & Quality**| Automated test benchmark, token tracking, agent guardrails | *Upcoming* |
