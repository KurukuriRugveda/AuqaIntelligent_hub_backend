# AquaIntelligent Backend API

This is the Node.js/Express backend for the AquaIntelligent Document Intake & Decision Hub. It provides a REST API to handle document ingestion, mock AI processing, and analytics tracking using a local SQLite database.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Variables:
   Configure your environment variables in a `.env` file in the root of this `backend` folder.
   *Example `.env`:*
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_PATH=./aqua_hub.db
   CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
   ```

### Running the Server

**Development Mode:**
Starts the server using standard node (runs on port 5000 by default).
```bash
npm start
```

**Production Mode:**
Starts the server with `NODE_ENV=production`.
```bash
npm run start:prod
```

**PM2 (Process Manager):**
If you have PM2 installed, you can use the ecosystem configuration:
```bash
npm run start:pm2
```

## 🛠 Tech Stack
- **Framework:** Express.js
- **Database:** SQLite3 (via `better-sqlite3`)
- **Security:** Helmet, CORS, express-rate-limit
- **Optimization:** Compression

## 📂 API Endpoints

- `GET /` - Health check status
- `GET /api/documents` - Fetch all ingested documents
- `POST /api/documents/upload` - Ingest/upload a new document (Mock AI delays)
- `POST /api/documents/reset` - Wipe the DB and re-seed mock data
- `POST /api/documents/:id/action` - Record reviewer decisions (APPROVE / REJECT / FLAG)
- `GET /api/analytics` - Fetch KPIs and KPI trend data
