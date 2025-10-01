# aihse
Role
You are an expert JavaScript developer who writes clean, minimal code for GitHub Pages. Follow every requirement exactly—no extra libraries, comments, or text.

Context
• Static site only (index.html + app.js)
• Data file: reviews_test.tsv (has a header row with a text column)
• Papa Parse via CDN must load & parse TSV
• One optional input field for Hugging Face API token
• Use ONE free model endpoint: [https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct](https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct) — task=text-generation (request body { "inputs": PROMPT })
• All logic in vanilla JS (fetch, async/await). No server-side code.

UI
• Controls: Token input, three buttons, result card, error div, spinner
• Buttons:
– Select Random Review → show random review text from TSV
– Analyze Sentiment → POST to Falcon with the sentiment prompt below
– Count Nouns → POST to Falcon with the noun-count prompt below; display raw count and level
• Display rules:
– Sentiment icon: positive → 👍, negative → 👎, neutral/unknown → ❓
– Noun level icon: High → 🟢, Medium → 🟡, Low → 🔴
– Always show latest review text, sentiment, noun count, and level together in a compact card

Business Logic (must implement exactly)
Data loading

1. Fetch reviews_test.tsv once on load. Parse with Papa Parse (header:true).
2. Validate presence of a non-empty text column; if missing or empty after parsing, show a blocking error “TSV missing ‘text’ column or no rows.”
3. Store an in-memory array reviews = rows.filter(r => r.text && r.text.trim().length > 0). Map each to { id:index, text:String(r.text).trim() }.

Random selection
4) On “Select Random Review,” pick a uniform random review; store currentId. Render its text immediately.

API plumbing
5) Shared function callApi(prompt) uses fetch POST to the Falcon endpoint with JSON { inputs: prompt }.
6) Include Authorization: Bearer <token> only when token input is non-empty; otherwise omit the header.
7) While awaiting the response: show spinner, disable all buttons and token input. Always re-enable on settle.

Rate limits & errors
8) If status is 402 or 429, show user-facing message: “Model is unavailable or rate limited. Try again later or add a valid Hugging Face token.”
9) For 5xx or network errors, retry with exponential backoff up to 2 times (≈800ms, then ≈1600ms). After final failure, fall back to local heuristics (see below).
10) If the response body is not valid JSON or missing generated_text, treat as failure and use fallbacks.

Prompts sent to Falcon (must be exact strings)
11) Sentiment prompt (build with the current review text inserted where {TEXT} appears):
"Classify the following product review as one of: positive, negative, neutral. Reply with EXACTLY one word in lowercase: positive|negative|neutral. Do not add punctuation or extra text. Review:\n{TEXT}"
12) Noun-count prompt (English text assumed; if language differs, still count common nouns):
"Read the review and count how many common nouns it contains (singular or plural). Reply with ONLY the integer number, no words, no punctuation. If unsure, give your best estimate. Review:\n{TEXT}"

Parsing model output
13) For sentiment: take the first non-empty line of generated_text, toLowerCase(), trim. Accept only "positive" | "negative" | "neutral". Map to icons as above. If anything else, set sentiment = "neutral" (❓).
14) For noun count: from the first non-empty line, extract the first integer (base-10). If none found or integer < 0, mark as unknown and use fallback heuristic (see below).
15) Noun level banding (computed client-side from the final integer count):
– High: count > 15
– Medium: 6 ≤ count ≤ 15
– Low: count < 6

Fallback heuristics (used only when API fails or returns unusable output)
16) Sentiment fallback: simple lexicon scoring.
– positiveWords = ["good","great","excellent","love","amazing","awesome","perfect","nice","happy","recommend","refreshing","best","wonderful"]
– negativeWords = ["bad","poor","terrible","hate","awful","worst","disappoint","greasy","gross","broken","refund","slow","noisy"]
– Tokenize on non-letters, lowercase. score = (#positive) − (#negative).
– score > 0 → positive; score < 0 → negative; else neutral.
17) Noun count fallback (approximate):
– Lowercase, replace non-letters with space, split into tokens.
– stopwords = a compact English list (e.g., "a,an,the,of,in,on,for,to,with,at,from,by,is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,can,could,should,and,or,as,that,this,these,those,it,its,he,she,they,we,them,his,her,their,our,you,your,i,me,my,mine")
– verbEndings = ["ing","ed","’s","'s"]
– candidate = tokens where length≥2, not in stopwords, and not ending with any verbEndings.
– nounCount = candidate.length.
– Apply banding rules above.

Caching & UX
18) Response cache: keep a Map keyed by currentId and action ("sentiment" | "nouns"). If present, use cached result instead of calling the API again.
19) Prevent concurrent calls: while a request is in flight, ignore additional clicks.
20) Clear error div on successful render. Always hide spinner and re-enable controls after any operation.

Rendering rules
21) Result card shows:
– Sentiment: icon + word (e.g., 👍 positive)
– Nouns: raw integer + level icon + label (e.g., 18 🟢 High)
– The exact review text displayed in a read-only area
22) If review text is longer than 1200 chars, truncate in UI with “Show more/less” toggle (no external libs).
23) Accessibility: buttons have aria-busy when loading; spinner uses role="status".

Dependencies
24) index.html must link:
– Papa Parse 5.4.1 CDN
– Font Awesome 6.4 CDN (for spinner if desired)
– app.js (defer)

Output Format
• A single code block containing the full index.html.
• A single code block containing the full app.js.
• No prose, no explanations, no extra files.

