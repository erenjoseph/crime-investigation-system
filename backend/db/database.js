// ============================================================
// SQLite Database Layer — Crime Investigation System
// Uses better-sqlite3 for real SQLite database (ciras.db)
// Implements: normalization, indexing, triggers, audit logging
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ciras.db');
let db = null;

// ---- INITIALIZE DATABASE ----
function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');

  // Create all tables
  db.exec(`
    -- Officers Table
    CREATE TABLE IF NOT EXISTS officers (
      officerId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rank TEXT,
      department TEXT,
      role TEXT CHECK(role IN ('Admin','Investigator','Analyst','Viewer')),
      createdAt TEXT DEFAULT (datetime('now'))
    );

    -- FIRs Table
    CREATE TABLE IF NOT EXISTS firs (
      firId INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT,
      location TEXT NOT NULL,
      crimeType TEXT NOT NULL,
      description TEXT,
      complainant TEXT,
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open','Under Investigation','Resolved','Closed')),
      officerId INTEGER REFERENCES officers(officerId),
      severity TEXT CHECK(severity IN ('Low','Medium','High','Critical')),
      method TEXT,
      lat REAL,
      lng REAL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT
    );

    -- Cases Table
    CREATE TABLE IF NOT EXISTS cases (
      caseId INTEGER PRIMARY KEY AUTOINCREMENT,
      firId INTEGER NOT NULL REFERENCES firs(firId),
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Closed','Suspended')),
      priority TEXT CHECK(priority IN ('Low','Medium','High','Critical')),
      assignedOfficer TEXT,
      createdDate TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT
    );

    -- Criminals Table
    CREATE TABLE IF NOT EXISTS criminals (
      criminalId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      aliases TEXT,
      knownAddress TEXT,
      crimeHistory TEXT,
      priorConvictions INTEGER DEFAULT 0,
      riskLevel TEXT CHECK(riskLevel IN ('Low','Medium','High')),
      status TEXT,
      relatedCases TEXT,
      associates TEXT,
      photo TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT
    );

    -- Evidence Table
    CREATE TABLE IF NOT EXISTS evidence (
      evidenceId INTEGER PRIMARY KEY AUTOINCREMENT,
      caseId INTEGER REFERENCES cases(caseId),
      type TEXT,
      description TEXT,
      collectedBy TEXT,
      collectedDate TEXT,
      location TEXT,
      chainOfCustody TEXT,
      status TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      logId INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT,
      userId TEXT,
      details TEXT
    );

    -- Crime Patterns Table
    CREATE TABLE IF NOT EXISTS crime_patterns (
      patternId INTEGER PRIMARY KEY AUTOINCREMENT,
      crimeType TEXT,
      location TEXT,
      timeOfDay TEXT,
      method TEXT,
      frequency INTEGER DEFAULT 0,
      riskScore REAL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for fast lookups
    CREATE INDEX IF NOT EXISTS idx_firs_crimeType ON firs(crimeType);
    CREATE INDEX IF NOT EXISTS idx_firs_status ON firs(status);
    CREATE INDEX IF NOT EXISTS idx_firs_date ON firs(date);
    CREATE INDEX IF NOT EXISTS idx_firs_location ON firs(location);
    CREATE INDEX IF NOT EXISTS idx_firs_officerId ON firs(officerId);
    CREATE INDEX IF NOT EXISTS idx_cases_firId ON cases(firId);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_criminals_riskLevel ON criminals(riskLevel);
    CREATE INDEX IF NOT EXISTS idx_evidence_caseId ON evidence(caseId);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);
    CREATE INDEX IF NOT EXISTS idx_patterns_crimeType ON crime_patterns(crimeType);
  `);

  console.log('[DB] SQLite database initialized at', DB_PATH);
  return db;
}

// ---- AUDIT LOG TRIGGER ----
function createAuditLog(action, entity, entityId, userId, details) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (action, entity, entityId, userId, details)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(action, entity, String(entityId), userId || 'System', 
           typeof details === 'string' ? details : JSON.stringify(details));
}

// ---- GENERIC CRUD ----

function getAllRecords(table) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  // Parse JSON fields for criminals
  if (table === 'criminals') {
    return rows.map(r => ({
      ...r,
      crimeHistory: parseJSON(r.crimeHistory),
      relatedCases: parseJSON(r.relatedCases),
      associates: parseJSON(r.associates),
    }));
  }
  if (table === 'evidence') {
    return rows.map(r => ({
      ...r,
      chainOfCustody: parseJSON(r.chainOfCustody),
    }));
  }
  return rows;
}

