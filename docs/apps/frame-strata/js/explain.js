/* Framecraft — "How this is calculated", for modelers who don't read JavaScript.
   Progressive disclosure in the Inspect pane: plain words first, then the worked numbers,
   the frame code that does it, the same thing as a Pigment formula, and any hardcoded values.
   Also the short "How frames compute" primer. Everything is derived from the snapshot, the
   replayed data and the frame code; where the code lookup is a best guess, it says so. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const E = () => S.engine;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const app = () => S.app;

  /* ---------- helpers ---------- */
  function meta(key) { const m = E().blockMeta(app().snap, key); return m || { key, name: key }; }
  function q(name) { return "'" + String(name).replace(/'/g, "\\'") + "'"; } // Pigment block reference
  function fmtV(v, key) {
    if (v == null || typeof v !== 'number') return '—';
    const m = key ? meta(key) : null;
    return m && m.format ? E().formatPigment(v, m.format) : (Math.abs(v) >= 1e5 ? E().formatPigment(v, { type: 'number', scale: 'auto', decimals: 2 }) : String(+v.toPrecision(6)));
  }
  function raw(v) { return typeof v === 'number' ? (Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(+v.toPrecision(6))) : String(v); }
  function activeOf(g, ds) { return (g.active || []).find((a) => a.name === ds) || null; }
  function filterWords(g, ds) {
    const a = activeOf(g, ds), def = a && a.def;
    if (!def || !def.selectors || !def.selectors.length) return '';
    return def.selectors.map((s) => { const f = (a.filters || []).find((x) => x.binding === s.binding); return meta(s.binding).name + ' = ' + (f && f.selection && f.selection.length ? f.selection.join(', ') : 'All'); }).join(', ');
  }
  function rowsDim(g, ds) { const a = activeOf(g, ds); const l = a && a.def && a.def.labels && a.def.labels[0]; return l ? meta(l.binding).name : null; }
  function cell(g, inp) {
    const a = activeOf(g, inp.ds);
    if (!a || !a.data) return null;
    const r = a.data.rows[inp.row];
    return r ? r.values[inp.col] : null;
  }
  function columnRows(g, inp) {
    const a = activeOf(g, inp.ds);
    if (!a || !a.data) return [];
    return a.data.rows.map((r) => ({ label: r.labels.filter((x) => typeof x === 'string').join(' · '), v: r.values[inp.col] })).filter((x) => typeof x.v === 'number');
  }
  function aggWords(g, ds, binding) {
    const a = activeOf(g, ds), def = a && a.def;
    const v = def && def.values.find((x) => x.binding === binding);
    const m = meta(binding);
    const shown = new Set((def ? def.labels : []).map((l) => meta(l.binding).name));
    const hidden = (m.dims || []).filter((d) => !shown.has(d));
    const agg = (v && v.aggregator) || m.aggregator || 'its default aggregator';
    return hidden.length ? agg + ' over ' + hidden.join(' and ') : 'no aggregation needed';
  }
  function sec(title, body, open) { return '<details class="how"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="how-body">' + body + '</div></details>'; }

  /* ---------- the frame code: find the lines that compute it ---------- */
  const STOP = new Set(['var', 'let', 'const', 'function', 'return', 'if', 'else', 'null', 'true', 'false', 'num', 'state', 'rows', 'values', 'labels', 'length', 'math', 'tofixed', 'push', 'join', 'esc', 'html', 'h', 'r', 'v', 'k', 'i', 'c', 'x', 'y', 'p', 'a', 'b', 'f', 'e', 'd', 'n', 't', 'w', 's']);
  function words(key) {
    const m = meta(key);
    const out = new Set([String(key).toLowerCase()]);
    String(key).replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).forEach((w) => { if (w.length > 2) out.add(w.toLowerCase()); });
    String(m.name || '').split(/[^A-Za-z0-9]+/).forEach((w) => { if (w.length > 2) out.add(w.toLowerCase()); });
    return out;
  }
  function strip(line) { return line.replace(/\/\/.*$/, '').replace(/'(?:\\.|[^'])*'|"(?:\\.|[^"])*"/g, '""'); }
  /* identifiers declared from a values index, e.g. `var arr = num(k[0])` → arr: column 0 */
  function indexVars(lines) {
    const map = new Map();
    lines.forEach((ln, i) => {
      const re = /([A-Za-z_$][\w$]*)\s*=\s*(?:num\(\s*)?([\w$.]+)\[(\d+)\]\)?/g;
      let m;
      while ((m = re.exec(strip(ln)))) if (!map.has(m[1]) && !/labels$/i.test(m[2])) map.set(m[1], { col: +m[3], line: i + 1 });
    });
    return map;
  }
  const OPCH = { ratio: /[^/*]\/[^/*]/, pct: /[^/*]\/[^/*]/, csum: /[^/*]\/[^/*]/, avg: /[^/*]\/[^/*]|reduce/, weighted: /\*/, diff: /\s-\s|-=/, rowdiff: /\s-\s/, rowpct: /[^/*]\/[^/*]/, add: /\s\+\s/, sum: /\+=|reduce|\s\+\s/, min: /Math\.min/, max: /Math\.max/, count: /\.length/ };
  function findCode(g, el) {
    const code = String(app().snap.code || '');
    const lines = code.split('\n');
    const c = el.match || {};
    const inputs = c.inputs || (c.binding ? [{ binding: c.binding, ds: c.ds, col: c.col }] : []);
    const idx = indexVars(lines);
    const want = new Set(); inputs.forEach((inp) => words(inp.binding).forEach((w) => want.add(w)));
    const cols = new Set(inputs.map((i) => i.col));
    const opRe = OPCH[c.op];
    const consts = (app().code.constants || []).map((k) => k.name);
    const scored = [];
    lines.forEach((ln, i) => {
      const s = strip(ln);
      if (!s.trim() || s.length > 260) return;
      let score = 0;
      const ids = s.match(/[A-Za-z_$][\w$]*/g) || [];
      const hit = new Set();
      ids.forEach((id) => {
        const lo = id.toLowerCase();
        if (STOP.has(lo)) return;
        if (want.has(lo) && !hit.has(lo)) { score += lo.length > 4 ? 3 : 2; hit.add(lo); }
        const iv = idx.get(id);
        if (iv && cols.has(iv.col) && !hit.has(id)) { score += 3; hit.add(id); }
      });
      if (opRe && opRe.test(' ' + s + ' ')) score += hit.size ? 3 : 0;
      if (/innerHTML|\.push\(\s*['"]</.test(ln) || /['"]<\w/.test(ln)) return; // markup, not maths
      if (/=\s*num\(/.test(s) && !(opRe && opRe.test(s))) score -= 1;
      if (score >= 6 && hit.size >= (inputs.length > 1 ? 2 : 1)) scored.push({ i: i + 1, score });
    });
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    const pick = scored.slice(0, 2).map((x) => x.i);
    // add the declarations of the variables those lines use
    const decl = new Set();
    pick.forEach((ln) => (strip(lines[ln - 1]).match(/[A-Za-z_$][\w$]*/g) || []).forEach((id) => { const iv = idx.get(id); if (iv && iv.line !== ln) decl.add(iv.line); }));
    const all = [...new Set([...decl].slice(0, 2).concat(pick))].sort((a, b) => a - b);
    // annotate identifiers
    const notes = new Map();
    all.forEach((ln) => (strip(lines[ln - 1]).match(/[A-Za-z_$][\w$]*/g) || []).forEach((id) => {
      if (notes.has(id)) return;
      const iv = idx.get(id);
      const inp = iv && inputs.find((x) => x.col === iv.col);
      if (inp) { const v = inp.row != null ? cell(g, inp) : null; notes.set(id, meta(inp.binding).name + ' (' + inp.ds + ', column ' + (inp.col + 1) + ')' + (v != null ? ' = ' + fmtV(v, inp.binding) : '')); return; }
      const byName = inputs.find((x) => String(x.binding).toLowerCase() === id.toLowerCase());
      if (byName) { notes.set(id, meta(byName.binding).name + ' from ' + byName.ds); return; }
      const k = (app().code.constants || []).find((x) => x.name === id);
      if (k) notes.set(id, 'hardcoded ' + k.raw + ' (line ' + k.line + ')');
    }));
    // constants on these lines, or compared with the result further down (e.g. coverage >= TARGET_COVERAGE)
    const result = pick.map((ln) => (strip(lines[ln - 1]).match(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/) || [])[1]).filter(Boolean);
    const usedConsts = consts.filter((n) => {
      const re = new RegExp('\\b' + n + '\\b');
      if (all.some((ln) => re.test(lines[ln - 1]))) return true;
      return result.some((r) => lines.some((ln) => re.test(ln) && new RegExp('\\b' + r + '\\b').test(ln)));
    });
    return { lines: all.map((n) => ({ n, text: lines[n - 1] })), notes, usedConsts, sure: pick.length > 0 && scored[0].score >= 9 };
  }
  const KW = /^(var|let|const|function|return|if|else|for|while|new|null|true|false|typeof|this|of|in)$/;
  function highlight(line, notes) {
    const re = /(\/\/.*$)|('(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([^\w\s]+)|(\s+)/g;
    let out = '', m;
    while ((m = re.exec(line))) {
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2].length > 60 ? m[2].slice(0, 57) + '…' + m[2].slice(-1) : m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-n">' + esc(m[3]) + '</span>';
      else if (m[4]) out += KW.test(m[4]) ? '<span class="tk-k">' + esc(m[4]) + '</span>' : notes && notes.has(m[4]) ? '<span class="tk-v" title="' + esc(notes.get(m[4])) + '">' + esc(m[4]) + '</span>' : esc(m[4]);
      else out += esc(m[5] || m[6] || '');
    }
    return out;
  }
  function codeSection(found, emptyText) {
    if (!found.lines.length) return '<p>' + esc(emptyText || 'This explorer could not pin the calculation to specific lines. It happens in the frame’s render code.') + '</p><button type="button" class="btn btn-sm" data-act="code-line" data-line="1">Open the Code tab</button>';
    let h = (found.sure ? '' : '<p class="muted small">Best match from reading the code; check it in the Code tab.</p>');
    h += '<div class="how-code">' + found.lines.map((l) => '<button type="button" class="hc-line" data-act="code-line" data-line="' + l.n + '" title="Show line ' + l.n + ' in the Code tab"><span class="ln">' + l.n + '</span><span class="lc">' + highlight(l.text.trim().slice(0, 220), found.notes) + '</span></button>').join('') + '</div>';
    if (found.notes.size) h += '<dl class="how-vars">' + [...found.notes].map(([k, v]) => '<dt><code>' + esc(k) + '</code></dt><dd>' + esc(v) + '</dd>').join('') + '</dl>';
    return h;
  }

  /* ---------- per-calculation language ---------- */
  function plainComputed(g, el) {
    const c = el.match, [a, b] = c.inputs, A = meta(a.binding).name, B = b ? meta(b.binding).name : '';
    const dim = rowsDim(g, a.ds) || 'row';
    const after = ' after ' + (b ? 'both arrive' : 'it arrives') + ' from Pigment';
    const f = filterWords(g, a.ds);
    const ctx = (c.rowLabel ? ' for ' + c.rowLabel : '') + (f ? ' (' + f + ')' : '');
    const s = {
      ratio: 'The frame divides ' + A + ' by ' + B + ctx + after + '.',
      pct: 'The frame works out how much ' + A + ' differs from ' + B + ', as a percentage of ' + B + ctx + after + '.',
      diff: 'The frame subtracts ' + B + ' from ' + A + ctx + after + '.',
      add: 'The frame adds ' + A + ' and ' + B + ctx + after + '.',
      sum: 'The frame adds up ' + A + ' across the ' + a.n + ' ' + dim + ' rows it received' + (f ? ' (' + f + ')' : '') + '. Pigment did not send this total.',
      avg: 'The frame averages ' + A + ' across the ' + (a.n || '') + ' ' + dim + ' rows it received' + (f ? ' (' + f + ')' : '') + '.',
      min: 'The frame picks the smallest ' + A + ' among the ' + dim + ' rows it received.',
      max: 'The frame picks the largest ' + A + ' among the ' + dim + ' rows it received.',
      count: 'The frame counts the ' + dim + ' rows that have a ' + A + ' value.',
      csum: 'The frame totals ' + A + ' and ' + B + ' across ' + dim + ' rows, then divides one total by the other.',
      weighted: 'The frame averages ' + A + ' across ' + dim + ' rows, giving each row a weight equal to its ' + B + '. Pigment did not send this figure.',
      rowpct: 'The frame compares each ' + dim + ' with the one before it and shows the change in ' + A + ' as a percentage.',
      rowdiff: 'The frame subtracts each ' + dim + '’s ' + A + ' from the next one.',
    }[c.op];
    return s || 'The frame calculates this from ' + A + (B ? ' and ' + B : '') + '.';
  }
  function workedComputed(g, el) {
    const c = el.match, [a, b] = c.inputs;
    const v = (inp) => (inp.row != null ? cell(g, inp) : null);
    // when rounding makes the inputs look identical, show them unrounded
    const F0 = (x, key) => fmtV(x, key);
    const same = b && b.row != null && a.row != null && F0(cell(g, a), a.binding) === F0(cell(g, b), b.binding);
    const F = (x, key) => (same ? raw(x) : F0(x, key));
    const res = '= ' + raw(c.op === 'pct' || c.op === 'rowpct' ? c.v : c.v) + ' → shown as <b>' + esc(el.raw || el.text) + '</b>';
    const listSum = (inp, op) => {
      const rows = columnRows(g, inp);
      const parts = rows.slice(0, 8).map((r) => esc(r.label || '·') + ' ' + esc(F(r.v, inp.binding)));
      return parts.join(op) + (rows.length > 8 ? op + '… (' + rows.length + ' rows)' : '');
    };
    let h = '';
    switch (c.op) {
      case 'ratio': h = esc(meta(a.binding).name) + ' ' + esc(F(v(a), a.binding)) + ' ÷ ' + esc(meta(b.binding).name) + ' ' + esc(F(v(b), b.binding)) + ' ' + res; break;
      case 'pct': h = '(' + esc(F(v(a), a.binding)) + ' − ' + esc(F(v(b), b.binding)) + ') ÷ ' + esc(F(v(b), b.binding)) + ' ' + res; break;
      case 'diff': h = esc(F(v(a), a.binding)) + ' − ' + esc(F(v(b), b.binding)) + ' ' + res; break;
      case 'add': h = esc(F(v(a), a.binding)) + ' + ' + esc(F(v(b), b.binding)) + ' ' + res; break;
      case 'sum': h = listSum(a, ' + ') + ' ' + res; break;
      case 'avg': h = '(' + listSum(a, ' + ') + ') ÷ ' + (a.n || columnRows(g, a).length) + ' ' + res; break;
      case 'csum': h = 'Σ ' + esc(meta(a.binding).name) + ' ÷ Σ ' + esc(meta(b.binding).name) + ' ' + res; break;
      case 'weighted': {
        const A = columnRows(g, a), W = columnRows(g, b);
        h = A.slice(0, 6).map((r, i) => esc(F(r.v, a.binding)) + ' × ' + esc(F(W[i] ? W[i].v : null, b.binding))).join(' + ') + (A.length > 6 ? ' + …' : '') + '<br>÷ (' + W.slice(0, 6).map((r) => esc(F(r.v, b.binding))).join(' + ') + (W.length > 6 ? ' + …' : '') + ') ' + res;
        break;
      }
      case 'rowpct': h = '(' + esc(F(v(b), b.binding)) + ' − ' + esc(F(v(a), a.binding)) + ') ÷ ' + esc(F(v(a), a.binding)) + ' ' + res; break;
      case 'rowdiff': h = esc(F(v(b), b.binding)) + ' − ' + esc(F(v(a), a.binding)) + ' ' + res; break;
      default: h = esc(el.formula || '') ;
    }
    const f = filterWords(g, a.ds);
    return '<div class="how-math">' + h + '</div><p class="muted small">Values as the frame received them from <span class="mono">' + esc(a.ds) + '</span>' + (c.rowLabel ? ', row ' + esc(c.rowLabel) : '') + (f ? ', with ' + esc(f) : '') + '. Change the filter on the frame and these numbers change with it.</p>';
  }
  function pigmentComputed(g, el) {
    const c = el.match, [a, b] = c.inputs, A = q(meta(a.binding).name), B = b ? q(meta(b.binding).name) : '';
    const dimName = rowsDim(g, a.ds), D = dimName ? q(dimName) : "'Dimension'";
    const isTime = /month|week|quarter|year|period|day/i.test(dimName || '');
    const prev = (x) => x + '[SELECT: ' + (dimName ? dimName.replace(/'/g, '') : 'Month') + ' - 1]';
    const f = {
      ratio: A + ' / ' + B,
      pct: '(' + A + ' - ' + B + ') / ' + B,
      diff: A + ' - ' + B,
      add: A + ' + ' + B,
      sum: A + '[REMOVE SUM: ' + D + ']',
      avg: A + '[REMOVE AVG: ' + D + ']',
      min: A + '[REMOVE MIN: ' + D + ']',
      max: A + '[REMOVE MAX: ' + D + ']',
      count: A + '[REMOVE COUNT: ' + D + ']',
      csum: A + '[REMOVE SUM: ' + D + '] / ' + B + '[REMOVE SUM: ' + D + ']',
      weighted: '(' + A + ' * ' + B + ')[REMOVE SUM: ' + D + '] / ' + B + '[REMOVE SUM: ' + D + ']',
      rowpct: '(' + A + ' - ' + prev(A) + ') / ' + prev(A),
      rowdiff: A + ' - ' + prev(A),
    }[c.op];
    const twoBlocks = ['ratio', 'pct', 'diff', 'add'].includes(c.op);
    const rollup = ['sum', 'avg', 'min', 'max', 'count', 'csum', 'weighted'].includes(c.op);
    let why;
    if (twoBlocks) why = '<b>Better in the model.</b> As a metric it is one source of truth: Boards, other frames and exports all show the same number, access rights on both inputs apply to it, and it is auditable in Formula Studio. The frame would then just display it.';
    else if (rollup && c.op !== 'weighted' && c.op !== 'csum') why = '<b>Either works.</b> A display total is fine in the frame, or a View total does it with no formula. Move it into the model if people reuse the total, or if the frame might not receive every row (data sources send at most 1,000 rows per window), which would make a frame total quietly wrong.';
    else if (rollup) why = '<b>Better in the model.</b> Weighted and ratio-of-totals figures are easy to get subtly wrong. As a metric the aggregation is defined once and every report agrees; you can also set it as the metric’s aggregation so totals in Views stay correct.';
    else why = '<b>Better in the model.</b> Period-over-period logic is clearer with an explicit SELECT offset' + (isTime ? '' : ' on an ordered dimension') + ', and it keeps working across fiscal calendars and versions.';
    return '<div class="formula-box">' + esc(f || '') + '</div><p class="small">' + why + '</p><p class="muted small">A model calculation runs once in Pigment and is cached. A frame calculation runs in every viewer’s browser on every render; that is quick for small data but exists nowhere else.</p>';
  }
  function hardcoded(names) {
    const consts = (app().code.constants || []).filter((k) => names.includes(k.name));
    if (!consts.length) return '';
    return consts.map((k) => {
      const nice = k.name.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return '<p><code class="codebit">' + esc(k.name) + ' = ' + esc(k.raw) + '</code> is typed into the code on <button type="button" class="xlink" data-act="code-line" data-line="' + k.line + '">line ' + k.line + '</button>. It won’t follow the model when targets change.</p><p class="small"><b>Suggested replacement:</b> an input metric <span class="mono">' + esc(q(nice)) + '</span> (Number, no dimensions, or by Region if it differs), entered once in Pigment. Bind it, add it to a data source’s values, and read it like any other number. If viewers should adjust it themselves, a Variable works too.</p>';
    }).join('');
  }

  /* ---------- public ---------- */
  const X = (S.explain = {});
  X.element = function (g, el) {
    let h = '<div class="sec how-wrap"><div class="sec-title">How this is calculated</div>';
    if (el.cls === 'computed' && el.match && el.match.inputs) {
      const found = findCode(g, el);
      h += sec('In plain words', '<p>' + esc(plainComputed(g, el)) + '</p><p class="muted small">This number does not exist anywhere in Pigment. Only the frame knows it.</p>', true);
      h += sec('With real numbers', workedComputed(g, el));
      h += sec('The frame code', codeSection(found));
      h += sec('As a Pigment formula', pigmentComputed(g, el));
      const hc = hardcoded(found.usedConsts);
      if (hc) h += sec('Hardcoded values', hc);
    } else if (el.cls === 'direct' && el.match) {
      const m = meta(el.match.binding), f = filterWords(g, el.match.ds);
      const found = findCode(g, el);
      h += sec('In plain words', '<p>Comes straight from Pigment. The frame asks the <span class="mono">' + esc(el.match.ds) + '</span> data source for <b>' + esc(m.name) + '</b>' + (el.match.rowLabel ? ' for ' + esc(el.match.rowLabel) : '') + ' and prints it. Pigment does the maths (' + esc(aggWords(g, el.match.ds, el.match.binding)) + ')' + (f ? ' with ' + esc(f) : '') + '.</p>', true);
      h += sec('With real numbers', '<div class="how-math">' + esc(m.name) + ' = ' + esc(raw(el.match.v)) + ' → shown as <b>' + esc(el.raw || el.text) + '</b></div><p class="muted small">The frame only formats it' + (m.format ? ' (' + esc(E().describeFormat(m.format)) + ')' : '') + '. Rounding happens on screen; the full value stays in Pigment.</p>');
      h += sec('The frame code', codeSection(found, 'The frame reads this value from the data source and writes it into the page; no calculation is involved.'));
      h += sec('As a Pigment formula', m.formula ? '<div class="formula-box">' + esc(m.name) + ' = ' + esc(m.formula) + '</div><p class="small"><b>Already in the model.</b> Nothing to move.</p>' : m.input ? '<p class="small"><b>An input metric</b>: values are entered in Pigment, not calculated.</p>' : '<p class="small">This is a Pigment block; its formula isn’t in the snapshot.</p>');
    } else if (el.cls === 'constant' && el.match) {
      h += sec('In plain words', '<p>This value is typed into the frame’s code as <code class="codebit">' + esc(el.match.name) + '</code>. It never came from Pigment.</p>', true);
      const lines = String(app().snap.code || '').split('\n');
      h += sec('The frame code', codeSection({ lines: [{ n: el.match.line, text: lines[el.match.line - 1] || '' }], notes: new Map(), usedConsts: [], sure: true }));
      h += sec('Hardcoded values', hardcoded([el.match.name]), true);
    } else if (el.cls === 'label') {
      h += sec('In plain words', '<p>An item name from a Pigment dimension. The frame prints it as a label; there is no number to calculate.</p>', true);
    } else if (el.cls === 'axis') {
      h += sec('In plain words', '<p>A chart gridline value. The frame picks round numbers that fit the data range; it is not data.</p>', true);
    } else {
      h += sec('In plain words', '<p>This explorer could not tell where this number comes from. Check the Code tab or ask Claude.</p>', true);
    }
    return h + '</div>';
  };
  X.node = function (g, n) {
    if (n.kind === 'computed') {
      const el = g.elements.find((e) => e.nodeId === n.id && e.cls === 'computed');
      return el ? X.element(g, el) : '';
    }
    if (n.kind === 'constant') {
      const el = g.elements.find((e) => e.nodeId === n.id);
      if (el) return X.element(g, el);
      return '<div class="sec how-wrap"><div class="sec-title">How this is calculated</div>' + sec('Hardcoded values', hardcoded([n.name]), true) + '</div>';
    }
    if (n.kind === 'ds' && n.def) {
      const vals = n.def.values.map((v) => meta(v.binding).name + (v.aggregator ? ' (' + v.aggregator + ')' : '')).join(', ');
      const labs = n.def.labels.map((l) => meta(l.binding).name).join(', ');
      const sels = (n.def.selectors || []).map((s) => meta(s.binding).name).join(', ');
      const sub = (app().code.subscriptions || []).filter((s) => s.name === n.name);
      const lines = String(app().snap.code || '').split('\n');
      let h = '<div class="sec how-wrap"><div class="sec-title">How this works</div>';
      h += sec('In plain words', '<p>A data source is a request the frame sends to Pigment: give me <b>' + esc(vals) + '</b>' + (labs ? ', one row per <b>' + esc(labs) + '</b>' : ', as a single row') + (sels ? ', and let me filter by <b>' + esc(sels) + '</b>' : '') + '. Pigment aggregates before sending, so what arrives is already summed or averaged.</p>', true);
      h += sec('As a Pigment View', '<p class="small">It behaves like a View: <b>rows</b> ' + esc(labs || 'none') + ', <b>columns</b> ' + esc(vals) + (sels ? ', <b>page selector</b> ' + esc(sels) : '') + '. Each value uses its aggregator for every dimension that is not on the rows.</p>');
      if (sub.length) h += sec('The frame code', codeSection({ lines: sub.map((s) => ({ n: s.line, text: lines[s.line - 1] || '' })), notes: new Map(), usedConsts: [], sure: true }));
      return h + '</div>';
    }
    return '';
  };
  X.primer = function () {
    return '<details class="primer"><summary><span class="q">?</span> How frames compute</summary><div class="how-body">' +
      '<p><b>Frames run in the browser.</b> A frame is JavaScript. Pigment calculates the model, sends the frame its data, and the code then draws the page in each viewer’s browser.</p>' +
      '<p><b>Bindings and data sources.</b> A binding gives the frame permission to read a block. A data source is the request: which metrics as columns, which dimension as rows, and which dimensions it may filter by. Pigment aggregates everything else (Sum, Last, Avg…) before sending.</p>' +
      '<p><b>From Pigment vs computed in the frame.</b> Purple numbers arrive as Pigment calculated them; the frame only formats them. Teal numbers are worked out by the frame’s code from those values, such as a ratio, a variance or a total.</p>' +
      '<p><b>Frame calculations don’t exist in Pigment.</b> They aren’t stored, versioned, audited or available to Boards, exports or other frames, and access rights only apply to their inputs.</p>' +
      '<p><b>When to move logic into the model.</b> Do it when people rely on the number, reuse it, or need it governed. Keep in the frame only what is purely presentation: formatting, chart scales, and display totals.</p>' +
      '</div></details>';
  };
})();
