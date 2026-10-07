(function () {
  let theme;
  try {
    theme = localStorage.getItem("partygame:theme");
  } catch {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
