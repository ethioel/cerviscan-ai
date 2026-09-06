/* ============================================================
   CERVISCAN AI · DATA LAYER v2 — single source of truth
   Every stat, chart, ticker item, model metric, demo behaviour
   and footer link reads from here.
   ============================================================ */
window.CERVI = {

  /* ---------- Site identity & links ---------- */
 site: {
    name: 'CerviScan AI',
    version: '2.0',
    github:      'https://github.com/ethioel/cerviscan-ai',
    linkedin:    'https://www.linkedin.com/in/samuel-kahsay', 
    huggingface: 'https://huggingface.co/ethioel/cerviscan-b0',
    kaggle:      'https://www.kaggle.com/ethioel/cervical-cancer-detector'
},

  ethiopia: {
    cases: 8159, deaths: 5007,
    minutesPerDeath: 105,          /* 525,600 ÷ 5,007 */
    screeningLabel: '≤4%',
    hpvCoverage: '51%',            /* girls 9–14 */
    atRiskM: 35.2,                 /* women 15+, millions */
    asr: 16.4,
    lateStage: '>80%'              /* found at advanced stage */
  },


  africa: {
    casesK: 140, deathsK: 119,
    casesShare: 23, deathsShare: 35,
    hivRisk: '×6'
  },


  model: {
    accept: { minDim: 64, maxDim: 6000, maxMB: 15, minTopProb: 0.40 },
    arch: 'EfficientNet-B0 (timm) + custom head',
    params: '4.3M',
    url: 'https://huggingface.co/ethioel/cerviscan-b0/resolve/main/cervical_b0_fp16.onnx',
    fallbackUrl: 'https://huggingface.co/ethioel/cerviscan-b0/resolve/main/cervical_b0.onnx',
    sizeMB: 8.3,
    classes: ['Dyskeratotic','Koilocytotic','Metaplastic','Parabasal','Superficial-Intermediate'],
    categories: { 'Dyskeratotic':'Abnormal', 'Koilocytotic':'HPV-related',
                  'Metaplastic':'Abnormal', 'Parabasal':'Normal',
                  'Superficial-Intermediate':'Normal' },
    normalClasses: ['Parabasal','Superficial-Intermediate'],
    inputSize: 224,
    mean: [0.485, 0.456, 0.406],
    std:  [0.229, 0.224, 0.225],
    gate: 0.70,                    /* below this - mandatory human review */
    accuracy: 98.40, macroF1: 98.40,
    normalSens: 99.69, abnormalSens5: 97.54,
    triage: { acc: 99.51, sens: 99.38, spec: 99.69,
              missed: 3, abnormal: 487, errors: 13, harmless: 10 },
    perClass: [
      { name:'Dyskeratotic',             category:'Abnormal',    p:.9878, r:.9939, f1:.9908, n:163 },
      { name:'Koilocytotic',             category:'HPV-related', p:.9752, r:.9515, f1:.9632, n:165 },
      { name:'Metaplastic',              category:'Abnormal',    p:.9750, r:.9811, f1:.9781, n:159 },
      { name:'Parabasal',                category:'Normal',      p:1.0000, r:1.0000, f1:1.0000, n:157 },
      { name:'Superficial-Intermediate', category:'Normal',      p:.9821, r:.9940, f1:.9880, n:166 }
    ]
  },

  /* ---------- Ticker ---------- */
  tickerItems: [
    ['1 death every','~105 minutes','in Ethiopia'],
    ['8,159','new cases / yr','Ethiopia'],
    ['98.4%','5-class accuracy','SIPaKMeD val'],
    ['99.4%','abnormal sensitivity','binary triage'],
    ['~140K','new cases / yr','African Region'],
    ['19 of 20','highest-mortality countries','are in Africa'],
    ['90·70·90','elimination targets','by 2030'],
    ['≤4%','ever screened','Ethiopia'],
    ['51%','HPV vax coverage','girls 9–14'],
    ['8.3 MB','model in your browser','fp16 ONNX']
  ],

  /* ---------- Chart 1 · incidence leaderboard (ASR/100k) ---------- */
  countries: [
    { name:'Eswatini',   asr:75.9 }, { name:'Malawi',     asr:62.9 },
    { name:'Zambia',     asr:59.9 }, { name:'Tanzania',   asr:59.1 },
    { name:'Mozambique', asr:54.8 }, { name:'Zimbabwe',   asr:52.9 },
    { name:'Uganda',     asr:43.1 }, { name:'Kenya',      asr:36.8 },
    { name:'Nigeria',    asr:36.1 }, { name:'Ethiopia',   asr:16.4, ethiopia:true }
  ],

  /* ---------- Chart 2 · Africa share of global burden (%) ---------- */
  share: { cases: 23, deaths: 35 },

  /* ---------- Chart 3 · projections, WHO African Region (K) ---------- */
  projections: {
    years:   [2020, 2025, 2030, 2035, 2040],
    casesK:  [140, 165, 195, 230, 270],
    deathsK: [119, 140, 166, 196, 230]
  },

  /* ---------- Chart 4 · survival gap: deaths per 100 cases ---------- */
  survivalGap: { labels: ['Ethiopia','WHO African Region','World'], ratio: [67, 85, 57] },

  /* ---------- News fallbacks ---------- */
  fallbackNews: {
    et: [
      { title:'Ethiopia cervical cancer — live search results (connect to internet for full feed)', src:'Google News', link:'https://news.google.com/search?q=cervical%20cancer%20ethiopia', date:'', live:false },
      { title:'FMOH Ethiopia — national cancer control & screening programme', src:'FMOH', link:'https://www.moh.gov.et/', date:'', live:false },
      { title:'ICO HPV Centre — Ethiopia fact sheet: HPV & related cancers', src:'ICO/IARC', link:'https://hpvcentre.net/', date:'', live:false }
    ],
    af: [
      { title:'WHO — Cervical cancer fact sheet: global strategy & elimination progress', src:'WHO', link:'https://www.who.int/news-room/fact-sheets/detail/cervical-cancer', date:'', live:false },
      { title:'WHO African Region — cervical cancer health topic & latest updates', src:'WHO AFRO', link:'https://www.afro.who.int/health-topics/cervical-cancer', date:'', live:false },
      { title:'Africa cervical cancer — live search results (connect to internet for full feed)', src:'Google News', link:'https://news.google.com/search?q=cervical%20cancer%20africa', date:'', live:false }
    ]
  },

  /* ---------- PubMed lenses ---------- */
  researchTerms: {
    all: 'cervical cancer AND Africa[Affiliation]',
    eth: 'cervical cancer AND Ethiopia[Affiliation]',
    esa: 'cervical cancer AND (Ethiopia[Affiliation] OR Kenya[Affiliation] OR Uganda[Affiliation] OR Tanzania[Affiliation] OR Malawi[Affiliation] OR Zambia[Affiliation] OR Zimbabwe[Affiliation] OR Rwanda[Affiliation] OR Mozambique[Affiliation])',
    scr: 'cervical cancer screening AND Africa[Affiliation]',
    hpv: 'HPV vaccination AND Africa[Affiliation]',
    ai:  '(cervical cancer) AND (artificial intelligence OR deep learning) AND Africa[Affiliation]'
  },

  /* ---------- Research fallbacks ---------- */
  fallbackResearch: [
    { title:'Estimates of incidence and mortality of cervical cancer in 2018: a worldwide analysis (Lancet Glob Health)', meta:'Arbyn M et al. · 2020', url:'https://pubmed.ncbi.nlm.nih.gov/33112365/', live:false },
    { title:'Live PubMed search — cervical cancer · Africa (connect to internet for full feed)', meta:'NCBI PubMed', url:'https://pubmed.ncbi.nlm.nih.gov/?term=cervical+cancer+Africa', live:false },
    { title:'Live PubMed search — cervical cancer screening · Ethiopia', meta:'NCBI PubMed', url:'https://pubmed.ncbi.nlm.nih.gov/?term=cervical+cancer+screening+Ethiopia', live:false }
  ],

  /* ---------- Shared utilities ---------- */
  util: {
    $:  s => document.querySelector(s),
    $$: s => [...document.querySelectorAll(s)],
    esc: s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },
    toast: m => {
      const t = document.querySelector('#toast'); if (!t) return;
      document.querySelector('#toastMsg').textContent = m;
      t.classList.add('show'); clearTimeout(t._t);
      t._t = setTimeout(() => t.classList.remove('show'), 3800);
    },
    nowStr: () => new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
    timeAgo: d => {
      if (!d || isNaN(d)) return '';
      const s = (Date.now() - d.getTime()) / 1e3;
      if (s < 3600)  return Math.max(1, Math.round(s/60)) + 'm ago';
      if (s < 86400) return Math.round(s/3600) + 'h ago';
      return Math.round(s/86400) + 'd ago';
    }
  }
};