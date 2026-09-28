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
- **AI Integration (Phase 3):** OpenAI-compatible official SDK (`openai`) with dynamic tool calling and controlled agent loop
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
│   │   │   ├── ChatMessage.jsx  # Markdown-rendered bubbles with tool execution tags
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
    │   │   ├── chat.controller.js  # Chat handler routing through AgentService
    │   │   └── user.controller.js  # User Profile CRUD controller
    │   ├── middleware/
    │   │   ├── errorHandler.js  # Standardized error and 404 responses
    │   │   └── requestLogger.js # Request ID and latency logging
    │   ├── models/
    │   │   └── user.model.js    # Mongoose schema for candidate profile & progress
    │   ├── routes/
    │   │   ├── chat.routes.js   # Route definitions (/api/chat)
    │   │   └── user.routes.js   # User CRUD routes (/api/users)
    │   ├── services/
    │   │   ├── agent/
    │   │   │   └── agent.service.js# Controlled Agent Loop with limits & observability
    │   │   ├── ai/
    │   │   │   └── ai.service.js   # LLM client singleton with tools capability
    │   │   ├── tools/
    │   │   │   ├── index.js              # Central Tool Registry & safe executor
    │   │   │   ├── getUserProfile.tool.js    # Candidate profile tool
    │   │   │   ├── getUserProgress.tool.js   # Preparation progress tool
    │   │   │   └── updateUserProgress.tool.js# Topic mastery logging tool
    │   │   └── user/
    │   │       └── user.service.js # User persistence and prompt context formatter
    │   ├── utils/
    │   │   └── apiResponse.js   # Standardized JSON response envelope
    │   ├── app.js               # Express application pipeline
    │   └── server.js            # HTTP server bootstrap & DB connection
    ├── test/
    │   └── api.test.js          # Automated verification test suite (Phase 1, 2 & 3)
    ├── .env.example
    └── package.json
```

---

## 4. Agent Architecture & Tool System (Phase 3, 4 & 5)

The system operates a controlled Agent Loop with strict guardrails:

```text
User Request
     ↓
AI Agent Loop (max 5 iterations, max 8 tool calls, 30s timeout)
     ↓
Model decides: Tool required?
 ├── NO  → Return final text response
 └── YES → Select tool from Tool Registry (10 registered tools)
             ↓
           Validate arguments schema
             ↓
           Execute service abstraction (DB or Intelligence Catalog)
             ↓
           Return structured tool result (or handled error)
             ↓
           Agent observes result and continues reasoning
             ↓
           Final response synthesized
