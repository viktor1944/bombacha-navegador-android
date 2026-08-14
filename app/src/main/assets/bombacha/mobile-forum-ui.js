(() => {
  "use strict";
  if (globalThis.__bombachaMobileForumUIV2) return;
  globalThis.__bombachaMobileForumUIV2 = true;

  const BUTTON_ID = "bombacha-mobile-board-refresh";
  const STYLE_ID = "bombacha-mobile-board-refresh-style-v2";
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
    return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
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
        flex:0 0 auto!important;
        min-width:0!important;
        height:34px!important;
        margin:0 8px 0 2px!important;
        padding:0 9px!important;
        border:0!important;
        border-radius:17px!important;
        background:transparent!important;
        color:var(--vkui--color_text_link,#2688eb)!important;
        font:500 12.5px/34px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
        white-space:nowrap!important;
        cursor:pointer!important;
        -webkit-tap-highlight-color:transparent!important;
      }
      #${BUTTON_ID}:active{background:var(--vkui--color_background_secondary,rgba(0,0,0,.06))!important}
      #${BUTTON_ID}[data-loading="1"]{opacity:.6!important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function findVisibleHeader() {
    const titles = document.querySelectorAll(".vkuiPanelHeader__contentIn, [class*='PanelHeader'] [class*='contentIn']");
    for (const title of titles) {
      if (!visible(title)) continue;
      if ((title.textContent || "").replace(/\s+/g, " ").trim() !== "Discussões") continue;
      const host = title.closest(".vkuiPanelHeader__host, [class*='PanelHeader']");
      const inner = host?.querySelector(".vkuiPanelHeader__in") || title.parentElement?.parentElement;
      if (!inner || !visible(inner)) continue;
      return { title, host, inner };
    }
    return null;
  }

  function getTarget(header) {
    let after = header.host?.querySelector(".vkuiPanelHeader__after");
    if (after && visible(after)) return after;
    if (after) return after;

    after = document.createElement("div");
    after.className = "vkuiPanelHeader__after bombacha-mobile-header-after";
    after.style.display = "flex";
    after.style.alignItems = "center";
    header.inner.appendChild(after);
    return after;
  }

  function addRefreshButton() {
    const old = document.getElementById(BUTTON_ID);
    if (!isBoardContext()) {
      old?.remove();
      return;
    }

    const header = findVisibleHeader();
    if (!header) return;
    const target = getTarget(header);
    if (!target) return;

    if (old?.isConnected && target.contains(old)) return;
    old?.remove();
    ensureStyle();

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "↻ Atualizar";
    button.title = "Atualizar tópicos";
    button.setAttribute("aria-label", "Atualizar tópicos");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset.loading === "1") return;
      button.dataset.loading = "1";
      button.textContent = "↻ Atualizando";
      setTimeout(() => location.reload(), 60);
    });
    target.prepend(button);
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
