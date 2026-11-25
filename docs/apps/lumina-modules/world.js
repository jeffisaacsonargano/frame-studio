/* module: world */
/* Lumina module: Walk the Frame (contract v1).
A first-person walk through this frame, its Blockflow, the warehouse behind it and the Graphite engine below.
This is the Pigment port of Frame Studio's "Frame World": the same layout and rules, drawn by a small raw-WebGL
renderer written here (no three.js, no external scripts). Self-contained, ASCII-only, no backslashes, no network,
no eval, no markup strings except the static icon below; every text node is set with textContent.
Data: 2026 actual and budget by month come from the frame's own data sources (dsTrend, dsTrendRegion, dsFx,
dsChannel) when they have arrived; otherwise the snapshot figures of 24 Nov 2026 are used and the badge says so.
Nothing is written anywhere. Lazy: nothing below runs until the view is opened. */
(function () {
'use strict';
if (typeof window === 'undefined') return;
var ICON = "<svg viewBox='0 0 18 18' width='18' height='18' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M2.5 13.5l6.5-3.2 6.5 3.2-6.5 3z'/><path d='M5 11V7.5M9 9.6V4M13 11V6'/><circle cx='9' cy='2.6' r='1'/></svg>";

/* ------------------------------------------------------------------ snapshot figures (24 Nov 2026) and the block map */
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var REGS = ['All', 'NAM', 'LATAM', 'EMEA', 'APAC'];
var SNAP = {
bud: [31.575, 31.9, 33.4, 34.3, 35.2, 36.2, 38.0, 40.0, 43.5, 48.0, 57.5, 58.7],
act: [31.775, 31.95, 33.48, 34.36, 34.742, 35.693],
K: { All: { ytd: 202.0, pct: -0.3, fx: 9.4 }, NAM: { ytd: 72.5, pct: -2.3 }, LATAM: { ytd: 10.4, pct: 19.2 }, EMEA: { ytd: 79.2, pct: -1.9, fx: 10.4 }, APAC: { ytd: 39.8, pct: 1.1 } },
channels: [['Direct', 0.476], ['Marketplace', 0.24], ['Retail - Specialist', 0.12], ['Retail - General', 0.094], ['B2B Direct', 0.07]]
};
var FML = {
trend: "'Actual Net Revenue USD'[REMOVE SUM: Product]",
act: "'Sales Actuals'.'Net Revenue USD'[BY SUM: 'Sales Actuals'.Channel, 'Sales Actuals'.Month]",
avb: "IF('Is Comparison Month', 'Actual Net Revenue USD'[REMOVE SUM: Product])",
age: "'Actual Net Revenue USD'[REMOVE SUM: Country][BY SUM: 'Product Age', Product]",
fx: "IF('Is Comparison Month', 'Actual Net Revenue USD'[REMOVE SUM: Product] - 'Actual Net Revenue LC' / 'Budget FX Rate'[BY CONSTANT: Month.Year])"
};
var NODES = {
kYtd: { n: 'Net Revenue Trend', k: 'Metric', x: -10, z: -12, f: FML.trend },
kVar: { n: 'AVB Net Revenue USD', k: 'Metric', x: 0, z: -12, f: FML.avb },
kFx: { n: 'FX Impact USD', k: 'Metric', x: 10, z: -12, f: FML.fx },
age: { n: 'Revenue by Product Age', k: 'Metric', x: -19, z: -7, f: FML.age },
act: { n: 'Actual Net Revenue USD', k: 'Metric', x: -6, z: -4, f: FML.act },
cmp: { n: 'Is Comparison Month', k: 'Metric', x: 2.5, z: -4, d: 'Boolean setting: TRUE for the months where actuals meet budget.' },
lc: { n: 'Actual Net Revenue LC', k: 'Metric', x: 9, z: -3, d: 'Actuals in local currency.' },
fxr: { n: 'Budget FX Rate', k: 'Metric', x: 15.5, z: -3.5, d: 'Budget exchange rate, held by year.' },
dProd: { n: 'Product', k: 'Dimension', x: -17, z: 2, d: 'Dimension list: the products.' },
dMonth: { n: 'Month', k: 'Dimension', x: 2.5, z: 3, d: 'Calendar dimension.' },
tNs: { n: 'Sales Actuals', k: 'TxList', x: -8, z: 5.5, d: 'Transaction list: one row per sale.' },
tSf: { n: 'FX rates', k: 'Table', x: 11, z: 4, d: 'Table of rates from the warehouse (illustrative name).' },
sf: { n: 'Snowflake', k: 'Source', x: 0, z: 44 },
ns: { n: 'NetSuite', k: 'Source', x: 0, z: 67 },
sfdc: { n: 'Salesforce', k: 'Source', x: -17, z: 62 },
wd: { n: 'Workday', k: 'Source', x: 17, z: 62 },
/* the hiring lever: the Revenue Planning model has no headcount data, so these blocks and draft formulas are illustrative */
ros: { n: 'Employee Roster', k: 'TxList', x: 24, z: 3, hire: true, d: 'one row per hire (Name, Role, Region, Start Month, Salary). Source: Workday, through the warehouse (illustrative).' },
hc: { n: 'Headcount', k: 'Metric', x: 21, z: -3, hire: true, f: "CUMULATE('Employee Roster'.Headcount[BY SUM: 'Employee Roster'.Role, 'Employee Roster'.'Start Month'->Month], Month)" },
pay: { n: 'Payroll Cost', k: 'Metric', x: 27, z: -3, hire: true, f: "CUMULATE('Employee Roster'.Salary[BY SUM: 'Employee Roster'.Role, 'Employee Roster'.'Start Month'->Month], Month) / 12" },
cap: { n: 'Sales Capacity', k: 'Metric', x: 23, z: -9, hire: true, f: "Headcount[FILTER: 'Role' = 'Role'." + '"Sales rep"' + "] * 'Quota per Rep' * 'Ramp %'" },
fc: { n: 'Revenue Forecast USD', k: 'Metric', x: 17, z: -16, hire: true, f: "'Baseline Forecast USD' + 'Sales Capacity'[REMOVE SUM: Role]" }
};
/* the loop starts with requirements: lines from the call are tagged to proposed build items, which stand in Blockflow as ghosts until built (illustrative) */
NODES.bud = { n: 'Budget Net Revenue USD', k: 'Metric', x: 5.6, z: -8.2, prop: true, f: "'Budget Load'.'Net Revenue USD'[BY SUM: 'Budget Load'.Country, 'Budget Load'.Month]" };
NODES.bk = { n: 'Salesforce Bookings', k: 'TxList', x: -12.6, z: -1, prop: true, d: 'bookings pulled from Salesforce through the warehouse.' };
NODES.hc.prop = true; NODES.ros.prop = true;
var PROPQ = { hc: ['Priya', 'We need headcount by region.'], bud: ['Miles', 'Budget is monthly by country.'], bk: ['Dot', 'Pull bookings from Salesforce.'], ros: ['Priya', 'And who is on the team, with start dates.'] };
var H_EDGES = [['hc', 'ros'], ['pay', 'ros'], ['cap', 'hc'], ['fc', 'cap'], ['fc', 'act'], ['kVar', 'bud'], ['fc', 'bk']];
var ROLES = [['Sales rep', 180, 'adds up to $250K of revenue a month after a 4-month ramp'], ['Customer success', 130, 'adds about $40K a month from month 3 (retention, assumed)'], ['Engineer', 190, 'cost only this year'], ['Marketing', 150, 'adds about $50K a month from month 4 (pipeline, assumed)']];
var KIND = { Metric: 'Metric', Dimension: 'Dimension', TxList: 'Transaction list', Table: 'Table', Source: 'Source' };
var EDGES = [['kYtd', 'act'], ['kVar', 'act'], ['kVar', 'cmp'], ['kFx', 'act'], ['kFx', 'cmp'], ['kFx', 'lc'], ['kFx', 'fxr'], ['age', 'act'], ['age', 'dProd'], ['cmp', 'dMonth'], ['act', 'tNs'], ['lc', 'tNs'], ['fxr', 'tSf']];
var ALLE = EDGES.concat(H_EDGES), DEPS = EDGES.concat([['tNs', 'sf'], ['tSf', 'sf'], ['sf', 'ns'], ['sf', 'sfdc'], ['sf', 'wd'], ['ros', 'sf'], ['bk', 'sf'], ['bud', 'sf']], H_EDGES);
var TRACES = [{ kpi: 'Net revenue 2026 to date', x: -10, c: 'blue', path: ['kYtd', 'act', 'tNs', 'sf'] }, { kpi: 'Against budget', x: 0, c: 'yellow', path: ['kVar', 'act', 'tNs', 'sf'] }, { kpi: 'Exchange-rate effect', x: 10, c: 'pink', path: ['kFx', 'fxr', 'tSf', 'sf'] }];
var AFF = [['act', 0], ['kYtd', 0.7], ['kVar', 0.85], ['kFx', 1.0], ['age', 1.15]], G_CELLS = { act: 2880, kYtd: 480, kVar: 320, kFx: 320, age: 360 }, G_TOTAL = 13560, G_PASS = { kYtd: 0, kVar: 0, age: 1, act: 1, kFx: 2 };
/* Illustrative SQL for the nine warehouse tables: column names are examples, not from a real warehouse. */
var WSQL = {
"RAW.NETSUITE_GL": { kind: "Raw table, landed by the Airflow load (Fivetran-style)", rows: 12480, feed: null, note: null, q: ["-- peek at the landed table: one row per GL line", "select", "  transaction_id, posting_date, subsidiary,", "  account_number, item_id, customer_id,", "  sales_channel, amount_local, currency_code,", "  _fivetran_synced", "from RAW.NETSUITE_GL", "order by posting_date desc", "limit 10;"] },
"STG_NETSUITE_GL": { kind: "dbt staging model", rows: 12480, feed: null, note: null, q: ["with source as (", "  select * from {{ source('netsuite', 'gl') }}", "),", "renamed as (", "  select", "    transaction_id,", "    cast(posting_date as date)         as posting_date,", "    upper(subsidiary)                  as country_code,", "    item_id                            as product_id,", "    sales_channel                      as channel,", "    cast(amount_local as number(18,2)) as amount_local,", "    currency_code", "  from source", "  where account_number like '4%'  -- revenue accounts", ")", "select * from renamed"] },
"FCT_NET_REVENUE": { kind: "dbt mart", rows: 3168, feed: "act", note: "Feeds Pigment: Actual Net Revenue USD", q: ["-- feeds Pigment: Actual Net Revenue USD", "select", "  date_trunc('month', g.posting_date)  as month,", "  g.country_code, g.product_id, g.channel,", "  sum(g.amount_local)                  as net_revenue_lc,", "  sum(g.amount_local * fx.rate_to_usd) as net_revenue_usd", "from {{ ref('stg_netsuite_gl') }} g", "join {{ ref('fx_rates_monthly') }} fx", "  on fx.currency_code = g.currency_code", " and fx.month = date_trunc('month', g.posting_date)", "group by 1, 2, 3, 4"] },
"RAW.SFDC_OPPORTUNITY": { kind: "Raw table, landed by the Airflow load (Fivetran-style)", rows: 4210, feed: null, note: null, q: ["-- peek at the landed table: one row per opportunity", "select", "  id, account_id, owner_id,", "  stage_name, amount, currency_iso_code,", "  close_date, is_closed, is_won,", "  _fivetran_synced", "from RAW.SFDC_OPPORTUNITY", "where is_deleted = false", "limit 10;"] },
"STG_SFDC_OPPORTUNITY": { kind: "dbt staging model", rows: 4096, feed: null, note: null, q: ["with source as (", "  select * from {{ source('salesforce', 'opportunity') }}", "),", "renamed as (", "  select", "    id                           as opportunity_id,", "    account_id,", "    stage_name                   as stage,", "    cast(amount as number(18,2)) as amount,", "    cast(close_date as date)     as close_date,", "    is_won", "  from source", "  where is_deleted = false", ")", "select * from renamed"] },
"FCT_PIPELINE": { kind: "dbt mart", rows: 216, feed: "cap", note: "Could feed Pigment: Sales Capacity (illustrative)", q: ["-- opportunities by stage and close month", "select", "  date_trunc('month', close_date) as close_month,", "  stage,", "  count(*)                        as opportunities,", "  sum(amount)                     as pipeline_amount,", "  sum(iff(is_won, amount, 0))     as won_amount", "from {{ ref('stg_sfdc_opportunity') }}", "group by 1, 2", "order by 1, 2"] },
"RAW.WORKDAY_WORKER": { kind: "Raw table, landed by the Airflow load (Fivetran-style)", rows: 1904, feed: null, note: null, q: ["-- peek at the landed table: one row per worker", "select", "  worker_id, legal_name, job_profile,", "  supervisory_org, location_region,", "  hire_date, termination_date,", "  comp_grade, _fivetran_synced", "from RAW.WORKDAY_WORKER", "limit 10;"] },
"STG_WORKDAY_WORKER": { kind: "dbt staging model", rows: 1904, feed: null, note: null, q: ["with source as (", "  select * from {{ source('workday', 'worker') }}", "),", "renamed as (", "  select", "    worker_id               as employee_id,", "    legal_name              as employee_name,", "    job_profile             as role,", "    location_region         as region,", "    cast(hire_date as date) as start_date,", "    comp_grade              as salary_band,", "    termination_date", "  from source", ")", "select * from renamed"] },
"DIM_EMPLOYEE": { kind: "dbt mart", rows: 1762, feed: "ros", note: "Feeds Pigment: Employee Roster (illustrative)", q: ["-- current employees; feeds the Employee Roster (illustrative)", "select", "  employee_id, employee_name,", "  role, region,", "  start_date,", "  salary_band", "from {{ ref('stg_workday_worker') }}", "where termination_date is null", "   or termination_date > current_date"] },
"RAW.GREENHOUSE_APPLICATION": { kind: "Raw table, landed by the Airflow load (Fivetran-style)", rows: 9340, feed: null, note: null, q: ["-- peek at the landed table: one row per application", "select", "  application_id, candidate_id, job_id,", "  status, current_stage,", "  applied_at, rejected_at,", "  offer_id, _fivetran_synced", "from RAW.GREENHOUSE_APPLICATION", "order by applied_at desc", "limit 10;"] },
"STG_GREENHOUSE_APPLICATION": { kind: "dbt staging model", rows: 9340, feed: null, note: null, q: ["with source as (", "  select * from {{ source('greenhouse', 'application') }}", "),", "renamed as (", "  select", "    application_id,", "    candidate_id,", "    job_id,", "    lower(status)            as status,", "    current_stage            as stage,", "    cast(applied_at as date) as applied_date,", "    offer_id is not null     as has_offer", "  from source", ")", "select * from renamed"] },
"FCT_HIRING_FUNNEL": { kind: "dbt mart", rows: 148, feed: null, note: "Feeds the hiring floor: the candidate queue (illustrative)", q: ["-- candidates by job and stage: the hiring floor's queue", "select", "  job_id,", "  stage,", "  count(*)                  as candidates,", "  sum(iff(has_offer, 1, 0)) as offers,", "  min(applied_date)         as oldest_application", "from {{ ref('stg_greenhouse_application') }}", "where status = 'active'", "group by 1, 2", "order by 1, 2"] },
"bronze.usage_events": { kind: "Databricks Delta table, bronze layer", rows: 2400000, feed: null, note: null, q: ["-- raw product events as they stream in", "select", "  event_id, account_id, user_id,", "  event_name, event_ts,", "  properties:plan::string as plan,", "  _ingest_file", "from bronze.usage_events", "where event_ts >= current_date - interval 1 day", "limit 10;"] },
"silver.usage_daily": { kind: "Databricks Delta table, silver layer", rows: 61200, feed: null, note: null, q: ["-- cleaned: one row per account and day", "create or replace table silver.usage_daily as", "select", "  account_id,", "  cast(event_ts as date)  as usage_date,", "  count(distinct user_id) as active_users,", "  count(*)                as events", "from bronze.usage_events", "where event_name is not null", "group by account_id, cast(event_ts as date)"] },
"gold.product_usage": { kind: "Databricks Delta table, gold layer", rows: 2040, feed: null, note: "Shared to the Snowflake warehouse through a Delta share (illustrative)", q: ["-- monthly usage per account, shared to the warehouse", "create or replace table gold.product_usage as", "select", "  date_trunc('month', usage_date) as month,", "  account_id,", "  avg(active_users)               as avg_daily_users,", "  sum(events)                     as events", "from silver.usage_daily", "group by 1, 2;", "", "alter share warehouse_share add table gold.product_usage;"] }
};
var KW = { IF: '#F34F77', BY: '#3B82F6', REMOVE: '#E07B39', ADD: '#1F9E89', SELECT: '#3B82F6', FILTER: '#F34F77', SUM: '#7A45D1', CONSTANT: '#7A45D1' };
var PAL = {
light: { sky: '#EFE7DA', floor: '#FBF8F3', floor2: '#E6DECF', line: '#CFC5B2', ink: '#1F1E1D', muted: '#655F55', clay: '#B04F2B', card: '#FFFDF9', metal: '#8C8A84', deep: '#27365A', deepfloor: '#2B3A63', metric: '#7A45D1', tdim: '#3B78C4', ttxn: '#3F8F6B', ttab: '#C8457A' },
dark: { sky: '#1F1E1D', floor: '#2E2D2A', floor2: '#3A3835', line: '#5A5750', ink: '#FAF9F5', muted: '#B5B3A9', clay: '#D97757', card: '#262624', metal: '#6E6C67', deep: '#0C1220', deepfloor: '#141C33', metric: '#A889D9', tdim: '#6A9BCC', ttxn: '#8FA876', ttab: '#C46686' }
};
var ACC = { blue: '#0355F3', pink: '#F34F77', yellow: '#FFC368', cyan: '#57E3FF', violet: '#7B61FF', white: '#FFFFFF', dark: '#0B1020', paper: '#E9DFCB' };
var TOK = { light: { met: '#7A45D1', metS: '#D5C4F0', dim: '#3B78C4', dimS: '#BFD3EA', txn: '#3F8F6B', txnS: '#BBDCC9', tab: '#C8457A', tabS: '#EFC3D3' },
dark: { met: '#A889D9', metS: 'rgba(168,137,217,.45)', dim: '#6A9BCC', dimS: 'rgba(106,155,204,.45)', txn: '#8FA876', txnS: 'rgba(143,168,118,.45)', tab: '#C46686', tabS: 'rgba(196,102,134,.45)' } };
var FONT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
var HATCH = { x0: -15.5, x1: -12.5, z0: 8, z1: 11 }, LIFT = { x0: 12.5, x1: 15.5, z0: 8, z1: 11 }, H2 = { x0: -24, x1: -21, z0: 12, z1: 15 }, GY = -80;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmtM(v) { return (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(1) + 'M'; }
function fmtP(v) { return (v < 0 ? '-' : '+') + Math.abs(v).toFixed(1) + '%'; }
function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
/* formula tokens without regular expressions: quoted names, capital keywords, everything else */
function tok(text) {
var out = [], i = 0, n = text.length, c, j, w;
while (i < n) {
c = text.charAt(i);
if (c === "'") { j = text.indexOf("'", i + 1); if (j < 0) j = n - 1; out.push({ t: text.slice(i, j + 1), s: i, k: 'q' }); i = j + 1; }
else if (c >= 'A' && c <= 'Z') { j = i; while (j < n && ((text.charAt(j) >= 'A' && text.charAt(j) <= 'Z') || (text.charAt(j) >= 'a' && text.charAt(j) <= 'z'))) j++; w = text.slice(i, j); out.push({ t: w, s: i, k: KW[w] ? w : 'w' }); i = j; }
else { out.push({ t: c, s: i, k: 'p' }); i++; }
}
return out;
}

/* ------------------------------------------------------------------ data from the frame's own sources */
function readData(ctx) {
var D = { live: false, regions: {}, K: {}, channels: SNAP.channels }, tot = 72.5 + 10.4 + 79.2 + 39.8;
function series(rows, vi, mi0) {   /* rows: labels [.., Version, Month], values [Net Revenue USD]; keep 2026 only */
var a = [], b = [], na = 0, nb = 0, m;
for (m = 0; m < 12; m++) { a.push(null); b.push(null); }
rows.forEach(function (x) {
var p = String(x.labels[mi0] || '').split(' '), mi = MON.indexOf(p[0]), v = Number(x.values[0]), ver = String(x.labels[vi]);
if (mi < 0 || p[1] !== '26' || !isFinite(v) || v <= 0) return;
if (ver === 'Actual') { a[mi] = v / 1e6; na++; } else if (ver === 'Budget') { b[mi] = v / 1e6; nb++; }
});
if (na < 3 || nb < 12) return null;
var act = []; for (m = 0; m < 12 && a[m] != null; m++) act.push(a[m]);
return { act: act, bud: b };
}
function kp(s) { var n = s.act.length, a = 0, b = 0, i; for (i = 0; i < n; i++) { a += s.act[i]; b += s.bud[i]; } return { ytd: a, pct: (a / b - 1) * 100 }; }
try {
var d = ctx.data.get('dsTrend'), all = d && d.rows && d.rows.length ? series(d.rows, 0, 1) : null;
if (all) {
D.live = true; D.regions.All = all; D.K.All = kp(all);
var fx = ctx.data.get('dsFx'), f = 0; if (fx && fx.rows && fx.rows.length) { fx.rows.forEach(function (x) { f += Number(x.values[1]) || 0; }); D.K.All.fx = f / 1e6; }
var rg = ctx.data.get('dsTrendRegion');
REGS.slice(1).forEach(function (r) {
var rows = rg && rg.rows ? rg.rows.filter(function (x) { return x.labels[0] === r; }) : [], s = rows.length ? series(rows, 1, 2) : null;
if (s) { D.regions[r] = s; D.K[r] = kp(s); }
});
var ch = ctx.data.get('dsChannel');
if (ch && ch.rows && ch.rows.length) {
var last = null, lk = -1, by = {}, sum = 0;
ch.rows.forEach(function (x) { var p = String(x.labels[1] || '').split(' '), k = (parseInt(p[1], 10) || 0) * 12 + MON.indexOf(p[0]); if (k > lk && Number(x.values[0]) > 0) { lk = k; last = x.labels[1]; } });
ch.rows.forEach(function (x) { if (x.labels[1] === last) { by[x.labels[0]] = Number(x.values[0]) || 0; sum += by[x.labels[0]]; } });
var list = Object.keys(by).map(function (c) { return [String(c).slice(0, 24), by[c] / (sum || 1)]; }).sort(function (p, q) { return q[1] - p[1]; }).slice(0, 5);
if (list.length >= 2) { D.channels = list; D.chLive = true; }
}
}
} catch (e) {}
if (!D.regions.All) { D.regions.All = { act: SNAP.act, bud: SNAP.bud }; D.K.All = SNAP.K.All; }
REGS.slice(1).forEach(function (r) {   /* regions that have not arrived: an approximate split of the snapshot */
if (D.regions[r]) return;
var k = SNAP.K[r], sh = k.ytd / tot, A = D.regions.All;
D.regions[r] = { act: A.act.map(function (v) { return v * sh; }), bud: A.bud.map(function (v) { return v * sh / (1 + k.pct / 100); }), approx: true }; D.K[r] = k;
});
return D;
}

/* ------------------------------------------------------------------ tiny matrix kit (column-major) */
function mIdent() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function mMul(a, b) { var o = new Float32Array(16), i, j; for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3]; return o; }
function mPersp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; }
function mTRS(x, y, z, ry, sx, sy, sz, rx) {   /* translate * rotY * rotX * scale */
var c = Math.cos(ry || 0), s = Math.sin(ry || 0), cx = Math.cos(rx || 0), sn = Math.sin(rx || 0), o = new Float32Array(16);
o[0] = c * sx; o[1] = 0; o[2] = -s * sx; o[4] = s * sn * sy; o[5] = cx * sy; o[6] = c * sn * sy; o[8] = s * cx * sz; o[9] = -sn * sz; o[10] = c * cx * sz; o[12] = x; o[13] = y; o[14] = z; o[15] = 1; return o;
}
function mView(ex, ey, ez, yaw, pitch) {   /* inverse of translate * rotY(yaw) * rotX(pitch) */
var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
var r = [cy, sy * sp, sy * cp, 0, cp, -sp, -sy, cy * sp, cy * cp];   /* camera basis columns: right, up, back */
var o = new Float32Array(16);
o[0] = r[0]; o[4] = r[3]; o[8] = r[6]; o[1] = r[1]; o[5] = r[4]; o[9] = r[7]; o[2] = r[2]; o[6] = r[5]; o[10] = r[8];
o[12] = -(r[0] * ex + r[3] * ey + r[6] * ez); o[13] = -(r[1] * ex + r[4] * ey + r[7] * ez); o[14] = -(r[2] * ex + r[5] * ey + r[8] * ez); o[15] = 1; return o;
}

/* ------------------------------------------------------------------ the view */
function makeWorld(host, ctx) {
var dead = false, raf = 0, offs = [], reduce = false, dark = false, theme = 'light';
try { reduce = !!ctx.motion.reduced(); } catch (e) {}
try { dark = !!ctx.theme.isDark(); } catch (e) {}
theme = dark ? 'dark' : 'light';
function hx(k) { return PAL[theme][k] || ACC[k] || k; }
function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); offs.push(function () { t.removeEventListener(ev, fn, o); }); }

