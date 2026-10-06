# AFTAB — Multi-Session WhatsApp Bot

One server. Many WhatsApp sessions. Link a number, the bot goes live for it.

AFTAB is a Node.js WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys).
You deploy it **once**, open its pairing page, and link as many WhatsApp numbers as you
want. Every linked number gets its own session inside the same running bot — no second
deploy, no second server.

---

## Deploy to Heroku in one click

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/famousaftab07-ui/AFTAB)

Click the button, give the app a name, hit **Deploy**. When it finishes, open the app URL —
that is your pairing page.

This repo ships with everything the Heroku **container** stack needs:

- `heroku.yml` — tells Heroku to build `Dockerfile` for the `web` process. Without it a
  container-stack app has no build target and the deploy fails before the app boots.
- `Dockerfile` — builds the image and creates `/app/session` writable for the non-root user
  Heroku runs containers as.
- `app.json` — sets the deploy defaults. It deliberately does **not** set `PORT`, because
  Heroku assigns `PORT` itself; hardcoding it causes an `R10` boot timeout.

> **First thing after deploying:** set `PANEL_PASS` in the app's **Config Vars** to something
> private. The default password is `aftab`, and the pairing page is public.

### If the deploy fails

| Symptom in `heroku logs --tail` | Cause | Fix |
|---|---|---|
| `R10` / `H10` boot timeout, app never opens | The app did not bind to the port Heroku assigned | The app reads `process.env.PORT` and binds `0.0.0.0` — make sure you did not set `PORT` yourself in Config Vars (`heroku config:unset PORT`) |
| `EACCES: permission denied, open 'session/...'` | The session folder is owned by root but Heroku runs the container as non-root | Already handled: the image chmods `/app/session` to `777`. Redeploy so the new image is used |
| `Your app does not include a heroku.yml build manifest` | The branch you deployed has no `heroku.yml`, so the container stack has nothing to build | Make sure `heroku.yml` is on the branch you push (it is on `main`) |
| `App not compatible with buildpack` / no buildpack detected | The app is not on the container stack, so Heroku tried buildpacks | `heroku stack:set container --app your-app-name`, then redeploy |
| Sessions disappear after a restart | Heroku's filesystem is ephemeral | Re-link, or point `SESSION_DIR` at an attached store (see below) |

### Manual deploy (Heroku CLI)

```bash
heroku login
heroku create your-app-name --stack container      # the container stack is required
heroku config:set PANEL_PASS='pick-something-private' --app your-app-name
git push heroku main
heroku logs --tail --app your-app-name
```

Then open the app URL: `heroku open --app your-app-name`.

---

## Run it locally

```bash
git clone https://github.com/famousaftab07-ui/AFTAB.git
cd AFTAB
npm install
npm start
```

Then open **http://localhost:12637** and log in with `aftab` / `aftab`.

To expose your local instance on a public link, use a Cloudflare quick tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:12637
```

It prints a `https://something.trycloudflare.com` URL. Open that, and you can pair from
anywhere.

---

## How to link a number

1. Open the panel URL.
2. Type the phone number **with country code and no `+`** — for example `923001234567`.
3. Press **Get pairing code**. An 8-character code appears.
4. On the phone: **WhatsApp → Settings → Linked devices → Link a device →
   Link with phone number**, then type the code.
5. The number appears in the session list as **ONLINE**. Send it `.menu`.

Repeat for every number you want on this bot. They all run side by side.

---

## Commands

Prefix is `.` (change it in `lib/config.js`).

| Command | Aliases | What it does |
|---|---|---|
| `.menu` | `.help`, `.h` | List every command, grouped by category |
| `.ping` | `.p` | Round-trip latency to WhatsApp |
| `.uptime` | `.up` | Bot process uptime and server uptime |
| `.sysinfo` | `.sys` | Server memory, CPU cores, load average |
| `.stats` | `.stat` | Messages and commands handled across all sessions |
| `.runtime` | `.rt` | Health of the session that ran the command |
| `.server` | `.srv` | Hostname, port, Node version, PID |
| `.disk` | `.storage` | Size of the session store and free space |
| `.speed` | `.latency` | Measures how fast the bot answers |
| `.creator` | `.owner`, `.af` | Bot owner card |

---

## Adding your own command

Drop a file in `plugins/commands/`. It is picked up on the next start — no registry to edit.

```js
// plugins/commands/hello.js
export default {
  name: 'hello',
  alias: ['hi'],
  category: 'GENERAL',
  desc: 'Say hello',
  usage: '.hello',
  async run(ctx) {
    await ctx.reply(`Hello from ${ctx.session.number}`);
  },
};
```

What `ctx` gives you:

| Field | Meaning |
|---|---|
| `ctx.reply(text)` | Reply to the message that triggered the command |
| `ctx.send(content)` | Send to the chat without quoting |
| `ctx.args` | Words after the command name |
| `ctx.text` | The full message text |
| `ctx.from` | Chat JID |
| `ctx.isGroup` | `true` when the message came from a group |
| `ctx.sock` | The raw Baileys socket, for anything advanced |
| `ctx.session` | The session object (number, counters, uptime) |

---

## Configuration

All settings live in **`lib/config.js`**. No `.env` file is needed.

| Setting | Default | Meaning |
|---|---|---|
| `BOT_NAME` | `AFTAB` | Name shown in menus |
| `PREFIX` | `.` | Command prefix |
| `PORT` | `12637` | Panel port |
| `PANEL_USER` | `aftab` | Panel username |
| `PANEL_PASS` | `aftab` | Panel password |
| `MAX_SESSIONS` | `50` | Session cap per instance |
| `SESSION_DIR` | `./session` | Where linked credentials are stored |

`PORT`, `PANEL_USER`, `PANEL_PASS`, `MAX_SESSIONS` and `SESSION_DIR` can also be set as
environment variables, which is what the Heroku button does for you.

---

## How it holds sessions

Each linked number gets a folder under `session/<number>/` holding its WhatsApp
credentials. On every boot the bot scans that folder and reconnects everything it finds,
so a restart or a dyno cycle does **not** need re-pairing.

On Heroku, dyno storage is wiped whenever the dyno restarts. To keep sessions across
restarts, attach a database or object store and point `SESSION_DIR` at mounted storage, or
simply re-link after a restart. A paid dyno that never idles keeps sessions alive
indefinitely.

---

## Panel API

The page uses these; you can too.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Pairing page |
| `GET` | `/health` | `{ status, bot, count, max }` |
| `GET` | `/sessions` | Every session and its live status |
| `POST` | `/pair` | `{ "number": "923001234567" }` → pairing code |
| `DELETE` | `/sessions/:number` | Unlink a session and delete its credentials |

---

## Notes

- Baileys is an **unofficial** WhatsApp client. Use it with numbers you own and respect
  WhatsApp's terms.
- The panel is protected by HTTP basic auth. Change the password before exposing it.
- Running many sessions on one small dyno will hit memory limits — raise the dyno size or
  lower `MAX_SESSIONS` if sessions start dropping.

---

## License

MIT — see [LICENSE](LICENSE).
