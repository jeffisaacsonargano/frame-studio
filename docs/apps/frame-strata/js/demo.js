/* Framecraft — built-in sample frame ("Revenue Pulse") with three versions.
   Everything here is example data, generated deterministically. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});

  const REGIONS = { AMER: 0.54, EMEA: 0.3, APAC: 0.16 };
  const MONTHS = ['Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dec 26'];
  const SEGMENTS = ['Enterprise', 'Mid-Market', 'SMB'];
  const SEASON = [0.78, 0.86, 1.22, 0.84, 0.9, 1.25, 0.82, 0.88, 1.28, 0.92, 1.0, 1.45];
  const SMOOTH = [0.85, 0.9, 1.15, 0.88, 0.93, 1.17, 0.88, 0.92, 1.18, 0.95, 1.0, 1.19];
  const ACTUAL_MONTHS = 10;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildModel() {
    const rand = rng(20261120);
    const jit = (p) => 1 + (rand() * 2 - 1) * p;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const sM = mean(SEASON), smM = mean(SMOOTH);
    const g = { AMER: 0.131, EMEA: 0.118, APAC: 0.164 };
    const gm = { AMER: 0.792, EMEA: 0.774, APAC: 0.748 };
    const att = { AMER: 1.058, EMEA: 1.021, APAC: 0.973 };
    const natt = { AMER: 1.04, EMEA: 0.97, APAC: 0.92 };
    const cov = { AMER: 3.6, EMEA: 3.1, APAC: 2.4 };
    const segShare = { AMER: [0.6, 0.28, 0.12], EMEA: [0.57, 0.3, 0.13], APAC: [0.52, 0.31, 0.17] };
    const nrrBase = [1.172, 1.084, 0.962];
    const nrrAdj = { AMER: 0.01, EMEA: -0.005, APAC: -0.02 };
    const custTot = [162, 694, 2406];
    const R = {};
    Object.keys(REGIONS).forEach((r) => {
      const share = REGIONS[r];
      const arr = 48.62e6 * share * jit(0.02);
      const arrLy = arr / (1 + g[r]);
      const nnarr = (arr - arrLy) * 0.97;
      const arrTarget = arr / att[r];
      const nnTarget = nnarr / natt[r];
      const pipeline = nnTarget * cov[r];
      const arrForecast = arr * (1.019 + rand() * 0.006);
      const bookings = [], plan = [], forecast = [];
      for (let m = 0; m < 12; m++) {
        const p = ((nnTarget * 1.32) / 12) * (SMOOTH[m] / smM);
        plan.push(p);
        if (m < ACTUAL_MONTHS) { bookings.push(((nnarr * 1.32) / 12) * (SEASON[m] / sM) * jit(0.06)); forecast.push(null); }
        else { bookings.push(null); forecast.push(p * (0.94 + rand() * 0.08)); }
      }
      const seg = SEGMENTS.map((_, i) => ({
        arr: arr * segShare[r][i],
        nrr: nrrBase[i] + nrrAdj[r] + (rand() - 0.5) * 0.01,
        customers: Math.round(custTot[i] * share * jit(0.05)),
      }));
      R[r] = { arr, arrLy, nnarr, gm: gm[r], arrTarget, nnTarget, pipeline, arrForecast, bookings, plan, forecast, seg };
    });
    // "All" = Pigment's aggregation across Region
    const keys = Object.keys(R);
    const sum = (f) => keys.reduce((s, k) => s + f(R[k]), 0);
    const all = {
      arr: sum((x) => x.arr), arrLy: sum((x) => x.arrLy), nnarr: sum((x) => x.nnarr),
      arrTarget: sum((x) => x.arrTarget), nnTarget: sum((x) => x.nnTarget), pipeline: sum((x) => x.pipeline),
      arrForecast: sum((x) => x.arrForecast),
    };
    all.gm = sum((x) => x.gm * x.arr) / all.arr;
    all.bookings = MONTHS.map((_, m) => (m < ACTUAL_MONTHS ? sum((x) => x.bookings[m]) : null));
    all.plan = MONTHS.map((_, m) => sum((x) => x.plan[m]));
    all.forecast = MONTHS.map((_, m) => (m < ACTUAL_MONTHS ? null : sum((x) => x.forecast[m])));
    all.seg = SEGMENTS.map((_, i) => {
      const a = sum((x) => x.seg[i].arr);
      return { arr: a, nrr: sum((x) => x.seg[i].nrr * x.seg[i].arr) / a, customers: sum((x) => x.seg[i].customers) };
    });
    R.All = all;
    return R;
  }

  // binding name -> value getter (region model, label item)
  const GETTERS = {
    arr: (m, l) => (l && SEGMENTS.includes(l) ? m.seg[SEGMENTS.indexOf(l)].arr : m.arr),
    arrLy: (m) => m.arrLy,
    netNewArr: (m) => m.nnarr,
    grossMargin: (m) => m.gm,
    arrTarget: (m) => m.arrTarget,
    netNewArrTarget: (m) => m.nnTarget,
    openPipeline: (m) => m.pipeline,
    arrForecast: (m) => m.arrForecast,
    newBookings: (m, l) => m.bookings[MONTHS.indexOf(l)],
    bookingsPlan: (m, l) => m.plan[MONTHS.indexOf(l)],
    bookingsForecast: (m, l) => m.forecast[MONTHS.indexOf(l)],
    nrr: (m, l) => m.seg[SEGMENTS.indexOf(l)].nrr,
    activeCustomers: (m, l) => m.seg[SEGMENTS.indexOf(l)].customers,
  };
  const LIST_ITEMS = { monthList: MONTHS, segmentList: SEGMENTS, regionList: Object.keys(REGIONS) };

  const BLOCKS = {
    arr: { name: 'ARR', kind: 'Metric', folder: 'Revenue › ARR', dims: ['Month', 'Region', 'Segment'], formula: "'Subscription MRR' * 12", format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Last', description: 'Annual recurring revenue at month end.', upstream: ['subMrr'] },
    arrLy: { name: 'ARR LY', kind: 'Metric', folder: 'Revenue › ARR', dims: ['Month', 'Region', 'Segment'], formula: 'ARR[SELECT: Month - 12]', format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Last', description: 'ARR in the same month last year.', upstream: ['arr'] },
    netNewArr: { name: 'Net New ARR', kind: 'Metric', folder: 'Revenue › ARR', dims: ['Month', 'Region', 'Segment'], formula: "'New Business ARR' + 'Expansion ARR' - 'Churned ARR'", format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Sum', upstream: ['expansion', 'churned', 'contracts'] },
    grossMargin: { name: 'Gross Margin %', kind: 'Metric', folder: 'P&L › Margin', dims: ['Month', 'Region'], formula: 'IFDEFINED(Revenue, (Revenue - COGS) / Revenue)', format: { type: 'percent', decimals: 1 }, aggregator: 'Avg', upstream: ['revenue', 'cogs'] },
    arrTarget: { name: 'ARR Target', kind: 'Metric', folder: 'Targets', dims: ['Month', 'Region'], formula: "'Targets Input'.'ARR Target'", format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Last', upstream: ['targets'] },
    netNewArrTarget: { name: 'Net New ARR Target', kind: 'Metric', folder: 'Targets', dims: ['Month', 'Region'], formula: "'Targets Input'.'Net New ARR Target'", format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Sum', upstream: ['targets'] },
    openPipeline: { name: 'Open Pipeline', kind: 'Metric', folder: 'Pipeline', dims: ['Month', 'Region', 'Segment'], formula: "Opportunities.Amount[FILTER: Opportunities.'Is Open'][BY SUM: Opportunities.'Close Month', Opportunities.Region, Opportunities.Segment]", format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Sum', upstream: ['opps'] },
    arrForecast: { name: 'ARR Forecast', kind: 'Metric', folder: 'Forecast', dims: ['Month', 'Region'], formula: "ARR[SELECT: Month.'Last Actual'] + CUMULATE('Bookings Forecast', Month)", format: { type: 'currency', prefix: '$', scale: 'M', decimals: 1 }, aggregator: 'Last', upstream: ['arr', 'bookingsForecast'] },
    newBookings: { name: 'New Bookings', kind: 'Metric', folder: 'Pipeline › Bookings', dims: ['Month', 'Region', 'Segment'], formula: "Opportunities.Amount[FILTER: Opportunities.Stage = Stage.\"Closed Won\"][BY SUM: Opportunities.'Close Month', Opportunities.Region, Opportunities.Segment]", format: { type: 'currency', prefix: '$', scale: 'K', decimals: 0 }, aggregator: 'Sum', upstream: ['opps'] },
    bookingsPlan: { name: 'Bookings Plan', kind: 'Metric', folder: 'Targets', dims: ['Month', 'Region', 'Segment'], formula: null, input: true, format: { type: 'currency', prefix: '$', scale: 'K', decimals: 0 }, aggregator: 'Sum', description: 'Input metric, entered by Sales Ops.', upstream: [] },
    bookingsForecast: { name: 'Bookings Forecast', kind: 'Metric', folder: 'Forecast', dims: ['Month', 'Region', 'Segment'], formula: "IF(Month.'Is Actual', BLANK, 'Weighted Pipeline' * 'Close Rate')", format: { type: 'currency', prefix: '$', scale: 'K', decimals: 0 }, aggregator: 'Sum', upstream: ['opps'] },
    nrr: { name: 'NRR %', kind: 'Metric', folder: 'Revenue › Retention', dims: ['Month', 'Region', 'Segment'], formula: "(ARR LY + 'Expansion ARR' - 'Churned ARR') / ARR LY", format: { type: 'percent', decimals: 1 }, aggregator: 'Avg', upstream: ['arrLy', 'expansion', 'churned'] },
    activeCustomers: { name: 'Active Customers', kind: 'Metric', folder: 'Customers', dims: ['Month', 'Region', 'Segment'], formula: "Customer.'Is Active'[BY COUNT: Customer.Region, Customer.Segment]", format: { type: 'integer', decimals: 0 }, aggregator: 'Sum', upstream: ['customer'] },
    monthList: { name: 'Month', kind: 'Dimension', folder: 'Calendar', dims: [], formula: null, items: MONTHS.length, description: 'Calendar dimension, Jan 26 – Dec 26.' },
    regionList: { name: 'Region', kind: 'Dimension', folder: 'Org', dims: [], formula: null, items: 3 },
    segmentList: { name: 'Segment', kind: 'Dimension', folder: 'Org', dims: [], formula: null, items: 3 },
  };
  const UPSTREAM = {
    subMrr: { name: 'Subscription MRR', kind: 'Metric', formula: "Contracts.MRR[BY SUM: Contracts.Month, Contracts.Region, Contracts.Segment]", upstream: ['contracts'] },
    contracts: { name: 'Contracts', kind: 'Transaction list', formula: null, description: 'Imported nightly from billing.', upstream: [] },
    expansion: { name: 'Expansion ARR', kind: 'Metric', formula: "Contracts.'Delta ARR'[FILTER: Contracts.Type = \"Expansion\"][BY SUM: Contracts.Month]", upstream: ['contracts'] },
    churned: { name: 'Churned ARR', kind: 'Metric', formula: "Contracts.'Delta ARR'[FILTER: Contracts.Type = \"Churn\"][BY SUM: Contracts.Month]", upstream: ['contracts'] },
    revenue: { name: 'Revenue', kind: 'Metric', formula: "'GL Actuals'.Amount[FILTER: Account.Type = \"Revenue\"]", upstream: ['gl'] },
    cogs: { name: 'COGS', kind: 'Metric', formula: "'GL Actuals'.Amount[FILTER: Account.Type = \"COGS\"]", upstream: ['gl'] },
    gl: { name: 'GL Actuals', kind: 'Transaction list', formula: null, description: 'Imported from the ERP.', upstream: [] },
    targets: { name: 'Targets Input', kind: 'Table', formula: null, description: 'Board-approved targets.', upstream: [] },
    opps: { name: 'Opportunities', kind: 'Transaction list', formula: null, description: 'Synced from CRM every hour.', upstream: [] },
    customer: { name: 'Customer', kind: 'Dimension', formula: null, upstream: [] },
  };

  const VERSIONS = [
    { n: 1, id: 'v1', label: 'Initial build', createdAt: '2026-09-18T15:42:00Z', author: 'JI', note: 'KPI tiles and the monthly bookings chart.' },
    { n: 2, id: 'v2', label: 'Segment table', createdAt: '2026-10-09T10:05:00Z', author: 'JI', note: 'Adds ARR by segment and wires plan attainment to ARR Target.' },
    { n: 3, id: 'v3', label: 'Region filter + pipeline', createdAt: '2026-11-14T17:20:00Z', author: 'JI', note: 'Region selector, pipeline coverage, Net New ARR vs target, forecast.' },
  ];

  function dsDefs(n) {
    const sel = n >= 3 ? [{ binding: 'regionList' }] : [];
    const kv = [{ binding: 'arr', aggregator: 'Last' }, { binding: 'arrLy', aggregator: 'Last' }, { binding: 'netNewArr', aggregator: 'Sum' }, { binding: 'grossMargin' }];
    if (n >= 2) kv.push({ binding: 'arrTarget', aggregator: 'Last' });
    if (n >= 3) kv.push({ binding: 'netNewArrTarget', aggregator: 'Sum' }, { binding: 'openPipeline', aggregator: 'Sum' }, { binding: 'arrForecast', aggregator: 'Last' });
    const bv = [{ binding: 'newBookings', aggregator: 'Sum' }, { binding: 'bookingsPlan', aggregator: 'Sum' }];
    if (n >= 3) bv.push({ binding: 'bookingsForecast', aggregator: 'Sum' });
    const out = [
      { name: 'kpis', values: kv, labels: [], selectors: sel },
      { name: 'bookingsByMonth', values: bv, labels: [{ binding: 'monthList' }], selectors: sel },
    ];
    if (n >= 2) out.push({ name: 'segmentTable', values: [{ binding: 'arr', aggregator: 'Last' }, { binding: 'nrr' }, { binding: 'activeCustomers', aggregator: 'Sum' }], labels: [{ binding: 'segmentList' }], selectors: sel });
    return out;
  }

  function bindingsFor(defs, n) {
    const names = new Set();
    defs.forEach((d) => [...d.values, ...d.labels, ...d.selectors].forEach((x) => names.add(x.binding)));
    if (n >= 3) names.add('regionList');
    return [...names].map((name) => {
      const b = BLOCKS[name];
      const isList = b.kind === 'Dimension';
      return isList
        ? { name, type: 'List', list_id: 'lst-' + name, can_read: name === 'regionList', can_write: false }
        : { name, type: 'Metric', metric_id: 'mtr-' + name, can_read: true, can_write: false };
    });
  }

  function rowsFor(def, region, model) {
    const m = model[region];
    const labelList = def.labels[0] && LIST_ITEMS[def.labels[0].binding];
    const labelSets = labelList ? labelList.map((l) => [l]) : [[]];
    const rows = labelSets.map((labels) => ({ labels, values: def.values.map((v) => { const x = GETTERS[v.binding](m, labels[0]); return x == null ? null : x; }) }));
    return { rows, rowOffset: 0, totalRowCount: rows.length };
  }

  S.preprocessFrame = function (src, n) {
    const out = [], stack = [];
    src.split('\n').forEach((line) => {
      const mIf = line.match(/^\s*\/\/#if v(>=|<=|<|>|==)(\d+)/);
      if (mIf) {
        const k = +mIf[2], op = mIf[1];
        const ok = op === '>=' ? n >= k : op === '<=' ? n <= k : op === '<' ? n < k : op === '>' ? n > k : n === k;
        stack.push(ok);
        return;
      }
      if (/^\s*\/\/#endif/.test(line)) { stack.pop(); return; }
      if (stack.every(Boolean)) out.push(line);
    });
    return out.join('\n');
  };

  let model = null;
  S.demo = {
    versions: VERSIONS,
    key: 'sample-revenue-pulse',
    build(n, frameSrc, pigmentCss) {
      model = model || buildModel();
      const ver = VERSIONS.find((v) => v.n === n) || VERSIONS[VERSIONS.length - 1];
      const code = S.preprocessFrame(frameSrc, ver.n).replace('__PIGMENT_CSS__', () => JSON.stringify(pigmentCss));
      const defs = dsDefs(ver.n);
      const data = {};
      defs.forEach((d) => {
        data[d.name] = { default: rowsFor(d, 'All', model), filters: {} };
        if (d.selectors.length) Object.keys(REGIONS).forEach((r) => { data[d.name].filters['regionList=' + r] = rowsFor(d, r, model); });
      });
      const bindings = bindingsFor(defs, ver.n);
      const blocks = {};
      bindings.forEach((b) => { blocks[b.name] = JSON.parse(JSON.stringify(BLOCKS[b.name])); });
      return {
        schema: 1,
        key: S.demo.key,
        frame: { id: 'frm-sample-revenue-pulse', name: 'Revenue Pulse', application: 'Revenue Planning', workspace: 'Sample workspace', isSample: true },
        version: { id: ver.id, n: ver.n, label: ver.label, createdAt: ver.createdAt, author: ver.author, note: ver.note, source: 'sample' },
        code,
        bindings,
        dataSources: defs,
        data,
        items: { regionList: LIST_ITEMS.regionList.slice(), monthList: MONTHS.slice(), segmentList: SEGMENTS.slice() },
        blocks,
        upstream: JSON.parse(JSON.stringify(UPSTREAM)),
        tunable: true,
      };
    },
  };
})();
