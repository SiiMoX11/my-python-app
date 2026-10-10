/* Chirurgie Viscérale A — CHU Oujda — Front-end (vanilla JS, SPA) */
(() => {
'use strict';

// COMPTEUR POSTOPERATOIRE AUTOMATIQUE
function postOpLabel(c) {
  if (c.category !== 'Gestes faits') return String(c.content || '');
  const dayNumber = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const y=Number(match[1]), m=Number(match[2]), d=Number(match[3]);
    const t=new Date(0);t.setUTCFullYear(y,m-1,d);t.setUTCHours(0,0,0,0);
    if(t.getUTCFullYear()!==y || t.getUTCMonth()!==m-1 || t.getUTCDate()!==d)return null;
    return t.getTime()/86400000;
  };
  const start=dayNumber(c.date), end=dayNumber(today());
  if(start===null || end===null)return String(c.content || '') + ' — date du geste à renseigner';
  if(end<start)return String(c.content || '') + ' — geste prévu le ' + fmtDate(c.date);
  const text=String(c.content || '').replace(/^\s*J\s*\d+\s*(?:post\b\s*)?/i,'').replace(/^\s*post\b\s*/i,'').trim();
  return 'J' + Math.round(end-start) + ' post ' + text;
}
function refreshPostOpLabels(){
  if(!S.token || !S.entries)return;
  document.querySelectorAll('[data-postop-id]').forEach(el=>{
    const entry=(S.entries.clinique || []).find(c=>String(c.id)===el.dataset.postopId);
    if(entry)el.textContent=postOpLabel(entry);
  });
}
setInterval(refreshPostOpLabels,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPostOpLabels();});


async function downloadTableauWord() {
  const button = document.querySelector('[data-act="tableau"]');
  if (button) button.disabled = true;
  try {
    toast('Génération du tableau Word…');
    const response = await fetch(API + '/api/tableau/word', {headers:{Authorization:'Bearer ' + S.token}, credentials:'same-origin'});
    if (response.status === 401) {logout(true); throw new Error('Session expirée');}
    if (!response.ok) {
      let message = 'Impossible de générer le tableau';
      try {message = (await response.json()).error || message;} catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const match = (response.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/);
    link.download = match ? match[1].trim() : 'Tableau_service.docx';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('Tableau Word téléchargé');
  } catch (error) {toast(error.message, true);}
  finally {if(button)button.disabled=false;}
}


// Base API : vide quand Flask sert le site ; remplacé par le proxy lors d'un déploiement de prévisualisation
const API = '__PORT_8000__'.startsWith('__') ? '' : '__PORT_8000__';

const S = { token: null, user: null, meta: null, patient: null, entries: null, expanded: new Set() };
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

// ------------------------------------------------------------------ utils
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let clock = {offset_minutes:0, epoch_ms:Date.now(), synced:performance.now()};
const clockDate = () => new Date(clock.epoch_ms + performance.now()-clock.synced + clock.offset_minutes*60000);
const today = () => clockDate().toISOString().slice(0,10);
async function syncClock() {clock={...await api('/api/clock'), synced:performance.now()};}
const fmtDate = (d) => { if (!d) return ''; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : d; };
const fmtTs = (t) => { if (!t) return ''; const [d, h] = t.split(' '); return `${fmtDate(d)} ${h ? h.slice(0, 5) : ''}`; };
const bedLabel = (p) => p.room ? `${p.room}${p.position || ''}` : (p.hors_service ? 'Hors service' : '—');

function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = ''), 2600);
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let body = opts.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const res = await fetch(API + path, { method: opts.method || 'GET', headers, body, credentials: 'same-origin' });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && path !== '/api/login') { logout(true); throw new Error(data.error || 'Session expirée'); }
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ------------------------------------------------------------------ icons
const I = {
  menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  logout: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  cross: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" rx="2"/></svg>',
  bed: (s = 28) => `<svg width="${s}" height="${s * .75}" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18M3 15h26v6M29 15v-3a3 3 0 0 0-3-3H14v6"/><circle cx="8.5" cy="10" r="2.3"/></svg>`,
  bigBed: '<svg width="124" height="90" viewBox="0 0 124 90" fill="none"><rect x="4" y="6" width="7" height="80" rx="3" fill="#1d62a0"/><rect x="113" y="50" width="7" height="36" rx="3" fill="#1d62a0"/><rect x="4" y="54" width="116" height="8" rx="3" fill="#1d62a0"/><circle cx="30" cy="31" r="10" fill="#1d62a0"/><rect x="16" y="42" width="30" height="10" rx="4" fill="#7ac4bf"/><path d="M50 30h52a14 14 0 0 1 14 14v8H50z" fill="#1d62a0"/></svg>',
  folder: '<svg width="44" height="40" viewBox="0 0 24 22" fill="none" stroke="#1b2b3c" stroke-width="1.6" stroke-linejoin="round"><path d="M2 5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2"/><path d="M2 5v13a1 1 0 0 0 1 1h16l3-9H6l-3 8"/></svg>',
  hosp: '<svg width="36" height="32" viewBox="0 0 36 32" fill="none" stroke="#1d4673" stroke-width="2.2" stroke-linejoin="round"><path d="M4 30V12L18 3l14 9v18z"/><path d="M18 9v8M14 13h8" stroke-linecap="round"/><path d="M8 30v-6h20v6M8 24h20" /></svg>',
  plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  chev: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9fb0c4" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M6 14l6 6 6-6"/></svg>',
  up: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M6 10l6-6 6 6"/></svg>',
  arrL: '<svg viewBox="0 0 52 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M50 15H4M16 3L4 15l12 12"/></svg>',
  arrR: '<svg viewBox="0 0 52 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15h46M36 3l12 12-12 12"/></svg>',
  arrU: '<svg viewBox="0 0 30 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 50V4M3 16L15 4l12 12"/></svg>',
};

// ------------------------------------------------------------------ auth
function logout(silent) {
  if (S.token && !silent) api('/api/logout', { method: 'POST' }).catch(() => {});
  S.token = null; S.user = null; S.meta = null; S.patient = null; S.entries = null; store.set('cva_token', null);
  closeModal(); location.hash = '#/login'; render();
}

