// AFTAB — the session manager.
//
// Keeps a Map of number -> Session. On boot it restores every *registered*
// session already present in ./session, so a restart reconnects linked
// accounts without anyone re-scanning a QR code.
//
// Folders that were never actually linked (a pairing code was generated but
// never entered in WhatsApp) are deleted on boot. Loading one of those makes
// the socket try to LOG IN with a dead device instead of showing a QR, which
// poisons every later attempt for that number.

import fs from 'node:fs';
import path from 'node:path';
import { Session, saveSessionIndex } from './session.js';
import { SESSION_DIR, MAX_SESSIONS } from './config.js';

export const sessions = new Map();

// Numbers currently being paired. Guards against a second request (or a double
// click) tearing down the socket of a pairing that is still in flight.
export const pairingInFlight = new Set();

function onChange() {
  saveSessionIndex(sessions);
}

function credsFile(dir) {
  return path.join(dir, 'creds.json');
}

function isRegisteredDir(dir) {
  try {
    const creds = JSON.parse(fs.readFileSync(credsFile(dir), 'utf8'));
    return creds?.registered === true;
  } catch {
    return false;
  }
}

// Every sub-directory holding REGISTERED credentials is a linked account.
export function discoverOnDisk() {
  if (!fs.existsSync(SESSION_DIR)) return [];
  return fs
    .readdirSync(SESSION_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((n) => isRegisteredDir(path.join(SESSION_DIR, n)));
}

// Delete folders that hold half-finished pairings. Without this a dead folder
// survives a restart and blocks the number forever.
export function sweepDeadFolders(log = console.log) {
  if (!fs.existsSync(SESSION_DIR)) return [];
  const removed = [];
  for (const e of fs.readdirSync(SESSION_DIR, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const dir = path.join(SESSION_DIR, e.name);
    if (fs.existsSync(credsFile(dir)) && !isRegisteredDir(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(e.name);
    }
  }
  if (removed.length) log(`[sessions] cleared ${removed.length} unfinished pairing(s): ${removed.join(', ')}`);
  return removed;
}

export async function restoreAll(log = console.log) {
  sweepDeadFolders(log);
  const found = discoverOnDisk();
  if (!found.length) {
    log('[sessions] no linked sessions on disk yet');
    return [];
  }
  log(`[sessions] restoring ${found.length}: ${found.join(', ')}`);
  for (const number of found) {
    await add(number, { log, restore: true });
  }
  return found;
}

export async function add(number, { log = console.log, restore = false } = {}) {
  const key = String(number).replace(/[^0-9]/g, '');
  if (!key) throw new Error('session number must be digits only');
  if (sessions.has(key)) return sessions.get(key);
  if (sessions.size >= MAX_SESSIONS) throw new Error(`session limit reached (${MAX_SESSIONS})`);

  const session = new Session(key, { onUpdate: onChange });
  sessions.set(key, session);
  await session.start();
  log(`[sessions] ${restore ? 'restored' : 'started'} ${key}`);
  onChange();
  return session;
}

export function get(number) {
  return sessions.get(String(number).replace(/[^0-9]/g, ''));
}

// Drop a session locally. `unlink` decides whether WhatsApp is also told to log
// the device out — only pass it when the user asked to unlink. Credentials are
// deleted either way, because a half-finished pairing must never be reused.
export async function remove(number, { unlink = false } = {}) {
  const key = String(number).replace(/[^0-9]/g, '');
  const session = sessions.get(key);
  if (session) {
    await session.stop({ unlink });
    session.deleteCreds();
    sessions.delete(key);
  } else {
    // Not in memory — still clear whatever is on disk for this number.
    fs.rmSync(path.join(SESSION_DIR, key), { recursive: true, force: true });
  }
  pairingInFlight.delete(key);
  onChange();
  return true;
}

export function list() {
  return [...sessions.values()].map((s) => s.stats);
}

export function summary() {
  const all = list();
  return {
    bot: 'AFTAB',
    count: all.length,
    online: all.filter((s) => s.online).length,
    linked: all.filter((s) => s.registered).length,
    pending: all.filter((s) => !s.registered).length,
    max: MAX_SESSIONS,
    sessions: all,
  };
}
