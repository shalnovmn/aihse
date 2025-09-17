(() => {
  const HF_ENDPOINT = "https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english";

  const els = {
    token: document.getElementById("tokenInput"),
    btn: document.getElementById("analyzeBtn"),
    review: document.getElementById("reviewText"),
    sentimentBox: document.getElementById("sentimentBox"),
    sentimentLabel: document.getElementById("sentimentLabel"),
    sentimentScore: document.getElementById("sentimentScore"),
    loadStatus: document.getElementById("loadStatus"),
    reviewCount: document.getElementById("reviewCount"),
  };

  let reviews = [];

  function setStatusLoading(isLoading, message) {
    els.loadStatus.classList.remove("hidden");
    els.loadStatus.querySelector("span").textContent = message || (isLoading ? "Loading reviews…" : "Ready");
  }

  function setSentimentUI(kind, label, score) {
    els.sentimentBox.classList.remove("positive","negative","neutral");
    els.sentimentBox.classList.add(kind);

    const iconEl = els.sentimentBox.querySelector(".icon");
    iconEl.innerHTML = kind === "positive"
      ? '<i class="fa-solid fa-thumbs-up"></i>'
      : kind === "negative"
      ? '<i class="fa-solid fa-thumbs-down"></i>'
      : '<i class="fa-solid fa-circle-question"></i>';

    els.sentimentLabel.textContent = label ?? "Neutral";
    els.sentimentScore.textContent = typeof score === "number" ? `(${score.toFixed(3)})` : "(—)";
  }

  function pickRandomReview() {
    if (!reviews.length) return null;
    let text = "";
    // Avoid empty strings
    for (let guard = 0; guard < 20 && !text; guard++) {
      const idx = Math.floor(Math.random() * reviews.length);
      text = (reviews[idx] || "").toString().trim();
    }
    return text || null;
  }

  async function analyze(text) {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    const token = els.token.value.trim();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text }),
    });

    // Graceful handling of model spin-up or rate limits
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const problem = await res.json();
        if (problem && (problem.error || problem.message)) {
          errMsg += `: ${problem.error || problem.message}`;
        }
      } catch (_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    // Expected format: [[{ label: 'POSITIVE', score: number }, { label: 'NEGATIVE', score: number }]]
    // Per requirement: parse API response [[{label:'POSITIVE', score:number}]]
    // We'll defensively read first item of first array; if array-of-objects provided, take first element.
    let first;
    if (Array.isArray(data) && data.length > 0) {
      first = Array.isArray(data[0]) ? data[0][0] : data[0];
    }
    const label = first?.label || "NEUTRAL";
    const score = typeof first?.score === "number" ? first.score : null;

    // Decision rule:
    // If score > 0.5 and label 'POSITIVE' → positive;
    // 'NEGATIVE' → negative;
    // else neutral.
    if (label.toUpperCase() === "POSITIVE" && score !== null && score > 0.5) {
      setSentimentUI("positive", "Positive", score);
    } else if (label.toUpperCase() === "NEGATIVE") {
      setSentimentUI("negative", "Negative", score);
    } else {
      setSentimentUI("neutral", "Neutral", score);
    }
  }

  function enableUI() {
    els.btn.disabled = false;
    setStatusLoading(false, "Ready");
    setTimeout(() => els.loadStatus.classList.add("hidden"), 1000);
  }

  function showErrorCard(message) {
    els.review.textContent = message;
    els.review.classList.remove("muted");
    setSentimentUI("neutral", "Neutral", null);
  }

  function initialize() {
    setStatusLoading(true, "Loading reviews…");
    fetch("./reviews_test.tsv", { cache: "no-store" })
      .then(resp => {
        if (!resp.ok) throw new Error(`Failed to load reviews_test.tsv (HTTP ${resp.status})`);
        return resp.text();
      })
      .then(text => {
        return new Promise((resolve, reject) => {
          Papa.parse(text, {
            header: true,
            delimiter: "\t",
            skipEmptyLines: true,
            complete: results => resolve(results),
            error: err => reject(err),
          });
        });
      })
      .then(results => {
        const rows = results?.data || [];
        reviews = rows
          .map(r => (r && typeof r.text !== "undefined" ? r.text : ""))
          .filter(v => v && String(v).trim().length > 0);

        if (!reviews.length) {
          throw new Error("No reviews found. Ensure TSV has a 'text' column.");
        }

        els.reviewCount.textContent = `${reviews.length.toLocaleString()} reviews loaded`;
        enableUI();
      })
      .catch(err => {
        setStatusLoading(false, "Error");
        showErrorCard(`Error loading TSV: ${err.message}`);
      });

    els.btn.addEventListener("click", async () => {
      const sample = pickRandomReview();
      if (!sample) {
        showErrorCard("No valid review found. Please check your TSV.");
        return;
      }

      els.review.textContent = sample;
      els.review.classList.remove("muted");
      setSentimentUI("neutral", "Analyzing…", null);
      els.btn.disabled = true;

      try {
        await analyze(sample);
      } catch (e) {
        setSentimentUI("neutral", "Neutral", null);
        showErrorCard(`Analysis error: ${e.message}. You may retry, add a token, or wait if rate-limited.`);
      } finally {
        els.btn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