function getRecord(table, id) {
  const keyCol = getKeyColumn(table);
  const row = db.prepare(`SELECT * FROM ${table} WHERE ${keyCol} = ?`).get(id);
  if (!row) return null;
  if (table === 'criminals') {
    row.crimeHistory = parseJSON(row.crimeHistory);
    row.relatedCases = parseJSON(row.relatedCases);
    row.associates = parseJSON(row.associates);
  }
  if (table === 'evidence') {
    row.chainOfCustody = parseJSON(row.chainOfCustody);
  }
  return row;
}

function addRecord(table, data, userId) {
  const d = prepareData(table, data);
  const cols = Object.keys(d);
  const placeholders = cols.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
  const result = stmt.run(...Object.values(d));
  const id = result.lastInsertRowid;
  createAuditLog('CREATE', table, id, userId, data);
  return id;
}

function updateRecord(table, id, data, userId) {
  const keyCol = getKeyColumn(table);
  const d = prepareData(table, { ...data, updatedAt: new Date().toISOString() });
  delete d[keyCol]; // don't update the PK
  const sets = Object.keys(d).map(k => `${k} = ?`).join(', ');
  const stmt = db.prepare(`UPDATE ${table} SET ${sets} WHERE ${keyCol} = ?`);
  stmt.run(...Object.values(d), id);
  createAuditLog('UPDATE', table, id, userId, data);
}

function deleteRecord(table, id, userId) {
  const keyCol = getKeyColumn(table);
  db.prepare(`DELETE FROM ${table} WHERE ${keyCol} = ?`).run(id);
  createAuditLog('DELETE', table, id, userId, { deleted: true });
}

function getAuditLogs() {
  return db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC').all();
}

// ---- HELPERS ----

function getKeyColumn(table) {
  const map = {
    firs: 'firId', cases: 'caseId', criminals: 'criminalId',
    evidence: 'evidenceId', officers: 'officerId',
    audit_logs: 'logId', crime_patterns: 'patternId',
  };
  return map[table] || 'id';
}

