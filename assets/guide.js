/* Shared behaviour for every game guide (site/<slug>/index.html). Plain JavaScript, no framework.

   Load order on a guide page:  assets/guide.js  ->  <slug>/codes.js  ->  the page's own inline script.
   Nothing here touches the page until one of its functions is called, so Node can load this file too
   (tools/common/jscheck.mjs uses G.par to compare the page's codes with the Python generator).

   What a guide page gets from it (see tools/README.md, "Guide page structure"):
     G.par          Action Replay (PAR v3 / "Action Replay MAX") encryption and ROM-patch lines
     G.tabs()       tabs from .tablist, #hash links to a tab or to any element inside one (e.g. #card-shiny)
     G.copyText()   copy to the clipboard, with a select-the-text fallback; [data-copy="<id>"] buttons wire themselves
     G.showCode()   fill a code box and its line count
     G.seg()        segmented buttons (.seg with data-v on each button)
     G.cards()      collapsible code cards (.ccard > .chead), collapsed ones remembered per viewer
     G.LazyTable    long lists in a scroll box, rendered in batches as the box scrolls
     G.store        localStorage that never throws */
(function (root) {
  "use strict";

  /* ---------- Action Replay (PAR v3) ---------- */
  // TEA with the PAR v3 seeds, exactly as mGBA decrypts "Action Replay MAX" codes (tools/common/arcrypt.py).
  const SEEDS = [0x7AA9648F, 0x7FAE6994, 0xC0EFAAD5, 0x42712C57];
  function encrypt(a, b) {
    let t = 0;
    a >>>= 0; b >>>= 0;
    for (let i = 0; i < 32; i++) {
      t = (t + 0x9E3779B9) >>> 0;
      a = (a + (((b << 4) + SEEDS[0]) ^ (b + t) ^ ((b >>> 5) + SEEDS[1]))) >>> 0;
      b = (b + (((a << 4) + SEEDS[2]) ^ (a + t) ^ ((a >>> 5) + SEEDS[3]))) >>> 0;
    }
    return [a, b];
  }
  const hex = (n, w) => (n >>> 0).toString(16).toUpperCase().padStart(w, "0");
  const fmt = ([a, b]) => hex(a, 8) + " " + hex(b, 8);
  // 16-bit ROM patch: 00000000 18aaaaaa / 0000vvvv 00000000, address 0x08000000 + aaaaaa * 2
  const patch = (addr, val) => [[0, (0x18000000 | ((addr - 0x08000000) >>> 1)) >>> 0], [val & 0xFFFF, 0]];
  const enc = lines => lines.map(l => fmt(encrypt(l[0], l[1])));
  const raw = lines => lines.map(fmt);
  const par = {encrypt, hex, fmt, patch, enc, raw};

  /* ---------- small helpers ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const hex4 = n => hex(n, 4);

  /* ---------- copy ---------- */
  function flash(btn, label, txt) {
    btn.textContent = txt; btn.classList.add("done");
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = label; btn.classList.remove("done"); }, 1400);
  }
  // Copies text; if the clipboard is blocked, selects `cell` so the visitor can press Ctrl+C.
  function copyText(btn, text, cell, label) {
    label = label || btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    const fallback = () => {
      if (!cell) return;
      const s = getSelection(), r = document.createRange();
      r.selectNodeContents(cell); s.removeAllRanges(); s.addRange(r);
      flash(btn, label, "Selected: press Ctrl+C");
    };
    try { navigator.clipboard.writeText(text).then(() => flash(btn, label, "Copied"), fallback); } catch (e) { fallback(); }
  }
  // A code box shows one line per line of the code; its [data-lines="<id>"] label says how many.
  function showCode(id, lines) {
    const box = document.getElementById(id);
    box.textContent = lines.join("\n");
    document.querySelectorAll(`[data-lines="${id}"]`).forEach(el => {
      el.textContent = lines.length === 1 ? "1 line" : `${lines.length} lines · paste all as one code`;
    });
  }
  function wireCopy(scope) {
    (scope || document).querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
      const box = document.getElementById(b.dataset.copy);
      if (box.dataset.blocked) return;
      copyText(b, box.innerText.trim(), box);
    }));
  }

  /* ---------- segmented buttons ---------- */
  // <div class="seg" role="group"><button data-v="a" aria-pressed="true">…</button>…</div>
  function seg(group, onPick) {
    const btns = [...group.querySelectorAll("button[data-v]")];
    const set = v => btns.forEach(b => b.setAttribute("aria-pressed", b.dataset.v === String(v) ? "true" : "false"));
    btns.forEach(b => b.addEventListener("click", () => { set(b.dataset.v); onPick(b.dataset.v); }));
    return {set, get value() { const b = btns.find(x => x.getAttribute("aria-pressed") === "true"); return b && b.dataset.v; }};
  }

  /* ---------- collapsible code cards ---------- */
  // <article class="ccard"><h3 class="chead-h"><button class="chead" aria-expanded="true" aria-controls="body-id">…
  // Cards the visitor collapses stay collapsed on their next visit (localStorage `key`).
  // [data-cards="collapse"|"expand"] buttons act on the cards in their own tab.
  function cards(key) {
    const heads = [...document.querySelectorAll(".chead")];
    const set = (b, open) => { b.setAttribute("aria-expanded", open ? "true" : "false"); document.getElementById(b.getAttribute("aria-controls")).hidden = !open; };
    const save = () => store.set(key, JSON.stringify(heads.filter(b => b.getAttribute("aria-expanded") === "false").map(b => b.getAttribute("aria-controls"))));
    heads.forEach(b => b.addEventListener("click", () => { set(b, b.getAttribute("aria-expanded") !== "true"); save(); }));
    try { const shut = JSON.parse(store.get(key, "[]")); heads.forEach(b => { if (shut.includes(b.getAttribute("aria-controls"))) set(b, false); }); } catch (e) {}
    document.querySelectorAll("[data-cards]").forEach(btn => btn.addEventListener("click", () => {
      const panel = btn.closest(".panel");
      heads.filter(h => panel.contains(h)).forEach(h => set(h, btn.dataset.cards === "expand"));
      save();
    }));
    return {open(el) { const h = el && el.querySelector(".chead"); if (h && h.getAttribute("aria-expanded") === "false") { set(h, true); save(); } }};
  }

  /* ---------- tabs ---------- */
  // Tabs come from .tablist [role=tab][aria-controls]; the first one is the landing tab.
  // #<tab id> opens a tab; #<any id inside a tab> (e.g. #card-money) opens that tab and scrolls to the element.
  // `aliases` maps old hashes to tab ids. onShow(tabId) runs after a tab is shown; onGo(el) before scrolling to one.
  function tabs({aliases = {}, onShow = null, onGo = null} = {}) {
    const list = document.querySelector(".tablist");
    const btns = [...list.querySelectorAll('[role="tab"]')];
    const ids = btns.map(b => b.getAttribute("aria-controls"));
    let current = null;
    function show(id, push) {
      if (!ids.includes(id)) id = ids[0];
      btns.forEach((b, i) => {
        const on = ids[i] === id;
        b.setAttribute("aria-selected", on ? "true" : "false");
        document.getElementById(ids[i]).hidden = !on;
      });
      if (push) { try { history.replaceState(null, "", "#" + id); } catch (e) {} }
      // phones and tablets: the tab row scrolls sideways, so bring the selected tab into view
      const b = btns[ids.indexOf(id)];
      if (list.scrollWidth > list.clientWidth) list.scrollLeft = Math.max(0, b.offsetLeft - list.offsetLeft - 16);
      current = id;
      if (onShow) onShow(id);
    }
    // go("moves") shows a tab and scrolls to the top; go("card-money") shows the card's tab and scrolls to the card
    function go(target, push = true) {
      target = aliases[target] || target;
      if (ids.includes(target) || !target) { show(target, push); if (push) scrollTo(0, 0); return; }
      const el = document.getElementById(target), panel = el && el.closest('[role="tabpanel"]');
      if (!panel) { show(ids[0], push); return; }
      show(panel.id, false);
      if (push) { try { history.replaceState(null, "", "#" + target); } catch (e) {} }
      if (onGo) onGo(el);
      el.scrollIntoView({block: "start"});
      if (el.classList.contains("ccard")) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
    }
    btns.forEach((b, i) => b.addEventListener("click", () => show(ids[i], true)));
    // in-page links (<a href="#card-money">) go through go(), so a second click on the same link still works
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains("mvl") || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = a.getAttribute("href").slice(1);
      if (!t) return;
      e.preventDefault(); go(t);
    });
    window.addEventListener("hashchange", () => go(location.hash.slice(1), false));
    return {show, go, get current() { return current; }, start() { go(location.hash.slice(1), false); }};
  }

  /* ---------- long lists ---------- */
  // A table inside a scroll box (.lazybox) that renders its rows a batch at a time: the first batch at once, the next
  // whenever the box is scrolled near its end. set(items) replaces the list (and scrolls the box to the top);
  // ensure(i) renders at least up to item i (to jump to a row). build(item) returns the <tr>s for one item.
  // `batch`: rows added per load (50); `chunk`: rows per <tbody> (20; use fewer for tall, complex rows).
  // Each batch goes into its own <tbody class="chunk">, which the browser skips while it's out of view
  // (content-visibility:auto in guide.css), so a long list costs nothing when switching themes.
  class LazyTable {
    constructor({table, rowH, build, batch = 50, chunk = 20}) {
      this.table = table; this.rowH = rowH; this.build = build; this.batch = batch; this.chunk = chunk;
      this.box = table.closest(".lazybox"); this.items = []; this.n = 0;
      this.end = document.createElement("div"); this.end.className = "lazyend"; this.end.setAttribute("aria-hidden", "true");
      table.after(this.end);
      this.io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) this.more(); }, {root: this.box, rootMargin: "0px 0px 800px 0px"});
      // Wheeling down over the list scrolls the page first, until the list's top reaches the sticky tab bar, and only
      // then the list itself, so the whole box is on screen while it scrolls. (Upwards, the browser already hands the
      // scroll back to the page once the list is at its top.)
      this.box.addEventListener("wheel", e => {
        if (e.deltaY <= 0 || e.ctrlKey || e.shiftKey) return;
        const bar = document.querySelector(".tabs"), barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
        const room = this.box.getBoundingClientRect().top - barBottom - 8;
        const pageLeft = document.documentElement.scrollHeight - innerHeight - scrollY;
        if (room < 1 || pageLeft < 1) return;
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
        const smooth = Math.abs(dy) >= 50 && !matchMedia("(prefers-reduced-motion: reduce)").matches;
        scrollBy({top: Math.min(room, pageLeft, dy), behavior: smooth ? "smooth" : "instant"});
      }, {passive: false});
    }
    set(items) {
      this.items = items; this.n = 0;
      this.table.querySelectorAll("tbody").forEach(t => t.remove());
      this.box.scrollTop = 0;
      this.more();
    }
    more(upto) {
      const stop = Math.min(this.items.length, Math.max(upto === undefined ? 0 : upto + 1, this.n + this.batch));
      if (this.n >= stop) return;
      const groups = [];
      for (let i = this.n; i < stop; i++) groups.push(this.build(this.items[i], i));
      this.n = stop;
      const frag = document.createDocumentFragment(), CH = this.chunk;   // rows per chunk: a chunk scrolling into view lays out in one short task
      for (let i = 0; i < groups.length; i += CH) {
        const part = groups.slice(i, i + CH), tb = document.createElement("tbody");
        tb.className = "chunk"; tb.setAttribute("role", "rowgroup");
        tb.style.containIntrinsicSize = `auto ${part.length * this.rowH}px`;
        part.forEach(g => g.forEach(tr => tb.appendChild(tr)));
        frag.appendChild(tb);
      }
      this.table.appendChild(frag);
      // re-observing reports the end marker's position again, so a box that still isn't full keeps loading
      this.io.unobserve(this.end);
      if (this.n < this.items.length) this.io.observe(this.end);
    }
    ensure(i) { if (i >= this.n) this.more(i); }
    get rendered() { return this.n; }
  }

  root.G = {par, store, esc, hex4, flash, copyText, showCode, wireCopy, seg, cards, tabs, LazyTable};
})(typeof globalThis !== "undefined" ? globalThis : this);
