(function () {
  const STORAGE_KEY = "lisa_daily_card_records_v2";
  let selectedImageBase64 = "";

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
        typeof customReplyGroups !== "undefined" &&
        Array.isArray(customReplyGroups)
      ) {
        customReplyGroups.forEach(group => {
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
      if (typeof customReplies !== "undefined" && Array.isArray(customReplies)) {
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

  function drawLisaCards() {
    const pool = getOriginalReplyCards();

    if (!pool.length) {
      alert("还没有可用字卡。请先去原网站的「高级功能 → 自定义回复」里添加字卡，或检查是否把字卡都屏蔽了。");
      return [];
    }

    const max = Math.min(4, pool.length);
    const count = randomInt(1, max);

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
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

  function createDailyCardsUI() {
    const floatBtn = document.createElement("button");
    floatBtn.className = "lisa-daily-float-btn";
    floatBtn.type = "button";
    floatBtn.textContent = "日常碎片";
    floatBtn.title = "记录图片、碎碎念和日常；Lisa 会从原字卡库随机回应";

    const overlay = document.createElement("div");
    overlay.className = "lisa-daily-overlay";
    overlay.innerHTML = `
      <div class="lisa-daily-panel">
        <div class="lisa-daily-header">
          <div class="lisa-daily-title">日常碎片</div>
          <button class="lisa-daily-close" type="button">×</button>
        </div>

        <textarea class="lisa-daily-textarea" id="lisaDailyText" placeholder="写一点碎碎念，或者把今天发生的事放在这里……"></textarea>

        <div class="lisa-daily-actions">
          <label class="lisa-daily-upload">
            上传图片
            <input id="lisaDailyImage" type="file" accept="image/*" hidden>
          </label>
          <button class="lisa-daily-send" id="lisaDailySend" type="button">发送给 Lisa</button>
          <button class="lisa-daily-clear" id="lisaDailyClear" type="button">清空记录</button>
        </div>

        <div class="lisa-daily-preview" id="lisaDailyPreview"></div>

        <div class="lisa-daily-response">
          <div class="lisa-daily-subtitle">Lisa 从原字卡库抽到</div>
          <div class="lisa-card-row" id="lisaDailyCurrentCards"></div>
        </div>

        <div class="lisa-daily-history">
          <div class="lisa-daily-subtitle">以前留下的碎片</div>
          <div id="lisaDailyHistory"></div>
        </div>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".lisa-daily-close");
    const textInput = overlay.querySelector("#lisaDailyText");
    const imageInput = overlay.querySelector("#lisaDailyImage");
    const preview = overlay.querySelector("#lisaDailyPreview");
    const sendBtn = overlay.querySelector("#lisaDailySend");
    const clearBtn = overlay.querySelector("#lisaDailyClear");
    const currentCards = overlay.querySelector("#lisaDailyCurrentCards");
    const historyBox = overlay.querySelector("#lisaDailyHistory");

    floatBtn.addEventListener("click", () => {
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
      const text = textInput.value.trim();

      if (!text && !selectedImageBase64) {
        alert("先放点东西给她。");
        return;
      }

      const cards = drawLisaCards();
      if (!cards.length) return;

      currentCards.innerHTML = cardsHTML(cards);

      const newRecord = {
        id: Date.now(),
        createdAt: new Date().toLocaleString("zh-CN"),
        text,
        image: selectedImageBase64,
        cards
      };

      const records = getRecords();
      records.unshift(newRecord);
      saveRecords(records);

      textInput.value = "";
      imageInput.value = "";
      selectedImageBase64 = "";
      preview.innerHTML = "";

      renderHistory(historyBox);
    });

    clearBtn.addEventListener("click", () => {
      if (!confirm("确定要清空所有日常碎片吗？")) return;
      localStorage.removeItem(STORAGE_KEY);
      currentCards.innerHTML = "";
      renderHistory(historyBox);
    });

    renderHistory(historyBox);
  }

  function renderHistory(container) {
    const records = getRecords();

    if (!records.length) {
      container.innerHTML = `<div class="lisa-daily-time">还没有记录。</div>`;
      return;
    }

    container.innerHTML = records.map(item => {
      const image = item.image
        ? `<img class="lisa-daily-history-img" src="${item.image}" alt="daily image">`
        : "";

      return `
        <div class="lisa-daily-history-item">
          <div class="lisa-daily-time">${escapeHTML(item.createdAt)}</div>
          ${image}
          <div class="lisa-daily-user-text">${escapeHTML(item.text)}</div>
          <div class="lisa-card-row" style="margin-top: 8px;">
            ${cardsHTML(item.cards || [])}
          </div>
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
