(function () {
  const STORAGE_KEY = "lisa_daily_card_records_v4";
  let selectedImageBase64 = "";

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function escapeHTML(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeCardText(text) {
    return String(text || "").trim();
  }

  function getDisabledReplySet() {
    try {
      const raw = localStorage.getItem("disabledReplyItems");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function getDisabledGroupItemsSet() {
    const result = new Set();

    try {
      if (
        typeof window.customReplyGroups !== "undefined" &&
        Array.isArray(window.customReplyGroups)
      ) {
        window.customReplyGroups.forEach(group => {
          if (!group || !group.disabled) return;
          if (!Array.isArray(group.items)) return;

          group.items.forEach(item => {
            result.add(normalizeCardText(item));
          });
        });
      }
    } catch (e) {
      console.warn("读取字卡分组屏蔽状态失败：", e);
    }

    return result;
  }

  function getOriginalReplyCards() {
    let pool = [];

    try {
      if (typeof window.customReplies !== "undefined" && Array.isArray(window.customReplies)) {
        pool = window.customReplies;
      } else if (typeof customReplies !== "undefined" && Array.isArray(customReplies)) {
        pool = customReplies;
      }
    } catch (e) {
      console.warn("读取原网站字卡库失败：", e);
    }

    const disabledItems = getDisabledReplySet();
    const disabledGroupItems = getDisabledGroupItemsSet();

    return pool
      .map(normalizeCardText)
      .filter(Boolean)
      .filter(card => !disabledItems.has(card))
      .filter(card => !disabledGroupItems.has(card));
  }

  function getReplyCount() {
    return randomInt(1, 4);
  }

  function getReplyDelay() {
    const fallbackMin = 800;
    const fallbackMax = 2200;

    const min =
      typeof window.settings !== "undefined" && Number.isFinite(Number(window.settings.replyDelayMin))
        ? Number(window.settings.replyDelayMin)
        : typeof settings !== "undefined" && Number.isFinite(Number(settings.replyDelayMin))
          ? Number(settings.replyDelayMin)
          : fallbackMin;

    const max =
      typeof window.settings !== "undefined" && Number.isFinite(Number(window.settings.replyDelayMax))
        ? Number(window.settings.replyDelayMax)
        : typeof settings !== "undefined" && Number.isFinite(Number(settings.replyDelayMax))
          ? Number(settings.replyDelayMax)
          : fallbackMax;

    const safeMin = Math.max(0, Math.min(min, max));
    const safeMax = Math.max(safeMin, Math.max(min, max));

    return safeMin + Math.random() * (safeMax - safeMin);
  }

  function drawOneCard(pool) {
    if (!pool.length) return "";
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function drawCardsNow() {
    const pool = getOriginalReplyCards();

    if (!pool.length) return [];

    const replyCount = Math.min(getReplyCount(), pool.length);
    const selectedCards = [];
    const used = new Set();

    for (let i = 0; i < replyCount; i++) {
      let picked = "";

      for (let t = 0; t < 8; t++) {
        const candidate = drawOneCard(pool);
        if (candidate && !used.has(candidate)) {
          picked = candidate;
          break;
        }
      }

      if (!picked) picked = drawOneCard(pool);

      if (picked) {
        used.add(picked);
        selectedCards.push(picked);
      }
    }

    return selectedCards;
  }

  function shouldLisaReply(replyMode) {
    if (replyMode === "must") return true;
    if (replyMode === "silent") return false;
    return Math.random() < 0.5;
  }

  function getRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("读取日常碎片记录失败：", e);
      return [];
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      alert("保存失败：可能是图片太大，浏览器本地存储满了。可以换小一点的图片。");
      console.warn("保存日常碎片记录失败：", e);
    }
  }

  function cardsHTML(cards) {
    return cards
      .map(card => `<span class="lisa-card-chip">${escapeHTML(card)}</span>`)
      .join("");
  }

  function createCardChip(text) {
    const card = document.createElement("span");
    card.className = "lisa-card-chip lisa-card-chip-appear";
    card.textContent = text;
    return card;
  }

  function formatDueTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN");
  }

  function processDueReplies() {
    const records = getRecords();
    let changed = false;
    const now = Date.now();

    records.forEach(record => {
      if (record.status === "pending" && record.dueAt && now >= record.dueAt) {
        const cards = drawCardsNow();

        record.status = cards.length ? "replied" : "no_cards";
        record.cards = cards;
        record.repliedAt = new Date().toLocaleString("zh-CN");
        changed = true;
      }
    });

    if (changed) {
      saveRecords(records);
    }
  }

  function createDailyCardsUI() {
    const floatBtn = document.createElement("button");
    floatBtn.className = "lisa-daily-float-btn";
    floatBtn.type = "button";
    floatBtn.textContent = "日常碎片";
    floatBtn.title = "记录图片、碎碎念和日常；Lisa 可能回应，也可能不回应";

    const overlay = document.createElement("div");
    overlay.className = "lisa-daily-overlay";
    overlay.innerHTML = `
      <div class="lisa-daily-panel">
        <div class="lisa-daily-header">
          <div class="lisa-daily-title">日常碎片</div>
          <button class="lisa-daily-close" type="button">×</button>
        </div>

        <div class="lisa-daily-tabs">
          <button class="lisa-daily-tab active" data-tab="send" type="button">发送碎片</button>
          <button class="lisa-daily-tab" data-tab="board" type="button">碎片板</button>
        </div>

        <div class="lisa-daily-tab-panel active" id="lisaDailySendPanel">
          <textarea class="lisa-daily-textarea" id="lisaDailyText" placeholder="写一点碎碎念，或者把今天发生的事放在这里……"></textarea>

          <div class="lisa-daily-options">
            <label class="lisa-daily-option">
              <span>Lisa 要不要回应</span>
              <select id="lisaReplyMode">
                <option value="auto">不干预：50% 概率回应</option>
                <option value="must">我想要她回应</option>
                <option value="silent">不需要回应，只保存</option>
              </select>
            </label>

            <label class="lisa-daily-option">
              <span>反馈时间</span>
              <select id="lisaFeedbackMode">
                <option value="instant">即时反馈</option>
                <option value="delayed">稍后反馈：6h-24h</option>
              </select>
            </label>
          </div>

          <div class="lisa-daily-actions">
            <label class="lisa-daily-upload">
              上传图片
              <input id="lisaDailyImage" type="file" accept="image/*" hidden>
            </label>
            <button class="lisa-daily-send" id="lisaDailySend" type="button">发送给 Lisa</button>
          </div>

          <div class="lisa-daily-preview" id="lisaDailyPreview"></div>

          <div class="lisa-daily-response">
            <div class="lisa-daily-subtitle">Lisa 的回应</div>
            <div class="lisa-thinking" id="lisaThinking" style="display:none;">
              <span class="lisa-thinking-dot"></span>
              <span class="lisa-thinking-text">Lisa 正在想……</span>
            </div>
            <div class="lisa-daily-time" id="lisaDailyStatus"></div>
            <div class="lisa-card-row" id="lisaDailyCurrentCards"></div>
          </div>
        </div>

        <div class="lisa-daily-tab-panel" id="lisaDailyBoardPanel">
          <div class="lisa-daily-board-head">
            <div>
              <div class="lisa-daily-subtitle">碎片板</div>
              <div class="lisa-daily-time">这里会保存你发过的图片、文字和 Lisa 的回应状态。</div>
            </div>
            <button class="lisa-daily-clear" id="lisaDailyClear" type="button">清空</button>
          </div>
          <div id="lisaDailyHistory"></div>
        </div>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".lisa-daily-close");
    const tabs = overlay.querySelectorAll(".lisa-daily-tab");
    const sendPanel = overlay.querySelector("#lisaDailySendPanel");
    const boardPanel = overlay.querySelector("#lisaDailyBoardPanel");

    const textInput = overlay.querySelector("#lisaDailyText");
    const replyModeInput = overlay.querySelector("#lisaReplyMode");
    const feedbackModeInput = overlay.querySelector("#lisaFeedbackMode");
    const imageInput = overlay.querySelector("#lisaDailyImage");
    const preview = overlay.querySelector("#lisaDailyPreview");
    const sendBtn = overlay.querySelector("#lisaDailySend");
    const clearBtn = overlay.querySelector("#lisaDailyClear");
    const currentCards = overlay.querySelector("#lisaDailyCurrentCards");
    const thinking = overlay.querySelector("#lisaThinking");
    const statusText = overlay.querySelector("#lisaDailyStatus");
    const historyBox = overlay.querySelector("#lisaDailyHistory");

    let isReplying = false;

    function switchTab(tabName) {
      processDueReplies();

      tabs.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
      });

      sendPanel.classList.toggle("active", tabName === "send");
      boardPanel.classList.toggle("active", tabName === "board");

      if (tabName === "board") {
        renderHistory(historyBox);
      }
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    floatBtn.addEventListener("click", () => {
      processDueReplies();
      overlay.classList.add("show");
      renderHistory(historyBox);
    });

    closeBtn.addEventListener("click", () => {
      overlay.classList.remove("show");
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("show");
    });

    imageInput.addEventListener("change", () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;

      if (file.size > 1024 * 1024 * 2.5) {
        alert("这张图有点大。本地保存容易失败，建议压缩到 2.5MB 以下。");
        imageInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        selectedImageBase64 = event.target.result;
        preview.innerHTML = `<img src="${selectedImageBase64}" alt="preview">`;
      };
      reader.readAsDataURL(file);
    });

    sendBtn.addEventListener("click", () => {
      if (isReplying) return;

      const text = textInput.value.trim();
      const replyMode = replyModeInput.value;
      const feedbackMode = feedbackModeInput.value;

      if (!text && !selectedImageBase64) {
        alert("先放点东西给她。");
        return;
      }

      const willReply = shouldLisaReply(replyMode);

      currentCards.innerHTML = "";
      statusText.textContent = "";

      if (!willReply) {
        const newRecord = {
          id: Date.now(),
          createdAt: new Date().toLocaleString("zh-CN"),
          text,
          image: selectedImageBase64,
          cards: [],
          status: "no_reply",
          replyMode,
          feedbackMode
        };

        const records = getRecords();
        records.unshift(newRecord);
        saveRecords(records);
        renderHistory(historyBox);

        statusText.textContent = "Lisa 这次没有回应。碎片已经保存。";

        textInput.value = "";
        imageInput.value = "";
        selectedImageBase64 = "";
        preview.innerHTML = "";
        return;
      }

      if (!getOriginalReplyCards().length) {
        alert("还没有可用字卡。请先去原网站的「高级功能 → 自定义回复」里添加字卡，或检查是否把字卡都屏蔽了。");
        return;
      }

      if (feedbackMode === "delayed") {
        const dueAt = Date.now() + randomBetween(SIX_HOURS, TWENTY_FOUR_HOURS);

        const newRecord = {
          id: Date.now(),
          createdAt: new Date().toLocaleString("zh-CN"),
          text,
          image: selectedImageBase64,
          cards: [],
          status: "pending",
          replyMode,
          feedbackMode,
          dueAt
        };

        const records = getRecords();
        records.unshift(newRecord);
        saveRecords(records);
        renderHistory(historyBox);

        statusText.textContent = `Lisa 会晚点回应。预计不早于：${formatDueTime(dueAt)}`;

        textInput.value = "";
        imageInput.value = "";
        selectedImageBase64 = "";
        preview.innerHTML = "";
        return;
      }

      isReplying = true;
      sendBtn.disabled = true;
      sendBtn.textContent = "Lisa 正在看";
      thinking.style.display = "flex";

      const pool = getOriginalReplyCards();
      const replyCount = Math.min(getReplyCount(), pool.length);
      const selectedCards = [];
      const used = new Set();

      let totalDelay = 0;

      for (let i = 0; i < replyCount; i++) {
        totalDelay += getReplyDelay();

        setTimeout(() => {
          let picked = "";

          for (let t = 0; t < 8; t++) {
            const candidate = drawOneCard(pool);
            if (candidate && !used.has(candidate)) {
              picked = candidate;
              break;
            }
          }

          if (!picked) {
            picked = drawOneCard(pool);
          }

          if (picked) {
            used.add(picked);
            selectedCards.push(picked);
            currentCards.appendChild(createCardChip(picked));
          }

          if (i === replyCount - 1) {
            thinking.style.display = "none";
            statusText.textContent = "Lisa 回应了。";

            const newRecord = {
              id: Date.now(),
              createdAt: new Date().toLocaleString("zh-CN"),
              text,
              image: selectedImageBase64,
              cards: selectedCards,
              status: "replied",
              replyMode,
              feedbackMode,
              repliedAt: new Date().toLocaleString("zh-CN")
            };

            const records = getRecords();
            records.unshift(newRecord);
            saveRecords(records);
            renderHistory(historyBox);

            textInput.value = "";
            imageInput.value = "";
            selectedImageBase64 = "";
            preview.innerHTML = "";

            sendBtn.disabled = false;
            sendBtn.textContent = "发送给 Lisa";
            isReplying = false;
          }
        }, totalDelay);
      }
    });

    clearBtn.addEventListener("click", () => {
      if (!confirm("确定要清空所有日常碎片吗？")) return;
      localStorage.removeItem(STORAGE_KEY);
      currentCards.innerHTML = "";
      statusText.textContent = "";
      renderHistory(historyBox);
    });

    processDueReplies();
    renderHistory(historyBox);

    setInterval(() => {
      processDueReplies();
      renderHistory(historyBox);
    }, 60 * 1000);
  }

  function getStatusHTML(item) {
    if (item.status === "pending") {
      return `<div class="lisa-daily-status pending">Lisa 还没有回应。预计不早于：${escapeHTML(formatDueTime(item.dueAt))}</div>`;
    }

    if (item.status === "no_reply") {
      return `<div class="lisa-daily-status silent">Lisa 这次没有回应。</div>`;
    }

    if (item.status === "no_cards") {
      return `<div class="lisa-daily-status silent">到时间了，但没有可用字卡。</div>`;
    }

    if (item.status === "replied") {
      return `<div class="lisa-daily-status replied">Lisa 回应了${item.repliedAt ? "：" + escapeHTML(item.repliedAt) : ""}</div>`;
    }

    return "";
  }

  function renderHistory(container) {
    processDueReplies();

    const records = getRecords();

    if (!records.length) {
      container.innerHTML = `<div class="lisa-daily-time">还没有记录。</div>`;
      return;
    }

    container.innerHTML = records.map(item => {
      const image = item.image
        ? `<img class="lisa-daily-history-img" src="${item.image}" alt="daily image">`
        : "";

      const cardBlock = item.cards && item.cards.length
        ? `<div class="lisa-card-row" style="margin-top: 8px;">${cardsHTML(item.cards)}</div>`
        : "";

      return `
        <div class="lisa-daily-history-item">
          <div class="lisa-daily-time">${escapeHTML(item.createdAt)}</div>
          ${image}
          <div class="lisa-daily-user-text">${escapeHTML(item.text)}</div>
          ${getStatusHTML(item)}
          ${cardBlock}
        </div>
      `;
    }).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createDailyCardsUI);
  } else {
    createDailyCardsUI();
  }
})();
