/* Framecraft — Studio: playful, optional ways to move through frames.
   Everything here is off by default except the paper ripple, and lives behind the Studio menu:
   - Paper ripple: the frame sheet settles with a short damped wave as it lifts into 3D (view.js draws it).
   - Gallery: a museum of rooms, one per persona; frames hang like paintings; pick one to step into it.
   - Flipbook: switching frames collapses the 3D and pages through the other frames like a storybook.
   - Journey: a guided camera walk from the blocks, down to Blockflow, up a trace beam, onto a living frame. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 60) : ms));
  const KEY = 'strata:play';
  const DEFAULTS = { ripple: true, gallery: false, flipbook: false, journey: false, alt: 'off' };

  function load() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(play.prefs)); } catch (e) {} }

  const play = (S.play = { prefs: load(), api: null, busy: false });
  const V = () => S.view;

  /* ---------- Studio menu ---------- */
  const TOGGLES = [
    ['ripple', 'Paper ripple', 'The frame settles like a sheet of paper as it lifts into 3D.'],
    ['gallery', 'Gallery', 'Choose frames in a museum, one room per persona.'],
    ['flipbook', 'Flipbook', 'Switching frames pages through the others like a storybook.'],
    ['journey', 'Journey', 'Adds a guided walk from the blocks up into a living frame.'],
  ];
  function renderMenu() {
    const pop = $('#studioPop');
    const p = play.prefs;
    let h = '<div class="sec-title">Studio <span class="muted small">Optional, just for fun</span></div>';
    h += TOGGLES.map(([k, name, sub]) => '<div class="studio-row"><div><b>' + name + '</b><span>' + sub + '</span></div><button type="button" class="switch" role="switch" aria-checked="' + !!p[k] + '" aria-label="' + name + '" data-pref="' + k + '"><i></i></button></div>').join('');
    if (S.alt) h += S.alt.menuHtml(p.alt);
    const acts = [];
    if (p.gallery) acts.push('<button type="button" class="btn" data-act="gallery">Walk the gallery</button>');
    if (p.journey) acts.push('<button type="button" class="btn btn-primary" data-act="journey">Begin the journey</button>');
    if (acts.length) h += '<div class="studio-acts">' + acts.join('') + '</div>';
    pop.innerHTML = h;
    const r = $('#btnStudio').getBoundingClientRect();
    pop.style.left = Math.max(16, Math.min(r.right - 340, window.innerWidth - 356)) + 'px';
  }
  function setPref(k, v) {
    play.prefs[k] = v;
    save();
    if (k === 'ripple') V().opts.ripple = !!v;
    if (k === 'journey') renderJourneyButton();
    if (k === 'alt' && S.alt) S.alt.set(v);
    $('#btnStudio').classList.toggle('is-lit', TOGGLES.some(([t]) => t !== 'ripple' && play.prefs[t]) || (play.prefs.alt && play.prefs.alt !== 'off'));
  }
  function renderJourneyButton() {
    let b = $('#journeyStart');
    if (!b) {
      b = document.createElement('button');
      b.id = 'journeyStart'; b.type = 'button'; b.className = 'journey-start studio-ui';
      b.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4z"/></svg><span>Begin the journey</span>';
      b.addEventListener('click', () => startJourney());
      $('#stage').appendChild(b);
    }
    b.hidden = !play.prefs.journey || !!journey;
  }

  play.init = function (api) {
    play.api = api;
    V().opts.ripple = !!play.prefs.ripple;
    $('#btnStudio').addEventListener('click', (e) => {
      e.stopPropagation();
      const p = $('#studioPop');
      api.closePops('#studioPop');
      p.hidden = !p.hidden;
      if (!p.hidden) renderMenu();
    });
    $('#studioPop').addEventListener('click', (e) => {
      e.stopPropagation();
      const sw = e.target.closest('[data-pref]');
      if (sw) { setPref(sw.dataset.pref, !play.prefs[sw.dataset.pref]); renderMenu(); return; }
      const alt = e.target.closest('[data-alt]');
      if (alt) { setPref('alt', alt.dataset.alt); renderMenu(); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      $('#studioPop').hidden = true;
      if (a.dataset.act === 'gallery') openGallery();
      if (a.dataset.act === 'journey') startJourney();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (journey) { e.stopPropagation(); exitJourney(); }
      else if (gallery) { e.stopPropagation(); closeGallery(); }
    }, true);
    setPref('ripple', play.prefs.ripple);
    renderJourneyButton();
    if (S.alt) S.alt.init(api, play.prefs.alt);
  };
  play.wantsGallery = () => !!play.prefs.gallery;
  play.setAlt = function (mode) { setPref('alt', mode); if (!$('#studioPop').hidden) renderMenu(); };
  /* Called by the picker: flip through pages if the flipbook is on, else just open. */
  play.switchTo = function (key) {
    const api = play.api;
    if (!api.currentKey() || key === api.currentKey()) return api.openFrame(key);
    if (play.prefs.flipbook && !play.busy) return flipTo(key);
    return api.openFrame(key);
  };

  /* ---------- frames + thumbnails ---------- */
  function allFrames() {
    const list = play.api.frameList();
    return list.map((f) => Object.assign({ room: f.key === S.demo.key ? 'cfo' : S.samples && S.samples.has(f.key) ? S.samples.roomOf(f.key) : 'yours' }, f));
  }
  const thumbCache = new Map();
  function thumbOf(key) {
    if (thumbCache.has(key)) return thumbCache.get(key);
    const snap = play.api.snapFor(key);
    const svg = snap && S.samples ? S.samples.thumb(snap) : '<svg viewBox="0 0 1280 800"><rect width="1280" height="800" fill="#f4f6fb"/><text x="640" y="410" text-anchor="middle" font-family="Inter,sans-serif" font-size="40" fill="#7c879d">Saved frame</text></svg>';
    thumbCache.set(key, svg);
    return svg;
  }

  /* ---------- the gallery: a museum with one room per persona ---------- */
  let gallery = null;
  function openGallery() {
    if (gallery) return;
    const frames = allFrames();
    const rooms = S.samples.rooms.slice();
    if (frames.some((f) => f.room === 'yours')) rooms.push({ id: 'yours', name: 'Your Collection', persona: 'You', blurb: 'Frames you have loaded or saved.', wall: 'study' });
    const cur = play.api.currentKey();
    let start = Math.max(0, rooms.findIndex((r) => frames.some((f) => f.key === cur && f.room === r.id)));
    const el = document.createElement('div');
    el.className = 'gal studio-ui';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Frame gallery');
    el.innerHTML = '<div class="gal-world"><div class="gal-cam">' + rooms.map((r, i) => roomHtml(r, i, frames.filter((f) => f.room === r.id), cur)).join('') + '</div></div>' +
      '<header class="gal-head"><div><span class="gal-kicker">Framecraft gallery</span><span class="gal-hint">Arrow keys to walk · Esc to leave</span></div><button type="button" class="btn" data-gal="close">Leave the gallery</button></header>' +
      '<nav class="gal-nav" aria-label="Rooms"><button type="button" class="gal-arrow" data-gal="prev" aria-label="Previous room">‹</button>' + rooms.map((r, i) => '<button type="button" class="gal-tab" data-room="' + i + '"><b>' + esc(r.persona) + '</b><span>' + esc(r.name) + '</span></button>').join('') + '<button type="button" class="gal-arrow" data-gal="next" aria-label="Next room">›</button></nav>';
    document.body.appendChild(el);
    gallery = { el, rooms, idx: start };
    sizeGallery();
    goRoom(start, true);
    requestAnimationFrame(() => el.classList.add('is-open'));
    el.addEventListener('click', onGalClick);
    window.addEventListener('keydown', onGalKey);
    window.addEventListener('resize', sizeGallery);
  }
  function roomHtml(r, i, frames, cur) {
    const art = frames.length ? frames.map((f) => '<button type="button" class="painting' + (f.key === cur ? ' is-current' : '') + '" data-frame="' + esc(f.key) + '" aria-label="Open ' + esc(f.name) + '"><span class="pt-frame"><span class="pt-mat"><span class="pt-canvas">' + thumbOf(f.key) + '</span></span></span><span class="pt-light" aria-hidden="true"></span><span class="placard"><b>' + esc(f.name) + '</b><span>' + esc(f.application || 'Frame') + (f.source === 'sample' ? ' · sample data' : '') + '</span></span></button>').join('')
      : '<p class="gal-empty">This room is waiting for its first frame.</p>';
    return '<section class="gal-room wall-' + r.wall + '" style="--i:' + i + '" data-room="' + i + '">' +
      '<div class="rm rm-back"><div class="rm-title"><span>' + esc(r.persona) + '</span><h2>' + esc(r.name) + '</h2><p>' + esc(r.blurb) + '</p></div><div class="hang">' + art + '</div></div>' +
      '<div class="rm rm-floor"></div><div class="rm rm-ceil"></div><div class="rm rm-left"></div><div class="rm rm-right"></div><div class="rm rm-bench" aria-hidden="true"></div></section>';
  }
  function sizeGallery() {
    if (!gallery) return;
    const f = Math.min(window.innerWidth / 1500, window.innerHeight / 940);
    gallery.el.style.setProperty('--gs', Math.max(0.42, Math.min(1.25, f)).toFixed(3));
  }
  function goRoom(i, instant) {
    const g = gallery;
    g.idx = (i + g.rooms.length) % g.rooms.length;
    const cam = $('.gal-cam', g.el);
    if (instant) cam.style.transition = 'none';
    cam.style.setProperty('--room', g.idx);
    if (instant) { void cam.offsetWidth; cam.style.transition = ''; }
    else if (!reduce) { const w = $('.gal-world', g.el); w.classList.remove('is-walking'); void w.offsetWidth; w.classList.add('is-walking'); }
    $$('.gal-tab', g.el).forEach((b, k) => b.setAttribute('aria-current', String(k === g.idx)));
    $$('.gal-room', g.el).forEach((r, k) => r.classList.toggle('is-here', k === g.idx));
  }
  function onGalKey(e) {
    if (!gallery) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goRoom(gallery.idx + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goRoom(gallery.idx - 1); }
  }
  function onGalClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.gal === 'close') return closeGallery();
    if (b.dataset.gal === 'prev') return goRoom(gallery.idx - 1);
    if (b.dataset.gal === 'next') return goRoom(gallery.idx + 1);
    if (b.dataset.room) return goRoom(+b.dataset.room);
    if (b.dataset.frame) {
      const room = b.closest('.gal-room');
      if (room && +room.dataset.room !== gallery.idx) return goRoom(+room.dataset.room);
      stepInto(b);
    }
  }
  function closeGallery() {
    if (!gallery) return;
    const g = gallery;
    gallery = null;
    window.removeEventListener('keydown', onGalKey);
    window.removeEventListener('resize', sizeGallery);
    g.el.classList.remove('is-open');
    setTimeout(() => g.el.remove(), reduce ? 0 : 420);
  }
  /* Picking a painting: the camera leans in, the canvas flies to where the frame lives, then Framecraft takes over. */
  async function stepInto(btn) {
    if (play.busy) return;
    play.busy = true;
    const key = btn.dataset.frame;
    const api = play.api;
    const canvas = $('.pt-canvas', btn);
    const from = canvas.getBoundingClientRect();
    const to = frameRect();
    const g = gallery;
    const world = $('.gal-world', g.el);
    world.style.transformOrigin = (from.left + from.width / 2) + 'px ' + (from.top + from.height / 2) + 'px';
    g.el.classList.add('is-leaving');
    const fly = flyer(thumbOf(key), from);
    await wait(380);
    const prevMode = api.mode();
    const was3d = prevMode === 'layers';
    if (was3d) V().setMode('frame', { instant: true });
    if (key !== api.currentKey()) await api.openFrame(key);
    moveFlyer(fly, to, 820);
    await wait(860);
    closeGallery();
    fly.classList.add('is-gone');
    setTimeout(() => fly.remove(), 400);
    if (was3d) { await wait(160); V().setMode('layers'); }
    play.busy = false;
  }
  function frameRect() {
    const st = $('#stage').getBoundingClientRect();
    const v = V();
    let s, cx = st.left + st.width / 2, cy = st.top + st.height / 2;
    if (play.api.mode() === 'trace') {
      const p0 = v.projectPlanePoint(0, 0), p1 = v.projectPlanePoint(v.W, v.H);
      return { left: st.left + p0.x, top: st.top + p0.y, width: p1.x - p0.x, height: p1.y - p0.y };
    }
    s = Math.min((st.width - 40) / v.W, (st.height - 40) / v.H, 1.3);
    return { left: cx - (v.W * s) / 2, top: cy - (v.H * s) / 2, width: v.W * s, height: v.H * s };
  }
  function flyer(svg, r) {
    const d = document.createElement('div');
    d.className = 'flyer';
    d.innerHTML = svg;
    Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(d);
    return d;
  }
  function moveFlyer(d, r, ms) {
    d.style.transition = reduce ? 'none' : 'left ' + ms + 'ms cubic-bezier(.65,0,.25,1), top ' + ms + 'ms cubic-bezier(.65,0,.25,1), width ' + ms + 'ms cubic-bezier(.65,0,.25,1), height ' + ms + 'ms cubic-bezier(.65,0,.25,1), border-radius ' + ms + 'ms';
    Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  play.openGallery = openGallery;

  /* ---------- the flipbook ---------- */
  async function flipTo(key) {
    const api = play.api;
    play.busy = true;
    const prevMode = api.mode();
    const frames = allFrames();
    const curKey = api.currentKey();
    const ci = Math.max(0, frames.findIndex((f) => f.key === curKey));
    const ti = frames.findIndex((f) => f.key === key);
    // pages: walk forward from the current frame to the target, at most five pages in between
    const seq = [];
    for (let k = 1; k <= frames.length; k++) { const f = frames[(ci + k) % frames.length]; seq.push(f); if (f.key === key) break; }
    while (seq.length > 6) seq.splice(1 + Math.floor((seq.length - 2) / 2), 1);
    if (ti < 0) { play.busy = false; return api.openFrame(key); }
    if (prevMode === 'layers' || prevMode === 'trace') { api.setMode('frame'); await wait(140); } // the book's backdrop covers the rest of the collapse
    const st = $('#stage').getBoundingClientRect();
    const fr = frameRect();
    const pw = Math.min(st.width * 0.43, (st.height * 0.7) * 1.6), ph = pw / 1.6;
    const book = document.createElement('div');
    book.className = 'flipbook studio-ui';
    book.style.setProperty('--pw', pw + 'px');
    book.style.setProperty('--ph', ph + 'px');
    const bx = st.left + st.width / 2, by = st.top + st.height / 2;
    book.style.left = bx + 'px'; book.style.top = by + 'px';
    const curName = (frames[ci] || {}).name || '';
    book.innerHTML = '<div class="fb-spread"><div class="fb-left"><div class="fb-title"><span>Framecraft</span><b>' + esc(curName) + '</b></div></div><div class="fb-right"><div class="fb-page fb-under">' + thumbOf(curKey) + '</div></div></div><div class="fb-caption"></div>';
    document.body.appendChild(book);
    // the live frame shrinks into the book
    const fly = flyer(thumbOf(curKey), fr);
    fly.classList.add('is-page');
    await wait(30);
    book.classList.add('is-open');
    moveFlyer(fly, { left: bx, top: by - ph / 2, width: pw, height: ph }, 190);
    await wait(200);
    fly.remove();
    const right = $('.fb-right', book), under = $('.fb-under', book), caption = $('.fb-caption', book);
    let prev = curKey;
    for (let i = 0; i < seq.length; i++) {
      const f = seq[i], last = i === seq.length - 1;
      const dur = reduce ? 1 : i === 0 ? 140 : last ? 190 : 80;
      under.innerHTML = thumbOf(f.key);
      const leaf = document.createElement('div');
      leaf.className = 'fb-leaf';
      leaf.style.setProperty('--d', dur + 'ms');
      leaf.innerHTML = '<div class="fb-face fb-front">' + thumbOf(prev) + '<i class="fb-shade"></i></div><div class="fb-face fb-back"><div class="fb-title"><span>' + esc(roomName(f.room)) + '</span><b>' + esc(f.name) + '</b><em>' + esc(f.application || '') + '</em></div><i class="fb-shade"></i></div>';
      right.appendChild(leaf);
      caption.textContent = f.name;
      void leaf.offsetWidth;
      leaf.classList.add('is-turning');
      if (last && f.key !== api.currentKey()) api.openFrame(f.key);
      await wait(dur + 8);
      const lp = $('.fb-left', book);
      lp.innerHTML = $('.fb-back', leaf).innerHTML;
      leaf.remove();
      prev = f.key;
    }
    // the chosen page lifts out of the book and becomes the frame
    const r2 = under.getBoundingClientRect();
    const fly2 = flyer(thumbOf(key), r2);
    fly2.classList.add('is-page');
    book.classList.add('is-closing');
    await wait(20);
    moveFlyer(fly2, frameRect(), 230);
    await wait(240);
    book.remove();
    fly2.classList.add('is-gone');
    setTimeout(() => fly2.remove(), 400);
    if (prevMode === 'layers' || prevMode === 'trace') api.setMode(prevMode);
    play.busy = false;
  }
  function roomName(id) { const r = S.samples.rooms.find((x) => x.id === id); return r ? r.name : 'Your Collection'; }

  /* ---------- the journey ---------- */
  let journey = null;
  const STEPS = [   /* the same arc as Frame World: Requirements -> Build -> Decide in the world -> Learn -> Update the frame */
    { id: 'blocks', kicker: 'I · Requirements', title: 'What the team asked for', text: 'Every block here began as a line someone said: headcount by region, budget by month and country. You are standing on the Pigment blocks those requirements became.' },
    { id: 'deep', kicker: 'II · Build', title: 'Beneath you, the model that was built', text: 'Far below runs Blockflow: every block behind this frame, and every formula that joins them. Proposed items become blocks here.' },
    { id: 'rise', kicker: 'II · Build', title: 'Follow a number upward', text: '' },
    { id: 'frame', kicker: 'III · Decide in the world', title: 'The frame informs, the world decides', text: 'Each column is a month of data standing on the page. It tells you where to look. What you find on a shelf or hear from a customer makes the call.' },
    { id: 'walk', kicker: 'IV · Learn, V · Update the frame', title: 'Step onto the frame', text: 'Step into Frame World and play the whole loop: requirements, build, decide in the world, learn, and bring the insight back to update the frame.' },
  ];
  async function startJourney() {
    const api = play.api;
    if (journey || play.busy || !api.graph()) return;
    const v = V();
    journey = {
      prevMode: api.mode(), token: {},
      saved: { blockflow: v.opts.blockflow, flow: v.opts.flow, traces: v.opts.traces, beam: v.opts.beam, op: Object.assign({}, v.opacity), gap: v.userGap },
      step: -1,
    };
    renderJourneyButton();
    $('#studioPop').hidden = true;
    if (S.alt) S.alt.suspend(true);
    $('#stage').classList.add('is-journey');
    const ui = document.createElement('div');
    ui.className = 'journey-ui studio-ui';
    ui.innerHTML = '<div class="jr-cap" aria-live="polite"><span class="jr-k"></span><h3></h3><p></p></div><div class="jr-ctl"><span class="jr-dots">' + STEPS.map(() => '<i></i>').join('') + '</span><button type="button" class="btn" data-jr="next">Next</button><button type="button" class="btn" data-jr="exit">Exit journey</button></div>';
    $('#stage').appendChild(ui);
    journey.ui = ui;
    ui.addEventListener('click', (e) => { const b = e.target.closest('[data-jr]'); if (!b) return; if (b.dataset.jr === 'exit') exitJourney(); else advance(); });
    if (api.mode() !== 'layers') { api.setMode('layers'); await wait(1500); }
    if (!journey) return;
    v.opts.traces = true;
    advance();
  }
  function caption(i, extra) {
    const s = STEPS[i], ui = journey.ui;
    const cap = $('.jr-cap', ui);
    cap.classList.remove('is-in');
    void cap.offsetWidth;
    $('.jr-k', cap).textContent = s.kicker;
    $('h3', cap).textContent = s.title;
    $('p', cap).textContent = extra || s.text;
    cap.classList.add('is-in');
    $$('.jr-dots i', ui).forEach((d, k) => d.classList.toggle('is-on', k <= i));
    const nx = $('[data-jr="next"]', ui);
    nx.hidden = i >= STEPS.length - 1;
    nx.textContent = STEPS[i + 1] && STEPS[i + 1].id === 'walk' ? 'Step onto the frame' : 'Next';
  }
  /* Ease a layer's opacity over time (journey only). */
  const fades = [];
  function fadeOp(layer, to, ms) {
    const v = V(), from = v.opacity[layer], t0 = performance.now();
    const fn = (now) => {
      const k = Math.min(1, (now - t0) / (reduce ? 1 : ms));
      v.opacity[layer] = from + (to - from) * (k * k * (3 - 2 * k));
      if (k >= 1) { const i = v.tickers.indexOf(fn); if (i >= 0) v.tickers.splice(i, 1); const j = fades.indexOf(fn); if (j >= 0) fades.splice(j, 1); }
    };
    fades.push(fn);
    v.tickers.push(fn);
  }
  function centroid(pts) { return pts.length ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length } : { x: 640, y: 400 }; }
  function pickChain() {
    const g = play.api.graph();
    const els = g.elements.filter((e) => e.cls === 'direct' && e.chain);
    let best = null;
    els.forEach((el) => {
      const ids = [...el.chain];
      const blk = ids.map((id) => g.nodes.get(id)).find((n) => n && n.layer === 'blocks' && n.kind === 'block' && n.group !== 'list');
      const lg = ids.map((id) => g.nodes.get(id)).find((n) => n && n.layer === 'logic');
      if (blk && lg && (!best || el.rect.y < best.el.rect.y)) best = { el, blk, lg };
    });
    return best;
  }
  async function advance() {
    if (!journey) return;
    const tok = (journey.token = {});
    journey.step++;
    const i = journey.step, v = V(), api = play.api;
    if (i >= STEPS.length) return;
    const H2 = v.H / 2, W2 = v.W / 2;
    const live = () => journey && journey.token === tok;
    if (STEPS[i].id === 'blocks') {
      caption(i);
      const pts = [];
      v.positions.forEach((p, id) => { const n = api.graph().nodes.get(id); if (n && n.layer === 'blocks') pts.push(p); });
      const c = centroid(pts);
      v.flyTo({ ax: 72, az: -26, s: 1.45, px: 0, py: v.stageH * 0.1, fu: c.x - W2, fv: c.y - H2 + 60, fz: v.zOf('blocks'), pp: 1250 }, 2600);
      await wait(6200);
      if (live()) advance();
    } else if (STEPS[i].id === 'deep') {
      caption(i);
      v.opts.blockflow = true;
      v.opacity.blocks = 0.42; v.opacity.logic = 0.35; v.opacity.frame = 0.35;
      v.flyTo({ ax: 26, az: -12, s: 0.62, px: 0, py: 0, fu: 0, fv: 0, fz: v.zOf('flow') * 0.55 + v.zOf('blocks') * 0.45, pp: 1700 }, 3200);
      await wait(3400);
      if (!live()) return;
      v.flyTo({ ax: 30, az: 8, s: 0.66, fz: v.zOf('flow') * 0.55 + v.zOf('blocks') * 0.45 }, 4200);
      await wait(4600);
      if (live()) advance();
    } else if (STEPS[i].id === 'rise') {
      const ch = pickChain();
      fadeOp('blocks', 1, 900); fadeOp('logic', 1, 900); fadeOp('frame', 0.18, 900);
      v.opts.flow = true; v.opts.beam = 0.18;
      if (!ch) { caption(i, 'Trace beams rise from each block through the frame logic to the numbers they become.'); await wait(3000); if (live()) advance(); return; }
      v.select(ch.el.id);
      const blkP = v.positions.get(ch.blk.id), lgP = v.positions.get(ch.lg.id);
      caption(i, 'This beam leaves ' + ch.blk.meta.name + ', passes through the ' + (ch.lg.name || 'frame logic') + ' data source, and becomes ' + ch.el.text + ' on the page.');
      if (blkP) { v.flyTo({ ax: 66, az: -22, s: 1.7, px: 0, py: v.stageH * 0.06, fu: blkP.x - W2, fv: blkP.y - H2, fz: v.zOf('blocks'), pp: 1300 }, 1800); await wait(2400); }
      if (!live()) return;
      if (lgP) { v.flyTo({ ax: 62, az: -16, s: 1.6, fu: lgP.x - W2, fv: lgP.y - H2, fz: v.zOf('logic') }, 1900); await wait(2500); }
      if (!live()) return;
      const ec = { x: ch.el.rect.x + ch.el.rect.w / 2, y: ch.el.rect.y + ch.el.rect.h / 2 };
      fadeOp('frame', 1, 1600);
      v.flyTo({ ax: 56, az: -12, s: 1.7, fu: ec.x - W2, fv: ec.y - H2, fz: v.zOf('frame') }, 2000);
      await wait(2900);
      if (live()) advance();
    } else if (STEPS[i].id === 'frame') {
      caption(i);
      v.select(null);
      v.opts.flow = false; v.opts.beam = 0.12; v.opts.blockflow = journey.saved.blockflow;
      fadeOp('frame', 1, 400);
      v.flyTo({ ax: 54, az: -14, s: 0.74, px: 0, py: -v.stageH * 0.04, fu: 0, fv: 40, fz: v.zOf('frame'), pp: 1600 }, 2200);
      await wait(900);
      if (live() && !Sculpture.el) Sculpture.build();
    } else if (STEPS[i].id === 'walk') {
      caption(i);
      let cb = null; try { cb = window.parent !== window ? window.parent.__canvas : null; } catch (e) { cb = null; }
      if (cb && cb.open) { exitJourney(); cb.open('frame-world', { from: 'Framecraft journey' }); return; }
      if (!Sculpture.el) Sculpture.build();
      Sculpture.walk();
    }
  }
  function exitJourney() {
    if (!journey) return;
    const j = journey, v = V();
    journey = null;
    if (S.walk) S.walk.close(true);
    Sculpture.destroy();
    fades.forEach((fn) => { const i = v.tickers.indexOf(fn); if (i >= 0) v.tickers.splice(i, 1); });
    fades.length = 0;
    Object.assign(v.opacity, j.saved.op);
    v.opts.blockflow = j.saved.blockflow; v.opts.flow = j.saved.flow; v.opts.traces = j.saved.traces; v.opts.beam = j.saved.beam;
    v.select(null);
    j.ui.remove();
    $('#stage').classList.remove('is-journey');
    if (S.alt) S.alt.suspend(false);
    play.api.setMode(j.prevMode === 'compare' ? 'frame' : j.prevMode);
    if (j.prevMode === 'layers') v.refit(true);
    renderJourneyButton();
  }
  play.startJourney = startJourney;
  play.exitJourney = exitJourney;
  play.inJourney = () => !!journey;

  /* ---------- the living frame: a data sculpture standing on the frame plane ---------- */
  const Sculpture = {
    el: null, filter: 'All', pinned: null,
    build() {
      const api = play.api, snap = api.snap(), v = V();
      const ds = (snap.dataSources || []).find((d) => d.labels.length && d.labels[0].binding === 'monthList');
      if (!ds) return;
      this.ds = ds;
      this.kds = (snap.dataSources || []).find((d) => !d.labels.length);
      this.sel = ds.selectors && ds.selectors[0] ? ds.selectors[0].binding : null;
      const plane = v.planeEl('frame');
      plane.classList.add('is-sculpted');
      const el = document.createElement('div');
      el.className = 'sculpt';
      el.innerHTML = '<div class="sc-floor"></div><div class="sc-bars"></div><div class="sc-kpis"></div><div class="sc-months"></div><div class="sc-title"></div>';
      plane.appendChild(el);
      this.el = el;
      const ui = journey.ui;
      const items = this.sel ? (snap.items[this.sel] || []) : [];
      const chips = document.createElement('div');
      chips.className = 'sc-chips';
      chips.innerHTML = items.length ? '<span>' + esc((E().blockMeta(snap, this.sel) || {}).name || 'Filter') + '</span>' + ['All'].concat(items).map((it) => '<button type="button" class="chipbtn" data-scf="' + esc(it) + '" aria-pressed="' + (it === 'All') + '">' + esc(it) + '</button>').join('') : '';
      ui.appendChild(chips);
      chips.addEventListener('click', (e) => { const b = e.target.closest('[data-scf]'); if (b) this.setFilter(b.dataset.scf); });
      const card = document.createElement('div');
      card.className = 'sc-card';
      card.hidden = true;
      ui.appendChild(card);
      this.card = card;
      card.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sc]');
        if (!b) return;
        if (b.dataset.sc === 'fx') S.crossLink && S.crossLink('formula-studio', b.dataset.key);
        if (b.dataset.sc === 'lineage') { const id = 'block:' + b.dataset.key; if (api.graph().nodes.has(id)) { v.select(id); api.showInspector(); } }
        if (b.dataset.sc === 'close') { this.pinned = null; card.hidden = true; this.mark(); }
      });
      el.addEventListener('pointermove', (e) => { const b = e.target.closest('.sc-bar'); if (!this.pinned) this.hover(b ? +b.dataset.i : null, e); });
      el.addEventListener('pointerleave', () => { if (!this.pinned) this.hover(null); });
      el.addEventListener('click', (e) => { const b = e.target.closest('.sc-bar'); if (!b) return; e.stopPropagation(); const i = +b.dataset.i; this.pinned = this.pinned === i ? null : i; this.hover(this.pinned, e, true); });
      this.render(true);
      requestAnimationFrame(() => el.classList.add('is-risen'));
    },
    rows() {
      const snap = play.api.snap(), d = snap.data[this.ds.name];
      if (!d) return [];
      const f = this.filter === 'All' ? null : d.filters[this.sel + '=' + this.filter];
      return (f || d.default).rows;
    },
    kpiRow() {
      if (!this.kds) return [];
      const d = play.api.snap().data[this.kds.name];
      if (!d) return [];
      const f = this.filter === 'All' ? null : d.filters[this.sel + '=' + this.filter];
      const r = (f || d.default).rows[0];
      return r ? r.values : [];
    },
    render(first) {
      const rows = this.rows(), snap = play.api.snap();
      const num = (x) => (typeof x === 'number' && isFinite(x) ? x : null);
      let max = 0;
      rows.forEach((r) => r.values.forEach((x) => { x = num(x); if (x != null && x > max) max = x; }));
      const n = rows.length || 1, x0 = 110, span = 1060, step = span / n, w = Math.min(54, step * 0.56), d = 54, y = 590, hMax = 250;
      const bars = $('.sc-bars', this.el), months = $('.sc-months', this.el);
      if (first || bars.children.length !== rows.length) {
        bars.innerHTML = rows.map((r, i) => '<div class="sc-bar" data-id="sc-' + i + '" data-i="' + i + '" style="left:' + (x0 + step * i + (step - w) / 2).toFixed(1) + 'px;top:' + y + 'px;width:' + w.toFixed(1) + 'px;height:' + d + 'px;--dl:' + (i * 70) + 'ms;--ph:' + (i * 0.37).toFixed(2) + 's"><div class="bx"><i class="f-top"></i><i class="f-front"></i><i class="f-back"></i><i class="f-left"></i><i class="f-right"></i></div><i class="plan"></i></div>').join('');
        months.innerHTML = rows.map((r, i) => '<span style="left:' + (x0 + step * i).toFixed(1) + 'px;width:' + step.toFixed(1) + 'px">' + esc(String(r.labels[0]).split(' ')[0]) + '</span>').join('');
      }
      const metaA = E().blockMeta(snap, this.ds.values[0].binding) || {};
      $$('.sc-bar', bars).forEach((b, i) => {
        const r = rows[i];
        const a = num(r.values[0]), p = num(r.values[1]), f = num(r.values[2]);
        const val = a != null ? a : f != null ? f : p;
        const h = val == null || !max ? 2 : Math.max(2, (val / max) * hMax);
        const hp = p == null || !max ? null : (p / max) * hMax;
        b.style.setProperty('--h', h.toFixed(1) + 'px');
        b.style.setProperty('--hp', hp == null ? '0px' : hp.toFixed(1) + 'px');
        b.classList.toggle('is-forecast', a == null);
        b.classList.toggle('is-ahead', a != null && p != null && a >= p);
        b.classList.toggle('no-plan', hp == null);
      });
      $('.sc-title', this.el).innerHTML = '<b>' + esc(snap.frame.name) + '</b><span>' + esc(metaA.name || this.ds.name) + (this.filter !== 'All' ? ' · ' + esc(this.filter) : '') + '</span>';
      const kv = this.kpiRow();
      const kn = this.kds ? Math.min(4, this.kds.values.length) : 0;
      let kh = '';
      for (let i = 0; i < kn; i++) {
        const m = E().blockMeta(snap, this.kds.values[i].binding) || {};
        kh += '<div class="sc-kpi" style="left:' + (110 + i * 270) + 'px;--ph:' + (i * 0.6).toFixed(1) + 's"><div class="sc-kpi-face"><span>' + esc(m.name || '') + '</span><b>' + esc(E().formatPigment(kv[i], m.format)) + '</b></div></div>';
      }
      $('.sc-kpis', this.el).innerHTML = kh;
      if (this.pinned != null) this.hover(this.pinned, null, true);
    },
    setFilter(it) {
      this.filter = it;
      journey && $$('[data-scf]', journey.ui).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scf === it)));
      this.render(false);
    },
    mark(i) { $$('.sc-bar', this.el).forEach((b, k) => { b.classList.toggle('is-hot', k === i); b.classList.toggle('is-dim', i != null && k !== i); }); },
    hover(i, e, pinned) {
      const card = this.card;
      this.mark(i);
      if (i == null) { card.hidden = true; return; }
      const snap = play.api.snap(), r = this.rows()[i];
      const num = (x) => (typeof x === 'number' && isFinite(x) ? x : null);
      const a = num(r.values[0]), p = num(r.values[1]), f = num(r.values[2]);
      const vals = this.ds.values.map((v) => E().blockMeta(snap, v.binding) || { name: v.binding, key: v.binding });
      const F = (x, m) => E().formatPigment(x, m && m.format);
      const shown = a != null ? a : f;
      const varAbs = shown != null && p != null ? shown - p : null;
      let h = '<div class="sc-card-head"><b>' + esc(r.labels[0]) + '</b>' + (a == null ? '<span class="tag">Forecast</span>' : '<span class="tag">Actual</span>') + (pinned ? '<button type="button" class="mini" data-sc="close" aria-label="Close">×</button>' : '') + '</div>';
      h += '<dl>';
      if (a != null) h += '<dt>' + esc(vals[0].name) + '</dt><dd>' + esc(F(a, vals[0])) + '</dd>';
      if (f != null && vals[2]) h += '<dt>' + esc(vals[2].name) + '</dt><dd>' + esc(F(f, vals[2])) + '</dd>';
      if (p != null && vals[1]) h += '<dt>' + esc(vals[1].name) + '</dt><dd>' + esc(F(p, vals[1])) + '</dd>';
      if (varAbs != null) h += '<dt>Variance</dt><dd class="' + (varAbs >= 0 ? 'good' : 'bad') + '">' + (varAbs >= 0 ? '+' : '−') + esc(F(Math.abs(varAbs), vals[0])) + ' · ' + (varAbs >= 0 ? '+' : '−') + Math.abs((varAbs / p) * 100).toFixed(1) + '%</dd>';
      h += '</dl><div class="sc-blocks">' + vals.map((m, k) => {
        const x = r.values[k];
        if (x == null) return '';
        return '<div class="sc-blk"><div class="sc-blk-h"><span class="bk-ico">' + (S.ICONS.metric) + '</span><b>' + esc(m.name) + '</b><span class="xlinks"><button type="button" class="xlink" data-sc="fx" data-key="' + esc(m.key) + '" title="Open in Formula Studio">ƒx</button><button type="button" class="xlink" data-sc="lineage" data-key="' + esc(m.key) + '">Lineage</button></span></div>' + (m.formula ? '<code>' + esc(m.formula) + '</code>' : m.input ? '<code class="muted">Input metric · no formula</code>' : '') + '</div>';
      }).join('') + '</div>';
      card.innerHTML = h;
      card.hidden = false;
      card.classList.toggle('is-pinned', !!pinned);
    },
    /* The last stop: hand the same data to the walk scene (js/walk.js). Leaving it returns to the living frame. */
    walk() {
      if (!S.walk || !this.ds) return;
      const snap = play.api.snap(), num = (x) => (typeof x === 'number' && isFinite(x) ? x : null);
      const metas = this.ds.values.map((v) => E().blockMeta(snap, v.binding) || { name: v.binding });
      const F = (x, m) => E().formatPigment(x, m && m.format);
      const items = this.sel ? (snap.items[this.sel] || []) : [];
      S.walk.open({
        title: snap.frame.name,
        subtitle: metas[0].name || this.ds.name,
        rows: () => this.rows().map((r) => {
          const a = num(r.values[0]), p = num(r.values[1]), f = num(r.values[2]);
          const parts = [];
          if (a != null) parts.push(metas[0].name + ' ' + F(a, metas[0]));
          if (f != null && metas[2]) parts.push(metas[2].name + ' ' + F(f, metas[2]));
          if (p != null && metas[1]) parts.push(metas[1].name + ' ' + F(p, metas[1]));
          return { label: r.labels[0], actual: a, plan: p, forecast: f, text: parts.join(' \u00b7 ') };
        }),
        kpis: () => {
          const kv = this.kpiRow(), out = [];
          for (let i = 0; this.kds && i < Math.min(4, this.kds.values.length); i++) { const m = E().blockMeta(snap, this.kds.values[i].binding) || {}; out.push({ name: m.name || '', text: E().formatPigment(kv[i], m.format) }); }
          return out;
        },
        selector: items.length ? { name: (E().blockMeta(snap, this.sel) || {}).name || 'Filter', items: ['All'].concat(items) } : null,
        filter: () => this.filter,
        setFilter: (it) => this.setFilter(it),
      }, () => {
        if (!journey) return;
        journey.step = STEPS.findIndex((s) => s.id === 'frame');
        caption(journey.step);
      });
    },
    destroy() {
      const plane = V().planeEl('frame');
      if (plane) plane.classList.remove('is-sculpted');
      if (this.el) this.el.remove();
      this.el = null; this.pinned = null; this.filter = 'All';
    },
  };
  const E = () => S.engine;
})();
