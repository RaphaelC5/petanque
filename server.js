/**
 * Serveur pétanque — Express + SQLite
 * Sert les fichiers statiques ET l'API /api/terrains
 * Port : 8765
 */

const express  = require('express');
const Database = require('better-sqlite3');
const path     = require('path');

const app  = express();
const PORT = 8765;
const DB_FILE = path.join(__dirname, 'user_terrains.db');

/* ── Base SQLite ── */
const db = new Database(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS user_terrains (
    equip_numero TEXT    PRIMARY KEY,
    data         TEXT    NOT NULL,
    created_at   INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
  )
`);
console.log(`Base SQLite : ${DB_FILE}`);

/* ── Middleware ── */
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));   // sert index.html, app.js, style.css…

/* ── API ── */

// GET  /api/terrains  — liste tous les terrains utilisateur
app.get('/api/terrains', (req, res) => {
  const rows = db.prepare(
    'SELECT data FROM user_terrains ORDER BY created_at DESC'
  ).all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

// POST /api/terrains  — ajoute ou remplace un terrain
app.post('/api/terrains', (req, res) => {
  const t = req.body;
  if (!t || !t.equip_numero) {
    return res.status(400).json({ error: 'equip_numero requis' });
  }
  db.prepare(
    `INSERT OR REPLACE INTO user_terrains (equip_numero, data, created_at)
     VALUES (?, ?, ?)`
  ).run(t.equip_numero, JSON.stringify(t), t._created_at || Date.now());
  res.json({ ok: true, equip_numero: t.equip_numero });
});

// DELETE /api/terrains/:id  — supprime un terrain
app.delete('/api/terrains/:id', (req, res) => {
  const info = db.prepare(
    'DELETE FROM user_terrains WHERE equip_numero = ?'
  ).run(req.params.id);
  res.json({ ok: true, deleted: info.changes });
});

/* ── Démarrage ── */
app.listen(PORT, () => {
  console.log(`Serveur pétanque  →  http://localhost:${PORT}`);
});