function parseJSON(val) {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function prepareData(table, data) {
  const d = { ...data };
  // Serialize arrays to JSON strings for SQLite storage
  if (table === 'criminals') {
    if (Array.isArray(d.crimeHistory)) d.crimeHistory = JSON.stringify(d.crimeHistory);
    if (Array.isArray(d.relatedCases)) d.relatedCases = JSON.stringify(d.relatedCases);
    if (Array.isArray(d.associates)) d.associates = JSON.stringify(d.associates);
  }
  if (table === 'evidence') {
    if (Array.isArray(d.chainOfCustody)) d.chainOfCustody = JSON.stringify(d.chainOfCustody);
  }
  return d;
}

// ---- SEED DATA ----
function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM firs').get().cnt;
  if (count > 0) { console.log('[DB] Already seeded'); return; }

  console.log('[DB] Seeding Kerala crime data...');

  const insertTx = db.transaction(() => {
    // Officers
    const officers = [
      { name: 'CI Arun Krishnan', rank: 'Circle Inspector', department: 'Crime Branch', role: 'Admin' },
      { name: 'SI Lakshmi Nair', rank: 'Sub Inspector', department: 'Cyber Crime', role: 'Investigator' },
      { name: 'SI Manoj Pillai', rank: 'Sub Inspector', department: 'Homicide', role: 'Investigator' },
      { name: 'CPO Akhil Rajan', rank: 'Civil Police Officer', department: 'Patrol', role: 'Viewer' },
      { name: 'Dr. Sreelakshmi Menon', rank: 'Forensic Analyst', department: 'FSL Thiruvananthapuram', role: 'Analyst' },
    ];
    const addOfficer = db.prepare('INSERT INTO officers (name, rank, department, role) VALUES (?, ?, ?, ?)');
    officers.forEach(o => addOfficer.run(o.name, o.rank, o.department, o.role));

    // FIRs
    const firs = [
      { date: '2026-01-10', time: '22:45', location: 'MG Road, Ernakulam', crimeType: 'Robbery', description: 'Armed robbery at a gold jewellery showroom in MG Road. Three suspects entered with covered faces and escaped with 2kg gold in a black car.', complainant: 'Suresh Menon', status: 'Under Investigation', officerId: 1, severity: 'Critical', method: 'Armed', lat: 9.9816, lng: 76.2999 },
      { date: '2026-01-18', time: '03:00', location: 'Pattom, Thiruvananthapuram', crimeType: 'Burglary', description: 'House break-in while family was away for a wedding. Laptops, cash, and gold ornaments stolen.', complainant: 'Anitha Kumari', status: 'Open', officerId: 2, severity: 'Medium', method: 'Break-in', lat: 8.5242, lng: 76.9300 },
      { date: '2026-01-25', time: '14:30', location: 'Kozhikode Beach, Kozhikode', crimeType: 'Fraud', description: 'Online loan fraud targeting fishermen community. Victims lost 8 lakh through fake loan apps.', complainant: 'Rashid K.', status: 'Open', officerId: 2, severity: 'High', method: 'Phishing', lat: 11.2588, lng: 75.7804 },
      { date: '2026-02-02', time: '21:00', location: 'Thrissur Round, Thrissur', crimeType: 'Assault', description: 'Group clash near Swaraj Round during festival season. Three people injured. Weapons recovered.', complainant: 'Pradeep Kumar', status: 'Resolved', officerId: 3, severity: 'High', method: 'Physical', lat: 10.5276, lng: 76.2144 },
      { date: '2026-02-08', time: '07:30', location: 'Edappally, Ernakulam', crimeType: 'Robbery', description: 'Chain snatching near Lulu Mall. Suspect fled on a motorcycle towards Aluva.', complainant: 'Geetha Nambiar', status: 'Under Investigation', officerId: 1, severity: 'Medium', method: 'Snatching', lat: 10.0261, lng: 76.3125 },
      { date: '2026-02-12', time: '02:00', location: 'Palakkad Town, Palakkad', crimeType: 'Burglary', description: 'Break-in at Cooperative Bank branch. Locker room accessed. Loss estimated at 25 lakh.', complainant: 'Bank Manager', status: 'Open', officerId: 3, severity: 'Critical', method: 'Break-in', lat: 10.7867, lng: 76.6548 },
      { date: '2026-02-18', time: '11:00', location: 'Technopark, Thiruvananthapuram', crimeType: 'Cybercrime', description: 'Data breach at an IT company. Employee data of 10,000 people leaked on dark web. Ransomware suspected.', complainant: 'InfoTech Solutions', status: 'Open', officerId: 2, severity: 'Critical', method: 'Ransomware', lat: 8.5568, lng: 76.8816 },
      { date: '2026-02-22', time: '19:30', location: 'Kannur Town, Kannur', crimeType: 'Assault', description: 'Political clash between rival groups. Two persons hospitalised with stab injuries.', complainant: 'Anonymous', status: 'Under Investigation', officerId: 3, severity: 'High', method: 'Physical', lat: 11.8745, lng: 75.3704 },
      { date: '2026-02-28', time: '01:30', location: 'Fort Kochi, Ernakulam', crimeType: 'Robbery', description: 'Tourist robbed at knifepoint near the Chinese fishing nets. Passport, phone, and wallet stolen.', complainant: 'James Wilson (Tourist)', status: 'Open', officerId: 1, severity: 'High', method: 'Armed', lat: 9.9639, lng: 76.2423 },
      { date: '2026-03-01', time: '16:00', location: 'Kottayam Town, Kottayam', crimeType: 'Fraud', description: 'Real estate fraud involving forged land documents. Multiple families cheated. Total loss over 1 crore.', complainant: 'Multiple Complainants', status: 'Open', officerId: 2, severity: 'Critical', method: 'Investment Scam', lat: 9.5916, lng: 76.5222 },
    ];
    const addFir = db.prepare('INSERT INTO firs (date, time, location, crimeType, description, complainant, status, officerId, severity, method, lat, lng) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    firs.forEach(f => addFir.run(f.date, f.time, f.location, f.crimeType, f.description, f.complainant, f.status, f.officerId, f.severity, f.method, f.lat, f.lng));

    // Cases
    const cases = [
      { firId: 1, status: 'Active', priority: 'Critical', assignedOfficer: 'CI Arun Krishnan', createdDate: '2026-01-11', notes: 'CCTV footage from nearby shops collected. Vehicle number partially traced.' },
      { firId: 2, status: 'Active', priority: 'Medium', assignedOfficer: 'SI Lakshmi Nair', createdDate: '2026-01-19', notes: 'Fingerprints collected. Checking with DCRB records.' },
      { firId: 3, status: 'Active', priority: 'High', assignedOfficer: 'SI Lakshmi Nair', createdDate: '2026-01-26', notes: 'Fake app server traced to another state. Coordinating with Cyber Police.' },
      { firId: 4, status: 'Closed', priority: 'High', assignedOfficer: 'SI Manoj Pillai', createdDate: '2026-02-03', notes: 'Six arrested. Weapons seized under Arms Act.' },
      { firId: 5, status: 'Active', priority: 'Medium', assignedOfficer: 'CI Arun Krishnan', createdDate: '2026-02-09', notes: 'ANPR camera data obtained. Tracking suspect vehicle.' },
      { firId: 7, status: 'Active', priority: 'Critical', assignedOfficer: 'SI Lakshmi Nair', createdDate: '2026-02-19', notes: 'CERT-In notified. Digital forensics team from TVM deployed.' },
      { firId: 9, status: 'Active', priority: 'High', assignedOfficer: 'CI Arun Krishnan', createdDate: '2026-02-28', notes: 'Sketch prepared from tourist description. Port alert issued.' },
    ];
    const addCase = db.prepare('INSERT INTO cases (firId, status, priority, assignedOfficer, createdDate, notes) VALUES (?,?,?,?,?,?)');
    cases.forEach(c => addCase.run(c.firId, c.status, c.priority, c.assignedOfficer, c.createdDate, c.notes));

    // Criminals
    const criminals = [
      { name: 'Vijayan Kutty', age: 38, gender: 'Male', aliases: 'Viji, Gold Viji', knownAddress: 'Mattancherry, Kochi', crimeHistory: JSON.stringify(['Robbery', 'Assault']), priorConvictions: 3, riskLevel: 'High', status: 'Wanted', relatedCases: JSON.stringify([1, 5]), associates: JSON.stringify([2]), photo: '', notes: 'Notorious chain snatcher and gold robber. Known to operate in Ernakulam district.' },
      { name: 'Shaji Mathew', age: 31, gender: 'Male', aliases: 'Shaji Pappan', knownAddress: 'Aluva, Ernakulam', crimeHistory: JSON.stringify(['Robbery', 'Burglary']), priorConvictions: 2, riskLevel: 'High', status: 'Active', relatedCases: JSON.stringify([1, 5]), associates: JSON.stringify([1, 3]), photo: '', notes: 'Part of a robbery gang. Skilled at disabling security systems.' },
      { name: 'Ravi Varma', age: 44, gender: 'Male', aliases: 'Locker Ravi', knownAddress: 'Palakkad Town', crimeHistory: JSON.stringify(['Burglary', 'Fraud']), priorConvictions: 4, riskLevel: 'High', status: 'Wanted', relatedCases: JSON.stringify([2, 6]), associates: JSON.stringify([2]), photo: '', notes: 'Expert in bank burglaries. Uses gas cutters and power tools. Previously jailed in Viyyur Central Jail.' },
      { name: 'Deepa Krishnan', age: 29, gender: 'Female', aliases: 'Cyber Deepa', knownAddress: 'Kazhakkoottam, TVM', crimeHistory: JSON.stringify(['Fraud', 'Cybercrime']), priorConvictions: 0, riskLevel: 'Medium', status: 'Under Surveillance', relatedCases: JSON.stringify([3]), associates: JSON.stringify([5]), photo: '', notes: 'Suspected involvement in phishing operations targeting Kerala banks.' },
      { name: 'Anoop Das', age: 26, gender: 'Male', aliases: 'Dark Anoop', knownAddress: 'Technopark, TVM', crimeHistory: JSON.stringify(['Cybercrime', 'Fraud']), priorConvictions: 1, riskLevel: 'High', status: 'Active', relatedCases: JSON.stringify([7]), associates: JSON.stringify([4]), photo: '', notes: 'Skilled hacker. Arrested previously for accessing government databases.' },
    ];
    const addCriminal = db.prepare('INSERT INTO criminals (name, age, gender, aliases, knownAddress, crimeHistory, priorConvictions, riskLevel, status, relatedCases, associates, photo, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    criminals.forEach(c => addCriminal.run(c.name, c.age, c.gender, c.aliases, c.knownAddress, c.crimeHistory, c.priorConvictions, c.riskLevel, c.status, c.relatedCases, c.associates, c.photo, c.notes));

    // Evidence
    const evidenceItems = [
      { caseId: 1, type: 'Physical', description: 'Crowbar used to break display case', collectedBy: 'SI Manoj Pillai', collectedDate: '2026-01-11', location: 'Crime scene, MG Road', chainOfCustody: JSON.stringify(['SI Manoj Pillai → Evidence Room → Dr. Sreelakshmi Menon']), status: 'In Lab' },
      { caseId: 1, type: 'Digital', description: 'CCTV footage from nearby textile shop', collectedBy: 'SI Lakshmi Nair', collectedDate: '2026-01-11', location: 'Adjacent shops', chainOfCustody: JSON.stringify(['SI Lakshmi Nair → Digital Forensics Wing']), status: 'Under Analysis' },
      { caseId: 2, type: 'Physical', description: 'Fingerprints from windowsill and almirah handle', collectedBy: 'Dr. Sreelakshmi Menon', collectedDate: '2026-01-20', location: 'Crime scene', chainOfCustody: JSON.stringify(['Dr. Sreelakshmi Menon → FSL Thiruvananthapuram']), status: 'In Lab' },
      { caseId: 3, type: 'Digital', description: 'Fake loan app APK and phishing URLs', collectedBy: 'SI Lakshmi Nair', collectedDate: '2026-01-27', location: 'Victim devices', chainOfCustody: JSON.stringify(['SI Lakshmi Nair → Cyber Police Station TVM']), status: 'Under Analysis' },
      { caseId: 4, type: 'Physical', description: 'Knife and iron rod recovered from scene', collectedBy: 'CPO Akhil Rajan', collectedDate: '2026-02-03', location: 'Swaraj Round', chainOfCustody: JSON.stringify(['CPO Akhil Rajan → SI Manoj Pillai → Sessions Court Thrissur']), status: 'Submitted to Court' },
      { caseId: 7, type: 'Digital', description: 'Hard drive images and network logs from compromised servers', collectedBy: 'Dr. Sreelakshmi Menon', collectedDate: '2026-02-19', location: 'Technopark office', chainOfCustody: JSON.stringify(['Dr. Sreelakshmi Menon → Cyber Forensics Lab']), status: 'Under Analysis' },
    ];
    const addEvidence = db.prepare('INSERT INTO evidence (caseId, type, description, collectedBy, collectedDate, location, chainOfCustody, status) VALUES (?,?,?,?,?,?,?,?)');
    evidenceItems.forEach(e => addEvidence.run(e.caseId, e.type, e.description, e.collectedBy, e.collectedDate, e.location, e.chainOfCustody, e.status));

    // Crime Patterns
    const patterns = [
      { crimeType: 'Robbery', location: 'Ernakulam', timeOfDay: 'Night', method: 'Armed', frequency: 12, riskScore: 8.0 },
      { crimeType: 'Burglary', location: 'Thiruvananthapuram', timeOfDay: 'Night', method: 'Break-in', frequency: 9, riskScore: 7.0 },
      { crimeType: 'Fraud', location: 'Kozhikode', timeOfDay: 'Day', method: 'Phishing', frequency: 18, riskScore: 6.5 },
      { crimeType: 'Cybercrime', location: 'Thiruvananthapuram', timeOfDay: 'Any', method: 'Ransomware', frequency: 5, riskScore: 9.0 },
      { crimeType: 'Assault', location: 'Thrissur', timeOfDay: 'Night', method: 'Physical', frequency: 14, riskScore: 6.0 },
      { crimeType: 'Robbery', location: 'Ernakulam', timeOfDay: 'Morning', method: 'Snatching', frequency: 20, riskScore: 5.5 },
      { crimeType: 'Fraud', location: 'Kottayam', timeOfDay: 'Day', method: 'Investment Scam', frequency: 7, riskScore: 7.5 },
      { crimeType: 'Assault', location: 'Kannur', timeOfDay: 'Evening', method: 'Physical', frequency: 10, riskScore: 7.0 },
    ];
    const addPattern = db.prepare('INSERT INTO crime_patterns (crimeType, location, timeOfDay, method, frequency, riskScore) VALUES (?,?,?,?,?,?)');
    patterns.forEach(p => addPattern.run(p.crimeType, p.location, p.timeOfDay, p.method, p.frequency, p.riskScore));
  });

  insertTx();
  console.log('[DB] Seeded with Kerala crime data');
}

// ---- EXPORTS ----
module.exports = {
  initDB,
  seedDatabase,
  getAllRecords,
  getRecord,
  addRecord,
  updateRecord,
  deleteRecord,
  getAuditLogs,
  getDB: () => db,
};
