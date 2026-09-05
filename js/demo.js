/* ============================================================
   CERVISCAN AI · INFERENCE ENGINE v2
   Single + Batch in-browser inference with image validation:
   · Layer 1 (pre-flight): type/dimension/aspect/color-statistics
   · Layer 2 (post-inference): model-confidence floor (entropy gate)
   Non-cytology images are rejected with a reason and excluded
   from triage statistics. Exports include a rejection audit.
   ============================================================ */
(function () {
  const { $, esc, toast } = window.CERVI.util;
  const M = window.CERVI.model;
  const A = M.accept || { minDim: 64, maxDim: 6000, maxMB: 15, minTopProb: 0.40 };
  let session = null, inputName = null, ready = false, loading = false;
  let mode = 'single';

  /* ---------- helpers ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const decodeImage = file => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('decode failed'));
    img.src = URL.createObjectURL(file);
  });

  /* ---------- model loading (fp16 → fp32 fallback) ---------- */
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
      ort.env.wasm.numThreads = 1;
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

  /* ---------- preprocessing (mirrors training val_tf) ---------- */
  function preprocess(img) {
    const n = M.inputSize * M.inputSize;
    const c = Object.assign(document.createElement('canvas'),
                            { width: M.inputSize, height: M.inputSize });
    c.getContext('2d').drawImage(img, 0, 0, M.inputSize, M.inputSize);
    const px = c.getContext('2d').getImageData(0, 0, M.inputSize, M.inputSize).data;
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

  /* ============================================================
     LAYER 1 · PRE-FLIGHT VALIDATION
     Stained cytology = bright field + pink/purple/red hues.
     Reject: dark photos, green/blue-dominant scenes, wrong dims.
     ============================================================ */
  function colorStats(img) {
    const s = 64;
    const c = Object.assign(document.createElement('canvas'), { width: s, height: s });
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, s, s);
    const d = ctx.getImageData(0, 0, s, s).data;
    let lum = 0, cool = 0, px = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      lum += .299 * r + .587 * g + .114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), delta = mx - mn;
      let h = 0;
      if (delta > 12) { /* only count chromatic pixels */
        if (mx === r) h = ((g - b) / delta) % 6;
        else if (mx === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = Math.round(h * 60); if (h < 0) h += 360;
        if (h >= 70 && h <= 200) cool++;   /* green→blue band: nature/sky */
      }
      px++;
    }
    return { meanLum: lum / px, coolFrac: cool / px };
  }

  function validateImage(file, img) {
    const okType = /^image\/(png|jpe?g|webp|bmp)$/i.test(file.type);
    if (!okType)            return { ok: false, reason: `unsupported file type (${file.type || 'unknown'})` };
    if (file.size > A.maxMB * 1048576)
                            return { ok: false, reason: `file exceeds ${A.maxMB} MB` };
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w < A.minDim || h < A.minDim)
                            return { ok: false, reason: `image too small (${w}×${h} — min ${A.minDim}px)` };
    if (w > A.maxDim || h > A.maxDim)
                            return { ok: false, reason: `image too large (${w}×${h} — max ${A.maxDim}px)` };
    const ar = w / h;
    if (ar > 4 || ar < 0.25)
                            return { ok: false, reason: 'extreme aspect ratio — not a cell crop' };
    const cs = colorStats(img);
    if (cs.meanLum < 50)    return { ok: false, reason: 'too dark — stained slides are bright-field' };
    if (cs.coolFrac > 0.55) return { ok: false, reason: 'green/blue-dominant — not cytology staining' };
    return { ok: true };
  }

  /* ============================================================
     LAYER 2 · VERDICT + ENTROPY GATE
     ============================================================ */
  function verdict(probs) {
    const top = probs[0];
    if (top.p < A.minTopProb)
      return { pred: top.name, conf: top.p, cat: 'Unknown', gatePass: false,
               action: 'Rejected — model uncertain (not a cell?)' };
    const normal = M.normalClasses.includes(top.name);
    return {
      pred: top.name, conf: top.p,
      cat: M.categories[top.name] || 'Abnormal',
      gatePass: top.p >= M.gate,
      action: !gatePassSafe(top.p, M.gate) ? 'Human review'
            : normal ? 'Auto-clear' : 'Refer · abnormal'
    };
  }
  const gatePassSafe = (p, g) => p >= g;

  const catChip = c =>
    c === 'Normal'      ? '<span class="chip ok">Normal</span>' :
    c === 'HPV-related' ? '<span class="chip warn">HPV-related</span>' :
    c === 'Unknown'     ? '<span class="chip warn">unrecognized</span>' :
                          '<span class="chip bad">Abnormal</span>';

  /* ---------- SINGLE mode ---------- */
  async function classifySingle(file) {
    if (!ready) await loadModel(); if (!ready) return;
    let img;
    try { img = await decodeImage(file); }
    catch { toast('Could not read that image'); return; }
    $('#previewWrap').hidden = false;
    $('#previewImg').src = img.src;

    const v = validateImage(file, img);
    if (!v.ok) {
      $('#resultBig').textContent = 'Rejected';
      $('#gateBadge').innerHTML = `<span class="gate-badge gate-warn">⛔ NOT A CYTOLOGY IMAGE</span>`;
      $('#actionBadge').innerHTML = `<span class="gate-badge gate-warn">→ ${esc(v.reason)}</span>`;
      $('#probList').innerHTML = '';
      toast('Rejected: ' + v.reason);
      return;
    }

    const probs = await infer(img);
    const r = verdict(probs);
    if (r.cat === 'Unknown') {
      $('#resultBig').textContent = 'Not a cell';
      $('#gateBadge').innerHTML = `<span class="gate-badge gate-warn">⛔ UNRECOGNIZED (top confidence ${(r.conf*100).toFixed(1)}% < ${Math.round(A.minTopProb*100)}%)</span>`;
      $('#actionBadge').innerHTML = `<span class="gate-badge gate-warn">→ not a Pap smear cell — nothing triaged</span>`;
      $('#probList').innerHTML = probs.map(p => `
        <div class="prob-row"><span class="pn">${esc(p.name)}</span>
        <span class="prob-bar"><i style="width:${(p.p*100).toFixed(1)}%"></i></span>
        <span class="pv">${(p.p*100).toFixed(1)}%</span></div>`).join('');
      return;
    }

    $('#resultBig').textContent = r.pred;
    $('#gateBadge').innerHTML = r.gatePass
      ? `<span class="gate-badge gate-ok">✓ HIGH CONFIDENCE · ${(r.conf*100).toFixed(1)}%</span>`
      : `<span class="gate-badge gate-warn">⚠ LOW CONFIDENCE · human review</span>`;
    $('#actionBadge').innerHTML =
      `<span class="gate-badge ${r.action === 'Auto-clear' ? 'gate-ok' : 'gate-warn'}">→ ${esc(r.action)}</span>`;
    $('#probList').innerHTML = probs.map((p, i) => `
      <div class="prob-row ${i === 0 ? 'top' : ''}">
        <span class="pn">${esc(p.name)}</span>
        <span class="prob-bar"><i style="width:${(p.p*100).toFixed(1)}%"></i></span>
        <span class="pv">${(p.p*100).toFixed(1)}%</span></div>`).join('');
  }

  /* ---------- BATCH mode ---------- */
  const batch = [];

  async function addFiles(files) {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    for (const file of list) {
      const entry = { file, status: 'pending' };
      batch.push(entry);
      renderQueue();
      try {
        const img = await decodeImage(file);
        const v = validateImage(file, img);
        if (!v.ok) { entry.status = 'rejected'; entry.reason = v.reason; }
      } catch { entry.status = 'rejected'; entry.reason = 'unreadable image'; }
      renderQueue(); renderResults();
    }
  }

  function renderQueue() {
    $('#batchCount').textContent = batch.length;
    $('#batchList').innerHTML = batch.map((b, i) => {
      const st = b.status === 'done' ? '✅'
               : b.status === 'rejected' ? '⛔'
               : b.status === 'busy' ? '🧠' : '⏳';
      const title = b.reason ? ` title="${esc(b.reason)}"` : '';
      return `<div class="bq-row"${title}>
        <span class="bq-num mono">${String(i + 1).padStart(2, '0')}</span>
        <span class="bq-name">${esc(b.file.name)}${b.reason ? ` — <em>${esc(b.reason)}</em>` : ''}</span>
        <span class="bq-status">${st}</span></div>`;
    }).join('');
  }

  async function processBatch() {
    if (!batch.some(b => b.status === 'pending')) return;
    if (!ready) await loadModel(); if (!ready) return;
    const btn = $('#processBtn'); btn.disabled = true;
    for (const b of batch) {
      if (b.status !== 'pending') continue;
      b.status = 'busy'; renderQueue();
      const img = await decodeImage(b.file);
      const probs = await infer(img); URL.revokeObjectURL(img.src);
      Object.assign(b, verdict(probs), { probs, status: 'done' });
      renderQueue(); renderResults();
    }
    btn.disabled = false;
    const rej = batch.filter(b => b.status === 'rejected').length;
    if (rej) toast(`${rej} image${rej > 1 ? 's' : ''} rejected — not cytology`);
  }

  function renderResults() {
    const done = batch.filter(b => b.status === 'done');
    const rej  = batch.filter(b => b.status === 'rejected');
    $('#sumTotal').textContent    = done.length;
    $('#sumRejected').textContent = rej.length;
    $('#sumNormal').textContent   = done.filter(r => r.cat === 'Normal').length;
    $('#sumAbnormal').textContent = done.filter(r => r.cat !== 'Normal' && r.cat !== 'Unknown').length;
    $('#sumReview').textContent   = done.filter(r => !r.gatePass && r.cat !== 'Unknown').length;
    $('#batchTableWrap').hidden = !done.length;
    $('#exportBar').hidden      = !(done.length || rej.length);
    $('#batchTable tbody').innerHTML = [...done, ...rej].map((r, i) => r.status === 'rejected' ? `
      <tr><td class="mono">${String(i + 1).padStart(2, '0')}</td>
      <td title="${esc(r.file.name)}">${esc(r.file.name.length > 22 ? r.file.name.slice(0, 20) + '…' : r.file.name)}</td>
      <td><span class="chip warn">not cytology</span></td><td></td><td></td>
      <td>—</td><td><span class="chip bad">rejected</span></td>
      <td>${esc(r.reason || '')}</td></tr>` : `
      <tr><td class="mono">${String(i + 1).padStart(2, '0')}</td>
      <td title="${esc(r.file.name)}">${esc(r.file.name.length > 22 ? r.file.name.slice(0, 20) + '…' : r.file.name)}</td>
      <td><b>${esc(r.pred)}</b></td>
      <td><div class="prob-bar"><i style="width:${(r.conf*100).toFixed(1)}%"></i></div></td>
      <td class="mono">${(r.conf*100).toFixed(1)}%</td>
      <td>${catChip(r.cat)}</td>
      <td>${r.gatePass ? '<span class="chip ok">pass</span>' : '<span class="chip warn">review</span>'}</td>
      <td>${esc(r.action)}</td></tr>`).join('');
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
    const rows = batch.filter(b => b.status === 'done').map(b => [
      b.file.name, b.pred, (b.conf*100).toFixed(1), b.cat,
      b.gatePass ? 'pass' : 'review', b.action,
      ...M.classes.map(c => b.probs.find(p => p.name === c).p.toFixed(4))
    ]);
    const rejRows = batch.filter(b => b.status === 'rejected').map(b => [
      b.file.name, 'NOT_CYTOLOGY', '', '', 'rejected', 'Rejected — ' + (b.reason || ''),
      ...M.classes.map(() => '')
    ]);
    download(`cerviscan_results_${stamp()}.csv`,
      [head, ...rows, ...rejRows].map(r => r.map(q).join(',')).join('\n'), 'text/csv');
  }

  function exportJSON() {
    const done = batch.filter(b => b.status === 'done');
    const rej  = batch.filter(b => b.status === 'rejected');
    download(`cerviscan_results_${stamp()}.json`, JSON.stringify({
      model: M.arch, generated: new Date().toISOString(),
      gate: M.gate, minTopProb: A.minTopProb,
      summary: {
        analyzed: done.length,
        normal: done.filter(r => r.cat === 'Normal').length,
        abnormal: done.filter(r => r.cat !== 'Normal' && r.cat !== 'Unknown').length,
        lowConfidence: done.filter(r => !r.gatePass && r.cat !== 'Unknown').length,
        rejected: rej.length
      },
      results: done.map(({ file, pred, conf, cat, gatePass, action, probs }) => ({
        file: file.name, prediction: pred, confidence: +(conf*100).toFixed(1),
        category: cat, gate: gatePass ? 'pass' : 'review', action,
        probabilities: Object.fromEntries(probs.map(p => [p.name, +p.p.toFixed(4)]))
      })),
      rejected: rej.map(r => ({ file: r.file.name, reason: r.reason }))
    }, null, 2), 'application/json');
  }

  /* ---------- mode toggle + wiring ---------- */
  function setMode(m) {
    mode = m;
    $('#modeSingle').classList.toggle('on', m === 'single');
    $('#modeBatch').classList.toggle('on', m === 'batch');
    $('#singlePane').hidden = m !== 'single';
    $('#batchPane').hidden  = m !== 'batch';
    $('#dzTitle').textContent = m === 'single' ? 'Drop a cell image here' : 'Drop cell images here (batch)';
  }

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