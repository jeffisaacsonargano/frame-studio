/* Framecraft — app shell: panes, tuning, Claude, versions, compare, loading. */
(function () {
  'use strict';
  const S = window.Strata;
  const E = S.engine, V = S.view, esc = S.esc;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('strata:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('strata:' + k, JSON.stringify(v)); } catch (e) {} },
  };

  const CLS = {
    direct: { label: 'From a Pigment block', k: '--c-metric' },
    label: { label: 'Dimension item', k: '--c-list' },
    computed: { label: 'Computed in frame', k: '--c-logic' },
    constant: { label: 'Hardcoded in code', k: '--c-const' },
    axis: { label: 'Chart scale', k: '--c-axis' },
    untraced: { label: 'Not traced', k: '--c-untraced' },
    zero: { label: 'Zero / blank', k: '--c-axis' },
  };
  const GROUP_K = { metric: '--c-metric', list: '--c-list', prop: '--c-prop', var: '--c-var', tx: '--c-tx', table: '--c-table' };
  /* Defaults are the neutral position of every control: a frame that reads none of the newer keys looks as it always did. */
  const DEFAULT_TUNING = { color: 0.5, detail: 0.5, horizon: 0.5, specificity: 0.5, audience: 0.5, emphasis: 0.5, certainty: 0, round: 0.5, depth: 0.5, space: 0.5, precision: 0.5, alert: 0, headline: '', hide: [], highlights: [] };
  const freshTuning = (t) => { const o = Object.assign({}, DEFAULT_TUNING, t || {}); o.highlights = (o.highlights || []).slice(); o.hide = (o.hide || []).slice(); return o; };

  const app = (S.app = {
    snap: null,
    graph: null,
    tuning: freshTuning(),
    savedTuning: null,    // the default saved for this frame (shared store, or this device)
    savedScope: null,     // 'everyone' | 'me'
    mode: 'frame',
    tab: store.get('tab', 'inspect'),
    caps: { db: null, user: null, sample: null, downloads: null },
    frames: new Map(), // key -> {key, name, application, workspace, source, versions: []}
    localVersions: new Map(), // key -> [{id,label,createdAt,source,snap}]
    dbVersions: new Map(),
    chat: [],
    texts: { frame: '', css: '' },
    selfEdit: store.get('selfEdit', false), // in-frame edit pane on/off
    seBuilt: null,
    seLog: [],
    seRequests: [],
  });

  /* ---------- links to the other apps in Frame Studio ---------- */
  function canvasBridge() { try { return window.parent !== window ? window.parent.__canvas : null; } catch (e) { return null; } }
  function crossLink(target, key) {
    const snap = app.snap;
    const m = E.blockMeta(snap, key) || (snap.upstream && snap.upstream[key]) || { name: key };
    const block = { name: m.name, kind: m.kind, formula: m.formula || null, dims: m.dims || [], folder: m.folder || null, app: (snap.frame && snap.frame.application) || null, from: 'Framecraft' };
    const c = canvasBridge();
    if (c && c.open) { c.open(target, { block, from: 'Framecraft' }); return; }
    toast(target === 'pigment' ? 'Pigment links connect once the Pigment connector is authorized.' : 'Formula Studio opens from here inside Frame Studio.');
  }
  S.crossLink = crossLink;

  /* ---------- in-frame editing ---------- */
  const KIT_SETTINGS = () => TUNE_SLIDERS.concat([
    { key: 'specificity', name: 'Specificity', lo: 'Abstract', hi: 'Specific' },
    { key: 'audience', name: 'Audience', lo: 'Executive', hi: 'Operator' },
  ]);
  function hostLoad(snap) {
    const size = { w: V.W, h: V.H };
    if (app.selfEdit && S.selfEdit) {
      const b = S.selfEdit.build(snap, app.tuning, app.code.tunable, KIT_SETTINGS());
      app.seBuilt = b;
      app.host.load(snap, app.code.tunable ? app.tuning : null, size, { prefix: b.prefix, defs: b.defs, data: b.data, items: b.items, hideDs: b.hideDs, simulate: true });
    } else {
      app.seBuilt = null;
      app.host.load(snap, app.code.tunable ? app.tuning : null, size);
    }
  }
  function setSelfEdit(on) {
    app.selfEdit = !!on;
    store.set('selfEdit', app.selfEdit);
    const b = $('#btnSelfEdit');
    if (b) b.setAttribute('aria-pressed', String(app.selfEdit));
    if (app.snap) { app.lastSig = ''; hostLoad(app.snap); }
    if (app.tab === 'tune') renderTune();
    toast(app.selfEdit ? 'In-frame editing is on. Use the Edit frame button at the top right of the frame.' : 'In-frame editing is off. The frame is back to its own code.');
  }
  let seToastTimer = null, seBatch = [];
  function onSelfEditWrite(d) {
    const [target, coords, value] = d.args || [];
    const entry = { op: d.op, target, coords, value, at: Date.now() };
    app.seLog.unshift(entry);
    app.seLog = app.seLog.slice(0, 40);
    if (d.op === 'editValue' && target === 'frameConfigValue' && coords && coords.frameSettingList) {
      const k = coords.frameSettingList;
      if (k === 'highlights') app.tuning.highlights = String(value || '').split('|').filter(Boolean);
      else if (k in app.tuning) app.tuning[k] = Math.max(0, Math.min(1, parseFloat(value) || 0));
    }
    if (d.op === 'addItem' && target === 'frameChangeRequests') {
      const text = coords && (coords.Name || coords.name || Object.values(coords)[0]);
      if (text) app.seRequests.unshift({ text: String(text), at: Date.now(), status: 'queued' });
    }
    seBatch.push(entry);
    clearTimeout(seToastTimer);
    seToastTimer = setTimeout(() => {
      const n = seBatch.length;
      const kinds = [...new Set(seBatch.map((e) => (e.target === 'frameConfigValue' ? 'display settings' : e.op === 'addItem' ? 'a change request' : E.blockMeta(app.snap, e.target) ? E.blockMeta(app.snap, e.target).name : e.target)))];
      seBatch = [];
      toast('The frame applied ' + n + ' write' + (n > 1 ? 's' : '') + ' (' + kinds.join(', ') + '). Simulated here; in Pigment these go to your workspace.');
      if (app.tab === 'tune') renderTune();
    }, 180);
  }
  function seWriteText(e) {
    const nm = (k) => { const m = E.blockMeta(app.snap, k); return m ? m.name : k; };
    if (e.target === 'frameConfigValue') return 'FRAME_CONFIG[' + (e.coords && e.coords.frameSettingList) + '] = "' + e.value + '"';
    if (e.op === 'addItem') return 'Frame Change Requests += "' + String((e.coords && (e.coords.Name || Object.values(e.coords)[0])) || '').slice(0, 60) + '"';
    const c = e.coords ? Object.entries(e.coords).map(([k, v]) => nm(k) + ' ' + v).join(', ') : '';
    return nm(e.target) + ' [' + c + '] = ' + (typeof e.value === 'number' ? e.value.toLocaleString('en-US') : JSON.stringify(e.value));
  }
  function seSetupPrompt(spec) {
    const f = app.snap.frame || {};
    return 'Set up self-editing for the Pigment Frame "' + (f.name || 'this frame') + '"' + (f.application ? ' in the ' + f.application + ' application' : '') + ' using the Pigment MCP.\n\n' +
      'Create these blocks:\n' + spec.blocks.map((b) => '- ' + b).join('\n') + '\n\n' +
      'Then write the attached frame code to a file and call update_frame for this frame with that path, these bindings (replace the <...> placeholders with the ids you created) and these data sources:\n\nbindings = ' + JSON.stringify(spec.bindings, null, 2) + '\n\ndata_sources = ' + JSON.stringify(spec.dataSources, null, 2) + '\n\n' +
      'Finally, open the frame, click Edit frame, change one display setting and Apply, and confirm FRAME_CONFIG updated.';
  }

  /* ---------- boot ---------- */
  async function boot() {
    V.init({ stage: $('#stage'), scene: $('#scene'), canvas: $('#traces'), hotspots: $('#hotspots'), trace2d: $('#trace2d') });
    app.host = new S.FrameHost($('#frameHost'), { onMessage: onFrameMessage });
    bindChrome();
    try {
      const [fr, css] = await Promise.all([fetch('frames/revenue-pulse.frame.js').then((r) => r.text()), fetch('frames/pigment.css').then((r) => r.text())]);
      app.texts.frame = fr; app.texts.css = css;
    } catch (e) {
      toast('The sample frame could not be loaded: ' + e.message);
    }
    app.frames.set(S.demo.key, { key: S.demo.key, name: 'Revenue Pulse', application: 'Revenue Planning', workspace: 'Sample workspace', source: 'sample', room: 'cfo' });
    if (S.samples) S.samples.specs.forEach((sp) => app.frames.set(sp.key, { key: sp.key, name: sp.name, application: sp.app, workspace: 'Sample workspace', source: 'sample', room: sp.room }));
    loadSnapshot(S.demo.build(3, app.texts.frame, app.texts.css));
    const h = (location.hash || '').slice(1);
    setMode(['frame', 'layers', 'trace', 'compare'].includes(h) ? h : 'frame', true);
    window.addEventListener('hashchange', () => { const m = location.hash.slice(1); if (['frame', 'layers', 'trace', 'compare'].includes(m) && m !== app.mode) setMode(m); });
    initCaps();
  }

  async function initCaps() {
    if (!window.claude || !window.claude.use) return;
    const [db, user, sample, downloads] = await Promise.all(['db', 'user', 'sample', 'downloads'].map((n) => window.claude.use(n).catch(() => null)));
    Object.assign(app.caps, { db, user, sample, downloads });
    if (user) {
      try { app.canEdit = await user.canEdit(); } catch (e) { app.canEdit = false; }
      try { app.userId = await user.id(); } catch (e) { app.userId = null; }
    }
    if (db) { subscribeFrames(); subscribePushes(); if (app.snap) subscribeVersions(app.snap.key); if (app.tuneKey) loadSharedTuning(app.tuneKey); }
    renderClaude();
    renderTune();
    if ($('#historyPop').hidden === false) renderHistory();
  }

  /* ---------- loading a snapshot into the stage ---------- */
  function normalizeSnapshot(s) {
    s = Object.assign({ schema: 1, bindings: [], dataSources: [], data: {}, items: {}, blocks: {}, upstream: {} }, s);
    s.dataSources = s.dataSources || s.data_sources || [];
    Object.keys(s.data || {}).forEach((k) => {
      const v = s.data[k];
      if (Array.isArray(v)) s.data[k] = { default: { rows: v, rowOffset: 0, totalRowCount: v.length }, filters: {} };
      else if (v && v.rows && !v.default) s.data[k] = { default: v, filters: {} };
      else if (v && v.default && !v.filters) v.filters = {};
    });
    s.frame = s.frame || { name: 'Untitled frame' };
    s.key = s.key || slug(s.frame.id || s.frame.name || 'frame');
    s.version = s.version || { id: 'draft', label: 'Draft', createdAt: new Date().toISOString(), source: 'paste' };
    return s;
  }
  function slug(x) { return String(x).toLowerCase().replace(/[^a-z0-9_\-.~:@+]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'frame'; }

  function loadSnapshot(snap) {
    snap = normalizeSnapshot(snap);
    if (app.tuneKey !== snap.key) { app.tuneKey = snap.key; initTuningFor(snap.key); }
    app.snap = snap;
    app.code = E.analyzeCode(snap.code);
    app.lastSig = '';
    if (!app.frames.has(snap.key)) app.frames.set(snap.key, { key: snap.key, name: snap.frame.name, application: snap.frame.application, workspace: snap.frame.workspace, source: snap.version.source });
    hostLoad(snap);
    if (S.flowmap) {
      const fp = document.querySelector('[data-layer="flow"]');
      S.flowmap.render(fp, snap, (id) => V.select(id));
      const ob = fp && fp.querySelector('[data-fm-open]');
      if (ob) ob.onclick = (e) => { e.stopPropagation(); const c = canvasBridge(); if (c && c.open) c.open('blockflow', { block: { name: snap.frame.name }, from: 'Framecraft' }); else toast('Blockflow opens from here inside Frame Studio.'); };
    }
    $('#pickerName').textContent = snap.frame.name;
    $('#pickerMeta').textContent = [snap.frame.workspace, snap.frame.application, snap.version.label].filter(Boolean).join(' › ');
    $('#frameStatus').hidden = true;
    V.select(null, true);
    renderTune();
    renderCode();
    renderInspector();
    if (app.mode === 'compare') renderCompare();
    if (!$('#historyPop').hidden) renderHistory();
    subscribeVersions(snap.key);
  }

  let rebuildTimer = null;
  function onFrameMessage(d, host) {
    if (host !== app.host) return;
    if (d.type === 'error') showFrameError(d.message, d.line);
    if (d.type === 'write') {
      if (d.simulated) onSelfEditWrite(d);
      else toast('The frame called ' + d.op + '(' + (d.args && d.args[0] ? JSON.stringify(d.args[0]) : '') + '). Replays are read-only, so nothing was sent to Pigment.');
    }
    if (d.type === 'scan' || d.type === 'delivered' || d.type === 'dsMissing' || d.type === 'items') {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(rebuild, d.type === 'scan' ? 30 : 200);
    }
  }
  function showFrameError(msg, line) {
    const el = $('#frameStatus');
    el.hidden = false;
    el.textContent = 'The frame reported an error' + (line ? ' (code line ' + Math.max(1, line - 1) + ')' : '') + ': ' + msg;
  }
  function rebuild() {
    const h = app.host;
    if (!h.scan) return;
    const sig = JSON.stringify([h.scan.items.map((i) => i.id + i.text + Math.round(i.x) + ',' + Math.round(i.y)), [...h.subs.values()].map((s) => s.name + s.key + !!s.dead), [...h.itemsAliases]]);
    if (sig === app.lastSig) return;
    app.lastSig = sig;
    const g = E.buildGraph(app.snap, h, h.scan);
    app.graph = g;
    V.setGraph(g, true);
    applySpotlight();
    renderSummary();
    renderInspector();
    if (app.tab === 'tune') renderTuneMembersOnly();
  }

  /* ---------- modes ---------- */
  function setMode(mode, instant) {
    app.mode = mode;
    $$('#viewTabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
    if (location.hash.slice(1) !== mode) { try { history.replaceState(null, '', '#' + mode); } catch (e) { location.hash = mode; } }
    const cmp = $('#compare');
    if (mode === 'compare') { cmp.hidden = false; renderCompare(); return; }
    cmp.hidden = true;
    destroyCompare();
    V.setMode(mode, { instant });
    renderDock();
    renderSummary();
  }

  /* ---------- summary chips ---------- */
  function renderSummary() {
    const g = app.graph, el = $('#summary');
    if (!g) { el.innerHTML = '<span class="sum-chip">Replaying frame…</span>'; return; }
    const c = g.stats.counts;
    const chip = (k, n, t) => (n ? '<span class="sum-chip"><i style="--k:var(' + k + ')"></i><b>' + n + '</b>' + t + '</span>' : '');
    el.innerHTML = '<span class="sum-chip is-cov"><b>' + Math.round(g.stats.coverage * 100) + '%</b>of numbers trace to Pigment</span>' +
      chip('--c-metric', c.direct, 'from blocks') + chip('--c-logic', c.computed, 'computed in frame') + chip('--c-const', c.constant, 'hardcoded') + chip('--c-untraced', c.untraced, 'not traced') + chip('--c-list', c.label, 'dimension labels');
  }

  /* ---------- dock ---------- */
  function slider(id, min, max, step, val, label, fmt) {
    return '<div class="ctl-group"><label class="ctl-label" for="' + id + '">' + esc(label) + '<output id="' + id + 'Out">' + (fmt ? fmt(val) : val) + '</output></label><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
  }
  function toggleBtn(key, label) { return '<button type="button" class="chipbtn" data-opt="' + key + '" aria-pressed="' + !!V.opts[key] + '">' + esc(label) + '</button>'; }
  function paintRange(inp) { const p = ((inp.value - inp.min) / (inp.max - inp.min)) * 100; inp.style.setProperty('--p', p + '%'); }
  function renderDock() {
    const body = $('#dockBody'), title = $('#dockTitle');
    const mode = app.mode;
    let h = '';
    const flip = $('#dockFlip');
    if (flip) {
      const open = mode !== 'frame';
      const t = open ? 'Collapse back to the frame' : 'Reveal source layers';
      flip.setAttribute('aria-pressed', String(open)); flip.setAttribute('aria-label', t); flip.title = t;
    }
    if (mode !== 'frame') h += '<button type="button" class="btn" data-act="collapse" style="justify-content:center;width:100%;margin-bottom:10px"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 3 14 6 8 9 2 6z"/><path d="M5 12.5h6"/></svg>Collapse to frame</button>';
    if (mode === 'frame') {
      title.textContent = 'Frame';
      const inter = $('#stage').dataset.interact === '1';
      h += '<button type="button" class="btn btn-primary" data-act="reveal" style="justify-content:center">Reveal source layers</button>';
      h += '<div class="ctl-group"><span class="ctl-label">Pointer</span><div class="ctl-row"><button type="button" class="chipbtn" data-ptr="inspect" aria-pressed="' + !inter + '">Inspect numbers</button><button type="button" class="chipbtn" data-ptr="interact" aria-pressed="' + inter + '">Use the frame</button></div></div>';
      h += '<div class="ctl-group"><span class="ctl-label">Show</span><div class="ctl-row">' + toggleBtn('labels', 'Dimension labels') + toggleBtn('axis', 'Chart scales') + '</div></div>';
    } else if (mode === 'layers' && S.alt && S.alt.active()) {
      title.textContent = S.alt.title();
      h += S.alt.dockHtml();
    } else if (mode === 'layers') {
      title.textContent = 'Layers';
      h += '<div class="ctl-group"><span class="ctl-label">Camera</span><div class="ctl-row">' +
        [['Isometric', 58, -34], ['Cinematic', 68, -18], ['Edge-on', 80, -6], ['Overhead', 24, -8]].map((p) => '<button type="button" class="chipbtn" data-cam="' + p[1] + ',' + p[2] + '">' + p[0] + '</button>').join('') +
        '<button type="button" class="chipbtn" data-act="fit">Fit</button>' + toggleBtn('drift', 'Drift') + '</div></div>';
      h += '<div class="ctl-group"><span class="ctl-label">Zoom</span><div class="ctl-row"><button type="button" class="chipbtn" data-zoom="0.8" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" class="chipbtn" data-zoom="1.25" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" class="chipbtn" data-act="fit" title="Refit (0)">Reset</button></div></div>';
      h += slider('gapSlider', 40, 440, 2, Math.round(V.userGap), 'Layer spacing', (v) => v + 'px');
      h += slider('beamSlider', 5, 100, 1, Math.round(V.opts.beam * 100), 'Beam strength', (v) => v + '%');
      h += '<div class="ctl-group"><span class="ctl-label">Opacity</span>' + [['frame', 'Frame'], ['logic', 'Logic'], ['blocks', 'Blocks'], ['upstream', 'Upstream']].map(([k, l]) => '<div class="op-row"><span>' + l + '</span><input type="range" min="0" max="100" value="' + Math.round(V.opacity[k] * 100) + '" data-op="' + k + '" aria-label="' + l + ' opacity"><output>' + Math.round(V.opacity[k] * 100) + '</output></div>').join('') + '</div>';
      const EYE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';
      const EYE_OFF = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l12 12M6.4 4A6.6 6.6 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a12 12 0 0 1-2 2.5M4.2 5.4A11.6 11.6 0 0 0 1.5 8S4 12.5 8 12.5a6 6 0 0 0 2.4-.5"/></svg>';
      h += '<div class="ctl-group"><span class="ctl-label">Layers</span><div class="layer-row">' + LAYER_CHIPS.map(([k, l]) => { const on = layerOn(k); return '<button type="button" class="chipbtn layer-chip" data-layer-toggle="' + k + '" aria-pressed="' + on + '" title="' + (on ? 'Hide ' : 'Show ') + l + '">' + (on ? EYE : EYE_OFF) + l + '</button>'; }).join('') + '</div></div>';
      h += '<div class="ctl-group"><span class="ctl-label">Traces</span><div class="ctl-row">' + toggleBtn('traces', 'Beams') + toggleBtn('flow', 'Flow') + toggleBtn('labels', 'Dimension labels') + toggleBtn('axis', 'Scales') + '</div></div>';
      h += '<div class="ctl-group"><span class="ctl-label">Cards</span><div class="ctl-row">' + toggleBtn('details', 'Expand all details') + '</div></div>';
      h += '<p class="muted small" style="margin:0">Drag to orbit · Shift-drag to pan · pinch or scroll to zoom (+ / − keys) · 0 or double-click to refit</p>';
    } else {
      title.textContent = 'Trace';
      h += '<div class="ctl-group"><span class="ctl-label">Traces</span><div class="ctl-row">' + toggleBtn('traces', 'Lines') + toggleBtn('flow', 'Flow') + toggleBtn('labels', 'Dimension labels') + toggleBtn('axis', 'Scales') + toggleBtn('upstream', 'Upstream column') + toggleBtn('details', 'Expand all details') + '</div></div>';
      h += '<p class="muted small" style="margin:0">Hover a block, a logic node or a number to follow its path.</p>';
    }
    body.innerHTML = h;
    $$('input[type="range"]', body).forEach(paintRange);
  }
  const LAYER_CHIPS = [['frame', 'Frame'], ['logic', 'Frame logic'], ['blocks', 'Pigment blocks'], ['upstream', 'Upstream lineage'], ['flow', 'Blockflow']];
  function layerOn(k) { return k === 'upstream' ? !!V.opts.upstream : k === 'flow' ? !!V.opts.blockflow : !V.hidden[k]; }
  function saveLayers() { store.set('layers', { frame: layerOn('frame'), logic: layerOn('logic'), blocks: layerOn('blocks'), upstream: layerOn('upstream'), flow: layerOn('flow') }); }
  function restoreLayers() {
    const l = store.get('layers', null);
    if (!l || typeof l !== 'object') return; // upstream lineage starts off; everything else on
    ['frame', 'logic', 'blocks'].forEach((k) => { V.hidden[k] = l[k] === false; });
    V.opts.upstream = !!l.upstream;
    V.opts.blockflow = !!l.flow;
  }
  function bindDock() {
    const body = $('#dockBody');
    restoreLayers();
    const flip = $('#dockFlip');
    if (flip) flip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (app.mode === 'frame') { setMode('layers'); return; }
      setMode('frame');
    });
    V.on('layers', () => { saveLayers(); if (app.mode === 'layers') renderDock(); });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.layerToggle) { V.setLayerShown(b.dataset.layerToggle, !layerOn(b.dataset.layerToggle)); return; }
      if (b.dataset.act === 'reveal') setMode('layers');
      if (b.dataset.act === 'collapse') { setMode('frame'); return; }
      if (b.dataset.act === 'fit') V.refit(true);
      if (b.dataset.zoom) V.zoomBy(+b.dataset.zoom);
      if (b.dataset.cam) { const [ax, az] = b.dataset.cam.split(',').map(Number); V.setPreset(ax, az); }
      if (b.dataset.opt) { const v = !V.opts[b.dataset.opt]; V.setOpt(b.dataset.opt, v); b.setAttribute('aria-pressed', String(v)); }
      if (b.dataset.ptr) { $('#stage').dataset.interact = b.dataset.ptr === 'interact' ? '1' : '0'; $('#stage').dataset.inspect = b.dataset.ptr === 'interact' ? '0' : '1'; renderDock(); }
    });
    body.addEventListener('input', (e) => {
      const t = e.target;
      if (t.type !== 'range') return;
      paintRange(t);
      if (t.id === 'gapSlider') { V.setGap(+t.value); $('#gapSliderOut').textContent = t.value + 'px'; }
      if (t.id === 'beamSlider') { V.setOpt('beam', t.value / 100); $('#beamSliderOut').textContent = t.value + '%'; }
      if (t.dataset.op) { V.setOpacity(t.dataset.op, t.value / 100); t.nextElementSibling.textContent = t.value; }
    });
  }

  /* ---------- tooltip ---------- */
  function sourceLine(el) {
    const g = app.graph;
    if (!g || !el) return '';
    const nm = (b) => { const m = E.blockMeta(g.snap, b); return m ? m.name : b; };
    if (el.cls === 'direct') return nm(el.match.binding) + ' · via ' + el.match.ds;
    if (el.cls === 'label') return nm(el.label.binding) + (el.label.items ? ' · list items' : ' · via ' + el.label.ds);
    if (el.cls === 'computed') return E._opLabel(el.match);
    if (el.cls === 'constant') return el.match.name + ' · line ' + el.match.line;
    if (el.cls === 'axis') return 'Tick generated by the frame';
    return 'No matching value in the data the frame received';
  }
  function bindTooltip() {
    const tip = $('#tip'), stage = $('#stage');
    V.on('hover', (id) => { if (!id) tip.hidden = true; });
    V.on('hovermove', (id, e) => {
      const g = app.graph;
      if (!g) return;
      const el = g.elements.find((x) => x.id === id);
      const n = g.nodes.get(id);
      let h = '';
      if (el) {
        const c = CLS[el.cls];
        h = '<div class="tip-big">' + esc(el.raw || el.text) + '</div><div class="tip-row"><i style="--k:var(' + c.k + ')"></i>' + esc(c.label) + '</div><div>' + esc(sourceLine(el)) + '</div>';
      } else if (n) {
        const title = n.kind === 'block' ? n.meta.name : n.kind === 'ds' ? n.name : n.label || n.name || n.kind;
        const sub = n.kind === 'block' ? n.meta.kind + (n.visible ? ' · on ' + n.visible + ' frame element' + (n.visible > 1 ? 's' : '') : ' · not shown on frame') : n.kind === 'ds' ? 'Data source · ' + n.rows + ' rows · feeds ' + n.elements + ' elements' : '';
        h = '<div class="tip-big">' + esc(title) + '</div>' + (sub ? '<div>' + esc(sub) + '</div>' : '');
      }
      if (!h) { tip.hidden = true; return; }
      tip.innerHTML = h;
      tip.hidden = false;
      const r = stage.getBoundingClientRect();
      let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
      if (x + 320 > r.width) x = e.clientX - r.left - 16 - tip.offsetWidth;
      if (y + tip.offsetHeight > r.height) y = e.clientY - r.top - 16 - tip.offsetHeight;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    });
    V.on('select', () => { renderInspector(); if (app.tab !== 'inspect' && app.tab !== 'claude') setTab('inspect'); });
  }

  /* ---------- inspector ---------- */
  function setTab(tab) {
    app.tab = tab;
    store.set('tab', tab);
    $$('#paneTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('.tab').forEach((t) => { t.hidden = t.dataset.tab !== tab; });
    if (tab === 'tune') renderTune();
    if (tab === 'claude') renderClaude();
    if (tab === 'code') renderCode();
    if (tab === 'inspect') renderInspector();
  }
  function pill(cls) { const c = CLS[cls]; return '<span class="pill" style="--k:var(' + c.k + ')"><i></i>' + esc(c.label) + '</span>'; }
  function fmtRaw(v) { return typeof v === 'number' ? (Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(+v.toPrecision(6))) : String(v); }
  function chainItem(k, kicker, title, detail, id) {
    return '<li class="' + (id ? 'chain-click' : '') + '" style="--k:var(' + k + ')"' + (id ? ' data-goto="' + esc(id) + '"' : '') + '><div class="chain-k">' + esc(kicker) + '</div><div class="chain-t">' + title + '</div>' + (detail ? '<div class="chain-d">' + detail + '</div>' : '') + '</li>';
  }
  function blockChainItems(g, blockId, seen) {
    seen = seen || new Set();
    if (seen.has(blockId)) return '';
    seen.add(blockId);
    const n = g.nodes.get(blockId);
    if (!n) return '';
    const m = n.meta;
    let h = chainItem(GROUP_K[n.group] || '--c-metric', (n.layer === 'upstream' ? 'Upstream ' : 'Pigment ') + m.kind, esc(m.name), m.input ? 'Input metric · no formula' : m.formula ? '<code>' + esc(m.formula) + '</code>' : esc(m.description || ''), blockId);
    g.edges.filter((e) => e.to === blockId && e.type === 'upstream').forEach((e) => { h += blockChainItems(g, e.from, seen); });
    return h;
  }
  function explainMatch(el) {
    const t = el.tok, c = el.match;
    if (!t || !c) return '';
    const scaleWord = t.scale === 1e6 ? ' in millions' : t.scale === 1e3 ? ' in thousands' : t.scale === 1e9 ? ' in billions' : '';
    const pct = el.unit === 'ratio' && t.percent ? ', multiplied by 100' : '';
    return 'Shown as <code>' + esc(t.raw.trim()) + '</code>. Underlying value <code>' + esc(fmtRaw(c.v)) + '</code>' + pct + ', rounded to ' + t.decimals + ' decimal' + (t.decimals === 1 ? '' : 's') + scaleWord + '.';
  }
  function renderInspector() {
    const tab = $('#tabInspect');
    const g = app.graph;
    if (!g) { tab.innerHTML = '<div class="empty"><b>Replaying the frame…</b><span>Lineage appears once the frame has rendered its data.</span></div>'; return; }
    const id = V.selectedId;
    const el = id && g.elements.find((x) => x.id === id);
    const n = id && g.nodes.get(id);
    const primer = S.explain ? S.explain.primer() : '';
    if (el) tab.innerHTML = inspectElement(g, el) + primer;
    else if (n) tab.innerHTML = inspectNode(g, n) + primer;
    else tab.innerHTML = primer + inspectOverview(g);
  }
  function inspectElement(g, el) {
    const nm = (b) => { const m = E.blockMeta(g.snap, b); return m ? m.name : b; };
    let h = '<div class="sec"><div class="sec-title">Selected on frame <button class="btn btn-sm" data-act="clear">Clear</button></div><div class="hero-num">' + esc(el.raw || el.text) + '</div>';
    h += '<div class="ctl-row">' + pill(el.cls) + (el.conf ? '<span class="conf">Confidence <b>' + el.conf + '</b></span>' : '') + '</div>';
    if (el.text !== el.raw && el.raw) h += '<div class="muted small">In “' + esc(el.text) + '”</div>';
    h += '</div><div class="sec"><div class="sec-title">Lineage</div><ol class="chain">';
    h += chainItem(CLS[el.cls].k, 'Frame element', esc(el.raw || el.text), esc(el.rect.tag || '') + (el.group ? ' inside a chart' : ''), null);
    if (el.cls === 'direct') {
      const ds = g.nodes.get('ds:' + el.match.ds);
      const v = ds && ds.def && ds.def.values[el.match.col];
      h += chainItem('--accent-2', 'Data source', '<span class="mono">' + esc(el.match.ds) + '</span>', 'Column ' + esc(nm(el.match.binding)) + (v && v.aggregator ? ' · ' + esc(v.aggregator) : '') + (el.match.rowLabel ? ' · row ' + esc(el.match.rowLabel) : ' · single row') + filtersText(ds), 'ds:' + el.match.ds);
      el.blockIds.forEach((b) => { h += blockChainItems(g, b); });
      h += '</ol></div><div class="sec"><div class="sec-title">How it matched</div><div class="note">' + explainMatch(el) + '</div>';
      if (el.ambiguous && el.alts && el.alts.length) h += '<div class="note"><b>Also matches</b> ' + el.alts.map((a) => esc(nm(a.binding)) + ' in ' + esc(a.ds) + (a.rowLabel ? ' (' + esc(a.rowLabel) + ')' : '')).join(', ') + '. Two blocks hold the same rounded value here, so this pick is a best guess.</div>';
      h += '</div>';
    } else if (el.cls === 'label') {
      const L = el.label;
      h += L.items ? chainItem('--c-list', 'List items', esc(nm(L.items)), 'subscribeToItems(' + esc(L.items) + ')', 'items:' + L.items) : chainItem('--accent-2', 'Data source', '<span class="mono">' + esc(L.ds) + '</span>', 'Row label', 'ds:' + L.ds);
      el.blockIds.forEach((b) => { h += blockChainItems(g, b); });
      h += '</ol></div><div class="note">Matches the item <b>' + esc(L.full) + '</b> of dimension <b>' + esc(nm(L.binding)) + '</b>.</div>';
    } else if (el.cls === 'computed') {
      h += chainItem('--c-logic', 'Computed in frame', esc(E._opLabel(el.match)), '<code>' + esc(el.formula || '') + '</code>', el.nodeId);
      const nd = g.nodes.get(el.nodeId);
      (nd ? nd.dsNames : []).forEach((d) => { h += chainItem('--accent-2', 'Data source', '<span class="mono">' + esc(d) + '</span>', '', 'ds:' + d); });
      el.blockIds.forEach((b) => { h += blockChainItems(g, b); });
      h += '</ol></div><div class="note">This number does not exist in Pigment. The frame code calculates it from the blocks above. If people rely on it, consider a Pigment metric so it is governed, auditable and reusable.</div>';
      if (el.alts && el.alts.length && el.conf !== 'high') h += '<div class="note"><b>Other possible formulas</b><br>' + el.alts.map((a) => esc(E._opLabel(a))).join('<br>') + '</div>';
    } else if (el.cls === 'constant') {
      h += chainItem('--c-const', 'Hardcoded in code', '<span class="mono">' + esc(el.match.name) + ' = ' + esc(el.match.raw) + '</span>', 'Line ' + el.match.line + ' of the frame code', el.nodeId);
      h += '</ol></div><div class="note"><b>Not from Pigment.</b> This value is typed into the frame code, so it will not change when the model changes. Move it into a metric or a variable.</div><button class="btn" data-act="code-line" data-line="' + el.match.line + '">Show line ' + el.match.line + '</button>';
    } else if (el.cls === 'axis') {
      h += chainItem('--c-axis', 'Chart scale', 'Generated tick', 'The frame computed this tick from the data range.', el.nodeId) + '</ol></div>';
    } else {
      h += '</ol></div><div class="note"><b>No match.</b> No value the frame received, no combination of two of them, and no constant in the code rounds to this number. It may come from a calculation this explorer does not try, a date, or text.</div>';
    }
    if (S.explain) h += S.explain.element(g, el);
    h += '<div class="ctl-row"><button class="btn" data-act="show-layers">Show in Layers</button><button class="btn" data-act="ask-el" data-id="' + esc(el.id) + '">Ask Claude about this</button></div>';
    return h;
  }
  function filtersText(ds) {
    if (!ds || !ds.def || !ds.def.selectors || !ds.def.selectors.length) return '';
    return ' · ' + ds.def.selectors.map((s) => { const f = ds.filters.find((x) => x.binding === s.binding); const m = E.blockMeta(app.snap, s.binding); return (m ? m.name : s.binding) + ' = ' + (f && f.selection.length ? f.selection.join(', ') : 'All'); }).join(' · ');
  }
  function inspectNode(g, n) {
    const nm = (b) => { const m = E.blockMeta(g.snap, b); return m ? m.name : b; };
    const fed = [...(V.chainOf(n.id) || [])].map((id) => g.elements.find((e) => e.id === id)).filter(Boolean);
    let h = '<div class="sec"><div class="sec-title">Selected ' + (n.layer === 'blocks' ? 'Pigment block' : n.layer === 'upstream' ? 'upstream block' : 'frame logic') + ' <button class="btn btn-sm" data-act="clear">Clear</button></div>';
    if (n.kind === 'block') {
      const m = n.meta;
      h += '<div class="hero-num">' + esc(m.name) + '</div><div class="ctl-row"><span class="pill" style="--k:var(' + (GROUP_K[n.group] || '--c-metric') + ')"><i></i>' + esc(m.kind) + '</span>' + (m.folder ? '<span class="muted small">' + esc(m.folder) + '</span>' : '') +
        '<span class="xlinks"><button type="button" class="xlink" data-act="xl-pigment" data-key="' + esc(n.key) + '" title="Open this block in Pigment">Pigment ↗</button></span></div></div>';
      if (m.formula || m.input) h += '<div class="sec"><div class="sec-title">Formula' + (m.formula ? '<button type="button" class="xlink" data-act="xl-studio" data-key="' + esc(n.key) + '" title="Step through this formula in Formula Studio">ƒx Formula Studio</button>' : '') + '</div><div class="formula-box">' + (m.input ? 'Input metric. Values are entered, not calculated.' : esc(m.formula)) + '</div></div>';
      const facts = [];
      if (m.dims && m.dims.length) facts.push(['Dimensions', m.dims.join(' × ')]);
      if (m.format) facts.push(['Format', E.describeFormat(m.format)]);
      if (m.aggregator) facts.push(['Default aggregator', m.aggregator]);
      if (n.sample != null) facts.push(['Value in this frame', E.formatPigment(n.sample, m.format) + ' (' + fmtRaw(n.sample) + ')']);
      if (n.binding) facts.push(['Binding', n.binding.name + ' · ' + n.binding.type + (n.binding.can_write ? ' · can write' : '')]);
      if (facts.length) h += '<div class="sec"><div class="sec-title">Details</div>' + facts.map((f) => '<div class="small"><span class="muted">' + esc(f[0]) + '</span><br>' + esc(f[1]) + '</div>').join('') + '</div>';
      const ups = g.edges.filter((e) => e.to === n.id && e.type === 'upstream').map((e) => g.nodes.get(e.from)).filter(Boolean);
      if (ups.length) h += '<div class="sec"><div class="sec-title">Feeds from</div><div class="ctl-row">' + ups.map((u) => '<button class="chipbtn" data-goto="' + esc(u.id) + '">' + esc(u.meta.name) + '</button>').join('') + '</div></div>';
      if (n.layer === 'blocks' && !n.inDataSource) h += '<div class="note"><b>Bound but unused.</b> The frame declares this binding but no data source reads it. Remove it or wire it up.</div>';
      else if (n.layer === 'blocks' && !n.visible && n.group !== 'list') h += '<div class="note"><b>Not visible on the frame.</b> The frame receives this block’s data but no number on screen matches it right now. It may be used for a calculation, hidden by a setting, or unused.</div>';
    } else if (n.kind === 'ds') {
      h += '<div class="hero-num mono" style="font-size:24px">' + esc(n.name) + '</div><div class="muted small">' + n.rows + ' rows delivered' + filtersText(n) + '</div></div>';
      if (n.def) {
        h += '<div class="sec"><div class="sec-title">Definition</div><div class="formula-box">values    ' + n.def.values.map((v) => nm(v.binding) + (v.aggregator ? ' (' + v.aggregator + ')' : '')).join(', ') + '\nlabels    ' + (n.def.labels.map((l) => nm(l.binding)).join(', ') || '—') + '\nselectors ' + ((n.def.selectors || []).map((s) => nm(s.binding)).join(', ') || '—') + '</div></div>';
      } else h += '<div class="note">This data source’s definition is not in the snapshot, so its columns cannot be named.</div>';
      if (!n.exact) h += '<div class="note"><b>Filter not in snapshot.</b> The frame asked for a filter combination the snapshot does not hold, so it is showing unfiltered data.</div>';
      const sub = app.code.subscriptions.filter((s) => s.name === n.name);
      if (sub.length) h += '<button class="btn" data-act="code-line" data-line="' + sub[0].line + '">Show subscription, line ' + sub[0].line + '</button>';
    } else {
      const label = n.kind === 'computed' ? n.label : n.kind === 'constant' ? n.name + ' = ' + n.value : n.kind === 'filter' ? nm(n.binding) + ' = ' + (n.selection.length ? n.selection.join(', ') : 'All') : n.kind === 'items' ? nm(n.alias) : n.kind === 'write' ? n.op + ' → ' + nm(n.target) : 'Chart scale';
      h += '<div class="hero-num" style="font-size:22px">' + esc(label) + '</div></div>';
      if (n.kind === 'computed') h += '<div class="sec"><div class="sec-title">Examples on the frame</div>' + n.examples.slice(0, 6).map((x) => '<div class="formula-box">' + esc(x.text) + '  =  ' + esc(x.formula) + '</div>').join('') + '</div>';
      if (n.kind === 'constant') h += '<button class="btn" data-act="code-line" data-line="' + n.line + '">Show line ' + n.line + '</button>';
      if (n.kind === 'write') h += '<div class="note">The frame can write to <b>' + esc(nm(n.target)) + '</b> with <code class="codebit">' + esc(n.op) + '</code> (line ' + n.line + '). Writes are never sent from this explorer.</div>';
    }
    if (S.explain) h += S.explain.node(g, n);
    if (fed.length) h += '<div class="sec"><div class="sec-title">On the frame <span>' + fed.length + '</span></div>' + ledgerRows(fed.slice(0, 40)) + '</div>';
    h += '<div class="ctl-row"><button class="btn" data-act="show-layers">Show in Layers</button><button class="btn" data-act="ask-node" data-id="' + esc(n.id) + '">Ask Claude about this</button></div>';
    return h;
  }
  function ledgerRows(list) {
    return '<div class="ledger">' + list.map((e) => '<div class="ledger-row' + (e.id === V.selectedId ? ' is-selected' : '') + '" data-goto="' + esc(e.id) + '" style="--k:var(' + CLS[e.cls].k + ')"><i></i><span class="lr-text">' + esc(e.raw || e.text) + '</span><span class="lr-src">' + esc(sourceLine(e)) + '</span></div>').join('') + '</div>';
  }
  function insights(g) {
    const out = [];
    const nm = (b) => { const m = E.blockMeta(g.snap, b); return m ? m.name : b; };
    g.elements.filter((e) => e.cls === 'constant').forEach((e) => out.push(['--c-const', '<b>' + esc(e.raw) + '</b> is hardcoded as <code class="codebit">' + esc(e.match.name) + '</code> on line ' + e.match.line + '. It will not follow the model.', e.id]));
    const comp = [...g.nodes.values()].filter((n) => n.kind === 'computed');
    if (comp.length) out.push(['--c-logic', '<b>' + comp.length + ' calculation' + (comp.length > 1 ? 's' : '') + '</b> live only in the frame code: ' + comp.slice(0, 3).map((c) => esc(c.label)).join('; ') + (comp.length > 3 ? '…' : '') + '.', comp[0].id]);
    g.nodes.forEach((n) => { if (n.layer === 'blocks' && !n.inDataSource) out.push(['--c-untraced', '<b>' + esc(n.meta.name) + '</b> is bound but no data source reads it.', n.id]); });
    const unseen = [...g.nodes.values()].filter((n) => n.layer === 'blocks' && n.inDataSource && !n.visible && n.group !== 'list');
    if (unseen.length) out.push(['--c-var', '<b>' + unseen.map((n) => esc(n.meta.name)).join(', ') + '</b> ' + (unseen.length > 1 ? 'are' : 'is') + ' fetched but not shown with the current settings.', unseen[0].id]);
    const amb = g.elements.filter((e) => e.ambiguous);
    if (amb.length) out.push(['--c-metric', '<b>' + amb.length + ' number' + (amb.length > 1 ? 's' : '') + '</b> match more than one block after rounding. Check them before relying on the trace.', amb[0].id]);
    const untr = g.elements.filter((e) => e.cls === 'untraced');
    if (untr.length) out.push(['--c-untraced', '<b>' + untr.length + ' number' + (untr.length > 1 ? 's' : '') + '</b> could not be traced: ' + untr.slice(0, 4).map((e) => esc(e.raw)).join(', ') + '.', untr[0].id]);
    g.nodes.forEach((n) => { if (n.kind === 'ds' && !n.exact) out.push(['--c-var', 'Data source <b>' + esc(n.name) + '</b> asked for a filter the snapshot does not hold.', n.id]); });
    g.nodes.forEach((n) => { if (n.kind === 'write') out.push(['--c-var', 'The frame can write to <b>' + esc(nm(n.target)) + '</b> (' + esc(n.op) + ').', n.id]); });
    if (app.host.legacy.length) out.push(['--c-untraced', 'Uses the legacy View subscription (' + app.host.legacy.map(esc).join(', ') + '). Migrate it to data sources.', null]);
    return out;
  }
  function inspectOverview(g) {
    const c = g.stats.counts, tot = Math.max(1, g.stats.numbers);
    const seg = (k, n) => (n ? '<span style="--k:var(' + k + ');width:' + (n / tot) * 100 + '%"></span>' : '');
    let h = '<div class="sec"><div class="sec-title">Lineage coverage</div><div class="cov"><span class="hero-num">' + Math.round(g.stats.coverage * 100) + '%</span><span class="muted">of ' + g.stats.numbers + ' numbers on this frame trace back to Pigment blocks</span></div>';
    h += '<div class="bar">' + seg('--c-metric', c.direct) + seg('--c-logic', c.computed) + seg('--c-const', c.constant) + seg('--c-untraced', c.untraced) + '</div>';
    h += '<div class="small muted">' + [c.direct + ' straight from blocks', c.computed + ' computed in the frame', c.constant + ' hardcoded', c.untraced + ' not traced'].join(' · ') + '</div></div>';
    const ins = insights(g);
    if (ins.length) h += '<div class="sec"><div class="sec-title">Findings</div>' + ins.map((x) => '<div class="note' + (x[2] ? ' chain-click' : '') + '"' + (x[2] ? ' data-goto="' + esc(x[2]) + '"' : '') + ' style="border-left:3px solid var(' + x[0] + ')">' + x[1] + '</div>').join('') + '</div>';
    const order = ['direct', 'computed', 'constant', 'untraced', 'label', 'axis'];
    const els = g.elements.filter((e) => e.cls !== 'zero').sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || a.rect.y - b.rect.y || a.rect.x - b.rect.x);
    h += '<div class="sec"><div class="sec-title">Everything on the frame <span>' + els.length + '</span></div>' + ledgerRows(els) + '</div>';
    return h;
  }
  function bindInspector() {
    $('#pane').addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) { V.select(go.dataset.goto); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'xl-studio' || act === 'xl-pigment') { crossLink(act === 'xl-studio' ? 'formula-studio' : 'pigment', b.dataset.key); return; }
      if (act === 'clear') V.select(null);
      if (act === 'show-layers') setMode('layers');
      if (act === 'code-line') { setTab('code'); setTimeout(() => { const l = $('#code-l' + b.dataset.line); if (l) { l.scrollIntoView({ block: 'center' }); l.classList.remove('is-flash'); void l.offsetWidth; l.classList.add('is-flash'); } }, 30); }
      if (act === 'ask-el' || act === 'ask-node') { setTab('claude'); const ta = $('#chatInput'); if (ta) { ta.value = 'Explain where [' + b.dataset.id + '] comes from and whether I can trust it.'; ta.focus(); } }
    });
  }

  /* ---------- code tab ---------- */
  function renderCode() {
    const tab = $('#tabCode');
    if (!app.snap) return;
    const code = String(app.snap.code || '');
    const lines = code.split('\n');
    const marks = {};
    app.code.subscriptions.forEach((s) => { marks[s.line] = 'hl-sub'; });
    app.code.items.forEach((s) => { marks[s.line] = 'hl-items'; });
    app.code.writes.forEach((s) => { marks[s.line] = 'hl-write'; });
    app.code.constants.forEach((s) => { marks[s.line] = 'hl-const'; });
    const a = app.code;
    let h = '<div class="sec"><div class="sec-title">Frame code <span>' + a.lines + ' lines · ' + Math.round(a.bytes / 1024) + ' KB</span></div>';
    h += '<div class="small muted">' + a.subscriptions.length + ' data-source subscriptions · ' + a.items.length + ' list subscriptions · ' + a.constants.length + ' numeric constants · ' + a.writes.length + ' write-backs' + (a.tunable ? ' · responds to Tune' : '') + '</div>';
    h += '<div class="ctl-row"><button class="btn btn-sm" data-act="copy-code">Copy code</button>' + (app.caps.downloads ? '<button class="btn btn-sm" data-act="dl-code">Download .js</button>' : '') + '</div></div>';
    h += '<div class="code">' + lines.map((l, i) => '<div class="code-line ' + (marks[i + 1] || '') + '" id="code-l' + (i + 1) + '"><span class="ln">' + (i + 1) + '</span><span class="lc">' + esc(l.length > 400 ? l.slice(0, 400) + ' …' : l) + '</span></div>').join('') + '</div>';
    tab.innerHTML = h;
  }

  /* ---------- tune tab ---------- */
  const TUNE_SLIDERS = [
    { key: 'color', name: 'Color', lo: 'Monochrome', hi: 'Expressive' },
    { key: 'detail', name: 'Detail', lo: 'Concise', hi: 'Detailed' },
    { key: 'horizon', name: 'Time horizon', lo: 'Historical', hi: 'Forward-looking' },
  ];
  /* The full control set, grouped the way the Lumina frame's Tune groups them. TUNE_SLIDERS stays the short list the in-frame kit shows. */
  const TUNE_GROUPS = [
    { name: 'Style', items: [TUNE_SLIDERS[0], { key: 'emphasis', name: 'Emphasis', lo: 'Calm', hi: 'Bold' }] },
    { name: 'Scope', items: [TUNE_SLIDERS[1]] },
    { name: 'Nature of the data', items: [TUNE_SLIDERS[2], { key: 'certainty', name: 'Certainty', lo: 'Single number', hi: 'Range' }] },
    { name: 'Look', items: [{ key: 'round', name: 'Corners', lo: 'Square', hi: 'Soft' }, { key: 'depth', name: 'Depth', lo: 'Flat', hi: 'Lifted' }, { key: 'space', name: 'Spacing', lo: 'Tight', hi: 'Airy' }] },
    { name: 'Numbers', items: [{ key: 'precision', name: 'Precision', lo: 'Rounded', hi: 'Precise' }, { key: 'alert', name: 'Alert threshold', lo: 'Flag every change', hi: 'Only big ones' }] },
  ];
  const TUNE_KEYS = TUNE_GROUPS.reduce((a, g) => a.concat(g.items.map((i) => i.key)), []).concat(['specificity', 'audience']);
  const TUNE_SECTIONS = [{ key: 'kpis', name: 'KPI row' }, { key: 'chart', name: 'Chart' }, { key: 'table', name: 'Table' }, { key: 'pipeline', name: 'Pipeline' }];
  const TUNE_PRESETS = [
    { name: 'Board pack', sub: 'Executive, abstract, concise', t: { color: 0.55, detail: 0.15, horizon: 0.5, specificity: 0.2, audience: 0.1, emphasis: 0.8, certainty: 0, precision: 0.2, alert: 0.3, depth: 0.6, space: 0.7 } },
    { name: 'Ops review', sub: 'Operator, specific, detailed', t: { color: 0.45, detail: 0.9, horizon: 0.5, specificity: 0.85, audience: 0.9, emphasis: 0.3, certainty: 0, precision: 0.8, alert: 0, depth: 0.4, space: 0.25 } },
    { name: 'Forecast call', sub: 'Forward-looking, with a range', t: { color: 0.75, detail: 0.5, horizon: 0.95, specificity: 0.4, audience: 0.25, emphasis: 0.6, certainty: 0.8, precision: 0.5, alert: 0.2, depth: 0.5, space: 0.5 } },
    { name: 'Audit mode', sub: 'Plain, flat, precise', t: { color: 0.1, detail: 0.85, horizon: 0.2, specificity: 0.95, audience: 0.7, emphasis: 0.2, certainty: 0, precision: 0.95, alert: 0, depth: 0.05, round: 0.1, space: 0.35 } },
  ];
  /* What each control is doing right now, in plain words. */
  function tuneSays(k, v) {
    const b = v < 0.34 ? 0 : v < 0.67 ? 1 : 2, pc = Math.round(v * 10);
    const T = {
      color: ['Greys, with colour only where it matters', 'Brand colour on the main series', 'Full palette and gradient surfaces'],
      emphasis: ['Quiet figures and thin lines', 'Standard weight', 'Large key figures and heavier lines'],
      detail: ['Headline numbers only', 'Labels on the key points', 'Every label, column and footnote'],
      horizon: ['Actuals only, looking back', 'Actuals with plan alongside', 'Forecast to year end shown'],
      certainty: ['One number per month', 'A light range on forecast months', 'A wide range on forecast months'],
      round: ['Square cards', 'Gently rounded cards', 'Soft, pill-like cards'],
      depth: ['Flat cards on the page', 'A soft shadow', 'Cards lifted off the page'],
      space: ['Tight: more on screen', 'Balanced spacing', 'Airy: room to breathe'],
      precision: ['Whole numbers ($12M)', 'One decimal ($12.3M)', 'Two decimals ($12.34M)'],
      alert: [pc ? 'Changes over ' + pc + '% are coloured' : 'Every change is coloured green or red', 'Only changes over ' + pc + '% are coloured', 'Only changes over ' + pc + '% are coloured; the rest stay grey'],
    };
    return (T[k] || [])[b] || '';
  }
  /* Undo and redo across tuning changes, and a glide so you can see what moved. */
  const TH = { past: [], future: [] };
  const tuneSnap = () => JSON.stringify(app.tuning);
  function tunePush() { const sn = tuneSnap(); if (TH.past[TH.past.length - 1] === sn) return; TH.past.push(sn); if (TH.past.length > 40) TH.past.shift(); TH.future = []; }
  function tuneApply(t, quiet) { app.tuning = freshTuning(typeof t === 'string' ? JSON.parse(t) : t); pushTuning(); if (!quiet) renderTune(); }
  function tuneUndo() { if (!TH.past.length) return; TH.future.push(tuneSnap()); tuneApply(TH.past.pop()); }
  function tuneRedo() { if (!TH.future.length) return; TH.past.push(tuneSnap()); tuneApply(TH.future.pop()); }
  function tuneDirty() { return !!app.savedTuning && JSON.stringify(freshTuning(app.savedTuning)) !== tuneSnap(); }
  let glideTimers = [];
  function tuneGlide(target, why) {
    tunePush();
    glideTimers.forEach(clearTimeout); glideTimers = [];
    const from = JSON.parse(tuneSnap()), keys = Object.keys(target).filter((k) => TUNE_KEYS.indexOf(k) >= 0);
    ['headline', 'hide', 'highlights'].forEach((k) => { if (target[k] != null) app.tuning[k] = Array.isArray(target[k]) ? target[k].slice() : target[k]; });
    const n = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 12;
    app.tuneWhy = why || ''; app.tuneMsg = '';
    for (let i = 1; i <= n; i++) glideTimers.push(setTimeout(() => {
      const e = i / n, sm = e * e * (3 - 2 * e);
      keys.forEach((k) => { app.tuning[k] = (+from[k] || 0) + (+target[k] - (+from[k] || 0)) * sm; });
      if (i === n) { pushTuning(); renderTune(); } else { pushTuning(); paintTuneLive(); }
    }, i * 40));
  }
  function paintTuneLive() {
    $$('#tabTune [data-tune]').forEach((inp) => { const k = inp.dataset.tune, v = Math.round((app.tuning[k] || 0) * 100); inp.value = v; paintRange(inp); const o = $('#tune-' + k + 'Out'); if (o) o.textContent = v; const sy = $('#tune-' + k + 'Says'); if (sy) sy.textContent = tuneSays(k, app.tuning[k] || 0); });
    const pad = $('#pad'); if (pad) { pad.style.setProperty('--px', app.tuning.specificity * 100 + '%'); pad.style.setProperty('--py', app.tuning.audience * 100 + '%'); }
  }
  /* Describe it: plain words become control positions. Claude reads them where the host allows; keywords otherwise. */
  const TUNE_WORDS = [
    [/calm|quiet|minimal|simple|clean|understated/, { emphasis: 0.2, color: 0.3, depth: 0.15 }, 'calmer'], [/bold|punchy|vivid|loud|striking/, { emphasis: 0.9, color: 0.8, depth: 0.65 }, 'bolder'],
    [/monochrome|grey|gray|black and white|no colou?r/, { color: 0.05 }, 'monochrome'], [/colou?rful|expressive|bright/, { color: 0.9 }, 'more colour'],
    [/concise|summary|executive|board|headline|glance/, { detail: 0.15, audience: 0.1 }, 'concise'], [/detail|granular|every label|analyst|operator|deep/, { detail: 0.9, audience: 0.85 }, 'detailed'],
    [/forecast|forward|future|outlook|year.?end|land/, { horizon: 0.9 }, 'forward-looking'], [/histor|actuals|past|backward/, { horizon: 0.15 }, 'historical'],
    [/range|uncertain|confidence|scenario|spread/, { certainty: 0.85, horizon: 0.9 }, 'show the range'], [/single number|point estimate/, { certainty: 0 }, 'single numbers'],
    [/round(ed)? corner|soft|friendly/, { round: 0.9 }, 'softer corners'], [/square|sharp|crisp/, { round: 0.05 }, 'square corners'],
    [/flat|print|paper/, { depth: 0.05 }, 'flat'], [/lift|shadow|depth|3d/, { depth: 0.85 }, 'lifted'],
    [/tight|dense|compact|more on screen/, { space: 0.1 }, 'tighter'], [/airy|spacious|breathe|roomy/, { space: 0.9 }, 'airier'],
    [/precise|decimals|exact figures/, { precision: 0.9 }, 'more decimals'], [/whole numbers|round numbers|rounded numbers|no decimals/, { precision: 0.1 }, 'rounded numbers'],
    [/only big|big misses|ignore small|less red|noise/, { alert: 0.6 }, 'flag only big changes'], [/every miss|every change|all changes|strict/, { alert: 0 }, 'flag every change'],
  ];
  function tuneByWords(text) {
    const s = text.toLowerCase(), out = {}, why = [];
    TUNE_WORDS.forEach((w) => { if (w[0].test(s)) { Object.assign(out, w[1]); why.push(w[2]); } });
    let hide = app.tuning.hide.slice(), touched = false;
    TUNE_SECTIONS.forEach((x) => {
      const nm = x.key === 'kpis' ? '(kpis?|cards?|tiles?)' : x.key === 'chart' ? '(chart|graph|bars?)' : x.key === 'table' ? '(table|grid|segments?)' : '(pipeline|coverage)';
      if (new RegExp('(hide|remove|drop|without|no) (the )?' + nm).test(s) && hide.indexOf(x.key) < 0) { hide.push(x.key); touched = true; why.push('hide ' + x.name.toLowerCase()); }
      if (new RegExp('(show|add|bring back|with) (the )?' + nm).test(s) && hide.indexOf(x.key) >= 0) { hide = hide.filter((k) => k !== x.key); touched = true; why.push('show ' + x.name.toLowerCase()); }
    });
    if (touched) out.hide = hide;
    const hl = /(?:headline|title)\s*[:=]?\s*["“](.+?)["”]/.exec(text); if (hl) { out.headline = hl[1].slice(0, 60); why.push('new headline'); }
    return { set: out, why: why.length ? 'Read as: ' + why.join(', ') + '.' : '' };
  }
  async function tuneDescribe() {
    const box = $('#tuneDesc'), text = box && box.value.trim(), msg = $('#tuneDescMsg');
    if (!text) return;
    const words = () => { const w = tuneByWords(text); if (Object.keys(w.set).length) tuneGlide(w.set, w.why); else if (msg) msg.textContent = 'No match. Try words like calmer, bolder, forecast, range, airy, hide the table or more decimals.'; };
    if (!app.caps.sample) { words(); return; }
    if (msg) msg.textContent = 'Claude is reading that…';
    const spec = TUNE_GROUPS.reduce((a, g) => a.concat(g.items), []).concat(KIT_SETTINGS().slice(-2)).map((d) => d.key + ' (' + d.name + ': 0 = ' + d.lo + ', 1 = ' + d.hi + ', now ' + (+app.tuning[d.key] || 0).toFixed(2) + ')').join('\n');
    const prompt = 'Turn a request about how a finance dashboard should look into control settings.\nControls (0 to 1):\n' + spec + '\nSections that can be hidden: ' + TUNE_SECTIONS.map((x) => x.key).join(', ') + ' (hidden now: ' + (app.tuning.hide.join(', ') || 'none') + ').\nRequest: ' + text + '\nChange only what the request implies. Reply with JSON only: {"set": {"<control key>": number, "hide": ["<section key>"] (optional, the full list to hide), "headline": "..." (optional)}, "why": "one sentence on what you changed and why"}';
    try {
      const { text: reply } = await app.caps.sample(prompt, { cache: false });
      const m = reply.match(/\{[\s\S]*\}/), a = m ? JSON.parse(m[0]) : {}, set = a.set || {}, clean = {};
      Object.keys(set).forEach((k) => { if (TUNE_KEYS.indexOf(k) >= 0 && isFinite(+set[k])) clean[k] = Math.max(0, Math.min(1, +set[k])); });
      if (Array.isArray(set.hide)) clean.hide = set.hide.filter((k) => TUNE_SECTIONS.some((x) => x.key === k));
      if (typeof set.headline === 'string') clean.headline = set.headline.slice(0, 60);
      if (!Object.keys(clean).length) throw new Error('nothing to change');
      tuneGlide(clean, String(a.why || '').slice(0, 200));
    } catch (e) { words(); }
  }
  /* Saved defaults: with the frame in the shared store for every viewer (editors), otherwise on this device. */
  const tuneDoc = (key) => 'frames/' + key + '/settings/tuning';
  function initTuningFor(key) {
    TH.past = []; TH.future = []; app.tuneWhy = ''; app.tuneMsg = '';
    const local = store.get('tuning:' + key, null);
    app.savedTuning = local; app.savedScope = local ? 'me' : null;
    app.tuning = freshTuning(local);
    loadSharedTuning(key);
  }
  async function loadSharedTuning(key) {
    const db = app.caps.db;
    if (!db) return;
    try {
      const d = await db.doc(tuneDoc(key)).get();
      const x = d && (typeof d.data === 'function' ? d.data() : d.data);
      if (!x || !x.tuning || app.tuneKey !== key) return;
      const untouched = !TH.past.length && (!app.savedTuning || !tuneDirty());
      // a default saved on this device stays the viewer's own; otherwise the shared one applies
      if (app.savedScope !== 'me') { app.savedTuning = x.tuning; app.savedScope = 'everyone'; if (untouched) { app.tuning = freshTuning(x.tuning); pushTuning(); } }
      if (app.tab === 'tune') renderTune();
    } catch (e) {}
  }
  async function saveTuning() {
    const key = app.snap.key, t = JSON.parse(tuneSnap());
    const db = app.caps.db, canShare = !!db && app.canEdit !== false;
    if (canShare) {
      try {
        await db.doc(tuneDoc(key)).set({ tuning: t, at: Date.now(), by: app.userId || null });
        store.set('tuning:' + key, null);
        app.savedTuning = t; app.savedScope = 'everyone'; app.tuneMsg = 'Saved as the default for everyone who opens this frame.';
        renderTune(); return;
      } catch (e) { /* fall through to this device */ }
    }
    store.set('tuning:' + key, t);
    app.savedTuning = t; app.savedScope = 'me';
    app.tuneMsg = canShare ? 'The shared store refused the save, so these settings are kept on this device.' : 'Saved on this device. Editors of the published artifact can save for everyone.';
    renderTune();
  }
  async function clearSavedTuning() {
    const key = app.snap.key;
    store.set('tuning:' + key, null);
    if (app.savedScope === 'everyone' && app.caps.db && app.canEdit !== false) { try { await app.caps.db.doc(tuneDoc(key)).set({ tuning: null, at: Date.now(), by: app.userId || null }); } catch (e) {} }
    tunePush();
    app.savedTuning = null; app.savedScope = null; app.tuneMsg = 'Saved default cleared.';
    tuneApply(freshTuning());
  }
  function bindCompare2() {
    const tc = $('#tuneCompare');
    if (!tc) return;
    let held = null;
    const down = (e) => { if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return; if (held) return; held = tuneSnap(); app.tuning = freshTuning(app.savedTuning); pushTuning(); paintTuneLive(); tc.setAttribute('aria-pressed', 'true'); };
    const up = () => { if (!held) return; app.tuning = freshTuning(JSON.parse(held)); held = null; pushTuning(); paintTuneLive(); tc.setAttribute('aria-pressed', 'false'); };
    tc.addEventListener('pointerdown', down); tc.addEventListener('pointerup', up); tc.addEventListener('pointerleave', up); tc.addEventListener('pointercancel', up);
    tc.addEventListener('keydown', down); tc.addEventListener('keyup', up); tc.addEventListener('blur', up);
  }
  function renderTune() {
    const tab = $('#tabTune');
    if (!app.snap) return;
    const t = app.tuning;
    const live = app.code && app.code.tunable;
    const seToggle = '<div class="sec se-sec"><div class="se-toggle-row"><div><div class="sec-title">In-frame editing</div><div class="small muted">Put an edit pane inside the frame itself, using only what a real Pigment Frame can do.</div></div>' +
      '<button type="button" class="switch" role="switch" data-act="se-toggle" aria-checked="' + app.selfEdit + '" aria-label="In-frame editing"><i></i></button></div></div>';
    if (app.selfEdit) { tab.innerHTML = seToggle + selfEditHtml(); return; }
    const st = app.tuneMsg || '';
    let h = seToggle + '<div class="sec"><div class="sec-title">Shape this frame</div><div class="note">' + (live
      ? '<b>Live.</b> This frame listens to these controls, so it redraws as you move them, and lineage updates with it. Save to make the result the default; use <b>Make it permanent</b> to have Claude write it into the frame code.'
      : '<b>Not live for this frame.</b> Move the controls, then let Claude rewrite the frame code to match. The result is saved as a new version you can compare.') + '</div></div>';
    h += '<div class="sec"><div class="tune-desc"><textarea id="tuneDesc" rows="2" placeholder="Describe it: calmer, forecast with a range, hide the table, more decimals…" aria-label="Describe how the frame should look"></textarea><button class="btn btn-primary" data-act="tune-describe">Apply</button></div><div class="small muted" id="tuneDescMsg">' + esc(app.tuneWhy || '') + '</div>' +
      '<div class="ctl-row"><button class="chipbtn" data-act="tune-undo"' + (TH.past.length ? '' : ' disabled') + '>↶ Undo</button><button class="chipbtn" data-act="tune-redo"' + (TH.future.length ? '' : ' disabled') + '>↷ Redo</button><button class="chipbtn" id="tuneCompare" type="button" title="Hold to see the saved default, release to come back">Hold to compare with ' + (app.savedTuning ? 'saved' : 'default') + '</button></div></div>';
    h += '<div class="sec"><div class="sec-title">Presets</div><div class="presets">' + TUNE_PRESETS.map((p, i) => '<button type="button" data-preset="' + i + '"><b>' + esc(p.name) + '</b><span>' + esc(p.sub) + '</span></button>').join('') + '</div></div>';
    TUNE_GROUPS.forEach((g) => {
      h += '<div class="sec"><div class="sec-title">' + g.name + '</div>' + g.items.map((s) => { const v = Math.round((t[s.key] || 0) * 100); return '<div class="tune-row"><label class="tune-name" for="tune-' + s.key + '">' + s.name + '<small id="tune-' + s.key + 'Out">' + v + '</small></label><input type="range" id="tune-' + s.key + '" data-tune="' + s.key + '" min="0" max="100" value="' + v + '"><div class="tune-ends"><span>' + s.lo + '</span><span>' + s.hi + '</span></div><div class="tune-says" id="tune-' + s.key + 'Says">' + esc(tuneSays(s.key, t[s.key] || 0)) + '</div></div>'; }).join('') + '</div>';
    });
    h += '<div class="sec"><div class="sec-title">Audience <span class="mono" id="padOut">' + padText(t) + '</span></div><div class="pad" id="pad" style="--px:' + t.specificity * 100 + '%;--py:' + t.audience * 100 + '%"><span class="pad-lab t">Executive</span><span class="pad-lab b">Operator</span><span class="pad-lab l">Abstract</span><span class="pad-lab r">Specific</span><span class="pad-corner tl">Narrative<br>headline</span><span class="pad-corner tr">Precise<br>summary</span><span class="pad-corner bl">Working<br>overview</span><span class="pad-corner br">Full<br>detail</span><div class="pad-dot"></div></div><div class="small muted">Drag the point. Across: how abstract or specific the numbers are. Down: who reads it.</div></div>';
    if (live) {
      h += '<div class="sec"><div class="sec-title">Sections</div><div class="member-chips">' + TUNE_SECTIONS.map((x) => '<button type="button" class="chipbtn" data-section="' + x.key + '" aria-pressed="' + (t.hide.indexOf(x.key) < 0) + '" title="' + (t.hide.indexOf(x.key) < 0 ? 'Shown. Click to hide.' : 'Hidden. Click to show.') + '">' + esc(x.name) + '</button>').join('') + '</div><div class="small muted">Switch a part of the frame off without touching its code. A frame only hides the sections it knows by these names.</div></div>';
      h += '<div class="sec"><label class="sec-title" for="tuneHeadline">Headline</label><input type="text" class="tune-text" id="tuneHeadline" maxlength="60" value="' + esc(t.headline || '') + '" placeholder="' + esc(app.snap.frame.name || 'Frame title') + '"><div class="small muted">Leave empty to keep the frame’s own title.</div></div>';
    }
    h += '<div class="sec" id="tuneMembers">' + membersHtml() + '</div>';
    const canShare = !!app.caps.db && app.canEdit !== false;
    h += '<div class="sec"><div class="ctl-row"><button class="btn btn-primary" data-act="tune-save">' + (canShare ? 'Save as everyone’s default' : 'Save as my default') + '</button><button class="btn" data-act="tune-reset" title="' + (app.savedTuning ? 'Back to the saved default' : 'Back to the neutral settings') + '">Reset</button>' + (app.savedTuning ? '<button class="btn" data-act="tune-factory" title="Forget the saved default and return every control to neutral">Clear saved</button>' : '') + '</div>' +
      '<div class="small muted" id="tuneSaveMsg">' + esc(st || (app.savedTuning ? (tuneDirty() ? 'Changed since the saved default' + (app.savedScope === 'everyone' ? ' (shared with everyone).' : ' (on this device).') : 'Matches the saved default' + (app.savedScope === 'everyone' ? ', shared with everyone.' : ' on this device.')) : canShare ? 'Nothing saved yet. Saving stores these settings with the frame for every viewer.' : 'Nothing saved yet. Saving keeps these settings on this device; editors of the published artifact can save for everyone.')) + '</div></div>';
    h += '<div class="sec"><div class="ctl-row"><button class="btn" data-act="tune-claude"' + (app.caps.sample ? '' : ' disabled title="Claude is not available in this view"') + '>' + (live ? 'Make it permanent with Claude' : 'Rewrite with Claude') + '</button></div><div class="small muted" id="tuneStatus">' + (app.caps.sample ? '' : 'Claude rewrites need the published artifact with Claude access.') + '</div></div>';
    const keepDesc = $('#tuneDesc') ? $('#tuneDesc').value : '';
    tab.innerHTML = h;
    if (keepDesc && $('#tuneDesc')) $('#tuneDesc').value = keepDesc;
    $$('input[type="range"]', tab).forEach(paintRange);
    bindPad();
    bindCompare2();
  }
  function selfEditHtml() {
    const b = app.seBuilt;
    if (!b) return '<div class="sec"><div class="note">Loading the frame…</div></div>';
    const cfg = b.cfg;
    let h = '<div class="sec"><div class="note"><b>On.</b> The frame now has an <b>Edit frame</b> button at its top right. Its pane changes the frame from the inside, and <b>Apply</b> saves through the Pigment SDK, the same calls a published frame would make. Here the writes are simulated, so you can see the result without touching your workspace.</div></div>';
    h += '<div class="sec"><div class="sec-title">What the pane can change</div><ul class="se-list">' +
      (cfg.display ? '<li><b>Display settings</b><span>Colour, detail, time horizon, specificity, audience and spotlighted members. Saved to a FRAME_CONFIG text metric that the frame reads back.</span></li>' : '<li><b>Display settings</b><span>Not available: this frame\'s code does not read tuning settings yet. Ask Claude to make it tunable.</span></li>') +
      (cfg.inputs.length ? cfg.inputs.map((i) => '<li><b>Planning inputs</b><span>' + esc(i.name) + ' by ' + esc(i.labelName) + (i.selector ? ' for one ' + esc(i.selectorName) + ' at a time' : '') + ', written with editValue. The chart redraws from its own data.</span></li>').join('') : '<li><b>Planning inputs</b><span>None: no input metric is bound to this frame.</span></li>') +
      '<li><b>Change requests</b><span>Layout or chart changes. A frame cannot rewrite its own code, so the request is saved to a Frame Change Requests list for Claude to build.</span></li></ul></div>';
    h += '<div class="sec"><div class="sec-title">Writes from the frame <span class="mono">' + app.seLog.length + '</span></div>' +
      (app.seLog.length ? '<ol class="se-log">' + app.seLog.slice(0, 12).map((e) => '<li><code class="codebit">' + esc(e.op) + '</code> ' + esc(seWriteText(e)) + '<span class="muted">' + new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '</span></li>').join('') + '</ol>' : '<div class="small muted">Nothing yet. Open the pane in the frame, change something and click Apply.</div>') + '</div>';
    h += '<div class="sec"><div class="sec-title">Change requests from the frame</div>' + (app.seRequests.length ? app.seRequests.map((r, i) => '<div class="se-req"><div>' + esc(r.text) + '</div><div class="ctl-row"><span class="small muted">' + (r.status === 'built' ? 'Built as a new version' : 'Queued') + '</span><button class="btn btn-sm btn-primary" type="button" data-act="se-build" data-req="' + i + '"' + (app.caps.sample ? '' : ' disabled title="Claude is not available in this view"') + '>Build it with Claude</button></div></div>').join('') : '<div class="small muted">Requests typed into the frame\'s “Request a change” tab land here.</div>') + '<div class="small muted" id="tuneStatus"></div></div>';
    h += '<div class="sec"><div class="sec-title">Take it to Pigment</div><div class="small muted">The frame file below is the kit plus this frame\'s code. The setup lists the blocks to create and the bindings to send with update_frame.</div><div class="ctl-row" style="flex-wrap:wrap"><button class="btn btn-sm" type="button" data-act="se-copy-code">Copy frame code</button><button class="btn btn-sm" type="button" data-act="se-copy-setup">Copy setup for Claude</button>' + (app.caps.downloads ? '<button class="btn btn-sm" type="button" data-act="se-download">Download .js</button>' : '') + '</div>' +
      '<details class="se-details"><summary>Blocks and bindings</summary><ul class="se-list">' + S.selfEdit.exportSpec(app.snap, b).blocks.map((x) => '<li><span>' + esc(x) + '</span></li>').join('') + '</ul></details></div>';
    return h;
  }
  function padText(t) { return (t.audience < 0.5 ? 'Executive' : 'Operator') + ' · ' + (t.specificity < 0.5 ? 'abstract' : 'specific'); }
  function membersHtml() {
    const s = app.snap;
    const lists = Object.keys(s.items || {}).filter((k) => (s.items[k] || []).length && s.items[k].length <= 40);
    if (!lists.length) return '';
    const hl = new Set(app.tuning.highlights);
    return '<div class="sec-title">Spotlight members <button class="btn btn-sm" data-act="spot-clear">Clear</button></div>' + lists.map((k) => {
      const m = E.blockMeta(s, k);
      return '<div class="member-group"><span class="small muted">' + esc(m ? m.name : k) + '</span><div class="member-chips">' + s.items[k].map((it) => '<button type="button" class="chipbtn" data-member="' + esc(it) + '" aria-pressed="' + hl.has(it) + '">' + esc(it) + '</button>').join('') + '</div></div>';
    }).join('') + '<div class="small muted">Spotlighted members glow wherever they or their numbers appear, in every view.</div>';
  }
  function renderTuneMembersOnly() { const el = $('#tuneMembers'); if (el) el.innerHTML = membersHtml(); }
  let tuneTimer = null;
  function pushTuning() {
    clearTimeout(tuneTimer);
    tuneTimer = setTimeout(() => { if (app.code.tunable) app.host.setTuning(app.tuning); applySpotlight(); }, 40);
  }
  function applySpotlight() {
    const g = app.graph;
    if (!g) return;
    const hl = app.tuning.highlights;
    if (!hl.length) { V.spotlight([]); return; }
    const ids = g.elements.filter((e) => (e.cls === 'label' && hl.includes(e.label.full)) || (e.match && e.match.rowLabel && hl.some((m) => e.match.rowLabel.split(' · ').includes(m))) || (e.match && e.match.inputs && e.match.inputs.some((i) => i.row != null && hl.some((m) => rowLabelOf(i) === m)))).map((e) => e.id);
    V.spotlight(ids);
  }
  function rowLabelOf(inp) {
    const d = app.graph.active.find((a) => a.name === inp.ds);
    const r = d && d.data && d.data.rows[inp.row];
    return r ? r.labels.filter((l) => typeof l === 'string').join(' · ') : '';
  }
  function bindPad() {
    const pad = $('#pad');
    if (!pad) return;
    let on = false;
    const setFrom = (e) => {
      const r = pad.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      app.tuning.specificity = x; app.tuning.audience = y;
      pad.style.setProperty('--px', x * 100 + '%'); pad.style.setProperty('--py', y * 100 + '%');
      $('#padOut').textContent = padText(app.tuning);
      pushTuning();
    };
    pad.addEventListener('pointerdown', (e) => { on = true; try { pad.setPointerCapture(e.pointerId); } catch (err) {} setFrom(e); });
    pad.addEventListener('pointermove', (e) => { if (on) setFrom(e); });
    pad.addEventListener('pointerup', () => { on = false; });
  }
  function bindTune() {
    const tab = $('#tabTune');
    tab.addEventListener('input', (e) => {
      const k = e.target.dataset.tune;
      if (!k) return;
      paintRange(e.target);
      app.tuning[k] = e.target.value / 100;
      $('#tune-' + k + 'Out').textContent = e.target.value;
      const sy = $('#tune-' + k + 'Says'); if (sy) sy.textContent = tuneSays(k, app.tuning[k]);
      const sm = $('#tuneSaveMsg'); if (sm && app.savedTuning) sm.textContent = 'Changed since the saved default.';
      pushTuning();
    });
    // one undo step per drag or per typed headline, taken before the first change
    tab.addEventListener('pointerdown', (e) => { if (e.target.matches && e.target.matches('input[data-tune], #pad, #pad *')) tunePush(); }, true);
    tab.addEventListener('keydown', (e) => {
      if (e.target.matches && e.target.matches('input[data-tune]') && /^Arrow|^Page|^Home$|^End$/.test(e.key)) tunePush();
      if (e.target.id === 'tuneDesc' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); tuneDescribe(); }
    }, true);
    tab.addEventListener('focusin', (e) => { if (e.target.id === 'tuneHeadline') tunePush(); });
    tab.addEventListener('pointerup', renderTuneHistory);
    tab.addEventListener('change', (e) => { if (e.target.id === 'tuneHeadline') { app.tuning.headline = e.target.value.trim().slice(0, 60); pushTuning(); } if (e.target.dataset && e.target.dataset.tune) renderTuneHistory(); });
    tab.addEventListener('input', (e) => { if (e.target.id === 'tuneHeadline') { app.tuning.headline = e.target.value.slice(0, 60); pushTuning(); } });
    tab.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.preset) { const p = TUNE_PRESETS[+b.dataset.preset]; tuneGlide(Object.assign({ round: 0.5 }, p.t), p.name + ': ' + p.sub.toLowerCase() + '.'); }
      if (b.dataset.section) { tunePush(); const k = b.dataset.section, hd = app.tuning.hide, i = hd.indexOf(k); if (i >= 0) hd.splice(i, 1); else hd.push(k); pushTuning(); renderTune(); }
      if (b.dataset.act === 'tune-describe') tuneDescribe();
      if (b.dataset.act === 'tune-undo') tuneUndo();
      if (b.dataset.act === 'tune-redo') tuneRedo();
      if (b.dataset.act === 'tune-save') saveTuning();
      if (b.dataset.act === 'tune-factory') clearSavedTuning();
      if (b.dataset.member) {
        tunePush();
        const m = b.dataset.member, hl = app.tuning.highlights;
        const i = hl.indexOf(m);
        if (i >= 0) hl.splice(i, 1); else hl.push(m);
        b.setAttribute('aria-pressed', String(i < 0));
        pushTuning();
      }
      if (b.dataset.act === 'spot-clear') { tunePush(); app.tuning.highlights = []; renderTuneMembersOnly(); pushTuning(); }
      if (b.dataset.act === 'tune-reset') { app.tuneMsg = ''; app.tuneWhy = ''; tuneGlide(freshTuning(app.savedTuning), ''); }
      if (b.dataset.act === 'tune-claude') rewriteWithClaude();
      if (b.dataset.act === 'se-toggle') setSelfEdit(!app.selfEdit);
      if (b.dataset.act === 'se-build') { const r = app.seRequests[+b.dataset.req]; if (r) rewriteWithClaude(r.text, r); }
      if (b.dataset.act === 'se-copy-code' && app.seBuilt) copyText(S.selfEdit.exportCode(app.snap, app.seBuilt));
      if (b.dataset.act === 'se-copy-setup' && app.seBuilt) copyText(seSetupPrompt(S.selfEdit.exportSpec(app.snap, app.seBuilt)));
      if (b.dataset.act === 'se-download' && app.seBuilt && app.caps.downloads) {
        const name = slug(app.snap.frame.name || 'frame') + '.self-edit.frame.js';
        app.caps.downloads.save({ filename: name, data: S.selfEdit.exportCode(app.snap, app.seBuilt) }).then(() => toast('Saved ' + name + '.'), () => {});
      }
    });
  }
  function renderTuneHistory() { const u = $('[data-act="tune-undo"]'), r = $('[data-act="tune-redo"]'); if (u) u.disabled = !TH.past.length; if (r) r.disabled = !TH.future.length; }
  function tuningWords(t) {
    const w = (v, lo, hi) => (v < 0.34 ? lo : v > 0.67 ? hi : 'balanced between ' + lo.toLowerCase() + ' and ' + hi.toLowerCase());
    return [
      'Color: ' + Math.round(t.color * 100) + '/100 (' + w(t.color, 'Monochrome, outlined surfaces', 'Expressive, Pigment editorial gradients and full chart palette') + ')',
      'Detail: ' + Math.round(t.detail * 100) + '/100 (' + w(t.detail, 'Concise, fewest elements', 'Detailed, extra columns, data labels and footnotes') + ')',
      'Time horizon: ' + Math.round(t.horizon * 100) + '/100 (' + w(t.horizon, 'Historical, actuals and year-over-year', 'Forward-looking, plan, forecast and coverage') + ')',
      'Specificity: ' + Math.round(t.specificity * 100) + '/100 (' + w(t.specificity, 'Abstract, rounded headline numbers', 'Specific, more decimals and breakdowns') + ')',
      'Audience: ' + Math.round(t.audience * 100) + '/100 (' + w(t.audience, 'Executive, narrative first', 'Operator, tables first') + ')',
      'Emphasis: ' + Math.round(t.emphasis * 100) + '/100 (' + w(t.emphasis, 'Calm, quiet figures', 'Bold, large key figures') + ')',
      'Certainty: ' + Math.round(t.certainty * 100) + '/100 (' + w(t.certainty, 'Single forecast numbers', 'Show a range around forecast values') + ')',
      'Corners ' + Math.round(t.round * 100) + ', depth ' + Math.round(t.depth * 100) + ', spacing ' + Math.round(t.space * 100) + ' out of 100 (0 = square, flat, tight; 100 = soft, lifted, airy)',
      'Precision: ' + Math.round(t.precision * 100) + '/100 (' + w(t.precision, 'Whole numbers', 'Two decimals') + ')',
      'Alert threshold: colour a change only when it exceeds ' + Math.round(t.alert * 10) + '%',
      t.headline ? 'Page title: "' + t.headline + '"' : '',
      t.hide && t.hide.length ? 'Leave out these sections: ' + t.hide.join(', ') : '',
      t.highlights.length ? 'Highlight these dimension members wherever they appear: ' + t.highlights.join(', ') : '',
    ].filter(Boolean).join('\n');
  }
  async function rewriteWithClaude(request, reqObj) {
    if (typeof request !== 'string') request = null;
    const sample = app.caps.sample;
    const status = $('#tuneStatus');
    if (!sample) return;
    let code = String(app.snap.code || '');
    const cssLine = code.match(/^var PG_CSS = ".*";$/m);
    if (cssLine) code = code.replace(cssLine[0], 'var PG_CSS = __PIGMENT_CSS__;');
    if (code.length > 150000) { status.textContent = 'This frame is too large to rewrite in one request.'; return; }
    const dsText = (app.snap.dataSources || []).map((d) => d.name + ': values [' + d.values.map((v) => v.binding).join(', ') + '], labels [' + d.labels.map((l) => l.binding).join(', ') + '], selectors [' + (d.selectors || []).map((s) => s.binding).join(', ') + ']').join('\n');
    const prompt = 'You edit Pigment Frames: single-file vanilla JS run in a sandboxed iframe, reading data only through window.PigmentSDK.subscribeToDataSource / subscribeToItems, styled with Pigment design tokens (CSS variables such as --color-chart-1, classes such as card, type-kicker, chip). Keep the IIFE, the root.__cleanup pattern, every data subscription, data source names and binding names exactly. Do not add network calls, storage or CDNs. Do not invent data: only use values the data sources deliver.\n\n' +
      (request
        ? 'A viewer asked for this change from inside the frame:\n"' + request + '"\n\nMake that change. Keep reading window.StrataTuning if the code already does, so the in-frame display settings keep working.\n\nData sources:\n'
        : 'Rewrite the frame below so its presentation matches these settings:\n' + tuningWords(app.tuning) + '\n\nIf the code reads window.StrataTuning, bake the chosen settings in as constants and remove that dependency.\n\nData sources:\n') + dsText + '\n\nReply with the complete new frame code in one ```js code block and nothing after it. Before the block, write one short sentence describing the change.\n\n```js\n' + code + '\n```';
    status.textContent = 'Claude is rewriting the frame…';
    const btn = $('[data-act="tune-claude"]');
    if (btn) btn.disabled = true;
    try {
      const { text } = await sample(prompt, { cache: false, modelTier: 'complex', onText: ({ text }) => { status.textContent = 'Claude is writing · ' + Math.round(text.length / 1024) + ' KB'; } });
      const m = text.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/);
      if (!m) throw { code: 'no_code', message: 'No code block in the reply.' };
      let next = m[1];
      if (cssLine) next = next.replace('var PG_CSS = __PIGMENT_CSS__;', () => cssLine[0]);
      const summary = text.slice(0, text.indexOf('```')).trim().split('\n')[0].slice(0, 160);
      const snap = JSON.parse(JSON.stringify(app.snap));
      snap.code = next;
      snap.version = { id: 'c' + Date.now().toString(36), label: request ? 'Change request' : 'Tuned by Claude', note: summary || (request ? request.slice(0, 120) : tuningWords(app.tuning).split('\n')[0]), createdAt: new Date().toISOString(), author: 'Claude', source: 'claude', parent: app.snap.version.id };
      addLocalVersion(snap);
      await saveVersionToDb(snap).catch(() => {});
      if (reqObj) reqObj.status = 'built';
      loadSnapshot(snap);
      toast('New version from Claude loaded. Open History to compare it with the previous one.');
    } catch (e) {
      status.textContent = e && e.code === 'not_granted' ? 'Claude is not allowed for this artifact.' : e && e.code === 'rate_limited' ? 'Claude is busy for you right now. Try again later.' : 'The rewrite did not finish: ' + ((e && e.message) || 'unknown error') + '.';
    } finally {
      const b2 = $('[data-act="tune-claude"]');
      if (b2) b2.disabled = !app.caps.sample;
    }
  }

  /* ---------- Ask Claude ---------- */
  const SUGGESTIONS = [
    'Which numbers on this frame are not backed by Pigment blocks?',
    'Explain how Plan attainment is calculated, end to end.',
    'If I delete ARR Target, what breaks on this frame?',
    'What should I move from the frame code into the model?',
  ];
  function renderClaude() {
    const tab = $('#tabClaude');
    if (!tab) return;
    if (!app.caps.sample) {
      tab.innerHTML = '<div class="empty"><b>Ask Claude about this frame</b><span>Available when this page is open as a published artifact with Claude enabled. Claude reads the lineage, the code and the blocks, and can point at numbers for you.</span></div>' + suggestHtml(true);
      return;
    }
    const msgs = app.chat.map((m) => '<div class="msg ' + (m.role === 'user' ? 'user' : 'claude') + '">' + (m.role === 'user' ? esc(m.content) : md(m.content)) + '</div>').join('');
    tab.innerHTML = '<div class="chat" id="chatLog">' + (msgs || '<div class="note">Claude sees the rendered frame’s lineage, data sources, blocks and code. It can highlight numbers and switch views while it answers.</div>' + suggestHtml(false)) + '</div>' +
      '<form class="composer" id="chatForm"><textarea id="chatInput" rows="2" placeholder="Ask about a number, a block or a change…"></textarea><button class="btn btn-primary" type="submit" id="chatSend">Ask</button></form>';
    const log = $('#chatLog');
    log.scrollTop = log.scrollHeight;
  }
  function suggestHtml(disabled) { return '<div class="suggest">' + SUGGESTIONS.map((s) => '<button type="button" data-suggest="' + esc(s) + '"' + (disabled ? ' disabled' : '') + '>' + esc(s) + '</button>').join('') + '</div>'; }
  function md(t) {
    let h = esc(t);
    h = h.replace(/```[a-z]*\n([\s\S]*?)```/g, (_, c) => '<div class="formula-box">' + c + '</div>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/\[((?:t|c)\d+(?:_\d+)?(?::\d+)?|(?:block|ds|comp|const|axis|filter|items|write|up):[^\]\s]+)\]/g, (_, id) => '<button type="button" class="ref" data-goto="' + id + '">' + id.replace(/^block:|^up:/, '') + '</button>');
    const lines = h.split('\n');
    let out = '', inList = false;
    lines.forEach((l) => {
      if (/^\s*[-*] /.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + l.replace(/^\s*[-*] /, '') + '</li>'; return; }
      if (inList) { out += '</ul>'; inList = false; }
      if (l.trim()) out += '<p>' + l + '</p>';
    });
    if (inList) out += '</ul>';
    return out;
  }
  function contextForClaude() {
    const g = app.graph, s = app.snap;
    if (!g) return 'The frame has not rendered yet.';
    const nm = (b) => { const m = E.blockMeta(s, b); return m ? m.name : b; };
    const lines = [];
    lines.push('Frame: ' + s.frame.name + ' (' + [s.frame.workspace, s.frame.application].filter(Boolean).join(' › ') + '), version ' + s.version.label + '.');
    lines.push('Current view: ' + app.mode + '. Coverage: ' + Math.round(g.stats.coverage * 100) + '% of ' + g.stats.numbers + ' numbers trace to Pigment blocks.');
    lines.push('\nDATA SOURCES');
    g.nodes.forEach((n) => { if (n.kind === 'ds') lines.push('[ds:' + n.name + '] values ' + (n.def ? n.def.values.map((v) => nm(v.binding) + (v.aggregator ? '(' + v.aggregator + ')' : '')).join(', ') : '?') + '; rows by ' + (n.def && n.def.labels.length ? n.def.labels.map((l) => nm(l.binding)).join(', ') : 'none') + filtersText(n) + '; ' + n.rows + ' rows'); });
    lines.push('\nPIGMENT BLOCKS');
    g.nodes.forEach((n) => { if (n.kind === 'block') { const m = n.meta; lines.push('[' + n.id + '] ' + m.name + ' (' + m.kind + (n.layer === 'upstream' ? ', upstream' : '') + ')' + (m.formula ? ' = ' + m.formula : m.input ? ' input metric' : '') + (m.dims && m.dims.length ? '; dims ' + m.dims.join(' × ') : '') + (n.layer === 'blocks' ? '; shown on ' + n.visible + ' elements' : '')); } });
    lines.push('\nFRAME LOGIC');
    g.nodes.forEach((n) => { if (n.layer === 'logic' && n.kind !== 'ds') lines.push('[' + n.id + '] ' + n.kind + ': ' + (n.label || n.name || n.op || '') + (n.kind === 'constant' ? ' = ' + n.value + ' at line ' + n.line : '')); });
    lines.push('\nNUMBERS AND LABELS ON THE FRAME (id | shown | classification | source | confidence)');
    g.elements.filter((e) => e.cls !== 'zero').slice(0, 220).forEach((e) => lines.push('[' + e.id + '] | ' + (e.raw || e.text) + ' | ' + e.cls + ' | ' + sourceLine(e) + (e.formula ? ' (' + e.formula + ')' : '') + ' | ' + e.conf + ' | context: ' + String(e.rect.ctx || '').slice(0, 80)));
    if (V.selectedId) lines.push('\nThe viewer has selected [' + V.selectedId + '].');
    return lines.join('\n');
  }
  let chatCtl = null;
  async function askClaude(q) {
    const sample = app.caps.sample;
    if (!sample || !q.trim()) return;
    app.chat.push({ role: 'user', content: q.trim() });
    app.chat.push({ role: 'assistant', content: '…', pending: true });
    renderClaude();
    const bubbles = $$('#chatLog .msg.claude');
    const bubble = bubbles[bubbles.length - 1];
    const rules = 'You are Claude, embedded in Framecraft, a lineage explorer for a Pigment Frame. A Pigment Frame is custom JavaScript that reads Pigment blocks (metrics, dimensions) through data sources. Framecraft replays the frame and matches every number on screen to the data the frame received, so each number is classified as from a block, computed in the frame, hardcoded in code, a chart scale, or not traced. Answer the viewer in plain, short paragraphs or bullets. Cite numbers and blocks with their ids in square brackets exactly as given, for example [t12] or [block:arr], so the page can link them. Use the highlight tool to point at what you are talking about. Never invent blocks or numbers that are not in the context.\n\nCONTEXT\n' + contextForClaude().slice(0, 90000);
    const turns = [{ role: 'user', content: rules }];
    app.chat.filter((m) => !m.pending).slice(-12).forEach((m) => turns.push({ role: m.role, content: m.content }));
    const tools = [
      { name: 'highlight', description: 'Select a number, block or logic node on the stage so the viewer sees its full lineage path. Returns "ok".', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'An id from the context, such as t12 or block:arr' } }, required: ['id'] }, execute: (inp) => { const id = String(inp.id || '').replace(/^\[|\]$/g, ''); V.select(id); return 'ok'; } },
      { name: 'set_view', description: 'Switch the stage view. view is one of frame, layers, trace. Returns "ok".', inputSchema: { type: 'object', properties: { view: { type: 'string', enum: ['frame', 'layers', 'trace'] } }, required: ['view'] }, execute: (inp) => { const v = String(inp.view); if (['frame', 'layers', 'trace'].includes(v)) setMode(v); return 'ok'; } },
      { name: 'get_code', description: 'Read lines of the frame JavaScript, 1-based and inclusive, at most 200 lines. Returns the numbered lines.', inputSchema: { type: 'object', properties: { from: { type: 'number' }, to: { type: 'number' } }, required: ['from', 'to'] }, execute: (inp) => { const L = String(app.snap.code || '').split('\n'); const a = Math.max(1, Number(inp.from) || 1), b = Math.min(L.length, a + 199, Number(inp.to) || a + 50); return L.slice(a - 1, b).map((l, i) => a + i + ': ' + l.slice(0, 300)).join('\n'); } },
    ];
    chatCtl = new AbortController();
    let limits = null;
    try { limits = await sample.limits(); } catch (e) { limits = null; }
    const opts = { cache: false, signal: chatCtl.signal, onText: ({ text }) => { if (bubble) bubble.innerHTML = md(text); const log = $('#chatLog'); if (log) log.scrollTop = log.scrollHeight; } };
    if (limits && limits.tools) opts.tools = tools;
    const last = app.chat[app.chat.length - 1];
    try {
      const { text } = await sample(turns, opts);
      last.content = text;
    } catch (e) {
      last.content = (e && e.text ? e.text + '\n\n' : '') + (e && e.code === 'cancelled' ? '(stopped)' : e && e.code === 'not_granted' ? 'Claude is not allowed for this artifact.' : e && e.code === 'rate_limited' ? 'Claude is busy for you right now. Try again in a little while.' : 'The answer was interrupted. Try asking again.');
    }
    delete last.pending;
    renderClaude();
  }
  function bindClaude() {
    const tab = $('#tabClaude');
    tab.addEventListener('submit', (e) => { e.preventDefault(); const ta = $('#chatInput'); const q = ta.value; ta.value = ''; askClaude(q); });
    tab.addEventListener('keydown', (e) => { if (e.target.id === 'chatInput' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
    tab.addEventListener('click', (e) => { const b = e.target.closest('[data-suggest]'); if (b) askClaude(b.dataset.suggest); });
  }

  /* ---------- versions: local + db ---------- */
  function addLocalVersion(snap) {
    const list = app.localVersions.get(snap.key) || [];
    list.unshift({ id: snap.version.id, label: snap.version.label, note: snap.version.note, createdAt: snap.version.createdAt, author: snap.version.author, source: snap.version.source, load: async () => snap });
    app.localVersions.set(snap.key, list);
  }
  function versionsFor(key) {
    const out = [];
    if (key === S.demo.key) S.demo.versions.slice().reverse().forEach((v) => out.push({ id: v.id, label: v.label, note: v.note, createdAt: v.createdAt, author: v.author, source: 'sample', load: async () => S.demo.build(v.n, app.texts.frame, app.texts.css) }));
    (app.localVersions.get(key) || []).forEach((v) => { if (!out.some((o) => o.id === v.id)) out.push(v); });
    (app.dbVersions.get(key) || []).forEach((v) => { if (!out.some((o) => o.id === v.id)) out.push(v); });
    return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  let framesUnsub = null, versionsUnsub = null, versionsKey = null;
  function subscribeFrames() {
    const db = app.caps.db;
    if (!db || framesUnsub) return;
    framesUnsub = db.collection('frames').onSnapshot((snap) => {
      snap.docs.forEach((d) => { const x = d.data(); if (x) app.frames.set(d.id, Object.assign({ key: d.id, source: 'db' }, x, { key: d.id })); });
      if (!$('#pickerPop').hidden) renderPicker();
    }, () => {});
  }
  function subscribeVersions(key) {
    const db = app.caps.db;
    if (!db || versionsKey === key) return;
    if (versionsUnsub) versionsUnsub();
    versionsKey = key;
    versionsUnsub = db.collection('frames/' + key + '/versions').onSnapshot((snap) => {
      app.dbVersions.set(key, snap.docs.map((d) => { const x = d.data() || {}; return { id: d.id, label: x.label || d.id, note: x.note || '', createdAt: x.createdAt || '', author: x.author || '', authorId: x.authorId || null, source: x.source || 'db', parts: x.parts || 0, inline: x.snapshot || null, load: () => loadDbVersion(key, d.id, x) }; }));
      if (!$('#historyPop').hidden) renderHistory();
    }, () => {});
  }
  async function loadDbVersion(key, vid, meta) {
    if (meta && meta.snapshot) return normalizeSnapshot(Object.assign({ key }, meta.snapshot));
    const db = app.caps.db;
    const parts = await db.collection('frames/' + key + '/versions/' + vid + '/parts').get();
    const sorted = parts.docs.map((d) => ({ i: parseInt(String(d.id).replace(/\D/g, ''), 10) || 0, c: (d.data() || {}).chunk || '' })).sort((a, b) => a.i - b.i);
    const snap = JSON.parse(sorted.map((p) => p.c).join(''));
    snap.key = key;
    snap.version = Object.assign({}, snap.version, { id: vid, label: meta.label || vid, createdAt: meta.createdAt, source: meta.source || 'db', note: meta.note });
    return normalizeSnapshot(snap);
  }
  async function saveVersionToDb(snap) {
    const db = app.caps.db;
    if (!db) throw new Error('Saving needs the published artifact.');
    const key = snap.key, vid = snap.version.id && !/^v\d$/.test(snap.version.id) ? snap.version.id : 'v' + Date.now().toString(36);
    const body = JSON.stringify(Object.assign({}, snap, { version: Object.assign({}, snap.version, { id: vid }) }));
    const CH = 180000;
    const n = Math.ceil(body.length / CH);
    for (let i = 0; i < n; i++) await db.doc('frames/' + key + '/versions/' + vid + '/parts/p' + i).set({ chunk: body.slice(i * CH, (i + 1) * CH) });
    await db.doc('frames/' + key + '/versions/' + vid).set({ label: snap.version.label, note: snap.version.note || '', createdAt: snap.version.createdAt || new Date().toISOString(), author: snap.version.author || '', authorId: app.userId || null, source: snap.version.source || 'explorer', parts: n, bytes: body.length });
    await db.doc('frames/' + key).set({ name: snap.frame.name, application: snap.frame.application || '', workspace: snap.frame.workspace || '', frameId: snap.frame.id || '', updatedAt: new Date().toISOString(), latestVersion: vid });
    return vid;
  }

  /* ---------- history popover ---------- */
  function renderHistory() {
    const pop = $('#historyPop');
    const key = app.snap.key;
    const list = versionsFor(key);
    const canSave = !!app.caps.db && app.canEdit !== false;
    let h = '<div class="sec-title">Versions and publishing · ' + esc(app.snap.frame.name) + '</div>';
    h += '<div class="note">Pigment Frames have no version history yet. Every version saved here keeps the code, bindings, data sources and a data snapshot, so you can reopen and compare them.</div>';
    h += '<div class="ctl-row"><input type="text" id="verLabel" placeholder="Name this version" style="flex:1;min-width:0;border:1px solid var(--line-2);background:var(--panel-2);color:var(--text);border-radius:7px;padding:6px 8px"><button class="btn btn-primary" data-act="save-ver"' + (canSave ? '' : ' disabled') + '>Save current</button></div>';
    if (!canSave) h += '<div class="small muted">' + (app.caps.db ? 'Only editors of this artifact can save versions.' : 'Saving versions works on the published artifact.') + '</div>';
    h += pushHtml(canSave);
    h += list.map((v) => '<div class="ver' + (v.id === app.snap.version.id ? ' is-current' : '') + '"><span class="ver-dot"></span><div class="ver-main"><div class="ver-top"><b>' + esc(v.label) + '</b><span class="muted small">' + esc(fmtDate(v.createdAt)) + '</span></div>' + (v.note ? '<div class="small muted">' + esc(v.note) + '</div>' : '') + '<div class="small muted">' + esc(sourceWord(v.source)) + (v.author ? ' · ' + esc(v.author) : '') + '</div><div class="ver-actions">' + (v.id === app.snap.version.id ? '<span class="pill" style="--k:var(--accent)"><i></i>Open now</span>' : '<button class="btn btn-sm" data-open-ver="' + esc(v.id) + '">Open</button><button class="btn btn-sm" data-cmp-ver="' + esc(v.id) + '">Compare with open</button>') + '</div></div></div>').join('');
    pop.innerHTML = h;
  }
  /* ---------- push edits back to Pigment (through Claude + the Pigment connector) ---------- */
  app.pushes = [];
  let pushesUnsub = null;
  function subscribePushes() {
    const db = app.caps.db;
    if (!db || pushesUnsub) return;
    pushesUnsub = db.collection('pushes').orderBy('requestedAt', 'desc').limit(30).onSnapshot((snap) => {
      app.pushes = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      if (!$('#historyPop').hidden) renderHistory();
    }, () => {});
  }
  function pushHtml(canSave) {
    const s = app.snap;
    const isSample = s.version.source === 'sample' || (s.frame && s.frame.isSample);
    const hasId = !!(s.frame && s.frame.id && !/^paste-|^frm-sample/.test(s.frame.id));
    const mode = app.pushMode || (hasId ? 'update' : 'copy');
    let h = '<div class="sec" style="margin-top:6px"><div class="sec-title">Push to Pigment</div>';
    if (isSample) return h + '<div class="small muted">The sample frame is not in Pigment. Pull a real frame to push edits back.</div></div>';
    h += '<div class="ctl-row"><button type="button" class="chipbtn" data-pushmode="update" aria-pressed="' + (mode === 'update') + '"' + (hasId ? '' : ' disabled title="This frame has no Pigment frame id"') + '>Update this frame</button><button type="button" class="chipbtn" data-pushmode="copy" aria-pressed="' + (mode === 'copy') + '">Save as a new frame</button></div>';
    if (mode === 'copy') h += '<input type="text" id="pushName" value="' + esc((s.frame.name || 'Frame') + ' (Framecraft copy)') + '" style="border:1px solid var(--line-2);background:var(--panel-2);color:var(--text);border-radius:7px;padding:6px 8px" aria-label="New frame name">';
    h += '<div class="small muted">' + (mode === 'update' ? 'Replaces the code, bindings and data sources of “' + esc(s.frame.name) + '” in ' + esc(s.frame.application || 'its application') + ' with the open version.' : 'Creates a new frame in ' + esc(s.frame.application || 'the same application') + ' with the same bindings and data sources. The original stays untouched.') + ' Claude carries it out with your Pigment access.</div>';
    h += '<button class="btn btn-primary" data-act="push"' + (canSave ? '' : ' disabled') + '>Queue push of “' + esc(s.version.label) + '”</button>';
    const mine = app.pushes.filter((p) => p.frameKey === s.key).slice(0, 5);
    if (mine.length) h += mine.map((p) => '<div class="note small"><b>' + esc(p.mode === 'update' ? 'Update' : 'New frame “' + (p.newName || '') + '”') + '</b> · ' + esc(p.versionLabel || p.versionId) + '<br><span class="pill" style="--k:var(' + (p.status === 'done' ? '--good' : p.status === 'failed' ? '--bad' : '--warn') + ')"><i></i>' + esc(p.status === 'done' ? 'Pushed' : p.status === 'failed' ? 'Failed' : 'Waiting for Claude') + '</span> ' + esc(p.message || fmtDate(p.requestedAt)) + (p.status === 'pending' ? '<br><button class="btn btn-sm" data-copypush="' + esc(p.id) + '" style="margin-top:6px">Copy request for Claude</button>' : '') + '</div>').join('');
    return h + '</div>';
  }
  function pushPrompt(id) { return 'Run the pending Framecraft push request "' + id + '" in my Framecraft artifact (https://claude.ai/artifact/Y93SwSChoLVXBDW84FkE3F): read pushes/' + id + ', load that frame version, push it to Pigment, then mark the request done.'; }
  async function requestPush() {
    const db = app.caps.db;
    if (!db) { toast('Pushing works on the published artifact.'); return; }
    const s = app.snap;
    const mode = app.pushMode || (s.frame.id && !/^paste-/.test(s.frame.id) ? 'update' : 'copy');
    const name = mode === 'copy' ? (($('#pushName') && $('#pushName').value) || '').trim() : '';
    if (mode === 'copy' && !name) { toast('Name the new frame first.'); return; }
    const saved = (app.dbVersions.get(s.key) || []).some((v) => v.id === s.version.id);
    if (!saved) {
      const copy = JSON.parse(JSON.stringify(s));
      if (!copy.version.id || /^v\d$|^draft$/.test(copy.version.id)) copy.version.id = 'v' + Date.now().toString(36);
      const vid = await saveVersionToDb(copy);
      s.version.id = vid;
    }
    const id = 'push-' + Date.now().toString(36);
    await db.doc('pushes/' + id).set({ frameKey: s.key, versionId: s.version.id, versionLabel: s.version.label, frameName: s.frame.name, frameId: s.frame.id || '', application: s.frame.application || '', workspace: s.frame.workspace || '', mode, newName: name, status: 'pending', requestedAt: new Date().toISOString(), requestedBy: app.userId || null });
    copyText(pushPrompt(id));
    toast('Push queued. The request for Claude is on your clipboard: paste it into your Claude session.');
  }
  function sourceWord(s) { return { sample: 'Sample version', pigment: 'Pulled from Pigment', claude: 'Rewritten by Claude', paste: 'Pasted in', explorer: 'Saved here', db: 'Saved here' }[s] || 'Saved here'; }
  function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function bindHistory() {
    const pop = $('#historyPop');
    pop.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const list = versionsFor(app.snap.key);
      if (b.dataset.openVer) { const v = list.find((x) => x.id === b.dataset.openVer); if (v) { try { loadSnapshot(await v.load()); renderHistory(); } catch (err) { toast('That version could not be opened: ' + err.message); } } }
      if (b.dataset.pushmode) { app.pushMode = b.dataset.pushmode; renderHistory(); return; }
      if (b.dataset.copypush) { copyText(pushPrompt(b.dataset.copypush)); return; }
      if (b.dataset.act === 'push') { b.disabled = true; try { await requestPush(); } catch (err) { toast('Could not queue the push: ' + (err.message || err.code)); } renderHistory(); return; }
      if (b.dataset.cmpVer) { app.compareIds = [b.dataset.cmpVer, app.snap.version.id]; pop.hidden = true; setMode('compare'); }
      if (b.dataset.act === 'save-ver') {
        const label = ($('#verLabel').value || '').trim() || 'Saved ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const snap = JSON.parse(JSON.stringify(app.snap));
        snap.version = { id: 'v' + Date.now().toString(36), label, note: '', createdAt: new Date().toISOString(), source: 'explorer', parent: app.snap.version.id };
        b.disabled = true;
        try { await saveVersionToDb(snap); app.snap.version = snap.version; toast('Saved “' + label + '”.'); renderHistory(); }
        catch (err) { toast(err && err.code === 'quota_exceeded' ? 'Storage for this artifact is full. Delete old versions first.' : 'Could not save: ' + (err.message || err.code)); b.disabled = false; }
      }
    });
  }

  /* ---------- picker ---------- */
  function renderPicker() {
    const pop = $('#pickerPop');
    const items = [...app.frames.values()];
    const persona = (f) => { const r = S.samples && f.room && S.samples.rooms.find((x) => x.id === f.room); return r ? r.persona + ' · ' : ''; };
    pop.innerHTML = '<div class="sec-title">Frames</div><div class="pop-scroll">' + items.map((f) => '<button class="pop-item' + (app.snap && f.key === app.snap.key ? ' is-current' : '') + '" data-frame="' + esc(f.key) + '"><b>' + esc(f.name) + '</b><span>' + esc(persona(f) + ([f.workspace, f.application].filter(Boolean).join(' › ') || sourceWord(f.source))) + (f.source === 'sample' ? ' · sample data' : '') + '</span></button>').join('') + '</div>' +
      '<button class="btn" data-act="open-load">Load another frame…</button>';
    const r = $('#picker').getBoundingClientRect();
    pop.style.left = Math.max(16, Math.min(r.left, window.innerWidth - 396)) + 'px';
  }
  async function openFrame(key) {
    if (app.snap && key === app.snap.key) return;
    if (key === S.demo.key) { loadSnapshot(S.demo.build(3, app.texts.frame, app.texts.css)); return; }
    if (S.samples && S.samples.has(key)) { loadSnapshot(S.samples.build(key, app.texts.css)); return; }
    const list = versionsFor(key);
    if (list.length) { loadSnapshot(await list[0].load()); return; }
    const db = app.caps.db;
    if (db) {
      const snap = await db.collection('frames/' + key + '/versions').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.docs[0]) { loadSnapshot(await loadDbVersion(key, snap.docs[0].id, snap.docs[0].data())); return; }
    }
    toast('That frame has no saved versions yet.');
  }

  /* ---------- compare ---------- */
  let cmp = null;
  function destroyCompare() { if (cmp) { cmp.hosts.forEach((h) => h.destroy()); cmp = null; } }
  async function renderCompare() {
    destroyCompare();
    const box = $('#compare');
    const list = versionsFor(app.snap.key);
    if (list.length < 2) {
      box.innerHTML = '<div class="cmp-bar"><button class="btn" data-act="cmp-close">Back</button></div><div class="empty" style="align-self:center;justify-self:center;max-width:420px"><b>Only one version so far</b><span>Save a version in History, tune it, or let Claude rewrite it, then compare any two here.</span></div>';
      return;
    }
    let [ia, ib] = app.compareIds || [];
    if (!list.some((v) => v.id === ia)) ia = list[1].id;
    if (!list.some((v) => v.id === ib)) ib = list[0].id;
    const opt = (sel) => list.map((v) => '<option value="' + esc(v.id) + '"' + (v.id === sel ? ' selected' : '') + '>' + esc(v.label) + ' · ' + esc(fmtDate(v.createdAt)) + '</option>').join('');
    box.innerHTML = '<div class="cmp-bar"><button class="btn" data-act="cmp-close">Back</button><span class="muted">Before</span><select id="cmpA">' + opt(ia) + '</select><span class="muted">After</span><select id="cmpB">' + opt(ib) + '</select><nav class="seg"><button type="button" data-cmpmode="side" aria-pressed="' + (store.get('cmpmode', 'side') === 'side') + '">Side by side</button><button type="button" data-cmpmode="swipe" aria-pressed="' + (store.get('cmpmode', 'side') === 'swipe') + '">Swipe</button></nav></div>' +
      '<div class="cmp-stage' + (store.get('cmpmode', 'side') === 'swipe' ? ' is-swipe' : '') + '" id="cmpStage"><div class="cmp-slot a"><span class="cmp-label">Before</span><div class="cmp-host" id="cmpHostA"></div></div><div class="cmp-slot b"><span class="cmp-label" style="left:auto;right:10px">After</span><div class="cmp-host" id="cmpHostB"></div></div><div class="cmp-handle" id="cmpHandle"></div></div>' +
      '<div class="cmp-diff" id="cmpDiff"><div class="cmp-card"><h3>Comparing</h3><div class="muted">Replaying both versions…</div></div></div>';
    const va = list.find((v) => v.id === ia), vb = list.find((v) => v.id === ib);
    const [A, B] = [normalizeSnapshot(await va.load()), normalizeSnapshot(await vb.load())];
    cmp = { A, B, gA: null, gB: null, hosts: [] };
    const mk = (slot, snap, which) => {
      const h = new S.FrameHost($(slot), { onMessage: (d, host) => { if (d.type === 'scan' && cmp) { cmp[which] = E.buildGraph(snap, host, host.scan); renderDiff(); } } });
      h.load(snap, E.analyzeCode(snap.code).tunable ? app.tuning : null, { w: V.W, h: V.H });
      cmp.hosts.push(h);
    };
    mk('#cmpHostA', A, 'gA');
    mk('#cmpHostB', B, 'gB');
    fitCompare();
    renderDiff();
  }
  function fitCompare() {
    $$('.cmp-slot').forEach((slot) => {
      const host = $('.cmp-host', slot);
      const r = slot.getBoundingClientRect();
      const s = Math.min(r.width / V.W, r.height / V.H);
      host.style.transform = 'translate(' + (r.width - V.W * s) / 2 + 'px,' + (r.height - V.H * s) / 2 + 'px) scale(' + s + ')';
    });
  }
  function renderDiff() {
    if (!cmp) return;
    const d = E.diffSnapshots(cmp.A, cmp.B, cmp.gA, cmp.gB);
    const pct = (x) => (x == null ? '…' : Math.round(x * 100) + '%');
    const li = (tag, t) => '<li><span class="tag ' + tag + '">' + { add: 'ADDED', del: 'REMOVED', chg: 'CHANGED' }[tag] + '</span><span>' + t + '</span></li>';
    let h = '<div class="cmp-card"><h3>Lineage coverage</h3><div class="cov"><span class="hero-num" style="font-size:26px">' + pct(d.coverage[0]) + ' → ' + pct(d.coverage[1]) + '</span></div><div class="small muted">' + (d.numbers[0] == null ? '' : d.numbers[0] + ' → ' + d.numbers[1] + ' numbers on the frame') + '</div></div>';
    const bl = [...d.blocks.added.map((m) => li('add', esc(m.name) + ' <span class="muted">' + esc(m.kind) + '</span>')), ...d.blocks.removed.map((m) => li('del', esc(m.name))), ...d.blocks.changed.map((c) => li('chg', esc(c.after.name) + ' formula'))];
    h += '<div class="cmp-card"><h3>Pigment blocks</h3><ul class="cmp-list">' + (bl.join('') || '<li class="muted">No change</li>') + '</ul></div>';
    const dl = [...d.ds.added.map((x) => li('add', '<span class="mono">' + esc(x.name) + '</span>')), ...d.ds.removed.map((x) => li('del', '<span class="mono">' + esc(x.name) + '</span>')), ...d.ds.changed.map((c) => li('chg', '<span class="mono">' + esc(c.after.name) + '</span> ' + esc(dsChange(c.before, c.after))))];
    h += '<div class="cmp-card"><h3>Data sources</h3><ul class="cmp-list">' + (dl.join('') || '<li class="muted">No change</li>') + '</ul></div>';
    const hard = [...d.hardcoded[0].filter((x) => !d.hardcoded[1].includes(x)).map((x) => li('del', esc(x))), ...d.hardcoded[1].filter((x) => !d.hardcoded[0].includes(x)).map((x) => li('add', esc(x)))];
    h += '<div class="cmp-card"><h3>Hardcoded numbers</h3><ul class="cmp-list">' + (hard.join('') || '<li class="muted">' + (cmp.gA && cmp.gB ? 'No change' : 'Checking…') + '</li>') + '</ul></div>';
    h += '<div class="cmp-card cmp-code"><h3>Code · <span style="color:var(--good)">+' + d.code.added + '</span> <span style="color:var(--bad)">−' + d.code.removed + '</span> lines</h3><div class="code">' + hunks(d.code.ops) + '</div></div>';
    $('#cmpDiff').innerHTML = h;
  }
  function dsChange(a, b) {
    const va = new Set(a.values.map((v) => v.binding)), vb = new Set(b.values.map((v) => v.binding));
    const add = [...vb].filter((x) => !va.has(x)), rem = [...va].filter((x) => !vb.has(x));
    const parts = [];
    if (add.length) parts.push('+ ' + add.map((x) => (E.blockMeta(cmp.B, x) || { name: x }).name).join(', '));
    if (rem.length) parts.push('− ' + rem.map((x) => (E.blockMeta(cmp.A, x) || { name: x }).name).join(', '));
    if (JSON.stringify(a.selectors) !== JSON.stringify(b.selectors)) parts.push('selectors changed');
    if (JSON.stringify(a.labels) !== JSON.stringify(b.labels)) parts.push('labels changed');
    return parts.join(' · ');
  }
  function hunks(ops) {
    const keep = new Set();
    ops.forEach((o, i) => { if (o.t !== '=') for (let k = Math.max(0, i - 2); k <= Math.min(ops.length - 1, i + 2); k++) keep.add(k); });
    let h = '', gap = false;
    ops.forEach((o, i) => {
      if (!keep.has(i)) { if (!gap) { h += '<div class="code-line d-gap">⋯</div>'; gap = true; } return; }
      gap = false;
      const s = o.s.length > 300 ? o.s.slice(0, 300) + ' …' : o.s;
      h += '<div class="code-line ' + (o.t === '+' ? 'd-add' : o.t === '-' ? 'd-del' : '') + '"><span class="ln">' + (o.t === '+' ? '+' : o.t === '-' ? '−' : (o.b + 1)) + '</span><span class="lc">' + esc(s) + '</span></div>';
    });
    return h || '<div class="code-line d-gap">Identical code</div>';
  }
  function bindCompare() {
    const box = $('#compare');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'cmp-close') setMode('frame');
      if (b.dataset.cmpmode) { store.set('cmpmode', b.dataset.cmpmode); $('#cmpStage').classList.toggle('is-swipe', b.dataset.cmpmode === 'swipe'); $$('[data-cmpmode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); fitCompare(); }
    });
    box.addEventListener('change', (e) => { if (e.target.id === 'cmpA' || e.target.id === 'cmpB') { app.compareIds = [$('#cmpA').value, $('#cmpB').value]; renderCompare(); } });
    let drag = false;
    box.addEventListener('pointerdown', (e) => { if (e.target.id === 'cmpHandle') { drag = true; try { e.target.setPointerCapture(e.pointerId); } catch (err) {} } });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const st = $('#cmpStage').getBoundingClientRect();
      const p = Math.max(0, Math.min(100, ((e.clientX - st.left) / st.width) * 100));
      $('#cmpStage').style.setProperty('--cut', p + '%');
    });
    box.addEventListener('pointerup', () => { drag = false; });
    new ResizeObserver(() => { if (cmp) fitCompare(); }).observe(box);
  }

  /* ---------- load modal ---------- */
  function renderLoad() {
    const m = $('#loadModal');
    const prompt = 'Use the Pigment connector to find the Frame "<frame name>" in my <application> application, then pull it into Framecraft: its code, bindings, data sources, block formulas and formats, upstream lineage, and a data snapshot for each data source. Save it as a new version.';
    m.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="loadTitle"><h2 id="loadTitle">Load a frame</h2>' +
      '<div class="sec"><div class="sec-title">From Pigment, through Claude</div><div class="note">Claude connects to Pigment over MCP, reads the frame definition and the blocks it binds, queries a data snapshot, and saves it here as a version. Ask Claude in your Claude session:</div><div class="copybox"><pre id="loadPrompt">' + esc(prompt) + '</pre><button class="btn btn-sm" data-act="copy-prompt">Copy</button></div></div>' +
      '<div class="sec"><div class="sec-title">Or paste it yourself</div><label class="small muted" for="pasteCode">Frame JavaScript, or a full Framecraft snapshot as JSON</label><textarea id="pasteCode" placeholder="(function () { … })();"></textarea>' +
      '<label class="small muted" for="pasteBindings">Bindings JSON (from create_frame / search_frames)</label><textarea id="pasteBindings" placeholder=\'[{"name":"revMetric","type":"Metric","metric_id":"…","can_read":true}]\' style="min-height:70px"></textarea>' +
      '<label class="small muted" for="pasteDs">Data sources JSON</label><textarea id="pasteDs" placeholder=\'[{"name":"revenueByTime","values":[{"binding":"revMetric","aggregator":"Sum"}],"labels":[{"binding":"monthList"}],"selectors":[]}]\' style="min-height:70px"></textarea>' +
      '<label class="small muted" for="pasteData">Data snapshot JSON (optional): { "dataSourceName": [ { "labels": [...], "values": [...] } ] }</label><textarea id="pasteData" style="min-height:70px"></textarea>' +
      '<label class="small muted" for="pasteName">Frame name</label><input type="text" id="pasteName" placeholder="My frame"></div>' +
      '<div class="small muted" id="loadErr"></div><div class="modal-actions"><button class="btn" data-act="close-load">Cancel</button><button class="btn btn-primary" data-act="do-load">Load frame</button></div></div>';
    m.hidden = false;
  }
  function bindLoad() {
    const m = $('#loadModal');
    m.addEventListener('click', async (e) => {
      if (e.target === m) { m.hidden = true; return; }
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'close-load') m.hidden = true;
      if (b.dataset.act === 'copy-prompt') copyText($('#loadPrompt').textContent);
      if (b.dataset.act === 'do-load') {
        const err = $('#loadErr');
        try {
          const code = $('#pasteCode').value.trim();
          let snap;
          if (code.startsWith('{')) snap = JSON.parse(code);
          else {
            if (!code) throw new Error('Paste the frame code first.');
            const parse = (id, d) => { const v = $(id).value.trim(); return v ? JSON.parse(v) : d; };
            const name = $('#pasteName').value.trim() || 'Pasted frame';
            snap = { frame: { name, id: 'paste-' + Date.now().toString(36) }, code, bindings: parse('#pasteBindings', []), dataSources: parse('#pasteDs', []), data: parse('#pasteData', {}), version: { id: 'p' + Date.now().toString(36), label: 'Pasted', createdAt: new Date().toISOString(), source: 'paste' } };
          }
          snap = normalizeSnapshot(snap);
          addLocalVersion(snap);
          loadSnapshot(snap);
          m.hidden = true;
          toast('Loaded “' + snap.frame.name + '”. Save it in History to keep it.');
        } catch (ex) { err.textContent = 'Could not load: ' + ex.message; }
      }
    });
  }

  /* ---------- panes: resize, snap, collapse; floating panels ---------- */
  const SNAP_W = [320, 380, 480, 600];
  function bindPane() {
    const ws = $('#workspace'), rz = $('#resizer');
    const narrow = () => window.matchMedia('(max-width: 860px)').matches;
    const setW = (w) => { document.documentElement.style.setProperty('--pane-w', w + 'px'); };
    setW(store.get('paneW', 380));
    if (store.get('paneCollapsed', false)) ws.classList.add('pane-collapsed');
    let drag = null;
    rz.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; ws.classList.add('is-resizing'); try { rz.setPointerCapture(e.pointerId); } catch (err) {} });
    rz.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = ws.getBoundingClientRect();
      if (narrow()) { const hgt = Math.max(0, r.bottom - e.clientY - 4); document.documentElement.style.setProperty('--pane-h', hgt + 'px'); ws.classList.toggle('pane-collapsed', hgt < 80); return; }
      const w = Math.max(0, Math.min(r.width * 0.7, r.right - e.clientX - 4));
      ws.classList.toggle('pane-collapsed', w < 160);
      if (w >= 160) setW(Math.round(w));
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      ws.classList.remove('is-resizing');
      if (narrow()) return;
      const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pane-w')) || 380;
      if (!ws.classList.contains('pane-collapsed')) {
        const near = SNAP_W.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
        if (Math.abs(near - cur) < 44) setW(near);
        store.set('paneW', Math.abs(near - cur) < 44 ? near : Math.round(cur));
      }
      store.set('paneCollapsed', ws.classList.contains('pane-collapsed'));
    };
    rz.addEventListener('pointerup', end);
    rz.addEventListener('pointercancel', end);
    rz.addEventListener('dblclick', () => togglePane());
    rz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') togglePane();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pane-w')) || 380;
        const list = e.key === 'ArrowLeft' ? SNAP_W.filter((w) => w > cur) : SNAP_W.filter((w) => w < cur).reverse();
        if (list[0]) { setW(list[0]); store.set('paneW', list[0]); }
      }
    });
    $('#btnPane').addEventListener('click', togglePane);
    function togglePane() { ws.classList.toggle('pane-collapsed'); store.set('paneCollapsed', ws.classList.contains('pane-collapsed')); }
  }
  function bindFloats() {
    $$('.float').forEach((f) => {
      const id = f.id;
      const saved = store.get('float:' + id, null);
      if (saved) { f.dataset.corner = saved.corner || f.dataset.corner; f.classList.toggle('is-collapsed', !!saved.collapsed); }
      const head = $('.float-head', f);
      const save = () => store.set('float:' + id, { corner: f.dataset.corner, collapsed: f.classList.contains('is-collapsed') });
      $('[data-collapse]', f).addEventListener('click', (e) => { e.stopPropagation(); f.classList.toggle('is-collapsed'); e.target.textContent = f.classList.contains('is-collapsed') ? '+' : '–'; save(); });
      $('[data-collapse]', f).textContent = f.classList.contains('is-collapsed') ? '+' : '–';
      let drag = null;
      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const st = $('#stage').getBoundingClientRect(), r = f.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, st };
        f.classList.add('is-dragging');
        f.style.left = r.left - st.left + 'px'; f.style.top = r.top - st.top + 'px'; f.style.right = 'auto'; f.style.bottom = 'auto';
        try { head.setPointerCapture(e.pointerId); } catch (err) {}
        e.stopPropagation();
      });
      head.addEventListener('pointermove', (e) => {
        if (!drag) return;
        f.style.left = e.clientX - drag.st.left - drag.dx + 'px';
        f.style.top = e.clientY - drag.st.top - drag.dy + 'px';
      });
      const end = () => {
        if (!drag) return;
        const st = drag.st, r = f.getBoundingClientRect();
        drag = null;
        const cx = r.left + r.width / 2 - st.left, cy = r.top + r.height / 2 - st.top;
        f.dataset.corner = (cy < st.height / 2 ? 't' : 'b') + (cx < st.width / 2 ? 'l' : 'r');
        f.classList.remove('is-dragging');
        f.style.left = f.style.top = f.style.right = f.style.bottom = '';
        save();
      };
      head.addEventListener('pointerup', end);
      head.addEventListener('pointercancel', end);
    });
  }

  /* ---------- misc ---------- */
  let toastTimer = null;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200); }
  function copyText(s) {
    try { navigator.clipboard.writeText(s).then(() => toast('Copied.'), () => toast('Copy was blocked. Select the text and copy it instead.')); }
    catch (e) { toast('Copy was blocked. Select the text and copy it instead.'); }
  }
  function closePops(except) { ['#pickerPop', '#historyPop', '#studioPop'].forEach((p) => { if (p !== except && $(p)) $(p).hidden = true; }); }

  const hostTheme = document.documentElement.getAttribute('data-theme');
  function applyTheme(choice) {
    const root = document.documentElement;
    if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
    $$('#themeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === choice)));
    store.set('theme', choice);
  }
  function bindChrome() {
    let parentTheme = null;
    try { if (window.parent !== window) parentTheme = window.parent.document.documentElement.getAttribute('data-theme') || 'light'; } catch (e) {}
    if (parentTheme) { $('#themeSeg').hidden = true; applyTheme(parentTheme); } // inside Pigment Atlas: Atlas owns the theme
    else { const t = store.get('theme', 'light'); applyTheme(t === 'dark' ? 'dark' : 'light'); }
    $('#themeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) applyTheme(b.dataset.themeSet); });
    $('#stage').dataset.inspect = '1';
    $('#stage').dataset.interact = '0';
    $('#viewTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.view); });
    $('#paneTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setTab(b.dataset.tab); if ($('#workspace').classList.contains('pane-collapsed')) $('#workspace').classList.remove('pane-collapsed'); } });
    $('#picker').addEventListener('click', (e) => { e.stopPropagation(); if (S.play && S.play.wantsGallery()) { closePops(); S.play.openGallery(); return; } const p = $('#pickerPop'); closePops('#pickerPop'); p.hidden = !p.hidden; if (!p.hidden) renderPicker(); });
    $('#pickerPop').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.frame) { $('#pickerPop').hidden = true; Promise.resolve(S.play ? S.play.switchTo(b.dataset.frame) : openFrame(b.dataset.frame)).catch((err) => toast('Could not open: ' + err.message)); }
      if (b.dataset.act === 'open-load') { $('#pickerPop').hidden = true; renderLoad(); }
    });
    $('#btnSelfEdit').setAttribute('aria-pressed', String(app.selfEdit));
    $('#btnSelfEdit').addEventListener('click', () => setSelfEdit(!app.selfEdit));
    $('#btnHistory').addEventListener('click', (e) => { e.stopPropagation(); const p = $('#historyPop'); closePops('#historyPop'); p.hidden = !p.hidden; if (!p.hidden) renderHistory(); });
    $('#btnLoad').addEventListener('click', () => { closePops(); renderLoad(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.pop, #picker, #btnHistory, #btnStudio')) closePops(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePops(); $('#loadModal').hidden = true; if (V.selectedId) V.select(null); }
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (e.key === '1') setMode('frame'); if (e.key === '2') setMode('layers'); if (e.key === '3') setMode('trace');
      if (app.mode === 'layers' && !e.metaKey && !e.ctrlKey) {
        if (e.key === '+' || e.key === '=') V.zoomBy(1.25);
        if (e.key === '-' || e.key === '_') V.zoomBy(0.8);
        if (e.key === '0') V.refit(true);
      }
    });
    $('#tabCode').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'copy-code') copyText(app.snap.code);
      if (b.dataset.act === 'dl-code' && app.caps.downloads) { try { await app.caps.downloads.save({ filename: slug(app.snap.frame.name) + '-' + app.snap.version.id + '.js', data: app.snap.code }); } catch (err) { if (err && err.code !== 'cancelled' && err.code !== 'declined') toast('Download did not start.'); } }
    });
    bindDock(); bindTooltip(); bindInspector(); bindTune(); bindClaude(); bindHistory(); bindCompare(); bindLoad(); bindPane(); bindFloats();
    setTab(app.tab);
    renderDock();
    renderSummary();
    if (S.play) S.play.init({
      closePops, toast, store,
      openFrame: (k) => openFrame(k),
      setMode: (m) => setMode(m),
      mode: () => app.mode,
      graph: () => app.graph,
      snap: () => app.snap,
      currentKey: () => (app.snap ? app.snap.key : null),
      frameList: () => [...app.frames.values()],
      snapFor: (k) => (app.snap && app.snap.key === k ? app.snap : k === S.demo.key ? S.demo.build(3, app.texts.frame, app.texts.css) : S.samples && S.samples.has(k) ? S.samples.build(k, '') : null),
      showInspector: () => { setTab('inspect'); $('#workspace').classList.remove('pane-collapsed'); },
      renderDock: () => renderDock(),
    });
  }

  boot();
})();
