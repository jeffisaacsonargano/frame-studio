/* Framecraft — reimagined views of how a frame comes to be (Studio option, off by default).
   They replace the stacked 3D strata while in Layers mode; stacked layers stay the default.
   - Loom: every block is a horizontal thread; each number on the frame is a vertical thread
     woven up from the blocks it comes from, knotted where they meet.
   - Assembly: a timelapse. Values leave their blocks, pass through the frame logic and land
     on the page, and the frame assembles itself piece by piece.
   - Paint: blocks are tubes of pigment. Thick, glossy ribbons pour through the frame logic,
     mix in its wells and settle into the frame like paint drying on canvas.
   Hover, click and the Inspect pane behave as everywhere else: pills carry data-id and use the
   stage's own selection, so the lineage shows in the side pane. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const V = () => S.view;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MODES = [
    ['off', 'Stacked', 'The default 3D strata.'],
    ['loom', 'Loom', 'Block threads woven up into each number.'],
    ['assembly', 'Assembly', 'A timelapse: values fly in from their sources and the frame assembles.'],
    ['paint', 'Paint', 'Thick pigment pours from blocks, mixes in the logic and dries on the frame.'],
  ];
  const PIGMENT = { metric: '#6a2fb5', list: '#1f4fd0', table: '#c4245e', tx: '#14866d', prop: '#3b82c4', var: '#b5713a', constant: '#e2a21c', axis: '#5a6270', computed: '#2a9aa8' };

  const alt = (S.alt = { mode: 'off', api: null, suspended: false });
  let on = false, curMode = 'off', root = null, canvas = null, ctx = null, nodesHost = null, dpr = 1;
  let stageW = 0, stageH = 0, pills = new Map(), model = null, t0 = 0, dirty = true;
  let asm = { t: 0, playing: true, last: 0, dur: 9000 };
  let paintCache = null, paintKey = '';
  /* Assembly filter: click a block, logic node or number to assemble just its chain; Cmd/Ctrl/Shift-click to add or remove. */
  const asmSel = new Set();
  let selGuard = false;
  function selUnion() {
    if (!asmSel.size) return null;
    const u = new Set();
    asmSel.forEach((id) => (V().chainOf(id) || []).forEach((x) => u.add(x)));
    return u;
  }
  function restartAsm() { asm.t = 0; asm.playing = !reduce; if (reduce) asm.t = 1; asm.last = performance.now(); dirty = true; mark(); if (alt.api) alt.api.renderDock(); }
  function selName(id) {
    const g = alt.api && alt.api.graph();
    if (!g) return id;
    const n = g.nodes.get(id);
    if (n) return n.kind === 'block' ? n.meta.name : n.kind === 'ds' ? n.name : n.label || n.name || n.kind;
    const el = g.elements.find((e) => e.id === id);
    return el ? (el.raw || el.text) : id;
  }

  /* ---------- public ---------- */
  alt.init = function (api, mode) {
    alt.api = api;
    alt.mode = MODES.some((m) => m[0] === mode) ? mode : 'off';
    const stage = $('#stage');
    root = document.createElement('div');
    root.className = 'alt-view';
    root.innerHTML = '<canvas class="alt-canvas"></canvas><div class="alt-nodes"></div><div class="alt-cap" aria-live="polite"></div>';
    stage.insertBefore(root, $('#trace2d'));
    canvas = $('.alt-canvas', root); ctx = canvas.getContext('2d'); nodesHost = $('.alt-nodes', root);
    V().on('mode', () => sync());
    V().on('graph', (g) => {
      [...asmSel].forEach((id) => { if (!g.nodes.has(id) && !g.elements.some((e) => e.id === id)) asmSel.delete(id); });
      if (on) { buildModel(); buildPills(); paintCache = null; dirty = true; }
    });
    V().on('hover', () => mark());
    V().on('select', (id) => {
      if (on && curMode === 'assembly' && id == null && !selGuard && asmSel.size) { asmSel.clear(); restartAsm(); return; }
      mark();
    });
    stage.addEventListener('pointerup', (e) => {
      if (!on || curMode !== 'assembly' || e.button !== 0) return;
      const t = e.target.closest && e.target.closest('[data-id]');
      if (!t || !(t.classList.contains('alt-hit') || t.classList.contains('hs'))) return;
      const id = t.dataset.id, multi = e.metaKey || e.ctrlKey || e.shiftKey;
      if (multi) { if (asmSel.has(id)) asmSel.delete(id); else asmSel.add(id); }
      else if (asmSel.size === 1 && asmSel.has(id)) asmSel.clear();
      else { asmSel.clear(); asmSel.add(id); }
      const focus = asmSel.has(id) ? id : asmSel.size ? [...asmSel].pop() : null;
      selGuard = true;
      // the stage toggles its own selection on this same click; settle it afterwards so Inspect shows the item
      setTimeout(() => { V().select(focus); selGuard = false; restartAsm(); }, 0);
    }, true);
    V().on('layers', () => { if (on) { buildModel(); buildPills(); paintCache = null; dirty = true; } });
    new ResizeObserver(() => { if (on) { size(); place(); paintCache = null; dirty = true; } }).observe(stage);
    $('#dockBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-alt-dock], [data-asm], [data-asm-rm]');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.altDock) { S.play ? S.play.setAlt(b.dataset.altDock) : alt.set(b.dataset.altDock); return; }
      if (b.dataset.asm === 'play') { if (asm.t >= 1) asm.t = 0; asm.playing = !asm.playing; asm.last = performance.now(); api.renderDock(); }
      if (b.dataset.asm === 'replay') { asm.t = 0; asm.playing = true; asm.last = performance.now(); api.renderDock(); }
      if (b.dataset.asm === 'clear') { asmSel.clear(); selGuard = true; V().select(null); selGuard = false; restartAsm(); }
      if (b.dataset.asmRm) { asmSel.delete(b.dataset.asmRm); if (V().selectedId === b.dataset.asmRm) { selGuard = true; V().select(asmSel.size ? [...asmSel].pop() : null); selGuard = false; } restartAsm(); }
    });
    $('#dockBody').addEventListener('input', (e) => {
      if (e.target.id !== 'asmScrub') return;
      asm.t = e.target.value / 1000; asm.playing = false; dirty = true;
      const pb = $('[data-asm="play"]'); if (pb) pb.textContent = 'Play';
    });
    sync();
  };
  alt.menuHtml = function (cur) {
    return '<div class="studio-seg"><span class="lab"><b>Reimagined view</b> · replaces the stacked 3D layers while it is on</span>' +
      MODES.map(([k, n]) => '<button type="button" class="chipbtn" data-alt="' + k + '" aria-pressed="' + (k === (cur || 'off')) + '" title="' + esc(MODES.find((m) => m[0] === k)[2]) + '">' + (k === 'off' ? 'Stacked (default)' : n) + '</button>').join('') + '</div>';
  };
  alt.set = function (mode) { alt.mode = mode || 'off'; sync(); if (alt.api) alt.api.renderDock(); };
  alt.active = () => alt.mode !== 'off' && !alt.suspended && V().mode === 'layers';
  alt.title = () => (MODES.find((m) => m[0] === alt.mode) || MODES[0])[1];
  alt.suspend = function (b) { alt.suspended = !!b; sync(); };
  alt.dockHtml = function () {
    let h = '<div class="ctl-group"><span class="ctl-label">View</span><div class="ctl-row">' + MODES.map(([k, n]) => '<button type="button" class="chipbtn" data-alt-dock="' + k + '" aria-pressed="' + (k === alt.mode) + '">' + n + '</button>').join('') + '</div></div>';
    h += '<p class="muted small" style="margin:0">' + esc(MODES.find((m) => m[0] === alt.mode)[2]) + ' Hover or click a block or number to follow it.</p>';
    if (alt.mode === 'assembly') h += '<div class="ctl-group"><span class="ctl-label">Assembling</span>' + (asmSel.size
      ? '<div class="ctl-row sel-chips">' + [...asmSel].map((id) => '<span class="sel-chip">' + esc(selName(id)) + '<button type="button" data-asm-rm="' + esc(id) + '" aria-label="Remove ' + esc(selName(id)) + '">×</button></span>').join('') + '<button type="button" class="chipbtn" data-asm="clear">Clear</button></div>'
      : '<p class="muted small" style="margin:0">The whole frame. Click a block or number to assemble just its lineage; ⌘/Ctrl- or Shift-click to add more.</p>') + '</div>';
    if (alt.mode === 'assembly') h += '<div class="ctl-group"><span class="ctl-label">Timelapse</span><div class="ctl-row asm-row"><button type="button" class="chipbtn" data-asm="play">' + (asm.playing && asm.t < 1 ? 'Pause' : 'Play') + '</button><button type="button" class="chipbtn" data-asm="replay">Replay</button><input type="range" id="asmScrub" min="0" max="1000" value="' + Math.round(asm.t * 1000) + '" aria-label="Timelapse position"></div></div>';
    return h;
  };

  /* ---------- enter / leave ---------- */
  function sync() {
    const want = alt.active();
    if (want && (!on || curMode !== alt.mode)) enter();
    else if (!want && on) leave();
  }
  function enter() {
    const stage = $('#stage');
    if (on) stage.classList.remove('alt-' + curMode);
    on = true; curMode = alt.mode;
    stage.classList.add('is-alt', 'alt-' + curMode);
    V().lockCamera = true;
    size();
    buildModel();
    V().altRect = frameRectFor(curMode);
    V().refit(true);
    buildPills();
    t0 = performance.now();
    asm = { t: 0, playing: !reduce, last: t0, dur: 9000 };
    if (reduce) asm.t = 1;
    paintCache = null; dirty = true;
    if (V().tickers.indexOf(tick) < 0) V().tickers.push(tick);
  }
  function leave() {
    const stage = $('#stage');
    on = false;
    stage.classList.remove('is-alt', 'alt-' + curMode);
    curMode = 'off';
    const v = V();
    v.altRect = null; v.lockCamera = false;
    const i = v.tickers.indexOf(tick); if (i >= 0) v.tickers.splice(i, 1);
    nodesHost.innerHTML = ''; pills.clear();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    $('.alt-cap', root).textContent = '';
    if (v.mode === 'layers') v.refit(true);
  }
  function size() {
    const r = $('#stage').getBoundingClientRect();
    stageW = r.width; stageH = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(stageW * dpr)); canvas.height = Math.max(1, Math.round(stageH * dpr));
    canvas.style.width = stageW + 'px'; canvas.style.height = stageH + 'px';
  }

  /* ---------- model: blocks, logic and the numbers they become ---------- */
  function buildModel() {
    const g = alt.api.graph();
    if (!g) { model = null; return; }
    const v = V();
    const els = g.elements.filter((e) => e.cls !== 'zero' && e.cls !== 'axis' && (e.cls !== 'label' || v.opts.labels));
    const blockLayer = (n) => n.kind === 'block' && (n.layer === 'blocks' || (n.layer === 'upstream' && v.opts.upstream));
    const blocks = [...g.nodes.values()].filter(blockLayer);
    const logic = [...g.nodes.values()].filter((n) => n.layer === 'logic' && ['ds', 'computed', 'constant', 'filter'].includes(n.kind));
    const parents = (id) => g.edges.filter((e) => e.to === id).map((e) => e.from);
    const items = els.map((el) => {
      const lg = el.nodeId && g.nodes.has(el.nodeId) ? el.nodeId : parents(el.id).find((p) => g.nodes.has(p) && g.nodes.get(p).layer === 'logic') || null;
      let src = (el.blockIds || []).filter((b) => g.nodes.has(b) && blockLayer(g.nodes.get(b)));
      if (!src.length && lg) src = parents(lg).filter((p) => g.nodes.has(p) && blockLayer(g.nodes.get(p)) && el.chain && el.chain.has(p));
      return { el, id: el.id, cls: el.cls, logic: lg, blocks: src.slice(0, 3) };
    });
    // blocks feed numbers; upstream blocks feed blocks
    const ups = [];
    if (v.opts.upstream) g.edges.forEach((e) => { if (e.type === 'upstream' && g.nodes.has(e.from) && g.nodes.has(e.to) && blockLayer(g.nodes.get(e.from)) && blockLayer(g.nodes.get(e.to))) ups.push(e); });
    model = { g, items, blocks, logic, ups };
  }
  function groupOf(n) { return n.kind === 'block' ? n.group : n.kind; }
  function colorOf(n) {
    const cs = V().colors;
    if (!n) return cs.metric;
    if (n.kind === 'block') return cs[n.group] || cs.metric;
    if (n.kind === 'constant') return cs.const;
    return cs.logic;
  }
  function clsColor(cls) { const cs = V().colors; return { direct: cs.metric, label: cs.list, computed: cs.logic, constant: cs.const, untraced: cs.untraced }[cls] || cs.metric; }

  function buildPills() {
    nodesHost.innerHTML = ''; pills.clear();
    if (!model) return;
    const ICONS = S.ICONS || {};
    const mk = (n, role) => {
      const d = document.createElement('div');
      const grp = groupOf(n);
      d.className = 'alt-pill alt-hit r-' + role + ' g-' + grp;
      d.dataset.id = n.id;
      d.style.setProperty('--k', colorOf(n));
      if (curMode === 'paint') d.style.setProperty('--paint', n.kind === 'block' ? PIGMENT[n.group] || PIGMENT.metric : n.kind === 'constant' ? PIGMENT.constant : PIGMENT.computed);
      const name = n.kind === 'block' ? n.meta.name : n.kind === 'ds' ? n.name : n.kind === 'constant' ? n.name : n.kind === 'filter' ? 'Selector' : (n.label || n.kind);
      d.innerHTML = '<span class="ap-ico">' + (n.kind === 'block' ? ICONS[n.group] || ICONS.metric : ICONS[n.kind] || '') + '</span><span class="ap-name">' + esc(name) + '</span>';
      d.title = n.kind === 'block' ? n.meta.name + (n.meta.formula ? ' = ' + n.meta.formula : '') : name;
      nodesHost.appendChild(d);
      pills.set(n.id, { n, d, role, x: 0, y: 0, w: 0, h: 0 });
    };
    model.blocks.forEach((n) => mk(n, 'block'));
    const usedLogic = new Set(model.items.map((it) => it.logic).filter(Boolean));
    model.logic.filter((n) => usedLogic.has(n.id)).forEach((n) => mk(n, 'logic'));
    pills.forEach((p) => { p.w = p.d.offsetWidth; p.h = p.d.offsetHeight; });
    place();
    mark();
  }

  /* ---------- layout ---------- */
  function dockBottom() {
    const d = $('#dock'), sr = $('#stage').getBoundingClientRect();
    if (!d || d.offsetParent === null) return 56;
    const r = d.getBoundingClientRect();
    return r.bottom - sr.top + 14;
  }
  function frameRectFor(mode) {
    const W = stageW, H = stageH, top = 52;
    if (mode === 'assembly') {
      const x0 = Math.max(400, W * 0.34), avail = W - x0 - 20, fh = Math.min(H - top - 40, avail / 1.6), fw = fh * 1.6;
      return { x: x0 + (avail - fw) / 2, y: top + (H - top - 40 - fh) / 2, w: fw, h: fh };
    }
    const x0 = W > 900 ? 300 : 16, avail = W - x0 - 20;
    const fh = Math.min((H - top) * (mode === 'paint' ? 0.5 : 0.46), avail / 1.6), fw = fh * 1.6;
    return { x: x0 + (avail - fw) / 2, y: top, w: fw, h: fh };
  }
  function elRect(el) {
    const v = V();
    const a = v.projectPlanePoint(el.rect.x, el.rect.y), b = v.projectPlanePoint(el.rect.x + el.rect.w, el.rect.y + el.rect.h);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
  function frameScreen() { const v = V(); const a = v.projectPlanePoint(0, 0), b = v.projectPlanePoint(v.W, v.H); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; }
  function spreadX(list, lo, hi, gap) {
    list.sort((a, b) => a.tx - b.tx);
    list.forEach((p) => { p.x = Math.max(lo, Math.min(hi - p.w, p.tx - p.w / 2)); });
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (b.x < a.x + a.w + gap) b.x = a.x + a.w + gap; }
      const over = list.length ? list[list.length - 1].x + list[list.length - 1].w - hi : 0;
      if (over > 0) list.forEach((p) => { p.x -= over; });
      for (let i = list.length - 2; i >= 0; i--) { const a = list[i], b = list[i + 1]; if (a.x + a.w + gap > b.x) a.x = b.x - a.w - gap; }
      if (list.length && list[0].x < lo) { const d = lo - list[0].x; list.forEach((p) => { p.x += d; }); }
    }
  }
  function meanX(id) {
    const xs = model.items.filter((it) => it.logic === id || it.blocks.includes(id)).map((it) => elRect(it.el).cx);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : stageW / 2;
  }
  function place() {
    if (!model) return;
    const fr = frameScreen(), W = stageW, H = stageH;
    const blocks = [...pills.values()].filter((p) => p.role === 'block');
    const logic = [...pills.values()].filter((p) => p.role === 'logic');
    if (curMode === 'loom') {
      const twoRows = logic.reduce((s2, p) => s2 + p.w + 8, 0) > W - 40;
      const reedY = fr.y + fr.h + (twoRows ? 44 : 30);
      model.reedY = reedY;
      logic.forEach((p) => { p.tx = meanX(p.n.id); });
      if (twoRows) {
        logic.sort((a, b) => a.tx - b.tx);
        const A = logic.filter((p, i) => i % 2 === 0), B = logic.filter((p, i) => i % 2 === 1);
        spreadX(A, 20, W - 20, 8); spreadX(B, 20, W - 20, 8);
        A.forEach((p) => { p.y = reedY - 16 - p.h / 2; }); B.forEach((p) => { p.y = reedY + 16 - p.h / 2; });
      } else { spreadX(logic, 20, W - 20, 8); logic.forEach((p) => { p.y = reedY - p.h / 2; }); }
      const top = reedY + (twoRows ? 50 : 40), bottom = H - 22;
      blocks.forEach((p) => { p.tx = meanX(p.n.id); });
      blocks.sort((a, b) => (a.n.layer === 'upstream') - (b.n.layer === 'upstream') || (a.n.group === 'list') - (b.n.group === 'list') || a.tx - b.tx);
      const n = Math.max(1, blocks.length), step = Math.min(34, (bottom - top) / Math.max(1, n - 1));
      blocks.forEach((p, i) => { p.row = top + i * step; p.x = 14; p.y = p.row - p.h / 2; });
    } else if (curMode === 'assembly') {
      const topY = Math.max(dockBottom(), 60), bottomY = H - 24;
      const colX = 16, colW = Math.max(150, Math.min(200, fr.x * 0.42));
      const n = blocks.length, step = Math.min(40, (bottomY - topY) / Math.max(1, n));
      blocks.sort((a, b) => (a.n.group === 'list') - (b.n.group === 'list') || meanY(a.n.id) - meanY(b.n.id));
      blocks.forEach((p, i) => { p.x = colX; p.y = topY + i * step; });
      const lx = colX + colW + Math.max(24, (fr.x - colX - colW - 160) / 2);
      logic.forEach((p) => { p.ty = meanY(p.n.id); });
      logic.sort((a, b) => a.ty - b.ty);
      let y = Math.max(topY, 60);
      logic.forEach((p) => { p.y = Math.max(y, p.ty - p.h / 2); y = p.y + p.h + 10; p.x = lx; });
      const over = y - bottomY; if (over > 0) logic.forEach((p) => { p.y -= over; });
    } else if (curMode === 'paint') {
      const tubeY = H - 30;
      const wellY = fr.y + fr.h + (H - 110 - (fr.y + fr.h)) * 0.5;
      logic.forEach((p) => { p.tx = meanX(p.n.id); p.y = wellY + 22; });
      spreadX(logic, 16, W - 16, 26);
      logic.forEach((p) => { p.well = { x: p.x + p.w / 2, y: wellY }; });
      // each tube sits under the wells it pours into, so the paint rises rather than sprawls
      blocks.forEach((p) => {
        const ws = model.items.filter((it) => it.blocks.includes(p.n.id)).map((it) => { const lp = it.logic && pills.get(it.logic); return lp && lp.well ? lp.well.x : elRect(it.el).cx; });
        p.tx = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : W / 2;
      });
      const rowA = blocks.filter((p, i) => i % 2 === 0), rowB = blocks.filter((p, i) => i % 2 === 1);
      const dense = blocks.reduce((s, p) => s + p.w + 10, 0) > W - 40;
      if (dense) {
        spreadX(rowA, 16, W - 16, 10); spreadX(rowB, 16, W - 16, 10);
        rowA.forEach((p) => { p.y = tubeY - p.h / 2; }); rowB.forEach((p) => { p.y = tubeY - p.h / 2 - 38; });
      } else { spreadX(blocks, 16, W - 16, 12); blocks.forEach((p) => { p.y = tubeY - p.h / 2; }); }
    }
    pills.forEach((p) => { p.d.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)'; });
  }
  function meanY(id) {
    const ys = model.items.filter((it) => it.logic === id || it.blocks.includes(id)).map((it) => elRect(it.el).cy);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : stageH / 2;
  }

  /* ---------- selection ---------- */
  function mark() {
    if (!on) return;
    const chain = (curMode === 'assembly' && selUnion()) || V().activeChain();
    pills.forEach((p, id) => { p.d.classList.toggle('is-on', !!chain && chain.has(id)); p.d.classList.toggle('is-dim', !!chain && !chain.has(id)); p.d.classList.toggle('is-selected', id === V().selectedId); });
    dirty = true; paintKey = '';
  }
  const inChain = (chain, it) => !chain || chain.has(it.id);

  /* ---------- drawing helpers ---------- */
  function rgba(c, a) {
    c = String(c || '#888').trim();
    let r = 136, g = 136, b = 136;
    if (c[0] === '#') { const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
    else { const m = c.match(/(\d+)[ ,]+(\d+)[ ,]+(\d+)/); if (m) { r = +m[1]; g = +m[2]; b = +m[3]; } }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  }
  function mix(c1, c2, k) {
    const p = (c) => { c = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); };
    const a = p(c1), b = p(c2);
    return '#' + a.map((x, i) => Math.round(x + (b[i] - x) * k).toString(16).padStart(2, '0')).join('');
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function bez(a, b, c, d, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, m = 1 - t;
      out.push({ x: m * m * m * a.x + 3 * m * m * t * b.x + 3 * m * t * t * c.x + t * t * t * d.x, y: m * m * m * a.y + 3 * m * m * t * b.y + 3 * m * t * t * c.y + t * t * t * d.y });
    }
    return out;
  }

  /* ---------- frame loop ---------- */
  function tick(now) {
    if (!on || !model) return;
    const v = V();
    const tweening = v.isTweening();
    if (tweening) place();
    if (curMode === 'assembly' && asm.playing) {
      asm.t = Math.min(1, asm.t + (now - asm.last) / asm.dur);
      if (asm.t >= 1) { asm.playing = false; alt.api.renderDock(); }
      const sc = document.getElementById('asmScrub'); if (sc) sc.value = Math.round(asm.t * 1000);
    }
    asm.last = now;
    const intro = Math.min(1, (now - t0) / 1800);
    const animating = tweening || intro < 1 || (curMode === 'assembly' && asm.playing) || curMode === 'loom' || (curMode === 'paint' && (now - t0) < 7000);
    if (!animating && !dirty) return;
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, stageW, stageH);
    if (curMode === 'loom') drawLoom(now, ease(intro));
    else if (curMode === 'assembly') drawAssembly(now);
    else if (curMode === 'paint') drawPaint(now);
  }

  /* ---------- Loom ---------- */
  function drawLoom(now, intro) {
    const fr = frameScreen(), chain = V().activeChain(), dark = V().dark;
    const rows = [...pills.values()].filter((p) => p.role === 'block');
    const rowOf = new Map(rows.map((p) => [p.n.id, p]));
    const reed = [...pills.values()].filter((p) => p.role === 'logic');
    const reedY = model.reedY || fr.y + fr.h + 30;
    const x0 = 206, x1 = stageW - 16;
    const warps = model.items.map((it, i) => {
      const r = elRect(it.el);
      const srcRows = it.blocks.map((b) => rowOf.get(b)).filter(Boolean);
      const lowest = srcRows.length ? Math.max(...srcRows.map((p) => p.row)) : reedY;
      return { it, i, x: r.cx, r, srcRows, lowest, on: inChain(chain, it), col: clsColor(it.cls) };
    });
    const grow = intro;
    // pass 1: warp threads (vertical), from the frame's lower edge down to their deepest source
    warps.forEach((w) => {
      const y0 = fr.y + fr.h + 2, y1 = y0 + (w.lowest - y0) * grow;
      const a = w.on ? (chain ? 0.95 : 0.6) : 0.1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(w.col, a * 0.35); ctx.lineWidth = w.it.cls === 'label' ? 2.4 : 3.6;
      ctx.beginPath(); ctx.moveTo(w.x, y0); ctx.lineTo(w.x, y1); ctx.stroke();
      ctx.strokeStyle = rgba(w.col, a); ctx.lineWidth = w.it.cls === 'label' ? 1 : 1.6;
      ctx.beginPath(); ctx.moveTo(w.x, y0); ctx.lineTo(w.x, y1); ctx.stroke();
    });
    // pass 2: weft threads (horizontal block rows), twisted like yarn, shuttled in from the left
    rows.forEach((p, k) => {
      const lit = !chain || chain.has(p.n.id);
      const xe = x0 + (x1 - x0) * clamp01(intro * 1.25 - k * 0.02);
      const c = colorOf(p.n);
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(dark ? '#000000' : '#FBF8F3', lit ? 0.5 : 0.2); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x0, p.row); ctx.lineTo(xe, p.row); ctx.stroke();
      ctx.strokeStyle = rgba(c, lit ? 0.9 : 0.22); ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(x0, p.row); ctx.lineTo(xe, p.row); ctx.stroke();
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -((now / 90 + k * 3) % 8) * (lit && chain ? 1 : 0);
      ctx.strokeStyle = rgba('#ffffff', lit ? 0.38 : 0.1); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0, p.row - 0.6); ctx.lineTo(xe, p.row - 0.6); ctx.stroke();
      ctx.setLineDash([]);
      // the row's lead thread from its pill
      ctx.strokeStyle = rgba(c, lit ? 0.6 : 0.15); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x + p.w + 4, p.row); ctx.lineTo(x0, p.row); ctx.stroke();
    });
    // pass 3: where a warp passes over a weft, and the knots where a number is tied to its block
    warps.forEach((w) => {
      const a = w.on ? (chain ? 0.95 : 0.65) : 0.1;
      rows.forEach((p, k) => {
        if (p.row > w.lowest + 0.5 || p.row > fr.y + fr.h + (w.lowest - fr.y - fr.h) * grow) return;
        const isSrc = w.srcRows.includes(p);
        if (isSrc) {
          const c = colorOf(p.n);
          ctx.fillStyle = rgba(c, w.on ? 0.3 : 0.08);
          ctx.beginPath(); ctx.arc(w.x, p.row, 6.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(c, w.on ? 1 : 0.25);
          ctx.beginPath(); ctx.arc(w.x, p.row, 3.4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba('#ffffff', w.on ? 0.8 : 0.2);
          ctx.beginPath(); ctx.arc(w.x - 1, p.row - 1.1, 1.1, 0, Math.PI * 2); ctx.fill();
        } else if ((k + w.i) % 2 === 0) {
          ctx.strokeStyle = rgba(w.col, a); ctx.lineWidth = w.it.cls === 'label' ? 1 : 1.6;
          ctx.beginPath(); ctx.moveTo(w.x, p.row - 4.5); ctx.lineTo(w.x, p.row + 4.5); ctx.stroke();
        }
      });
      // heddle eyelet on the reed, tied to its logic pill
      const lp = w.it.logic && pills.get(w.it.logic);
      if (lp && grow > 0.2) {
        const c = colorOf(lp.n);
        ctx.strokeStyle = rgba(c, w.on ? 0.9 : 0.15); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(w.x, reedY, 3.2, 0, Math.PI * 2); ctx.stroke();
        if (w.on && chain) {
          ctx.strokeStyle = rgba(c, 0.55); ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(w.x, reedY); ctx.lineTo(lp.x + lp.w / 2, lp.y + lp.h / 2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // where the warp meets the page: a tie, and when focused, the path up to the number
      ctx.fillStyle = rgba(w.col, w.on ? 0.9 : 0.15);
      ctx.fillRect(w.x - 3, fr.y + fr.h - 1, 6, 3);
      if (chain && w.on) {
        ctx.strokeStyle = rgba(w.col, 0.75); ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(w.x, fr.y + fr.h); ctx.lineTo(w.x, w.r.y + w.r.h + 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = rgba(w.col, 0.95); ctx.lineWidth = 1.6;
        roundRect(w.r.x - 3, w.r.y - 2, w.r.w + 6, w.r.h + 4, 4); ctx.stroke();
        // a bead of light running up the thread
        const t = ((now / 1600) + w.i * 0.13) % 1, yy = w.lowest + (fr.y + fr.h - w.lowest) * t;
        ctx.fillStyle = rgba(w.col, 0.9); ctx.beginPath(); ctx.arc(w.x, yy, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    });
    caption(intro < 1 ? 'Weaving the frame…' : chain ? '' : 'Blocks are threads; numbers are woven from them.');
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function caption(t) { const c = $('.alt-cap', root); if (c.textContent !== t) c.textContent = t; }

  /* ---------- Assembly ---------- */
  function drawAssembly(now) {
    const fr = frameScreen(), sel = selUnion(), hov = V().activeChain();
    const chain = sel ? (hov && V().hoverId && !asmSel.has(V().hoverId) ? hov : sel) : hov;
    const items = model.items.filter((it) => !sel || sel.has(it.id)).sort((a, b) => (a.cls === 'label') - (b.cls === 'label') || a.el.rect.y - b.el.rect.y || a.el.rect.x - b.el.rect.x);
    const n = items.length || 1, t = asm.t;
    const sched = (i) => 0.1 + 0.72 * (i / n);
    const DUR = 0.14;
    // the veil: the frame is hidden until its pieces arrive
    // with a selection, everything else on the page stays behind the veil
    const veilA = t >= 0.9 ? 1 - (sel ? 0.45 : 1) * clamp01((t - 0.9) / 0.1) : 1;
    if (veilA > 0.01) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--stage-2').trim() || '#141413';
      ctx.save();
      ctx.fillStyle = rgba(bg, 0.94 * veilA);
      ctx.fillRect(fr.x - 1, fr.y - 1, fr.w + 2, fr.h + 2);
      ctx.globalCompositeOperation = 'destination-out';
      items.forEach((it, i) => {
        const land = sched(i) + DUR;
        if (t < land) return;
        const r = elRect(it.el), k = clamp01((t - land) / 0.08);
        const pad = 4 + 10 * k;
        ctx.fillStyle = 'rgba(0,0,0,' + (0.9 * k + 0.1).toFixed(3) + ')';
        roundRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 6); ctx.fill();
      });
      ctx.restore();
      // blueprint grid + outline while it assembles
      ctx.strokeStyle = rgba(V().colors.accent, 0.35 * veilA); ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.strokeRect(fr.x + 0.5, fr.y + 0.5, fr.w - 1, fr.h - 1); ctx.setLineDash([]);
    }
    // guides from sources to the frame when something is focused or once assembled
    items.forEach((it, i) => {
      const r = elRect(it.el), lp = it.logic && pills.get(it.logic);
      const bp = it.blocks.map((b) => pills.get(b)).filter(Boolean);
      const start = sched(i), k = clamp01((t - start) / DUR);
      const focus = chain ? chain.has(it.id) : false;
      const showGuide = focus || (t >= 1 && !chain);
      const col = clsColor(it.cls);
      const route = (src) => {
        const a = { x: src.x + src.w, y: src.y + src.h / 2 };
        const m = lp ? { x: lp.x, y: lp.y + lp.h / 2 } : null;
        const end = { x: r.x - 2, y: r.cy };
        const seg1 = m ? bez(a, { x: a.x + 60, y: a.y }, { x: m.x - 60, y: m.y }, m, 16) : [];
        const m2 = m ? { x: lp.x + lp.w, y: m.y } : a;
        const seg2 = bez(m2, { x: m2.x + 80, y: m2.y }, { x: end.x - 80, y: end.y }, end, 22);
        return seg1.concat(seg2);
      };
      const sources = bp.length ? bp : lp ? [lp] : [];
      sources.forEach((src, si) => {
        const pts = route(src);
        if (showGuide) {
          ctx.strokeStyle = rgba(col, focus ? 0.85 : 0.13); ctx.lineWidth = focus ? 1.8 : 1;
          ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        }
        if (k > 0 && k < 1) {
          const e = ease(k), idx = Math.min(pts.length - 1, Math.floor(e * (pts.length - 1)));
          const tail = Math.max(0, idx - 8);
          ctx.strokeStyle = rgba(col, 0.5); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          ctx.beginPath(); for (let j = tail; j <= idx; j++) { const p = pts[j]; if (j === tail) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } ctx.stroke();
          if (si === 0) token(pts[idx], it.el.text, col, 0.7 + 0.3 * e);
          else { ctx.fillStyle = rgba(col, 0.9); ctx.beginPath(); ctx.arc(pts[idx].x, pts[idx].y, 3, 0, Math.PI * 2); ctx.fill(); }
        }
      });
      if (k >= 1 && t - (start + DUR) < 0.06) {
        const g = 1 - (t - start - DUR) / 0.06;
        ctx.strokeStyle = rgba(col, 0.8 * g); ctx.lineWidth = 2;
        roundRect(r.x - 4 - 8 * (1 - g), r.y - 3 - 8 * (1 - g), r.w + 8 + 16 * (1 - g), r.h + 6 + 16 * (1 - g), 6); ctx.stroke();
      }
      if (focus && t >= start + DUR) { ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 1.8; roundRect(r.x - 3, r.y - 2, r.w + 6, r.h + 4, 4); ctx.stroke(); }
    });
    // pills light up while they are sending
    pills.forEach((p, id) => {
      const live = items.some((it, i) => (it.logic === id || it.blocks.includes(id)) && t >= sched(i) && t <= sched(i) + DUR);
      p.d.classList.toggle('is-sending', live);
    });
    caption(t < 0.1 ? 'The blocks hold the data.' : t < 0.45 ? 'Values leave their blocks…' : t < 0.82 ? '…pass through the frame logic and land on the page.' : t < 1 ? 'The frame takes shape.' : chain ? '' : 'Assembled. Replay, scrub the timelapse, or hover anything to see where it came from.');
  }
  function token(p, text, col, s) {
    const tx = String(text).slice(0, 14);
    ctx.save();
    ctx.font = '500 ' + Math.round(11 * s + 1) + 'px "JetBrains Mono", ui-monospace, monospace';
    const w = ctx.measureText(tx).width + 12, h = 18 * s;
    ctx.shadowColor = rgba(col, 0.6); ctx.shadowBlur = 12;
    ctx.fillStyle = rgba(V().dark ? '#1f1e1d' : '#FBF8F3', 0.95);
    roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = V().dark ? '#faf9f5' : '#1F1E1D'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tx, p.x, p.y + 0.5);
    ctx.restore();
  }

  /* ---------- Paint ---------- */
  function pigmentOf(n) { return !n ? PIGMENT.metric : n.kind === 'block' ? PIGMENT[n.group] || PIGMENT.metric : n.kind === 'constant' ? PIGMENT.constant : PIGMENT.computed; }
  function drawPaint(now) {
    const el = now - t0, chain = V().activeChain();
    const pour = reduce ? 1 : clamp01(el / 2600), swirl = reduce ? 1 : clamp01((el - 1400) / 1800), settle = reduce ? 1 : clamp01((el - 2600) / 2400), dry = reduce ? 1 : clamp01((el - 4200) / 2800);
    const key = [stageW, stageH, chain ? [...chain].join(',') : '', V().dark].join('|');
    if (pour >= 1 && settle >= 1 && dry >= 1 && paintCache && paintKey === key) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(paintCache, 0, 0); return; }
    const fr = frameScreen();
    const wells = new Map();
    pills.forEach((p) => { if (p.role === 'logic' && p.well) wells.set(p.n.id, p); });
    // block -> well ribbons, one per pair, as thick as the values they carry
    const pairs = new Map();
    model.items.forEach((it) => it.blocks.forEach((b) => {
      const target = it.logic && wells.get(it.logic) ? it.logic : '__frame';
      const k = b + '>' + target;
      const pr = pairs.get(k) || { b, target, items: [] };
      pr.items.push(it); pairs.set(k, pr);
    }));
    const lit = (it) => !chain || chain.has(it.id);
    // 1. tubes pour into wells (or straight to the page when no logic sits between)
    pairs.forEach((pr) => {
      const bp = pills.get(pr.b); if (!bp) return;
      const a = { x: bp.x + bp.w / 2, y: bp.y - 2 };
      let pts;
      if (pr.target !== '__frame') {
        const w = wells.get(pr.target).well;
        pts = bez(a, { x: a.x, y: a.y - 70 }, { x: w.x + (a.x < w.x ? -40 : 40), y: w.y + 60 }, { x: w.x + (a.x < w.x ? -8 : 8), y: w.y + 6 }, 30);
      } else {
        const r = elRect(pr.items[0].el);
        pts = bez(a, { x: a.x, y: a.y - 90 }, { x: r.cx, y: fr.y + fr.h + 90 }, { x: r.cx, y: fr.y + fr.h + 2 }, 30);
      }
      const on = pr.items.some(lit);
      ribbon(pts, pigmentOf(bp.n), 10 + Math.min(12, 3 * Math.sqrt(pr.items.length)), pour, on ? 1 : 0.16, 1 - dry * 0.55);
    });
    // 2. wells: the colours swirl together
    wells.forEach((p) => {
      const ins = [...pairs.values()].filter((pr) => pr.target === p.n.id).map((pr) => pigmentOf(pills.get(pr.b) && pills.get(pr.b).n));
      const on = model.items.some((it) => it.logic === p.n.id && lit(it));
      well(p.well, ins.length ? ins : [pigmentOf(p.n)], swirl, now, on ? 1 : 0.2, 1 - dry * 0.5);
    });
    // 3. wells pour up into the page, one ribbon per number, settling where it lands
    model.items.forEach((it) => {
      const r = elRect(it.el), w = it.logic && wells.get(it.logic);
      const src = it.blocks.map((b) => pills.get(b)).filter(Boolean).map((p) => pigmentOf(p.n));
      let col = src[0] || pigmentOf(w && w.n);
      if (src.length > 1) col = mix(src[0], src[1], 0.5);
      if (it.cls === 'computed') col = mix(col, PIGMENT.computed, 0.35);
      if (it.cls === 'constant') col = PIGMENT.constant;
      const on = lit(it);
      const thin = it.cls === 'label' ? 3.4 : 5.5;
      if (w) {
        const a = { x: w.well.x, y: w.well.y - 8 };
        const pts = bez(a, { x: a.x, y: a.y - 50 }, { x: r.cx, y: fr.y + fr.h + 70 }, { x: r.cx, y: fr.y + fr.h + 1 }, 26);
        ribbon(pts, col, thin, settle, on ? 0.95 : 0.12, 1 - dry * 0.6);
      }
      // the dab: paint settles under the number and dries from glossy to matte
      const k = w ? clamp01((settle - 0.75) / 0.25) : clamp01((pour - 0.8) / 0.2);
      if (k > 0) dab(r, col, k, on ? 1 : 0.18, 1 - dry);
      if (chain && on) { ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.6; roundRect(r.x - 4, r.y - 3, r.w + 8, r.h + 6, 5); ctx.stroke(); }
    });
    caption(pour < 1 ? 'Pigment pours from the blocks…' : settle < 1 ? '…mixes in the frame logic…' : dry < 1 ? '…and dries into the numbers.' : chain ? '' : 'Tubes are blocks; wells are frame logic.');
    if (pour >= 1 && settle >= 1 && dry >= 1) {
      if (!paintCache) paintCache = document.createElement('canvas');
      paintCache.width = canvas.width; paintCache.height = canvas.height;
      paintCache.getContext('2d').drawImage(canvas, 0, 0);
      paintKey = key;
    }
  }
  /* a thick impasto ribbon: swelling body, darker edges, bristle striations and a wet highlight */
  function ribbon(pts, color, width, progress, alpha, gloss) {
    if (progress <= 0) return;
    const n = pts.length - 1, last = Math.max(1, Math.floor(n * progress));
    const P = pts.slice(0, last + 1);
    const norms = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { x: -dy / l, y: dx / l };
    });
    const prof = (i) => { const t = i / n; return width * (0.5 + 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), 0.5)) * (1 + 0.08 * Math.sin(t * 19)); };
    const edge = (side) => P.map((p, i) => ({ x: p.x + norms[i].x * prof(i) * 0.5 * side, y: p.y + norms[i].y * prof(i) * 0.5 * side }));
    const L = edge(1), R = edge(-1);
    ctx.save();
    ctx.globalAlpha = alpha;
    // cast shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = mix(color, '#000000', 0.25);
    ctx.beginPath(); L.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    const tip = P[P.length - 1], tn = norms[norms.length - 1], tw = prof(P.length - 1) * 0.5;
    ctx.arc(tip.x, tip.y, tw, Math.atan2(tn.y, tn.x), Math.atan2(tn.y, tn.x) - Math.PI, true);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    // body with a soft light-to-shadow fall-off across the ribbon
    const body = (off, w2, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); P.forEach((p, i) => { const x = p.x + norms[i].x * off * prof(i), y = p.y + norms[i].y * off * prof(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    };
    body(0, width * 0.78, color);
    body(0.14, width * 0.42, mix(color, '#ffffff', 0.18));
    // bristle striations
    [-0.32, -0.12, 0.08, 0.26].forEach((o, k) => { body(o, 0.9, k % 2 ? rgba(mix(color, '#000000', 0.35), 0.35) : rgba(mix(color, '#ffffff', 0.4), 0.28)); });
    // wet specular highlight, fading as it dries
    if (gloss > 0.02) { body(0.22, Math.max(1, width * 0.13), rgba('#ffffff', 0.55 * gloss)); body(0.26, Math.max(0.6, width * 0.05), rgba('#ffffff', 0.85 * gloss)); }
    ctx.restore();
  }
  function well(w, colors, k, now, alpha, gloss) {
    if (k <= 0) return;
    const r = 18 * (0.6 + 0.4 * ease(k));
    ctx.save();
    ctx.globalAlpha = alpha;
    // the cup
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = V().dark ? '#2b2a27' : '#f4f1ea';
    ctx.beginPath(); ctx.arc(w.x, w.y, r + 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    const base = colors.length > 1 ? colors.reduce((acc, c) => mix(acc, c, 0.5)) : colors[0];
    const grd = ctx.createRadialGradient(w.x - r * 0.3, w.y - r * 0.35, r * 0.1, w.x, w.y, r);
    grd.addColorStop(0, mix(base, '#ffffff', 0.3)); grd.addColorStop(1, mix(base, '#000000', 0.2));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.fill();
    // swirl: each incoming colour as a spiral arm, slowly turning while wet
    const rot = (reduce ? 0 : now / 2400) * gloss;
    colors.slice(0, 4).forEach((c, i) => {
      ctx.strokeStyle = rgba(c, 0.9); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s <= 30; s++) {
        const t = s / 30, ang = rot + i * (Math.PI * 2 / colors.length) + t * Math.PI * 2.4 * k, rr = r * 0.85 * t;
        const x = w.x + Math.cos(ang) * rr, y = w.y + Math.sin(ang) * rr;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });
    if (gloss > 0.02) { ctx.fillStyle = rgba('#ffffff', 0.55 * gloss); ctx.beginPath(); ctx.ellipse(w.x - r * 0.35, w.y - r * 0.4, r * 0.32, r * 0.16, -0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function dab(r, color, k, alpha, gloss) {
    const x0 = r.x - 4, x1 = r.x + (r.w + 8) * ease(k) - 4, y = r.y + r.h + 3.5, th = Math.max(3, Math.min(6, r.h * 0.3));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
    ctx.strokeStyle = color; ctx.lineWidth = th; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 1.6, x1, y - 0.6); ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = rgba(mix(color, '#ffffff', 0.4), 0.5); ctx.lineWidth = th * 0.3;
    ctx.beginPath(); ctx.moveTo(x0 + 2, y - th * 0.18); ctx.lineTo(x1 - 2, y - th * 0.28); ctx.stroke();
    if (gloss > 0.02) { ctx.strokeStyle = rgba('#ffffff', 0.7 * gloss); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 3, y - th * 0.3); ctx.lineTo(x0 + (x1 - x0) * 0.6, y - th * 0.36); ctx.stroke(); }
    ctx.restore();
  }
})();
