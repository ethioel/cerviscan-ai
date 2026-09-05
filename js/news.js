/* ============================================================
   CERVISCAN AI · LIVE NEWS v2 (Google News RSS via CORS proxies)
   Fallbacks come from js/data.js.
   ============================================================ */
(function () {
  const { $, $$, esc, toast, nowStr, timeAgo } = window.CERVI.util;
  const D = window.CERVI;

  const PROXIES = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
  ];

  async function fetchText(url) {
    for (const p of PROXIES) {
      try {
        const r = await fetch(p(url), { cache: 'no-store' });
        if (r.ok) return await r.text();
      } catch (e) { /* try next proxy */ }
    }
    throw new Error('proxy-fail');
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

  function renderNews() {
    $('#newsET').innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    $('#newsAF').innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';

    const jobs = [
      fetchText('https://news.google.com/rss/search?q=cervical+cancer+Ethiopia&hl=en-GB&gl=ET&ceid=ET:en').then(parseRSS),
      fetchText('https://news.google.com/rss/search?q=cervical+cancer+Africa&hl=en-GB&gl=ET&ceid=ET:en').then(parseRSS)
    ];

    return Promise.allSettled(jobs).then(([et, af]) => {
      paint('et', et.status === 'fulfilled' && et.value.length ? et.value : D.fallbackNews.et);
      paint('af', af.status === 'fulfilled' && af.value.length ? af.value : D.fallbackNews.af);
      $('#newsSyncTime').textContent = nowStr();
      const ok = (et.status === 'fulfilled' && et.value.length) || (af.status === 'fulfilled' && af.value.length);
      toast(ok ? 'News synced live from Google News' : 'Offline — showing cached news');
    });
  }

  function paint(region, items) {
    const box = region === 'et' ? $('#newsET') : $('#newsAF');
    box.innerHTML = items.map(n => {
      const d = timeAgo(new Date(n.date));
      return `<a class="glass news-card lift" href="${esc(n.link)}" target="_blank" rel="noopener">
        <div class="news-meta">
          <span class="srcb">${esc(n.src)}</span>
          ${n.live ? '<span class="liveb">● LIVE</span>' : '<span class="cacheb">CACHED</span>'}
          ${d ? `<span>${d}</span>` : ''}
        </div>
        <h4>${esc(n.title)}</h4></a>`;
    }).join('');
    applyFilter();
  }

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
  $('#newsRefresh').addEventListener('click', renderNews);

  renderNews();
  setInterval(renderNews, 10 * 60 * 1000);
})();