/* =========================================================================
 * Terrains de pétanque en France
 * ========================================================================= */

/* ===== CONSTANTS ===== */
const FRANCE_CENTER   = [46.6, 2.5];
const FRANCE_ZOOM     = 6;
const LOCAL_ZOOM      = 11;
const DB_NAME         = 'petanque-db';
const DB_VERSION      = 2;
const DB_STORE        = 'boulodromes';
const DB_META         = 'meta';
const DB_USER_STORE   = 'user_terrains';
const LIST_INITIAL    = 20;
const LIST_INCREMENT  = 10;
const AC_DEBOUNCE_MS  = 350;

const API_EXPORT_URL =
  'https://data.sports.gouv.fr/api/explore/v2.1/catalog/datasets/equipements-sportifs/exports/json' +
  '?where=' + encodeURIComponent('equip_type_famille="Boulodrome"') +
  '&select=' + encodeURIComponent([
    'inst_numero','equip_numero','inst_nom','equip_nom','equip_type_name',
    'inst_adresse','inst_cp','new_name','equip_coordonnees','equip_prop_type',
    'equip_ouv_public_bool','equip_acc_libre','equip_nature','equip_sol',
    'equip_surf','equip_haut','aps_name'
  ].join(','));

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/* ===== INDEXEDDB ===== */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE))
        db.createObjectStore(DB_STORE, { keyPath: 'equip_numero' });
      if (!db.objectStoreNames.contains(DB_META))
        db.createObjectStore(DB_META);
      if (!db.objectStoreNames.contains(DB_USER_STORE))
        db.createObjectStore(DB_USER_STORE, { keyPath: 'equip_numero' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

const dbGet = (db, store, key) => new Promise((res, rej) => {
  const req = db.transaction(store, 'readonly').objectStore(store).get(key);
  req.onsuccess = () => res(req.result);
  req.onerror   = () => rej(req.error);
});

const dbGetAll = (db, store) => new Promise((res, rej) => {
  const req = db.transaction(store, 'readonly').objectStore(store).getAll();
  req.onsuccess = () => res(req.result);
  req.onerror   = () => rej(req.error);
});

const dbPut = (db, store, value, key) => new Promise((res, rej) => {
  const tx = db.transaction(store, 'readwrite');
  key !== undefined ? tx.objectStore(store).put(value, key)
                    : tx.objectStore(store).put(value);
  tx.oncomplete = () => res();
  tx.onerror    = () => rej(tx.error);
});

async function saveTerrains(db, terrains) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.clear();
    for (const t of terrains) { if (t.equip_numero) store.put(t); }
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/* ===== API ===== */
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

/* ===== GLOBAL STATE ===== */
let allTerrains      = [];   // official + user
let filteredTerrains = [];   // after active filters

let activeFilters = {
  types:      new Set(),
  natures:    new Set(),
  publicOnly: false,
  libreOnly:  false
};

/* ===== UI ELEMENT REFS ===== */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const loadingOverlay  = $('loading-overlay');
const loadingText     = $('loading-text');
const syncDateEl      = $('sync-date');
const updateBtn       = $('update-btn');
const addBtn          = $('add-btn');
const searchForm      = $('search-form');
const searchInput     = $('search-input');
const searchBtn       = $('search-btn');
const searchError     = $('search-error');
const filterBtn       = $('filter-btn');
const filterBadge     = $('filter-badge');
const filterPanel     = $('filter-panel');
const filterApplyBtn  = $('filter-apply-btn');
const filterResetBtn  = $('filter-reset-btn');
const autocompleteList= $('autocomplete-list');
const btnMapView      = $('btn-map-view');
const btnListView     = $('btn-list-view');
const listView        = $('list-view');
const listCount       = $('list-count');
const listContainer   = $('list-container');
const listSentinel    = $('list-sentinel');
const addModal        = $('add-modal');
const addModalClose   = $('add-modal-close');
const addForm         = $('add-form');
const addFormCancel   = $('add-form-cancel');
const addFormCoords   = $('add-form-coords');
const addFormError    = $('add-form-error');

/* ===== LOADING / ERROR ===== */
function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}
function hideLoading() { loadingOverlay.classList.add('hidden'); }

function showError(msg) {
  searchError.textContent = msg;
  searchError.classList.add('visible');
  setTimeout(() => searchError.classList.remove('visible'), 4000);
}

function setSyncDate(ts) {
  syncDateEl.textContent = ts
    ? new Date(ts).toLocaleString('fr-FR', {
        day:'2-digit', month:'2-digit', year:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      })
    : '–';
}

/* ===== MAP SETUP ===== */
const map = L.map('map', {
  center: FRANCE_CENTER,
  zoom:   FRANCE_ZOOM,
  minZoom: 5,
  maxZoom: 18,
  zoomControl: false,
  doubleClickZoom: false
});
window.__map = map;

// Zoom control at bottom-left (doesn't overlap search bar)
L.control.zoom({ position: 'bottomleft' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

/* ===== PIN ICONS ===== */
function makePinIcon(color) {
  return L.divIcon({
    className: 'pin-icon',
    html: `<svg viewBox="0 0 24 32" width="22" height="29" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20S24 20.4 24 12C24 5.4 18.6 0 12 0z"
                   fill="${color}" stroke="#fff" stroke-width="1.5"/>
             <circle cx="12" cy="12" r="4" fill="#fff"/>
           </svg>`,
    iconSize: [22, 29], iconAnchor: [11, 29], popupAnchor: [0, -26]
  });
}
const redPinIcon  = makePinIcon('#c0392b');
const bluePinIcon = makePinIcon('#1f618d');

const userIcon = L.divIcon({
  className: 'user-location-icon',
  html: '<div></div>',
  iconSize: [16, 16], iconAnchor: [8, 8]
});

/* ===== MARKER CLUSTER ===== */
const markerCluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom:  true,
  disableClusteringAtZoom: 14,
  maxClusterRadius: 50
});
map.addLayer(markerCluster);

const markerMap = new Map();   // equip_numero → L.Marker
let userMarker   = null;
let searchMarker = null;

/* ===== POPUP ===== */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function buildBadges(t) {
  const isPublic  = t.equip_ouv_public_bool === 'true' || t.equip_ouv_public_bool === true;
  const isLibre   = t.equip_acc_libre       === 'true' || t.equip_acc_libre       === true;
  const badges = [];
  if (t._user_added) badges.push('<span class="badge badge-user">Ajouté</span>');
  badges.push(isPublic
    ? '<span class="badge badge-public">Public</span>'
    : '<span class="badge badge-private">Privé</span>');
  if (isLibre) badges.push('<span class="badge badge-libre">Accès libre</span>');
  return badges;
}

function fullAddr(t) {
  const addr = t.inst_adresse || '';
  const cp   = t.inst_cp  || '';
  const ville= t.new_name || '';
  return [addr, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function buildPopup(t) {
  const aps = Array.isArray(t.aps_name) ? t.aps_name.join(', ') : (t.aps_name || '');
  const rows = [
    t.equip_type_name && ['Type',        escapeHtml(t.equip_type_name)],
    t.equip_nature    && ['Nature',      escapeHtml(t.equip_nature)],
    t.equip_sol       && ['Sol',         escapeHtml(t.equip_sol)],
    t.equip_surf      && ['Surface',     `${t.equip_surf} m²`],
    t.equip_haut      && ['Hauteur',     `${t.equip_haut} m`],
    t.equip_prop_type && ['Propriétaire',escapeHtml(t.equip_prop_type)],
    aps               && ['Activités',   escapeHtml(aps)]
  ].filter(Boolean);

  return `<div class="popup-content">
    <h3>${escapeHtml(t.inst_nom || 'Terrain de pétanque')}</h3>
    ${t.equip_nom && t.equip_nom !== t.inst_nom
      ? `<div class="equip-name">${escapeHtml(t.equip_nom)}</div>` : ''}
    <div style="margin-bottom:8px">${buildBadges(t).join(' ')}</div>
    <div style="margin-bottom:8px;color:#444">📍 ${escapeHtml(fullAddr(t)) || '<i>Adresse non renseignée</i>'}</div>
    <dl>${rows.map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  </div>`;
}

/* ===== MARKER MANAGEMENT ===== */
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
  markerMap.set(t.equip_numero, m);
  return m;
}

function renderTerrains(terrains) {
  markerCluster.clearLayers();
  markerMap.clear();
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

/* ===== GEOCODING ===== */
async function geocode(query) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=fr&addressdetails=0`;
  const resp = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
  return await resp.json();
}

async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`;
  const resp = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
  if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
  const data = await resp.json();
  const addr = data.address || {};
  return {
    adresse: [addr.house_number, addr.road].filter(Boolean).join(' '),
    cp:   addr.postcode || '',
    ville: addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '',
    display_name: data.display_name || ''
  };
}

/* ===== GEOLOCATION ===== */
function tryGeolocate() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      _   => resolve(null),
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}

function placeUserMarker(lat, lon) {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat, lon], { icon: userIcon, interactive: false }).addTo(map);
}

