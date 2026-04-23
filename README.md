# API Blackbox Tester

A full-stack API testing and validation platform with an intelligent failure insights engine. Send requests, enforce custom validation rules, run automated stress tests, and get AI-style explanations for why your endpoints fail ; all in one tool.

---

Live Demo: Coming soon  
Backend: Node.js + Express  
Frontend: React + Vite  
Database: MongoDB

---

## Why This Exists

Most API testing tools stop at responses. They show status codes and payloads, but they don’t explain failures.

This project focuses on **failure reasoning**, helping developers understand:
- Why an API failed
- Whether the failure is critical
- Patterns across multiple requests

It behaves more like a debugging assistant than a simple API client.

---

## What Makes This Different

Most API testers tell you *what* happened (status code, response time). This one tells you *why* it happened. The built-in **Failure Insights Engine** analyzes every response, across error type, HTTP semantics, performance thresholds, response body quality, and rule violations; and surfaces actionable, human-readable explanations with severity ratings.

---

## Features

### Core Testing
- **Custom requests** — any URL, method (GET / POST / PUT / DELETE), JSON body, and custom headers
- **5 automated preset tests** run alongside every request:
  - Empty Body, Null Values, Wrong Data Types, Large Payload, Invalid Endpoint (404)
- **AbortController cancel** — abort in-flight requests from the UI

---

## Key Highlights

- Rule-based API validation engine
- Failure insights with severity classification
- MongoDB-backed history + analytics
- Exportable test results (JSON / CSV)
- Abortable requests with real-time feedback
- Structured backend (controllers, services, middleware)

  
### Rule-Based Validation Engine
- Define per-request validation rules that are checked against every response:
  - `expectedStatus` — exact status code match
  - `maxResponseTime` — latency ceiling in ms
  - `mustContain[]` — required strings in the response body
  - `mustNotContain[]` — forbidden strings in the response body
  - `requiredHeaders[]` — headers that must be present
  - `minResponseSize` / `maxResponseSize` — byte-range enforcement

### Failure Insights Engine
- Analyzes 6 dimensions per test result: error type, HTTP status semantics, performance, body quality, rule failures, and preset test context
- Deduplicates and ranks insights by severity: **high / medium / low**
- Persisted to MongoDB and aggregated in the Insights tab
- Shows common failure patterns, unstable endpoints, and slowest endpoints across all history

### History & Analytics
- Full request history persisted in MongoDB with all test results, insights, and severity
- Filter history by status (All / Passed / Failed) and delete individual entries or clear all
- Export history as **JSON** or **CSV**
- Per-endpoint analytics: total hits, success rate, avg/min/max response time
- Trend chart (last 10 requests);  pure CSS bar visualization, no chart library

### Debug Panel
- Payload sent, response body preview (truncated at 1500 chars), response headers grid, error type pill

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8 |
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose 9 |
| HTTP Client (server) | Axios |
| CSV Export | json2csv |
| Styling | Pure CSS (no UI framework) |

---

## Project Structure

```
api-tester/
├── server/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── controllers/
│   │   ├── testController.js      # Orchestrates test run
│   │   ├── historyController.js   # CRUD + export
│   │   ├── analyticsController.js # Aggregation queries
│   │   └── insightsController.js  # Insights aggregation
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── models/
│   │   └── History.js             # Full Mongoose schema
│   ├── routes/
│   │   ├── testRoutes.js
│   │   ├── historyRoutes.js
│   │   ├── analyticsRoutes.js
│   │   └── insightsRoutes.js
│   ├── services/
│   │   ├── requestService.js      # HTTP execution + error classification
│   │   ├── rulesEngine.js         # Validation rule checker
│   │   ├── insightsEngine.js      # Failure analysis engine
│   │   └── analyticsService.js    # MongoDB aggregation helpers
│   ├── index.js
│   └── package.json
│
└── client/client/
    ├── src/
    │   ├── App.jsx                # Full UI (single-component, 4 tabs)
    │   ├── App.css                # All styles (~1100 lines, pure CSS)
    │   └── main.jsx
    ├── index.html
    └── package.json
```

