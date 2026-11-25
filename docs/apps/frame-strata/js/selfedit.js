/* Framecraft — self-edit kit.
   A prelude that runs inside a Pigment Frame, before the frame's own code. It adds an
   "Edit frame" button and a pop-out pane. Everything it does is allowed in a real Frame:
   DOM only, no network, no storage. Apply writes through the PigmentSDK:
     - display settings  -> editValue on a FRAME_CONFIG text metric (one cell per setting)
     - planning inputs   -> editValue on the input metric the frame already shows
     - change requests   -> addItem on a "Frame Change Requests" list, for Claude to build
   The frame redraws from its own subscriptions, so the change shows as soon as Pigment
   delivers the new values. In the explorer, writes are simulated against the snapshot. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});

  /* Serialized into the frame. Self-contained ES2015, no outer references. */
  function strataSelfEditKit(SE) {
    var SDK = window.PigmentSDK;
    if (!SDK || !document.body) return;
    var DEF = { color: 0.5, detail: 0.5, horizon: 0.5, specificity: 0.5, audience: 0.5, highlights: [] };
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    var saved = clone(DEF), draft = null, listeners = [];
    var st = { open: false, tab: SE.display ? 'display' : (SE.inputs.length ? 'plan' : 'request'), dirty: false, status: '', plan: {}, region: null, regions: [], rows: null, request: '', items: {} };

    if (SE.display) {
      window.StrataTuning = {
        get: function () { return clone(saved); },
        subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }
      };
      SDK.subscribeToDataSource(SE.config.dataSource, {
        onData: function (d) {
          var next = clone(saved), any = false;
          (d.rows || []).forEach(function (r) {
            var k = r.labels[0], v = r.values[0];
            if (typeof k !== 'string' || v == null || typeof v === 'object') return;
            any = true;
            if (k === 'highlights') next.highlights = String(v) ? String(v).split('|').filter(Boolean) : [];
            else if (k in DEF) { var n = parseFloat(v); if (!isNaN(n)) next[k] = Math.max(0, Math.min(1, n)); }
          });
          if (!any) return;
          saved = next;
          listeners.forEach(function (fn) { try { fn(clone(saved)); } catch (e) {} });
          if (!st.dirty) { draft = null; if (st.open) render(); }
        },
        onError: function () {}
      });
      (SE.highlightLists || []).forEach(function (l) {
        SDK.subscribeToItems(l.alias, { onData: function (d) { st.items[l.alias] = (d.items || []).filter(function (x) { return typeof x === 'string'; }); if (st.open) render(); } });
      });
    }

    var css = '.se-root{font:13px/1.45 Inter,system-ui,-apple-system,sans-serif;color:#1B2130}' +
      '.se-fab{position:fixed;top:12px;right:12px;z-index:2147483000;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid #D5DAE3;background:#fff;color:#1B2130;font:600 12.5px Inter,system-ui,sans-serif;box-shadow:0 4px 16px rgba(20,30,60,.14);cursor:pointer}' +
      '.se-fab:hover{border-color:#2F5BFF}.se-fab svg{width:14px;height:14px}' +
      '.se-pane{position:fixed;top:0;right:0;bottom:0;width:340px;max-width:92vw;z-index:2147483001;background:#fff;border-left:1px solid #DDE2EA;box-shadow:-12px 0 40px rgba(20,30,60,.16);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .28s ease}' +
      '.se-pane.on{transform:none}' +
      '.se-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px}.se-head b{font-size:15px}' +
      '.se-x{border:0;background:none;font-size:20px;line-height:1;color:#6B7385;cursor:pointer;padding:2px 6px}' +
      '.se-tabs{display:flex;gap:4px;padding:0 12px 10px;border-bottom:1px solid #EDF0F4}' +
      '.se-tabs button{border:0;background:#F1F3F7;color:#4B5468;border-radius:7px;padding:5px 10px;font:500 12px inherit;font-family:inherit;cursor:pointer}' +
      '.se-tabs button[aria-pressed="true"]{background:#2F5BFF;color:#fff}' +
      '.se-body{flex:1;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:14px}' +
      '.se-row label{display:flex;justify-content:space-between;font-weight:600;font-size:12.5px}.se-row label span{font-weight:500;color:#2F5BFF}' +
      '.se-row input[type=range]{width:100%;accent-color:#2F5BFF}.se-ends{display:flex;justify-content:space-between;font-size:11px;color:#7A8296}' +
      '.se-chips{display:flex;flex-wrap:wrap;gap:4px}.se-chips button{border:1px solid #DDE2EA;background:#fff;border-radius:999px;padding:2px 9px;font:12px inherit;font-family:inherit;cursor:pointer}' +
      '.se-chips button[aria-pressed="true"]{background:#E6ECFF;border-color:#2F5BFF;color:#1E3FC4}' +
      '.se-note{font-size:12px;color:#6B7385;background:#F6F7FA;border-radius:8px;padding:8px 10px}' +
      '.se-t{width:100%;border-collapse:collapse;font-size:12.5px}.se-t td,.se-t th{padding:4px 4px;border-bottom:1px solid #F0F2F6;text-align:right}.se-t th{color:#7A8296;font-weight:600;font-size:11px}.se-t td:first-child,.se-t th:first-child{text-align:left}' +
      '.se-t input{width:92px;border:1px solid #DDE2EA;border-radius:6px;padding:3px 6px;text-align:right;font:12.5px inherit;font-family:inherit}.se-t input.ch{border-color:#2F5BFF;background:#F2F5FF}' +
      '.se-sel{border:1px solid #DDE2EA;border-radius:7px;padding:4px 8px;font:12.5px inherit;font-family:inherit}' +
      '.se-ta{width:100%;min-height:110px;border:1px solid #DDE2EA;border-radius:8px;padding:8px;font:13px inherit;font-family:inherit;resize:vertical;box-sizing:border-box}' +
      '.se-foot{border-top:1px solid #EDF0F4;padding:10px 16px 14px;display:flex;flex-direction:column;gap:8px}.se-btns{display:flex;gap:8px;justify-content:flex-end}' +
      '.se-btn{border:1px solid #D5DAE3;background:#fff;border-radius:8px;padding:6px 14px;font:600 12.5px inherit;font-family:inherit;cursor:pointer}.se-btn.p{background:#2F5BFF;border-color:#2F5BFF;color:#fff}.se-btn:disabled{opacity:.45;cursor:default}' +
      '.se-status{font-size:12px;color:#6B7385;min-height:16px}.se-status.ok{color:#17733F}.se-status.bad{color:#B4232F}';
    var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    var root = document.createElement('div'); root.className = 'se-root'; root.setAttribute('data-strata-ignore', '');
    var fab = document.createElement('button'); fab.type = 'button'; fab.className = 'se-fab';
    fab.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3z"/></svg>Edit frame';
    var pane = document.createElement('aside'); pane.className = 'se-pane'; pane.setAttribute('aria-label', 'Edit this frame');
    root.appendChild(fab); root.appendChild(pane); document.body.appendChild(root);
    fab.addEventListener('click', function () { st.open = !st.open; pane.classList.toggle('on', st.open); if (st.open) { render(); ensurePlan(); } });

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(v) { if (typeof v !== 'number') return '—'; var a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v * 100) / 100); }
    function parseNum(s) { s = String(s).trim().replace(/[$,\s]/g, ''); var m = s.match(/^(-?\d*\.?\d+)([kKmM]?)$/); if (!m) return null; var n = parseFloat(m[1]); return m[2] === 'k' || m[2] === 'K' ? n * 1e3 : m[2] === 'm' || m[2] === 'M' ? n * 1e6 : n; }

    var planSub = null, regionSub = null;
    function ensurePlan() {
      var inp = SE.inputs[0];
      if (!inp || planSub) return;
      if (inp.selector) {
        regionSub = SDK.subscribeToItems(inp.selector, { onData: function (d) {
          st.regions = (d.items || []).filter(function (x) { return typeof x === 'string'; });
          if (!st.region && st.regions.length) { st.region = st.regions[0]; planSub.updateDynamicFilters([{ binding: inp.selector, selection: [st.region] }]); }
          if (st.open) render();
        } });
      }
      planSub = SDK.subscribeToDataSource(inp.dataSource, {
        dynamicFilters: [],
        onData: function (d) {
          var rows = d.rows || [];
          if (rows.length && rows[0].values[inp.valueIndex] && typeof rows[0].values[inp.valueIndex] === 'object') return; // loading
          st.rows = rows.map(function (r) { return { label: r.labels[0], value: r.values[inp.valueIndex] }; }).filter(function (r) { return typeof r.label === 'string'; });
          if (st.open && st.tab === 'plan') render();
        },
        onError: function () {}
      });
    }

    function render() {
      var t = draft || saved, h = '';
      h += '<div class="se-head"><b>Edit this frame</b><button type="button" class="se-x" data-a="close" aria-label="Close">×</button></div>';
      var tabs = [];
      if (SE.display) tabs.push(['display', 'Display']);
      if (SE.inputs.length) tabs.push(['plan', 'Plan inputs']);
      tabs.push(['request', 'Request a change']);
      h += '<div class="se-tabs">' + tabs.map(function (x) { return '<button type="button" data-tab="' + x[0] + '" aria-pressed="' + (st.tab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div class="se-body">';
      if (st.tab === 'display') {
        SE.settings.forEach(function (s) {
          var v = Math.round(t[s.key] * 100);
          h += '<div class="se-row"><label for="se-' + s.key + '">' + esc(s.name) + '<span>' + v + '</span></label><input type="range" id="se-' + s.key + '" data-k="' + s.key + '" min="0" max="100" value="' + v + '"><div class="se-ends"><span>' + esc(s.lo) + '</span><span>' + esc(s.hi) + '</span></div></div>';
        });
        (SE.highlightLists || []).forEach(function (l) {
          var its = st.items[l.alias] || [];
          if (!its.length) return;
          h += '<div class="se-row"><label>Spotlight ' + esc(l.name) + '</label><div class="se-chips">' + its.map(function (it) { return '<button type="button" data-hl="' + esc(it) + '" aria-pressed="' + (t.highlights.indexOf(it) >= 0) + '">' + esc(it) + '</button>'; }).join('') + '</div></div>';
        });
        h += '<div class="se-note">Apply saves these to <b>' + esc(SE.config.metricName) + '</b> in Pigment, so everyone who opens this frame sees the same version.</div>';
      } else if (st.tab === 'plan') {
        var inp = SE.inputs[0];
        if (inp.selector) h += '<div class="se-row"><label for="se-region">' + esc(inp.selectorName) + '</label><select class="se-sel" id="se-region">' + st.regions.map(function (r) { return '<option' + (r === st.region ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select></div>';
        if (!st.rows) h += '<div class="se-note">Loading ' + esc(inp.name) + '…</div>';
        else {
          h += '<table class="se-t"><thead><tr><th>' + esc(inp.labelName) + '</th><th>Now</th><th>New ' + esc(inp.name) + '</th></tr></thead><tbody>';
          st.rows.forEach(function (r) {
            var key = r.label, ch = st.plan[key] != null;
            h += '<tr><td>' + esc(r.label) + '</td><td>' + fmt(r.value) + '</td><td><input type="text" inputmode="decimal" data-plan="' + esc(key) + '" class="' + (ch ? 'ch' : '') + '" value="' + (ch ? esc(st.plan[key]) : '') + '" placeholder="' + fmt(r.value) + '" aria-label="New value for ' + esc(r.label) + '"></td></tr>';
          });
          h += '</tbody></table><div class="se-note">Writes go to <b>' + esc(inp.name) + '</b>' + (inp.selector ? ' for the selected ' + esc(inp.selectorName) : '') + '. Type 1.2M or 850K. Your Pigment access rights decide what you can change.</div>';
        }
      } else {
        h += '<div class="se-row"><label for="se-req">What should change?</label><textarea class="se-ta" id="se-req" placeholder="e.g. Add a pipeline coverage chart under the KPI tiles">' + esc(st.request) + '</textarea></div>';
        h += '<div class="se-note">A frame can\'t rewrite its own code. Apply saves your request to <b>' + esc(SE.requests.listName) + '</b> in Pigment; Claude reads it, writes the new code and pushes it to this frame.</div>';
      }
      h += '</div><div class="se-foot"><div class="se-status ' + (st.status.indexOf('Saved') === 0 ? 'ok' : st.status.indexOf('Pigment') === 0 ? 'bad' : '') + '" role="status">' + esc(st.status) + '</div><div class="se-btns"><button type="button" class="se-btn" data-a="cancel"' + (st.dirty ? '' : ' disabled') + '>Discard</button><button type="button" class="se-btn p" data-a="apply"' + (st.dirty ? '' : ' disabled') + '>Apply</button></div></div>';
      pane.innerHTML = h;
    }
    function markDirty() {
      st.dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved) || Object.keys(st.plan).length > 0 || !!st.request.trim();
      var a = pane.querySelector('[data-a="apply"]'), c = pane.querySelector('[data-a="cancel"]');
      if (a) a.disabled = !st.dirty; if (c) c.disabled = !st.dirty;
    }
    pane.addEventListener('input', function (e) {
      var el = e.target;
      if (el.dataset.k) { draft = draft || clone(saved); draft[el.dataset.k] = el.value / 100; el.previousElementSibling.querySelector('span').textContent = el.value; }
      if (el.dataset.plan != null) { var v = el.value.trim(); if (v) st.plan[el.dataset.plan] = v; else delete st.plan[el.dataset.plan]; el.classList.toggle('ch', !!v); }
      if (el.id === 'se-req') st.request = el.value;
      st.status = ''; markDirty();
    });
    pane.addEventListener('change', function (e) {
      if (e.target.id === 'se-region') { st.region = e.target.value; st.plan = {}; st.rows = null; planSub.updateDynamicFilters([{ binding: SE.inputs[0].selector, selection: [st.region] }]); render(); markDirty(); }
    });
    pane.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'close') { st.open = false; pane.classList.remove('on'); }
      if (b.dataset.tab) { st.tab = b.dataset.tab; render(); markDirty(); }
      if (b.dataset.hl != null) { draft = draft || clone(saved); var i = draft.highlights.indexOf(b.dataset.hl); if (i >= 0) draft.highlights.splice(i, 1); else draft.highlights.push(b.dataset.hl); b.setAttribute('aria-pressed', String(i < 0)); markDirty(); }
      if (b.dataset.a === 'cancel') { draft = null; st.plan = {}; st.request = ''; st.status = 'Changes discarded.'; st.dirty = false; render(); }
      if (b.dataset.a === 'apply') apply();
    });

    function apply() {
      var writes = [], n = 0, bad = [];
      if (draft) {
        SE.settings.forEach(function (s) {
          if (draft[s.key] !== saved[s.key]) { var c = {}; c[SE.config.listBinding] = s.key; writes.push(SDK.editValue(SE.config.valueBinding, c, String(Math.round(draft[s.key] * 100) / 100))); n++; }
        });
        if (draft.highlights.join('|') !== saved.highlights.join('|')) { var c2 = {}; c2[SE.config.listBinding] = 'highlights'; writes.push(SDK.editValue(SE.config.valueBinding, c2, draft.highlights.join('|'))); n++; }
      }
      var inp = SE.inputs[0];
      Object.keys(st.plan).forEach(function (k) {
        var v = parseNum(st.plan[k]);
        if (v == null) { bad.push(k); return; }
        var c = {}; c[inp.labelBinding] = k; if (inp.selector) c[inp.selector] = st.region;
        writes.push(SDK.editValue(inp.binding, c, v)); n++;
      });
      if (bad.length) { st.status = 'Pigment needs numbers: check ' + bad.join(', ') + '.'; render(); return; }
      if (st.request.trim()) { writes.push(SDK.addItem(SE.requests.list, { Name: st.request.trim().slice(0, 500) })); n++; }
      if (!n) return;
      var btn = pane.querySelector('[data-a="apply"]'); if (btn) btn.disabled = true;
      st.status = 'Saving ' + n + ' change' + (n > 1 ? 's' : '') + ' to Pigment…'; render();
      Promise.all(writes).then(function () {
        if (draft) { saved = clone(draft); listeners.forEach(function (fn) { try { fn(clone(saved)); } catch (e) {} }); }
        var hadReq = !!st.request.trim();
        draft = null; st.plan = {}; st.request = ''; st.dirty = false;
        st.status = 'Saved ' + n + ' change' + (n > 1 ? 's' : '') + ' to Pigment.' + (hadReq ? ' Your request is queued for Claude.' : '');
        render();
      }, function (err) {
        st.status = 'Pigment did not accept the change: ' + (err && err.message ? err.message : 'unknown error') + '.';
        render(); markDirty();
      });
    }
  }

  function configRows(t) {
    return ['color', 'detail', 'horizon', 'specificity', 'audience'].map((k) => ({ labels: [k], values: [String(Math.round((t[k] == null ? 0.5 : t[k]) * 100) / 100)] }))
      .concat([{ labels: ['highlights'], values: [(t.highlights || []).join('|')] }]);
  }

  /* Build the kit for a snapshot. Returns what FrameHost.load needs plus the config. */
  S.selfEdit = {
    CONFIG_DS: 'frameConfig',
    build(snap, tuning, tunable, sliders) {
      const E = S.engine;
      const name = (k) => { const m = E.blockMeta(snap, k); return m ? m.name : k; };
      const inputs = [];
      (snap.dataSources || []).forEach((d) => (d.values || []).forEach((v, i) => {
        const m = E.blockMeta(snap, v.binding);
        if (m && m.input && d.labels && d.labels[0]) {
          const sel = (d.selectors || [])[0];
          inputs.push({ dataSource: d.name, binding: v.binding, name: m.name, valueIndex: i, labelBinding: d.labels[0].binding, labelName: name(d.labels[0].binding), selector: sel ? sel.binding : null, selectorName: sel ? name(sel.binding) : null });
        }
      }));
      const lists = Object.keys(snap.items || {}).filter((k) => (snap.items[k] || []).length && snap.items[k].length <= 24 && !/month|date|week|day|year/i.test(k));
      const cfg = {
        display: !!tunable,
        settings: sliders.map((s) => ({ key: s.key, name: s.name, lo: s.lo, hi: s.hi })),
        highlightLists: lists.map((k) => ({ alias: k, name: name(k) })),
        config: { dataSource: 'frameConfig', valueBinding: 'frameConfigValue', listBinding: 'frameSettingList', metricName: 'FRAME_CONFIG' },
        inputs: inputs.slice(0, 1),
        requests: { list: 'frameChangeRequests', listName: 'Frame Change Requests' },
      };
      const prefix = '/* Self-edit kit (Framecraft): in-frame edit pane. */\n(' + strataSelfEditKit.toString() + ')(' + JSON.stringify(cfg) + ');';
      const defs = (snap.dataSources || []).concat([{ name: 'frameConfig', values: [{ binding: 'frameConfigValue' }], labels: [{ binding: 'frameSettingList' }], selectors: [] }]);
      return { cfg, prefix, defs, data: { frameConfig: { default: { rows: configRows(tuning), rowOffset: 0, totalRowCount: 6 }, filters: {} } }, items: { frameChangeRequests: [] }, hideDs: ['frameConfig'] };
    },
    /* The complete frame file to push to Pigment: kit first, then the frame's own code. */
    exportCode(snap, built) { return built.prefix + '\n\n' + String(snap.code || ''); },
    /* Bindings and data sources to add, and the Pigment blocks to create. */
    exportSpec(snap, built) {
      const cfg = built.cfg;
      const bindings = (snap.bindings || []).map((b) => (cfg.inputs.some((i) => i.binding === b.name) ? Object.assign({}, b, { can_write: true }) : b));
      const inputLists = new Set(cfg.inputs.flatMap((i) => [i.labelBinding, i.selector].filter(Boolean)));
      bindings.forEach((b) => { if (inputLists.has(b.name) || cfg.highlightLists.some((l) => l.alias === b.name)) b.can_read = true; });
      if (cfg.display) bindings.push({ name: 'frameConfigValue', type: 'Metric', metric_id: '<FRAME_CONFIG metric id>', can_read: true, can_write: true }, { name: 'frameSettingList', type: 'List', list_id: '<Frame Setting list id>', can_read: true, can_write: false });
      bindings.push({ name: 'frameChangeRequests', type: 'List', list_id: '<Frame Change Requests list id>', can_read: false, can_write: true });
      const dataSources = (snap.dataSources || []).map((d) => JSON.parse(JSON.stringify(d)));
      if (cfg.display) dataSources.push({ name: 'frameConfig', values: [{ binding: 'frameConfigValue' }], labels: [{ binding: 'frameSettingList' }], selectors: [] });
      const blocks = [];
      if (cfg.display) {
        blocks.push('List "Frame Setting" with items: color, detail, horizon, specificity, audience, highlights.');
        blocks.push('Metric "FRAME_CONFIG", Text type, dimensioned by Frame Setting only. Seed it: ' + configRows(S.app ? S.app.tuning : {}).map((r) => r.labels[0] + ' = "' + r.values[0] + '"').join(', ') + '.');
      }
      blocks.push('List "Frame Change Requests" (default Name property holds the request text). Optional properties: Status, Requested by.');
      cfg.inputs.forEach((i) => blocks.push('Allow writes to "' + i.name + '" from the frame (binding can_write: true). Viewers still need write access in Pigment.'));
      return { bindings, dataSources, blocks };
    },
  };
})();
