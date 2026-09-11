/* ============================================================
   CERVISCAN AI · LIVE NEWS 
   ============================================================ */
(function () {
  const { $, $$, esc, toast, nowStr, timeAgo } = window.CERVI.util;
  const D = window.CERVI;

  const FEEDS = {
    et: 'https://news.google.com/rss/search?q=cervical+cancer+Ethiopia&hl=en-GB&gl=ET&ceid=ET:en',
    af: 'https://news.google.com/rss/search?q=cervical+cancer+Africa&hl=en-GB&gl=ET&ceid=ET:en'
  };
  const CACHE_KEY = r => `cervi_news_${r}_v3`;
  const STALE_MS = 6 * 60 * 60 * 1000;   /* 6 h */

  const PROXIES = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
  ];

  /* ---------- fetch strategies ---------- */
  async function viaRss2Json(url) {
    const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=8`);
    if (!r.ok) throw new Error('rss2json HTTP ' + r.status);
    const j = await r.json();
    if (j.status !== 'ok' || !j.items?.length) throw new Error('rss2json empty');
    return j.items.map(it => {
      const t = it.title || 'Untitled';
      const i = t.lastIndexOf(' - ');
      const src = i > 0 ? t.slice(i + 3) : 'Google News';
      return { title: i > 0 ? t.slice(0, i) : t, link: it.link || '#',
               date: it.pubDate || '', src, live: true };
    });
  }

  async function viaProxy(url) {
    let lastErr;
    for (const p of PROXIES) {
      try {
        const r = await fetch(p(url));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const xml = await r.text();
        const items = parseRSS(xml);
        if (items.length) return items;
        throw new Error('no items (blocked page?)');
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('all proxies failed');
  }

  function parseRSS(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return [...doc.querySelectorAll('item')].slice(0, 8).map(it => ({
      title: (it.querySelector('title')?.textContent || 'Untitled').replace(/\s+-\s+[^-]+$/, ''),
      link: it.querySelector('link')?.textContent || '#',
      date: it.querySelector('pubDate')?.textContent || '',
      src: it.querySelector('source')?.textContent || 'Google News',
      live: true
    }));
  }

  async function viaRepoCache(region) {
    const r = await fetch('js/news-cache.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('repo cache HTTP ' + r.status);
    const j = await r.json();
    const items = j[region];
    if (!items?.length) throw new Error('repo cache empty');
    return items;
  }

  /* ---------- localStorage cache ---------- */
  const readCache = r => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY(r))); } catch { return null; }
  };
  const writeCache = (r, items) => {
    try { localStorage.setItem(CACHE_KEY(r), JSON.stringify({ t: Date.now(), items })); } catch {}
  };

  /* ---------- painting ---------- */
  function paint(region, items, badge) {
    const box = region === 'et' ? $('#newsET') : $('#newsAF');
    box.innerHTML = items.map(n => {
      const d = timeAgo(new Date(n.date));
      return `<a class="glass news-card lift" href="${esc(n.link)}" target="_blank" rel="noopener">
        <div class="news-meta">
          <span class="srcb">${esc(n.src)}</span>
          <span class="${badge === 'LIVE' ? 'liveb' : 'cacheb'}">${badge === 'LIVE' ? '● LIVE' : badge}</span>
          ${d ? `<span>${d}</span>` : ''}
        </div>
        <h4>${esc(n.title)}</h4></a>`;
    }).join('');
    applyFilter();
  }

  async function refreshRegion(region) {
    /* try live strategies in order */
    for (const [label, fn] of [['rss2json', () => viaRss2Json(FEEDS[region])],
                               ['proxies',  () => viaProxy(FEEDS[region])]]) {
      try {
        const items = await fn();
        writeCache(region, items);
        paint(region, items, 'LIVE');
        return true;
      } catch (e) { console.warn(`news[${region}] ${label} failed:`, e.message); }
    }
    /* repo static cache (GitHub Action) */
    try {
      const items = await viaRepoCache(region);
      paint(region, items, 'BOT');
      return true;
    } catch (e) { console.warn(`news[${region}] repo cache failed:`, e.message); }
    return false;
  }

  function renderNews() {
    let anyLive = false;
    ['et', 'af'].forEach(region => {
      const cached = readCache(region);
      /* instant paint from localStorage, then background refresh */
      if (cached?.items?.length) paint(region, cached.items, 'CACHED');
      else {
        (region === 'et' ? $('#newsET') : $('#newsAF')).innerHTML =
          '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
      }
      const age = cached ? Date.now() - cached.t : Infinity;
      if (age < STALE_MS && cached.items.length) {
        paint(region, cached.items, 'CACHED');   /* fresh enough — skip network */
        anyLive = true;
      } else {
        refreshRegion(region).then(ok => { if (ok) anyLive = true; });
      }
    });
    $('#newsSyncTime').textContent = nowStr();
    setTimeout(() => toast(anyLive ? 'News synced' : 'News offline — showing cached items'), 1500);
  }

  /* ---------- filters ---------- */
  let newsFilter = 'all';
  function applyFilter() {
    $$('#newsET .news-card').forEach(c => c.style.display = (newsFilter === 'all' || newsFilter === 'et') ? '' : 'none');
    $$('#newsAF .news-card').forEach(c => c.style.display = (newsFilter === 'all' || newsFilter === 'af') ? '' : 'none');
  }
  $('#newsFilters').addEventListener('click', e => {
    const b = e.target.closest('.fchip');
    if (!b) return;
    $$('#newsFilters .fchip').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    newsFilter = b.dataset.f;
    applyFilter();
  });
  $('#newsRefresh').addEventListener('click', () => {
    /* manual refresh always goes to the network */
    Promise.allSettled([refreshRegion('et'), refreshRegion('af')])
      .then(() => { $('#newsSyncTime').textContent = nowStr(); });
  });

  renderNews();
  setInterval(renderNews, 10 * 60 * 1000);
})();