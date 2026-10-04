// AFTAB — plugin loader.
//
// Every file in plugins/commands/ exports:
//   export default {
//     name: 'ping',                  // command word (required)
//     alias: ['p'],                  // optional extra words
//     category: 'ALIVE',             // menu grouping
//     desc: 'Check if the bot is alive',
//     usage: '.ping',
//     run: async (ctx) => { ... }    // required
//   }
//
// The loader reads them all at boot and keeps them in a Map keyed by name.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.js';

export const plugins = new Map();
export const aliases = new Map();

export async function loadPlugins(log = console.log) {
  const dir = path.join(ROOT, 'plugins', 'commands');
  if (!fs.existsSync(dir)) {
    log(`[plugins] no directory at ${dir}`);
    return { count: 0, failed: 0 };
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  let failed = 0;
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const mod = await import(pathToFileURL(full).href);
      const plugin = mod.default;
      if (!plugin || !plugin.name || typeof plugin.run !== 'function') {
        log(`[plugins] SKIP ${file} — needs { name, run }`);
        failed += 1;
        continue;
      }
      if (plugins.has(plugin.name)) {
        log(`[plugins] SKIP ${file} — duplicate command "${plugin.name}"`);
        failed += 1;
        continue;
      }
      plugins.set(plugin.name, { ...plugin, file });
      for (const a of plugin.alias || []) {
        if (aliases.has(a) || plugins.has(a)) {
          log(`[plugins] note: alias "${a}" in ${file} shadows an existing name`);
        }
        aliases.set(a, plugin.name);
      }
    } catch (err) {
      log(`[plugins] FAIL ${file} — ${err.message}`);
      failed += 1;
    }
  }

  log(`[plugins] loaded ${plugins.size} commands (${failed} skipped) from ${files.length} files`);
  return { count: plugins.size, failed };
}

// Resolve a typed word to a plugin: exact name first, then alias.
export function resolve(word) {
  const w = String(word || '').toLowerCase();
  if (plugins.has(w)) return plugins.get(w);
  if (aliases.has(w)) return plugins.get(aliases.get(w));
  return null;
}

// Group plugins for .menu.
export function byCategory() {
  const groups = new Map();
  for (const p of plugins.values()) {
    const cat = p.category || 'GENERAL';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}