function viewLogin() {
  $('#app').innerHTML = `
  <main class="login">
    <img src="./static/logo.png" alt="Chirurgie Viscérale A — CHU Oujda" width="657" height="259">
    <section class="login-card" aria-labelledby="lg">
      <h1 id="lg">LOGIN</h1>
      <form id="login-form" autocomplete="on">
        <input class="pill" name="username" placeholder="Username" aria-label="Nom d'utilisateur" autocomplete="username" required>
        <input class="pill" name="password" type="password" placeholder="Password" aria-label="Mot de passe" autocomplete="current-password" required>
        <div class="login-err" id="login-err"></div>
        <button class="btn-login" type="submit">LOG IN</button>
      </form>
    </section>
    
  </main>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#login-err').textContent = '';
    try {
      const r = await api('/api/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
      S.token = r.token; S.user = r.user; store.set('cva_token', r.token);
      location.hash = '#/home';
    } catch (err) { $('#login-err').textContent = err.message; }
  });
}

// ------------------------------------------------------------------ chrome
function topbar() {
  return `
  <header class="topbar no-print">
    <div class="left">
      <button class="icon-btn" id="menu-btn" aria-label="Menu">${I.menu}</button>
      <span class="clock" id="clock"></span>
    </div>
    <h1>Chirurgie viscérale A</h1>
    <div class="right">
      <div class="search-box">
        <input id="search" type="search" placeholder="Rechercher nom / IP" aria-label="Rechercher un patient" autocomplete="off">
        <div class="search-res hidden" id="search-res"></div>
      </div>
      <span class="username">${esc(S.user?.username || '')}</span>
      <button class="icon-btn" id="logout-btn" aria-label="Se déconnecter" title="Se déconnecter">${I.logout}</button>
    </div>
  </header>
  <nav class="menu-panel" id="menu">
    <button data-go="#/home">Plan du service</button>
    <button data-act="tableau">Tableau</button>
    <button data-act="admit">Admettre un patient</button>
    <button data-act="hs">Dossiers hors service</button>
    <button data-go="#/archives">Patients sortis (archives)</button>
    ${S.user?.role === 'admin' ? '<div class="sep"></div><button data-go="#/users">Utilisateurs</button><button data-go="#/journal">Journal global</button><button data-act="clock">Date et heure</button>' : ''}
    <div class="sep"></div>
<button data-act="logout">Se déconnecter</button>
  </nav>`;
}

function bindChrome() {
  const tick = () => { const c = $('#clock'); if (!c) return; const d = clockDate(); c.textContent = `${d.toLocaleDateString('fr-FR',{timeZone:'UTC'})}   ${d.toLocaleTimeString('fr-FR', {timeZone:'UTC', hour:'2-digit', minute:'2-digit'})} UTC${clock.offset_minutes ? ' (corrigé)' : ''}`; };
  tick(); clearInterval(bindChrome._i); bindChrome._i = setInterval(tick, 15000);
  $('#logout-btn').onclick = () => logout();
  const menu = $('#menu');
  $('#menu-btn').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
  document.onclick = (e) => {
    if (!menu.contains(e.target)) menu.classList.remove('open');
    if (!e.target.closest('.search-box')) $('#search-res')?.classList.add('hidden');
  };
  menu.querySelectorAll('button').forEach(b => b.onclick = () => {
    menu.classList.remove('open');
    if (b.dataset.go) location.hash = b.dataset.go;
    if (b.dataset.act === 'admit') admitForm({});
    if (b.dataset.act === 'hs') openHorsService();
    if (b.dataset.act === 'logout') logout();
    if (b.dataset.act === 'tableau') downloadTableauWord();
    if (b.dataset.act === 'profile') profileForm();
    if (b.dataset.act === 'clock') clockForm();
  });
  const inp = $('#search'), res = $('#search-res');
  let t;
  inp.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = inp.value.trim();
      if (q.length < 2) { res.classList.add('hidden'); return; }
      const r = await api('/api/search?q=' + encodeURIComponent(q));
      res.innerHTML = r.patients.length ? r.patients.map(p => `<button data-id="${p.id}"><b>${esc(p.nom)} ${esc(p.prenom)}</b> <small>IP ${esc(p.ip)} · ${p.status === 'sorti' ? 'Sorti' : esc(bedLabel(p))}</small><br><small>${esc(p.motif)}</small></button>`).join('') : '<div class="empty">Aucun résultat</div>';
      res.classList.remove('hidden');
      res.querySelectorAll('button').forEach(b => b.onclick = () => { res.classList.add('hidden'); inp.value = ''; location.hash = `#/patient/${b.dataset.id}/maj`; });
    }, 220);
  };
}

// ------------------------------------------------------------------ home
const LAYOUT = { tl: ['213', '212', '211', '210'], tr: ['209', '208', '207', '206'], bl: ['214', '215', '216', '217', '218'], br: ['201', '202', '203', '204', '205'] };

async function viewHome() {
  $('#app').innerHTML = topbar() + `<main class="home"><div class="map" id="map"><div class="empty">Chargement du plan…</div></div></main>`;
  bindChrome();
  const r = await api('/api/rooms');
  const by = Object.fromEntries(r.rooms.map(x => [x.room, x]));
  const roomBtn = (n) => {
    const b = by[n].beds, c = (b.F ? 1 : 0) + (b.P ? 1 : 0);
    return `<button class="room ${c ? 'occ' : ''}" data-room="${n}" aria-label="Chambre ${n}, ${c} patient(s) sur 2">
      <span class="cnt">${c}/2</span><span>CH ${n}</span><span class="cross">${I.cross}</span><span>${I.bed(28)}</span></button>`;
  };
  $('#map').innerHTML = `
    <section class="wing top">
      <div class="rooms">${LAYOUT.tl.map(roomBtn).join('')}</div>
      <button class="hs-table" id="hs-btn" aria-label="Table des dossiers hors service">
        <span>dossiers hors-service</span>
        <div class="tbl">${I.folder}${r.hors_service_count ? `<span class="badge">${r.hors_service_count}</span>` : ''}</div>
      </button>
      <div class="rooms">${LAYOUT.tr.map(roomBtn).join('')}</div>
    </section>
    <div class="corridor-h" aria-hidden="true">${I.arrL}${I.arrR}</div>
    <section class="bottom">
      <div class="rooms">${LAYOUT.bl.map(roomBtn).join('')}</div>
      <div class="corridor-v" aria-hidden="true">${I.arrU}</div>
      <div class="rooms">${LAYOUT.br.map(roomBtn).join('')}</div>
    </section>
    <div class="legend"><span><b style="background:var(--teal-tint)"></b>Chambre occupée</span><span><b style="background:#f3f5f9"></b>Chambre libre</span></div>`;
  $('#map').querySelectorAll('.room').forEach(b => b.onclick = () => openRoom(b.dataset.room, by[b.dataset.room]));
  $('#hs-btn').onclick = openHorsService;
}

// ------------------------------------------------------------------ modals
function closeModal() { $('#modal-root').innerHTML = ''; document.onkeydown = null; }
function modal(html, cls = '') {
  $('#modal-root').innerHTML = `<div class="overlay" id="ov"><div class="dialog ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  const ov = $('#ov');
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(); });
  document.onkeydown = (e) => { if (e.key === 'Escape') closeModal(); };
  return ov;
}

function bedCard(p, label, isLoc, emptyAction) {
  if (!p) return `<button class="bed empty" data-empty="${esc(emptyAction)}">
      <div class="bed-ico">${label ? `<b>${esc(label)}</b>` : ''}${I.bigBed}</div>
      <div class="bed-info">Lit libre<br><small>Cliquer pour admettre un patient</small></div>
      <div class="bed-go"><div class="row">${I.plus}</div>Admettre</div></button>`;
  return `<button class="bed" data-pid="${p.id}">
      <div class="bed-ico ${isLoc ? 'loc' : ''}">${isLoc ? esc(label) : `<b>${esc(label)}</b>${I.bigBed}`}</div>
      <div class="bed-info">Patient : ${esc(p.nom)} ${esc(p.prenom)}<br>IP : ${esc(p.ip)}<br>Motif : ${esc(p.motif)}</div>
      <div class="bed-go"><div class="row">${I.bed(58)}${I.chev}</div>Cliquer pour voir<br>la fiche</div></button>`;
}

function bindBeds(ov) {
  ov.querySelectorAll('.bed[data-pid]').forEach(b => b.onclick = () => { closeModal(); location.hash = `#/patient/${b.dataset.pid}/maj`; });
  ov.querySelectorAll('.bed[data-empty]').forEach(b => b.onclick = () => {
    const [room, position] = b.dataset.empty.split('|');
    room === 'HS' ? admitForm({ hors_service: ' ' }) : admitForm({ room, position });
  });
  ov.querySelector('.btn-back').onclick = closeModal;
}

