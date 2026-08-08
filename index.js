'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const { DOCUMENT_TYPES, processDocument } = require('./mock_ai_engine');
const {
  db,
  getAllDocuments,
  getDocumentById,
  insertDocument,
  updateDocumentAction,
  resetDocuments,
  getAnalytics,
} = require('./db');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';

// ─── Security & Utility Middleware ───────────────────────────────────────────

// Security headers (CSP, XSS protection, etc.)
app.use(helmet());

// Gzip compression for all responses
app.use(compression());

// HTTP request logger — 'combined' in prod, 'dev' in dev
app.use(morgan(ENV === 'production' ? 'combined' : 'dev'));

// CORS — allow origins from env or default to Vercel production + local dev ports
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://fisheries-intelligent-hub.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, same-origin) or any origin in dev mode
    if (ENV !== 'production' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin '${origin}' not allowed.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,             // max 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use('/api', apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    environment: ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/documents
 * Returns all documents ordered by upload time (newest first).
 */
app.get('/api/documents', (_req, res, next) => {
  try {
    res.json(getAllDocuments());
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/upload
 * Ingests a simulated document via templateId.
 * Body: { templateId, uploader?, customName? }
 */
app.post('/api/documents/upload', (req, res, next) => {
  const { templateId, uploader, customName } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: 'templateId is required.' });
  }

  // Simulate AI OCR/NLP pipeline delay (~1.2 s) then persist to DB
  setTimeout(() => {
    try {
      const doc = processDocument({ templateId, uploader, customName });
      insertDocument(doc);
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  }, 1200);
});

/**
 * POST /api/documents/reset
 * Wipes the database and re-seeds with the initial mock data set.
 */
app.post('/api/documents/reset', (_req, res, next) => {
  try {
    const docs = resetDocuments();
    res.json({ message: 'Database reset to initial state.', count: docs.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/:id/action
 * Records a reviewer decision (APPROVE | REJECT | FLAG).
 * Body: { action, userRole, reviewerNotes? }
 */
app.post('/api/documents/:id/action', (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, userRole, reviewerNotes } = req.body;

    if (!action || !userRole) {
      return res.status(400).json({ error: 'action and userRole are required.' });
    }

    const existing = getDocumentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const statusMap = { APPROVE: 'Approved', REJECT: 'Rejected', FLAG: 'Flagged' };
    const newStatus = statusMap[action];
    if (!newStatus) {
      return res.status(400).json({ error: `Unknown action '${action}'. Use APPROVE, REJECT, or FLAG.` });
    }

    const updated = updateDocumentAction({
      id,
      status: newStatus,
      decisionBy: `${userRole} (Reviewer)`,
      decisionTime: new Date().toISOString(),
      reviewerNotes: reviewerNotes || `Action: ${action} applied.`,
    });

    res.json({ message: 'Document action recorded.', document: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics
 * Computes aggregated KPIs and chart-ready trend data from the live DB.
 */
app.get('/api/analytics', (_req, res, next) => {
  try {
    res.json(getAnalytics(DOCUMENT_TYPES));
  } catch (err) {
    next(err);
  }
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(`[ERROR] ${status} — ${err.message}`);
  if (ENV !== 'production') console.error(err.stack);
  res.status(status).json({
    error: err.message || 'Internal server error.',
    ...(ENV !== 'production' && { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[SERVER] AquaIntelligent Hub API running in ${ENV} mode on port ${PORT}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[SERVER] ${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log('[SERVER] HTTP server closed.');
    db.close();
    console.log('[DB] SQLite connection closed.');
    process.exit(0);
  });

  // Force exit if close takes too long
  setTimeout(() => {
    console.error('[SERVER] Forced exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
