(() => {
  "use strict";
  if (globalThis.__bombachaMobileAuthorFallbackV2) return;
  globalThis.__bombachaMobileAuthorFallbackV2 = true;

  const api = globalThis.browser || globalThis.chrome;
  if (!api?.storage?.local) return;

  const MODE_KEY = "bombachaTopicAuthorsModeV1";
  const LEGACY_ENABLED_KEY = "bombachaTopicAuthorsEnabledV1";
  const CACHE_KEY = "bombachaTopicAuthorCacheV1";
  const STYLE_ID = "bombacha-mobile-author-fallback-style";
  const MARK_CLASS = "bombacha-mobile-topic-author";
  const pending = new Map();
  let cache = {};
  let mode = "author";
  let scanTimer = null;
  let active = 0;
  const queue = [];
  const MAX_CONCURRENCY = 3;

  function getStorage(defaults) { return api.storage.local.get(defaults); }
  function setStorage(value) { return api.storage.local.set(value); }

  function isBoardContext() {
    if (/^\/board-?\d+\/?$/i.test(location.pathname)) return true;
    const q = new URLSearchParams(location.search);
    return /board/i.test(q.get("act") || "") || /^board-?\d+/i.test(q.get("w") || "");
  }

  function desktopBoardPresent() {
    return Boolean(document.querySelector("#blst_cont .blst_row"));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${MARK_CLASS}{
        position:absolute!important;
        right:16px!important;
        bottom:8px!important;
        z-index:2!important;
        max-width:36%!important;
        padding-left:6px!important;
        overflow:hidden!important;
        white-space:nowrap!important;
        text-overflow:ellipsis!important;
        background:var(--vkui--color_background_content,#fff)!important;
        color:var(--vkui--color_text_secondary,#818c99)!important;
        font:400 10.5px/16px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
        letter-spacing:0!important;
        text-transform:none!important;
        pointer-events:none!important;
      }
      .bombacha-mobile-topic-row{position:relative!important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function topicInfo(anchor) {
    try {
      const url = new URL(anchor.href, location.origin);
      const m = url.pathname.match(/^\/topic(-?\d+_\d+)/i);
      if (!m) return null;
      return { id: m[1], url: url.href };
    } catch (_) { return null; }
  }

  function candidateTopicLinks() {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/topic"]')) {
      const info = topicInfo(a);
      if (!info || seen.has(info.id)) continue;
      const text = (a.textContent || "").trim();
      if (text.length < 2) continue;
      seen.add(info.id);
      out.push({ anchor: a, ...info });
    }
    return out;
  }

  function authorFromDocument(doc, topicUrl) {
    const firstPost = doc.querySelector("#legacy_content #bt_rows .bp_post, #bt_rows .bp_post, .bt_rows .bp_post, .bp_post, .wall_item, article, [data-post-id]");
    if (!firstPost) return null;

    const candidates = [
      ".bp_author",
      ".pi_author",
      ".post_author",
      "[class*='author'] a[href]",
      "a[data-from-id]",
      "a[href^='/id']",
      "a[href^='/club']",
      "a[href^='/public']"
    ];
    let link = null;
    for (const selector of candidates) {
      link = firstPost.querySelector(selector);
      if (link && (link.textContent || "").trim()) break;
    }
    if (!link) return null;

    const name = (link.textContent || "").trim();
    let profileHref = link.getAttribute("href") || "";
    try { profileHref = new URL(profileHref, topicUrl).href; } catch (_) {}

    const img = firstPost.querySelector(".bp_img, img[class*='avatar'], img[alt*='avatar' i], img");
    let avatarUrl = img?.getAttribute("src") || "";
    try { if (avatarUrl) avatarUrl = new URL(avatarUrl, topicUrl).href; } catch (_) {}
    return { name, profileHref, avatarUrl, fetchedAt: Date.now() };
  }

  function desktopTopicCandidates(item) {
    const out = [];
    try {
      const original = new URL(item.url, location.origin);
      const suffix = `${original.pathname}${original.search || ""}`;
      out.push(`https://vk.ru${suffix}`);
      out.push(`https://vk.com${suffix}`);
      out.push(original.href);
    } catch (_) {
      out.push(item.url);
    }
    return [...new Set(out)];
  }

  async function fetchAuthor(item) {
    let lastError = null;
    for (const url of desktopTopicCandidates(item)) {
      try {
        const response = await fetch(url, { credentials: "include", cache: "no-store", redirect: "follow" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const data = authorFromDocument(doc, response.url || url);
        if (!data?.name) throw new Error("Autor não encontrado no HTML");

        cache[item.id] = data;
        const entries = Object.entries(cache);
        if (entries.length > 5000) {
          entries.sort((a,b) => (b[1]?.fetchedAt || 0) - (a[1]?.fetchedAt || 0));
          cache = Object.fromEntries(entries.slice(0, 5000));
        }
        setStorage({ [CACHE_KEY]: cache }).catch(() => {});
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Autor não encontrado");
  }

  function rowContainer(anchor) {
    if (!anchor) return null;
    const viewport = Math.max(document.documentElement.clientWidth || 0, innerWidth || 0);
    let el = anchor.parentElement;
    let fallback = el;
    for (let depth = 0; el && el !== document.body && depth < 7; depth++, el = el.parentElement) {
      const rect = el.getBoundingClientRect();
      const topicLinks = el.querySelectorAll?.('a[href*="/topic"]')?.length || 0;
      if (rect.width >= viewport * .78 && rect.height >= 48 && rect.height <= 180 && topicLinks === 1) return el;
      if (rect.width >= viewport * .7 && rect.height >= 42 && rect.height <= 200) fallback = el;
    }
    return fallback || anchor.parentElement;
  }

  function currentTopicId() {
    const pathMatch = location.pathname.match(/^\/topic(-?\d+_\d+)/i);
    if (pathMatch) return pathMatch[1];
    const w = new URLSearchParams(location.search).get("w") || "";
    const wMatch = w.match(/^topic(-?\d+_\d+)/i);
    return wMatch ? wMatch[1] : "";
  }

  function visibleProfileLinkCandidates(root = document) {
    return [...root.querySelectorAll('a[href]')].filter((a) => {
      if (!a.isConnected || a.closest('#spa_global_root_skeleton_content, [hidden], [aria-hidden="true"]')) return false;
      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 80) return false;
      let path = "";
      try { path = new URL(a.href, location.origin).pathname; } catch (_) { return false; }
      if (/^\/(?:id\d+|[A-Za-z][A-Za-z0-9_.-]{2,}|club\d+|public\d+)\/?$/i.test(path)) {
        const rect = a.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }
      return false;
    });
  }

  function captureOpenTopicAuthor() {
    const id = currentTopicId();
    if (!id) return;
    const candidates = visibleProfileLinkCandidates();
    if (!candidates.length) return;

    // Em tópicos mobile o primeiro nome de perfil visível dentro da área de conteúdo
    // costuma ser o autor da primeira mensagem. Evita cabeçalho/menu pelo eixo Y.
    const ranked = candidates
      .map((a) => ({ a, rect: a.getBoundingClientRect() }))
      .filter((x) => x.rect.top > 40)
      .sort((x, y) => x.rect.top - y.rect.top);
    const link = ranked[0]?.a;
    if (!link) return;
    const name = (link.textContent || "").replace(/\s+/g, " ").trim();
    if (!name) return;
    const data = { name, profileHref: link.href, avatarUrl: "", fetchedAt: Date.now() };
    if (cache[id]?.name === name) return;
    cache[id] = data;
    setStorage({ [CACHE_KEY]: cache }).catch(() => {});
  }

  function render(item, data) {
    if (!item.anchor?.isConnected || mode === "original" || !data?.name) return;
    ensureStyle();
    const row = rowContainer(item.anchor);
    if (!row) return;
    row.classList.add("bombacha-mobile-topic-row");
    let mark = row.querySelector(`:scope > .${MARK_CLASS}[data-topic-id="${CSS.escape(item.id)}"]`);
    if (!mark) {
      mark = document.createElement("span");
      mark.className = MARK_CLASS;
      mark.dataset.topicId = item.id;
      row.appendChild(mark);
    }
    mark.textContent = data.name;
    mark.title = `Autor original: ${data.name}`;
    mark.dataset.state = "ready";
  }

  function enqueue(item) {
    if (pending.has(item.id) || cache[item.id]) return;
    pending.set(item.id, true);
    queue.push(item);
    pump();
  }

  function pump() {
    while (active < MAX_CONCURRENCY && queue.length) {
      const item = queue.shift();
      active++;
      fetchAuthor(item)
        .then(data => render(item, data))
        .catch(() => {})
        .finally(() => {
          active--;
          pending.delete(item.id);
          pump();
        });
    }
  }

  function scan() {
    captureOpenTopicAuthor();
    if (!isBoardContext() || desktopBoardPresent() || mode === "original") return;
    for (const item of candidateTopicLinks()) {
      if (cache[item.id]?.name) render(item, cache[item.id]);
      else enqueue(item);
    }
  }

  function schedule(delay = 100) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  async function init() {
    const result = await getStorage({ [MODE_KEY]: null, [LEGACY_ENABLED_KEY]: null, [CACHE_KEY]: {} });
    const savedMode = String(result?.[MODE_KEY] || "").toLowerCase();
    mode = ["author", "original", "both"].includes(savedMode)
      ? savedMode
      : result?.[LEGACY_ENABLED_KEY] === false ? "original" : "author";
    cache = result?.[CACHE_KEY] && typeof result[CACHE_KEY] === "object" ? result[CACHE_KEY] : {};
    scan();
  }

  api.storage.onChanged?.addListener?.((changes, area) => {
    if (area !== "local") return;
    if (changes[MODE_KEY]) {
      mode = String(changes[MODE_KEY].newValue || "author");
      if (mode === "original") {
        document.querySelectorAll(`.${MARK_CLASS}`).forEach(el => el.remove());
        document.querySelectorAll(".bombacha-mobile-topic-row").forEach(el => el.classList.remove("bombacha-mobile-topic-row"));
      }
      else schedule(0);
    }
    if (changes[CACHE_KEY]?.newValue && typeof changes[CACHE_KEY].newValue === "object") {
      cache = changes[CACHE_KEY].newValue;
      schedule(0);
    }
  });

  new MutationObserver(() => schedule(120)).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("pageshow", () => schedule(20));
  addEventListener("popstate", () => schedule(20));
  init().catch(() => {});
  setInterval(scan, 2500);
})();
