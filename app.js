(() => {
  // Hugging Face Inference API endpoint for the sentiment model.
  const HF_ENDPOINT = "https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english";

  // Cache references to all necessary DOM elements for quick access.
  const els = {
    token: document.getElementById("tokenInput"),          // Optional HF API token input
    btn: document.getElementById("analyzeBtn"),            // "Analyze" button
    review: document.getElementById("reviewText"),         // Area to display the sampled review text
    sentimentBox: document.getElementById("sentimentBox"), // Container that changes style based on sentiment
    sentimentLabel: document.getElementById("sentimentLabel"), // Text label for sentiment (Positive/Negative/Neutral)
    sentimentScore: document.getElementById("sentimentScore"), // Numeric score display
    loadStatus: document.getElementById("loadStatus"),     // Status chip (loading/ready/error)
    reviewCount: document.getElementById("reviewCount"),   // Shows number of loaded reviews
  };

  // Will hold the parsed review texts from the TSV file.
  let reviews = [];

  /**
   * Show a loading/ready message in the status chip.
   * @param {boolean} isLoading - Whether we are loading something.
   * @param {string} [message] - Optional custom message.
   */
  function setStatusLoading(isLoading, message) {
    els.loadStatus.classList.remove("hidden");
    els.loadStatus.querySelector("span").textContent = message || (isLoading ? "Loading reviews…" : "Ready");
  }

  /**
   * Update the sentiment UI box:
   * - apply the correct CSS class (positive/negative/neutral)
   * - set an icon
   * - update label and score
   * @param {"positive"|"negative"|"neutral"} kind
   * @param {string} label
   * @param {number|null} score
   */
  function setSentimentUI(kind, label, score) {
    // Reset any previous sentiment classes, then apply the new one.
    els.sentimentBox.classList.remove("positive","negative","neutral");
    els.sentimentBox.classList.add(kind);

    // Swap the icon according to the sentiment kind.
    const iconEl = els.sentimentBox.querySelector(".icon");
    iconEl.innerHTML = kind === "positive"
      ? '<i class="fa-solid fa-thumbs-up"></i>'
      : kind === "negative"
      ? '<i class="fa-solid fa-thumbs-down"></i>'
      : '<i class="fa-solid fa-circle-question"></i>';

    // Set label and score (score shown to 3 decimals if provided).
    els.sentimentLabel.textContent = label ?? "Neutral";
    els.sentimentScore.textContent = typeof score === "number" ? `(${score.toFixed(3)})` : "(—)";
  }

  /**
   * Pick a random non-empty review from the loaded list.
   * Uses a small guard loop to avoid empty/invalid rows.
   * @returns {string|null}
   */
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

  /**
   * Call Hugging Face Inference API to analyze the sentiment of the given text.
   * Parses a few possible response shapes defensively and updates the UI.
   * Throws on HTTP errors (including model warm-up or rate limit responses).
   * @param {string} text
   */
  async function analyze(text) {
    // Prepare headers; include Authorization if user provided a token.
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    const token = els.token.value.trim();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Send the inference request.
    const res = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text }),
    });

    // Graceful handling of model spin-up or rate limits
    if (!res.ok) {
      // Try to surface any message returned by the API to help the user.
      let errMsg = `HTTP ${res.status}`;
      try {
        const problem = await res.json();
        if (problem && (problem.error || problem.message)) {
          errMsg += `: ${problem.error || problem.message}`;
        }
      } catch (_) {}
      throw new Error(errMsg);
    }

    // Parse the response body.
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

    // Simple decision rule to map model output to UI state.
    // If label is POSITIVE and score is high enough → "positive",
    // if label is NEGATIVE → "negative",
    // otherwise → "neutral".
    if (label.toUpperCase() === "POSITIVE" && score !== null && score > 0.5) {
      setSentimentUI("positive", "Positive", score);
    } else if (label.toUpperCase() === "NEGATIVE") {
      setSentimentUI("negative", "Negative", score);
    } else {
      setSentimentUI("neutral", "Neutral", score);
    }
  }

  /**
   * Enable the main UI after reviews are loaded.
   * Shows "Ready" briefly and then hides the status chip.
   */
  function enableUI() {
    els.btn.disabled = false;
    setStatusLoading(false, "Ready");
    setTimeout(() => els.loadStatus.classList.add("hidden"), 1000);
  }

  /**
   * Display an error message in the review area and reset sentiment to neutral.
   * @param {string} message
   */
  function showErrorCard(message) {
    els.review.textContent = message;
    els.review.classList.remove("muted");
    setSentimentUI("neutral", "Neutral", null);
  }

  /**
   * Initialize the app:
   * - load and parse the TSV file with Papa Parse
   * - extract non-empty review texts
   * - wire up the Analyze button click handler
   */
  function initialize() {
    setStatusLoading(true, "Loading reviews…");
    // Fetch the TSV file without caching to ease iteration during development.
    fetch("./reviews_test.tsv", { cache: "no-store" })
      .then(resp => {
        if (!resp.ok) throw new Error(`Failed to load reviews_test.tsv (HTTP ${resp.status})`);
        return resp.text();
      })
      .then(text => {
        // Use Papa Parse to parse TSV (tab-delimited, header row expected).
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
        // Extract the "text" column and filter out empty rows.
        const rows = results?.data || [];
        reviews = rows
          .map(r => (r && typeof r.text !== "undefined" ? r.text : ""))
          .filter(v => v && String(v).trim().length > 0);

        if (!reviews.length) {
          throw new Error("No reviews found. Ensure TSV has a 'text' column.");
        }

        // Display how many reviews were loaded and enable the UI.
        els.reviewCount.textContent = `${reviews.length.toLocaleString()} reviews loaded`;
        enableUI();
      })
      .catch(err => {
        // Surface TSV loading/parsing errors to the user.
        setStatusLoading(false, "Error");
        showErrorCard(`Error loading TSV: ${err.message}`);
      });

    // When the user clicks Analyze:
    // - pick a random review
    // - show it
    // - call the HF API
    // - update the sentiment UI accordingly
    els.btn.addEventListener("click", async () => {
      const sample = pickRandomReview();
      if (!sample) {
        showErrorCard("No valid review found. Please check your TSV.");
        return;
      }

      // Show the sampled review and set a temporary "Analyzing…" state.
      els.review.textContent = sample;
      els.review.classList.remove("muted");
      setSentimentUI("neutral", "Analyzing…", null);
      els.btn.disabled = true;

      try {
        await analyze(sample);
      } catch (e) {
        // Handle API errors (e.g., rate limits, warm-up delays, invalid token).
        setSentimentUI("neutral", "Neutral", null);
        showErrorCard(`Analysis error: ${e.message}. You may retry, add a token, or wait if rate-limited.`);
      } finally {
        // Re-enable the button regardless of success/failure.
        els.btn.disabled = false;
      }
    });
  }

  // Start the app after the DOM is fully loaded.
  document.addEventListener("DOMContentLoaded", initialize);
})();
