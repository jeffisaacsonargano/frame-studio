/* Framecraft — walk mode: the last stop of the journey. The frame becomes a place you can stand on.
   Bars from the frame's month chart are platforms (height = value), each selector item is a floor pad,
   and the KPIs stand as slabs at the back. Everything is built from the data the caller hands in
   (play.js reads it from the current snapshot), so nothing here knows about a particular frame.

   Strata.walk.open({
     title, subtitle,
     rows():   [{ label, actual, plan, forecast, text }]   // current filter applied; text = formatted shown value
     kpis():   [{ name, text }]
     selector: { name, items: ['All', ...] } | null
     filter(): current item,   setFilter(item)
     fmt(x):   formatted number
   }, onClose)                                                                                              */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let threeP = null, W = null;

  function ensureThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threeP) return threeP;
    threeP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = THREE_URL; s.onload = () => (window.THREE ? res(window.THREE) : rej(new Error('three.js did not initialise')));
      s.onerror = () => { threeP = null; rej(new Error('three.js could not be loaded')); };
      document.head.appendChild(s);
    });
    return threeP;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);

  /* world measurements, in metres-ish units */
  const FLOOR_W = 46, FLOOR_D = 32, BAR_Z = -8, BAR_D = 2.6, H_MAX = 7.5, STEP_H = 1.5, STEP_D = 1.5, PAD_Z = 5, PAD_R = 1.5;
  const GRAV = 26, JUMP_V = 9.6, SPEED = 7.5, EYE = 1.65, RADIUS = 0.42;

  function open(opts, onClose) {
    if (W) return Promise.resolve();
    const host = document.getElementById('stage');
    const ui = document.createElement('div');
    ui.className = 'walk-ui';
    ui.innerHTML = '<canvas class="walk-cv" tabindex="0" aria-label="Walk on the frame. W A S D or arrow keys move, Space jumps or uses a selector pad, drag to look, Escape leaves."></canvas>' +
      '<div class="walk-load">Building the frame you can walk on…</div>' +
      '<div class="walk-hud walk-keys" aria-hidden="true"><b>Walk the frame</b><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows: move</span><span><kbd>Space</kbd>: jump, or use a pad</span><span>Drag: look · <kbd>V</kbd>: camera · <kbd>Esc</kbd>: leave</span></div>' +
      '<button type="button" class="btn walk-exit" data-walk="exit">Leave the walk</button>' +
      '<div class="walk-hud walk-where" role="status" aria-live="polite"></div>' +
      '<div class="walk-pad" aria-label="Touch controls"><button type="button" data-hold="left" aria-label="Turn left">◀</button><button type="button" data-hold="fwd" aria-label="Forward">▲</button><button type="button" data-hold="back" aria-label="Back">▼</button><button type="button" data-hold="right" aria-label="Turn right">▶</button></div>' +
      '<button type="button" class="walk-jump" data-hold="jump" aria-label="Jump or use pad">Jump</button>';
    host.appendChild(ui);
    W = { ui, opts, onClose, keys: {}, dead: false };
    ui.querySelector('[data-walk="exit"]').addEventListener('click', () => close());
    return ensureThree().then((T) => { if (W && !W.dead) start(T); }, (err) => {
      if (!W) return;
      ui.querySelector('.walk-load').innerHTML = 'The 3D library could not be loaded here, so walk mode is unavailable. <button type="button" class="btn" data-walk="exit2">Back to the frame</button>';
      ui.querySelector('[data-walk="exit2"]').addEventListener('click', () => close());
      console.warn('Walk mode:', err);
    });
  }

  function start(T) {
    const w = W, ui = w.ui, opts = w.opts, cv = ui.querySelector('.walk-cv');
    ui.querySelector('.walk-load').remove();
    const C = (n, fb) => new T.Color(css(n, fb));
    const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new T.Scene();
    const bg = C('--bg', '#F0EBE1');
    scene.background = bg; scene.fog = new T.Fog(bg.getHex(), 34, 78);
    const camera = new T.PerspectiveCamera(66, 1, 0.1, 200);
    scene.add(new T.AmbientLight(0xffffff, 0.78));
    const sun = new T.DirectionalLight(0xffffff, 0.7); sun.position.set(10, 22, 14); scene.add(sun);
    const accent = C('--accent', '#3b5bff'), metric = C('--c-metric', '#3b5bff'), text = css('--text', '#111'), text2 = css('--text-2', '#555');
    const surf = C('--panel', '#FBF8F3'), lineC = bg.clone().lerp(C('--text', '#111'), 0.2);   // --line-2 is translucent, so mix an opaque equivalent

    /* the page */
    const floor = new T.Mesh(new T.BoxGeometry(FLOOR_W, 0.4, FLOOR_D), new T.MeshLambertMaterial({ color: surf })); floor.position.y = -0.2; scene.add(floor);
    const grid = new T.GridHelper(Math.max(FLOOR_W, FLOOR_D) + 2, 24, lineC, lineC); grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
    const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(FLOOR_W, 0.4, FLOOR_D)), new T.LineBasicMaterial({ color: accent })); edge.position.y = -0.2; scene.add(edge);

    function sprite(str, o) {
      o = o || {};
      const fs = o.size || 30, pad = o.bg ? 14 : 4, lines = String(str).split('\n');
      const c = document.createElement('canvas'), x = c.getContext('2d');
      const font = (o.weight || 500) + ' ' + fs + 'px Inter, "Segoe UI", system-ui, sans-serif';
      x.font = font;
      const tw = Math.ceil(Math.max.apply(null, lines.map((l) => x.measureText(l).width))) + pad * 2, th = Math.ceil(fs * 1.25 * lines.length) + pad * 2;
      c.width = tw * 2; c.height = th * 2; x.scale(2, 2); x.font = font;
      if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, tw, th); }
      x.fillStyle = o.color || text; x.textBaseline = 'middle'; x.textAlign = 'center';
      lines.forEach((l, i) => x.fillText(l, tw / 2, pad + fs * 1.25 * (i + 0.5)));
      const tex = new T.CanvasTexture(c); tex.minFilter = T.LinearFilter;
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      const k = o.scale || 0.02; s.scale.set(tw * k, th * k, 1);
      return s;
    }
    function swap(holder, key, make) { if (holder[key]) { scene.remove(holder[key]); holder[key].material.map.dispose(); holder[key].material.dispose(); } holder[key] = make(); scene.add(holder[key]); return holder[key]; }

    const title = sprite(opts.title + (opts.subtitle ? '\n' + opts.subtitle : ''), { size: 34, weight: 600, scale: 0.03 }); title.position.set(0, 15.5, -FLOOR_D / 2 - 1); scene.add(title);

    /* bars: one platform per row, plus steps in front so every bar can be climbed in normal jumps */
    const bars = [], solids = [];           // solids: axis-aligned boxes { x0, x1, z0, z1, top, bar? }
    let steps = [], max = 1;
    const stepMat = new T.MeshLambertMaterial({ color: bg.clone().lerp(metric, 0.3) });
    function shown(r) { return r.actual != null ? r.actual : r.forecast != null ? r.forecast : r.plan; }
    function layout(first) {
      const rows = opts.rows();
      max = 0; rows.forEach((r) => [r.actual, r.plan, r.forecast].forEach((x) => { if (typeof x === 'number' && x > max) max = x; })); max = max || 1;
      const n = rows.length || 1, span = FLOOR_W - 6, step = span / n, bw = Math.min(2.6, step * 0.66);
      if (first) {
        rows.forEach((r, i) => {
          const x = -span / 2 + step * (i + 0.5);
          const mesh = new T.Mesh(new T.BoxGeometry(bw, 1, BAR_D), new T.MeshLambertMaterial({ color: metric, transparent: true, opacity: 1 }));
          mesh.position.set(x, 0.5, BAR_Z); scene.add(mesh);
          const top = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(bw, 1, BAR_D)), new T.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.6 })); scene.add(top);
          const plan = new T.Mesh(new T.BoxGeometry(bw + 0.5, 0.06, BAR_D + 0.5), new T.MeshBasicMaterial({ color: C('--text', '#888'), transparent: true, opacity: 0.4 })); scene.add(plan);
          const b = { i, x, w: bw, h: 0.05, target: 0.05, mesh, top, plan, row: r, lab: {} };
          b.solid = { x0: x - bw / 2, x1: x + bw / 2, z0: BAR_Z - BAR_D / 2, z1: BAR_Z + BAR_D / 2, top: 0.05, bar: b };
          bars.push(b); solids.push(b.solid);
        });
      }
      bars.forEach((b, i) => {
        const r = rows[i] || { label: '', actual: null, plan: null, forecast: null };
        b.row = r;
        const v = shown(r);
        b.from = b.h; b.target = v == null ? 0.05 : Math.max(0.25, (v / max) * H_MAX);
        b.planH = r.plan == null ? null : (r.plan / max) * H_MAX;
        b.mesh.material.opacity = r.actual == null ? 0.55 : 1;
        const l = swap(b.lab, 's', () => sprite(String(r.label).split(' ')[0], { size: 26, weight: 600, color: text2 })); l.position.set(b.x, 0.5, BAR_Z + BAR_D / 2 + 0.35);
      });
      // steps descend toward the viewer from each bar's front edge
      steps.forEach((s) => { scene.remove(s.mesh); s.mesh.geometry.dispose(); const k = solids.indexOf(s.solid); if (k >= 0) solids.splice(k, 1); });
      steps = [];
      bars.forEach((b) => {
        const count = Math.max(0, Math.ceil(b.target / STEP_H) - 1);
        for (let k = 1; k <= count; k++) {
          const top = b.target - k * (b.target / (count + 1)), z0 = BAR_Z + BAR_D / 2 + (k - 1) * STEP_D;
          const m = new T.Mesh(new T.BoxGeometry(b.w * 0.5, top, STEP_D), stepMat); m.position.set(b.x, top / 2, z0 + STEP_D / 2); scene.add(m);
          const solid = { x0: b.x - b.w * 0.25, x1: b.x + b.w * 0.25, z0, z1: z0 + STEP_D, top };
          steps.push({ mesh: m, solid }); solids.push(solid);
        }
      });
      w.rise = { t0: performance.now(), ms: reduce ? 1 : 900 };
      kpiBoard();
    }
    function setBar(b, h) {
      b.h = h; b.solid.top = h;
      b.mesh.scale.y = h; b.mesh.position.y = h / 2;
      b.top.scale.y = h; b.top.position.set(b.x, h / 2, BAR_Z);
      b.plan.visible = b.planH != null; if (b.planH != null) b.plan.position.set(b.x, b.planH, BAR_Z);
    }

    /* KPI slabs along the back edge */
    const kpiHold = [];
    function kpiBoard() {
      const ks = (opts.kpis() || []).slice(0, 4), n = ks.length;
      ks.forEach((k, i) => {
        kpiHold[i] = kpiHold[i] || {};
        const s = swap(kpiHold[i], 's', () => sprite(k.name + '\n' + k.text, { size: 30, weight: 600, bg: css('--panel-2', '#fff'), scale: 0.026 }));
        s.position.set((i - (n - 1) / 2) * 10, 11.2, -FLOOR_D / 2 + 0.5);
      });
    }

    /* selector pads */
    const pads = [];
    if (opts.selector && opts.selector.items.length) {
      const items = opts.selector.items, n = items.length, gap = Math.min(6, (FLOOR_W - 8) / n);
      const head = sprite(opts.selector.name + ': stand on a pad and press Space', { size: 24, color: text2 }); head.position.set(0, 0.4, PAD_Z + 3.2); scene.add(head);
      items.forEach((it, i) => {
        const x = (i - (n - 1) / 2) * gap;
        const disc = new T.Mesh(new T.CylinderGeometry(PAD_R, PAD_R, 0.16, 40), new T.MeshLambertMaterial({ color: lineC, emissive: accent, emissiveIntensity: 0 })); disc.position.set(x, 0.08, PAD_Z); scene.add(disc);
        const ring = new T.Mesh(new T.TorusGeometry(PAD_R + 0.12, 0.05, 8, 48), new T.MeshBasicMaterial({ color: accent })); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.18, PAD_Z); scene.add(ring);
        const lab = sprite(it, { size: 26, weight: 600 }); lab.position.set(x, 1.1, PAD_Z); scene.add(lab);
        pads.push({ it, x, z: PAD_Z, disc, ring });
      });
    }
    function paintPads() { const cur = opts.filter(); pads.forEach((p) => { const on = p.it === cur; p.disc.material.color.copy(on ? accent : lineC); p.disc.material.emissiveIntensity = on ? 0.5 : 0; p.ring.visible = on || p === w.near; }); }

    /* the walker */
    const P = { x: 0, y: 0, z: 14, vy: 0, yaw: 0, pitch: 0.06, ground: true, third: false };
    const body = new T.Mesh(new T.CylinderGeometry(RADIUS, RADIUS, 1.5, 16), new T.MeshLambertMaterial({ color: accent })); body.visible = false; scene.add(body);
    w.P = P; w.pads = pads; w.bars = bars;
    const head = new T.Mesh(new T.SphereGeometry(0.36, 16, 12), new T.MeshLambertMaterial({ color: accent })); head.visible = false; scene.add(head);
    function groundAt(x, z, y) {
      // highest solid under the walker that it could be standing on (its top is not above knee height)
      let g = 0, on = null;
      for (let i = 0; i < solids.length; i++) { const s = solids[i]; if (x > s.x0 - RADIUS * 0.5 && x < s.x1 + RADIUS * 0.5 && z > s.z0 - RADIUS * 0.5 && z < s.z1 + RADIUS * 0.5 && s.top <= y + 0.45 && s.top > g) { g = s.top; on = s; } }
      return { g, on };
    }
    function blocked(x, z, y) {
      for (let i = 0; i < solids.length; i++) { const s = solids[i]; if (x > s.x0 - RADIUS && x < s.x1 + RADIUS && z > s.z0 - RADIUS && z < s.z1 + RADIUS && s.top > y + 0.45) return true; }
      return false;
    }

    layout(true); paintPads();
    function resize() { const r = ui.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix(); }
    resize();
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(ui);

    /* input */
    const keys = w.keys;
    const MAP = { KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'sl', KeyD: 'sr', ArrowLeft: 'left', ArrowRight: 'right', KeyQ: 'left', KeyE: 'right' };
    function act() {
      if (w.near && P.ground && P.y < 0.3) { opts.setFilter(w.near.it); layout(false); paintPads(); return; }
      if (P.ground) { P.vy = JUMP_V; P.ground = false; }
    }
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) act(); return; }
      if (e.code === 'KeyV') { if (!e.repeat) { P.third = !P.third; body.visible = head.visible = P.third; } return; }
      if (MAP[e.code]) { keys[MAP[e.code]] = true; e.preventDefault(); }
    };
    const onKeyUp = (e) => { if (MAP[e.code]) keys[MAP[e.code]] = false; };
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKeyUp, true);
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; try { cv.setPointerCapture(e.pointerId); } catch (err) {} cv.focus(); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; P.yaw -= (e.clientX - drag[0]) * 0.005; P.pitch = Math.max(-1.2, Math.min(0.9, P.pitch - (e.clientY - drag[1]) * 0.004)); drag = [e.clientX, e.clientY]; });
    const endDrag = () => { drag = null; }; cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    ui.querySelectorAll('[data-hold]').forEach((b) => {
      const k = b.dataset.hold;
      const dn = (e) => { e.preventDefault(); if (k === 'jump') act(); else keys[k] = true; }, up = () => { if (k !== 'jump') keys[k] = false; };
      b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    });
    cv.focus();

    /* loop */
    const where = ui.querySelector('.walk-where');
    let last = performance.now(), lastWhere = '';
    function frame(now) {
      if (w.dead) return;
      w.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (w.rise) { const k = Math.min(1, (now - w.rise.t0) / w.rise.ms), e = k * k * (3 - 2 * k); bars.forEach((b) => setBar(b, b.from + (b.target - b.from) * e)); if (k >= 1) w.rise = null; }
      if (keys.left) P.yaw += 1.9 * dt; if (keys.right) P.yaw -= 1.9 * dt;
      const f = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0), s = (keys.sr ? 1 : 0) - (keys.sl ? 1 : 0);
      if (f || s) {
        const len = Math.hypot(f, s) || 1, sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
        const dx = ((-sin * f + cos * s) / len) * SPEED * dt, dz = ((-cos * f - sin * s) / len) * SPEED * dt;
        const lim = (v, m) => Math.max(-m, Math.min(m, v));
        const nx = lim(P.x + dx, FLOOR_W / 2 - RADIUS), nz = lim(P.z + dz, FLOOR_D / 2 - RADIUS);
        if (!blocked(nx, P.z, P.y)) P.x = nx;
        if (!blocked(P.x, nz, P.y)) P.z = nz;
      }
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      const gr = groundAt(P.x, P.z, P.y - P.vy * dt);
      if (P.y <= gr.g) { P.y = gr.g; P.vy = 0; P.ground = true; } else P.ground = false;
      // a bar that rises under or into the walker carries them up
      const lift = groundAt(P.x, P.z, P.y + 2); if (P.ground && lift.on && lift.on.bar && lift.g > P.y && lift.g - P.y < 2) P.y = lift.g;
      // camera
      const cp = Math.cos(P.pitch), dirx = -Math.sin(P.yaw) * cp, diry = Math.sin(P.pitch), dirz = -Math.cos(P.yaw) * cp;
      if (P.third) { camera.position.set(P.x - dirx * 7, P.y + EYE + 2.6 - diry * 4, P.z - dirz * 7); camera.lookAt(P.x, P.y + EYE, P.z); body.position.set(P.x, P.y + 0.75, P.z); head.position.set(P.x, P.y + 1.8, P.z); }
      else { camera.position.set(P.x, P.y + EYE, P.z); camera.lookAt(P.x + dirx, P.y + EYE + diry, P.z + dirz); }
      // what is under and around the walker
      let near = null; pads.forEach((p) => { if (Math.hypot(P.x - p.x, P.z - p.z) < PAD_R + 0.2) near = p; });
      if (near !== w.near) { w.near = near; paintPads(); }
      let msg = '';
      const on = P.ground && gr.on && gr.on.bar && Math.abs(P.y - gr.on.top) < 0.05 ? gr.on.bar : null;
      if (on) { const r = on.row; msg = '<b>Standing on ' + esc(r.label) + '</b><span>' + esc(r.text || '') + '</span>'; }
      else if (near && P.y < 0.3) msg = near.it === opts.filter() ? '<b>' + esc(opts.selector.name) + ': ' + esc(near.it) + '</b><span>This pad is on. The bars show it now.</span>' : '<b>Press Space</b><span>to show ' + esc(opts.selector.name) + ': ' + esc(near.it) + '</span>';
      else msg = '<b>' + esc(opts.selector ? opts.selector.name + ': ' + opts.filter() : opts.title) + '</b><span>Climb the steps in front of a bar to stand on its month.</span>';
      if (msg !== lastWhere) { where.innerHTML = msg; lastWhere = msg; }
      renderer.render(scene, camera);
    }
    w.raf = requestAnimationFrame(frame);
    w.dispose = () => {
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKeyUp, true);
      if (ro) ro.disconnect();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      renderer.dispose();
    };
    ui.classList.add('is-on');
  }

  function close(silent) {
    if (!W) return;
    const w = W; W = null; w.dead = true;
    cancelAnimationFrame(w.raf);
    if (w.dispose) w.dispose();
    w.ui.remove();
    if (!silent && w.onClose) w.onClose();
  }

  S.walk = { open, close, isOpen: () => !!W, state: () => W };
})();
