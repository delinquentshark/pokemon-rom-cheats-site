/* Dark/light switch, shared by every page. Pages start dark; a one-line script in <head>
   switches to light before first paint if the visitor picked it. The choice is kept in
   localStorage and synced across open tabs. */
(() => {
  const KEY = "prc-theme";
  const root = document.documentElement;
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
  // clicks for the 0.25 s it runs. Browsers without View Transitions get the instant switch.
  // It also runs when the visitor asks for reduced motion: a crossfade only changes opacity,
  // which WCAG doesn't count as motion. Things that move (the knob sliding) still stop.
  function switchTo(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    if (!document.startViewTransition) paint(t);
    else document.startViewTransition(() => paint(t));
  }

  // On the guides the switch sits in a sticky strip (.tt-rail in guide.css): it follows the top of the window
  // down the page and settles into the tab bar. That's all CSS, so there's nothing to do here.

  paint(theme);
  document.querySelectorAll(".theme-toggle").forEach(b =>
    b.addEventListener("click", () => switchTo(theme === "dark" ? "light" : "dark")));
  window.addEventListener("storage", e => {
    if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) paint(e.newValue);
  });
})();
