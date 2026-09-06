<div align="center">

# CerviScan AI

### AI-powered cervical cancer screening intelligence for Ethiopia & Africa

> *Every 105 minutes, a woman in Ethiopia dies of a cancer that is almost entirely preventable.*
*We built this because waiting for a pathologist shouldn't be part of the diagnosis.*

<br>

[![🚀 Visit Live Site](https://img.shields.io/badge/VISIT_LIVE_SITE-ethioel.github.io-2dd4bf?style=for-the-badge&logo=googlechrome&logoColor=032420&labelColor=04060a)](https://ethioel.github.io/cerviscan-ai/)
[![🧪 Try the Demo](https://img.shields.io/badge/TRY_THE_DEMO-runs_in_your_browser-38bdf8?style=for-the-badge&labelColor=04060a)](https://ethioel.github.io/cerviscan-ai/#demo)

<br>

[![Model](https://img.shields.io/badge/🤗_Model_Weights-Hugging_Face-ffb000?style=flat-square&labelColor=04060a)](https://huggingface.co/ethioel/cerviscan-b0)
[![Notebook](https://img.shields.io/badge/📓_Training-Kaggle-20beff?style=flat-square&labelColor=04060a)](https://www.kaggle.com/ethioel)
[![Issues](https://img.shields.io/badge/🐞_Issues-Report-fb7185?style=flat-square&labelColor=04060a)](https://github.com/ethioel/cerviscan-ai/issues)

<br>

![Status](https://img.shields.io/badge/status-live-success?style=flat-square)
![Accuracy](https://img.shields.io/badge/accuracy-98.40%25-2dd4bf?style=flat-square)
![Triage](https://img.shields.io/badge/triage_acc-99.51%25-6ee7b7?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![PyTorch](https://img.shields.io/badge/PyTorch-EfficientNet--B0-ee4c2c?style=flat-square&logo=pytorch&logoColor=white)
![ONNX](https://img.shields.io/badge/inference-onnxruntime--web-005ced?style=flat-square)
![Privacy](https://img.shields.io/badge/privacy-100%25_on--device-9333ea?style=flat-square)

</div>

---

## What is this?

CerviScan AI is a cervical cancer screening intelligence platform — part **live data observatory**, part **working diagnostic model**. It tracks the epidemic through WHO and IARC data, reads Africa's news and research as it happens, and runs a trained Pap-smear classifier **entirely in your browser**.

> No servers. No uploads. No patient image ever leaves your device.

In Ethiopia, cervical cancer is the **second most common cancer in women**: ~**8,159 diagnosed** and ~**5,007 die** every year, 80%+ found at an advanced stage, fewer than **1 in 25** ever screened. Africa carries ~1/4 of global cases but ~1/3 of global deaths.

**We can't ship pathologists. But a 4.3M-parameter model that runs in a $50 phone's browser fits in a clinic tomorrow.**

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🩺 | **Live Demo** | Upload a Pap smear cell — or twenty in batch mode — and get a classification, confidence score, and triage action in milliseconds. Non-cytology images are automatically rejected. |
| 📤 | **Exports** | Batch results as CSV / JSON — file, prediction, confidence, gate status, action, and rejection audit. |
| 📊 | **Data Hub** | Curated WHO / IARC epidemiology: the human clock, the screening gap, the 90·70·90 elimination tracker — every figure linked to its primary source. |
And Many More..,

---

## 🎯 The model

EfficientNet-B0 (timm) + custom head · 4.3M params · trained on **[SIPaKMeD](https://www.kaggle.com/datasets/akshaykrishnan/sipakmed5)** (4,049 cells, 80/20 stratified split) · serving as fp16 ONNX, 8.3 MB.

| Metric | Value |
|:---|---:|
| **5-class accuracy** | `98.40%` · macro F1 `0.9840` |
| **Binary triage accuracy** | `99.51%` |
| **Abnormal sensitivity** (triage) | `99.38%` — 3 of 487 missed |
| **Normal specificity** | `99.69%` |
| **Best class** | Parabasal — `157/157` perfect |

> **The number we're most proud of isn't the accuracy.** At the decision that actually matters in a clinic — *normal vs. needs-a-human* — the system misses 3 in 487. And every prediction below **70% confidence is routed to mandatory human review**, by design. The workflow was built around the model's weaknesses, not just its strengths.

---

## 🛡️ Done the careful way

- ✅ **Export verified on the full validation set** — fp16 ONNX is numerically identical to the PyTorch model (max diff `1.3e-07`).
- 🗂 **The checkpoint describes itself** — class order, normalization stats, and image size are embedded. No tensor archaeology for the next person.
- 🔒 **Privacy is architectural, not a policy** — inference runs in WASM on the visitor's machine. There is no backend to trust, because there is no backend.
- ⛔ **Non-medical images are rejected, not guessed** — two-layer validation (image statistics + model-confidence floor).

---

## 🚀 Run it locally

```bash
git clone https://github.com/ethioel/cerviscan-ai.git
cd cerviscan-ai
python -m http.server 8000
```

> Then open **http://localhost:8000** — first demo visit downloads the 8.3 MB model from Hugging Face; after that it's browser-cached.

---

## 🔄 Retraining

The full pipeline — data ingest, augmentation, training, early stopping, Grad-CAM, verified ONNX export — lives in the Kaggle notebook. Edit the dataset a little bit, enable GPU, **Save & Run All**: reproducible end to end on free hardware.

[![Open In Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://www.kaggle.com/ethioel)

---
[![Hugging Face](https://img.shields.io/badge/HF-ethioel-FFD21E?style=flat-square)](https://huggingface.co/ethioel)
[![Kaggle](https://img.shields.io/badge/Kaggle-ethioel-20BEFF?style=flat-square&logo=kaggle&logoColor=white)](https://www.kaggle.com/ethioel)

- **Data sources:** WHO · IARC GLOBOCAN · ICO/IARC HPV Centre · WHO AFRO · FMOH Ethiopia · NCBI PubMed
- **Dataset:** [SIPaKMeD](https://www.kaggle.com/datasets/akshaykrishnan/sipakmed5) — with gratitude to its creators
- **Runtime:** [onnxruntime-web](https://onnxruntime.ai/) · [Chart.js](https://www.chartjs.org/)

---

## ⚠️ Disclaimer

This is a research prototype, **not a medical device**. The model was trained and validated on isolated cells from one public dataset — it has not seen whole slides, other scanners, or real clinical populations. Its confidence gate and not-a-cell rejection layer exist precisely because of that. Epidemiological figures are approximations from the cited primary sources; verify them there before citing them anywhere that matters.

*If this work speeds up one referral, or keeps one woman from being diagnosed late — that's the whole point.*

---

<div align="center">

**If this project helps you, a star helps it reach someone else.**

[![⭐ Star on GitHub](https://img.shields.io/badge/STAR-Click_Here-ffd700?style=for-the-badge&labelColor=04060a)](https://github.com/ethioel/cerviscan-ai/stargazers)

</div>
