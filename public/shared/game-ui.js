(function () {
  const root = document.documentElement;
  const button = document.getElementById("play-theme");
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let manual = false;
  try {
    manual = ["light", "dark"].includes(
      localStorage.getItem("partygame:theme"),
    );
  } catch {}
  function refresh() {
    const dark = root.dataset.theme === "dark";
    button.setAttribute("aria-label", dark ? "切换浅色模式" : "切换深色模式");
    button.querySelector("img").src =
      "/lobby/assets/" + (dark ? "sun" : "moon") + ".svg";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#19191b" : "#f8f8f6";
  }
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    manual = true;
    try {
      localStorage.setItem("partygame:theme", root.dataset.theme);
    } catch {}
    refresh();
  });
  system.addEventListener("change", (event) => {
    if (!manual) {
      root.dataset.theme = event.matches ? "dark" : "light";
      refresh();
    }
  });
  refresh();
  window.addEventListener("storage", (event) => {
    if (event.key !== "partygame:theme") return;
    manual = ["light", "dark"].includes(event.newValue);
    root.dataset.theme = manual
      ? event.newValue
      : system.matches ? "dark" : "light";
    refresh();
  });
  // A new room/game view starts at its heading, including after a mobile form scroll.
  let activeScreen = document.querySelector(".screen.active");
  const screenObserver = new MutationObserver(() => {
    const nextScreen = document.querySelector(".screen.active");
    if (!nextScreen || nextScreen === activeScreen) return;
    activeScreen = nextScreen;
    const heading = nextScreen.querySelector("h1") || nextScreen;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  document.querySelectorAll(".screen").forEach((screen) => {
    screenObserver.observe(screen, { attributes: true, attributeFilter: ["class"] });
  });
  // Keep keyboard focus inside an open dialog and restore it when it closes.
  document.querySelectorAll(".modal").forEach((modal, index) => {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.tabIndex = -1;
    const heading = modal.querySelector("h2, h3");
    if (heading) {
      if (!heading.id) heading.id = `game-dialog-title-${index}`;
      modal.setAttribute("aria-labelledby", heading.id);
    }
    let previousFocus = null;
    const controls = () => [...modal.querySelectorAll(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
    )].filter((element) => element.getClientRects().length);
    new MutationObserver(() => {
      if (!modal.classList.contains("hidden")) {
        previousFocus = document.activeElement;
        (controls()[0] || modal).focus({ preventScroll: true });
      } else if (previousFocus?.isConnected && previousFocus.getClientRects().length) {
        previousFocus.focus({ preventScroll: true });
        previousFocus = null;
      }
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const close = modal.querySelector(".close-modal, .close-player-select");
        if (close) close.click();
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
        event.preventDefault();
        first.focus();
      }
    });
  });
  // Existing game scripts own state. Only add keyboard semantics and labels here.
  const reaction = document.getElementById("reaction-zone");
  if (reaction)
    reaction.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reaction.click();
      }
    });
  document
    .querySelectorAll("input:not([type=range]), select")
    .forEach((input) => {
      if (!input.labels?.length && !input.hasAttribute("aria-label")) {
        input.setAttribute(
          "aria-label",
          input.placeholder ||
            input.closest(".setting-item")?.querySelector("label")
              ?.textContent ||
            "游戏设置",
        );
      }
    });
  const brush = document.getElementById("brush-size");
  if (brush) brush.setAttribute("aria-label", "画笔粗细");
  const scores = document.getElementById("show-scores-btn");
  if (scores) {
    scores.textContent = "积分";
    scores.setAttribute("aria-label", "查看积分");
  }
  const rules = document.getElementById("rules-btn");
  if (rules) {
    rules.textContent = "规则";
    rules.setAttribute("aria-label", "查看游戏规则");
  }
  const eraser = document.getElementById("eraser-btn");
  if (eraser) {
    eraser.textContent = "擦除";
    eraser.setAttribute("aria-label", "橡皮擦");
  }
  const clear = document.getElementById("clear-canvas-btn");
  if (clear) {
    clear.textContent = "清空";
    clear.setAttribute("aria-label", "清空画布");
  }
  document.querySelectorAll(".color-btn").forEach((swatch) => {
    swatch.setAttribute("role", "button");
    swatch.tabIndex = 0;
    swatch.setAttribute("aria-label", "画笔颜色 " + swatch.dataset.color);
    swatch.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        swatch.click();
      }
    });
  });
})();
