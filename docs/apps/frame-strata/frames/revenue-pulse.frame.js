var PG_CSS = __PIGMENT_CSS__;
(function () {
  'use strict';
  var root = document.getElementById('app');
  if (root.__cleanup) root.__cleanup();

  // SECTION: styles
  var FRAME_CSS = [
    '.rp-page{box-sizing:border-box;min-height:100%;padding:36px 32px;display:flex;flex-direction:column;gap:24px;}',
    '.rp-page.is-plain{background:var(--color-white);}',
    '.rp-filters{display:flex;align-items:center;gap:12px;}',
    '.rp-kpis{display:grid;grid-template-columns:repeat(var(--rp-kpi-cols,4),minmax(0,1fr));gap:16px;}',
    '.rp-kpi{gap:8px;}',
    '.rp-kpi.is-outlined{border:1px solid var(--border);}',
    '.rp-figure-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
    '.rp-figure-xl{font-size:36px;line-height:44px;font-weight:500;color:var(--text-primary);}',
    '.rp-chip-pos{background:var(--color-positive-10);}',
    '.rp-chip-pos .type-chip{color:var(--color-positive-90);}',
    '.rp-chip-neg{background:var(--color-negative-10);}',
    '.rp-chip-neg .type-chip{color:var(--color-negative-90);}',
    '.rp-body{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:24px;align-items:start;}',
    '.rp-body.is-single{grid-template-columns:minmax(0,1fr);}',
    '.rp-body.is-table-first{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);}',
    '.rp-section{display:flex;flex-direction:column;gap:12px;min-width:0;}',
    '.rp-side{display:flex;flex-direction:column;gap:24px;min-width:0;}',
    '.rp-chart-card{padding:16px;gap:8px;}',
    '.rp-legend{display:flex;gap:8px;}',
    '.rp-table-surface{border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--color-white);padding:0 12px;}',
    '.rp-table{width:100%;border-collapse:collapse;}',
    '.rp-table th{text-align:left;padding:12px 0;border-bottom:1px solid var(--border);}',
    '.rp-table td{padding:12px 0;border-bottom:1px solid var(--border);}',
    '.rp-table th + th,.rp-table td + td{padding-left:24px;text-align:right;}',
    '.rp-table tr:last-child td{border-bottom:none;}',
    '.rp-table tr.is-highlight td{background:var(--color-primary-10);}',
    '.rp-table tr.rp-total td{border-top:1px solid var(--color-grey-20);}',
    '.rp-headline{padding:16px 24px;border-radius:var(--radius-xs);}',
    '.rp-foot{display:flex;flex-direction:column;gap:4px;}',
    '.rp-error{padding:12px 16px;border-radius:var(--radius-xs);background:var(--color-negative-10);color:var(--color-negative-90);}',
    '.rp-loading{padding:48px;}',
    // presentation hints (Tune): only active when a control leaves its neutral position
    '.rp-page.has-space{gap:var(--rp-gap);padding:calc(var(--rp-gap) * 1.5) calc(var(--rp-gap) * 1.33);}',
    '.rp-page.has-space .rp-kpis{gap:calc(var(--rp-gap) * .66);}',
    '.rp-page.has-space .rp-body,.rp-page.has-space .rp-side{gap:var(--rp-gap);}',
    '.rp-page.has-round .card,.rp-page.has-round .rp-table-surface,.rp-page.has-round .rp-headline{border-radius:var(--rp-radius);}',
    '.rp-page.has-depth .card.is-elevated{box-shadow:var(--rp-shadow);}',
    '.rp-page.has-emph .rp-figure-row > span:first-child{font-size:var(--rp-fig);line-height:1.2;font-weight:var(--rp-figw);}',
    '.rp-chip-flat{background:var(--color-grey-10,rgba(0,0,0,.06));}',
    '.rp-chip-flat .type-chip{color:var(--color-grey-50);}'
  ].join('');
  var style = document.getElementById('pg-styles') || document.createElement('style');
  style.id = 'pg-styles';
  style.textContent = PG_CSS + FRAME_CSS;
  document.head.appendChild(style);
  root.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;overflow:auto;font-family:var(--font-sans);-webkit-font-smoothing:antialiased;background:var(--color-white);';
  // SECTION: styles end

  //#if v<2
  var PLAN_ATTAINMENT = 1.042; // TODO: wire to ARR Target once the block exists
  //#endif
  //#if v>=3
  var TARGET_COVERAGE = 3.0;
  //#endif

  // Optional presentation hints. Pigment ignores this; Framecraft sends it.
  var DEFAULT_TUNING = { color: 0.5, detail: 0.5, horizon: 0.5, specificity: 0.5, audience: 0.5, emphasis: 0.5, certainty: 0, round: 0.5, depth: 0.5, space: 0.5, precision: 0.5, alert: 0, headline: '', hide: [], highlights: [] };
  function withDefaults(t) { var o = {}; for (var key in DEFAULT_TUNING) o[key] = t && t[key] != null ? t[key] : DEFAULT_TUNING[key]; return o; }
  var tuning = withDefaults(window.StrataTuning ? window.StrataTuning.get() : null);
  function hidden(section) { return tuning.hide.indexOf(section) >= 0; }
  function neutral(v) { return Math.abs(v - 0.5) < 0.04; }

  var state = { kpis: null, months: null, segments: null, regions: [], region: 'All', error: null };
  var subs = [];
  var renderTimer = null;

  function hasLoadingKind(arr) {
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (item && typeof item === 'object' && item.kind === 'loading') return true;
    }
    return false;
  }
  function isReady(data) {
    for (var r = 0; r < data.rows.length; r++) {
      if (hasLoadingKind(data.rows[r].labels) || hasLoadingKind(data.rows[r].values)) return false;
    }
    return true;
  }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
  function dp() { return tuning.specificity > 0.7 || tuning.precision > 0.67 ? 2 : (tuning.precision < 0.2 ? 0 : 1); }

  function fmtMoney(v) {
    if (v == null) return '—';
    var a = Math.abs(v), s;
    if (a >= 1e9) s = (a / 1e9).toFixed(dp()) + 'B';
    else if (a >= 1e6) s = (a / 1e6).toFixed(dp()) + 'M';
    else if (a >= 1e3) s = (a / 1e3).toFixed(0) + 'K';
    else s = a.toFixed(0);
    return (v < 0 ? '-' : '') + '$' + s;
  }
  function fmtPct(v) { return v == null ? '—' : (v * 100).toFixed(dp()) + '%'; }
  function fmtInt(v) { return v == null ? '—' : Math.round(v).toLocaleString('en-US'); }
  function fmtDelta(v) { return v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%'; }
  function fmtMultiple(v) { return v == null ? '—' : v.toFixed(1) + 'x'; }
  function isHighlighted(label) {
    for (var i = 0; i < tuning.highlights.length; i++) if (tuning.highlights[i] === label) return true;
    return false;
  }

  function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 16); }

  function subscribe(name, key) {
    var sub = window.PigmentSDK.subscribeToDataSource(name, {
      onData: function (data) { if (!isReady(data)) return; state[key] = data; scheduleRender(); },
      onError: function (err) { state.error = err && err.message ? err.message : String(err); scheduleRender(); }
    });
    subs.push(sub);
    return sub;
  }

  subscribe('kpis', 'kpis');
  subscribe('bookingsByMonth', 'months');
  //#if v>=2
  subscribe('segmentTable', 'segments');
  //#endif
  //#if v>=3
  var regionSub = window.PigmentSDK.subscribeToItems('regionList', {
    onData: function (d) {
      state.regions = (d.items || []).map(function (it) { return typeof it === 'string' ? it : (it.name || it.label || String(it)); });
      scheduleRender();
    },
    onError: function () {}
  });
  function setRegion(name) {
    state.region = name;
    var filters = name === 'All' ? [] : [{ binding: 'regionList', selection: [name] }];
    subs.forEach(function (s) { s.updateDynamicFilters(filters); });
    scheduleRender();
  }
  //#endif

  function niceTicks(max, count) {
    if (!max || max <= 0) return [0];
    var raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var out = [];
    for (var t = 0; t <= max + step * 0.999; t += step) out.push(Math.round(t));
    return out;
  }

  function chartSvg(rows, width, height) {
    var padL = 52, padR = 8, padT = 22, padB = 28;
    var plotW = width - padL - padR, plotH = height - padT - padB;
    var colorful = tuning.color > 0.34;
    var showLabels = tuning.detail > 0.34;
    var hist = tuning.horizon < 0.34, fwd = tuning.horizon > 0.67;
    var max = 0;
    rows.forEach(function (r) {
      for (var c = 0; c < 3; c++) { var v = num(r.values[c]); if (v != null && v > max) max = v; }
    });
    var ticks = niceTicks(max, 4);
    var top = ticks[ticks.length - 1] || 1;
    var step = plotW / Math.max(1, rows.length);
    var barW = Math.max(4, Math.min(36, step * 0.56));
    var actualFill = colorful ? 'var(--color-chart-1)' : 'var(--color-grey-90)';
    var planStroke = colorful ? 'var(--color-chart-2)' : 'var(--color-grey-30)';
    var fcFill = colorful ? 'var(--color-chart-7)' : 'var(--color-grey-20)';
    var out = ['<svg width=\'' + width + '\' height=\'' + height + '\' viewBox=\'0 0 ' + width + ' ' + height + '\' role=\'img\' aria-label=\'Monthly bookings versus plan\'>'];
    ticks.forEach(function (t) {
      var y = padT + plotH - (t / top) * plotH;
      out.push('<line x1=\'' + padL + '\' x2=\'' + (width - padR) + '\' y1=\'' + y + '\' y2=\'' + y + '\' stroke=\'var(--color-grey-20)\' stroke-width=\'1\'/>');
      out.push('<text x=\'' + (padL - 8) + '\' y=\'' + (y + 4) + '\' text-anchor=\'end\' fill=\'var(--color-grey-50)\' font-size=\'11\'>' + fmtMoney(t) + '</text>');
    });
    var planPts = [];
    rows.forEach(function (r, i) {
      var cx = padL + step * i + step / 2;
      var a = num(r.values[0]), p = num(r.values[1]), f = num(r.values[2]);
      var lab = r.labels[0];
      var short = typeof lab === 'string' ? lab.split(' ')[0] : '';
      var hl = typeof lab === 'string' && isHighlighted(lab);
      if (a != null) {
        var h = (a / top) * plotH;
        out.push('<rect x=\'' + (cx - barW / 2) + '\' y=\'' + (padT + plotH - h) + '\' width=\'' + barW + '\' height=\'' + h + '\' rx=\'2\' fill=\'' + (hl ? 'var(--color-chart-4)' : actualFill) + '\' opacity=\'' + (fwd ? 0.45 : 1) + '\'/>');
        if (showLabels && !fwd) out.push('<text x=\'' + cx + '\' y=\'' + (padT + plotH - h - 6) + '\' text-anchor=\'middle\' fill=\'var(--color-grey-50)\' font-size=\'10\'>' + fmtMoney(a) + '</text>');
      } else if (f != null && !hist) {
        var hf = (f / top) * plotH;
        out.push('<rect x=\'' + (cx - barW / 2) + '\' y=\'' + (padT + plotH - hf) + '\' width=\'' + barW + '\' height=\'' + hf + '\' rx=\'2\' fill=\'' + fcFill + '\' stroke=\'' + actualFill + '\' stroke-dasharray=\'3 2\'/>');
        var spread = tuning.certainty > 0.02 ? f * tuning.certainty * 0.18 : 0;
        if (spread) {
          var yHi = Math.max(padT, padT + plotH - ((f + spread) / top) * plotH), yLo = padT + plotH - ((f - spread) / top) * plotH;
          out.push('<rect x=\'' + (cx - barW / 2 - 3) + '\' y=\'' + yHi + '\' width=\'' + (barW + 6) + '\' height=\'' + (yLo - yHi) + '\' rx=\'2\' fill=\'' + actualFill + '\' opacity=\'0.14\'/>');
          out.push('<path d=\'M' + (cx - 5) + ' ' + yHi + 'H' + (cx + 5) + 'M' + cx + ' ' + yHi + 'V' + yLo + 'M' + (cx - 5) + ' ' + yLo + 'H' + (cx + 5) + '\' stroke=\'' + actualFill + '\' stroke-width=\'1.5\' fill=\'none\'/>');
        }
        if (showLabels || fwd) out.push('<text x=\'' + cx + '\' y=\'' + ((spread ? Math.max(padT, padT + plotH - ((f + spread) / top) * plotH) : padT + plotH - hf) - 6) + '\' text-anchor=\'middle\' fill=\'var(--color-grey-90)\' font-size=\'10\'>' + fmtMoney(f) + '</text>');
      }
      if (p != null && !hist) planPts.push([cx, padT + plotH - (p / top) * plotH]);
      out.push('<text x=\'' + cx + '\' y=\'' + (height - 8) + '\' text-anchor=\'middle\' fill=\'' + (hl ? 'var(--color-grey-90)' : 'var(--color-grey-50)') + '\' font-size=\'11\'>' + esc(short) + '</text>');
    });
    if (planPts.length) {
      out.push('<polyline fill=\'none\' stroke=\'' + planStroke + '\' stroke-width=\'' + (1 + tuning.emphasis * 2).toFixed(1) + '\' points=\'' + planPts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '\'/>');
      planPts.forEach(function (p) { out.push('<circle cx=\'' + p[0] + '\' cy=\'' + p[1] + '\' r=\'3\' fill=\'var(--color-white)\' stroke=\'' + planStroke + '\' stroke-width=\'2\'/>'); });
    }
    out.push('</svg>');
    return out.join('');
  }

  function kpiCard(kicker, figure, chipText, chipPositive, sub, cls, change) {
    var h = ['<div class=\'card ' + cls + ' rp-kpi\'>'];
    h.push('<span class=\'type-kicker\'>' + esc(kicker) + '</span>');
    h.push('<div class=\'rp-figure-row\'><span class=\'' + (tuning.audience < 0.3 ? 'rp-figure-xl' : 'type-highlight-figure') + '\'>' + esc(figure) + '</span>');
    var flat = change != null && Math.abs(change) < tuning.alert * 0.1; // below the alert threshold a change stays grey
    if (chipText) h.push('<span class=\'chip ' + (flat ? 'rp-chip-flat' : chipPositive ? 'rp-chip-pos' : 'rp-chip-neg') + '\'><span class=\'type-chip\'>' + esc(chipText) + '</span></span>');
    h.push('</div>');
    if (sub && tuning.detail > 0.2) h.push('<span class=\'type-running-small\'>' + esc(sub) + '</span>');
    h.push('</div>');
    return h.join('');
  }

  function render() {
    var w = window.innerWidth;
    var k = state.kpis && state.kpis.rows[0] ? state.kpis.rows[0].values : [];
    var arr = num(k[0]), arrLy = num(k[1]), nnarr = num(k[2]), gm = num(k[3]);
    //#if v>=2
    var arrTarget = num(k[4]);
    var attainment = arr != null && arrTarget ? arr / arrTarget : null;
    //#endif
    //#if v<2
    var attainment = PLAN_ATTAINMENT;
    //#endif
    //#if v>=3
    var nnTarget = num(k[5]), pipeline = num(k[6]), arrForecast = num(k[7]);
    var coverage = pipeline != null && nnTarget ? pipeline / nnTarget : null;
    //#endif
    var growth = arr != null && arrLy ? (arr - arrLy) / arrLy : null;
    var colorful = tuning.color > 0.67, plain = tuning.color < 0.34;
    var cardCls = plain ? 'is-outlined' : (colorful ? 'is-elevated has-gradient' : 'is-elevated');
    var concise = tuning.detail < 0.34, detailed = tuning.detail > 0.67;
    var fwd = tuning.horizon > 0.67, hist = tuning.horizon < 0.34;
    var operator = tuning.audience > 0.67, exec = tuning.audience < 0.34;

    var html = [];
    var hints = [], vars = [];
    if (!neutral(tuning.space)) { hints.push('has-space'); vars.push('--rp-gap:' + Math.round(10 + tuning.space * 28) + 'px'); }
    if (!neutral(tuning.round)) { hints.push('has-round'); vars.push('--rp-radius:' + Math.round(tuning.round * 28) + 'px'); }
    if (!neutral(tuning.depth)) { hints.push('has-depth'); vars.push('--rp-shadow:' + (tuning.depth < 0.5 ? 'none' : '0 ' + Math.round(tuning.depth * 14) + 'px ' + Math.round(tuning.depth * 36) + 'px rgba(2,13,35,' + (tuning.depth * 0.22).toFixed(2) + ')')); }
    if (!neutral(tuning.emphasis)) { hints.push('has-emph'); vars.push('--rp-fig:' + Math.round(20 + tuning.emphasis * 24) + 'px', '--rp-figw:' + (tuning.emphasis > 0.5 ? 600 : 400)); }
    html.push('<div class=\'rp-page ' + (plain ? 'is-plain' : 'gradient-background') + (hints.length ? ' ' + hints.join(' ') : '') + '\' style=\'' + vars.join(';') + '\'>');
    html.push('<header class=\'page-header\'><div class=\'page-header-text\'><h1 class=\'type-screen-title\'>' + esc(tuning.headline || 'Revenue Pulse') + '</h1>');
    if (!concise) html.push('<p class=\'type-running-small\'>FY26 · actuals through Oct 2026' + (fwd ? ' · forecast Nov–Dec' : '') + '</p>');
    html.push('</div></header>');
    if (state.error) html.push('<div class=\'rp-error type-running-regular\'>' + esc(state.error) + '</div>');

    if (exec && attainment != null) {
      var ahead = attainment >= 1;
      html.push('<div class=\'card is-filled rp-headline\'><span class=\'type-content-title\'>ARR is ' + (ahead ? 'ahead of' : 'behind') + ' plan at ' + fmtPct(attainment) + ' attainment.</span></div>');
    }

    //#if v>=3
    html.push('<div class=\'rp-filters\'><span class=\'type-fieldset-small\'>Region</span><fieldset class=\'button-group\' aria-label=\'Region\'>');
    ['All'].concat(state.regions).forEach(function (r) {
      html.push('<label class=\'toggle-button button-small\'><input type=\'radio\' name=\'rp-region\' value=\'' + esc(r) + '\'' + (state.region === r ? ' checked' : '') + '/>' + esc(r) + '</label>');
    });
    html.push('</fieldset></div>');
    //#endif

    var cards = [];
    cards.push(kpiCard('ARR', fmtMoney(arr), hist || !fwd ? fmtDelta(growth) : null, growth == null || growth >= 0, hist ? 'vs last year' : 'Annual recurring revenue', cardCls, growth));
    //#if v>=3
    if (fwd) cards.push(kpiCard('ARR forecast, Dec', fmtMoney(arrForecast), null, true, 'Year-end projection', cardCls));
    var nnDelta = nnarr != null && nnTarget ? (nnarr - nnTarget) / nnTarget : null;
    cards.push(kpiCard('Net new ARR', fmtMoney(nnarr), fmtDelta(nnDelta), nnDelta == null || nnDelta >= 0, 'vs target ' + fmtMoney(nnTarget), cardCls, nnDelta));
    //#endif
    //#if v<3
    cards.push(kpiCard('Net new ARR', fmtMoney(nnarr), null, true, 'Trailing 12 months', cardCls));
    //#endif
    if (!concise && !fwd) cards.push(kpiCard('Gross margin', fmtPct(gm), null, true, 'Blended, actuals', cardCls));
    //#if v>=2
    cards.push(kpiCard('Plan attainment', fmtPct(attainment), null, true, 'ARR vs ' + fmtMoney(arrTarget) + ' target', cardCls));
    //#endif
    //#if v<2
    cards.push(kpiCard('Plan attainment', fmtPct(attainment), null, true, 'Of FY26 ARR plan', cardCls));
    //#endif
    if (!hidden('kpis')) html.push('<div class=\'rp-kpis\' style=\'--rp-kpi-cols:' + cards.length + '\'>' + cards.join('') + '</div>');

    var hasSide = false;
    //#if v>=2
    hasSide = !concise || operator;
    //#endif
    var showTable = !hidden('table'), showPipe = !hidden('pipeline'), showChart = !hidden('chart');
    var bodyCls = hasSide && showChart && (showTable || showPipe) ? (operator ? 'rp-body is-table-first' : 'rp-body') : 'rp-body is-single';
    html.push('<div class=\'' + bodyCls + '\'>');

    var chartHtml = [];
    chartHtml.push('<section class=\'rp-section\'><div class=\'section-header\'><div class=\'section-header-text\'><h2 class=\'type-section-title\'>' + (fwd ? 'Bookings outlook' : hist ? 'Bookings history' : 'Bookings vs plan') + '</h2></div></div>');
    chartHtml.push('<div class=\'card is-elevated rp-chart-card\'><div class=\'rp-legend\'>');
    chartHtml.push('<span class=\'chip\'><span class=\'chip-dot\' style=\'background:' + (tuning.color > 0.34 ? 'var(--color-chart-1)' : 'var(--color-grey-90)') + ';border:none\'></span><span class=\'type-chip\'>New bookings</span></span>');
    if (!hist) chartHtml.push('<span class=\'chip\'><span class=\'chip-dot\' style=\'background:' + (tuning.color > 0.34 ? 'var(--color-chart-2)' : 'var(--color-grey-30)') + ';border:none\'></span><span class=\'type-chip\'>Plan</span></span>');
    chartHtml.push('</div><div data-chart=\'bookings\'></div></div></section>');

    var sideHtml = [];
    //#if v>=2
    if (hasSide && (showTable || showPipe)) {
      sideHtml.push('<div class=\'rp-side\'>');
      if (showTable) {
      sideHtml.push('<section class=\'rp-section\'><div class=\'table-header\'><div class=\'table-header-text\'><h2 class=\'type-section-title\'>ARR by segment</h2></div></div>');
      sideHtml.push('<div class=\'rp-table-surface\'><table class=\'rp-table\'><thead><tr><th class=\'type-column-title\'>Segment</th><th class=\'type-column-title\'>ARR</th><th class=\'type-column-title\'>NRR</th>' + (detailed || operator ? '<th class=\'type-column-title\'>Customers</th>' : '') + '</tr></thead><tbody>');
      var segRows = state.segments ? state.segments.rows : [];
      var tArr = 0, tCust = 0, wNrr = 0;
      segRows.forEach(function (r) {
        var sArr = num(r.values[0]), sNrr = num(r.values[1]), sCust = num(r.values[2]);
        tArr += sArr || 0; tCust += sCust || 0; wNrr += (sNrr || 0) * (sArr || 0);
        var lab = typeof r.labels[0] === 'string' ? r.labels[0] : 'Unassigned';
        sideHtml.push('<tr class=\'' + (isHighlighted(lab) ? 'is-highlight' : '') + '\'><td class=\'type-running-regular\'>' + esc(lab) + '</td><td class=\'type-running-regular\'>' + fmtMoney(sArr) + '</td><td class=\'type-running-regular\'>' + fmtPct(sNrr) + '</td>' + (detailed || operator ? '<td class=\'type-running-regular\'>' + fmtInt(sCust) + '</td>' : '') + '</tr>');
      });
      if (segRows.length && !concise) {
        sideHtml.push('<tr class=\'rp-total\'><td class=\'type-running-heavy\'>Total</td><td class=\'type-running-heavy\'>' + fmtMoney(tArr) + '</td><td class=\'type-running-heavy\'>' + fmtPct(tArr ? wNrr / tArr : null) + '</td>' + (detailed || operator ? '<td class=\'type-running-heavy\'>' + fmtInt(tCust) + '</td>' : '') + '</tr>');
      }
      sideHtml.push('</tbody></table></div></section>');
      }
      //#if v>=3
      if (showPipe && (!concise || fwd)) {
        var good = coverage != null && coverage >= TARGET_COVERAGE;
        sideHtml.push('<section class=\'rp-section\'><div class=\'section-header\'><div class=\'section-header-text\'><h2 class=\'type-section-title\'>Pipeline</h2></div></div>');
        sideHtml.push(kpiCard('Pipeline coverage', fmtMultiple(coverage), 'Target ' + fmtMultiple(TARGET_COVERAGE), good, 'Open pipeline ' + fmtMoney(pipeline), cardCls));
        sideHtml.push('</section>');
      }
      //#endif
      sideHtml.push('</div>');
    }
    //#endif

    if (!showChart) chartHtml = [];
    if (operator) html.push(sideHtml.join('') + chartHtml.join(''));
    else html.push(chartHtml.join('') + sideHtml.join(''));
    html.push('</div>');

    if (detailed) {
      html.push('<footer class=\'rp-foot\'><span class=\'type-legal-notice\'>Plan attainment = ARR ÷ ARR Target. Growth compares ARR with ARR LY. Totals are computed in this frame.</span></footer>');
    }
    html.push('</div>');
    root.innerHTML = html.join('');

    var host = root.querySelector('[data-chart=\'bookings\']');
    if (host && state.months) {
      var cw = Math.max(240, host.clientWidth || (w - 96));
      host.innerHTML = chartSvg(state.months.rows, cw, concise ? 260 : 300);
    }
  }

  function onChange(e) {
    //#if v>=3
    if (e.target && e.target.name === 'rp-region') setRegion(e.target.value);
    //#endif
  }
  function onResize() { scheduleRender(); }
  var unTune = window.StrataTuning ? window.StrataTuning.subscribe(function (t) { tuning = withDefaults(t); scheduleRender(); }) : null;
  root.addEventListener('change', onChange);
  window.addEventListener('resize', onResize);
  root.innerHTML = '<div class=\'rp-loading type-running-small\'>Loading Revenue Pulse…</div>';

  root.__cleanup = function () {
    subs.forEach(function (s) { s.unsubscribe(); });
    //#if v>=3
    regionSub.unsubscribe();
    //#endif
    if (unTune) unTune();
    root.removeEventListener('change', onChange);
    window.removeEventListener('resize', onResize);
    clearTimeout(renderTimer);
    state = null;
  };
})();
