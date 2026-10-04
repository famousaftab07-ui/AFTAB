// AFTAB — pairing / control panel.
//
// Open the root URL, type a phone number, get a pairing code, link it from
// WhatsApp and the bot goes live for that number. One process, many sessions.

import express from 'express';
import basicAuth from 'express-basic-auth';
import { PORT, BOT_NAME, PANEL_USER, PANEL_PASS, MAX_SESSIONS } from './lib/config.js';
import { add, remove, summary, sessions, get } from './lib/manager.js';

export function startPanel(log = console.log) {
  const app = express();
  app.use(express.json());
  app.use(
    basicAuth({
      users: { [PANEL_USER]: PANEL_PASS },
      challenge: true,
      realm: BOT_NAME,
    }),
  );

  // Live snapshot used by the page.
  app.get('/sessions', (_req, res) => res.json(summary()));

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', bot: BOT_NAME, count: sessions.size, max: MAX_SESSIONS }),
  );

  // Start a new session. Returns a pairing code the user types into WhatsApp.
  app.post('/pair', async (req, res) => {
    try {
      const number = String(req.body?.number || '').replace(/[^0-9]/g, '');
      if (number.length < 8) return res.status(400).json({ error: 'enter a full phone number with country code' });
      const existing = sessions.get(number);
      if (existing && existing.online) {
        return res.status(409).json({ error: 'this number is already linked and online' });
      }
      // A session that is present but never came online is a half-finished
      // attempt; drop it so the user can ask for a fresh code.
      if (existing && !existing.online) {
        await remove(number);
      }

      const session = await add(number, { log });

      // WhatsApp only accepts a pairing request once the socket has finished
      // its handshake and shown a QR. Asking earlier closes the connection and
      // the code dies instantly. So wait for that moment, with a ceiling.
      const ready = await waitForSocketReady(session, 30000);
      if (!ready) {
        return res.status(504).json({
          error: 'WhatsApp did not answer in time — try again in a few seconds.',
        });
      }

      let code = null;
      try {
        code = await session.sock.requestPairingCode(number);
      } catch (err) {
        return res.status(500).json({ error: `could not create pairing code: ${err.message}` });
      }
      return res.json({ ok: true, number, code });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Unlink a session and delete its stored credentials.
  app.delete('/sessions/:number', async (req, res) => {
    const ok = await remove(req.params.number);
    return res.json({ ok });
  });

  app.get('/', (_req, res) => res.type('html').send(PAGE));

  const server = app.listen(PORT, () => log(`[panel] ${BOT_NAME} panel on http://0.0.0.0:${PORT}`));
  return server;
}

// Resolve as soon as the socket has a QR (handshake done) or is already open.
// Resolves false if it never gets there inside the ceiling.
function waitForSocketReady(session, timeoutMs = 30000) {
  if (session.online || session.qr) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (session.online || session.qr) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}

const PAGE = `<!doctype html><html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>AFTAB — WhatsApp Bot</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background:#0b0f14; color:#e6edf3; display:flex; justify-content:center; padding:32px 16px; }
  .wrap { width:100%; max-width:760px; }
  h1 { margin:0 0 4px; font-size:28px; letter-spacing:.5px; }
  .sub { color:#8b98a5; margin-bottom:24px; font-size:14px; }
  .card { background:#131a22; border:1px solid #22303c; border-radius:12px; padding:20px; margin-bottom:16px; }
  label { display:block; font-size:13px; color:#8b98a5; margin-bottom:6px; }
  .row { display:flex; gap:10px; flex-wrap:wrap; }
  input { flex:1; min-width:200px; padding:12px 14px; border-radius:8px; border:1px solid #2b3a47;
          background:#0e151c; color:#e6edf3; font-size:15px; }
  button { padding:12px 18px; border-radius:8px; border:0; background:#1f9c6b; color:#fff;
           font-weight:600; font-size:15px; cursor:pointer; }
  button.ghost { background:#243444; }
  button:hover { filter:brightness(1.1); }
  .code { font-size:30px; font-weight:700; letter-spacing:6px; margin-top:16px; color:#4ade80; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:9px 8px; border-bottom:1px solid #22303c; }
  th { color:#8b98a5; font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.6px; }
  .on { color:#4ade80; } .off { color:#f87171; }
  .hint { color:#8b98a5; font-size:13px; margin-top:14px; line-height:1.6; }
  code { background:#0e151c; padding:2px 6px; border-radius:5px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>AFTAB</h1>
  <div class="sub">Multi-Session WhatsApp Bot — link as many numbers as you like.</div>

  <div class="card">
    <label for="num">Phone number (with country code, digits only)</label>
    <div class="row">
      <input id="num" placeholder="923001234567" autocomplete="off" />
      <button onclick="pair()">Get pairing code</button>
    </div>
    <div id="out"></div>
    <div class="hint">
      In WhatsApp: <b>Settings &rarr; Linked devices &rarr; Link a device &rarr; Link with phone number</b>,
      then type the code above.
    </div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between;align-items:center">
      <b>Linked sessions</b>
      <button class="ghost" onclick="load()">Refresh</button>
    </div>
    <div id="list" style="margin-top:12px"></div>
  </div>
</div>

<script>
async function pair() {
  const number = document.getElementById('num').value.replace(/[^0-9]/g, '');
  const out = document.getElementById('out');
  if (number.length < 8) { out.innerHTML = '<div class="hint" style="color:#f87171">Enter a full number with country code.</div>'; return; }
  out.innerHTML = '<div class="hint">Creating pairing code…</div>';
  try {
    const r = await fetch('/pair', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ number }) });
    const d = await r.json();
    if (!r.ok) { out.innerHTML = '<div class="hint" style="color:#f87171">' + (d.error || 'failed') + '</div>'; return; }
    out.innerHTML = '<div class="hint">Type this on your phone:</div><div class="code">' + d.code + '</div>';
    load();
  } catch (e) {
    out.innerHTML = '<div class="hint" style="color:#f87171">' + e.message + '</div>';
  }
}

async function load() {
  try {
    const d = await (await fetch('/sessions')).json();
    const el = document.getElementById('list');
    if (!d.sessions.length) { el.innerHTML = '<div class="hint">No sessions linked yet.</div>'; return; }
    let h = '<table><tr><th>Number</th><th>Status</th><th>Messages</th><th></th></tr>';
    for (const s of d.sessions) {
      h += '<tr><td><code>' + s.number + '</code></td>' +
           '<td class="' + (s.online ? 'on' : 'off') + '">' + (s.online ? 'ONLINE' : 'OFFLINE') + '</td>' +
           '<td>' + s.messages + '</td>' +
           '<td><button class="ghost" onclick="unlink(\\'' + s.number + '\\')">Unlink</button></td></tr>';
    }
    h += '</table>';
    el.innerHTML = h;
  } catch (e) { /* panel still warming up */ }
}

async function unlink(number) {
  if (!confirm('Unlink ' + number + '?')) return;
  await fetch('/sessions/' + number, { method:'DELETE' });
  load();
}

load();
setInterval(load, 5000);
</script>
</body>
</html>`;