function placeSearchMarker(lat, lon, label) {
  if (searchMarker) map.removeLayer(searchMarker);
  searchMarker = L.marker([lat, lon], { icon: userIcon })
    .bindPopup(`<strong>${escapeHtml(label)}</strong>`)
    .addTo(map);
}

/* ===== AUTOCOMPLETE ===== */
let acTimer   = null;
let acActive  = -1;
let acResults = [];

function showAutocomplete(results) {
  acResults = results;
  acActive  = -1;
  autocompleteList.innerHTML = '';
  if (!results.length) { hideAutocomplete(); return; }
  results.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'autocomplete-item';
    li.setAttribute('role', 'option');
    li.textContent = r.display_name;
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectAcResult(i);
    });
    autocompleteList.appendChild(li);
  });
  autocompleteList.classList.remove('hidden');
}

function hideAutocomplete() {
  autocompleteList.classList.add('hidden');
  acResults = [];
  acActive  = -1;
}

function setAcActive(idx) {
  const items = autocompleteList.querySelectorAll('.autocomplete-item');
  items.forEach((el, i) => el.classList.toggle('ac-active', i === idx));
  acActive = idx;
}

async function triggerAutocomplete(query) {
  if (!query.trim() || query.length < 2) { hideAutocomplete(); return; }
  try {
    const results = await geocode(query);
    showAutocomplete(results);
  } catch (_) { hideAutocomplete(); }
}