```

### Complete Tool Registry (10 Registered Tools)

1. **`get_user_profile`**: Retrieves candidate degree, current skills with proficiency levels, target role, target companies, and LeetCode count.
2. **`get_user_progress`**: Retrieves completed topics, weak/focus areas, and recent preparation history.
3. **`update_user_progress`**: Updates or records study mastery for a specific interview topic (`completed`, `in_progress`, `needs_review`, `weak`) with reflection notes.
4. **`get_relevant_memories`**: Retrieves candidate durable memories matching query topics using token relevance scoring.
5. **`save_memory`**: Stores durable, high-confidence facts (goals, weaknesses, achievements) while rejecting casual conversational chatter.
6. **`update_memory`**: Updates existing memory attributes by ID.
7. **`delete_memory`**: Removes a memory record by ID or key upon candidate request.
8. **`get_role_requirements`**: Retrieves canonical catalog skills, categories, and importance for any engineering/analytics role.
9. **`analyze_placement_readiness`**: End-to-end deterministic assessment of candidate skills vs. role requirements, calculating readiness level, strengths, and priority gaps.
10. **`get_skill_gap_analysis`**: Identifies missing competencies and developing focus areas ranked by preparation urgency.

---

## 5. Placement Intelligence Engine (Phase 5)

### Role Catalog & Skill Requirements
The engine maintains a structured, deterministic catalog (`server/src/config/roles.catalog.js`) covering 9 core industry roles:
- **Software Engineer**
- **Backend Developer**
- **Frontend Developer**
- **Full Stack Developer**
- **Data Analyst**
- **Data Scientist**
- **Machine Learning Engineer**
- **AI Engineer**
- **Data Engineer**

### Skill Normalization & Alias Map
Normalizes user inputs and role variations (e.g. `JS` / `ECMAScript` → `javascript`, `PowerBI` → `power bi`, `DSA` → `data structures & algorithms`, `ML` → `machine learning`) using deterministic token sets and alias dictionaries.

### Deterministic Gap & Priority Algorithm
1. Compares candidate profile skills against required catalog skills.
2. Factors in proficiency: differentiates `strong` (meets/exceeds target), `developing` (below target level or flagged weak area), and `gap` (completely absent).
3. Considers recent progress and long-term memory weaknesses.
4. Ranks skill gaps based on:
   - Importance: `high` > `medium` > `low`
   - Gap severity: missing > developing
   - Explicit weak area flags (+0.75 priority bump)

### Explainable Preparation Readiness Indicator
Calculates an explainable preparation score (`0.0` to `1.0`):
$$\text{Readiness Score} = \text{clamp}\left(\frac{\sum (\text{weight} \times \text{credit})}{\sum \text{weights}} + \text{Progress Bonus} + \text{LeetCode Bonus}, 0.0, 1.0\right)$$
- **`placement_ready`** ($\ge 0.80$): High coverage across all high/medium importance requirements.
- **`progressing`** ($0.60 - 0.79$): Solid foundation with a few developing topics.
- **`developing`** ($0.35 - 0.59$): Multiple key requirements missing or in early progress.
- **`early`** ($< 0.35$): Foundational stage; majority of core skills absent.

> **CRITICAL DISCLAIMER:** The readiness score is an internal **preparation coverage indicator** relative to configured curriculum benchmarks. It is **NOT** a hiring prediction, job guarantee, or employment probability calculator.

---

## 6. REST API Endpoints

### Chat & Agent
- `POST /api/chat`: Send message through controlled agent loop
- `GET /api/health`: Health status, AI readiness, and database connection state

### Profile (Phase 2)
- `POST /api/users`: Create candidate profile
- `GET /api/users/:userId`: Retrieve profile
- `PATCH /api/users/:userId`: Update profile
- `DELETE /api/users/:userId`: Delete profile

### Structured Memory (Phase 4)
- `GET /api/users/:userId/memories`: Retrieve candidate memories
- `POST /api/users/:userId/memories`: Save candidate memory
- `PATCH /api/memories/:memoryId`: Update memory
- `DELETE /api/memories/:memoryId`: Delete memory

### Placement Intelligence (Phase 5)
- `GET /api/placement/roles`: List all catalog placement roles
- `GET /api/placement/roles/:role`: Get required skills for a role
- `GET /api/users/:userId/placement-analysis`: Retrieve placement intelligence analysis

---

## 7. Multi-Phase Roadmap

| Phase | Milestone | Description | Status |
|---|---|---|---|
| **Phase 1** | **Core AI Chat** | Decoupled client/server, AI service, configurable LLM, responsive UI | **COMPLETED** |
| **Phase 2** | **User Profile** | MongoDB models, CRUD APIs, UI profile sync, and structured chat context | **COMPLETED** |
| **Phase 3** | **Tool Calling & Agent Loop**| Controlled agent loop, tool registry, profile & progress tools | **COMPLETED** |
| **Phase 4** | **Structured Memory** | Short-term context pruning + long-term explicit student memory | **COMPLETED** |
| **Phase 5** | **Placement Intelligence** | Deterministic gap analysis, role benchmarking, readiness indicator | **COMPLETED** |
| **Phase 6** | **Question Generation** | Categorized DSA, SQL, ML, System Design, and Behavioral drills | *Upcoming* |
| **Phase 7** | **Answer Evaluation** | Rubric-based scoring, missing concepts, structured feedback | *Upcoming* |
| **Phase 8** | **RAG Pipeline** | Resume & notes ingestion, vector embeddings, grounded retrieval | *Upcoming* |
| **Phase 9** | **Live Web Tools** | Current company tech stacks, hiring trends, job post analysis | *Upcoming* |
| **Phase 10**| **Evaluation & Quality**| Automated test benchmark, token tracking, agent guardrails | *Upcoming* |

---

## 8. Verification & Testing

Run the full end-to-end verification suite across all phases:

```bash
# Run server test suite (54/54 automated tests across Phases 1-5)
npm run test:server

# Run client linter (Oxlint)
npm run lint:client

# Run client production build (Vite)
npm run build:client
```