/* ---- DOM shell ---- */
var root = el('div', 'position:absolute;inset:0;overflow:hidden;user-select:none;-webkit-user-select:none;font:13px/1.45 ' + FONT + ';color:' + hx('ink') + ';background:' + hx('sky'));
var cv = el('canvas', 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none;cursor:grab'); cv.tabIndex = 0;
cv.setAttribute('aria-label', 'Walk the Frame, a 3D scene. W A S D or arrows move, I J K L or drag to look, Space jumps or uses what you stand on.');
var pill = 'background:' + hx('card') + ';border:1px solid ' + hx('line') + ';border-radius:12px;box-shadow:0 6px 20px -10px rgba(0,0,0,.45);';
var where = el('div', 'position:absolute;left:12px;top:12px;max-width:min(70%,700px);padding:7px 13px;' + pill); where.setAttribute('role', 'status'); where.setAttribute('aria-live', 'polite');
var quest = el('div', 'position:absolute;right:12px;top:12px;width:210px;padding:9px 12px;font-size:12.5px;' + pill);
var badge = el('div', 'position:absolute;left:12px;bottom:12px;padding:4px 10px;font-size:11px;color:' + hx('muted') + ';' + pill);
var keys = el('div', 'position:absolute;right:12px;bottom:12px;padding:4px 10px;font-size:11px;color:' + hx('muted') + ';' + pill, 'Move: W A S D | Look: I J K L or drag | Recenter: R | Space: jump or use | F: formula');
var fade = el('div', 'position:absolute;inset:0;background:' + hx('sky') + ';opacity:0;pointer-events:none;transition:opacity .45s linear');
var start = el('div', 'position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.18)');
var card = el('div', 'width:min(92%,480px);padding:22px 24px;' + pill);
card.appendChild(el('div', 'font:700 11px/1 ' + FONT + ';letter-spacing:.12em;text-transform:uppercase;color:' + hx('clay'), 'Explore'));
card.appendChild(el('div', 'font:700 28px/1.1 ' + FONT + ';margin:8px 0', 'Walk the Frame'));
card.appendChild(el('div', 'margin-bottom:10px;color:' + hx('muted'), 'Step onto this frame. Jump on the month bars, switch region on a pad, drop through the pink hatch into Blockflow, cross the bridges to the warehouse, and go down again to the Graphite engine.'));
card.appendChild(el('div', 'margin-bottom:14px;font-size:12px;color:' + hx('muted'), 'Move: W A S D or arrows. Look: I J K L or drag. Recenter: R. Space: jump or use. Nothing is written anywhere.'));
var go = el('button', 'border:0;border-radius:999px;padding:10px 16px;width:100%;font:700 14px ' + FONT + ';cursor:pointer;color:#fff;background:' + hx('clay'), 'Start walking'); go.type = 'button';
card.appendChild(go); start.appendChild(card);
var qh = el('div', 'font:700 11px/1.2 ' + FONT + ';letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;color:' + hx('muted'), 'Things to try'); quest.appendChild(qh);
var QUEST = [['bar', 'Stand on a month bar'], ['region', 'Switch region on a pad'], ['fall', 'Drop into Blockflow'], ['trace', 'Slide down a trace line'], ['block', 'Jump on a block'], ['graphite', 'Visit the Graphite engine']], qEls = {}, found = {};
QUEST.forEach(function (q) { var r = el('div', 'padding:1px 0', '[ ] ' + q[1]); qEls[q[0]] = r; quest.appendChild(r); });
[cv, fade, where, quest, badge, keys, start].forEach(function (n) { root.appendChild(n); }); host.appendChild(root);
function mark(k) { if (found[k]) return; found[k] = true; qEls[k].textContent = '[x] ' + qEls[k].textContent.slice(4); qEls[k].style.color = hx('muted'); }
var whereSig = '';
function setWhere(w) {   /* w: { b, t, f, hl, s[] } rendered with text nodes only */
var sig = JSON.stringify(w); if (sig === whereSig) return; whereSig = sig;
while (where.firstChild) where.removeChild(where.firstChild);
if (w.b) where.appendChild(el('b', '', w.b));
if (w.t) where.appendChild(el('span', '', (w.b ? ' | ' : '') + w.t));
if (w.f) {
var code = el('div', 'margin-top:5px;font:600 12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word');
tok(w.f).forEach(function (tk) { var sp = el('span', (KW[tk.k] ? 'color:' + (tk.k === 'SUM' || tk.k === 'CONSTANT' ? hx('metric') : KW[tk.k]) + ';' : '') + (w.hl && tk.s >= w.hl[0] && tk.s < w.hl[1] ? 'background:rgba(255,195,104,.5);' : ''), tk.t); code.appendChild(sp); });
where.appendChild(code);
}
if (w.q) where.appendChild(el('div', 'margin-top:5px;font:600 11.5px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap', w.q.join(String.fromCharCode(10))));
(w.s || []).forEach(function (t) { where.appendChild(el('div', 'margin-top:3px;font-size:12px;color:' + hx('muted'), t)); });
}

/* ---- WebGL ---- */
var gl = null;
try { gl = cv.getContext('webgl', { antialias: true, alpha: false }) || cv.getContext('experimental-webgl'); } catch (e) {}
if (!gl) { start.removeChild(card); start.appendChild(el('div', 'padding:18px 20px;max-width:420px;' + pill, 'This browser could not start WebGL, so Walk the Frame cannot run here.')); return { destroy: function () { offs.forEach(function (f) { f(); }); if (root.parentNode) root.parentNode.removeChild(root); } }; }
function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
function program(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; }
var FOGF = 'uniform vec3 uFog; uniform vec2 uFogR; varying float vD; float fogk() { return clamp((vD - uFogR.x) / (uFogR.y - uFogR.x), 0.0, 1.0); } ';
var P1 = program(
'attribute vec3 aP; attribute vec3 aN; attribute vec4 aC; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uEye; uniform vec3 uCol; uniform float uLit; varying vec3 vC; varying float vD; ' +
'void main() { vec4 w = uM * vec4(aP, 1.0); gl_Position = uVP * w; vec3 n = normalize(mat3(uM) * aN); float d = max(dot(n, vec3(0.42, 0.78, 0.46)), 0.0); float l = 0.6 + 0.22 * n.y + 0.42 * d; vC = aC.rgb * uCol * mix(1.0, l, aC.a * uLit); vD = distance(w.xyz, uEye); }',
'precision mediump float; varying vec3 vC; uniform float uA; ' + FOGF + 'void main() { gl_FragColor = vec4(mix(vC, uFog, fogk()), uA); }');
var P2 = program(
'attribute vec2 aQ; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uEye; varying vec2 vU; varying float vD; void main() { vec4 w = uM * vec4(aQ, 0.0, 1.0); gl_Position = uVP * w; vU = vec2(aQ.x + 0.5, 0.5 - aQ.y); vD = distance(w.xyz, uEye); }',
'precision mediump float; varying vec2 vU; uniform sampler2D uT; uniform float uA; ' + FOGF + 'void main() { vec4 c = texture2D(uT, vU); if (c.a < 0.02) discard; gl_FragColor = vec4(mix(c.rgb, uFog, fogk() * 0.8), c.a * uA); }');
function locs(p, names) { var o = {}; names.forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; }
var U1 = locs(P1, ['uVP', 'uM', 'uEye', 'uCol', 'uLit', 'uA', 'uFog', 'uFogR']), U2 = locs(P2, ['uVP', 'uM', 'uEye', 'uT', 'uA', 'uFog', 'uFogR']);
var A1 = { p: gl.getAttribLocation(P1, 'aP'), n: gl.getAttribLocation(P1, 'aN'), c: gl.getAttribLocation(P1, 'aC') }, A2 = gl.getAttribLocation(P2, 'aQ');
var quadB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
var glRes = [quadB];

/* geometry batches: interleaved position, normal, colour (alpha = lit) */
var FACES = [[0, 0, 1, [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]], [0, 0, -1, [1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1]], [1, 0, 0, [1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1]], [-1, 0, 0, [-1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1]], [0, 1, 0, [-1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1]], [0, -1, 0, [-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1]]];
function Batch() { this.v = []; }
Batch.prototype.box = function (cx, cy, cz, sx, sy, sz, col, lit, ry) {
var c = rgb(hx(col)), l = lit === 0 ? 0 : 1, cs = Math.cos(ry || 0), sn = Math.sin(ry || 0), v = this.v;
FACES.forEach(function (f) { [0, 1, 2, 0, 2, 3].forEach(function (i) { var x = f[3][i * 3] * sx / 2, y = f[3][i * 3 + 1] * sy / 2, z = f[3][i * 3 + 2] * sz / 2; v.push(cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs, f[0] * cs + f[2] * sn, f[1], -f[0] * sn + f[2] * cs, c[0], c[1], c[2], l); }); });
return this;
};
Batch.prototype.cyl = function (cx, cy, cz, r, h, col, lit, seg) {
var c = rgb(hx(col)), l = lit === 0 ? 0 : 1, v = this.v, n = seg || 14, i, a0, a1, x0, z0, x1, z1;
function p(x, y, z, nx, ny, nz) { v.push(cx + x, cy + y, cz + z, nx, ny, nz, c[0], c[1], c[2], l); }
for (i = 0; i < n; i++) { a0 = i / n * 6.28319; a1 = (i + 1) / n * 6.28319; x0 = Math.cos(a0) * r; z0 = Math.sin(a0) * r; x1 = Math.cos(a1) * r; z1 = Math.sin(a1) * r;
p(x0, -h / 2, z0, x0, 0, z0); p(x1, h / 2, z1, x1, 0, z1); p(x1, -h / 2, z1, x1, 0, z1); p(x0, -h / 2, z0, x0, 0, z0); p(x0, h / 2, z0, x0, 0, z0); p(x1, h / 2, z1, x1, 0, z1);
p(0, h / 2, 0, 0, 1, 0); p(x1, h / 2, z1, 0, 1, 0); p(x0, h / 2, z0, 0, 1, 0); }
return this;
};
Batch.prototype.beam = function (a, b, th, col, lit) {   /* a thin box from a to b */
var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, c = rgb(hx(col)), l = lit === 0 ? 0 : 1, v = this.v;
var w = [dx / len, dy / len, dz / len], u = Math.abs(w[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
var r = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], rl = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]); r = [r[0] / rl, r[1] / rl, r[2] / rl];
var t = [w[1] * r[2] - w[2] * r[1], w[2] * r[0] - w[0] * r[2], w[0] * r[1] - w[1] * r[0]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
FACES.forEach(function (f) { [0, 1, 2, 0, 2, 3].forEach(function (i) { var x = f[3][i * 3] * th / 2, y = f[3][i * 3 + 1] * th / 2, z = f[3][i * 3 + 2] * len / 2;
v.push(m[0] + r[0] * x + t[0] * y + w[0] * z, m[1] + r[1] * x + t[1] * y + w[1] * z, m[2] + r[2] * x + t[2] * y + w[2] * z, r[0] * f[0] + t[0] * f[1] + w[0] * f[2], r[1] * f[0] + t[1] * f[1] + w[1] * f[2], r[2] * f[0] + t[2] * f[1] + w[2] * f[2], c[0], c[1], c[2], l); }); });
return this;
};
Batch.prototype.done = function () { this.n = this.v.length / 10; this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.v), gl.STATIC_DRAW); this.v = null; glRes.push(this.buf); return this; };
var IDENT = mIdent(), WHITE = [1, 1, 1];
function draw(b, m, col, lit, alpha) {
gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.vertexAttribPointer(A1.p, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(A1.n, 3, gl.FLOAT, false, 40, 12); gl.vertexAttribPointer(A1.c, 4, gl.FLOAT, false, 40, 24);
gl.uniformMatrix4fv(U1.uM, false, m || IDENT); gl.uniform3fv(U1.uCol, col || WHITE); gl.uniform1f(U1.uLit, lit == null ? 1 : lit); gl.uniform1f(U1.uA, alpha == null ? 1 : alpha); gl.drawArrays(gl.TRIANGLES, 0, b.n);
}

/* labels: a canvas texture on a quad. mode 's' = faces the camera, 'w' = upright with a fixed heading, 'f' = flat on the floor */
var labels = [];
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function label(lines, w, h, x, y, z, o) {
o = o || {};
var c = document.createElement('canvas'); c.width = o.px || 256; c.height = Math.max(16, Math.round(c.width * h / w));
var L = { c: c, w: w, h: h, x: x, y: y, z: z, mode: o.mode || 's', ry: o.ry || 0, lvl: o.lvl == null ? 0 : o.lvl, bg: o.bg === undefined ? 'card' : o.bg, lines: lines, vis: true, a: 1, paint: o.paint || null };
L.tex = gl.createTexture(); glRes.push(L.tex);
L.set = function (ls) {
if (ls) L.lines = ls;
var g = c.getContext('2d'), W = c.width, H = c.height, k = W / 512, tot = 0, sc, yy;
g.clearRect(0, 0, W, H);
if (L.paint) L.paint(g, W, H);
else {
if (L.bg) { g.fillStyle = hx(L.bg); rr(g, 2, 2, W - 4, H - 4, H * 0.2); g.fill(); g.strokeStyle = hx('line'); g.lineWidth = Math.max(2, H * 0.03); g.stroke(); }
var arr = (typeof L.lines === 'string' ? [L.lines] : L.lines).map(function (q) { return typeof q === 'string' ? { t: q } : q; });
arr.forEach(function (q) { tot += (q.s || 44) * k * 1.24; }); sc = Math.min(1, H * 0.88 / tot); yy = H / 2 - tot * sc / 2;
arr.forEach(function (q) { var lh = (q.s || 44) * k * sc, s = lh; g.font = (q.w || 600) + ' ' + s + 'px ' + FONT; var mw = g.measureText(q.t).width; if (mw > W * 0.9) { s *= W * 0.9 / mw; g.font = (q.w || 600) + ' ' + s + 'px ' + FONT; }
g.fillStyle = hx(q.c || 'ink'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.t, W / 2, yy + lh * 0.62); yy += lh * 1.24; });
}
gl.bindTexture(gl.TEXTURE_2D, L.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
};
L.set(); labels.push(L); return L;
}

/* ------------------------------------------------------------------ the world */
var wt = [], sqlOpen = null, FXS = [];
function nearTable() { if (P.y > -30 || P.y < -45) return null; var best = null, bd = 1.7; wt.forEach(function (w) { var d = Math.sqrt(Math.pow(P.x - w.x, 2) + Math.pow(P.z - w.z, 2)); if (d < bd) { bd = d; best = w; } }); return best; }
var HR = { hires: [], pend: -1, rev: null, pay: 0, land: 0, gap: 0, flash: 0, built: {}, field: false }, GH = [];
function shown(id) { var n = NODES[id]; return !!n.prop || !n.hire || HR.hires.length > 0; }
function solid(id) { var n = NODES[id]; return !n.prop || !!HR.built[id] || (!!n.hire && HR.hires.length > 0); }
var D = readData(ctx), region = 'All', colliders = [], dyn = [], bars = [], pads = [], nodes = {}, up = {}, down = {}, conn = {}, kpiL = [];
var unit = new Batch().box(0, 0, 0, 1, 1, 1, 'white', 1).done(), unitE = new Batch().box(0, 0, 0, 1, 1, 1, 'white', 0).done();
function val(v) { return typeof v === 'function' ? v() : v; }
function col(x0, x1, z0, z1, top, bot, info) { var c = { x0: x0, x1: x1, z0: z0, z1: z1, top: top, bot: bot == null ? -1e9 : bot, info: info }; colliders.push(c); return c; }
function heights(r) {
var d = D.regions[r], fut = d.bud.map(function (b, i) { return r === 'All' && (HR.hires.length || HR.field) && HR.rev && i >= d.act.length ? b * HR.fcf + HR.rev[i] + (HR.field ? 0.1 : 0) : null; });   /* with hires, future months show the forecast */
var all = d.bud.concat(d.act, fut.filter(function (v) { return v != null; })), hi = Math.max.apply(null, all), lo = Math.min.apply(null, all) * 0.82;
function h(v) { return 1.1 + 4.6 * (v - lo) / (hi - lo); }
return d.bud.map(function (b, i) { var a = i < d.act.length ? d.act[i] : null; return { a: h(a != null ? a : fut[i] != null ? fut[i] : b), b: h(b), act: a, bud: b, fc: fut[i] }; });
}
var L0 = new Batch(), L1 = new Batch(), L2 = new Batch(), lift = { y: 0, to: null }, focusN = null, eI = ALLE.map(function () { return 1; });
var KC = { Metric: 'metric', Dimension: 'tdim', TxList: 'ttxn', Table: 'ttab' };
function iconPaint(kind) {
return function (g) {
var c = TOK[theme]; function R(a, b, w, h, f) { g.fillStyle = f; rr(g, a, b, w, h, 1.3); g.fill(); }
g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = hx('card'); rr(g, 4, 4, 120, 120, 24); g.fill(); g.setTransform(6.5, 0, 0, 6.5, 12, 12);
if (kind === 'Metric') {   /* the same shapes as the frame's own block icons (16 x 16) */
g.fillStyle = c.metS; g.beginPath(); g.moveTo(3.3, 2); g.lineTo(12.7, 2); g.arcTo(14, 2, 14, 3.3, 1.3); g.lineTo(14, 6.2); g.lineTo(7.5, 6.2); g.arcTo(6.2, 6.2, 6.2, 7.5, 1.3); g.lineTo(6.2, 14); g.lineTo(3.3, 14); g.arcTo(2, 14, 2, 12.7, 1.3); g.lineTo(2, 3.3); g.arcTo(2, 2, 3.3, 2, 1.3); g.closePath(); g.fill(); R(7.4, 7.4, 6.6, 6.6, c.met);
} else if (kind === 'Dimension') { R(2, 2, 5.4, 5.4, c.dim); R(8.6, 2, 5.4, 5.4, c.dim); R(2, 8.6, 12, 5.4, c.dimS); }
else if (kind === 'TxList') { R(2, 3, 12, 4.8, c.txn); R(2, 8.9, 12, 4.3, c.txnS); }
else { R(2, 2, 5.2, 12, c.tabS); R(8.4, 2, 5.6, 5.4, c.tabS); R(8.4, 8.6, 5.6, 5.4, c.tab); }
g.setTransform(1, 0, 0, 1, 0, 0);
};
}
function names(a) { a = a.filter(shown); return a.length ? a.map(function (q) { return NODES[q].n; }).join(', ') : 'nothing on this map'; }
/* the hiring lever (illustrative): four role pads on the frame; each approved hire adds a roster row, payroll from its start month and, for sales reps, ramping revenue */
function hireCalc() {
var A = D.regions.All, n0 = A.act.length, base = 0, bud = 0, rev = [], pay = 0, add = 0, m;
HR.fcf = D.live ? 0.997 : (486.9 - 202.0) / 285.7;
for (m = 0; m < 12; m++) { rev.push(0); bud += A.bud[m]; base += m < n0 ? A.act[m] : A.bud[m] * HR.fcf; }
HR.hires.forEach(function (h) { for (m = h.start; m < 12; m++) { var k = m - h.start; pay += ROLES[h.role][1] / 12000; rev[m] += h.role === 0 ? 0.25 * Math.min(1, k / 4) : h.role === 1 ? (k >= 2 ? 0.04 : 0) : h.role === 3 ? (k >= 3 ? 0.05 : 0) : 0; } });
rev.forEach(function (v) { add += v; }); HR.rev = rev; HR.pay = pay; HR.land = base + add; HR.gap = HR.land - bud; HR.n0 = n0;
}
function hireBoard() {
hireCalc();
if (HR.board) HR.board.set([{ t: 'Hiring lever (illustrative)', s: 60, w: 800 }, { t: '+' + HR.hires.length + ' hired | payroll 2026 $' + Math.round(HR.pay * 1000) + 'K', s: 50 }, { t: 'year lands at ' + fmtM(HR.land) + ', ' + (HR.gap >= 0 ? fmtM(HR.gap) + ' ahead of budget' : fmtM(-HR.gap) + ' short of budget'), s: 50, w: 700, c: HR.gap >= 0 ? 'ttxn' : 'pink' }, { t: 'the model has no headcount data: all hiring numbers are assumptions', s: 34, c: 'muted' }]);
if (HR.fl) HR.fl.vis = HR.field;
if (kpiL.length) setRegion(region, true);
}

(function build() {
var i;
/* ---- level 0: the frame ---- */
[[-24, 24, -17, 8], [-24, 24, 11, 17], [-24, -15.5, 8, 11], [-12.5, 12.5, 8, 11], [15.5, 24, 8, 11]].forEach(function (r) { L0.box((r[0] + r[1]) / 2, -0.3, (r[2] + r[3]) / 2, r[1] - r[0], 0.6, r[3] - r[2], 'floor'); col(r[0], r[1], r[2], r[3], 0, -0.6); });
L0.box(0, -0.86, 0, 49, 0.5, 35, 'clay');
for (i = -22; i <= 22; i += 4) L0.box(i, 0.012, -4.5, 0.05, 0.02, 25, 'line', 0);
for (i = -16; i <= 8; i += 4) L0.box(0, 0.012, i, 48, 0.02, 0.05, 'line', 0);
label([{ t: 'Revenue Outlook', s: 84, w: 800 }, { t: 'Net revenue in US dollars | actual vs budget, 2026', s: 38, c: 'muted' }], 15, 2.6, 0, 0.03, 13.6, { mode: 'f', px: 1024, bg: null });
var hs = heights('All');
MON.forEach(function (mn, k) {
var x = -16.5 + 3 * k, b = { x: x, h: hs[k], cur: 0.02, tgt: hs[k].a, sl: hs[k].b };
b.tag = label('', 2.3, 0.62, x, 2, -6, {});
col(x - 1.1, x + 1.1, -7.3, -4.7, function () { return b.cur; }, 0, function () { mark('bar'); var v = b.h; return { b: mn + ' 26', t: (v.act != null ? 'Actual ' + fmtM(v.act) + ' | Budget ' + fmtM(v.bud) + ' | ' + fmtP((v.act / v.bud - 1) * 100) : 'Budget ' + fmtM(v.bud) + ' | no actuals yet' + (v.fc != null ? ' | forecast with your hires ' + fmtM(v.fc) + ' (illustrative)' : '')) + ' (' + region + ')', s: D.regions[region].approx ? ['Regional split approximate'] : [] }; });
col(x - 1.1, x + 1.1, -7.85, -7.3, function () { return b.h.act != null ? b.sl : 0; }, 0);
[0.75, 0.5, 0.25].forEach(function (f, j) { col(x - 1.1, x + 1.1, -4.7 + j * 0.8, -3.9 + j * 0.8, function () { return b.cur * f; }, 0); });
bars.push(b);
});
TRACES.forEach(function (tr, k) {
L0.box(tr.x, 0.25, -13.5, 6.4, 0.5, 1.8, 'clay'); L0.box(tr.x, 2.35, -13.5, 6, 3.7, 1.2, 'card'); col(tr.x - 3.2, tr.x + 3.2, -14.4, -12.6, 4.2, 0);
kpiL.push(label('', 5.6, 3.3, tr.x, 2.35, -12.88, { mode: 'w', px: 512, bg: null }));
L0.cyl(tr.x, 0.03, -10.4, 1.1, 0.06, tr.c);
label([{ t: 'Trace this number', s: 120, w: 700 }, { t: 'stand here | Space', s: 90, c: 'muted' }], 2.3, 0.7, tr.x + 2.3, 0.8, -10.4, {});
});
L0.box(19.6, 0.25, -13.5, 5.4, 0.5, 1.8, 'clay'); L0.box(19.6, 2.35, -13.5, 5, 3.7, 1.2, 'card'); col(16.9, 22.3, -14.4, -12.6, 4.2, 0);
label([{ t: 'Leading channel', s: 60, c: 'muted' }, { t: D.channels[0][0], s: 130, w: 800 }, { t: (D.channels[0][1] * 100).toFixed(1) + '% of revenue', s: 44, c: 'muted' }], 4.7, 3.3, 19.6, 2.35, -12.88, { mode: 'w', px: 512, bg: null });
var pc = ['clay', 'blue', 'pink', 'yellow', 'violet'];
REGS.forEach(function (r, k) { var x = -8 + 4 * k; L0.cyl(x, 0.125, 4, 1.45, 0.25, pc[k]); label([{ t: r, s: 190, w: 800 }], 1.5, 0.62, x, 2.5, 4, {}); pads.push({ r: r, x: x });
col(x - 1.25, x + 1.25, 2.75, 5.25, 0.25, 0, function () { return { b: r + ' pad', t: region === r ? 'showing now' : 'press Space to show ' + (r === 'All' ? 'all regions' : r) }; }); });
D.channels.forEach(function (c, k) { var z = -4.4 + k * 2.2, h = c[1] * 9; L0.box(20.1, h / 2, z, 1.5, h, 1.5, pc[(k + 1) % 5]); label([{ t: c[0], s: 100, w: 700 }, { t: (c[1] * 100).toFixed(k || D.chLive ? 0 : 1) + '% of revenue', s: 84, c: 'muted' }], 2.5, 0.78, 20.1, h + 0.75, z, {});
col(19.35, 20.85, z - 0.75, z + 0.75, h, 0, function () { return { b: c[0], t: Math.round(c[1] * 100) + '% of net revenue' + (D.chLive ? ' in the latest month' : ' (snapshot, approximate)') }; }); });
ROLES.forEach(function (r, k) { var x = 17.4 + (k % 2) * 3.4, z = 12.6 + Math.floor(k / 2) * 2.9; L0.cyl(x, 0.125, z, 1.2, 0.25, ['blue', 'ttxn', 'violet', 'pink'][k]); label([{ t: r[0], s: 110, w: 800 }, { t: '$' + r[1] + 'K a year', s: 90, c: 'muted' }], 2.3, 0.8, x, 1.9, z, {});
col(x - 1.05, x + 1.05, z - 1.05, z + 1.05, 0.25, 0, function () { return { b: 'Hire a ' + r[0], t: HR.pend === k ? 'press Space again to approve and stamp the offer' : 'press Space to open the offer', s: ['$' + r[1] + 'K a year, starting ' + MON[Math.min(11, (HR.n0 || 6) + Math.min(HR.hires.length, 4))] + ' 26; ' + r[2] + '. Candidates come from Greenhouse. Illustrative assumptions.'] }; }).hrole = k; });
L0.cyl(22.9, 0.125, 9.6, 0.9, 0.25, 'metal'); label([{ t: 'Undo last hire', s: 110, w: 700 }], 2.2, 0.5, 22.9, 1.5, 9.6, {}); col(22.1, 23.7, 8.8, 10.4, 0.25, 0, function () { return { b: 'Undo', t: HR.hires.length ? 'press Space to undo the last hire' : 'nothing to undo yet' }; }).hrole = -2;
HR.board = label('', 5.2, 2, 19.1, 3.6, 16.6, { px: 512 }); HR.stamp = label([{ t: 'HIRED', s: 190, w: 800, c: 'white' }], 1.6, 0.6, 19, 2.6, 14, { bg: 'ttxn' }); HR.stamp.vis = false;
/* the field loop, lighter here: a pad that brings an insight from the shop floor back into the frame */
L0.cyl(-19.5, 0.125, 13.6, 1.2, 0.25, 'clay'); label([{ t: 'Field insight', s: 110, w: 800 }, { t: 'stand here | Space', s: 90, c: 'muted' }], 2.4, 0.8, -19.5, 1.9, 13.6, {});
col(-20.55, -18.45, 12.55, 14.65, 0.25, 0, function () { return { b: 'Field insight', t: HR.field ? 'Frame updated from the field. Press Space to take the update off again.' : 'the model says EMEA is short; the shop says Watch SE sells out by the 10th. Press Space to bring that back into the frame.', s: ['Requirements, build, decide in the world, learn, update the frame. Illustrative.'] }; }).field = true;
HR.fl = label([{ t: 'Frame updated from the field', s: 70, w: 800, c: 'clay' }, { t: 'Watch SE sells out by the 10th in EMEA stores', s: 56 }, { t: 'H2 allocation lifted: forecast +$0.6M (illustrative)', s: 50, c: 'muted' }], 5.6, 1.5, -19.5, 3.4, 15.6, { px: 512 }); HR.fl.vis = false;
label([{ t: 'Call transcript > proposed build items', s: 56, w: 800 }, { t: '"headcount by region" > Headcount', s: 44 }, { t: '"budget is monthly by country" > Budget Net Revenue USD', s: 44 }, { t: '"pull bookings from Salesforce" > Salesforce Bookings', s: 44 }, { t: '"who is on the team" > Employee Roster', s: 44 }, { t: 'ghost blocks: jump on one and press Space to build it (illustrative)', s: 36, c: 'muted' }], 7.4, 2.6, -2, -35.6, 10.5, { px: 1024, lvl: 1 });
function rim(R, c, y, depth) { var m = (R.x0 + R.x1) / 2, n = (R.z0 + R.z1) / 2, B = y > -1 ? L0 : L1; B.box(m, y + 0.07, R.z0, 3.3, 0.14, 0.15, c, 0); B.box(m, y + 0.07, R.z1, 3.3, 0.14, 0.15, c, 0); B.box(R.x0, y + 0.07, n, 0.15, 0.14, 3.3, c, 0); B.box(R.x1, y + 0.07, n, 0.15, 0.14, 3.3, c, 0);
[[R.x0, R.z0], [R.x1, R.z0], [R.x0, R.z1], [R.x1, R.z1]].forEach(function (q) { L1.box(q[0], y - depth / 2, q[1], 0.07, depth, 0.07, c, 0); }); }
rim(HATCH, 'pink', 0, 40); rim(LIFT, 'cyan', 0, 80); rim(H2, 'violet', -40, 40);
label([{ t: 'Blockflow', s: 130, w: 800 }, { t: 'drop in', s: 90, c: 'muted' }], 2.5, 0.85, -14, 2.3, 9.5, {});
label([{ t: 'Lift', s: 130, w: 800 }, { t: 'stand on it | Space', s: 90, c: 'muted' }], 2.5, 0.85, 14, 2.3, 9.5, {});
col(LIFT.x0, LIFT.x1, LIFT.z0, LIFT.z1, function () { return lift.y; }, function () { return lift.y - 0.3; }, function () { return { b: 'Lift', t: lift.y > -1 ? 'press Space to ride down to Blockflow' : lift.y < -70 ? 'press Space to ride up to Blockflow' : 'Space rides up to the frame; look down and press Space to ride down to Graphite' }; });
/* ---- level 1: Blockflow ---- */
L1.box(0, -40.25, -2, 64, 0.5, 52, 'deepfloor');
[[-32, 32, -28, 8], [-32, 32, 15, 24], [-32, 12.5, 8, 11], [15.5, 32, 8, 11], [-32, 32, 11, 12], [-32, -24, 12, 15], [-21, 32, 12, 15]].forEach(function (r) { col(r[0], r[1], r[2], r[3], -40, -40.5); });
for (i = -28; i <= 28; i += 8) L1.box(i, -39.98, -2, 0.05, 0.02, 52, '#4A5C94', 0);
for (i = -26; i <= 22; i += 8) L1.box(0, -39.98, i, 64, 0.02, 0.05, '#4A5C94', 0);
L1.box(-22.5, -39.97, 13.5, 3, 0.02, 3, '#05060D', 0); L1.box(14, -39.975, 9.5, 3, 0.02, 3, '#05060D', 0);
label([{ t: 'Graphite', s: 130, w: 800 }, { t: 'the engine below | drop in', s: 84, c: 'muted' }], 2.9, 0.85, -22.5, -37.6, 13.5, { lvl: 1 });
Object.keys(NODES).forEach(function (id) { up[id] = DEPS.filter(function (e) { return e[0] === id; }).map(function (e) { return e[1]; }); down[id] = DEPS.filter(function (e) { return e[1] === id; }).map(function (e) { return e[0]; }); conn[id] = {}; up[id].concat(down[id]).forEach(function (q) { conn[id][q] = 1; }); });
Object.keys(NODES).forEach(function (id) {
var n = NODES[id], o = { id: id, n: n, y: -39, I: 1, G: 0 }; nodes[id] = o; if (n.k === 'Source') return;
var l0 = labels.length; o.key = KC[n.k]; if (!n.hire) L1.box(n.x, -39.5, n.z, 2.86, 0.1, 1.26, 'card');
col(n.x - 1.4, n.x + 1.4, n.z - 0.6, n.z + 0.6, function () { return shown(id) ? -38.5 : -1e9; }, -39.6, function () { mark('block'); return { b: n.n, t: KIND[n.k] + (n.f ? '' : ' | ' + n.d), f: n.f || null, s: ['Depends on: ' + names(up[id]), 'Used by: ' + names(down[id])].concat(n.hire ? ['Illustrative draft: the Revenue Planning model has no headcount data.' + (id === 'ros' ? ' Rows now: ' + HR.hires.length + '.' : '')] : [], PROPQ[id] ? ['Proposed from the call: "' + PROPQ[id][1] + '" (' + PROPQ[id][0] + '). ' + (solid(id) ? 'Built.' : 'A ghost until you press Space to build it.')] : []) }; }).node = o;
window.setTimeout(function () { if (n.hire && !n.prop) for (var q = l0; q < l0 + 3 && q < labels.length; q++) labels[q].hire = true; }, 0);
label('', 0.8, 0.8, n.x - 0.85, -38.97, n.z + 0.607, { mode: 'w', px: 128, lvl: 1, paint: iconPaint(n.k) });
label('', 0.8, 0.8, n.x + 0.85, -38.97, n.z - 0.607, { mode: 'w', ry: Math.PI, px: 128, lvl: 1, paint: iconPaint(n.k) });
label([{ t: n.n, s: 76, w: 700 }, { t: KIND[n.k], s: 58, c: n.k === 'Metric' ? 'metric' : 'muted' }], 3.9, 0.8, n.x, -37.35, n.z, { px: 512, lvl: 1 });
});
/* ---- the warehouse, off the far edge: NetSuite -> Snowflake (RAW -> dbt -> ANALYTICS) -> Pigment, with Airflow above. Names in plain type; marks are illustrative. ---- */
L1.box(0, -40.05, 44, 17.9, 0.1, 7.9, '#0E1630'); col(-9, 9, 40, 48, -40, -40.4, function () { return { b: 'Inside the Snowflake warehouse', t: 'three lanes climb from RAW at the far side, through dbt staging, to ANALYTICS. Walk up to a table and press Space for its SQL.' }; });   /* the glass shell can be walked through */
[['RAW.NETSUITE_GL', 'STG_NETSUITE_GL', 'FCT_NET_REVENUE'], ['RAW.SFDC_OPPORTUNITY', 'STG_SFDC_OPPORTUNITY', 'FCT_PIPELINE'], ['RAW.WORKDAY_WORKER', 'STG_WORKDAY_WORKER', 'DIM_EMPLOYEE'], ['RAW.GREENHOUSE_APPLICATION', 'STG_GREENHOUSE_APPLICATION', 'FCT_HIRING_FUNNEL']].forEach(function (lane, li) {
lane.forEach(function (nm, k) { var x = -6 + li * 4, y = -39.2 + k * 1.5, z = 46.6 - k * 2.6; wt.push({ nm: nm, x: x, z: z }); L1.box(x, y, z, 2.1, 0.7, 1.7, ['ttxn', 'yellow', 'pink'][k], 0); label([{ t: nm, s: 150, w: 700, c: '#FFFFFF' }], 2.25, 0.3, x, y + 0.62, z, { px: 512, bg: ACC.dark, lvl: 1 }); }); });
[-1, 1].forEach(function (d) {   /* Salesforce (west) and Workday (east): two more sources piped into the RAW side; plain names, illustrative */
var x = 17 * d; L1.box(x, -40.25, 62, 8, 0.5, 6, ACC.dark);
[-2.2, 0, 2.2].forEach(function (o, q) { if (d < 0) L1.cyl(x + o, -38.9, 62.6, 0.95, 2.2, ['blue', 'cyan', 'violet'][q]); else L1.box(x + o, -38.95, 62.6, 1.5, 1.9, 0.7, q % 2 ? '#FFD9A8' : 'yellow'); });
label([{ t: d < 0 ? 'Salesforce' : 'Workday', s: 150, w: 700 }, { t: d < 0 ? 'opportunities, accounts, bookings' : 'employees, positions, comp', s: 70, c: 'muted' }], 6, 1.4, x, -36.2, 64.4, { mode: 'w', ry: Math.PI, px: 512, lvl: 1 });
L1.beam([x - d * 3.6, -39.5, 59.4], [2 * d, -39.2, 48.3], 0.22, d < 0 ? 'blue' : 'yellow', 0);
});
/* Greenhouse (recruiting) feeds RAW.GREENHOUSE_* and the hiring lever; Databricks is a lakehouse beside the warehouse, reached by a short bridge */
L1.box(28, -40.25, 68, 7, 0.5, 6, ACC.dark); [-2.2, 0, 2.2].forEach(function (o) { L1.box(28 + o, -39.65, 68.6, 1.5, 0.7, 1.5, '#C8A57A'); L1.box(28 + o, -39, 68.6, 0.3, 0.7, 0.3, '#4E8B5A'); });
label([{ t: 'Greenhouse', s: 150, w: 700 }, { t: 'candidates, applications, offers', s: 70, c: 'muted' }], 6, 1.4, 28, -36.2, 70.4, { mode: 'w', ry: Math.PI, px: 512, lvl: 1 });
L1.beam([24.6, -39.5, 65.4], [6, -39.2, 48.3], 0.22, '#4E8B5A', 0);
L1.box(-21, -40.2, 44, 11, 0.4, 10, ACC.dark); col(-26.5, -15.5, 39, 49, -40, -40.4, function () { return { b: 'Databricks', t: 'lakehouse: raw events are refined bronze, silver, gold, and the gold table is shared into the warehouse. Walk up to a table and press Space for its SQL. Illustrative.' }; });
L1.box(-13.25, -40.08, 44, 4.5, 0.16, 1.6, ACC.dark); L1.box(-13.25, -39.97, 43.2, 4.5, 0.07, 0.07, '#E07B39', 0); L1.box(-13.25, -39.97, 44.8, 4.5, 0.07, 0.07, '#E07B39', 0); col(-15.5, -11, 43.2, 44.8, -40, -40.2, function () { return { b: 'Bridge to Databricks', t: 'the lakehouse sits beside the warehouse.' }; });
[['bronze.usage_events', -24.4, -39.1, 46.6, '#B87333'], ['silver.usage_daily', -21, -38.1, 44, '#B8BDC6'], ['gold.product_usage', -17.6, -37.1, 41.4, '#E6B422']].forEach(function (q) { L1.box(q[1], q[2], q[3], 3, 1, 2.4, q[4], 0); wt.push({ nm: q[0], x: q[1], z: q[3] }); label([{ t: q[0], s: 150, w: 700, c: '#FFFFFF' }], 3, 0.4, q[1], q[2] + 0.85, q[3], { px: 512, bg: ACC.dark, lvl: 1 }); });
label([{ t: 'Databricks', s: 150, w: 700 }, { t: 'lakehouse: bronze, silver, gold', s: 70, c: 'muted' }], 9, 2.1, -21, -33.6, 48.9, { mode: 'w', ry: Math.PI, px: 512, lvl: 1 });
L1.beam([-17.6, -37.1, 41.4], [-9.1, -37.1, 41.4], 0.16, '#E6B422', 0); FXS.push([[-17.6, -37.1, 41.4], [-9.1, -37.1, 41.4], 0, 4, 0.3, '#E6B422']);
/* Claude, past Pigment at the end of the flow: an original starburst in warm orange with the name in plain type */
for (i = 0; i < 12; i++) { var ca = i * Math.PI / 6, cl = i % 2 ? 0.8 : 1.3; L1.beam([0, -33.4, -23.5], [Math.cos(ca) * cl, -33.4 + Math.sin(ca) * cl, -23.5], 0.15, '#D97757', 0); }
label([{ t: 'Claude', s: 170, w: 700, c: '#D97757' }], 3.4, 1, 0, -35.9, -23.5, { mode: 'w', px: 256, lvl: 1 });
L1.cyl(0, -39.875, -23.5, 1.6, 0.25, '#D97757'); col(-1.4, 1.4, -24.9, -22.1, -39.75, -40, function () { return { b: 'Claude', t: 'a downstream reader of the modelled tables and the metrics here. Answers questions, drafts plans; nothing is written without your approval (approve before write). Illustrative.' }; });
FXS.push([[-6, -36.2, 41.4], [0, -33.4, -23.5], 7, 10, 0.07, '#F4A582']); ['kYtd', 'kVar', 'kFx'].forEach(function (id) { FXS.push([[NODES[id].x, -38.5, NODES[id].z], [0, -33.4, -23.5], 1.2, 3, 0.25, '#F4A582']); });
/* the native Connectors gateway: Slack and Notion push and pull through it. Names are for orientation; marks are illustrative. */
L1.box(-25, -38.7, -20.3, 0.3, 2.6, 0.3, 'metric'); L1.box(-25, -38.7, -17.7, 0.3, 2.6, 0.3, 'metric'); L1.box(-25, -37.3, -19, 0.34, 0.3, 3.2, 'metric');
label([{ t: 'Connectors', s: 150, w: 700 }, { t: 'the native gateway', s: 80, c: 'muted' }], 4.2, 1.1, -25, -36.3, -19, { px: 512, lvl: 1 });
col(-26, -24, -20.3, -17.7, -39.99, -40.2, function () { return { b: 'Connectors', t: 'the native gateway. Slack and Notion connect here: alerts and plan pages are pushed out, notes are pulled back in. Names are for orientation; marks are illustrative.' }; });
[['Slack', -24.5, 'pink', 'push: an alert when the gap against budget moves'], ['Notion', -13.5, 'yellow', 'push: plan pages; pull: notes back into Collaboration']].forEach(function (q) { L1.cyl(-29.6, -39.875, q[1], 1.3, 0.25, q[2]); label([{ t: q[0], s: 170, w: 700 }], 2.6, 0.8, -29.6, -38, q[1], { px: 256, lvl: 1 });
col(-30.75, -28.45, q[1] - 1.15, q[1] + 1.15, -39.75, -40, function () { return { b: q[0], t: 'through the Connectors gateway. ' + q[3] + '. Illustrative.' }; }); FXS.push([[-25, -37.5, -19], [-29.6, -39.2, q[1]], 0.8, 3, 0.3, ACC[q[2]]]); });
FXS.push([[NODES.kVar.x, -38.5, NODES.kVar.z], [-25, -37.5, -19], 2.2, 5, 0.14, ACC.pink]);
for (i = -8; i <= 8; i += 2) { L1.box(i, -31, 39.98, 0.08, 78, 0.02, 'cyan', 0); L1.box(i, -31, 48.02, 0.08, 78, 0.02, 'cyan', 0); }
[-4, -1.3, 1.3, 4].forEach(function (z) { L1.box(-9.02, -31, 44 + z, 0.02, 78, 0.08, 'cyan', 0); L1.box(9.02, -31, 44 + z, 0.02, 78, 0.08, 'cyan', 0); });
var sfInfo = function () { return { b: 'Snowflake', t: 'data warehouse. Walk in through the glass: every table inside has its SQL. RAW on the far side, ANALYTICS facing Pigment.', s: ['Names are for orientation; marks are illustrative.'] }; };
[[-11, 11, 38, 40], [-11, 11, 48, 50], [-11, -9, 40, 48], [9, 11, 40, 48]].forEach(function (r) { L1.box((r[0] + r[1]) / 2, -40.2, (r[2] + r[3]) / 2, r[1] - r[0], 0.4, r[3] - r[2], ACC.dark); col(r[0], r[1], r[2], r[3], -40, -40.4, sfInfo); });
function bridge(x, z0, z1) { L1.box(x, -40.08, (z0 + z1) / 2, 1.6, 0.16, z1 - z0, ACC.dark); L1.box(x - 0.8, -39.97, (z0 + z1) / 2, 0.07, 0.07, z1 - z0, 'cyan', 0); L1.box(x + 0.8, -39.97, (z0 + z1) / 2, 0.07, 0.07, z1 - z0, 'cyan', 0); col(x - 0.8, x + 0.8, z0, z1, -40, -40.2, function () { return { b: 'Data-flow bridge', t: 'rows travel this way toward Pigment. No railings: fall and you are set back on the platform.' }; }); }
bridge(-5, 24, 38); bridge(5, 24, 30); bridge(5, 32.2, 38); bridge(0, 50, 64);
L1.beam([NODES.tNs.x, -39.97, NODES.tNs.z + 0.8], [-5, -39.97, 24], 0.3, 'cyan', 0); L1.beam([NODES.tSf.x, -39.97, NODES.tSf.z + 0.8], [5, -39.97, 24], 0.3, 'cyan', 0);
for (i = 0; i < 8; i++) L1.box(i ? (i % 2 ? 0.5 : -0.4) : 0, -40.65 - i * 1.5, 67 + (i ? (i % 3 - 1) * 0.35 : 0), 9, 1.3, 6, i % 2 ? '#C9B79A' : ACC.paper);
col(-4.5, 4.5, 64, 70, -40, -52, function () { return { b: 'NetSuite', t: 'ERP: where each sale is first written down. From here the rows flow to Snowflake, then into Pigment.' }; });
label([{ t: 'Snowflake', s: 150, w: 700, c: '#DFF6FF' }, { t: 'ANALYTICS: FCT_NET_REVENUE  DIM_PRODUCT  DIM_COUNTRY  FX_RATES_MONTHLY', s: 44, c: '#57E3FF' }], 16, 3.4, 0, -34.2, 39.94, { mode: 'w', ry: Math.PI, px: 1024, bg: null, lvl: 1 });
label([{ t: 'Snowflake', s: 150, w: 700, c: '#DFF6FF' }, { t: 'RAW: tables as they arrive, loaded by Fivetran', s: 50, c: '#57E3FF' }], 16, 3.4, 0, -34.2, 48.06, { mode: 'w', px: 1024, bg: null, lvl: 1 });
label([{ t: 'NetSuite', s: 170, w: 700 }], 4.6, 1.2, 0, -37.4, 70.4, { mode: 'w', ry: Math.PI, px: 512, lvl: 1 });
[1, -1].forEach(function (d) {
[[46.6, [-38.9, -38.1, -37.3], 'ttxn'], [44, [-38.5, -37.7], 'yellow'], [41.4, [-39, -38.4, -37.8, -37.2], 'pink']].forEach(function (st) { st[1].forEach(function (y) { L1.box(9.07 * d, y, st[0], 0.1, 0.34, 0.9, st[2], 0); }); });
label([{ t: 'dbt', s: 170, w: 700, c: '#FFD9A8' }, { t: d > 0 ? 'staging > intermediate > marts' : 'marts < intermediate < staging', s: 60, c: '#DFF6FF' }], 6, 1.5, 9.09 * d, -35.6, 44, { mode: 'w', ry: d * Math.PI / 2, px: 512, bg: null, lvl: 1 });
});
label([{ t: 'dbt: SQL transformations that turn raw', s: 62, w: 700 }, { t: 'tables into clean models (illustrative)', s: 62, w: 700 }], 4.8, 0.8, 10.2, -33.6, 44, { px: 512, lvl: 1 });
L1.cyl(19, -31, 45, 2.2, 1.7, ACC.dark, 1, 6); L1.cyl(19, -30.05, 45, 2.5, 0.1, 'yellow', 0, 6); L1.box(19, -28.9, 45, 0.14, 2.2, 0.14, 'yellow', 0);
[[0, -39.2, 67], [0, -36, 48.3], [9.3, -37.9, 44], [5, -39.8, 24]].forEach(function (q) { L1.beam([19, -31.9, 45], q, 0.04, '#5A6A9A', 0); });
/* trace lines from each KPI down to the warehouse */
TRACES.forEach(function (tr, k) {
var pts = [[tr.x, 1.5, -10.4], [tr.x, 6.4, -13.5], [tr.x, 5, -19.5], [tr.x * 0.9, -8, -24.5], [NODES[tr.path[0]].x, -27, -21]];
tr.path.slice(0, -1).forEach(function (id) { pts.push([NODES[id].x + (k === 1 ? 0.4 : 0), -35.3 - (k === 1 ? 0.25 : 0), NODES[id].z]); });
pts.push([(k === 2 ? 1.2 : k === 1 ? -1.2 : 0), -38.35, 38.8]);
tr.pts = []; var seg = 14, a, t, p0, p1, p2, p3;
for (a = 0; a < pts.length - 1; a++) for (t = 0; t < seg; t++) { p0 = pts[Math.max(0, a - 1)]; p1 = pts[a]; p2 = pts[a + 1]; p3 = pts[Math.min(pts.length - 1, a + 2)]; var u = t / seg, u2 = u * u, u3 = u2 * u;
tr.pts.push([0, 1, 2].map(function (j) { return 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * u3); })); }
tr.pts.push(pts[pts.length - 1]); tr.len = [0];
for (a = 1; a < tr.pts.length; a++) { var q0 = tr.pts[a - 1], q1 = tr.pts[a]; tr.len.push(tr.len[a - 1] + Math.sqrt(Math.pow(q1[0] - q0[0], 2) + Math.pow(q1[1] - q0[1], 2) + Math.pow(q1[2] - q0[2], 2))); (q0[1] > -1 ? L0 : L1).beam(q0, q1, 0.14, tr.c, 0); }
});
/* ---- level 2: Graphite, the calculation engine (a lighter version of the Frame Studio level) ---- */
L2.box(0, GY - 0.25, -2, 62, 0.5, 50, '#0A0D18'); col(-31, 31, -27, 23, GY, GY - 0.5);
for (i = -28; i <= 28; i += 8) L2.box(i, GY + 0.02, -2, 0.05, 0.02, 50, '#1A2350', 0);
for (i = -26; i <= 22; i += 8) L2.box(0, GY + 0.02, i, 62, 0.02, 0.05, '#1A2350', 0);
L2.cyl(0, GY + 0.25, -2, 2.2, 0.5, '#0A0D18');
['Viewer', 'Planner', 'Admin'].forEach(function (r, k) { var z = -9 + k * 6; L2.cyl(-23, GY + 0.125, z, 1.3, 0.25, ['blue', 'yellow', 'pink'][k]); label([{ t: r, s: 170, w: 800 }], 2.2, 0.62, -23, GY + 2.4, z, { lvl: 2 });
col(-24.15, -21.85, z - 1.15, z + 1.15, GY + 0.25, GY, function () { return { b: r + ' role', t: (G.role === k ? 'active' : 'press Space to switch') + '. Access rights decide which results rise through the shield for this role (rule shown is illustrative).' }; }).role = k; });
[[19.5, 21, 1.2], [18, 19.5, 2.4], [15, 18, 3.6]].forEach(function (q, k) { L2.box(0, GY + q[2] / 2, (q[0] + q[1]) / 2, 3, q[2], q[1] - q[0], '#0A0D18'); L2.box(0, GY + q[2], (q[0] + q[1]) / 2, 3.04, 0.06, q[1] - q[0] + 0.04, 'metric', 0); var c = col(-1.5, 1.5, q[0], q[1], GY + q[2], GY, k === 2 ? function () { return { b: 'Overview deck', t: 'press Space for the overview camera: the whole engine, with the access shield above.' }; } : null); if (k === 2) c.ov = true; });
label([{ t: 'Unified, governed data', s: 66, w: 800 }, { t: 'stored once and shared; access rights filter what each role sees', s: 44 }, { t: 'documented | shield illustrative', s: 44, c: 'muted' }], 5.6, 1.3, -23, GY + 3.8, -3, { px: 512, lvl: 2 });
label([{ t: 'Elastic Engine', s: 66, w: 800 }, { t: 'storage apart from compute; capacity added during peaks', s: 44 }, { t: 'interactive work is prioritised over background analysis', s: 44 }, { t: 'documented | not drawn in this lighter level', s: 40, c: 'muted' }], 6.4, 1.7, 22, GY + 2.6, 6, { px: 512, lvl: 2 });
label([{ t: "Based on Pigment's published description of Graphite", s: 50, w: 800 }, { t: 'Pigment blog: Graphite, the architecture powering what is possible in Pigment', s: 34 }, { t: 'Pigment KB: scoped calculations, access rights, scenarios', s: 34 }, { t: 'Pigment Community: architectural foundations, sparse engine', s: 34 }, { t: 'Every drawing here is original and illustrative.', s: 30, c: 'muted' }], 8.6, 2, -15, GY + 2.7, 19.5, { px: 1024, lvl: 2 });
/* Graphite, drawn in the spirit of Pigment's own illustrations (an original drawing): a sphere of layers for the Elastic Engine, a cage of connected nodes for unified, governed data, and a broken bowl of curved panels for dynamic modeling. The part for the layer in focus is in colour; the rest fade to grey. */
var SC = { on: -1, off: -1, F: 2.6, y0: GY + 9.2, parts: [], L: [['People and AI agents', 'in Pigment and through MCP: same definitions, same governance'], ['Dynamic modeling', 'flexible structures and native scenarios'], ['Elastic Engine', 'storage apart from compute, capacity on demand, prioritised work'], ['Unified, governed data', 'stored once, access rights, one source of truth']] };
function scQuad(B, a, b, c, d) { [a, b, c, a, c, d].forEach(function (p) { B.v.push(p[0], p[1], p[2], p[3], p[4], p[5], 1, 1, 1, 1); }); }
function scZone(B, R, t0, t1, tx, ry, ox) {
var n = 36, m = 4, i, j, P = function (t, a) { var x = R * Math.sin(t) * Math.cos(a), y = R * Math.cos(t), z = R * Math.sin(t) * Math.sin(a), c = Math.cos(tx), s = Math.sin(tx), y2 = y * c - z * s, z2 = y * s + z * c, cr = Math.cos(ry), sr = Math.sin(ry), x3 = x * cr + z2 * sr, z3 = -x * sr + z2 * cr; return [x3 + ox, y2, z3, x3 / R, y2 / R, z3 / R]; };
for (i = 0; i < m; i++) for (j = 0; j < n; j++) scQuad(B, P(t0 + (t1 - t0) * i / m, j / n * 6.28319), P(t0 + (t1 - t0) * (i + 1) / m, j / n * 6.28319), P(t0 + (t1 - t0) * (i + 1) / m, (j + 1) / n * 6.28319), P(t0 + (t1 - t0) * i / m, (j + 1) / n * 6.28319));
return B;
}
function scArc(B, r0, r1, y0, y1, a0, a1) {
for (var j = 0; j < 8; j++) { var a = a0 + (a1 - a0) * j / 8, b = a0 + (a1 - a0) * (j + 1) / 8, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
scQuad(B, [ca * r0, y0, sa * r0, ca, 0, sa], [cb * r0, y0, sb * r0, cb, 0, sb], [cb * r1, y1, sb * r1, cb, 0, sb], [ca * r1, y1, sa * r1, ca, 0, sa]); }
return B;
}
(function () {
var i, R = 1.55, ORB = ['#1F2A55', '#2B3A67', '#C2407E', '#F0508C', '#F57BB0', '#9AA7E8', '#3FC7E0'], N = ORB.length;
for (i = 0; i < N; i++) SC.parts.push({ k: 2, c: rgb(ORB[i]), b: scZone(new Batch(), R * (1 - i * 0.012), i / N * Math.PI + 0.035, (i + 1) / N * Math.PI - 0.035, 0.55 + Math.sin(i * 1.1) * 0.08, i * 0.35, Math.sin(i * 1.7) * 0.05).done(), y: 3.7 });
var pts = [], NB = [new Batch(), new Batch(), new Batch(), new Batch()], NC = ['#8F97AE', '#F0508C', '#3FC7E0', '#F26B3A'], LB = new Batch(), seen = {};
for (i = 0; i < 40; i++) { var yy = 0.95 - i / 39 * 1.7, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = i * 2.399963, jj = 0.88 + (i * 37 % 11) / 50; pts.push([Math.cos(th) * rr * 2.7 * jj, yy * 2.16, Math.sin(th) * rr * 2.7 * jj]); }
pts.forEach(function (p, i) { var s = 0.13 + (i * 13 % 7) * 0.025; NB[i % 5 === 0 ? 1 + (i / 5) % 3 : 0].box(p[0], p[1], p[2], s, s, s, 'white');
pts.map(function (q, j) { return [Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2), j]; }).filter(function (x) { return x[1] !== i; }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, 3).forEach(function (x) { var key = Math.min(i, x[1]) + ':' + Math.max(i, x[1]); if (!seen[key]) { seen[key] = 1; LB.beam(p, pts[x[1]], 0.025, 'white', 0); } }); });
NB.forEach(function (B, q) { SC.parts.push({ k: 3, c: rgb(NC[q]), b: B.done(), y: 1.05 }); });
SC.parts.push({ k: 3, c: rgb('#6E7BA8'), b: LB.done(), y: 1.05, line: 1 });
var BC = ['#2B3A67', '#3A4A7A', '#F0508C', '#2B3A67', '#3FC7E0', '#46557F', '#2B3A67', '#F57BB0'], bi = 0, BB = {};
[[0, 3.1, 1.25, 7], [-1.15, 2.7, 1, 6], [-2.05, 2, 0.7, 5]].forEach(function (q, ri) { for (var k = 0; k < q[3]; k++) { var a0 = k / q[3] * 6.28319 + ri * 0.4 + (k * 7 % 3) * 0.04, col = BC[bi++ % BC.length], yo = q[0] + (k * 3 % 4) * 0.06; scArc(BB[col] = BB[col] || new Batch(), q[1] * 0.86, q[1], yo - q[2] / 2, yo + q[2] / 2, a0, a0 + 6.28319 / q[3] - 0.12 - (k * 5 % 3) * 0.05); } });
Object.keys(BB).forEach(function (col) { SC.parts.push({ k: 1, c: rgb(col), b: BB[col].done(), y: -1 }); });
SC.parts.forEach(function (p) { p.cur = p.c.slice(); });
[[2, 3.7], [3, 1.05], [1, -2.3]].forEach(function (q) { label([{ t: SC.L[q[0]][0], s: 54, w: 500, c: 'muted' }], 4.4, 0.5, 10.8, SC.y0 + q[1] * SC.F, -2, { px: 512, lvl: 2 }); });
})();
L0.done(); L1.done(); L2.done();
})();

