// ============================================================
// CIRAS Backend Server — Express + SQLite
// ============================================================

const express = require('express');
const cors = require('cors');
const { initDB, seedDatabase, getAllRecords, getRecord, addRecord, updateRecord, deleteRecord, getAuditLogs } = require('./db/database');

// Import AI Engine (converted to CommonJS)
const aiEngine = require('./utils/aiEngine');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ---- Initialize DB & Seed ----
initDB();
seedDatabase();

// ---- ROLE-BASED ACCESS CONTROL (in-memory for simplicity) ----
let currentRole = 'Admin';
let currentUser = 'CI Arun Krishnan';

const ROLE_PERMISSIONS = {
  Admin: ['create', 'read', 'update', 'delete'],
  Investigator: ['create', 'read', 'update'],
  Analyst: ['read'],
  Viewer: ['read'],
};

function checkPermission(action, res) {
  const perms = ROLE_PERMISSIONS[currentRole] || [];
  if (!perms.includes(action)) {
    res.status(403).json({ error: `Access denied: ${currentRole} cannot perform ${action}` });
    return false;
  }
  return true;
}

// ---- AUTH ROUTES ----
app.get('/api/auth/role', (req, res) => {
  res.json({ role: currentRole, user: currentUser });
});

app.post('/api/auth/role', (req, res) => {
  const { role, user } = req.body;
  if (role) currentRole = role;
  if (user) currentUser = user;
  res.json({ role: currentRole, user: currentUser });
});

// ---- AUDIT LOGS (before generic routes) ----
app.get('/api/audit-logs/all', (req, res) => {
  try {
    const logs = getAuditLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- AI ANALYSIS ROUTES (before generic routes) ----
app.post('/api/ai/similar-crimes', (req, res) => {
  try {
    const { targetFirId } = req.body;
    const allFirs = getAllRecords('firs');
    const targetFir = allFirs.find(f => f.firId === targetFirId);
    if (!targetFir) return res.status(404).json({ error: 'FIR not found' });
    const results = aiEngine.findSimilarCrimes(targetFir, allFirs);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/suspect-recommendation', (req, res) => {
  try {
    const { targetFirId } = req.body;
    const allFirs = getAllRecords('firs');
    const criminals = getAllRecords('criminals');
    const targetFir = allFirs.find(f => f.firId === targetFirId);
    if (!targetFir) return res.status(404).json({ error: 'FIR not found' });
    const results = aiEngine.recommendSuspects(targetFir, criminals, allFirs);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ai/hotspots', (req, res) => {
  try {
    const allFirs = getAllRecords('firs');
    const results = aiEngine.identifyHotspots(allFirs);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/priority', (req, res) => {
  try {
    const { targetFirId } = req.body;
    const allFirs = getAllRecords('firs');
    const evidence = getAllRecords('evidence');
    const cases = getAllRecords('cases');
    const targetFir = allFirs.find(f => f.firId === targetFirId);
    if (!targetFir) return res.status(404).json({ error: 'FIR not found' });
    const result = aiEngine.calculatePriority(targetFir, evidence, cases);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ai/network', (req, res) => {
  try {
    const criminals = getAllRecords('criminals');
    const result = aiEngine.analyzeNetwork(criminals);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GENERIC CRUD ROUTES ----
const VALID_TABLES = ['firs', 'cases', 'criminals', 'evidence', 'officers', 'crime_patterns'];

app.get('/api/:table', (req, res) => {
  const { table } = req.params;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  if (!checkPermission('read', res)) return;
  try {
    const records = getAllRecords(table);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  if (!checkPermission('read', res)) return;
  try {
    const record = getRecord(table, Number(id));
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:table', (req, res) => {
  const { table } = req.params;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  if (!checkPermission('create', res)) return;
  try {
    const id = addRecord(table, req.body, currentUser);
    res.status(201).json({ id, message: 'Created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  if (!checkPermission('update', res)) return;
  try {
    updateRecord(table, Number(id), req.body, currentUser);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  if (!checkPermission('delete', res)) return;
  try {
    deleteRecord(table, Number(id), currentUser);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- ERROR HANDLER ----
process.on('uncaughtException', (err) => {
  console.error('[CIRAS] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[CIRAS] Unhandled Rejection:', err);
});

// ---- START SERVER ----
app.listen(PORT, () => {
  console.log(`[CIRAS] Backend running on http://localhost:${PORT}`);
  console.log(`[CIRAS] SQLite database file: backend/db/ciras.db`);
});

