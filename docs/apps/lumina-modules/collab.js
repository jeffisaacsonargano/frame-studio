/* Lumina module: Collaboration (view id "collab", group Collaborate, fluid).
   Transcripts -> flow diagram pins, an Architecture Decision log, people, threads, a digest and a copy-ready brief.
   Rule-based throughout; Claude (ctx.ai) only refines on an explicit click. Transcripts stay with the viewer
   unless they choose "Share with team". Security: no network, no eval, no data-derived text through innerHTML
   (createElement / textContent only), ASCII-only source with no escape sequences. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var CC = String.fromCharCode, NL = CC(10), CR = CC(13), TAB = CC(9), AP = CC(39), MID = ' ' + CC(183) + ' ', ARROW = CC(8594), TIMES = CC(215), CHECK = CC(10003), ELL = CC(8230);
  var ICON = '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h9a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H7.5l-3 2.4v-2.4h-2z"/><circle cx="14.4" cy="14" r="1.7"/><path d="M11.2 12.2l1.7 1"/></svg>';
  var MAX_TX = 3, MAX_TX_KEEP = 6000, MAX_TX_LIVE = 60000, MAX_NOTES = 60, MAX_NOTE = 380;

  /* ---------- small helpers ---------- */
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function txt(v, max) { var s = String(v == null ? '' : v), o = '', i, c; max = max || 400; for (i = 0; i < s.length && o.length < max; i++) { c = s.charCodeAt(i); o += (c < 32 && c !== 10) || c === 127 ? ' ' : s.charAt(i); } return o; }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + ELL : s; }
  function hash(s) { var x = 5381, i; s = String(s); for (i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().split(CC(8217)).join(AP).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function stem(t) { return t.length > 3 && t.charAt(t.length - 1) === 's' && t.charAt(t.length - 2) !== 's' ? t.slice(0, -1) : t; }
  function toks(s) { var n = norm(s); return n ? n.split(' ').map(stem) : []; }
  function uniq(a) { var o = [], m = {}; a.forEach(function (x) { if (!m[x]) { m[x] = 1; o.push(x); } }); return o; }
  function fmtTime(sec) { if (sec == null || isNaN(sec)) return ''; var hh = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60); return (hh ? hh + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtWhen(ms) { try { var d = new Date(ms); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function lev(a, b, max) {   // edit distance with an early exit
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j, best;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; best = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1; prev = cur;
    }
    return prev[b.length];
  }
  function teq(a, b) {   // 2 exact, 1 fuzzy, 0 no
    if (a === b) return 2;
    if (b.length < 6 || a.charAt(0) !== b.charAt(0)) return 0;
    return lev(a, b, b.length >= 10 ? 2 : 1) <= (b.length >= 10 ? 2 : 1) ? 1 : 0;
  }
  // find seq inside tk: contiguous first, then in order with up to two skipped words, each word exact or a near miss
  function findLoose(tk, seq) {
    var out = [], i, j, k, q, skips, exact, e;
    for (i = 0; i < tk.length; i++) {
      e = teq(tk[i], seq[0]); if (!e) continue;
      exact = e === 2; k = i; skips = 0;
      for (j = 1; j < seq.length; j++) {
        q = 0;
        while (k + 1 < tk.length) { k++; q = teq(tk[k], seq[j]); if (q) break; skips++; if (skips > 2) break; }
        if (!q || skips > 2) { k = -1; break; }
        if (q === 1) exact = false;
      }
      if (k < 0) continue;
      out.push({ s: i, e: k, exact: exact && skips === 0 });
    }
    return out;
  }

  /* ---------- the model's vocabulary ---------- */
  var REGIONS = { NAM: ['Canada', 'United States'], LATAM: ['Brazil', 'Mexico'], APAC: ['Australia', 'Hong Kong', 'Japan', 'South Korea', 'New Zealand', 'Singapore'],
    EMEA: ['United Arab Emirates', 'Austria', 'Switzerland', 'Germany', 'Spain', 'France', 'United Kingdom', 'Ireland', 'Italy', 'Netherlands', 'Norway', 'Poland', 'Sweden', 'South Africa'] };
  var REGION_SYN = { NAM: ['north america', 'u s', 'usa', 'the states'], LATAM: ['latin america', 'south america'], APAC: ['asia pacific', 'asia'], EMEA: ['europe', 'european', 'uk', 'middle east'] };
  var CHANNEL_SYN = { 'Direct': ['direct', 'dtc', 'd2c', 'web store', 'online store'], 'Marketplace': ['marketplace', 'amazon'], 'Retail': ['retail', 'retailer', 'specialist retail', 'general retail', 'sell in'], 'B2B Direct': ['b2b', 'business customers'] };
  var TOPICS = { growth: ['growth', 'growing', 'year over year', 'yoy', 'fastest'], budget: ['budget', 'variance', 'forecast', 'landing', 'baseline', 'phasing', 'vs plan'], margin: ['margin', 'discount', 'promo', 'price'],
    fx: ['fx', 'currency', 'exchange rate', 'yen', 'euro', 'peso', 'pound', 'the real', 'hedging', 'translation', 'constant currency'], launches: ['launch', 'launched', 'generation', 'gen 1', 'gen 2', 'post mortem', 'on shelf', 'stock out'], channels: ['channel', 'marketplace', 'retail', 'direct', 'b2b', 'channel mix'] };
  var TOPIC_NAME = { growth: 'Growth', budget: 'Budget gap', margin: 'Margin', fx: 'FX risk', launches: 'Launches', channels: 'Channels' };
  var TOPIC_NODE = { fx: 'fxi', budget: 'aB', channels: 'ch', launches: 'ageR', margin: 'mDisc', growth: 'vNR' };
  var GENERIC = { product: 1, country: 1, channel: 1, month: 1, year: 1, region: 1, version: 1, currency: 1, category: 1, item: 1, customer: 1, campaign: 1 };
  // spoken names for parts of the flow, keyed by the frame's own ids; ids that are absent are simply skipped
  var SYN = {
    ns_so: ['sales order'], ns_inv: ['invoice', 'billed revenue'], ns_cm: ['credit memo', 'refund'], ns_item: ['item master', 'item record', 'netsuite item', 'the item'], ns_cust: ['customer record', 'customer master'],
    ns_sub: ['subsidiary', 'legal entity'], ns_fx: ['netsuite currency rate', 'daily rate', 'netsuite rate'], raw_tl: ['transaction line', 'fivetran', 'raw landing'],
    m_rev: ['fct net revenue', 'revenue fact', 'net revenue model', 'fact table'], m_prod: ['dim product', 'product model'], m_ctry: ['dim country', 'country mapping', 'region mapping'], m_chan: ['dim channel'],
    m_fx: ['fx rates monthly', 'monthly average', 'monthly rate', 'average rate', 'month end rate', 'rates source'], m_camp: ['dim campaign'],
    x_amz: ['amazon settlement', 'settlement file', 'marketplace file', 'settlement', 'external stage'], x_bud: ['budget submission', 'budget file', 'budget csv'],
    tSales: ['sales actuals', 'actuals list', 'actuals import'], tBud: ['sales budget', 'budget list', 'budget import'],
    dProduct: ['product dimension', 'product list', 'launch month', 'launch date'], dCountry: ['country dimension', 'country list', 'market tier'], dRegion: ['region dimension', 'region rollup'],
    dChan: ['channel dimension', 'channel list'], dCur: ['currency dimension'], dVer: ['version dimension', 'forecast version'], dAge: ['months since launch'],
    mNet: ['net revenue'], mGross: ['gross revenue'], mUnits: ['units sold', 'unit volume'], mLC: ['local currency revenue', 'local currency'], bNet: ['budget net revenue', 'budget revenue'],
    fxA: ['actual fx rate', 'actual rate'], fxB: ['budget fx rate', 'budget rate', 'bud fx rate', 'december rate'], vNR: ['net revenue by version'],
    aV: ['variance view', 'variance number', 'budget variance'], aB: ['budget vs actual', 'budget versus actual', 'actual vs budget', 'behind budget', 'ahead of budget', 'against budget'],
    ch: ['revenue by channel', 'channel revenue'], chP: ['channel share', 'marketplace share'], cc: ['constant currency', 'at budget fx'],
    fxi: ['fx impact', 'currency impact', 'currency effect', 'fx drag', 'tailwind', 'headwind'], usdC: ['revenue by country', 'top eight countries'], lcC: ['net revenue lc by country', 'local currency by country'],
    ageR: ['launch curve', 'revenue by product age'], age: ['product age'], mDisc: ['discount'], mDiscP: ['discount percentage', 'discount pct'],
    sLast: ['last actual month', 'actuals cutoff'], sCfg: ['frame config', 'frame setting'], dReq: ['change request'], board: ['sales performance board', 'exec pack'],
    'w:trend': ['trend chart', 'trend line', 'revenue trend'], 'w:kpi2': ['budget vs actual kpi', 'budget kpi', 'variance kpi'], 'w:channel': ['channel mix chart', 'channel chart', 'channel mix'],
    'w:launch': ['launch chart', 'launch curves', 'launch curve chart'], 'w:fx': ['fx chart', 'currency chart'], 'w:kpi3': ['fx tile', 'fx kpi'], 'w:header': ['headline', 'frame header']
  };
  var WNAME = { trend: 'Revenue trend chart', kpi1: 'Growth KPI', kpi2: 'Budget vs actual KPI', channel: 'Channel mix chart', launch: 'Launch curves chart', fx: 'FX by country chart', kpi3: 'FX impact KPI', header: 'Headline and settings' };
  var NEG = ['risk', 'miss', 'behind', 'wrong', 'broken', 'stale', 'worry', 'worries', 'concern', 'issue', 'gap', 'short', 'late', 'mismatch', 'problem', 'drag', 'headwind', 'hurt', 'lag', 'missing', 'misleading', 'overstating', 'unfair', 'dip', 'dipped', 'slipped', 'worse', 'caution', 'reconcile', 'dropped'].map(stem);
  var POS = ['ahead', 'beat', 'strong', 'good', 'great', 'healthy', 'clean', 'tailwind', 'bright', 'growing', 'fastest', 'steeper', 'up', 'current'].map(stem);
  var CUE_AGREED = ['we decided', 'decided to', 'decision is', 'we agreed', 'it s settled', 'we re going with', 'we are going with', 'final call', 'going forward', 'from now on'];
  var CUE_PROP = ['let s', 'we should', 'i propose', 'i suggest', 'proposal is', 'we need to', 'plan is to', 'why don t we', 'i d keep', 'i d like to', 'i recommend', 'we will', 'we ll', 'we re going to', 'we are going to', 'fix it in'];
  var CUE_ACT = ['action item', 'i ll', 'i will', 'i can take', 'will own', 'to own', 'follow up with'];
  var CUE_Q = ['should we', 'do we', 'can we', 'who owns', 'who will', 'what if', 'how do we', 'are we', 'when do we', 'is it worth'];
  var CUE_YES = ['agreed', 'sounds good', 'works for me', 'fine by me', 'makes sense', 'approved', 'let s do it', 'i m good with', 'yes'];
  var CUE_NO = ['i disagree', 'not sure', 'i m not sure', 'i don t think', 'push back', 'hold on'];
  var CUE_SUP = ['instead of', 'rather than', 'no longer', 'scrap', 'revert'];
  var CUE_SKIP = ['let s start', 'let s move', 'let s look', 'let s go', 'let s begin', 'let s turn', 'let s talk', 'let s see'];
  var CUE_WHY = ['because', 'the reason', 'so that', 'the problem is', 'the issue is', 'otherwise', 'that means'];
  var DUE = {}; ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'end', 'of', 'the', 'week', 'month', 'quarter', 'next', 'tomorrow', 'close', 'eod', 'day'].forEach(function (w) { DUE[w] = 1; });
  var STATUS = { proposed: 'Proposed', agreed: 'Agreed', open: 'Open question', superseded: 'Superseded' };

  /* ---------- sample transcripts (illustrative; written against the frame's model) ---------- */
  function sample(id, title, when, lines) {
    return { id: id, title: title, sample: true, at: when, text: lines.map(function (l) { return '[' + l[0] + '] ' + l[1] + ': ' + l[2]; }).join(NL) };
  }
  var MC = 'Maya Chen (CFO)', DO = 'Daniel Okafor (VP Sales EMEA)', PR = 'Priya Raman (FP&A)', TB = 'Tom Becker (Data engineering)', KS = 'Kenji Sato (APAC GM)', AB = 'Aisha Bello (Channel ops)', CV = 'Carlos Vega (LATAM GM)', SM = 'Sofia Marin (Treasury)', LF = 'Lena Fischer (Product)';
  var SAMPLES = [
    sample('s-forecast', 'Q2 forecast review', Date.UTC(2026, 6, 14, 15), [
      ['00:12', MC, "Let's start with budget versus actual. Year to date we're about three percent behind budget on net revenue, and almost all of that gap is EMEA."],
      ['00:41', DO, "EMEA is the problem, yes. Germany and the UK are both short, and Retail is where it hurts. Specialist retail sell-in slipped after the Watch SE Gen 2 launch."],
      ['01:15', PR, "One caution on the variance number. The budget file was loaded once in January, so Sales Budget still has the old EMEA phasing. I worry the budget vs actual KPI is overstating the miss."],
      ['01:48', MC, "Should we reload the budget submission mid-year, or keep the original as the baseline?"],
      ['02:10', PR, "I'd keep the original budget file. We should add a forecast version next to Actual and Budget, so the trend chart shows where we expect to land."],
      ['02:36', MC, "Agreed. Going forward the Version dimension carries Actual, Budget and Forecast, and the budget file stays frozen."],
      ['03:02', TB, "That means a new import into Pigment. I'll draft the forecast load from Snowflake into Sales Actuals by Friday."],
      ['03:30', KS, "APAC is slightly ahead of budget, mostly Japan. Marketplace is strong there, but the Amazon settlements file lands weekly, so the last week of June is missing from Sales Actuals."],
      ['04:05', TB, "Correct, the marketplace file is a weekly drop into the external stage. The FCT_NET_REVENUE model is hourly, so Direct and Retail are current and Marketplace lags."],
      ['04:31', AB, "The channel mix chart is misleading then. Marketplace share looks like it dropped in June and it did not."],
      ['04:52', MC, "Let's flag the latest month as provisional on the channel mix chart until the settlement file is loaded."],
      ['05:10', AB, "Sounds good. I can take that with Tom."],
      ['05:28', CV, "LATAM is the bright spot. We are ahead of budget in Brazil and Mexico, and Direct is growing fastest. Buds Pro ANC is carrying it."],
      ['05:55', MC, "Good. Who owns the EMEA retail recovery plan?"],
      ['06:08', DO, "I'll own it. We need to split Retail into Specialist and General in the variance view, because the EMEA miss is all Specialist."],
      ['06:34', PR, "We decided last quarter to report revenue by channel at the top level only, but that no longer works for EMEA."],
      ['06:50', MC, "Then we'll show the Retail split in the revenue by channel view for EMEA. Priya, can you raise the change by end of week?"]
    ]),
    sample('s-fx', 'FX risk call', Date.UTC(2026, 6, 21, 14), [
      ['00:08', SM, "FX impact is now a real drag. On the FX tile we are showing a negative impact year to date, and Japan is the biggest piece because of the yen."],
      ['00:35', KS, "Japan local currency revenue is actually up. It is only the translation to USD that hurts."],
      ['00:58', PR, "Right, ACT Net Revenue LC by Country is up for Japan. The FX Impact USD metric compares actual rates against the budget FX rate, and the budget rate for the yen was set in December."],
      ['01:30', SM, "The problem is the rates source. NetSuite currency rates are daily, FX_RATES_MONTHLY averages them, and the budget rate in Pigment is one number per currency. Those three do not reconcile for Brazil."],
      ['02:02', TB, "The monthly average in Snowflake is a simple mean of the daily rates. If treasury wants month-end rates, I need to change the dbt model."],
      ['02:25', SM, "Should we use month-end rates or monthly averages for the restatement?"],
      ['02:40', MC, "Averages for revenue, that is standard. We'll keep FX_RATES_MONTHLY as the average and add a month-end column for treasury."],
      ['03:05', TB, "Works for me. I'll add the column to FX_RATES_MONTHLY by next week."],
      ['03:22', CV, "For LATAM the real and the peso moved in opposite directions. Can we see FX impact by region and not only the top eight countries?"],
      ['03:48', MC, "Yes. Let's add a region view to the FX chart, with EMEA, APAC, LATAM and NAM as the first level."],
      ['04:10', DO, "EMEA gets a small tailwind from the euro and the pound, so our underlying miss against budget is worse than the reported number. That worries me."],
      ['04:36', PR, "That is what constant currency shows. ACT Net Revenue USD at Budget FX strips the currency effect out."],
      ['04:58', MC, "Going forward, every budget vs actual number in the exec pack is shown at constant currency next to reported."],
      ['05:20', SM, "Agreed. And we should refresh the budget FX rate each quarter instead of keeping the December rate all year."],
      ['05:44', PR, "That changes what we said in the forecast review about keeping the budget frozen. I'm not sure we want a moving budget rate."],
      ['06:05', MC, "Fair. Do we refresh the budget rate quarterly, or hold it and report a separate forecast rate?"],
      ['06:22', SM, "I'll bring a hedging proposal for the yen and the real by month end."]
    ]),
    sample('s-launch', 'Watch SE Gen 2 launch post-mortem', Date.UTC(2026, 7, 4, 16), [
      ['00:10', LF, "Watch SE Gen 2 is six months in. On the launch curves it tracks ahead of Gen 1 at the same age, which is good, but month three dipped."],
      ['00:38', AB, "Month three was the Marketplace stock-out. Amazon was out for two weeks, and Direct did not pick up the demand."],
      ['01:02', DO, "In EMEA the dip was worse. Specialist Retail got the allocation late in Germany and France."],
      ['01:26', LF, "There is also a data problem. The launch date in NetSuite Items was the announcement date, not the on-shelf date, so Months Since Launch is off by one for Watch SE Gen 2."],
      ['01:52', TB, "DIM_PRODUCT takes the launch month straight from the item record. If the item is wrong in NetSuite, the launch curve shifts."],
      ['02:15', LF, "We should fix the launch date at the source in the item master, not patch it in Pigment."],
      ['02:32', MC, "Agreed. Fix it in the item master, and the Product dimension picks it up on the next load."],
      ['02:50', TB, "I'll correct the item record and rerun DIM_PRODUCT by Wednesday."],
      ['03:08', KS, "APAC launched four weeks later than NAM. Comparing regions on calendar months is unfair. Should we line regions up by their own launch date?"],
      ['03:34', LF, "Good question. Today product age is per product, not per country."],
      ['03:52', PR, "That is a bigger model change, because product age by country means a new metric and a new data source for the frame."],
      ['04:15', MC, "Let's not do that yet. Instead of a product age per country, we'll add a note on the launch chart that APAC started a month later."],
      ['04:40', LF, "Fine by me. Buds Pro ANC is the comparison I care about. Its launch curve was steeper than Buds Pro, and we expected the same step-up for the watch."],
      ['05:05', CV, "LATAM saw strong Gen 2 demand through Direct, but the discount was deep. Net revenue looks great and the discount percentage doubled."],
      ['05:30', MC, "We need to put discount next to the launch curve, otherwise we celebrate the wrong thing."],
      ['05:48', PR, "I can take that. I'll propose a discount overlay on the launch chart by Friday."],
      ['06:05', AB, "And who owns the Marketplace stock-out follow up with Amazon?"],
      ['06:18', LF, "I will own it."]
    ])
  ];

  /* ---------- transcript parsing (plain text and WebVTT; no regular expressions over the text) ---------- */
  function isDigit(c) { return c >= '0' && c <= '9'; }
  function readTime(s, i) {
    var j = i, parts = [], num = '', c, sec = 0;
    while (j < s.length) { c = s.charAt(j); if (isDigit(c)) num += c; else if (c === ':' && num) { parts.push(num); num = ''; } else break; j++; }
    if (!num || !parts.length || parts.length > 2 || num.length !== 2) return null;
    parts.push(num);
    if ((s.charAt(j) === '.' || s.charAt(j) === ',') && isDigit(s.charAt(j + 1))) { j++; while (j < s.length && isDigit(s.charAt(j))) j++; }
    parts.forEach(function (p) { sec = sec * 60 + parseInt(p, 10); });
    return { sec: sec, end: j };
  }
  function stripTags(s) { var o = '', depth = 0, i, c; for (i = 0; i < s.length; i++) { c = s.charAt(i); if (c === '<') depth++; else if (c === '>' && depth) depth--; else if (!depth) o += c; } return o; }
  function nameLike(p) {
    if (!p || p.length > 40) return false;
    var w = p.split(' ').filter(Boolean), i, j, c, code;
    if (!w.length || w.length > 4) return false;
    for (i = 0; i < w.length; i++) {
      c = w[i].charAt(0); if (!(c >= 'A' && c <= 'Z')) return false;
      for (j = 0; j < w[i].length; j++) { code = w[i].charCodeAt(j); c = w[i].charAt(j); if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || isDigit(c) || c === '.' || c === '-' || c === AP || c === '&' || code > 191)) return false; }
    }
    return true;
  }
  function parseTranscript(text) {
    var lines = String(text || '').split(CR).join('').split(NL), out = [], pend = null, cur = null, lastSp = '', n, s, k, t0, time, sp, role, g, c, p, q, pre, inner, tt, rest;
    for (n = 0; n < lines.length && out.length < 400; n++) {
      s = lines[n].split(TAB).join(' ').trim();
      if (!s) { cur = null; continue; }
      if (s.indexOf('WEBVTT') === 0 || s.indexOf('NOTE') === 0) continue;
      if (s.indexOf('-->') > 0) { t0 = readTime(s, 0); pend = t0 ? t0.sec : null; cur = null; continue; }
      if (s.split('').every(isDigit)) continue;
      time = null; sp = ''; role = '';
      k = s.charAt(0) === '[' || s.charAt(0) === '(' ? 1 : 0; t0 = readTime(s, k);
      if (t0) { time = t0.sec; k = t0.end; if (s.charAt(k) === ']' || s.charAt(k) === ')') k++; s = s.slice(k).trim(); if (s.charAt(0) === '-') s = s.slice(1).trim(); }
      if (s.indexOf('<v ') === 0) { g = s.indexOf('>'); if (g > 0) { sp = s.slice(3, g).trim(); s = s.slice(g + 1); } }
      s = stripTags(s).trim();
      if (!sp) {
        p = s.indexOf('('); if (p < 0) p = s.indexOf('['); c = s.indexOf(':');
        if (p > 0 && p < 44 && (c < 0 || p < c || true)) {
          q = s.indexOf(s.charAt(p) === '(' ? ')' : ']', p);
          pre = s.slice(0, p).trim(); rest = q > 0 ? s.slice(q + 1).trim() : '';
          if (q > 0 && nameLike(pre) && (rest.charAt(0) === ':' || !rest)) {
            inner = s.slice(p + 1, q).trim(); tt = readTime(inner, 0);
            if (tt) time = tt.sec; else role = inner;
            sp = pre; s = rest.charAt(0) === ':' ? rest.slice(1).trim() : '';
          }
        }
        if (!sp && c > 0 && c <= 44) { pre = s.slice(0, c).trim(); if (nameLike(pre)) { sp = pre; s = s.slice(c + 1).trim(); } }
      }
      if (sp) { cur = { sp: txt(sp, 40), role: txt(role, 40), t: time != null ? time : pend, text: s }; lastSp = cur.sp; out.push(cur); pend = null; }
      else if (cur) cur.text += (cur.text ? ' ' : '') + s;
      else { cur = { sp: lastSp || 'Speaker', role: '', t: time != null ? time : pend, text: s }; out.push(cur); pend = null; }
    }
    return out.filter(function (u) { u.text = txt(u.text, 1200).trim(); return !!u.text; }).map(function (u, i) { u.i = i; return u; });
  }
  function sentences(text) {
    var out = [], cur = '', i, c, nx;
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i); cur += c; nx = text.charAt(i + 1);
      if ((c === '.' || c === '!' || c === '?') && (!nx || nx === ' ') && !(c === '.' && isDigit(text.charAt(i - 1)) && isDigit(text.charAt(i + 2)))) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function hasCue(padded, list) { for (var i = 0; i < list.length; i++) if (padded.indexOf(' ' + list[i] + ' ') >= 0) return list[i]; return ''; }

  /* ---------- the module ---------- */
  function createView() {
    var ctx = null, root = null, offs = [], timers = [], obs = null, alive = 0;
    var G = null, ENT = [], NODE_ALL = {}, cache = {}, S = null, ST = null, U = {};

    function later(fn, ms) { var t = window.setTimeout(function () { var i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); fn(); }, ms); timers.push(t); return t; }
    function reduced() { try { return !!ctx.motion.reduced(); } catch (e) { return true; } }
    function rise(el, opts) { try { if (!reduced() && el) return ctx.motion.rise(el, opts); } catch (e) {} return null; }
    function toast(m) { try { ctx.toast(m); } catch (e) {} }
    function say(m) { try { ctx.say(m); } catch (e) {} }
    function btn(cls, label, fn, title) { var b = h('button', 'cb-b' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', function (ev) { ev.preventDefault(); fn(b, ev); }); return b; }
    function chip(cls, label, fn, title) { var b = h(fn ? 'button' : 'span', 'cb-chip' + (cls ? ' ' + cls : ''), label); if (fn) { b.type = 'button'; b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(b); }); } if (title) b.title = title; return b; }
    // every write goes through here: the button shows a waiting state while the host's approval sheet (and Pigment's own prompt) is open
    function waitOn(b, label, run, done) {
      if (b.disabled) return; var was = b.textContent, tok = alive;
      b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = label; b.classList.add('wait');
      var p; try { p = Promise.resolve(run()); } catch (e) { p = Promise.reject(e); }
      p.then(function (res) { return res; }, function (e) { return { ok: false, msg: 'Not written: ' + txt((e && e.message) || e || 'declined', 140) }; }).then(function (res) {
        if (tok !== alive) return;
        b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = was; b.classList.remove('wait');
        done(res);
      });
    }

    /* ----- persisted state: validated field by field on the way in, capped on the way out ----- */
    function strArr(a, max, len) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x.length <= (len || 60); }).slice(0, max) : []; }
    function loadState() {
      var raw = null, st = { v: 1, me: '', active: SAMPLES[0].id, dec: {}, manual: [], notes: [], seen: null };
      try { raw = ctx.store.get('collab'); } catch (e) {}
      if (!raw || typeof raw !== 'object') return st;
      if (typeof raw.me === 'string') st.me = txt(raw.me, 40);
      if (typeof raw.active === 'string') st.active = txt(raw.active, 40);
      if (raw.dec && typeof raw.dec === 'object') Object.keys(raw.dec).slice(0, 80).forEach(function (id) {
        var d = raw.dec[id], o = {}; if (!d || typeof d !== 'object' || id.length > 40) return;
        if (STATUS[d.status]) o.status = d.status; if (typeof d.text === 'string') o.text = txt(d.text, 300); if (typeof d.owner === 'string') o.owner = txt(d.owner, 60); if (typeof d.due === 'string') o.due = txt(d.due, 30);
        if (Array.isArray(d.nodes)) o.nodes = strArr(d.nodes, 8); if (d.accepted === true) o.accepted = true; if (typeof d.sentReq === 'number') o.sentReq = d.sentReq; if (typeof d.sentTask === 'number') o.sentTask = d.sentTask;
        st.dec[id] = o;
      });
      if (Array.isArray(raw.manual)) raw.manual.slice(0, 20).forEach(function (d) { if (d && typeof d.id === 'string' && typeof d.text === 'string') st.manual.push({ id: txt(d.id, 40), text: txt(d.text, 300), at: typeof d.at === 'number' ? d.at : 0 }); });
      if (Array.isArray(raw.notes)) raw.notes.slice(0, MAX_NOTES).forEach(function (n) {
        if (!n || typeof n.id !== 'string' || typeof n.text !== 'string') return;
        st.notes.push({ id: txt(n.id, 40), anchor: txt(n.anchor || 'general', 60), text: txt(n.text, MAX_NOTE), by: txt(n.by || 'You', 40), at: typeof n.at === 'number' ? n.at : 0, parent: typeof n.parent === 'string' ? txt(n.parent, 40) : '', posted: typeof n.posted === 'number' ? n.posted : 0 });
      });
      if (raw.seen && typeof raw.seen === 'object' && typeof raw.seen.at === 'number') {
        st.seen = { at: raw.seen.at, dec: strArr(raw.seen.dec, 200, 40), notes: strArr(raw.seen.notes, 100, 40), tx: strArr(raw.seen.tx, 12, 40), status: {}, sig: {} };
        if (raw.seen.status && typeof raw.seen.status === 'object') Object.keys(raw.seen.status).slice(0, 200).forEach(function (k) { if (STATUS[raw.seen.status[k]]) st.seen.status[k] = raw.seen.status[k]; });
        if (raw.seen.sig && typeof raw.seen.sig === 'object') ['avb', 'fx'].forEach(function (k) { if (typeof raw.seen.sig[k] === 'number' && isFinite(raw.seen.sig[k])) st.seen.sig[k] = raw.seen.sig[k]; });
      }
      return st;
    }
    function save() {
      var keys = Object.keys(ST.dec); if (keys.length > 80) keys.slice(0, keys.length - 80).forEach(function (k) { delete ST.dec[k]; });
      if (ST.notes.length > MAX_NOTES) ST.notes = ST.notes.slice(ST.notes.length - MAX_NOTES);
      try { Promise.resolve(ctx.store.set('collab', ST)).then(null, function () { toast('Could not save collaboration notes on this device.'); }); } catch (e) {}
    }
    function loadTx() {
      var list = SAMPLES.slice(), raw = null, sh = null;
      try { raw = ctx.store.get('collabTx'); } catch (e) {}
      if (Array.isArray(raw)) raw.slice(0, MAX_TX).forEach(function (t) { if (t && typeof t.id === 'string' && typeof t.text === 'string' && t.text.length <= MAX_TX_LIVE) list.push({ id: txt(t.id, 40), title: txt(t.title || 'Transcript', 80), text: t.text, at: typeof t.at === 'number' ? t.at : 0, mine: true, shared: t.shared === true }); });
      try { sh = ctx.store.get('collabShared'); } catch (e) {}
      if (sh && typeof sh === 'object' && typeof sh.text === 'string' && sh.text.length <= 12000 && typeof sh.id === 'string' && !list.some(function (t) { return t.id === sh.id; })) list.push({ id: txt(sh.id, 40), title: txt(sh.title || 'Shared transcript', 80), text: sh.text, at: typeof sh.at === 'number' ? sh.at : 0, team: true, by: txt(sh.by, 40) });
      return list;
    }
    function saveTx() {
      var mine = S.tx.filter(function (t) { return t.mine; }).slice(-MAX_TX).map(function (t) { return { id: t.id, title: t.title, text: t.text.slice(0, MAX_TX_KEEP), at: t.at, shared: !!t.shared }; });
      try { Promise.resolve(ctx.store.set('collabTx', mine)).then(null, function () { toast('This transcript is too large to keep after you leave; it stays for this session.'); }); } catch (e) {}
    }

    /* ----- entity dictionary: every node of the lineage plus regions, channels, products and topics ----- */
    function buildEntities() {
      var L = ctx.lineage || {}, blocks = L.blocks || ctx.blocks || [], list = [], counts = {}, d;
      NODE_ALL = {};
      function node(id, name, kind, sub, says) { if (typeof id !== 'string' || !id || NODE_ALL[id]) return; NODE_ALL[id] = { id: id, name: txt(name || id, 70), kind: kind, sub: txt(sub, 90), says: txt(says, 260) }; }
      (L.sources || []).forEach(function (s) { if (s && !s.block) node(s.id, s.name, s.system === 'erp' ? 'erp' : s.system === 'raw' ? 'raw' : s.system === 'ext' ? 'ext' : 'model', s.sub, s.says); });
      blocks.forEach(function (b) { if (b && b.kind !== 'frame') node(b.id, b.name, b.kind || 'metric', b.folder, b.says); });
      (L.dataSources || []).forEach(function (x) { if (x && x.name) node('ds:' + x.name, x.name, 'ds', x.values, 'Frame data source' + (x.labels ? ', rows by ' + x.labels : '')); });
      (L.widgets || []).forEach(function (w) { if (!w) return; if (w.ds) node('ds:' + w.ds, w.ds, 'ds', '', 'Frame data source'); if (w.widget) node('w:' + w.widget, WNAME[w.widget] || w.widget, 'widget', w.how, 'Frame widget'); });
      function ent(type, id, label, phrases) {
        var al = [], seen = {};
        phrases.forEach(function (p) { var t = toks(p[0]); if (!t.length || t.length > 7) return; var key = t.join(' '); if (seen[key]) return; seen[key] = 1; al.push({ t: t, w: p[1], key: key }); });
        if (al.length) list.push({ type: type, id: id, label: label, al: al });
      }
      Object.keys(NODE_ALL).forEach(function (id) {
        var n = NODE_ALL[id], ph = [], t = toks(n.name), short;
        if (t.length > 1 || (t.length === 1 && !GENERIC[t[0]] && t[0].length > 3)) ph.push([n.name, 1.2]);
        short = t.filter(function (x) { return x !== 'act' && x !== 'usd' && x !== 'lumina'; });
        if (short.length > 1 && short.length < t.length) ph.push([short.join(' '), 1]);
        (SYN[id] || []).forEach(function (p) { ph.push([p, 1.4]); });
        ent('node', id, n.name, ph);
      });
      Object.keys(REGIONS).forEach(function (r) { var ph = [[r, 1.5]]; (REGION_SYN[r] || []).forEach(function (p) { ph.push([p, 1.2]); }); REGIONS[r].forEach(function (c) { ph.push([c, 1]); }); ent('region', r, r, ph); });
      var chans = {}; Object.keys(CHANNEL_SYN).forEach(function (c) { chans[c] = CHANNEL_SYN[c].slice(); });
      try { d = ctx.data.get('dsChannel'); ((d && d.rows) || []).forEach(function (r) { var c = txt(r.labels[0], 40), base = c.split(' - ')[0]; if (chans[base]) chans[base].push(c.split(' - ').join(' ')); else if (!chans[c]) chans[c] = [c]; }); } catch (e) {}
      Object.keys(chans).forEach(function (c) { ent('channel', c, c, uniq(chans[c]).map(function (p) { return [p, 1]; })); });
      var prods = ['Lumina Band Lite 2', 'Lumina Buds Pro', 'Lumina Buds Pro ANC', 'Lumina Watch SE Gen 1', 'Lumina Watch SE Gen 2'];
      try { d = ctx.data.get('dsAge'); ((d && d.rows) || []).forEach(function (r) { if (typeof r.labels[0] === 'string') prods.push(txt(r.labels[0], 50)); }); } catch (e) {}
      uniq(prods).slice(0, 40).forEach(function (p) { var t = norm(p).split(' ').filter(function (x) { return x !== 'lumina'; }), ph = [[t.join(' '), 1.3]]; if (t.indexOf('gen') >= 0) ph.push([t.filter(function (x) { return x !== 'gen'; }).join(' '), 1.1]); ent('product', p, p.split('Lumina ').join(''), ph); });
      Object.keys(TOPICS).forEach(function (k) { ent('topic', k, TOPIC_NAME[k], TOPICS[k].map(function (p) { return [p, 1]; })); });
      // a phrase shared by several nodes is worth less for each of them
      list.forEach(function (e) { if (e.type === 'node') e.al.forEach(function (a) { counts[a.key] = (counts[a.key] || 0) + 1; }); });
      list.forEach(function (e) { if (e.type === 'node') e.al.forEach(function (a) { if (counts[a.key] > 1) a.w = a.w / Math.sqrt(counts[a.key]); }); });
      ENT = list;
    }
    function matchText(text) {
      var tk = toks(text), hits = [], kept = [], res = { nodes: [], region: [], channel: [], product: [], topic: [] }, score = {};
      ENT.forEach(function (e) { e.al.forEach(function (a) { findLoose(tk, a.t).forEach(function (m) { hits.push({ e: e, s: m.s, x: m.e, n: a.t.length, w: a.w * (m.exact ? 1 : 0.7), cls: e.type === 'node' ? 'node' : e.type }); }); }); });
      hits.sort(function (a, b) { return b.n - a.n || b.w - a.w; });
      hits.forEach(function (x) { if (kept.some(function (k) { return k.cls === x.cls && k.n > x.n && k.s <= x.s && k.x >= x.x; })) return; kept.push(x); });
      kept.forEach(function (x) {
        if (x.cls !== 'node') { if (res[x.cls].indexOf(x.e.id) < 0) res[x.cls].push(x.e.id); return; }
        score[x.e.id] = Math.max(score[x.e.id] || 0, x.w * (1 + 0.5 * (x.n - 1))) + (score[x.e.id] ? 0.3 : 0);
      });
      res.nodes = Object.keys(score).map(function (id) { return { id: id, s: score[id] }; }).sort(function (a, b) { return b.s - a.s; });
      if (res.nodes.length && res.nodes[0].s >= 1.2) res.nodes = res.nodes.filter(function (n) { return n.s >= 1; });
      res.nodes = res.nodes.slice(0, 4);
      if (!res.nodes.length) res.topic.slice(0, 1).forEach(function (t) { if (NODE_ALL[TOPIC_NODE[t]]) res.nodes.push({ id: TOPIC_NODE[t], s: 0.5 }); });   // nothing named: pin weakly to the topic's metric
      return { res: res, tk: tk };
    }
    function stanceOf(tk, text) {
      var neg = 0, pos = 0, i, not = false;
      for (i = 0; i < tk.length; i++) { if (tk[i] === 'not' || tk[i] === 'no') { not = true; continue; } if (NEG.indexOf(tk[i]) >= 0) neg++; else if (POS.indexOf(tk[i]) >= 0) { if (not) neg++; else pos++; } not = false; }
      if (neg > pos) return 'concern';
      if (text.charAt(text.length - 1) === '?') return 'question';
      if (pos > neg) return 'positive';
      return 'neutral';
    }

    /* ----- analysis of one transcript: statements, their place in the flow, and decision-like statements ----- */
    function analyse(tx) {
      var key = tx.id + ':' + tx.text.length + ':' + (S.ai[tx.id] ? S.ai[tx.id].v : 0);
      if (cache[tx.id] && cache[tx.id].key === key) return cache[tx.id];
      var utts = parseTranscript(tx.text), people = {}, order = [], decs = [], aim = S.ai[tx.id];
      utts.forEach(function (u) {
        var m = matchText(u.text);
        u.k = tx.id + ':' + u.i; u.tx = tx.id; u.nodes = m.res.nodes; u.region = m.res.region; u.channel = m.res.channel; u.product = m.res.product; u.topic = m.res.topic; u.stance = stanceOf(m.tk, u.text); u.pad = ' ' + norm(u.text) + ' ';
        if (aim && aim.map[u.i]) { u.ai = true; aim.map[u.i].forEach(function (id) { if (!u.nodes.some(function (n) { return n.id === id; })) u.nodes.unshift({ id: id, s: 2, ai: true }); }); u.nodes = u.nodes.slice(0, 4); }
        if (!people[u.sp]) { people[u.sp] = { name: u.sp, role: u.role, n: 0, first: norm(u.sp).split(' ')[0] }; order.push(u.sp); }
        if (u.role && !people[u.sp].role) people[u.sp].role = u.role; people[u.sp].n++;
      });
      var firsts = order.map(function (n) { return people[n]; });
      utts.forEach(function (u, ui) {
        sentences(u.text).forEach(function (sent, si) {
          var pad = ' ' + norm(sent) + ' ', n = pad.trim().split(' ').length, isQ = sent.charAt(sent.length - 1) === '?', kind = '', status = '', cue, own = u.sp, due = '', i, w, m, nodes, d, why = [], j, v, sup;
          if (n < 5 && !(n >= 3 && hasCue(pad, ['will own', 'i ll own']))) return;
          if (isQ && (cue = hasCue(pad, CUE_Q))) { kind = 'question'; status = 'open'; }
          else if (!isQ && (cue = hasCue(pad, CUE_AGREED))) { kind = 'decision'; status = 'agreed'; }
          else if (!isQ && (cue = hasCue(pad, CUE_PROP))) { kind = 'decision'; status = 'proposed'; }
          else if (!isQ && (cue = hasCue(pad, CUE_ACT))) { kind = 'action'; status = 'proposed'; }
          else if (isQ && pad.indexOf(' can you ') >= 0) { cue = 'can you'; kind = 'action'; status = 'proposed'; }
          if (!kind || hasCue(pad, CUE_SKIP)) return;
          if (kind !== 'question' && (pad.indexOf(' i ll ') >= 0 || pad.indexOf(' i will ') >= 0 || pad.indexOf(' i can take ') >= 0) && cue !== 'we ll' && cue !== 'we will' && cue !== 'let s') kind = 'action';
          // owner: a named teammate asked or assigned in the sentence, else the speaker
          w = pad.trim().split(' ');
          firsts.forEach(function (p) { var at = w.indexOf(p.first); if (at >= 0 && p.name !== u.sp && (w[at + 1] === 'will' || w[at + 1] === 'can' || w[at + 1] === 'to' || w[at + 1] === 'own' || w[at + 1] === 'owns' || (w[at + 1] === 'please'))) { own = p.name; if (kind === 'decision' && w[at + 1] === 'can') kind = 'decision'; } });
          if (kind === 'question') own = '';
          i = w.lastIndexOf('by'); if (i >= 0) { for (j = i + 1; j < w.length && j < i + 5 && DUE[w[j]]; j++) due += (due ? ' ' : '') + w[j]; }
          m = matchText(sent); nodes = m.res.nodes.filter(function (x) { return x.s >= 1; }).map(function (x) { return x.id; });
          if (kind === 'decision' && !nodes.length && n < 7) return;   // too thin to be a decision on its own
          if (kind === 'decision' && status === 'proposed' && ui > 0 && u.pad.indexOf(' agreed ') === 0) status = 'agreed';
          if (!nodes.length) nodes = u.nodes.filter(function (x) { return x.s >= 1; }).slice(0, 2).map(function (x) { return x.id; });
          // rationale: this statement, the statements just before it that talk about the same nodes or give a reason, and replies that confirm it
          for (j = Math.max(0, ui - 3); j < ui; j++) { v = utts[j]; if (v.nodes.some(function (x) { return nodes.indexOf(x.id) >= 0 && x.s >= 1; }) || hasCue(v.pad, CUE_WHY)) why.push(v.i); }
          why = why.slice(-2); why.push(u.i);
          if (kind !== 'question') for (j = ui + 1; j < utts.length && j <= ui + 2; j++) {
            v = utts[j]; if (v.sp === u.sp) continue;
            if (hasCue(v.pad, CUE_NO)) { why.push(v.i); if (status === 'agreed') status = 'proposed'; break; }
            if (hasCue(v.pad, CUE_YES) && v.pad.trim().split(' ').indexOf(hasCue(v.pad, CUE_YES).split(' ')[0]) < 4) { why.push(v.i); if (status === 'proposed' && kind === 'decision') status = 'agreed'; break; }
          }
          sup = kind === 'decision' ? hasCue(pad, CUE_SUP) : '';
          d = { id: 'd' + hash(tx.id + '|' + u.i + '|' + si), tx: tx.id, u: u.i, kind: kind, status: status, text: clip(sent, 260), owner: own, due: due, nodes: uniq(nodes).slice(0, 6), why: uniq(why), sp: u.sp, t: u.t, cue: cue, sup: sup, auto: status };
          if (sup === 'no longer' && (cue === 'we decided' || cue === 'decided to')) { d.status = 'superseded'; d.selfSup = true; }
          decs.push(d);
        });
      });
      // a decision that replaces an approach supersedes earlier ones about the same nodes; a statement that retires an old rule points at what follows
      decs.forEach(function (d, i) {
        var j, e;
        if (d.selfSup) { for (j = i + 1; j < decs.length; j++) { e = decs[j]; if (e.kind === 'decision' && e.u <= d.u + 3) { d.by = e.id; break; } } return; }
        if (!d.sup || d.kind !== 'decision') return;
        for (j = i - 1; j >= 0; j--) { e = decs[j]; if (e.kind === 'decision' && e.status !== 'superseded' && e.u < d.u - 1 && e.nodes.some(function (x) { return d.nodes.indexOf(x) >= 0; })) { e.status = 'superseded'; e.by = d.id; break; } }
      });
      cache[tx.id] = { key: key, utts: utts, people: order.map(function (n) { return people[n]; }), decs: decs };
      return cache[tx.id];
    }
    function txById(id) { for (var i = 0; i < S.tx.length; i++) if (S.tx[i].id === id) return S.tx[i]; return null; }
    function scopeTx() { var t = S.active === 'all' ? null : txById(S.active); return t ? [t] : S.tx; }
    function scopeUtts() { var out = []; scopeTx().forEach(function (t) { out = out.concat(analyse(t).utts); }); return out; }
    function uttOf(txid, i) { var t = txById(txid); return t ? analyse(t).utts[i] : null; }
    function eff(d) { var o = ST.dec[d.id] || {}, r = {}; Object.keys(d).forEach(function (k) { r[k] = d[k]; }); ['status', 'text', 'owner', 'due', 'nodes', 'accepted', 'sentReq', 'sentTask'].forEach(function (k) { if (o[k] != null) r[k] = o[k]; }); r.edited = !!(o.text || o.owner || o.nodes || (o.status && o.status !== d.status)); return r; }
    function scopeDecs() {
      var out = []; scopeTx().forEach(function (t) { analyse(t).decs.forEach(function (d) { out.push(eff(d)); }); });
      ST.manual.forEach(function (m) { out.push(eff({ id: m.id, tx: '', u: -1, kind: 'decision', status: 'proposed', text: m.text, owner: ST.me || 'You', due: '', nodes: [], why: [], sp: ST.me || 'You', t: null, manual: true })); });
      return out;
    }
    function allPeople() { var m = {}, out = []; S.tx.forEach(function (t) { analyse(t).people.forEach(function (p) { if (!m[p.name]) { m[p.name] = { name: p.name, role: p.role, first: p.first, n: 0 }; out.push(m[p.name]); } }); }); return out; }
    function nodeName(id) { return NODE_ALL[id] ? NODE_ALL[id].name : id === 'general' ? 'General' : id; }

    /* ----- focus: the executive's direction filters statements and brings the nodes they touch forward ----- */
    function focusOn() { var f = S.focus || {}; return !S.ignoreFocus && ((f.region && f.region !== 'All' && REGIONS[f.region]) || (f.topic && f.topic !== 'all' && TOPICS[f.topic])); }
    function focusLabel() { var f = S.focus || {}, p = []; if (f.region && f.region !== 'All' && REGIONS[f.region]) p.push(f.region); if (f.topic && f.topic !== 'all' && TOPICS[f.topic]) p.push(TOPIC_NAME[f.topic]); return p.join(MID); }
    function inFocus(u) {
      if (!u) return false; if (!focusOn()) return true; var f = S.focus;
      if (f.region && f.region !== 'All' && REGIONS[f.region] && u.region.indexOf(f.region) < 0) return false;
      if (f.topic && f.topic !== 'all' && TOPICS[f.topic] && u.topic.indexOf(f.topic) < 0) return false;
      return true;
    }
    function decInFocus(d) { if (!focusOn() || d.manual) return true; return d.why.concat([d.u]).some(function (i) { return inFocus(uttOf(d.tx, i)); }); }

    /* ----- the flow diagram: lanes from source systems to frame widgets ----- */
    var LANES = [['erp', 'NetSuite'], ['raw', 'Snowflake RAW'], ['model', 'Snowflake ANALYTICS'], ['pdata', 'Pigment data'], ['calc1', 'Pigment metrics'], ['calc2', 'Derived metrics'], ['ds', 'Frame data sources'], ['w', 'Frame widgets']];
    var NW = 152, NH = 26, GAP = 8, LW = 180, TOP = 30;
    function buildGraph(extra) {
      var L = ctx.lineage || {}, blocks = L.blocks || ctx.blocks || [], bBy = {}, want = {}, srcBlock = {}, nodes = [], by = {}, edges = [], frame = null, ek = {};
      blocks.forEach(function (b) { if (b && typeof b.id === 'string') { bBy[b.id] = b; if (b.kind === 'frame') frame = b; } });
      (L.sources || []).forEach(function (s) { if (s && s.block) { srcBlock[s.id] = s.block; if (bBy[s.block]) want[s.block] = 1; } });
      function up(id) { var b = bBy[id]; if (!b || want[id] === 2) return; want[id] = 2; (b.deps || []).forEach(function (x) { var c = bBy[x]; if (!c) return; if (c.kind === 'metric' || c.kind === 'tl' || c.kind === 'table') up(x); else if (c.kind === 'dim') want[x] = want[x] || 1; }); }
      if (frame) (frame.deps || []).forEach(function (x) { if (bBy[x]) { want[x] = want[x] || 1; up(x); } });
      else blocks.slice(0, 36).forEach(function (b) { if (b) want[b.id] = 1; });
      (L.widgets || []).forEach(function (w) { if (w && bBy[w.block]) { want[w.block] = want[w.block] || 1; up(w.block); } });
      (extra || []).forEach(function (id) { if (bBy[id] && bBy[id].kind !== 'frame') want[id] = want[id] || 1; });
      function add(id, lane) { if (by[id] || !NODE_ALL[id]) return; var n = NODE_ALL[id]; by[id] = { id: id, name: n.name, kind: n.kind, lane: lane, sub: n.sub, says: n.says, ins: [], outs: [] }; nodes.push(by[id]); }
      function edge(a, b) { if (!by[a] || !by[b] || a === b || ek[a + '>' + b]) return; ek[a + '>' + b] = 1; edges.push([a, b]); by[a].outs.push(b); by[b].ins.push(a); }
      (L.sources || []).forEach(function (s) { if (s && !s.block) add(s.id, s.system === 'erp' ? 'erp' : s.system === 'raw' ? 'raw' : 'model'); });
      Object.keys(want).forEach(function (id) { var b = bBy[id]; if (!b || b.kind === 'frame') return; var lane = b.kind === 'metric' ? ((b.deps || []).some(function (x) { return bBy[x] && bBy[x].kind === 'metric'; }) ? 'calc2' : 'calc1') : (b.kind === 'table' || b.kind === 'board') ? 'calc2' : 'pdata'; add(id, lane); });
      (L.widgets || []).forEach(function (w) { if (!w) return; if (w.ds) add('ds:' + w.ds, 'ds'); if (w.widget) add('w:' + w.widget, 'w'); });
      (L.edges || []).forEach(function (e) { if (e && e.length > 1) edge(srcBlock[e[0]] || e[0], srcBlock[e[1]] || e[1]); });
      Object.keys(want).forEach(function (id) { ((bBy[id] || {}).deps || []).forEach(function (x) { edge(x, id); }); });
      (L.widgets || []).forEach(function (w) { if (!w) return; edge(w.block, 'ds:' + w.ds); edge('ds:' + w.ds, 'w:' + w.widget); });
      // order each lane by where its inputs sit, so edges cross less
      var maxRows = 0, yOf = {};
      LANES.forEach(function (ln, li) {
        var items = nodes.filter(function (n) { return n.lane === ln[0]; });
        items.forEach(function (n, i) { var ys = n.ins.filter(function (a) { return yOf[a] != null; }).map(function (a) { return yOf[a]; }); n.bc = ys.length ? ys.reduce(function (s, v) { return s + v; }, 0) / ys.length : (n.kind === 'ext' ? 9000 + i : i * (NH + GAP) + TOP); n.o = i; });
        items.sort(function (a, b) { return a.bc - b.bc || a.o - b.o; });
        items.forEach(function (n, i) { n.x = li * LW + 12; n.y = TOP + i * (NH + GAP) + (n.kind === 'ext' ? 14 : 0); yOf[n.id] = n.y; });
        maxRows = Math.max(maxRows, items.length);
      });
      return { nodes: nodes, by: by, edges: edges, W: LANES.length * LW + 8, H: TOP + maxRows * (NH + GAP) + 30, sig: nodes.map(function (n) { return n.id; }).join(',') };
    }
    function mentioned() { var m = {}; S.tx.forEach(function (t) { analyse(t).utts.forEach(function (u) { u.nodes.forEach(function (n) { m[n.id] = 1; }); }); }); Object.keys(ST.dec).forEach(function (k) { (ST.dec[k].nodes || []).forEach(function (id) { m[id] = 1; }); }); return Object.keys(m); }
    function svg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }
    function drawFlow() {
      var g = buildGraph(mentioned()); if (G && G.sig === g.sig && U.nodeEl) return false;
      G = g; U.nodeEl = {}; U.pinEl = {}; U.edgeEl = []; clear(U.flowIn);
      U.flowIn.style.width = G.W + 'px'; U.flowIn.style.height = G.H + 'px';
      LANES.forEach(function (ln, i) { var t = h('div', 'cb-lane', ln[1]); t.style.left = (i * LW + 12) + 'px'; U.flowIn.appendChild(t); });
      var s = svg('svg'); s.setAttribute('class', 'cb-edges'); s.setAttribute('width', G.W); s.setAttribute('height', G.H); s.setAttribute('aria-hidden', 'true');
      G.edges.forEach(function (e) { var a = G.by[e[0]], b = G.by[e[1]], x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2, p = svg('path'); if (x2 < x1) { x1 = a.x + NW / 2; x2 = b.x + NW / 2; y1 = a.y + NH; y2 = b.y; mx = x1; } p.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2); s.appendChild(p); U.edgeEl.push({ a: e[0], b: e[1], el: p }); });
      U.flowIn.appendChild(s);
      G.nodes.forEach(function (n) {
        var b = h('button', 'cb-n k-' + n.kind); b.type = 'button'; b.style.left = n.x + 'px'; b.style.top = n.y + 'px'; b.appendChild(h('span', 'cb-n-t', n.name)); b.title = n.name + (n.sub ? MID + n.sub : '');
        b.addEventListener('click', function () { selectNode(S.sel === n.id ? null : n.id, true); });
        U.flowIn.appendChild(b); U.nodeEl[n.id] = b;
      });
      fitFlow(); return true;
    }
    function fitFlow() { if (!U.flowWrap || !G) return; var w = U.flowWrap.clientWidth - 4, sc = Math.max(0.74, Math.min(1.15, w / G.W)); U.flowIn.style.transform = 'scale(' + sc.toFixed(3) + ')'; U.flowSize.style.width = Math.ceil(G.W * sc) + 'px'; U.flowSize.style.height = Math.ceil(G.H * sc) + 'px'; U.scale = sc; }
    function trace(id) { var m = {}; function go(x, dir) { var n = G.by[x]; if (!n) return; (dir > 0 ? n.outs : n.ins).forEach(function (y) { if (!m[y]) { m[y] = 1; go(y, dir); } }); } m[id] = 1; go(id, 1); go(id, -1); return m; }
    function paintFlow(drop) {
      if (!G) return; if (U.box) U.box.classList.toggle('still', reduced()); var utts = scopeUtts(), stat = {}, decN = {}, tr = S.sel && G.by[S.sel] ? trace(S.sel) : null, lit = {}, fo = focusOn(), order = 0;
      utts.forEach(function (u) { if (!inFocus(u)) return; u.nodes.forEach(function (n) { var s = stat[n.id] = stat[n.id] || { n: 0, concern: 0, positive: 0, question: 0, neutral: 0 }; s.n++; s[u.stance]++; }); });
      scopeDecs().forEach(function (d) { if (d.status !== 'superseded' && decInFocus(d)) d.nodes.forEach(function (id) { decN[id] = (decN[id] || 0) + 1; }); });
      if (S.lit) (S.lit.nodes || []).forEach(function (id) { lit[id] = 1; });
      G.nodes.forEach(function (n) {
        var el = U.nodeEl[n.id], s = stat[n.id], pin = U.pinEl[n.id], fwd = fo && !!s, was = el.classList.contains('fwd'), st;
        el.classList.toggle('sel', S.sel === n.id); el.classList.toggle('lit', !!lit[n.id]); el.classList.toggle('fwd', fwd);
        el.classList.toggle('back', (fo && !s && !lit[n.id]) || (!!tr && !tr[n.id] && !lit[n.id])); el.classList.toggle('dec', !!decN[n.id]);
        el.setAttribute('aria-pressed', S.sel === n.id ? 'true' : 'false');
        if (fwd && !was) rise(el, { lift: 9, delay: Math.min(order, 10) * 40 });
        if (!s) { if (pin) { el.removeChild(pin); delete U.pinEl[n.id]; } el.setAttribute('aria-label', n.name + ', no statements'); return; }
        st = s.concern >= Math.max(s.positive, 1) ? 'concern' : s.positive > s.concern ? 'positive' : s.question ? 'question' : 'neutral';
        if (!pin) { pin = h('span', 'cb-pin'); el.appendChild(pin); U.pinEl[n.id] = pin; drop = drop || 'one'; if (drop === 'one') dropPin(pin, 0); }
        pin.textContent = String(s.n); pin.className = 'cb-pin s-' + st;
        el.setAttribute('aria-label', n.name + ', ' + s.n + ' statement' + (s.n > 1 ? 's' : '') + ', mostly ' + st + (decN[n.id] ? ', ' + decN[n.id] + ' decision' + (decN[n.id] > 1 ? 's' : '') : ''));
        if (drop === 'all') dropPin(pin, order);
        order++;
      });
      U.edgeEl.forEach(function (e) { var on = tr ? !!(tr[e.a] && tr[e.b]) : false, hot = !!(lit[e.a] && lit[e.b]); e.el.setAttribute('class', on || hot ? 'on' : (tr || fo) ? 'dim' : ''); });
      if (U.flowNote) U.flowNote.textContent = (S.active === 'all' ? 'All transcripts' : (txById(S.active) || {}).title || '') + MID + utts.filter(function (u) { return inFocus(u) && u.nodes.length; }).length + ' of ' + utts.length + ' statements pinned' + (fo ? MID + 'direction: ' + focusLabel() : '');
    }
    function dropPin(pin, i) { if (reduced() || !pin.animate) return; try { pin.animate([{ transform: 'translateY(-26px) scale(.4)', opacity: 0 }, { transform: 'translateY(3px) scale(1.12)', opacity: 1, offset: 0.68 }, { transform: 'none', opacity: 1 }], { duration: 540, delay: Math.min(i, 24) * 34, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }); } catch (e) {} }
    function reveal(id) {
      var el = U.nodeEl && U.nodeEl[id], n = G && G.by[id]; if (!el || !n || !U.flowWrap) return;
      var sc = U.scale || 1, x = n.x * sc - U.flowWrap.clientWidth / 2 + NW * sc / 2, y = n.y * sc - U.flowWrap.clientHeight / 2;
      try { U.flowWrap.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { U.flowWrap.scrollLeft = Math.max(0, x); U.flowWrap.scrollTop = Math.max(0, y); }
    }
    function selectNode(id, fromFlow) {
      S.sel = id; S.lit = null; if (id) { S.tab = S.tab === 'decisions' || S.tab === 'threads' ? S.tab : 'quotes'; if (!fromFlow) reveal(id); rise(U.nodeEl[id], { lift: 7 }); say(nodeName(id) + ' selected'); }
      paintFlow(); renderSide();
    }
    function lightQuote(u) {
      var ids = u.nodes.map(function (n) { return n.id; }).filter(function (id) { return G.by[id]; });
      S.lit = S.lit && S.lit.k === u.k ? null : { k: u.k, nodes: ids }; paintFlow();
      if (S.lit && ids.length) { reveal(ids[0]); ids.forEach(function (id, i) { rise(U.nodeEl[id], { lift: 10, delay: i * 70 }); }); say('Lit ' + ids.map(nodeName).join(', ')); }
      else if (S.lit) toast('This statement does not name a part of the flow.');
      renderSide(true);
    }

    /* ----- header: transcripts, privacy, direction ----- */
    function renderHead() {
      clear(U.head);
      var eb = h('div', 'cb-eb'); eb.appendChild(h('i')); eb.appendChild(h('span', '', 'Collaborate')); eb.appendChild(h('em', '', 'Fluid view: follows your direction')); U.head.appendChild(eb);
      var row = h('div', 'cb-hrow'), tw = h('div', 'cb-htitle'); tw.appendChild(h('h1', 'cb-h', 'What the team said, pinned to the flow'));
      tw.appendChild(h('p', 'cb-sub', 'Transcripts stay in this browser. Nothing leaves it unless you choose Share with team' + (ctx.ai ? ' or Refine with Claude' : '') + ', and both ask first. Mapping and decisions are rule-based suggestions: check them before acting.'));
      row.appendChild(tw); U.head.appendChild(row);
      var bar = h('div', 'cb-tx'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Transcripts');
      function pick(id, label, tag, title) { var b = chip(S.active === id ? 'on' : '', label, function () { setActive(id); }, title); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', S.active === id ? 'true' : 'false'); if (tag) b.appendChild(h('small', tag === 'SAMPLE' ? 'smp' : '', tag)); bar.appendChild(b); }
      pick('all', 'All transcripts', '', 'Pins and decisions from every transcript');
      S.tx.forEach(function (t) { pick(t.id, t.title, t.sample ? 'SAMPLE' : t.team ? 'TEAM' : t.shared ? 'SHARED' : 'LOCAL', t.sample ? 'Illustrative sample transcript, not a real meeting' : t.team ? 'Shared with the team' + (t.by ? ' by ' + t.by : '') : 'Kept in this browser only'); });
      bar.appendChild(btn('pri sm', '+ Add transcript', function () { S.adding = !S.adding; renderAdd(); }));
      U.head.appendChild(bar);
      U.add = h('div', 'cb-add'); U.head.appendChild(U.add); renderAdd();
      U.dir = h('div', 'cb-dir'); U.head.appendChild(U.dir); renderDir();
    }
    function renderDir() {
      if (!U.dir) return; clear(U.dir); var f = S.focus || {}, on = focusOn();
      U.dir.appendChild(h('span', 'cb-dir-l', on ? 'Following your direction' : 'Direction'));
      ['All', 'NAM', 'LATAM', 'APAC', 'EMEA'].forEach(function (r) { var c = chip((f.region || 'All') === r && !S.ignoreFocus ? 'on' : '', r === 'All' ? 'All regions' : r, function () { S.ignoreFocus = false; try { ctx.focus.set({ region: r }); } catch (e) {} applyFocus(true); }); c.setAttribute('aria-pressed', (f.region || 'All') === r ? 'true' : 'false'); U.dir.appendChild(c); });
      if (f.topic && f.topic !== 'all' && TOPIC_NAME[f.topic]) U.dir.appendChild(chip(S.ignoreFocus ? '' : 'on', 'Topic: ' + TOPIC_NAME[f.topic], null));
      if (on) U.dir.appendChild(btn('ghost sm', 'Show everything', function () { S.ignoreFocus = true; applyFocus(true); }, 'Stop filtering this view; your direction itself is not changed'));
      else if (S.ignoreFocus) U.dir.appendChild(btn('ghost sm', 'Follow direction again', function () { S.ignoreFocus = false; applyFocus(true); }));
    }
    function renderAdd() {
      clear(U.add); U.add.hidden = !S.adding; if (!S.adding) return;
      var mineN = S.tx.filter(function (t) { return t.mine; }).length;
      var title = h('input', 'cb-in'); title.type = 'text'; title.maxLength = 80; title.placeholder = 'Title, for example: Pricing sync 12 Aug'; title.setAttribute('aria-label', 'Transcript title');
      var ta = h('textarea', 'cb-in'); ta.rows = 6; ta.maxLength = MAX_TX_LIVE; ta.placeholder = 'Paste a transcript: one line per turn, like "[00:12] Maya Chen: ..." or "Maya Chen (CFO): ...". WebVTT also works.'; ta.setAttribute('aria-label', 'Transcript text');
      var drop = h('div', 'cb-drop', 'Drop a .txt or .vtt file here, or '), file = h('input'); file.type = 'file'; file.accept = '.txt,.vtt,.srt,.md,text/plain,text/vtt'; file.setAttribute('aria-label', 'Choose a transcript file'); drop.appendChild(file);
      function readFile(f) {
        if (!f) return; var nm = String(f.name || '').toLowerCase(), okExt = ['.txt', '.vtt', '.srt', '.md'].some(function (x) { return nm.slice(-x.length) === x; });
        if (!okExt && String(f.type).indexOf('text') !== 0) { toast('Only plain text or .vtt files can be read.'); return; }
        if (f.size > 600000) { toast('That file is too large (600 KB limit).'); return; }
        var fr = new FileReader(), tok = alive; fr.onload = function () { if (tok !== alive) return; ta.value = txt(fr.result, MAX_TX_LIVE); if (!title.value) title.value = txt(f.name, 80); toast('Read locally. Nothing was uploaded.'); }; fr.onerror = function () { toast('Could not read that file.'); }; fr.readAsText(f);
      }
      file.addEventListener('change', function () { readFile(file.files && file.files[0]); });
      drop.addEventListener('dragover', function (ev) { ev.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
      drop.addEventListener('drop', function (ev) { ev.preventDefault(); drop.classList.remove('over'); readFile(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]); });
      var foot = h('div', 'cb-row');
      foot.appendChild(btn('pri', 'Map to the flow', function () {
        var text = txt(ta.value, MAX_TX_LIVE).trim(); if (text.length < 20) { toast('Paste or drop a transcript first.'); return; }
        if (!parseTranscript(text).length) { toast('No statements found in that text.'); return; }
        var t = { id: 't' + hash(text.slice(0, 400) + Date.now()), title: txt(title.value, 80).trim() || 'Transcript ' + (mineN + 1), text: text, at: Date.now(), mine: true };
        var mine = S.tx.filter(function (x) { return x.mine; }); if (mine.length >= MAX_TX) { S.tx.splice(S.tx.indexOf(mine[0]), 1); toast('Kept your latest ' + MAX_TX + ' transcripts; the oldest was removed.'); }
        S.tx.push(t); saveTx(); S.adding = false; if (text.length > MAX_TX_KEEP) toast('Mapped. Only the first ' + MAX_TX_KEEP + ' characters are kept after you leave.'); setActive(t.id);
      }));
      foot.appendChild(btn('ghost', 'Cancel', function () { S.adding = false; renderAdd(); }));
      foot.appendChild(h('span', 'cb-hint', 'Read and analysed in this browser. Kept on this device only (up to ' + MAX_TX + ' transcripts).'));
      U.add.appendChild(title); U.add.appendChild(ta); U.add.appendChild(drop); U.add.appendChild(foot);
      try { title.focus(); } catch (e) {}
    }
    function setActive(id) { S.active = id; ST.active = id; S.sel = null; S.lit = null; S.person = ''; save(); renderHead(); drawFlow(); paintFlow('all'); renderSide(); }

    /* ----- side panel ----- */
    var TABS = [['quotes', 'Quotes'], ['decisions', 'Decisions'], ['people', 'People'], ['threads', 'Threads'], ['digest', 'Digest']];
    function renderSide(keepScroll) {
      var top = keepScroll && U.body ? U.body.scrollTop : 0;
      clear(U.tabs);
      var counts = { quotes: visibleQuotes().length, decisions: scopeDecs().filter(decInFocus).length, people: 0, threads: ST.notes.length, digest: digest().length };
      TABS.forEach(function (t) {
        var b = h('button', 'cb-tab' + (S.tab === t[0] ? ' on' : ''), t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', S.tab === t[0] ? 'true' : 'false');
        if (counts[t[0]]) b.appendChild(h('small', '', String(counts[t[0]])));
        b.addEventListener('click', function () { S.tab = t[0]; renderSide(); }); U.tabs.appendChild(b);
      });
      clear(U.body);
      ({ quotes: renderQuotes, decisions: renderDecisions, people: renderPeople, threads: renderThreads, digest: renderDigest })[S.tab]();
      U.body.scrollTop = top;
    }
    function visibleQuotes() { return scopeUtts().filter(function (u) { return inFocus(u) && (!S.sel || u.nodes.some(function (n) { return n.id === S.sel; })) && (!S.person || u.sp === S.person); }); }
    function avatar(name) { var a = h('span', 'cb-av', (name || '?').charAt(0).toUpperCase()); a.style.background = 'hsl(' + (parseInt(hash(name), 36) % 360) + ' 42% 46%)'; return a; }
    function filterBar() {
      var bar = h('div', 'cb-filter'), any = false;
      if (S.sel) { any = true; bar.appendChild(chip('on', 'Node: ' + nodeName(S.sel) + ' ' + TIMES, function () { selectNode(null); }, 'Clear the node filter')); }
      if (S.person) { any = true; bar.appendChild(chip('on', 'Person: ' + S.person + ' ' + TIMES, function () { S.person = ''; renderSide(); }, 'Clear the person filter')); }
      if (focusOn()) { any = true; bar.appendChild(chip('', 'Direction: ' + focusLabel(), null)); }
      if (any) U.body.appendChild(bar);
    }
    function quoteCard(u, compact) {
      var c = h('div', 'cb-q s-' + u.stance + (S.lit && S.lit.k === u.k ? ' lit' : '')), top = h('div', 'cb-q-top'), tx = txById(u.tx);
      c.setAttribute('role', 'button'); c.tabIndex = 0; c.title = 'Light up the parts of the flow this statement is about';
      top.appendChild(avatar(u.sp)); top.appendChild(h('b', '', u.sp)); if (u.role) top.appendChild(h('span', 'cb-role', u.role));
      top.appendChild(h('span', 'cb-time', (fmtTime(u.t) || '') + (S.active === 'all' && tx ? MID + clip(tx.title, 22) : '')));
      top.appendChild(h('span', 'cb-st', u.stance === 'concern' ? 'Concern' : u.stance === 'positive' ? 'Positive' : u.stance === 'question' ? 'Question' : ''));
      c.appendChild(top); c.appendChild(h('p', 'cb-q-t', u.text));
      if (!compact) {
        var tags = h('div', 'cb-tags');
        u.nodes.forEach(function (n) { if (!NODE_ALL[n.id]) return; tags.appendChild(chip('node k-' + NODE_ALL[n.id].kind + (n.s < 1 ? ' weak' : ''), nodeName(n.id), function () { selectNode(n.id); }, (n.ai ? 'Added by Claude' : n.s >= 2 ? 'Strong match' : n.s >= 1 ? 'Likely match' : 'Weak match, by topic only') + ': show statements about this node')); });
        u.region.concat(u.channel).concat(u.product.map(function (p) { return p.split('Lumina ').join(''); })).forEach(function (x) { tags.appendChild(chip('facet', x, null)); });
        if (u.ai) tags.appendChild(chip('ai', 'Refined by Claude', null));
        if (tags.firstChild) c.appendChild(tags);
      }
      function go() { lightQuote(u); }
      c.addEventListener('click', go); c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
      return c;
    }
    function renderQuotes() {
      filterBar();
      var list = visibleQuotes(), tx = S.active !== 'all' ? txById(S.active) : null, box = h('div', 'cb-list'), bar;
      if (S.sel && NODE_ALL[S.sel]) { var info = h('div', 'cb-node-info k-' + NODE_ALL[S.sel].kind); info.appendChild(h('b', '', nodeName(S.sel))); if (NODE_ALL[S.sel].says) info.appendChild(h('p', '', NODE_ALL[S.sel].says)); var nb = h('div', 'cb-row'); nb.appendChild(btn('sm', 'Start a thread here', function () { S.tab = 'threads'; S.anchor = S.sel; renderSide(); })); info.appendChild(nb); U.body.appendChild(info); }
      if (!list.length) U.body.appendChild(h('p', 'cb-empty', focusOn() ? 'No statements about ' + focusLabel() + (S.sel ? ' on this node' : '') + ' in this scope. Choose "Show everything" above to see the rest.' : S.sel ? 'Nobody mentioned this part of the flow.' : 'No statements yet. Add a transcript to begin.'));
      list.forEach(function (u) { var c = quoteCard(u); c.setAttribute('data-k', u.k); box.appendChild(c); });
      U.body.appendChild(box);
      if (tx) {
        bar = h('div', 'cb-row foot');
        if (ctx.ai) bar.appendChild(btn('sm', S.ai[tx.id] ? 'Refined by Claude ' + CHECK : 'Refine with Claude', function (b) { aiRefine(tx, b); }, 'Sends this transcript to Claude after you confirm'));
        if (tx.mine && !tx.shared) bar.appendChild(btn('sm', 'Share with team', function (b) { shareTx(tx, b); }, 'Asks for approval, then saves this transcript where everyone who opens the frame can read it'));
        if (tx.mine) bar.appendChild(btn('ghost sm', 'Remove', function () { removeTx(tx); }));
        bar.appendChild(h('span', 'cb-hint', tx.sample ? 'SAMPLE transcript: illustrative, not a real meeting.' : tx.team ? 'Shared with the team.' : tx.shared ? 'Shared with the team by you.' : 'Local to this browser.'));
        U.body.appendChild(bar);
      }
    }
    function aiRefine(tx, b) {
      var a = analyse(tx), catalog = Object.keys(NODE_ALL).slice(0, 140).map(function (id) { return { id: id, name: NODE_ALL[id].name }; }), sts = a.utts.slice(0, 60).map(function (u) { return { i: u.i, who: u.sp, text: clip(u.text, 320), guess: u.nodes.map(function (n) { return n.id; }) }; });
      waitOn(b, 'Waiting for approval' + ELL, function () {
        return Promise.resolve(ctx.approve({ title: 'Send "' + clip(tx.title, 60) + '" to Claude?', what: 'The text of this transcript (' + a.utts.length + ' statements) is sent to Claude to check which parts of the flow each statement is about.', where: 'Claude, through this Canvas. Nothing is written to Pigment.', reversible: 'Yes. The rule-based mapping stays underneath.', confirm: 'Send to Claude' })).then(function (ok) {
          if (!ok) return { ok: false, cancelled: true };
          b.textContent = 'Asking Claude' + ELL;
          return ctx.ai.ask('You map meeting statements to nodes of a data lineage diagram (source tables, Pigment blocks, frame widgets). Return ONLY JSON shaped as {"map":[{"i":0,"nodes":["id"]}]}. Use only ids from the catalog, at most 3 per statement, and leave out statements that name no node. "guess" is a rule-based first pass you may correct.', { catalog: catalog, statements: sts }).then(function (out) {
            var s = String(out || ''), i0 = s.indexOf('{'), i1 = s.lastIndexOf('}'), j = null, map = {}, n = 0;
            try { j = JSON.parse(s.slice(i0, i1 + 1)); } catch (e) { j = null; }
            if (!j || !Array.isArray(j.map)) return { ok: false, msg: 'Claude did not return a usable mapping; the rule-based one is unchanged.' };
            j.map.slice(0, 80).forEach(function (m) { if (!m || typeof m.i !== 'number' || !Array.isArray(m.nodes) || !a.utts[m.i]) return; var ids = m.nodes.filter(function (id) { return typeof id === 'string' && NODE_ALL[id]; }).slice(0, 3); if (ids.length) { map[m.i] = ids; n++; } });
            S.ai[tx.id] = { v: Date.now(), map: map }; return { ok: true, msg: 'Claude checked ' + n + ' statements.' };
          });
        });
      }, function (res) { if (res && res.msg) toast(res.msg); if (res && res.ok) { drawFlow(); paintFlow('all'); renderSide(); } });
    }
    function shareTx(tx, b) {
      waitOn(b, 'Waiting for approval' + ELL, function () {
        return Promise.resolve(ctx.store.set('collabShared', { v: 1, id: tx.id, title: tx.title, text: tx.text.slice(0, 9000), by: ST.me || '', at: Date.now() }, { shared: true })).then(function (r) { return { ok: !!(r && r.shared) }; });
      }, function (res) {
        if (res.ok) { tx.shared = true; saveTx(); toast('Shared with the team.'); renderHead(); renderSide(); }
        else toast(res.msg || 'Not shared: this frame has no shared slot for transcripts, or the approval was cancelled. It stays local.');
      });
    }
    function removeTx(tx) {
      Promise.resolve(ctx.approve({ title: 'Remove "' + clip(tx.title, 60) + '"?', what: 'Removes this transcript and its pins from this browser. Decisions you already sent are not affected.', local: true, reversible: 'No. Paste it again to bring it back.', confirm: 'Remove' })).then(function (ok) {
        if (!ok || !root) return; var i = S.tx.indexOf(tx); if (i >= 0) S.tx.splice(i, 1); delete cache[tx.id]; saveTx(); setActive(S.tx.length ? S.tx[0].id : 'all');
      });
    }

    /* ----- Architecture Decision log ----- */
    function decText(d) {
      var tx = txById(d.tx), s = '[ADR ' + (STATUS[d.status] || d.status) + '] ' + d.text;
      if (d.nodes.length) s += ' | Affects: ' + d.nodes.map(nodeName).join(', ');
      if (d.owner) s += ' | Owner: ' + d.owner;
      if (tx) s += ' | From: ' + tx.title + (d.t != null ? ' ' + fmtTime(d.t) : '');
      return clip(s, 380);
    }
    function patch(d, o) { var cur = ST.dec[d.id] = ST.dec[d.id] || {}; Object.keys(o).forEach(function (k) { cur[k] = o[k]; }); save(); }
    function renderDecisions() {
      filterBar();
      var all = scopeDecs().filter(decInFocus), list = all.filter(function (d) { return (!S.sel || d.nodes.indexOf(S.sel) >= 0) && (!S.person || d.owner === S.person || d.sp === S.person); });
      var head = h('div', 'cb-row'), sum = {};
      all.forEach(function (d) { sum[d.status] = (sum[d.status] || 0) + 1; });
      head.appendChild(h('span', 'cb-hint', Object.keys(STATUS).filter(function (k) { return sum[k]; }).map(function (k) { return sum[k] + ' ' + STATUS[k].toLowerCase(); }).join(MID) || 'No decisions detected'));
      head.appendChild(btn('sm', '+ Add decision', function () { var id = 'm' + hash(String(Date.now())); ST.manual.push({ id: id, text: 'New decision', at: Date.now() }); if (ST.manual.length > 20) ST.manual.shift(); ST.dec[id] = { nodes: S.sel ? [S.sel] : [] }; S.editing = id; save(); renderSide(); }, 'Record a decision by hand' + (S.sel ? ', linked to ' + nodeName(S.sel) : '')));
      U.body.appendChild(head);
      if (!list.length) U.body.appendChild(h('p', 'cb-empty', 'No decisions match this filter.'));
      var order = { agreed: 0, proposed: 1, open: 2, superseded: 3 };
      list.sort(function (a, b) { return (order[a.status] - order[b.status]) || 0; }).forEach(function (d) { U.body.appendChild(S.editing === d.id ? decEdit(d) : decCard(d)); });
      U.body.appendChild(h('p', 'cb-hint foot', 'Detected from phrases such as "we' + AP + 'll", "let' + AP + 's", "decided", "going forward" and questions like "should we". Accept a decision before it can be sent; every send opens an approval sheet first.'));
    }
    function decCard(d) {
      var c = h('div', 'cb-d st-' + d.status), top = h('div', 'cb-d-top'), tx = txById(d.tx), meta = [], tags = h('div', 'cb-tags'), why, acts = h('div', 'cb-row'), sent = h('div', 'cb-sent'), by;
      top.appendChild(h('span', 'cb-pill st-' + d.status, STATUS[d.status])); top.appendChild(h('span', 'cb-kind', d.kind === 'action' ? 'Action' : d.kind === 'question' ? 'Question' : 'Decision'));
      if (d.accepted) top.appendChild(h('span', 'cb-kind ok', CHECK + ' Accepted by you'));
      if (d.edited) top.appendChild(h('span', 'cb-kind', 'Edited'));
      top.appendChild(h('span', 'cb-time', d.manual ? 'Added by hand' : clip((tx || {}).title || '', 26) + (d.t != null ? MID + fmtTime(d.t) : '')));
      c.appendChild(top); c.appendChild(h('p', 'cb-d-t', d.text));
      if (d.owner) meta.push((d.kind === 'action' ? 'Owner: ' : 'Raised by: ') + d.owner); if (d.due) meta.push('Due: ' + d.due);
      if (d.by) { by = scopeDecs().filter(function (x) { return x.id === d.by; })[0]; if (by) meta.push('Replaced by: ' + clip(by.text, 60)); }
      if (meta.length) c.appendChild(h('p', 'cb-d-m', meta.join(MID)));
      d.nodes.forEach(function (id) { if (NODE_ALL[id]) tags.appendChild(chip('node k-' + NODE_ALL[id].kind, nodeName(id), function () { selectNode(id); }, 'Affected node: show it in the flow')); });
      if (!d.nodes.length) tags.appendChild(chip('facet', 'Not linked to a node yet', null));
      c.appendChild(tags);
      if (d.why && d.why.length) {
        why = h('details', 'cb-why'); var sm = h('summary', '', 'Rationale: ' + d.why.length + ' quote' + (d.why.length > 1 ? 's' : '')); why.appendChild(sm);
        d.why.forEach(function (i) { var u = uttOf(d.tx, i); if (u) why.appendChild(quoteCard(u, true)); });
        if (S.openWhy[d.id]) why.open = true; why.addEventListener('toggle', function () { S.openWhy[d.id] = why.open; });
        c.appendChild(why);
      }
      if (!d.accepted) acts.appendChild(btn('pri sm', d.kind === 'question' ? 'Mark resolved' : 'Accept', function () { patch(d, { accepted: true, status: 'agreed' }); say('Decision accepted'); renderSide(true); paintFlow(); }, 'Confirm this is a real decision. Nothing is written to Pigment yet.'));
      else acts.appendChild(btn('ghost sm', 'Undo accept', function () { patch(d, { accepted: false, status: d.auto || 'proposed' }); renderSide(true); paintFlow(); }));
      acts.appendChild(btn('sm', 'Edit', function () { S.editing = d.id; renderSide(true); }));
      if (S.sel && d.nodes.indexOf(S.sel) < 0) acts.appendChild(btn('sm', 'Link ' + clip(nodeName(S.sel), 18), function () { patch(d, { nodes: d.nodes.concat([S.sel]).slice(0, 8) }); renderSide(true); paintFlow(); }, 'Link this decision to the selected node'));
      var gate = d.accepted ? '' : 'Accept the decision first';
      var rq = btn('sm', d.sentReq ? 'Send again' : 'Send as change request', function (b) {
        waitOn(b, 'Waiting for approval' + ELL, function () { return ctx.act.request(decText(d), { title: 'Raise a change request from a decision', id: d.id }); }, function (res) { if (res && res.ok) { patch(d, { sentReq: Date.now() }); renderSide(true); } else if (res && res.msg && !res.cancelled) sent.textContent = res.msg; });
      }, gate || 'Opens an approval sheet, then adds one change request to the frame' + AP + 's Requests list');
      var tk = btn('sm', d.sentTask ? 'Create task again' : 'Create task', function (b) {
        waitOn(b, 'Waiting for approval' + ELL, function () { return ctx.act.task(clip(d.text, 300), d.owner || '', d.due || ''); }, function (res) { if (res && res.ok) { patch(d, { sentTask: Date.now() }); renderSide(true); } else if (res && res.msg && !res.cancelled) sent.textContent = res.msg; });
      }, gate || 'Opens an approval sheet, then adds one task with its owner and due date');
      rq.disabled = tk.disabled = !d.accepted; acts.appendChild(rq); acts.appendChild(tk); c.appendChild(acts);
      sent.textContent = [d.sentReq ? 'Change request sent ' + fmtWhen(d.sentReq) : '', d.sentTask ? 'Task created ' + fmtWhen(d.sentTask) : '', !d.accepted ? 'Accept to enable sending.' : ''].filter(Boolean).join(MID);
      c.appendChild(sent);
      return c;
    }
    function decEdit(d) {
      var c = h('div', 'cb-d edit'), ta = h('textarea', 'cb-in'), ow = h('input', 'cb-in'), du = h('input', 'cb-in'), sel = h('select', 'cb-in'), nodes = d.nodes.slice(), tags = h('div', 'cb-tags'), row = h('div', 'cb-row'), g = h('div', 'cb-grid2');
      function lab(t, el) { var l = h('label', 'cb-lab', t); l.appendChild(el); return l; }
      ta.rows = 3; ta.maxLength = 300; ta.value = d.text; ow.type = 'text'; ow.maxLength = 60; ow.value = d.owner || ''; du.type = 'text'; du.maxLength = 30; du.value = d.due || '';
      Object.keys(STATUS).forEach(function (k) { var o = h('option', '', STATUS[k]); o.value = k; if (k === d.status) o.selected = true; sel.appendChild(o); });
      function drawTags() { clear(tags); nodes.forEach(function (id) { tags.appendChild(chip('node', nodeName(id) + ' ' + TIMES, function () { nodes.splice(nodes.indexOf(id), 1); drawTags(); }, 'Unlink this node')); }); if (S.sel && nodes.indexOf(S.sel) < 0) tags.appendChild(chip('add', '+ Link ' + nodeName(S.sel), function () { nodes.push(S.sel); drawTags(); })); else if (!S.sel) tags.appendChild(h('span', 'cb-hint', 'Select a node in the flow to link it.')); }
      drawTags();
      c.appendChild(lab('Decision', ta)); g.appendChild(lab('Owner', ow)); g.appendChild(lab('Due', du)); g.appendChild(lab('Status', sel)); c.appendChild(g); c.appendChild(lab('Affected nodes', tags));
      row.appendChild(btn('pri sm', 'Save', function () { var t = txt(ta.value, 300).trim(); if (!t) { toast('The decision text is empty.'); return; } patch(d, { text: t, owner: txt(ow.value, 60).trim(), due: txt(du.value, 30).trim(), status: sel.value, nodes: nodes.slice(0, 8) }); S.editing = ''; drawFlow(); paintFlow(); renderSide(true); }));
      row.appendChild(btn('ghost sm', 'Cancel', function () { S.editing = ''; renderSide(true); }));
      if (d.manual) row.appendChild(btn('ghost sm', 'Delete', function () { ST.manual = ST.manual.filter(function (m) { return m.id !== d.id; }); delete ST.dec[d.id]; S.editing = ''; save(); renderSide(); paintFlow(); }));
      else if (ST.dec[d.id]) row.appendChild(btn('ghost sm', 'Reset to detected', function () { delete ST.dec[d.id]; S.editing = ''; save(); renderSide(true); paintFlow(); }));
      c.appendChild(row); return c;
    }

    /* ----- people ----- */
    function renderPeople() {
      var utts = scopeUtts().filter(inFocus), decs = scopeDecs(), by = {}, order = [], me = h('div', 'cb-row'), inp = h('input', 'cb-in');
      utts.forEach(function (u) { var p = by[u.sp]; if (!p) { p = by[u.sp] = { name: u.sp, role: u.role, n: 0, st: { concern: 0, positive: 0, question: 0, neutral: 0 }, nodes: {}, facets: {} }; order.push(p); } p.n++; p.st[u.stance]++; if (u.role) p.role = u.role; u.nodes.forEach(function (n) { if (n.s >= 1) p.nodes[n.id] = (p.nodes[n.id] || 0) + 1; }); u.region.forEach(function (r) { p.facets[r] = (p.facets[r] || 0) + 1; }); });
      inp.type = 'text'; inp.maxLength = 40; inp.value = ST.me; inp.placeholder = 'Your name, to spot @mentions'; inp.setAttribute('aria-label', 'Your name'); inp.addEventListener('change', function () { ST.me = txt(inp.value, 40).trim(); save(); renderSide(); });
      me.appendChild(h('span', 'cb-hint', 'You are')); me.appendChild(inp); U.body.appendChild(me);
      if (!order.length) U.body.appendChild(h('p', 'cb-empty', 'Nobody spoke about this in the current scope.'));
      order.sort(function (a, b) { return b.n - a.n; }).forEach(function (p) {
        var c = h('div', 'cb-p'), top = h('div', 'cb-q-top'), bar = h('div', 'cb-bar'), tags = h('div', 'cb-tags'), mine = decs.filter(function (d) { return d.owner === p.name && d.status !== 'superseded'; }), ment = ST.notes.filter(function (n) { return mentionsOf(n.text).indexOf(p.name) >= 0; }).length, facts = [];
        top.appendChild(avatar(p.name)); top.appendChild(h('b', '', p.name)); if (p.role) top.appendChild(h('span', 'cb-role', p.role)); top.appendChild(h('span', 'cb-time', p.n + ' statement' + (p.n > 1 ? 's' : ''))); c.appendChild(top);
        ['concern', 'question', 'neutral', 'positive'].forEach(function (k) { if (!p.st[k]) return; var s = h('i', 's-' + k); s.style.flex = String(p.st[k]); s.title = p.st[k] + ' ' + k; bar.appendChild(s); });
        bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', p.st.concern + ' concerns, ' + p.st.question + ' questions, ' + p.st.positive + ' positive'); c.appendChild(bar);
        Object.keys(p.nodes).sort(function (a, b) { return p.nodes[b] - p.nodes[a]; }).slice(0, 5).forEach(function (id) { if (NODE_ALL[id]) tags.appendChild(chip('node k-' + NODE_ALL[id].kind, nodeName(id) + ' ' + p.nodes[id], function () { S.person = p.name; selectNode(id); }, 'What ' + p.name + ' said about this node')); });
        Object.keys(p.facets).forEach(function (r) { tags.appendChild(chip('facet', r + ' ' + p.facets[r], null)); });
        c.appendChild(tags);
        if (mine.length) facts.push(mine.length + ' decision' + (mine.length > 1 ? 's' : '') + ' or action' + (mine.length > 1 ? 's' : '') + ' owned'); if (ment) facts.push(ment + ' mention' + (ment > 1 ? 's' : '') + ' in threads');
        if (facts.length) c.appendChild(h('p', 'cb-d-m', facts.join(MID)));
        var row = h('div', 'cb-row');
        row.appendChild(btn('sm', 'Quotes', function () { S.person = p.name; S.tab = 'quotes'; renderSide(); }));
        if (mine.length) row.appendChild(btn('sm', 'Decisions', function () { S.person = p.name; S.tab = 'decisions'; renderSide(); }));
        row.appendChild(btn('ghost sm', '@ Mention', function () { S.tab = 'threads'; S.draft = (S.draft ? S.draft + ' ' : '') + '@' + p.name.split(' ')[0] + ' '; renderSide(); }));
        c.appendChild(row); U.body.appendChild(c);
      });
    }

    /* ----- threads: notes anchored to a node, widget or region, with @mentions ----- */
    function mentionsOf(text) {
      var ppl = allPeople(), out = [], parts = String(text).split('@'), i, w;
      for (i = 1; i < parts.length; i++) { w = norm(parts[i]).split(' ')[0]; if (!w) continue; ppl.forEach(function (p) { if (p.first === w && out.indexOf(p.name) < 0) out.push(p.name); }); if (ST.me && norm(ST.me).split(' ')[0] === w && out.indexOf(ST.me) < 0) out.push(ST.me); }
      return out;
    }
    function richText(text) {   // @mentions become chips; everything else is plain text nodes
      var p = h('p', 'cb-note-t'), parts = String(text).split('@'), firsts = {}, i, j, w, c;
      allPeople().forEach(function (x) { firsts[x.first] = x.name; }); if (ST.me) firsts[norm(ST.me).split(' ')[0]] = ST.me;
      p.appendChild(document.createTextNode(parts[0]));
      for (i = 1; i < parts.length; i++) {
        w = ''; for (j = 0; j < parts[i].length; j++) { c = parts[i].charAt(j).toLowerCase(); if ((c >= 'a' && c <= 'z') || c === '-') w += parts[i].charAt(j); else break; }
        if (w && firsts[w.toLowerCase()]) { p.appendChild(h('span', 'cb-at', '@' + w)); p.appendChild(document.createTextNode(parts[i].slice(w.length))); }
        else p.appendChild(document.createTextNode('@' + parts[i]));
      }
      return p;
    }
    function anchorLabel(a) { return a === 'general' ? 'General' : a.indexOf('region:') === 0 ? 'Region ' + a.slice(7) : nodeName(a); }
    function renderThreads() {
      var comp = h('div', 'cb-comp'), ta = h('textarea', 'cb-in'), sel = h('select', 'cb-in'), row = h('div', 'cb-row'), ppl = h('div', 'cb-tags'), opts = [['general', 'General']], f = S.focus || {}, parent = S.replyTo ? ST.notes.filter(function (n) { return n.id === S.replyTo; })[0] : null;
      if (S.sel) opts.push([S.sel, nodeName(S.sel)]); if (S.anchor && S.anchor !== S.sel && NODE_ALL[S.anchor]) opts.push([S.anchor, nodeName(S.anchor)]);
      if (f.region && REGIONS[f.region]) opts.push(['region:' + f.region, 'Region ' + f.region]);
      Object.keys(NODE_ALL).forEach(function (id) { if (NODE_ALL[id].kind === 'widget' && id !== S.sel && id !== S.anchor) opts.push([id, NODE_ALL[id].name]); });
      opts.forEach(function (o) { var e = h('option', '', o[1]); e.value = o[0]; if (o[0] === (S.anchor || S.sel || 'general')) e.selected = true; sel.appendChild(e); });
      sel.setAttribute('aria-label', 'Anchor the note to'); sel.addEventListener('change', function () { S.anchor = sel.value; });
      ta.rows = 3; ta.maxLength = MAX_NOTE; ta.value = S.draft || ''; ta.placeholder = parent ? 'Reply to ' + parent.by + ELL : 'Write a note. Use @ to mention a teammate. Select a node in the flow to anchor it there.'; ta.setAttribute('aria-label', 'Note'); ta.addEventListener('input', function () { S.draft = ta.value; });
      allPeople().slice(0, 9).forEach(function (p) { ppl.appendChild(chip('at', '@' + p.name.split(' ')[0], function () { ta.value = (ta.value && ta.value.slice(-1) !== ' ' ? ta.value + ' ' : ta.value) + '@' + p.name.split(' ')[0] + ' '; S.draft = ta.value; ta.focus(); }, 'Mention ' + p.name)); });
      if (parent) { var rp = h('div', 'cb-filter'); rp.appendChild(chip('on', 'Replying to ' + parent.by + ': ' + clip(parent.text, 40) + ' ' + TIMES, function () { S.replyTo = ''; renderSide(); })); comp.appendChild(rp); }
      else comp.appendChild(sel);
      comp.appendChild(ta); comp.appendChild(ppl);
      row.appendChild(btn('pri sm', parent ? 'Reply' : 'Add note', function () {
        var t = txt(ta.value, MAX_NOTE).trim(); if (!t) { toast('Write the note first.'); return; }
        var n = { id: 'n' + hash(t + Date.now()), anchor: parent ? parent.anchor : sel.value, text: t, by: ST.me || 'You', at: Date.now(), parent: parent ? parent.id : '', posted: 0 };
        ST.notes.push(n); S.draft = ''; S.replyTo = ''; S.fresh = n.id; save(); renderSide(); S.fresh = '';
      }));
      row.appendChild(h('span', 'cb-hint', 'Notes stay on this device until you post one to Pigment (asks first).'));
      comp.appendChild(row); U.body.appendChild(comp);
      var roots = ST.notes.filter(function (n) { return !n.parent && (!S.sel || n.anchor === S.sel); }).sort(function (a, b) { return b.at - a.at; });
      if (S.sel) filterBar();
      if (!roots.length) U.body.appendChild(h('p', 'cb-empty', S.sel ? 'No threads on this node yet.' : 'No threads yet. Select a node, a widget or a region and leave the first note.'));
      roots.forEach(function (n) {
        var th = h('div', 'cb-th'), hd = h('div', 'cb-th-h'), a = n.anchor;
        hd.appendChild(NODE_ALL[a] ? chip('node k-' + NODE_ALL[a].kind, anchorLabel(a), function () { selectNode(a); }, 'Show this node in the flow') : chip('facet', anchorLabel(a), null)); th.appendChild(hd);
        th.appendChild(noteEl(n)); ST.notes.filter(function (r) { return r.parent === n.id; }).forEach(function (r) { var e = noteEl(r); e.classList.add('reply'); th.appendChild(e); });
        U.body.appendChild(th);
      });
    }
    function noteEl(n) {
      var c = h('div', 'cb-note'), top = h('div', 'cb-q-top'), row = h('div', 'cb-row');
      top.appendChild(avatar(n.by)); top.appendChild(h('b', '', n.by)); top.appendChild(h('span', 'cb-time', fmtWhen(n.at))); c.appendChild(top); c.appendChild(richText(n.text));
      if (!n.parent) row.appendChild(btn('ghost sm', 'Reply', function () { S.replyTo = n.id; renderSide(); }));
      row.appendChild(btn('ghost sm', n.posted ? 'Posted ' + fmtWhen(n.posted) : 'Post to Pigment', function (b) {
        waitOn(b, 'Waiting for approval' + ELL, function () { return ctx.act.note(n.text, anchorLabel(n.anchor)); }, function (res) { if (res && res.ok) { n.posted = Date.now(); save(); renderSide(true); } else if (res && res.msg && !res.cancelled) toast(res.msg); });
      }, 'Opens an approval sheet, then adds this note to the frame' + AP + 's Requests list'));
      row.appendChild(btn('ghost sm', 'Delete', function () { ST.notes = ST.notes.filter(function (x) { return x.id !== n.id && x.parent !== n.id; }); save(); renderSide(true); }, 'Removes the local note only'));
      c.appendChild(row);
      if (S.fresh === n.id) rise(c, { from: 'in' });
      return c;
    }

    /* ----- digest (what changed since you last looked) and the copy-ready brief ----- */
    function dataSig() {
      var sig = {}, d, r, a = 0, b = 0, fx = 0;
      try { d = ctx.data.get('dsAvb'); if (d && d.rows && d.rows.length) { d.rows.forEach(function (x) { a += Number(x.values[0]) || 0; b += Number(x.values[1]) || 0; }); if (b) sig.avb = Math.round((a / b - 1) * 1000) / 10; } } catch (e) {}
      try { r = ctx.data.get('dsFx'); if (r && r.rows && r.rows.length) { r.rows.forEach(function (x) { fx += Number(x.values[1]) || 0; }); sig.fx = Math.round(fx / 1e5) / 10; } } catch (e) {}
      return sig;
    }
    function allDecs() { var out = []; S.tx.forEach(function (t) { analyse(t).decs.forEach(function (d) { out.push(eff(d)); }); }); ST.manual.forEach(function (m) { out.push(eff({ id: m.id, tx: '', u: -1, kind: 'decision', status: 'proposed', text: m.text, owner: '', due: '', nodes: [], why: [], manual: true })); }); return out; }
    function digest() {
      var seen = ST.seen, out = [], sig = dataSig(), decs = allDecs(), me = ST.me;
      if (!seen) { out.push({ t: 'First visit', s: S.tx.length + ' transcripts are mapped to the flow, with ' + decs.length + ' decision-like statements to review.', go: 'decisions' }); return out; }
      S.tx.forEach(function (t) { if (seen.tx.indexOf(t.id) < 0) out.push({ t: 'New transcript', s: t.title + (t.team ? ' (shared by the team)' : ''), tx: t.id }); });
      decs.forEach(function (d) {
        if (seen.dec.indexOf(d.id) < 0) out.push({ t: 'New ' + (d.kind === 'question' ? 'question' : d.kind), s: clip(d.text, 110), go: 'decisions' });
        else if (seen.status[d.id] && seen.status[d.id] !== d.status) out.push({ t: 'Status changed', s: STATUS[seen.status[d.id]] + ' ' + ARROW + ' ' + STATUS[d.status] + ': ' + clip(d.text, 90), go: 'decisions' });
      });
      ST.notes.forEach(function (n) { if (seen.notes.indexOf(n.id) >= 0) return; var m = me && mentionsOf(n.text).indexOf(me) >= 0; out.push({ t: m ? 'You were mentioned' : 'New note', s: n.by + ' on ' + anchorLabel(n.anchor) + ': ' + clip(n.text, 80), go: 'threads' }); });
      if (seen.sig.avb != null && sig.avb != null && Math.abs(seen.sig.avb - sig.avb) >= 0.1) out.push({ t: 'Data moved', s: 'Actual vs budget went from ' + seen.sig.avb.toFixed(1) + '% to ' + sig.avb.toFixed(1) + '%.', node: 'w:kpi2' });
      if (seen.sig.fx != null && sig.fx != null && Math.abs(seen.sig.fx - sig.fx) >= 0.1) out.push({ t: 'Data moved', s: 'FX impact went from $' + seen.sig.fx.toFixed(1) + 'M to $' + sig.fx.toFixed(1) + 'M.', node: 'w:kpi3' });
      return out;
    }
    function markSeen() { var decs = allDecs(), st = {}; decs.forEach(function (d) { st[d.id] = d.status; }); ST.seen = { at: Date.now(), dec: decs.map(function (d) { return d.id; }).slice(0, 200), notes: ST.notes.map(function (n) { return n.id; }), tx: S.tx.map(function (t) { return t.id; }).slice(0, 12), status: st, sig: dataSig() }; save(); }
    function briefText() {
      var decs = scopeDecs().filter(decInFocus), utts = scopeUtts().filter(inFocus), L = [], hot = {}, ppl = {}, t = S.active === 'all' ? null : txById(S.active), any = scopeTx().some(function (x) { return x.sample; });
      function line(d) { return '- ' + d.text + (d.owner ? ' (' + (d.kind === 'action' ? 'owner' : 'raised by') + ': ' + d.owner + (d.due ? ', due ' + d.due : '') + ')' : '') + (d.nodes.length ? ' [' + d.nodes.map(nodeName).join(', ') + ']' : ''); }
      function sect(title, list) { if (!list.length) return; L.push(''); L.push(title + ' (' + list.length + ')'); list.slice(0, 12).forEach(function (d) { L.push(line(d)); }); }
      L.push('Collaboration brief: ' + (t ? t.title : 'all transcripts') + (focusOn() ? ' - direction: ' + focusLabel() : ''));
      if (any) L.push('SAMPLE content: illustrative transcripts, not real meetings.');
      sect('Agreed', decs.filter(function (d) { return d.status === 'agreed' && d.kind !== 'action'; }));
      sect('Proposed, not yet agreed', decs.filter(function (d) { return d.status === 'proposed' && d.kind === 'decision'; }));
      sect('Open questions', decs.filter(function (d) { return d.status === 'open'; }));
      sect('Actions', decs.filter(function (d) { return d.kind === 'action' && d.status !== 'superseded'; }));
      sect('Superseded', decs.filter(function (d) { return d.status === 'superseded'; }));
      utts.forEach(function (u) { ppl[u.sp] = (ppl[u.sp] || 0) + 1; u.nodes.forEach(function (n) { if (n.s < 1) return; var x = hot[n.id] = hot[n.id] || { n: 0, c: 0 }; x.n++; if (u.stance === 'concern') x.c++; }); });
      var hk = Object.keys(hot).sort(function (a, b) { return hot[b].n - hot[a].n; }).slice(0, 6);
      if (hk.length) { L.push(''); L.push('Most discussed parts of the flow'); hk.forEach(function (id) { L.push('- ' + nodeName(id) + ': ' + hot[id].n + ' statement' + (hot[id].n > 1 ? 's' : '') + (hot[id].c ? ', ' + hot[id].c + ' raising a concern' : '')); }); }
      L.push(''); L.push('Voices: ' + Object.keys(ppl).sort(function (a, b) { return ppl[b] - ppl[a]; }).map(function (p) { return p + ' (' + ppl[p] + ')'; }).join(', '));
      L.push(''); L.push('Drafted by rule-based matching from the transcripts. Please check against the recording before relying on it.');
      return L.join(NL);
    }
    function renderDigest() {
      var items = digest(), box = h('div', 'cb-list'), hd = h('div', 'cb-row'), ta = h('textarea', 'cb-in cb-brief'), row = h('div', 'cb-row');
      hd.appendChild(h('b', 'cb-sec', ST.seen ? 'Since you last looked (' + fmtWhen(ST.seen.at) + ')' : 'Since you last looked'));
      hd.appendChild(btn('sm', 'Mark all as seen', function () { markSeen(); renderSide(); toast('Marked as seen.'); })); U.body.appendChild(hd);
      if (!items.length) U.body.appendChild(h('p', 'cb-empty', 'Nothing new since ' + fmtWhen(ST.seen.at) + '.'));
      items.slice(0, 30).forEach(function (it) {
        var c = h('button', 'cb-dg'); c.type = 'button'; c.appendChild(h('span', 'cb-kind', it.t)); c.appendChild(h('span', '', it.s));
        c.addEventListener('click', function () { if (it.tx) setActive(it.tx); else if (it.node && NODE_ALL[it.node]) selectNode(it.node); else if (it.go) { S.tab = it.go; renderSide(); } });
        box.appendChild(c);
      });
      U.body.appendChild(box);
      U.body.appendChild(h('b', 'cb-sec', 'Share-ready brief'));
      ta.rows = 14; ta.readOnly = true; ta.value = S.briefAi || briefText(); ta.setAttribute('aria-label', 'Brief text to copy'); U.body.appendChild(ta);
      row.appendChild(btn('pri sm', 'Copy brief', function () {
        var done = function (ok) { toast(ok ? 'Copied. Paste it wherever you share updates.' : 'Select the text and copy it.'); };
        try { ta.focus(); ta.select(); } catch (e) {}
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} done(ok); });
        else { var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} done(ok); }
      }));
      if (ctx.ai) row.appendChild(btn('sm', S.briefAi ? 'Back to rule-based' : 'Polish with Claude', function (b) {
        if (S.briefAi) { S.briefAi = ''; renderSide(true); return; }
        var src = briefText();
        waitOn(b, 'Waiting for approval' + ELL, function () {
          return Promise.resolve(ctx.approve({ title: 'Send this brief to Claude?', what: 'The brief text (decisions, owners and node names; no full transcript) is sent to Claude to tighten the wording.', where: 'Claude, through this Canvas. Nothing is written to Pigment.', reversible: 'Yes. The rule-based brief stays available.', confirm: 'Send to Claude' })).then(function (ok) {
            if (!ok) return { ok: false, cancelled: true }; b.textContent = 'Asking Claude' + ELL;
            return ctx.ai.ask('Rewrite this meeting brief for an executive in plain text, under 220 words. Keep every decision, owner and due date; add nothing that is not in it; no markdown.', { brief: src }).then(function (out) { var s = txt(out, 4000).trim(); if (!s) return { ok: false, msg: 'Claude returned nothing; the brief is unchanged.' }; S.briefAi = s + NL + NL + 'Wording polished by Claude from a rule-based draft.'; return { ok: true }; });
          });
        }, function (res) { if (res && res.msg) toast(res.msg); if (res && res.ok) renderSide(true); });
      }));
      row.appendChild(h('span', 'cb-hint', 'Never sent anywhere: you copy and share it yourself.'));
      U.body.appendChild(row);
    }

    /* ----- focus changes: filter, glide the statements, bring nodes forward ----- */
    function applyFocus(force) {
      var f = {}; try { f = ctx.focus.get() || {}; } catch (e) {}
      var sig = [f.region, f.topic, S.ignoreFocus ? 1 : 0].join('|'); if (!force && sig === S.focusSig) return;
      if (sig.split('|').slice(0, 2).join('|') !== String(S.focusSig).split('|').slice(0, 2).join('|')) S.ignoreFocus = false;
      S.focus = f; S.focusSig = [f.region, f.topic, S.ignoreFocus ? 1 : 0].join('|'); S.lit = null;
      renderDir();
      var before = {}, cards;
      if (S.tab === 'quotes' && U.body && !reduced()) Array.prototype.forEach.call(U.body.querySelectorAll('[data-k]'), function (c) { before[c.getAttribute('data-k')] = c.getBoundingClientRect(); });
      renderSide(); paintFlow();
      if (S.tab === 'quotes' && !reduced()) {   // statements that stay glide to their new place; new ones assemble
        cards = Array.prototype.slice.call(U.body.querySelectorAll('[data-k]')).slice(0, 14);
        cards.forEach(function (c, i) { var a = before[c.getAttribute('data-k')], b = c.getBoundingClientRect(); if (a && c.animate && Math.abs(a.top - b.top) > 1) { try { c.animate([{ transform: 'translateY(' + (a.top - b.top).toFixed(1) + 'px)' }, { transform: 'none' }], { duration: 520, delay: Math.min(i, 8) * 30, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }); } catch (e) {} } else if (!a) rise(c, { from: 'in', delay: Math.min(i, 8) * 40 }); });
      }
      if (focusOn()) { var first = G && G.nodes.filter(function (n) { return U.nodeEl[n.id].classList.contains('fwd'); })[0]; if (first) reveal(first.id); say('Collaboration filtered to ' + focusLabel()); }
    }

    /* ----- mount / unmount ----- */
    var CSS = [
      '.cb{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:18px 20px 16px;box-sizing:border-box;color:var(--ink);font:13px/1.5 var(--f-body);overflow:hidden}',
      '.cb *{box-sizing:border-box}.cb [hidden]{display:none!important}.cb button{font-family:inherit}.cb :focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.cb-eb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-deep)}.cb-eb i{width:7px;height:7px;border-radius:50%;background:var(--accent)}.cb-eb em{font-style:normal;color:var(--faint);letter-spacing:.04em;text-transform:none;font-weight:500}',
      '.cb-h{margin:6px 0 2px;font:600 clamp(19px,2.1vw,26px)/1.2 var(--f-display);letter-spacing:-.015em}.cb-sub{margin:0;max-width:78em;color:var(--muted);font-size:12px}',
      '.cb-tx,.cb-dir,.cb-row,.cb-tags,.cb-filter{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.cb-tx{margin-top:10px}.cb-dir{margin-top:8px}.cb-dir-l{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-right:2px}',
      '.cb-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:999px;padding:3px 10px;font:500 11.5px var(--f-body);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}button.cb-chip{cursor:pointer}button.cb-chip:hover{border-color:var(--accent);color:var(--accent-deep)}',
      '.cb-chip.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}.cb-chip.on:hover{color:var(--accent-ink)}.cb-chip small{font-size:9px;font-weight:700;letter-spacing:.06em;padding:1px 5px;border-radius:999px;background:var(--sunk);color:var(--muted)}.cb-chip small.smp{background:var(--warn);color:var(--surface)}',
      '.cb-chip.node{border-radius:7px;border-left:3px solid var(--kc,var(--faint));padding-left:7px}.cb-chip.node.weak{border-style:dashed;border-left-style:solid;color:var(--muted)}.cb-chip.facet{background:var(--sunk);border-color:transparent;color:var(--muted);font-size:11px}.cb-chip.ai,.cb-chip.at,.cb-at{background:var(--accent-soft);border-color:transparent;color:var(--accent-deep)}.cb-chip.add{border-style:dashed}',
      '.cb-at{border-radius:5px;padding:0 4px;font-weight:600}',
      '.cb-b{border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:9px;padding:6px 11px;font:600 12px var(--f-body);cursor:pointer;white-space:nowrap}.cb-b:hover{border-color:var(--accent);color:var(--accent-deep)}.cb-b.sm{padding:4px 9px;font-size:11.5px;border-radius:8px}.cb-b.pri{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}.cb-b.pri:hover{color:var(--accent-ink);filter:brightness(1.06)}.cb-b.ghost{background:transparent;border-color:transparent;color:var(--muted)}.cb-b:disabled{opacity:.5;cursor:not-allowed}.cb-b.wait{opacity:1;border-style:dashed;border-color:var(--accent);color:var(--accent-deep);background:var(--accent-soft);cursor:progress}',
      '.cb-hint{font-size:11px;color:var(--faint)}.cb-hint.foot,.cb-row.foot{margin-top:12px}.cb-empty{margin:18px 4px;color:var(--muted);font-size:12.5px}.cb-sec{display:block;margin:14px 0 6px;font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}',
      '.cb-add{margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:8px;box-shadow:var(--shadow)}.cb-in{width:100%;border:1px solid var(--line);border-radius:9px;background:var(--raise);color:var(--ink);padding:7px 9px;font:13px/1.45 var(--f-body);resize:vertical}select.cb-in{padding:5px 7px}.cb-drop{border:1.5px dashed var(--line);border-radius:10px;padding:10px 12px;color:var(--muted);font-size:12px}.cb-drop.over{border-color:var(--accent);background:var(--accent-soft)}.cb-drop input{font:inherit;color:inherit;max-width:100%}',
      '.cb-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,34%);gap:12px}.cb-card{min-height:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:var(--shadow);overflow:hidden}',
      '.cb.narrow{overflow:auto}.cb.narrow .cb-main{display:flex;flex-direction:column;flex:none}.cb.narrow .cb-card{flex:none}.cb.narrow .cb-flowwrap{max-height:340px}.cb.narrow .cb-body{max-height:none;overflow:visible}',
      '.cb-fh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line-soft)}.cb-fh b{font:600 13px var(--f-body)}.cb-fh span{font-size:11.5px;color:var(--muted)}.cb-legend{margin-left:auto;display:flex;gap:10px;font-size:10.5px;color:var(--faint)}.cb-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}',
      '.cb-flowwrap{flex:1;min-height:160px;overflow:auto;background:var(--raise);padding:2px}.cb-flowsize{position:relative}.cb-flowin{position:absolute;left:0;top:0;transform-origin:0 0}',
      '.cb-lane{position:absolute;top:8px;width:152px;font-size:9.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);white-space:nowrap}.cb-edges{position:absolute;left:0;top:0;pointer-events:none}.cb-edges path{fill:none;stroke:var(--line);stroke-width:1.1;transition:stroke .3s,opacity .3s,stroke-width .3s}.cb-edges path.on{stroke:var(--accent);stroke-width:1.9}.cb-edges path.dim{opacity:.35}',
      '.cb-n{position:absolute;width:152px;height:26px;display:flex;align-items:center;padding:0 9px 0 11px;border:1px solid var(--line);border-left:4px solid var(--kc,var(--faint));border-radius:8px;background:var(--surface);color:var(--ink-2);font:500 10.5px var(--f-body);text-align:left;cursor:pointer;transition:opacity .35s,transform .45s cubic-bezier(.2,.75,.25,1),box-shadow .35s,border-color .2s,background .2s}',
      '.cb-n-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cb-n:hover{border-color:var(--accent);z-index:5}.cb-n.back{opacity:.34}.cb-n.fwd{transform:scale(1.06);z-index:4;box-shadow:0 10px 22px -12px rgba(61,48,32,.55);color:var(--ink)}.cb-n.sel{border-color:var(--accent);background:var(--accent-soft);color:var(--ink);z-index:6;box-shadow:0 0 0 2px var(--accent)}.cb-n.lit{border-color:var(--accent);background:var(--accent-soft);z-index:6;opacity:1;box-shadow:0 0 0 3px var(--accent-soft),0 10px 22px -12px rgba(61,48,32,.6)}',
      '.cb-n.dec::after{content:"";position:absolute;left:-9px;top:8px;width:8px;height:8px;transform:rotate(45deg);background:var(--accent);border:1.5px solid var(--surface);border-radius:2px}',
      '.cb-pin{position:absolute;right:-8px;top:-10px;min-width:19px;height:19px;padding:0 5px;display:flex;align-items:center;justify-content:center;border-radius:10px 10px 10px 3px;background:var(--muted);color:var(--surface);font:700 10px var(--f-body);box-shadow:0 2px 5px rgba(0,0,0,.22);pointer-events:none}.cb-pin.s-concern{background:var(--bad)}.cb-pin.s-positive{background:var(--ok)}.cb-pin.s-question{background:var(--warn)}.cb-pin.s-neutral{background:var(--muted)}',
      '.k-erp{--kc:var(--k-board)}.k-raw,.k-model{--kc:var(--k-cal)}.k-ext{--kc:var(--k-plan)}.k-tl{--kc:var(--k-tl)}.k-dim,.k-cal{--kc:var(--k-dim)}.k-metric{--kc:var(--k-metric)}.k-set{--kc:var(--k-set)}.k-table,.k-board{--kc:var(--k-table)}.k-ds{--kc:var(--k-frame)}.k-widget{--kc:var(--accent)}',
      '.cb-tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--line-soft);overflow-x:auto}.cb-tab{border:0;background:transparent;color:var(--muted);padding:7px 9px 8px;font:600 12px var(--f-body);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}.cb-tab.on{color:var(--ink);border-bottom-color:var(--accent)}.cb-tab small{margin-left:5px;font-size:10px;font-weight:700;padding:1px 5px;border-radius:999px;background:var(--sunk);color:var(--muted)}',
      '.cb-body{flex:1;min-height:0;overflow:auto;padding:10px 12px 14px}.cb-list{display:grid;gap:8px}.cb-filter{margin-bottom:8px}',
      '.cb-q{border:1px solid var(--line-soft);border-left:3px solid var(--line);border-radius:10px;background:var(--raise);padding:8px 10px;cursor:pointer;transition:border-color .2s,box-shadow .3s}.cb-q:hover{border-color:var(--accent)}.cb-q.s-concern{border-left-color:var(--bad)}.cb-q.s-positive{border-left-color:var(--ok)}.cb-q.s-question{border-left-color:var(--warn)}.cb-q.lit{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}',
      '.cb-q-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px}.cb-av{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font:700 10px var(--f-body);flex:none}.cb-role{color:var(--faint);font-size:11px}.cb-time{margin-left:auto;color:var(--faint);font:500 10.5px var(--f-mono)}.cb-st{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}.s-concern .cb-st{color:var(--bad)}.s-positive .cb-st{color:var(--ok)}.s-question .cb-st{color:var(--warn)}',
      '.cb-q-t,.cb-note-t{margin:5px 0 6px;font-size:12.5px;color:var(--ink-2);overflow-wrap:anywhere}.cb-node-info{border:1px solid var(--line-soft);border-left:4px solid var(--kc,var(--faint));border-radius:10px;padding:8px 10px;margin-bottom:8px;background:var(--raise)}.cb-node-info p{margin:3px 0 6px;font-size:12px;color:var(--muted)}',
      '.cb-d,.cb-p,.cb-th,.cb-comp{border:1px solid var(--line-soft);border-radius:12px;background:var(--raise);padding:10px 11px;margin-top:8px;display:grid;gap:6px}.cb-d{border-left:3px solid var(--line)}.cb-d.st-agreed{border-left-color:var(--ok)}.cb-d.st-proposed{border-left-color:var(--accent)}.cb-d.st-open{border-left-color:var(--warn)}.cb-d.st-superseded{opacity:.72}.cb-d.st-superseded .cb-d-t{text-decoration:line-through}.cb-d.edit{border-color:var(--accent)}',
      '.cb-d-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.cb-pill{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:var(--sunk);color:var(--muted)}.cb-pill.st-agreed{background:var(--ok);color:var(--surface)}.cb-pill.st-proposed{background:var(--accent);color:var(--accent-ink)}.cb-pill.st-open{background:var(--warn);color:var(--surface)}',
      '.cb-kind{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}.cb-kind.ok{color:var(--ok)}.cb-d-t{margin:0;font:600 13px/1.4 var(--f-body);color:var(--ink);overflow-wrap:anywhere}.cb-d-m{margin:0;font-size:11.5px;color:var(--muted)}.cb-sent{font-size:11px;color:var(--faint);min-height:14px}',
      '.cb-why summary{cursor:pointer;font-size:11.5px;font-weight:600;color:var(--muted)}.cb-why .cb-q{margin-top:6px;background:var(--surface)}.cb-lab{display:grid;gap:3px;font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}.cb-grid2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}',
      '.cb-bar{display:flex;height:6px;border-radius:999px;overflow:hidden;background:var(--sunk)}.cb-bar i.s-concern{background:var(--bad)}.cb-bar i.s-positive{background:var(--ok)}.cb-bar i.s-question{background:var(--warn)}.cb-bar i.s-neutral{background:var(--faint)}',
      '.cb-note{border-top:1px solid var(--line-soft);padding-top:7px}.cb-th-h+.cb-note{border-top:0;padding-top:0}.cb-note.reply{margin-left:18px}.cb-dg{display:grid;gap:2px;text-align:left;border:1px solid var(--line-soft);border-radius:10px;background:var(--raise);color:var(--ink-2);padding:7px 10px;font:12.5px/1.4 var(--f-body);cursor:pointer}.cb-dg:hover{border-color:var(--accent)}.cb-brief{font:12px/1.5 var(--f-mono);min-height:180px}',
      '.cb.still *{transition:none!important}@media (prefers-reduced-motion: reduce){.cb *{transition:none!important;animation:none!important}}'
    ].join('');

    function mount(el, c) {
      ctx = c; root = el; alive++; cache = {}; G = null; U = {};
      S = { tx: [], active: '', sel: null, lit: null, tab: 'quotes', person: '', ignoreFocus: false, focus: {}, focusSig: '', ai: {}, adding: false, editing: '', openWhy: {}, draft: '', replyTo: '', anchor: '', fresh: '', briefAi: '' };
      ST = loadState(); buildEntities(); S.tx = loadTx(); S.active = S.tx.some(function (t) { return t.id === ST.active; }) || ST.active === 'all' ? ST.active : S.tx[0].id;
      try { S.focus = ctx.focus.get() || {}; } catch (e) {}
      S.focusSig = [S.focus.region, S.focus.topic, 0].join('|');
      clear(el);
      var st = h('style'); st.textContent = CSS; el.appendChild(st);
      var box = h('div', 'cb'); U.box = box;
      U.head = h('div', 'cb-head'); box.appendChild(U.head);
      var main = h('div', 'cb-main'), flow = h('section', 'cb-card'), side = h('section', 'cb-card'), fh = h('div', 'cb-fh'), lg = h('div', 'cb-legend');
      flow.setAttribute('aria-label', 'Flow diagram with speech pins'); side.setAttribute('aria-label', 'Collaboration details');
      fh.appendChild(h('b', '', 'The flow, with speech pins')); U.flowNote = h('span', '', ''); fh.appendChild(U.flowNote);
      [['bad', 'Concern'], ['warn', 'Question'], ['ok', 'Positive'], ['muted', 'Neutral']].forEach(function (x) { var s = h('span'), i = h('i'); i.style.background = 'var(--' + x[0] + ')'; s.appendChild(i); s.appendChild(document.createTextNode(x[1])); lg.appendChild(s); });
      fh.appendChild(lg); flow.appendChild(fh);
      U.flowWrap = h('div', 'cb-flowwrap'); U.flowSize = h('div', 'cb-flowsize'); U.flowIn = h('div', 'cb-flowin'); U.flowSize.appendChild(U.flowIn); U.flowWrap.appendChild(U.flowSize); flow.appendChild(U.flowWrap);
      U.tabs = h('div', 'cb-tabs'); U.tabs.setAttribute('role', 'tablist'); U.body = h('div', 'cb-body'); side.appendChild(U.tabs); side.appendChild(U.body);
      main.appendChild(flow); main.appendChild(side); box.appendChild(main); el.appendChild(box);
      var size = function () { if (!U.box) return; U.box.classList.toggle('narrow', U.box.clientWidth < 900 || U.box.clientHeight < 520); fitFlow(); };
      if (window.ResizeObserver) { obs = new ResizeObserver(size); obs.observe(box); }
      renderHead(); size(); drawFlow(); size(); paintFlow('all'); renderSide();
      try { offs.push(ctx.focus.on(function () { applyFocus(false); })); } catch (e) {}
      try { offs.push(ctx.theme.on(function () { paintFlow(); })); } catch (e) {}
      try { offs.push(ctx.data.on('dsAvb', function () { if (S && S.tab === 'digest') later(function () { if (root) renderSide(true); }, 60); })); } catch (e) {}
      if (!ST.seen) later(function () { if (root && !ST.seen) { /* the first visit is recorded only when the viewer marks it */ } }, 0);
    }
    function unmount() {
      alive++; offs.forEach(function (o) { try { if (typeof o === 'function') o(); } catch (e) {} }); offs = [];
      timers.forEach(function (t) { window.clearTimeout(t); }); timers = [];
      if (obs) { try { obs.disconnect(); } catch (e) {} obs = null; }
      if (root) clear(root); root = null; U = {}; G = null; cache = {};
    }
    return { id: 'collab', label: 'Collaboration', icon: ICON, kind: 'fluid', group: 'Collaborate', mount: mount, unmount: unmount, onFocus: function () { if (root) applyFocus(false); } };
  }

  var tries = 0;
  function register() {
    if (window.Lumina && typeof window.Lumina.registerView === 'function') { try { window.Lumina.registerView(createView()); } catch (e) {} return; }
    if (tries++ < 60) window.setTimeout(register, 250);
  }
  register();
})();