/* Graphite's moving parts: the lattice and three rings are small batches in local space, turned by a model matrix */
var G = { role: 2, rip: null, ov: 0, on: false, ova: 0, ovh: 9, rot: 0, ring: [0, 0, 0], txt: '', glow: {}, beams: {}, shield: 0.1, rn: {} };
var coreB = new Batch(), ringB = [], RR = [7, 10.5, 14];
(function () {
var a, b, c, N = 6, def;
for (a = 0; a < N; a++) for (b = 0; b < N; b++) for (c = 0; c < N; c++) { def = (a * 7 + b * 13 + c * 5 + a * b * c) % 10 < 4; coreB.box((a - 2.5) * 0.8, (b - 2.5) * 0.8, (c - 2.5) * 0.8, def ? 0.42 : 0.07, def ? 0.42 : 0.07, def ? 0.42 : 0.07, def ? ['#A889D9', '#A889D9', ACC.blue, ACC.pink, ACC.yellow][(a + b * 2 + c) % 5] : '#2A3350', 0); }
coreB.done();
RR.forEach(function (r, k) { var B = new Batch(), q, an; for (q = 0; q < 48; q++) { an = q / 48 * 6.28319; B.box(Math.cos(an) * r, 0, Math.sin(an) * r, 0.14, 0.1, r * 0.132, ['blue', 'pink', 'yellow'][k], 0, -an); } ringB.push(B.done()); });
var RN = { tNs: [0, 0], tSf: [0, 1], dProd: [0, 2], dMonth: [0, 3], act: [1, 0], lc: [1, 1], fxr: [1, 2], cmp: [1, 3], kYtd: [2, 0], kVar: [2, 1], kFx: [2, 2], age: [2, 3] };
Object.keys(RN).forEach(function (id) { G.rn[id] = { ring: RN[id][0], a: RN[id][1] * Math.PI / 2 + RN[id][0] * 0.6 }; G.glow[id] = 0; G.beams[id] = { h: 0, to: 0, a: 0 }; });
G.read = label('', 8.4, 1.3, 0, GY + 27, -2, { px: 512, lvl: 2 });
})();

