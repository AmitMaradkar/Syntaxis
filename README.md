# Syntaxis — AI-Powered Adaptive Coding Tutor

Syntaxis is a full-stack, AI-powered coding tutor web application designed to help developers build durable programming intuition and mental models. Instead of simply generating answers like a typical code assistant, Syntaxis uses an **adaptive 3-tier hint escalation engine**, tracks **recurring mistake habits** across attempts, and dynamically tunes its explanation depth using rolling difficulty assessment.

---

## 🎯 Core Value & USPs

### 1. 🧠 Mistake Pattern Memory (`mistakeTracker.js`)
- Classifies each submission's mistakes into standard error types:
  - `off-by-one`, `wrong-data-structure`, `syntax`, `logic-error`, `bad-complexity`, `type-error`, `boundary-error`, `null-reference`, `scope-error`, `other`
- Aggregates historical mistake frequencies per user and session in MongoDB (`MistakeLog`).
- Injects recurring patterns into Claude's prompt:
  > *"This user has repeatedly made off-by-one (5x) and logic-error (3x) type errors. Watch for and call out these patterns."*

### 2. 💡 Adaptive 3-Tier Hint Engine (`hintEngine.js`)
Guarantees students learn rather than having answers prematurely spoiled:
- **Tier 1 (Conceptual Nudge)**: High-level conceptual nudge. Strictly no code snippets or line numbers.
- **Tier 2 (Specific Pointer)**: Pinpoints the problematic area and logical invariant, asking guided questions.
- **Tier 3 (Solution & Mental Model)**: Full explanation with corrected code, complexity breakdown, and Explain-Why analysis.
- *Never auto-jumps to Tier 3.* Escalation requires explicit student progression.

### 3. 📈 Rolling Adaptive Difficulty (`difficultyEngine.js`)
- Analyzes rolling performance over recent attempts:
  - Success rate (% solved)
  - Hints used per problem
  - Time elapsed
- Computes an inferred level: `beginner`, `intermediate`, or `advanced`.
- Automatically modulates Claude's explanation depth and system prompts without manual selectors.
- Exposed in the UI as a subtle live badge.

### 4. 🔍 Explain-Why Mental Model Logic (`explainPrompt.js`)
Structured 3-part pedagogical breakdown for any mistake:
1. **What's Wrong**: Grounded in student's actual code, quoting the exact lines and variables.
2. **Why It Happens**: Conceptual mechanics (memory, call stack, language semantics).
3. **Mental Model to Remember**: Memorable analogy or checklist for future problems.

### 5. 💻 Monaco Editor & Sandbox Execution
- Powered by `@monaco-editor/react` with VS-Dark theme.
- Multi-language support: JavaScript, Python, Java, C++.
- Debounced 500ms `onChange` to prevent redundant computations.
- File upload with automatic language extension detection.
- Remote code execution via isolated Piston sandbox API.

### 6. 📊 Progress & Fluency Analytics (`ProgressChart.jsx`)
- **Fluency Score (0–100)**: Weighted composite of:
  - Success rate (35%)
  - Declining mistake frequency (30%)
  - Declining hint escalation dependency (25%)
  - Practice volume & consistency (10%)
- Interactive charts built with `Recharts`:
  - 30-day Mistake Frequency Trend (Area Chart)
  - Error Pattern Breakdown (Donut Chart)
  - Hint Escalation Trajectory (Bar Chart)

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v3, Monaco Editor (`@monaco-editor/react`), Recharts, React Markdown, Lucide Icons, Canvas Confetti.
- **Backend**: Node.js, Express, Mongoose (MongoDB), Anthropic Claude SDK (`@anthropic-ai/sdk`), JWT Auth, Piston API client, Morgan, Helmet, Rate Limiter.
- **Database**: MongoDB (supports both cloud MongoDB Atlas or local daemon, with zero-config in-memory fallback for immediate local testing).

---

## 📂 Project Structure

