/* =========================================================================
 * Terrains de pétanque en France
 * - Carte Leaflet centrée sur la géoloc utilisateur (50 km visibles)
 * - Recherche d'adresse via Nominatim
 * - Données depuis data.sports.gouv.fr, cache IndexedDB
 * ========================================================================= */

const FRANCE_CENTER = [46.6, 2.5];
const FRANCE_ZOOM = 6;
const LOCAL_ZOOM = 11;            // ~50 km visibles
const DB_NAME = "petanque-db";
const DB_VERSION = 2;
const DB_STORE = "boulodromes";
const DB_META = "meta";
const DB_USER_STORE = "user_terrains";

const API_EXPORT_URL =
  'https://data.sports.gouv.fr/api/explore/v2.1/catalog/datasets/equipements-sportifs/exports/json' +
  '?where=' + encodeURIComponent('equip_type_famille="Boulodrome"') +
  '&select=' + encodeURIComponent([
    'inst_numero',
    'equip_numero',
    'inst_nom',
    'equip_nom',
    'equip_type_name',
    'inst_adresse',
    'inst_cp',
    'new_name',
    'equip_coordonnees',
    'equip_prop_type',
    'equip_ouv_public_bool',
    'equip_acc_libre',
    'equip_nature',
    'equip_sol',
    'equip_surf',
    'equip_haut',
    'aps_name'
  ].join(','));

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/* ---------- IndexedDB ---------- */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'equip_numero' });
      }
      if (!db.objectStoreNames.contains(DB_META)) {
        db.createObjectStore(DB_META);
      }
      if (!db.objectStoreNames.contains(DB_USER_STORE)) {
        db.createObjectStore(DB_USER_STORE, { keyPath: 'equip_numero' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllTerrains(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveTerrains(db, terrains) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.clear();
    for (const t of terrains) {
      if (!t.equip_numero) continue;
      store.put(t);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getMeta(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_META, 'readonly');
    const req = tx.objectStore(DB_META).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function setMeta(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_META, 'readwrite');
    tx.objectStore(DB_META).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getUserTerrains(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_USER_STORE, 'readonly');
    const req = tx.objectStore(DB_USER_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveUserTerrain(db, terrain) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_USER_STORE, 'readwrite');
    tx.objectStore(DB_USER_STORE).put(terrain);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- API fetch ---------- */

async function fetchAllTerrains() {
  const resp = await fetch(API_EXPORT_URL);
  if (!resp.ok) throw new Error(`API HTTP ${resp.status}`);
  const data = await resp.json();
  return data.filter(t =>
    t.equip_coordonnees &&
    typeof t.equip_coordonnees.lat === 'number' &&
    typeof t.equip_coordonnees.lon === 'number'
  );
}

/* ---------- UI helpers ---------- */

const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const syncDateEl = document.getElementById('sync-date');
const updateBtn = document.getElementById('update-btn');
const addBtn = document.getElementById('add-btn');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchError = document.getElementById('search-error');
const addModal = document.getElementById('add-modal');
const addModalClose = document.getElementById('add-modal-close');
const addForm = document.getElementById('add-form');
const addFormCancel = document.getElementById('add-form-cancel');
const addFormCoords = document.getElementById('add-form-coords');
const addFormError = document.getElementById('add-form-error');

function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function showError(msg) {
  searchError.textContent = msg;
  searchError.classList.add('visible');
  setTimeout(() => searchError.classList.remove('visible'), 4000);
}

function formatSyncDate(ts) {
  if (!ts) return '–';
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function setSyncDate(ts) {
  syncDateEl.textContent = formatSyncDate(ts);
}

/* ---------- Map ---------- */

const map = L.map('map', {
  center: FRANCE_CENTER,
  zoom: FRANCE_ZOOM,
  minZoom: 5,
  maxZoom: 18,
  zoomControl: true,
  doubleClickZoom: false   // double-click is used to open the add form
});

// Auto-pan popups so they're not hidden behind the search box or sync box
map.options.closePopupOnClick = true;
window.__map = map;   // exposed for debugging in browser console

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

// Custom pin builder
function makePinIcon(color) {
  return L.divIcon({
    className: 'pin-icon',
    html: `<svg viewBox="0 0 24 32" width="22" height="29" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z"
                   fill="${color}" stroke="#fff" stroke-width="1.5"/>
             <circle cx="12" cy="12" r="4" fill="#fff"/>
           </svg>`,
    iconSize: [22, 29],
    iconAnchor: [11, 29],
    popupAnchor: [0, -26]
  });
}

const redPinIcon = makePinIcon('#c0392b');
const bluePinIcon = makePinIcon('#1f618d');

const userIcon = L.divIcon({
  className: 'user-location-icon',
  html: '<div></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Cluster group
const markerCluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  disableClusteringAtZoom: 14,
  maxClusterRadius: 50
});
map.addLayer(markerCluster);

let userMarker = null;
let searchMarker = null;

/* ---------- Popup builder ---------- */

function buildPopup(t) {
  const isPublic = t.equip_ouv_public_bool === 'true' || t.equip_ouv_public_bool === true;
  const isAccLibre = t.equip_acc_libre === 'true' || t.equip_acc_libre === true;
  const ville = t.new_name || '';
  const cp = t.inst_cp || '';
  const adresse = t.inst_adresse || '';
  const fullAddress = [adresse, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const aps = Array.isArray(t.aps_name) ? t.aps_name.join(', ') : (t.aps_name || '');

  const badges = [];
  if (t._user_added) badges.push('<span class="badge badge-user">Ajouté par un utilisateur</span>');
  if (isPublic) badges.push('<span class="badge badge-public">Public</span>');
  else badges.push('<span class="badge badge-private">Privé / restreint</span>');
  if (isAccLibre) badges.push('<span class="badge badge-libre">Accès libre</span>');

  const rows = [];
  if (t.equip_type_name) rows.push(['Type', escapeHtml(t.equip_type_name)]);
  if (t.equip_nature) rows.push(['Nature', escapeHtml(t.equip_nature)]);
  if (t.equip_sol) rows.push(['Sol', escapeHtml(t.equip_sol)]);
  if (t.equip_surf) rows.push(['Surface', `${t.equip_surf} m²`]);
  if (t.equip_haut) rows.push(['Hauteur', `${t.equip_haut} m`]);
  if (t.equip_prop_type) rows.push(['Propriétaire', escapeHtml(t.equip_prop_type)]);
  if (aps) rows.push(['Activités', escapeHtml(aps)]);

  return `
    <div class="popup-content">
      <h3>${escapeHtml(t.inst_nom || 'Terrain de pétanque')}</h3>
      ${t.equip_nom && t.equip_nom !== t.inst_nom ? `<div class="equip-name">${escapeHtml(t.equip_nom)}</div>` : ''}
      <div style="margin-bottom:8px;">${badges.join(' ')}</div>
      <div style="margin-bottom:8px;color:#444;">📍 ${escapeHtml(fullAddress) || '<i>Adresse non renseignée</i>'}</div>
      <dl>
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}
      </dl>
    </div>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Render markers ---------- */

function buildMarker(t) {
  const c = t.equip_coordonnees;
  if (!c || typeof c.lat !== 'number' || typeof c.lon !== 'number') return null;
  const icon = t._user_added ? bluePinIcon : redPinIcon;
  const m = L.marker([c.lat, c.lon], { icon });
  m.bindPopup(() => buildPopup(t), {
    maxWidth: 320,
    autoPanPaddingTopLeft: L.point(20, 90),
    autoPanPaddingBottomRight: L.point(20, 100)
  });
  return m;
}

function renderTerrains(terrains) {
  markerCluster.clearLayers();
  const markers = [];
  for (const t of terrains) {
    const m = buildMarker(t);
    if (m) markers.push(m);
  }
  markerCluster.addLayers(markers);
}

function addTerrainMarker(t) {
  const m = buildMarker(t);
  if (m) markerCluster.addLayer(m);
  return m;
}

/* ---------- Geocoding (Nominatim) ---------- */

async function geocode(query) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=fr&addressdetails=0`;
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'fr' }
  });
  if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    label: data[0].display_name
  };
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`;
  const resp = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
  const data = await resp.json();
  const addr = data.address || {};
  const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '';
  return {
    adresse: street,
    cp: addr.postcode || '',
    ville: city,
    display_name: data.display_name || ''
  };
}

/* ---------- Geolocation ---------- */

function tryGeolocate() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      _err => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

function placeUserMarker(lat, lon) {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat, lon], { icon: userIcon, interactive: false }).addTo(map);
}

function placeSearchMarker(lat, lon, label) {
  if (searchMarker) map.removeLayer(searchMarker);
  searchMarker = L.marker([lat, lon], { icon: userIcon, interactive: true })
    .bindPopup(`<strong>${escapeHtml(label)}</strong>`)
    .addTo(map);
}

/* ---------- Main flow ---------- */

async function loadOrFetchTerrains(db, { forceRefresh = false } = {}) {
  let terrains = forceRefresh ? [] : await getAllTerrains(db);
  let lastSync = await getMeta(db, 'lastSync');

  if (!terrains.length || forceRefresh) {
    showLoading(forceRefresh
      ? 'Mise à jour des données…'
      : 'Premier chargement : téléchargement de tous les terrains de pétanque (≈ 17 Mo)…');
    terrains = await fetchAllTerrains();
    await saveTerrains(db, terrains);
    lastSync = Date.now();
    await setMeta(db, 'lastSync', lastSync);
    hideLoading();
  }

  setSyncDate(lastSync);

  // Combine official + user-added terrains in the cluster
  const userTerrains = await getUserTerrains(db);
  renderTerrains(terrains.concat(userTerrains));
  return terrains;
}

/* ---------- Add-terrain modal ---------- */

let pendingCoords = null;   // {lat, lon} chosen for the new terrain

function setPendingCoords(lat, lon) {
  pendingCoords = { lat, lon };
  addFormCoords.textContent =
    `📍 Position : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  addFormCoords.classList.add('has-coords');
}

function clearPendingCoords() {
  pendingCoords = null;
  addFormCoords.textContent =
    'Astuce : double-cliquez sur la carte avant d\'ouvrir ce formulaire pour pré-remplir la position et l\'adresse.';
  addFormCoords.classList.remove('has-coords');
}

function openAddModal() {
  addFormError.textContent = '';
  addModal.classList.remove('hidden');
  setTimeout(() => document.getElementById('f-inst_nom').focus(), 50);
}

function closeAddModal() {
  addModal.classList.add('hidden');
}

function resetAddForm() {
  addForm.reset();
  clearPendingCoords();
}

async function openAddModalAtPoint(lat, lon) {
  resetAddForm();
  setPendingCoords(lat, lon);
  openAddModal();

  // Best-effort reverse-geocode, non-blocking
  try {
    const addr = await reverseGeocode(lat, lon);
    if (!pendingCoords || pendingCoords.lat !== lat || pendingCoords.lon !== lon) return;
    if (addr.adresse) document.getElementById('f-inst_adresse').value = addr.adresse;
    if (addr.cp) document.getElementById('f-inst_cp').value = addr.cp;
    if (addr.ville) document.getElementById('f-new_name').value = addr.ville;
  } catch (e) {
    console.warn('reverse geocode failed', e);
  }
}

function buildTerrainFromForm() {
  const data = new FormData(addForm);
  const surfRaw = data.get('equip_surf');
  const hautRaw = data.get('equip_haut');
  const id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  return {
    equip_numero: id,
    inst_numero: id,
    inst_nom: (data.get('inst_nom') || '').trim(),
    equip_nom: (data.get('equip_nom') || '').trim() || null,
    equip_type_name: data.get('equip_type_name') || null,
    equip_type_famille: 'Boulodrome',
    inst_adresse: (data.get('inst_adresse') || '').trim() || null,
    inst_cp: (data.get('inst_cp') || '').trim() || null,
    new_name: (data.get('new_name') || '').trim() || null,
    equip_coordonnees: { lat: pendingCoords.lat, lon: pendingCoords.lon },
    equip_prop_type: data.get('equip_prop_type') || null,
    equip_ouv_public_bool: data.get('equip_ouv_public_bool') === 'on' ? 'true' : 'false',
    equip_acc_libre: data.get('equip_acc_libre') === 'on' ? 'true' : 'false',
    equip_nature: data.get('equip_nature') || null,
    equip_sol: data.get('equip_sol') || null,
    equip_surf: surfRaw ? parseFloat(surfRaw) : null,
    equip_haut: hautRaw ? parseFloat(hautRaw) : null,
    aps_name: ['Pétanque et jeu provencal'],
    _user_added: true,
    _created_at: Date.now()
  };
}

async function init() {
  let db;
  try {
    db = await openDB();
  } catch (e) {
    showLoading('Erreur IndexedDB : ' + e.message);
    return;
  }

  // Geolocate in parallel with data loading
  const geoPromise = tryGeolocate();

  try {
    await loadOrFetchTerrains(db);
  } catch (e) {
    hideLoading();
    showError('Erreur de chargement des terrains : ' + e.message);
    console.error(e);
  }

  const geo = await geoPromise;
  if (geo) {
    map.setView([geo.lat, geo.lon], LOCAL_ZOOM);
    placeUserMarker(geo.lat, geo.lon);
  } else {
    // Stay on France-wide view
    map.setView(FRANCE_CENTER, FRANCE_ZOOM);
  }

  // Update button
  updateBtn.addEventListener('click', async () => {
    updateBtn.disabled = true;
    try {
      await loadOrFetchTerrains(db, { forceRefresh: true });
    } catch (e) {
      hideLoading();
      showError('Erreur lors de la mise à jour : ' + e.message);
      console.error(e);
    } finally {
      updateBtn.disabled = false;
    }
  });

  // Search form
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    searchBtn.disabled = true;
    try {
      const result = await geocode(q);
      if (!result) {
        showError('Adresse introuvable');
        return;
      }
      map.setView([result.lat, result.lon], LOCAL_ZOOM);
      placeSearchMarker(result.lat, result.lon, result.label);
    } catch (err) {
      showError('Erreur de géocodage : ' + err.message);
      console.error(err);
    } finally {
      searchBtn.disabled = false;
    }
  });

  // --- Add-terrain feature ---

  // "+" button: open empty form using current map center as default position
  addBtn.addEventListener('click', () => {
    resetAddForm();
    const c = map.getCenter();
    setPendingCoords(c.lat, c.lng);
    openAddModal();
  });

  // Double-click on map: open form with coords + reverse-geocoded address
  map.on('dblclick', (e) => {
    openAddModalAtPoint(e.latlng.lat, e.latlng.lng);
  });

  // Close modal interactions
  addModalClose.addEventListener('click', closeAddModal);
  addFormCancel.addEventListener('click', closeAddModal);
  addModal.querySelector('.modal-backdrop').addEventListener('click', closeAddModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !addModal.classList.contains('hidden')) closeAddModal();
  });

  // Submit
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    addFormError.textContent = '';
    if (!pendingCoords) {
      addFormError.textContent = 'Position manquante. Double-cliquez sur la carte ou rouvrez le formulaire.';
      return;
    }
    const nom = document.getElementById('f-inst_nom').value.trim();
    if (!nom) {
      addFormError.textContent = 'Le nom de l\'installation est obligatoire.';
      return;
    }
    const terrain = buildTerrainFromForm();
    const submitBtn = addForm.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      await saveUserTerrain(db, terrain);
      addTerrainMarker(terrain);
      closeAddModal();
    } catch (err) {
      addFormError.textContent = 'Erreur d\'enregistrement : ' + err.message;
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

init();