function setRegion(r, quiet) {
region = r; var hs = heights(r), k = D.K[r], who = r === 'All' ? 'All regions' : r, usd = k.ytd - k.ytd / (1 + k.pct / 100);
bars.forEach(function (b, i) { b.h = hs[i]; b.tgt = hs[i].a; b.sl = hs[i].b; if (reduce) b.cur = b.tgt; else if (!quiet) b.cur = 0.05; b.tag.set([{ t: fmtM(hs[i].act != null ? hs[i].act : hs[i].fc != null ? hs[i].fc : hs[i].bud), s: 150, w: 800, c: hs[i].act != null ? 'ink' : hs[i].fc != null ? 'pink' : 'muted' }]); });
kpiL[0].set([{ t: 'Net revenue 2026 to date', s: 46, c: 'muted' }, { t: fmtM(k.ytd), s: 150, w: 800 }, { t: who, s: 40, c: 'muted' }]);
kpiL[1].set([{ t: 'Against budget, 2026 to date', s: 42, c: 'muted' }, { t: fmtP(k.pct), s: 150, w: 800, c: k.pct < 0 ? 'pink' : 'ink' }, { t: (usd < 0 ? '-' : '+') + '$' + (Math.abs(usd) >= 1 ? Math.abs(usd).toFixed(1) + 'M' : Math.round(Math.abs(usd) * 1000) + 'K') + (usd < 0 ? ' behind plan' : ' ahead of plan'), s: 40, c: 'muted' }]);
kpiL[2].set([{ t: 'Exchange-rate effect', s: 50, c: 'muted' }, { t: k.fx != null ? fmtM(k.fx) : '-', s: 150, w: 800 }, { t: k.fx != null ? 'reported vs budget rates' : who + ': not available here', s: 36, c: 'muted' }]);
if (!quiet) { mark('region'); ripple(); }
}
function ripple() { if (!G.rip) G.rip = { t: 0, hit: {}, fired: {} }; }
hireBoard();
setRegion('All', true);
badge.textContent = (D.live ? 'Live figures from this frame' : 'Snapshot figures of 24 Nov 2026') + ' | names are for orientation; marks are illustrative';

