/* Parliament v2 — interaction layer.
   Purely additive: it observes the page the original script renders and adds
   motion / feedback. It never changes votes, parties or app state. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ── 1. Pointer: card spotlight + aurora lean ───────── */
  const GLASS = '.glass,.wiki-wrap,.editor-wrap,.persist-wrap,.history-wrap,.motion-box,.stats,.parties,.coalition-panel,.analysis-panel';
  let pf = 0;
  addEventListener('pointermove', e => {
    if (pf) return;
    pf = requestAnimationFrame(() => {
      pf = 0;
      root.style.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
      const g = e.target.closest && e.target.closest(GLASS);
      if (g) {
        const r = g.getBoundingClientRect();
        g.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        g.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    });
  }, { passive: true });

  /* ── 2. Ripple on every button press ────────────────── */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || reduce) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  });

  /* ── 3. Staggered reveal ────────────────────────────── */
  const revealTargets = $$('body > header, body > .wiki-wrap, body > .editor-wrap, body > .motion-wrap, body > .view-toggle-wrap, body > .mode-strip, body > .parliament-wrap, body > .stats, body > .verdict, body > .persist-wrap, body > .party-table-head, body > .parties, body > .log-btn, body > .reset-btn, body > .history-wrap, body > .legend');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--d', Math.min(i, 8) * 70 + 'ms'); io.observe(el); });
  }

  /* ── 4. Sliding tab indicator ───────────────────────── */
  const tabs = $('.view-toggle-wrap');
  if (tabs) {
    const ind = document.createElement('span');
    ind.className = 'tab-ind';
    tabs.prepend(ind);
    tabs.classList.add('has-ind');
    const place = () => {
      const a = $('.view-btn.active', tabs) || $('.view-btn', tabs);
      if (!a) return;
      ind.style.setProperty('--ind-x', a.offsetLeft + 'px');
      ind.style.setProperty('--ind-w', a.offsetWidth + 'px');
      a.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    };
    new MutationObserver(place).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', place);
    document.fonts && document.fonts.ready.then(place);
    place();
  }

  /* ── 5. Tally: count-up, bump, share bars, dock ─────── */
  const nums = { yes: $('#yes-count'), abs: $('#abs-count'), no: $('#no-count') };
  const shown = { yes: 0, abs: 0, no: 0 };
  const target = { yes: 0, abs: 0, no: 0 };
  const total = () => parseInt(($('#header-sub') || {}).textContent, 10) || 1;
  const obs = {};
  // write without re-triggering our own observer (observer callbacks run async, so a flag isn't enough)
  const write = (k, v) => { nums[k].textContent = v; obs[k].takeRecords(); };

  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.innerHTML = '<span class="y"><b>0</b> yea</span><span class="bar"><i class="by"></i><i class="ba"></i><i class="bn"></i></span><span class="n"><b>0</b> nay</span><span class="v">No votes yet</span>';
  document.body.appendChild(dock);

  function paintShares() {
    const t = total();
    for (const k of ['yes', 'abs', 'no']) {
      const card = nums[k] && nums[k].closest('.stat-card');
      if (card) card.style.setProperty('--share', Math.min(100, (target[k] / t) * 100) + '%');
    }
    $('.by', dock).style.width = (target.yes / t) * 100 + '%';
    $('.ba', dock).style.width = (target.abs / t) * 100 + '%';
    $('.bn', dock).style.width = (target.no / t) * 100 + '%';
    dock.style.setProperty('--maj', ((Math.floor(t / 2) + 1) / t) * 100 + '%');
    $('.y b', dock).textContent = target.yes;
    $('.n b', dock).textContent = target.no;
    const vEl = $('#verdict'), v = $('.v', dock);
    if (vEl) {
      const pass = vEl.classList.contains('passed'), fail = vEl.classList.contains('failed');
      v.textContent = pass ? '✓ Passed' : fail ? '✕ Failed' : 'Undecided';
      v.className = 'v' + (pass ? ' passed' : fail ? ' failed' : '');
    }
  }

  function tween(k) {
    const el = nums[k];
    if (!el) return;
    const from = shown[k], to = target[k];
    if (from === to) return;
    shown[k] = to;
    if (reduce) { write(k, to); return; }
    const t0 = performance.now(), dur = Math.min(900, 300 + Math.abs(to - from) * 2);
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      write(k, Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  for (const k of Object.keys(nums)) {
    const el = nums[k];
    if (!el) continue;
    target[k] = shown[k] = parseInt(el.textContent, 10) || 0;
    obs[k] = new MutationObserver(() => {
      const v = parseInt(el.textContent, 10);
      if (Number.isNaN(v)) return;
      target[k] = v;
      // the app already wrote the final value; rewind it so the count-up can play
      write(k, shown[k]);
      tween(k); paintShares();
    });
    obs[k].observe(el, { childList: true, characterData: true, subtree: true });
  }
  const verdictEl = $('#verdict');
  if (verdictEl) new MutationObserver(paintShares).observe(verdictEl, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const sub = $('#header-sub');
  if (sub) new MutationObserver(paintShares).observe(sub, { childList: true, characterData: true, subtree: true });
  paintShares();

  const statsEl = $('.stats');
  if (statsEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => dock.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top < 0 || (!en.isIntersecting && scrollY > 200)))
      .observe(statsEl);
  }

  /* ── 6. Party rows: colour hooks, vote pop, seat linking ── */
  const svg = $('#parl-svg');
  const cache = new Map();
  const cv = document.createElement('canvas').getContext('2d');
  const norm = c => {
    if (!c) return '';
    if (cache.has(c)) return cache.get(c);
    cv.fillStyle = '#000'; cv.fillStyle = c;
    const out = cv.fillStyle; cache.set(c, out); return out;
  };
  const seatCircles = () => svg ? $$('circle', svg).filter(c => parseFloat(c.getAttribute('r')) >= 3) : [];

  function tagRows() {
    $$('.party-row').forEach(row => {
      const sw = $('.swatch', row);
      if (sw && sw.style.background) row.style.setProperty('--row-color', sw.style.background.split(' ')[0] === 'linear-gradient' ? 'var(--accent)' : sw.style.background);
    });
  }
  const list = $('#party-list');
  if (list) { new MutationObserver(tagRows).observe(list, { childList: true }); tagRows(); }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.vote-btn');
    if (!b) return;
    const id = b.dataset.id, vote = b.dataset.vote;
    requestAnimationFrame(() => {
      const nb = $(`.vote-btn[data-id="${id}"][data-vote="${vote}"]`);
      if (nb) { nb.classList.remove('pop'); void nb.offsetWidth; nb.classList.add('pop'); }
      // party-colour mode doesn't recolour seats, so pulse the voting party's seats instead
      const sw = nb && $('.swatch', nb.closest('.party-row'));
      const col = sw && norm(getComputedStyle(sw).backgroundColor);
      if (col && !reduce) {
        const all = $$('circle', svg), idx = [];
        all.forEach((c, i) => { if (parseFloat(c.getAttribute('r')) >= 3 && norm(c.getAttribute('fill')) === col) idx.push(i); });
        startPulse(idx, all);
      }
    });
  });

  if (list && svg) {
    list.addEventListener('pointerover', e => {
      const row = e.target.closest('.party-row');
      if (!row) return;
      const sw = $('.swatch', row);
      const col = sw && norm(getComputedStyle(sw).backgroundColor);
      if (!col) return;
      let hit = 0;
      seatCircles().forEach(c => { const on = norm(c.getAttribute('fill')) === col; c.classList.toggle('lit', on); hit += on; });
      svg.classList.toggle('dimming', hit > 0);
    });
    list.addEventListener('pointerleave', () => { svg.classList.remove('dimming'); $$('circle.lit', svg).forEach(c => c.classList.remove('lit')); });
  }

  /* ── 7. Seats: ripple outward from the changed seats ──── */
  // The app rebuilds the chamber (sometimes twice) per change, wiping classes, so a pulse
  // is remembered for a short window and re-applied mid-animation to each fresh render.
  let pulse = null;
  const PULSE_MS = 900;
  function startPulse(idx, seats) {
    if (!idx.length || reduce) return;
    const n = idx.length;
    pulse = { t0: performance.now(), delays: new Map(idx.map((i, k) => [i, Math.min(520, (k / n) * 520)])) };
    applyPulse(seats || $$('circle', svg));
  }
  function applyPulse(seats) {
    if (!pulse) return;
    const el = performance.now() - pulse.t0;
    if (el > PULSE_MS) { pulse = null; return; }
    pulse.delays.forEach((d, i) => {
      const c = seats[i];
      if (c && !c.classList.contains('wave')) { c.style.setProperty('--wd', (d - el) + 'ms'); c.classList.add('wave'); }
    });
  }
  if (svg) {
    // The dot count changes between states, so compare seats by position (each slot has a fixed x/y)
    const allSeats = () => $$('circle', svg);
    const pos = c => Math.round(c.getAttribute('cx')) + ',' + Math.round(c.getAttribute('cy'));
    const look = c => c.getAttribute('fill');
    const snapshot = seats => new Map(seats.map(c => [pos(c), look(c)]));
    let prev = snapshot(allSeats());
    new MutationObserver(() => {
      const seats = allSeats();
      const cur = snapshot(seats);
      const changed = [];
      seats.forEach((c, i) => { if (prev.has(pos(c)) && prev.get(pos(c)) !== look(c)) changed.push(i); });
      // a layout rebuild recolours nearly everything: only animate genuine vote changes
      if (changed.length && changed.length < seats.length * 0.6) startPulse(changed, seats);
      else applyPulse(seats);
      prev = cur;
    }).observe(svg, { childList: true, subtree: true });

    svg.addEventListener('pointerover', e => {
      const c = e.target;
      if (c.tagName === 'circle' && parseFloat(c.getAttribute('r')) >= 3) c.classList.add('seat-hover');
    });
    svg.addEventListener('pointerout', e => { if (e.target.classList) e.target.classList.remove('seat-hover'); });
  }
})();