```
Ai-tutor/
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   └── tutorApi.js            # Axios client with JWT interceptor
│   │   ├── components/
│   │   │   ├── MonacoEditorPanel.jsx  # Monaco editor + language picker + Piston run
│   │   │   ├── ChatPanel.jsx          # Concept chat + Explain-Why modal
│   │   │   ├── HintPanel.jsx          # 3-tier escalation stepper + pattern banner
│   │   │   ├── Navbar.jsx             # Brand header + adaptive difficulty badge
│   │   │   └── ProgressChart.jsx      # Recharts visualizations & Fluency Score
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Persistent JWT auth context
│   │   ├── pages/
│   │   │   ├── TutorPage.jsx          # Main split-panel tutoring workspace
│   │   │   ├── ProgressPage.jsx       # Analytics dashboard
│   │   │   ├── LoginPage.jsx          # Sign-in page
│   │   │   └── RegisterPage.jsx       # Registration page
│   │   ├── App.jsx                    # Routing
│   │   ├── index.css                  # Tailwind directives + glassmorphism tokens
│   │   └── main.jsx
│   ├── tailwind.config.js             # Tailwind CSS v3 config
│   ├── postcss.config.js
│   └── package.json
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js      # Register, login, profile
│   │   │   └── tutorController.js     # Chat, code review, hints, piston execution
│   │   ├── middleware/
│   │   │   └── auth.js                # JWT verification
│   │   ├── models/
│   │   │   ├── User.js                # User accounts & difficulty level
│   │   │   ├── Session.js             # Problem attempts, code & hint history
│   │   │   └── MistakeLog.js          # Categorized mistakes per session
│   │   ├── prompts/
│   │   │   ├── hintPrompt.js          # Tier 1, 2, 3 prompt generators
│   │   │   ├── reviewPrompt.js        # JSON error classifier prompt
│   │   │   └── explainPrompt.js       # 3-part Explain-Why breakdown
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── chat.js
│   │   │   ├── codeReview.js
│   │   │   ├── hint.js
│   │   │   └── progress.js
│   │   ├── services/
│   │   │   ├── llmService.js          # Anthropic SDK wrapper & streaming
│   │   │   ├── mistakeTracker.js      # Aggregation & pattern injection context
│   │   │   ├── hintEngine.js          # Progressive escalation manager
│   │   │   └── difficultyEngine.js    # Rolling difficulty metric calculator
│   │   └── index.js                   # Express server entry point
│   ├── .env                           # Server environment variables
│   └── package.json
├── .env.example
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Environment Configuration

Copy `.env.example` into `server/.env`:
```bash
cp .env.example server/.env
```

Ensure `GEMINI_API_KEY` is populated with your Google Gemini API key:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/ai-coding-tutor
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=Gemini 3.5 Flash-Lite
JWT_SECRET=your_jwt_secret
PISTON_API_URL=https://emkc.org/api/v2/piston
```

*(Note: If you don't have a local MongoDB daemon running, the server automatically starts an in-memory MongoDB runner so you can develop immediately without setup friction!)*

### 2. Run the Backend Server

```bash
cd server
npm install
npm run dev
# Server runs on http://localhost:5000
```

### 3. Run the Frontend Client

```bash
cd client
npm install
npm run dev
# Client runs on http://localhost:5173
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token |
| `GET` | `/api/auth/profile` | Get current user profile & difficulty level |
| `POST` | `/api/code-review` | Submit code, classify errors, get Tier 1 hint |
| `POST` | `/api/hint/next` | Escalate to next progressive hint tier (Tier 1 → 2 → 3) |
| `POST` | `/api/code/explain-why` | Get 3-part Explain-Why mental model analysis |
| `POST` | `/api/code/execute` | Execute code in Piston sandbox |
| `POST` | `/api/chat` | Ask concept questions to AI tutor |
| `GET` | `/api/progress/:userId` | Fetch mistake trends, hint stats, & fluency score |
| `GET` | `/api/health` | Health check endpoint |