/* ------------------------------------------------------------------ player */
var P = { x: 0, y: 0, z: 14.5, vy: 0, yaw: 0, pitch: -0.04, ground: true, cur: null, lvy: 0, lvp: 0 }, K = {}, mode = 'wait', ride = null, time = 0, last = 0;
function inRect(R, x, z, m) { m = m || 0; return x > R.x0 + m && x < R.x1 - m && z > R.z0 + m && z < R.z1 - m; }
function blocked(x, z) { for (var i = 0; i < colliders.length; i++) { var c = colliders[i]; if (x > c.x0 - 0.36 && x < c.x1 + 0.36 && z > c.z0 - 0.36 && z < c.z1 + 0.36 && val(c.top) > P.y + 0.56 && val(c.bot) < P.y + 1.5) return true; } return false; }
function groundAt(x, z) { var g = -1e9, cur = null, i, c, t; for (i = 0; i < colliders.length; i++) { c = colliders[i]; if (x >= c.x0 - 0.12 && x <= c.x1 + 0.12 && z >= c.z0 - 0.12 && z <= c.z1 + 0.12) { t = val(c.top); if (t <= P.y + 0.56 && t > g) { g = t; cur = c; } } } P.cur = cur; return g; }
function nearNode(r) { var best = null, bd = r; Object.keys(nodes).forEach(function (id) { var n = nodes[id]; if (!n.n.f || !shown(id)) return; var d = Math.sqrt(Math.pow(P.x - n.n.x, 2) + Math.pow(P.z - n.n.z, 2)); if (d < bd) { bd = d; best = n; } }); return best; }
function nearRing() { if (P.y > 1 || P.y < -0.5) return -1; for (var i = 0; i < TRACES.length; i++) if (Math.sqrt(Math.pow(P.x - TRACES[i].x, 2) + Math.pow(P.z + 10.4, 2)) < 1.7) return i; return -1; }
function flash() { fade.style.transition = 'none'; fade.style.opacity = '1'; void fade.offsetWidth; fade.style.transition = 'opacity .45s linear'; fade.style.opacity = '0'; }
function ovSet(v) { G.on = !!v; if (v) { G.ova = 0; G.ovh = 9; } Object.keys(K).forEach(function (k) { K[k] = false; }); P.lvy = 0; P.lvp = 0; whereSig = ''; }
function action() {
if (mode !== 'walk') return;
if (G.on) { ovSet(false); return; }
var tb = nearTable(); if (tb) { sqlOpen = sqlOpen === tb ? null : tb; whereSig = ''; return; }   /* at a warehouse table: open or close its SQL */
var r = nearRing(); if (r >= 0) { ride = { t: TRACES[r], d: 0, v: 2.5 }; mode = 'ride'; return; }
if (P.ground && P.cur) {
var c = P.cur, pad = pads.filter(function (p) { return P.y > 0.2 && P.y < 0.3 && Math.abs(P.x - p.x) < 1.3 && Math.abs(P.z - 4) < 1.3; })[0];
if (pad) { if (pad.r !== region) setRegion(pad.r); return; }
if (inRect(LIFT, P.x, P.z) && Math.abs(P.y - lift.y) < 0.1 && lift.to == null) { lift.to = lift.y > -1 ? -39.85 : lift.y < -70 ? -39.85 : P.pitch < -0.3 ? GY + 0.15 : 0; if (lift.y > -1) mark('fall'); return; }
if (c.ov) { ovSet(true); return; }
if (c.node && !solid(c.node.id)) { HR.built[c.node.id] = 1; whereSig = ''; return; }   /* standing on a proposed block: build it */
if (c.field) { HR.field = !HR.field; hireBoard(); whereSig = ''; return; }
if (c.hrole === -2) { if (HR.hires.length) { HR.hires.pop(); HR.pend = -1; hireBoard(); } return; }
if (c.hrole != null) {   /* first Space opens the offer, second Space approves it: nothing is added until then */
if (HR.pend !== c.hrole) { HR.pend = c.hrole; whereSig = ''; return; }
HR.hires.push({ role: c.hrole, start: Math.min(11, (HR.n0 || 6) + Math.min(HR.hires.length, 4)) }); HR.pend = -1; HR.flash = 1.6; HR.stamp.x = c.x0 + 1.05; HR.stamp.z = c.z0 + 1.05; hireBoard(); return;
}
if (c.role != null) { G.role = c.role; return; }
if (P.y < -70 && Math.sqrt(P.x * P.x + (P.z + 2) * (P.z + 2)) < 7.5) { ripple(); return; }
}
if (P.ground) { P.vy = 9.4; P.ground = false; }
}
function step(dt) {
var f = 0, s = 0, ka = Math.min(1, dt * (reduce ? 20 : 6));
if (G.on) {   /* overview mode: you stand still and the keys orbit the camera; Space or Esc leaves it */
G.ova += (((K.ll || K.tl || K.left) ? 1 : 0) - ((K.lr || K.tr || K.right) ? 1 : 0)) * 0.9 * dt; G.ovh = clamp(G.ovh + (((K.lu || K.fwd) ? 1 : 0) - ((K.ld || K.back) ? 1 : 0)) * 5 * dt, 3, 16);
} else {
f = (K.fwd ? 1 : 0) - (K.back ? 1 : 0); s = (K.right ? 1 : 0) - (K.left ? 1 : 0);
P.yaw += ((K.tl ? 1 : 0) - (K.tr ? 1 : 0)) * 2 * dt;
P.lvy += (((K.ll ? 1 : 0) - (K.lr ? 1 : 0)) * 2.3 - P.lvy) * ka; P.lvp += (((K.lu ? 1 : 0) - (K.ld ? 1 : 0)) * 1.7 - P.lvp) * ka;
P.yaw += P.lvy * dt; P.pitch = clamp(P.pitch + P.lvp * dt, -1.25, 1.25);
}
if (P.rc) { P.pitch += (0 - P.pitch) * Math.min(1, dt * 10); if (Math.abs(P.pitch) < 0.01) { P.pitch = 0; P.rc = false; } }
var sn = Math.sin(P.yaw), cs = Math.cos(P.yaw), dx = -sn * f + cs * s, dz = -cs * f - sn * s, l = Math.sqrt(dx * dx + dz * dz); if (l > 1) { dx /= l; dz /= l; }
var sh = P.y < -0.2 && P.y > -39.4 && inRect(HATCH, P.x, P.z, -0.4) ? HATCH : P.y < -40.2 && P.y > GY + 0.6 && inRect(H2, P.x, P.z, -0.4) ? H2 : null, inS = !!sh && !P.ground, sp = (inS ? 2.5 : 11) * dt;
var nx = P.x + dx * sp, nz = P.z + dz * sp;
if (inS) { nx = clamp(nx, sh.x0 + 0.45, sh.x1 - 0.45); nz = clamp(nz, sh.z0 + 0.45, sh.z1 - 0.45); }
else if (P.y < -60) { nx = clamp(nx, -30.5, 30.5); nz = clamp(nz, -26.5, 22.5); }
else if (P.y > -1.5) { nx = clamp(nx, -23.6, 23.6); nz = clamp(nz, -16.6, 16.6); }
else { nx = clamp(nx, -31.5, 31.5); nz = clamp(nz, -27.5, 80); }
if (!blocked(nx, P.z)) P.x = nx; if (!blocked(P.x, nz)) P.z = nz;
if (inS) P.vy = Math.max(P.vy - 12 * dt, reduce ? -5.5 : -9.5); else P.vy -= 26 * dt;
P.y += P.vy * dt;
if (P.y < -56 && P.z > 24.4) { P.x = 0; P.y = -40; P.z = 19; P.vy = 0; P.pitch = 0; P.ground = true; flash(); return; }
var g = groundAt(P.x, P.z);
if (P.y <= g) { if (!P.ground && g < -30 && g > -41) mark('fall'); if (g < -70) mark('graphite'); P.y = g; P.vy = 0; P.ground = true; } else P.ground = P.y - g < 0.02;
focusN = P.ground && P.cur && P.cur.node ? P.cur.node : null;
var LV = [0, -39.85, GY + 0.15], onL = inRect(LIFT, P.x, P.z) && Math.abs(P.y - lift.y) < 0.4;
if (lift.to == null && !onL && P.ground) { var want = P.y > -1 ? 0 : P.y < -70 ? 2 : P.y < -30 && P.y > -41 ? 1 : -1; if (want >= 0 && Math.abs(lift.y - LV[want]) > 0.01) lift.to = LV[want]; }
if (lift.to != null) { var dd = lift.to > lift.y ? 1 : -1; lift.y += dd * 7.5 * dt; if ((lift.to - lift.y) * dd <= 0) { lift.y = lift.to; lift.to = null; } }
if (G.on && !(P.ground && P.cur && P.cur.ov)) G.on = false;
G.ov += ((G.on ? 1 : 0) - G.ov) * Math.min(1, dt * (reduce ? 20 : 3.5));
}
function stepRide(dt) {
var R = ride, T = R.t, tot = T.len[T.len.length - 1], i = 1, p, q, u;
R.v = Math.min(reduce ? 9 : 19, R.v + 7 * dt); R.d = Math.min(tot, R.d + R.v * dt);
while (i < T.len.length - 1 && T.len[i] < R.d) i++;
p = T.pts[i - 1]; q = T.pts[i]; u = (R.d - T.len[i - 1]) / ((T.len[i] - T.len[i - 1]) || 1);
P.x = p[0] + (q[0] - p[0]) * u; P.z = p[2] + (q[2] - p[2]) * u; P.y = p[1] + (q[1] - p[1]) * u - 1.65;
var tx = q[0] - p[0], ty = q[1] - p[1], tz = q[2] - p[2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1, yaw = Math.atan2(-tx, -tz), dy = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw));
P.yaw += dy * Math.min(1, dt * 6); P.pitch += (Math.asin(clamp(ty / tl, -1, 1)) * 0.8 - P.pitch) * Math.min(1, dt * 6);
var best = 0, bd = 1e9; T.path.forEach(function (id, k) { var n = NODES[id], d = Math.pow(P.x - n.x, 2) + Math.pow(P.z - n.z, 2); if (d < bd) { bd = d; best = k; } });
setWhere({ b: T.kpi, t: 'traced back through: ' + T.path.map(function (id, k) { return (k === best && P.y < -20 ? '[' + NODES[id].n + ']' : NODES[id].n); }).join(' < ') });
if (R.d >= tot) { P.y = -40; P.vy = 0; P.pitch = 0.1; mode = 'walk'; ride = null; mark('trace'); }
}
function updateWhere() {
var w, nb;
if (G.on) { setWhere({ b: 'Overview', t: 'drag, or J and L, to orbit the engine; I and K raise and lower the camera. Space or Esc returns you to the deck.', s: G.rip ? [G.txt] : [] }); return; }
if (P.y < -0.8 && P.y > -39.5 && !P.ground && inRect(HATCH, P.x, P.z, -0.5)) w = { b: 'Falling', t: 'through the frame, its data sources, its views and its metrics, down to Blockflow.' };
else if (P.y < -60) w = G.rip ? { b: 'Graphite', t: G.txt } : P.cur && P.cur.info && P.ground ? P.cur.info() : Math.sqrt(P.x * P.x + (P.z + 2) * (P.z + 2)) < 8 ? { b: 'Graphite | ' + SC.L[SC.on < 0 ? 1 + Math.floor(time / 3.5) % 3 : SC.on][0], t: SC.L[SC.on < 0 ? 1 + Math.floor(time / 3.5) % 3 : SC.on][1] + '. Press Space to run a recalculation.', s: ['Pigment describes three pillars (Pigment blog, June 2026). An original drawing.'] } : { b: 'Graphite, the calculation engine', t: 'role pads to the west, the overview deck to the north. The cyan lift goes back up.', s: ['A lighter version of the Frame Studio level. What the engine does is documented; how it looks here is illustrative.'] };
else if (P.y < -30 && (sqlOpen || nearTable())) { var tq = nearTable(); if (sqlOpen && Math.sqrt(Math.pow(P.x - sqlOpen.x, 2) + Math.pow(P.z - sqlOpen.z, 2)) > 5) sqlOpen = null; var sd = sqlOpen ? WSQL[sqlOpen.nm] : null;
w = sqlOpen ? { b: sqlOpen.nm, t: sd.kind + ' | ' + sd.rows + ' rows (illustrative)', q: sd.q, s: (sd.note ? [sd.note] : []).concat(['Illustrative SQL: column names are examples, not from a real warehouse. Space or Esc closes.']) } : tq ? { b: tq.nm, t: WSQL[tq.nm].kind + ' | press Space to open its SQL' } : { b: 'Blockflow level', t: 'walk up to a block or a warehouse table.' }; }
else if (P.y < -30) { nb = nearNode(4.6); w = P.cur && P.cur.info && P.ground ? P.cur.info() : nb ? { b: nb.n.n, t: KIND[nb.n.k], f: nb.n.f, s: ['Jump on top to see what it depends on.'] } : { b: 'Blockflow level', t: 'jump on a block to see what it depends on. Bridges at the far edge lead to Snowflake and NetSuite; the violet hatch drops to the Graphite engine.' }; }
else { var r = nearRing(); w = r >= 0 ? { b: TRACES[r].kpi, t: 'press Space to slide down its trace line to the warehouse' } : P.cur && P.cur.info && P.ground ? P.cur.info() : { b: 'You are standing on the frame', t: 'jump on the bars, try a region pad, find the pink hatch.' }; }
setWhere(w);
}