function openRoom(n, data) {
  const ov = modal(`
    <div class="dialog-head"><div><h2>CHAMBRE ${esc(n)} ${I.hosp}</h2><p>Détails de la chambre</p></div>
      <button class="btn-back">&lt; Retour à l'accueil</button></div>
    <div class="dialog-body">${bedCard(data.beds.F, 'F', false, `${n}|F`)}${bedCard(data.beds.P, 'P', false, `${n}|P`)}</div>`);
  bindBeds(ov);
}

async function openHorsService() {
  const r = await api('/api/hors-service');
  const ov = modal(`
    <div class="dialog-head"><div><h2>Hors Service ${I.hosp}</h2><p>Patients hébergés dans d'autres services</p></div>
      <button class="btn-back">&lt; Retour à l'accueil</button></div>
    <div class="dialog-body">${r.patients.map(p => bedCard(p, p.hors_service, true)).join('') || '<div class="empty">Aucun patient hors service.</div>'}
      ${bedCard(null, '', false, 'HS|')}</div>`);
  bindBeds(ov);
}

/* Formulaire générique : fields = [{name,label,type,options,full,required,placeholder}] */
function formModal({ title, fields, values = {}, submit = 'Enregistrer', onSubmit, onDelete, extra = '' }) {
  const fld = (f) => {
    const v = values[f.name] ?? f.default ?? '';
    let input;
    if (f.type === 'textarea') input = `<textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>${esc(v)}</textarea>`;
    else if (f.type === 'select') input = `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
    else if (f.type === 'datalist') input = `<input name="${f.name}" list="dl-${f.name}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}><datalist id="dl-${f.name}">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
    else if (f.type === 'checkbox') input = `<label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:15px;color:var(--ink);font-weight:500"><input type="checkbox" name="${f.name}" style="width:auto" ${v ? 'checked' : ''}> ${esc(f.hint || '')}</label>`;
    else if (f.type === 'file') input = `<input type="file" name="${f.name}" accept="${esc(f.accept || '')}">`;
    else input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>`;
    return `<div class="field ${f.full ? 'full' : ''}" data-f="${f.name}"><label>${esc(f.label)}</label>${input}</div>`;
  };
  const ov = modal(`
    <div class="dialog-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <form class="dialog-body" id="mform" novalidate>
      ${extra}
      <div class="fgrid">${fields.map(fld).join('')}</div>
      <div class="form-err" id="ferr"></div>
      <div class="form-actions">
        ${onDelete ? '<button type="button" class="btn danger" data-del>Supprimer</button>' : ''}
        <div class="r"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit">${esc(submit)}</button></div>
      </div>
    </form>`, 'form-dialog');
  ov.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  const form = $('#mform');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const out = {};
    fields.forEach(f => {
      const el = form.elements[f.name];
      if (!el) return;
      out[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'file' ? el.files[0] : el.value;
    });
    const miss = fields.find(f => f.required && !String(out[f.name] ?? '').trim());
    if (miss) { $('#ferr').textContent = `Champ obligatoire : ${miss.label}`; return; }
    try { await onSubmit(out, form); closeModal(); } catch (err) { $('#ferr').textContent = err.message; }
  };
  if (onDelete) ov.querySelector('[data-del]').onclick = async () => {
    if (!confirm('Confirmer la suppression ?')) return;
    try { await onDelete(); closeModal(); } catch (err) { $('#ferr').textContent = err.message; }
  };
  setTimeout(() => form.querySelector('input:not([type=checkbox]),textarea,select')?.focus(), 50);
  return form;
}

// Emplacement : chambre+lit ou hors service
function locationFields(meta) {
  return [
    { name: 'loc_type', label: 'Emplacement', type: 'select', options: [['room', 'Chambre du service'], ['hs', 'Hors service (hébergé ailleurs)']] },
    { name: 'room', label: 'Chambre', type: 'select', options: [['', '—'], ...meta.rooms.map(r => [r, 'CH ' + r])] },
    { name: 'position', label: 'Lit', type: 'select', options: [['', '—'], ['F', 'F — côté fenêtre'], ['P', 'P — côté porte']] },
    { name: 'hors_service', label: 'Service d\'hébergement', type: 'datalist', full: true, placeholder: 'ex. Service Réanimation Brûlés BOX 2', options: ['Service Réanimation Brûlés', 'Service HGE', 'Réanimation chirurgicale', 'Réanimation médicale', 'Urgences', 'Cardiologie', 'Néphrologie'] },
  ];
}
function bindLocToggle(form) {
  const sync = () => {
    const hs = form.elements.loc_type.value === 'hs';
    ['room', 'position'].forEach(n => form.querySelector(`[data-f=${n}]`).classList.toggle('hidden', hs));
    form.querySelector('[data-f=hors_service]').classList.toggle('hidden', !hs);
  };
  form.elements.loc_type.onchange = sync; sync();
}
function locPayload(v) {
  return v.loc_type === 'hs' ? { hors_service: v.hors_service.trim(), room: null, position: null } : { hors_service: '', room: v.room, position: v.position };
}

function admitForm(pre) {
  const m = S.meta;
  const values = { ...pre, loc_type: pre.hors_service ? 'hs' : 'room', hors_service: (pre.hors_service || '').trim(), date_entree: today() };
  const form = formModal({
    title: 'Admettre un patient',
    submit: 'Admettre',
    values,
    fields: [
      { name: 'nom', label: 'Nom', required: true }, { name: 'prenom', label: 'Prénom' },
      { name: 'age', label: 'Âge', type: 'number' }, { name: 'ip', label: 'IP', required: true },
      { name: 'mutuelle', label: 'Mutuelle', type: 'select', options: m.mutuelles }, { name: 'groupe', label: 'Groupe sanguin', type: 'select', options: m.groupes },
      { name: 'motif', label: 'Motif d\'hospitalisation', full: true, placeholder: 'ex. AVP, Cholécystectomie…' },
      { name: 'date_entree', label: 'Date d\'entrée', type: 'date' },
      ...locationFields(m),
    ],
    onSubmit: async (v) => {
      if (v.loc_type === 'hs' && !v.hors_service.trim()) throw new Error('Indiquez le service d\'hébergement.');
      if (v.loc_type === 'room' && (!v.room || !v.position)) throw new Error('Choisissez la chambre et le lit.');
      const { loc_type, ...rest } = v;
      const r = await api('/api/patients', { method: 'POST', body: { ...rest, ...locPayload(v) } });
      toast('Patient admis'); location.hash = `#/patient/${r.id}/maj`;
    },
  });
  bindLocToggle(form);
}

