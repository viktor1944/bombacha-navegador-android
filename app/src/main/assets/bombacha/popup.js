(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const MODE_KEY = "bombachaTopicAuthorsModeV1";
  const LEGACY_ENABLED_KEY = "bombachaTopicAuthorsEnabledV1";
  const authors = document.getElementById("authors");
  const version = document.getElementById("version");

  try { version.textContent = `Android ${api.runtime.getManifest().version}`; } catch (_) {}

  api.storage.local.get({ [MODE_KEY]: "author", [LEGACY_ENABLED_KEY]: true }).then((data) => {
    authors.checked = String(data[MODE_KEY] || "author") !== "original" && data[LEGACY_ENABLED_KEY] !== false;
  }).catch(() => {});

  authors.addEventListener("change", () => {
    const enabled = authors.checked;
    api.storage.local.set({
      [MODE_KEY]: enabled ? "author" : "original",
      [LEGACY_ENABLED_KEY]: enabled
    }).catch(() => {});
  });

  document.querySelectorAll("button[data-url]").forEach((button) => {
    button.addEventListener("click", () => {
      const url = button.dataset.url;
      if (!url) return;
      api.tabs.create({ url }).catch(() => { location.href = url; });
    });
  });
})();
