// AFTAB — the session manager.
//
// Keeps a Map of number -> Session. On boot it restores every folder already
// present in ./session, so a restart after a Heroku dyno cycle reconnects all
// linked accounts without anyone re-scanning a QR code.

import fs from 'node:fs';
import path from 'node:path';
import { Session, saveSessionIndex } from './session.js';
import { SESSION_DIR, MAX_SESSIONS } from './config.js';

export const sessions = new Map();

function onChange() {
  saveSessionIndex(sessions);
}

// Every sub-directory that holds a creds.json is a linked account.
export function discoverOnDisk() {
  if (!fs.existsSync(SESSION_DIR)) return [];
  return fs
    .readdirSync(SESSION_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((n) => fs.existsSync(path.join(SESSION_DIR, n, 'creds.json')));
}

export async function restoreAll(log = console.log) {
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

export async function remove(number) {
  const key = String(number).replace(/[^0-9]/g, '');
  const session = sessions.get(key);
  if (!session) return false;
  await session.stop();
  sessions.delete(key);
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
    max: MAX_SESSIONS,
    sessions: all,
  };
}
