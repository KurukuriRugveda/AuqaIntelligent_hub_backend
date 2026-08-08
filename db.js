'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { MOCK_TEMPLATES, processDocument } = require('./mock_ai_engine');

// ─── Open / Create Database ──────────────────────────────────────────────────
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, 'aqua_hub.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id               TEXT PRIMARY KEY,
    file_name        TEXT    NOT NULL,
    type             TEXT    NOT NULL,
    facility         TEXT    NOT NULL,
    uploader         TEXT    NOT NULL,
    upload_time      TEXT    NOT NULL,
    content          TEXT    NOT NULL,  -- JSON blob
    alerts           TEXT    NOT NULL,  -- JSON blob (array)
    status           TEXT    NOT NULL DEFAULT 'Flagged',
    extraction_confidence REAL NOT NULL DEFAULT 0,
    ai_recommendation     TEXT,
    decision_by      TEXT,
    decision_time    TEXT,
    reviewer_notes   TEXT
  );
`);

console.log(`[DB] SQLite database opened: ${DB_PATH}`);

// ─── Prepared Statements ─────────────────────────────────────────────────────
const stmts = {
  insertDoc: db.prepare(`
    INSERT INTO documents (
      id, file_name, type, facility, uploader, upload_time,
      content, alerts, status, extraction_confidence,
      ai_recommendation, decision_by, decision_time, reviewer_notes
    ) VALUES (
      @id, @file_name, @type, @facility, @uploader, @upload_time,
      @content, @alerts, @status, @extraction_confidence,
      @ai_recommendation, @decision_by, @decision_time, @reviewer_notes
    )
  `),

  countDocs: db.prepare('SELECT COUNT(*) as cnt FROM documents'),

  allDocs: db.prepare(`
    SELECT * FROM documents ORDER BY upload_time DESC
  `),

  docById: db.prepare('SELECT * FROM documents WHERE id = ?'),

  updateAction: db.prepare(`
    UPDATE documents
    SET status         = @status,
        decision_by    = @decision_by,
        decision_time  = @decision_time,
        reviewer_notes = @reviewer_notes
    WHERE id = @id
  `),

  deleteAll: db.prepare('DELETE FROM documents'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a raw DB row into the plain-JS doc shape the API and frontend expect */
function rowToDoc(row) {
  return {
    id:                   row.id,
    fileName:             row.file_name,
    type:                 row.type,
    facility:             row.facility,
    uploader:             row.uploader,
    uploadTime:           row.upload_time,
    content:              JSON.parse(row.content),
    alerts:               JSON.parse(row.alerts),
    status:               row.status,
    extractionConfidence: row.extraction_confidence,
    aiRecommendation:     row.ai_recommendation,
    decisionBy:           row.decision_by,
    decisionTime:         row.decision_time,
    reviewerNotes:        row.reviewer_notes,
  };
}

/** Convert a processed-doc object into a flat row ready for INSERT */
function docToRow(doc) {
  return {
    id:                     doc.id,
    file_name:              doc.fileName,
    type:                   doc.type,
    facility:               doc.facility,
    uploader:               doc.uploader,
    upload_time:            doc.uploadTime,
    content:                JSON.stringify(doc.content),
    alerts:                 JSON.stringify(doc.alerts),
    status:                 doc.status,
    extraction_confidence:  doc.extractionConfidence,
    ai_recommendation:      doc.aiRecommendation,
    decision_by:            doc.decisionBy ?? null,
    decision_time:          doc.decisionTime ?? null,
    reviewer_notes:         doc.reviewerNotes ?? null,
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
function seedIfEmpty() {
  const { cnt } = stmts.countDocs.get();
  if (cnt > 0) {
    console.log(`[DB] Existing data found (${cnt} records). Skipping seed.`);
    return;
  }

  console.log('[DB] Empty database — seeding with mock records...');
  const seedMany = db.transaction(() => {
    MOCK_TEMPLATES.forEach((tpl) => {
      const doc = processDocument({
        templateId: tpl.id,
        uploader:   tpl.uploader,
        customName: tpl.fileName,
      });

      // Make odd-indexed templates pre-approved (historical)
      if (tpl.id.endsWith('001')) {
        doc.status       = 'Approved';
        doc.decisionBy   = 'Cooperative Manager (Sarah Jenkins)';
        doc.decisionTime = new Date(Date.now() - 3_600_000 * 4).toISOString();
        doc.reviewerNotes = 'Verified. Operational limits normal, data matches baseline.';
      }

      stmts.insertDoc.run(docToRow(doc));
    });
  });

  seedMany();
  console.log(`[DB] Seeded ${MOCK_TEMPLATES.length} records.`);
}

seedIfEmpty();

// ─── Public API ──────────────────────────────────────────────────────────────

function getAllDocuments() {
  return stmts.allDocs.all().map(rowToDoc);
}

function getDocumentById(id) {
  const row = stmts.docById.get(id);
  return row ? rowToDoc(row) : null;
}

function insertDocument(doc) {
  stmts.insertDoc.run(docToRow(doc));
}

function updateDocumentAction({ id, status, decisionBy, decisionTime, reviewerNotes }) {
  stmts.updateAction.run({
    id,
    status,
    decision_by:    decisionBy,
    decision_time:  decisionTime,
    reviewer_notes: reviewerNotes,
  });
  return getDocumentById(id);
}

function resetDocuments() {
  const reset = db.transaction(() => {
    stmts.deleteAll.run();
    seedIfEmpty();
  });
  reset();
  return getAllDocuments();
}

function getAnalytics(DOCUMENT_TYPES) {
  const docs = getAllDocuments();

  const totalIngested   = docs.length;
  const approvedCount   = docs.filter(d => d.status === 'Approved' || d.status === 'Auto-Approved').length;
  const flaggedCount    = docs.filter(d => d.status === 'Flagged').length;
  const rejectedCount   = docs.filter(d => d.status === 'Rejected').length;
  const totalConfidence = docs.reduce((s, d) => s + d.extractionConfidence, 0);
  const avgConfidence   = totalIngested > 0
    ? parseFloat((totalConfidence / totalIngested).toFixed(1))
    : 0;
  const flaggedRate     = totalIngested > 0
    ? parseFloat(((flaggedCount / totalIngested) * 100).toFixed(1))
    : 0;

  const landingDocs      = docs.filter(d => d.type === DOCUMENT_TYPES.HARVEST_LANDING);
  const totalHarvestedKg = landingDocs.reduce((s, d) => s + (d.content.weightKg || 0), 0);

  const typeCounts = {};
  docs.forEach(d => {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
  });

  const timelineData = docs.slice(0, 10).map(d => ({
    time:       d.uploadTime,
    type:       d.type,
    status:     d.status,
    confidence: d.extractionConfidence,
  }));

  const wqTrend = docs
    .filter(d => d.type === DOCUMENT_TYPES.WATER_QUALITY)
    .map(d => ({
      time: d.uploadTime,
      pH:   d.content.pH,
      do:   d.content.dissolvedOxygenMgL,
      temp: d.content.waterTempC,
    }));

  const coldTrend = docs
    .filter(d => d.type === DOCUMENT_TYPES.COLD_STORAGE)
    .map(d => ({
      time:    d.uploadTime,
      avgTemp: d.content.averageTempC,
      maxTemp: d.content.maxTempC,
    }));

  return {
    kpis: { totalIngested, approvedCount, flaggedCount, rejectedCount, avgConfidence, flaggedRate, totalHarvestedKg },
    typeCounts,
    timelineData,
    wqTrend,
    coldTrend,
  };
}

// Expose the raw db handle so index.js can hook graceful shutdown
module.exports = {
  db,
  getAllDocuments,
  getDocumentById,
  insertDocument,
  updateDocumentAction,
  resetDocuments,
  getAnalytics,
};
