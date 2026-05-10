// DOM要素
const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const gradeSelect = document.getElementById("grade");
const termSelect = document.getElementById("term");
const userInput = document.getElementById("userInput");
const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");
const outputArea = document.getElementById("outputArea");
const output = document.getElementById("output");
const modeIndicator = document.getElementById("modeIndicator");
const errorBox = document.getElementById("errorBox");

// localStorage キー
const LS = {
  apiKey: "shoken_api_key_google",
  model: "shoken_model_google",
  grade: "shoken_grade",
  term: "shoken_term"
};

// 旧バージョンからのデータ移行
function migrateLegacy() {
  const legacyKeys = ["shoken_api_key", "shoken_api_key_anthropic"];
  for (const k of legacyKeys) {
    const v = localStorage.getItem(k);
    if (v && v.startsWith("AIza") && !localStorage.getItem(LS.apiKey)) {
      localStorage.setItem(LS.apiKey, v);
    }
    if (v) localStorage.removeItem(k);
  }
  const oldModel = localStorage.getItem("shoken_model");
  if (oldModel && oldModel.startsWith("gemini") && !localStorage.getItem(LS.model)) {
    localStorage.setItem(LS.model, oldModel);
  }
  if (oldModel) localStorage.removeItem("shoken_model");
  localStorage.removeItem("shoken_provider");
  localStorage.removeItem("shoken_model_anthropic");
}

function loadSettings() {
  migrateLegacy();
  apiKeyInput.value = localStorage.getItem(LS.apiKey) || "";
  modelSelect.value = localStorage.getItem(LS.model) || "gemini-2.5-flash";
  gradeSelect.value = localStorage.getItem(LS.grade) || "5";
  termSelect.value = localStorage.getItem(LS.term) || "後期";
}

function saveSetting(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

apiKeyInput.addEventListener("change", () => saveSetting(LS.apiKey, apiKeyInput.value.trim()));
modelSelect.addEventListener("change", () => saveSetting(LS.model, modelSelect.value));
gradeSelect.addEventListener("change", () => saveSetting(LS.grade, gradeSelect.value));
termSelect.addEventListener("change", () => saveSetting(LS.term, termSelect.value));

function showError(msg) {
  errorBox.hidden = false;
  errorBox.textContent = msg;
}
function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

clearBtn.addEventListener("click", () => {
  userInput.value = "";
  outputArea.hidden = true;
  output.innerHTML = "";
  clearError();
  userInput.focus();
});

generateBtn.addEventListener("click", async () => {
  clearError();
  const apiKey = apiKeyInput.value.trim();
  const text = userInput.value.trim();

  if (!apiKey) {
    showError("Gemini APIキーを「API設定」から入力してください。");
    return;
  }
  if (!apiKey.startsWith("AIza")) {
    showError("APIキーの形式が正しくないようです。Google AI Studio で発行したキー（AIza... で始まる）を貼り付けてください。");
    return;
  }
  if (!text) {
    showError("メモまたは文章を入力してください。");
    return;
  }

  generateBtn.disabled = true;
  clearBtn.disabled = true;
  outputArea.hidden = false;
  modeIndicator.textContent = "";
  modeIndicator.className = "mode-badge";
  output.innerHTML = '<div class="loading"><span class="spinner"></span>生成中…（10〜30秒程度）</div>';

  try {
    const grade = gradeSelect.value;
    const term = termSelect.value;
    const model = modelSelect.value;
    const systemPrompt = buildSystemPrompt(grade, term);
    const result = await callGemini(apiKey, model, systemPrompt, text);
    renderOutput(result);
  } catch (e) {
    output.innerHTML = "";
    showError(e.message || String(e));
  } finally {
    generateBtn.disabled = false;
    clearBtn.disabled = false;
  }
});

// Gemini API 呼び出し
async function callGemini(apiKey, model, systemPrompt, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7
      }
    })
  });

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Gemini APIエラー (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const candidate = (data.candidates || [])[0];
  if (!candidate) throw new Error("応答に候補がありません。再度お試しください。");

  // 終了理由の確認
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    if (candidate.finishReason === "MAX_TOKENS") {
      throw new Error("出力が長すぎて途中で切れました。もう一度お試しください。");
    }
    if (candidate.finishReason === "SAFETY") {
      throw new Error("安全性フィルタで応答が止まりました。入力内容をご確認ください。");
    }
  }

  const parts = candidate.content?.parts || [];
  const text = parts.map(p => p.text || "").join("");
  if (!text) throw new Error("応答にテキストが含まれていません。再度お試しください。");
  return text;
}

// 出力のパース・描画
function renderOutput(raw) {
  const cleaned = raw.replace(/\*\*/g, "").trim();

  const modeMatch = cleaned.match(/【処理モード】[：:]\s*([^\n]+)/);
  if (modeMatch) {
    const modeText = modeMatch[1].trim();
    modeIndicator.textContent = modeText;
    if (modeText.includes("モードB") || modeText.includes("推敲")) {
      modeIndicator.classList.add("modeB");
    }
  }

  const caseRegex = /【案(\d)[：:]([^】]+)】\s*([\s\S]*?)(?=\n*【案\d|\s*$)/g;
  const cases = [];
  let m;
  while ((m = caseRegex.exec(cleaned)) !== null) {
    const num = m[1];
    const title = m[2].trim();
    let body = m[3].trim();
    // モデルが付ける「（約 〇〇文字）」表記は実測表示にするため除去
    body = body.replace(/[（(]約\s*\d+\s*文字[）)]/g, "").trim();
    cases.push({ num, title, body });
  }

  if (cases.length === 0) {
    output.innerHTML = `<pre class="case-body">${escapeHtml(cleaned)}</pre>`;
    return;
  }

  output.innerHTML = cases.map((c, i) => `
    <div class="case">
      <div class="case-title">
        <span>案${c.num}：${escapeHtml(c.title)}</span>
        <button class="copy-btn" data-idx="${i}">コピー</button>
      </div>
      <p class="case-body">${escapeHtml(c.body)}</p>
      <p class="case-meta">${countChars(c.body)}文字</p>
    </div>
  `).join("");

  output.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      try {
        await navigator.clipboard.writeText(cases[idx].body);
        btn.textContent = "コピー済み";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "コピー";
          btn.classList.remove("copied");
        }, 1500);
      } catch {
        showError("クリップボードへのコピーに失敗しました。");
      }
    });
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countChars(s) {
  return Array.from(s.replace(/\s/g, "")).length;
}

userInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    generateBtn.click();
  }
});

loadSettings();
