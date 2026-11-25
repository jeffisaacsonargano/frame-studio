/* Framecraft — sample frames for the Studio (gallery, flipbook, journey).
   Every frame here is example data with no Pigment back-end. A small factory turns each spec into a
   real snapshot (frame code + bindings + data sources + synthetic data + block metadata), so picking
   one replays it with full lineage like the built-in Revenue Pulse. */
(function () {
  'use strict';
  const S = (window.Strata = window.Strata || {});

  const MONTHS = ['Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dec 26'];
  const REGIONS = ['AMER', 'EMEA', 'APAC'];
  const SHARES = [0.52, 0.31, 0.17];
  const CHART_HEX = { 1: '#0355f3', 2: '#4bc766', 3: '#ffbe5c', 4: '#f95a77', 5: '#6b1cb0', 6: '#1b2970', 7: '#c2dffa', 11: '#c096e3' };

  const M = (prefix, scale, decimals) => ({ type: 'currency', prefix: prefix || '$', scale, decimals: decimals == null ? 1 : decimals });
  const P = (d) => ({ type: 'percent', decimals: d == null ? 1 : d });
  const I = () => ({ type: 'integer', decimals: 0 });
  const N = (d, suffix) => ({ type: 'number', decimals: d, suffix: suffix || '' });

  /* Rooms of the museum, one per persona. */
  const ROOMS = [
    { id: 'cfo', name: "The CFO's Study", persona: 'CFO', blurb: 'Board-level health: growth, cash and the runway ahead.', wall: 'study' },
    { id: 'fpa', name: 'FP&A Atelier', persona: 'FP&A', blurb: 'Where the plan is drafted, tested and reconciled.', wall: 'atelier' },
    { id: 'revops', name: 'RevOps Hall', persona: 'RevOps', blurb: 'Pipeline, quota and the machinery of bookings.', wall: 'hall' },
    { id: 'people', name: 'People Gallery', persona: 'People team', blurb: 'Headcount, hiring and the shape of the organisation.', wall: 'gallery' },
    { id: 'supply', name: 'Supply Chain Wing', persona: 'Supply chain', blurb: 'Stock, demand and the flow of goods.', wall: 'wing' },
  ];

  /* kpi: [binding, name, format, base, opts]   opts: ratio, vs (index), better ('up'|'down'), formula, folder, up, sub */
  const SPECS = [
    {
      key: 'sample-cash-runway', name: 'Cash Runway', room: 'cfo', app: 'Corporate Finance', chart: 6,
      sub: 'Treasury view · actuals through Oct 2026', filterName: 'Entity',
      kpis: [
        ['cashBalance', 'Cash Balance', M('$', 'M', 1), 84.6e6, { agg: 'Last', formula: "'Bank Balances'.Amount[BY LAST: Month]", folder: 'Treasury', up: ['bank'], sub: 'Across all bank accounts' }],
        ['netBurn', 'Net Burn', M('$', 'M', 2), 3.42e6, { agg: 'Avg', better: 'down', formula: "-('Operating Cash Flow' + 'Investing Cash Flow')", folder: 'Treasury › Cash flow', up: ['ocf', 'icf'], sub: 'Average monthly, last quarter' }],
        ['runwayMonths', 'Runway', N(1, ' mo'), 24.7, { ratio: true, agg: 'Avg', formula: "'Cash Balance' / 'Net Burn'", folder: 'Treasury', up: ['ocf'], sub: 'Months of cash at current burn' }],
        ['burnPlan', 'Burn Plan', M('$', 'M', 2), 3.6e6, { agg: 'Avg', vsOf: 1, formula: null, input: true, folder: 'Targets', sub: 'Board-approved burn' }],
      ],
      constant: { name: 'RUNWAY_FLOOR_MONTHS', value: 18, label: 'Runway floor', kpi: 2, suffix: ' mo' },
      trend: { title: 'Monthly net burn', a: ['monthlyBurn', 'Monthly Burn', M('$', 'M', 1), 3.4e6, { formula: "-('Operating Cash Flow' + 'Investing Cash Flow')", folder: 'Treasury › Cash flow', up: ['ocf', 'icf'] }], p: ['monthlyBurnPlan', 'Burn Plan by Month', M('$', 'M', 1), { input: true, folder: 'Targets' }], shape: [1.05, 0.98, 1.1, 1.02, 0.96, 1.08, 1.0, 0.94, 1.03, 0.97, 1.0, 1.06] },
      table: { title: 'Cash by entity type', list: ['accountList', 'Account Type', ['Operating', 'Payroll', 'Reserve', 'Money market']], weights: [0.36, 0.14, 0.2, 0.3], cols: [['accountCash', 'Cash by Account', M('$', 'M', 1), 84.6e6, { agg: 'Last', folder: 'Treasury', up: ['bank'] }], ['accountYield', 'Yield %', P(2), 0.031, { ratio: true, agg: 'Avg', folder: 'Treasury', formula: "'Interest Income' / 'Cash by Account' * 12", up: ['bank'] }]] },
      upstream: { bank: ['Bank Balances', 'Transaction list', 'Synced daily from the bank feeds.'], ocf: ['Operating Cash Flow', 'Metric', "'GL Actuals'.Amount[FILTER: Account.'Cash Flow Class' = \"Operating\"]", ['gl']], icf: ['Investing Cash Flow', 'Metric', "'GL Actuals'.Amount[FILTER: Account.'Cash Flow Class' = \"Investing\"]", ['gl']], gl: ['GL Actuals', 'Transaction list', 'Imported from the ERP.'] },
    },
    {
      key: 'sample-opex-by-department', name: 'Opex by Department', room: 'fpa', app: 'Budget & Forecast', chart: 1,
      sub: 'FY26 operating expenses · budget vs actuals',
      kpis: [
        ['opexActual', 'Opex Actuals', M('$', 'M', 1), 61.8e6, { agg: 'Sum', formula: "'GL Actuals'.Amount[FILTER: Account.Type = \"Opex\"]", folder: 'P&L › Opex', up: ['gl'], sub: 'Year to date' }],
        ['opexBudget', 'Opex Budget', M('$', 'M', 1), 64.0e6, { agg: 'Sum', input: true, folder: 'Budget', sub: 'Year to date' }],
        ['opexVariance', 'Budget Variance', M('$', 'M', 1), 2.2e6, { agg: 'Sum', formula: "'Opex Budget' - 'Opex Actuals'", folder: 'P&L › Opex', sub: 'Under budget is positive' }],
        ['opexPerHead', 'Opex per Head', M('$', 'K', 0), 41.2e3, { ratio: true, agg: 'Avg', formula: "'Opex Actuals' / Headcount", folder: 'P&L › Opex', up: ['hc'], sub: 'Annualised' }],
      ],
      vs: [0, 1, 'vs budget'],
      trend: { title: 'Opex vs budget by month', a: ['opexMonthly', 'Opex by Month', M('$', 'M', 1), 6.1e6, { formula: "'GL Actuals'.Amount[FILTER: Account.Type = \"Opex\"][BY SUM: Month]", folder: 'P&L › Opex', up: ['gl'] }], p: ['budgetMonthly', 'Budget by Month', M('$', 'M', 1), { input: true, folder: 'Budget' }], shape: [0.92, 0.95, 1.0, 0.98, 1.02, 1.05, 0.97, 0.99, 1.04, 1.06, 1.0, 1.1] },
      table: { title: 'By department', list: ['departmentList', 'Department', ['R&D', 'Sales', 'Marketing', 'G&A', 'Customer Success']], weights: [0.38, 0.24, 0.16, 0.12, 0.1], cols: [['deptOpex', 'Department Opex', M('$', 'M', 1), 61.8e6, { agg: 'Sum', folder: 'P&L › Opex', up: ['gl'] }], ['deptUtil', 'Budget Used %', P(0), 0.96, { ratio: true, agg: 'Avg', formula: "'Department Opex' / 'Department Budget'", folder: 'Budget' }]] },
      upstream: { gl: ['GL Actuals', 'Transaction list', 'Imported from the ERP.'], hc: ['Headcount', 'Metric', "Employees.'Is Active'[BY COUNT: Employees.Department]", ['emp']], emp: ['Employees', 'Dimension', 'Synced from the HRIS.'] },
    },
    {
      key: 'sample-margin-watch', name: 'Margin Watch', room: 'fpa', app: 'Budget & Forecast', chart: 2,
      sub: 'Gross margin by product line · monthly',
      kpis: [
        ['revenueM', 'Revenue', M('$', 'M', 1), 52.4e6, { agg: 'Sum', formula: "'GL Actuals'.Amount[FILTER: Account.Type = \"Revenue\"]", folder: 'P&L', up: ['gl'], sub: 'Year to date' }],
        ['cogsM', 'COGS', M('$', 'M', 1), 12.1e6, { agg: 'Sum', better: 'down', formula: "'GL Actuals'.Amount[FILTER: Account.Type = \"COGS\"]", folder: 'P&L', up: ['gl'], sub: 'Hosting, support, services' }],
        ['gmPct', 'Gross Margin %', P(1), 0.769, { ratio: true, agg: 'Avg', formula: '(Revenue - COGS) / Revenue', folder: 'P&L › Margin', sub: 'Blended' }],
        ['gmTarget', 'Margin Target', P(1), 0.78, { ratio: true, agg: 'Avg', input: true, folder: 'Targets', sub: 'FY26 plan' }],
      ],
      trend: { title: 'Gross margin dollars vs plan', a: ['gmDollars', 'Gross Margin $', M('$', 'M', 1), 4.0e6, { formula: 'Revenue - COGS', folder: 'P&L › Margin', up: ['gl'] }], p: ['gmPlan', 'Gross Margin Plan', M('$', 'M', 1), { input: true, folder: 'Targets' }], shape: [0.9, 0.93, 1.0, 0.97, 1.0, 1.04, 0.99, 1.01, 1.05, 1.06, 1.02, 1.12] },
      table: { title: 'By product line', list: ['productList', 'Product Line', ['Platform', 'Analytics', 'Services', 'Add-ons']], weights: [0.52, 0.24, 0.14, 0.1], cols: [['lineRevenue', 'Revenue by Line', M('$', 'M', 1), 52.4e6, { agg: 'Sum', folder: 'P&L', up: ['gl'] }], ['lineMargin', 'Margin % by Line', P(1), 0.77, { ratio: true, agg: 'Avg', formula: "('Revenue by Line' - 'COGS by Line') / 'Revenue by Line'", folder: 'P&L › Margin' }]] },
      upstream: { gl: ['GL Actuals', 'Transaction list', 'Imported from the ERP.'] },
    },
    {
      key: 'sample-pipeline-coverage', name: 'Pipeline Coverage', room: 'revops', app: 'Revenue Planning', chart: 5,
      sub: 'Open pipeline against next-quarter bookings target',
      kpis: [
        ['pipeOpen', 'Open Pipeline', M('$', 'M', 1), 38.4e6, { agg: 'Sum', formula: "Opportunities.Amount[FILTER: Opportunities.'Is Open'][BY SUM: Opportunities.'Close Month']", folder: 'Pipeline', up: ['opps'], sub: 'Closing next quarter' }],
        ['bookTarget', 'Bookings Target', M('$', 'M', 1), 12.6e6, { agg: 'Sum', input: true, folder: 'Targets', sub: 'Next quarter' }],
        ['pipeWeighted', 'Weighted Pipeline', M('$', 'M', 1), 14.9e6, { agg: 'Sum', formula: 'Opportunities.Amount * Stage.Probability', folder: 'Pipeline', up: ['opps', 'stage'], sub: 'Stage-probability weighted' }],
        ['winRate', 'Win Rate', P(1), 0.284, { ratio: true, agg: 'Avg', formula: "'Closed Won Count' / 'Closed Count'", folder: 'Pipeline', up: ['opps'], sub: 'Trailing 12 months' }],
      ],
      coverage: [0, 1, 'Coverage'],
      constant: { name: 'TARGET_COVERAGE', value: 3, label: 'Coverage target', ratioOf: [0, 1], suffix: 'x' },
      trend: { title: 'Pipeline created by month', a: ['pipeCreated', 'Pipeline Created', M('$', 'M', 1), 3.3e6, { formula: "Opportunities.Amount[BY SUM: Opportunities.'Created Month']", folder: 'Pipeline', up: ['opps'] }], p: ['pipeCreatedPlan', 'Pipeline Plan', M('$', 'M', 1), { input: true, folder: 'Targets' }], shape: [0.82, 0.9, 1.18, 0.86, 0.94, 1.2, 0.85, 0.9, 1.22, 0.95, 1.02, 1.1] },
      table: { title: 'By stage', list: ['stageList', 'Stage', ['Discovery', 'Evaluation', 'Proposal', 'Commit']], weights: [0.34, 0.3, 0.22, 0.14], cols: [['stagePipe', 'Pipeline by Stage', M('$', 'M', 1), 38.4e6, { agg: 'Sum', folder: 'Pipeline', up: ['opps'] }], ['stageDeals', 'Open Deals', I(), 410, { agg: 'Sum', folder: 'Pipeline', formula: "Opportunities.'Is Open'[BY COUNT: Opportunities.Stage]", up: ['opps'] }]] },
      upstream: { opps: ['Opportunities', 'Transaction list', 'Synced from CRM every hour.'], stage: ['Stage', 'Dimension', 'Stage list with probabilities.'] },
    },
    {
      key: 'sample-quota-attainment', name: 'Quota Attainment', room: 'revops', app: 'Sales Performance', chart: 4,
      sub: 'Rep attainment against assigned quota · FY26',
      kpis: [
        ['qBookings', 'Closed Won', M('$', 'M', 1), 41.7e6, { agg: 'Sum', formula: "Opportunities.Amount[FILTER: Opportunities.Stage = Stage.\"Closed Won\"]", folder: 'Bookings', up: ['opps'], sub: 'Year to date' }],
        ['qQuota', 'Assigned Quota', M('$', 'M', 1), 44.0e6, { agg: 'Sum', formula: "'Quota Assignments'.Amount[BY SUM: Rep, Month]", folder: 'Quota', up: ['quota'], sub: 'Year to date' }],
        ['repsAtQuota', 'Reps at Quota', I(), 38, { agg: 'Sum', formula: "IF('Rep Attainment' >= 1, 1, 0)[BY SUM: Rep.Region]", folder: 'Quota', sub: 'Of 64 ramped reps' }],
        ['avgDeal', 'Average Deal', M('$', 'K', 0), 86.4e3, { ratio: true, agg: 'Avg', formula: "'Closed Won' / 'Closed Won Count'", folder: 'Bookings', up: ['opps'], sub: 'Closed won' }],
      ],
      vs: [0, 1, 'attainment', true],
      trend: { title: 'Bookings vs quota by month', a: ['qMonthly', 'Closed Won by Month', M('$', 'M', 1), 3.5e6, { formula: "'Closed Won'[BY SUM: Month]", folder: 'Bookings', up: ['opps'] }], p: ['qQuotaMonthly', 'Quota by Month', M('$', 'M', 1), { folder: 'Quota', up: ['quota'], formula: "'Quota Assignments'.Amount[BY SUM: Month]" }], shape: [0.74, 0.86, 1.24, 0.82, 0.9, 1.28, 0.8, 0.88, 1.3, 0.92, 1.0, 1.5] },
      table: { title: 'By team', list: ['teamList', 'Sales Team', ['Enterprise', 'Strategic', 'Mid-Market', 'SMB']], weights: [0.36, 0.28, 0.22, 0.14], cols: [['teamWon', 'Closed Won by Team', M('$', 'M', 1), 41.7e6, { agg: 'Sum', folder: 'Bookings', up: ['opps'] }], ['teamAtt', 'Team Attainment', P(0), 0.95, { ratio: true, agg: 'Avg', formula: "'Closed Won by Team' / 'Quota by Team'", folder: 'Quota' }]] },
      upstream: { opps: ['Opportunities', 'Transaction list', 'Synced from CRM every hour.'], quota: ['Quota Assignments', 'Table', 'Entered by Sales Ops at the start of each half.'] },
    },
    {
      key: 'sample-headcount-pulse', name: 'Headcount Pulse', room: 'people', app: 'Workforce Planning', chart: 11,
      sub: 'Active employees, hiring and attrition',
      kpis: [
        ['headcount', 'Headcount', I(), 1486, { agg: 'Last', formula: "Employees.'Is Active'[BY COUNT: Employees.Region]", folder: 'Workforce', up: ['emp'], sub: 'Active employees, month end' }],
        ['hcPlan', 'Headcount Plan', I(), 1540, { agg: 'Last', input: true, folder: 'Workforce › Plan', sub: 'Approved positions' }],
        ['openReqs', 'Open Requisitions', I(), 112, { agg: 'Last', formula: "Requisitions.'Is Open'[BY COUNT: Requisitions.Region]", folder: 'Recruiting', up: ['reqs'], sub: 'Approved, not filled' }],
        ['attrition', 'Attrition', P(1), 0.112, { ratio: true, agg: 'Avg', better: 'down', formula: "'Leavers TTM' / 'Average Headcount'", folder: 'Workforce', up: ['emp'], sub: 'Trailing 12 months' }],
      ],
      vs: [0, 1, 'vs plan'],
      trend: { title: 'Hires vs plan by month', a: ['hires', 'Hires', I(), 41, { agg: 'Sum', formula: "Employees.'Start Month'[BY COUNT: Employees.'Start Month']", folder: 'Recruiting', up: ['emp'] }], p: ['hirePlan', 'Hiring Plan', I(), { input: true, folder: 'Workforce › Plan' }], shape: [1.2, 1.05, 1.0, 0.92, 0.95, 0.88, 0.8, 0.9, 1.1, 1.08, 0.96, 0.7] },
      table: { title: 'By department', list: ['hcDeptList', 'Department', ['Engineering', 'Sales', 'Customer Success', 'Marketing', 'G&A']], weights: [0.42, 0.22, 0.14, 0.1, 0.12], cols: [['deptHc', 'Headcount by Dept', I(), 1486, { agg: 'Last', folder: 'Workforce', up: ['emp'] }], ['deptAttr', 'Attrition by Dept', P(1), 0.11, { ratio: true, agg: 'Avg', folder: 'Workforce', up: ['emp'] }]] },
      upstream: { emp: ['Employees', 'Dimension', 'Synced nightly from the HRIS.'], reqs: ['Requisitions', 'Transaction list', 'Synced from the ATS.'] },
    },
    {
      key: 'sample-hiring-velocity', name: 'Hiring Velocity', room: 'people', app: 'Workforce Planning', chart: 3,
      sub: 'Time to fill and offer acceptance across the funnel',
      kpis: [
        ['offersMade', 'Offers Made', I(), 512, { agg: 'Sum', formula: "Candidates.'Offer Date'[BY COUNT: Candidates.Region]", folder: 'Recruiting', up: ['cand'], sub: 'Year to date' }],
        ['offersAccepted', 'Offers Accepted', I(), 431, { agg: 'Sum', formula: "Candidates.'Accepted'[BY COUNT: Candidates.Region]", folder: 'Recruiting', up: ['cand'], sub: 'Year to date' }],
        ['timeToFill', 'Time to Fill', N(0, ' days'), 46, { ratio: true, agg: 'Avg', better: 'down', formula: "AVG(Requisitions.'Days Open')", folder: 'Recruiting', up: ['reqs'], sub: 'Median, closed reqs' }],
        ['recruiterLoad', 'Reqs per Recruiter', N(1), 14.2, { ratio: true, agg: 'Avg', formula: "'Open Requisitions' / Recruiters", folder: 'Recruiting', up: ['reqs'], sub: 'Current' }],
      ],
      vs: [1, 0, 'acceptance', true],
      trend: { title: 'Offers accepted by month', a: ['acceptedMonthly', 'Accepted by Month', I(), 36, { agg: 'Sum', folder: 'Recruiting', up: ['cand'] }], p: ['acceptedPlan', 'Acceptance Plan', I(), { input: true, folder: 'Workforce › Plan' }], shape: [1.1, 1.0, 1.05, 0.95, 0.9, 0.85, 0.82, 0.95, 1.15, 1.1, 1.0, 0.75] },
      table: { title: 'By source', list: ['sourceList', 'Candidate Source', ['Referral', 'Inbound', 'Agency', 'Outbound']], weights: [0.3, 0.34, 0.12, 0.24], cols: [['srcHires', 'Hires by Source', I(), 431, { agg: 'Sum', folder: 'Recruiting', up: ['cand'] }], ['srcRate', 'Acceptance Rate', P(0), 0.84, { ratio: true, agg: 'Avg', folder: 'Recruiting', up: ['cand'] }]] },
      upstream: { cand: ['Candidates', 'Transaction list', 'Synced from the ATS.'], reqs: ['Requisitions', 'Transaction list', 'Synced from the ATS.'] },
    },
    {
      key: 'sample-inventory-health', name: 'Inventory Health', room: 'supply', app: 'Supply Planning', chart: 2,
      sub: 'Stock on hand, cover and stockout risk', filterName: 'Warehouse', items: ['Reno', 'Rotterdam', 'Singapore'],
      kpis: [
        ['stockValue', 'Stock on Hand', M('$', 'M', 1), 28.3e6, { agg: 'Last', formula: "'Inventory Snapshots'.Value[BY LAST: Month]", folder: 'Inventory', up: ['snaps'], sub: 'At standard cost' }],
        ['daysCover', 'Days of Cover', N(0, ' days'), 52, { ratio: true, agg: 'Avg', formula: "'Stock on Hand' / 'Daily Demand'", folder: 'Inventory', up: ['demand'], sub: 'At forecast demand' }],
        ['stockoutSkus', 'SKUs at Risk', I(), 37, { agg: 'Sum', better: 'down', formula: "IF('Days of Cover' < 'Lead Time Days', 1, 0)[BY SUM: SKU.Warehouse]", folder: 'Inventory › Risk', up: ['sku'], sub: 'Cover below lead time' }],
        ['turns', 'Inventory Turns', N(1, 'x'), 6.4, { ratio: true, agg: 'Avg', formula: "COGS / 'Average Inventory'", folder: 'Inventory', sub: 'Annualised' }],
      ],
      trend: { title: 'Stock on hand vs target', a: ['stockMonthly', 'Stock by Month', M('$', 'M', 1), 28.3e6, { agg: 'Last', folder: 'Inventory', up: ['snaps'] }], p: ['stockTarget', 'Stock Target', M('$', 'M', 1), { input: true, folder: 'Targets' }], shape: [1.06, 1.08, 1.02, 0.98, 1.0, 1.04, 1.1, 1.12, 1.05, 0.99, 0.96, 0.92], level: true },
      table: { title: 'By category', list: ['categoryList', 'Category', ['Finished goods', 'Components', 'Packaging', 'Spares']], weights: [0.5, 0.3, 0.08, 0.12], cols: [['catStock', 'Stock by Category', M('$', 'M', 1), 28.3e6, { agg: 'Last', folder: 'Inventory', up: ['snaps'] }], ['catCover', 'Cover by Category', N(0, ' days'), 52, { ratio: true, agg: 'Avg', folder: 'Inventory', up: ['demand'] }]] },
      upstream: { snaps: ['Inventory Snapshots', 'Transaction list', 'Nightly extract from the WMS.'], demand: ['Daily Demand', 'Metric', "'Demand Forecast' / 30", ['fc']], fc: ['Demand Forecast', 'Metric', "'Shipments History'[SELECT: Month - 12] * 'Growth Factor'", ['ship']], ship: ['Shipments History', 'Transaction list', 'From the ERP.'], sku: ['SKU', 'Dimension', 'Item master.'] },
    },
    {
      key: 'sample-demand-forecast', name: 'Demand Forecast', room: 'supply', app: 'Supply Planning', chart: 1,
      sub: 'Units shipped against the consensus forecast', filterName: 'Warehouse', items: ['Reno', 'Rotterdam', 'Singapore'],
      kpis: [
        ['unitsShipped', 'Units Shipped', I(), 1.284e6, { agg: 'Sum', formula: "'Shipments History'.Units[BY SUM: Month, Warehouse]", folder: 'Demand', up: ['ship'], sub: 'Year to date' }],
        ['unitsForecast', 'Consensus Forecast', I(), 1.33e6, { agg: 'Sum', formula: "'Statistical Forecast' + 'Sales Overrides'", folder: 'Demand › Forecast', up: ['stat', 'over'], sub: 'Year to date' }],
        ['forecastAcc', 'Forecast Accuracy', P(1), 0.913, { ratio: true, agg: 'Avg', formula: "1 - ABS('Units Shipped' - 'Consensus Forecast') / 'Units Shipped'", folder: 'Demand › Forecast', sub: 'Weighted MAPE' }],
        ['fillRate', 'Fill Rate', P(1), 0.962, { ratio: true, agg: 'Avg', formula: "'Units Shipped' / 'Units Ordered'", folder: 'Demand', up: ['ship'], sub: 'Orders shipped complete' }],
      ],
      vs: [0, 1, 'vs forecast'],
      trend: { title: 'Units shipped vs forecast', a: ['unitsMonthly', 'Units by Month', I(), 128e3, { agg: 'Sum', folder: 'Demand', up: ['ship'] }], p: ['forecastMonthly', 'Forecast by Month', I(), { folder: 'Demand › Forecast', up: ['stat', 'over'], formula: "'Statistical Forecast' + 'Sales Overrides'" }], shape: [0.86, 0.88, 0.98, 1.0, 1.04, 1.1, 1.06, 1.08, 1.02, 0.98, 1.05, 1.2] },
      table: { title: 'By product family', list: ['familyList', 'Product Family', ['Core', 'Pro', 'Lite', 'Accessories']], weights: [0.44, 0.22, 0.2, 0.14], cols: [['famUnits', 'Units by Family', I(), 1.284e6, { agg: 'Sum', folder: 'Demand', up: ['ship'] }], ['famAcc', 'Accuracy by Family', P(1), 0.91, { ratio: true, agg: 'Avg', folder: 'Demand › Forecast' }]] },
      upstream: { ship: ['Shipments History', 'Transaction list', 'From the ERP.'], stat: ['Statistical Forecast', 'Metric', "FORECAST_ETS('Shipments History'.Units, Month)", ['ship']], over: ['Sales Overrides', 'Table', 'Entered by regional sales leads.'] },
    },
  ];

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const ACTUAL = 10;

  /* ---------- the generic sample frame (runs inside the sandboxed iframe) ---------- */
  function sampleFrame(CFG) {
    'use strict';
    var root = document.getElementById('app');
    if (root.__cleanup) root.__cleanup();
    var css = [
      '.sf-page{box-sizing:border-box;min-height:100%;padding:36px 32px;display:flex;flex-direction:column;gap:24px;}',
      '.sf-filters{display:flex;align-items:center;gap:12px;}',
      '.sf-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;}',
      '.sf-kpi{gap:8px;}',
      '.sf-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.sf-pos{background:var(--color-positive-10);}.sf-pos .type-chip{color:var(--color-positive-90);}',
      '.sf-neg{background:var(--color-negative-10);}.sf-neg .type-chip{color:var(--color-negative-90);}',
      '.sf-body{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:24px;align-items:start;}',
      '.sf-section{display:flex;flex-direction:column;gap:12px;min-width:0;}',
      '.sf-chart{padding:16px;gap:8px;}',
      '.sf-legend{display:flex;gap:8px;}',
      '.sf-table-surface{border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--color-white);padding:0 12px;}',
      '.sf-table{width:100%;border-collapse:collapse;}',
      '.sf-table th{text-align:left;padding:12px 0;border-bottom:1px solid var(--border);}',
      '.sf-table td{padding:12px 0;border-bottom:1px solid var(--border);}',
      '.sf-table th + th,.sf-table td + td{padding-left:24px;text-align:right;}',
      '.sf-table tr:last-child td{border-bottom:none;}',
      '.sf-table tr.sf-total td{border-top:1px solid var(--color-grey-20);}'
    ].join('');
    var style = document.getElementById('pg-styles') || document.createElement('style');
    style.id = 'pg-styles';
    style.textContent = PG_CSS + css;
    document.head.appendChild(style);
    root.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;overflow:auto;font-family:var(--font-sans);-webkit-font-smoothing:antialiased;background:var(--color-white);';

    var state = { kpis: null, trend: null, breakdown: null, regions: [], region: 'All', error: null };
    var subs = [], timer = null;
    function isLoading(x) { return x && typeof x === 'object' && x.kind === 'loading'; }
    function ready(d) { for (var r = 0; r < d.rows.length; r++) { var row = d.rows[r]; if (row.labels.some(isLoading) || row.values.some(isLoading)) return false; } return true; }
    function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
    function fmt(v, f) {
      if (v == null) return '—';
      f = f || {};
      var d = f.decimals == null ? 1 : f.decimals;
      if (f.type === 'percent') return (v * 100).toFixed(d) + '%';
      if (f.type === 'integer') return Math.round(v).toLocaleString('en-US');
      var a = Math.abs(v), s;
      if (f.scale === 'M' || (!f.scale && f.type === 'currency' && a >= 1e6)) s = (a / 1e6).toFixed(d) + 'M';
      else if (f.scale === 'K' || (!f.scale && f.type === 'currency' && a >= 1e3)) s = (a / 1e3).toFixed(d) + 'K';
      else s = a.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
      return (v < 0 ? '-' : '') + (f.prefix || '') + s + (f.suffix || '');
    }
    function pct(v) { return v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%'; }
    function schedule() { clearTimeout(timer); timer = setTimeout(render, 16); }
    function sub(name) {
      var s = window.PigmentSDK.subscribeToDataSource(name, {
        onData: function (d) { if (!ready(d)) return; state[name] = d; schedule(); },
        onError: function (e) { state.error = e && e.message ? e.message : String(e); schedule(); }
      });
      subs.push(s);
    }
    sub('kpis'); sub('trend'); sub('breakdown');
    var regionSub = window.PigmentSDK.subscribeToItems('regionList', {
      onData: function (d) { state.regions = (d.items || []).map(function (it) { return typeof it === 'string' ? it : (it.name || String(it)); }); schedule(); },
      onError: function () {}
    });
    function setRegion(r) {
      state.region = r;
      var f = r === 'All' ? [] : [{ binding: 'regionList', selection: [r] }];
      subs.forEach(function (s) { s.updateDynamicFilters(f); });
    }
    function ticks(max) {
      if (!max || max <= 0) return [0];
      var raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
      var step = (n <= 1 ? 1 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag, out = [];
      for (var t = 0; t <= max + step * 0.999; t += step) out.push(t);
      return out;
    }
    function chart(rows, width, height) {
      var pl = 56, pr = 8, pt = 22, pb = 28, pw = width - pl - pr, ph = height - pt - pb;
      var max = 0;
      rows.forEach(function (r) { r.values.forEach(function (v) { v = num(v); if (v != null && v > max) max = v; }); });
      var tk = ticks(max), top = tk[tk.length - 1] || 1, step = pw / Math.max(1, rows.length), bw = Math.max(4, Math.min(34, step * 0.56));
      var col = 'var(--color-chart-' + CFG.chart + ')';
      var out = ['<svg width=\'' + width + '\' height=\'' + height + '\' viewBox=\'0 0 ' + width + ' ' + height + '\' role=\'img\' aria-label=\'' + esc(CFG.trendTitle) + '\'>'];
      var axisFmt = { type: CFG.trendFormat.type, prefix: CFG.trendFormat.prefix, scale: CFG.trendFormat.scale, decimals: 0, suffix: '' };
      tk.forEach(function (t) {
        var y = pt + ph - (t / top) * ph;
        out.push('<line x1=\'' + pl + '\' x2=\'' + (width - pr) + '\' y1=\'' + y + '\' y2=\'' + y + '\' stroke=\'var(--color-grey-20)\'/>');
        out.push('<text x=\'' + (pl - 8) + '\' y=\'' + (y + 4) + '\' text-anchor=\'end\' fill=\'var(--color-grey-50)\' font-size=\'11\'>' + fmt(t, axisFmt) + '</text>');
      });
      var pts = [];
      rows.forEach(function (r, i) {
        var cx = pl + step * i + step / 2, a = num(r.values[0]), p = num(r.values[1]), f = num(r.values[2]);
        if (a != null) {
          var h = (a / top) * ph;
          out.push('<rect x=\'' + (cx - bw / 2) + '\' y=\'' + (pt + ph - h) + '\' width=\'' + bw + '\' height=\'' + h + '\' rx=\'2\' fill=\'' + col + '\'/>');
        } else if (f != null) {
          var hf = (f / top) * ph;
          out.push('<rect x=\'' + (cx - bw / 2) + '\' y=\'' + (pt + ph - hf) + '\' width=\'' + bw + '\' height=\'' + hf + '\' rx=\'2\' fill=\'var(--color-chart-7)\' stroke=\'' + col + '\' stroke-dasharray=\'3 2\'/>');
        }
        if (p != null) pts.push([cx, pt + ph - (p / top) * ph]);
        out.push('<text x=\'' + cx + '\' y=\'' + (height - 8) + '\' text-anchor=\'middle\' fill=\'var(--color-grey-50)\' font-size=\'11\'>' + esc(String(r.labels[0]).split(' ')[0]) + '</text>');
      });
      if (pts.length) {
        out.push('<polyline fill=\'none\' stroke=\'var(--color-grey-90)\' stroke-width=\'1.5\' stroke-dasharray=\'4 3\' points=\'' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '\'/>');
      }
      out.push('</svg>');
      return out.join('');
    }
    function card(kicker, figure, chip, good, subText) {
      var h = '<div class=\'card is-elevated sf-kpi\'><span class=\'type-kicker\'>' + esc(kicker) + '</span><div class=\'sf-row\'><span class=\'type-highlight-figure\'>' + esc(figure) + '</span>';
      if (chip) h += '<span class=\'chip ' + (good ? 'sf-pos' : 'sf-neg') + '\'><span class=\'type-chip\'>' + esc(chip) + '</span></span>';
      return h + '</div>' + (subText ? '<span class=\'type-running-small\'>' + esc(subText) + '</span>' : '') + '</div>';
    }
    function render() {
      var k = state.kpis && state.kpis.rows[0] ? state.kpis.rows[0].values.map(num) : [];
      var h = ['<div class=\'sf-page gradient-background\'>'];
      h.push('<header class=\'page-header\'><div class=\'page-header-text\'><h1 class=\'type-screen-title\'>' + esc(CFG.name) + '</h1><p class=\'type-running-small\'>' + esc(CFG.sub) + '</p></div></header>');
      if (state.error) h.push('<div class=\'type-running-regular\'>' + esc(state.error) + '</div>');
      h.push('<div class=\'sf-filters\'><span class=\'type-fieldset-small\'>' + esc(CFG.filterName) + '</span><fieldset class=\'button-group\' aria-label=\'' + esc(CFG.filterName) + '\'>');
      ['All'].concat(state.regions).forEach(function (r) { h.push('<label class=\'toggle-button button-small\'><input type=\'radio\' name=\'sf-region\' value=\'' + esc(r) + '\'' + (state.region === r ? ' checked' : '') + '/>' + esc(r) + '</label>'); });
      h.push('</fieldset></div><div class=\'sf-kpis\'>');
      CFG.kpis.forEach(function (c, i) {
        var v = k[i], chip = null, good = true;
        if (CFG.vs && CFG.vs[0] === i && k[CFG.vs[1]]) {
          var r = v / k[CFG.vs[1]];
          if (CFG.vs[3]) { chip = (r * 100).toFixed(1) + '% ' + CFG.vs[2]; good = r >= 1 || CFG.vs[2] === 'acceptance'; }
          else { chip = pct(r - 1) + ' ' + CFG.vs[2]; good = (r >= 1) === (c.better !== 'down'); }
        }
        if (CFG.coverage && CFG.coverage[0] === i && k[CFG.coverage[1]]) {
          var cov = v / k[CFG.coverage[1]];
          chip = cov.toFixed(1) + 'x coverage';
          good = !CFG.constant || cov >= CFG.constant.value;
        }
        var subText = c.sub;
        if (CFG.constant && CFG.constant.kpi === i) { subText = CFG.constant.label + ' ' + CFG.constant.value + (CFG.constant.suffix || ''); good = v >= CFG.constant.value; chip = v >= CFG.constant.value ? 'Above floor' : 'Below floor'; }
        if (CFG.constant && CFG.constant.ratioOf && CFG.constant.ratioOf[0] === i) subText = CFG.constant.label + ' ' + CFG.constant.value + (CFG.constant.suffix || '');
        h.push(card(c.name, fmt(v, c.format), chip, good, subText));
      });
      h.push('</div><div class=\'sf-body\'>');
      h.push('<section class=\'sf-section\'><div class=\'section-header\'><div class=\'section-header-text\'><h2 class=\'type-section-title\'>' + esc(CFG.trendTitle) + '</h2></div></div><div class=\'card is-elevated sf-chart\'><div class=\'sf-legend\'>');
      h.push('<span class=\'chip\'><span class=\'chip-dot\' style=\'background:var(--color-chart-' + CFG.chart + ');border:none\'></span><span class=\'type-chip\'>' + esc(CFG.trendA) + '</span></span><span class=\'chip\'><span class=\'chip-dot\' style=\'background:var(--color-grey-90);border:none\'></span><span class=\'type-chip\'>' + esc(CFG.trendP) + '</span></span>');
      h.push('</div><div data-chart=\'trend\'></div></div></section>');
      h.push('<section class=\'sf-section\'><div class=\'table-header\'><div class=\'table-header-text\'><h2 class=\'type-section-title\'>' + esc(CFG.tableTitle) + '</h2></div></div><div class=\'sf-table-surface\'><table class=\'sf-table\'><thead><tr><th class=\'type-column-title\'>' + esc(CFG.tableList) + '</th>');
      CFG.cols.forEach(function (c) { h.push('<th class=\'type-column-title\'>' + esc(c.short) + '</th>'); });
      h.push('</tr></thead><tbody>');
      var rows = state.breakdown ? state.breakdown.rows : [], tot = 0, wsum = 0;
      rows.forEach(function (r) {
        var a = num(r.values[0]), b = num(r.values[1]);
        tot += a || 0; wsum += (a || 0) * (b || 0);
        h.push('<tr><td class=\'type-running-regular\'>' + esc(r.labels[0]) + '</td><td class=\'type-running-regular\'>' + fmt(a, CFG.cols[0].format) + '</td><td class=\'type-running-regular\'>' + fmt(b, CFG.cols[1].format) + '</td></tr>');
      });
      if (rows.length) h.push('<tr class=\'sf-total\'><td class=\'type-running-heavy\'>Total</td><td class=\'type-running-heavy\'>' + fmt(tot, CFG.cols[0].format) + '</td><td class=\'type-running-heavy\'>' + fmt(tot ? wsum / tot : null, CFG.cols[1].format) + '</td></tr>');
      h.push('</tbody></table></div></section></div></div>');
      root.innerHTML = h.join('');
      var host = root.querySelector('[data-chart=\'trend\']');
      if (host && state.trend) host.innerHTML = chart(state.trend.rows, Math.max(240, host.clientWidth || 700), 300);
    }
    function onChange(e) { if (e.target && e.target.name === 'sf-region') setRegion(e.target.value); }
    function onResize() { schedule(); }
    root.addEventListener('change', onChange);
    window.addEventListener('resize', onResize);
    root.innerHTML = '<div class=\'type-running-small\' style=\'padding:48px\'>Loading ' + esc(CFG.name) + '…</div>';
    root.__cleanup = function () {
      subs.forEach(function (s) { s.unsubscribe(); });
      regionSub.unsubscribe();
      root.removeEventListener('change', onChange);
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }

  /* ---------- snapshot factory ---------- */
  function build(spec, pigmentCss) {
    const rand = rng(hashStr(spec.key));
    const jit = (p) => 1 + (rand() * 2 - 1) * p;
    const filterName = spec.filterName || 'Region';
    const items = spec.items || REGIONS;
    const tableList = spec.table.list;
    const blocks = {}, bindings = [];
    const addMetric = (e, dims) => {
      const [b, name, format, , o] = e;
      const opts = o || {};
      blocks[b] = { name, kind: 'Metric', folder: opts.folder || null, dims, formula: opts.input ? null : opts.formula || null, input: !!opts.input || (!opts.formula && opts.input !== false && !opts.up), format, aggregator: opts.agg || (opts.ratio ? 'Avg' : 'Sum'), description: opts.input ? 'Input metric.' : undefined, upstream: opts.up || [] };
      bindings.push({ name: b, type: 'Metric', metric_id: 'mtr-' + b, can_read: true, can_write: false });
    };
    spec.kpis.forEach((e) => addMetric(e, ['Month', filterName]));
    const pEntry = [spec.trend.p[0], spec.trend.p[1], spec.trend.p[2], 0, spec.trend.p[3]];
    addMetric(spec.trend.a, ['Month', filterName]);
    addMetric(pEntry, ['Month', filterName]);
    spec.table.cols.forEach((e) => addMetric(e, ['Month', filterName, tableList[1]]));
    blocks.monthList = { name: 'Month', kind: 'Dimension', folder: 'Calendar', dims: [], items: 12, description: 'Calendar dimension, Jan 26 – Dec 26.' };
    blocks.regionList = { name: filterName, kind: 'Dimension', folder: 'Org', dims: [], items: items.length };
    blocks[tableList[0]] = { name: tableList[1], kind: 'Dimension', folder: 'Org', dims: [], items: tableList[2].length };
    bindings.push({ name: 'monthList', type: 'List', list_id: 'lst-month', can_read: false, can_write: false });
    bindings.push({ name: 'regionList', type: 'List', list_id: 'lst-region', can_read: true, can_write: false });
    bindings.push({ name: tableList[0], type: 'List', list_id: 'lst-' + tableList[0], can_read: false, can_write: false });

    const sel = [{ binding: 'regionList' }];
    const defs = [
      { name: 'kpis', values: spec.kpis.map((e) => ({ binding: e[0], aggregator: (e[4] && e[4].agg) || undefined })), labels: [], selectors: sel },
      { name: 'trend', values: [{ binding: spec.trend.a[0], aggregator: 'Sum' }, { binding: spec.trend.p[0], aggregator: 'Sum' }], labels: [{ binding: 'monthList' }], selectors: sel },
      { name: 'breakdown', values: spec.table.cols.map((e) => ({ binding: e[0], aggregator: (e[4] && e[4].agg) || undefined })), labels: [{ binding: tableList[0] }], selectors: sel },
    ];
    defs.forEach((d) => d.values.forEach((v) => { if (!v.aggregator) delete v.aggregator; }));

    // region-level values; "All" aggregates them the way Pigment would (sum, or share-weighted average for ratios)
    const regionVals = items.map((_, ri) => {
      const share = SHARES[ri] || 1 / items.length;
      const val = (base, opts) => (opts && opts.ratio ? base * jit(0.06) : base * share * jit(0.05));
      const kp = spec.kpis.map((e) => val(e[3], e[4]));
      const smooth = spec.trend.shape.map((x) => 1 + (x - 1) * 0.35);
      const tScale = spec.trend.level ? share : share;
      const ta = spec.trend.shape.map((x, m) => (m < ACTUAL ? spec.trend.a[3] * tScale * x * jit(0.05) : null));
      const tp = smooth.map((x) => spec.trend.a[3] * tScale * x * 1.03);
      const tb = tableList[2].map((_, ii) => spec.table.cols.map((e) => (e[4] && e[4].ratio ? e[3] * jit(0.08) : e[3] * share * spec.table.weights[ii] * jit(0.06))));
      return { share, kp, ta, tp, tb };
    });
    const isRatio = (e) => !!(e[4] && e[4].ratio);
    const agg = (vals, ratio) => (ratio ? vals.reduce((s, v, i) => s + v * regionVals[i].share, 0) / regionVals.reduce((s, r) => s + r.share, 0) : vals.reduce((s, v) => s + v, 0));
    const roundFor = (e, v) => (v == null ? null : e[2].type === 'integer' ? Math.round(v) : v);
    const kpisRows = (R) => ({ rows: [{ labels: [], values: spec.kpis.map((e, i) => roundFor(e, R.kp[i])) }], rowOffset: 0, totalRowCount: 1 });
    const trendRows = (R) => ({ rows: MONTHS.map((m, i) => ({ labels: [m], values: [roundFor(spec.trend.a, R.ta[i]), roundFor(spec.trend.a, R.tp[i])] })), rowOffset: 0, totalRowCount: 12 });
    const tableRows = (R) => ({ rows: tableList[2].map((it, i) => ({ labels: [it], values: spec.table.cols.map((e, c) => roundFor(e, R.tb[i][c])) })), rowOffset: 0, totalRowCount: tableList[2].length });
    const All = {
      kp: spec.kpis.map((e, i) => agg(regionVals.map((r) => r.kp[i]), isRatio(e))),
      ta: MONTHS.map((_, m) => (m < ACTUAL ? agg(regionVals.map((r) => r.ta[m]), false) : null)),
      tp: MONTHS.map((_, m) => agg(regionVals.map((r) => r.tp[m]), false)),
      tb: tableList[2].map((_, ii) => spec.table.cols.map((e, c) => agg(regionVals.map((r) => r.tb[ii][c]), isRatio(e)))),
    };
    const data = { kpis: { default: kpisRows(All), filters: {} }, trend: { default: trendRows(All), filters: {} }, breakdown: { default: tableRows(All), filters: {} } };
    items.forEach((it, ri) => {
      data.kpis.filters['regionList=' + it] = kpisRows(regionVals[ri]);
      data.trend.filters['regionList=' + it] = trendRows(regionVals[ri]);
      data.breakdown.filters['regionList=' + it] = tableRows(regionVals[ri]);
    });

    const upstream = {};
    Object.keys(spec.upstream || {}).forEach((k) => {
      const u = spec.upstream[k];
      const hasFormula = u[1] === 'Metric';
      upstream[k] = { name: u[0], kind: u[1], formula: hasFormula ? u[2] : null, description: hasFormula ? undefined : u[2], upstream: hasFormula ? u[3] || [] : [] };
    });

    const short = (n) => n.replace(/ by (Account|Dept|Category|Family|Line|Stage|Team|Source)$/i, '').replace(/^Department /, '');
    const CFG = {
      name: spec.name, sub: spec.sub, chart: spec.chart || 1, filterName,
      kpis: spec.kpis.map((e) => ({ name: e[1], format: e[2], sub: (e[4] && e[4].sub) || '', better: (e[4] && e[4].better) || 'up' })),
      vs: spec.vs || null, coverage: spec.coverage || null,
      constant: spec.constant ? { label: spec.constant.label, value: spec.constant.value, kpi: spec.constant.kpi == null ? -1 : spec.constant.kpi, ratioOf: spec.constant.ratioOf || null, suffix: spec.constant.suffix || '' } : null,
      trendTitle: spec.trend.title, trendA: spec.trend.a[1], trendP: spec.trend.p[1], trendFormat: spec.trend.a[2],
      tableTitle: spec.table.title, tableList: tableList[1], cols: spec.table.cols.map((e) => ({ short: short(e[1]), format: e[2] })),
    };
    const constLine = spec.constant ? 'var ' + spec.constant.name + ' = ' + spec.constant.value + '; // hardcoded presentation threshold\n' : '';
    const code = '/* ' + spec.name + ' — Framecraft sample frame (example data, no Pigment back-end). */\nvar PG_CSS = ' + JSON.stringify(pigmentCss || '') + ';\n' + constLine +
      '(' + sampleFrame.toString() + ')(' + JSON.stringify(CFG) + ');\n';

    return {
      schema: 1,
      key: spec.key,
      frame: { id: 'frm-' + spec.key, name: spec.name, application: spec.app, workspace: 'Sample workspace', isSample: true, room: spec.room },
      version: { id: 'v1', n: 1, label: 'Sample', createdAt: '2026-11-20T09:00:00Z', author: 'Framecraft', note: 'Example frame with synthetic data.', source: 'sample' },
      code, bindings, dataSources: defs, data,
      items: { regionList: items.slice(), monthList: MONTHS.slice(), [tableList[0]]: tableList[2].slice() },
      blocks, upstream, tunable: false,
    };
  }

  /* ---------- thumbnails: a painted miniature of any snapshot ---------- */
  function thumb(snap, opts) {
    opts = opts || {};
    const ds = snap.dataSources || [];
    const kDef = ds.find((d) => !d.labels.length);
    const tDef = ds.find((d) => d.labels.length && d.labels[0].binding === 'monthList');
    const rows = (d) => (d && snap.data[d.name] ? snap.data[d.name].default.rows : []);
    const k = rows(kDef)[0] ? rows(kDef)[0].values : [];
    const meta = (b) => (snap.blocks && snap.blocks[b]) || { name: b };
    const fmt = (v, f) => (S.engine ? S.engine.formatPigment(v, f) : String(v));
    const spec = SPECS.find((s) => s.key === snap.key);
    const col = CHART_HEX[(spec && spec.chart) || 1] || '#0355f3';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const out = ['<svg viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="1280" height="800" fill="url(#tg)"/>'];
    out.push('<text x="40" y="74" font-family="Inter,system-ui,sans-serif" font-size="34" font-weight="500" fill="#020d23">' + esc(snap.frame.name) + '</text>');
    const nK = Math.min(4, kDef ? kDef.values.length : 0);
    for (let i = 0; i < nK; i++) {
      const x = 40 + i * 302, b = kDef.values[i].binding, m = meta(b);
      out.push('<rect x="' + x + '" y="112" width="282" height="128" rx="6" fill="#fff" stroke="#e8eaed"/>');
      out.push('<text x="' + (x + 20) + '" y="148" font-family="Inter,system-ui,sans-serif" font-size="17" fill="#5a657a">' + esc(m.name) + '</text>');
      out.push('<text x="' + (x + 20) + '" y="202" font-family="Inter,system-ui,sans-serif" font-size="40" font-weight="500" fill="#020d23">' + esc(fmt(k[i], m.format)) + '</text>');
    }
    out.push('<rect x="40" y="272" width="780" height="488" rx="6" fill="#fff" stroke="#e8eaed"/>');
    const tr = rows(tDef);
    if (tr.length) {
      let max = 0;
      tr.forEach((r) => r.values.forEach((v) => { if (typeof v === 'number' && v > max) max = v; }));
      const bw = 34, step = 720 / tr.length;
      tr.forEach((r, i) => {
        const v = typeof r.values[0] === 'number' ? r.values[0] : typeof r.values[2] === 'number' ? r.values[2] : null;
        if (v == null) return;
        const h = (v / (max || 1)) * 380, x = 70 + i * step + (step - bw) / 2;
        out.push('<rect x="' + x.toFixed(1) + '" y="' + (730 - h).toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="3" fill="' + (typeof r.values[0] === 'number' ? col : '#c2dffa') + '"/>');
      });
      const pts = tr.map((r, i) => (typeof r.values[1] === 'number' ? (70 + i * step + step / 2).toFixed(1) + ',' + (730 - (r.values[1] / (max || 1)) * 380).toFixed(1) : null)).filter(Boolean);
      if (pts.length) out.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#020d23" stroke-width="3" stroke-dasharray="8 6" opacity=".7"/>');
    }
    out.push('<rect x="852" y="272" width="388" height="488" rx="6" fill="#fff" stroke="#e8eaed"/>');
    for (let i = 0; i < 6; i++) { out.push('<rect x="876" y="' + (310 + i * 64) + '" width="' + (150 + ((i * 53) % 110)) + '" height="14" rx="7" fill="#e8eaed"/><rect x="1130" y="' + (310 + i * 64) + '" width="86" height="14" rx="7" fill="' + (i === 0 ? col : '#d3d8e0') + '" opacity="' + (i === 0 ? 0.8 : 1) + '"/>'); }
    out.push('</svg>');
    return out.join('');
  }

  const cache = new Map();
  S.samples = {
    rooms: ROOMS,
    specs: SPECS,
    has: (key) => SPECS.some((s) => s.key === key),
    build(key, pigmentCss) {
      const ck = key + '|' + (pigmentCss ? pigmentCss.length : 0); // thumbnails build without CSS; never hand that copy to the stage
      if (!cache.has(ck)) { const spec = SPECS.find((s) => s.key === key); if (!spec) return null; cache.set(ck, build(spec, pigmentCss)); }
      return JSON.parse(JSON.stringify(cache.get(ck)));
    },
    thumb,
    roomOf: (key) => { const s = SPECS.find((x) => x.key === key); return s ? s.room : 'cfo'; },
  };
})();
