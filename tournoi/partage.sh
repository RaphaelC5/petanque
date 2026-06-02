#!/usr/bin/env bash
#
# partage.sh — Semaine des Copains Marseille
# Démarre le serveur partagé (port 5174) ET le tunnel ngrok d'un seul coup,
# sur une URL fixe. Ctrl+C arrête proprement les deux.
#
# ── Pré-requis (UNE SEULE FOIS) ───────────────────────────────────────────
#   1) brew install ngrok
#   2) Crée un compte gratuit sur https://dashboard.ngrok.com
#   3) ngrok config add-authtoken <TON_TOKEN>     (token dans le dashboard)
#   4) Récupère ton "Static Domain" gratuit dans le dashboard → onglet "Domains"
#      (ex. lucky-otter-1234.ngrok-free.app) et renseigne-le ci-dessous,
#      ou exporte-le : export NGROK_DOMAIN="lucky-otter-1234.ngrok-free.app"
#
# ── Usage ─────────────────────────────────────────────────────────────────
#   ./partage.sh                 # build + serveur + tunnel
#   ./partage.sh --no-build      # serveur + tunnel sans rebuild (plus rapide)
#   NGROK_DOMAIN=mon-nom.ngrok-free.app ./partage.sh

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
PORT=5174

# 👉 Mets ton domaine statique ngrok ici (ou exporte $NGROK_DOMAIN).
#    Laisse vide pour une URL aléatoire (non recommandé : elle change à chaque fois).
NGROK_DOMAIN="${NGROK_DOMAIN:-}"

# Toujours travailler depuis le dossier de ce script (= dossier tournoi).
cd "$(dirname "$0")"

BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

# ── Vérifs ───────────────────────────────────────────────────────────────
command -v ngrok >/dev/null 2>&1 || {
  echo "❌ ngrok introuvable. Installe-le d'abord : brew install ngrok" >&2
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "❌ node introuvable." >&2
  exit 1
}

# ── Build du front (charge les dernières évolutions) ───────────────────────
if [ "$BUILD" = "1" ]; then
  echo "🛠️  Build du front (npm run build)…"
  npm run build
fi

# ── Démarrage du serveur en arrière-plan ───────────────────────────────────
echo "🚀 Démarrage du serveur sur http://localhost:$PORT …"
node server.cjs &
SERVER_PID=$!

# Arrêt propre du serveur (et du tunnel) quand on quitte / Ctrl+C
cleanup() {
  echo ""
  echo "🧹 Arrêt du serveur…"
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Attendre que le serveur réponde avant d'ouvrir le tunnel ───────────────
printf "⏳ Attente du serveur"
for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:$PORT/api/state" >/dev/null 2>&1; then
    printf " ✅\n"
    break
  fi
  printf "."
  sleep 0.5
done

# ── Tunnel ngrok (au premier plan : affiche l'URL et les requêtes) ─────────
if [ -n "$NGROK_DOMAIN" ]; then
  echo "🌍 Lien fixe à partager : https://$NGROK_DOMAIN"
  echo "   (Ctrl+C pour tout arrêter)"
  # ngrok v3 récent : --url ; si erreur "unknown flag", remplace par --domain
  ngrok http "--url=https://$NGROK_DOMAIN" "$PORT"
else
  echo "⚠️  Aucun domaine fixe (NGROK_DOMAIN vide) → URL aléatoire."
  echo "   Renseigne ton domaine statique en haut du script pour une URL stable."
  ngrok http "$PORT"
fi
