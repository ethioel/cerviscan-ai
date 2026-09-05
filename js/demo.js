/* ============================================================
   CERVISCAN AI · INFERENCE ENGINE v2
   Single + Batch in-browser inference (onnxruntime-web, WASM)
   ============================================================ */
(function () {
  const { $, esc } = window.CERVI.util;
  const M = window.CERVI.model;
  let session = null, inputName = null, ready = false, loading = false;
  let mode = 'single';

  /* ---------- script loader ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  /* ---------- model loading (with fallback) ---------- */
  async function createSession(url) {
    const resp = await fetch(url, { cache: 'force-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const total = +resp.headers.get('Content-Length') || 0;
    const reader = resp.body.getReader(), chunks = []; let got = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (total) {
        const p = Math.round(got / total * 100);
        $('#mlPct').textContent = p + '%';
        $('#mlBar').style.width = p + '%';
      }
    }
    const buf = await new Blob(chunks).arrayBuffer();
    return ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
  }

  async function loadModel() {
    if (ready || loading) return; loading = true;
    const st = $('#mlStatus');
    try {
      st.textContent = 'Loading runtime…';
      if (!window.ort) await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.js');
      ort.env.wasm.numThreads = 1;   /* GitHub Pages has no COOP/COEP */

      st.textContent = 'Downloading model…';
      try { session = await createSession(M.url); }
      catch (e) {
        console.warn('primary model failed → fp32 fallback', e);
        $('#mlPct').textContent = '…';
        session = await createSession(M.fallbackUrl);
      }
      inputName = session.inputNames[0];
      st.textContent = '✅ Model ready — drop cell images below';
      $('#mlPct').textContent = 'OK'; $('#mlBar').style.width = '100%';
      ready = true;
    } catch (err) {
      console.error(err);
      st.textContent = '⚠️ Load failed — check connection / model URL';
    }
    loading = false;
  }

  /* ---------- preprocess (mirrors val_tf exactly) ---------- */
  function preprocess(img) {
    const n = M.inputSize * M.inputSize;
    const c = Object.assign(document.createElement('canvas'),
                            { width: M.inputSize, height: M.inputSize });
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, M.inputSize, M.inputSize);
    const px = ctx.getImageData(0, 0, M.inputSize, M.inputSize).data;
    const data = new Float32Array(3 * n);
    for (let i = 0; i < n; i++)
      for (let ch = 0; ch < 3; ch++)
        data[ch * n + i] = (px[i * 4 + ch] / 255 - M.mean[ch]) / M.std[ch];
    return new ort.Tensor('float32', data, [1, 3, M.inputSize, M.inputSize]);
  }

  async function infer(img) {
    const out = await session.run({ [inputName]: preprocess(img) });
    const logits = out[session.outputNames[0]].data;
    const ex = [...logits].map(Math.exp), s = ex.reduce((a, b) => a + b, 0);
    return M.classes.map((name, i) => ({ name, p: ex[i] / s })).sort((a, b) => b.p - a.p);
  }

  /* ---------- deployment policy (the triage ladder) ---------- */
  function verdict(probs) {
    const top = probs[0];
    const cat = M.categories[top.name] || 'Abnormal';
    const normal = M.normalClasses.includes(top.name);
    const gatePass = top.p >= M.gate;
    const action = !gatePass ? 'Human review'
                 : normal    ? 'Auto-clear'
                 :             'Refer · abnormal';
    return { pred: top.name, conf: top.p, cat, gatePass, action };
  }

  const catChip = c =>
    c === 'Normal'      ? '<span class="chip ok">Normal</span>' :
    c === 'HPV-related' ? '<span class="chip warn">HPV-related</span>' :
                          '<span class="chip bad">Abnormal</span>';

  /* ---------- SINGLE mode ---------- */
  async function classifySingle(file) {
    if (!ready) await loadModel(); if (!ready) return;
    const img = new Image();
    img.src = URL.createObjectURL(file); await img.decode();
    $('#previewWrap').hidden = false;
    $('#previewImg').src = img.src;

    const probs = await infer(img);
    const v = verdict(probs);

    $('#resultBig').textContent = v.pred;
    $('#gateBadge').innerHTML = v.gatePass
      ? `<span class="gate-badge gate-ok">✓ HIGH CONFIDENCE · ${(v.conf*100).toFixed(1)}%</span>`
      : `<span class="gate-badge gate-warn">⚠ LOW CONFIDENCE · routed to human review</span>`;
    $('#actionBadge').innerHTML =
      `<span class="gate-badge ${v.action === 'Auto-clear' ? 'gate-ok' : 'gate-warn'}">→ ${esc(v.action)}</span>`;
    $('#probList').innerHTML = probs.map((r, i) => `
      <div class="prob-row ${i === 0 ? 'top' : ''}">
        <span class="pn">${esc(r.name)}</span>
        <span class="prob-bar"><i style="width:${(r.p*100).toFixed(1)}%"></i></span>
        <span class="pv">${(r.p*100).toFixed(1)}%</span>
      </div>`).join('');
    URL.revokeObjectURL(img.src);
  }

  /* ---------- BATCH mode ---------- */
  const batch = [];

  function addFiles(files) {
    [...files].filter(f => f.type.startsWith('image/')).forEach(f => batch.push({ file: f }));
    renderQueue();
  }

  function renderQueue() {
    $('#batchCount').textContent = batch.length;
    $('#batchList').innerHTML = batch.map((b, i) => `
      <div class="bq-row">
        <span class="bq-num mono">${String(i + 1).padStart(2, '0')}</span>
        <span class="bq-name" title="${esc(b.file.name)}">${esc(b.file.name)}</span>
        <span class="bq-status" id="bq-st-${i}">${b.done ? '✅' : '⏳'}</span>
      </div>`).join('');
  }

  async function processBatch() {
    if (!batch.length) return;
    if (!ready) await loadModel(); if (!ready) return;
    const btn = $('#processBtn'); btn.disabled = true;
    for (let i = 0; i < batch.length; i++) {
      const st = $('#bq-st-' + i); if (!st) continue;
      st.textContent = '🧠';
      const img = new Image();
      img.src = URL.createObjectURL(batch[i].file); await img.decode();
      const probs = await infer(img); URL.revokeObjectURL(img.src);
      Object.assign(batch[i], verdict(probs), { probs, done: true });
      st.textContent = '✅';
      renderResults();
    }
    btn.disabled = false;
  }

  function renderResults() {
    const rows = batch.filter(b => b.done);
    $('#sumTotal').textContent    = rows.length;
    $('#sumNormal').textContent   = rows.filter(r => r.cat === 'Normal').length;
    $('#sumAbnormal').textContent = rows.filter(r => r.cat !== 'Normal').length;
    $('#sumReview').textContent   = rows.filter(r => !r.gatePass).length;
    $('#batchTableWrap').hidden = !rows.length;
    $('#exportBar').hidden      = !rows.length;
    $('#batchTable tbody').innerHTML = rows.map((r, i) => `
      <tr>
        <td class="mono">${String(i + 1).padStart(2, '0')}</td>
        <td title="${esc(r.file.name)}">${esc(r.file.name.length > 22 ? r.file.name.slice(0, 20) + '…' : r.file.name)}</td>
        <td><b>${esc(r.pred)}</b></td>
        <td><div class="prob-bar"><i style="width:${(r.conf*100).toFixed(1)}%"></i></div></td>
        <td class="mono">${(r.conf*100).toFixed(1)}%</td>
        <td>${catChip(r.cat)}</td>
        <td>${r.gatePass ? '<span class="chip ok">pass</span>' : '<span class="chip warn">review</span>'}</td>
        <td>${esc(r.action)}</td>
      </tr>`).join('');
  }

  /* ---------- export ---------- */
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const q = v => `"${String(v).replace(/"/g, '""')}"`;

  function exportCSV() {
    const head = ['file','prediction','confidence_pct','category','confidence_gate','action', ...M.classes];
    const lines = batch.filter(b => b.done).map(b => [
      b.file.name, b.pred, (b.conf*100).toFixed(1), b.cat,
      b.gatePass ? 'pass' : 'review', b.action,
      ...M.classes.map(c => b.probs.find(p => p.name === c).p.toFixed(4))
    ]);
    download(`cerviscan_results_${stamp()}.csv`,
      [head, ...lines].map(r => r.map(q).join(',')).join('\n'), 'text/csv');
  }

  function exportJSON() {
    const done = batch.filter(b => b.done);
    download(`cerviscan_results_${stamp()}.json`, JSON.stringify({
      model: M.arch, generated: new Date().toISOString(), gate: M.gate,
      summary: {
        total: done.length,
        normal: done.filter(r => r.cat === 'Normal').length,
        abnormal: done.filter(r => r.cat !== 'Normal').length,
        lowConfidence: done.filter(r => !r.gatePass).length
      },
      results: done.map(({ file, pred, conf, cat, gatePass, action, probs }) => ({
        file: file.name, prediction: pred, confidence: +(conf*100).toFixed(1),
        category: cat, gate: gatePass ? 'pass' : 'review', action,
        probabilities: Object.fromEntries(probs.map(p => [p.name, +p.p.toFixed(4)]))
      }))
    }, null, 2), 'application/json');
  }

  /* ---------- mode toggle ---------- */
  function setMode(m) {
    mode = m;
    $('#modeSingle').classList.toggle('on', m === 'single');
    $('#modeBatch').classList.toggle('on', m === 'batch');
    $('#singlePane').hidden = m !== 'single';
    $('#batchPane').hidden  = m !== 'batch';
    $('#dzTitle').textContent = m === 'single' ? 'Drop a cell image here' : 'Drop cell images here (batch)';
  }

  /* ---------- wiring ---------- */
  document.addEventListener('cervi:page', e => { if (e.detail.id === 'demo') loadModel(); });

  const dz = $('#dropzone'), inp = $('#cellFile');
  if (!dz) return;
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    const fs = e.dataTransfer.files; if (!fs.length) return;
    mode === 'single' ? classifySingle(fs[0]) : addFiles(fs);
  });
  inp.addEventListener('change', () => {
    if (!inp.files.length) return;
    mode === 'single' ? classifySingle(inp.files[0]) : addFiles(inp.files);
    inp.value = '';
  });

  /* paste support — Ctrl+V a screenshot or copied image */
  document.addEventListener('paste', e => {
    if (!$('#page-demo').classList.contains('active')) return;
    const f = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))?.getAsFile();
    if (f) mode === 'single' ? classifySingle(f) : addFiles([f]);
  });

  $('#modeSingle').addEventListener('click', () => setMode('single'));
  $('#modeBatch').addEventListener('click', () => setMode('batch'));
  $('#processBtn').addEventListener('click', processBatch);
  $('#clearBatch').addEventListener('click', () => { batch.length = 0; renderQueue(); renderResults(); });
  $('#csvBtn').addEventListener('click', exportCSV);
  $('#jsonBtn').addEventListener('click', exportJSON);
})();