/* Framecraft — stage: flat frame, exploded 3D strata, 2D trace, beams and flow. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const W = 1280, H = 800, PERSP = 2600;
  const CAM_DEF = { fu: 0, fv: 0, fz: 0, pp: PERSP };
  const camv = (c, k) => (c[k] == null ? CAM_DEF[k] : c[k]);
  const LAYERS = ['frame', 'logic', 'blocks', 'upstream'];
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICONS = {
    metric: '<svg viewBox="0 0 16 16"><rect x="1" y="1" width="11.5" height="11.5" rx="2.2" fill="#e3c8fb"/><rect x="7" y="7" width="8" height="8" rx="1.8" fill="#8a12e8"/></svg>',
    list: '<svg viewBox="0 0 16 16"><rect x="1" y="1.5" width="6.4" height="5.6" rx="1.6" fill="#1f8bff"/><rect x="8.6" y="1.5" width="6.4" height="5.6" rx="1.6" fill="#1f8bff"/><rect x="1" y="8.3" width="14" height="6.2" rx="1.6" fill="#c3e0ff"/></svg>',
    table: '<svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="14" rx="1.8" fill="#ffc4d8"/><rect x="8" y="1" width="7" height="6" rx="1.8" fill="#ffc4d8"/><rect x="8" y="8" width="7" height="7" rx="1.8" fill="#e5306e"/></svg>',
    prop: '<svg viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="5.6" rx="1.6" fill="#c3e0ff"/><rect x="1" y="8.3" width="14" height="6.2" rx="1.6" fill="#1f8bff"/></svg>',
    var: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 2.5C3 4 3 12 5 13.5M11 2.5c2 1.5 2 9.5 0 11M6.5 6l3 4M9.5 6l-3 4"/></svg>',
    tx: '<svg viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="5.6" rx="1.6" fill="#13b38e"/><rect x="1" y="8.3" width="14" height="6.2" rx="1.6" fill="#bdeedd"/></svg>',
    ds: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="8" cy="3.8" rx="5.2" ry="1.9"/><path d="M2.8 3.8v8.4c0 1 2.3 1.9 5.2 1.9s5.2-.9 5.2-1.9V3.8M2.8 8c0 1 2.3 1.9 5.2 1.9s5.2-.9 5.2-1.9"/></svg>',
    computed: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10.5 2.5c-1.8 0-2.3 1-2.6 2.6L6.6 12c-.3 1.4-.9 1.9-2.1 1.9M5 6.5h5.5"/></svg>',
    constant: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2 14 13H2z"/><path d="M8 6.5v3"/><circle cx="8" cy="11.2" r=".5" fill="currentColor"/></svg>',
    axis: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 2v11h11M3 9.5h2M3 6h2"/></svg>',
    filter: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 3h11L9.2 8.2V13l-2.4-1V8.2z"/></svg>',
    items: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2.5" width="5" height="5" rx="1"/><rect x="9" y="2.5" width="5" height="5" rx="1"/><rect x="2" y="9.5" width="5" height="4" rx="1"/><rect x="9" y="9.5" width="5" height="4" rx="1"/></svg>',
    write: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10.8 2.7 13.3 5.2 6 12.5l-3.2.7.7-3.2z"/></svg>',
  };
  S.ICONS = ICONS;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  S.esc = esc;

  const view = (S.view = {
    mode: 'frame',
    graph: null,
    cam: { ax: 0, az: 0, s: 0.8, px: 0, py: 0 },
    gap: 0,
    vis: { logic: 0, blocks: 0, upstream: 0, panel2d: 0, reveal: 1 },
    opacity: { frame: 0.9, logic: 1, blocks: 1, upstream: 0.9 },
    /* Beams default on but faint and still (no flow), so the frame stays readable; the Blockflow layer starts off. */
    opts: { traces: true, flow: false, beam: 0.3, labels: true, axis: true, upstream: false, blockflow: false, drift: false, inspect: true, details: false, ripple: true },
    hidden: { frame: false, logic: false, blocks: false }, // per-layer show/hide (upstream and Blockflow use opts)
    layerFade: { frame: 1, logic: 1, blocks: 1 },
    ripple: null, // paper-settle wave on the frame sheet as it lifts into 3D
    tickers: [], // per-frame callbacks (Studio journey, alternate views)
    userGap: 190,
    preset: { ax: 58, az: -34 },
    hoverId: null,
    selectedId: null,
    listeners: {},
    positions: new Map(), // id -> {x,y,w,h} plane coords
    tween: null,
    dirty: true,
    rects2d: new Map(),
    rects2dDirty: true,
    colors: {},
  });
  view.on = (ev, fn) => { (view.listeners[ev] = view.listeners[ev] || []).push(fn); };
  const emit = (ev, a, b) => (view.listeners[ev] || []).forEach((fn) => { try { fn(a, b); } catch (err) { console.error(err); } });

  let els = {};
  let ctx = null, dpr = 1;
  const nodeEls = new Map();
  const hsEls = new Map();
  const card2d = new Map();

  view.init = function (e) {
    els = e;
    ctx = els.canvas.getContext('2d');
    els.planes = {};
    LAYERS.forEach((l) => { els.planes[l] = els.scene.querySelector('[data-layer="' + l + '"]'); });
    els.floor = els.scene.querySelector('.plane-floor');
    els.flowPlane = els.scene.querySelector('[data-layer="flow"]');
    els.viewport = els.scene.parentElement;
    els.wave = document.createElement('canvas');
    els.wave.className = 'paper-wave';
    els.wave.width = 64; els.wave.height = 40;
    els.wave.setAttribute('aria-hidden', 'true');
    els.planes.frame.appendChild(els.wave);
    readColors();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => { readColors(); view.dirty = true; });
    new MutationObserver(() => { readColors(); view.dirty = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    new ResizeObserver(() => { sizeCanvas(); if (view.graph && view._built2dUp !== show2dUp()) build2d(); view.refit(false); view.rects2dDirty = true; view.dirty = true; }).observe(els.stage);
    sizeCanvas();
    bindPointer();
    els.trace2d.addEventListener('scroll', () => { view.rects2dDirty = true; view.dirty = true; }, { passive: true });
    requestAnimationFrame(tick);
  };

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    ['metric', 'list', 'prop', 'var', 'tx', 'logic', 'const', 'untraced', 'axis', 'upstream', 'accent'].forEach((k) => {
      view.colors[k] = (cs.getPropertyValue(k === 'accent' ? '--accent' : '--c-' + k) || '#5b8cff').trim();
    });
    view.dark = (cs.getPropertyValue('--is-dark') || '').trim() === '1';
  }
  function sizeCanvas() {
    const r = els.stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    els.canvas.width = Math.max(1, Math.round(r.width * dpr));
    els.canvas.height = Math.max(1, Math.round(r.height * dpr));
    els.canvas.style.width = r.width + 'px';
    els.canvas.style.height = r.height + 'px';
    view.stageW = r.width;
    view.stageH = r.height;
  }

  /* ---------- geometry ---------- */
  function layerShown(l) {
    if (l === 'upstream') return !!(view.opts.upstream && view.graph && view.graph.stats.upstream > 0);
    if (l === 'flow') return !!(view.opts.blockflow && els.flowPlane);
    return !view.hidden[l];
  }
  view.layerShown = layerShown;
  function zOf(layer, gap) {
    const g = gap == null ? view.gap : gap;
    const stack = LAYERS.filter(layerShown);
    if (!stack.length) stack.push('frame');
    const mid = (stack.length - 1) / 2;
    if (layer === 'flow') return (mid - (stack.length - 1) - 2.4) * g; // the Blockflow map sits well below everything else
    let i = stack.indexOf(layer);
    if (i < 0) { // a hidden layer keeps its place in the order, between its shown neighbours
      const all = LAYERS.indexOf(layer);
      i = stack.filter((l) => LAYERS.indexOf(l) < all).length - 0.5;
    }
    return (mid - i) * g;
  }
  function matrixOf(cam) {
    return new DOMMatrix().translate(cam.px, cam.py, 0).rotateAxisAngle(1, 0, 0, cam.ax).rotateAxisAngle(0, 0, 1, cam.az).scale(cam.s, cam.s, cam.s).translate(-camv(cam, 'fu'), -camv(cam, 'fv'), -camv(cam, 'fz'));
  }
  let M = null;
  function project(u, v, z, m) {
    if (!m && !M) { M = matrixOf(view.cam); M.__cam = view.cam; }
    const p = (m || M).transformPoint(new DOMPoint(u - W / 2, v - H / 2, z));
    const pp = camv(m ? (m.__cam || view.cam) : view.cam, 'pp');
    const k = pp / Math.max(60, pp - p.z);
    return { x: view.stageW / 2 + p.x * k, y: view.stageH / 2 + p.y * k, k };
  }
  function bboxFor(cam, gap, layers) {
    const m = matrixOf(cam);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    layers.forEach((l) => {
      const z = zOf(l, gap);
      [[0, 0], [W, 0], [0, H], [W, H]].forEach(([u, v]) => {
        const p = project(u, v, z, m);
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      });
    });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function visibleLayers() {
    const ls = LAYERS.concat(['flow']).filter(layerShown);
    return ls.length ? ls : ['frame'];
  }
  function fitCam(ax, az, gap) {
    const cam = { ax, az, s: 1, px: 0, py: 0 };
    const sw = view.stageW, sh = view.stageH;
    for (let i = 0; i < 3; i++) {
      const b = bboxFor(cam, gap, visibleLayers());
      const f = Math.min((sw * 0.9) / b.w, (sh * 0.84) / b.h);
      cam.s *= f;
      const b2 = bboxFor(cam, gap, visibleLayers());
      cam.px -= (b2.x0 + b2.x1) / 2 - sw / 2;
      cam.py -= (b2.y0 + b2.y1) / 2 - sh / 2 - sh * 0.02;
    }
    return cam;
  }
  function show2dUp() { return !!(view.opts.upstream && view.graph && view.graph.stats.upstream && view.stageW > 1180); }
  function cols2dWidth() { return (show2dUp() ? 190 + 40 : 0) + 236 + 40 + 220 + 28; }
  function targetFor(mode) {
    const sw = view.stageW, sh = view.stageH;
    if (mode === 'layers' && view.altRect) {
      // a reimagined view owns the stage: lay the frame flat inside the rect it asked for
      const r = view.altRect, s = Math.min(r.w / W, r.h / H);
      return { cam: { ax: 0, az: 0, s, px: r.x + r.w / 2 - sw / 2, py: r.y + r.h / 2 - sh / 2 }, gap: 0, vis: { logic: 0, blocks: 0, upstream: 0, panel2d: 0 } };
    }
    if (mode === 'layers') {
      const gap = view.userGap;
      return { cam: fitCam(view.preset.ax, view.preset.az, gap), gap, vis: { logic: 1, blocks: 1, upstream: 1, panel2d: 0 } };
    }
    if (mode === 'trace') {
      const cw = cols2dWidth();
      const rw = Math.max(200, sw - cw - 48);
      const s = Math.min(rw / W, (sh - 40) / H);
      return { cam: { ax: 0, az: 0, s, px: cw + 24 + rw / 2 - sw / 2, py: 0 }, gap: 0, vis: { logic: 0, blocks: 0, upstream: 0, panel2d: 1 } };
    }
    const s = Math.min((sw - 40) / W, (sh - 40) / H, 1.3);
    return { cam: { ax: 0, az: 0, s, px: 0, py: 0 }, gap: 0, vis: { logic: 0, blocks: 0, upstream: 0, panel2d: 0 } };
  }

  /* ---------- tweening ---------- */
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function startTween(to, dur, stagger) {
    const from = { cam: Object.assign({}, view.cam), gap: view.gap, vis: Object.assign({}, view.vis) };
    view.tween = { from, to, t0: performance.now(), dur: reduceMotion ? 1 : dur, stagger: stagger || 0 };
  }
  function stepTween(now) {
    const tw = view.tween;
    if (!tw) return false;
    const raw = Math.min(1, (now - tw.t0) / tw.dur);
    const e = ease(raw);
    const L = (a, b, t) => a + (b - a) * t;
    ['ax', 'az', 's', 'px', 'py', 'fu', 'fv', 'fz', 'pp'].forEach((k) => { view.cam[k] = L(camv(tw.from.cam, k), camv(tw.to.cam, k), e); });
    view.gap = L(tw.from.gap, tw.to.gap, e);
    const st = tw.stagger;
    const lay = (k, i) => {
      const d = st * i;
      const tt = Math.max(0, Math.min(1, (raw - d) / Math.max(0.0001, 1 - d)));
      view.vis[k] = L(tw.from.vis[k], tw.to.vis[k], ease(tt));
    };
    lay('logic', 1); lay('blocks', 2); lay('upstream', 3);
    view.vis.panel2d = L(tw.from.vis.panel2d, tw.to.vis.panel2d, e);
    view.vis.reveal = raw;
    if (raw >= 1) view.tween = null;
    return true;
  }

  view.setMode = function (mode, opts) {
    const prev = view.mode;
    view.mode = mode;
    els.stage.dataset.mode = mode;
    const to = targetFor(mode);
    const dur = (opts && opts.instant) ? 1 : prev === mode ? 500 : mode === 'layers' ? 1700 : 1100;
    startTween(to, dur, mode === 'layers' && prev !== 'layers' ? 0.18 : 0);
    if (mode === 'layers' && prev !== 'layers' && view.opts.ripple && !reduceMotion && !(opts && opts.instant)) view.ripple = { t0: performance.now() + dur * 0.42, dur: 1900 };
    if (mode === 'trace') { view.rects2dDirty = true; }
    view.dirty = true;
    emit('mode', mode, prev);
  };
  view.refit = function (animate) {
    const to = targetFor(view.mode);
    if (animate) startTween(to, 700, 0);
    else if (!view.tween) { view.cam = to.cam; view.gap = to.gap; Object.assign(view.vis, to.vis); }
    else view.tween.to = to;
    view.dirty = true;
  };
  /* Free camera moves for the Studio journey: cam may carry fu/fv/fz (focus point in plane coords) and pp (perspective). */
  view.flyTo = function (cam, dur, vis) {
    const to = { cam: Object.assign({}, view.cam, cam), gap: view.gap, vis: Object.assign({}, view.vis, vis || {}) };
    startTween(to, dur || 1400, 0);
    view.dirty = true;
  };
  /* Zoom toward a stage point (defaults to the centre), clamped so it cannot run away. */
  view.zoomBy = function (f, x, y) {
    if (view.mode !== 'layers') return;
    view.tween = null;
    const s0 = view.cam.s, s1 = Math.max(0.12, Math.min(4.5, s0 * f));
    const k = s1 / s0;
    const cx = (x == null ? view.stageW / 2 : x) - view.stageW / 2, cy = (y == null ? view.stageH / 2 : y) - view.stageH / 2;
    view.cam.px = cx + (view.cam.px - cx) * k;
    view.cam.py = cy + (view.cam.py - cy) * k;
    view.cam.s = s1;
    view.dirty = true;
  };
  view.zOf = (l) => zOf(l);
  view.setLayerShown = function (l, on) {
    if (l === 'upstream') return view.setOpt('upstream', !!on);
    if (l === 'flow') return view.setOpt('blockflow', !!on);
    view.hidden[l] = !on;
    if (view.mode === 'layers') view.refit(true);
    emit('layers');
    view.dirty = true;
  };
  view.setPreset = function (ax, az) { view.preset = { ax, az }; if (view.mode === 'layers') startTween(targetFor('layers'), 900, 0); };
  view.setGap = function (g) { view.userGap = g; if (view.mode === 'layers' && !view.tween) view.gap = g; view.dirty = true; };
  view.setOpacity = function (layer, v) { view.opacity[layer] = v; view.dirty = true; };
  view.setOpt = function (k, v) {
    view.opts[k] = v;
    if (k === 'upstream') { view.refit(true); layoutPlanes(); build2d(); }
    if (k === 'upstream' || k === 'blockflow') emit('layers');
    if (k === 'blockflow') view.refit(true);
    if (k === 'labels' || k === 'axis') { renderHotspots(); build2d(); }
    if (k === 'details') { els.stage.classList.toggle('show-details', !!v); layoutPlanes(); }
    view.rects2dDirty = true;
    view.dirty = true;
  };

  /* ---------- graph -> DOM ---------- */
  const CHEV = '<button type="button" class="nd-exp" aria-label="Show details" title="Details"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 6 4 4 4-4"/></svg></button>';
  /* Pill by default; the .nd-more part is progressive disclosure (expand, select, or "Details" toggle). */
  function cardHtml(n) {
    if (n.kind === 'block') {
      const m = n.meta, g = n.group;
      const sample = n.sample != null ? S.engine.formatPigment(n.sample, m.format) : '';
      const dims = (m.dims || []).map((d) => '<span class="bk-dim">' + esc(d) + '</span>').join('');
      let flag = '', dot = '';
      if (n.layer === 'blocks' && !n.inDataSource) { flag = '<span class="bk-flag is-warn">Bound, unused</span>'; dot = '<i class="bk-dot is-warn" title="Bound, unused"></i>'; }
      else if (n.layer === 'blocks' && !n.visible && g !== 'list') { flag = '<span class="bk-flag">Not on frame</span>'; dot = '<i class="bk-dot" title="Not on frame"></i>'; }
      const formula = m.input ? '<div class="bk-formula is-input">Input metric · no formula</div>' : m.formula ? '<div class="bk-formula">' + esc(m.formula) + '</div>' : m.description ? '<div class="bk-desc">' + esc(m.description) + '</div>' : '';
      return '<div class="nd-head"><span class="bk-ico g-' + g + '">' + (ICONS[g] || ICONS.metric) + '</span><span class="bk-name">' + esc(m.name) + '</span>' + (sample ? '<span class="bk-val">' + esc(sample) + '</span>' : '') + dot + CHEV + '</div>' +
        '<div class="nd-more"><div class="bk-sub">' + esc(m.kind) + (m.folder ? ' · ' + esc(m.folder) : '') + (m.format ? ' · ' + esc(S.engine.describeFormat(m.format)) : '') + '</div>' + formula + (dims || flag ? '<div class="bk-foot">' + dims + flag + '</div>' : '') + '</div>';
    }
    if (n.kind === 'ds') {
      const nm = (b) => { const m = S.engine.blockMeta(view.graph.snap, b); return m ? m.name : b; };
      const vals = n.def ? n.def.values.map((v) => '<span class="ds-chip">' + esc(nm(v.binding)) + (v.aggregator ? '<i>' + esc(v.aggregator) + '</i>' : '') + '</span>').join('') : '<span class="ds-chip">definition not in snapshot</span>';
      const labs = n.def && n.def.labels.length ? n.def.labels.map((l) => esc(nm(l.binding))).join(', ') : 'none';
      const sel = n.def && n.def.selectors && n.def.selectors.length ? n.def.selectors.map((s) => { const f = n.filters.find((x) => x.binding === s.binding); return esc(nm(s.binding)) + ' = ' + esc(f && f.selection.length ? f.selection.join(', ') : 'All'); }).join(' · ') : '';
      const nv = n.def ? n.def.values.length : 0;
      return '<div class="nd-head"><span class="lg-ico">' + ICONS.ds + '</span><span class="lg-name">' + esc(n.name) + '</span><span class="lg-count">' + nv + ' value' + (nv === 1 ? '' : 's') + ' · ' + n.rows + ' row' + (n.rows === 1 ? '' : 's') + '</span>' + (n.missing || !n.exact ? '<i class="bk-dot is-warn"></i>' : '') + CHEV + '</div>' +
        '<div class="nd-more"><div class="lg-kicker">Data source</div><div class="ds-vals">' + vals + '</div><div class="lg-meta">Rows by ' + labs + (sel ? ' · ' + sel : '') + (n.missing ? ' · <b>no data in snapshot</b>' : '') + (!n.exact ? ' · filter not in snapshot' : '') + '</div></div>';
    }
    const lab = {
      computed: ['Computed in frame', n.label, (n.examples || []).slice(0, 3).map((x) => x.text + ' = ' + x.formula).join('\n')],
      constant: ['Hardcoded in code', n.name + ' = ' + n.value, 'Line ' + n.line + ' of the frame code. Not from Pigment.'],
      axis: ['Chart scale', n.count + ' ticks', 'Generated by the frame from the data range.'],
      filter: ['Selector', nameOfKey(n.binding) + ' = ' + (n.selection && n.selection.length ? n.selection.join(', ') : 'All'), 'Filters ' + (n.dsNames || []).join(', ') + ' before aggregation.'],
      items: ['List items', nameOfKey(n.alias), n.count + ' items via subscribeToItems'],
      write: ['Writes to Pigment', n.op + ' → ' + nameOfKey(n.target), 'Line ' + n.line + (n.fired ? ' · fired ' + n.fired + '×' : '')],
    }[n.kind] || [n.kind, '', ''];
    return '<div class="nd-head"><span class="lg-ico">' + (ICONS[n.kind] || '') + '</span><span class="lg-text">' + esc(lab[1]) + '</span>' + CHEV + '</div>' +
      '<div class="nd-more"><div class="lg-kicker">' + esc(lab[0]) + '</div><div class="lg-meta" style="white-space:pre-wrap">' + esc(lab[2]) + '</div></div>';
  }
  function nameOfKey(k) { const m = view.graph && S.engine.blockMeta(view.graph.snap, k); return m ? m.name : k; }
  view.cardHtml = cardHtml;
  function nodeClass(n) {
    if (n.kind === 'block') return 'nd bk g-' + n.group + (n.layer === 'upstream' ? ' is-up' : '') + (n.layer === 'blocks' && !n.visible ? ' is-quiet' : '');
    return 'nd lg k-' + n.kind;
  }

  view.setGraph = function (graph, keepSelection) {
    view.graph = graph;
    if (!keepSelection) { view.selectedId = null; }
    else if (view.selectedId && !graph.nodes.has(view.selectedId) && !graph.elements.some((e) => e.id === view.selectedId)) view.selectedId = null;
    const hasUp = graph.stats.upstream > 0;
    els.planes.upstream.hidden = !hasUp;
    ['logic', 'blocks', 'upstream'].forEach((l) => {
      const host = els.planes[l].querySelector('.nodes');
      host.innerHTML = '';
    });
    nodeEls.clear();
    graph.nodes.forEach((n) => {
      const host = els.planes[n.layer] && els.planes[n.layer].querySelector('.nodes');
      if (!host) return;
      const d = document.createElement('div');
      d.className = nodeClass(n);
      d.dataset.id = n.id;
      d.innerHTML = cardHtml(n, false);
      host.appendChild(d);
      nodeEls.set(n.id, d);
    });
    // plane tags
    const st = graph.stats;
    const tag = (l, t) => { const e = els.planes[l].querySelector('.plane-tag'); if (e) e.innerHTML = t; };
    tag('frame', '<b>01</b> Frame <span>' + st.numbers + ' numbers · ' + (st.counts.label || 0) + ' labels</span>');
    tag('logic', '<b>02</b> Frame logic <span>' + countKinds(graph, 'logic') + '</span>');
    tag('blocks', '<b>03</b> Pigment blocks <span>' + st.blocks + ' bound' + (st.unseenBlocks ? ' · ' + st.unseenBlocks + ' not on frame' : '') + '</span>');
    tag('upstream', '<b>04</b> Upstream lineage <span>' + st.upstream + ' blocks</span>');
    layoutPlanes();
    renderHotspots();
    build2d();
    applySelectionClasses();
    view.dirty = true;
    emit('graph', graph);
  };
  function countKinds(g, layer) {
    const c = {};
    g.nodes.forEach((n) => { if (n.layer === layer) c[n.kind] = (c[n.kind] || 0) + 1; });
    const words = { ds: 'data source', computed: 'computed value', constant: 'constant', axis: 'scale', filter: 'selector', items: 'item list', write: 'write-back' };
    return Object.keys(c).map((k) => c[k] + ' ' + words[k] + (c[k] > 1 ? 's' : '')).join(' · ');
  }

  function elCenter(el) { return { x: el.rect.x + el.rect.w / 2, y: el.rect.y + el.rect.h / 2 }; }
  function visibleElement(el) {
    if (el.cls === 'zero') return false;
    if (el.cls === 'label' && !view.opts.labels) return false;
    if (el.cls === 'axis' && !view.opts.axis) return false;
    return true;
  }
  function relax(items, iters, padX, padY) {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = (a.w + b.w) / 2 + padX - Math.abs(dx), oy = (a.h + b.h) / 2 + padY - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            if (ox / (a.w + b.w) < oy / (a.h + b.h)) { const s = (dx >= 0 ? 1 : -1) * ox / 2; a.x -= s; b.x += s; }
            else { const s = (dy >= 0 ? 1 : -1) * oy / 2; a.y -= s; b.y += s; }
          }
        }
      }
      items.forEach((n) => {
        n.x += (n.tx - n.x) * 0.04;
        n.y += (n.ty - n.y) * 0.04;
        n.x = Math.max(n.w / 2 + 24, Math.min(W - n.w / 2 - 24, n.x));
        n.y = Math.max(n.h / 2 + 44, Math.min(H - n.h / 2 - 20, n.y));
      });
    }
  }
  function layoutPlanes() {
    const g = view.graph;
    if (!g) return;
    view.positions.clear();
    const elsById = new Map(g.elements.map((e) => [e.id, e]));
    const targetsOf = (id) => g.edges.filter((e) => e.from === id).map((e) => e.to);
    const sourcesOf = (id) => g.edges.filter((e) => e.to === id).map((e) => e.from);
    const centroid = (pts, fallback) => {
      if (!pts.length) return fallback;
      return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    };
    const place = (layer, desiredFn) => {
      const items = [];
      g.nodes.forEach((n) => {
        if (n.layer !== layer) return;
        const d = nodeEls.get(n.id);
        const w = d ? d.offsetWidth || 200 : 200, h = d ? d.offsetHeight || 60 : 60;
        const t = desiredFn(n);
        const j = hash(n.id) - 0.5;
        items.push({ id: n.id, w, h, tx: t.x, ty: t.y, x: t.x + j * 6, y: t.y - j * 6 });
      });
      relax(items, 160, 16, 14);
      items.forEach((it) => {
        view.positions.set(it.id, it);
        const d = nodeEls.get(it.id);
        if (d) { d.style.left = (it.x - it.w / 2) + 'px'; d.style.top = (it.y - it.h / 2) + 'px'; }
      });
    };
    let k = 0;
    const spread = () => { k++; return { x: 120 + ((k * 211) % (W - 240)), y: 120 + ((k * 137) % (H - 240)) }; };
    place('logic', (n) => {
      const pts = [];
      const walk = (id, depth) => targetsOf(id).forEach((t) => { const el = elsById.get(t); if (el) pts.push(elCenter(el)); else if (depth < 2) walk(t, depth + 1); });
      walk(n.id, 0);
      if (n.kind === 'filter') { const p = centroid(pts, { x: W * 0.15, y: H * 0.2 }); return { x: p.x, y: Math.max(80, p.y - 120) }; }
      return centroid(pts, spread());
    });
    const posOf = (id) => view.positions.get(id);
    place('blocks', (n) => {
      const pts = targetsOf(n.id).map(posOf).filter(Boolean);
      const p = centroid(pts, spread());
      return { x: p.x + (n.group === 'list' ? 0 : 0), y: p.y + (n.group === 'list' ? -90 : 40) };
    });
    // upstream, deepest last
    const ups = [...g.nodes.values()].filter((n) => n.layer === 'upstream');
    if (ups.length) {
      const desired = new Map();
      const sorted = ups.slice().sort((a, b) => (a.depth || 1) - (b.depth || 1));
      sorted.forEach((n) => {
        const pts = targetsOf(n.id).map((t) => posOf(t) || desired.get(t)).filter(Boolean);
        desired.set(n.id, centroid(pts, spread()));
      });
      place('upstream', (n) => desired.get(n.id));
    }
  }

  function renderHotspots() {
    const g = view.graph;
    els.hotspots.innerHTML = '';
    hsEls.clear();
    if (!g) return;
    g.elements.forEach((el) => {
      if (!visibleElement(el)) return;
      const d = document.createElement('div');
      d.className = 'hs c-' + el.cls;
      d.dataset.id = el.id;
      d.style.left = el.rect.x - 3 + 'px';
      d.style.top = el.rect.y - 2 + 'px';
      d.style.width = el.rect.w + 6 + 'px';
      d.style.height = el.rect.h + 4 + 'px';
      els.hotspots.appendChild(d);
      hsEls.set(el.id, d);
    });
  }

  /* ---------- 2D trace columns ---------- */
  function build2d() {
    const g = view.graph;
    const host = els.trace2d;
    host.innerHTML = '';
    card2d.clear();
    if (!g) return;
    const elY = new Map(g.elements.filter(visibleElement).map((e) => [e.id, elCenter(e).y]));
    const order = new Map();
    const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 1e6);
    const logic = [...g.nodes.values()].filter((n) => n.layer === 'logic');
    logic.forEach((n) => {
      const ys = [];
      g.edges.forEach((e) => { if (e.from === n.id) { if (elY.has(e.to)) ys.push(elY.get(e.to)); else g.edges.forEach((e2) => { if (e2.from === e.to && elY.has(e2.to)) ys.push(elY.get(e2.to)); }); } });
      order.set(n.id, avg(ys));
    });
    logic.sort((a, b) => order.get(a.id) - order.get(b.id));
    logic.forEach((n, i) => order.set(n.id, i));
    const blocks = [...g.nodes.values()].filter((n) => n.layer === 'blocks');
    blocks.forEach((n) => order.set(n.id, avg(g.edges.filter((e) => e.from === n.id && order.has(e.to)).map((e) => order.get(e.to)))));
    blocks.sort((a, b) => order.get(a.id) - order.get(b.id) || (a.group === 'list') - (b.group === 'list'));
    blocks.forEach((n, i) => order.set(n.id, i + 0.001));
    const ups = [...g.nodes.values()].filter((n) => n.layer === 'upstream');
    ups.forEach((n) => order.set(n.id, avg(g.edges.filter((e) => e.from === n.id && order.has(e.to)).map((e) => order.get(e.to)))));
    ups.sort((a, b) => order.get(a.id) - order.get(b.id));
    const showUp = show2dUp();
    const col = (title, sub, list) => {
      const c = document.createElement('div');
      c.className = 'col2d';
      c.innerHTML = '<div class="col2d-head"><span>' + esc(title) + '</span><small>' + esc(sub) + '</small></div>';
      list.forEach((n) => {
        const d = document.createElement('div');
        d.className = nodeClass(n) + ' is-2d';
        d.dataset.id = n.id;
        d.innerHTML = cardHtml(n, true);
        c.appendChild(d);
        card2d.set(n.id, d);
      });
      host.appendChild(c);
    };
    if (showUp) col('Upstream', ups.length + ' blocks', ups);
    col('Pigment blocks', blocks.length + ' bound', blocks);
    col('Frame logic', logic.length + ' nodes', logic);
    host.style.gridTemplateColumns = (showUp ? '190px ' : '') + '236px 220px';
    host.style.width = cols2dWidth() + 'px';
    view._built2dUp = showUp;
    view.rects2dDirty = true;
  }

  /* ---------- selection ---------- */
  function chainOf(id) {
    const g = view.graph;
    if (!g || !id) return null;
    const el = g.elements.find((e) => e.id === id);
    if (el) return el.chain;
    if (!g.nodes.has(id)) return null;
    const set = new Set([id]);
    const up = [id], down = [id];
    while (up.length) { const x = up.pop(); g.edges.forEach((e) => { if (e.to === x && !set.has(e.from)) { set.add(e.from); up.push(e.from); } }); }
    const seenDown = new Set([id]);
    while (down.length) { const x = down.pop(); g.edges.forEach((e) => { if (e.from === x && !seenDown.has(e.to)) { seenDown.add(e.to); set.add(e.to); down.push(e.to); } }); }
    return set;
  }
  view.chainOf = chainOf;
  let activeChain = null;
  function applySelectionClasses() {
    const id = view.hoverId || view.selectedId;
    activeChain = chainOf(id);
    const mark = (map) => map.forEach((d, k) => {
      d.classList.toggle('is-dim', !!activeChain && !activeChain.has(k));
      d.classList.toggle('is-on', !!activeChain && activeChain.has(k));
      d.classList.toggle('is-selected', k === view.selectedId);
    });
    mark(nodeEls); mark(hsEls); mark(card2d);
    els.stage.classList.toggle('has-focus', !!activeChain);
    view.dirty = true;
  }
  view.select = function (id, silent) {
    view.selectedId = id || null;
    applySelectionClasses();
    if (!silent) emit('select', view.selectedId);
  };
  view.spotlight = function (ids) {
    const set = new Set(ids || []);
    hsEls.forEach((d, k) => d.classList.toggle('is-spot', set.has(k)));
    view.spotIds = set;
  };
  view.highlight = function (ids) {
    // used by Claude: union of chains
    const g = view.graph;
    if (!g || !ids || !ids.length) return;
    view.select(ids[0]);
  };

  /* ---------- pointer ---------- */
  function bindPointer() {
    let drag = null;
    const stage = els.stage;
    stage.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 3;
        if (view.mode === 'layers' && drag.moved && !view.lockCamera) {
          view.tween = null;
          if (e.shiftKey) { view.cam.px = drag.cam.px + dx; view.cam.py = drag.cam.py + dy; }
          else {
            view.cam.az = drag.cam.az + dx * 0.25;
            view.cam.ax = Math.max(0, Math.min(84, drag.cam.ax - dy * 0.2));
            view.preset = { ax: view.cam.ax, az: view.cam.az };
          }
          view.dirty = true;
        }
        return;
      }
      const t = e.target.closest ? e.target.closest('[data-id]') : null;
      const id = t && (t.classList.contains('hs') || t.classList.contains('nd') || t.classList.contains('alt-hit')) ? t.dataset.id : null;
      if (id !== view.hoverId) { view.hoverId = id; applySelectionClasses(); emit('hover', id, e); }
      if (id) emit('hovermove', id, e);
    });
    stage.addEventListener('pointerleave', () => { if (view.hoverId) { view.hoverId = null; applySelectionClasses(); emit('hover', null); } });
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.dock, .legend, .stage-summary, .compare, .col2d-head, button, input, label')) return;
      drag = { x: e.clientX, y: e.clientY, cam: Object.assign({}, view.cam), moved: false, target: e.target };
      if (view.mode === 'layers' && !view.lockCamera && !e.target.closest('[data-id]')) { try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    stage.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      if (d.moved) return;
      const t = d.target.closest ? d.target.closest('[data-id]') : null;
      if (t && (t.classList.contains('hs') || t.classList.contains('nd') || t.classList.contains('alt-hit'))) view.select(t.dataset.id === view.selectedId ? null : t.dataset.id);
      else if (!d.target.closest('.dock, .legend, .stage-summary, .compare')) view.select(null);
    });
    stage.addEventListener('wheel', (e) => {
      if (view.mode !== 'layers' || view.lockCamera || e.target.closest('.dock, .compare, .studio-ui')) return;
      e.preventDefault();
      // Trackpad pinch arrives as ctrlKey wheel events with small deltas: give it a much steeper curve.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = Math.max(-120, Math.min(120, e.deltaY * unit));
      const sr = els.stage.getBoundingClientRect();
      view.zoomBy(Math.exp(-dy * (e.ctrlKey ? 0.0045 : 0.0024)), e.clientX - sr.left, e.clientY - sr.top);
    }, { passive: false });
    stage.addEventListener('click', (e) => {
      const exp = e.target.closest && e.target.closest('.nd-exp');
      if (!exp) return;
      const nd = exp.closest('.nd');
      if (nd) { nd.classList.toggle('is-open'); exp.setAttribute('aria-label', nd.classList.contains('is-open') ? 'Hide details' : 'Show details'); }
      view.rects2dDirty = true;
      view.dirty = true;
    });
    stage.addEventListener('dblclick', (e) => { if (view.mode === 'layers' && !view.lockCamera && !e.target.closest('[data-id], .dock')) view.refit(true); });
  }

  /* ---------- drawing ---------- */
  function hexToRgb(c) {
    c = c.trim();
    if (c.startsWith('#')) {
      const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = c.match(/(\d+)[ ,]+(\d+)[ ,]+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [91, 140, 255];
  }
  const rgbCache = {};
  function rgba(key, a) { const c = view.colors[key] || '#5b8cff'; const rgb = rgbCache[c] || (rgbCache[c] = hexToRgb(c)); return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')'; }
  const EDGE_COLOR = { metric: 'metric', list: 'list', logic: 'logic', const: 'const', axis: 'axis', upstream: 'upstream', write: 'var' };

  function layerOfId(id) {
    const g = view.graph;
    const n = g.nodes.get(id);
    return n ? n.layer : 'frame';
  }
  function edgeVisible(e) {
    const g = view.graph;
    const to = g.nodes.get(e.to);
    if (!to) { const el = g.elements.find((x) => x.id === e.to); if (!el || !visibleElement(el)) return false; }
    if (!view.opts.upstream && (layerOfId(e.from) === 'upstream' || layerOfId(e.to) === 'upstream')) return false;
    if (view.mode !== 'trace' && (view.hidden[layerOfId(e.from)] || view.hidden[layerOfId(e.to)])) return false;
    const from = g.nodes.get(e.from);
    if (from && from.kind === 'axis' && !view.opts.axis) return false;
    return true;
  }
  let elIndex = new Map();
  function point3d(id) {
    const g = view.graph;
    const p = view.positions.get(id);
    if (p) return { u: p.x, v: p.y, z: zOf(g.nodes.get(id).layer) };
    const el = elIndex.get(id);
    if (el) { const c = elCenter(el); return { u: c.x, v: c.y, z: zOf('frame') }; }
    return null;
  }
  function rect2d(id) {
    if (!view.rects2dDirty && view.rects2d.has(id)) return view.rects2d.get(id);
    const d = card2d.get(id);
    if (!d) return null;
    const sr = els.stage.getBoundingClientRect();
    const r = d.getBoundingClientRect();
    const o = { x0: r.left - sr.left, x1: r.right - sr.left, y: r.top - sr.top + Math.min(r.height / 2, 22), top: r.top - sr.top, bottom: r.bottom - sr.top };
    view.rects2d.set(id, o);
    return o;
  }
  function samples3d(a, b, n) {
    const P0 = [a.u, a.v, a.z], P3 = [b.u, b.v, b.z];
    const dz = b.z - a.z;
    const lift = Math.abs(dz) < 1 ? 60 : dz * 0.42;
    const P1 = [a.u, a.v, a.z + lift], P2 = [b.u, b.v, b.z - (Math.abs(dz) < 1 ? -60 : dz * 0.42)];
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      const c0 = mt * mt * mt, c1 = 3 * mt * mt * t, c2 = 3 * mt * t * t, c3 = t * t * t;
      out.push(project(c0 * P0[0] + c1 * P1[0] + c2 * P2[0] + c3 * P3[0], c0 * P0[1] + c1 * P1[1] + c2 * P2[1] + c3 * P3[1], c0 * P0[2] + c1 * P1[2] + c2 * P2[2] + c3 * P3[2]));
    }
    return out;
  }
  function samples2d(a, b, n) {
    const out = [];
    const dx = Math.max(40, (b.x - a.x) * 0.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      const c0 = mt * mt * mt, c1 = 3 * mt * mt * t, c2 = 3 * mt * t * t, c3 = t * t * t;
      out.push({ x: c0 * a.x + c1 * (a.x + dx) + c2 * (b.x - dx) + c3 * b.x, y: c0 * a.y + c1 * a.y + c2 * b.y + c3 * b.y });
    }
    return out;
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

  function strokePath(pts, upto) {
    const n = pts.length - 1;
    const last = Math.max(1, Math.floor(n * upto));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= last; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  function pointAt(pts, t) {
    const f = t * (pts.length - 1), i = Math.floor(f), r = f - i;
    const a = pts[Math.min(i, pts.length - 1)], b = pts[Math.min(i + 1, pts.length - 1)];
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  }

  function draw(now) {
    const g = view.graph;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.stageW, view.stageH);
    if (!g || !view.opts.traces) return;
    const a3 = Math.min(view.vis.logic, 1);
    const a2 = view.vis.panel2d;
    const focus = activeChain;
    const flow = view.opts.flow;
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = view.dark ? 'lighter' : 'source-over';
    const reveal = view.mode === 'layers' && view.tween ? Math.max(0, Math.min(1, (view.vis.reveal - 0.45) / 0.55)) : 1;
    g.edges.forEach((e) => {
      if (!edgeVisible(e)) return;
      const on = focus ? focus.has(e.from) && focus.has(e.to) : false;
      const base = (focus ? (on ? 1 : 0.07) : 0.55) * (on ? 1 : view.opts.beam);
      const key = EDGE_COLOR[e.type] || 'metric';
      const layerAlpha = (id) => { const l = layerOfId(id); return l === 'frame' ? view.opacity.frame * 0.6 + 0.4 : (view.vis[l] == null ? 1 : view.vis[l]) * (0.35 + 0.65 * view.opacity[l]); };
      // 3D beams
      if (a3 > 0.01) {
        const pa = point3d(e.from), pb = point3d(e.to);
        if (pa && pb) {
          const lf = (id) => { const l = layerOfId(id); return view.layerFade[l] == null ? 1 : view.layerFade[l]; };
          const alpha = base * Math.min(layerAlpha(e.from), layerAlpha(e.to)) * a3 * Math.min(lf(e.from), lf(e.to));
          if (alpha > 0.01) {
            const pts = samples3d(pa, pb, 18);
            ctx.strokeStyle = rgba(key, alpha * 0.22);
            ctx.lineWidth = on ? 7 : 4;
            strokePath(pts, reveal);
            ctx.strokeStyle = rgba(key, Math.min(1, alpha * (on ? 1 : 0.85)));
            ctx.lineWidth = on ? 2 : 1.1;
            strokePath(pts, reveal);
            if (flow && reveal >= 1) particles(pts, e, alpha, key, now, on);
          }
        }
      }
      // 2D traces
      if (a2 > 0.01) {
        const pts = edge2d(e);
        if (pts) {
          const alpha = base * a2;
          ctx.strokeStyle = rgba(key, alpha * 0.18);
          ctx.lineWidth = on ? 6 : 3.5;
          strokePath(pts, 1);
          ctx.strokeStyle = rgba(key, Math.min(1, alpha * 0.95));
          ctx.lineWidth = on ? 2 : 1;
          strokePath(pts, 1);
          if (flow) particles(pts, e, alpha, key, now, on);
        }
      }
    });
    view.rects2dDirty = false;
    ctx.globalCompositeOperation = 'source-over';
  }
  function particles(pts, e, alpha, key, now, on) {
    const n = on ? 3 : 1;
    const speed = 0.00018 * (on ? 1.6 : 1);
    for (let i = 0; i < n; i++) {
      const t = (now * speed + hash(e.id) + i / n) % 1;
      const p = pointAt(pts, t);
      ctx.fillStyle = rgba(key, Math.min(1, alpha * 0.35));
      ctx.beginPath(); ctx.arc(p.x, p.y, on ? 5 : 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(key, Math.min(1, alpha * 1.4));
      ctx.beginPath(); ctx.arc(p.x, p.y, on ? 2 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  function edge2d(e) {
    const g = view.graph;
    const fromIsEl = !g.nodes.has(e.from), toIsEl = !g.nodes.has(e.to);
    if (fromIsEl) return null;
    const ra = rect2d(e.from);
    if (!ra) return null;
    let b;
    if (toIsEl) {
      const el = elIndex.get(e.to);
      if (!el) return null;
      const p = project(el.rect.x - 2, el.rect.y + el.rect.h / 2, 0);
      b = { x: p.x, y: p.y };
    } else {
      const rb = rect2d(e.to);
      if (!rb) return null;
      const sameCol = Math.abs(rb.x0 - ra.x0) < 5;
      if (sameCol) {
        // same column: loop out to the right
        const a = { x: ra.x1, y: ra.y }, bb = { x: rb.x1, y: rb.y };
        const out = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16, mt = 1 - t, bulge = 28;
          const c0 = mt * mt * mt, c1 = 3 * mt * mt * t, c2 = 3 * mt * t * t, c3 = t * t * t;
          out.push({ x: c0 * a.x + c1 * (a.x + bulge) + c2 * (bb.x + bulge) + c3 * bb.x, y: c0 * a.y + c1 * a.y + c2 * bb.y + c3 * bb.y });
        }
        return out;
      }
      b = { x: rb.x0, y: rb.y };
    }
    return samples2d({ x: ra.x1, y: ra.y }, b, 18);
  }

  function applyTransforms(now) {
    let cam = view.cam;
    if (view.opts.drift && view.mode === 'layers' && !view.tween && !reduceMotion) {
      cam = Object.assign({}, cam, { az: cam.az + Math.sin(now * 0.00023) * 7, ax: Math.max(0, Math.min(84, cam.ax + Math.sin(now * 0.00017) * 2.5)) });
    }
    M = matrixOf(cam);
    M.__cam = cam;
    const fu = camv(cam, 'fu'), fv = camv(cam, 'fv'), fz = camv(cam, 'fz'), pp = camv(cam, 'pp');
    els.viewport.style.perspective = pp.toFixed(1) + 'px';
    els.scene.style.transform = 'translate3d(' + cam.px.toFixed(2) + 'px,' + cam.py.toFixed(2) + 'px,0) rotateX(' + cam.ax.toFixed(3) + 'deg) rotateZ(' + cam.az.toFixed(3) + 'deg) scale3d(' + cam.s.toFixed(4) + ',' + cam.s.toFixed(4) + ',' + cam.s.toFixed(4) + ')' +
      (fu || fv || fz ? ' translate3d(' + (-fu).toFixed(2) + 'px,' + (-fv).toFixed(2) + 'px,' + (-fz).toFixed(2) + 'px)' : '');
    const rip = rippleState(now);
    LAYERS.forEach((l) => {
      const p = els.planes[l];
      if (!p) return;
      if (l === 'frame' && rip) p.style.transform = 'translateZ(' + (zOf(l) + rip.tz).toFixed(2) + 'px) rotateX(' + rip.rx.toFixed(3) + 'deg) rotateY(' + rip.ry.toFixed(3) + 'deg)';
      else p.style.transform = 'translateZ(' + zOf(l).toFixed(2) + 'px)';
      const fade = view.layerFade[l] == null ? 1 : view.layerFade[l];
      const vis = l === 'frame' ? 1 : view.vis[l] * (l === 'upstream' && !view.opts.upstream ? 0 : 1);
      const op = (l === 'frame' ? 1 - (1 - view.opacity.frame) * view.vis.logic : vis * view.opacity[l]) * (view.mode === 'layers' || l !== 'frame' ? fade : 1);
      p.style.opacity = op.toFixed(3);
      p.style.visibility = op < 0.01 ? 'hidden' : 'visible';
    });
    if (els.flowPlane) {
      const fp = els.flowPlane, fv = view.opts.blockflow ? Math.min(1, view.vis.blocks) : 0;
      fp.style.transform = 'translateZ(' + zOf('flow').toFixed(2) + 'px)';
      fp.style.opacity = fv.toFixed(3);
      fp.style.visibility = fv < 0.01 ? 'hidden' : 'visible';
    }
    const lowest = view.opts.blockflow && els.flowPlane ? 'flow' : view.opts.upstream && view.graph && view.graph.stats.upstream ? 'upstream' : 'blocks';
    els.floor.style.transform = 'translateZ(' + (zOf(lowest) - view.gap * 0.55 - 40).toFixed(2) + 'px)';
    els.floor.style.opacity = (Math.min(1, view.vis.blocks) * 0.9).toFixed(3);
    els.trace2d.style.opacity = view.vis.panel2d.toFixed(3);
    els.trace2d.style.visibility = view.vis.panel2d < 0.01 ? 'hidden' : 'visible';
    els.trace2d.style.transform = 'translateX(' + ((1 - view.vis.panel2d) * -40).toFixed(1) + 'px)';
  }

  /* ---------- paper ripple: a short damped wave as the frame sheet lifts ---------- */
  let waveImg = null, waveOn = false;
  function rippleState(now) {
    const r = view.ripple;
    if (!r) { if (waveOn) { els.wave.style.opacity = '0'; waveOn = false; } return null; }
    const t = now - r.t0;
    if (t < 0) return null;
    if (t > r.dur) { view.ripple = null; els.wave.style.opacity = '0'; waveOn = false; return null; }
    const env = Math.exp(-t / 560) * Math.min(1, t / 140);
    const ph = (t / 1000) * Math.PI * 2 * 1.6;
    drawWave(t / 1000, env);
    return { rx: 2.2 * env * Math.sin(ph), ry: -1.2 * env * Math.sin(ph * 0.83 + 1.1), tz: 18 * env * Math.sin(ph + 0.7) };
  }
  function drawWave(ts, env) {
    const c = els.wave, w = c.width, h = c.height, g = c.getContext('2d');
    if (!waveImg) waveImg = g.createImageData(w, h);
    const d = waveImg.data;
    const front = ts * 1.5 - 0.15; // the crest travels from the front-left corner across the sheet
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const u = i / (w - 1), v = 1 - j / (h - 1);
        const dist = u * 0.62 + v * 0.38;
        const lag = front - dist;
        const k = lag < 0 ? Math.max(0, 1 + lag * 6) : Math.exp(-lag * 1.8);
        const slope = Math.cos((dist * 3.2 - ts * 2.4) * Math.PI * 2) * env * k;
        const o = (j * w + i) * 4;
        const light = slope > 0;
        d[o] = d[o + 1] = d[o + 2] = light ? 255 : 20;
        d[o + 3] = Math.min(255, Math.abs(slope) * (light ? 120 : 70));
      }
    }
    g.putImageData(waveImg, 0, 0);
    if (!waveOn) { c.style.opacity = '1'; waveOn = true; }
  }

  let lastAnim = 0;
  function stepFades() {
    let moving = false;
    ['frame', 'logic', 'blocks'].forEach((l) => {
      const target = view.hidden[l] && view.mode === 'layers' && !view.altRect ? 0 : 1, cur = view.layerFade[l];
      if (Math.abs(target - cur) < 0.004) { view.layerFade[l] = target; return; }
      view.layerFade[l] = reduceMotion ? target : cur + (target - cur) * 0.14;
      moving = true;
    });
    return moving;
  }
  function tick(now) {
    const animating = stepTween(now) | stepFades();
    const continuous = !!view.ripple || view.tickers.length > 0 || (view.opts.flow && view.opts.traces && view.graph && (view.mode !== 'frame' || view.vis.logic > 0.01)) || (view.opts.drift && view.mode === 'layers');
    if (animating || continuous || view.dirty) {
      if (view.graph) elIndex = new Map(view.graph.elements.map((e) => [e.id, e]));
      applyTransforms(now);
      draw(now);
      view.tickers.forEach((fn) => { try { fn(now); } catch (err) { console.error(err); } });
      view.dirty = false;
      if (animating) lastAnim = now;
    }
    requestAnimationFrame(tick);
  }

  view.projectPlanePoint = (u, v) => project(u, v, zOf('frame'));
  view.project = (u, v, z) => project(u, v, z);
  view.planeEl = (l) => els.planes[l] || (l === 'flow' ? els.flowPlane : null);
  view.reduceMotion = reduceMotion;
  view.isTweening = () => !!view.tween;
  view.activeChain = () => activeChain;
  view.W = W;
  view.H = H;
})();
