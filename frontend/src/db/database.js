// ============================================================
// Frontend API Layer — Crime Investigation System
// Wraps fetch() calls to the Express/SQLite backend
// Same exported function signatures as the original database.js
// so no component changes are needed.
// ============================================================

const API_BASE = '/api';

// ---- DATABASE INITIALIZATION ----
// No-op on the frontend; the backend handles DB init and seeding.
export async function initDB() {
  return true;
}

export async function seedDatabase() {
  return true;
}

// ---- ROLE-BASED ACCESS CONTROL ----
let currentRole = 'Admin';
let currentUser = 'Officer Admin';

export function setCurrentRole(role) {
  currentRole = role;
  // Sync to backend
  fetch(`${API_BASE}/auth/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  }).catch(() => {});
}

export function getCurrentRole() {
  return currentRole;
}

export function setCurrentUser(user) {
  currentUser = user;
  fetch(`${API_BASE}/auth/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user }),
  }).catch(() => {});
}

export function getCurrentUser() {
  return currentUser;
}

// ---- GENERIC CRUD ----

export async function getAllRecords(storeName) {
  const res = await fetch(`${API_BASE}/${storeName}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch ${storeName}`);
  }
  return res.json();
}

export async function getRecord(storeName, id) {
  const res = await fetch(`${API_BASE}/${storeName}/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Not found');
  }
  return res.json();
}

export async function addRecord(storeName, data) {
  const res = await fetch(`${API_BASE}/${storeName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Create failed');
  }
  const result = await res.json();
  return result.id;
}

export async function updateRecord(storeName, data) {
  // Determine ID key based on store name
  const keyMap = {
    firs: 'firId', cases: 'caseId', criminals: 'criminalId',
    evidence: 'evidenceId', officers: 'officerId', crime_patterns: 'patternId',
  };
  const keyCol = keyMap[storeName] || 'id';
  const id = data[keyCol];
  
  const res = await fetch(`${API_BASE}/${storeName}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Update failed');
  }
  return id;
}

export async function deleteRecord(storeName, id) {
  const res = await fetch(`${API_BASE}/${storeName}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Delete failed');
  }
}

export async function getRecordsByIndex(storeName, indexName, value) {
  // For now, fetch all and filter client-side (simple approach)
  const all = await getAllRecords(storeName);
  return all.filter(record => record[indexName.replace('by_', '')] === value);
}

export async function getAuditLogs() {
  const res = await fetch(`${API_BASE}/audit-logs/all`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch logs');
  }
  return res.json();
}

export function clearDatabase() {
  // Not typically needed from frontend
  return Promise.resolve();
}
