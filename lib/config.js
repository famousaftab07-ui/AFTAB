// AFTAB — central configuration.
//
// Everything the operator may want to change lives here, in one file.
// No .env file is required: this bot reads its settings from this file so a
// fresh clone runs with zero setup.

export const BOT_NAME = 'AFTAB';

// Prefix a user types before a command, e.g. ".menu" or "!ping".
export const PREFIX = '.';

// Port for the built-in pairing / control panel.
export const PORT = Number(process.env.PORT || 12637);

// Where each linked session's WhatsApp credentials are kept on disk.
export const SESSION_DIR = process.env.SESSION_DIR || './session';

// Panel login. Change the password before you make this public.
export const PANEL_USER = process.env.PANEL_USER || 'aftab';
export const PANEL_PASS = process.env.PANEL_PASS || 'aftab';

// How many WhatsApp sessions this one process is allowed to run at once.
export const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 50);

// Bot replies to messages it cannot handle.
export const REPLY_FALLBACK = `Type ${PREFIX}menu to see what I can do.`;
