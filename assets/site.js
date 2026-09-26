// Shared by every page: the dark/light switch in the site bar.
// Dark is the default. The choice is saved per browser and applied before first paint
// by a one-line script in each page's <head>, so there's no flash of the wrong theme.
(() => {
  const KEY = "prc-theme";
  const root = document.documentElement;
  const current = () => (root.dataset.theme === "light" ? "light" : "dark");
  function apply(theme, save) {
    root.dataset.theme = theme;
    document.querySelectorAll(".theme-toggle").forEach(b => {
      b.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
      b.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    });
    if (save) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
  }
  apply(current(), false);
  // One attribute change, no colour transitions: the whole page repaints in a single frame.
  document.querySelectorAll(".theme-toggle").forEach(b => b.addEventListener("click", () => {
    apply(current() === "dark" ? "light" : "dark", true);
  }));
  // keep other open tabs of the site in step
  window.addEventListener("storage", e => { if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) apply(e.newValue, false); });
})();
