(() => {
  "use strict";
  if (globalThis.__bombachaMobileForumUIV1) return;
  globalThis.__bombachaMobileForumUIV1 = true;

  const BUTTON_ID = "bombacha-mobile-board-refresh";
  const STYLE_ID = "bombacha-mobile-board-refresh-style";
  let timer = null;

  function isBoardContext() {
    if (/^\/board-?\d+\/?$/i.test(location.pathname)) return true;
    const q = new URLSearchParams(location.search);
    return /board/i.test(q.get("act") || "") || /^board-?\d+/i.test(q.get("w") || "");
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest("#spa_global_root_skeleton_content, [hidden], [aria-hidden='true']")) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:34px!important;
        height:34px!important;
        margin-left:6px!important;
        padding:0!important;
        border:0!important;
        border-radius:50%!important;
        background:transparent!important;
        color:var(--vkui--color_icon_accent_themed,var(--vkui--color_text_link,#2688eb))!important;
        font:400 27px/34px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
        cursor:pointer!important;
        vertical-align:middle!important;
        -webkit-tap-highlight-color:transparent!important;
      }
      #${BUTTON_ID}:active{background:var(--vkui--color_background_secondary,rgba(0,0,0,.06))!important}
      #${BUTTON_ID}[data-loading="1"]{animation:bombachaMobileSpin .65s linear infinite}
      @keyframes bombachaMobileSpin{to{transform:rotate(360deg)}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function titleCandidates() {
    const selectors = [
      ".vkuiPanelHeader__contentIn",
      "[class*='PanelHeader'] [class*='contentIn']",
      "h1", "h2", "h3", "span", "div"
    ];
    const seen = new Set();
    const result = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text !== "Discussões" || !visible(el)) continue;
        result.push(el);
      }
    }
    return result;
  }

  function addRefreshButton() {
    if (!isBoardContext()) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }
    const existing = document.getElementById(BUTTON_ID);
    if (existing && visible(existing)) return;
    existing?.remove();

    const title = titleCandidates()[0];
    if (!title) return;
    ensureStyle();

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "↻";
    button.title = "Atualizar tópicos";
    button.setAttribute("aria-label", "Atualizar tópicos");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.dataset.loading = "1";
      button.disabled = true;
      setTimeout(() => location.reload(), 40);
    });

    title.insertAdjacentElement("afterend", button);
  }

  function schedule(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(addRefreshButton, delay);
  }

  new MutationObserver(() => schedule(100)).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("pageshow", () => schedule(20));
  addEventListener("popstate", () => schedule(20));
  document.addEventListener("DOMContentLoaded", () => schedule(20), { once: true });
  schedule(20);
})();
