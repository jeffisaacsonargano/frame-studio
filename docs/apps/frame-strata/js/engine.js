/* Framecraft — lineage engine.
   Static analysis of frame code + value fingerprinting of what the frame renders,
   matched against exactly the data the frame was handed through the PigmentSDK. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const E = (S.engine = {});

  E.filterKey = function (filters) {
    if (!filters || !filters.length) return '';
    return filters
      .filter((f) => f && f.binding && f.selection && f.selection.length)
      .map((f) => f.binding + '=' + f.selection.map(String).slice().sort().join(','))
      .sort()
      .join(';');
  };

  const KIND_DEFAULT = { Metric: 'Metric', List: 'Dimension', ListProperty: 'Property', Variable: 'Variable', View: 'View' };
  E.blockMeta = function (snap, key) {
    const m = (snap.blocks && snap.blocks[key]) || (snap.upstream && snap.upstream[key]);
    if (m) return Object.assign({ key, name: key, kind: 'Metric', dims: [], upstream: [] }, m, { key });
    const b = (snap.bindings || []).find((x) => x.name === key);
    if (b) return { key, name: key, kind: KIND_DEFAULT[b.type] || b.type, dims: [], upstream: [], binding: b };
    return null;
  };
  E.kindGroup = function (kind) {
    const k = String(kind || '').toLowerCase();
    if (k === 'metric') return 'metric';
    if (k === 'table') return 'table';
    if (k === 'dimension' || k === 'list') return 'list';
    if (k === 'property' || k === 'listproperty') return 'prop';
    if (k === 'variable') return 'var';
    if (k.indexOf('transaction') >= 0) return 'tx';
    return 'metric';
  };

  /* ---------- Pigment-style formatting for block cards ---------- */
  E.formatPigment = function (v, fmt) {
    if (v == null || typeof v !== 'number' || !isFinite(v)) return '—';
    fmt = fmt || {};
    const dec = fmt.decimals == null ? 1 : fmt.decimals;
    if (fmt.type === 'percent') return (v * 100).toFixed(dec) + '%';
    if (fmt.type === 'integer') return Math.round(v).toLocaleString('en-US');
    let a = Math.abs(v), s;
    const scale = fmt.scale || 'auto';
    if (scale === 'B' || (scale === 'auto' && a >= 1e9)) s = (a / 1e9).toFixed(dec) + 'B';
    else if (scale === 'M' || (scale === 'auto' && a >= 1e6)) s = (a / 1e6).toFixed(dec) + 'M';
    else if (scale === 'K' || (scale === 'auto' && a >= 1e3)) s = (a / 1e3).toFixed(dec) + 'K';
    else s = a.toLocaleString('en-US', { maximumFractionDigits: dec });
    return (v < 0 ? '−' : '') + (fmt.prefix || '') + s + (fmt.suffix || '');
  };
  E.describeFormat = function (fmt) {
    if (!fmt) return 'Default';
    const parts = [];
    parts.push(fmt.type === 'percent' ? 'Percent' : fmt.type === 'currency' ? 'Currency ' + (fmt.prefix || '') : fmt.type === 'integer' ? 'Integer' : 'Number');
    if (fmt.scale && fmt.scale !== 'auto') parts.push('in ' + fmt.scale);
    if (fmt.decimals != null && fmt.type !== 'integer') parts.push(fmt.decimals + ' dp');
    return parts.join(' · ');
  };

  /* ---------- Static analysis of the frame code ---------- */
  const IGNORE_CONST = /(^|_)(w|h|x|y|z|pad|padding|gap|ms|delay|duration|size|radius|width|height|margin|dpr|opacity|font|line|stroke|debounce|timeout|interval|rows|limit|page|offset|cols|idx|index|min|max|count|step|speed|zoom|scale|alpha|angle)(_|$)/i;
  E.analyzeCode = function (code) {
    code = String(code || '');
    const lineStarts = [0];
    for (let i = 0; i < code.length; i++) if (code.charCodeAt(i) === 10) lineStarts.push(i + 1);
    const lineOf = (idx) => {
      let lo = 0, hi = lineStarts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
      return lo + 1;
    };
    const grab = (re, map) => { const out = []; let m; re.lastIndex = 0; while ((m = re.exec(code))) out.push(Object.assign({ line: lineOf(m.index) }, map(m))); return out; };
    const res = {
      lines: code.split('\n').length,
      bytes: code.length,
      subscriptions: grab(/subscribeToDataSource\(\s*['"]([^'"]+)['"]/g, (m) => ({ name: m[1] })),
      items: grab(/subscribeToItems\(\s*['"]([^'"]+)['"]/g, (m) => ({ name: m[1] })),
      legacy: grab(/subscribeToVizualization\(\s*['"]([^'"]+)['"]/g, (m) => ({ name: m[1] })),
      writes: grab(/\b(editValue|addItem|editItem)\(\s*['"]([^'"]+)['"]/g, (m) => ({ op: m[1], target: m[2] })),
      filterCalls: grab(/updateDynamicFilters\(/g, () => ({})),
      tunable: /StrataTuning/.test(code),
      constants: [],
    };
    const seen = new Set();
    const pushConst = (name, raw, idx) => {
      const value = parseFloat(raw);
      if (!isFinite(value) || value === 0 || value === 1 || seen.has(name)) return;
      if (IGNORE_CONST.test(name) || name.length < 3) return;
      seen.add(name);
      res.constants.push({ name, value, raw, line: lineOf(idx) });
    };
    let m;
    const re1 = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*[;,\n]/g;
    while ((m = re1.exec(code))) pushConst(m[1], m[2], m.index);
    const re2 = /\b([A-Z][A-Z0-9_]{2,})\s*:\s*(-?\d+(?:\.\d+)?)\b/g;
    while ((m = re2.exec(code))) pushConst(m[1], m[2], m.index);
    return res;
  };

  /* ---------- Number tokens in rendered text ---------- */
  const NUM_RE = /(?<![\w.])([-−–+]?)(\()?([$€£¥])?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?(%|pts|pt|bps|bn|[kKmMbBx])?(?![\w])/g;
  E.parseTokens = function (text) {
    const out = [];
    let m;
    NUM_RE.lastIndex = 0;
    while ((m = NUM_RE.exec(text))) {
      const sign = m[1] || '', paren = !!m[2], cur = m[3] || '', int = m[4], dec = m[5] || '', suf = m[6] || '';
      const digits = int.replace(/,/g, '');
      const shown = parseFloat(digits + (dec ? '.' + dec : ''));
      const neg = /[-−–]/.test(sign) || (paren && text.indexOf(')', m.index) > m.index);
      const sl = suf.toLowerCase();
      const scale = sl === 'k' ? 1e3 : sl === 'm' ? 1e6 : sl === 'b' || sl === 'bn' ? 1e9 : 1;
      const percent = sl === '%' || sl === 'pt' || sl === 'pts';
      const isYear = !dec && !cur && !suf && !sign && int.indexOf(',') < 0 && shown >= 1900 && shown <= 2100;
      const sig = (digits.replace(/^0+/, '') + dec).replace(/0+$/, '').length || 1;
      out.push({
        raw: m[0], index: m.index, shown, decimals: dec.length, scale, percent, bps: sl === 'bps', multiple: sl === 'x',
        sign: neg ? '-' : sign === '+' ? '+' : '', currency: cur, isYear, sig,
        value: (neg ? -1 : 1) * shown * scale,
      });
    }
    return out;
  };

  function tokenTargets(tok) {
    const half = 0.5 * Math.pow(10, -tok.decimals) * (1 + 1e-9) + 1e-12;
    const sgn = tok.sign === '-' ? -1 : 1;
    if (tok.percent) return [{ v: (sgn * tok.shown) / 100, tol: half / 100, unit: 'ratio' }, { v: sgn * tok.shown, tol: half, unit: 'pct' }];
    if (tok.bps) return [{ v: (sgn * tok.shown) / 10000, tol: half / 10000, unit: 'ratio' }];
    return [{ v: sgn * tok.shown * tok.scale, tol: half * tok.scale, unit: 'abs' }];
  }

  function lowerBound(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].v < v) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function findIn(sorted, target) {
    const out = [];
    let i = lowerBound(sorted, target.v - target.tol);
    for (; i < sorted.length && sorted[i].v <= target.v + target.tol; i++) out.push(sorted[i]);
    return out;
  }

  const OP_BASE = { sum: 3, pct: 3, ratio: 3, weighted: 2.5, diff: 2, avg: 2, add: 1, min: 1, max: 1, count: 0.5, rowpct: 1.5, rowdiff: 1, csum: 2.5 };
  const OP_SYM = { ratio: '÷', diff: '−', add: '+', pct: 'Δ% vs' };

  /* ---------- Build the lineage graph ---------- */
  E.buildGraph = function (snap, rt, scan) {
    const code = E.analyzeCode(snap.code);
    const defs = {};
    (snap.dataSources || []).forEach((d) => { defs[d.name] = d; });
    const meta = (k) => E.blockMeta(snap, k);
    const nameOf = (k) => { const m = meta(k); return m ? m.name : k; };

    const nodes = new Map();
    const edges = [];
    const edgeKeys = new Set();
    const addNode = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, n); return nodes.get(n.id); };
    const addEdge = (from, to, type) => {
      const k = from + '>' + to;
      if (from === to || edgeKeys.has(k)) return;
      edgeKeys.add(k);
      edges.push({ id: 'e' + edges.length, from, to, type });
    };

    /* active data sources: what the frame actually subscribed to, with its filters */
    const active = [];
    const subSeen = new Set();
    (rt && rt.subs ? [...rt.subs.values()] : []).forEach((s) => {
      if (s.dead) return;
      const k = s.name + '|' + (s.key || '');
      if (subSeen.has(k)) return;
      subSeen.add(k);
      const d = snap.data && snap.data[s.name];
      const data = d ? (s.key && d.filters && d.filters[s.key]) || d.default : null;
      active.push({ name: s.name, key: s.key || '', exact: s.exact !== false, wanted: s.wanted, filters: s.filters || [], data, def: defs[s.name] || null });
    });

    /* blocks: every binding, flagged by use */
    const usedInDs = new Set();
    (snap.dataSources || []).forEach((d) => [...(d.values || []), ...(d.labels || []), ...(d.selectors || [])].forEach((x) => usedInDs.add(x.binding)));
    (snap.bindings || []).forEach((b) => {
      const m = meta(b.name) || { key: b.name, name: b.name, kind: KIND_DEFAULT[b.type] || 'Metric' };
      addNode({ id: 'block:' + b.name, layer: 'blocks', kind: 'block', key: b.name, meta: m, group: E.kindGroup(m.kind), binding: b, inDataSource: usedInDs.has(b.name), visible: 0, sample: null });
    });

    /* upstream closure */
    const upSeen = new Set();
    const walkUp = (key, childId, depth) => {
      const m = meta(key);
      if (!m || !m.upstream) return;
      m.upstream.forEach((u) => {
        const bound = nodes.get('block:' + u);
        if (bound) { addEdge(bound.id, childId, 'upstream'); return; }
        const um = meta(u);
        if (!um) return;
        const id = 'up:' + u;
        addNode({ id, layer: 'upstream', kind: 'block', key: u, meta: um, group: E.kindGroup(um.kind), depth });
        addEdge(id, childId, 'upstream');
        if (!upSeen.has(u)) { upSeen.add(u); walkUp(u, id, depth + 1); }
      });
    };
    (snap.bindings || []).forEach((b) => walkUp(b.name, 'block:' + b.name, 1));

    /* data-source nodes */
    const filterNodes = {};
    active.forEach((a) => {
      const id = 'ds:' + a.name;
      const n = addNode({ id, layer: 'logic', kind: 'ds', name: a.name, def: a.def, rows: a.data ? a.data.rows.length : 0, filters: a.filters, exact: a.exact, missing: !a.data, elements: 0 });
      if (a.def) {
        a.def.values.forEach((v) => { if (nodes.has('block:' + v.binding)) addEdge('block:' + v.binding, id, 'metric'); });
        a.def.labels.forEach((l) => { if (nodes.has('block:' + l.binding)) addEdge('block:' + l.binding, id, 'list'); });
        (a.def.selectors || []).forEach((s) => {
          const fid = 'filter:' + s.binding;
          const f = a.filters.find((x) => x.binding === s.binding);
          const fn = addNode({ id: fid, layer: 'logic', kind: 'filter', binding: s.binding, selection: f ? f.selection : [], dsNames: [] });
          if (f) fn.selection = f.selection;
          fn.dsNames.push(a.name);
          filterNodes[s.binding] = fn;
          if (nodes.has('block:' + s.binding)) addEdge('block:' + s.binding, fid, 'list');
          addEdge(fid, id, 'list');
        });
      }
      // sample values for block cards
      if (a.data && a.def && a.data.rows.length) {
        a.def.values.forEach((v, c) => {
          const bn = nodes.get('block:' + v.binding);
          if (bn && bn.sample == null) {
            const r0 = a.data.rows.length === 1 ? a.data.rows[0] : null;
            if (r0 && typeof r0.values[c] === 'number') bn.sample = r0.values[c];
          }
        });
      }
      n.missing = !a.data;
    });
    /* writes back to Pigment */
    code.writes.forEach((w) => {
      const id = 'write:' + w.op + ':' + w.target;
      addNode({ id, layer: 'logic', kind: 'write', op: w.op, target: w.target, line: w.line });
      if (nodes.has('block:' + w.target)) addEdge(id, 'block:' + w.target, 'write');
    });
    (rt && rt.writes ? rt.writes : []).forEach((w) => {
      const id = 'write:' + w.op + ':' + (w.args && w.args[0]);
      const n = nodes.get(id);
      if (n) n.fired = (n.fired || 0) + 1;
    });

    /* candidates */
    const direct = [], derived = [], consts = [];
    const labelIndex = new Map();
    const addLabel = (text, info) => {
      const k = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!k) return;
      if (!labelIndex.has(k)) labelIndex.set(k, []);
      labelIndex.get(k).push(info);
    };
    active.forEach((a) => {
      if (!a.data) return;
      const rows = a.data.rows;
      const valB = (c) => (a.def && a.def.values[c] ? a.def.values[c].binding : null);
      rows.forEach((row, r) => {
        const rowLabel = row.labels.filter((l) => typeof l === 'string').join(' · ');
        row.labels.forEach((l, li) => { if (typeof l === 'string') addLabel(l, { ds: a.name, binding: a.def && a.def.labels[li] ? a.def.labels[li].binding : null, row: r, full: l }); });
        row.values.forEach((v, c) => { if (typeof v === 'number' && isFinite(v)) direct.push({ v, kind: 'direct', ds: a.name, row: r, col: c, binding: valB(c), rowLabel }); });
      });
      // derived
      const R = rows.slice(0, 400);
      const ncols = R.reduce((mx, r) => Math.max(mx, r.values.length), 0);
      const numCols = [];
      for (let c = 0; c < ncols; c++) if (R.some((r) => typeof r.values[c] === 'number')) numCols.push(c);
      const val = (r, c) => (typeof R[r].values[c] === 'number' ? R[r].values[c] : null);
      const push = (v, op, inputs, extra) => { if (isFinite(v)) derived.push(Object.assign({ v, kind: 'derived', op, inputs, ds: a.name }, extra || {})); };
      const colSum = {};
      numCols.forEach((c) => {
        const vs = [];
        R.forEach((_, r) => { const v = val(r, c); if (v != null) vs.push(v); });
        colSum[c] = vs.reduce((s, x) => s + x, 0);
        if (vs.length >= 2) {
          push(colSum[c], 'sum', [{ ds: a.name, col: c, binding: valB(c), all: true, n: vs.length }]);
          push(colSum[c] / vs.length, 'avg', [{ ds: a.name, col: c, binding: valB(c), all: true, n: vs.length }]);
          push(Math.min(...vs), 'min', [{ ds: a.name, col: c, binding: valB(c), all: true }]);
          push(Math.max(...vs), 'max', [{ ds: a.name, col: c, binding: valB(c), all: true }]);
          push(vs.length, 'count', [{ ds: a.name, col: c, binding: valB(c), all: true }]);
        }
        if (R.length <= 60) {
          for (let r = 0; r + 1 < R.length; r++) {
            const x = val(r, c), y = val(r + 1, c);
            if (x != null && y != null) {
              if (x !== 0) push((y - x) / x, 'rowpct', [{ ds: a.name, col: c, row: r, binding: valB(c) }, { ds: a.name, col: c, row: r + 1, binding: valB(c) }]);
              push(y - x, 'rowdiff', [{ ds: a.name, col: c, row: r, binding: valB(c) }, { ds: a.name, col: c, row: r + 1, binding: valB(c) }]);
            }
          }
        }
      });
      if (numCols.length <= 10) {
        R.forEach((row, r) => {
          const rowLabel = row.labels.filter((l) => typeof l === 'string').join(' · ');
          numCols.forEach((ca) => numCols.forEach((cb) => {
            if (ca === cb) return;
            const x = val(r, ca), y = val(r, cb);
            if (x == null || y == null) return;
            const ins = [{ ds: a.name, col: ca, row: r, binding: valB(ca) }, { ds: a.name, col: cb, row: r, binding: valB(cb) }];
            if (y !== 0) { push(x / y, 'ratio', ins, { rowLabel }); push((x - y) / y, 'pct', ins, { rowLabel }); }
            push(x - y, 'diff', ins, { rowLabel });
            if (ca < cb) push(x + y, 'add', ins, { rowLabel });
          }));
        });
        if (R.length >= 2) {
          numCols.forEach((ca) => numCols.forEach((cb) => {
            if (ca === cb) return;
            const ins = [{ ds: a.name, col: ca, binding: valB(ca), all: true }, { ds: a.name, col: cb, binding: valB(cb), all: true }];
            if (colSum[cb]) push(colSum[ca] / colSum[cb], 'csum', ins);
            let num = 0, den = 0;
            R.forEach((_, r) => { const x = val(r, ca), w = val(r, cb); if (x != null && w != null) { num += x * w; den += w; } });
            if (den) push(num / den, 'weighted', ins);
          }));
        }
      }
    });
    (rt && rt.itemsAliases ? [...rt.itemsAliases] : []).forEach((alias) => {
      const items = snap.items && snap.items[alias];
      (items || []).forEach((it, r) => addLabel(it, { items: alias, binding: alias, row: r, full: it }));
    });
    code.constants.forEach((c) => consts.push({ v: c.value, kind: 'constant', name: c.name, line: c.line, raw: c.raw }));
    const byV = (a, b) => a.v - b.v;
    direct.sort(byV); derived.sort(byV); consts.sort(byV);

    /* elements */
    const elements = [];
    const items = (scan && scan.items) || [];
    const numericItems = [];
    items.forEach((it) => {
      const norm = it.text.toLowerCase().replace(/\s+/g, ' ').trim();
      let lab = labelIndex.get(norm);
      if (!lab && norm.length >= 3 && /^[a-z][a-z .\-]*$/.test(norm)) {
        for (const [k, v] of labelIndex) { if (k.startsWith(norm + ' ') || (k.startsWith(norm) && k.length - norm.length <= 3)) { lab = v; break; } }
      }
      if (lab) {
        elements.push({ id: it.id, scanId: it.id, text: it.text, rect: it, cls: 'label', label: lab[0], alts: lab.length, conf: lab.length > 1 && new Set(lab.map((l) => l.binding)).size > 1 ? 'medium' : 'high', group: it.group });
        return;
      }
      const toks = E.parseTokens(it.text).filter((t) => !t.isYear);
      toks.forEach((t, i) => numericItems.push({ it, tok: t, id: toks.length > 1 ? it.id + ':' + i : it.id }));
    });

    /* axis detection: aligned arithmetic progressions inside one svg/canvas */
    const axisIds = new Set();
    const byGroup = {};
    numericItems.forEach((n) => { if (n.it.group) (byGroup[n.it.group] = byGroup[n.it.group] || []).push(n); });
    Object.keys(byGroup).forEach((g) => {
      const arr = byGroup[g];
      const tryAlign = (keyFn) => {
        const buckets = {};
        arr.forEach((n) => { const k = Math.round(keyFn(n) / 3); (buckets[k] = buckets[k] || []).push(n); });
        Object.values(buckets).forEach((b) => {
          if (b.length < 3) return;
          const vs = b.map((n) => n.tok.value).sort((x, y) => x - y);
          const d = vs[1] - vs[0];
          if (d <= 0) return;
          if (vs.every((v, i) => i === 0 || Math.abs(v - vs[i - 1] - d) <= Math.abs(d) * 0.01)) b.forEach((n) => axisIds.add(n.id));
        });
      };
      tryAlign((n) => n.it.x + n.it.w); // right-aligned y axis
      tryAlign((n) => n.it.x + n.it.w / 2);
      tryAlign((n) => n.it.y + n.it.h / 2); // x axis
    });

    const ctxOf = (n) => {
      if (n.it.group) {
        const cx = n.it.x + n.it.w / 2, cy = n.it.y + n.it.h / 2;
        return items.filter((o) => o.group === n.it.group && o !== n.it && (Math.abs(o.x + o.w / 2 - cx) < 4 || Math.abs(o.y + o.h / 2 - cy) < 3)).map((o) => o.text).join(' ').toLowerCase();
      }
      return String(n.it.ctx || '').toLowerCase();
    };
    const blockNameIn = (ctx, binding) => { const nm = binding && nameOf(binding); return nm && nm.length > 2 && ctx.indexOf(nm.toLowerCase()) >= 0; };

    numericItems.forEach((n) => {
      const t = n.tok, it = n.it;
      const base = { id: n.id, scanId: it.id, text: it.text, raw: t.raw.trim(), tok: t, rect: it, group: it.group };
      if (axisIds.has(n.id)) { elements.push(Object.assign(base, { cls: 'axis', conf: 'high' })); return; }
      if (t.shown === 0) { elements.push(Object.assign(base, { cls: 'zero', conf: 'low' })); return; }
      const ctx = ctxOf(n);
      const targets = tokenTargets(t);
      const collect = (pool, allowAbs) => {
        const found = [];
        targets.forEach((tg) => found.push(...findIn(pool, tg).map((c) => ({ c, unit: tg.unit }))));
        if (!found.length && allowAbs) targets.forEach((tg) => found.push(...findIn(pool, { v: -tg.v, tol: tg.tol, unit: tg.unit }).map((c) => ({ c, unit: tg.unit, abs: true }))));
        return found;
      };
      // 1. direct
      let found = collect(direct, true);
      if (found.length) {
        let pool = found.filter((f) => f.c.rowLabel && ctx.indexOf(f.c.rowLabel.toLowerCase()) >= 0);
        const ctxResolved = pool.length > 0;
        if (!pool.length) pool = found;
        const pref = pool.filter((f) => blockNameIn(ctx, f.c.binding));
        if (pref.length) pool = pref;
        const bset = new Set(pool.map((f) => f.c.binding));
        // a "Total" row is a frame-side sum even when it equals a source value
        if (/\btotal\b/.test(ctx)) {
          const sums = collect(derived, false).filter((f) => f.c.op === 'sum' || f.c.op === 'weighted' || f.c.op === 'csum');
          if (sums.length) { found = []; pushDerived(base, sums, ctx, t); return; }
        }
        let conf = bset.size > 1 ? 'low' : ctxResolved || pool.length === 1 ? 'high' : 'medium';
        if (t.sig <= 1 && conf === 'high') conf = 'medium';
        if (pool[0].abs && conf === 'high') conf = 'medium';
        const best = pool[0];
        elements.push(Object.assign(base, { cls: 'direct', conf, match: best.c, unit: best.unit, alts: pool.slice(1, 6).map((f) => f.c), ambiguous: bset.size > 1 }));
        return;
      }
      // 2. hardcoded constants in the code
      const cf = collect(consts, true);
      if (cf.length) {
        const best = cf[0];
        elements.push(Object.assign(base, { cls: 'constant', conf: t.decimals > 0 || t.sig >= 2 ? 'high' : 'medium', match: best.c, unit: best.unit }));
        return;
      }
      // 3. derived in frame
      const df = collect(derived, false);
      if (df.length) { pushDerived(base, df, ctx, t); return; }
      elements.push(Object.assign(base, { cls: 'untraced', conf: 'low' }));
    });

    function pushDerived(base, df, ctx, t) {
      const scored = df.map((f) => {
        let s = OP_BASE[f.c.op] || 1;
        if (t.sign && (f.c.op === 'pct' || f.c.op === 'diff' || f.c.op === 'rowpct' || f.c.op === 'rowdiff')) s += 3;
        if (t.percent && /ratio|pct|weighted|avg|csum/.test(f.c.op)) s += 1.5;
        if (t.multiple && f.c.op === 'ratio') s += 3;
        if (/\btotal\b|\bsum\b/.test(ctx) && /sum|weighted|csum/.test(f.c.op)) s += 4;
        if (f.c.rowLabel && ctx.indexOf(f.c.rowLabel.toLowerCase()) >= 0) s += 2;
        f.c.inputs.forEach((inp) => { if (blockNameIn(ctx, inp.binding)) s += 1; });
        if (f.unit === 'pct' && t.percent) s -= 0.5;
        return { f, s };
      }).sort((a, b) => b.s - a.s);
      const best = scored[0];
      const margin = scored.length > 1 ? best.s - scored[1].s : 9;
      elements.push(Object.assign(base, { cls: 'computed', conf: margin >= 2 ? 'high' : margin >= 0.75 ? 'medium' : 'low', match: best.f.c, unit: best.f.unit, alts: scored.slice(1, 4).map((x) => x.f.c) }));
    }

    /* wire elements into nodes */
    const opLabel = (c) => {
      const nm = (inp) => nameOf(inp.binding || '?');
      const [a, b] = c.inputs;
      switch (c.op) {
        case 'sum': return 'Σ ' + nm(a) + ' across ' + a.n + ' rows';
        case 'avg': return 'Average of ' + nm(a);
        case 'min': return 'Minimum of ' + nm(a);
        case 'max': return 'Maximum of ' + nm(a);
        case 'count': return 'Count of ' + nm(a) + ' rows';
        case 'weighted': return nm(a) + ' weighted by ' + nm(b);
        case 'csum': return 'Σ ' + nm(a) + ' ÷ Σ ' + nm(b);
        case 'ratio': return nm(a) + ' ÷ ' + nm(b);
        case 'pct': return 'Change in ' + nm(a) + ' vs ' + nm(b);
        case 'diff': return nm(a) + ' − ' + nm(b);
        case 'add': return nm(a) + ' + ' + nm(b);
        case 'rowpct': return 'Period change in ' + nm(a);
        case 'rowdiff': return 'Period difference in ' + nm(a);
        default: return c.op;
      }
    };
    const opFormula = (c) => {
      const f = (x) => (Math.abs(x) >= 1e5 ? E.formatPigment(x, { type: 'number', scale: 'auto', decimals: 2 }) : String(+x.toPrecision(5)));
      const ins = c.inputs.map((inp) => {
        if (inp.all) return 'Σ ' + nameOf(inp.binding);
        const d = active.find((x) => x.name === inp.ds);
        const v = d && d.data && d.data.rows[inp.row] ? d.data.rows[inp.row].values[inp.col] : null;
        return v == null ? '?' : f(v);
      });
      const sym = { ratio: ' ÷ ', diff: ' − ', add: ' + ' }[c.op];
      if (sym) return ins.join(sym) + ' = ' + f(c.v);
      if (c.op === 'pct') return '(' + ins[0] + ' − ' + ins[1] + ') ÷ ' + ins[1] + ' = ' + (c.v * 100).toFixed(2) + '%';
      return opLabel(c) + ' = ' + f(c.v);
    };
    E._opLabel = opLabel;

    const upClosure = (ids) => {
      const out = new Set(ids);
      const stack = [...ids];
      while (stack.length) {
        const id = stack.pop();
        edges.forEach((e) => { if (e.to === id && e.type === 'upstream' && !out.has(e.from)) { out.add(e.from); stack.push(e.from); } });
      }
      return out;
    };

    elements.forEach((el) => {
      el.chain = new Set([el.id]);
      if (el.cls === 'direct') {
        const dsId = 'ds:' + el.match.ds;
        el.nodeId = dsId;
        el.blockIds = el.match.binding ? ['block:' + el.match.binding] : [];
        addEdge(dsId, el.id, 'metric');
        const dsN = nodes.get(dsId);
        if (dsN) dsN.elements++;
      } else if (el.cls === 'label') {
        const L = el.label;
        if (L.items) {
          const id = 'items:' + L.items;
          addNode({ id, layer: 'logic', kind: 'items', alias: L.items, count: (snap.items[L.items] || []).length });
          if (nodes.has('block:' + L.items)) addEdge('block:' + L.items, id, 'list');
          el.nodeId = id;
        } else {
          el.nodeId = 'ds:' + L.ds;
        }
        el.blockIds = L.binding ? ['block:' + L.binding] : [];
        addEdge(el.nodeId, el.id, 'list');
      } else if (el.cls === 'computed') {
        const c = el.match;
        const sig = c.op + '|' + c.inputs.map((i) => i.binding).join('|');
        const id = 'comp:' + sig;
        const n = addNode({ id, layer: 'logic', kind: 'computed', op: c.op, label: opLabel(c), inputs: c.inputs.map((i) => i.binding), dsNames: [...new Set(c.inputs.map((i) => i.ds))], examples: [] });
        n.examples.push({ text: el.raw, formula: opFormula(c) });
        el.formula = opFormula(c);
        el.nodeId = id;
        el.blockIds = [...new Set(c.inputs.map((i) => i.binding).filter(Boolean))].map((b) => 'block:' + b);
        n.dsNames.forEach((ds) => addEdge('ds:' + ds, id, 'logic'));
        addEdge(id, el.id, 'logic');
      } else if (el.cls === 'constant') {
        const id = 'const:' + el.match.name;
        addNode({ id, layer: 'logic', kind: 'constant', name: el.match.name, value: el.match.v, line: el.match.line });
        el.nodeId = id;
        el.blockIds = [];
        addEdge(id, el.id, 'const');
      } else if (el.cls === 'axis') {
        const id = 'axis:' + (el.group || 'x');
        addNode({ id, layer: 'logic', kind: 'axis', group: el.group, count: 0 });
        nodes.get(id).count++;
        el.nodeId = id;
        el.blockIds = [];
        addEdge(id, el.id, 'axis');
      } else {
        el.blockIds = [];
      }
      if (el.nodeId) el.chain.add(el.nodeId);
      if (el.cls === 'computed' && nodes.get(el.nodeId)) nodes.get(el.nodeId).dsNames.forEach((d) => el.chain.add('ds:' + d));
      if (el.nodeId && el.nodeId.startsWith('ds:')) {
        const dsN = nodes.get(el.nodeId);
        if (dsN && dsN.def) (dsN.def.selectors || []).forEach((s) => { el.chain.add('filter:' + s.binding); el.chain.add('block:' + s.binding); });
      }
      upClosure(el.blockIds).forEach((id) => el.chain.add(id));
      el.blockIds.forEach((b) => { const bn = nodes.get(b); if (bn) bn.visible++; });
    });

    // reach: does the block reach the frame through a computed value?
    elements.forEach((el) => el.blockIds.forEach((b) => { const bn = nodes.get(b); if (bn && el.cls === 'computed') bn.viaComputed = true; }));

    const counts = { direct: 0, label: 0, computed: 0, constant: 0, axis: 0, untraced: 0, zero: 0 };
    elements.forEach((e) => { counts[e.cls] = (counts[e.cls] || 0) + 1; });
    const numbers = elements.filter((e) => e.cls !== 'label' && e.cls !== 'axis' && e.cls !== 'zero');
    const traced = numbers.filter((e) => e.cls === 'direct' || e.cls === 'computed').length;
    const stats = {
      counts,
      numbers: numbers.length,
      traced,
      coverage: numbers.length ? traced / numbers.length : 1,
      blocks: [...nodes.values()].filter((n) => n.layer === 'blocks').length,
      unseenBlocks: [...nodes.values()].filter((n) => n.layer === 'blocks' && !n.visible).length,
      upstream: [...nodes.values()].filter((n) => n.layer === 'upstream').length,
    };
    return { nodes, edges, elements, stats, code, active, snap };
  };

  /* ---------- Diff helpers ---------- */
  E.diffLines = function (a, b) {
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let suf = 0;
    while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    const A = a.slice(pre, a.length - suf), B = b.slice(pre, b.length - suf);
    const ops = [];
    for (let i = 0; i < pre; i++) ops.push({ t: '=', a: i, b: i, s: a[i] });
    const n = A.length, m = B.length;
    if (n * m > 4e6) {
      A.forEach((s, i) => ops.push({ t: '-', a: pre + i, s }));
      B.forEach((s, j) => ops.push({ t: '+', b: pre + j, s }));
    } else {
      const W = m + 1;
      const L = new Uint32Array((n + 1) * W);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (A[i] === B[j]) { ops.push({ t: '=', a: pre + i, b: pre + j, s: A[i] }); i++; j++; }
        else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { ops.push({ t: '-', a: pre + i, s: A[i] }); i++; }
        else { ops.push({ t: '+', b: pre + j, s: B[j] }); j++; }
      }
      while (i < n) { ops.push({ t: '-', a: pre + i, s: A[i] }); i++; }
      while (j < m) { ops.push({ t: '+', b: pre + j, s: B[j] }); j++; }
    }
    for (let k = 0; k < suf; k++) ops.push({ t: '=', a: a.length - suf + k, b: b.length - suf + k, s: a[a.length - suf + k] });
    return ops;
  };

  E.diffSnapshots = function (A, B, gA, gB) {
    const blocksOf = (s) => new Map((s.bindings || []).map((b) => [b.name, E.blockMeta(s, b.name)]));
    const ba = blocksOf(A), bb = blocksOf(B);
    const blocks = { added: [], removed: [], changed: [] };
    bb.forEach((m, k) => { if (!ba.has(k)) blocks.added.push(m); else if ((ba.get(k).formula || '') !== (m.formula || '')) blocks.changed.push({ before: ba.get(k), after: m }); });
    ba.forEach((m, k) => { if (!bb.has(k)) blocks.removed.push(m); });
    const sig = (d) => JSON.stringify({ v: d.values, l: d.labels, s: d.selectors });
    const da = new Map((A.dataSources || []).map((d) => [d.name, d])), db = new Map((B.dataSources || []).map((d) => [d.name, d]));
    const ds = { added: [], removed: [], changed: [] };
    db.forEach((d, k) => { if (!da.has(k)) ds.added.push(d); else if (sig(da.get(k)) !== sig(d)) ds.changed.push({ before: da.get(k), after: d }); });
    da.forEach((d, k) => { if (!db.has(k)) ds.removed.push(d); });
    const la = String(A.code || '').split('\n'), lb = String(B.code || '').split('\n');
    const ops = E.diffLines(la, lb);
    const code = { ops, added: ops.filter((o) => o.t === '+').length, removed: ops.filter((o) => o.t === '-').length };
    const hard = (g) => (g ? g.elements.filter((e) => e.cls === 'constant').map((e) => e.match.name + ' → ' + e.raw) : []);
    return { blocks, ds, code, coverage: [gA ? gA.stats.coverage : null, gB ? gB.stats.coverage : null], hardcoded: [hard(gA), hard(gB)], numbers: [gA ? gA.stats.numbers : null, gB ? gB.stats.numbers : null] };
  };
})();
