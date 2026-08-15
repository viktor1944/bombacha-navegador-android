(() => {
  if (globalThis.__bombachaTopicAuthorsLoadedV6) return;
  globalThis.__bombachaTopicAuthorsLoadedV6 = true;

  const api = globalThis.browser || globalThis.chrome;
  if (!api?.storage?.local) return;

  const LEGACY_ENABLED_KEY = "bombachaTopicAuthorsEnabledV1";
  const MODE_KEY = "bombachaTopicAuthorsModeV1";
  const CACHE_KEY = "bombachaTopicAuthorCacheV1";
  const BLOCKED_KEY = "bombachaBlockedTopicCreatorsV1";
  const MAX_CACHE_ENTRIES = 5000;
  const MAX_CONCURRENCY = 4;
  const OLD_BUTTON_ID = "bombacha-forum-author-button";
  const LEGACY_AUTHOR_CLASS = "bombacha-topic-original-author";
  const LEGACY_CARD_CLASS = "bombacha-topic-original-author-card";
  const nativeLastSnapshots = new WeakMap();
  const AUTHOR_APPLIED_CLASS = "bombacha-topic-author-in-last-slot";
  const BOTH_MODE_CLASS = "bombacha-topic-author-both-mode";
  const BLOCKED_ROW_CLASS = "bombacha-topic-blocked-by-author";
  const STYLE_ID = "bombacha-topic-author-style-v6";
  const VALID_MODES = new Set(["author", "original", "both"]);

  let authorMode = "author";
  let mutationTimer = null;
  let populatePromise = null;
  let populateAgain = false;
  let runToken = 0;
  let cacheLoaded = false;
  let cacheMemory = {};
  let cacheWriteTimer = null;
  let blockedEntries = [];
  let blockedKeys = new Set();

  function storageGet(defaults) {
    if (globalThis.browser?.storage?.local) {
      return globalThis.browser.storage.local.get(defaults).then((value) => value || {});
    }
    return new Promise((resolve, reject) => {
      try {
        api.storage.local.get(defaults, (value) => {
          const err = globalThis.chrome?.runtime?.lastError;
          if (err) reject(err);
          else resolve(value || {});
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function storageSet(values) {
    if (globalThis.browser?.storage?.local) return globalThis.browser.storage.local.set(values);
    return new Promise((resolve, reject) => {
      try {
        api.storage.local.set(values, () => {
          const err = globalThis.chrome?.runtime?.lastError;
          if (err) reject(err);
          else resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function normalizeMode(value, legacyEnabled = true) {
    const mode = String(value || "").toLowerCase();
    if (VALID_MODES.has(mode)) return mode;
    return legacyEnabled === false ? "original" : "author";
  }

  function modeNeedsAuthorPresentation() {
    return authorMode === "author" || authorMode === "both";
  }

  function isBoardPath() {
    return /^\/board-?\d+\/?$/i.test(location.pathname);
  }

  function isBoardPage() {
    return isBoardPath() && Boolean(document.querySelector("#blst_cont"));
  }

  function normalizeProfileKey(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, location.origin);
      if (!/(^|\.)vk\.(?:ru|com)$/i.test(url.hostname)) return "";
      const path = String(url.pathname || "").replace(/\/+$/, "");
      if (!path || path === "/") return "";
      if (/^\/(?:board|topic|wall|video|photo|im|feed|groups?|search)/i.test(path)) return "";
      return path.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function normalizeBlockedEntries(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const url = typeof item === "string" ? item : String(item?.url || item?.profileHref || item?.key || "");
      const key = normalizeProfileKey(typeof item === "object" && item?.key ? item.key : url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        url: /^https?:\/\//i.test(url) ? url : `${location.origin}${key}`,
        addedAt: Number(item?.addedAt || 0) || Date.now()
      });
    }
    return out;
  }

  function setBlockedEntries(value) {
    blockedEntries = normalizeBlockedEntries(value);
    blockedKeys = new Set(blockedEntries.map((item) => item.key));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.getElementById("bombacha-topic-author-style-v3")?.remove();
    document.getElementById("bombacha-topic-author-style-v4")?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${AUTHOR_APPLIED_CLASS} .blst_mem {
        color:var(--vkui--color_text_link,#2a5885)!important;
        font-weight:650!important;
      }
      .${AUTHOR_APPLIED_CLASS} .blst_date {
        color:var(--vkui--color_text_secondary,#818c99)!important;
      }
      .bombacha-topic-author-badge {
        margin-left:5px!important;
        color:var(--vkui--color_text_secondary,#818c99)!important;
        font-size:11px!important;
        font-weight:400!important;
        white-space:nowrap!important;
      }
      a.${LEGACY_CARD_CLASS} {
        float:right!important;
        width:200px!important;
        padding:8px 12px!important;
        border-radius:2px!important;
        overflow:hidden!important;
        box-sizing:content-box!important;
        color:inherit!important;
        text-decoration:none!important;
      }
      a.${LEGACY_CARD_CLASS}:hover {
        text-decoration:none!important;
        background-color:var(--vkui--color_background_secondary,#f0f2f5)!important;
      }
      a.${LEGACY_CARD_CLASS} .blst_mem {
        color:var(--vkui--color_text_link,#2a5885)!important;
        font-weight:650!important;
      }
      a.${LEGACY_CARD_CLASS} .blst_date {
        color:var(--vkui--color_text_secondary,#818c99)!important;
      }
      .${BLOCKED_ROW_CLASS} { display:none !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function topicRows() {
    return [...document.querySelectorAll("#blst_cont .blst_row")]
      .filter((row) => row.querySelector('a.blst_title[href*="/topic"]'));
  }

  function cleanTopicUrl(href) {
    try {
      const url = new URL(href, location.origin);
      if (!/^\/topic-?\d+_\d+/i.test(url.pathname)) return null;
      url.search = "";
      url.hash = "";
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function topicKey(url) {
    try {
      const match = new URL(url).pathname.match(/\/topic(-?\d+_\d+)/i);
      return match ? match[1] : url;
    } catch (_) {
      return url;
    }
  }

  function lastMessageHref(row) {
    const current = row.querySelector("a.blst_last")?.getAttribute("href") || "";
    if (/offset=last|scroll=1/i.test(current)) return current;
    const topicHref = row.querySelector('a.blst_title[href*="/topic"]')?.getAttribute("href") || current;
    if (!topicHref) return current || "#";
    try {
      const url = new URL(topicHref, location.origin);
      url.searchParams.set("offset", "last");
      url.searchParams.set("scroll", "1");
      return `${url.pathname}${url.search}`;
    } catch (_) {
      return topicHref;
    }
  }

  function cleanupLegacyAuthorPresentation(row = document) {
    row.querySelectorAll?.(`.${LEGACY_AUTHOR_CLASS}`).forEach((el) => el.remove());
    document.getElementById(OLD_BUTTON_ID)?.remove();
  }

  function removeBothCard(row = document) {
    row.querySelectorAll?.(`a.${LEGACY_CARD_CLASS}`).forEach((el) => el.remove());
  }

  function backupNativeLast(last) {
    if (!last || last.dataset.bombachaNativeLastSaved === "1") return;
    last.dataset.bombachaNativeLastSaved = "1";
    nativeLastSnapshots.set(last, [...last.childNodes].map((node) => node.cloneNode(true)));
    last.dataset.bombachaNativeLastHref = last.getAttribute("href") || "";
    last.dataset.bombachaNativeLastTitle = last.getAttribute("title") || "";
    last.dataset.bombachaNativeLastAria = last.getAttribute("aria-label") || "";
  }

  function nativeLastData(last) {
    const holder = document.createElement("div");
    const snapshot = last ? nativeLastSnapshots.get(last) : null;
    const sourceNodes = snapshot?.length ? snapshot : (last ? [...last.childNodes] : []);
    holder.append(...sourceNodes.map((node) => node.cloneNode(true)));
    return {
      avatarUrl: holder.querySelector(".blst_img")?.getAttribute("src") || "",
      name: holder.querySelector(".blst_mem")?.textContent?.trim() || "Última resposta",
      date: holder.querySelector(".blst_date")?.textContent?.trim() || "Última resposta"
    };
  }

  function appendAuthorName(container, author) {
    container.append(document.createTextNode(author || ""));
    const badge = document.createElement("span");
    badge.className = "bombacha-topic-author-badge";
    badge.textContent = "(AUTOR)";
    container.appendChild(badge);
  }

  function rebuildNativeLastIdentity(last, native) {
    if (!last || !native) return;
    last.replaceChildren();
    const thumb = document.createElement("div");
    thumb.className = "blst_thumb";
    if (native.avatarUrl) {
      const img = document.createElement("img");
      img.className = "blst_img";
      img.src = native.avatarUrl;
      img.alt = native.name || "";
      thumb.appendChild(img);
    }
    const name = document.createElement("div");
    name.className = "blst_mem";
    name.textContent = native.name || "Última resposta";
    const date = document.createElement("div");
    date.className = "blst_date";
    date.textContent = native.date || "Última resposta";
    last.append(thumb, name, date);
  }

  function answeredActivityText(value) {
    const text = String(value || "").trim();
    if (!text) return "respondido";
    if (/^respondido\b/i.test(text)) return text.replace(/^Respondido\b/i, "respondido");
    if (/^(respondeu|escreveu)\b/i.test(text)) {
      return text.replace(/^(respondeu|escreveu)\b/i, "respondido");
    }
    return `respondido ${text}`.trim();
  }

  function restoreNativeLast(row) {
    cleanupLegacyAuthorPresentation(row);
    removeBothCard(row);
    const last = row.querySelector("a.blst_last");
    if (!last) return;
    if (last.dataset.bombachaNativeLastSaved === "1") {
      const snapshot = nativeLastSnapshots.get(last) || [];
      last.replaceChildren(...snapshot.map((node) => node.cloneNode(true)));
      const href = last.dataset.bombachaNativeLastHref || "";
      if (href) last.setAttribute("href", href); else last.removeAttribute("href");
      const title = last.dataset.bombachaNativeLastTitle || "";
      if (title) last.setAttribute("title", title); else last.removeAttribute("title");
      const aria = last.dataset.bombachaNativeLastAria || "";
      if (aria) last.setAttribute("aria-label", aria); else last.removeAttribute("aria-label");
    }
    last.classList.remove(AUTHOR_APPLIED_CLASS, BOTH_MODE_CLASS);
    delete last.dataset.bombachaNativeLastSaved;
    delete last.dataset.bombachaNativeLastHref;
    delete last.dataset.bombachaNativeLastTitle;
    delete last.dataset.bombachaNativeLastAria;
    delete last.dataset.bombachaLastHref;
    delete last.dataset.bombachaRenderKey;
    nativeLastSnapshots.delete(last);
  }

  function makeIdentityLine(avatarUrl, nameText, dateText, extraClass = "") {
    const line = document.createElement("div");
    line.className = `bombacha-topic-both-line ${extraClass}`.trim();

    const thumb = document.createElement("div");
    thumb.className = "blst_thumb";
    if (avatarUrl) {
      const img = document.createElement("img");
      img.className = "blst_img";
      img.src = avatarUrl;
      img.alt = nameText || "";
      thumb.appendChild(img);
    }

    const copy = document.createElement("div");
    copy.className = "bombacha-topic-both-copy";
    const name = document.createElement("div");
    name.className = "blst_mem";
    name.textContent = nameText || "";
    const date = document.createElement("div");
    date.className = "blst_date";
    date.textContent = dateText || "";
    copy.append(name, date);
    line.append(thumb, copy);
    return line;
  }

  function prepareForcedLastLink(row, last, data, renderKey) {
    backupNativeLast(last);
    const targetHref = lastMessageHref(row);
    last.href = targetHref;
    last.dataset.bombachaLastHref = targetHref;
    last.title = "Ir para a última mensagem deste tópico";
    last.setAttribute("aria-label", `Autor original: ${data.author}. Abrir a última mensagem do tópico.`);
    last.classList.add(AUTHOR_APPLIED_CLASS);
    if (last.dataset.bombachaRenderKey === renderKey) return false;
    last.dataset.bombachaRenderKey = renderKey;
    return true;
  }

  function showAuthorInNativeLastSlot(row, data) {
    cleanupLegacyAuthorPresentation(row);
    removeBothCard(row);
    const last = row.querySelector("a.blst_last");
    if (!last || !data?.author) return;
    backupNativeLast(last);
    const native = nativeLastData(last);
    const activityText = answeredActivityText(native.date);
    last.classList.remove(BOTH_MODE_CLASS);
    const renderKey = `author|${data.author}|${data.avatarUrl || ""}|${activityText}|${lastMessageHref(row)}`;
    if (!prepareForcedLastLink(row, last, data, renderKey)) return;
    last.classList.remove(BOTH_MODE_CLASS);
    last.replaceChildren();

    const thumb = document.createElement("div");
    thumb.className = "blst_thumb";
    if (data.avatarUrl) {
      const img = document.createElement("img");
      img.className = "blst_img";
      img.src = data.avatarUrl;
      img.alt = data.author;
      thumb.appendChild(img);
    }

    const name = document.createElement("div");
    name.className = "blst_mem";
    appendAuthorName(name, data.author);

    const date = document.createElement("div");
    date.className = "blst_date";
    date.textContent = activityText;

    last.append(thumb, name, date);
  }

  function showBothInNativeLastSlot(row, data) {
    cleanupLegacyAuthorPresentation(row);
    const last = row.querySelector("a.blst_last");
    if (!last || !data?.author) return;

    // Captura SEMPRE os dados da última resposta nativa antes de qualquer alteração.
    // Se o slot estiver no modo Autor original, nativeLastData usa o snapshot salvo pelo backup.
    const nativeResponder = nativeLastData(last);

    // Volta o slot da direita ao estado nativo e garante que foto/nome/data sejam do último respondedor.
    if (last.dataset.bombachaNativeLastSaved === "1") restoreNativeLast(row);
    const nativeLast = row.querySelector("a.blst_last");
    if (!nativeLast) return;
    rebuildNativeLastIdentity(nativeLast, nativeResponder);

    const targetHref = lastMessageHref(row);
    const renderKey = `both-card|${data.author}|${data.avatarUrl || ""}|${nativeResponder.name}|${nativeResponder.avatarUrl}|${nativeResponder.date}|${targetHref}`;
    let card = row.querySelector(`a.${LEGACY_CARD_CLASS}`);
    if (card?.dataset?.bombachaRenderKey === renderKey) return;
    removeBothCard(row);

    card = document.createElement("a");
    card.className = `${LEGACY_CARD_CLASS} ${AUTHOR_APPLIED_CLASS}`;
    card.href = targetHref;
    card.dataset.bombachaLastHref = targetHref;
    card.dataset.bombachaRenderKey = renderKey;
    card.title = "Ir para a última mensagem deste tópico";
    card.setAttribute("aria-label", `Autor original: ${data.author}. Abrir a última mensagem do tópico.`);

    const thumb = document.createElement("div");
    thumb.className = "blst_thumb";
    if (data.avatarUrl) {
      const img = document.createElement("img");
      img.className = "blst_img";
      img.src = data.avatarUrl;
      img.alt = data.author;
      thumb.appendChild(img);
    }

    const name = document.createElement("div");
    name.className = "blst_mem";
    appendAuthorName(name, data.author);

    const date = document.createElement("div");
    date.className = "blst_date";
    date.textContent = "Autor do tópico";

    card.append(thumb, name, date);
    nativeLast.insertAdjacentElement("afterend", card);
  }

  function removeAuthorPresentation() {
    runToken++;
    cleanupLegacyAuthorPresentation(document);
    topicRows().forEach(restoreNativeLast);
  }

  function clearBlockedPresentation() {
    document.querySelectorAll(`.${BLOCKED_ROW_CLASS}`).forEach((row) => row.classList.remove(BLOCKED_ROW_CLASS));
  }

  function applyBlockedState(row, data) {
    const key = data?.profileKey || normalizeProfileKey(data?.profileHref || "");
    row.classList.toggle(BLOCKED_ROW_CLASS, Boolean(key && blockedKeys.has(key)));
  }

  function applyDataToRow(row, data) {
    applyBlockedState(row, data);
    if (authorMode === "author") showAuthorInNativeLastSlot(row, data);
    else if (authorMode === "both") showBothInNativeLastSlot(row, data);
    else restoreNativeLast(row);
  }

  async function loadCacheOnce() {
    if (cacheLoaded) return cacheMemory;
    const result = await storageGet({ [CACHE_KEY]: {} });
    const value = result?.[CACHE_KEY];
    cacheMemory = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    cacheLoaded = true;
    return cacheMemory;
  }

  function trimCache(cache) {
    let entries = Object.entries(cache || {});
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => (Number(b[1]?.fetchedAt) || 0) - (Number(a[1]?.fetchedAt) || 0));
      entries = entries.slice(0, MAX_CACHE_ENTRIES);
    }
    return Object.fromEntries(entries);
  }

  function queueCacheWrite() {
    clearTimeout(cacheWriteTimer);
    cacheWriteTimer = setTimeout(() => {
      cacheMemory = trimCache(cacheMemory);
      storageSet({ [CACHE_KEY]: cacheMemory }).catch(() => {});
    }, 250);
  }

  async function fetchAuthor(url) {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "X-Bombacha-Topic-Author": "1" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const firstPost = doc.querySelector("#bt_rows .bp_post, .bt_rows .bp_post, .bp_post");
    const authorLink = firstPost?.querySelector(".bp_author");
    const author = authorLink?.textContent?.trim();
    if (!author) throw new Error("Autor não encontrado");
    const href = authorLink.getAttribute("href");
    let profileHref = "";
    if (href) {
      try { profileHref = new URL(href, url).href; } catch (_) {}
    }
    const avatarUrl = firstPost?.querySelector(".bp_img")?.getAttribute("src") || "";
    return {
      author,
      profileHref,
      profileKey: normalizeProfileKey(profileHref),
      avatarUrl,
      fetchedAt: Date.now()
    };
  }

  async function populateVisibleRows() {
    const needLookup = modeNeedsAuthorPresentation() || blockedKeys.size > 0;
    if (!isBoardPage() || !needLookup) return;
    const myToken = runToken;
    const rows = topicRows();
    if (!rows.length) return;
    cleanupLegacyAuthorPresentation(document);
    const cache = await loadCacheOnce();
    if (myToken !== runToken) return;

    const jobsByKey = new Map();
    for (const row of rows) {
      const link = row.querySelector('a.blst_title[href*="/topic"]');
      const url = cleanTopicUrl(link?.getAttribute("href") || "");
      if (!url) continue;
      const key = topicKey(url);
      const cached = cache[key];
      if (cached?.author) {
        if (!cached.profileKey && cached.profileHref) cached.profileKey = normalizeProfileKey(cached.profileHref);
        applyDataToRow(row, cached);
        const hasEnoughForDisplay = !modeNeedsAuthorPresentation() || Boolean(cached.avatarUrl);
        const hasEnoughForBlock = !blockedKeys.size || Boolean(cached.profileKey || cached.profileHref);
        if (hasEnoughForDisplay && hasEnoughForBlock) continue;
      } else {
        row.classList.remove(BLOCKED_ROW_CLASS);
        if (authorMode === "original") restoreNativeLast(row);
      }
      if (!jobsByKey.has(key)) jobsByKey.set(key, { key, url, rows: [] });
      jobsByKey.get(key).rows.push(row);
    }

    const jobs = [...jobsByKey.values()];
    if (!jobs.length) return;
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const index = nextIndex++;
        if (index >= jobs.length) return;
        const job = jobs[index];
        try {
          const result = await fetchAuthor(job.url);
          cacheMemory[job.key] = result;
          queueCacheWrite();
          if (myToken === runToken && isBoardPage()) {
            job.rows.forEach((row) => row.isConnected && applyDataToRow(row, result));
          }
        } catch (error) {
          console.warn("[Bombacha] Falha ao buscar autor original:", job.url, error);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, jobs.length) }, worker));
  }

  function requestPopulate() {
    const needLookup = modeNeedsAuthorPresentation() || blockedKeys.size > 0;
    if (!needLookup || !isBoardPage()) return;
    if (populatePromise) {
      populateAgain = true;
      return;
    }
    populateAgain = false;
    populatePromise = populateVisibleRows()
      .catch(() => {})
      .finally(() => {
        populatePromise = null;
        if (populateAgain && isBoardPage()) {
          populateAgain = false;
          setTimeout(requestPopulate, 10);
        }
      });
  }

  function refreshFeature() {
    document.getElementById(OLD_BUTTON_ID)?.remove();
    if (!isBoardPage()) {
      cleanupLegacyAuthorPresentation(document);
      clearBlockedPresentation();
      return;
    }
    ensureStyle();
    cleanupLegacyAuthorPresentation(document);
    if (authorMode === "original") topicRows().forEach(restoreNativeLast);
    if (!blockedKeys.size) clearBlockedPresentation();
    requestPopulate();
  }

  function scheduleRefresh(delay = 35) {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      refreshFeature();
    }, delay);
  }

  async function loadSettings() {
    const result = await storageGet({ [MODE_KEY]: null, [LEGACY_ENABLED_KEY]: null, [BLOCKED_KEY]: [] });
    authorMode = normalizeMode(result?.[MODE_KEY], result?.[LEGACY_ENABLED_KEY] !== false);
    if (!VALID_MODES.has(String(result?.[MODE_KEY] || "").toLowerCase())) {
      await storageSet({
        [MODE_KEY]: authorMode,
        [LEGACY_ENABLED_KEY]: authorMode !== "original"
      }).catch(() => {});
    }
    setBlockedEntries(result?.[BLOCKED_KEY]);
    await loadCacheOnce();
    refreshFeature();
  }

  const observer = new MutationObserver(() => scheduleRefresh(35));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  api.storage.onChanged?.addListener?.((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes?.[MODE_KEY]) {
      authorMode = normalizeMode(changes[MODE_KEY].newValue, true);
      runToken++;
      removeAuthorPresentation();
      refreshFeature();
    } else if (changes?.[LEGACY_ENABLED_KEY] && !changes?.[MODE_KEY]) {
      authorMode = changes[LEGACY_ENABLED_KEY].newValue === false ? "original" : "author";
      runToken++;
      removeAuthorPresentation();
      refreshFeature();
    }
    if (changes?.[BLOCKED_KEY]) {
      setBlockedEntries(changes[BLOCKED_KEY].newValue);
      clearBlockedPresentation();
      refreshFeature();
    }
    if (changes?.[CACHE_KEY]) {
      const value = changes[CACHE_KEY].newValue;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        cacheMemory = value;
        cacheLoaded = true;
        scheduleRefresh(0);
      }
    }
  });

  window.addEventListener("popstate", () => scheduleRefresh(10), true);
  window.addEventListener("pageshow", () => scheduleRefresh(0), true);
  window.addEventListener("bombacha:forum-refreshed", () => {
    runToken++;
    scheduleRefresh(0);
  }, true);

  document.addEventListener("click", (event) => {
    const forcedLast = event.target?.closest?.(`a.${AUTHOR_APPLIED_CLASS}[data-bombacha-last-href]`);
    if (forcedLast && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const href = forcedLast.dataset.bombachaLastHref || forcedLast.getAttribute("href") || "";
      if (href) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        try {
          location.assign(new URL(href, location.origin).href);
        } catch (_) {
          location.href = href;
        }
        return;
      }
    }
    const link = event.target?.closest?.('a[href*="/board"], a[href*="/topic"]');
    if (link) setTimeout(() => scheduleRefresh(0), 180);
  }, true);

  // Reconciliador leve: reaplica usando o cache sem reconstruir cartões já corretos.
  setInterval(() => {
    if (isBoardPage()) refreshFeature();
  }, 450);

  document.getElementById(OLD_BUTTON_ID)?.remove();
  loadSettings().catch(() => {
    authorMode = "author";
    setBlockedEntries([]);
    refreshFeature();
  });
})();
