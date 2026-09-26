/* Dark/light switch, shared by every page. Pages start dark; a one-line script in <head>
   switches to light before first paint if the visitor picked it. The choice is kept in
   localStorage and synced across open tabs. */
(() => {
  const KEY = "prc-theme";
  const root = document.documentElement;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let theme = root.dataset.theme === "light" ? "light" : "dark";

  // One attribute change on <html>. Nothing transitions colours, so the page is fully
  // restyled in a single frame (see the performance rule in guide.css).
  function paint(t) {
    theme = t;
    root.dataset.theme = t;
    document.querySelectorAll(".theme-toggle").forEach(b => {
      b.setAttribute("aria-checked", t === "dark" ? "true" : "false");
      b.title = t === "dark" ? "Switch to light mode" : "Switch to dark mode";
    });
  }

  // The fade is a View Transition: the browser snapshots the page, applies the new theme in
  // that one frame, then crossfades the two snapshots on the GPU. No element is restyled or
  // repainted while it fades, so it costs the same as the instant switch. The page ignores
  // clicks for the 0.25 s it runs. Browsers without View Transitions, and visitors who ask
  // for reduced motion, get the instant switch.
  function switchTo(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    if (!document.startViewTransition || still.matches) paint(t);
    else document.startViewTransition(() => paint(t));
  }

  // Pages with a sticky bar marked data-theme-dock (the game guides' tab bar) get a second
  // switch docked on its right. It shows only while the top switch is scrolled out of view.
  const dock = document.querySelector("[data-theme-dock]");
  const top = document.querySelector(".sitebar .theme-toggle");
  if (dock && top && "IntersectionObserver" in window) {
    const copy = top.cloneNode(true);
    copy.classList.add("dock");
    dock.appendChild(copy);
    new IntersectionObserver(entries => {
      dock.toggleAttribute("data-docked", !entries[entries.length - 1].isIntersecting);
    }).observe(top);
  }

  paint(theme);
  document.querySelectorAll(".theme-toggle").forEach(b =>
    b.addEventListener("click", () => switchTo(theme === "dark" ? "light" : "dark")));
  window.addEventListener("storage", e => {
    if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) paint(e.newValue);
  });
})();