// ------------------------------------------------------------------ patient
const TABS = [['maj', 'MAJ'], ['obsrv', 'OBSRV'], ['ttt', 'TTT'], ['videos', 'VIDEOS'], ['anapath', 'ANAPATH'], ['sortie', 'SORTIE'], ['logs', 'LOGS']];
const EXAM_TYPES = ['TDM', 'IRM', 'Bili-IRM', 'Échographie', 'Radiographie', 'Coloscopie', 'FOGD', 'Écho-endoscopie', 'CPRE', 'Anapath', 'Cytologie', 'Scintigraphie', 'Autre'];
const CLIN_CATS = ['Gestes faits', 'Surveillance clinique', 'Constantes', 'Drains'];
const ATCD_CATS = ['Médicaux', 'Chirurgicaux', 'Gynéco-obstétricaux', 'Toxiques', 'Allergies', 'Familiaux'];
const SPECIALITES = ['Anesthésie-Réanimation', 'Réanimation médicale', 'Réanimation chirurgicale', 'Médecine intensive', 'Médecine d’urgence', 'Médecine interne', 'Médecine générale', 'Cardiologie', 'Rythmologie', 'Cardiologie interventionnelle', 'Pneumologie', 'Gastro-entérologie', 'Hépatologie', 'Néphrologie', 'Endocrinologie', 'Diabétologie', 'Nutrition', 'Neurologie', 'Rhumatologie', 'Dermatologie', 'Allergologie', 'Immunologie clinique', 'Hématologie', 'Oncologie médicale', 'Radiothérapie', 'Maladies infectieuses', 'Gériatrie', 'Pédiatrie', 'Néonatologie', 'Psychiatrie', 'Pédopsychiatrie', 'Médecine physique et réadaptation', 'Médecine de la douleur', 'Soins palliatifs', 'Médecine du travail', 'Médecine du sport', 'Médecine légale', 'Santé publique', 'Chirurgie générale', 'Chirurgie viscérale et digestive', 'Chirurgie hépatobiliaire et pancréatique', 'Chirurgie colorectale', 'Chirurgie oncologique', 'Chirurgie thoracique', 'Chirurgie cardiovasculaire', 'Chirurgie vasculaire', 'Chirurgie orthopédique et traumatologique', 'Neurochirurgie', 'Chirurgie pédiatrique', 'Chirurgie plastique et reconstructrice', 'Chirurgie maxillo-faciale', 'Chirurgie orale', 'Urologie', 'Gynécologie-Obstétrique', 'Gynécologie', 'Obstétrique', 'Ophtalmologie', 'ORL', 'Radiologie', 'Radiologie interventionnelle', 'Médecine nucléaire', 'Anatomie et cytologie pathologiques', 'Biologie médicale', 'Microbiologie', 'Biochimie', 'Génétique médicale', 'Pharmacologie clinique', 'Autre'];

async function loadPatient(id) {
  const r = await api('/api/patients/' + id);
  S.patient = r.patient; S.entries = r.entries;
}

async function viewPatient(id, tab) {
  if (!S.patient || String(S.patient.id) !== String(id) || !$('#pmain')) {
    $('#app').innerHTML = topbar() + `<main class="patient"><div class="empty">Chargement du dossier…</div></main>`;
    bindChrome();
    await loadPatient(id);
  }
  const p = S.patient;
  $('#app').querySelector('main').outerHTML = `
  <main class="patient" id="pmain">
    <div class="tabsbar no-print">
      <button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button>
      <nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join('')}</nav>
    </div>
    <div class="pbody">
      <aside class="consignes no-print">
        <div class="col-head">CONSIGNES <button class="plus" id="add-cons" aria-label="Ajouter une consigne">${I.plus}</button></div>
        <div class="cons-list" id="cons-list"></div>
      </aside>
      <section class="main">
        <div class="idbar">
          <div class="ids">
            <span><b>${esc(p.nom)} ${esc(p.prenom)}</b></span>
            <span>${p.age != null ? esc(p.age) + ' ans' : '— ans'}</span>
            <span>IP : ${esc(p.ip)}</span>
            <span>${esc(p.mutuelle || '—')}</span>
            <span>${esc(p.groupe || '—')}</span>
            ${p.status === 'sorti' ? '<span class="status-pill">Sorti</span>' : ''}
            <button class="plus edit no-print" id="edit-id" aria-label="Modifier l'identité et l'emplacement" title="Modifier identité / emplacement">${I.plus}</button>
          </div>
          <div class="roomno">${p.status === 'sorti' ? 'Sorti' : p.room ? esc(p.room + (p.position || '')) : `<small>${esc(p.hors_service)}</small>`}</div>
        </div>
        <div id="tab-content" style="min-height:0;display:grid"></div>
      </section>
    </div>
  </main>`;
  $('#home-btn').onclick = () => (location.hash = '#/home');
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => (location.hash = `#/patient/${p.id}/${b.dataset.tab}`));
  $('#add-cons').onclick = () => entryForm('consigne');
  $('#edit-id').onclick = editIdentity;
  renderConsignes();
  renderTab(tab);
}

async function refresh() {
  await loadPatient(S.patient.id);
  const tab = (location.hash.split('/')[3]) || 'maj';
  viewPatient(S.patient.id, tab);
}

function renderConsignes() {
  const list = S.entries.consigne || [];
  const todo = list.filter(c => !c.done), done = list.filter(c => c.done);
  const row = (c) => `<div class="cons ${c.done ? 'done' : 'todo'}"><input type="checkbox" data-id="${c.id}" ${c.done ? 'checked' : ''} aria-label="Valider la consigne"><span class="txt" data-edit="${c.id}">${esc(c.content)}<small>${fmtDate(c.updated_at)}</small></span></div>`;
  $('#cons-list').innerHTML = (todo.map(row).join('') || '<div class="empty">Aucune consigne à faire</div>') + (done.length ? `<div class="cons-sep">VALIDÉES (${done.length})</div>` + done.map(row).join('') : '');
  $('#cons-list').querySelectorAll('input').forEach(i => i.onchange = async () => {
    await api('/api/entries/' + i.dataset.id, { method: 'PUT', body: { done: i.checked } });
    toast(i.checked ? 'Consigne validée' : 'Consigne remise à faire'); refresh();
  });
  $('#cons-list').querySelectorAll('[data-edit]').forEach(s => s.onclick = () => entryForm('consigne', list.find(c => String(c.id) === s.dataset.edit)));
}

