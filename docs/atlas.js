/* Frame Studio — shell, learn tabs, costs and portfolio.
   Data comes from data/*.json, rebuilt on the Mac by build_data.py. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CENTS = '\u2063';
  function appendText(el, str) {
    if (str.indexOf(CENTS) < 0) { el.append(document.createTextNode(str)); return; }
    const re = /\u2063(\S+)/g; let last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) el.append(document.createTextNode(str.slice(last, m.index)));
      const sp = document.createElement('span'); sp.className = 'cents'; sp.textContent = m[1]; el.append(sp);
      last = m.index + m[0].length;
    }
    if (last < str.length) el.append(document.createTextNode(str.slice(last)));
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') { if (typeof v === 'string' && v.indexOf(CENTS) >= 0) appendText(el, v); else el.textContent = v; }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) { if (k.nodeType) el.append(k); else appendText(el, String(k)); }
    return el;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  }
  /* Dollars: whole dollars from $1 up; under $1 keeps cents and is drawn fainter (CENTS marks it). */
  const money = (v) => { if (v == null || isNaN(v)) return '—'; const a = Math.abs(v), sign = v < 0 ? '−$' : '$'; if (a >= 1 || a === 0) return sign + Math.round(a).toLocaleString('en-US'); return CENTS + sign + a.toFixed(2); };
  const num = (v) => Math.round(v).toLocaleString('en-US');
  const big = (v) => v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v));
  const pct = (v) => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const date = (ts) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const shortDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('atlas:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('atlas:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DATA = { ready: false };

  /* ------------------------------------------------------------------ theme */
  /* Light and Dark only; Light is the default. */
  function applyTheme(mode) {
    mode = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === mode)));
    $$('iframe.app-frame').forEach(syncFrameTheme);
  }
  function syncFrameTheme(f) {
    try {
      const r = f.contentDocument && f.contentDocument.documentElement;
      if (r) { r.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'light'); r.classList.add('in-canvas'); }
    } catch (e) {}
  }
  $$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => { applyTheme(b.dataset.themeSet); store.set('theme-choice', b.dataset.themeSet); }));
  applyTheme(store.get('theme-choice', 'light'));

  /* ----------------------------------------------------------------- router */
  const VIEWS = ['home', 'lumina', 'formula-lens', 'frame-strata', 'blockflow', 'graphite', 'frame-world', 'frame-size'];
  const ALIAS = { start: 'home', overview: 'home', 'formula-studio': 'formula-lens', framecraft: 'frame-strata', world: 'frame-world', size: 'frame-size', admin: 'frame-size' };
  const HASH = { 'formula-lens': 'formula-studio', 'frame-strata': 'framecraft' };
  const rendered = {};
  let current = null;
  function show(name) {
    name = ALIAS[name] || name;
    if (!VIEWS.includes(name)) name = 'home';
    current = name;
    if (name !== 'home') markVisited(name);
    VIEWS.forEach((v) => { const el = $('#view-' + v); if (el) el.hidden = v !== name; });
    $$('.navbtn').forEach((b) => b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false'));
    const view = $('#view-' + name);
    if (view.classList.contains('app-view')) mountApp(view);
    else if (name === 'home') renderHome();
    else if (!rendered[name] && DATA.ready) { rendered[name] = true; RENDER[name](); initSections(view); }
    const hash = HASH[name] || name;
    if (location.hash.slice(1) !== hash) { try { history.replaceState(null, '', '#' + hash); } catch (e) { location.hash = hash; } }
    paintPath();
  }
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  /* ------------------------------------------------ the path through Canvas */
  /* One suggested order through the apps. Home lists it, every app bar carries a previous/next control for it,
     and visited stops are remembered in localStorage (store is try/catch-wrapped). */
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PATH = ['graphite', 'formula-lens', 'blockflow', 'frame-strata', 'lumina'];
  const PSTOPS = {
    graphite: { role: 'Engine', name: 'Graphite', desc: 'How Pigment’s calculation engine works, in 3D: sparse cells, scoped recalculation, access rights and scenarios', why: 'Start with how the engine stores and recalculates cells. Everything else rests on it.' },
    'formula-lens': { role: 'Formulas', name: 'Formula Studio', desc: 'Step through a formula and watch BY, REMOVE, ADD, SELECT and FILTER reshape it', why: 'Then watch one formula reshape those cells, modifier by modifier.' },
    blockflow: { role: 'Model', name: 'Blockflow', desc: 'Map a model’s data flow from concept to every block, and play build plans step by step', why: 'Zoom out: formulas chain into blocks, and blocks into a model you can map and plan.' },
    'frame-strata': { role: 'Frame', name: 'Framecraft', desc: 'Trace every number on a Pigment Frame back to its blocks, in 3D or 2D', why: 'Follow the model’s numbers up into a Frame, and trace each one back down.' },
    lumina: { role: 'Live frame', name: 'Lumina frame', desc: 'A finished Pigment Frame, built from the repo and running on sample data. Nothing is sent to Pigment.', why: 'Finish with a complete frame running on sample data.' },
  };
  /* After the last stop: the real frames in Pigment. Not a numbered stop, but the path control leads on to it. */
  const CODA = {
    'frame-world': { role: 'Play', name: 'Frame World', desc: 'Walk a revenue frame in first person, then follow the finding to the office and out into the world. Sample data.' },
    'frame-size': { role: 'Admin', name: 'Frame size', desc: 'How much of the 1 MiB Pigment limit each part of the frame uses, and what to trim first' },
  };
  const MORE = [
    ['frame-world', 'Frame World', 'Walk a revenue frame in first person: the model, the warehouse behind it, and out into the real world.'],
    ['frame-size', 'Frame size', 'Where a real Pigment frame spends its 1 MiB code limit, and what to trim first.'],
  ];
  const HANDOFFS = [
    ['blockflow', 'formula-lens', 'Open a block in Blockflow, then “Open in Formula Studio” steps through its formula.'],
    ['formula-lens', 'graphite', 'On a modifier step in Formula Studio, “See BY in the engine” opens that modifier on Graphite’s sparse cube.'],
    ['frame-strata', 'blockflow', 'From a frame’s flow map in Framecraft, “Open Blockflow” shows where its blocks sit in the model.'],
    ['lumina', 'frame-strata', 'Click the Lumina logo to open Framecraft and take a frame apart layer by layer.'],
  ];
  const EXT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h4v4M13 3 7.5 8.5M12 9.5V13H3V4h3.5"/></svg>';
  const visited = store.get('visited', {}) || {};
  function markVisited(v) {
    if (visited[v]) return;
    visited[v] = Date.now(); store.set('visited', visited);
    $$('[data-pmark="' + v + '"]').forEach((el) => { el.classList.add('seen'); el.title = pmarkLabel(v); el.setAttribute('aria-label', pmarkLabel(v)); });
  }
  /* The number travels with the tab, wherever it is in the rail. */
  function pmarkLabel(v) { return 'Step ' + (PATH.indexOf(v) + 1) + ' of ' + PATH.length + ' on the learning path — ' + (visited[v] ? 'visited' : 'not visited yet'); }
  function goStop(v) { show(v); }
  const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
  const TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';
  function navIcon(v) { return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' + NAV[v].icon + '</svg>'; }
  function renderHome() {
    const page = $('#homePage'); if (!page) return;
    const seen = PATH.filter((v) => visited[v]).length;
    const next = PATH.find((v) => !visited[v]);
    const head = h('div', { class: 'page-head' },
      h('div', { class: 'eyebrow', text: 'Start here' }),
      h('h1', { text: 'From engine to frame' }),
      h('p', { class: 'lede', text: 'Frame Studio is a set of working models of how Pigment plans: the calculation engine, the formula language, a model’s data flow and the frames built on top. Follow the path in order, or jump in anywhere.' }));
    const cta = h('button', { type: 'button', class: 'btn primary', onclick: () => goStop(next || PATH[0]) });
    cta.innerHTML = (seen === 0 ? 'Start with ' + esc(PSTOPS[PATH[0]].name) : next ? 'Continue with ' + esc(PSTOPS[next].name) : 'Walk the path again') + ARROW;
    const prog = h('div', { class: 'home-prog' }, cta,
      h('span', { class: 'small muted tnum', text: seen + ' of ' + PATH.length + ' stops visited' }));
    if (seen) prog.append(h('button', { type: 'button', class: 'btn ghost', text: 'Reset progress', onclick: () => { Object.keys(visited).forEach((k) => delete visited[k]); store.set('visited', visited); renderNav(); renderHome(); paintPath(); } }));
    const path = h('ol', { class: 'home-path' });
    PATH.forEach((v, i) => {
      const s = PSTOPS[v], done = !!visited[v];
      const card = h('button', { type: 'button', class: 'pstop' + (done ? ' seen' : '') + (v === next ? ' next' : ''), 'aria-label': 'Stop ' + (i + 1) + ', ' + s.role + ': open ' + s.name + (done ? ' (visited)' : ''), onclick: () => goStop(v) });
      card.innerHTML = '<span class="pstop-top"><span class="pnum">' + (done ? TICK : i + 1) + '</span><span class="prole">' + esc(s.role) + '</span></span>' +
        '<span class="pname">' + navIcon(v) + esc(s.name) + '</span><span class="pwhy">' + esc(s.why) + '</span><span class="pgo">' + (done ? 'Open again' : 'Open') + ARROW + '</span>';
      path.append(h('li', {}, card));
    });
    const hand = h('ul', { class: 'home-hand' });
    HANDOFFS.forEach(([a, b, t]) => {
      const li = h('li', {});
      li.innerHTML = '<span class="hh-pair"><button type="button" data-go="' + a + '">' + esc((PSTOPS[a] || CODA[a]).name) + '</button>' + ARROW + '<button type="button" data-go="' + b + '">' + esc((PSTOPS[b] || CODA[b]).name) + '</button></span><span class="hh-t">' + esc(t) + '</span>';
      hand.append(li);
    });
    hand.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) goStop(b.dataset.go); });
    const more = h('div', { class: 'home-more' });
    MORE.forEach(([v, name, t]) => {
      const b = h('button', { type: 'button', class: 'mcard' + (visited[v] ? ' seen' : ''), onclick: () => show(v) });
      b.innerHTML = '<span class="mname">' + navIcon(v) + esc(name) + (visited[v] ? '<i class="mtick" title="Visited">' + TICK + '</i>' : '') + '</span><span class="mt">' + esc(t) + '</span>';
      more.append(b);
    });
    const sec = (title, sub, body) => h('div', { class: 'section' }, h('header', {}, h('h2', { text: title }), h('p', { class: 'sub', text: sub })), body);
    const hero = h('div', { class: 'home-hero', style: 'position:relative;margin:0 0 14px;border-radius:18px;overflow:hidden;border:1px solid var(--line);background:#070B16;aspect-ratio:16/8;min-height:300px;max-height:520px' },
      h('iframe', { src: 'apps/flythrough.html?embed=1', title: 'Frame Studio flythrough', style: 'position:absolute;inset:0;width:100%;height:100%;border:0', allow: 'fullscreen' }));
    const heroBtns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 26px', html: '<button type="button" class="btn primary" data-demo>Watch the demo</button><button type="button" class="btn" data-demo-setup>Demo settings</button>' });
    page.replaceChildren(hero, heroBtns, head, prog,
      sec('The path', 'Five stops, each building on the one before. Every app bar has the same previous and next control, so you can walk it without coming back here.', path),
      sec('Context travels with you', 'The apps hand a block or a formula to each other. While a block is in focus it shows in the app bar, with jumps to the other apps.', h('div', { class: 'card pad' }, hand)),
      sec('Beyond the path', 'Two more: a first-person walk through a frame, and what a real frame costs against Pigment’s code limit.', more));
  }
  /* The same compact control in every app bar: role, previous stop, five dots, next stop. */
  function paintPath() {
    $$('.app-view').forEach((view) => {
      const v = view.id.replace(/^view-/, ''), s = PSTOPS[v] || CODA[v], bar = $('.app-bar', view);
      if (!s || !bar) return;
      const coda = !PSTOPS[v], i = coda ? PATH.length : PATH.indexOf(v), prev = PATH[i - 1];
      const next = coda ? null : PATH[i + 1] || 'frame-world';
      const stop = (x) => PSTOPS[x] || CODA[x];
      const nameEl = $(':scope > b', bar), descEl = $(':scope > span', bar);
      if (nameEl) nameEl.textContent = s.name;
      if (descEl) { descEl.textContent = s.desc; descEl.title = s.desc; }
      let role = $('.cv-role', bar);
      if (!role) { role = h('em', { class: 'cv-role' }); nameEl.after(role); }
      role.textContent = s.role;
      let nav = $('.cv-path', bar);
      if (!nav) { nav = h('nav', { class: 'cv-path', 'aria-label': 'Suggested path through Canvas' }); bar.insertBefore(nav, $('[data-reload]', bar)); nav.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) goStop(b.dataset.go); }); }
      nav.innerHTML =
        '<button type="button" class="cv-pprev" ' + (prev ? 'data-go="' + prev + '" title="Previous: ' + esc(stop(prev).role + ' · ' + stop(prev).name) + '" aria-label="Previous stop: ' + esc(stop(prev).name) + '"' : 'data-go="home" title="Back to the path overview" aria-label="Back to the path overview"') + '><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg></button>' +
        '<span class="cv-pdots">' + PATH.map((p, k) => '<button type="button" data-go="' + p + '" class="' + (p === v ? 'cur' : visited[p] ? 'seen' : '') + '"' + (p === v ? ' aria-current="step"' : '') + ' title="' + (k + 1) + '. ' + esc(PSTOPS[p].role + ' · ' + PSTOPS[p].name) + '" aria-label="Stop ' + (k + 1) + ': ' + esc(PSTOPS[p].name) + (visited[p] ? ' (visited)' : '') + '"><i></i></button>').join('') + '</span>' +
        (next ? '<button type="button" class="cv-pnext" data-go="' + next + '" title="Next: ' + esc(stop(next).role + ' · ' + stop(next).name) + '"><span class="cv-pl">' + (CODA[next] ? 'Then' : 'Next') + '</span><b>' + esc(stop(next).name) + '</b>' + ARROW + '</button>'
          : '<button type="button" class="cv-pnext" data-go="home" title="Back to the path overview"><span class="cv-pl">Done</span><b>Overview</b>' + ARROW + '</button>');
    });
  }

  paintPath();

  /* -------------------------------------------- nav: reorder, star, extras */
  const NAV = {
    home: { label: 'Start here', tag: '', icon: '<circle cx="4.5" cy="15" r="2"/><circle cx="15.5" cy="5" r="2"/><path d="M6.5 15h4.2a2.6 2.6 0 0 0 0-5.2H9.3a2.6 2.6 0 0 1 0-5.2h4.2" stroke-linecap="round"/>' },
    'formula-lens': { label: 'Formula Studio', tag: '', icon: '<path d="M11.5 3.2c-1.5-.6-3 .1-3.4 1.8L6.2 14.6c-.4 1.7-1.8 2.4-3.2 1.9"/><path d="M4.8 8.3h5.6"/><path d="m12 10.5 4.5 5M16.5 10.5l-4.5 5"/>' },
    blockflow: { label: 'Blockflow', tag: '', icon: '<rect x="2.5" y="3.5" width="4.5" height="4" rx="1"/><rect x="2.5" y="12.5" width="4.5" height="4" rx="1"/><rect x="13" y="8" width="4.5" height="4" rx="1"/><path d="M7 5.5h1.8c.9 0 1.5.6 1.5 1.5v1.5c0 .9.6 1.5 1.5 1.5H13M7 14.5h1.8c.9 0 1.5-.6 1.5-1.5v-1.5c0-.9.6-1.5 1.5-1.5" stroke-linecap="round" stroke-linejoin="round"/>' },
    lumina: { label: 'Lumina frame', tag: '', icon: '<rect x="2.5" y="3" width="15" height="14" rx="2"/><path d="M2.5 7h15"/><path d="m5.5 14 2.6-3 2 1.8 3.4-4.3"/>' },
    graphite: { label: 'Graphite', tag: '', icon: '<path d="m10 2.5 6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5z" stroke-linejoin="round"/><path d="M3.5 6.25 10 10l6.5-3.75M10 10v7.5" stroke-linejoin="round"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/>' },
    'frame-strata': { label: 'Framecraft', tag: '', icon: '<path d="m10 2.5 7 3.8-7 3.8-7-3.8z"/><path d="m3 12.2 7 3.8 7-3.8"/><path d="M6.5 8.3v5.5M13.5 8.3v5.5" stroke-dasharray="1.4 1.6"/>' },
  };
  NAV['frame-size'] = { label: 'Frame size', tag: 'Admin', icon: '<rect x="3" y="8" width="14" height="5" rx="1.2"/><path d="M3 10.5h9.5"/><path d="M6 4.5h8M6 15.5h5"/>' };
  NAV['frame-world'] = { label: 'Frame World', tag: '', icon: '<circle cx="10" cy="10" r="7.2"/><path d="M2.8 10h14.4M10 2.8c2.4 2 2.4 12.4 0 14.4M10 2.8c-2.4 2-2.4 12.4 0 14.4"/><path d="m13.2 5.2 1.6-2.2 1 2.4" stroke-linecap="round" stroke-linejoin="round"/>' };
  const NAV_GROUPS = [['learn', 'Start'], ['apps', 'Apps'], ['pigment', 'Pigment']];
  const NAV_DEFAULT = { order: { learn: ['home'], numbers: [], apps: ['formula-lens', 'blockflow', 'frame-strata', 'frame-world', 'lumina'], pigment: ['frame-size'], extras: ['graphite'] }, starred: [] };
  /* Groups: the built-in ones plus user-made ones (ids "g-…"). `groups` is their order in the main rail; Extras sits in
     its own block below the nav and stays last. A deleted built-in group is listed in `deleted` so it does not come back. */
  const BUILTIN_GROUPS = NAV_GROUPS.map(([g]) => g);
  const isCustomGroup = (g) => /^g-[a-z0-9]+$/.test(g);
  let navPrefs = normalizePrefs(store.get('nav', null));
  function normalizePrefs(p) {
    const out = { order: {}, starred: [], groups: [], deleted: [] };
    const src = p && p.order ? p : NAV_DEFAULT;
    /* Older prefs have no group order: keep known groups once each, then append any missing built-ins in default order. */
    out.deleted = (Array.isArray(p && p.deleted) ? p.deleted : []).filter((g) => BUILTIN_GROUPS.includes(g));
    const gs = new Set();
    out.groups = (Array.isArray(p && p.groups) ? p.groups : []).filter((g) => (BUILTIN_GROUPS.includes(g) ? !out.deleted.includes(g) : isCustomGroup(g)) && !gs.has(g) && gs.add(g));
    BUILTIN_GROUPS.forEach((g) => { if (!gs.has(g) && !out.deleted.includes(g)) { gs.add(g); out.groups.push(g); } });
    if (!out.groups.length) { out.deleted = []; out.groups = BUILTIN_GROUPS.slice(); }
    const seen = new Set();
    out.groups.concat('extras').forEach((g) => { out.order[g] = ((src.order && src.order[g]) || []).filter((v) => NAV[v] && !seen.has(v) && seen.add(v)); });
    /* Tabs not placed anywhere go to their default group, or to the first group when that one was deleted. */
    Object.keys(NAV).forEach((v) => { if (!seen.has(v)) { let g = Object.keys(NAV_DEFAULT.order).find((k) => NAV_DEFAULT.order[k].includes(v)) || 'apps'; if (!out.order[g]) g = out.groups[0]; if (v === 'home') out.order[g].unshift(v); else out.order[g].push(v); } });
    out.starred = ((p && p.starred) || []).filter((v) => NAV[v]);
    out.labels = {};
    Object.entries((p && p.labels) || {}).forEach(([g, l]) => { if (out.order[g] && typeof l === 'string' && l) out.labels[g] = l; });
    return out;
  }
  const GROUP_DEFAULT_LABEL = { learn: 'Learn', numbers: 'Run the numbers', apps: 'Apps', pigment: 'Pigment', extras: 'Extras' };
  const groupLabel = (g) => (navPrefs.labels[g] || GROUP_DEFAULT_LABEL[g] || 'New group');
  /* Section header: double-click (or the pencil) to rename; Enter saves, Escape cancels, empty restores the default. */
  function groupHeader(g, isFirst) {
    const movable = g !== 'extras';
    const deletable = movable && navPrefs.groups.length > 1;
    /* The Pigment-grey heading follows the Pigment Frames tab, whichever group it sits in. */
    const pg = (navPrefs.order[g] || []).includes('pigment-frames');
    const wrap = h('div', { class: 'nav-group' + (isFirst ? ' first' : '') + (g === 'extras' ? ' extras-title' : '') + (pg ? ' pg-head' : ''), 'data-group-head': g,
      draggable: movable ? 'true' : null, tabindex: movable ? '0' : null, 'aria-label': movable ? groupLabel(g) + ' section' : null,
      'aria-keyshortcuts': movable ? 'Alt+ArrowUp Alt+ArrowDown F2 Delete' : null, title: movable ? 'Drag to move this section and its tabs (or Alt+↑/↓). F2 renames, Delete removes the heading.' : null });
    const label = h('span', { class: 'gl', text: groupLabel(g), title: 'Double-click to rename' });
    const pen = h('button', { type: 'button', class: 'gren', 'aria-label': 'Rename ' + groupLabel(g) });
    pen.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3z"/></svg>';
    const del = deletable ? h('button', { type: 'button', class: 'gdel', 'aria-label': 'Delete the ' + groupLabel(g) + ' heading (its tabs are kept)', title: 'Delete heading (tabs are kept)' }) : null;
    if (del) del.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
    /* Delete is confirmed inline in the heading; the tabs move to the group above (or the next one when this is the top group). */
    const askDelete = () => {
      if (navPrefs.groups.length < 2) return;
      const i = navPrefs.groups.indexOf(g), to = navPrefs.groups[i > 0 ? i - 1 : 1], n = (navPrefs.order[g] || []).length;
      const yes = h('button', { type: 'button', class: 'gc-yes', text: 'Delete', onclick: () => deleteGroup(g) });
      const no = h('button', { type: 'button', class: 'gc-no', text: 'Cancel' });
      const cancel = () => { renderNav(); const again = $(`#nav [data-group-head="${g}"]`); if (again) again.focus(); };
      no.addEventListener('click', cancel);
      const box = h('div', { class: 'gconfirm', role: 'group', 'aria-label': 'Confirm delete' },
        h('span', { class: 'gc-msg', text: 'Delete “' + groupLabel(g) + '”?' + (n ? ' ' + n + (n === 1 ? ' tab moves to ' : ' tabs move to ') + groupLabel(to) + '.' : '') }), yes, no);
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } });
      wrap.removeAttribute('draggable'); wrap.classList.add('confirming');
      wrap.replaceChildren(box); no.focus();
    };
    if (del) del.addEventListener('click', (e) => { e.stopPropagation(); askDelete(); });
    const edit = () => {
      const inp = h('input', { type: 'text', class: 'gin', value: groupLabel(g), 'aria-label': 'Section name', maxlength: '40' });
      wrap.removeAttribute('draggable');
      wrap.replaceChildren(inp); inp.focus(); inp.select();
      let done = false;
      const finish = (save, refocus) => {
        if (done) return; done = true;
        if (save) { const v = inp.value.trim(); if (v && v !== GROUP_DEFAULT_LABEL[g]) navPrefs.labels[g] = v; else delete navPrefs.labels[g]; savePrefs(); }
        renderNav();
        const again = refocus && movable && $(`#nav [data-group-head="${g}"]`); if (again) again.focus();
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true, true); if (e.key === 'Escape') finish(false, true); });
      inp.addEventListener('blur', () => finish(true));
    };
    label.addEventListener('dblclick', edit);
    pen.addEventListener('click', edit);
    wrap.append(label, pen);
    if (del) wrap.append(del);
    wrap._rename = edit;
    if (movable) {
      wrap.addEventListener('keydown', (e) => {
        if (e.target.closest('.gin, .gconfirm')) return;
        /* Rename and delete need the full rail: a collapsed rail shows headings as grips only. */
        const full = !$('#shell').classList.contains('left-collapsed');
        if (e.target === wrap && full && (e.key === 'Enter' || e.key === 'F2')) { e.preventDefault(); edit(); return; }
        if (e.target === wrap && full && (e.key === 'Delete' || e.key === 'Backspace') && deletable) { e.preventDefault(); askDelete(); return; }
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || phoneNav()) return;
        e.preventDefault();
        const i = navPrefs.groups.indexOf(g);
        moveGroup(g, i + (e.key === 'ArrowUp' ? -1 : 2));
        const again = $(`#nav [data-group-head="${g}"]`); if (again) again.focus();
      });
      wrap.addEventListener('dragstart', (e) => {
        if (phoneNav() || e.target !== wrap) { e.preventDefault(); return; }
        dragGroup = g;
        const list = groupList(g);
        try {
          e.dataTransfer.setData('text/plain', 'group:' + g); e.dataTransfer.effectAllowed = 'move';
          /* Drag image: the heading with all its tabs, at full rail width even when the rail is collapsed. */
          const ghost = h('div', { class: 'nav-ghost', style: { width: Math.max(200, $('#nav').clientWidth) + 'px' } }, wrap.cloneNode(true), list ? list.cloneNode(true) : null);
          document.body.append(ghost);
          const r = wrap.getBoundingClientRect();
          e.dataTransfer.setDragImage(ghost, Math.min(e.clientX - r.left, 180), e.clientY - r.top);
          setTimeout(() => ghost.remove(), 0);
        } catch (err) {}
        requestAnimationFrame(() => { wrap.classList.add('gdragging'); if (list) list.classList.add('gdragging'); });
      });
      wrap.addEventListener('dragend', () => { dragGroup = null; clearDropMarks(); $$('.gdragging').forEach((el) => el.classList.remove('gdragging')); });
    }
    return wrap;
  }
  /* Groups move as a block: heading plus its tabs. `to` is an insertion index into the current group order. */
  let dragGroup = null;
  const phoneNav = () => !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches);
  function moveGroup(g, to) {
    const from = navPrefs.groups.indexOf(g);
    if (from < 0 || to < 0 || to > navPrefs.groups.length || to === from || to === from + 1) return;
    const rest = navPrefs.groups.filter((x) => x !== g);
    rest.splice(to > from ? to - 1 : to, 0, g);
    navPrefs.groups = rest;
    savePrefs(); renderNav();
  }
  const groupList = (g) => $(`#nav .nav-list[data-group="${g}"]`);
  /* Delete a heading, never its tabs: they join the group above (prepended to the next group when this was the top one). */
  function deleteGroup(g) {
    const i = navPrefs.groups.indexOf(g);
    if (i < 0 || navPrefs.groups.length < 2) return;
    const before = JSON.parse(JSON.stringify(navPrefs)), name = groupLabel(g);
    const to = navPrefs.groups[i > 0 ? i - 1 : 1], moved = navPrefs.order[g] || [];
    navPrefs.order[to] = i > 0 ? navPrefs.order[to].concat(moved) : moved.concat(navPrefs.order[to]);
    delete navPrefs.order[g]; delete navPrefs.labels[g];
    navPrefs.groups.splice(i, 1);
    if (BUILTIN_GROUPS.includes(g)) navPrefs.deleted.push(g);
    savePrefs(); renderNav();
    const n = moved.length;
    navToast(n ? 'Moved ' + n + ' tab' + (n === 1 ? '' : 's') + ' to ' + groupLabel(to) : 'Deleted ' + name, () => restorePrefs(before, g));
    const head = $(`#nav [data-group-head="${to}"]`); if (head) head.focus();
  }
  let pendingRename = null;
  function newGroup() {
    const id = 'g-' + Date.now().toString(36);
    navPrefs.groups.push(id); navPrefs.order[id] = [];
    savePrefs();
    pendingRename = id; renderNav();
  }
  /* Reset layout: default groups, names and tab order. Stars are kept; Undo brings the old layout back. */
  function resetLayout() {
    const before = JSON.parse(JSON.stringify(navPrefs));
    navPrefs = normalizePrefs({ order: NAV_DEFAULT.order, starred: navPrefs.starred });
    savePrefs(); renderNav();
    navToast('Menu layout reset to the default', () => restorePrefs(before));
  }
  function restorePrefs(snap, focusGroup) {
    navPrefs = normalizePrefs(snap); savePrefs(); renderNav();
    const head = focusGroup && $(`#nav [data-group-head="${focusGroup}"]`); if (head) head.focus();
  }
  let toastTimer = null;
  function navToast(msg, undo) {
    const old = $('.nav-toast'); if (old) old.remove();
    clearTimeout(toastTimer);
    const t = h('div', { class: 'cv-toast nav-toast', role: 'status' }, h('span', { text: msg }));
    if (undo) t.append(h('button', { type: 'button', text: 'Undo', onclick: () => { t.remove(); clearTimeout(toastTimer); undo(); } }));
    document.body.append(t);
    toastTimer = setTimeout(() => t.remove(), 7000);
  }
  /* Where a dragged group would land: the insertion index nearest the pointer, or -1 when it would not move. */
  function groupDropIndex(y) {
    const gs = navPrefs.groups;
    let idx = gs.length;
    for (let i = 0; i < gs.length; i++) {
      const head = $(`#nav [data-group-head="${gs[i]}"]`), list = groupList(gs[i]);
      if (!head) continue;
      const top = head.getBoundingClientRect().top, bottom = (list || head).getBoundingClientRect().bottom;
      if (y < (top + bottom) / 2) { idx = i; break; }
    }
    const from = gs.indexOf(dragGroup);
    return idx === from || idx === from + 1 ? -1 : idx;
  }
  function bindGroupDrop(nav) {
    nav.addEventListener('dragover', (e) => {
      if (!dragGroup) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
      clearDropMarks();
      const idx = groupDropIndex(e.clientY), gs = navPrefs.groups;
      if (idx < 0) return;
      if (idx < gs.length) { const head = $(`#nav [data-group-head="${gs[idx]}"]`); if (head) head.classList.add('gdrop-before'); }
      else { const list = groupList(gs[gs.length - 1]); if (list) list.classList.add('gdrop-after'); }
    });
    nav.addEventListener('dragleave', (e) => { if (dragGroup && !nav.contains(e.relatedTarget)) clearDropMarks(); });
    nav.addEventListener('drop', (e) => {
      if (!dragGroup) return;
      e.preventDefault();
      const g = dragGroup, idx = groupDropIndex(e.clientY);
      dragGroup = null; clearDropMarks();
      if (idx >= 0) moveGroup(g, idx); else renderNav();
    });
  }
  let prefsDb = null, prefsUser = null, prefsVersion = null;
  function savePrefs() {
    store.set('nav', navPrefs);
    if (prefsDb && prefsUser) {
      try { prefsDb.doc('data/users/' + prefsUser + '/prefs/nav').set({ order: navPrefs.order, groups: navPrefs.groups, deleted: navPrefs.deleted, starred: navPrefs.starred, labels: navPrefs.labels, at: Date.now() }).catch(() => {}); } catch (e) {}
    }
  }
  async function loadPrefsFromDb() {
    if (!window.claude || !window.claude.use) return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db').catch(() => null), window.claude.use('user').catch(() => null)]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      prefsDb = db; prefsUser = id;
      const snap = await db.doc('data/users/' + id + '/prefs/nav').get();
      const d = snap && (snap.data ? (typeof snap.data === 'function' ? snap.data() : snap.data) : snap);
      if (d && d.order) { navPrefs = normalizePrefs(d); store.set('nav', navPrefs); renderNav(); }
    } catch (e) {}
  }
  function navItem(v, group) {
    const n = NAV[v];
    const starred = navPrefs.starred.includes(v);
    const btn = h('button', { type: 'button', class: 'navbtn', 'data-view': v, title: n.label, 'aria-current': String(current === v ? 'page' : 'false'), onclick: () => show(v) });
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">' + n.icon + '</svg>';
    btn.append(n.label);
    if (n.tag) btn.append(h('span', { class: 'tag', text: n.tag }));
    if (PATH.includes(v)) btn.append(h('span', { class: 'pmark' + (visited[v] ? ' seen' : ''), 'data-pmark': v, role: 'img', title: pmarkLabel(v), 'aria-label': pmarkLabel(v), text: String(PATH.indexOf(v) + 1) }));
    const star = h('button', { type: 'button', class: 'star', 'aria-pressed': String(starred), 'aria-label': (starred ? 'Unstar ' : 'Star ') + n.label, title: starred ? 'Unstar' : 'Star' });
    star.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>';
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = navPrefs.starred.indexOf(v);
      if (i >= 0) navPrefs.starred.splice(i, 1); else navPrefs.starred.push(v);
      savePrefs(); renderNav();
    });
    const item = h('div', { class: 'nav-item' + (starred ? ' starred' : ''), draggable: 'true', 'data-view': v, 'data-group': group }, btn, star);
    item.addEventListener('dragstart', (e) => { dragView = v; item.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', v); e.dataTransfer.effectAllowed = 'move'; } catch (err) {} });
    item.addEventListener('dragend', () => { dragView = null; item.classList.remove('dragging'); clearDropMarks(); });
    btn.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      /* One step within the group; at its edge, into the end (Up) or start (Down) of the neighbouring group, empty ones included. */
      const gs = allGroups(), g = gs.find((x) => navPrefs.order[x].includes(v)), i = navPrefs.order[g].indexOf(v), up = e.key === 'ArrowUp';
      if (up && i > 0) moveView(v, g, i - 1);
      else if (!up && i < navPrefs.order[g].length - 1) moveView(v, g, i + 1);
      else { const ng = gs[gs.indexOf(g) + (up ? -1 : 1)]; if (!ng) return; moveView(v, ng, up ? navPrefs.order[ng].length : 0); }
      const again = $(`.navbtn[data-view="${v}"]`); if (again) again.focus();
    });
    return item;
  }
  let dragView = null;
  function allGroups() { return navPrefs.groups.concat('extras'); }
  function clearDropMarks() { $$('.drop-before, .drop-after, .drop-into, .gdrop-before, .gdrop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into', 'gdrop-before', 'gdrop-after')); }
  function moveView(v, group, index) {
    allGroups().forEach((g) => { navPrefs.order[g] = navPrefs.order[g].filter((x) => x !== v); });
    const list = navPrefs.order[group];
    list.splice(Math.max(0, Math.min(index, list.length)), 0, v);
    savePrefs(); renderNav();
  }
  function bindDropList(list, group) {
    list.addEventListener('dragover', (e) => {
      if (!dragView) return;
      e.preventDefault();
      clearDropMarks();
      const item = e.target.closest('.nav-item');
      if (item && item.dataset.view !== dragView) {
        const r = item.getBoundingClientRect();
        item.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
      } else if (!item) list.classList.add('drop-into');
    });
    list.addEventListener('dragleave', (e) => { if (!list.contains(e.relatedTarget)) clearDropMarks(); });
    list.addEventListener('drop', (e) => {
      if (!dragView) return;
      e.preventDefault();
      const item = e.target.closest('.nav-item');
      let idx = navPrefs.order[group].length;
      if (item && item.dataset.view !== dragView) {
        const r = item.getBoundingClientRect();
        const others = navPrefs.order[group].filter((x) => x !== dragView);
        idx = others.indexOf(item.dataset.view) + (e.clientY < r.top + r.height / 2 ? 0 : 1);
        navPrefs.order[group] = others;
      }
      const v = dragView; dragView = null; clearDropMarks();
      moveView(v, group, idx);
    });
  }
  function pathHint() {
    const help = h('button', { type: 'button', class: 'ph-help', text: '?', title: 'What is the learning path?', 'aria-label': 'What is the learning path? Opens Start here', onclick: () => show('home') });
    const x = h('button', { type: 'button', class: 'ph-x', title: 'Hide this note', 'aria-label': 'Hide the learning path note' });
    x.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
    const el = h('div', { class: 'path-hint' }, h('span', { text: 'Path 1–' + PATH.length + ' · filled = visited', title: 'Numbered circles mark the ' + PATH.length + ' steps of the learning path; a filled circle means you have visited that step' }), help, x);
    x.addEventListener('click', () => { store.set('path-hint-off', true); el.remove(); });
    return el;
  }
  /* the menu tabs lift off the page one after another, quick and light, like a finger run down piano keys */
  let navPlayed = false;
  function playKeys(root) {
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { return; }
    Array.prototype.forEach.call((root || document).querySelectorAll('.navbtn'), (b, i) => {
      if (!b.animate || !b.offsetParent) return;
      try { b.animate([{ opacity: 0, transform: 'translateY(8px) scale(.97)', boxShadow: '0 0 0 rgba(0,0,0,0)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.04)', boxShadow: '0 8px 18px rgba(0,0,0,.18)', offset: 0.5 }, { opacity: 1, transform: 'none', boxShadow: '0 0 0 rgba(0,0,0,0)' }], { duration: 380, delay: 80 + i * 24, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' }); } catch (e) {}
    });
  }
  function renderNav() {
    if (!navPlayed) { navPlayed = true; setTimeout(() => playKeys(document), 60); }
    const nav = $('#nav');
    nav.replaceChildren();
    if (!nav.dataset.gbound) { bindGroupDrop(nav); nav.dataset.gbound = '1'; }
    /* One-line key for the step circles, under the heading of the first group holding a path tab, until dismissed. */
    const hintGroup = store.get('path-hint-off', false) ? null : navPrefs.groups.find((g) => navPrefs.order[g].some((v) => PATH.includes(v)));
    navPrefs.groups.forEach((g, gi) => {
      nav.append(groupHeader(g, gi === 0));
      if (g === hintGroup) nav.append(pathHint());
      const list = h('div', { class: 'nav-list', 'data-group': g, 'data-empty-hint': 'Drag tabs here' }, ...navPrefs.order[g].map((v) => navItem(v, g)));
      bindDropList(list, g);
      nav.append(list);
    });
    const plus = h('button', { type: 'button', class: 'nav-add', title: 'New group', 'aria-label': 'New group', onclick: newGroup });
    plus.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg><span>New group</span>';
    nav.append(h('div', { class: 'nav-tools' }, plus,
      h('button', { type: 'button', class: 'nav-reset', text: 'Reset layout', title: 'Restore the default groups, names and tab order (stars are kept)', onclick: resetLayout })));
    if (pendingRename) {
      const hd = $(`#nav [data-group-head="${pendingRename}"]`); pendingRename = null;
      if (hd) { hd.scrollIntoView({ block: 'nearest' }); if ($('#shell').classList.contains('left-collapsed')) hd.focus(); else hd._rename(); }
    }
    const exHead = $('#extrasWrap .extras-title');
    if (exHead) exHead.replaceWith(groupHeader('extras', false));
    const ex = $('#navExtras');
    ex.replaceChildren(...navPrefs.order.extras.map((v) => navItem(v, 'extras')));
    if (!navPrefs.order.extras.length) ex.append(h('div', { class: 'extras-hint', text: 'Drag tabs here to keep them out of the way.' }));
    if (!ex.dataset.bound) { bindDropList(ex, 'extras'); ex.dataset.bound = '1'; }
  }
  renderNav();
  loadPrefsFromDb();

  /* --------------------------------------- resizable, collapsible split panes */
  function initSplits() {
    $$('[data-split]').forEach((el) => {
      const key = 'split:' + el.dataset.split;
      const min = +el.dataset.min || 180, max = +el.dataset.max || 600, def = +el.dataset.def || 300;
      const st = Object.assign({ w: def, collapsed: false }, store.get(key, {}));
      const apply = () => { el.style.setProperty('--left', Math.max(min, Math.min(max, st.w)) + 'px'); el.classList.toggle('left-collapsed', !!st.collapsed); };
      apply();
      const gutter = $(':scope > .gutter', el);
      if (!gutter) return;
      const toggle = () => { st.collapsed = !st.collapsed; apply(); store.set(key, st); if (!st.collapsed) playKeys(el); };
      $('.gutter-btn', gutter).addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      gutter.addEventListener('dblclick', toggle);
      gutter.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); st.collapsed = false; st.w += e.key === 'ArrowLeft' ? -24 : 24; st.w = Math.max(min, Math.min(max, st.w)); apply(); store.set(key, st); }
        if (e.key === 'Enter') toggle();
      });
      gutter.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.gutter-btn')) return;
        e.preventDefault();
        const left = el.getBoundingClientRect().left;
        gutter.classList.add('dragging');
        try { gutter.setPointerCapture(e.pointerId); } catch (err) {}
        const move = (ev) => { st.collapsed = false; st.w = Math.max(min, Math.min(max, ev.clientX - left)); apply(); };
        const up = () => { gutter.classList.remove('dragging'); gutter.removeEventListener('pointermove', move); gutter.removeEventListener('pointerup', up); store.set(key, st); };
        gutter.addEventListener('pointermove', move);
        gutter.addEventListener('pointerup', up);
      });
    });
  }
  initSplits();

  /* ------------------------------------------------- collapsible sections */
  const CHEV = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 6 4 4 4-4"/></svg>';
  function initSections(view) {
    $$('.section > header', view).forEach((hd) => {
      if (hd.dataset.coll) return;
      hd.dataset.coll = '1';
      const sec = hd.parentElement, h2 = $('h2', hd);
      if (!h2) return;
      const key = 'sec:' + view.id + ':' + h2.textContent.trim();
      const btn = h('button', { type: 'button', class: 'sec-toggle', 'aria-label': 'Collapse or expand ' + h2.textContent.trim(), 'aria-expanded': 'true' });
      btn.innerHTML = CHEV;
      h2.prepend(btn);
      const set = (c) => { sec.classList.toggle('collapsed', c); btn.setAttribute('aria-expanded', String(!c)); };
      set(!!store.get(key, false));
      btn.addEventListener('click', () => { const c = !sec.classList.contains('collapsed'); set(c); store.set(key, c); });
    });
  }

  function mountApp(view) {
    if (typeof view === 'string') view = $('#view-' + view);
    if (!view || $('iframe', view)) return;
    const f = h('iframe', { class: 'app-frame', src: view.dataset.src, title: $('.app-bar b', view).textContent, allow: 'clipboard-write' });
    f.addEventListener('load', () => { const l = $('.loading', view); if (l) l.remove(); syncFrameTheme(f); f.dataset.loaded = '1'; });
    view.append(f);
    $('[data-reload]', view).onclick = () => { try { f.contentWindow.location.reload(); } catch (e) { f.src = f.src; } };
  }

  /* ------------------------------------------------------------------- data */
  const RENDER = {};
  DATA.ready = true;
  { const ao = $('#asOf'); if (ao) ao.textContent = ''; }
  renderNav();
  show(location.hash.slice(1) || 'home');

  /* ------------------------------------------------------- Ask Claude (sample) */
  let samplePromise = null;
  function getSample() {
    if (!samplePromise) samplePromise = (window.claude && window.claude.use ? window.claude.use('sample').catch(() => null) : Promise.resolve(null));
    return samplePromise;
  }
  function askBox(label, getContext) {
    const box = h('div', { class: 'ask', hidden: true });
    const inp = h('input', { type: 'text', id: 'ask-' + Math.random().toString(36).slice(2, 8), placeholder: 'Ask Claude about ' + label, 'aria-label': 'Question for Claude' });
    const btn = h('button', { class: 'btn primary', type: 'button', text: 'Ask' });
    const ans = h('div', { class: 'ans', 'aria-live': 'polite' });
    box.append(h('h4', { text: 'Ask Claude' }), h('div', { class: 'row' }, inp, btn), ans);
    let ctrl = null;
    async function go() {
      const q = inp.value.trim();
      if (!q) { inp.focus(); return; }
      const sample = await getSample();
      if (!sample) { box.hidden = true; return; }
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      btn.disabled = true; ans.textContent = 'Thinking…';
      const ctx = getContext();
      const prompt = 'You are helping a Pigment implementation consultant learn how their tooling works. ' +
        'Answer the question using the material below. Be concrete, cite file or section names where useful, ' +
        'and keep it under 180 words of plain prose (no headings).\n\n<material name="' + label + '">\n' + ctx.slice(0, 60000) + '\n</material>\n\nQuestion: ' + q;
      try {
        const r = await sample(prompt, { signal: ctrl.signal, onText: ({ text }) => { ans.textContent = text; } });
        ans.textContent = r.text || ans.textContent;
      } catch (e) {
        if (e && e.code === 'not_granted') { box.hidden = true; return; }
        ans.textContent = e && e.code === 'rate_limited' ? 'Claude is busy right now. Try again in a minute.' : 'No answer came back' + (e && e.message ? ': ' + e.message : '.') ;
      } finally { btn.disabled = false; }
    }
    btn.addEventListener('click', go);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    getSample().then((sm) => { box.hidden = !sm; });
    return box;
  }

  /* ------------------------------------------------------------ markdown */
  function renderMd(text) {
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    let html;
    try { html = window.marked ? window.marked.parse(body, { gfm: true }) : null; } catch (e) { html = null; }
    const div = h('div', { class: 'md' });
    if (html && window.DOMPurify) div.innerHTML = window.DOMPurify.sanitize(html);
    else div.append(h('pre', { class: 'rawcode', text: body }));
    $$('a', div).forEach((a) => { const href = a.getAttribute('href') || ''; if (!/^https?:/.test(href)) a.removeAttribute('href'); else a.target = '_blank'; });
    return div;
  }

  /* outline with a step-through animation; returns {el, attach(mdEl)} */
  function outlineBlock(headings, onPick) {
    const hs = (headings || []).filter((x) => x[0] <= 3);
    const wrap = h('div', { class: 'section', style: { gap: '8px' } });
    if (!hs.length) return { el: wrap, attach() {} };
    const btn = h('button', { class: 'btn', type: 'button' }, h('span', { text: 'Walk through' }));
    const list = h('ol', { class: 'outline' });
    hs.forEach((x, i) => list.append(h('li', { class: 'h' + x[0], text: x[1].replace(/[`*_]/g, ''), onclick: () => onPick(i), style: { cursor: 'pointer' } })));
    wrap.append(h('div', { class: 'outline-head' }, h('h4', { text: 'Outline · ' + hs.length + ' sections' }), btn), list);
    let timer = null, i = -1;
    const items = $$('li', list);
    function stop() { clearInterval(timer); timer = null; $('span', btn).textContent = 'Walk through'; }
    function step() {
      i++;
      if (i >= items.length) { stop(); items.forEach((li) => li.classList.remove('lit')); i = -1; return; }
      items.forEach((li, k) => { li.classList.toggle('lit', k === i); li.classList.toggle('past', k < i); });
      items[i].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    btn.addEventListener('click', () => {
      if (timer) { stop(); return; }
      items.forEach((li) => li.classList.remove('lit', 'past')); i = -1;
      $('span', btn).textContent = 'Stop'; step(); timer = setInterval(step, reduceMotion ? 1400 : 650);
    });
    return { el: wrap, stop };
  }

  // expose a couple of helpers for cross-tab links
  window.__atlas = { openFile() {}, selectSkill() {}, show, mountApp, VIEWS, PATH, STOPS: PSTOPS, skills: [], harnessFiles: {} };
})();
