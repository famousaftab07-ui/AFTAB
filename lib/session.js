// AFTAB — the per-session wrapper.
//
// One Session object == one linked WhatsApp account. It owns the socket,
// reconnects on drop, and hands every incoming message to the dispatcher.

import fs from 'node:fs';
import path from 'node:path';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { SESSION_DIR, PREFIX } from './config.js';
import { resolve } from './loader.js';
import { writeJson, nowStamp } from './helpers.js';

const silent = pino({ level: 'silent' });

// How many times we let a single session auto-reconnect before parking it.
const MAX_RECONNECTS = 12;

export class Session {
  constructor(number, opts = {}) {
    this.number = String(number);
    this.onUpdate = opts.onUpdate || (() => {});
    this.sock = null;
    this.online = false;
    this.startedAt = Date.now();
    this.connectedAt = null;
    this.reconnects = 0;
    this.lastError = null;
    this.qr = null;
    this.stopped = false;
    this.messages = 0;
    this.commands = 0;
    this.lastMessageAt = null;
    this.dir = path.join(SESSION_DIR, this.number);
  }

  get stats() {
    return {
      number: this.number,
      online: this.online,
      startedAt: this.startedAt,
      connectedAt: this.connectedAt,
      reconnects: this.reconnects,
      messages: this.messages,
      commands: this.commands,
      lastMessageAt: this.lastMessageAt,
      lastError: this.lastError,
      registered: this.isRegistered(),
      pending: !this.isRegistered(),
      paired: this.isRegistered(),
      hasQr: Boolean(this.qr),
    };
  }

  // True only when WhatsApp has actually confirmed this device. A pairing code
  // that was generated but never entered leaves `me` set with registered:false,
  // and that folder must never be reused.
  isRegistered() {
    try {
      const creds = JSON.parse(fs.readFileSync(path.join(this.dir, 'creds.json'), 'utf8'));
      return creds?.registered === true;
    } catch {
      return false;
    }
  }

  // Delete this session's stored credentials. Called when WhatsApp logs the
  // device out and when a half-finished pairing is discarded — leaving either
  // on disk poisons every later attempt for this number.
  deleteCreds() {
    try {
      fs.rmSync(this.dir, { recursive: true, force: true });
    } catch {
      /* nothing to remove */
    }
  }

  async start() {
    this.stopped = false;
    fs.mkdirSync(this.dir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(this.dir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    this.sock = makeWASocket({
      version,
      logger: silent,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silent),
      },
      // Browsers.ubuntu('Chrome') is the label Baileys itself uses and the one
      // WhatsApp is known to accept. A made-up label produces pairing codes
      // that die on arrival, so keep the standard one.
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      // Give the handshake room on slow/cloud networks. Without these a cold
      // dyno can time out before WhatsApp ever answers.
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        this.qr = qr;
        this.onUpdate(this);
      }

      if (connection === 'open') {
        this.online = true;
        this.qr = null;
        this.connectedAt = Date.now();
        this.reconnects = 0;
        this.lastError = null;
        // A newly-linked account often has the phone number only known after
        // the handshake, so refresh the label once we are open.
        try {
          const me = this.sock.user;
          if (me?.id) this.number = jidNormalizedUser(me.id).split('@')[0];
        } catch {
          /* keep the directory label */
        }
        this.onUpdate(this);
      }

      if (connection === 'close') {
        this.online = false;
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        this.lastError = lastDisconnect?.error?.message || `closed (${code})`;
        this.onUpdate(this);

        if (this.stopped) return;

        if (code === DisconnectReason.loggedOut) {
          // The user unlinked the device from their phone. The credentials in
          // this folder are now dead: if we keep them, the next start tries to
          // LOG IN with a dead device instead of showing a QR, and every future
          // pairing attempt for this number fails. Delete them and stop.
          this.stopped = true;
          this.deleteCreds();
          this.onUpdate(this);
          return;
        }

        // 401 on a folder that was never registered means the same thing: a
        // half-written pairing left `me` set without a real link. Loading it
        // again can only fail, so clear it and let the next attempt start clean.
        if (code === 401 && !this.isRegistered()) {
          this.stopped = true;
          this.deleteCreds();
          this.onUpdate(this);
          return;
        }

        if (this.reconnects >= MAX_RECONNECTS) {
          this.stopped = true;
          this.onUpdate(this);
          return;
        }

        this.reconnects += 1;
        const wait = Math.min(3000 * this.reconnects, 20000);
        setTimeout(() => {
          if (!this.stopped) this.start().catch((e) => {
            this.lastError = e.message;
            this.onUpdate(this);
          });
        }, wait);
      }
    });

    this.sock.ev.on('messages.upsert', (payload) => {
      this.handleUpsert(payload).catch(() => {});
    });

    return this;
  }

  async handleUpsert({ messages, type }) {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      if (!from || from === 'status@broadcast') continue;

      const text = extractText(msg.message);
      if (!text) continue;

      this.messages += 1;
      this.lastMessageAt = Date.now();

      if (!text.startsWith(PREFIX)) continue;

      const body = text.slice(PREFIX.length).trim();
      const [word, ...args] = body.split(/\s+/);
      const plugin = resolve(word);
      if (!plugin) continue;

      this.commands += 1;
      const ctx = this.makeContext({ msg, from, word: word.toLowerCase(), args, text });
      try {
        await plugin.run(ctx);
      } catch (err) {
        this.lastError = `${word}: ${err.message}`;
        try {
          await this.sock.sendMessage(from, { text: `⚠️ ${word} failed: ${err.message}` });
        } catch {
          /* the socket may already be gone */
        }
      }
      this.onUpdate(this);
    }
  }

  // Everything a plugin is allowed to touch.
  makeContext({ msg, from, word, args, text }) {
    const self = this;
    return {
      session: self,
      sock: self.sock,
      msg,
      from,
      word,
      args,
      text,
      sender: msg.key.participant || from,
      isGroup: String(from).endsWith('@g.us'),
      prefix: PREFIX,
      async reply(content) {
        return self.sock.sendMessage(from, typeof content === 'string' ? { text: content } : content, {
          quoted: msg,
        });
      },
      async send(content) {
        return self.sock.sendMessage(from, typeof content === 'string' ? { text: content } : content);
      },
    };
  }

  // Stop this session locally.
  //
  // `unlink: true` also tells WhatsApp to log the device out (used only when
  // the user explicitly unlinks). The default NEVER calls logout: stopping or
  // restarting a session must not remove a working device from the user's
  // phone. A previous version logged out on every stop, which silently
  // unlinked valid numbers.
  async stop({ unlink = false } = {}) {
    this.stopped = true;
    this.online = false;
    if (unlink) {
      try {
        await this.sock?.logout?.();
      } catch {
        /* already unlinked on WhatsApp's side */
      }
    }
    try {
      this.sock?.end?.(undefined);
    } catch {
      /* socket already closed */
    }
    this.onUpdate(this);
  }
}

// Pull plain text out of the many message shapes WhatsApp uses.
export function extractText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

export function saveSessionIndex(sessions) {
  const index = [...sessions.values()].map((s) => s.stats);
  writeJson(path.join(SESSION_DIR, 'index.json'), { updated: nowStamp(), sessions: index });
  return index;
}