function selectAcResult(idx) {
  const r = acResults[idx];
  if (!r) return;
  searchInput.value = r.display_name;
  hideAutocomplete();
  const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
  map.setView([lat, lon], LOCAL_ZOOM);
  placeSearchMarker(lat, lon, r.display_name);
}

searchInput.addEventListener('input', () => {
  clearTimeout(acTimer);
  acTimer = setTimeout(() => triggerAutocomplete(searchInput.value), AC_DEBOUNCE_MS);
});

searchInput.addEventListener('keydown', (e) => {
  const items = autocompleteList.querySelectorAll('.autocomplete-item');
  if (autocompleteList.classList.contains('hidden') || !items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setAcActive(Math.min(acActive + 1, items.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setAcActive(Math.max(acActive - 1, 0));
  } else if (e.key === 'Enter' && acActive >= 0) {
    e.preventDefault();
    selectAcResult(acActive);
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
});

searchInput.addEventListener('blur', () => setTimeout(hideAutocomplete, 150));

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAutocomplete();
  const q = searchInput.value.trim();
  if (!q) return;
  searchBtn.disabled = true;
  try {
    const results = await geocode(q);
    if (!results.length) { showError('Adresse introuvable'); return; }
    const r = results[0];
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    map.setView([lat, lon], LOCAL_ZOOM);
    placeSearchMarker(lat, lon, r.display_name);
  } catch (err) {
    showError('Erreur de géocodage : ' + err.message);
  } finally {
    searchBtn.disabled = false;
  }
});

/* ===== FILTERS ===== */
function getFilterCount() {
  return activeFilters.types.size + activeFilters.natures.size +
    (activeFilters.publicOnly ? 1 : 0) + (activeFilters.libreOnly ? 1 : 0);
}

function updateFilterBadge() {
  const n = getFilterCount();
  if (n > 0) {
    filterBadge.textContent = n;
    filterBadge.classList.remove('hidden');
    filterBtn.classList.add('is-active');
  } else {
    filterBadge.classList.add('hidden');
    filterBtn.classList.remove('is-active');
  }
}

function filterTerrains(terrains) {
  return terrains.filter(t => {
    if (activeFilters.types.size > 0  && !activeFilters.types.has(t.equip_type_name))    return false;
    if (activeFilters.natures.size > 0 && !activeFilters.natures.has(t.equip_nature))    return false;
    if (activeFilters.publicOnly && t.equip_ouv_public_bool !== 'true')                  return false;
    if (activeFilters.libreOnly  && t.equip_acc_libre       !== 'true')                  return false;
    return true;
  });
}

function readFiltersFromDOM() {
  activeFilters.types   = new Set([...$('[name="ftype"]:checked')].map(el => el.value));
  activeFilters.natures = new Set([...$('[name="fnature"]:checked')].map(el => el.value));
  activeFilters.publicOnly = $('filter-public').checked;
  activeFilters.libreOnly  = $('filter-libre').checked;
}

function $checked(sel) { return document.querySelectorAll(sel); }

function applyAndRender() {
  readFiltersFromDOM();
  updateFilterBadge();
  filteredTerrains = filterTerrains(allTerrains);
  renderTerrains(filteredTerrains);
  if (!listView.classList.contains('hidden')) refreshList();
  filterPanel.classList.add('hidden');
  filterBtn.setAttribute('aria-expanded', 'false');
}

filterBtn.addEventListener('click', () => {
  const open = filterPanel.classList.toggle('hidden') === false;
  filterBtn.setAttribute('aria-expanded', String(open));
});

filterApplyBtn.addEventListener('click', applyAndRender);

filterResetBtn.addEventListener('click', () => {
  $$('[name="ftype"], [name="fnature"]').forEach(el => el.checked = false);
  $('filter-public').checked = false;
  $('filter-libre').checked  = false;
  applyAndRender();
});

/* ===== LIST VIEW ===== */
let sortedListTerrains = [];
let listDisplayCount   = 0;
let listObserver       = null;

function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km) {
  if (km < 0.1)  return '< 100 m';
  if (km < 1)    return `${Math.round(km * 1000)} m`;
  if (km < 10)   return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function buildListCard(t, dist) {
  const addr   = fullAddr(t);
  const badges = buildBadges(t);
  const aps    = Array.isArray(t.aps_name) ? t.aps_name.join(', ') : (t.aps_name || '');
  const rows   = [
    t.equip_type_name && ['Type',        escapeHtml(t.equip_type_name)],
    t.equip_nature    && ['Nature',      escapeHtml(t.equip_nature)],
    t.equip_sol       && ['Sol',         escapeHtml(t.equip_sol)],
    t.equip_surf      && ['Surface',     `${t.equip_surf} m²`],
    t.equip_haut      && ['Hauteur',     `${t.equip_haut} m`],
    t.equip_prop_type && ['Propriétaire',escapeHtml(t.equip_prop_type)],
    aps               && ['Activités',   escapeHtml(aps)]
  ].filter(Boolean);

  const card = document.createElement('div');
  card.className   = 'list-card';
  card.dataset.id  = t.equip_numero;

  card.innerHTML = `
    <div class="list-card-header">
      <div class="list-card-main">
        <div class="list-card-name">${escapeHtml(t.inst_nom || 'Terrain')}</div>
        ${t.equip_nom && t.equip_nom !== t.inst_nom
          ? `<div class="list-card-equip">${escapeHtml(t.equip_nom)}</div>` : ''}
        <div class="list-card-addr">📍 ${escapeHtml(addr) || '<i>Adresse inconnue</i>'}</div>
        <div class="list-card-badges">${badges.join(' ')}</div>
      </div>
      <div class="list-card-aside">
        <span class="list-card-dist">${formatDist(dist)}</span>
        <svg class="list-card-chevron" viewBox="0 0 24 24" width="16" height="16"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
    <div class="list-card-details hidden">
      <dl class="list-dl">
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}
      </dl>
      <button class="btn-open-map" data-id="${escapeHtml(t.equip_numero)}">
        🗺 Ouvrir dans la carte
      </button>
    </div>
  `;

  card.querySelector('.list-card-header').addEventListener('click', () => {
    const details = card.querySelector('.list-card-details');
    const chevron = card.querySelector('.list-card-chevron');
    const opening = details.classList.contains('hidden');
    details.classList.toggle('hidden', !opening);
    chevron.classList.toggle('open', opening);
  });

  card.querySelector('.btn-open-map').addEventListener('click', (e) => {
    e.stopPropagation();
    openInMap(t.equip_numero);
  });

  return card;
}

function appendListItems(n) {
  const center = map.getCenter();
  const frag = document.createDocumentFragment();
  const end = Math.min(listDisplayCount + n, sortedListTerrains.length);
  for (let i = listDisplayCount; i < end; i++) {
    const t    = sortedListTerrains[i];
    const c    = t.equip_coordonnees;
    const dist = haversine(center.lat, center.lng, c.lat, c.lon);
    frag.appendChild(buildListCard(t, dist));
  }
  listContainer.insertBefore(frag, listSentinel);
  listDisplayCount = end;
}

function refreshList() {
  const center = map.getCenter();
  sortedListTerrains = [...filteredTerrains].sort((a, b) => {
    const ca = a.equip_coordonnees, cb = b.equip_coordonnees;
    return haversine(center.lat, center.lng, ca.lat, ca.lon)
         - haversine(center.lat, center.lng, cb.lat, cb.lon);
  });
  listDisplayCount = 0;
  // Remove all existing cards (keep sentinel)
  [...listContainer.children].forEach(child => {
    if (child.id !== 'list-sentinel') child.remove();
  });
  listCount.textContent = `${sortedListTerrains.length.toLocaleString('fr-FR')} terrain(s)`;
  appendListItems(LIST_INITIAL);
}

function initListObserver() {
  if (listObserver) listObserver.disconnect();
  listObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && listDisplayCount < sortedListTerrains.length) {
      appendListItems(LIST_INCREMENT);
    }
  }, { threshold: 0.1 });
  listObserver.observe(listSentinel);
}

