/* ============================================================
   CERVISCAN AI · LIVE RESEARCH v2 (NCBI PubMed E-utilities)
   CORS-enabled, no API key · auto-refresh every 10 minutes
   Query lenses + fallbacks come from js/data.js.
   ============================================================ */
(function () {
  const { $, $$, esc, toast, nowStr } = window.CERVI.util;
  const D = window.CERVI;

  async function fetchResearch(termKey) {
    const term = D.researchTerms[termKey] || D.researchTerms.all;
    const es = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=9&sort=date&retmode=json`);
    const data = await es.json();
    const ids = (data.esearchresult && data.esearchresult.idlist) || [];
    if (!ids.length) return [];
    const sm = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
    const sum = await sm.json();
    return ids.map(id => sum.result && sum.result[id]).filter(Boolean).map(r => ({
      title: r.title,
      meta: `${r.lastauthor || ''}${r.lastauthor ? ' et al.' : ''} · ${r.pubdate || ''} · ${r.fulljournalname || r.source || ''}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${r.uid}/`,
      live: true
    }));
  }

  function renderResearch(key = 'all') {
    const list = $('#resList');
    list.innerHTML = '<div class="skel" style="height:80px"></div><div class="skel" style="height:80px"></div><div class="skel" style="height:80px"></div>';
    return fetchResearch(key)
      .then(items => {
        paint(items.length ? items : D.fallbackResearch);
        $('#resSyncTime').textContent = nowStr();
        toast(items.length ? `Research synced · ${items.length} papers` : 'Offline — cached research shown');
      })
      .catch(() => { paint(D.fallbackResearch); toast('Offline — cached research shown'); });
  }

  function paint(items) {
    $('#resList').innerHTML = items.map((r, i) => `
      <a class="glass res-item lift" href="${esc(r.url)}" target="_blank" rel="noopener">
        <span class="res-num">${String(i + 1).padStart(2, '0')}</span>
        <div class="res-body">
          <h4>${esc(r.title)}</h4>
          <div class="res-meta"><b>${r.live ? '● LIVE · PubMed' : 'CACHED'}</b><span>${esc(r.meta)}</span></div>
        </div></a>`).join('');
  }

  $('#resFilters').addEventListener('click', e => {
    const b = e.target.closest('.fchip');
    if (!b) return;
    $$('#resFilters .fchip').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    renderResearch(b.dataset.t);
  });
  $('#resRefresh').addEventListener('click', () => {
    const on = $('#resFilters .fchip.on');
    renderResearch(on ? on.dataset.t : 'all');
  });

  renderResearch('all');
  setInterval(() => {
    const on = $('#resFilters .fchip.on');
    renderResearch(on ? on.dataset.t : 'all');
  }, 10 * 60 * 1000);
})();