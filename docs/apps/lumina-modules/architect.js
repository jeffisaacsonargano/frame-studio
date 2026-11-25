/* Lumina module: Architecture Studio (contract v1).
   A 2D/3D modeling studio for Pigment solution architects: intent -> head start -> sketch -> validate -> execute.
   Self-contained, ASCII-only, no backslashes, no network, no markup strings except the static icon below.
   Never writes to Pigment directly: the design is kept with ctx.store, and a change request goes through ctx.approve() then ctx.act.request(). */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.Lumina || typeof window.Lumina.registerView !== 'function') return;

  var ICON = "<svg viewBox='0 0 18 18' width='18' height='18' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M9 2.2 15.2 5.4 9 8.6 2.8 5.4z'/><path d='M2.8 9 9 12.2 15.2 9'/><path d='M2.8 12.6 9 15.8l6.2-3.2'/></svg>";
  var NL = String.fromCharCode(10), TIMES = String.fromCharCode(215), ARROW = '->', DOT = String.fromCharCode(183);
  var SVGNS = 'http://www.w3.org/2000/svg';
  var STORE_KEY = 'architect';
  var LAYERS = [
    { id: 'src', label: 'Data sources', sub: 'NetSuite, Snowflake, files', one: 'source' },
    { id: 'imp', label: 'Imports', sub: 'transaction lists', one: 'import' },
    { id: 'dim', label: 'Dimensions', sub: 'lists and hierarchies', one: 'dimension' },
    { id: 'met', label: 'Metrics', sub: 'cubes and formulas', one: 'metric' },
    { id: 'out', label: 'Outputs', sub: 'boards and frame widgets', one: 'output' }
  ];
  var LAYER_IX = { src: 0, imp: 1, dim: 2, met: 3, out: 4 };
  var STEPS = ['Intent', 'Head start', 'Sketch', 'Validate', 'Execute'];
  var NW = 178, NH = 50, CW = 214, RH = 62, GAP = 230;
  var ITEMS = { 'Product': 18, 'Country': 24, 'Channel': 5, 'Version': 3, 'Month': 48, 'Quarter': 16, 'Year': 4, 'Currency': 17, 'Campaign': 96, 'Region': 4, 'Market Tier': 3, 'Category': 2, 'Product Range': 6, 'Range': 6, 'Price Tier': 3, 'Months Since Launch': 55, 'Factory Country': 2, 'Frame Setting': 20 };
  var FILL = { 'Product': 0.7, 'Country': 0.85, 'Channel': 0.7, 'Month': 0.62, 'Version': 0.67, 'Currency': 1, 'Campaign': 0.08, 'Months Since Launch': 0.5 };
  var TOKENS = [['bg', '#F0EBE1', '#1F1E1D'], ['surface', '#FBF8F3', '#262624'], ['sunk', '#E8E1D4', '#30302E'], ['raise', '#FDFBF7', '#2A2927'], ['ink', '#1F1E1D', '#FAF9F5'], ['ink-2', '#3D3A35', '#E5E3DA'], ['muted', '#655F55', '#B5B3A9'], ['faint', '#857E72', '#8A887F'], ['line', '#DCD4C5', 'rgba(250,249,245,.14)'], ['line-soft', '#E9E2D6', 'rgba(250,249,245,.08)'], ['accent', '#B04F2B', '#D97757'], ['accent-ink', '#FFFDF9', '#1F1E1D'], ['accent-soft', '#F2DDD0', 'rgba(217,119,87,.18)'], ['ok', '#2F6B3F', '#8FC6A0'], ['warn', '#8A5600', '#E5B567'], ['bad', '#A8322B', '#E58F86'], ['k-dim', '#2C6FB8', '#6EA8FF'], ['k-tl', '#2F7D5C', '#4CC496'], ['k-metric', '#7A45D1', '#A36BFF'], ['k-board', '#C7641C', '#FF9A5C'], ['k-set', '#8F5A06', '#E5B567']];

  /* ---------- sample catalog: used only when the host gives no lineage (labelled as sample in the UI) ---------- */
  var SAMPLE = {
    sources: [
      { id: 'raw_tl', system: 'raw', name: 'TRANSACTION_LINES', sub: '2.49M rows', cols: ['TRANSACTION', 'LINE', 'ITEM', 'QUANTITY', 'NETAMOUNT', 'FOREIGNAMOUNT', 'CLASS', 'CAMPAIGN'] },
      { id: 'raw_item', system: 'raw', name: 'ITEMS', sub: '412 rows', cols: ['ID', 'ITEMID', 'DISPLAYNAME', 'CLASS'] },
      { id: 'raw_cust', system: 'raw', name: 'CUSTOMERS', sub: '38K rows', cols: ['ID', 'ENTITYID', 'CATEGORY', 'BILLCOUNTRY', 'SUBSIDIARY'] },
      { id: 'raw_sub', system: 'raw', name: 'SUBSIDIARIES', sub: '24 rows', cols: ['ID', 'NAME', 'COUNTRY', 'CURRENCY'] },
      { id: 'raw_fx', system: 'raw', name: 'CURRENCY_RATES', sub: '18K rows', cols: ['BASECURRENCY', 'TRANSACTIONCURRENCY', 'EXCHANGERATE', 'EFFECTIVEDATE'] },
      { id: 'm_rev', system: 'model', name: 'FCT_NET_REVENUE', sub: '1.31M rows', cols: ['PRODUCT_ID', 'COUNTRY', 'CHANNEL', 'CAMPAIGN', 'MONTH', 'UNITS', 'GROSS_USD', 'NET_USD', 'NET_LC', 'CURRENCY'] },
      { id: 'm_prod', system: 'model', name: 'DIM_PRODUCT', sub: '412 rows', cols: ['PRODUCT_ID', 'NAME', 'CATEGORY', 'RANGE', 'PRICE_TIER', 'LAUNCH_MONTH'] },
      { id: 'm_ctry', system: 'model', name: 'DIM_COUNTRY', sub: '24 rows', cols: ['COUNTRY', 'REGION', 'MARKET_TIER', 'CURRENCY'] },
      { id: 'm_chan', system: 'model', name: 'DIM_CHANNEL', sub: '5 rows', cols: ['CHANNEL'] },
      { id: 'm_fx', system: 'model', name: 'FX_RATES_MONTHLY', sub: '864 rows', cols: ['CURRENCY', 'MONTH', 'AVG_RATE_TO_USD'] },
      { id: 'p_tSales', system: 'pig', name: 'Sales Actuals', block: 'tSales' }, { id: 'p_dProduct', system: 'pig', name: 'Product', block: 'dProduct' },
      { id: 'p_dCountry', system: 'pig', name: 'Country', block: 'dCountry' }, { id: 'p_dChan', system: 'pig', name: 'Channel', block: 'dChan' }
    ],
    edges: [['raw_tl', 'm_rev'], ['raw_cust', 'm_rev'], ['raw_fx', 'm_fx'], ['m_fx', 'm_rev'], ['raw_item', 'm_prod'], ['raw_sub', 'm_ctry'], ['raw_cust', 'm_chan'], ['m_rev', 'p_tSales'], ['m_prod', 'p_dProduct'], ['m_ctry', 'p_dCountry'], ['m_chan', 'p_dChan']],
    blocks: (function () {
      var P = 'Product', C = 'Country', CH = 'Channel', M = 'Month', V = 'Version', a = [];
      var B = function (id, name, kind, dims, deps, formula) { a.push({ id: id, name: name, kind: kind, folder: '', dims: dims, deps: deps, formula: formula || '', says: '' }); };
      B('cMonth', M, 'cal', [], []); B('dProduct', P, 'dim', ['Category', 'Range', 'Price Tier', 'Launch Date'], []); B('dCountry', C, 'dim', ['Region', 'Market Tier', 'Currency'], []);
      B('dChan', CH, 'dim', [], []); B('dVer', V, 'dim', ['Version Type'], []); B('dCur', 'Currency', 'dim', [], []); B('dAge', 'Months Since Launch', 'dim', [], []);
      B('tSales', 'Sales Actuals', 'tl', [], ['dProduct', 'dCountry', 'dChan', 'dCur', 'cMonth']);
      B('mAct', 'Actual Net Revenue USD', 'metric', [P, C, CH, M], ['tSales'], "'Sales Actuals'.'Net Revenue USD'[BY SUM: 'Sales Actuals'.'Product', 'Sales Actuals'.'Country', 'Sales Actuals'.'Channel', 'Sales Actuals'.'Month']");
      B('mUnits', 'Units', 'metric', [P, C, CH, M], ['tSales'], "'Sales Actuals'.'Units'[BY SUM: 'Sales Actuals'.'Product', 'Sales Actuals'.'Country', 'Sales Actuals'.'Channel', 'Sales Actuals'.'Month']");
      B('mBud', 'Budget Net Revenue USD', 'metric', [P, C, CH, M], []); B('mFc', 'Forecast Net Revenue USD', 'metric', [P, C, CH, M], []);
      B('mNR', 'Net Revenue USD', 'metric', [P, C, CH, M, V], ['mAct', 'mBud', 'mFc']);
      B('mPrice', 'Net Price per Unit USD', 'metric', [P, C, CH, M], ['mAct', 'mUnits'], "'Actual Net Revenue USD' / 'Units'");
      B('mUG', 'Unit Growth %', 'metric', [P, C, CH, M], ['mUnits']); B('mPC', 'Price Change %', 'metric', [P, C, CH, M], ['mPrice']);
      B('mLC', 'Actual Net Revenue LC', 'metric', [P, C, CH, M], ['tSales']); B('fxB', 'Budget FX Rate', 'metric', ['Currency', M], []);
      B('fxi', 'FX Impact USD', 'metric', [C, M], ['mLC', 'fxB', 'mAct']); B('sCfg', 'Frame Config', 'metric', ['Frame Setting'], []);
      B('board', 'Revenue Planning', 'board', [], ['mNR', 'fxi']); B('frame', 'Lumina Frame', 'frame', [], ['mNR', 'fxi', 'sCfg']);
      return a;
    })()
  };

  /* ---------- small helpers ---------- */
  function txt(v, max) { v = v == null ? '' : String(v); return v.length > (max || 200) ? v.slice(0, max || 200) : v; }
  function q(n) { return "'" + n + "'"; }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function sv(tag, attrs) { var e = document.createElementNS(SVGNS, tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function clear(e) { while (e && e.firstChild) e.removeChild(e.firstChild); }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function btn(cls, text, fn, title) { var b = h('button', 'as-b' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (title) b.title = title; if (fn) b.addEventListener('click', fn); return b; }
  function fmt(n) { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K'; return String(Math.round(n)); }
  function rowsOf(sub) { var s = String(sub || ''), f = parseFloat(s); if (isNaN(f)) return 0; var i = 0; while (i < s.length && '0123456789.,'.indexOf(s.charAt(i)) >= 0) i++; var u = s.charAt(i); return Math.round(f * (u === 'M' ? 1e6 : u === 'K' ? 1e3 : 1)); }
  function splitList(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 24); }
  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function has(a, x) { return a.indexOf(x) >= 0; }
  function lc(s) { return String(s || '').toLowerCase(); }
  function isLetter(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }
  function strList(a, n, max) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }).slice(0, n).map(function (x) { return txt(x, max || 80); }) : []; }

  /* ---------- the view ---------- */
  var V = null;   // live instance

  function create(root0, ctx) {
    var root = h('div', 'as-root'), timers = [], offs = [], dead = false, uidN = 0;
    var C = buildCatalog();
    var S = { step: 0, intent: { tpl: '', goal: '', notes: '', noSrc: false, reuse: true, budget: '', cons: '' }, model: null, sel: null, mode: '2d', cam2: null, cam3: { rx: -16, ry: 30, k: 0.8, x: 0, y: 0 }, sending: '', sent: '', ai: null, aiBusy: false, saved: '', exp: 'text' };
    var SK = null;   // sketch DOM handles
    var reduced = function () { try { return !!(ctx.motion && ctx.motion.reduced && ctx.motion.reduced()); } catch (e) { return true; } };
    var later = function (fn, ms) { var id = window.setTimeout(function () { if (!dead) fn(); }, ms); timers.push(id); return id; };
    var uid = function (p) { uidN++; return p + uidN.toString(36) + Math.floor(Math.random() * 1296).toString(36); };
    var toast = function (t) { try { if (ctx.toast) ctx.toast(t); } catch (e) {} };
    var say = function (t) { try { if (ctx.say) ctx.say(t); } catch (e) {} };

    /* ----- catalog: what exists today, read from ctx.lineage / ctx.blocks / ctx.data ----- */
    function buildCatalog() {
      var lin = ctx.lineage || {}, blocks = Array.isArray(ctx.blocks) && ctx.blocks.length ? ctx.blocks : Array.isArray(lin.blocks) ? lin.blocks : [];
      var sources = Array.isArray(lin.sources) ? lin.sources : [], edges = Array.isArray(lin.edges) ? lin.edges : [], sample = false;
      if (!sources.length || !blocks.length) { sample = true; sources = SAMPLE.sources; edges = SAMPLE.edges; blocks = SAMPLE.blocks; }
      var c = { sample: sample, sources: [], srcBy: {}, srcName: {}, edges: [], blocks: [], by: {}, byName: {}, feeds: {}, items: {}, volumes: [], widgets: Array.isArray(lin.widgets) ? lin.widgets : [] };
      sources.slice(0, 80).forEach(function (s) {
        if (!s || typeof s.id !== 'string') return;
        var o = { id: txt(s.id, 40), system: txt(s.system || s.col, 12), name: txt(s.name, 80), rows: rowsOf(s.sub), cols: strList(s.cols, 30, 50), block: s.block ? txt(s.block, 40) : '' };
        c.sources.push(o); c.srcBy[o.id] = o; c.srcName[o.name] = o;
      });
      edges.slice(0, 300).forEach(function (e) { if (Array.isArray(e) && c.srcBy[e[0]] && c.srcBy[e[1]]) { c.edges.push([e[0], e[1]]); var t = c.srcBy[e[1]]; if (t.block) (c.feeds[t.block] = c.feeds[t.block] || []).push(e[0]); } });
      blocks.slice(0, 200).forEach(function (b) {
        if (!b || typeof b.id !== 'string' || typeof b.name !== 'string') return;
        var o = { id: txt(b.id, 40), name: txt(b.name, 80), kind: txt(b.kind, 10), dims: strList(b.dims, 12), deps: strList(b.deps, 20, 40), formula: txt(b.formula, 1200), says: txt(b.says, 240) };
        c.blocks.push(o); c.by[o.id] = o; if (!c.byName[o.name]) c.byName[o.name] = o;
      });
      // item counts: defaults, raised by what the frame's data sources actually show
      Object.keys(ITEMS).forEach(function (k) { c.items[k] = ITEMS[k]; });
      var seen = function (ds, ix, dim) { var d = null; try { d = ctx.data && ctx.data.get ? ctx.data.get(ds) : null; } catch (e) { d = null; } if (!d || !Array.isArray(d.rows)) return; var o = {}, n = 0; d.rows.forEach(function (r) { var l = r && r.labels && r.labels[ix]; if (l != null && !o[l]) { o[l] = 1; n++; } }); if (n > (c.items[dim] || 0)) c.items[dim] = n; };
      seen('dsChannel', 0, 'Channel'); seen('dsFx', 0, 'Country'); seen('dsAge', 0, 'Product'); seen('dsTrend', 0, 'Version');
      ['dsTrend', 'dsAvb', 'dsChannel', 'dsAge', 'dsFx', 'dsPvm', 'dsTrendRegion', 'dsAvbRegion', 'dsConfig'].forEach(function (n) { var d = null; try { d = ctx.data && ctx.data.get ? ctx.data.get(n) : null; } catch (e) { d = null; } if (d && Array.isArray(d.rows)) c.volumes.push([n, d.rows.length]); });
      return c;
    }
    function pick(cands) { for (var i = 0; i < cands.length; i++) if (C.byName[cands[i]]) return C.byName[cands[i]]; return null; }
    function pickKind(kind) { for (var i = 0; i < C.blocks.length; i++) if (C.blocks[i].kind === kind) return C.blocks[i]; return null; }

    /* ----- model ----- */
    function nodeBy(id) { var ns = S.model ? S.model.nodes : []; for (var i = 0; i < ns.length; i++) if (ns[i].id === id) return ns[i]; return null; }
    function nodeNamed(name, layer) { var ns = S.model ? S.model.nodes : []; for (var i = 0; i < ns.length; i++) if (ns[i].name === name && !ns[i].off && (!layer || ns[i].layer === layer)) return ns[i]; return null; }
    function live() { return S.model ? S.model.nodes.filter(function (n) { return !n.off; }) : []; }
    function liveEdges() { if (!S.model) return []; return S.model.edges.filter(function (e) { var a = nodeBy(e[0]), b = nodeBy(e[1]); return a && b && !a.off && !b.off; }); }
    function hasEdge(a, b) { return S.model.edges.some(function (e) { return e[0] === a && e[1] === b; }); }
    function link(a, b) { if (a && b && a.id !== b.id && !hasEdge(a.id, b.id)) S.model.edges.push([a.id, b.id]); }
    function unlink(a, b) { S.model.edges = S.model.edges.filter(function (e) { return !(e[0] === a && e[1] === b); }); }
    function mk(layer, name, status, o) {
      var n = { id: uid(layer.charAt(0)), layer: layer, name: txt(name, 80), status: status || 'proposed', off: false, note: '' };
      if (layer === 'src') { n.system = 'model'; n.rows = 0; n.cols = []; }
      if (layer === 'imp') { n.source = ''; n.grain = []; n.keys = []; n.map = []; n.steps = []; n.rows = 0; }
      if (layer === 'dim') { n.items = 10; n.props = []; n.mapSource = ''; n.fill = 0; }
      if (layer === 'met') { n.dims = []; n.formula = ''; n.base = null; n.nd = []; n.input = false; n.agg = 'SUM'; n.manual = false; }
      if (layer === 'out') { n.okind = 'board'; }
      if (o) Object.keys(o).forEach(function (k) { n[k] = o[k]; });
      S.model.nodes.push(n); return n;
    }
    // place an existing Pigment block (by catalog id) on the canvas, with its nearest source
    function place(b) {
      if (!b) return null;
      var ex = S.model.nodes.filter(function (n) { return n.ref === b.id; })[0]; if (ex) { ex.off = false; return ex; }
      var n, feeds = (C.feeds[b.id] || []).map(function (id) { return C.srcBy[id]; });
      if (b.kind === 'dim' || b.kind === 'cal') {
        n = mk('dim', b.name, 'existing', { ref: b.id, items: C.items[b.name] || 12, props: b.dims.slice(), mapSource: feeds[0] ? feeds[0].name + '.' + (feeds[0].cols[0] || '') : (b.kind === 'cal' ? 'Pigment calendar' : 'Manual input') });
      } else if (b.kind === 'tl') {
        var props = b.deps.map(function (d) { return C.by[d] ? C.by[d].name : ''; }).filter(Boolean);
        n = mk('imp', b.name, 'existing', { ref: b.id, grain: props.slice(), keys: props.slice(), props: props, source: feeds[0] ? feeds[0].name : '', rows: feeds[0] ? feeds[0].rows : 0, note: b.says });
        feeds.forEach(function (s) { link(placeSrc(s), n); });
      } else if (b.kind === 'metric' || b.kind === 'set') {
        n = mk('met', b.name, 'existing', { ref: b.id, dims: b.dims.slice(), nd: b.dims.slice(), formula: b.formula, input: !b.formula && !b.deps.length, agg: (has(lc(b.name).split(' '), 'pct') || b.name.indexOf('%') >= 0 || has(lc(b.name).split(' '), 'rate')) ? 'RATIO' : 'SUM' });
        n.base = { t: 'expr', expr: b.formula || q(b.name) };
      } else {
        n = mk('out', b.name, 'existing', { ref: b.id, okind: b.kind === 'frame' ? 'frame' : b.kind === 'table' ? 'table' : 'board', note: b.says });
      }
      // connect to anything already on the canvas that it reads, or that reads it
      S.model.nodes.forEach(function (o) {
        if (!o.ref || o === n) return; var ob = C.by[o.ref]; if (!ob) return;
        if (has(b.deps, o.ref) && o.layer !== 'dim' && LAYER_IX[o.layer] <= LAYER_IX[n.layer]) link(o, n);
        if (has(ob.deps, b.id) && n.layer !== 'dim' && LAYER_IX[n.layer] <= LAYER_IX[o.layer]) link(n, o);
      });
      return n;
    }
    function placeSrc(s) {
      if (!s) return null;
      var ex = S.model.nodes.filter(function (n) { return n.layer === 'src' && n.name === s.name; })[0]; if (ex) { ex.off = false; return ex; }
      return mk('src', s.name, 'existing', { sref: s.id, system: s.system, rows: s.rows, cols: s.cols.slice() });
    }

    /* ----- cube maths ----- */
    function dimItems(name) { var d = nodeNamed(name, 'dim'); if (d) return Math.max(1, Number(d.items) || 1); return C.items[name] || 10; }
    function dimFill(name) { var d = nodeNamed(name, 'dim'); if (d && d.fill > 0) return Math.min(1, d.fill); if (FILL[name]) return FILL[name]; var n = dimItems(name); return n > 5000 ? 0.03 : n > 500 ? 0.1 : n > 40 ? 0.4 : 0.8; }
    function cube(n, dims) {
      dims = dims || n.dims || []; var dense = 1, fill = 1;
      dims.forEach(function (d) { dense *= dimItems(d); fill *= dimFill(d); });
      var sparse = Math.max(1, Math.round(dense * fill));
      if (n.base && n.base.t === 'tl') { var l = nodeNamed(n.base.list, 'imp'); if (l && l.rows > 0) sparse = Math.min(sparse, l.rows); }
      if (n.input) sparse = Math.max(1, Math.round(dense * Math.min(1, fill * 1.5)));
      return { dense: dense, sparse: Math.min(dense, sparse), pct: dense ? Math.min(dense, sparse) / dense : 1 };
    }
    function listProps(l) { return uniq((l.props || []).concat((l.map || []).map(function (m) { return m[1]; })).concat(l.grain || [])); }
    // draft a Pigment formula for a metric from its base and its current dimensions
    function draft(n, dims) {
      dims = dims || n.dims; var b = n.base;
      if (n.input || !b) return n.input ? '' : n.formula;
      if (b.t === 'tl') return q(b.list) + '.' + q(b.value) + '[BY ' + (b.agg || 'SUM') + ': ' + dims.map(function (d) { return q(b.list) + '.' + q(d); }).join(', ') + ']';
      var nd = n.nd || [], removed = nd.filter(function (d) { return !has(dims, d); }), added = dims.filter(function (d) { return !has(nd, d); }), by = [], addm = [];
      added.forEach(function (a) {
        var via = null; removed.forEach(function (r) { var dn = nodeNamed(r, 'dim'); if (!via && dn && has(dn.props || [], a)) via = r; });
        if (via) { by.push(q(via) + '.' + q(a)); removed = removed.filter(function (r) { return r !== via; }); } else addm.push(q(a));
      });
      if (!by.length && !removed.length && !addm.length) return b.expr;
      var e = b.expr, plain = e.charAt(0) === "'" && e.charAt(e.length - 1) === "'" && e.split("'").length === 3;
      var agg = n.agg === 'AVG' ? 'AVG' : 'SUM';
      return (plain ? e : '(' + e + ')') + (by.length ? '[BY ' + agg + ': ' + by.join(', ') + ']' : '') + (removed.length ? '[REMOVE ' + agg + ': ' + removed.map(q).join(', ') + ']' : '') + (addm.length ? '[ADD: ' + addm.join(', ') + ']' : '');
    }
    function setDims(n, dims) { n.dims = uniq(dims).slice(0, 10); if (!n.manual) n.formula = draft(n); if (n.status === 'existing') n.status = 'changed'; }
    function refNames(f) { var p = String(f || '').split("'"), r = []; for (var i = 1; i < p.length; i += 2) if (p[i]) r.push(p[i]); return uniq(r); }
    function knownName(nm) {
      if (C.byName[nm] || nodeNamed(nm)) return true; var ok = false;
      live().forEach(function (n) { if (n.layer === 'dim' && has(n.props || [], nm)) ok = true; if (n.layer === 'imp' && (has(listProps(n), nm) || (n.values || []).indexOf(nm) >= 0)) ok = true; });
      if (!ok) C.blocks.forEach(function (b) { if ((b.kind === 'dim' || b.kind === 'tl') && has(b.dims, nm)) ok = true; });
      return ok || nm === 'Start Date' || nm === 'End Date' || nm === 'Name';
    }

    /* ----- diagnosis: conflicts and hints per node (also feeds Validate) ----- */
    function diagNode(n, dimsOverride) {
      var r = [], P = function (sev, code, text) { r.push({ node: n.id, sev: sev, code: code, text: text }); };
      var isNew = n.status !== 'existing';
      if (n.layer === 'src' && n.status === 'proposed') P('info', 'src', 'New source: not in the lineage today. Needs data engineering before Pigment can import it.');
      if (n.layer === 'dim' && isNew) {
        if (!n.mapSource) P('bad', 'map', 'Dimension is not mapped from a source: choose a table column or mark it as manual input.');
        else if (n.mapSource.indexOf('.') > 0) { var tb = n.mapSource.split('.')[0], col = n.mapSource.split('.')[1], sn = nodeNamed(tb, 'src') || C.srcName[tb]; if (!sn) P('warn', 'map', 'Mapping source ' + tb + ' is not in the lineage.'); else if (col && !has(sn.cols || [], col)) P('warn', 'map', 'Column ' + col + ' is not in ' + tb + ' today: a source change is needed.'); }
        if (n.items > 20000) P('info', 'perf', fmt(n.items) + ' items: keep metrics on this dimension sparse and avoid ADD without a driver.');
      }
      if (n.layer === 'imp' && isNew) {
        var s = nodeNamed(n.source, 'src');
        if (!n.source || !s) P('bad', 'imp', 'Import has no source table on the canvas.');
        if (!n.keys.length) P('bad', 'keys', 'Import has no unique keys: re-imports would duplicate rows.');
        if (!n.grain.length) P('warn', 'grain', 'Grain is not stated: say what one row means.');
        if (s) n.map.forEach(function (m) { if (!has(s.cols || [], m[0])) P(s.status === 'existing' ? 'bad' : 'warn', 'col', 'Column ' + m[0] + ' is not in ' + s.name + (s.status === 'existing' ? ': change the source (mark it Changed and add the column) or remap.' : ' yet.')); });
        n.grain.forEach(function (g) { if (!nodeNamed(g, 'dim') && !C.byName[g]) P('bad', 'dim', 'Grain dimension ' + g + ' does not exist in the model or the design.'); });
      }
      if (n.layer === 'met') {
        var dims = dimsOverride || n.dims, f = dimsOverride ? draft(n, dims) : n.formula, cb = cube(n, dims), up = f.toUpperCase();
        if (isNew || dimsOverride) {
          if (!n.input && !f.trim()) P('bad', 'formula', 'No formula yet: write one or mark the metric as an input.');
          dims.forEach(function (d) { if (!nodeNamed(d, 'dim') && !(C.byName[d] && (C.byName[d].kind === 'dim' || C.byName[d].kind === 'cal'))) P('bad', 'dim', 'Dimension ' + d + ' does not resolve to a list.'); });
          if (n.base && n.base.t === 'tl') { var l = nodeNamed(n.base.list, 'imp'); if (l) dims.forEach(function (d) { if (!has(listProps(l), d)) P('bad', 'map', q(n.base.list) + ' has no ' + d + ' property: map a source column to it first.'); }); }
          var ndd = n.nd || [], rem = ndd.some(function (d) { return !has(dims, d); }), adn = dims.some(function (d) { return !has(ndd, d); });
          if (n.base && n.base.t === 'expr' && !n.manual) {
            if (adn && up.indexOf('[ADD:') >= 0) P('warn', 'agg', 'ADD repeats the value across the new dimension. Without an allocation driver the totals multiply.');
            if (n.agg === 'RATIO' && (rem || adn) && (up.indexOf('[REMOVE SUM') >= 0 || up.indexOf('[BY SUM') >= 0)) P('bad', 'agg', 'Aggregation mismatch: a ratio cannot be summed. Recompute it from its numerator and denominator at the new grain.');
          }
          refNames(f).forEach(function (nm) { if (!knownName(nm)) P('warn', 'ref', 'Formula references ' + q(nm) + ', which is not in the model or this design.'); });
          if (n.name.indexOf('%') >= 0) P('warn', 'name', 'Naming: avoid % in block names; use the Pct suffix.');
          else if (n.status === 'proposed') { var w = n.name.split(' ')[0]; if (!(w.length >= 2 && w.length <= 4 && w === w.toUpperCase())) P('info', 'name', 'Naming: existing metrics start with a short prefix (ACT, BUD, FC...). Consider one here.'); }
          var dup = live().filter(function (o) { return o !== n && o.name === n.name; }).length || (n.status === 'proposed' && C.byName[n.name]);
          if (dup) P('bad', 'name', 'Name is already used by another block.');
          if (cb.dense > 5e7) P('warn', 'perf', 'Dense cube of ' + fmt(cb.dense) + ' cells. Keep it sparse or drop a dimension.');
          if (up.indexOf('IF(') >= 0 && up.indexOf('IFDEFINED') < 0 && up.indexOf('ISDEFINED') < 0 && up.indexOf('ISBLANK') < 0 && cb.dense > 1e5) P('warn', 'perf', 'Dense IF: the condition is evaluated on every cell. Guard with IFDEFINED / ISDEFINED or scope with FILTER.');
          if (f.split(' ').join('').indexOf(',0)') >= 0) P('warn', 'perf', 'Returning 0 instead of BLANK densifies the cube.');
          var budget = parseFloat(S.intent.budget); if (budget > 0 && cb.dense > budget * 1e6) P('warn', 'cons', 'Exceeds your constraint of ' + budget + 'M dense cells per metric.');
        }
      }
      if (n.layer === 'out' && isNew && !liveEdges().some(function (e) { return e[1] === n.id; })) P('warn', 'out', 'Output reads nothing yet: connect a metric to it.');
      if (n.layer === 'met' && n.status === 'proposed' && !dimsOverride && !liveEdges().some(function (e) { return e[0] === n.id; })) P('info', 'orphan', 'Nothing reads this metric yet.');
      if (S.intent.noSrc && n.layer === 'src' && n.status !== 'existing') P('warn', 'cons', 'Breaks your constraint: no new or changed source tables.');
      return r;
    }
    function diagAll() { var r = []; live().forEach(function (n) { r = r.concat(diagNode(n)); }); return r; }
    function worst(list) { var s = ''; list.forEach(function (p) { if (p.sev === 'bad') s = 'bad'; else if (p.sev === 'warn' && s !== 'bad') s = 'warn'; }); return s; }

    /* ----- templates: deterministic head starts ----- */
    var TPL = [
      { id: 'driver', title: 'Add a driver-based forecast by channel', goal: 'Forecast net revenue by channel from unit-growth and price-change drivers, and show it next to actuals and budget.', kpis: 'Forecast net revenue by channel' + NL + 'Forecast vs budget variance %' + NL + 'Unit growth % by channel', words: ['forecast', 'driver', 'growth', 'outlook', 'landing', 'run rate'] },
      { id: 'margin', title: 'Introduce customer-level margin', goal: 'See gross margin per customer and customer segment, from invoiced revenue and standard cost.', kpis: 'Gross margin % by customer segment' + NL + 'Top 20 customers by margin' + NL + 'Margin by product and customer', words: ['margin', 'customer', 'cogs', 'cost', 'profit', 'segment'] },
      { id: 'hedge', title: 'Scenario for FX hedging', goal: 'Compare net revenue in USD under hedging scenarios and rate shocks, by country and currency.', kpis: 'Net revenue USD by scenario' + NL + 'FX impact vs budget rate by scenario' + NL + 'Hedge ratio by currency', words: ['fx', 'hedg', 'currency', 'scenario', 'exchange', 'rate shock'] },
      { id: 'capacity', title: 'Headcount-to-revenue capacity', goal: 'Tie sales headcount to revenue capacity by country and channel, and show utilisation and hiring gap.', kpis: 'Revenue capacity vs actual by country' + NL + 'Utilisation % by channel' + NL + 'Hiring gap in FTE', words: ['headcount', 'capacity', 'fte', 'hiring', 'workforce', 'utilisation', 'utilization', 'people'] }
    ];
    function tplBy(id) { for (var i = 0; i < TPL.length; i++) if (TPL[i].id === id) return TPL[i]; return null; }
    function matchTpl(text) { var t = lc(text), best = null, bs = 0; TPL.forEach(function (T) { var s = 0; T.words.forEach(function (w) { if (t.indexOf(w) >= 0) s++; }); if (s > bs) { bs = s; best = T; } }); return best; }
    function understood() {
      var it = S.intent, T = tplBy(it.tpl) || matchTpl(it.goal + ' ' + it.notes), text = it.notes, lines = [], kp = [], dims = [];
      text.split(NL).forEach(function (l) { l.split(';').forEach(function (x) { x = x.trim(); while (x.charAt(0) === '-' || x.charAt(0) === '*') x = x.slice(1).trim(); if (x.length >= 4 && x.length <= 110) lines.push(x); }); });
      var keys = ['margin', 'revenue', 'growth', '%', 'pct', 'units', 'price', 'forecast', 'variance', 'capacity', 'headcount', 'fte', 'hedg', 'fx', 'cost', ' by ', 'kpi', 'top '];
      lines.forEach(function (l) { var t = lc(l); if (keys.some(function (k) { return t.indexOf(k) >= 0; }) && kp.length < 8) kp.push(l); });
      var all = lc(it.goal + ' ' + it.notes);
      C.blocks.forEach(function (b) { if ((b.kind === 'dim' || b.kind === 'cal') && all.indexOf(lc(b.name)) >= 0) dims.push(b.name); b.dims.forEach(function (p) { if ((b.kind === 'dim') && p.length > 3 && all.indexOf(lc(p)) >= 0) dims.push(p); }); });
      ['Customer', 'Scenario', 'Role', 'Customer Segment'].forEach(function (d) { if (all.indexOf(lc(d)) >= 0) dims.push(d); });
      return { tpl: T, kpis: kp, dims: uniq(dims).slice(0, 12) };
    }
    function scan() {
      var U = understood(), T = U.tpl, P = 'Product', CO = 'Country', CH = 'Channel', MO = 'Month';
      S.model = { nodes: [], edges: [] }; S.sel = null; S.sent = ''; S.ai = null; S.cam2 = null;
      var nm = function (c, fb) { var b = pick(c); return b ? b.name : fb; }, ex = function (c) { return place(pick(c)); };
      var src = function (name) { return placeSrc(C.srcName[name]); };
      var dimEx = function (name) { return place(C.byName[name] && (C.byName[name].kind === 'dim' || C.byName[name].kind === 'cal') ? C.byName[name] : null); };
      var met = function (name, dims, formula, o) { var n = mk('met', name, 'proposed', { dims: dims, nd: dims.slice(), formula: formula || '', base: formula ? { t: 'expr', expr: formula } : null }); if (o) Object.keys(o).forEach(function (k) { n[k] = o[k]; }); if (n.base && n.base.t === 'tl') n.formula = draft(n); refNames(n.formula).forEach(function (r) { var a = nodeNamed(r); if (a && a !== n && a.layer !== 'dim' && a.layer !== 'out') link(a, n); }); return n; };
      var NET = nm(['ACT Net Revenue USD', 'Actual Net Revenue USD', 'Net Revenue USD'], 'ACT Net Revenue USD'), UNITS = nm(['ACT Units', 'Units'], 'ACT Units');
      [P, CO, CH, MO].forEach(dimEx);
      var sales = ex(['Sales Actuals']), net = ex([NET]), board = place(pickKind('board')), frame = place(pickKind('frame'));
      var out = function (name, kind, reads, note) { var o = mk('out', name, 'proposed', { okind: kind, note: note || '' }); reads.forEach(function (m) { link(m, o); }); return o; };
      var chFrame = function (reads, note) { if (frame) { frame.status = 'changed'; frame.note = note; reads.forEach(function (m) { link(m, frame); }); } };
      if (T && T.id === 'driver') {
        var units = ex([UNITS]), ver = dimEx('Version'), vm = ex(['Net Revenue USD by Version', 'Net Revenue USD']);
        var ug = ex(['Unit Growth %']), pc = ex(['Price Change %']);
        var G = ug ? ug.name : 'FC Unit Growth Pct', PC = pc ? pc.name : 'FC Price Change Pct';
        if (!ug) met(G, [CH, MO], '', { input: true, agg: 'RATIO', note: 'Planner input: expected unit growth vs the same month last year.' });
        if (!pc) met(PC, [CH, MO], '', { input: true, agg: 'RATIO', note: 'Planner input: expected net price change vs last year.' });
        met('FC Units', [P, CO, CH, MO], 'IF(ISDEFINED(' + q(UNITS) + '), ' + q(UNITS) + ', ' + q(UNITS) + "[SELECT: 'Month' - 12] * (1 + " + q(G) + '))');
        met('FC Net Price per Unit USD', [P, CO, CH, MO], '(' + q(NET) + ' / ' + q(UNITS) + ")[SELECT: 'Month' - 12] * (1 + " + q(PC) + ')', { agg: 'RATIO' });
        var fc = met('FC Net Revenue USD', [P, CO, CH, MO], 'IF(ISDEFINED(' + q(NET) + '), ' + q(NET) + ", 'FC Units' * 'FC Net Price per Unit USD')");
        var fch = met('FC Net Revenue USD by Channel', [CH, MO], "'FC Net Revenue USD'[REMOVE SUM: 'Product', 'Country']"); fch.base = { t: 'expr', expr: "'FC Net Revenue USD'" }; fch.nd = [P, CO, CH, MO];
        if (ver) { ver.status = 'changed'; ver.note = 'Add a Forecast item (and a Version Type of Forecast) if it is not there yet.'; }
        if (vm && has(vm.dims, 'Version')) { vm.status = 'changed'; vm.was = vm.formula; vm.manual = true; if (!pick(['SET Forecast Version'])) link(met('SET Forecast Version', [], '', { input: true, note: 'A setting that points at the Forecast item, so no formula hard-codes it.' }), vm); vm.formula = (vm.formula ? vm.formula : '<existing formula>') + " + 'FC Net Revenue USD'" + (has(vm.dims, CH) ? '' : "[REMOVE SUM: 'Channel']") + "[BY SUM: -> 'SET Forecast Version']"; link(fc, vm); vm.note = 'One more term puts the forecast on the Version dimension; every view of it gains a line.'; }
        out('Forecast by Channel', 'board', [fch, fc], 'New board: drivers grid (inputs) on the left, forecast vs budget by channel on the right.');
        chFrame([fch], 'New data source dsForecastChannel (labels Channel, Month) feeding the channel widget.');
      } else if (T && T.id === 'margin') {
        var fct = src('FCT_NET_REVENUE'), cust = src('CUSTOMERS'), prodS = src('DIM_PRODUCT');
        var cost = mk('src', 'FCT_STANDARD_COST', 'proposed', { system: 'model', rows: 7400, cols: ['PRODUCT_ID', 'MONTH', 'UNIT_COST_USD'], note: 'Proposed dbt model: standard unit cost per product per month.' });
        mk('dim', 'Customer', 'proposed', { items: cust ? cust.rows || 38000 : 38000, props: ['Customer Segment', CH, CO], mapSource: 'CUSTOMERS.ENTITYID', fill: 0.03, note: 'Hierarchy: Customer > Customer Segment. Channel and Country come from the customer record.' });
        mk('dim', 'Customer Segment', 'proposed', { items: 5, props: [], mapSource: '', fill: 0.9, note: 'No segment column exists in CUSTOMERS today.' });
        var cs = mk('imp', 'Customer Sales', 'proposed', { source: 'FCT_NET_REVENUE', rows: 420000, grain: ['Customer', P, MO], keys: ['CUSTOMER_ID', 'PRODUCT_ID', 'MONTH'], map: [['CUSTOMER_ID', 'Customer'], ['PRODUCT_ID', P], ['MONTH', MO], ['UNITS', 'Units'], ['NET_USD', 'Net Revenue USD']], values: ['Units', 'Net Revenue USD'],
          steps: ['Join FCT_NET_REVENUE to CUSTOMERS on the customer key (dbt), so each invoiced line carries CUSTOMER_ID', 'Filter: invoiced lines only, MONTH from Jan 2024', 'Aggregate: line grain to Customer x Product x Month (SUM UNITS, SUM NET_USD)', 'FX: NET_USD is already converted with FX_RATES_MONTHLY upstream; no conversion in Pigment'] });
        link(fct, cs); if (cust) link(cust, nodeNamed('Customer', 'dim'));
        var uc = mk('imp', 'Unit Costs', 'proposed', { source: 'FCT_STANDARD_COST', rows: 7400, grain: [P, MO], keys: ['PRODUCT_ID', 'MONTH'], map: [['PRODUCT_ID', P], ['MONTH', MO], ['UNIT_COST_USD', 'Unit Cost USD']], values: ['Unit Cost USD'], steps: ['Aggregate: one row per product per month (AVG of UNIT_COST_USD)', 'Map PRODUCT_ID to the Product dimension by its unique id property'] });
        link(cost, uc); if (prodS) prodS.off = true;
        var m1 = met('CUS Net Revenue USD', ['Customer', P, MO], '', { base: { t: 'tl', list: 'Customer Sales', value: 'Net Revenue USD', agg: 'SUM' } }); link(cs, m1);
        var m2 = met('CUS Units', ['Customer', P, MO], '', { base: { t: 'tl', list: 'Customer Sales', value: 'Units', agg: 'SUM' } }); link(cs, m2);
        var m3 = met('CUS Standard Unit Cost USD', [P, MO], '', { base: { t: 'tl', list: 'Unit Costs', value: 'Unit Cost USD', agg: 'AVG' }, agg: 'AVG' }); link(uc, m3);
        met('CUS COGS USD', ['Customer', P, MO], "'CUS Units' * 'CUS Standard Unit Cost USD'");
        met('CUS Gross Margin USD', ['Customer', P, MO], "'CUS Net Revenue USD' - 'CUS COGS USD'");
        var gp = met('CUS Gross Margin Pct', ['Customer', P, MO], "'CUS Gross Margin USD' / 'CUS Net Revenue USD'", { agg: 'RATIO', note: 'Set the view aggregator to Ratio so totals are true margins.' });
        var seg = met('CUS Gross Margin USD by Segment', ['Customer Segment', MO], "'CUS Gross Margin USD'[BY SUM: 'Customer'.'Customer Segment'][REMOVE SUM: 'Product']"); seg.base = { t: 'expr', expr: "'CUS Gross Margin USD'" }; seg.nd = ['Customer', P, MO];
        out('Customer Margin', 'board', [gp, seg, nodeNamed('CUS Gross Margin USD')], 'New board: margin by segment, top customers table, product x customer heat grid.');
        chFrame([seg], 'New data source dsMarginSegment (labels Customer Segment, Month) for a margin widget.');
      } else if (T && T.id === 'hedge') {
        src('FX_RATES_MONTHLY'); dimEx('Currency');
        var LCN = nm(['ACT Net Revenue LC by Country', 'Actual Net Revenue LC', 'ACT Net Revenue LC'], 'ACT Net Revenue LC by Country'), FXA = nm(['ACT FX Rate', 'Actual FX Rate', 'Budget FX Rate'], 'ACT FX Rate'), CCN = nm(['ACT Net Revenue USD at Budget FX'], '');
        var lcn = ex([LCN]); ex([FXA]); ex(['BUD FX Rate', 'Budget FX Rate']); ex(['FX Impact USD']); if (CCN) ex([CCN]);
        mk('dim', 'Scenario', 'proposed', { items: 4, props: [], mapSource: 'Manual input', fill: 1, note: 'Items: Base, Hedged 50%, Hedged 100%, Spot shock -10%.' });
        met('HDG Hedge Ratio Pct', ['Currency', MO, 'Scenario'], '', { input: true, agg: 'RATIO', note: 'Treasury input: share of exposure covered by forwards.' });
        met('HDG Hedged Rate', ['Currency', MO], '', { input: true, agg: 'AVG', note: 'Treasury input: the contracted forward rate.' });
        met('HDG Rate Shock Pct', ['Currency', 'Scenario'], '', { input: true, agg: 'RATIO' });
        met('HDG Effective FX Rate', ['Currency', MO, 'Scenario'], "'HDG Hedge Ratio Pct' * 'HDG Hedged Rate' + (1 - 'HDG Hedge Ratio Pct') * " + q(FXA) + " * (1 + 'HDG Rate Shock Pct')", { agg: 'AVG' });
        var lcExpr = lcn && has(lcn.dims, P) ? q(LCN) + "[REMOVE SUM: 'Product', 'Channel']" : q(LCN);
        var hn = met('HDG Net Revenue USD', [CO, MO, 'Scenario'], lcExpr + " / 'HDG Effective FX Rate'[BY CONSTANT: 'Country'.'Currency']");
        var hi = met('HDG FX Impact USD', [CO, MO, 'Scenario'], "'HDG Net Revenue USD' - " + (CCN ? q(CCN) : q(NET) + "[REMOVE SUM: 'Product', 'Channel']"));
        out('FX Hedging Scenarios', 'board', [hn, hi], 'New board: Scenario selector, hedge inputs grid, revenue and FX impact by scenario.');
        chFrame([hi], 'FX widget gains a Scenario selector: new data source dsFxScenario (labels Country, Scenario).');
      } else if (T && T.id === 'capacity') {
        var hr = mk('src', 'HR_HEADCOUNT_MONTHLY', 'proposed', { system: 'model', rows: 21000, cols: ['EMPLOYEE_ID', 'ROLE', 'COUNTRY', 'CHANNEL', 'MONTH', 'FTE'], note: 'Proposed table from the HRIS: not in the lineage today.' });
        mk('dim', 'Role', 'proposed', { items: 8, props: [], mapSource: 'HR_HEADCOUNT_MONTHLY.ROLE', fill: 0.6, note: 'Sales roles: AE, SDR, Channel Manager, Retail Lead...' });
        link(hr, nodeNamed('Role', 'dim'));
        var hl = mk('imp', 'Headcount', 'proposed', { source: 'HR_HEADCOUNT_MONTHLY', rows: 21000, grain: ['Role', CO, CH, MO], keys: ['EMPLOYEE_ID', 'MONTH'], map: [['ROLE', 'Role'], ['COUNTRY', CO], ['CHANNEL', CH], ['MONTH', MO], ['FTE', 'FTE']], values: ['FTE'], steps: ['Filter: sales roles only, active employees', 'Aggregate: employee rows keep their grain; Pigment sums FTE by Role x Country x Channel x Month', 'Map COUNTRY and CHANNEL codes to existing Pigment items (check unmatched values)'] });
        link(hr, hl);
        var fte = met('CAP FTE', ['Role', CO, CH, MO], '', { base: { t: 'tl', list: 'Headcount', value: 'FTE', agg: 'SUM' } }); link(hl, fte);
        met('CAP Productivity USD per FTE', ['Role', CH], '', { input: true, agg: 'AVG', note: 'Input: monthly net revenue one FTE can carry.' });
        var cap = met('CAP Revenue Capacity USD', [CO, CH, MO], "('CAP FTE' * 'CAP Productivity USD per FTE')[REMOVE SUM: 'Role']");
        var ut = met('CAP Utilisation Pct', [CO, CH, MO], q(NET) + "[REMOVE SUM: 'Product'] / 'CAP Revenue Capacity USD'", { agg: 'RATIO' });
        var gap = met('CAP Hiring Gap FTE', [CO, CH, MO], '(' + q(NET) + "[REMOVE SUM: 'Product'] - 'CAP Revenue Capacity USD') / 'CAP Productivity USD per FTE'[REMOVE AVG: 'Role']");
        out('Capacity Planning', 'board', [cap, ut, gap], 'New board: capacity vs actual by country, utilisation heat grid, hiring gap table.');
        chFrame([ut], 'New data source dsCapacity (labels Country, Month) for a capacity-vs-revenue widget.');
      } else if (board && net) link(net, board);
      // KPIs from the meeting notes that no proposed metric covers become placeholders the architect completes
      var stop = ['the', 'and', 'for', 'with', 'from', 'top', 'show', 'want', 'need', 'see', 'per', 'net', 'usd', 'vs'], made = 0;
      U.kpis.forEach(function (k) {
        var words = lc(k).split(' ').map(function (w) { var o = ''; for (var i = 0; i < w.length; i++) if (isLetter(w.charAt(i))) o += w.charAt(i); return o; }).filter(function (w) { return w.length > 2 && !has(stop, w); });
        var covered = live().some(function (n) { if (n.layer !== 'met' || n.status === 'existing') return false; var t = lc(n.name), hit = 0; words.forEach(function (w) { if (t.indexOf(w.slice(0, 6)) >= 0) hit++; }); return hit >= (T ? 1 : Math.min(2, words.length)); });
        if (covered || made >= 3 || !words.length) return;
        var dims = []; live().forEach(function (n) { if (n.layer === 'dim' && lc(k).indexOf(lc(n.name)) >= 0) dims.push(n.name); }); if (!has(dims, MO)) dims.push(MO);
        var name = 'NEW ' + words.slice(0, 4).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
        if (nodeNamed(name)) return; made++;
        var pm = mk('met', name, 'proposed', { dims: dims, nd: dims.slice(), note: 'From your notes: ' + txt(k, 110) + '. Needs a formula.' }); if (board) link(pm, board);
      });
      S.tplUsed = T ? T.id : '';
    }

    /* ----- build plan ----- */
    function topoMetrics() {
      var ms = live().filter(function (n) { return n.layer === 'met'; }), done = {}, out = [], guard = 0, E = liveEdges();
      while (out.length < ms.length && guard++ < 200) ms.forEach(function (m) { if (done[m.id]) return; var ok = E.every(function (e) { if (e[1] !== m.id) return true; var a = nodeBy(e[0]); return !a || a.layer !== 'met' || done[a.id] || guard > 100; }); if (ok) { done[m.id] = 1; out.push(m); } });
      return out;
    }
    function plan() {
      var st = [], E = liveEdges(), push = function (phase, action, tool, target, detail) { st.push({ n: st.length + 1, phase: phase, action: action, tool: tool, target: target, detail: detail }); };
      var L = function (layer) { return live().filter(function (n) { return n.layer === layer && n.status !== 'existing'; }); };
      L('src').forEach(function (n) { push('Sources', n.status === 'proposed' ? 'Request new source table' : 'Request source change', 'outside Pigment (data engineering)', n.name, 'Columns: ' + n.cols.join(', ') + (n.note ? '. ' + n.note : '')); });
      L('dim').forEach(function (n) {
        if (n.status === 'changed') { push('Dimensions', 'Update dimension', 'add_list_items / create_list_property', n.name, n.note || 'Review items and properties.'); return; }
        push('Dimensions', 'Create dimension list', 'create_list', n.name, '~' + fmt(n.items) + ' items. Load from ' + (n.mapSource || 'NOT MAPPED') + '.' + (n.note ? ' ' + n.note : ''));
        (n.props || []).forEach(function (p) { push('Dimensions', 'Add property', 'create_list_property', n.name + '.' + p, 'Dimension-typed property pointing at ' + q(p) + (nodeNamed(p, 'dim') || C.byName[p] ? '' : ' (create that list first)') + '.'); });
      });
      L('imp').forEach(function (n) {
        push('Imports', n.status === 'proposed' ? 'Create transaction list' : 'Update transaction list', 'create_list', n.name, 'Grain: ' + n.grain.join(' x ') + '. Unique keys: ' + (n.keys.join(' + ') || 'NONE') + '.');
        push('Imports', 'Configure import mapping', 'import configuration (Pigment UI / connector)', n.name, 'Source ' + (n.source || '?') + ': ' + n.map.map(function (m) { return m[0] + ' ' + ARROW + ' ' + m[1]; }).join('; '));
        n.steps.forEach(function (s) { push('Imports', 'Transformation', 'upstream (dbt) or import', n.name, s); });
      });
      topoMetrics().forEach(function (n) {
        if (n.status === 'existing') return;
        if (n.status === 'changed') push('Metrics', 'Update metric', 'bulk_update_metrics', n.name, 'Dimensions: ' + n.dims.join(', ') + '. Formula: ' + n.formula);
        else push('Metrics', n.input ? 'Create input metric' : 'Create metric', 'create_metric', n.name, 'Dimensions: ' + n.dims.join(', ') + '. ' + (n.input ? 'User input, no formula.' : 'Formula: ' + n.formula) + (n.agg === 'RATIO' ? ' Default aggregator: Ratio / none.' : ''));
      });
      L('out').forEach(function (n) {
        var reads = E.filter(function (e) { return e[1] === n.id; }).map(function (e) { return nodeBy(e[0]).name; });
        push('Outputs', n.status === 'proposed' ? (n.okind === 'frame' ? 'Create frame' : 'Create board') : (n.okind === 'frame' ? 'Update frame data sources' : 'Update board'), n.okind === 'frame' ? (n.status === 'proposed' ? 'create_frame' : 'update_frame') : (n.status === 'proposed' ? 'create_board' : 'update_board_widgets'), n.name, (n.note ? n.note + ' ' : '') + 'Reads: ' + (reads.join(', ') || 'nothing yet') + '.');
      });
      if (st.length) { push('Verify', 'Validate every formula', 'validate_formula', 'all new metrics', 'Run before saving; fix dimension alignment errors.'); push('Verify', 'Check performance', 'get_blocks_performance', 'new metrics', 'Compare populated cells with the Studio estimate; investigate anything dense.'); }
      return st;
    }
    function planText(st) {
      var o = ['ARCHITECTURE STUDIO BUILD PLAN', 'Goal: ' + (S.intent.goal || '(not stated)'), 'Application: Revenue Planning' + (C.sample ? ' (sample catalog)' : ''), 'Status: DRAFT design. Nothing has been written to Pigment.', ''], ph = '';
      st.forEach(function (s) { if (s.phase !== ph) { ph = s.phase; o.push('== ' + ph + ' =='); } o.push(s.n + '. ' + s.action + ': ' + s.target); o.push('   tool: ' + s.tool); o.push('   ' + s.detail); });
      var d = diagAll().filter(function (p) { return p.sev === 'bad'; });
      if (d.length) { o.push(''); o.push('== Open conflicts (' + d.length + ') =='); d.forEach(function (p) { o.push('- ' + nodeBy(p.node).name + ': ' + p.text); }); }
      return o.join(NL);
    }
    function planJson(st) {
      return JSON.stringify({ schema: 'lumina.architect.plan/1', goal: S.intent.goal, template: S.tplUsed || null, draft: true, instructions: 'Execute in order with the Pigment MCP. Validate each formula before saving. Ask before any destructive change.',
        nodes: live().filter(function (n) { return n.status !== 'existing'; }).map(function (n) { var o = { layer: n.layer, name: n.name, status: n.status }; if (n.layer === 'met') { o.dimensions = n.dims; o.formula = n.formula; o.input = !!n.input; o.aggregation = n.agg; var c = cube(n); o.cells = { dense: c.dense, expectedPopulated: c.sparse }; } if (n.layer === 'dim') { o.items = n.items; o.properties = n.props; o.mappingSource = n.mapSource; } if (n.layer === 'imp') { o.source = n.source; o.grain = n.grain; o.keys = n.keys; o.mapping = n.map.map(function (m) { return { column: m[0], property: m[1] }; }); o.transformations = n.steps; } if (n.layer === 'src') { o.columns = n.cols; } if (n.note) o.note = n.note; return o; }),
        reads: liveEdges().map(function (e) { return { from: nodeBy(e[0]).name, to: nodeBy(e[1]).name }; }), steps: st }, null, 2);
    }

    /* ----- persistence (schema-validated both ways) ----- */
    function pack() {
      var o = { v: 1, step: S.step, mode: S.mode, tplUsed: S.tplUsed || '', sent: S.sent, intent: S.intent, nodes: null, edges: null };
      if (S.model) {
        o.nodes = S.model.nodes.map(function (n) { var c = {}; Object.keys(n).forEach(function (k) { var v = n[k]; if (v === '' || v === false || v == null || (Array.isArray(v) && !v.length)) return; if (n.status === 'existing' && n.layer === 'src' && k === 'cols' && n.sref) return; c[k] = v; }); return c; });
        o.edges = S.model.edges;
      }
      return o;
    }
    function unpack(o) {
      if (!o || typeof o !== 'object' || o.v !== 1) return false;
      var it = o.intent || {};
      S.intent = { tpl: tplBy(it.tpl) ? it.tpl : '', goal: txt(it.goal, 600), notes: txt(it.notes, 3000), noSrc: it.noSrc === true, reuse: it.reuse !== false, budget: txt(it.budget, 8), cons: txt(it.cons, 400) };
      S.mode = o.mode === '3d' ? '3d' : '2d'; S.tplUsed = tplBy(o.tplUsed) ? o.tplUsed : ''; S.sent = txt(o.sent, 40);
      if (Array.isArray(o.nodes) && o.nodes.length <= 120) {
        var m = { nodes: [], edges: [] }, ids = {};
        o.nodes.forEach(function (r) {
          if (!r || typeof r.id !== 'string' || r.id.length > 24 || !(r.layer in LAYER_IX) || typeof r.name !== 'string' || ids[r.id]) return;
          var n = { id: r.id, layer: r.layer, name: txt(r.name, 80), status: has(['existing', 'proposed', 'changed'], r.status) ? r.status : 'proposed', off: r.off === true, note: txt(r.note, 300) };
          if (typeof r.ref === 'string' && C.by[r.ref]) n.ref = r.ref; if (typeof r.sref === 'string' && C.srcBy[r.sref]) n.sref = r.sref;
          var num = function (v, d) { v = Number(v); return isFinite(v) && v >= 0 ? v : d; };
          if (n.layer === 'src') { n.system = txt(r.system, 12) || 'model'; n.rows = num(r.rows, 0); n.cols = n.sref && !r.cols ? C.srcBy[n.sref].cols.slice() : strList(r.cols, 40, 50); }
          if (n.layer === 'imp') { n.source = txt(r.source, 80); n.grain = strList(r.grain, 12); n.keys = strList(r.keys, 12); n.steps = strList(r.steps, 12, 240); n.rows = num(r.rows, 0); n.props = strList(r.props, 20); n.values = strList(r.values, 12); n.map = Array.isArray(r.map) ? r.map.filter(function (x) { return Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'string'; }).slice(0, 30).map(function (x) { return [txt(x[0], 50), txt(x[1], 80)]; }) : []; }
          if (n.layer === 'dim') { n.items = Math.max(1, num(r.items, 10)); n.props = strList(r.props, 20); n.mapSource = txt(r.mapSource, 120); n.fill = Math.min(1, num(r.fill, 0)); }
          if (n.layer === 'met') { n.dims = strList(r.dims, 10); n.nd = strList(r.nd, 10); n.formula = txt(r.formula, 1600); n.was = txt(r.was, 1600); n.input = r.input === true; n.manual = r.manual === true; n.agg = has(['SUM', 'AVG', 'RATIO'], r.agg) ? r.agg : 'SUM'; var b = r.base; n.base = b && b.t === 'tl' ? { t: 'tl', list: txt(b.list, 80), value: txt(b.value, 80), agg: b.agg === 'AVG' ? 'AVG' : 'SUM' } : b && b.t === 'expr' ? { t: 'expr', expr: txt(b.expr, 1600) } : null; }
          if (n.layer === 'out') n.okind = has(['board', 'frame', 'table'], r.okind) ? r.okind : 'board';
          ids[n.id] = 1; m.nodes.push(n);
        });
        (Array.isArray(o.edges) ? o.edges : []).slice(0, 400).forEach(function (e) { if (Array.isArray(e) && ids[e[0]] && ids[e[1]] && e[0] !== e[1]) m.edges.push([e[0], e[1]]); });
        if (m.nodes.length) S.model = m;
      }
      S.step = S.model ? Math.max(0, Math.min(4, Number(o.step) || 0)) : 0;
      return true;
    }
    var saveT = 0;
    function save() {
      window.clearTimeout(saveT);
      saveT = later(function () {
        var p = null; try { p = ctx.store && ctx.store.set ? ctx.store.set(STORE_KEY, pack()) : null; } catch (e) { p = null; }
        if (!p || !p.then) { setSaved(p === null ? 'Not saved (no store)' : 'Saved'); return; }
        p.then(function () { setSaved('Design saved'); }, function () { setSaved('Could not save (design too large?)'); });
      }, 700);
      setSaved('Saving...');
    }
    function setSaved(t) { S.saved = t; if (UI.saved) UI.saved.textContent = t; }

    /* ----- chrome ----- */
    var UI = {};
    function applyTheme() {
      var dark = false; try { dark = !!(ctx.theme && ctx.theme.isDark && ctx.theme.isDark()); } catch (e) {}
      root.classList.toggle('as-dark', dark);
      TOKENS.forEach(function (t) { var v = ''; try { v = ctx.theme && ctx.theme.get ? ctx.theme.get(t[0]) : ''; } catch (e) { v = ''; } root.style.setProperty('--a-' + t[0], v || (dark ? t[2] : t[1])); });
      ['f-display', 'f-body', 'f-mono'].forEach(function (f) { var v = ''; try { v = ctx.theme.get(f); } catch (e) { v = ''; } if (v) root.style.setProperty('--a-' + f, v); });
    }
    function go(step) {
      if (step > 0 && !S.model) { scan(); }
      S.step = step; render(); save();
      say('Step ' + (step + 1) + ' of 5: ' + STEPS[step]);
    }
    function render() {
      SK = null; clear(UI.body); clear(UI.steps);
      STEPS.forEach(function (s, i) {
        var b = h('button', 'as-step' + (i === S.step ? ' on' : '') + (i < S.step ? ' done' : '')); b.type = 'button'; if (i === S.step) b.setAttribute('aria-current', 'step');
        add(b, h('i', '', String(i + 1)), h('span', '', s)); b.addEventListener('click', function () { go(i); }); UI.steps.appendChild(b);
      });
      var pane = h('div', 'as-pane as-p' + S.step); UI.body.appendChild(pane);
      [renderIntent, renderHead, renderSketch, renderValidate, renderExecute][S.step](pane);
      if (!reduced() && ctx.motion && ctx.motion.rise && S.step !== 2) { try { ctx.motion.rise(pane, { from: 'in', duration: 420 }); } catch (e) {} }
    }
    function sec(title, sub) { var s = h('section', 'as-card'); var hd = h('div', 'as-card-h'); add(hd, h('h3', '', title), sub ? h('span', '', sub) : null); s.appendChild(hd); return s; }
    function field(label, control, hint) { var l = h('label', 'as-f'); add(l, h('span', '', label), control, hint ? h('em', '', hint) : null); return l; }
    function input(value, fn, ph, cls) { var i = h('input', 'as-in' + (cls ? ' ' + cls : '')); i.type = 'text'; i.value = value == null ? '' : value; if (ph) i.placeholder = ph; i.addEventListener('change', function () { fn(i.value); }); return i; }
    function area(value, fn, rows, ph, live) { var t = h('textarea', 'as-in'); t.rows = rows || 3; t.value = value || ''; if (ph) t.placeholder = ph; t.spellcheck = false; t.addEventListener(live ? 'input' : 'change', function () { fn(t.value); }); return t; }
    function select(opts, value, fn) { var s = h('select', 'as-in'); opts.forEach(function (o) { var e = h('option', '', o[1]); e.value = o[0]; if (o[0] === value) e.selected = true; s.appendChild(e); }); s.addEventListener('change', function () { fn(s.value); }); return s; }
    function check(label, value, fn) { var l = h('label', 'as-ck'), c = h('input'); c.type = 'checkbox'; c.checked = !!value; c.addEventListener('change', function () { fn(c.checked); }); add(l, c, h('span', '', label)); return l; }
    function pill(text, cls) { return h('span', 'as-pill' + (cls ? ' ' + cls : ''), text); }
    function statusPill(n) { return pill(n.status === 'proposed' ? 'New' : n.status === 'changed' ? 'Changed' : 'Existing', 'st-' + n.status); }
    function cubeBar(c) {
      var w = h('div', 'as-cube'), bar = h('div', 'as-cube-bar'), f = h('i'); f.style.width = Math.max(2, Math.round(Math.sqrt(c.pct) * 100)) + '%'; bar.appendChild(f);
      add(w, bar, h('span', '', fmt(c.dense) + ' dense cells ' + DOT + ' ~' + fmt(c.sparse) + ' expected populated (' + (c.pct * 100 < 1 ? '<1' : Math.round(c.pct * 100)) + '%)'));
      return w;
    }
    function probList(list) { var u = h('ul', 'as-probs'); list.forEach(function (p) { var li = h('li', 'sev-' + p.sev); add(li, h('b', '', p.sev === 'bad' ? 'Conflict' : p.sev === 'warn' ? 'Check' : 'Hint'), h('span', '', p.text)); u.appendChild(li); }); return u; }

    /* ----- step 1: intent ----- */
    function renderIntent(pane) {
      var left = h('div', 'as-col'), right = h('div', 'as-col as-side'), it = S.intent;
      var s1 = sec('What are you trying to build?', 'Pick a starting point or describe it in your own words');
      var cards = h('div', 'as-tpls'); var f = null; try { f = ctx.focus && ctx.focus.get ? ctx.focus.get() : null; } catch (e) { f = null; }
      var hint = f ? matchTpl([f.topic, f.metric, f.text].join(' ')) : null;
      TPL.forEach(function (T) {
        var b = h('button', 'as-tpl' + (it.tpl === T.id ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', it.tpl === T.id ? 'true' : 'false');
        add(b, h('b', '', T.title), h('span', '', T.goal), hint === T && it.tpl !== T.id ? pill('Matches your current direction', 'st-proposed') : null);
        b.addEventListener('click', function () { if (it.tpl === T.id) { it.tpl = ''; } else { it.tpl = T.id; it.goal = T.goal; if (!it.notes.trim() || TPL.some(function (o) { return o.kpis === it.notes; })) it.notes = T.kpis; } S.model = null; render(); save(); });
        cards.appendChild(b);
      });
      add(s1, cards, field('Goal', area(it.goal, function (v) { it.goal = txt(v, 600); S.model = null; fill(); save(); }, 2, 'e.g. Add a driver-based forecast by channel', true)));
      var s2 = sec('End state', 'Paste meeting notes or describe the wireframe: one KPI or view per line');
      add(s2, area(it.notes, function (v) { it.notes = txt(v, 3000); S.model = null; fill(); save(); }, 6, 'Gross margin % by customer segment' + NL + 'Top 20 customers by margin' + NL + 'Left: KPI tiles. Right: trend by channel...', true));
      var s3 = sec('Constraints');
      var g = h('div', 'as-row');
      add(g, check('No new or changed source tables', it.noSrc, function (v) { it.noSrc = v; save(); }), check('Reuse existing dimensions where possible', it.reuse, function (v) { it.reuse = v; save(); }));
      add(s3, g, field('Dense cell budget per metric (millions)', input(it.budget, function (v) { it.budget = txt(v, 8); save(); }, 'e.g. 50', 'as-short')), field('Anything else', input(it.cons, function (v) { it.cons = txt(v, 400); save(); }, 'e.g. monthly grain only, must be live before the Q1 cycle')));
      add(left, s1, s2, s3);
      var u = sec('What Studio understood', 'Rule-based reading of your words'), ub = h('div', 'as-und'); u.appendChild(ub);
      var ex = sec('What exists today', C.sample ? 'SAMPLE catalog: the host gave no lineage' : 'Read from the frame lineage');
      var srcN = C.sources.filter(function (s) { return s.system !== 'pig'; }), colN = 0; srcN.forEach(function (s) { colN += s.cols.length; });
      var k = function (kind) { return C.blocks.filter(function (b) { return kind.indexOf(b.kind) >= 0; }).length; };
      var st = h('div', 'as-stats'); [[srcN.length, 'source tables'], [colN, 'columns'], [k(['dim', 'cal']), 'dimensions'], [k(['tl']), 'transaction lists'], [k(['metric', 'set']), 'metrics'], [k(['board', 'frame', 'table']), 'boards, tables, frames']].forEach(function (x) { var d = h('div'); add(d, h('b', '', String(x[0])), h('span', '', x[1])); st.appendChild(d); });
      ex.appendChild(st);
      var goB = btn('pri big', 'Scan the model and propose a head start', function () { scan(); go(1); });
      add(right, u, ex, goB, S.model ? btn('', 'Keep my current design and continue', function () { go(Math.max(1, 2)); }) : null);
      add(pane, left, right);
      function fill() {
        clear(ub); var U = understood();
        add(ub, field('Starting point', h('div', 'as-val', U.tpl ? U.tpl.title : 'Blank canvas with the core revenue blocks')));
        var kp = h('div', 'as-chips'); U.kpis.forEach(function (x) { kp.appendChild(pill(x)); }); if (!U.kpis.length) kp.appendChild(h('em', '', 'None found yet. Add one per line under End state.'));
        var dm = h('div', 'as-chips'); U.dims.forEach(function (x) { dm.appendChild(pill(x, 'k-dim')); }); if (!U.dims.length) dm.appendChild(h('em', '', 'No dimension names recognised yet.'));
        add(ub, field('KPIs and views heard', kp), field('Dimensions mentioned', dm));
      }
      fill();
    }

    /* ----- step 2: head start ----- */
    function renderHead(pane) {
      var main = h('div', 'as-col'), side = h('div', 'as-col as-side');
      var T = tplBy(S.tplUsed), prop = live().filter(function (n) { return n.status !== 'existing'; }), all = S.model.nodes.filter(function (n) { return n.status !== 'existing'; });
      var top = sec(T ? T.title : 'Head start', 'Proposed from what exists. Untick anything you do not want; refine it in the sketch.');
      var srcOn = live().filter(function (n) { return n.layer === 'src' && n.status === 'existing'; }), colN = 0; srcOn.forEach(function (s) { colN += s.cols.length; });
      var st = h('div', 'as-stats'); [[srcOn.length, 'source tables read'], [colN, 'columns scanned'], [live().filter(function (n) { return n.status === 'existing' && n.layer !== 'src'; }).length, 'existing blocks reused'], [prop.filter(function (n) { return n.status === 'proposed'; }).length, 'new blocks'], [prop.filter(function (n) { return n.status === 'changed'; }).length, 'changed blocks']].forEach(function (x) { var d = h('div'); add(d, h('b', '', String(x[0])), h('span', '', x[1])); st.appendChild(d); });
      top.appendChild(st); main.appendChild(top);
      var group = function (layer, title, sub, body) {
        var ns = all.filter(function (n) { return n.layer === layer; }); if (!ns.length) return;
        var s = sec(title, sub);
        ns.forEach(function (n) {
          var row = h('div', 'as-prop' + (n.off ? ' off' : '')), hd = h('div', 'as-prop-h'), c = h('input'); c.type = 'checkbox'; c.checked = !n.off; c.setAttribute('aria-label', 'Include ' + n.name);
          c.addEventListener('change', function () { n.off = !c.checked; render(); save(); });
          var pr = n.off ? [] : diagNode(n), w = worst(pr);
          add(hd, c, h('b', '', n.name), statusPill(n), w ? pill(w === 'bad' ? 'Conflict' : 'Check', 'sev-' + w) : null); row.appendChild(hd);
          if (n.note) row.appendChild(h('p', 'as-note', n.note));
          body(n, row); if (pr.length && !n.off) row.appendChild(probList(pr.filter(function (p) { return p.sev !== 'info'; })));
          s.appendChild(row);
        });
        main.appendChild(s);
      };
      group('src', 'Source tables', 'New or changed tables upstream of Pigment', function (n, row) { row.appendChild(h('p', 'as-mono', n.cols.join(', '))); });
      group('dim', 'Dimensions', 'Lists, hierarchies and where their items come from', function (n, row) {
        var d = h('div', 'as-kv'); add(d, h('span', '', 'Items'), h('b', '', '~' + fmt(n.items)), h('span', '', 'Mapped from'), h('b', n.mapSource ? '' : 'sev-bad', n.mapSource || 'not mapped'), h('span', '', 'Properties'), h('b', '', (n.props || []).join(', ') || 'none')); row.appendChild(d);
      });
      group('imp', 'Transaction lists and imports', 'Column to property mapping, keys and grain', function (n, row) {
        var d = h('div', 'as-kv'); add(d, h('span', '', 'Source'), h('b', '', n.source || 'none'), h('span', '', 'Grain'), h('b', '', n.grain.join(' x ') || 'not stated'), h('span', '', 'Keys'), h('b', '', n.keys.join(' + ') || 'none'), h('span', '', 'Rows'), h('b', '', n.rows ? '~' + fmt(n.rows) : 'unknown')); row.appendChild(d);
        var m = h('div', 'as-map'); n.map.forEach(function (x) { var r = h('div'); add(r, h('code', '', x[0]), h('i', '', ARROW), h('span', '', x[1])); m.appendChild(r); }); row.appendChild(m);
        if (n.steps.length) { var ol = h('ol', 'as-steps-l'); n.steps.forEach(function (x) { ol.appendChild(h('li', '', x)); }); add(row, h('div', 'as-sub', 'Data transformation'), ol); }
      });
      group('met', 'Metrics', 'Dimensionality, draft formula and cell estimate', function (n, row) {
        var ch = h('div', 'as-chips'); n.dims.forEach(function (d) { ch.appendChild(pill(d, 'k-dim')); }); if (n.input) ch.appendChild(pill('Input', 'k-set')); row.appendChild(ch);
        if (!n.input) row.appendChild(h('pre', 'as-formula', n.formula || '(no formula yet)'));
        row.appendChild(cubeBar(cube(n)));
      });
      group('out', 'Where it shows up', 'Boards and frame widgets that read the new metrics', function (n, row) {
        var reads = liveEdges().filter(function (e) { return e[1] === n.id; }).map(function (e) { return nodeBy(e[0]).name; });
        row.appendChild(h('p', 'as-mono', 'Reads: ' + (reads.join(', ') || 'nothing yet')));
      });
      if (!all.length) main.appendChild(h('p', 'as-empty', 'No template matched, so Studio placed the core revenue blocks. Add your own nodes in the sketch.'));
      // side: volumes + AI
      var vol = sec('Data volumes', C.volumes.length ? 'Rows the frame data sources deliver now' : 'No frame data delivered yet');
      var vl = h('div', 'as-kv'); C.volumes.forEach(function (v) { add(vl, h('span', '', v[0]), h('b', '', fmt(v[1]) + ' rows')); });
      live().forEach(function (n) { if (n.layer === 'src' && n.rows) add(vl, h('span', '', n.name), h('b', '', fmt(n.rows) + ' rows' + (n.status === 'proposed' ? ' (estimate)' : ''))); });
      vol.appendChild(vl);
      var ai = sec('Refine', ctx.ai ? 'Ask Claude to review the proposal' : 'Rule-based here: Claude is not available in this host');
      if (ctx.ai) {
        var ab = btn('', S.aiBusy ? 'Claude is reviewing...' : 'Ask Claude to refine', askAi); ab.disabled = S.aiBusy; ai.appendChild(ab);
        if (S.ai) { (S.ai.notes || []).forEach(function (t) { ai.appendChild(h('p', 'as-note', t)); }); (S.ai.formulas || []).forEach(function (fx) { var n = nodeNamed(fx.name, 'met'); if (!n) return; var r = h('div', 'as-prop'); add(r, h('b', '', fx.name), h('pre', 'as-formula', fx.formula), btn('', 'Use this formula', function () { n.formula = fx.formula; n.manual = true; if (n.status === 'existing') n.status = 'changed'; render(); save(); })); ai.appendChild(r); }); if (S.ai.error) ai.appendChild(h('p', 'as-note', S.ai.error)); }
      } else ai.appendChild(h('p', 'as-note', 'Formulas come from templates and heuristics (BY / REMOVE / ADD from the dimension change, hierarchy properties, list aggregation). Check each one in Validate.'));
      add(side, btn('pri big', 'Open in the sketch', function () { go(2); }), vol, ai, btn('', 'Start over from the intent', function () { go(0); }));
      add(pane, main, side);
    }
    function askAi() {
      if (!ctx.ai || S.aiBusy) return; S.aiBusy = true; render();
      var data = { goal: S.intent.goal, endState: txt(S.intent.notes, 800), constraints: S.intent.cons, dimensions: live().filter(function (n) { return n.layer === 'dim'; }).map(function (n) { return { name: n.name, status: n.status, properties: n.props }; }), metrics: live().filter(function (n) { return n.layer === 'met' && n.status !== 'existing'; }).map(function (n) { return { name: n.name, dims: n.dims, formula: n.formula, input: !!n.input }; }) };
      var prompt = 'You are reviewing a proposed Pigment model enhancement for a solution architect. Reply with JSON only, shaped {"notes":["short advice"],"formulas":[{"name":"exact metric name","formula":"improved Pigment formula"}]}. At most 4 notes and 4 formulas. Only suggest a formula when it is clearly better (sparsity, correct modifiers). QUESTION: Review this design.';
      Promise.resolve().then(function () { return ctx.ai.ask(prompt, data); }).then(function (r) {
        var s = String(r || ''), a = s.indexOf('{'), b = s.lastIndexOf('}'), o = null; try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { o = null; }
        if (!o) S.ai = { notes: [txt(s, 500)], formulas: [] };
        else S.ai = { notes: strList(o.notes, 4, 300), formulas: (Array.isArray(o.formulas) ? o.formulas : []).filter(function (x) { return x && typeof x.name === 'string' && typeof x.formula === 'string'; }).slice(0, 4).map(function (x) { return { name: txt(x.name, 80), formula: txt(x.formula, 1200) }; }) };
      }, function () { S.ai = { error: 'Claude could not be reached. The rule-based proposal stands.' }; }).then(function () { S.aiBusy = false; if (!dead && S.step === 1) render(); });
    }

    /* ----- step 3: sketch ----- */
    function metDepths(ns, E) { var d = {}, ids = {}; ns.forEach(function (n) { ids[n.id] = 1; d[n.id] = 0; }); for (var k = 0; k < 6; k++) E.forEach(function (e) { if (ids[e[0]] && ids[e[1]] && d[e[1]] < d[e[0]] + 1) d[e[1]] = Math.min(4, d[e[0]] + 1); }); return d; }
    function layout() {
      var L = { planes: [], pos: {}, w: 0, h: 0 }, x = 0, E = liveEdges();
      LAYERS.forEach(function (ly, li) {
        var ns = live().filter(function (n) { return n.layer === ly.id; }), sub = {}, cols = 1, rc = [0, 0, 0, 0, 0];
        if (ly.id === 'met') { var d = metDepths(ns, E), used = {}; ns.forEach(function (n) { used[d[n.id]] = 1; }); var remap = {}, c = 0; Object.keys(used).sort().forEach(function (k) { remap[k] = c++; }); ns.forEach(function (n) { sub[n.id] = remap[d[n.id]]; }); cols = Math.max(1, c); }
        var g = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(ns.length || 1) * 1.2)));
        ns.forEach(function (n, i) { var c2 = sub[n.id] || 0, r = rc[c2]++; L.pos[n.id] = { li: li, x2: c2 * CW + 14, y2: 44 + r * RH, x3: (i % g) * CW + 14, y3: 44 + Math.floor(i / g) * RH }; });
        var rows2 = Math.max(1, Math.max.apply(null, rc)), rows3 = Math.max(1, Math.ceil(ns.length / g)), gc = Math.max(1, Math.min(g, ns.length || 1));
        var p = { id: ly.id, x2: x, w2: cols * CW + 14, h2: 44 + rows2 * RH + 8, w3: Math.max(2, gc) * CW + 14, h3: 44 + rows3 * RH + 8, z: (li - 2) * GAP };
        x += p.w2 + 28; L.h = Math.max(L.h, p.h2); L.planes.push(p);
      });
      L.w = x - 28; return L;
    }
    function nodePt(L, id, side) { var p = L.pos[id]; if (!p) return null; var pl = L.planes[p.li], dx = side === 'r' ? NW : side === 'l' ? 0 : NW / 2; if (S.mode === '3d') return { x: p.x3 - pl.w3 / 2 + dx, y: p.y3 - pl.h3 / 2 + NH / 2, z: pl.z }; return { x: pl.x2 + p.x2 + dx, y: p.y2 + NH / 2, z: 0 }; }
    function subLine(n) {
      if (n.layer === 'src') return (n.system === 'raw' ? 'Snowflake RAW' : n.system === 'model' ? 'Snowflake ANALYTICS' : n.system === 'erp' ? 'NetSuite' : n.system === 'ext' ? 'External file' : n.system) + (n.rows ? ' ' + DOT + ' ' + fmt(n.rows) + ' rows' : '');
      if (n.layer === 'imp') return 'List ' + DOT + ' ' + (n.grain.length ? n.grain.join(' x ') : 'grain not stated');
      if (n.layer === 'dim') return '~' + fmt(n.items) + ' items' + (n.props && n.props.length ? ' ' + DOT + ' ' + n.props.length + ' properties' : '');
      if (n.layer === 'met') return (n.dims.length ? n.dims.map(function (d) { return d.split(' ').map(function (w) { return w.charAt(0); }).join(''); }).join(' x ') : 'no dimensions') + ' ' + DOT + ' ' + fmt(cube(n).dense);
      return n.okind === 'frame' ? 'Frame' : n.okind === 'table' ? 'Table' : 'Board';
    }
    function renderSketch(pane) {
      var tb = h('div', 'as-tb'), stage = h('div', 'as-stage'), world = h('div', 'as-world'), insp = h('aside', 'as-insp'), tray = h('div', 'as-tray'), wrap = h('div', 'as-sk-main');
      stage.tabIndex = 0; stage.setAttribute('role', 'application'); stage.setAttribute('aria-label', 'Model sketch. Arrow keys move the view, plus and minus zoom, 0 fits, Delete removes the selected node.');
      var seg = h('div', 'as-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'View mode');
      var b2 = btn('', '2D flow', function () { setMode('2d'); }), b3 = btn('', '3D layers', function () { setMode('3d'); }); add(seg, b2, b3);
      var addSel = select([['', '+ Add node...']].concat(LAYERS.map(function (l) { return ['new:' + l.id, 'New ' + l.one]; })).concat(C.blocks.filter(function (b) { return !S.model.nodes.some(function (n) { return n.ref === b.id && !n.off; }); }).slice(0, 80).map(function (b) { return ['ex:' + b.id, 'Existing: ' + b.name]; })).concat(C.sources.filter(function (s) { return s.system !== 'pig' && !nodeNamed(s.name, 'src'); }).map(function (s) { return ['src:' + s.id, 'Source: ' + s.name]; })), '', function (v) {
        var n = null; if (v.indexOf('new:') === 0) { var ly = v.slice(4); n = mk(ly, 'New ' + ly + ' ' + (live().length + 1), 'proposed'); if (ly === 'met') { n.name = 'NEW Metric ' + live().length; n.dims = nodeNamed('Month', 'dim') ? ['Month'] : []; n.nd = n.dims.slice(); } }
        else if (v.indexOf('ex:') === 0) n = place(C.by[v.slice(3)]); else if (v.indexOf('src:') === 0) n = placeSrc(C.srcBy[v.slice(4)]);
        if (n) { S.sel = n.id; changed(true); toast(n.name + ' added to the sketch'); }
      });
      addSel.classList.add('as-add'); addSel.setAttribute('aria-label', 'Add a node');
      var lg = h('div', 'as-legend'); [['existing', 'Existing'], ['proposed', 'New'], ['changed', 'Changed']].forEach(function (x) { var s = h('span', 'lg-' + x[0], x[1]); lg.appendChild(s); });
      add(tb, seg, btn('ic', '-', function () { zoom(1 / 1.2); }, 'Zoom out'), btn('ic', '+', function () { zoom(1.2); }, 'Zoom in'), btn('', 'Fit', function () { fit(true); }), addSel, lg, h('span', 'as-tb-hint', 'Drag the dot on a node to connect ' + DOT + ' drag a dimension chip onto a metric ' + DOT + ' pinch to zoom'));
      var planes = LAYERS.map(function (ly) { var p = h('div', 'as-plane pl-' + ly.id), tag = h('div', 'as-plane-tag'); add(tag, h('b', '', ly.label), h('span', '', ly.sub)); p.appendChild(tag); world.appendChild(p); return p; });
      var svg = sv('svg', { 'class': 'as-edges' }), beams = h('div', 'as-beams'); world.appendChild(svg); world.appendChild(beams);
      var over = sv('svg', { 'class': 'as-over' }), ghost = h('div', 'as-ghost'), tip = h('div', 'as-tip'); ghost.hidden = true; tip.hidden = true;
      add(stage, world, over); add(wrap, tb, stage, tray); add(pane, wrap, insp, ghost, tip);
      SK = { stage: stage, world: world, planes: planes, svg: svg, beams: beams, over: over, ghost: ghost, tip: tip, insp: insp, tray: tray, els: {}, b2: b2, b3: b3, L: null, pane: pane };
      bindStage(); syncSketch(false); renderInspector(); renderTray();
      later(function () { if (SK && SK.stage === stage) { if (S.mode === '2d' && !S.cam2) fit(false); applyCam(); drawEdges(); } }, 30);
    }
    function changed(structure) { if (SK) { renderInspector(); syncSketch(structure); if (structure) renderTray(); } save(); }
    function setMode(m) {
      if (S.mode === m || !SK) return; S.mode = m; SK.world.classList.add('as-anim'); SK.svg.style.opacity = '0'; SK.beams.style.opacity = '0';
      syncSketch(false); fit(false);
      later(function () { if (!SK) return; SK.world.classList.remove('as-anim'); drawEdges(); SK.svg.style.opacity = ''; SK.beams.style.opacity = ''; }, reduced() ? 0 : 640);
      say(m === '3d' ? '3D layers: sources at the back, outputs at the front. Drag to orbit.' : '2D flow, left to right.'); save();
    }
    function syncSketch(animate) {
      if (!SK) return; var L = layout(), is3 = S.mode === '3d', D = diagAll(), by = {}; SK.L = L;
      D.forEach(function (p) { (by[p.node] = by[p.node] || []).push(p); });
      SK.b2.classList.toggle('on', !is3); SK.b3.classList.toggle('on', is3); SK.b2.setAttribute('aria-pressed', String(!is3)); SK.b3.setAttribute('aria-pressed', String(is3));
      SK.stage.classList.toggle('is3', is3); SK.pane.classList.toggle('as-still', reduced());
      var apply = function () {
        L.planes.forEach(function (p, i) { var e = SK.planes[i]; e.style.width = (is3 ? p.w3 : p.w2) + 'px'; e.style.height = (is3 ? p.h3 : L.h) + 'px'; e.style.transform = is3 ? 'translate3d(' + (-p.w3 / 2) + 'px,' + (-p.h3 / 2) + 'px,' + p.z + 'px)' : 'translate3d(' + p.x2 + 'px,0,0)'; });
        var seen = {}, hot = related(S.sel);
        live().forEach(function (n) {
          var e = SK.els[n.id], p = L.pos[n.id], fresh = false; seen[n.id] = 1;
          if (!e) { e = makeNode(n); SK.els[n.id] = e; fresh = true; }
          if (e.parentNode !== SK.planes[p.li]) SK.planes[p.li].appendChild(e);
          e.style.left = (is3 ? p.x3 : p.x2) + 'px'; e.style.top = (is3 ? p.y3 : p.y2) + 'px';
          e.className = 'as-node ly-' + n.layer + ' st-' + n.status + (S.sel === n.id ? ' sel' : '') + (S.sel && !hot[n.id] ? ' dimmed' : '');
          e._name.textContent = n.name; e._sub.textContent = subLine(n); e._tag.textContent = n.status === 'proposed' ? 'NEW' : n.status === 'changed' ? 'CHG' : ''; e._tag.hidden = n.status === 'existing';
          var w = worst(by[n.id] || []); e._bad.hidden = !w; e._bad.className = 'as-n-bad sev-' + w; e._bad.textContent = w ? '!' : '';
          e.setAttribute('aria-label', n.name + ', ' + LAYERS[p.li].one + ', ' + n.status + (w ? ', has ' + (w === 'bad' ? 'conflicts' : 'checks') : ''));
          if (fresh && animate && !reduced() && ctx.motion && ctx.motion.rise && !is3) { try { ctx.motion.rise(e, { from: 'in' }); } catch (er) {} }
        });
        Object.keys(SK.els).forEach(function (id) { if (!seen[id]) { var e = SK.els[id]; if (e.parentNode) e.parentNode.removeChild(e); delete SK.els[id]; } });
      };
      var olds = Object.keys(SK.els).map(function (k) { return SK.els[k]; });
      if (animate && !is3 && !reduced() && ctx.motion && ctx.motion.flip && olds.length) { SK.pane.classList.add('as-noxy'); var pr = null; try { pr = ctx.motion.flip(olds, apply); } catch (e) { apply(); } var fin = function () { if (SK) { SK.pane.classList.remove('as-noxy'); drawEdges(); } }; if (pr && pr.then) pr.then(fin, fin); else fin(); }
      else apply();
      applyCam(); drawEdges();
    }
    function makeNode(n) {
      var e = h('div', 'as-node'), name = h('b'), sub = h('span'), tag = h('i', 'as-n-tag'), bad = h('i', 'as-n-bad'), port = h('i', 'as-port');
      e.tabIndex = 0; e.setAttribute('role', 'button'); e.setAttribute('data-nid', n.id); port.title = 'Drag to connect'; port.setAttribute('data-port', n.id);
      add(e, name, sub, tag, bad, port); e._name = name; e._sub = sub; e._tag = tag; e._bad = bad;
      e.addEventListener('click', function (ev) { ev.stopPropagation(); selectNode(n.id); });
      e.addEventListener('dblclick', function () { selectNode(n.id); var i = SK && SK.insp.querySelector('.as-name'); if (i) { i.focus(); i.select(); } });
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectNode(n.id); } });
      port.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); startConnect(n, port, ev); }); port.addEventListener('click', function (ev) { ev.stopPropagation(); });
      return e;
    }
    function related(id) { var hot = {}; if (!id) return hot; hot[id] = 1; var n = nodeBy(id); liveEdges().forEach(function (e) { if (e[0] === id) hot[e[1]] = 1; if (e[1] === id) hot[e[0]] = 1; }); if (n && n.layer === 'met') n.dims.forEach(function (d) { var dn = nodeNamed(d, 'dim'); if (dn) hot[dn.id] = 1; }); if (n && n.layer === 'dim') live().forEach(function (m) { if (m.layer === 'met' && has(m.dims, n.name)) hot[m.id] = 1; }); return hot; }
    function selectNode(id) { S.sel = id; if (SK) { renderInspector(); syncSketch(false); } }
    function allEdges() {   // explicit reads plus, for the selection, the dimension links that define its cube
      var E = liveEdges().map(function (e) { return { a: e[0], b: e[1], k: 'read' }; }), s = nodeBy(S.sel);
      if (s && s.layer === 'met') s.dims.forEach(function (d) { var dn = nodeNamed(d, 'dim'); if (dn) E.push({ a: dn.id, b: s.id, k: 'dim' }); });
      if (s && s.layer === 'dim') live().forEach(function (m) { if (m.layer === 'met' && has(m.dims, s.name)) E.push({ a: s.id, b: m.id, k: 'dim' }); });
      return E;
    }
    function drawEdges() {
      if (!SK) return; var L = SK.L, is3 = S.mode === '3d'; clear(SK.svg); clear(SK.beams);
      allEdges().forEach(function (e) {
        var A = nodePt(L, e.a, 'r'), B = nodePt(L, e.b, 'l'); if (!A || !B) return;
        var hot = S.sel && (e.a === S.sel || e.b === S.sel), cls = (e.k === 'dim' ? ' dimlink' : '') + (hot ? ' hot' : S.sel ? ' cold' : '') + (nodeBy(e.b).status !== 'existing' || nodeBy(e.a).status !== 'existing' ? ' new' : '');
        if (is3) {
          A = nodePt(L, e.a, 'c'); B = nodePt(L, e.b, 'c'); var dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz); if (len < 1) return;
          var bm = h('div', 'as-beam' + cls); bm.style.width = len.toFixed(1) + 'px';
          bm.style.transform = 'translate3d(' + A.x.toFixed(1) + 'px,' + A.y.toFixed(1) + 'px,' + A.z.toFixed(1) + 'px) rotateY(' + Math.atan2(-dz, dx).toFixed(4) + 'rad) rotateZ(' + Math.asin(Math.max(-1, Math.min(1, dy / len))).toFixed(4) + 'rad)';
          SK.beams.appendChild(bm);
        } else {
          var back = B.x < A.x + 12, mx = back ? Math.max(A.x, B.x + NW) + 46 : (A.x + B.x) / 2, d;
          if (back) { var bx = B.x + NW; d = 'M' + A.x + ',' + A.y + ' C' + mx + ',' + A.y + ' ' + mx + ',' + B.y + ' ' + bx + ',' + B.y; }
          else d = 'M' + A.x + ',' + A.y + ' C' + mx + ',' + A.y + ' ' + mx + ',' + B.y + ' ' + B.x + ',' + B.y;
          SK.svg.appendChild(sv('path', { d: d, 'class': 'as-edge' + cls }));
        }
      });
    }
    function applyCam() {
      if (!SK) return; var r = SK.stage.getBoundingClientRect();
      if (S.mode === '3d') { var c = S.cam3; SK.world.style.transform = 'translate3d(' + (r.width / 2 + c.x).toFixed(1) + 'px,' + (r.height / 2 + c.y).toFixed(1) + 'px,0) scale(' + c.k.toFixed(4) + ') rotateX(' + c.rx.toFixed(2) + 'deg) rotateY(' + c.ry.toFixed(2) + 'deg)'; }
      else { var c2 = S.cam2 || { x: 20, y: 20, k: 1 }; SK.world.style.transform = 'translate3d(' + c2.x.toFixed(1) + 'px,' + c2.y.toFixed(1) + 'px,0) scale(' + c2.k.toFixed(4) + ')'; }
    }
    function fit(anim) {
      if (!SK) return; var r = SK.stage.getBoundingClientRect(), L = SK.L || layout();
      if (S.mode === '3d') { S.cam3 = { rx: -16, ry: 30, k: Math.max(0.3, Math.min(0.95, r.width / 1050, r.height / 700)), x: r.width * 0.06, y: -r.height * 0.04 }; }
      else { var k = Math.max(0.56, Math.min(1.15, (r.width - 40) / Math.max(200, L.w), (r.height - 30) / Math.max(120, L.h))); S.cam2 = { k: k, x: Math.max(16, (r.width - L.w * k) / 2), y: Math.max(12, Math.min(40, (r.height - L.h * k) / 2)) }; }
      if (anim && !reduced()) { SK.world.classList.add('as-anim'); later(function () { if (SK) SK.world.classList.remove('as-anim'); }, 500); }
      applyCam();
    }
    function zoom(f, cx, cy) {
      if (S.mode === '3d') { S.cam3.k = Math.max(0.25, Math.min(2.2, S.cam3.k * f)); }
      else { var c = S.cam2 || (S.cam2 = { x: 20, y: 20, k: 1 }), r = SK.stage.getBoundingClientRect(); if (cx == null) { cx = r.width / 2; cy = r.height / 2; } var nk = Math.max(0.25, Math.min(2.4, c.k * f)); c.x = cx - (cx - c.x) * (nk / c.k); c.y = cy - (cy - c.y) * (nk / c.k); c.k = nk; }
      applyCam();
    }
    function bindStage() {
      var st = SK.stage, drag = null;
      st.addEventListener('wheel', function (ev) {
        ev.preventDefault(); var r = st.getBoundingClientRect();
        if (ev.ctrlKey || ev.metaKey) zoom(Math.exp(-ev.deltaY * 0.012), ev.clientX - r.left, ev.clientY - r.top);   // trackpad pinch arrives as ctrl+wheel
        else if (S.mode === '3d') zoom(Math.exp(-ev.deltaY * 0.0025));
        else { var c = S.cam2 || (S.cam2 = { x: 20, y: 20, k: 1 }); c.x -= ev.deltaX; c.y -= ev.deltaY; applyCam(); }
      }, { passive: false });
      st.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || (ev.target.closest && ev.target.closest('.as-node'))) return;
        drag = { x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId }; try { st.setPointerCapture(ev.pointerId); } catch (e) {} st.classList.add('grab');
      });
      st.addEventListener('pointermove', function (ev) {
        if (!drag || ev.pointerId !== drag.id) return; var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; drag.x = ev.clientX; drag.y = ev.clientY;
        if (S.mode === '3d') { var c = S.cam3; if (ev.shiftKey) { c.x += dx; c.y += dy; } else { c.ry = Math.max(-85, Math.min(85, c.ry + dx * 0.35)); c.rx = Math.max(-70, Math.min(40, c.rx - dy * 0.3)); } }
        else { var c2 = S.cam2 || (S.cam2 = { x: 20, y: 20, k: 1 }); c2.x += dx; c2.y += dy; }
        applyCam();
      });
      var up = function (ev) { if (!drag) return; var m = drag.moved; drag = null; st.classList.remove('grab'); try { st.releasePointerCapture(ev.pointerId); } catch (e) {} if (!m && S.sel) selectNode(null); };
      st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
      st.addEventListener('keydown', function (ev) {
        if (ev.target !== st && !(ev.target.classList && ev.target.classList.contains('as-node'))) return;
        var k = ev.key, s = ev.shiftKey ? 3 : 1, is3 = S.mode === '3d', c = is3 ? S.cam3 : (S.cam2 || (S.cam2 = { x: 20, y: 20, k: 1 })), used = true;
        if (k === 'ArrowLeft') { if (is3) c.ry -= 6 * s; else c.x += 40 * s; } else if (k === 'ArrowRight') { if (is3) c.ry += 6 * s; else c.x -= 40 * s; }
        else if (k === 'ArrowUp') { if (is3) c.rx += 5 * s; else c.y += 40 * s; } else if (k === 'ArrowDown') { if (is3) c.rx -= 5 * s; else c.y -= 40 * s; }
        else if (k === '+' || k === '=') zoom(1.2); else if (k === '-') zoom(1 / 1.2); else if (k === '0') fit(true);
        else if (k === 'Escape') selectNode(null); else if ((k === 'Delete' || k === 'Backspace') && S.sel) removeNode(S.sel); else used = false;
        if (used) { ev.preventDefault(); applyCam(); }
      });
    }
    function removeNode(id) { var n = nodeBy(id); if (!n) return; if (n.status === 'existing' || n.ref) { n.off = true; toast(n.name + ' hidden from the sketch. Nothing is deleted in Pigment.'); } else { S.model.nodes = S.model.nodes.filter(function (x) { return x !== n; }); S.model.edges = S.model.edges.filter(function (e) { return e[0] !== id && e[1] !== id; }); live().forEach(function (m) { if (m.layer === 'met' && n.layer === 'dim' && has(m.dims, n.name)) setDims(m, m.dims.filter(function (d) { return d !== n.name; })); }); toast(n.name + ' removed from the design'); } S.sel = null; changed(true); }
    function localPt(ev) { var r = SK.pane.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    function nodeAt(ev) { var e = document.elementFromPoint(ev.clientX, ev.clientY); e = e && e.closest ? e.closest('.as-node') : null; return e && root.contains(e) ? nodeBy(e.getAttribute('data-nid')) : null; }
    function connect(a, b) {
      if (!a || !b || a === b) return;
      var la = a.layer, lb = b.layer, ok = false;
      if (la === 'dim' && lb === 'met') { if (has(b.dims, a.name)) { toast(b.name + ' already has ' + a.name); return; } setDims(b, b.dims.concat([a.name])); S.sel = b.id; changed(true); toast(a.name + ' added to ' + b.name); return; }
      if (la === 'src' && lb === 'imp') { b.source = a.name; S.model.edges = S.model.edges.filter(function (e) { var x = nodeBy(e[0]); return !(e[1] === b.id && x && x.layer === 'src'); }); ok = true; }
      else if (la === 'src' && lb === 'dim') { var col = a.cols.filter(function (c) { return lc(c).indexOf(lc(b.name).split(' ')[0]) >= 0; })[0] || a.cols[0] || ''; b.mapSource = a.name + '.' + col; if (b.status === 'existing') b.status = 'changed'; ok = true; }
      else if ((la === 'imp' && lb === 'met') || (la === 'met' && lb === 'out') || (la === 'imp' && lb === 'out')) ok = true;
      else if (la === 'met' && lb === 'met') { var seen = {}, st = [b.id], cyc = false; while (st.length) { var x = st.pop(); if (x === a.id) cyc = true; if (seen[x]) continue; seen[x] = 1; S.model.edges.forEach(function (e) { if (e[0] === x) st.push(e[1]); }); } if (cyc) { toast('That would create a circular reference.'); return; } ok = true; }
      if (!ok) { toast('The flow runs sources ' + ARROW + ' imports ' + ARROW + ' dimensions ' + ARROW + ' metrics ' + ARROW + ' outputs.'); return; }
      if (hasEdge(a.id, b.id)) { toast('Already connected.'); return; }
      link(a, b); if (b.status === 'existing' && lb !== 'met') b.status = 'changed'; S.sel = b.id; changed(true); toast(a.name + ' ' + ARROW + ' ' + b.name);
    }
    function startConnect(n, port, ev) {
      var p0 = localPt(ev), line = sv('path', { 'class': 'as-rubber' }), target = null, pr = SK.pane.getBoundingClientRect(), sr = SK.stage.getBoundingClientRect(), ox = sr.left - pr.left, oy = sr.top - pr.top;
      SK.over.appendChild(line); try { port.setPointerCapture(ev.pointerId); } catch (e) {}
      var mv = function (e2) { var p = localPt(e2); line.setAttribute('d', 'M' + (p0.x - ox) + ',' + (p0.y - oy) + ' L' + (p.x - ox) + ',' + (p.y - oy)); var t = nodeAt(e2); if (target && target !== t && SK.els[target.id]) SK.els[target.id].classList.remove('drop'); target = t && t !== n ? t : null; if (target && SK.els[target.id]) SK.els[target.id].classList.add('drop'); };
      var up = function (e2) { port.removeEventListener('pointermove', mv); port.removeEventListener('pointerup', up); port.removeEventListener('pointercancel', up); try { port.releasePointerCapture(e2.pointerId); } catch (e) {} if (line.parentNode) line.parentNode.removeChild(line); if (target && SK.els[target.id]) SK.els[target.id].classList.remove('drop'); if (target && e2.type === 'pointerup') connect(n, target); };
      port.addEventListener('pointermove', mv); port.addEventListener('pointerup', up); port.addEventListener('pointercancel', up);
    }
    function previewDims(m, dimName) {   // live feedback while a dimension hovers over a metric
      var t = SK.tip; clear(t);
      if (!m || m.layer !== 'met') { add(t, h('b', '', 'Drop on a metric'), h('span', '', 'Dimensions define a metric cube.')); return false; }
      if (has(m.dims, dimName)) { add(t, h('b', '', m.name), h('span', '', 'Already has ' + dimName + '.')); return false; }
      var dims = m.dims.concat([dimName]), c0 = cube(m), c1 = cube(m, dims), pr = diagNode(m, dims).filter(function (p) { return p.sev !== 'info' && (p.code === 'map' || p.code === 'agg' || p.code === 'dim' || p.code === 'perf' || p.code === 'cons'); });
      add(t, h('b', '', m.name + ' + ' + dimName), h('span', '', 'Cube: ' + dims.join(' x ')), h('span', '', fmt(c0.dense) + ' ' + ARROW + ' ' + fmt(c1.dense) + ' dense cells ' + DOT + ' ~' + fmt(c1.sparse) + ' populated'));
      if (!m.input) t.appendChild(h('code', '', m.manual ? 'Formula was hand-edited: it will not be redrafted.' : draft(m, dims)));
      if (pr.length) t.appendChild(probList(pr.slice(0, 3)));
      return true;
    }
    function renderTray() {
      if (!SK) return; clear(SK.tray); SK.tray.appendChild(h('span', 'as-tray-l', 'Dimensions'));
      live().filter(function (n) { return n.layer === 'dim'; }).forEach(function (d) {
        var c = h('button', 'as-chip st-' + d.status, d.name); c.type = 'button'; c.title = 'Drag onto a metric to add it to the cube. Enter adds it to the selected metric.';
        c.addEventListener('click', function () { var m = nodeBy(S.sel); if (c._dragged) { c._dragged = false; return; } if (m && m.layer === 'met') connect(d, m); else toast('Select a metric first, or drag this chip onto one.'); });
        c.addEventListener('pointerdown', function (ev) {
          if (ev.button !== 0) return; var sx = ev.clientX, sy = ev.clientY, on = false, target = null; try { c.setPointerCapture(ev.pointerId); } catch (e) {}
          var mv = function (e2) {
            if (!on && Math.abs(e2.clientX - sx) + Math.abs(e2.clientY - sy) < 5) return;
            if (!on) { on = true; SK.ghost.textContent = d.name; SK.ghost.hidden = false; SK.tip.hidden = false; }
            var p = localPt(e2), pw = SK.pane.clientWidth; SK.ghost.style.transform = 'translate(' + (p.x + 8) + 'px,' + (p.y + 8) + 'px)'; SK.tip.style.left = Math.max(8, Math.min(pw - 330, p.x + 18)) + 'px'; SK.tip.style.top = Math.max(8, p.y - 150) + 'px';
            var t = nodeAt(e2); if (target && target !== t && SK.els[target.id]) SK.els[target.id].classList.remove('drop', 'nodrop');
            target = t; var ok = previewDims(t, d.name); if (t && SK.els[t.id]) SK.els[t.id].classList.add(ok ? 'drop' : 'nodrop');
          };
          var up = function (e2) {
            c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); try { c.releasePointerCapture(e2.pointerId); } catch (e) {}
            if (!SK) return; SK.ghost.hidden = true; SK.tip.hidden = true; if (target && SK.els[target.id]) SK.els[target.id].classList.remove('drop', 'nodrop');
            if (on) { c._dragged = true; later(function () { c._dragged = false; }, 60); if (e2.type === 'pointerup' && target && target.layer === 'met') connect(d, target); }
          };
          c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
        });
        SK.tray.appendChild(c);
      });
    }
    function renderInspector() {
      if (!SK) return; var box = SK.insp, n = nodeBy(S.sel); clear(box); box.classList.toggle('none', !n || n.off);
      if (!n || n.off) {
        var D = diagAll(), bad = D.filter(function (p) { return p.sev === 'bad'; }).length, wr = D.filter(function (p) { return p.sev === 'warn'; }).length, cells = 0;
        live().forEach(function (m) { if (m.layer === 'met' && m.status !== 'existing') cells += cube(m).dense; });
        add(box, h('h3', '', 'Design summary'), h('p', 'as-note', 'Select a node to edit it. Existing blocks are read from the model; new and changed ones are your design.'));
        var kv = h('div', 'as-kv'); add(kv, h('span', '', 'New blocks'), h('b', '', String(live().filter(function (x) { return x.status === 'proposed'; }).length)), h('span', '', 'Changed blocks'), h('b', '', String(live().filter(function (x) { return x.status === 'changed'; }).length)), h('span', '', 'New dense cells'), h('b', '', fmt(cells)), h('span', '', 'Conflicts'), h('b', bad ? 'sev-bad' : '', String(bad)), h('span', '', 'Checks'), h('b', wr ? 'sev-warn' : '', String(wr)));
        box.appendChild(kv);
        var first = D.filter(function (p) { return p.sev === 'bad'; }).slice(0, 4);
        first.forEach(function (p) { var b = btn('lnk sev-bad', nodeBy(p.node).name + ': ' + p.text, function () { selectNode(p.node); }); box.appendChild(b); });
        add(box, btn('pri', 'Validate the design', function () { go(3); }));
        return;
      }
      var re = function (structure) { return function () { changed(structure); }; };
      var hd = h('div', 'as-insp-h'); add(hd, pill(LAYERS[LAYER_IX[n.layer]].one, 'ly-' + n.layer), btn('ic', TIMES, function () { selectNode(null); }, 'Close')); box.appendChild(hd);
      var nameIn = input(n.name, function (v) { v = txt(v, 80).trim(); if (!v) { changed(false); return; } var old = n.name; n.name = v; if (n.layer === 'dim') live().forEach(function (m) { if (m.layer === 'met') { var i = m.dims.indexOf(old); if (i >= 0) { m.dims[i] = v; var j = (m.nd || []).indexOf(old); if (j >= 0) m.nd[j] = v; if (!m.manual) m.formula = draft(m); } } }); if (n.layer === 'imp') live().forEach(function (m) { if (m.base && m.base.t === 'tl' && m.base.list === old) { m.base.list = v; if (!m.manual) m.formula = draft(m); } }); if (n.status === 'existing') n.status = 'changed'; changed(true); }); nameIn.classList.add('as-name'); nameIn.setAttribute('aria-label', 'Name');
      box.appendChild(nameIn);
      box.appendChild(field('Status', select([['existing', 'Existing (as is)'], ['proposed', 'New (proposed)'], ['changed', 'Changed']], n.status, function (v) { n.status = v; changed(false); })));
      if (n.layer === 'src') {
        add(box, field('Rows (approx.)', input(n.rows || '', function (v) { n.rows = Math.max(0, parseFloat(v) || 0); changed(false); }, 'e.g. 21000', 'as-short')), field('Columns', area(n.cols.join(', '), function (v) { n.cols = splitList(v); if (n.status === 'existing') n.status = 'changed'; changed(false); }, 3), 'Comma-separated. Editing marks the source as changed.'));
      } else if (n.layer === 'imp') {
        var srcs = [['', '(none)']].concat(live().filter(function (x) { return x.layer === 'src'; }).map(function (x) { return [x.name, x.name]; }));
        add(box, field('Source table', select(srcs, n.source, function (v) { var s = nodeNamed(v, 'src'); S.model.edges = S.model.edges.filter(function (e) { var x = nodeBy(e[0]); return !(e[1] === n.id && x && x.layer === 'src'); }); n.source = v; if (s) link(s, n); changed(true); })),
          field('Grain (one row is...)', input(n.grain.join(', '), function (v) { n.grain = splitList(v); changed(false); }, 'Customer, Product, Month')),
          field('Unique keys', input(n.keys.join(', '), function (v) { n.keys = splitList(v); changed(false); }, 'CUSTOMER_ID, MONTH')),
          field('Column ' + ARROW + ' property', area(n.map.map(function (m) { return m[0] + ' ' + ARROW + ' ' + m[1]; }).join(NL), function (v) { n.map = v.split(NL).map(function (l) { var p = l.split(ARROW); return p.length === 2 ? [p[0].trim(), p[1].trim()] : null; }).filter(function (x) { return x && x[0] && x[1]; }).slice(0, 30); changed(false); }, 5), 'One per line: COLUMN ' + ARROW + ' Property'),
          field('Transformation steps', area(n.steps.join(NL), function (v) { n.steps = v.split(NL).map(function (x) { return txt(x.trim(), 240); }).filter(Boolean).slice(0, 12); changed(false); }, 4)));
      } else if (n.layer === 'dim') {
        var opts = [['', '(not mapped)'], ['Manual input', 'Manual input']]; live().forEach(function (s) { if (s.layer === 'src') s.cols.forEach(function (c) { opts.push([s.name + '.' + c, s.name + '.' + c]); }); }); if (n.mapSource && !opts.some(function (o) { return o[0] === n.mapSource; })) opts.push([n.mapSource, n.mapSource]);
        add(box, field('Items (approx.)', input(n.items, function (v) { n.items = Math.max(1, parseFloat(v) || 1); changed(false); }, '', 'as-short')),
          field('Mapped from', select(opts, n.mapSource, function (v) { n.mapSource = v; var s = nodeNamed(v.split('.')[0], 'src'); S.model.edges = S.model.edges.filter(function (e) { var x = nodeBy(e[0]); return !(e[1] === n.id && x && x.layer === 'src'); }); if (s) link(s, n); if (n.status === 'existing') n.status = 'changed'; changed(true); })),
          field('Properties / hierarchy', input((n.props || []).join(', '), function (v) { n.props = splitList(v); if (n.status === 'existing') n.status = 'changed'; changed(false); }, 'Customer Segment, Country'), 'A property that is itself a dimension lets metrics roll up with BY.'));
        var users = live().filter(function (m) { return m.layer === 'met' && has(m.dims, n.name); }); box.appendChild(field('Used by', h('div', 'as-val', users.map(function (m) { return m.name; }).join(', ') || 'no metric on the canvas')));
      } else if (n.layer === 'met') {
        var chips = h('div', 'as-chips');
        n.dims.forEach(function (d) { var c = h('span', 'as-pill k-dim', d), x = h('button', 'as-x', TIMES); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + d + ' from ' + n.name); x.addEventListener('click', function () { setDims(n, n.dims.filter(function (y) { return y !== d; })); changed(true); }); c.appendChild(x); chips.appendChild(c); });
        var avail = live().filter(function (d) { return d.layer === 'dim' && !has(n.dims, d.name); }).map(function (d) { return [d.name, d.name]; });
        var addD = select([['', '+ dimension']].concat(avail), '', function (v) { if (v) { setDims(n, n.dims.concat([v])); changed(true); } }); addD.classList.add('as-mini'); addD.setAttribute('aria-label', 'Add a dimension'); chips.appendChild(addD);
        add(box, field('Dimensions', chips), cubeBar(cube(n)));
        var g = h('div', 'as-row'); add(g, check('Input (no formula)', n.input, function (v) { n.input = v; if (v) n.formula = ''; else if (!n.manual) n.formula = draft(n); if (n.status === 'existing') n.status = 'changed'; changed(false); }), select([['SUM', 'Sums up'], ['AVG', 'Averages'], ['RATIO', 'Ratio / rate']], n.agg, function (v) { n.agg = v; if (!n.manual) n.formula = draft(n); changed(false); })); box.appendChild(g);
        if (!n.input) {
          var ta = area(n.formula, function (v) { n.formula = txt(v, 1600); n.manual = true; if (!n.base) { n.base = { t: 'expr', expr: n.formula }; n.nd = n.dims.slice(); n.manual = false; } if (n.status === 'existing') n.status = 'changed'; S.model.edges = S.model.edges.filter(function (e) { var a = nodeBy(e[0]); return !(e[1] === n.id && a && a.layer === 'met' && !has(refNames(n.formula), a.name)); }); refNames(n.formula).forEach(function (r) { var a = nodeNamed(r); if (a && a !== n && (a.layer === 'met' || a.layer === 'imp')) link(a, n); }); changed(true); }, 5, "'Metric A' * 'Metric B'"); ta.classList.add('as-code');
          box.appendChild(field('Draft formula', ta, n.manual ? 'Hand-edited: dimension changes will not redraft it.' : 'Redrafted when you change dimensions.'));
          var dft = draft(n); if (n.manual && n.base && dft !== n.formula) box.appendChild(btn('', 'Use Studio' + String.fromCharCode(39) + 's draft for these dimensions', function () { n.manual = false; n.formula = draft(n); changed(false); }));
          if (n.was) box.appendChild(field('Formula today', h('pre', 'as-formula', n.was)));
        }
      } else {
        box.appendChild(field('Kind', select([['board', 'Board'], ['frame', 'Frame widget / data source'], ['table', 'Table']], n.okind, function (v) { n.okind = v; changed(false); })));
      }
      box.appendChild(field('Notes', area(n.note, function (v) { n.note = txt(v, 300); save(); }, 2)));
      var E = liveEdges(), rd = E.filter(function (e) { return e[1] === n.id; }), fd = E.filter(function (e) { return e[0] === n.id; });
      var links = function (title, list, other) { if (!list.length) return; var w = h('div', 'as-links'); list.forEach(function (e) { var o = nodeBy(e[other]), r = h('div'), go2 = btn('lnk', o.name, function () { selectNode(o.id); }), x = btn('ic', TIMES, function () { unlink(e[0], e[1]); changed(true); }, 'Disconnect'); x.setAttribute('aria-label', 'Disconnect ' + o.name); add(r, go2, x); w.appendChild(r); }); box.appendChild(field(title, w)); };
      links('Reads', rd, 0); links('Feeds', fd, 1);
      var pr = diagNode(n); if (pr.length) box.appendChild(probList(pr));
      box.appendChild(btn('danger', n.ref || n.status === 'existing' ? 'Hide from the sketch' : 'Remove from the design', function () { removeNode(n.id); }));
    }

    /* ----- step 4: validate ----- */
    function renderValidate(pane) {
      var main = h('div', 'as-col'), side = h('div', 'as-col as-side'), D = diagAll(), L = live();
      var jump = function (id) { return function () { S.sel = id; go(2); }; };
      var groups = [
        ['Every proposed metric has a formula and its dimensions resolve', function (p) { return p.code === 'formula' || p.code === 'dim' || p.code === 'ref'; }, L.filter(function (n) { return n.layer === 'met' && n.status !== 'existing'; }).length + ' metrics checked'],
        ['Every import has a source, keys and a stated grain', function (p) { return p.code === 'keys' || p.code === 'imp' || p.code === 'grain' || p.code === 'col'; }, L.filter(function (n) { return n.layer === 'imp' && n.status !== 'existing'; }).length + ' imports checked'],
        ['Every new dimension is mapped from a source', function (p) { return p.code === 'map'; }, L.filter(function (n) { return n.layer === 'dim' && n.status !== 'existing'; }).length + ' dimensions checked'],
        ['Aggregation is consistent', function (p) { return p.code === 'agg'; }, 'ratios, ADD without a driver'],
        ['Naming conventions', function (p) { return p.code === 'name'; }, 'prefixes, no % in names, unique names'],
        ['Performance', function (p) { return p.code === 'perf'; }, 'scope, sparsity, dense IFs'],
        ['Your constraints and loose ends', function (p) { return p.code === 'cons' || p.code === 'out' || p.code === 'orphan' || p.code === 'src'; }, 'constraints from the intent, unread blocks']
      ];
      var nb = D.filter(function (p) { return p.sev === 'bad'; }).length, nw = D.filter(function (p) { return p.sev === 'warn'; }).length;
      var top = sec(nb ? nb + ' conflict' + (nb === 1 ? '' : 's') + ' to resolve' : nw ? 'No conflicts. ' + nw + ' thing' + (nw === 1 ? '' : 's') + ' to check' : 'The design holds together', 'Rule-based checks. Formulas are drafts: validate them against the live model before building.');
      main.appendChild(top);
      groups.forEach(function (g) {
        var ps = D.filter(g[1]), w = worst(ps), s = h('section', 'as-card as-chk ' + (w === 'bad' ? 'bad' : w === 'warn' ? 'warn' : 'ok')), hd = h('div', 'as-card-h');
        add(hd, h('i', 'as-mark', w === 'bad' ? '!' : w === 'warn' ? '?' : String.fromCharCode(10003)), h('h3', '', g[0]), h('span', '', ps.length ? ps.length + ' finding' + (ps.length === 1 ? '' : 's') : g[2])); s.appendChild(hd);
        ps.forEach(function (p) { var r = h('div', 'as-find sev-' + p.sev); add(r, btn('lnk', nodeBy(p.node).name, jump(p.node), 'Show in the sketch'), h('span', '', p.text)); s.appendChild(r); });
        main.appendChild(s);
      });
      var rw = sec('What reads what', 'New and changed blocks only'), tbl = h('div', 'as-reads'), E = liveEdges();
      L.filter(function (n) { return n.status !== 'existing' && n.layer !== 'src'; }).forEach(function (n) {
        var ins = E.filter(function (e) { return e[1] === n.id; }).map(function (e) { return nodeBy(e[0]).name; }).concat(n.layer === 'met' ? [] : []), outs = E.filter(function (e) { return e[0] === n.id; }).map(function (e) { return nodeBy(e[1]).name; }), r = h('div');
        add(r, h('span', '', ins.join(', ') || '-'), h('i', '', ARROW), btn('lnk', n.name, jump(n.id)), h('i', '', ARROW), h('span', '', outs.join(', ') || '-')); tbl.appendChild(r);
      });
      rw.appendChild(tbl); main.appendChild(rw);
      var cells = sec('Cell estimates', 'Dense vs expected populated');
      L.filter(function (n) { return n.layer === 'met' && n.status !== 'existing'; }).forEach(function (n) { var r = h('div', 'as-prop'); add(r, btn('lnk', n.name, jump(n.id)), cubeBar(cube(n))); cells.appendChild(r); });
      add(side, btn('pri big', nb ? 'Build the plan anyway' : 'Build the plan', function () { go(4); }), btn('', 'Back to the sketch', function () { go(2); }), cells);
      add(pane, main, side);
    }

    /* ----- step 5: execute ----- */
    function renderExecute(pane) {
      var main = h('div', 'as-col'), side = h('div', 'as-col as-side'), st = plan(), D = diagAll(), nb = D.filter(function (p) { return p.sev === 'bad'; }).length;
      var top = sec('Build plan', st.length ? st.length + ' ordered steps. A draft: nothing has been written to Pigment.' : 'Nothing new or changed in the design yet.');
      var ol = h('div', 'as-plan'), ph = '';
      st.forEach(function (s) { if (s.phase !== ph) { ph = s.phase; ol.appendChild(h('div', 'as-plan-ph', ph)); } var r = h('div', 'as-plan-s'), b = h('div'); add(b, h('b', '', s.action + ': ' + s.target), h('code', '', s.tool), h('p', '', s.detail)); add(r, h('i', '', String(s.n)), b); ol.appendChild(r); });
      top.appendChild(ol); main.appendChild(top);
      var ex = sec('Export', 'For you, or for Claude with the Pigment MCP to execute'), seg = h('div', 'as-seg'), ta = h('textarea', 'as-in as-code as-export'); ta.readOnly = true; ta.rows = 12; ta.spellcheck = false; ta.setAttribute('aria-label', 'Build plan export');
      var bt = btn(S.exp === 'text' ? 'on' : '', 'Text', function () { S.exp = 'text'; render(); }), bj = btn(S.exp === 'json' ? 'on' : '', 'JSON', function () { S.exp = 'json'; render(); }); add(seg, bt, bj);
      ta.value = S.exp === 'json' ? planJson(st) : planText(st);
      var copy = btn('', 'Copy to clipboard', function () {
        var done = function () { toast('Plan copied (' + S.exp + ')'); }, fall = function () { ta.focus(); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } if (ok) done(); else toast('Select the text and copy it manually.'); };
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fall); else fall(); } catch (e) { fall(); }
      });
      var row = h('div', 'as-row'); add(row, seg, copy); add(ex, row, ta); side.appendChild(ex);
      var cr = sec('Send as change request', 'Goes to the frame' + String.fromCharCode(39) + 's Requests list after your approval. Studio never writes to the model.');
      if (nb) cr.appendChild(h('p', 'as-note sev-bad', nb + ' open conflict' + (nb === 1 ? '' : 's') + ' will be listed in the request.'));
      var sb = btn('pri big', S.sending === 'approve' ? 'Waiting for your approval...' : S.sending === 'write' ? 'Waiting for Pigment...' : 'Send as change request', sendRequest); sb.disabled = !!S.sending || !st.length; if (S.sending) sb.classList.add('busy');
      cr.appendChild(sb);
      if (S.sending === 'write') cr.appendChild(h('p', 'as-note', 'If Pigment asks whether this frame may write, allow it to continue. Nothing else is changed.'));
      if (S.sent) cr.appendChild(h('p', 'as-note sev-ok', 'Request sent ' + S.sent + '. The plan stays here for the builder.'));
      UI.sendNote = h('p', 'as-note'); UI.sendNote.setAttribute('aria-live', 'polite'); cr.appendChild(UI.sendNote);
      add(side, cr, btn('', 'Back to validation', function () { go(3); }));
      add(pane, main, side);
    }
    function requestText(st) {
      var L = live(), names = function (layer, status) { return L.filter(function (n) { return n.layer === layer && n.status === status; }).map(function (n) { return n.name; }); };
      var parts = [], addP = function (label, a) { if (a.length) parts.push(label + ': ' + a.slice(0, 3).join(', ') + (a.length > 3 ? ' +' + (a.length - 3) : '')); };
      addP('New dims', names('dim', 'proposed')); addP('New lists', names('imp', 'proposed')); addP('New metrics', names('met', 'proposed')); addP('Changes', L.filter(function (n) { return n.status === 'changed'; }).map(function (n) { return n.name; })); addP('New sources needed', names('src', 'proposed'));
      return txt('Architecture Studio plan (' + st.length + ' steps): ' + txt(S.intent.goal || 'model enhancement', 110) + ' | ' + parts.join(' | '), 375);
    }
    function sendRequest() {
      if (S.sending) return; var st = plan(); if (!st.length) return;
      var text = requestText(st), note = function (t) { if (UI.sendNote) UI.sendNote.textContent = t; say(t); };
      S.sending = 'approve'; render();
      var approve = ctx.approve ? ctx.approve({ title: 'Send this build plan as a change request', local: true, confirm: 'Continue', what: 'Raises one change request summarising ' + st.length + ' build steps (' + live().filter(function (n) { return n.status === 'proposed'; }).length + ' new blocks, ' + live().filter(function (n) { return n.status === 'changed'; }).length + ' changed). No list, metric, board or formula is created or edited.', where: 'Nothing yet. The next sheet shows the exact request text and where it is written (the frame' + String.fromCharCode(39) + 's Requests list).', reversible: 'Yes. The request can be undone from Actions taken.' }) : Promise.resolve(false);
      Promise.resolve(approve).then(function (ok) {
        if (dead) return null;
        if (!ok) { S.sending = ''; render(); note('Not sent. Nothing was written.'); return null; }
        if (!ctx.act || !ctx.act.request) { S.sending = ''; render(); note('This host has no request path. Copy the plan instead.'); return null; }
        S.sending = 'write'; render();
        return Promise.resolve(ctx.act.request(text, { title: 'Architecture Studio build plan', id: 'architect' })).then(function (res) {
          if (dead) return; S.sending = '';
          if (res && res.ok === false) { render(); note(res.cancelled ? 'Cancelled. Nothing was written.' : 'Not sent: ' + txt(res.msg || 'the write was not accepted', 160)); return; }
          var d = new Date(); S.sent = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
          render(); save(); note(res && res.msg ? txt(res.msg, 160) : 'Change request sent.');
        });
      }).then(null, function (e) { if (dead) return; S.sending = ''; render(); note('Not sent: ' + txt(e && e.message, 160)); });
    }

    /* ----- mount ----- */
    var style = h('style'); style.textContent = CSS; root.appendChild(style);
    var bar = h('header', 'as-bar'), ttl = h('div', 'as-ttl'); add(ttl, h('h2', '', 'Architecture Studio'), h('span', '', 'From meeting notes to a concrete Pigment build' + (C.sample ? ' ' + DOT + ' SAMPLE catalog' : '')));
    UI.steps = h('nav', 'as-steps'); UI.steps.setAttribute('aria-label', 'Studio steps'); UI.saved = h('span', 'as-saved', ''); UI.saved.setAttribute('aria-live', 'polite');
    UI.dir = h('span', 'as-dir', '');
    var reset = btn('', 'New design', function () {
      var doIt = function () { S.model = null; S.sel = null; S.sent = ''; S.ai = null; S.intent = { tpl: '', goal: '', notes: '', noSrc: false, reuse: true, budget: '', cons: '' }; S.step = 0; render(); save(); };
      if (!S.model || !ctx.approve) { doIt(); return; }
      Promise.resolve(ctx.approve({ title: 'Start a new design', local: true, confirm: 'Discard and start over', what: 'Clears your saved Architecture Studio draft (intent, sketch and plan).', where: 'Only your own draft in this frame. Nothing in Pigment changes.', reversible: 'No. The draft is discarded.' })).then(function (ok) { if (ok && !dead) doIt(); });
    }, 'Discard this draft and start again');
    add(bar, ttl, UI.steps, UI.dir, UI.saved, reset); UI.body = h('div', 'as-body'); add(root, bar, UI.body); root0.appendChild(root);
    applyTheme();
    var saved = null; try { saved = ctx.store && ctx.store.get ? ctx.store.get(STORE_KEY) : null; } catch (e) { saved = null; }
    var restored = false; try { restored = unpack(saved); } catch (e) { restored = false; S.model = null; S.step = 0; }
    render(); if (restored && S.model) setSaved('Design restored');
    try { if (ctx.theme && ctx.theme.on) { var o1 = ctx.theme.on(function () { applyTheme(); }); if (typeof o1 === 'function') offs.push(o1); } } catch (e) {}
    var ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(function () { root.classList.toggle('as-narrow', root.clientWidth < 1020); root.classList.toggle('as-tight', root.clientWidth < 840); if (SK) applyCam(); }); ro.observe(root); }
    function onFocus(f) {
      if (!f) { try { f = ctx.focus && ctx.focus.get ? ctx.focus.get() : null; } catch (e) { f = null; } }
      var t = f ? txt(f.text || f.topic || f.metric || '', 60) : ''; if (lc(t) === 'all' || lc(t) === 'everything') t = ''; UI.dir.textContent = t ? 'Direction: ' + t : ''; UI.dir.hidden = !t;
      if (S.step === 0 && !S.intent.tpl) render();
    }
    onFocus(null);
    return { onFocus: onFocus, destroy: function () { dead = true; timers.forEach(function (t) { window.clearTimeout(t); }); offs.forEach(function (o) { try { o(); } catch (e) {} }); if (ro) ro.disconnect(); try { if (S.model && ctx.store && ctx.store.set) { var p = ctx.store.set(STORE_KEY, pack()); if (p && p.then) p.then(null, function () {}); } } catch (e) {} if (root.parentNode) root.parentNode.removeChild(root); SK = null; } };
  }

  /* ---------- styles (scoped to .as-root; colours come from ctx.theme tokens) ---------- */
  var CSS = [
    '.as-root{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;background:var(--a-bg);color:var(--a-ink);font:13px/1.45 var(--a-f-body,Inter,"Segoe UI",system-ui,-apple-system,sans-serif);--mono:var(--a-f-mono,ui-monospace,SFMono-Regular,Menlo,monospace);--disp:var(--a-f-display,"Segoe UI",system-ui,sans-serif);overflow:hidden;text-align:left}',
    '.as-root *{box-sizing:border-box}.as-root button,.as-root input,.as-root select,.as-root textarea{font:inherit;color:inherit}',
    '.as-root :focus-visible{outline:2px solid var(--a-accent);outline-offset:2px}',
    '.as-bar{display:flex;align-items:center;gap:14px;padding:10px 16px;border-bottom:1px solid var(--a-line);background:var(--a-surface);flex:none;flex-wrap:wrap}',
    '.as-ttl h2{margin:0;font:650 17px/1.2 var(--disp);letter-spacing:-.01em}.as-ttl span{color:var(--a-muted);font-size:11.5px}',
    '.as-steps{display:flex;gap:4px;margin:0 auto;flex-wrap:wrap}',
    '.as-step{display:flex;align-items:center;gap:7px;border:1px solid transparent;background:none;border-radius:999px;padding:4px 12px 4px 5px;cursor:pointer;color:var(--a-muted)}',
    '.as-step i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;background:var(--a-sunk);color:var(--a-ink-2)}',
    '.as-step:hover{background:var(--a-sunk)}.as-step.on{background:var(--a-accent-soft);color:var(--a-ink);border-color:var(--a-accent)}.as-step.on i{background:var(--a-accent);color:var(--a-accent-ink)}.as-step.done i{background:var(--a-ok);color:var(--a-surface)}',
    '.as-saved,.as-dir{font-size:11.5px;color:var(--a-faint);white-space:nowrap}.as-dir{color:var(--a-accent)}',
    '.as-b{border:1px solid var(--a-line);background:var(--a-surface);border-radius:8px;padding:6px 12px;cursor:pointer;white-space:nowrap}.as-b:hover{border-color:var(--a-faint)}.as-b:disabled{opacity:.55;cursor:default}',
    '.as-b.pri{background:var(--a-accent);border-color:var(--a-accent);color:var(--a-accent-ink);font-weight:600}.as-b.big{padding:10px 14px;font-size:13.5px;white-space:normal}.as-b.ic{padding:4px 9px;min-width:30px}.as-b.on{background:var(--a-ink);color:var(--a-bg);border-color:var(--a-ink)}',
    '.as-b.lnk{border:0;background:none;padding:0;color:var(--a-accent);text-align:left;white-space:normal;font-weight:600}.as-b.lnk:hover{text-decoration:underline}.as-b.danger{color:var(--a-bad);margin-top:6px}.as-b.busy{background:var(--a-sunk);color:var(--a-ink-2);border-color:var(--a-line)}',
    '.as-body{flex:1;min-height:0;position:relative}.as-pane{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;gap:16px;padding:16px 16px 64px;overflow:auto}',
    '.as-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:14px}.as-side{flex:none;width:320px}.as-narrow .as-side{width:270px}',
    '.as-card{border:1px solid var(--a-line);background:var(--a-surface);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}',
    '.as-card-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.as-card-h h3{margin:0;font:650 14.5px/1.25 var(--disp)}.as-card-h span{color:var(--a-muted);font-size:12px}',
    '.as-tpls{display:grid;grid-template-columns:1fr 1fr;gap:10px}.as-tpl{text-align:left;border:1px solid var(--a-line);background:var(--a-raise);border-radius:12px;padding:11px 12px;cursor:pointer;display:flex;flex-direction:column;gap:4px;align-items:flex-start;transition:border-color .15s,transform .15s}',
    '.as-tpl:hover{border-color:var(--a-accent);transform:translateY(-1px)}.as-tpl.on{border-color:var(--a-accent);background:var(--a-accent-soft);box-shadow:inset 0 0 0 1px var(--a-accent)}.as-tpl b{font:650 13.5px/1.25 var(--disp)}.as-tpl span{color:var(--a-muted);font-size:12px}',
    '.as-f{display:flex;flex-direction:column;gap:4px}.as-f>span{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--a-faint);font-weight:600}.as-f>em{font-style:normal;font-size:11px;color:var(--a-faint)}',
    '.as-in{width:100%;border:1px solid var(--a-line);background:var(--a-raise);border-radius:8px;padding:6px 9px;resize:vertical;min-width:0}.as-in.as-short{width:120px}.as-in.as-code,.as-formula,.as-mono{font-family:var(--mono);font-size:11.5px;line-height:1.5}',
    '.as-in.as-name{font:650 15px/1.3 var(--disp);border-color:transparent;background:none;padding-left:0}.as-in.as-name:hover,.as-in.as-name:focus{border-color:var(--a-line);background:var(--a-raise);padding-left:9px}',
    '.as-in.as-mini{width:auto;padding:2px 6px;border-radius:999px;font-size:12px}.as-in.as-add{width:150px}.as-export{white-space:pre;overflow:auto}',
    '.as-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.as-ck{display:flex;gap:6px;align-items:center;cursor:pointer}',
    '.as-pill{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--a-line);border-radius:999px;padding:1px 9px;font-size:11.5px;background:var(--a-raise);color:var(--a-ink-2);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}',
    '.as-pill.k-dim{border-color:var(--a-k-dim);color:var(--a-k-dim)}.as-pill.k-set{border-color:var(--a-k-set);color:var(--a-k-set)}.as-pill.st-proposed{border-style:dashed;border-color:var(--a-accent);color:var(--a-accent)}.as-pill.st-changed{border-color:var(--a-warn);color:var(--a-warn)}.as-pill.st-existing{color:var(--a-faint)}',
    '.as-pill.sev-bad{background:var(--a-bad);border-color:var(--a-bad);color:var(--a-surface)}.as-pill.sev-warn{border-color:var(--a-warn);color:var(--a-warn)}',
    '.as-pill.ly-src{color:var(--a-muted)}.as-pill.ly-imp{color:var(--a-k-tl);border-color:var(--a-k-tl)}.as-pill.ly-dim{color:var(--a-k-dim);border-color:var(--a-k-dim)}.as-pill.ly-met{color:var(--a-k-metric);border-color:var(--a-k-metric)}.as-pill.ly-out{color:var(--a-k-board);border-color:var(--a-k-board)}',
    '.as-x{border:0;background:none;cursor:pointer;padding:0 0 0 2px;font-size:13px;line-height:1;color:inherit}',
    '.as-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.as-chips em,.as-empty{color:var(--a-faint);font-style:normal;font-size:12px}.as-val{font-weight:600}',
    '.as-stats{display:flex;flex-wrap:wrap;gap:8px}.as-stats div{flex:1;min-width:86px;background:var(--a-sunk);border-radius:10px;padding:8px 10px}.as-stats b{display:block;font:650 19px/1.1 var(--disp)}.as-stats span{font-size:11px;color:var(--a-muted)}',
    '.as-prop{border-top:1px solid var(--a-line-soft);padding-top:10px;display:flex;flex-direction:column;gap:6px}.as-prop.off{opacity:.45}.as-prop-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.as-prop-h b{font-weight:650}',
    '.as-note{margin:0;color:var(--a-muted);font-size:12px}.as-note.sev-bad{color:var(--a-bad)}.as-note.sev-ok{color:var(--a-ok)}.as-sub{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--a-faint);font-weight:600}',
    '.as-kv{display:grid;grid-template-columns:minmax(64px,42%) minmax(0,1fr);gap:3px 12px;font-size:12px}.as-kv span{color:var(--a-muted);overflow-wrap:anywhere}.as-kv b{font-weight:600;overflow-wrap:anywhere}.as-kv b.sev-bad{color:var(--a-bad)}.as-kv b.sev-warn{color:var(--a-warn)}',
    '.as-map{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;font-size:12px}.as-map div{display:flex;gap:6px;align-items:baseline}.as-map code{font-family:var(--mono);font-size:11px;color:var(--a-k-tl)}.as-map i{font-style:normal;color:var(--a-faint)}',
    '.as-steps-l{margin:0;padding-left:18px;font-size:12px;color:var(--a-ink-2)}.as-formula{margin:0;background:var(--a-sunk);border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-wrap:anywhere}.as-mono{margin:0;color:var(--a-ink-2);overflow-wrap:anywhere}',
    '.as-cube{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--a-muted)}.as-cube-bar{height:6px;border-radius:3px;background:var(--a-sunk);overflow:hidden}.as-cube-bar i{display:block;height:100%;background:var(--a-k-metric);border-radius:3px;transition:width .4s}',
    '.as-probs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:12px}.as-probs li{display:flex;gap:7px;align-items:baseline;border-left:3px solid var(--a-line);padding-left:8px}.as-probs b{flex:none;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em}',
    '.as-probs .sev-bad{border-color:var(--a-bad)}.as-probs .sev-bad b{color:var(--a-bad)}.as-probs .sev-warn{border-color:var(--a-warn)}.as-probs .sev-warn b{color:var(--a-warn)}.as-probs .sev-info b{color:var(--a-faint)}',
    /* sketch */
    '.as-p2{padding:0;gap:0;overflow:hidden}.as-sk-main{flex:1;min-width:0;display:flex;flex-direction:column}',
    '.as-tb{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--a-line);background:var(--a-surface);flex-wrap:wrap}.as-seg{display:inline-flex}.as-seg .as-b{border-radius:0}.as-seg .as-b:first-child{border-radius:8px 0 0 8px}.as-seg .as-b:last-child{border-radius:0 8px 8px 0;margin-left:-1px}',
    '.as-legend{display:flex;gap:10px;font-size:11.5px;color:var(--a-muted);margin-left:6px}.as-legend span:before{content:"";display:inline-block;width:14px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;border:1.5px solid var(--a-faint)}.as-legend .lg-proposed:before{border:1.5px dashed var(--a-accent);background:var(--a-accent-soft)}.as-legend .lg-changed:before{border-color:var(--a-warn)}',
    '.as-tb-hint{color:var(--a-faint);font-size:11.5px;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;text-align:right}',
    '.as-stage{flex:1;min-height:0;position:relative;overflow:hidden;cursor:grab;touch-action:none;background-image:radial-gradient(var(--a-line) 1px,transparent 1px);background-size:22px 22px}.as-stage.grab{cursor:grabbing}.as-stage.is3{perspective:1800px;background-image:none}',
    '.as-world{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;transform-style:preserve-3d}.as-world.as-anim,.as-world.as-anim .as-plane{transition:transform .6s cubic-bezier(.2,.7,.2,1),width .6s,height .6s}',
    '.as-plane{position:absolute;left:0;top:0;transform-style:preserve-3d;border-radius:16px}.as-plane-tag{position:absolute;left:14px;top:8px;display:flex;gap:8px;align-items:baseline;white-space:nowrap}.as-plane-tag b{font:650 12px/1.2 var(--disp);letter-spacing:.06em;text-transform:uppercase;color:var(--a-ink-2)}.as-plane-tag span{font-size:11px;color:var(--a-faint)}',
    '.is3 .as-plane{background:color-mix(in srgb,var(--a-surface) 82%,transparent);border:1px solid var(--a-line);box-shadow:0 30px 60px -40px rgba(0,0,0,.45)}',
    '.as-node{position:absolute;width:178px;height:50px;border:1.5px solid var(--a-line);border-left-width:4px;background:var(--a-raise);border-radius:10px;padding:6px 16px 6px 9px;cursor:pointer;display:flex;flex-direction:column;justify-content:center;transition:left .45s cubic-bezier(.2,.7,.2,1),top .45s cubic-bezier(.2,.7,.2,1),opacity .2s,box-shadow .2s;user-select:none;-webkit-user-select:none}',
    '.as-still .as-node,.as-noxy .as-node{transition:none}.as-still .as-world.as-anim,.as-still .as-world.as-anim .as-plane{transition:none}',
    '.as-node b{font-weight:650;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.as-node span{font-size:10.5px;color:var(--a-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.as-node.ly-src{border-left-color:var(--a-faint)}.as-node.ly-imp{border-left-color:var(--a-k-tl)}.as-node.ly-dim{border-left-color:var(--a-k-dim)}.as-node.ly-met{border-left-color:var(--a-k-metric)}.as-node.ly-out{border-left-color:var(--a-k-board)}',
    '.as-node.st-proposed{border-style:dashed;border-color:var(--a-accent);border-left-style:solid;background:var(--a-accent-soft)}.as-node.st-changed{border-color:var(--a-warn);box-shadow:inset 0 0 0 1px var(--a-warn)}',
    '.as-node:hover{box-shadow:0 8px 18px -10px rgba(0,0,0,.4)}.as-node.sel{box-shadow:0 0 0 3px var(--a-accent),0 12px 24px -12px rgba(0,0,0,.5);z-index:3}.as-node.dimmed{opacity:.32}.as-node.drop{box-shadow:0 0 0 3px var(--a-ok);opacity:1}.as-node.nodrop{box-shadow:0 0 0 3px var(--a-bad);opacity:1}',
    '.as-n-tag{position:absolute;right:8px;top:-8px;font:700 9px/1 var(--mono);font-style:normal;letter-spacing:.06em;background:var(--a-accent);color:var(--a-accent-ink);border-radius:4px;padding:2px 5px}.st-changed .as-n-tag{background:var(--a-warn);color:var(--a-surface)}',
    '.as-n-bad{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font:700 11px/1 var(--mono);font-style:normal;color:var(--a-surface);background:var(--a-bad)}.as-n-bad.sev-warn{background:var(--a-warn)}.as-n-bad[hidden],.as-n-tag[hidden]{display:none}',
    '.as-port{position:absolute;right:-7px;top:50%;width:13px;height:13px;margin-top:-6.5px;border-radius:50%;background:var(--a-surface);border:2px solid var(--a-faint);cursor:crosshair;touch-action:none}.as-port:hover{border-color:var(--a-accent);background:var(--a-accent)}',
    '.as-edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;transition:opacity .25s}.as-edge{fill:none;stroke:var(--a-faint);stroke-width:1.4;opacity:.55}.as-edge.new{stroke:var(--a-accent);stroke-dasharray:5 4;opacity:.8}.as-edge.dimlink{stroke:var(--a-k-dim);stroke-dasharray:2 4}.as-edge.hot{stroke-width:2.2;opacity:1}.as-edge.cold{opacity:.12}',
    '.as-beams{position:absolute;left:0;top:0;transform-style:preserve-3d;pointer-events:none;transition:opacity .25s}.as-beam{position:absolute;left:0;top:-1px;height:2px;transform-origin:0 50%;background:var(--a-faint);opacity:.4;border-radius:1px}.as-beam.new{background:var(--a-accent);opacity:.65}.as-beam.dimlink{background:var(--a-k-dim)}.as-beam.hot{height:3px;opacity:1}.as-beam.cold{opacity:.08}',
    '.as-over{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}.as-rubber{fill:none;stroke:var(--a-accent);stroke-width:2;stroke-dasharray:6 4}',
    '.as-tray{display:flex;gap:6px;align-items:center;padding:8px 12px;border-top:1px solid var(--a-line);background:var(--a-surface);overflow-x:auto;flex:none;min-height:46px;padding-left:58px;padding-right:150px}.as-tray-l{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--a-faint);font-weight:600;margin-right:4px}',
    '.as-chip{flex:none;border:1px solid var(--a-k-dim);color:var(--a-k-dim);background:var(--a-raise);border-radius:999px;padding:3px 11px;cursor:grab;font-size:12px;touch-action:none}.as-chip.st-proposed{border-style:dashed}.as-chip:hover{background:var(--a-sunk)}',
    '.as-ghost{position:absolute;left:0;top:0;z-index:20;pointer-events:none;border:1px solid var(--a-k-dim);background:var(--a-k-dim);color:var(--a-surface);border-radius:999px;padding:3px 11px;font-size:12px;box-shadow:0 10px 20px -8px rgba(0,0,0,.5)}.as-ghost[hidden],.as-tip[hidden]{display:none}',
    '.as-tip{position:absolute;z-index:19;pointer-events:none;width:320px;background:var(--a-ink);color:var(--a-bg);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;font-size:12px;box-shadow:0 18px 36px -14px rgba(0,0,0,.6)}.as-tip b{font:650 13px/1.25 var(--disp)}.as-tip code{font-family:var(--mono);font-size:10.5px;opacity:.85;overflow-wrap:anywhere}.as-tip .as-probs li{border-color:currentColor}.as-tip .as-probs b{color:inherit!important;opacity:.7}',
    '.as-insp{flex:none;width:310px;border-left:1px solid var(--a-line);background:var(--a-surface);padding:12px 14px 64px;overflow:auto;display:flex;flex-direction:column;gap:10px}.as-narrow .as-insp{width:262px}.as-insp h3{margin:0;font:650 15px/1.3 var(--disp)}.as-insp-h{display:flex;justify-content:space-between;align-items:center}',
    '.as-links{display:flex;flex-direction:column;gap:3px}.as-links div{display:flex;justify-content:space-between;gap:8px;align-items:center}.as-links .as-b.ic{padding:0 6px;min-width:0;border:0}',
    /* validate + execute */
    '.as-chk{border-left:4px solid var(--a-ok)}.as-chk.warn{border-left-color:var(--a-warn)}.as-chk.bad{border-left-color:var(--a-bad)}.as-mark{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font:700 11px/1 var(--mono);background:var(--a-ok);color:var(--a-surface);align-self:center}.as-chk.warn .as-mark{background:var(--a-warn)}.as-chk.bad .as-mark{background:var(--a-bad)}',
    '.as-find{display:grid;grid-template-columns:minmax(120px,210px) 1fr;gap:10px;font-size:12px;border-top:1px solid var(--a-line-soft);padding-top:7px}.as-find.sev-info{color:var(--a-muted)}',
    '.as-reads{display:flex;flex-direction:column;gap:5px;font-size:12px}.as-reads div{display:grid;grid-template-columns:1fr auto minmax(120px,1fr) auto 1fr;gap:8px;align-items:baseline}.as-reads i{font-style:normal;color:var(--a-faint)}.as-reads span{color:var(--a-muted);overflow-wrap:anywhere}',
    '.as-plan{display:flex;flex-direction:column;gap:8px}.as-plan-ph{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--a-faint);font-weight:600;margin-top:6px}.as-plan-s{display:flex;gap:10px}.as-plan-s>i{font-style:normal;flex:none;width:24px;height:24px;border-radius:50%;background:var(--a-sunk);display:grid;place-items:center;font-size:11px;font-weight:600}',
    '.as-plan-s b{display:block;font-weight:650}.as-plan-s code{font-family:var(--mono);font-size:10.5px;color:var(--a-k-metric)}.as-plan-s p{margin:2px 0 0;font-size:12px;color:var(--a-ink-2);overflow-wrap:anywhere}',
    '.as-p4 .as-side{width:400px}.as-narrow .as-p4 .as-side{width:330px}','.as-tight .as-pane{flex-direction:column;overflow-y:auto}.as-tight .as-pane>.as-col{flex:none;width:100%}.as-tight .as-pane.as-p2{flex-direction:row}.as-tight .as-insp{width:236px}.as-tight .as-insp.none{display:none}.as-tight .as-tpls{grid-template-columns:1fr}.as-tight .as-tb-hint{display:none}',
    '@media (prefers-reduced-motion:reduce){.as-root *{transition:none!important}}'
  ].join('');

  window.Lumina.registerView({
    id: 'architect', label: 'Architecture Studio', icon: ICON, kind: 'fluid', group: 'Build',
    mount: function (el, ctx) { if (V) { try { V.destroy(); } catch (e) {} } V = create(el, ctx || {}); },
    unmount: function () { if (V) { try { V.destroy(); } catch (e) {} V = null; } },
    onFocus: function (f) { if (V) V.onFocus(f); }
  });
})();
