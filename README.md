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
- **Database (Phase 2):** MongoDB with Mongoose (with automated graceful degradation / in-memory fallback)
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
│   │   │   ├── Header.jsx       # Top navigation, status indicator, candidate badge
│   │   │   ├── Sidebar.jsx      # Session history, navigation tabs, roadmap tracker
│   │   │   ├── ChatArea.jsx     # Message list, auto-scrolling, typing skeleton
│   │   │   ├── ChatMessage.jsx  # Markdown-rendered bubbles with copy action
│   │   │   ├── ChatInput.jsx    # Auto-resizing textarea with keyboard shortcuts
│   │   │   ├── EmptyState.jsx   # Placement prep prompt starter cards
│   │   │   ├── ErrorBanner.jsx  # Diagnostic error alerts & retry action
│   │   │   └── ProfileView.jsx  # Candidate profile management form
│   │   ├── hooks/
│   │   │   ├── useChat.js       # Conversation state, error handling, health polling
│   │   │   └── useProfile.js    # Candidate profile synchronization & localStorage
│   │   ├── services/
│   │   │   └── api.js           # Fetch client for /api/chat, /api/users, /api/health
│   │   ├── App.jsx              # Main view coordinator (Chat vs. Profile)
│   │   ├── index.css            # Tailwind CSS v4 entrypoint & typography
│   │   └── main.jsx             # React DOM entrypoint
│   ├── index.html
│   ├── package.json
│   └── vite.config.js         # Vite configuration with API reverse proxy
│
└── server/                    # Node.js + Express Backend
    ├── src/
    │   ├── config/
    │   │   ├── db.js            # MongoDB connection manager with credential sanitization
    │   │   └── env.js           # Centralized configuration & environment validation
    │   ├── controllers/
    │   │   ├── chat.controller.js  # Chat handler & profile-context injection
    │   │   └── user.controller.js  # User Profile CRUD controller
    │   ├── middleware/
    │   │   ├── errorHandler.js  # Standardized error and 404 responses
    │   │   └── requestLogger.js # Request ID and latency logging
    │   ├── models/
    │   │   └── user.model.js    # Mongoose schema for candidate profile
    │   ├── routes/
    │   │   ├── chat.routes.js   # Route definitions (/api/chat)
    │   │   └── user.routes.js   # User CRUD routes (/api/users)
    │   ├── services/
    │   │   ├── ai/
    │   │   │   └── ai.service.js   # LLM client singleton with profileContext option
    │   │   └── user/
    │   │       └── user.service.js # User persistence and prompt context formatter
    │   ├── utils/
    │   │   └── apiResponse.js   # Standardized JSON response envelope
    │   ├── app.js               # Express application pipeline
    │   └── server.js            # HTTP server bootstrap & DB connection
    ├── test/
    │   └── api.test.js          # Automated verification test suite (Phase 1 & Phase 2)
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
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1

# MongoDB Connection String (Phase 2 Profile Persistence)
MONGODB_URI=mongodb://localhost:27017/placement_agent
```

---

## 5. Getting Started & Running Locally

### Step 1: Install Dependencies
```bash
npm run install:all
```

### Step 2: Configure Environment
Copy `server/.env.example` to `server/.env` and adjust variables as needed:
```bash
cp server/.env.example server/.env
```

### Step 3: Run Backend Server
```bash
npm run dev:server
```
Runs on `http://localhost:5000`. Connects to MongoDB on startup or runs in graceful fallback mode if offline.

### Step 4: Run Frontend Client
```bash
npm run dev:client
```
Runs on `http://localhost:5173`.

---

## 6. API Specifications

### User Profile Endpoints (Phase 2)

- `POST /api/users` — Create candidate profile (Name, Email, Degree, Skills, Target Role/Companies, LeetCode count, Weak Areas).
- `GET /api/users/:id` — Retrieve candidate profile by ID.
- `PATCH /api/users/:id` — Update profile fields.
- `DELETE /api/users/:id` — Delete profile by ID.

### Chat Endpoint

- `POST /api/chat` — Sends a message with optional `userId` for candidate context:
```json
{
  "userId": "6abaa9c4bd153abf38c566ac",
  "message": "What should I study for my upcoming interview?"
}
```
*Backward compatibility preserved: `userId` is completely optional.*

### Health Endpoint

- `GET /api/health` — Checks status of server, configured LLM, and MongoDB connectivity.

---

## 7. Multi-Phase Roadmap

| Phase | Milestone | Description | Status |
|---|---|---|---|
| **Phase 1** | **Core AI Chat** | Decoupled client/server, AI service, configurable LLM, responsive UI | **COMPLETED** |
| **Phase 2** | **User Profile** | MongoDB models, CRUD APIs, UI profile sync, and structured chat context | **COMPLETED** |
| **Phase 3** | **Tool Calling** | Tool system (`get_user_profile`, `generate_questions`, `get_progress`) | *Upcoming* |
| **Phase 4** | **Structured Memory** | Short-term context pruning + long-term explicit student memory | *Upcoming* |
| **Phase 5** | **Placement Intelligence** | Gap analysis, role benchmarking, personalized roadmaps | *Upcoming* |
| **Phase 6** | **Question Generation** | Categorized DSA, SQL, ML, System Design, and Behavioral drills | *Upcoming* |
| **Phase 7** | **Answer Evaluation** | Rubric-based scoring, missing concepts, structured feedback | *Upcoming* |
| **Phase 8** | **RAG Pipeline** | Resume & notes ingestion, vector embeddings, grounded retrieval | *Upcoming* |
| **Phase 9** | **Live Web Tools** | Current company tech stacks, hiring trends, job post analysis | *Upcoming* |
| **Phase 10**| **Evaluation & Quality**| Automated test benchmark, token tracking, agent guardrails | *Upcoming* |