const ENTRY_DEF = {
  consigne: { t: 'consigne', f: [{ name: 'content', label: 'Consigne', full: true, required: true, placeholder: 'ex. DEMANDER BILAN' }, { name: 'done', label: 'Statut', type: 'checkbox', hint: 'Déjà faite (validée)', full: true }] },
  atcd: { t: 'antécédent', f: [{ name: 'category', label: 'Catégorie', type: 'select', options: ATCD_CATS }, { name: 'content', label: 'Antécédent', type: 'textarea', full: true, required: true }] },
  clinique: { t: 'élément clinique', f: [{ name: 'category', label: 'Catégorie', type: 'select', options: CLIN_CATS }, { name: 'date', label: 'Date', type: 'date', default: today() }, { name: 'content', label: 'Contenu', type: 'textarea', full: true, required: true, placeholder: 'ex. TA 12/8 - FC 80 - T° 37.2 / Drain : 50 cc séreux' }] },
  bilan: { t: 'bilan', f: [{ name: 'date', label: 'Date du bilan', type: 'date', default: today(), required: true }, { name: 'content', label: 'Résultats (une ligne par paramètre)', type: 'textarea', full: true, required: true, placeholder: 'Alb : 34\nGB : 6660\nHB : 13.1\nPlq : 196k\nTP : 74\nCRP : 40' }] },
  examen: { t: 'examen complémentaire', f: [{ name: 'category', label: 'Type', type: 'select', options: EXAM_TYPES }, { name: 'date', label: 'Date', type: 'date', default: today(), required: true }, { name: 'title', label: 'Intitulé / lieu', full: true, placeholder: 'ex. TDM TAP — CHU Oujda' }, { name: 'content', label: 'Conclusion', type: 'textarea', full: true, required: true }, { name: 'details', label: 'Détails du compte rendu', type: 'textarea', full: true }] },
  avis: { t: 'avis spécialisé', f: [{ name: 'category', label: 'Spécialité', type: 'datalist', options: SPECIALITES, required: true }, { name: 'date', label: 'Date', type: 'date', default: today(), required: true }, { name: 'content', label: 'Avis', type: 'textarea', full: true, required: true }] },
  observation: { t: 'observation', f: [{ name: 'date', label: 'Date', type: 'date', default: today(), required: true }, { name: 'title', label: 'Titre (optionnel)', placeholder: 'ex. J2 post-op' }, { name: 'content', label: 'Observation', type: 'textarea', full: true, required: true }] },
  traitement: { t: 'traitement', f: [{ name: 'title', label: 'Médicament', required: true }, { name: 'category', label: 'Classe', type: 'datalist', options: ['Antibiotique', 'Antalgique', 'Anticoagulant', 'IPP', 'Antiémétique', 'Solutés', 'Insuline', 'Antihypertenseur', 'Autre'] }, { name: 'content', label: 'Posologie / voie', full: true, required: true, placeholder: 'ex. 1 g x 3/j IV' }, { name: 'date', label: 'Date de début', type: 'date', default: today() }, { name: 'done', label: 'Statut', type: 'checkbox', hint: 'Traitement arrêté' }, { name: 'details', label: 'Remarques', type: 'textarea', full: true }] },
  video: { t: 'vidéo', f: [{ name: 'title', label: 'Titre', required: true, placeholder: 'ex. Cholécystectomie cœlioscopique' }, { name: 'date', label: 'Date', type: 'date', default: today() }, { name: 'content', label: 'Lien (URL) de la vidéo', full: true, placeholder: 'https://… (ou importer un fichier ci-dessous)' }, { name: 'file', label: 'Ou importer un fichier (mp4, webm, mov, image)', type: 'file', accept: 'video/*,image/*', full: true }, { name: 'details', label: 'Description', type: 'textarea', full: true }] },
};

function entryForm(kind, entry, preset = {}) {
  const def = ENTRY_DEF[kind];
  formModal({
    title: (entry ? 'Modifier ' : 'Ajouter ') + def.t,
    fields: def.f.filter(f => !(entry && f.type === 'file')),
    values: entry || preset,
    onSubmit: async (v) => {
      if (kind === 'video' && v.file) {
        const fd = new FormData(); fd.append('file', v.file); fd.append('title', v.title); fd.append('date', v.date); fd.append('details', v.details || '');
        await api(`/api/patients/${S.patient.id}/upload`, { method: 'POST', body: fd });
      } else {
        delete v.file;
        if (kind === 'video' && !v.content) throw new Error('Ajoutez un lien ou un fichier.');
        if (entry) await api('/api/entries/' + entry.id, { method: 'PUT', body: v });
        else await api(`/api/patients/${S.patient.id}/entries`, { method: 'POST', body: { kind, ...v } });
      }
      toast(entry ? 'Modification enregistrée' : 'Ajout enregistré'); refresh();
    },
    onDelete: entry ? async () => { await api('/api/entries/' + entry.id, { method: 'DELETE' }); toast('Supprimé'); refresh(); } : null,
  });
}

function editIdentity() {
  const p = S.patient, m = S.meta;
  const form = formModal({
    title: 'Identité, motif & emplacement',
    values: { ...p, loc_type: p.hors_service ? 'hs' : 'room' },
    fields: [
      { name: 'nom', label: 'Nom', required: true }, { name: 'prenom', label: 'Prénom' },
      { name: 'age', label: 'Âge', type: 'number' }, { name: 'ip', label: 'IP', required: true },
      { name: 'mutuelle', label: 'Mutuelle', type: 'select', options: m.mutuelles }, { name: 'groupe', label: 'Groupe sanguin', type: 'select', options: m.groupes },
      { name: 'motif', label: 'Motif', full: true }, { name: 'date_entree', label: 'Date d\'entrée', type: 'date' },
      ...(p.status === 'sorti' ? [] : locationFields(m)),
    ],
    onSubmit: async (v) => {
      const { loc_type, ...rest } = v;
      let body = rest;
      if (p.status !== 'sorti') {
        if (loc_type === 'hs' && !v.hors_service.trim()) throw new Error('Indiquez le service d\'hébergement.');
        if (loc_type === 'room' && (!v.room || !v.position)) throw new Error('Choisissez la chambre et le lit.');
        body = { ...rest, ...locPayload(v) };
      }
      await api('/api/patients/' + p.id, { method: 'PUT', body });
      toast('Dossier mis à jour'); refresh();
    },
  });
  if (p.status !== 'sorti') bindLocToggle(form);
}

const plusBtn = (kind, label) => `<button class="plus" data-add="${kind}" aria-label="Ajouter ${label}">${I.plus}</button>`;
function bindItems(root) {
  root.querySelectorAll('[data-add]').forEach(b => b.onclick = (e) => { e.stopPropagation(); entryForm(b.dataset.add, null, b.dataset.preset ? JSON.parse(b.dataset.preset) : {}); });
  const isMaj = ((location.hash.split('/')[3]) || 'maj') === 'maj';
  root.querySelectorAll('[data-eid]').forEach(el => {
    const edit = () => {
      const [kind, id] = el.dataset.eid.split(':');
      const item = (S.entries[kind] || []).find(x => String(x.id) === id);
      if (item) entryForm(kind, item);
    };
    if (isMaj) {
      el.onclick = null;
      el.classList.add('maj-read-only');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'maj-edit-pencil no-print';
      button.textContent = '✎'; button.title = 'Modifier cet élément';
      button.setAttribute('aria-label', 'Modifier cet élément');
      button.onclick = event => {event.stopPropagation(); edit();};
      el.prepend(button);
    } else {
      el.onclick = event => {
        if (event.target.closest('.tog, a, video')) return;
        edit();
      };
    }
  });
  if (isMaj) {
    const motif = root.querySelector('#motif-edit');
    if (motif) {
      motif.onclick = null;
      motif.classList.add('maj-read-only');
      const hint = motif.querySelector('small');
      if (hint) hint.textContent = hint.textContent.replace(/\s*·\s*cliquer pour modifier/, '');
      const button = document.createElement('button');
      button.type = 'button';button.className = 'maj-edit-pencil no-print';
      button.textContent = '✎';button.title = 'Modifier le motif';
      button.setAttribute('aria-label','Modifier le motif');
      button.onclick = event => {event.stopPropagation();editIdentity();};
      motif.prepend(button);
    }
  }
  root.querySelectorAll('.tog').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.tog; S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
    renderTab((location.hash.split('/')[3]) || 'maj');
  });
}
const meta = (e) => `<span class="meta">${fmtDate(e.updated_at)}</span>`;
const sortByDate = (arr) => [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);

