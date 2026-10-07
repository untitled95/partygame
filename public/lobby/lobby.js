(function () {
  const cards = [...document.querySelectorAll("[data-game]")];
  const search = document.getElementById("game-search");
  const filters = [...document.querySelectorAll("[data-filter]")];
  const dialog = document.getElementById("random-dialog");
  let filter = "all";
  let lastPick = null;

  function applyFilter(announce = true) {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = cards.filter((card) => {
      const matches =
        (filter === "all" || card.dataset.mode === filter) &&
        card.dataset.search.toLocaleLowerCase().includes(query);
      card.hidden = !matches;
      return matches;
    });
    document.querySelectorAll(".game-section").forEach((section) => {
      section.hidden = !section.querySelector("[data-game]:not([hidden])");
    });
    document.getElementById("game-count").textContent = visible.length;
    document.getElementById("empty-state").hidden = visible.length > 0;
    if (announce)
      document.getElementById("filter-status").textContent =
        "找到 " + visible.length + " 款游戏";
    filters.forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      applyFilter();
    }),
  );
  search.addEventListener("input", () => applyFilter());
  document.getElementById("reset-search").addEventListener("click", () => {
    filter = "all";
    search.value = "";
    applyFilter();
    search.focus();
  });
  document.querySelectorAll(".main-nav a, .hero-actions a").forEach((link) => {
    link.addEventListener("click", () => {
      if (
        !["#multiplayer", "#solo", "#games"].includes(link.getAttribute("href"))
      )
        return;
      filter = "all";
      search.value = "";
      applyFilter(false);
    });
  });

  function pickGame() {
    // Respect category selection; search text does not limit the surprise pick.
    let pool = cards.filter(
      (card) => filter === "all" || card.dataset.mode === filter,
    );
    if (pool.length > 1) pool = pool.filter((card) => card !== lastPick);
    const card = pool[Math.floor(Math.random() * pool.length)];
    lastPick = card;
    document.getElementById("random-title").textContent = card.dataset.title;
    document.getElementById("random-description").textContent =
      card.dataset.description;
    document.getElementById("random-people").textContent =
      card.dataset.people +
      (card.dataset.mode === "solo" ? " · 单人小游戏" : " · 多人联机");
    document.getElementById("recommendation-icon").src =
      "/lobby/assets/" + card.dataset.icon + ".svg";
    document.getElementById("random-link").href = card.getAttribute("href");
    const art = document.querySelector(".recommendation-art");
    art.classList.remove("roll");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => art.classList.add("roll")),
    );
  }
  document.getElementById("random-pick").addEventListener("click", () => {
    pickGame();
    dialog.showModal();
  });
  document.getElementById("reroll").addEventListener("click", pickGame);
  document
    .getElementById("close-random")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });

  const themeButton = document.getElementById("theme-toggle");
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  let manualTheme = false;
  try {
    manualTheme = ["light", "dark"].includes(
      localStorage.getItem("partygame:theme"),
    );
  } catch {}
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === "dark";
    themeButton.setAttribute(
      "aria-label",
      dark ? "切换浅色模式" : "切换深色模式",
    );
    themeButton.querySelector("img").src =
      "/lobby/assets/" + (dark ? "sun" : "moon") + ".svg";
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#19191b"
      : "#f8f8f6";
  }
  themeButton.addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    manualTheme = true;
    try {
      localStorage.setItem("partygame:theme", theme);
    } catch {}
    updateThemeButton();
  });
  themeMedia.addEventListener("change", (event) => {
    if (!manualTheme) {
      document.documentElement.dataset.theme = event.matches ? "dark" : "light";
      updateThemeButton();
    }
  });
  updateThemeButton();
  applyFilter(false);
  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    cards.forEach((card) => observer.observe(card));
    window.addEventListener("pagehide", () => observer.disconnect(), {
      once: true,
    });
  }
})();
