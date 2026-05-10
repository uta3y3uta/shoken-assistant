// DOM要素
const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabelText = document.getElementById("apiKeyLabelText");
const apiKeyHelp = document.getElementById("apiKeyHelp");
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

// プロバイダ別設定
const PROVIDERS = {
  anthropic: {
    label: "Anthropic（Claude）",
    keyLabel: "Anthropic APIキー",
    keyPlaceholder: "sk-ant-...",
    keyHelp: "console.anthropic.com で取得（有料）",
    models: [
      { id: "claude-opus-4-7", label: "Claude Opus 4.7（最高品質）" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6（高速・安価）" }
    ],
    defaultModel: "claude-opus-4-7"
  },
  google: {
    label: "Google（Gemini）",
    keyLabel: "Google AI Studio APIキー",
    keyPlaceholder: "AIza...",
    keyHelp: "aistudio.google.com/app/apikey で取得（無料枠あり）",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro（高品質）" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash（高速・無料枠大）" }
    ],
    defaultModel: "gemini-2.5-flash"
  }
};

// localStorage キー
const LS = {
  provider: "shoken_provider",
  apiKeyAnthropic: "shoken_api_key_anthropic",
  apiKeyGoogle: "shoken_api_key_google",
  modelAnthropic: "shoken_model_anthropic",
  modelGoogle: "shoken_model_google",
  grade: "shoken_grade",
  term: "shoken_term"
};

function getApiKeyLSKey(provider) {
  return provider === "google" ? LS.apiKeyGoogle : LS.apiKeyAnthropic;
}
function getModelLSKey(provider) {
  return provider === "google" ? LS.modelGoogle : LS.modelAnthropic;
}

// プロバイダ切替時にUI更新
function refreshProviderUI() {
  const provider = providerSelect.value;
  const cfg = PROVIDERS[provider];

  apiKeyLabelText.textContent = cfg.keyLabel;
  apiKeyInput.placeholder = cfg.keyPlaceholder;
  apiKeyHelp.textContent = cfg.keyHelp;
  apiKeyInput.value = localStorage.getItem(getApiKeyLSKey(provider)) || "";

  // モデルセレクトを更新
  modelSelect.innerHTML = "";
  for (const m of cfg.models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  }
  modelSelect.value = localStorage.getItem(getModelLSKey(provider)) || cfg.defaultModel;
}

// 旧バージョンからのデータ移行
function migrateLegacy() {
  const oldKey = localStorage.getItem("shoken_api_key");
  if (oldKey) {
    if (oldKey.startsWith("AIza")) {
      if (!localStorage.getItem(LS.apiKeyGoogle)) {
        localStorage.setItem(LS.apiKeyGoogle, oldKey);
      }
      if (!localStorage.getItem(LS.provider)) {
        localStorage.setItem(LS.provider, "google");
      }
    } else {
      if (!localStorage.getItem(LS.apiKeyAnthropic)) {
        localStorage.setItem(LS.apiKeyAnthropic, oldKey);
      }
    }
    localStorage.removeItem("shoken_api_key");
  }
  const oldModel = localStorage.getItem("shoken_model");
  if (oldModel) {
    if (oldModel.startsWith("gemini")) {
      if (!localStorage.getItem(LS.modelGoogle)) localStorage.setItem(LS.modelGoogle, oldModel);
    } else {
      if (!localStorage.getItem(LS.modelAnthropic)) localStorage.setItem(LS.modelAnthropic, oldModel);
    }
    localStorage.removeItem("shoken_model");
  }
}

// 設定の読み込み
function loadSettings() {
  migrateLegacy();
  providerSelect.value = localStorage.getItem(LS.provider) || "anthropic";
  gradeSelect.value = localStorage.getItem(LS.grade) || "5";
  termSelect.value = localStorage.getItem(LS.term) || "後期";
  refreshProviderUI();
}

function saveSetting(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

providerSelect.addEventListener("change", () => {
  saveSetting(LS.provider, providerSelect.value);
  refreshProviderUI();
});
apiKeyInput.addEventListener("change", () => {
  saveSetting(getApiKeyLSKey(providerSelect.value), apiKeyInput.value.trim());
});
modelSelect.addEventListener("change", () => {
  saveSetting(getModelLSKey(providerSelect.value), modelSelect.value);
});
gradeSelect.addEventListener("change", () => saveSetting(LS.grade, gradeSelect.value));
termSelect.addEventListener("change", () => saveSetting(LS.term, termSelect.value));

// エラー表示
function showError(msg) {
  errorBox.hidden = false;
  errorBox.textContent = msg;
}
function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

// クリア
clearBtn.addEventListener("click", () => {
  userInput.value = "";
  outputArea.hidden = true;
  output.innerHTML = "";
  clearError();
  userInput.focus();
});

// 生成ボタン
generateBtn.addEventListener("click", async () => {
  clearError();
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const text = userInput.value.trim();

  if (!apiKey) {
    showError(`${PROVIDERS[provider].keyLabel}を「API設定」から入力してください。`);
    return;
  }
  // キー形式と選択プロバイダのミスマッチをチェック
  if (provider === "anthropic" && apiKey.startsWith("AIza")) {
    showError("Anthropicが選択されていますが，Google AI StudioのAPIキー（AIza...）が入力されています。プロバイダを「Google（Gemini）」に切り替えてください。");
    return;
  }
  if (provider === "google" && apiKey.startsWith("sk-ant-")) {
    showError("Googleが選択されていますが，AnthropicのAPIキー（sk-ant-...）が入力されています。プロバイダを「Anthropic」に切り替えてください。");
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

    let result;
    if (provider === "google") {
      result = await callGemini(apiKey, model, systemPrompt, text);
    } else {
      result = await callClaude(apiKey, model, systemPrompt, text);
    }
    renderOutput(result);
  } catch (e) {
    output.innerHTML = "";
    showError(e.message || String(e));
  } finally {
    generateBtn.disabled = false;
    clearBtn.disabled = false;
  }
});

// Claude API 呼び出し
async function callClaude(apiKey, model, systemPrompt, userText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }]
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
    throw new Error(`Claude APIエラー (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find(b => b.type === "text");
  if (!textBlock) throw new Error("応答にテキストが含まれていません。");
  return textBlock.text;
}

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
        maxOutputTokens: 2048,
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
  if (!candidate) throw new Error("応答に候補がありません。");
  const parts = candidate.content?.parts || [];
  const text = parts.map(p => p.text || "").join("");
  if (!text) throw new Error("応答にテキストが含まれていません。");
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
    const body = m[3].trim();

    const charMatch = body.match(/[（(]約\s*(\d+)\s*文字[）)]/);
    let mainBody = body;
    let charNote = "";
    if (charMatch) {
      charNote = `約 ${charMatch[1]} 文字`;
      mainBody = body.replace(charMatch[0], "").trim();
    }
    cases.push({ num, title, body: mainBody, charNote });
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
      ${c.charNote ? `<p class="case-meta">${c.charNote}（実測 ${countChars(c.body)} 文字）</p>` : `<p class="case-meta">実測 ${countChars(c.body)} 文字</p>`}
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
