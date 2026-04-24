# API Blackbox Simulator

A full-stack API testing and validation platform designed to go beyond traditional API tools.
This system not only executes API requests but also analyzes responses, detects failure patterns, and provides intelligent debugging insights.

---

## Live Demo

api-blackbox-simulator.vercel.app

---

## Project Overview

Modern API testing tools often stop at showing responses — status codes, payloads, and headers.
However, debugging APIs requires deeper understanding:

* Why did the request fail?
* Is the issue critical or minor?
* Is this failure consistent across requests?

This project addresses these gaps by combining:

* API execution
* Rule-based validation
* Automated edge-case testing
* Failure analysis
* Historical analytics

The result is a system that behaves more like a **debugging assistant** than a simple API client.

---

## Core Idea

Instead of focusing on:

> “What happened?”

This project focuses on:

> “Why did it happen?”

---

## Features

---

### API Testing Engine

* Supports HTTP methods:

  * GET
  * POST
  * PUT
  * DELETE

* Allows:

  * Custom headers
  * JSON request body
  * Dynamic endpoint testing

* Displays:

  * Status code
  * Response body
  * Response headers
  * Response time

---

### Automated Edge Case Testing

Each API request automatically triggers multiple test scenarios:

* Empty Body
* Null Values
* Incorrect Data Types
* Large Payload Simulation
* Invalid Endpoint (404)

These tests simulate real-world failure conditions and improve API robustness.

---

### Failure Insights Engine

The most important component of the system.

Instead of just showing failure, the system explains:

* What went wrong
* Why it went wrong
* How severe the issue is

#### It analyzes:

* HTTP status semantics
* Error type (timeout, network, server)
* Performance thresholds
* Response body quality
* Validation rule failures

#### Output:

* Human-readable insights
* Severity classification:

  * High
  * Medium
  * Low

---

### Rule-Based Validation Engine

Users can define custom validation rules for each request.

Example:

```json
{
  "expectedStatus": 200,
  "maxResponseTime": 500,
  "mustContain": ["success"],
  "mustNotContain": ["error"],
  "requiredHeaders": ["content-type"]
}
```

#### Supported Rules:

* expectedStatus
* maxResponseTime
* mustContain
* mustNotContain
* requiredHeaders
* response size constraints

These rules allow automated validation of API behavior.

---

### Analytics Dashboard

Tracks and analyzes API performance over time.

Includes:

* Success rate per endpoint
* Average response time
* Minimum and maximum latency
* Request trends (last 10 executions)
* Detection of unstable APIs

---

### Persistent History

All requests and results are stored in MongoDB.

Features:

* Full request history
* Filter by Passed / Failed
* Delete individual entries
* Clear entire history
* Export results

---

### Export System

Export test results in:

* JSON format
* CSV format

Useful for:

* Reporting
* Debugging logs
* Sharing results

---

### Debug Panel

Provides deep visibility into each request:

* Payload sent
* Response preview (truncated)
* Headers grid
* Error classification

---

### Request Control

* Cancel in-flight requests using AbortController
* Prevent long-running API hangs
* Improve user experience

---

## System Architecture

The system follows a modular backend architecture:

* Controllers → Handle request flow
* Services → Business logic (rules, insights, analytics)
* Models → MongoDB schema
* Routes → API endpoints

---

## Backend Flow

```text
User Request
   ↓
Controller Layer
   ↓
Request Service (API call)
   ↓
Rules Engine (validation)
   ↓
Insights Engine (analysis)
   ↓
Database (MongoDB)
   ↓
Response sent to frontend
```

---

## Tech Stack

### Frontend

* React
* Vite

### Backend

* Node.js
* Express

### Database

* MongoDB
* Mongoose

### Utilities

* Axios
* json2csv

---

## Project Structure

```text
api-blackbox-simulator/
├── server/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   └── index.js
│
└── client/
    └── src/
```

---

## Screenshots

### Tester Interface

<img width="887" height="1774" alt="image" src="https://github.com/user-attachments/assets/9ebc03a0-af42-4f34-8cea-fa3a4ca12d60" />


### Analytics Dashboard

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/616e1365-da9e-499d-8119-e4dcd7c3241a" />


### Insights Panel

<img width="950" height="1655" alt="image" src="https://github.com/user-attachments/assets/d8aa6de1-412b-42df-8e82-083a797f73a9" />


### History View

<img width="1122" height="1402" alt="image" src="https://github.com/user-attachments/assets/a9b89386-815c-4625-b5e2-e825f99f1aa3" />


---

## Design Decisions

### Why rule-based validation?

APIs often fail silently or partially.
Rules enforce expectations and catch inconsistencies automatically.

---

### Why insights engine?

Developers don’t just need data — they need interpretation.
This reduces debugging time significantly.

---

### Why MongoDB?

Flexible schema supports dynamic test results and evolving analytics.

---

## Future Improvements

* Authentication system (multi-user support)
* Saved API collections
* CI/CD integration
* OpenAPI import
* Real-time streaming of test results
* Team collaboration features

---

## Use Cases

* Backend API testing
* Debugging production endpoints
* Performance monitoring
* QA automation
* Learning API behavior

---

## Author

**Ashnaa Seth**

* GitHub: https://github.com/ashnaaseth2325-oss
* Email: [ashnaaseth2325@gmail.com](mailto:ashnaaseth2325@gmail.com)

---

## 📄 License

MIT
