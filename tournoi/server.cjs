/**
 * Serveur partagé « Semaine des Copains Marseille »
 * Express + SQLite : stocke l'état complet du tournoi et le sert à tous les
 * navigateurs connectés. Les changements sont propagés en temps réel (SSE).
 * Sert aussi le frontend buildé (dist/) → une seule URL pour tout le monde.
 */

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5174;
const DB_FILE = path.join(__dirname, 'tournois.db');

const DAY_MS = 24 * 60 * 60 * 1000;

/* ── Base SQLite ── */
const db = new Database(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS photos (
    id         TEXT    PRIMARY KEY,
    author     TEXT    NOT NULL,
    caption    TEXT,
    mime       TEXT    NOT NULL,
    data       TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT    PRIMARY KEY,
    author     TEXT    NOT NULL,
    text       TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_terrains (
    equip_numero TEXT    PRIMARY KEY,
    data         TEXT    NOT NULL,
    created_at   INTEGER NOT NULL
  );
`);
console.log(`Base SQLite : ${DB_FILE}`);

/* Purge des photos de plus de 24h (chambrage éphémère). */
function purgePhotos() {
  db.prepare('DELETE FROM photos WHERE created_at < ?').run(Date.now() - DAY_MS);
}
purgePhotos();
setInterval(purgePhotos, 10 * 60 * 1000).unref();

function photoMeta(row) {
  return {
    id: row.id,
    author: row.author,
    caption: row.caption || '',
    createdAt: row.created_at,
    expiresAt: row.created_at + DAY_MS,
    url: `/api/photos/${row.id}/raw`,
  };
}

function listPhotos() {
  purgePhotos();
  return db
    .prepare('SELECT id, author, caption, created_at FROM photos ORDER BY created_at DESC')
    .all()
    .map(photoMeta);
}

function listMessages() {
  return db
    .prepare('SELECT id, author, text, created_at FROM messages ORDER BY created_at ASC LIMIT 200')
    .all()
    .map((m) => ({ id: m.id, author: m.author, text: m.text, createdAt: m.created_at }));
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const EMPTY = JSON.stringify({ players: [], tournaments: [], version: 1 });

function getStateJson() {
  const row = db.prepare('SELECT data FROM app_state WHERE id = 1').get();
  return row ? row.data : EMPTY;
}

function setStateJson(json) {
  db.prepare(
    `INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(json, Date.now());
}

/* ── Middleware ── */
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

/* ── Flux temps réel (SSE) ── */
const clients = new Set();

function emit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

/* ── API ── */

// GET /api/state — état courant (JSON)
app.get('/api/state', (_req, res) => {
  res.type('application/json').send(getStateJson());
});

// PUT /api/state — remplace l'état et notifie les autres clients
app.put('/api/state', (req, res) => {
  const { origin, state } = req.body || {};
  if (!state || !Array.isArray(state.players) || !Array.isArray(state.tournaments)) {
    return res.status(400).json({ error: 'état invalide' });
  }
  setStateJson(JSON.stringify(state));
  emit('state', { origin: origin ?? null, state });
  res.json({ ok: true });
});

/* ── Photos de chambrage (auto-suppression 24h) ── */

// GET /api/photos — métadonnées des photos encore valides
app.get('/api/photos', (_req, res) => {
  res.json(listPhotos());
});

// POST /api/photos — { author, caption, dataUrl } (image en data URL)
app.post('/api/photos', (req, res) => {
  const { author, caption, dataUrl } = req.body || {};
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'image invalide' });
  const id = newId();
  db.prepare(
    'INSERT INTO photos (id, author, caption, mime, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, (author || 'Anonyme').slice(0, 40), (caption || '').slice(0, 200), m[1], m[2], Date.now());
  emit('photos', listPhotos());
  res.json({ ok: true, id });
});

// GET /api/photos/:id/raw — sert l'image décodée
app.get('/api/photos/:id/raw', (req, res) => {
  const row = db.prepare('SELECT mime, data, created_at FROM photos WHERE id = ?').get(req.params.id);
  if (!row || row.created_at < Date.now() - DAY_MS) return res.sendStatus(404);
  res.set('Content-Type', row.mime).set('Cache-Control', 'public, max-age=3600');
  res.send(Buffer.from(row.data, 'base64'));
});

// DELETE /api/photos/:id — retrait manuel
app.delete('/api/photos/:id', (req, res) => {
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  emit('photos', listPhotos());
  res.json({ ok: true });
});

/* ── Mini chat ── */

// GET /api/chat — derniers messages
app.get('/api/chat', (_req, res) => {
  res.json(listMessages());
});

// POST /api/chat — { author, text }
app.post('/api/chat', (req, res) => {
  const { author, text } = req.body || {};
  const t = (text || '').trim();
  if (!t) return res.status(400).json({ error: 'message vide' });
  const id = newId();
  db.prepare('INSERT INTO messages (id, author, text, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    (author || 'Anonyme').slice(0, 40),
    t.slice(0, 500),
    Date.now(),
  );
  // borne la taille : on ne garde que les 200 derniers
  db.prepare(
    'DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY created_at DESC LIMIT 200)',
  ).run();
  emit('chat', listMessages());
  res.json({ ok: true, id });
});

// GET /api/stream — abonnement SSE (reçoit l'état initial puis chaque mise à jour)
app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(
    `event: state\ndata: ${JSON.stringify({
      origin: null,
      state: JSON.parse(getStateJson()),
    })}\n\n`,
  );
  res.write(`event: photos\ndata: ${JSON.stringify(listPhotos())}\n\n`);
  res.write(`event: chat\ndata: ${JSON.stringify(listMessages())}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

/* ── Carte des terrains (terrains ajoutés par les copains, partagés) ── */

// GET /api/terrains — liste tous les terrains utilisateur
app.get('/api/terrains', (_req, res) => {
  const rows = db.prepare('SELECT data FROM user_terrains ORDER BY created_at DESC').all();
  res.json(rows.map((r) => JSON.parse(r.data)));
});

// POST /api/terrains — ajoute ou remplace un terrain
app.post('/api/terrains', (req, res) => {
  const t = req.body;
  if (!t || !t.equip_numero) return res.status(400).json({ error: 'equip_numero requis' });
  db.prepare(
    `INSERT INTO user_terrains (equip_numero, data, created_at) VALUES (?, ?, ?)
     ON CONFLICT(equip_numero) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
  ).run(t.equip_numero, JSON.stringify(t), t._created_at || Date.now());
  res.json({ ok: true, equip_numero: t.equip_numero });
});

// DELETE /api/terrains/:id — supprime un terrain
app.delete('/api/terrains/:id', (req, res) => {
  const info = db.prepare('DELETE FROM user_terrains WHERE equip_numero = ?').run(req.params.id);
  res.json({ ok: true, deleted: info.changes });
});

// Fallback SPA : toute autre route renvoie l'app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Semaine des Copains — serveur partagé sur http://localhost:${PORT}`);
  console.log('Partage : expose ce port (Wi-Fi local ou tunnel) — voir README.');
});