function examItem(e) {
  const open = S.expanded.has(String(e.id));
  const head = `${esc((e.title || e.category || '').toUpperCase())} LE ${fmtDate(e.date)}`;
  return `<div class="item exam" data-eid="examen:${e.id}">
    <span class="t">${head} :</span><span class="c">${esc(e.content)}</span>
    ${e.details ? (open
      ? `<div class="det"><span class="det-lbl">DÉTAILS :</span><br>${esc(e.details)}</div><button class="tog" data-tog="${e.id}" aria-label="Réduire">${I.up}</button>`
      : `<button class="tog" data-tog="${e.id}" aria-label="Voir les détails">${I.down}</button>`) : ''}
    ${meta(e)}</div>`;
}

function renderTab(tab) {
  const box = $('#tab-content'), E = S.entries, p = S.patient;
  if (tab === 'maj') {
    const atcds = E.atcd || [];
    const atcdHtml = atcds.map(a => `<div class="item center" data-eid="atcd:${a.id}" style="border-bottom:none;padding:6px 14px">${esc(a.content)}</div>`).join('');
    const clin = [...(E.clinique || [])].sort((a, b) => {
      const rank = (e) => e.category === 'Gestes faits' ? 0 : e.category === 'Drains' ? 1 : 2;
      return rank(a) - rank(b)
        || (b.date || '').localeCompare(a.date || '')
        || b.id - a.id;
    });
    box.innerHTML = `<div class="cols">
      <div class="col"><div class="col-head">Motif ${plusBtn('atcd', 'un antécédent')}</div>
        <div class="col-body">
          <div class="motif-block" id="motif-edit"><div class="m">${esc(p.motif || '—')}</div><small>Entrée le ${fmtDate(p.date_entree)} · cliquer pour modifier</small></div>
          <div class="atcd-cat" style="text-align:center;font-size:15px;text-transform:none;letter-spacing:0;color:var(--ink)">ATCDs :</div>
          ${atcdHtml || '<div class="empty">Aucun antécédent renseigné</div>'}
        </div></div>
      <div class="col"><div class="col-head">clinique ${plusBtn('clinique', 'un élément clinique')}</div>
        <div class="col-body">${clin.map(c => `<div class="item center" data-eid="clinique:${c.id}"><span class="cat-tag">${esc(c.category)}</span><br>${c.category === 'Gestes faits' ? `<span data-postop-id="${c.id}">${esc(postOpLabel(c))}</span>` : esc(c.content)}<span class="meta">${fmtDate(c.date)}</span></div>`).join('') || '<div class="empty">Gestes, surveillance, constantes, drains…</div>'}</div></div>
      <div class="col"><div class="col-head">Bilan ${plusBtn('bilan', 'un bilan')}</div>
        <div class="col-body">${sortByDate(E.bilan || []).map(b => `<div class="item" data-eid="bilan:${b.id}"><span class="k">${fmtDate(b.date)} :</span>\n${esc(b.content)}${meta(b)}</div>`).join('') || '<div class="empty">Aucun bilan</div>'}</div></div>
      <div class="col"><div class="col-head">Examen complémentaires ${plusBtn('examen', 'un examen')}</div>
        <div class="col-body">${sortByDate(E.examen || []).map(examItem).join('') || '<div class="empty">TDM, IRM, coloscopie, anapath…</div>'}</div></div>
      <div class="col"><div class="col-head">Avis ${plusBtn('avis', 'un avis')}</div>
        <div class="col-body">${sortByDate(E.avis || []).map(a => `<div class="item avis" data-eid="avis:${a.id}"><span class="t">${fmtDate(a.date)}<br>Avis ${esc(a.category)} :</span><span class="c">${esc(a.content)}</span>${meta(a)}</div>`).join('') || '<div class="empty">Aucun avis spécialisé</div>'}</div></div>
    </div>`;
    $('#motif-edit').onclick = editIdentity;
  } else if (tab === 'obsrv') {
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Observations médicales</h3><button class="btn primary" data-add="observation">+ Nouvelle observation</button></div>
      <div class="timeline">${sortByDate(E.observation || []).map(o => `<article class="card" data-eid="observation:${o.id}"><h4>${fmtDate(o.date)}${o.title ? ' — ' + esc(o.title) : ''}</h4><p>${esc(o.content)}</p><div class="meta">${fmtDate(o.updated_at)}</div></article>`).join('') || '<div class="empty">Aucune observation</div>'}</div></div>`;
  } else if (tab === 'ttt') {
    const list = [...(E.traitement || [])].sort((a, b) => a.done - b.done || (b.date || '').localeCompare(a.date || ''));
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Traitement</h3><button class="btn primary" data-add="traitement">+ Ajouter un traitement</button></div>
      <table class="tbl"><thead><tr><th>Statut</th><th>Médicament</th><th>Classe</th><th>Posologie / voie</th><th>Début</th><th>Prescrit par</th></tr></thead>
      <tbody>${list.map(t => `<tr class="clickable" data-eid="traitement:${t.id}"><td><span class="chip ${t.done ? 'off' : 'on'}">${t.done ? 'Arrêté' : 'En cours'}</span></td><td><b>${esc(t.title)}</b>${t.details ? `<br><small>${esc(t.details)}</small>` : ''}</td><td>${esc(t.category)}</td><td>${esc(t.content)}</td><td>${fmtDate(t.date)}</td><td>${esc(t.author)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucun traitement</td></tr>'}</tbody></table></div>`;
  } else if (tab === 'videos') {
    const vids = sortByDate(E.video || []);
    const media = (v) => {
      if (v.category === 'fichier') { const src = `${API}/api/files/${encodeURIComponent(v.content)}?t=${encodeURIComponent(S.token)}`; return /\.(jpe?g|png)$/i.test(v.content) ? `<img src="${src}" alt="${esc(v.title)}">` : `<video src="${src}" controls preload="metadata"></video>`; }
      const yt = v.content.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
      return yt ? `<iframe width="100%" height="200" src="https://www.youtube.com/embed/${yt[1]}" title="${esc(v.title)}" frameborder="0" allowfullscreen style="border-radius:10px"></iframe>` : `<a href="${esc(v.content)}" target="_blank" rel="noopener">Ouvrir la vidéo ↗</a>`;
    };
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Vidéos opératoires & médias</h3><button class="btn primary" data-add="video">+ Ajouter une vidéo</button></div>
      <div class="videos">${vids.map(v => `<article class="card" data-eid="video:${v.id}"><h4>${esc(v.title)}</h4>${media(v)}${v.details ? `<p style="margin-top:8px">${esc(v.details)}</p>` : ''}<div class="meta">${fmtDate(v.date)}</div></article>`).join('') || '<div class="empty">Aucune vidéo</div>'}</div></div>`;
  } else if (tab === 'anapath') {
    const ap = sortByDate((E.examen || []).filter(e => /anapath|cytolog/i.test(e.category)));
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Anatomopathologie</h3><button class="btn primary" data-add="examen" data-preset='{"category":"Anapath"}'>+ Ajouter un résultat</button></div>
      <div class="timeline">${ap.map(e => `<article class="card" data-eid="examen:${e.id}"><h4>${fmtDate(e.date)} — ${esc(e.title || e.category)}</h4><p><b>Conclusion :</b> ${esc(e.content)}</p>${e.details ? `<p style="margin-top:8px;color:var(--muted)">${esc(e.details)}</p>` : ''}<div class="meta">${fmtDate(e.updated_at)}</div></article>`).join('') || '<div class="empty">Aucun résultat anapath (les examens de type « Anapath » apparaissent ici et dans la colonne Examens complémentaires).</div>'}</div></div>`;
  } else if (tab === 'sortie') {
    renderSortie(box); return;
  } else if (tab === 'logs') {
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Journal des modifications</h3></div><div class="empty">Chargement…</div></div>`;
    api(`/api/patients/${p.id}/logs`).then(r => {
      box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Journal des modifications</h3><span class="meta">${r.logs.length} événement(s)</span></div>
      <table class="tbl"><thead><tr><th style="width:150px">Date / heure</th><th style="width:170px">Utilisateur</th><th style="width:240px">Action</th><th>Détail</th></tr></thead>
      <tbody>${r.logs.map(l => `<tr><td>${fmtTs(l.ts)}</td><td>${esc(l.user)}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody></table></div>`;
    });
    return;
  }
  bindItems(box);
}

function renderSortie(box) {
  const p = S.patient, sorti = p.status === 'sorti';
  const modes = ['', 'Domicile', 'Transfert vers un autre service', 'Transfert vers un autre établissement', 'Contre avis médical', 'Évasion', 'Décès'];
  box.innerHTML = `<div class="panel">
    <div class="panel-head"><h3>Fiche de sortie</h3><div style="display:flex;gap:8px"><button class="btn no-print" id="print">Imprimer</button>${sorti ? '<button class="btn teal no-print" id="readmit">Réadmettre</button>' : ''}</div></div>
    ${sorti ? `<div class="banner ok">Sortie validée le ${fmtDate(p.sortie_date)} — ${esc(p.sortie_mode)}. Le lit a été libéré.</div>` : '<div class="banner">Patient hospitalisé. « Valider la sortie » libère le lit et archive le dossier (consultable dans Patients sortis).</div>'}
    <form id="sortie-form" class="sortie-grid">
      <div class="field"><label>Date de sortie</label><input type="date" name="sortie_date" value="${esc(p.sortie_date || today())}"></div>
      <div class="field"><label>Mode de sortie</label><select name="sortie_mode">${modes.map(m => `<option ${m === (p.sortie_mode || '') ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
      <div class="field full" style="grid-column:1/-1"><label>Destination / service d'accueil</label><input name="sortie_destination" value="${esc(p.sortie_destination || '')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Résumé d'hospitalisation / compte rendu</label><textarea name="sortie_resume" style="min-height:160px">${esc(p.sortie_resume || '')}</textarea></div>
      <div class="field"><label>Ordonnance de sortie</label><textarea name="sortie_ordonnance">${esc(p.sortie_ordonnance || '')}</textarea></div>
      <div class="field"><label>Rendez-vous de contrôle</label><textarea name="sortie_rdv" placeholder="ex. Consultation dans 10 jours + ablation des fils">${esc(p.sortie_rdv || '')}</textarea></div>
      <div class="form-err" id="serr" style="grid-column:1/-1"></div>
      <div class="form-actions no-print" style="grid-column:1/-1"><div class="r"><button class="btn" type="submit" data-v="0">Enregistrer le brouillon</button>${sorti ? '' : '<button class="btn primary" type="submit" data-v="1">Valider la sortie</button>'}</div></div>
    </form></div>`;
  const form = $('#sortie-form');
  let valider = false;
  form.querySelectorAll('[data-v]').forEach(b => b.onclick = () => (valider = b.dataset.v === '1'));
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (valider && !confirm('Valider la sortie et libérer le lit ?')) return;
    const body = Object.fromEntries(new FormData(form)); body.valider = valider;
    try { await api(`/api/patients/${p.id}/sortie`, { method: 'POST', body }); toast(valider ? 'Sortie validée' : 'Fiche enregistrée'); refresh(); }
    catch (err) { $('#serr').textContent = err.message; }
  };
  $('#print').onclick = () => window.print();
  const ra = $('#readmit');
  if (ra) ra.onclick = () => {
    const f = formModal({
      title: 'Réadmettre le patient', submit: 'Réadmettre', values: { loc_type: 'room' }, fields: locationFields(S.meta),
      onSubmit: async (v) => {
        if (v.loc_type === 'room' && (!v.room || !v.position)) throw new Error('Choisissez la chambre et le lit.');
        await api(`/api/patients/${p.id}/readmettre`, { method: 'POST', body: locPayload(v) }); toast('Patient réadmis'); refresh();
      },
    });
    bindLocToggle(f);
  };
}

// ------------------------------------------------------------------ other pages
async function viewArchives() {
  $('#app').innerHTML = topbar() + `<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button><input id="aq" class="pill" style="box-shadow:none;border:1.5px solid var(--line);font-size:15px;padding:9px 18px;width:320px" placeholder="Filtrer par nom ou IP"></div><div class="panel" id="arch"></div></main>`;
  bindChrome();
  $('#home-btn').onclick = () => (location.hash = '#/home');
  const load = async (q = '') => {
    const r = await api('/api/archives?q=' + encodeURIComponent(q));
    $('#arch').innerHTML = `<div class="panel-head"><h3>Patients sortis</h3><span class="meta">${r.patients.length} dossier(s)</span></div>
      <table class="tbl"><thead><tr><th>Patient</th><th>IP</th><th>Motif</th><th>Date de sortie</th><th>Mode</th></tr></thead>
      <tbody>${r.patients.map(p => `<tr class="clickable" data-id="${p.id}"><td><b>${esc(p.nom)} ${esc(p.prenom)}</b></td><td>${esc(p.ip)}</td><td>${esc(p.motif)}</td><td>${fmtDate(p.sortie_date)}</td><td>${esc(p.sortie_mode)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Aucun patient sorti</td></tr>'}</tbody></table>`;
    $('#arch').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => (location.hash = `#/patient/${tr.dataset.id}/sortie`));
  };
  let t; $('#aq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value), 250); };
  load();
}

async function viewUsers() {
  $('#app').innerHTML = topbar() + `<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button></div><div class="panel" id="users"></div></main>`;
  bindChrome();
  $('#home-btn').onclick = () => (location.hash = '#/home');
  const r = await api('/api/users');
  const roles = { admin: 'Administrateur', medecin: 'Médecin', infirmier: 'Infirmier(e)' };
  $('#users').innerHTML = `<div class="panel-head"><h3>Utilisateurs de l'équipe</h3><button class="btn primary" id="add-user">+ Nouvel utilisateur</button></div>
    <table class="tbl"><thead><tr><th>Identifiant</th><th>Nom complet</th><th>Rôle</th><th>Statut</th><th></th></tr></thead>
    <tbody>${r.users.map(u => `<tr><td><b>${esc(u.username)}</b></td><td>${esc(u.full_name)}</td><td>${roles[u.role] || u.role}</td><td><span class="chip ${u.active ? 'on' : 'off'}">${u.active ? 'Actif' : 'Désactivé'}</span></td>
      <td style="text-align:right"><button class="btn" data-pw="${u.id}">Mot de passe</button> ${u.role === 'admin' ? '<span class="chip on">Compte protégé</span>' : `<button class="btn ${u.active ? 'danger' : ''}" data-act="${u.id}" data-a="${u.active ? 0 : 1}">${u.active ? 'Désactiver' : 'Activer'}</button> <button class="btn danger" data-delete-user="${u.id}">Supprimer</button>`}</td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-delete-user]').forEach(b=>b.onclick=async()=>{
    const u=r.users.find(x=>String(x.id)===b.dataset.deleteUser);
    if(!confirm(`Supprimer ${u.full_name} (${u.username}) ? Les dossiers et historiques seront conservés.`))return;
    try{await api('/api/users/'+u.id,{method:'DELETE'});toast('Utilisateur supprimé');await viewUsers();}catch(e){toast(e.message,true);}
  });
  $('#add-user').onclick = () => formModal({
    title: 'Nouvel utilisateur', submit: 'Créer',
    fields: [{ name: 'username', label: 'Identifiant', required: true }, { name: 'full_name', label: 'Nom complet', required: true }, { name: 'role', label: 'Rôle', type: 'select', options: [['medecin', 'Médecin'], ['infirmier', 'Infirmier(e)'], ['admin', 'Administrateur']] }, { name: 'password', label: 'Mot de passe', type: 'password', required: true }],
    onSubmit: async (v) => { await api('/api/users', { method: 'POST', body: v }); toast('Utilisateur créé'); viewUsers(); },
  });
  document.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => formModal({
    title: 'Nouveau mot de passe', fields: [{ name: 'password', label: 'Mot de passe', type: 'password', required: true }],
    onSubmit: async (v) => { await api('/api/users/' + b.dataset.pw, { method: 'PUT', body: v }); toast('Mot de passe modifié'); },
  }));
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    try { await api('/api/users/' + b.dataset.act, { method: 'PUT', body: { active: b.dataset.a === '1' } }); viewUsers(); } catch (e) { toast(e.message, true); }
  });
}

