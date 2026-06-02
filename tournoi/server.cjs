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

/* ── Base SQLite : une seule ligne contenant tout l'état ── */
const db = new Database(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
console.log(`Base SQLite : ${DB_FILE}`);

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

function broadcast(origin, state) {
  const payload = `event: state\ndata: ${JSON.stringify({ origin, state })}\n\n`;
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
  broadcast(origin ?? null, state);
  res.json({ ok: true });
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
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

// Fallback SPA : toute autre route renvoie l'app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Semaine des Copains — serveur partagé sur http://localhost:${PORT}`);
  console.log('Partage : expose ce port (Wi-Fi local ou tunnel) — voir README.');
});