function openInMap(equipNumero) {
  const terrain = allTerrains.find(t => t.equip_numero === equipNumero);
  if (!terrain) return;
  const c = terrain.equip_coordonnees;
  switchToMapView();
  map.setView([c.lat, c.lon], 15);
  const marker = markerMap.get(equipNumero);
  if (marker) {
    markerCluster.zoomToShowLayer(marker, () => {
      setTimeout(() => marker.openPopup(), 50);
    });
  }
}

/* ===== VIEW TOGGLE ===== */
let currentView = 'map';

function switchToMapView() {
  if (currentView === 'map') return;
  currentView = 'map';
  listView.classList.add('hidden');
  btnMapView.classList.add('active');
  btnListView.classList.remove('active');
  if (listObserver) listObserver.disconnect();
}

function switchToListView() {
  if (currentView === 'list') return;
  currentView = 'list';
  listView.classList.remove('hidden');
  btnListView.classList.add('active');
  btnMapView.classList.remove('active');
  refreshList();
  initListObserver();
}

btnMapView.addEventListener('click',  switchToMapView);
btnListView.addEventListener('click', switchToListView);

/* ===== DATA LOADING ===== */
async function loadOrFetchTerrains(db, { forceRefresh = false } = {}) {
  let official = forceRefresh ? [] : await dbGetAll(db, DB_STORE);
  let lastSync = await dbGet(db, DB_META, 'lastSync');

  if (!official.length || forceRefresh) {
    showLoading(forceRefresh
      ? 'Mise à jour des données…'
      : 'Premier chargement : téléchargement de tous les terrains (≈ 17 Mo)…');
    official = await fetchAllTerrains();
    await saveTerrains(db, official);
    lastSync = Date.now();
    await dbPut(db, DB_META, lastSync, 'lastSync');
    hideLoading();
  }

  setSyncDate(lastSync);
  const userTerrains = await dbGetAll(db, DB_USER_STORE);
  allTerrains        = official.concat(userTerrains);
  filteredTerrains   = filterTerrains(allTerrains);
  renderTerrains(filteredTerrains);
  updateFilterBadge();
}