/* ------------------------------------------------------------------ frame loop */
function resize() { var dpr = Math.min(window.devicePixelRatio || 1, 1.75), w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } }
function mixc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
var whereT = 0;
var frameErr = false;
function frame(now) {   /* one bad frame must never stop the loop: catch, report once, carry on */
if (dead) return; raf = window.requestAnimationFrame(frame);
try { tick(now); } catch (e) { try { gl.depthMask(true); } catch (x) {} if (!frameErr) { frameErr = true; try { console.warn('Walk the Frame: a frame failed and was skipped.', e); } catch (x2) {} } }
}
function tick(now) {
var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt;
if (mode === 'walk') { step(dt); whereT -= dt; if (whereT < 0) { whereT = 0.12; updateWhere(); } } else if (mode === 'ride') stepRide(dt); else { P.yaw = reduce ? 0 : Math.sin(time * 0.1) * 0.25; }
bars.forEach(function (b) { b.cur += (b.tgt - b.cur) * Math.min(1, dt * (reduce ? 30 : 5)); b.tag.y = b.cur + 0.55; });
/* the engine below */
var R = G.rip, sp = reduce ? 0.25 : 1;
G.rot += dt * 0.12 * sp; G.ring.forEach(function (v, k) { G.ring[k] = v + dt * [0.05, -0.035, 0.022][k] * sp * (R ? 2 : 1); });
if (R) {
R.t += dt; var done = 0;
AFF.forEach(function (q) { var id = q[0], k = clamp((R.t - q[1]) / 0.8, 0, 1); done += G_CELLS[id] * k; if (R.t >= q[1] && !R.hit[id]) { R.hit[id] = 1; G.glow[id] = 1; }
if (k >= 1 && !R.fired[id]) { R.fired[id] = 1; var pass = G.role >= G_PASS[id], B = G.beams[id]; B.to = pass ? 40 : 18.4; B.a = 0.85; if (reduce) B.h = B.to; if (pass) nodes[id].G = 1.3; else G.shield = 0.45; } });
G.txt = 'recalculating: ' + Math.round(done / 20) * 20 + ' / ' + G_TOTAL + ' cells, affected only (5 of 12 blocks); counts illustrative';
if (R.t > 4.4) { G.rip = null; G.txt = ''; }
}
G.shield += (0.1 - G.shield) * Math.min(1, dt * 2);
var rt = G.rip ? G.txt : 'idle | ' + ['Viewer', 'Planner', 'Admin'][G.role] + ' role | Space at the core recalculates';
if (rt !== G.readT && P.y < -55) { G.readT = rt; G.read.set([{ t: 'Graphite', s: 44, w: 800, c: 'metric' }, { t: rt, s: 36, w: 600 }]); }
/* camera */
var ok = G.ov, ex = P.x + (Math.sin(G.ova) * 24 - P.x) * ok, ey = P.y + 1.65 + (GY + G.ovh - P.y - 1.65) * ok, ez = P.z + (-2 + Math.cos(G.ova) * 24 - P.z) * ok, yaw = P.yaw, pitch = P.pitch;
if (ok > 0.01) { var ty = Math.atan2(ex, ez + 2), tp = Math.atan2(GY + 4.5 - ey, Math.sqrt(ex * ex + (ez + 2) * (ez + 2))); yaw += Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)) * ok; pitch += (tp - pitch) * ok; }
resize(); gl.viewport(0, 0, cv.width, cv.height);
var sky = rgb(hx('sky')), bg = mixc(sky, rgb(hx('deep')), clamp(-ey / 34, 0, 1)); if (ey < -45) bg = mixc(bg, [0.02, 0.024, 0.05], clamp((-ey - 45) / 22, 0, 1));
gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
var VP = mMul(mPersp((cv.width < cv.height * 0.8 ? 80 : 62) * Math.PI / 180, cv.width / cv.height, 0.08, 260), mView(ex, ey, ez, yaw, pitch));
gl.useProgram(P1); gl.enableVertexAttribArray(A1.p); gl.enableVertexAttribArray(A1.n); gl.enableVertexAttribArray(A1.c);
gl.uniformMatrix4fv(U1.uVP, false, VP); gl.uniform3f(U1.uEye, ex, ey, ez); gl.uniform3fv(U1.uFog, bg); gl.uniform2f(U1.uFogR, 40, 150);
var lit = dark ? 0.9 : 1, lvl = ey > -3 ? 0 : ey > -42 ? 1 : 2;
if (ey > -41) draw(L0, null, [lit, lit, lit]);
draw(L1, null, WHITE); if (ey < -40.7) draw(L2, null, WHITE);
function dbox(x, y, z, sx, sy, sz, c, e, a, ry) { draw(e ? unitE : unit, mTRS(x, y, z, ry || 0, sx, sy, sz), c, 1, a); }
if (ey > -41) bars.forEach(function (b, i) { var fut = b.h.act == null, blue = rgb(ACC.blue), yel = rgb(ACC.yellow), st = rgb(hx('floor2'));
dbox(b.x, b.cur / 2, -6, 2.2, b.cur, 2.6, fut ? yel : blue); if (!fut) dbox(b.x, b.sl / 2, -7.6, 2.2, b.sl, 0.5, yel);
[0.75, 0.5, 0.25].forEach(function (f, j) { dbox(b.x, b.cur * f / 2, -4.3 + j * 0.8, 2.2, b.cur * f, 0.8, st); }); });
dbox(14, lift.y - 0.1, 9.5, 2.9, 0.2, 2.9, rgb(ACC.cyan), 1);
var pr = pads.filter(function (p) { return p.r === region; })[0]; if (pr && ey > -41) [0, 1, 2, 3].forEach(function (q) { var a = q * Math.PI / 2 + time * (reduce ? 0 : 0.6); dbox(pr.x + Math.cos(a) * 1.62, 0.32, 4 + Math.sin(a) * 1.62, 0.5, 0.08, 0.08, rgb(hx('ink')), 1, 1, -a + Math.PI / 2); });
/* blocks, their dependency lines and pulses */
var kk = Math.min(1, dt * 7), cn = focusN ? conn[focusN.id] : null;
if (sqlOpen && WSQL[sqlOpen.nm].feed && nodes[WSQL[sqlOpen.nm].feed]) nodes[WSQL[sqlOpen.nm].feed].G = 0.9;   /* the block this mart feeds stays lit while its SQL is open */
if (ey < -3) {
Object.keys(nodes).forEach(function (id) { var o = nodes[id]; if (!o.key || !shown(id)) return; if (!solid(id)) { GH.push(o); return; } var ti = !focusN || o === focusN || cn[id] ? 1 : 0.25; o.I += (ti - o.I) * kk; o.G += ((focusN && cn[id] ? 0.55 : 0) - o.G) * kk;
var c = rgb(hx(o.key)), g = 1 + o.G; dbox(o.n.x, o.y, o.n.z, 2.8, 1, 1.2, [c[0] * o.I * g, c[1] * o.I * g, c[2] * o.I * g]); });
if (focusN) dbox(focusN.n.x, -38.47, focusN.n.z, 2.98, 0.07, 1.38, rgb(ACC.yellow), 1);
ALLE.forEach(function (e, i) {
if (!shown(e[0]) || !shown(e[1])) return;
var a = nodes[e[1]], b = nodes[e[0]], onE = !!focusN && (e[0] === focusN.id || e[1] === focusN.id); eI[i] += ((!focusN ? 1 : onE ? 2 : 0.25) - eI[i]) * kk;
var I = eI[i], lo = Math.min(I, 1), h = clamp(I - 1, 0, 1), c = [0.62 * lo * (1 - h) + h, 0.71 * lo * (1 - h) + 0.86 * h, 0.92 * lo * (1 - h) + 0.45 * h];
var dx = b.n.x - a.n.x, dz = b.n.z - a.n.z, len = Math.sqrt(dx * dx + dz * dz);
dbox((a.n.x + b.n.x) / 2, -39, (a.n.z + b.n.z) / 2, onE ? 0.09 : 0.05, onE ? 0.09 : 0.05, len, c, 1, 1, Math.atan2(dx, dz));
if (!(focusN && (!onE || reduce))) { var k = ((reduce ? 0.3 : time * (onE ? 0.8 : 0.35)) + i * 0.37) % 1; dbox(a.n.x + dx * k, -39, a.n.z + dz * k, 0.22, 0.22, 0.22, WHITE, 1); }
});
/* streams along the bridges, toward Pigment */
FXS.forEach(function (f) { for (var j = 0; j < f[3]; j++) { var k = ((reduce ? 0 : time * f[4]) + j / f[3]) % 1; dbox(f[0][0] + (f[1][0] - f[0][0]) * k, f[0][1] + (f[1][1] - f[0][1]) * k + Math.sin(Math.PI * k) * f[2], f[0][2] + (f[1][2] - f[0][2]) * k, 0.2, 0.2, 0.2, rgb(f[5]), 1); } });   /* soft streams: the Delta share, Claude reading, the connectors */
[[[0, 64], [0, 50]], [[-5, 38], [-5, 24]], [[5, 38], [5, 24]]].forEach(function (F) { for (var j = 0; j < 5; j++) { var k = ((reduce ? 0 : time * 0.2) + j / 5) % 1; dbox(F[0][0], -39.8, F[0][1] + (F[1][1] - F[0][1]) * k, 0.16, 0.16, 0.16, rgb(ACC.cyan), 1); } });
var stp = Math.floor(time / (reduce ? 2.6 : 1.5)) % 5; [0, 1, 2, 3].forEach(function (q) { dbox(13.5 + q, -32.15, 43.8, 0.7, 0.34, 0.34, rgb(q === stp ? ACC.yellow : q < stp ? '#7CFFB0' : '#3A4466'), 1); });
if (stp !== G.air) { G.air = stp; if (!G.airL) G.airL = label('', 5.4, 2.6, 19, -34.4, 43.4, { px: 512, lvl: 1 }); var tasks = ['extract NetSuite', 'load RAW', 'run dbt', 'refresh Pigment import'];
G.airL.set([{ t: 'Airflow | schedule: daily 02:00', s: 40, w: 800 }].concat(tasks.map(function (tk, q) { return { t: (q === stp ? '> ' : q < stp ? 'done: ' : '') + tk, s: 36, w: q === stp ? 800 : 500, c: q === stp ? 'clay' : q < stp ? 'ink' : 'muted' }; }), [{ t: 'schedules and orchestrates each step (illustrative)', s: 28, c: 'muted' }])); }
}
if (ey < -40.7) {
SC.on = P.y > -60 ? -1 : P.x < -18 ? 3 : P.x > 17 ? 2 : -1; SC.off = G.rip || time % 7 >= 1.3 ? -1 : 1 + Math.floor(time / 7) % 3;
var scPale = [0.36, 0.39, 0.48], scF = G.rip ? 1.3 : 1, scK = Math.min(1, dt * 5);
SC.parts.forEach(function (p) { var t = (SC.on < 0 || SC.on === p.k) && p.k !== SC.off ? p.c : scPale, sh = t === scPale || reduce ? 1 : 1 + 0.14 * Math.sin(time * 2.4 + p.k * 1.7 + p.y); for (var q = 0; q < 3; q++) p.cur[q] += (t[q] * scF * sh - p.cur[q]) * scK; if (!p.up) draw(p.b, mTRS(0, SC.y0 + p.y * SC.F, -2, p.k === 2 ? G.rot * 2 : p.k === 3 ? -G.rot * 0.6 : G.rot * 0.25, SC.F, SC.F, SC.F), p.cur, p.line ? 0 : 1); });
dbox(-23, GY + 0.32, -9 + G.role * 6, 3.1, 0.06, 0.12, WHITE, 1); dbox(-23, GY + 0.32, -9 + G.role * 6, 0.12, 0.06, 3.1, WHITE, 1);
}
/* transparent things last: glows, the shield, then labels */
gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
if (ey > -41) dbox(-14, -0.55, 9.5, 3, 0.02, 3, rgb(ACC.pink), 1, 0.3 + Math.sin(time * 3) * (reduce ? 0 : 0.12));
if (ey < -40.7) dbox(0, GY + 30, -2, 40, 0.05, 40, rgb(ACC.cyan), 1, G.shield);
if (ey < -3 && ey > -70) dbox(0, -31, 44, 18, 78, 8, [0.1, 0.2, 0.34], 1, 0.3); dbox(-21, -36, 44, 11, 8, 10, [0.45, 0.22, 0.1], 1, 0.14);   /* the glass warehouse and the lakehouse */
GH.forEach(function (o) { dbox(o.n.x, o.y, o.n.z, 2.8, 1, 1.2, rgb(hx(o.key)), 0, 0.3); dbox(o.n.x, o.y + 0.53, o.n.z, 2.9, 0.05, 1.3, WHITE, 1, 0.8); }); GH.length = 0;   /* proposed blocks, as ghosts */
if (HR.flash > 0) { HR.flash -= dt; HR.stamp.vis = HR.flash > 0; }
gl.useProgram(P2); gl.bindBuffer(gl.ARRAY_BUFFER, quadB); gl.enableVertexAttribArray(A2); gl.vertexAttribPointer(A2, 2, gl.FLOAT, false, 0, 0);
gl.uniformMatrix4fv(U2.uVP, false, VP); gl.uniform3f(U2.uEye, ex, ey, ez); gl.uniform3fv(U2.uFog, bg); gl.uniform2f(U2.uFogR, 40, 150); gl.uniform1i(U2.uT, 0); gl.activeTexture(gl.TEXTURE0);
labels.forEach(function (L) {
if (L.lvl !== lvl || L.vis === false || (L.hire && !HR.hires.length)) return;
var dx = L.x - ex, dy = L.y - ey, dz = L.z - ez, d = Math.sqrt(dx * dx + dy * dy + dz * dz), a = L.mode === 's' ? clamp((d - 1.6) / 2.2, 0, 1) : 1; if (a <= 0.01 || d > 90) return;
gl.bindTexture(gl.TEXTURE_2D, L.tex); gl.uniform1f(U2.uA, a);
gl.uniformMatrix4fv(U2.uM, false, L.mode === 'f' ? mTRS(L.x, L.y, L.z, Math.PI, L.w, L.h, 1, -Math.PI / 2) : mTRS(L.x, L.y, L.z, L.mode === 's' ? yaw : L.ry, L.w, L.h, 1));
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
});
gl.depthMask(true);
}