async function viewJournal() {
  $('#app').innerHTML = topbar() + `<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button></div><div class="panel" id="jr"></div></main>`;
  bindChrome();
  $('#home-btn').onclick = () => (location.hash = '#/home');
  const r = await api('/api/logs');
  $('#jr').innerHTML = `<div class="panel-head"><h3>Journal global (500 derniers événements)</h3></div>
    <table class="tbl"><thead><tr><th>Date / heure</th><th>Utilisateur</th><th>Patient</th><th>Action</th><th>Détail</th></tr></thead>
    <tbody>${r.logs.map(l => `<tr ${l.patient_id ? `class="clickable" data-id="${l.patient_id}"` : ''}><td>${fmtTs(l.ts)}</td><td>${esc(l.user)}</td><td>${l.nom ? esc(l.nom + ' ' + (l.prenom || '')) : '—'}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody></table>`;
  $('#jr').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => (location.hash = `#/patient/${tr.dataset.id}/logs`));
}


function clockForm(){formModal({title:'UTC et adaptation manuelle',values:clock,
 extra:'<p>UTC par défaut. Correction globale : 0 = UTC, +60 = UTC+1, -60 = UTC−1. Les anciens historiques ne sont pas modifiés.</p>',
 fields:[{name:'offset_minutes',label:'Correction en minutes',type:'number',required:true}],
 onSubmit:async v=>{await api('/api/clock',{method:'PUT',body:v});await syncClock();toast('Horloge mise à jour');setTimeout(render,0);}});}
