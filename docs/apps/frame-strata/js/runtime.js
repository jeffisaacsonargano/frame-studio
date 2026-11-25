/* Framecraft — frame runtime.
   Replays a Pigment Frame's own JavaScript in a sandboxed iframe (allow-scripts, opaque
   origin, like Pigment's host) against a PigmentSDK stand-in that serves the snapshot. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});

  /* This function is serialized into the iframe. Keep it self-contained ES2015. */
  function strataShim() {
    var P = window.__STRATA_PAYLOAD || { data: {}, items: {} };
    var FID = P.fid;
    function post(msg) { msg.src = 'strata'; msg.fid = FID; try { parent.postMessage(msg, '*'); } catch (e) {} }
    function fkey(filters) {
      if (!filters || !filters.length) return '';
      return filters.filter(function (f) { return f && f.binding && f.selection && f.selection.length; })
        .map(function (f) { return f.binding + '=' + f.selection.map(String).slice().sort().join(','); }).sort().join(';');
    }
    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function reportErr(e) { post({ type: 'error', message: String(e && e.message || e), stack: String(e && e.stack || '').slice(0, 600) }); }
    var subId = 0, subs = {};
    function lookup(name, filters) {
      var d = P.data[name];
      if (!d) return null;
      var k = fkey(filters);
      if (!k) return { data: d.default, key: '', exact: true };
      if (d.filters && d.filters[k]) return { data: d.filters[k], key: k, exact: true };
      return { data: d.default, key: '', exact: false, wanted: k };
    }
    function loadingShape(d) {
      return { rows: d.rows.map(function (r) { return { labels: r.labels.map(function () { return { kind: 'loading' }; }), values: r.values.map(function () { return { kind: 'loading' }; }) }; }), rowOffset: 0, totalRowCount: d.totalRowCount };
    }
    function deliver(s) {
      var res = lookup(s.name, s.filters);
      var gen = ++s.gen;
      if (!res) {
        setTimeout(function () { post({ type: 'dsMissing', sub: s.id, name: s.name }); if (s.opts.onError) s.opts.onError({ message: "Data source '" + s.name + "' isn't in this snapshot." }); }, 20);
        return;
      }
      setTimeout(function () { if (s.dead || gen !== s.gen) return; try { s.opts.onData(loadingShape(res.data)); } catch (e) { reportErr(e); } }, 10);
      setTimeout(function () {
        if (s.dead || gen !== s.gen) return;
        post({ type: 'delivered', sub: s.id, name: s.name, key: res.key, exact: res.exact, wanted: res.wanted || null, filters: s.filters });
        try { s.opts.onData(clone(res.data)); } catch (e) { reportErr(e); }
        scheduleScan(140);
      }, 50 + s.id * 30);
    }
    function safeArgs(args) { try { return JSON.parse(JSON.stringify(Array.prototype.slice.call(args))); } catch (e) { return []; } }
    window.PigmentSDK = {
      subscribeToDataSource: function (name, opts) {
        opts = opts || {};
        var s = { id: ++subId, name: String(name), opts: opts, filters: opts.dynamicFilters || [], gen: 0 };
        subs[s.id] = s;
        post({ type: 'subscribe', sub: s.id, name: s.name, filters: s.filters });
        deliver(s);
        return {
          updateDynamicFilters: function (f) { s.filters = f || []; post({ type: 'filters', sub: s.id, name: s.name, filters: s.filters }); deliver(s); },
          updateScroll: function () { deliver(s); },
          unsubscribe: function () { s.dead = true; delete subs[s.id]; post({ type: 'unsubscribe', sub: s.id }); }
        };
      },
      subscribeToItems: function (alias, opts) {
        opts = opts || {};
        var items = (P.items || {})[alias], dead = false;
        post({ type: 'items', alias: String(alias), found: !!items });
        setTimeout(function () {
          if (dead) return;
          if (!items) { if (opts.onError) opts.onError({ message: "List '" + alias + "' isn't in this snapshot." }); return; }
          try { opts.onData({ items: items.slice(), partialResult: false }); } catch (e) { reportErr(e); }
          scheduleScan(140);
        }, 40);
        return { unsubscribe: function () { dead = true; } };
      },
      subscribeToVizualization: function (alias, opts) {
        opts = opts || {};
        post({ type: 'legacy', alias: String(alias) });
        setTimeout(function () { if (opts.onError) opts.onError({ message: 'Legacy View subscriptions are not replayed in Framecraft.' }); }, 20);
        return { unsubscribe: function () {}, updatePageDefinitions: function () {}, updateScroll: function () {} };
      },
      addItem: function (alias, values) {
        post({ type: 'write', op: 'addItem', args: safeArgs(arguments), simulated: !!P.simulate });
        if (P.simulate && P.items) { (P.items[alias] = P.items[alias] || []).push(String(values && (values.Name || values.name || values[Object.keys(values)[0]]) || 'Item')); }
        return Promise.resolve();
      },
      editItem: function () { post({ type: 'write', op: 'editItem', args: safeArgs(arguments), simulated: !!P.simulate }); return Promise.resolve(); },
      editValue: function (alias, coords, value) {
        post({ type: 'write', op: 'editValue', args: safeArgs(arguments), simulated: !!P.simulate });
        if (P.simulate) simEditValue(String(alias), coords || {}, value);
        return Promise.resolve();
      }
    };

    /* Write simulation: when the explorer runs a frame with editing turned on, an editValue
       changes the snapshot the way Pigment would (leaf cell set, the All total moves by the
       same delta) and every subscription on that data source receives the new rows. */
    function simEditValue(alias, coords, value) {
      var changed = [];
      (P.defs || []).forEach(function (d) {
        var vi = -1;
        (d.values || []).forEach(function (v, i) { if (v.binding === alias) vi = i; });
        var entry = P.data[d.name];
        if (vi < 0 || !entry) return;
        var lab = d.labels && d.labels[0] ? d.labels[0].binding : null;
        var labVal = lab ? coords[lab] : null;
        var sel = (d.selectors || []).map(function (x) { return x.binding; });
        var key = sel.filter(function (b) { return coords[b] != null; }).map(function (b) { return b + '=' + coords[b]; }).sort().join(';');
        function rowsOf(set) { return (set && set.rows) || []; }
        function match(r) { return !lab || String(r.labels[0]) === String(labVal); }
        if (key && entry.filters && entry.filters[key]) {
          var old = null;
          rowsOf(entry.filters[key]).forEach(function (r) { if (match(r)) { old = r.values[vi]; r.values[vi] = value; } });
          var delta = typeof value === 'number' && typeof old === 'number' ? value - old : null;
          if (delta != null) rowsOf(entry.default).forEach(function (r) { if (match(r) && typeof r.values[vi] === 'number') r.values[vi] += delta; });
        } else {
          rowsOf(entry.default).forEach(function (r) { if (match(r)) r.values[vi] = value; });
        }
        changed.push(d.name);
      });
      if (changed.length) Object.keys(subs).forEach(function (id) { var s = subs[id]; if (changed.indexOf(s.name) >= 0) deliver(s); });
    }

    var tuning = P.tuning || null, tuneSubs = [];
    window.StrataTuning = {
      get: function () { return tuning ? clone(tuning) : { color: 0.5, detail: 0.5, horizon: 0.5, specificity: 0.5, audience: 0.5, emphasis: 0.5, certainty: 0, round: 0.5, depth: 0.5, space: 0.5, precision: 0.5, alert: 0, headline: '', hide: [], highlights: [] }; },
      subscribe: function (fn) { tuneSubs.push(fn); return function () { tuneSubs = tuneSubs.filter(function (x) { return x !== fn; }); }; }
    };

    /* canvas text capture */
    var canvasTexts = new Map();
    try {
      var proto = CanvasRenderingContext2D.prototype, origFill = proto.fillText, origClear = proto.clearRect;
      proto.fillText = function (text, x, y) {
        try {
          var c = this.canvas, list = canvasTexts.get(c);
          if (!list) { list = []; canvasTexts.set(c, list); }
          var m = this.getTransform(), p = m.transformPoint(new DOMPoint(x, y));
          var w = this.measureText(String(text)).width * Math.abs(m.a || 1);
          var fs = parseFloat((this.font || '10px').match(/(\d+(?:\.\d+)?)px/) ? RegExp.$1 : 10) * Math.abs(m.d || 1);
          var al = this.textAlign;
          var left = al === 'center' ? p.x - w / 2 : (al === 'right' || al === 'end') ? p.x - w : p.x;
          list.push({ text: String(text), x: left, y: p.y - fs * 0.8, w: w, h: fs });
          if (list.length > 2000) list.splice(0, 1000);
          scheduleScan(160);
        } catch (e) {}
        return origFill.apply(this, arguments);
      };
      proto.clearRect = function (x, y, w, h) {
        try { var c = this.canvas; if (w * h >= c.width * c.height * 0.9) canvasTexts.set(c, []); } catch (e) {}
        return origClear.apply(this, arguments);
      };
    } catch (e) {}

    var ids = new WeakMap(), nextId = 1;
    function idFor(n) { var id = ids.get(n); if (!id) { id = 't' + (nextId++); ids.set(n, id); } return id; }
    var scanTimer = null;
    function scheduleScan(ms) { clearTimeout(scanTimer); scanTimer = setTimeout(scan, ms || 120); }
    function scan() {
      if (!document.body) return;
      var items = [], svgIdx = new Map(), svgCount = 0;
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var n, vw = window.innerWidth, vh = window.innerHeight;
      if (!vw || !vh) { scheduleScan(250); return; } // not laid out yet (e.g. host still sizing): try again shortly
      while ((n = walker.nextNode())) {
        var t = n.nodeValue;
        if (!t) continue;
        t = t.replace(/\s+/g, ' ').trim();
        if (!t || t.length > 140) continue;
        var el = n.parentElement;
        if (!el) continue;
        var tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'title' || tag === 'option') continue;
        if (el.closest && el.closest('[data-strata-ignore]')) continue;
        var range = document.createRange();
        range.selectNodeContents(n);
        var r = range.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) continue;
        var cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
        var svg = el.closest ? el.closest('svg') : null, group = null;
        if (svg) { if (!svgIdx.has(svg)) svgIdx.set(svg, 'svg' + (++svgCount)); group = svgIdx.get(svg); }
        var ctxEl = el.closest('tr, li') || (el.parentElement && el.parentElement.parentElement) || el;
        var ctx = svg ? '' : (ctxEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220);
        items.push({ id: idFor(n), text: t, x: r.left, y: r.top, w: r.width, h: r.height, tag: tag, cls: String(el.getAttribute('class') || '').slice(0, 60), group: group, ctx: ctx });
      }
      var ci = 0;
      canvasTexts.forEach(function (list, c) {
        if (!c.isConnected) return;
        ci++;
        var rect = c.getBoundingClientRect(), sx = rect.width / (c.width || 1), sy = rect.height / (c.height || 1);
        list.forEach(function (ct, k) {
          var t2 = ct.text.replace(/\s+/g, ' ').trim();
          if (!t2) return;
          items.push({ id: 'c' + ci + '_' + k, text: t2, x: rect.left + ct.x * sx, y: rect.top + ct.y * sy, w: Math.max(4, ct.w * sx), h: Math.max(6, ct.h * sy), tag: 'canvas', cls: '', group: 'canvas' + ci, ctx: '' });
        });
      });
      post({ type: 'scan', items: items, vw: vw, vh: vh, sh: document.documentElement.scrollHeight });
    }
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.strata !== 1) return;
      if (d.type === 'tuning') { tuning = d.tuning; tuneSubs.forEach(function (fn) { try { fn(clone(tuning)); } catch (err) { reportErr(err); } }); scheduleScan(200); }
      if (d.type === 'rescan') scheduleScan(10);
    });
    window.addEventListener('error', function (e) { post({ type: 'error', message: e.message, line: e.lineno }); });
    window.addEventListener('unhandledrejection', function (e) { post({ type: 'error', message: 'Unhandled promise: ' + String(e.reason && e.reason.message || e.reason) }); });
    window.addEventListener('scroll', function () { scheduleScan(60); }, true);
    window.addEventListener('resize', function () { scheduleScan(120); });
    document.addEventListener('DOMContentLoaded', function () {
      try { new MutationObserver(function () { scheduleScan(160); }).observe(document.body, { subtree: true, childList: true, characterData: true }); } catch (e) {}
      post({ type: 'ready' });
      scheduleScan(400);
    });
  }

  const hosts = new Map();
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.src !== 'strata') return;
    const h = hosts.get(d.fid);
    if (h && h.iframe && e.source === h.iframe.contentWindow) h._onMessage(d);
  });

  class FrameHost {
    constructor(container, opts) {
      this.container = container;
      this.opts = opts || {};
      this.iframe = null;
      this.fid = null;
      this.reset();
    }
    reset() {
      this.subs = new Map();
      this.itemsAliases = new Set();
      this.writes = [];
      this.errors = [];
      this.legacy = [];
      this.scan = null;
      this.ready = false;
    }
    load(snap, tuning, size, extra) {
      if (this.fid) hosts.delete(this.fid);
      if (this.iframe) this.iframe.remove();
      this.reset();
      extra = extra || {};
      this.fid = 'f' + Math.random().toString(36).slice(2, 10);
      hosts.set(this.fid, this);
      const W = (size && size.w) || 1280, H = (size && size.h) || 800;
      const data = Object.assign({}, JSON.parse(JSON.stringify(snap.data || {})), extra.data || {});
      const items = Object.assign({}, JSON.parse(JSON.stringify(snap.items || {})), extra.items || {});
      const payload = JSON.stringify({ fid: this.fid, data, items, tuning: tuning || null, defs: extra.defs || snap.dataSources || [], simulate: !!extra.simulate }).replace(/</g, '\\u003c');
      const code = String(snap.code || '').replace(/<\/script/gi, '<\\/script');
      const prefix = extra.prefix ? String(extra.prefix).replace(/<\/script/gi, '<\\/script') : '';
      this.prefixLines = prefix ? prefix.split('\n').length : 0;
      this.hiddenDs = new Set(extra.hideDs || []);
      const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html,body{margin:0;padding:0;height:100%;background:#fff}</style></head><body><div id="app"></div>' +
        '<script>window.__STRATA_PAYLOAD=' + payload + ';<\/script><script>(' + strataShim.toString() + ')();<\/script>' + (prefix ? '<script>' + prefix + '\n<\/script>' : '') + '<script>' + code + '\n<\/script></body></html>';
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts');
      f.setAttribute('title', (snap.frame && snap.frame.name) || 'Frame');
      f.setAttribute('tabindex', '-1');
      f.style.cssText = 'width:' + W + 'px;height:' + H + 'px;border:0;display:block;background:#fff;';
      f.srcdoc = doc;
      this.iframe = f;
      this.container.appendChild(f);
    }
    send(msg) {
      if (!this.iframe || !this.iframe.contentWindow) return;
      try { this.iframe.contentWindow.postMessage(Object.assign({ strata: 1 }, msg), '*'); } catch (e) {}
    }
    setTuning(t) { this.send({ type: 'tuning', tuning: t }); }
    rescan() { this.send({ type: 'rescan' }); }
    _onMessage(d) {
      if (this.hiddenDs && d.name && this.hiddenDs.has(d.name) && (d.type === 'subscribe' || d.type === 'delivered' || d.type === 'filters' || d.type === 'dsMissing')) return;
      switch (d.type) {
        case 'ready': this.ready = true; break;
        case 'subscribe': this.subs.set(d.sub, { name: d.name, filters: d.filters || [], key: S.engine.filterKey(d.filters), exact: true }); break;
        case 'filters': { const s = this.subs.get(d.sub); if (s) { s.filters = d.filters || []; } break; }
        case 'delivered': { const s = this.subs.get(d.sub) || { name: d.name }; s.key = d.key; s.exact = d.exact; s.wanted = d.wanted; s.filters = d.filters || s.filters || []; s.delivered = true; this.subs.set(d.sub, s); break; }
        case 'dsMissing': { const s = this.subs.get(d.sub); if (s) s.missing = true; break; }
        case 'unsubscribe': { const s = this.subs.get(d.sub); if (s) s.dead = true; break; }
        case 'items': this.itemsAliases.add(d.alias); break;
        case 'legacy': this.legacy.push(d.alias); break;
        case 'write': this.writes.push({ op: d.op, args: d.args, at: Date.now(), simulated: !!d.simulated }); break;
        case 'error': if (d.line && this.prefixLines && d.line > this.prefixLines) d.line -= this.prefixLines; this.errors.push({ message: d.message, line: d.line, at: Date.now() }); break;
        case 'scan': this.scan = d; break;
      }
      if (this.opts.onMessage) this.opts.onMessage(d, this);
    }
    destroy() { if (this.fid) hosts.delete(this.fid); if (this.iframe) this.iframe.remove(); this.iframe = null; }
  }
  S.FrameHost = FrameHost;
})();