/* ===== ADD-TERRAIN MODAL ===== */
let pendingCoords = null;

function setPendingCoords(lat, lon) {
  pendingCoords = { lat, lon };
  addFormCoords.textContent = `📍 Position : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  addFormCoords.classList.add('has-coords');
}

function clearPendingCoords() {
  pendingCoords = null;
  addFormCoords.textContent =
    "Astuce : double-cliquez sur la carte pour pré-remplir la position et l'adresse.";
  addFormCoords.classList.remove('has-coords');
}

function openAddModal() {
  addFormError.textContent = '';
  addModal.classList.remove('hidden');
  setTimeout(() => $('f-inst_nom').focus(), 50);
}

function closeAddModal() { addModal.classList.add('hidden'); }

function resetAddForm() { addForm.reset(); clearPendingCoords(); }

async function openAddModalAtPoint(lat, lon) {
  resetAddForm();
  setPendingCoords(lat, lon);
  openAddModal();
  try {
    const addr = await reverseGeocode(lat, lon);
    if (!pendingCoords || pendingCoords.lat !== lat) return;
    if (addr.adresse) $('f-inst_adresse').value = addr.adresse;
    if (addr.cp)      $('f-inst_cp').value      = addr.cp;
    if (addr.ville)   $('f-new_name').value      = addr.ville;
  } catch (e) { console.warn('reverse geocode failed', e); }
}

function buildTerrainFromForm() {
  const data    = new FormData(addForm);
  const surfRaw = data.get('equip_surf');
  const hautRaw = data.get('equip_haut');
  const id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  return {
    equip_numero: id, inst_numero: id,
    inst_nom:     (data.get('inst_nom')     || '').trim(),
    equip_nom:    (data.get('equip_nom')    || '').trim() || null,
    equip_type_name: data.get('equip_type_name') || null,
    equip_type_famille: 'Boulodrome',
    inst_adresse: (data.get('inst_adresse') || '').trim() || null,
    inst_cp:      (data.get('inst_cp')      || '').trim() || null,
    new_name:     (data.get('new_name')     || '').trim() || null,
    equip_coordonnees: { lat: pendingCoords.lat, lon: pendingCoords.lon },
    equip_prop_type: data.get('equip_prop_type') || null,
    equip_ouv_public_bool: data.get('equip_ouv_public_bool') === 'on' ? 'true' : 'false',
    equip_acc_libre:       data.get('equip_acc_libre')       === 'on' ? 'true' : 'false',
    equip_nature: data.get('equip_nature') || null,
    equip_sol:    data.get('equip_sol')    || null,
    equip_surf:   surfRaw ? parseFloat(surfRaw) : null,
    equip_haut:   hautRaw ? parseFloat(hautRaw) : null,
    aps_name: ['Pétanque et jeu provencal'],
    _user_added:  true,
    _created_at:  Date.now()
  };
}

/* ===== INIT ===== */
async function init() {
  let db;
  try { db = await openDB(); }
  catch (e) { showLoading('Erreur IndexedDB : ' + e.message); return; }

  const geoPromise = tryGeolocate();

  try { await loadOrFetchTerrains(db); }
  catch (e) { hideLoading(); showError('Erreur de chargement : ' + e.message); console.error(e); }

  const geo = await geoPromise;
  if (geo) {
    map.setView([geo.lat, geo.lon], LOCAL_ZOOM);
    placeUserMarker(geo.lat, geo.lon);
  } else {
    map.setView(FRANCE_CENTER, FRANCE_ZOOM);
  }

  /* Update button */
  updateBtn.addEventListener('click', async () => {
    updateBtn.disabled = true;
    try { await loadOrFetchTerrains(db, { forceRefresh: true }); }
    catch (e) { hideLoading(); showError('Erreur mise à jour : ' + e.message); }
    finally   { updateBtn.disabled = false; }
  });

  /* Double-click → add form */
  map.on('dblclick', e => openAddModalAtPoint(e.latlng.lat, e.latlng.lng));

  /* Add button */
  addBtn.addEventListener('click', () => {
    resetAddForm();
    const c = map.getCenter();
    setPendingCoords(c.lat, c.lng);
    openAddModal();
  });

  /* Modal close interactions */
  addModalClose.addEventListener('click', closeAddModal);
  addFormCancel.addEventListener('click', closeAddModal);
  addModal.querySelector('.modal-backdrop').addEventListener('click', closeAddModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !addModal.classList.contains('hidden')) closeAddModal();
    if (e.key === 'Escape' && !filterPanel.classList.contains('hidden')) {
      filterPanel.classList.add('hidden');
      filterBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* Add form submit */
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    addFormError.textContent = '';
    if (!pendingCoords) {
      addFormError.textContent = 'Position manquante. Rouvrez le formulaire ou double-cliquez sur la carte.';
      return;
    }
    if (!$('f-inst_nom').value.trim()) {
      addFormError.textContent = "Le nom de l'installation est obligatoire.";
      return;
    }
    const terrain   = buildTerrainFromForm();
    const submitBtn = addForm.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      await dbPut(db, DB_USER_STORE, terrain);
      allTerrains.push(terrain);
      if (filterTerrains([terrain]).length) {
        filteredTerrains.push(terrain);
        addTerrainMarker(terrain);
      }
      closeAddModal();
    } catch (err) {
      addFormError.textContent = 'Erreur : ' + err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

init();