/* ------------------------------------------------------------------ input */
var KEY = { KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', KeyD: 'right', ArrowLeft: 'tl', ArrowRight: 'tr', KeyQ: 'tl', KeyE: 'tr', KeyI: 'lu', KeyK: 'ld', KeyJ: 'll', KeyL: 'lr' }, SHIFT = { ArrowUp: 'lu', ArrowDown: 'ld' };
function begin() { if (mode !== 'wait') return; mode = 'walk'; start.style.display = 'none'; try { cv.focus(); } catch (e) {} }
on(go, 'click', begin);
on(cv, 'keydown', function (e) {
if (e.metaKey || e.ctrlKey || e.altKey) return;
if (mode === 'wait') { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(); } return; }
if (KEY[e.code]) { K[e.shiftKey && SHIFT[e.code] ? SHIFT[e.code] : KEY[e.code]] = true; e.preventDefault(); e.stopPropagation(); return; }
if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) action(); return; }
if (e.code === 'Escape' && sqlOpen) { sqlOpen = null; whereSig = ''; e.preventDefault(); e.stopPropagation(); return; }
if (e.code === 'Escape' && G.on) { ovSet(false); e.preventDefault(); e.stopPropagation(); return; }
if (e.code === 'KeyR' || e.code === 'Home') { P.rc = true; e.preventDefault(); return; }
if (e.code === 'KeyF') { var nd = nearNode(6); if (nd && P.y < -30) setWhere({ b: nd.n.n, t: 'Metric formula', f: nd.n.f, s: ['The step-by-step cube explainer for this formula is in Frame Studio (Frame World and Formula Studio).'] }); e.preventDefault(); }
});
on(cv, 'keyup', function (e) { if (KEY[e.code]) { K[KEY[e.code]] = false; if (SHIFT[e.code]) K[SHIFT[e.code]] = false; } });
on(cv, 'blur', function () { Object.keys(K).forEach(function (k) { K[k] = false; }); });
var drag = null;
on(cv, 'pointerdown', function (e) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} try { cv.focus(); } catch (x2) {} });
on(cv, 'pointermove', function (e) { if (!drag || drag.id !== e.pointerId || mode !== 'walk') return; var k = e.pointerType === 'touch' ? 0.0067 : 0.0042; if (G.on) { G.ova -= (e.clientX - drag.x) * 0.005; G.ovh = clamp(G.ovh + (e.clientY - drag.y) * 0.03, 3, 16); drag.x = e.clientX; drag.y = e.clientY; return; } P.yaw -= (e.clientX - drag.x) * k; P.pitch = clamp(P.pitch - (e.clientY - drag.y) * k, -1.25, 1.25); drag.x = e.clientX; drag.y = e.clientY; });
on(cv, 'pointerup', function () { drag = null; }); on(cv, 'pointercancel', function () { drag = null; });
on(cv, 'contextmenu', function (e) { e.preventDefault(); });
/* touch buttons, shown after the first touch */
var pad = el('div', 'position:absolute;left:12px;bottom:44px;display:none;grid-template-columns:repeat(3,48px);gap:6px'), jump = el('button', 'position:absolute;right:14px;bottom:44px;display:none;width:84px;height:84px;border-radius:50%;border:0;font:700 13px ' + FONT + ';color:#fff;background:' + hx('clay'), 'Jump | Use');
[['', ''], ['fwd', '^'], ['', ''], ['tl', '<'], ['back', 'v'], ['tr', '>']].forEach(function (q) { var b = el(q[0] ? 'button' : 'span', q[0] ? 'height:48px;border-radius:12px;font:700 18px ' + FONT + ';touch-action:none;' + pill : '', q[1]); if (q[0]) { b.type = 'button'; on(b, 'pointerdown', function (e) { e.preventDefault(); K[q[0]] = true; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { on(b, ev, function () { K[q[0]] = false; }); }); } pad.appendChild(b); });
jump.type = 'button'; on(jump, 'pointerdown', function (e) { e.preventDefault(); action(); }); root.appendChild(pad); root.appendChild(jump);
on(root, 'pointerdown', function (e) { if (e.pointerType === 'touch') { pad.style.display = 'grid'; jump.style.display = 'block'; keys.style.display = 'none'; } }, true);
on(document, 'visibilitychange', function () { if (document.hidden) window.cancelAnimationFrame(raf); else if (!dead) { last = performance.now(); raf = window.requestAnimationFrame(frame); } });
var offTheme = null; try { offTheme = ctx.theme.on(function () { if (ctx.theme.isDark() !== dark && view.remount) view.remount(); }); } catch (e) {}

last = performance.now(); raf = window.requestAnimationFrame(frame);
var view = {
remount: null, P: P, act: action, G: G,   /* exposed on the host element for testing only */
destroy: function () {
dead = true; window.cancelAnimationFrame(raf); offs.forEach(function (f) { try { f(); } catch (e) {} }); offs = [];
if (typeof offTheme === 'function') { try { offTheme(); } catch (e) {} }
try { glRes.forEach(function (r) { if (r instanceof WebGLTexture) gl.deleteTexture(r); else gl.deleteBuffer(r); }); var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) {}
if (root.parentNode) root.parentNode.removeChild(root);
}
};
try { host.__walk = view; } catch (e) {}
return view;
}

function createView() {
var V = null;
function open(el, ctx) { if (V) { try { V.destroy(); } catch (e) {} } V = makeWorld(el, ctx); V.remount = function () { open(el, ctx); }; }
return { id: 'world', label: 'Walk the Frame', icon: ICON, kind: 'static', group: 'Explore', mount: open, unmount: function () { if (V) { try { V.destroy(); } catch (e) {} V = null; } } };
}
var tries = 0;
function register() {
if (window.Lumina && typeof window.Lumina.registerView === 'function') { try { window.Lumina.registerView(createView()); } catch (e) {} return; }
if (tries++ < 60) window.setTimeout(register, 250);
}
register();
})();
