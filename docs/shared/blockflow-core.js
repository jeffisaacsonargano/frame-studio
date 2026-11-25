  // SECTION: blockflow-core
  /* Blockflow core, shared word for word by Canvas Blockflow (apps/blockflow.html) and the Pigment frame
     (the frame build includes shared/blockflow-core.js). It owns the model index, the systems > stages >
     folders > blocks layout, edges, the node/folder/stage/system markup and styles, the animated renderer,
     highlight painting and cross-system process paths. Hosts own data, camera, panels and interaction.
     ES5 syntax only (the frame source is ES5); no network, storage or libraries. */
  var BFCore = (function () {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function clamp(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.max(a, Math.min(b, v)); }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function assign(a, b) { for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }
    function copy(o) { return assign({}, o); }

    /* ---------- block types and icons (Pigment's own block icons) ---------- */
    var TYPES = {
      dimension: { label: 'Dimension list', cls: 't-dim' },
      transaction: { label: 'Transaction list', cls: 't-txn' },
      metric: { label: 'Metric', cls: 't-met' },
      table: { label: 'Table', cls: 't-tab' },
      board: { label: 'Board', cls: 't-ext' },
      frame: { label: 'Frame', cls: 't-ext' },
      source: { label: 'Source system', cls: 't-ext' },
      wtable: { label: 'Warehouse table', cls: 't-wh' },
      analysis: { label: 'Claude analysis', cls: 't-ai' },
      app: { label: 'Pigment application', cls: 't-ext' }
    };
    var EXT_TYPES = { source: 1, app: 1, wtable: 1, analysis: 1 };
    var ICONS = {
      dimension: '<rect x="2" y="2" width="5.4" height="5.4" rx="1.3" style="fill:var(--t-dim)"/><rect x="8.6" y="2" width="5.4" height="5.4" rx="1.3" style="fill:var(--t-dim)"/><rect x="2" y="8.6" width="12" height="5.4" rx="1.3" style="fill:var(--t-dim-soft)"/>',
      transaction: '<rect x="2" y="3" width="12" height="4.8" rx="1.3" style="fill:var(--t-txn)"/><rect x="2" y="8.9" width="12" height="4.3" rx="1.3" style="fill:var(--t-txn-soft)"/>',
      metric: '<path d="M3.3 2h9.4A1.3 1.3 0 0 1 14 3.3V6.2H7.5A1.3 1.3 0 0 0 6.2 7.5V14H3.3A1.3 1.3 0 0 1 2 12.7V3.3A1.3 1.3 0 0 1 3.3 2z" style="fill:var(--t-met-soft)"/><rect x="7.4" y="7.4" width="6.6" height="6.6" rx="1.3" style="fill:var(--t-met)"/>',
      table: '<rect x="2" y="2" width="5.2" height="12" rx="1.3" style="fill:var(--t-tab-soft)"/><rect x="8.4" y="2" width="5.6" height="5.4" rx="1.3" style="fill:var(--t-tab-soft)"/><rect x="8.4" y="8.6" width="5.6" height="5.4" rx="1.3" style="fill:var(--t-tab)"/>',
      board: '<rect x="2" y="2.5" width="12" height="11" rx="2" style="fill:none;stroke:var(--t-ext);stroke-width:1.4"/><path d="M2.6 6.3h10.8M6.4 6.3v6.6" style="fill:none;stroke:var(--t-ext);stroke-width:1.4"/>',
      frame: '<rect x="2" y="2.5" width="12" height="11" rx="2" style="fill:none;stroke:var(--t-ext);stroke-width:1.4"/><path d="M6.6 6.4L4.8 8.2l1.8 1.8M9.4 6.4l1.8 1.8-1.8 1.8" style="fill:none;stroke:var(--t-ext);stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round"/>',
      source: '<ellipse cx="8" cy="4" rx="5" ry="2" style="fill:none;stroke:var(--t-ext);stroke-width:1.4"/><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" style="fill:none;stroke:var(--t-ext);stroke-width:1.4"/>',
      app: '<rect x="2" y="2" width="5" height="5" rx="1.2" style="fill:var(--t-ext)"/><rect x="9" y="2" width="5" height="5" rx="1.2" style="fill:var(--t-ext-soft)"/><rect x="2" y="9" width="5" height="5" rx="1.2" style="fill:var(--t-ext-soft)"/><rect x="9" y="9" width="5" height="5" rx="2.5" style="fill:var(--t-ext)"/>'
    };
    ICONS.wtable = '<rect x="2" y="2.5" width="12" height="11" rx="1.6" style="fill:none;stroke:var(--t-wh);stroke-width:1.4"/><path d="M2.6 6.2h10.8M2.6 9.8h10.8M6.4 6.2v7" style="fill:none;stroke:var(--t-wh);stroke-width:1.2"/>';
    ICONS.analysis = '<path d="M7.4 1.6l1.5 4.3 4.4 1.5-4.4 1.5-1.5 4.3-1.5-4.3L1.5 7.4l4.4-1.5z" style="fill:var(--t-ai)"/><circle cx="13" cy="12.6" r="1.8" style="fill:var(--t-ai-soft)"/>';
    function icon(type, s) { s = s || 16; return '<svg viewBox="0 0 16 16" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' + (ICONS[type] || ICONS.metric) + '</svg>'; }
    var FOLDER_ICON = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 4.6C2 3.7 2.7 3 3.6 3h2.5c.4 0 .8.2 1.1.5l.9.9h4.3c.9 0 1.6.7 1.6 1.6v5.4c0 .9-.7 1.6-1.6 1.6H3.6c-.9 0-1.6-.7-1.6-1.6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

    /* ---------- model ---------- */
    function index(m) {
      m.byId = {}; m.byName = {}; m.users = {}; m.folderById = {};
      if (!m.newEdges) m.newEdges = new Set();
      m.folders.forEach(function (f) { m.folderById[f.id] = f; });
      m.blocks.forEach(function (b) { if (!b.deps) b.deps = []; if (!b.dims) b.dims = []; m.byId[b.id] = b; m.byName[b.name] = b; });
      m.blocks.forEach(function (b) { b.deps.forEach(function (d) { (m.users[d] = m.users[d] || []).push(b.id); }); });
      return m;
    }
    function walkFrom(next, id) {
      var seen = new Map(), q = [[id, 0]];
      while (q.length) { var it = q.shift(), xs = next(it[0]) || []; for (var i = 0; i < xs.length; i++) { var u = xs[i]; if (!seen.has(u) && u !== id) { seen.set(u, it[1] + 1); q.push([u, it[1] + 1]); } } }
      return seen;
    }
    function upstream(M, id) { return walkFrom(function (x) { return M.byId[x] ? M.byId[x].deps : []; }, id); }
    function downstream(M, id) { return walkFrom(function (x) { return M.users[x]; }, id); }
    function stageOf(M, id) { var b = M.byId[id], f = b && M.folderById[b.folder]; return f ? f.stage : null; }
    function sysOf(cfg, stageId) { for (var i = 0; i < cfg.stages.length; i++) if (cfg.stages[i].id === stageId) return cfg.stages[i].sys || null; return null; }

    /* ---------- layout: systems > stages > folders > blocks ---------- */
    var G = { stageGap: 60, sysGap: 128, sysPadX: 22, sysHead: 62, sysPadB: 22, cardW: 220, card1H: 300, card2H: 212, cardGap: 20, bandPadX: 12, bandHead: 42, bandPadB: 12,
      nodeW: 190, nodeH: 46, colGap: 46, rowGap: 14, fPad: 12, fHead: 38, fGap: 22, maxRows: 5 };
    function unionR(a, b) { if (!a) return copy(b); if (!b) return a; var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; }
    function padR(r, px, py) { return { x: r.x - px, y: r.y - py, w: r.w + 2 * px, h: r.h + 2 * py }; }
    function visibleSet(M, level, extra) {
      var s = new Set(); if (level < 3) return s;
      M.blocks.forEach(function (b) { if (level >= 4 || b.tier === 1 || b.status || (extra && extra.has(b.id))) s.add(b.id); });
      return s;
    }
    function folderGrid(M, f, vis) {
      var all = M.blocks.filter(function (b) { return b.folder === f.id; });
      var inF = new Set(all.map(function (b) { return b.id; })), depth = {};
      function dfs(b, stack) {
        if (depth[b.id] != null) return depth[b.id];
        if (stack.has(b.id)) return 0; stack.add(b.id);
        var d = 0; b.deps.forEach(function (dep) { if (inF.has(dep)) d = Math.max(d, dfs(M.byId[dep], stack) + 1); });
        stack.delete(b.id); depth[b.id] = d; return d;
      }
      all.forEach(function (b) { dfs(b, new Set()); });
      var shown = all.filter(function (b) { return vis.has(b.id); });
      var res = { total: all.length, shown: shown.length, cells: [] };
      if (!all.length) { res.w = G.cardW; res.h = G.fHead + 40; res.empty = true; return res; }
      if (!shown.length) { res.w = G.cardW; res.h = G.fHead; return res; }
      var ds = []; shown.forEach(function (b) { if (ds.indexOf(depth[b.id]) < 0) ds.push(depth[b.id]); }); ds.sort(function (a, b) { return a - b; });
      var cols = [];
      ds.forEach(function (d) {
        var items = shown.filter(function (b) { return depth[b.id] === d; }), n = Math.ceil(items.length / G.maxRows), per = Math.ceil(items.length / n);
        for (var i = 0; i < n; i++) cols.push(items.slice(i * per, (i + 1) * per));
      });
      var rows = Math.max.apply(null, cols.map(function (c) { return c.length; }));
      cols.forEach(function (c, ci) { var off = (rows - c.length) / 2; c.forEach(function (b, ri) { res.cells.push({ id: b.id, col: ci, row: ri + off }); }); });
      res.w = Math.max(G.cardW, G.fPad * 2 + cols.length * G.nodeW + (cols.length - 1) * G.colGap);
      res.h = G.fHead + rows * G.nodeH + (rows - 1) * G.rowGap + G.fPad + 2;
      return res;
    }
    // cfg: {stages:[{id, n, name, summary, outputs, sys}], systems:[{id, name, sub, mark, tone}], flow:{'a>b': label}}
    function computeLayout(M, cfg, level, vis) {
      var R = { level: level, vis: vis, systems: new Map(), stages: new Map(), folders: new Map(), blocks: new Map(), rects: new Map(), grids: new Map() };
      var x = 0, prevSys;
      cfg.stages.forEach(function (st) {
        if (prevSys !== undefined && st.sys !== prevSys) x += G.sysGap - G.stageGap;
        prevSys = st.sys;
        var fs = M.folders.filter(function (f) { return f.stage === st.id; }), y = 0;
        if (level === 1) { R.stages.set(st.id, { x: x, y: 0, w: G.cardW, h: G.card1H }); x += G.cardW + G.stageGap; return; }
        if (level === 2) {
          fs.forEach(function (f) { R.folders.set(f.id, { x: x, y: y, w: G.cardW, h: G.card2H }); y += G.card2H + G.cardGap; });
          R.stages.set(st.id, { x: x - G.bandPadX, y: -G.bandHead, w: G.cardW + 2 * G.bandPadX, h: Math.max(0, y - G.cardGap) + G.bandHead + G.bandPadB });
          x += G.cardW + G.stageGap; return;
        }
        var grids = fs.map(function (f) { return { f: f, g: folderGrid(M, f, vis) }; });
        var colW = Math.max.apply(null, [G.cardW].concat(grids.map(function (o) { return o.g.w; })));
        grids.forEach(function (o) {
          var f = o.f, g = o.g;
          R.folders.set(f.id, { x: x, y: y, w: colW, h: g.h }); R.grids.set(f.id, g);
          g.cells.forEach(function (c) { R.blocks.set(c.id, { x: x + G.fPad + c.col * (G.nodeW + G.colGap), y: y + G.fHead + c.row * (G.nodeH + G.rowGap), w: G.nodeW, h: G.nodeH }); });
          y += g.h + G.fGap;
        });
        R.stages.set(st.id, { x: x - G.bandPadX, y: -G.bandHead, w: colW + 2 * G.bandPadX, h: Math.max(0, y - G.fGap) + G.bandHead + G.bandPadB });
        x += colW + G.stageGap;
      });
      // stages of one system share a common height so the system zone reads as one block
      (cfg.systems || []).forEach(function (sy) {
        var b = null;
        cfg.stages.forEach(function (st) { if (st.sys === sy.id && R.stages.has(st.id)) b = unionR(b, R.stages.get(st.id)); });
        if (b) R.systems.set(sy.id, { x: b.x - G.sysPadX, y: b.y - G.sysHead, w: b.w + 2 * G.sysPadX, h: b.h + G.sysHead + G.sysPadB });
      });
      R.systems.forEach(function (r, id) { R.rects.set('Y:' + id, r); });
      R.stages.forEach(function (r, id) { R.rects.set('S:' + id, r); });
      R.folders.forEach(function (r, id) { R.rects.set('F:' + id, r); });
      R.blocks.forEach(function (r, id) { R.rects.set('B:' + id, r); });
      var bb = null; R.stages.forEach(function (r) { bb = unionR(bb, r); }); R.systems.forEach(function (r) { bb = unionR(bb, r); });
      if (level === 1 && bb) bb.h += 150;
      R.bbox = bb || { x: 0, y: 0, w: 100, h: 100 };
      return R;
    }

    /* ---------- edges ---------- */
    function stageIdx(cfg, id) { for (var i = 0; i < cfg.stages.length; i++) if (cfg.stages[i].id === id) return i; return -1; }
    function stageEdges(M, cfg) {
      var cnt = new Map();
      M.blocks.forEach(function (b) { b.deps.forEach(function (d) { if (!M.byId[d]) return; var a = stageOf(M, d), c = stageOf(M, b.id); if (a && c && a !== c) { var k = a + '>' + c; cnt.set(k, (cnt.get(k) || 0) + 1); } }); });
      var out = [];
      cnt.forEach(function (n, k) {
        var p = k.split('>'), span = stageIdx(cfg, p[1]) - stageIdx(cfg, p[0]), cross = sysOf(cfg, p[0]) !== sysOf(cfg, p[1]);
        out.push({ key: 'SE:' + k, ak: 'S:' + p[0], bk: 'S:' + p[1], kind: cross ? 'system' : 'stage', w: 1.3 + Math.min(2, n * 0.15), label: (cfg.flow || {})[k] || '', arc: span > 1, span: span });
      });
      return out;
    }
    function folderEdges(M) {
      var cnt = new Map(), nw = new Set();
      M.blocks.forEach(function (b) { b.deps.forEach(function (d) { var db = M.byId[d]; if (!db) return; var a = db.folder, c = b.folder; if (a !== c) { var k = a + '>' + c; cnt.set(k, (cnt.get(k) || 0) + 1); if (M.newEdges.has(d + '>' + b.id)) nw.add(k); } }); });
      var out = []; cnt.forEach(function (n, k) { var p = k.split('>'); out.push({ key: 'FE:' + k, ak: 'F:' + p[0], bk: 'F:' + p[1], kind: 'folder', w: 1.2 + Math.min(2.6, n * 0.32), isNew: nw.has(k) }); });
      return out;
    }
    function edgeKind(s, t) {
      if (s.type === 'source' || s.type === 'wtable') return 'sync';
      if (t.type === 'analysis') return 'mcp';
      if (t.type === 'board' || t.type === 'frame') return 'view';
      if (t.type === 'app') return 'share';
      return 'formula';
    }
    function blockEdges(M, R, dimLinks) {
      var vis = R.vis, out = new Map(), rank = { formula: 3, sync: 3, view: 3, share: 3, mcp: 3, implied: 2, dim: 1 };
      function add(a, b, kind) { if (a === b) return; var k = a + '>' + b, ex = out.get(k); if (!ex || rank[kind] > rank[ex.kind]) out.set(k, { key: 'BE:' + k, ak: 'B:' + a, bk: 'B:' + b, a: a, b: b, kind: kind }); }
      var memo = new Map();
      function visAnc(id) {
        if (memo.has(id)) return memo.get(id); var res = new Set(); memo.set(id, res);
        ((M.byId[id] && M.byId[id].deps) || []).forEach(function (d) { if (vis.has(d)) res.add(d); else visAnc(d).forEach(function (x) { res.add(x); }); });
        return res;
      }
      vis.forEach(function (id) {
        var b = M.byId[id]; if (!b) return;
        b.deps.forEach(function (d) { if (!M.byId[d]) return; if (vis.has(d)) add(d, id, edgeKind(M.byId[d], b)); else if (R.level === 3) visAnc(d).forEach(function (u) { add(u, id, 'implied'); }); });
        if (R.level === 4 && dimLinks) b.dims.forEach(function (dn) { var db = M.byName[dn]; if (db && vis.has(db.id)) add(db.id, id, 'dim'); });
      });
      // drop implied links that another visible path already explains
      var succ = new Map(); out.forEach(function (e) { if (!succ.has(e.a)) succ.set(e.a, new Set()); succ.get(e.a).add(e.b); });
      Array.from(out.values()).forEach(function (e) {
        if (e.kind !== 'implied') return;
        var seen = new Set([e.a]), q = Array.from(succ.get(e.a) || []).filter(function (x) { return x !== e.b; }), found = false;
        while (q.length && !found) { var x = q.shift(); if (seen.has(x)) continue; seen.add(x); (succ.get(x) || new Set()).forEach(function (y) { if (y === e.b) found = true; else q.push(y); }); }
        if (found) { out.delete(e.a + '>' + e.b); succ.get(e.a).delete(e.b); }
      });
      out.forEach(function (e) { if (M.newEdges.has(e.a + '>' + e.b)) e.isNew = true; });
      return Array.from(out.values());
    }
    function edgeGeom(A, B, ed) {
      function P(x0, y0, x1, y1, x2, y2, x3, y3) { return { d: 'M' + x0 + ',' + y0 + ' C' + x1 + ',' + y1 + ' ' + x2 + ',' + y2 + ' ' + x3 + ',' + y3, mx: (x0 + 3 * x1 + 3 * x2 + x3) / 8, my: (y0 + 3 * y1 + 3 * y2 + y3) / 8, pts: [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] }; }
      if (ed.arc) { var ax = A.x + A.w * 0.6, ay = A.y + A.h, bx = B.x + B.w * 0.4, by = B.y + B.h, k = 40 + 30 * ed.span; return P(ax, ay, ax, ay + k, bx, by + k, bx, by + 1); }
      var sx = A.x + A.w, sy = A.y + A.h / 2, tx = B.x, ty = B.y + B.h / 2;
      if (tx - sx >= 14) { var dx = Math.max(28, (tx - sx) * 0.5); return P(sx, sy, sx + dx, sy, tx - dx, ty, tx, ty); }
      var overlap = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      if (overlap > 0) { var lx = Math.min(A.x, B.x) - 30 - Math.min(26, Math.abs(ty - sy) * 0.06); return P(A.x, sy, lx, sy, lx, ty, B.x, ty); }
      var dx2 = 60 + Math.min(120, Math.abs(sx - tx) * 0.2);
      return P(sx, sy, sx + dx2, sy, tx - dx2, ty, tx, ty);
    }
    function markerBase(ed) { return ed.isNew ? 'new' : ed.kind === 'dim' ? 'dim' : ed.kind === 'mcp' ? 'ai' : (ed.kind === 'sync' || ed.kind === 'share' || ed.kind === 'system') ? 'ext' : 'def'; }
    function markerDefs(prefix) {
      var mk = function (id, size, fill) { return '<marker id="' + prefix + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="' + size + '" markerHeight="' + size + '" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1.5 L9,5 L1,8.5 z" style="fill:' + fill + '"/></marker>'; };
      return '<defs>' + mk('def', 7, 'var(--edge)') + mk('hi', 8, 'var(--brand)') + mk('new', 8, 'var(--pos)') + mk('dim', 6, 'var(--t-dim);fill-opacity:.6') + mk('ext', 7, 'var(--t-ext)') + mk('ai', 7, 'var(--t-ai)') + mk('proc', 8, 'var(--proc)') + '</defs>';
    }

    /* ---------- markup ---------- */
    var COUNT_ORDER = ['source', 'wtable', 'transaction', 'dimension', 'metric', 'table', 'board', 'frame', 'analysis', 'app'];
    function typeCounts(blocks) {
      var c = {}; blocks.forEach(function (b) { c[b.type] = (c[b.type] || 0) + 1; });
      return COUNT_ORDER.filter(function (t) { return c[t]; }).map(function (t) { return '<span class="tc" title="' + TYPES[t].label + '">' + icon(t, 14) + '<b>' + c[t] + '</b></span>'; }).join('');
    }
    function systemHTML(sy, M, cfg) {
      var ids = cfg.stages.filter(function (s) { return s.sys === sy.id; }).map(function (s) { return s.id; });
      var n = M.blocks.filter(function (b) { var f = M.folderById[b.folder]; return f && ids.indexOf(f.stage) >= 0; }).length;
      return '<div class="sy-head"><span class="sy-mark">' + esc(sy.mark || sy.name.charAt(0)) + '</span><span class="sy-txt"><span class="sy-name">' + esc(sy.name) + '</span><span class="sy-sub">' + esc(sy.sub || '') + '</span></span><span class="sy-n">' + n + '</span></div>';
    }
    function stageHTML(st, M) {
      var fids = M.folders.filter(function (f) { return f.stage === st.id; }).map(function (f) { return f.id; });
      var blocks = M.blocks.filter(function (b) { return fids.indexOf(b.folder) >= 0; });
      var outs = (st.outputs || []).map(function (id) { return M.byId[id]; }).filter(Boolean).map(function (b) { return '<li>' + icon(b.type, 14) + '<span>' + esc(b.name) + '</span></li>'; }).join('');
      return '<div class="st-head"><span class="st-num">' + esc(st.n) + '</span><span class="st-name">' + esc(st.name) + '</span></div>' +
        '<div class="st-body"><p>' + esc(st.summary) + '</p><div class="tcounts">' + typeCounts(blocks) + '</div>' + (outs ? '<div class="eyebrow">Key outputs</div><ul class="outs">' + outs + '</ul>' : '') + '</div>';
    }
    function folderHTML(f, M, R) {
      var blocks = M.blocks.filter(function (b) { return b.folder === f.id; });
      var top = blocks.slice().sort(function (a, b) { return a.tier - b.tier; }).slice(0, 3).map(function (b) { return '<li>' + icon(b.type, 14) + '<span>' + esc(b.name) + '</span></li>'; }).join('');
      var g = R.grids.get(f.id);
      var cnt = g ? (g.shown < g.total ? g.shown + ' of ' + g.total : '' + g.total) : '' + blocks.length;
      var nNew = blocks.filter(function (b) { return b.status === 'new'; }).length, nEd = blocks.filter(function (b) { return b.status && b.status !== 'new'; }).length;
      var delta = [f.status === 'new' ? 'New folder' : '', nNew ? '+' + nNew + ' new' : '', nEd ? nEd + ' edited' : ''].filter(Boolean).join(' · ');
      return '<div class="f-head">' + FOLDER_ICON + '<span class="f-name">' + esc(f.name) + '</span><span class="f-count">' + cnt + '</span></div>' +
        '<div class="f-body"><p class="f-desc">' + esc(f.desc || '') + '</p><div class="tcounts">' + (blocks.length ? typeCounts(blocks) : '<span class="tc">Empty</span>') + '</div><ul class="outs">' + top + '</ul></div>' +
        (g && g.empty ? '<div class="f-empty">Empty folder</div>' : '') + '<span class="f-delta">' + esc(delta) + '</span>';
    }
    function blockSub(b) {
      if (b.sub) return b.sub;
      if (b.type === 'metric') return (b.input ? 'Input' : b.imported ? 'Imported' : 'ƒ') + ' · ' + (b.dims.length ? b.dims.join(' × ') : 'no dimensions');
      if (b.type === 'dimension') return b.items || 'Dimension list';
      if (b.type === 'transaction') return b.rows || 'Transaction list';
      return (TYPES[b.type] || TYPES.metric).label;
    }
    function blockHTML(b, extra) {
      var badge = b.status ? '<span class="n-badge b-' + b.status + '">' + (b.status === 'new' ? 'New' : b.status === 'shared' ? 'Shared' : 'Edited') + '</span>' : '';
      return '<span class="n-ico">' + icon(b.type, 16) + '</span><span class="n-txt"><span class="n-name">' + esc(b.name) + '</span><span class="n-sub">' + esc(blockSub(b)) + '</span></span>' + badge + '<span class="n-flag"></span><span class="n-step"></span>' + (extra || '');
    }

    /* ---------- cross-system processes ---------- */
    // proc: {id, name, says, ids:[block ids in the order data moves, across systems]}
    function procPath(M, proc) { return (proc && proc.ids || []).filter(function (id) { return !!M.byId[id]; }); }
    // the systems a process passes through, in order, with the blocks in each
    function procLegs(M, cfg, proc) {
      var legs = [];
      procPath(M, proc).forEach(function (id) {
        var sy = sysOf(cfg, stageOf(M, id)) || '-', last = legs[legs.length - 1];
        if (!last || last.sys !== sy) legs.push(last = { sys: sy, ids: [] });
        last.ids.push(id);
      });
      return legs;
    }

    /* ---------- the animated renderer ---------- */
    // o: {cfg, viewport, back, front, edgeG, labelG, blockExtra(b), blockSig(b), reducedMotion(), markerPrefix}
    function createView(o) {
      var ents = new Map(), edges = new Map(), lastLevel = null, anim = { t0: 0, dur: 0 }, raf = 0, last = null, cfg = o.cfg, pre = o.markerPrefix || 'mk-';
      var RM = function () { return o.reducedMotion ? o.reducedMotion() : false; };
      function stageById(id) { for (var i = 0; i < cfg.stages.length; i++) if (cfg.stages[i].id === id) return cfg.stages[i]; return null; }
      function sysById(id) { var s = cfg.systems || []; for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i]; return null; }
      function makeEnt(key, t) {
        var el = document.createElement('div'); el.setAttribute('data-key', key);
        if (t.kind === 'system') o.back.insertBefore(el, o.back.firstChild); else (t.kind === 'block' ? o.front : o.back).appendChild(el);
        return { key: key, el: el, kind: t.kind, id: t.id, sig: '', cur: null, from: null, to: null, exiting: false, t: t };
      }
      function setRole(el, label) { el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', label); }
      function fillEnt(e, M, level, R) {
        var el = e.el, sig;
        if (e.kind === 'system') {
          var sy = sysById(e.id); sig = 'y' + M.blocks.length;
          if (e.sig !== sig) { e.sig = sig; el.innerHTML = systemHTML(sy, M, cfg); }
          el.className = 'ent sys' + (level === 1 ? ' m-card' : ''); el.setAttribute('data-y', sy.id); el.style.setProperty('--sysc', 'var(--' + (sy.tone || 't-ext') + ')');
        } else if (e.kind === 'stage') {
          var st = stageById(e.id), mode = level === 1 ? 'm-card' : 'm-band'; sig = mode + M.blocks.length;
          if (e.sig !== sig) { e.sig = sig; el.innerHTML = stageHTML(st, M); }
          el.className = 'ent stage ' + mode; el.setAttribute('data-s', st.id); if (st.glow) el.style.setProperty('--glow', 'var(--' + st.glow + ')');
          if (level === 1) setRole(el, st.name + ' stage. Open modules'); else { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
        } else if (e.kind === 'folder') {
          var f = M.folderById[e.id]; if (!f) return; var fm = level === 2 ? 'm-card' : 'm-lane', g = R.grids.get(f.id);
          sig = [fm, f.status, g ? g.shown + '/' + g.total + (g.empty ? 'e' : '') : '', M.blocks.filter(function (b) { return b.folder === f.id; }).map(function (b) { return b.id + (b.status || ''); }).join(',')].join('|');
          if (e.sig !== sig) { e.sig = sig; el.innerHTML = folderHTML(f, M, R); }
          el.className = 'ent folder ' + fm + (f.kind === 'external' ? ' f-ext' : '') + (f.status ? ' st-' + f.status : '');
          var want = level === 2 ? o.front : o.back;
          if (el.parentNode !== want) { if (want === o.front) o.front.insertBefore(el, o.front.firstChild); else want.appendChild(el); }
          setRole(el, f.name);
        } else {
          var b = M.byId[e.id]; if (!b) return; var T = TYPES[b.type] || TYPES.metric;
          sig = b.name + '|' + blockSub(b) + '|' + (b.status || '') + '|' + (o.blockSig ? o.blockSig(b) : '');
          if (e.sig !== sig) { e.sig = sig; el.innerHTML = blockHTML(b, o.blockExtra ? o.blockExtra(b) : ''); }
          el.className = 'ent node ' + T.cls + (EXT_TYPES[b.type] ? ' n-ext' : '') + (b.status ? ' st-' + b.status : '');
          setRole(el, b.name + ', ' + T.label);
        }
      }
      // 3D. spec: {z(sysId) -> plane height, off(sysId, R) -> {x, y} shift for the arrangement (optional),
      //      lift(block) -> column height (optional), slab: plane thickness, straight: beams climb centre to centre}
      // Switching specs blends every entity from the old placement to the new one.
      var d3 = null, d3from = null, mixK = 1, lastM = null, curR = null, cam = { yaw: 0, pitch: 0 }, lay = null, ZERO = { x: 0, y: 0 };
      function entSys(e) {
        if (!lastM) return null;
        if (e.kind === 'system') return e.id;
        if (e.kind === 'stage') return sysOf(cfg, e.id);
        if (e.kind === 'folder') { var f = lastM.folderById[e.id]; return f ? sysOf(cfg, f.stage) : null; }
        return sysOf(cfg, stageOf(lastM, e.id));
      }
      function liftIn(sp, e) { if (!sp || !sp.lift || e.kind !== 'block' || !lastM) return 0; var b = lastM.byId[e.id]; return b ? (sp.lift(b) || 0) : 0; }
      function zIn(sp, e) {
        if (!sp) return 0; var z = sp.z(entSys(e)) || 0;
        return e.kind === 'system' ? z - 2 : e.kind === 'stage' ? z - 1 : e.kind === 'folder' ? z : z + 2 + liftIn(sp, e);
      }
      function offIn(sp, e) { var f = sp && sp.off ? sp.off(entSys(e), curR) : null; return f || ZERO; }
      function lerp(a, b, k) { return a + (b - a) * k; }
      function entZ(e) { var z = zIn(d3, e); return mixK < 1 ? lerp(zIn(d3from, e), z, mixK) : z; }
      function entOff(e) { var f = offIn(d3, e); if (mixK >= 1) return f; var g = offIn(d3from, e); return { x: lerp(g.x, f.x, mixK), y: lerp(g.y, f.y, mixK) }; }
      function entLift(e) { var l = liftIn(d3, e); return mixK < 1 ? lerp(liftIn(d3from, e), l, mixK) : l; }
      function paintEnt(e) { var c = e.cur, s = e.el.style, f = entOff(e); s.transform = 'translate3d(' + (c.x + f.x) + 'px,' + (c.y + f.y) + 'px,' + entZ(e) + 'px) scale(' + c.s + ')'; s.width = c.w + 'px'; s.height = c.h + 'px'; s.opacity = c.o; }
      function rect3(e) { var r = rectOf(e.cur), f = entOff(e); r.x += f.x; r.y += f.y; return r; }
      function layers() {
        if (!o.beams) return null;
        if (!lay) {
          o.beams.innerHTML = '';
          var mk = function (c) { var d = document.createElement('div'); d.className = c; o.beams.appendChild(d); return d; };
          lay = { solids: mk('bf-sol'), beams: mk('bf-bm') };
        }
        return lay;
      }
      function clearFx() { var L = layers(); if (L) { L.beams.innerHTML = ''; L.solids.innerHTML = ''; } }
      // beams: the flat edge's curve, rising from one plane's height to the other's
      function seg3(x1, y1, z1, x2, y2, z2) {
        var dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, hz = Math.sqrt(dx * dx + dy * dy), len = Math.sqrt(hz * hz + dz * dz);
        return '<i style="width:' + (len + 0.6).toFixed(1) + 'px;transform:translate3d(' + x1.toFixed(1) + 'px,' + y1.toFixed(1) + 'px,' + z1.toFixed(1) + 'px) rotateZ(' + Math.atan2(dy, dx).toFixed(4) + 'rad) rotateY(' + Math.atan2(-dz, hz).toFixed(4) + 'rad)"></i>';
      }
      function pathPts(A, B, ed) {
        var ra = rect3(A), rb = rect3(B), za = d3 ? entZ(A) : 0, zb = d3 ? entZ(B) : 0, q, pts = [];
        if (za !== zb && d3 && d3.straight) { var ax = ra.x + ra.w / 2, ay = ra.y + ra.h / 2, bx = rb.x + rb.w / 2, by = rb.y + rb.h / 2; q = [[ax, ay], [ax, ay], [bx, by], [bx, by]]; }
        else q = edgeGeom(ra, rb, ed || {}).pts;
        var n = za === zb ? 10 : 18;
        for (var i = 0; i <= n; i++) {
          var u = i / n, k0 = (1 - u) * (1 - u) * (1 - u), k1 = 3 * u * (1 - u) * (1 - u), k2 = 3 * u * u * (1 - u), k3 = u * u * u, sm = u * u * (3 - 2 * u);
          pts.push([k0 * q[0][0] + k1 * q[1][0] + k2 * q[2][0] + k3 * q[3][0], k0 * q[0][1] + k1 * q[1][1] + k2 * q[2][1] + k3 * q[3][1], za + (zb - za) * sm]);
        }
        return pts;
      }
      // four walls under a footprint, from z0 up by L (local y of each wall maps to world height)
      function walls(x, y, z0, w, h, L, cls, key) {
        if (L < 1 || w < 1 || h < 1) return '';
        var W = function (tf, ww, c) { return '<s class="' + c + '" style="width:' + ww.toFixed(1) + 'px;height:' + L.toFixed(1) + 'px;transform:' + tf + '"></s>'; };
        return '<u class="' + cls + '"' + (key ? ' data-key="' + key + '"' : '') + ' style="transform:translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z0.toFixed(1) + 'px)">' +
          W('rotateX(90deg)', w, 'wn') + W('translate3d(0,' + h.toFixed(1) + 'px,0) rotateX(90deg)', w, 'ws') +
          W('rotateZ(90deg) rotateX(90deg)', h, 'ww') + W('translate3d(' + w.toFixed(1) + 'px,0,0) rotateZ(90deg) rotateX(90deg)', h, 'we') + '</u>';
      }
      function drawSolids() {
        var L = layers(); if (!L) return;
        if (!d3) { L.solids.innerHTML = ''; return; }
        var out = '', slab = d3.slab || 0;
        ents.forEach(function (e, key) {
          if (e.exiting || !e.cur || e.cur.o < 0.05) return;
          var r = rect3(e);
          if (e.kind === 'system' && slab) out += walls(r.x + 1, r.y + 1, entZ(e) - slab, r.w - 2, r.h - 2, slab, 'pl-sys" data-y="' + esc(e.id), key);
          else if (e.kind === 'block') {
            var lift = entLift(e), b = lastM && lastM.byId[e.id], T = b ? (TYPES[b.type] || TYPES.metric) : TYPES.metric;
            if (lift >= 1) out += walls(r.x + 3, r.y + 3, entZ(e) - lift, r.w - 6, r.h - 6, lift, 'pl-blk ' + T.cls + (e.el.classList.contains('dim') || e.el.classList.contains('faded') ? ' dim' : '') + (e.el.classList.contains('proc') ? ' proc' : ''), key);
          }
        });
        L.solids.innerHTML = out;
      }
      function drawBeams() {
        var L = layers(); if (!L) return;
        if (!d3) { L.beams.innerHTML = ''; L.solids.innerHTML = ''; return; }
        var out = '';
        edges.forEach(function (ed) {
          if (ed.exiting) return; var A = ents.get(ed.ak), B = ents.get(ed.bk); if (!A || !B || !A.cur || !B.cur || ed.o < 0.05) return;
          var pts = pathPts(A, B, ed), segs = '';
          for (var i = 1; i < pts.length; i++) segs += seg3(pts[i - 1][0], pts[i - 1][1], pts[i - 1][2], pts[i][0], pts[i][1], pts[i][2]);
          out += '<b class="' + ed.p.getAttribute('class') + (entZ(A) !== entZ(B) ? ' climb' : '') + '" data-key="' + ed.key + '">' + segs + '</b>';
        });
        L.beams.innerHTML = out;
        drawSolids();
      }
      var mixRaf = 0;
      function set3d(spec, dur) {
        if (typeof spec === 'function') spec = { z: spec };
        var prev = d3, was = !!d3;
        d3 = spec || null;
        if (o.host) o.host.classList.toggle('bf-3d', !!d3);
        cancelAnimationFrame(mixRaf);
        if (was && d3 && dur && !RM()) {
          d3from = prev; mixK = 0; clearFx(); var t0 = performance.now();
          var step = function (now) {
            mixK = ease(clamp((now - t0) / dur)); ents.forEach(paintEnt);
            if (mixK < 1) mixRaf = requestAnimationFrame(step); else { d3from = null; drawBeams(); if (o.onSettled) o.onSettled(); }
          };
          mixRaf = requestAnimationFrame(step); return;
        }
        d3from = null; mixK = 1; ents.forEach(paintEnt); drawBeams();
      }
      function setCam(yaw, pitch) { cam.yaw = yaw; cam.pitch = pitch; }
      // a glowing packet that travels along the path between two entities, with a short trail
      var pk = null, pkRaf = 0;
      function flyPacket(fromKey, toKey, ms, done) {
        var A = ents.get(fromKey), B = ents.get(toKey); if (!A || !B || !A.cur || !B.cur || !o.beams) { if (done) done(); return; }
        var ed = null; edges.forEach(function (x) { if (!x.exiting && x.ak === fromKey && x.bk === toKey) ed = x; });
        var pts = pathPts(A, B, ed), acc = [0];
        for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], c = pts[i]; acc.push(acc[i - 1] + Math.sqrt((c[0] - a[0]) * (c[0] - a[0]) + (c[1] - a[1]) * (c[1] - a[1]) + (c[2] - a[2]) * (c[2] - a[2]))); }
        var total = acc[acc.length - 1] || 1;
        function at(u) {
          var d = clamp(u) * total, j = 1; while (j < acc.length - 1 && acc[j] < d) j++;
          var a = pts[j - 1], c = pts[j], k = (d - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1);
          return [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k + (d3 ? 6 : 0)];
        }
        if (!pk) { pk = document.createElement('div'); pk.className = 'bf-pk'; pk.innerHTML = '<i class="pk-t3"></i><i class="pk-t2"></i><i class="pk-t1"></i><i class="pk-core"></i>'; o.beams.parentNode.appendChild(pk); }
        var parts = pk.children, lags = [0.18, 0.12, 0.06, 0];
        cancelAnimationFrame(pkRaf); pk.style.display = 'block';
        var dur = RM() ? 0 : (ms || 1100), t0 = performance.now();
        var bb = d3 ? ' rotateZ(' + (-cam.yaw) + 'deg) rotateX(' + (-cam.pitch) + 'deg)' : '';
        function step(now) {
          var t = dur ? clamp((now - t0) / dur) : 1, e2 = ease(t);
          bb = d3 ? ' rotateZ(' + (-cam.yaw) + 'deg) rotateX(' + (-cam.pitch) + 'deg)' : '';
          for (var i = 0; i < parts.length; i++) {
            var u = e2 - lags[i], p2 = at(u);
            parts[i].style.transform = 'translate3d(' + p2[0].toFixed(1) + 'px,' + p2[1].toFixed(1) + 'px,' + p2[2].toFixed(1) + 'px)' + bb;
            parts[i].style.opacity = u < 0 ? 0 : (t > 0.85 ? (1 - t) / 0.15 : 1) * (i === 3 ? 1 : 0.25 + i * 0.18);
          }
          if (t < 1) pkRaf = requestAnimationFrame(step); else { pk.style.display = 'none'; if (done) done(); }
        }
        pkRaf = requestAnimationFrame(step);
      }
      function rcenter(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
      function rectOf(c) { var w = c.w * c.s, h = c.h * c.s; return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w: w, h: h }; }
      function syncEdges(list, drawNew) {
        var keys = new Set();
        list.forEach(function (d) {
          keys.add(d.key); var ed = edges.get(d.key);
          if (!ed) {
            var p = document.createElementNS(NS, 'path'); o.edgeG.appendChild(p);
            ed = { key: d.key, p: p, lab: null, o: 0, o0: 0, o1: 1, delay: 0.45, exiting: false };
            edges.set(d.key, ed);
            if (d.isNew && drawNew) { p.setAttribute('pathLength', '1'); ed.drawing = true; setTimeout(function () { p.removeAttribute('pathLength'); p.classList.remove('draw'); ed.drawing = false; }, 1400); }
          }
          assign(ed, { ak: d.ak, bk: d.bk, kind: d.kind, isNew: !!d.isNew, arc: d.arc, span: d.span, exiting: false });
          ed.o0 = ed.o; ed.o1 = 1; ed.delay = ed.o > 0.98 ? 0 : 0.45;
          ed.p.setAttribute('class', 'edge e-' + d.kind + (d.isNew ? ' e-new' : '') + (ed.drawing ? ' draw' : ''));
          ed.p.style.strokeWidth = d.w ? d.w + 'px' : '';
          ed.p.setAttribute('marker-end', 'url(#' + pre + markerBase(ed) + ')');
          if (d.label) { if (!ed.lab) { ed.lab = document.createElementNS(NS, 'text'); ed.lab.setAttribute('class', 'elabel'); o.labelG.appendChild(ed.lab); } ed.lab.textContent = d.label; }
          else if (ed.lab) { ed.lab.remove(); ed.lab = null; }
        });
        edges.forEach(function (ed) { if (!keys.has(ed.key)) { ed.exiting = true; ed.o0 = ed.o; ed.o1 = 0; ed.delay = 0; } });
      }
      function paintEdge(ed) {
        var A = ents.get(ed.ak), B = ents.get(ed.bk);
        if (!A || !B || !A.cur || !B.cur) { ed.p.style.opacity = 0; if (ed.lab) ed.lab.style.opacity = 0; return; }
        var g = edgeGeom(rectOf(A.cur), rectOf(B.cur), ed);
        ed.p.setAttribute('d', g.d);
        var op = ed.o * Math.min(A.cur.o, B.cur.o);
        ed.p.style.opacity = op;
        if (ed.lab) { ed.lab.setAttribute('x', g.mx); ed.lab.setAttribute('y', ed.arc ? g.my + 2 : g.my - 9); ed.lab.style.opacity = op; }
      }
      function frame(now) {
        raf = 0;
        var t = anim.dur ? clamp((now - anim.t0) / anim.dur) : 1, k = ease(t);
        ents.forEach(function (e) {
          var f = e.from, to = e.to, c = e.cur; if (!f || !to) return;
          c.x = f.x + (to.x - f.x) * k; c.y = f.y + (to.y - f.y) * k; c.w = f.w + (to.w - f.w) * k; c.h = f.h + (to.h - f.h) * k; c.o = f.o + (to.o - f.o) * k; c.s = f.s + (to.s - f.s) * k;
          paintEnt(e);
        });
        edges.forEach(function (ed) { var tt = ed.exiting ? clamp(t / 0.35) : clamp((t - ed.delay) / (1 - ed.delay)); ed.o = ed.o0 + (ed.o1 - ed.o0) * ease(tt); paintEdge(ed); });
        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          ents.forEach(function (e, key) { if (e.exiting) { e.el.remove(); ents.delete(key); } });
          edges.forEach(function (ed, key) { if (ed.exiting) { ed.p.remove(); if (ed.lab) ed.lab.remove(); edges.delete(key); } });
          drawBeams();
          if (o.onSettled) o.onSettled();
        }
      }
      function startAnim(dur) { anim = { t0: performance.now(), dur: RM() ? 0 : dur }; if (d3) clearFx(); if (!raf) raf = requestAnimationFrame(frame); }
      // ro: {dimLinks, drawNew}
      function render(M, level, vis, ro) {
        ro = ro || {};
        lastM = M;
        var R = computeLayout(M, cfg, level, vis); curR = R;
        var levelChanged = lastLevel !== null && lastLevel !== level; lastLevel = level;
        var T = new Map();
        R.systems.forEach(function (r, id) { T.set('Y:' + id, { kind: 'system', id: id, r: r }); });
        R.stages.forEach(function (r, id) { T.set('S:' + id, { kind: 'stage', id: id, r: r }); });
        R.folders.forEach(function (r, id) { T.set('F:' + id, { kind: 'folder', id: id, r: r }); });
        R.blocks.forEach(function (r, id) { T.set('B:' + id, { kind: 'block', id: id, r: r }); });
        function parentKey(kind, id) {
          if (kind === 'block') return M.byId[id] ? 'F:' + M.byId[id].folder : null;
          if (kind === 'folder') return M.folderById[id] ? 'S:' + M.folderById[id].stage : null;
          if (kind === 'stage') { var sy = sysOf(cfg, id); return sy ? 'Y:' + sy : null; }
          return null;
        }
        T.forEach(function (t, key) {
          var e = ents.get(key);
          if (!e) {
            e = makeEnt(key, t); ents.set(key, e);
            var pk = parentKey(t.kind, t.id), pe = pk && ents.get(pk);
            if (levelChanged && pe && pe.cur) { var c = rcenter(pe.cur); e.cur = { x: c.x - t.r.w / 2, y: c.y - t.r.h / 2, w: t.r.w, h: t.r.h, o: 0, s: 0.3 }; }
            else e.cur = { x: t.r.x, y: t.r.y, w: t.r.w, h: t.r.h, o: 0, s: 0.88 };
          }
          e.exiting = false; e.t = t;
          fillEnt(e, M, level, R); paintEnt(e);
          e.from = copy(e.cur); e.to = { x: t.r.x, y: t.r.y, w: t.r.w, h: t.r.h, o: 1, s: 1 };
        });
        ents.forEach(function (e, key) {
          if (T.has(key)) return;
          e.exiting = true; e.from = copy(e.cur);
          var pk = parentKey(e.kind, e.id), pt = pk && T.get(pk);
          if (pt && levelChanged) { var c = rcenter(pt.r); e.to = { x: c.x - e.cur.w / 2, y: c.y - e.cur.h / 2, w: e.cur.w, h: e.cur.h, o: 0, s: 0.3 }; }
          else e.to = assign(copy(e.cur), { o: 0, s: 0.9 });
        });
        var E = level === 1 ? stageEdges(M, cfg) : level === 2 ? folderEdges(M) : blockEdges(M, R, ro.dimLinks);
        syncEdges(E, ro.drawNew && !RM());
        R.edgeCount = E.length; last = R;
        startAnim(levelChanged ? 760 : 560);
        return R;
      }
      // the entity a block is drawn as at this level (itself, its folder, or its stage)
      function keyOf(M, id, level) {
        var b = M.byId[id]; if (!b) return null;
        if (level >= 3) { var e = ents.get('B:' + id); return e && !e.exiting ? 'B:' + id : null; }
        if (level === 2) return 'F:' + b.folder;
        var f = M.folderById[b.folder]; return f ? 'S:' + f.stage : null;
      }
      var HLC = ['sel', 'up', 'down', 'active', 'recalc', 'verified', 'manual', 'match', 'dim', 'faded', 'touched', 'proc', 'proc-on', 'proc-done'];
      // h: {N: Map key -> Set of classes, vars: Map key -> delay index, lin: {sel, up, down, pairs} of block ids,
      //     upDown: bool, dimMode, fade, matchKeys: Set|null, procKeys: Set|null, procEdge(ed): bool}
      function paintHL(M, level, h) {
        var N = h.N || new Map(), vars = h.vars || new Map();
        function add(k, c) { if (!k) return; var s = N.get(k); if (!s) N.set(k, s = new Set()); s.add(c); }
        function kOf(id) { return keyOf(M, id, level); }
        function keys(ids) { var s = new Set(); ids.forEach(function (id) { var k = kOf(id); if (k) s.add(k); }); return s; }
        var edgeHL = new Set(), procHL = new Set(), involved = null, lin = h.lin;
        if (lin) {
          var S = keys(lin.sel), U = keys(lin.up), D = keys(lin.down);
          if (h.upDown !== false) { U.forEach(function (k) { if (!S.has(k)) add(k, 'up'); }); D.forEach(function (k) { if (!S.has(k)) add(k, 'down'); }); }
          involved = new Set(); [S, U, D].forEach(function (set) { set.forEach(function (k) { involved.add(k); }); });
          var SU = function (k) { return S.has(k) || U.has(k); }, SD = function (k) { return S.has(k) || D.has(k); };
          edges.forEach(function (ed) {
            if (ed.exiting) return; var a = ed.ak, b = ed.bk;
            var hit = lin.pairs ? ((S.has(a) && S.has(b)) || (ed.isNew && (S.has(a) || S.has(b)))) : ((SU(a) && SU(b)) || (SD(a) && SD(b)));
            if (hit && a !== b) edgeHL.add(ed.key);
          });
        }
        if (h.procKeys) {
          involved = involved || new Set(); h.procKeys.forEach(function (k) { involved.add(k); add(k, 'proc'); });
          edges.forEach(function (ed) { if (!ed.exiting && ed.ak !== ed.bk && h.procKeys.has(ed.ak) && h.procKeys.has(ed.bk) && (!h.procEdge || h.procEdge(ed))) procHL.add(ed.key); });
        }
        var dimming = involved && (h.dimMode || h.fade || h.procKeys);
        ents.forEach(function (e, key) {
          if (e.exiting || e.kind === 'system') return;
          if (e.kind === 'stage' && level >= 2) return;
          if (e.kind === 'folder' && level >= 3) return;
          if (dimming && !involved.has(key)) add(key, h.fade && !h.dimMode ? 'faded' : 'dim');
          else if (h.matchKeys && !involved && !h.matchKeys.has(key)) add(key, 'dim');
        });
        ents.forEach(function (e, key) {
          var set = N.get(key), stp = e.kind === 'block' ? e.el.querySelector('.n-step') : null;
          HLC.forEach(function (c) { e.el.classList.toggle(c, !!(set && set.has(c))); });
          if (stp) stp.textContent = h.procOrder && h.procOrder.has(key) ? h.procOrder.get(key) : '';
          if (vars.has(key)) e.el.style.setProperty('--d', vars.get(key)); else e.el.style.removeProperty('--d');
        });
        var edgeDim = !!(dimming || (h.matchKeys && !involved));
        edges.forEach(function (ed) {
          var hl = edgeHL.has(ed.key), pr = procHL.has(ed.key);
          ed.p.classList.toggle('hl', hl && !pr); ed.p.classList.toggle('e-proc', pr); ed.p.classList.toggle('dimmed', edgeDim && !hl && !pr);
          ed.p.setAttribute('marker-end', 'url(#' + pre + (pr ? 'proc' : hl ? (ed.isNew ? 'new' : 'hi') : markerBase(ed)) + ')');
          if (ed.lab) ed.lab.classList.toggle('dimmed', edgeDim && !hl && !pr);
        });
        if (d3 && lay) $$beams();
      }
      function $$beams() {
        var m = {}; edges.forEach(function (ed) { m[ed.key] = ed.p.getAttribute('class'); });
        Array.prototype.forEach.call(lay.beams.children, function (b) { var k = b.getAttribute('data-key'); if (m[k]) b.setAttribute('class', m[k] + (b.classList.contains('climb') ? ' climb' : '')); });
        Array.prototype.forEach.call(lay.solids.children, function (u) {
          var e = ents.get(u.getAttribute('data-key')); if (!e || e.kind !== 'block') return;
          u.classList.toggle('dim', e.el.classList.contains('dim') || e.el.classList.contains('faded')); u.classList.toggle('proc', e.el.classList.contains('proc'));
        });
      }
      return {
        render: render, paintHL: paintHL, keyOf: keyOf, ents: ents, edges: edges, set3d: set3d, is3d: function () { return !!d3; }, setCam: setCam, flyPacket: flyPacket,
        rectOf: function (key) { var e = ents.get(key); return e && e.cur ? rectOf(e.cur) : null; },
        last: function () { return last; }
      };
    }

    /* ---------- orbit: right-drag or Shift-drag turns the camera ---------- */
    // oo: {el, enabled(), get() -> {yaw, pitch}, set(yaw, pitch, live), start(), end(), minPitch, maxPitch}
    function orbit(oo) {
      var drag = null, lo = oo.minPitch == null ? 0 : oo.minPitch, hi = oo.maxPitch == null ? 78 : oo.maxPitch;
      oo.el.addEventListener('pointerdown', function (ev) {
        if (!oo.enabled() || !(ev.button === 2 || (ev.button === 0 && ev.shiftKey))) return;
        var c = oo.get(); drag = { x: ev.clientX, y: ev.clientY, yaw: c.yaw, pitch: c.pitch, id: ev.pointerId };
        try { oo.el.setPointerCapture(ev.pointerId); } catch (er) {}
        ev.preventDefault(); if (oo.start) oo.start();
      });
      oo.el.addEventListener('pointermove', function (ev) {
        if (!drag || ev.pointerId !== drag.id) return;
        oo.set(drag.yaw + (ev.clientX - drag.x) * 0.32, clamp(drag.pitch - (ev.clientY - drag.y) * 0.26, lo, hi), true);
      });
      function up(ev) { if (!drag || ev.pointerId !== drag.id) return; drag = null; if (oo.end) oo.end(); }
      oo.el.addEventListener('pointerup', up); oo.el.addEventListener('pointercancel', up);
      oo.el.addEventListener('contextmenu', function (ev) { if (oo.enabled()) ev.preventDefault(); });
      return { dragging: function () { return !!drag; } };
    }

    var CSS = '.bfc .world{position:absolute;left:0;top:0;transform-origin:0 0}.bfc .layer{position:absolute;left:0;top:0;width:0;height:0}.bfc .edges-svg{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}.bfc .ent{position:absolute;left:0;top:0;transform-origin:50% 50%}.bfc .stage{border-radius:18px}.bfc .stage[data-s="ingest"]{--glow:var(--g1)}.bfc .stage[data-s="structure"]{--glow:var(--g2)}.bfc .stage[data-s="plan"]{--glow:var(--g3)}.bfc .stage[data-s="report"]{--glow:var(--g4)}.bfc .stage[data-s="consume"]{--glow:var(--g5)}.bfc .stage::before,.bfc .stage::after{content:"";position:absolute;inset:0;border-radius:inherit;transition:opacity .45s;pointer-events:none}.bfc .stage::before{background:radial-gradient(90% 70% at 100% 0%,color-mix(in srgb,var(--glow) var(--glow-a),transparent) 0%,transparent 62%),radial-gradient(55% 45% at 0% 0%,color-mix(in srgb,var(--glow) var(--glow-b),transparent) 0%,transparent 70%),var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-md)}.bfc .stage::after{background:color-mix(in srgb,var(--glow) var(--band-mix),transparent);border:1px solid color-mix(in srgb,var(--glow) 55%,transparent);opacity:0}.bfc .stage.m-band::before{opacity:0}.bfc .stage.m-band::after{opacity:1}.bfc .stage>*{position:relative}.bfc .stage.m-card{cursor:pointer}.bfc .st-head{display:flex;align-items:center;gap:8px;padding:18px 18px 0;transition:padding .4s}.bfc .st-num{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 var(--font);background:var(--fg);color:var(--surface);transition:width .4s,height .4s}.bfc .st-name{font:500 19px/24px var(--font);letter-spacing:-.01em;white-space:nowrap;transition:font-size .4s,letter-spacing .4s,color .4s}.bfc .stage.m-band .st-head{padding:12px 14px 0}.bfc .stage.m-band .st-num{width:18px;height:18px;font-size:10px}.bfc .stage.m-band .st-name{font-size:12px;line-height:18px;letter-spacing:.6px;text-transform:uppercase;font-weight:600;color:var(--fg-2)}.bfc .st-body{padding:12px 18px 18px;transition:opacity .3s}.bfc .stage.m-band .st-body{opacity:0;pointer-events:none}.bfc .st-body p{margin:0 0 14px;color:var(--fg-2);font-size:13px;line-height:19px}.bfc .tcounts{display:flex;flex-wrap:wrap;gap:6px 12px;margin-bottom:14px}.bfc .tc{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--fg-2);white-space:nowrap}.bfc .tc b{font-weight:500;color:var(--fg)}.bfc .outs{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:5px}.bfc .outs li{display:flex;align-items:center;gap:7px;font-size:12.5px;line-height:18px;white-space:nowrap;min-width:0}.bfc .outs li span{overflow:hidden;text-overflow:ellipsis}.bfc .outs svg{flex:none}.bfc .folder{border-radius:12px;border:1px solid var(--border);background:color-mix(in srgb,var(--surface) 60%,transparent);transition:background .35s,box-shadow .35s,border-color .35s;overflow:hidden}.bfc .folder.m-card{background:var(--surface);box-shadow:var(--shadow-sm);cursor:pointer}.bfc .folder.m-card:hover{box-shadow:var(--shadow-md);border-color:var(--border-2)}.bfc .folder.f-ext{border-style:dashed}.bfc .folder.st-new{border:1.5px dashed var(--pos)}.bfc .f-head{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;font-size:12.5px;font-weight:500;white-space:nowrap;cursor:pointer;color:var(--fg)}.bfc .f-head svg{flex:none;color:var(--fg-2)}.bfc .folder.m-card .f-head{height:46px;font-size:14px}.bfc .f-name{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}.bfc .f-count{font-size:11.5px;color:var(--fg-3);font-weight:400}.bfc .folder.m-card .f-count{display:none}.bfc .f-body{padding:0 14px 14px;transition:opacity .3s}.bfc .folder.m-lane .f-body{opacity:0;pointer-events:none;position:absolute;left:0;right:0;top:36px}.bfc .f-desc{margin:0 0 10px;font-size:12.5px;line-height:18px;color:var(--fg-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.bfc .f-body .tcounts{margin-bottom:10px}.bfc .f-empty{position:absolute;left:12px;right:12px;top:40px;height:26px;border:1px dashed var(--border-2);border-radius:8px;display:grid;place-items:center;font-size:11.5px;color:var(--fg-2)}.bfc .folder.m-card .f-empty{display:none}.bfc .folder.touched{box-shadow:0 0 0 2px var(--cau),var(--shadow-md)}.bfc .folder.touched.st-new{box-shadow:0 0 0 2px var(--pos),var(--shadow-md)}.bfc .f-delta{display:none;position:absolute;top:-10px;right:10px;font:600 10px/16px var(--font);padding:1px 7px;border-radius:999px;background:var(--cau-10);color:var(--cau-ink);border:1px solid var(--cau-20);white-space:nowrap}.bfc .folder.touched .f-delta{display:block}.bfc .folder.touched{overflow:visible}.bfc .node{display:flex;align-items:center;gap:9px;padding:0 10px 0 8px;background:var(--surface);border:1px solid var(--border);border-radius:9px;box-shadow:var(--shadow-sm);cursor:pointer;transition:box-shadow .2s,border-color .2s,filter .3s}.bfc .node:hover,.bfc .node.hover{border-color:var(--border-2);box-shadow:var(--shadow-md)}.bfc .t-dim{--tint:var(--t-dim-tint)}.bfc .t-txn{--tint:var(--t-txn-tint)}.bfc .t-met{--tint:var(--t-met-tint)}.bfc .t-tab{--tint:var(--t-tab-tint)}.bfc .t-ext{--tint:var(--t-ext-tint)}.bfc .n-ico{flex:none;width:28px;height:28px;border-radius:7px;display:grid;place-items:center;background:var(--tint)}.bfc .n-txt{display:grid;min-width:0;flex:1}.bfc .n-name{font:500 12.5px/16px var(--font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bfc .n-sub{font:400 10.5px/14px var(--font);color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bfc .node.n-ext{border-style:dashed;background:color-mix(in srgb,var(--surface) 80%,transparent)}.bfc .n-badge{position:absolute;top:-9px;right:8px;font:600 9.5px/14px var(--font);letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:999px;border:1px solid;white-space:nowrap}.bfc .b-new{background:var(--pos-10);color:var(--pos-ink);border-color:var(--pos-20)}.bfc .b-edited{background:var(--cau-10);color:var(--cau-ink);border-color:var(--cau-20)}.bfc .b-shared{background:var(--brand-10);color:var(--brand-ink);border-color:var(--brand-20)}.bfc .node.st-new{border-color:color-mix(in srgb,var(--pos) 60%,transparent)}.bfc .node.st-edited{border-color:color-mix(in srgb,var(--cau) 75%,transparent)}.bfc .n-flag{display:none;position:absolute;bottom:-9px;left:10px;font:600 9.5px/14px var(--font);letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:999px;white-space:nowrap;border:1px solid}.bfc .node.recalc .n-flag,.bfc .node.verified .n-flag,.bfc .node.manual .n-flag{display:block}.bfc .node.recalc .n-flag{background:var(--brand-10);color:var(--brand-ink);border-color:var(--brand-20)}.bfc .node.recalc .n-flag::after{content:"Recalc"}.bfc .node.verified .n-flag{background:var(--pos-10);color:var(--pos-ink);border-color:var(--pos-20)}.bfc .node.verified .n-flag::after{content:"✓ Verified"}.bfc .node.manual .n-flag{background:var(--neg-10);color:var(--neg-ink);border-color:var(--neg-20)}.bfc .node.manual .n-flag::after{content:"Your step"}.bfc .ent.sel{box-shadow:0 0 0 2px var(--brand),var(--shadow-md)}.bfc .node.up,.bfc .node.down{border-color:color-mix(in srgb,var(--brand) 55%,transparent)}.bfc .folder.up,.bfc .folder.down,.bfc .stage.m-card.up,.bfc .stage.m-card.down{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--brand) 55%,transparent),var(--shadow-md)}.bfc .ent.dim{filter:opacity(.28) saturate(.5)}.bfc .ent.faded{filter:opacity(.45) saturate(.7)}.bfc .ent.match{box-shadow:0 0 0 2px var(--cau),var(--shadow-md)}.bfc .ent.active::after{content:"";position:absolute;inset:-6px;border-radius:14px;border:2px solid var(--brand);animation:bfPulse 1.6s ease-out infinite;pointer-events:none}@keyframes bfPulse{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.07)}}.bfc .node.recalc{border-color:var(--brand);animation:bfRecalc 1s ease-out both;animation-delay:calc(var(--d,1) * 170ms)}@keyframes bfRecalc{0%{box-shadow:0 0 0 0 var(--brand-20)}45%{box-shadow:0 0 0 7px var(--brand-20)}100%{box-shadow:0 0 0 2px var(--brand-20)}}.bfc .edge{fill:none;stroke:var(--edge);stroke-width:1.4;transition:stroke .2s,stroke-opacity .25s}.bfc .e-implied{stroke-dasharray:5 4}.bfc .e-dim{stroke:var(--t-dim);stroke-opacity:.5;stroke-dasharray:1.5 3.5;stroke-width:1.1}.bfc .e-sync{stroke:var(--t-ext);stroke-opacity:.75;stroke-dasharray:2 3}.bfc .e-view{stroke:var(--edge-2)}.bfc .e-share{stroke:var(--t-ext);stroke-dasharray:7 3}.bfc .e-new{stroke:var(--pos);stroke-opacity:1;stroke-dasharray:none}.bfc .edge.hl{stroke:var(--brand);stroke-opacity:1;stroke-dasharray:6 7;animation:bfFlow 1.1s linear infinite}.bfc .edge.hl.e-new{stroke:var(--pos)}.bfc .edge.dimmed{stroke-opacity:.1}.bfc .edge.draw{stroke-dasharray:1 1!important;stroke-dashoffset:1;animation:bfDraw .9s .3s ease forwards!important}@keyframes bfFlow{to{stroke-dashoffset:-26}}@keyframes bfDraw{to{stroke-dashoffset:0}}.bfc .elabel{font:500 11.5px var(--font);fill:var(--fg-2);paint-order:stroke;stroke:var(--canvas);stroke-width:5px;stroke-linejoin:round;text-anchor:middle;dominant-baseline:middle;transition:opacity .25s}.bfc .elabel.dimmed{opacity:.2}.bfc .sys{border-radius:22px;border:1.5px dashed color-mix(in srgb,var(--sysc) 50%,transparent);background:color-mix(in srgb,var(--sysc) 5%,transparent);transition:opacity .3s,filter .3s}.bfc .sys.m-card{background:color-mix(in srgb,var(--sysc) 7%,transparent)}.bfc .sy-head{display:flex;align-items:center;gap:10px;padding:13px 16px 0}.bfc .sy-mark{flex:none;min-width:30px;height:30px;padding:0 6px;border-radius:8px;display:grid;place-items:center;font:700 11.5px/1 var(--font);letter-spacing:.02em;color:#fff;background:var(--sysc)}.bfc .sy-txt{display:grid;min-width:0}.bfc .sy-name{font:600 14px/18px var(--font);color:var(--fg);white-space:nowrap}.bfc .sy-sub{font:400 11.5px/15px var(--font);color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bfc .sy-n{margin-left:auto;font-size:11.5px;color:var(--fg-3)}.bfc .t-wh{--tint:var(--t-wh-tint)}.bfc .t-ai{--tint:var(--t-ai-tint)}.bfc .e-mcp{stroke:var(--t-ai);stroke-opacity:.85;stroke-dasharray:7 3}.bfc .e-system{stroke:var(--t-ext);stroke-dasharray:2 3}.bfc .edge.e-proc{stroke:var(--proc);stroke-opacity:1;stroke-width:2.6px!important;stroke-dasharray:9 6;animation:bfFlow .8s linear infinite}.bfc .node.proc{border-color:var(--proc);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--proc) 45%,transparent),var(--shadow-md)}.bfc .folder.proc,.bfc .stage.proc{box-shadow:0 0 0 2px color-mix(in srgb,var(--proc) 70%,transparent),var(--shadow-md)}.bfc .ent.proc-on::after{content:"";position:absolute;inset:-7px;border-radius:15px;border:2.5px solid var(--proc);animation:bfPulse 1.2s ease-out infinite;pointer-events:none}.bfc .node.proc-on{box-shadow:0 0 0 3px var(--proc),0 0 26px color-mix(in srgb,var(--proc) 50%,transparent)}.bfc .node.proc-done .n-step{background:color-mix(in srgb,var(--proc) 60%,var(--surface))}.bfc .n-step{display:none;position:absolute;top:-9px;left:-9px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--proc);color:#fff;font:700 10px/18px var(--font);text-align:center;box-shadow:0 0 0 2px var(--surface)}.bfc .node.proc .n-step:not(:empty){display:block}.bfc .eyebrow{font:400 11px/16px var(--font);letter-spacing:.6px;text-transform:uppercase;color:var(--fg-2)}.bfc.bf-3d .world,.bfc.bf-3d .tilt,.bfc.bf-3d .layer{transform-style:preserve-3d}.bfc.bf-3d .edges-svg{display:none}.bfc.bf-3d .beams3d{display:block}.bfc .beams3d{display:none;position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;pointer-events:none}.bfc .beams3d .bf-sol,.bfc .beams3d .bf-bm{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}.bfc .bf-sol u{position:absolute;left:0;top:0;transform-style:preserve-3d;--wc:var(--border-2);transition:opacity .3s}.bfc .bf-sol s{position:absolute;left:0;top:0;transform-origin:0 0;background:linear-gradient(to bottom,color-mix(in srgb,var(--wc) 62%,#000) ,var(--wc));animation:bfGrow .5s cubic-bezier(.2,.7,.2,1) both}.bfc .bf-sol s.ww,.bfc .bf-sol s.we{filter:brightness(.88)}.bfc .bf-sol u.t-met{--wc:color-mix(in srgb,var(--t-met) 62%,var(--surface))}.bfc .bf-sol u.t-dim{--wc:color-mix(in srgb,var(--t-dim) 62%,var(--surface))}.bfc .bf-sol u.t-txn{--wc:color-mix(in srgb,var(--t-txn) 62%,var(--surface))}.bfc .bf-sol u.t-tab{--wc:color-mix(in srgb,var(--t-tab) 62%,var(--surface))}.bfc .bf-sol u.t-ext{--wc:color-mix(in srgb,var(--t-ext) 50%,var(--surface))}.bfc .bf-sol u.t-wh{--wc:color-mix(in srgb,var(--t-wh) 62%,var(--surface))}.bfc .bf-sol u.t-ai{--wc:color-mix(in srgb,var(--t-ai) 62%,var(--surface))}.bfc .bf-sol u.proc{--wc:color-mix(in srgb,var(--proc) 70%,var(--surface))}.bfc .bf-sol u.dim{opacity:.22}.bfc .bf-sol u.pl-sys s{background:color-mix(in srgb,var(--sysc,var(--t-ext)) 30%,var(--canvas));animation:none}.bfc .bf-sol u.pl-sys[data-y=erp]{--sysc:var(--t-ext)}.bfc .bf-sol u.pl-sys[data-y=dw]{--sysc:var(--t-wh)}.bfc .bf-sol u.pl-sys[data-y=epm]{--sysc:var(--t-met)}.bfc .bf-sol u.pl-sys[data-y=ai]{--sysc:var(--t-ai)}@keyframes bfGrow{from{opacity:0}to{opacity:1}}.bfc .bf-pk{display:none;position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;pointer-events:none;z-index:5}.bfc .bf-pk i{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#fff 0 22%,var(--proc) 46%,color-mix(in srgb,var(--proc) 0%,transparent) 72%)}.bfc .bf-pk i.pk-core{left:-20px;top:-20px;width:40px;height:40px;box-shadow:0 0 30px 10px color-mix(in srgb,var(--proc) 55%,transparent)}.bfc.bf-3d .ent.sys{transform-style:preserve-3d;border-radius:4px}.bfc.bf-3d .sy-head{transform-origin:0 100%;transform:translateY(-6px) rotateZ(calc(-1 * var(--yaw,0deg))) rotateX(calc(-1 * var(--pitch,0deg))) scale(1.7);transform-style:flat}.bfc.bf-3d .ent.sys.leg-on{box-shadow:0 0 0 3px var(--proc),0 0 50px color-mix(in srgb,var(--proc) 40%,transparent)}.bfc.bf-3d.stack .sys{background:color-mix(in srgb,var(--sysc) 9%,transparent);box-shadow:none}.bfc .sy-leg{font:600 11px/1 var(--font);color:#fff;background:var(--proc);padding:4px 7px;border-radius:999px;white-space:nowrap}.bfc .beams3d b{display:block;position:absolute;left:0;top:0;transform-style:preserve-3d;--bc:var(--edge)}.bfc .beams3d i{position:absolute;left:0;top:0;height:1.6px;margin-top:-.8px;transform-origin:0 50%;background:var(--bc);border-radius:1px}.bfc .beams3d b.climb{--bc:color-mix(in srgb,var(--t-ext) 70%,var(--edge))}.bfc .beams3d b.e-mcp{--bc:var(--t-ai)}.bfc .beams3d b.e-sync{--bc:color-mix(in srgb,var(--t-wh) 70%,var(--edge))}.bfc .beams3d b.hl{--bc:var(--brand)}.bfc .beams3d b.hl i{height:2.4px;margin-top:-1.2px}.bfc .beams3d b.e-proc{--bc:var(--proc)}.bfc .beams3d b.e-proc i{height:3.4px;margin-top:-1.7px;box-shadow:0 0 8px var(--proc)}.bfc .beams3d b.dimmed{opacity:.12}.bfc.bf-3d .sys{background:color-mix(in srgb,var(--sysc) 12%,var(--canvas));box-shadow:0 30px 60px -30px rgba(0,0,0,.35)}.bfc.bf-3d .ent.dim,.bfc.bf-3d .ent.faded{filter:none;opacity:.3!important}';
    var TOKENS = '.bfc{--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; --bg:#FBF8F3; --surface:#FDFBF7; --surface-2:#F3EEE5; --canvas:#F0EBE1; --dot:rgba(61,48,32,.14); --wash:rgba(61,48,32,.05); --wash-2:rgba(61,48,32,.09); --border:rgba(61,48,32,.13); --border-2:rgba(61,48,32,.22); --input:#E3DBCD; --fg:#1F1E1D; --fg-2:#655F55; --fg-3:#857E72; --brand:#B04F2B; --btn:#B04F2B; --brand-ink:#8F3F22; --brand-10:#F6E7DD; --brand-20:#E3B39D; --brand-wash:rgba(176,79,43,.07); --pos:#3F8A4F; --pos-10:#E6F0DF; --pos-20:#C5DDBD; --pos-ink:#1F4D2B; --cau:#D9A21B; --cau-10:#F8EDD0; --cau-20:#EFD99A; --cau-ink:#6E5210; --neg:#C0392F; --neg-10:#F8E3DE; --neg-20:#F0C6BE; --neg-ink:#7A1F18; --t-dim:#3B78C4; --t-dim-soft:#BFD3EA; --t-dim-tint:#E6EDF1; --t-dim-ink:#1F56A3; --t-txn:#3F8F6B; --t-txn-soft:#BBDCC9; --t-txn-tint:#E4F0E5; --t-txn-ink:#1F6647; --t-met:#7A45D1; --t-met-soft:#D5C4F0; --t-met-tint:#EEE7F3; --t-met-ink:#5A27B0; --t-tab:#C8457A; --t-tab-soft:#EFC3D3; --t-tab-tint:#F7E6E8; --t-tab-ink:#9C2658; --t-ext:#6B655C; --t-ext-soft:#D6CEC0; --t-ext-tint:#EEE8DD; --t-ext-ink:#4A453E; --g1:hsl(28 80% 86%); --g2:hsl(45 75% 84%); --g3:hsl(12 75% 88%); --g4:hsl(80 40% 84%); --g5:hsl(340 60% 90%); --band-mix:34%; --glow-a:85%; --glow-b:70%; --btn-fg:#FFFDF9; --edge:rgba(31,30,29,.30); --edge-2:rgba(31,30,29,.16); --shadow-sm:0 1px 2px rgba(61,48,32,.08); --shadow-md:0 6px 20px rgba(61,48,32,.09),0 1px 3px rgba(61,48,32,.07); --shadow-lg:0 16px 48px rgba(61,48,32,.18),0 2px 8px rgba(61,48,32,.09); --ring:0 0 0 3px var(--brand-20); --t-wh:#2A8FB5; --t-wh-soft:#B9DDE8; --t-wh-tint:#E3EFEE; --t-wh-ink:#14647F; --t-ai:#D97757; --t-ai-soft:#F0CDBD; --t-ai-tint:#F8E9E0; --t-ai-ink:#9C4526; --proc:#1F8576;}.bfc.bf-dark{--bg:#1F1E1D; --surface:#262624; --surface-2:#2E2D2A; --canvas:#1A1918; --dot:rgba(250,249,245,.08); --wash:rgba(250,249,245,.05); --wash-2:rgba(250,249,245,.10); --border:rgba(250,249,245,.10); --border-2:rgba(250,249,245,.19); --input:rgba(250,249,245,.16); --fg:#FAF9F5; --fg-2:#B0AEA5; --fg-3:#7E7C75; --brand:#D97757; --btn:#D97757; --btn-fg:#141413; --brand-ink:#EBA58A; --brand-10:rgba(217,119,87,.16); --brand-20:rgba(217,119,87,.45); --brand-wash:rgba(217,119,87,.10); --pos:#8FAE6B; --pos-10:rgba(143,174,107,.15); --pos-20:rgba(143,174,107,.34); --pos-ink:#BCD49F; --cau:#E3B25B; --cau-10:rgba(227,178,91,.14); --cau-20:rgba(227,178,91,.34); --cau-ink:#F0CF8E; --neg:#E2725F; --neg-10:rgba(226,114,95,.14); --neg-20:rgba(226,114,95,.34); --neg-ink:#F2A497; --t-dim:#6A9BCC; --t-dim-soft:rgba(106,155,204,.45); --t-dim-tint:rgba(106,155,204,.16); --t-dim-ink:#A3C3E3; --t-txn:#8FA876; --t-txn-soft:rgba(143,168,118,.45); --t-txn-tint:rgba(143,168,118,.16); --t-txn-ink:#BED2A8; --t-met:#A889D9; --t-met-soft:rgba(168,137,217,.45); --t-met-tint:rgba(168,137,217,.16); --t-met-ink:#CDB8EE; --t-tab:#C46686; --t-tab-soft:rgba(196,102,134,.45); --t-tab-tint:rgba(196,102,134,.16); --t-tab-ink:#E6A5BC; --t-ext:#B0AEA5; --t-ext-soft:rgba(176,174,165,.35); --t-ext-tint:rgba(176,174,165,.12); --t-ext-ink:#D8D6CD; --g1:#6A9BCC; --g2:#788C5D; --g3:#D97757; --g4:#D4A27F; --g5:#C46686; --band-mix:15%; --glow-a:34%; --glow-b:24%; --edge:rgba(250,249,245,.27); --edge-2:rgba(250,249,245,.14); --shadow-sm:0 1px 2px rgba(0,0,0,.4); --shadow-md:0 6px 20px rgba(0,0,0,.35); --shadow-lg:0 16px 48px rgba(0,0,0,.55); --t-wh:#6CC4E4; --t-wh-soft:rgba(108,196,228,.42); --t-wh-tint:rgba(108,196,228,.15); --t-wh-ink:#A9DDF0; --t-ai:#E3906F; --t-ai-soft:rgba(227,144,111,.42); --t-ai-tint:rgba(227,144,111,.15); --t-ai-ink:#F2BBA5; --proc:#5FC7B4;}';
    function injectCSS(doc, withTokens) {
      doc = doc || document; if (doc.getElementById('bf-core-css')) return;
      var s = doc.createElement('style'); s.id = 'bf-core-css'; s.textContent = (withTokens ? TOKENS : '') + CSS; doc.head.appendChild(s);
    }

    return {
      TYPES: TYPES, ICONS: ICONS, icon: icon, FOLDER_ICON: FOLDER_ICON, G: G, esc: esc,
      index: index, upstream: upstream, downstream: downstream, stageOf: stageOf, sysOf: sysOf,
      visibleSet: visibleSet, computeLayout: computeLayout, unionR: unionR, padR: padR,
      stageEdges: stageEdges, folderEdges: folderEdges, blockEdges: blockEdges, edgeGeom: edgeGeom, markerBase: markerBase, markerDefs: markerDefs,
      typeCounts: typeCounts, blockSub: blockSub, blockHTML: blockHTML, folderHTML: folderHTML, stageHTML: stageHTML, systemHTML: systemHTML,
      procPath: procPath, procLegs: procLegs, createView: createView, orbit: orbit, injectCSS: injectCSS, CSS: CSS
    };
  })();
