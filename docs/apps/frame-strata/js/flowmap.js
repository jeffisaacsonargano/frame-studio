/* Framecraft — Blockflow layer.
   A model map drawn on its own plane, far beneath the other strata: every block behind
   this frame (bound and upstream), laid out left to right from sources to the frame,
   in Blockflow's block colours. Off by default; turned on from the Layers dock. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const W = 1280, H = 800, PAD_X = 60, PAD_TOP = 92, PAD_BOT = 60, NW = 176, NH = 44;
  const KIND = {
    'Dimension': { c: 'var(--c-list)', short: 'Dimension' },
    'Transaction list': { c: 'var(--c-tx)', short: 'Transaction list' },
    'Metric': { c: 'var(--c-metric)', short: 'Metric' },
    'Table': { c: 'var(--c-table)', short: 'Table' },
    'Frame': { c: 'var(--accent)', short: 'Frame' },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function graphOf(snap) {
    const nodes = new Map();
    Object.entries(snap.blocks || {}).forEach(([k, m]) => nodes.set(k, { key: k, id: 'block:' + k, name: m.name || k, kind: m.kind || 'Metric', deps: (m.upstream || []).slice(), bound: true }));
    Object.entries(snap.upstream || {}).forEach(([k, m]) => { if (!nodes.has(k)) nodes.set(k, { key: k, id: 'up:' + k, name: m.name || k, kind: m.kind || 'Metric', deps: (m.upstream || []).slice(), bound: false }); });
    nodes.forEach((n) => { n.deps = n.deps.filter((d) => nodes.has(d)); });
    const frameDeps = [...nodes.values()].filter((n) => n.bound && n.kind !== 'Dimension').map((n) => n.key);
    nodes.set('__frame', { key: '__frame', id: null, name: (snap.frame && snap.frame.name) || 'Frame', kind: 'Frame', deps: frameDeps, bound: true });
    const memo = new Map();
    const depth = (k, seen) => {
      if (memo.has(k)) return memo.get(k);
      const n = nodes.get(k); seen = seen || new Set();
      if (!n || seen.has(k)) return 0;
      seen.add(k);
      const d = n.deps.length ? 1 + Math.max(...n.deps.map((x) => depth(x, seen))) : 0;
      memo.set(k, d); return d;
    };
    nodes.forEach((n, k) => { n.depth = depth(k); });
    // dimensions sit in the first column with the sources
    nodes.forEach((n) => { if (n.kind === 'Dimension' && !n.deps.length) n.depth = 0; });
    return nodes;
  }

  function layout(nodes) {
    const cols = new Map();
    nodes.forEach((n) => { if (!cols.has(n.depth)) cols.set(n.depth, []); cols.get(n.depth).push(n); });
    const depths = [...cols.keys()].sort((a, b) => a - b);
    const order = { 'Transaction list': 0, 'Table': 1, 'Dimension': 2, 'Metric': 3, 'Frame': 4 };
    const span = W - PAD_X * 2 - NW;
    depths.forEach((d, ci) => {
      const list = cols.get(d).sort((a, b) => (order[a.kind] - order[b.kind]) || a.name.localeCompare(b.name));
      const x = PAD_X + (depths.length > 1 ? (span * ci) / (depths.length - 1) : span / 2);
      const avail = H - PAD_TOP - PAD_BOT;
      const step = Math.min(NH + 18, avail / Math.max(1, list.length));
      const top = PAD_TOP + (avail - step * list.length) / 2;
      list.forEach((n, i) => { n.x = x; n.y = top + i * step + (step - NH) / 2; });
    });
    return depths.map((d) => cols.get(d));
  }

  function colTitle(list) {
    if (list.some((n) => n.kind === 'Frame')) return 'Frame';
    const kinds = [...new Set(list.map((n) => n.kind))];
    if (kinds.length === 1) return kinds[0] === 'Transaction list' ? 'Imports' : kinds[0] + 's';
    if (list.every((n) => !n.deps.length)) return 'Sources and lists';
    return 'Calculations';
  }

  S.flowmap = {
    render(plane, snap, onPick) {
      if (!plane) return;
      const host = plane.querySelector('.flowmap');
      const nodes = graphOf(snap);
      const cols = layout(nodes);
      let svg = '<svg class="fm-links" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">';
      nodes.forEach((n) => n.deps.forEach((k) => {
        const a = nodes.get(k); if (!a) return;
        const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = n.x, y2 = n.y + NH / 2, mx = (x1 + x2) / 2;
        svg += '<path d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" stroke="' + (KIND[a.kind] || KIND.Metric).c + '"/>';
      }));
      svg += '</svg>';
      let html = svg;
      cols.forEach((list) => { const n0 = list[0]; html += '<div class="fm-col" style="left:' + n0.x + 'px;width:' + NW + 'px">' + esc(colTitle(list)) + '</div>'; });
      nodes.forEach((n) => {
        const k = KIND[n.kind] || KIND.Metric;
        html += '<button type="button" class="fm-node' + (n.bound ? ' bound' : '') + (n.kind === 'Frame' ? ' frame' : '') + '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + NW + 'px;height:' + NH + 'px;--k:' + k.c + '"' + (n.id ? ' data-fm="' + esc(n.id) + '"' : '') + ' title="' + esc(n.name + ' · ' + n.kind + (n.bound ? ' · bound to the frame' : ' · upstream')) + '">' +
          '<i></i><span class="fm-name">' + esc(n.name) + '</span><span class="fm-kind">' + esc(k.short) + '</span></button>';
      });
      host.innerHTML = html;
      host.onclick = (e) => { const b = e.target.closest('[data-fm]'); if (b && onPick) onPick(b.dataset.fm); };
      const total = nodes.size - 1;
      const tag = plane.querySelector('.plane-tag');
      if (tag) tag.innerHTML = '<b>05</b> Blockflow <span>model map · ' + total + ' blocks behind this frame</span><button type="button" class="xlink fm-open" data-fm-open>Open Blockflow ↗</button>';
      return total;
    },
  };
})();
