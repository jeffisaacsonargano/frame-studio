/* Sample decisions and stakeholder measures shared by decision.html and stakeholders.html. Lumina is a made-up company; every figure is illustrative. */
window.DECDATA = (function () {
  var GROUPS = [
    { id: 'emp', name: 'Employees', pillar: 'S', color: '#C2407E' },
    { id: 'cus', name: 'Customers', pillar: 'S', color: '#2F7FC1' },
    { id: 'sup', name: 'Suppliers and partners', pillar: 'S', color: '#B7791F' },
    { id: 'com', name: 'Communities', pillar: 'S', color: '#2E9E83' },
    { id: 'env', name: 'Environment', pillar: 'E', color: '#4E9A2F' },
    { id: 'sha', name: 'Shareholders', pillar: 'G', color: '#6B5BD2' }
  ];
  var BASE = {
    emp: { score: 68, trend: [63, 64, 66, 65, 67, 68], ind: [['Engagement', '72 / 100'], ['Overtime', '3.1 h a week'], ['Regretted attrition', '6%']] },
    cus: { score: 74, trend: [70, 71, 73, 72, 74, 74], ind: [['Net promoter score', '41'], ['On-time delivery', '93%'], ['Complaints solved in 48 h', '88%']] },
    sup: { score: 66, trend: [61, 62, 62, 64, 65, 66], ind: [['Paid on time', '91%'], ['Small suppliers’ share of spend', '22%'], ['Partner satisfaction', '3.9 / 5']] },
    com: { score: 61, trend: [58, 58, 59, 60, 60, 61], ind: [['Local hires', '64%'], ['Volunteer hours', '1,240'], ['Community spend', '$0.4M']] },
    env: { score: 57, trend: [52, 53, 55, 55, 56, 57], ind: [['CO2e per $1M revenue', '18 t'], ['Renewable energy', '46%'], ['Packaging recycled', '71%']] },
    sha: { score: 79, trend: [80, 79, 78, 78, 79, 79], ind: [['Operating margin', '21.4%'], ['Revenue against budget', '-0.2%'], ['Cash conversion', '92%']] }
  };
  var DECISIONS = [
    {
      id: 'emea', title: 'Restock Watch SE for EMEA before the holiday sell-out', short: 'EMEA restock',
      owner: 'EMEA sales lead', due: '4 Dec 2026', region: 'EMEA',
      question: 'How do we keep EMEA partners in stock without breaking margin or the emissions goal?',
      kpi: [['EMEA revenue, year to date', '$79.2M'], ['Against budget', '-1.9%'], ['At risk in December', '$0.9M']],
      context: [
        { t: 'msg', src: '#emea-retail', when: '26 Nov', rel: 0.9, tag: 'Demand', text: 'Three store partners say Watch SE will sell out by 10 Dec, and asked for earlier delivery.' },
        { t: 'call', src: 'Weekly supply call', when: '21 Nov', rel: 0.95, tag: 'Supply', text: 'The supplier can send 6,000 units by air at a 4% higher unit cost. Sea freight lands 18 Dec, after the peak.' },
        { t: 'proj', src: 'Q4 holiday launch plan', when: 'Updated 25 Nov', rel: 0.7, tag: 'Delivery', text: 'The milestone "EMEA channel stock" is at risk: 2 of its 5 tasks are late.' },
        { t: 'data', src: 'Pigment: Revenue actuals', when: '24 Nov', rel: 0.85, tag: 'Numbers', text: 'EMEA is 1.9% under budget ($1.5M) year to date. The Direct channel leads.' },
        { t: 'model', src: 'Block: EMEA Forecast', when: 'Formula', rel: 0.8, tag: 'Model', text: 'The forecast assumes full stock coverage. A sell-out would cut December by about $0.9M.' },
        { t: 'doc', src: 'Partner agreement', when: 'Signed 2025', rel: 0.6, tag: 'Terms', text: 'Late delivery carries a 2% penalty on order value, and partners may switch to a rival brand.' },
        { t: 'people', src: 'Warehouse team lead', when: 'Call note, 22 Nov', rel: 0.65, tag: 'People', text: 'An air shipment means two weekend shifts for the Rotterdam warehouse team.' }
      ],
      build: ['Add a stock-coverage input to the EMEA Forecast block, so a sell-out shows up in the numbers.', 'Add a freight-mode dimension (air, sea) to the supply cost metric.', 'Track CO2e per shipment next to cost, so emissions sit in the same view as margin.'],
      options: [
        { id: 'air', name: 'Send by air now', rev: 1.2, margin: -0.3, risk: 'Low', time: 'Lands 6 Dec',
          imp: { emp: -1, cus: 2, sup: 1, com: 0, env: -2, sha: 1 },
          why: 'The fastest option. Partners stay stocked through the peak.',
          cost: 'A higher unit cost, two weekend shifts, and about 38 t CO2e of air freight.',
          risks: ['Air capacity is tight in early December; a one-day slip still lands before the 10th.', 'Weekend shifts on short notice strain the warehouse team.'],
          steps: [['Confirm the air order with the supplier', 'Supply planner', '28 Nov', 'supplier'], ['Book two weekend shifts, with paid overtime and time off in lieu', 'Warehouse team lead', '29 Nov', 'team'], ['Tell partners the new delivery date', 'EMEA sales lead', '29 Nov', 'partners'], ['Update the EMEA Forecast scenario in Pigment', 'FP&A', '2 Dec', 'model'], ['Offset the air-freight emissions through the sustainability budget', 'Sustainability lead', '5 Dec', 'offset']] },
        { id: 'move', name: 'Move stock from APAC', rev: 0.6, margin: 0, risk: 'Medium', time: 'Lands 8 Dec',
          imp: { emp: 0, cus: 1, sup: 0, com: 0, env: 0, sha: 1 },
          why: 'No extra unit cost, and APAC is slightly ahead of budget.',
          cost: 'APAC partners could run short in January.',
          risks: ['APAC demand in January is less certain than the plan assumes.', 'Moving stock between regions needs customs paperwork that can slip.'],
          steps: [['Agree the transfer with the APAC lead', 'EMEA sales lead', '28 Nov', 'apac'], ['Book sea-and-rail transfer', 'Supply planner', '29 Nov', 'supplier'], ['Tell EMEA partners the delivery date', 'EMEA sales lead', '29 Nov', 'partners'], ['Move the units between regions in the Pigment scenario', 'FP&A', '2 Dec', 'model']] },
        { id: 'hold', name: 'Hold, and tell partners now', rev: -0.4, margin: 0.1, risk: 'High', time: 'Sea freight 18 Dec',
          imp: { emp: 1, cus: -1, sup: -1, com: 0, env: 1, sha: -2 },
          why: 'The lowest cost and emissions, and honest with partners early.',
          cost: 'Likely sell-outs, a 2% late penalty, and some partners may switch brands.',
          risks: ['Partners who sell out may move shelf space to a rival for good.', 'The December gap widens the EMEA shortfall to about $1.9M.'],
          steps: [['Tell partners the sea-freight date, with an apology and a credit', 'EMEA sales lead', '28 Nov', 'partners'], ['Lower the December forecast in Pigment', 'FP&A', '2 Dec', 'model'], ['Plan a January catch-up promotion with partners', 'EMEA marketing', '10 Dec', 'promo']] }
      ]
    },
    {
      id: 'latam', title: 'Approve the Q1 hiring plan for LATAM', short: 'LATAM hiring',
      owner: 'LATAM regional VP', due: '12 Dec 2026', region: 'LATAM',
      question: 'How fast should we grow the LATAM team to keep up with 19% growth, without burning people out?',
      kpi: [['LATAM revenue, year to date', '$10.4M'], ['Against budget', '+19.2%'], ['Team today', '41 people']],
      context: [
        { t: 'msg', src: '#latam-leadership', when: '25 Nov', rel: 0.85, tag: 'People', text: 'The sales team is at 118% of its quota capacity. Two reps asked about burnout support.' },
        { t: 'call', src: 'Finance review', when: '20 Nov', rel: 0.9, tag: 'Budget', text: 'Finance will fund 6 roles in Q1. More needs a revenue case.' },
        { t: 'proj', src: 'São Paulo office expansion', when: 'Updated 24 Nov', rel: 0.6, tag: 'Space', text: 'Desks for 10 more people are ready on 15 Jan.' },
        { t: 'data', src: 'Pigment: Revenue actuals', when: '24 Nov', rel: 0.85, tag: 'Numbers', text: 'LATAM is 19.2% ahead of budget, at $10.4M year to date.' },
        { t: 'model', src: 'Block: Hiring lever', when: 'Formula', rel: 0.8, tag: 'Model', text: 'Each new rep adds about $0.35M a year, after a four-month ramp.' },
        { t: 'doc', src: 'Workday headcount export', when: '22 Nov', rel: 0.7, tag: 'People', text: '41 people today. Regretted attrition is 9%, above the 6% company average.' },
        { t: 'people', src: 'Local university partnership', when: 'Email, 18 Nov', rel: 0.55, tag: 'Community', text: 'A graduate program could fill 4 roles from the local community.' }
      ],
      build: ['Split the Hiring lever block by hire type (experienced, graduate), each with its own ramp.', 'Add an attrition input by region, so the plan counts the people who leave.', 'Link quota capacity to headcount, so overload shows before it hurts.'],
      options: [
        { id: 'h12', name: 'Hire 12 now', rev: 2.4, margin: -0.8, risk: 'Medium', time: 'Starts Jan',
          imp: { emp: 2, cus: 1, sup: 0, com: 1, env: 0, sha: 0 },
          why: 'Relieves the team fastest and captures the most growth.',
          cost: 'Needs a revenue case for 6 roles beyond what Finance funds, and onboarding 12 at once is hard.',
          risks: ['Growth could slow before the new reps ramp up.', 'Two desks short until a second office phase.'],
          steps: [['Write the revenue case for 6 extra roles', 'LATAM regional VP', '3 Dec', 'case'], ['Open 12 requisitions in Workday', 'Talent partner', '5 Dec', 'reqs'], ['Plan onboarding in two waves', 'Sales enablement', '10 Dec', 'onboard'], ['Add the hires to the Hiring lever in Pigment', 'FP&A', '12 Dec', 'model']] },
        { id: 'h6', name: 'Hire 6, plus 4 graduates', rev: 1.8, margin: -0.3, risk: 'Low', time: 'Starts Jan',
          imp: { emp: 1, cus: 1, sup: 0, com: 2, env: 0, sha: 1 },
          why: 'Fits the funded budget and builds a local talent pipeline.',
          cost: 'Graduates take longer to ramp, so relief for the team is gradual.',
          risks: ['The graduate program depends on the university’s timeline.', 'The team stays above capacity until about April.'],
          steps: [['Open 6 experienced requisitions', 'Talent partner', '2 Dec', 'reqs'], ['Agree the graduate intake with the university', 'LATAM regional VP', '6 Dec', 'grads'], ['Offer burnout support to the current team now', 'People team', '1 Dec', 'support'], ['Add both hire types to the Hiring lever in Pigment', 'FP&A', '12 Dec', 'model']] },
        { id: 'wait', name: 'Wait for Q2', rev: 0.6, margin: 0.2, risk: 'High', time: 'Starts Apr',
          imp: { emp: -2, cus: -1, sup: 0, com: 0, env: 0, sha: 2 },
          why: 'Protects margin this quarter and waits for more data.',
          cost: 'The team stays overloaded, and attrition is already above average.',
          risks: ['More regretted leavers, which costs more than the hires would.', 'Customers notice slower responses.'],
          steps: [['Explain the decision to the team, with a date', 'LATAM regional VP', '2 Dec', 'team'], ['Offer burnout support now', 'People team', '1 Dec', 'support'], ['Review again at the March forecast', 'FP&A', '15 Mar', 'model']] }
      ]
    },
    {
      id: 'nam', title: 'Close the NAM gap: a promotion or a channel shift', short: 'NAM gap',
      owner: 'NAM marketing lead', due: '6 Dec 2026', region: 'NAM',
      question: 'What closes the $977K NAM gap at the lowest cost to margin and to our partners?',
      kpi: [['NAM revenue, year to date', '$72.5M'], ['Against budget', '-2.3%'], ['Gap', '$977K']],
      context: [
        { t: 'msg', src: '#nam-marketing', when: '24 Nov', rel: 0.8, tag: 'Market', text: 'A competitor launched a 15% holiday discount last week.' },
        { t: 'call', src: 'Partner quarterly review', when: '19 Nov', rel: 0.9, tag: 'Partners', text: 'Two large partners will feature us if we co-fund in-store displays.' },
        { t: 'proj', src: 'NAM partner program', when: 'Updated 23 Nov', rel: 0.7, tag: 'Budget', text: 'The co-marketing budget is 40% unspent.' },
        { t: 'data', src: 'Pigment: Revenue actuals', when: '24 Nov', rel: 0.85, tag: 'Numbers', text: 'NAM is 2.3% under budget ($977K), mostly in the Online channel.' },
        { t: 'model', src: 'Block: Channel mix', when: 'Formula', rel: 0.75, tag: 'Model', text: 'In last year’s data, moving 5% of spend to partners lifted sales more than a discount did.' },
        { t: 'doc', src: 'Pricing policy', when: 'Policy', rel: 0.6, tag: 'Rules', text: 'Discounts over 10% need the CFO’s approval.' }
      ],
      build: ['Add a promotion-depth driver to the Channel mix block.', 'Model co-funded displays as a partner spend line with its own uplift.'],
      options: [
        { id: 'promo', name: 'Run a 10% holiday promotion', rev: 0.9, margin: -1.1, risk: 'Medium', time: 'From 1 Dec',
          imp: { emp: 0, cus: 2, sup: -1, com: 0, env: 0, sha: -1 },
          why: 'Answers the competitor directly, and customers like it.',
          cost: 'Costs the most margin, and partners carry part of the discount.',
          risks: ['Customers may wait for discounts next year too.', 'Partners’ margins shrink during their busiest month.'],
          steps: [['Get the discount approved', 'NAM marketing lead', '28 Nov', 'approve'], ['Brief partners on the promotion', 'Partner manager', '29 Nov', 'partners'], ['Add the promotion to the Channel mix scenario in Pigment', 'FP&A', '30 Nov', 'model']] },
        { id: 'partner', name: 'Co-fund partner displays', rev: 0.8, margin: -0.2, risk: 'Low', time: 'From 5 Dec',
          imp: { emp: 0, cus: 1, sup: 2, com: 1, env: 0, sha: 1 },
          why: 'Uses budget already set aside, and strengthens two key partners.',
          cost: 'Closes slightly less of the gap than the promotion.',
          risks: ['Displays need a week to set up, so the first week of December is lost.'],
          steps: [['Confirm the displays with both partners', 'Partner manager', '29 Nov', 'partners'], ['Move the co-marketing budget', 'NAM marketing lead', '30 Nov', 'budget'], ['Add the partner uplift to the Channel mix scenario in Pigment', 'FP&A', '2 Dec', 'model']] },
        { id: 'accept', name: 'Hold and accept the gap', rev: 0, margin: 0, risk: 'Low', time: 'No change',
          imp: { emp: 0, cus: 0, sup: 0, com: 0, env: 0, sha: -1 },
          why: 'No new cost, and no risk to pricing.',
          cost: 'NAM finishes the year about $1M under budget.',
          risks: ['The gap carries into next year’s baseline.'],
          steps: [['Note the decision and the reasons in the forecast', 'FP&A', '2 Dec', 'model'], ['Plan a channel review for Q1', 'NAM marketing lead', '15 Jan', 'review']] }
      ]
    }
  ];
  var TYPES = { msg: 'Message', call: 'Call', proj: 'Project', data: 'Data', model: 'Model', doc: 'Document', people: 'People' };
  function store(k, v) { try { if (v === undefined) { var s = localStorage.getItem('frame-studio:' + k); return s ? JSON.parse(s) : null; } localStorage.setItem('frame-studio:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function weights() { var w = store('stake-weights'); var o = {}; GROUPS.forEach(function (g) { o[g.id] = w && typeof w[g.id] === 'number' ? w[g.id] : 1; }); return o; }
  function score(opt, w) { var s = 0, t = 0; GROUPS.forEach(function (g) { s += w[g.id] * opt.imp[g.id]; t += w[g.id]; }); return t ? s / t : 0; }
  return { GROUPS: GROUPS, BASE: BASE, DECISIONS: DECISIONS, TYPES: TYPES, store: store, weights: weights, score: score };
})();