---

## Setup

### Prerequisites

- **Node.js** v18+
- **MongoDB** running locally on the default port (27017)

Start MongoDB:
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB
# or via mongod directly:
mongod --dbpath "C:\data\db"

# Linux
sudo systemctl start mongod
```

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/api-tester.git
cd api-tester
```

### 2. Start the Backend

```bash
cd server
npm install
npm run dev       # nodemon, auto-restarts on changes
# or
npm start         # production
```

Server runs on **http://localhost:5000**

### 3. Start the Frontend

```bash
cd client/client
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## Environment Variables

The server reads the following variables from a `.env` file placed in `server/`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/api-tester
```

Both are optional — the server defaults to port 5000 and the local MongoDB URI above if not set.

---

## API Endpoints

### Test Runner
| Method | Endpoint | Description |
|---|---|---|
| POST | `/test-api` | Run custom + preset tests with optional rules |

**Request body:**
```json
{
  "url": "https://your-api.com/endpoint",
  "method": "POST",
  "requestBody": "{\"key\": \"value\"}",
  "headers": { "Authorization": "Bearer token" },
  "enabledTests": ["Empty Body", "Large Payload"],
  "rules": {
    "expectedStatus": 200,
    "maxResponseTime": 500,
    "mustContain": ["success"],
    "requiredHeaders": ["content-type"]
  }
}
```

### History
| Method | Endpoint | Description |
|---|---|---|
| GET | `/history` | Get all history entries |
| DELETE | `/history/:id` | Delete a single entry |
| DELETE | `/history` | Clear all history |
| GET | `/history/export?format=json` | Export as JSON |
| GET | `/history/export?format=csv` | Export as CSV |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics` | Global stats + per-endpoint + trend data |

### Insights
| Method | Endpoint | Description |
|---|---|---|
| GET | `/insights` | Common issues, unstable endpoints, slowest endpoints, severity breakdown |

---

## Screenshots

> Place screenshots in `client/client/src/assets/` and update the paths below.

**Tester Tab — Custom request with rule validation results and debug panel**

![Tester Tab](client/client/src/assets/hero.png)

**Analytics Tab — Per-endpoint stats and trend chart**

**Insights Tab — Failure patterns, severity breakdown, unstable endpoints**

**History Tab — Filterable request log with export options**

---

## How It Works

### Request Flow

```
Browser → POST /test-api
  → testController validates input
  → requestService executes the user's request (axios, validateStatus: always 200)
  → rulesEngine checks all defined rules against the response
  → insightsEngine analyzes: error type, status code, performance, body, rule failures, preset context
  → 5 preset tests run sequentially (each gets its own insights)
  → maxSeverity() reduces all severities to a single overall rating
  → History saved to MongoDB
  → Full results returned to browser
```

### Error Classification

`requestService` maps axios error codes to typed errors shown as pills in the UI:

| Error Type | Trigger |
|---|---|
| `timeout` | `ECONNABORTED` or `ETIMEDOUT` |
| `network` | `ECONNREFUSED`, `ENOTFOUND`, `ENETUNREACH` |
| `invalid_url` | `ERR_INVALID_URL` |
| `server_error` | HTTP 5xx response |
| `unknown` | Anything else |

---

## Future Improvements

- [ ] Authentication — JWT-protected history per user
- [ ] WebSocket live updates — stream preset test results as they complete
- [ ] Collection management — save and reuse request configurations
- [ ] CI/CD integration — run saved test suites from CLI
- [ ] Diff view — compare two historical responses side by side
- [ ] Rule templates — preset rule bundles for common API patterns (REST, GraphQL, health checks)
- [ ] Rate limit detection — auto-flag 429 patterns across history
- [ ] OpenAPI / Swagger import — generate test cases from a spec

---

## Author

Built by **Ashna Seth**

- GitHub: [@ashnaaseth](https://github.com/ashnaaseth)
- Email: ashnaaseth2325@gmail.com

---

## License

MIT
