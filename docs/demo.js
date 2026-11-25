/* Frame Studio: a self-running demo, and a control panel to shape it.
   The flythrough plays full screen, then each chosen app is shown in turn with a caption.
   window.__demo.start() plays it; window.__demo.setup() opens the control panel.
   Buttons: [data-demo] plays, [data-demo-setup] opens the panel. ?demo=1 in the address plays on load,
   and ?demo=1&cfg=... plays a shared version. Settings are kept in this browser (try/catch: it works without). */
(function () {
  'use strict';
  var A = window.__atlas;
  if (!A) return;

  /* ---------------- the steps: Claude's best go ---------------- */
  var STEPS = [
    { id: 'fly', fly: true, dur: 68, fixed: true, title: 'The flythrough', text: 'Engine to frame in about a minute.', std: 'Engine to frame in about a minute: the dashboard, the logic under it, the model, the data behind it, the engine, and Claude as a reader.', more: 'Everything in it is a working app you can open afterwards.' },
    { id: 'home', view: 'home', dur: 7, title: 'Frame Studio', text: 'Seven working apps on sample data.', std: 'Seven working apps on sample data. The path runs from Pigment’s calculation engine up to a full frame.', more: 'Each app hands context to the next: open a block in one and the others follow it.' },
    { id: 'graphite', view: 'graphite', dur: 14, title: '1 · Graphite, the engine', text: 'Only cells that hold data are stored.', std: 'Pigment stores only the cells that hold data. Change an input and only what depends on it is recalculated.', more: 'Try it: drag the cube to orbit, then run a recalculation and watch the wave stay inside its scope.' },
    { id: 'formula-lens', view: 'formula-lens', dur: 14, title: '2 · Formula Studio', text: 'Watch a formula reshape the data.', std: 'Step through a formula and watch BY, REMOVE, ADD, SELECT and FILTER reshape the cube, one modifier at a time.', more: 'On a modifier step, “See it in the engine” opens the same modifier on Graphite’s cube.' },
    { id: 'blockflow', view: 'blockflow', dur: 14, title: '3 · Blockflow, the model', text: 'Every block, and how data moves.', std: 'Every block in a model and how data moves between them, from concept down to each metric.', more: 'Open a block to hand it to Formula Studio, or play a build plan step by step.' },
    { id: 'frame-strata', view: 'frame-strata', dur: 14, title: '4 · Framecraft', text: 'Trace any number to its blocks.', std: 'Take a frame apart: trace any number on the page back through the frame’s logic to the blocks that produce it.', more: 'Switch between 3D layers and a flat 2D trace; the flow map links back to Blockflow.' },
    { id: 'lumina', view: 'lumina', dur: 18, title: '5 · The Lumina frame', text: 'A complete Pigment frame, on sample data.', std: 'A complete Pigment frame on a mock SDK: Pulse, Ask why, Architecture Studio, Collaboration and notes pinned to widgets.', more: 'The same code runs inside Pigment on live data, within Pigment’s 1 MiB limit for frame code.' },
    { id: 'frame-world', view: 'frame-world', dur: 16, title: 'Frame World', text: 'Walk the frame in first person.', std: 'Walk the same frame in first person: drop into Blockflow, cross into the warehouse, then take the finding into the real world.', more: 'The warehouse tables each carry their SQL; Databricks, Claude and Pigment’s connectors sit around it.' },
    { id: 'frame-size', view: 'frame-size', dur: 9, title: 'Frame size', text: 'Where the 1 MiB goes.', std: 'The real frame lives inside Pigment’s 1 MiB code limit. This shows where every kilobyte goes and what to trim first.', more: 'Open a part to see its biggest pieces, and the trims ranked from no impact to high.' },
    { id: 'end', view: 'home', dur: 8, last: true, title: 'Your turn', text: 'Start the path, or open any app.', std: 'That’s the tour. Start the path at Graphite, or open any app from the sidebar.', more: 'Everything runs in your browser on sample data; nothing is sent anywhere.' }
  ];
  var DETAIL = [['brief', 'Brief', 0.7], ['standard', 'Standard', 1], ['detailed', 'Detailed', 1.4]];
  var KEY = 'frame-studio:demo';
  function defaults() { var c = { detail: 'standard', on: {}, dur: {} }; STEPS.forEach(function (s) { c.on[s.id] = true; c.dur[s.id] = s.dur; }); return c; }
  function norm(c) {
    var d = defaults(); if (!c || typeof c !== 'object') return d;
    if (DETAIL.some(function (x) { return x[0] === c.detail; })) d.detail = c.detail;
    STEPS.forEach(function (s) {
      if (c.on && typeof c.on[s.id] === 'boolean') d.on[s.id] = c.on[s.id];
      if (!s.fixed && c.dur && isFinite(c.dur[s.id])) d.dur[s.id] = Math.max(3, Math.min(120, Math.round(c.dur[s.id])));
    });
    return d;
  }
  function load() { try { return norm(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return defaults(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }
  var cfg = load();
  function fromUrl() { var m = /[?&]cfg=([^&#]+)/.exec(location.search); if (!m) return null; try { return norm(JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))))); } catch (e) { return null; } }
  function shareUrl() { var b = btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))); return location.href.split('?')[0].split('#')[0] + '?demo=1&cfg=' + encodeURIComponent(b); }
  function caption(s, c) { c = c || cfg; return c.detail === 'brief' ? s.text : c.detail === 'detailed' ? s.std + ' ' + s.more : s.std; }
  function plan(c) { c = c || cfg; return STEPS.filter(function (s) { return c.on[s.id]; }); }
  function total() { return plan().reduce(function (a, s) { return a + (s.fixed ? s.dur : cfg.dur[s.id]); }, 0); }
  function mmss(t) { t = Math.round(t); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }

  /* ---------------- styles ---------------- */
  var css = '.dm-bar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483000;width:min(760px,calc(100vw - 32px));background:rgba(9,13,26,.93);color:#F4F1EA;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px 16px 12px;box-shadow:0 18px 50px rgba(0,0,0,.45);font:14px/1.45 Inter,system-ui,sans-serif;backdrop-filter:blur(8px)}' +
    '.dm-bar h3{margin:0 0 4px;font:700 18px/1.2 "Bricolage Grotesque",Inter,sans-serif}.dm-bar p{margin:0;color:#C3C9DA}' +
    '.dm-row{display:flex;align-items:center;gap:8px;margin-top:10px}.dm-btn{appearance:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#F4F1EA;font:600 12px Inter,sans-serif;padding:6px 11px;border-radius:999px;cursor:pointer}' +
    '.dm-btn:focus-visible,.dm-panel input:focus-visible,.dm-panel button:focus-visible{outline:2px solid #57E3FF;outline-offset:2px}.dm-go{background:#D9774F!important;border-color:#D9774F!important;color:#1A0F0A!important}' +
    '.dm-prog{flex:1;display:flex;gap:3px}.dm-prog i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.16);overflow:hidden}.dm-prog i b{display:block;height:100%;width:0;background:#D9774F}' +
    '.dm-fly{position:fixed;inset:0;z-index:2147482990;border:0;width:100vw;height:100vh;background:#070B16}' +
    '.dm-veil{position:fixed;inset:0;z-index:2147483100;background:rgba(5,8,16,.55);display:grid;place-items:center;padding:16px}' +
    '.dm-panel{width:min(640px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--bg,#FBF8F3);color:var(--ink,#1F1A17);border:1px solid var(--line,rgba(0,0,0,.12));border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);font:14px/1.45 Inter,system-ui,sans-serif}' +
    '.dm-panel header{padding:18px 20px 6px}.dm-panel h2{margin:0;font:700 22px/1.2 "Bricolage Grotesque",Inter,sans-serif}.dm-panel header p{margin:6px 0 0;color:var(--muted,#6B635C)}' +
    '.dm-panel section{padding:10px 20px}.dm-lbl{font:600 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#6B635C);margin:6px 0 8px}' +
    '.dm-seg{display:inline-flex;border:1px solid var(--line,rgba(0,0,0,.14));border-radius:999px;overflow:hidden}.dm-seg button{appearance:none;border:0;background:transparent;color:inherit;font:600 13px Inter,sans-serif;padding:7px 14px;cursor:pointer}.dm-seg button[aria-pressed="true"]{background:#D9774F;color:#1A0F0A}' +
    '.dm-step{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line,rgba(0,0,0,.08))}.dm-step:first-child{border-top:0}' +
    '.dm-step b{display:block;font-weight:600}.dm-step small{display:block;color:var(--muted,#6B635C);font-size:12px;line-height:1.35;margin-top:2px}.dm-step.off b,.dm-step.off small{opacity:.45}' +
    '.dm-step input[type=checkbox]{width:18px;height:18px;accent-color:#D9774F}.dm-dur{display:flex;align-items:center;gap:6px;white-space:nowrap}.dm-dur input{width:110px;accent-color:#D9774F}.dm-dur output{min-width:34px;text-align:right;font-variant-numeric:tabular-nums}' +
    '.dm-panel footer{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:14px 20px;background:var(--bg,#FBF8F3);border-top:1px solid var(--line,rgba(0,0,0,.1))}.dm-panel footer .dm-tot{margin-right:auto;color:var(--muted,#6B635C)}' +
    '.dm-panel .dm-btn{background:transparent;color:inherit;border-color:var(--line,rgba(0,0,0,.18));font-size:13px;padding:8px 14px}' +
    'body.dm-on .cv-toast{display:none}@media (max-width:520px){.dm-dur input{width:72px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, cls, fn) { var b = el('button', 'dm-btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; b.addEventListener('click', fn); return b; }

  /* ---------------- the player ---------------- */
  /* Only one app runs at a time during the demo: each 3D app holds a graphics context and memory, and several at once can crash a tab. */
  function unload(view) {
    if (!view) return;
    if (view === 'home') { var hf = document.querySelector('.home-hero iframe'); if (hf) hf.remove(); return; }
    var f = document.querySelector('#view-' + view + ' iframe'); if (f) f.remove();
  }
  var bar = null, fly = null, steps = [], i = -1, curView = null, timer = null, left = 0, t0 = 0, paused = false, raf = 0, runCfg = null;
  function build() {
    bar = el('div', 'dm-bar'); bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Demo'); bar.setAttribute('aria-live', 'polite');
    bar.append(el('h3'), el('p'));
    var row = el('div', 'dm-row'), prog = el('div', 'dm-prog');
    steps.forEach(function () { var s = el('i'); s.append(el('b')); prog.append(s); });
    row.append(btn('Pause', '', function () { setPaused(!paused); }), prog, btn('Next', 'dm-next', function () { go(i + 1); }), btn('Settings', '', function () { stop(); setup(); }), btn('Exit demo', '', stop));
    row.firstChild.setAttribute('data-a', 'pause');
    bar.append(row); document.body.append(bar);
  }
  function paint() {
    var s = steps[i]; bar.querySelector('h3').textContent = s.title; bar.querySelector('p').textContent = caption(s, runCfg);
    var segs = bar.querySelectorAll('.dm-prog b'); for (var k = 0; k < segs.length; k++) if (k !== i) segs[k].style.width = k < i ? '100%' : '0';
    var row = bar.querySelector('.dm-row'), old = row.querySelector('.dm-go'); if (old) old.remove();
    if (s.last) row.insertBefore(btn('Start the path', 'dm-go', function () { stop(); A.show('graphite'); }), row.querySelector('.dm-next'));
    bar.querySelector('.dm-next').hidden = !!s.last;
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    var s = steps[i]; if (!s || !bar) return;
    var seg = bar.querySelectorAll('.dm-prog b')[i]; if (!seg) return;
    var d = s.fixed ? s.dur : runCfg.dur[s.id], gone = paused ? d - left : d - Math.max(0, left - (performance.now() - t0) / 1000);
    seg.style.width = (Math.min(1, gone / d) * 100) + '%';
  }
  function schedule(sec) { clearTimeout(timer); left = sec; t0 = performance.now(); timer = setTimeout(function () { if (!steps[i].last) go(i + 1); }, sec * 1000); }
  function go(n) {
    if (n >= steps.length) { stop(); return; }
    i = n; var s = steps[i]; paused = false; bar.querySelector('[data-a="pause"]').textContent = 'Pause';
    if (fly && !s.fly) { fly.remove(); fly = null; }
    if (s.fly) {
      unload(curView); curView = null; unload('home');
      fly = el('iframe', 'dm-fly'); fly.src = 'apps/flythrough.html?demo=1'; fly.title = 'Flythrough'; document.body.append(fly);
      schedule(s.dur + 6);   /* the flythrough also says when it ends; this is the backstop */
    } else { var was = curView; A.show(s.view); curView = s.view; if (was && was !== s.view) unload(was); schedule(runCfg.dur[s.id]); }
    paint();
  }
  function setPaused(p) {
    var s = steps[i]; if (!s || s.fly) return; paused = p; bar.querySelector('[data-a="pause"]').textContent = p ? 'Resume' : 'Pause';
    if (p) { clearTimeout(timer); left = Math.max(0, left - (performance.now() - t0) / 1000); } else schedule(left);
  }
  function start(c) {
    if (bar) stop();
    runCfg = c || cfg; steps = plan(runCfg);
    if (!steps.length) { setup(); return; }
    closeSetup(); build(); document.body.classList.add('dm-on'); curView = null; go(0); tick();
  }
  function stop() { clearTimeout(timer); cancelAnimationFrame(raf); if (fly) { fly.remove(); fly = null; } if (bar) { bar.remove(); bar = null; } document.body.classList.remove('dm-on'); i = -1; }
  window.addEventListener('message', function (e) { var d = e.data; if (d && d.source === 'flythrough' && d.type === 'end' && steps[i] && steps[i].fly) go(i + 1); });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (veil) { closeSetup(); e.stopPropagation(); } else if (bar) stop(); }, true);

  /* ---------------- the control panel ---------------- */
  var veil = null, prevFocus = null;
  function closeSetup() { if (veil) { veil.remove(); veil = null; if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} } }
  function setup() {
    closeSetup(); prevFocus = document.activeElement;
    veil = el('div', 'dm-veil'); veil.addEventListener('click', function (e) { if (e.target === veil) closeSetup(); });
    var p = el('div', 'dm-panel'); p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'dmTitle');
    var head = el('header'); var h2 = el('h2', '', 'Demo settings'); h2.id = 'dmTitle';
    head.append(h2, el('p', '', 'Claude’s version is set up already. Choose the stops, how long each one runs, and how much the captions say. Your changes stay in this browser.'));
    var det = el('section'); det.append(el('div', 'dm-lbl', 'Caption detail'));
    var seg = el('div', 'dm-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Caption detail');
    DETAIL.forEach(function (d) {
      var b = el('button', '', d[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(cfg.detail === d[0]));
      b.addEventListener('click', function () {
        var was = DETAIL.filter(function (x) { return x[0] === cfg.detail; })[0][2], f = d[2] / was; cfg.detail = d[0];
        STEPS.forEach(function (s) { if (!s.fixed) cfg.dur[s.id] = Math.max(3, Math.min(120, Math.round(cfg.dur[s.id] * f))); });   /* more to read: more time */
        save(); render();
      });
      seg.append(b);
    });
    det.append(seg, el('div', 'dm-lbl', ''));
    var list = el('section'); list.append(el('div', 'dm-lbl', 'Stops'));
    STEPS.forEach(function (s) {
      var row = el('div', 'dm-step' + (cfg.on[s.id] ? '' : ' off')), cb = el('input'); cb.type = 'checkbox'; cb.checked = cfg.on[s.id]; cb.id = 'dm-' + s.id;
      cb.addEventListener('change', function () { cfg.on[s.id] = cb.checked; save(); render(); });
      var txt = el('label'); txt.htmlFor = cb.id; txt.append(el('b', '', s.title), el('small', '', caption(s)));
      var dur = el('div', 'dm-dur');
      if (s.fixed) dur.append(el('span', '', mmss(s.dur) + ' (fixed)'));
      else {
        var r = el('input'); r.type = 'range'; r.min = '3'; r.max = '60'; r.step = '1'; r.value = String(cfg.dur[s.id]); r.disabled = !cfg.on[s.id]; r.setAttribute('aria-label', s.title + ' seconds');
        var out = el('output', '', cfg.dur[s.id] + ' s');
        r.addEventListener('input', function () { cfg.dur[s.id] = +r.value; out.textContent = r.value + ' s'; tot.textContent = 'Total ' + mmss(total()) + ' · ' + plan().length + ' stops'; save(); });
        dur.append(r, out);
      }
      row.append(cb, txt, dur); list.append(row);
    });
    var foot = el('footer'), tot = el('span', 'dm-tot', 'Total ' + mmss(total()) + ' · ' + plan().length + ' stops');
    var copy = btn('Copy link', '', function () {
      var u = shareUrl(), done = function (ok) { copy.textContent = ok ? 'Link copied' : 'Copy failed'; setTimeout(function () { copy.textContent = 'Copy link'; }, 1800); };
      try { navigator.clipboard.writeText(u).then(function () { done(true); }, function () { prompt('Copy this link', u); }); } catch (e) { prompt('Copy this link', u); }
    });
    copy.title = 'A link that plays this exact version of the demo';
    foot.append(tot, btn('Reset to Claude’s version', '', function () { cfg = defaults(); save(); render(); }), copy, btn('Close', '', closeSetup), btn('Play demo', 'dm-go', function () { start(cfg); }));
    p.append(head, det, list, foot); veil.append(p); document.body.append(veil);
    var first = p.querySelector('.dm-seg button[aria-pressed="true"]'); if (first) first.focus();
    function render() { var keepScroll = p.scrollTop; setup(); veil.querySelector('.dm-panel').scrollTop = keepScroll; }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-demo],[data-demo-setup]'); if (!b) return;
    e.preventDefault(); if (b.hasAttribute('data-demo-setup')) setup(); else start(cfg);
  });
  window.__demo = { start: function () { start(cfg); }, setup: setup, stop: stop };
  if (/[?&]demo=1/.test(location.search)) { var shared = fromUrl(); setTimeout(function () { start(shared || cfg); }, 400); }
})();