function profileFields(){return [
 {name:'username',label:'Identifiant',required:true},{name:'full_name',label:'Nom complet',required:true},
 {name:'current_password',label:'Mot de passe actuel / temporaire',type:'password',required:true},
 ...(S.user.must_change_password ? [{name:'password',label:'Nouveau mot de passe (8 caractères minimum)',type:'password',required:true},{name:'confirm_password',label:'Confirmer le nouveau mot de passe',type:'password',required:true}] : [])
];}
async function saveProfile(v){
 if(S.user.must_change_password && v.password!==v.confirm_password)throw new Error('Les mots de passe ne correspondent pas.');
 delete v.confirm_password;
 S.user=(await api('/api/me/profile',{method:'PUT',body:v})).user;
 toast('Compte mis à jour');location.hash='#/home';setTimeout(render,0);
}
function profileForm(){formModal({title:'Mon compte',fields:profileFields(),values:S.user,
 extra:'<p>Après la première connexion, seul l’administrateur peut modifier votre mot de passe.</p>',onSubmit:saveProfile});}
function viewFirstLogin(){
 $('#app').innerHTML=`<main class="login"><section class="login-card"><h1>Première connexion</h1><p>Personnalisez votre compte. Vous ne pourrez plus modifier vous-même votre mot de passe après cette étape.</p><form id="first-login">${profileFields().map(f=>`<label>${esc(f.label)}<input class="pill" name="${f.name}" type="${f.type||'text'}" value="${f.type==='password'?'':esc(S.user[f.name])}" required></label>`).join('')}<div class="login-err" id="first-error"></div><button class="btn primary" type="submit">Enregistrer et continuer</button><button class="btn" type="button" id="first-logout">Se déconnecter</button></form></section></main>`;
 $('#first-logout').onclick=()=>logout();
 $('#first-login').onsubmit=async e=>{e.preventDefault();try{await saveProfile(Object.fromEntries(new FormData(e.target)));}catch(err){$('#first-error').textContent=err.message;}};
}

// ------------------------------------------------------------------ router
async function render() {
  const parts = (location.hash || '#/home').slice(2).split('/');
  if (!S.token) { if (parts[0] !== 'login') { location.hash = '#/login'; } viewLogin(); return; }
  if (!S.user) { try { S.user = (await api('/api/me')).user; } catch { return; } }
  closeModal();
  if (S.user.must_change_password) {viewFirstLogin(); return;}
  try {
    await syncClock();
    if (!S.meta) S.meta = await api('/api/meta');
    if (parts[0] === 'patient' && parts[1]) {
      const tab = TABS.some(t => t[0] === parts[2]) ? parts[2] : 'maj';
      if (!S.patient || String(S.patient.id) !== parts[1]) S.patient = null;
      await viewPatient(parts[1], tab);
    } else if (parts[0] === 'archives') { S.patient = null; await viewArchives(); }
    else if (parts[0] === 'users') { S.patient = null; await viewUsers(); }
    else if (parts[0] === 'journal') { S.patient = null; await viewJournal(); }
    else { if (parts[0] !== 'home') { location.hash = '#/home'; return; } S.patient = null; await viewHome(); }
  } catch (err) { toast(err.message, true); }
}

window.addEventListener('hashchange', render);
S.token = store.get('cva_token');
render();
})();
