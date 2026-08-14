(() => {
  "use strict";
  if (globalThis.__bombachaSocialEmbedsMobileV1) return;
  globalThis.__bombachaSocialEmbedsMobileV1 = true;

  const EMBED_CLASS = "bombacha-social-embed-mobile";
  const STYLE_ID = "bombacha-social-embed-mobile-style";
  const PROCESSED_ATTR = "data-bombacha-embed-processed";
  let scanTimer = null;
  let currentTopicKey = "";

  function isTopicContext() {
    if (/^\/topic-?\d+_\d+/i.test(location.pathname)) return true;
    const w = new URLSearchParams(location.search).get("w") || "";
    return /^topic-?\d+_\d+/i.test(w);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${EMBED_CLASS}{display:block;width:100%;max-width:100%;margin:10px 0 6px;box-sizing:border-box;overflow:hidden}
      .${EMBED_CLASS} iframe{display:block;width:100%;max-width:100%;border:0;border-radius:10px;box-sizing:border-box;background:#000}
      .${EMBED_CLASS}[data-kind="youtube"] iframe{aspect-ratio:16/9;min-height:180px}
      .${EMBED_CLASS}[data-kind="instagram"] iframe{height:min(680px,78vh);background:transparent}
      .${EMBED_CLASS}[data-kind="x"] iframe{height:min(520px,70vh);background:transparent}
      .${EMBED_CLASS}[data-kind="tiktok"] iframe{width:min(100%,440px);height:min(760px,78vh);margin:0 auto;background:#000}
      .${EMBED_CLASS}[data-kind="vocaroo"] iframe{height:60px;background:transparent}
      .bombacha-mobile-embed-fallback{display:inline-block;margin-top:5px;font-size:12px;color:var(--vkui--color_text_link,#2a5885);text-decoration:none}
      @media (max-width:420px){.${EMBED_CLASS}[data-kind="youtube"] iframe{min-height:170px}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function decodeAwayUrl(rawHref, title = "") {
    for (const candidate of [title, rawHref].filter(Boolean)) {
      try {
        const url = new URL(candidate, location.origin);
        if (/\/away\.php$/i.test(url.pathname)) {
          const to = url.searchParams.get("to");
          if (to) return decodeURIComponent(to);
        }
        if (/^https?:$/i.test(url.protocol)) return url.href;
      } catch (_) {
        try {
          const decoded = decodeURIComponent(String(candidate));
          const url = new URL(decoded, location.origin);
          if (/^https?:$/i.test(url.protocol)) return url.href;
        } catch (_) {}
      }
    }
    return "";
  }

  function mediaFromUrl(value) {
    let url;
    try { url = new URL(value); } catch (_) { return null; }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      if (/^[\w-]{6,}$/.test(id)) return { kind: "youtube", id, original: url.href };
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      let id = "";
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else {
        const m = url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/i);
        if (m) id = m[1];
      }
      if (/^[\w-]{6,}$/.test(id)) return { kind: "youtube", id, original: url.href };
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      const m = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
      if (m) return { kind: "instagram", type: m[1].toLowerCase(), id: m[2], original: url.href };
    }
    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const m = url.pathname.match(/^\/[^/]+\/status\/(\d+)/i);
      if (m) return { kind: "x", id: m[1], original: url.href };
    }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      const post = url.pathname.match(/^\/@[^/]+\/(?:video|photo)\/(\d+)/i);
      const player = url.pathname.match(/^\/player\/v1\/(\d+)/i);
      const id = post?.[1] || player?.[1] || "";
      if (/^\d{8,}$/.test(id)) return { kind: "tiktok", id, original: url.href };
    }
    if (host === "vocaroo.com" || host.endsWith(".vocaroo.com") || host === "voca.ro") {
      const m = url.pathname.match(/^\/(?:embed\/)?([A-Za-z0-9_-]{6,})\/?$/i);
      if (m) return { kind: "vocaroo", id: m[1], original: url.href };
    }
    return null;
  }

  function keyFor(media) { return `${media.kind}:${media.id}`; }

  function makeFrame(media) {
    const frame = document.createElement("iframe");
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    if (media.kind === "youtube") {
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.id)}?rel=0`;
      frame.title = "Vídeo do YouTube";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    } else if (media.kind === "instagram") {
      frame.src = `https://www.instagram.com/${media.type}/${encodeURIComponent(media.id)}/embed/`;
      frame.title = "Publicação do Instagram";
      frame.allow = "encrypted-media; picture-in-picture";
    } else if (media.kind === "x") {
      const dark = document.documentElement.getAttribute("scheme")?.includes("dark") || matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      frame.src = `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(media.id)}&dnt=true&theme=${dark ? "dark" : "light"}`;
      frame.title = "Publicação do X";
    } else if (media.kind === "tiktok") {
      frame.src = `https://www.tiktok.com/player/v1/${encodeURIComponent(media.id)}?autoplay=0&controls=1`;
      frame.title = "Publicação do TikTok";
      frame.allow = "fullscreen; autoplay; encrypted-media; picture-in-picture";
    } else if (media.kind === "vocaroo") {
      frame.src = `https://vocaroo.com/embed/${encodeURIComponent(media.id)}`;
      frame.title = "Áudio do Vocaroo";
      frame.allow = "autoplay";
    }
    return frame;
  }

  function isActuallyVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest(`#legacy_content, #spa_global_root_skeleton, [hidden], [aria-hidden="true"]`)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  }

  function postContainer(anchor) {
    return anchor.closest(
      ".bp_post, .bp_content, .bp_text, .pi, .pi_text, .wall_item, .wall_text, .post, .post_content, article, [data-post-id], [data-testid*='post' i]"
    ) || anchor.parentElement;
  }

  function hasEmbedAnywhere(key) {
    return [...document.querySelectorAll(`.${EMBED_CLASS}`)]
      .some(el => el.dataset.embedKey === key && el.isConnected && isActuallyVisible(el));
  }

  function insertEmbed(anchor, media) {
    const key = keyFor(media);
    if (!anchor?.isConnected) return;
    if (anchor.getAttribute(PROCESSED_ATTR) === key) return;

    // Marca ANTES de alterar o DOM. Assim o MutationObserver disparado pela
    // própria inserção nunca consegue processar o mesmo link novamente.
    anchor.setAttribute(PROCESSED_ATTR, key);

    if (!isActuallyVisible(anchor)) return;
    if (anchor.closest(`.${EMBED_CLASS}`)) return;

    // O VK mobile mantém cópias/árvores auxiliares do mesmo conteúdo durante
    // transições SPA. Para evitar dezenas de players idênticos, um mesmo ID
    // de mídia só recebe um embed visível por tópico.
    if (hasEmbedAnywhere(key)) return;

    const container = postContainer(anchor);
    if (!container) return;

    ensureStyle();
    const wrap = document.createElement("div");
    wrap.className = EMBED_CLASS;
    wrap.dataset.kind = media.kind;
    wrap.dataset.embedKey = key;
    wrap.appendChild(makeFrame(media));

    if (media.kind !== "youtube") {
      const fallback = document.createElement("a");
      fallback.className = "bombacha-mobile-embed-fallback";
      fallback.href = media.original;
      fallback.target = "_blank";
      fallback.rel = "noopener noreferrer";
      fallback.textContent = media.kind === "instagram" ? "Abrir no Instagram" : media.kind === "x" ? "Abrir no X" : media.kind === "tiktok" ? "Abrir no TikTok" : "Abrir no Vocaroo";
      wrap.appendChild(fallback);
    }

    const target = container.matches(".bp_text, .pi_text, .wall_text, .post_content") ? container : anchor;
    target.insertAdjacentElement("afterend", wrap);
  }

  function topicKey() {
    const w = new URLSearchParams(location.search).get("w") || "";
    return `${location.pathname}|${w}`;
  }

  function scan() {
    if (!isTopicContext()) return;
    const nextTopicKey = topicKey();
    if (nextTopicKey !== currentTopicKey) {
      currentTopicKey = nextTopicKey;
      document.querySelectorAll(`.${EMBED_CLASS}`).forEach(el => el.remove());
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
    }

    const anchors = document.querySelectorAll('a[href], a[title]');
    for (const anchor of anchors) {
      if (!isActuallyVisible(anchor) || anchor.closest(`.${EMBED_CLASS}`)) continue;
      const resolved = decodeAwayUrl(anchor.getAttribute("href") || "", anchor.getAttribute("title") || "");
      const media = mediaFromUrl(resolved);
      if (media) insertEmbed(anchor, media);
    }
  }

  function schedule(delay = 80) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  new MutationObserver((mutations) => {
    // Só reage quando o VK realmente acrescenta/remove nós. Inserções feitas
    // pela Bombacha são neutralizadas pelo atributo PROCESSED_ATTR acima.
    if (mutations.some(m => m.addedNodes.length || m.removedNodes.length)) schedule(120);
  }).observe(document.documentElement, { childList: true, subtree: true });

  addEventListener("pageshow", () => schedule(30));
  addEventListener("popstate", () => schedule(30));
  document.addEventListener("DOMContentLoaded", () => schedule(20), { once: true });
  schedule(20);
})();
