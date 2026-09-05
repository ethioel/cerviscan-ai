/* ============================================================
   CERVISCAN AI · UI CORE v2
   Router · Kinetic typography · Counters · Clock · Ticker
   · Data binder (data-bind spans) · Footer links
   ============================================================ */
(function () {
  const { $, $$, esc } = window.CERVI.util;
  const D = window.CERVI;

  /* ============ router ============ */
  window.go = function go(id) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const pg = $('#page-' + id);
    if (!pg) return;
    pg.classList.add('active');
    $$('.nav-links button').forEach(b => b.classList.toggle('active', b.dataset.go === id));
    $('#navLinks').classList.remove('open');
    history.replaceState(null, '', '#' + id);
    window.scrollTo({ top: 0, behavior: 'instant' });
    pg.querySelectorAll('.k-title').forEach(t => { t.classList.remove('k-in'); kineticTitle(t); });
    observeReveals(pg);
    animateCounters(pg);
    animateBars(pg);
    animateDonuts(pg);
    document.dispatchEvent(new CustomEvent('cervi:page', { detail: { id } }));
  };

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.dataset.go); }
  });
  $('#burger').addEventListener('click', () => $('#navLinks').classList.toggle('open'));

  /* ============ kinetic typography ============ */
  function kineticTitle(el) {
    if (!el || !el.dataset.text) return;
    const txt = el.dataset.text;
    el.innerHTML = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'k-ch';
      s.style.transitionDelay = (i * 22) + 'ms';
      s.innerHTML = ch === ' ' ? '&nbsp;' : esc(ch);
      el.appendChild(s);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('k-in')));
  }
  window.kineticTitle = kineticTitle;

  /* hero headline — word by word */
  (function () {
    const words = [
      ['Every', ''], ['105', 'g'], ['minutes,', ''], ['a', ''], ['woman', ''],
      ['in', ''], ['Ethiopia', 'g'], ['dies', ''], ['of', ''], ['a', ''],
      ['preventable', 's'], ['cancer.', 'g']
    ];
    const h = $('#heroH1');
    words.forEach(([w, c], i) => {
      const s = document.createElement('span');
      s.className = 'w' + (c ? ' ' + c : '');
      s.style.animationDelay = (i * 90 + 150) + 'ms';
      s.textContent = w + '\u00A0';
      if (c === 'g') s.classList.add('grad-text');
      if (c === 's') s.classList.add('strike');
      h.appendChild(s);
    });
  })();

  $$('.sec-head .k-title').forEach(t => { if (t.closest('#page-home')) kineticTitle(t); });

  /* ============ ticker (data-driven) ============ */
  (function () {
    const track = $('#tickerTrack');
    const html = D.tickerItems
      .map(([a, b, c]) => `<span class="tk"><b>${esc(a)}</b> ${esc(b)} <span class="sep">· ${esc(c)}</span></span>`)
      .join('<span class="tk sep">✦</span>');
    track.innerHTML = html + html;
  })();

  /* ============ death clock (from data.js) ============ */
  (function () {
    const minutes = (D.ethiopia && D.ethiopia.minutesPerDeath) || 105;
    let remaining = minutes * 60;
    function tick() {
      remaining--; if (remaining < 0) remaining = minutes * 60;
      const m = Math.floor(remaining / 60), s = remaining % 60;
      const str = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const a = $('#deathClock'), b = $('#deathClock2');
      if (a) a.textContent = str;
      if (b) b.textContent = str;
    }
    setInterval(tick, 1000); tick();
  })();

  /* ============ reveal on scroll ============ */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
  }), { threshold: .12 });
  function observeReveals(root) { root.querySelectorAll('.reveal:not(.in)').forEach(el => revealIO.observe(el)); }
  observeReveals(document);

  /* ============ count-up ============ */
  function countUp(el) {
    if (el._done) return; el._done = true;
    const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
    const dur = 1500, t0 = performance.now();
    (function f(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec }) + suf;
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  const cntIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { countUp(e.target); cntIO.unobserve(e.target); }
  }), { threshold: .4 });
  function animateCounters(root) { root.querySelectorAll('[data-count]').forEach(el => cntIO.observe(el)); }
  animateCounters(document);

  /* ============ 90-70-90 progress bars ============ */
  function animateBars(root) {
    root.querySelectorAll('[data-w]').forEach(el => {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { el.style.width = el.dataset.w + '%'; io.disconnect(); }
      }), { threshold: .3 });
      io.observe(el);
    });
  }
  animateBars(document);

  /* ============ mini SVG donuts ============ */
  function animateDonuts(root) {
    root.querySelectorAll('.donut .val[data-pct]').forEach(c => {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) {
          c.style.strokeDashoffset = 339.29 * (1 - (+c.dataset.pct) / 100);
          io.disconnect();
        }
      }), { threshold: .3 });
      io.observe(c);
    });
  }
  animateDonuts(document);

  /* ============ daily "verified" sync stamp ============ */
  (function () {
    const d = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    $('#syncTime').textContent = d;
  })();

  /* ============ v2: data binder + footer links ============ */
  document.querySelectorAll('[data-bind]').forEach(el => {
    let v = D;
    el.dataset.bind.split('.').forEach(k => { if (v != null) v = v[k]; });
    if (v != null) el.textContent = v;
  });
  [['#lnkGithub', 'github'], ['#lnkHf', 'huggingface'],
   ['#lnkKaggle', 'kaggle'], ['#lnkLinkedin', 'linkedin']].forEach(([sel, key]) => {
    const el = $(sel), url = D.site && D.site[key];
    if (el && url) { el.href = url; el.hidden = false; }
  });

  /* ============ deep link (#data, #news, …) ============ */
  const hash = (location.hash || '').replace('#', '');
  if (hash && $('#page-' + hash)) go(hash);
})();