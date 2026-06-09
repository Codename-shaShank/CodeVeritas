# Code Connect

Code Connect is a realtime collaborative coding workspace with authentication, shared rooms, live chat, file sync, drawing, code execution, and AI-assisted analysis.

## Project Layout

```text
docker-compose.yml        Local MongoDB / Kafka / Zookeeper / Redis stack
start-dev.ps1             Windows helper to start the full stack
client/                   Vite + React frontend
server/                   Express + Socket.IO backend
judge-worker/             Kafka consumer and Docker-based code execution worker
```

## What You Need

- Node.js 18+ and npm
- Docker Desktop or Docker Engine for the local MongoDB, Kafka, Zookeeper, and Redis stack
- A backend JWT secret
- A reachable ML agent service for AI generation and analysis
- Optional: MongoDB Atlas if you do not want to use the local MongoDB container

## URLs And Ports

| Service | URL | Purpose |
| --- | --- | --- |
| Frontend | http://localhost:5173 | Vite dev server |
| Backend | http://localhost:3000 | Express and Socket.IO API |
| MongoDB | mongodb://127.0.0.1:27017 | Local MongoDB port |
| Kafka | localhost:9092 | Broker port |
| Zookeeper | localhost:2181 | Kafka coordination |
| Redis | localhost:6379 | Pub/Sub relay for execution updates |
| ML agent | https://code-plag-fastapi.onrender.com | Default AI endpoint used by the backend |

## Environment Files

Copy the example files below into local `.env` files before starting the app.

### client/.env.example

```bash
VITE_BACKEND_URL=http://localhost:3000
```

### server/.env.example

```bash
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/codeconnect
JWT_SECRET=replace-with-a-long-random-secret
KAFKA_BROKERS=localhost:9092
REDIS_HOST=localhost
REDIS_PORT=6379
ML_AGENT_URL=https://code-plag-fastapi.onrender.com
```

### judge-worker/.env.example

```bash
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=judge-workers
REDIS_HOST=localhost
REDIS_PORT=6379
```

Notes:

- If you use MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.
- The server also falls back to `mongodb://127.0.0.1:27017/codeconnect` if `MONGO_URI` is not set.
- There is no `GEMINI_API_KEY` in this repository. The backend calls the external ML agent instead.
- `judge-worker` uses the local Kafka and Redis defaults above. If you move those services elsewhere, set the matching environment variables before starting it.

## Fresh Clone Setup

1. Clone the repository.
2. Copy the example environment files into place:
   ```powershell
   Copy-Item client\.env.example client\.env
   Copy-Item server\.env.example server\.env
   Copy-Item judge-worker\.env.example judge-worker\.env
   ```
3. Update `server/.env` with a strong `JWT_SECRET`. Keep the local `MONGO_URI` for Docker Compose, or replace it with your MongoDB Atlas connection string.
4. Start the full stack from the repository root:
   ```powershell
   .\start-dev.ps1
   ```
   The helper script starts Docker Compose and opens backend, worker, and frontend windows. It also installs dependencies the first time if a folder does not yet have `node_modules`.
5. If you prefer manual startup, run the services in this order:
   Infrastructure:
   ```powershell
   docker compose up -d
   ```
   Backend:
   ```powershell
   cd server
   npm install
   npm run dev
   ```
   Judge worker:
   ```powershell
   cd judge-worker
   npm install
   npm run dev
   ```
   Frontend:
   ```powershell
   cd client
   npm install
   npm run dev
   ```
   Docker Compose starts MongoDB, Kafka, Zookeeper, and Redis. The three npm commands start the backend, worker, and frontend.
6. Open http://localhost:5173 in your browser.

## Where The Backend And AI Calls Live

- server/server.js connects to MongoDB, verifies JWT auth, serves room data, calls the ML agent at /generate and /analyze, and publishes execution events through Socket.IO.
- server/migrations/migrate_generated_code.js connects to MongoDB for the generated-code migration.
- judge-worker/worker.js consumes Kafka jobs, runs code inside Docker containers, and publishes results to Redis.
- client/src/context/AppContext.jsx verifies the stored login token and checks ML agent health.
- client/src/context/SocketContext.jsx connects the frontend to the backend socket.
- client/src/components/forms/AuthComponent.jsx sends the login and signup requests.
- client/src/components/editor/AdminPanel.jsx fetches room data from the backend.
- client/src/components/tabs/AnalysisTab.jsx renders the AI analysis returned by the backend.

## Feature Notes

- The Gemini, ChatGPT, and Claude labels in the UI are model output tabs, not direct API keys in this repository.
- If the ML agent is unreachable, the core editor can still load, but AI generation and analysis will fail.
- If Kafka, Redis, or the judge worker are not running, code execution will not work.
