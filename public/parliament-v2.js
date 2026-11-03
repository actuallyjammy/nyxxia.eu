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
  const GLASS = '.glass,.wiki-wrap,.editor-wrap,.persist-wrap,.history-wrap,.motion-box,.stats,.parties,.coalition-panel,.analysis-panel,#us-election-wrap .election-topbar,#us-election-wrap .candidate-card,#us-election-wrap .count-line-card,#us-election-wrap .chamber-card,#us-election-wrap .government-card,#us-election-wrap .simple-controls,#us-election-wrap .real-map-card,#us-election-wrap .race-card,#us-election-wrap .party-drawer';
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
    document.dispatchEvent(new Event('v2:tally'));
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
      const bgc = getComputedStyle(sw).backgroundColor.match(/[\d.]+/g);
      document.dispatchEvent(new CustomEvent('v2:hover', { detail: bgc && !(bgc.length > 3 && +bgc[3] === 0) ? bgc.slice(0, 3).map(Number) : null }));
      let hit = 0;
      seatCircles().forEach(c => { const on = norm(c.getAttribute('fill')) === col; c.classList.toggle('lit', on); hit += on; });
      svg.classList.toggle('dimming', hit > 0);
    });
    list.addEventListener('pointerleave', () => { document.dispatchEvent(new CustomEvent('v2:hover', { detail: null })); svg.classList.remove('dimming'); $$('circle.lit', svg).forEach(c => c.classList.remove('lit')); });
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

  /* ── 8. Reactive background ────────────────────────────
     A dot field that bends away from the pointer, ripples on clicks / votes,
     drifts with scroll, and tints toward the tally (green = yea, red = nay).
     Performance: the loop only runs while something is happening (pointer, scroll,
     a ripple, or the tint easing) and sleeps otherwise; unaffected dots are drawn
     as one batched path; the --mood CSS variable is written sparingly. */
  (() => {
    if (reduce) return;
    const cvs = document.createElement('canvas');
    cvs.id = 'bg-canvas';
    document.body.prepend(cvs);
    const g = cvs.getContext('2d', { alpha: true });
    let W = 0, H = 0;
    const GAP = 38, RING_MS = 1900;
    const resize = () => {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      wake(200);
    };

    const light = () => root.dataset.theme === 'light';
    const PAL = {
      dark:  { accent: [139, 124, 255], yes: [52, 211, 153], no: [251, 95, 122], amber: [251, 191, 36], teal: [45, 212, 191], gray: [140, 140, 165], gold: [255, 215, 90] },
      light: { accent: [91, 75, 240],   yes: [5, 150, 105],  no: [225, 29, 72],  amber: [217, 119, 6],  teal: [13, 148, 136], gray: [100, 100, 125], gold: [202, 138, 4] },
    };
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    let mood = PAL.dark.accent.slice(), moodWant = mood.slice(), moodStr = '', moodAt = 0;

    const ptr = { x: 0, y: 0, tx: 0, ty: 0, on: false };
    const rings = [];
    const ring = (x, y, strength = 1, color = null) => {
      rings.push({ x, y, t0: performance.now(), s: strength, c: color });
      if (rings.length > 6) rings.shift();
      wake(RING_MS + 100);
    };

    /* wake / sleep */
    let awakeUntil = 0, running = false, visible = true;
    function wake(ms) {
      awakeUntil = Math.max(awakeUntil, performance.now() + ms);
      if (!running && visible) { running = true; requestAnimationFrame(frame); }
    }
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) wake(300); });

    addEventListener('pointermove', e => { ptr.tx = e.clientX; ptr.ty = e.clientY; if (!ptr.on) { ptr.x = ptr.tx; ptr.y = ptr.ty; } ptr.on = true; wake(1000); }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.on = false; wake(400); });
    addEventListener('scroll', () => wake(300), { passive: true });
    addEventListener('resize', resize);
    addEventListener('pointerdown', e => ring(e.clientX, e.clientY, e.target.closest && e.target.closest('.vote-btn') ? 1.4 : .7), { passive: true });
    new MutationObserver(() => wake(900)).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    /* Mood layers, highest priority last:
       tally lean (purple -> green/red) -> abstentions mute it -> view-specific (coalition / US / Catalunya)
       -> close vote (amber) -> quorum not met (amber). Hovering a party recolours the dots by the cursor. */
    const pal = () => PAL[light() ? 'light' : 'dark'];
    const parseRgb = c => {                                 // '#rrggbb' | 'rgb(r, g, b)' -> [r,g,b]
      if (!c) return null;
      c = c.trim();
      if (c[0] === '#') { const h = c.length === 4 ? c.replace(/./g, (m, i) => i ? m + m : '') : c; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
      const m = c.match(/[\d.]+/g); return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null;
    };
    let hoverRgb = null;
    const visibleWrap = id => { const w = document.getElementById(id); return w && w.classList.contains('visible') ? w : null; };
    const ev = { closeNow: false, coalitionMajority: false, usLeader: '', us270: false, quorum: false };

    // Leader of a candidate-card view (US elections / Catalunya): colour + score of the top card
    function leaderOf(wrap) {
      let best = null;
      wrap.querySelectorAll('.candidate-card').forEach(card => {
        const s = parseFloat(((card.querySelector('.candidate-score') || {}).textContent || '').replace(/[^\d.]/g, '')) || 0;
        if (s > 0 && (!best || s > best.s)) best = { s, id: card.dataset.candidateCard || card.textContent.slice(0, 20), rgb: parseRgb(getComputedStyle(card).getPropertyValue('--party')) };
      });
      return best;
    }

    function retarget() {
      const p = pal();
      const y = target.yes, n = target.no, ab = target.abs, t = total(), decided = y + n;
      const lean = decided ? (y - n) / decided : 0;
      const amt = Math.min(1, decided / (t * .45));
      let m = mix(p.accent, lean >= 0 ? p.yes : p.no, Math.abs(lean) * amt * .9);

      // many abstentions: wash the colour out
      if (ab > decided && ab / t > .25) m = mix(m, p.gray, Math.min(.8, ab / t));

      // coalition building: amber while short, teal once a majority is secured
      const coal = visibleWrap('coalition-wrap'), cs = coal && $('#coalition-status');
      if (cs) {
        const major = cs.classList.contains('ready') || cs.classList.contains('super');
        m = mix(m, major ? p.teal : p.amber, .8);
        if (major !== ev.coalitionMajority) { if (major) ring(W / 2, H * .4, 2, p.teal); ev.coalitionMajority = major; }
      } else ev.coalitionMajority = false;

      // elections: lean toward whoever is ahead
      const elec = visibleWrap('us-election-wrap') || visibleWrap('catalonia-election-wrap');
      if (elec) {
        const lead = leaderOf(elec);
        if (lead && lead.rgb) {
          m = mix(p.accent, lead.rgb, .85);
          if (lead.id !== ev.usLeader) { if (ev.usLeader) ring(W / 2, H * .4, 1.6, lead.rgb); ev.usLeader = lead.id; }
          if (lead.s >= 270 && !ev.us270) { ev.us270 = true; ring(W / 2, H * .4, 2.4, p.gold); }
          if (lead.s < 270) ev.us270 = false;
        } else { m = p.accent; ev.usLeader = ''; ev.us270 = false; }
      } else { ev.usLeader = ''; ev.us270 = false; }

      // razor-thin vote: amber, with one ring on entering the state
      const close = !elec && decided > t * .3 && Math.abs(y - n) / decided < .03;
      if (close) { m = mix(m, p.amber, .7); if (!ev.closeNow) ring(W / 2, H * .45, 1.6, p.amber); }
      ev.closeNow = close;

      // quorum not met
      const qw = $('#quorum-warning');
      const q = !!(qw && qw.classList.contains('visible'));
      if (q) m = mix(m, p.amber, .85);
      ev.quorum = q;

      moodWant = m;
      wake(1800);
    }
    document.addEventListener('v2:tally', retarget);
    document.addEventListener('v2:hover', e => { hoverRgb = e.detail; wake(1000); });
    // views, quorum banner, coalition strength and election cards change outside the tally: watch them (throttled)
    let retargetT = 0;
    const retargetSoon = () => { if (!retargetT) retargetT = setTimeout(() => { retargetT = 0; retarget(); }, 350); };
    ['coalition-wrap', 'us-election-wrap', 'catalonia-election-wrap', 'quorum-warning'].forEach(id => {
      const el = document.getElementById(id);
      if (el) new MutationObserver(retargetSoon).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    const csEl = $('#coalition-status');
    if (csEl) new MutationObserver(retargetSoon).observe(csEl, { attributes: true, attributeFilter: ['class'] });
    const watchElections = () => {
      ['us-election-wrap', 'catalonia-election-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.v2watch) { el.dataset.v2watch = 1; new MutationObserver(() => { if (el.classList.contains('visible')) retargetSoon(); }).observe(el, { childList: true, subtree: true, characterData: true }); }
      });
    };
    watchElections(); document.addEventListener('click', () => setTimeout(watchElections, 400), { passive: true });

    // Verdict flips fire a big ring from the middle of the screen in the verdict colour
    const verdict = $('#verdict');
    if (verdict) {
      let last = '';
      new MutationObserver(() => {
        const st = verdict.classList.contains('passed') ? 'yes' : verdict.classList.contains('failed') ? 'no' : '';
        if (st && st !== last) ring(W / 2, H * .45, 2.2, PAL[light() ? 'light' : 'dark'][st]);
        last = st;
      }).observe(verdict, { attributes: true, attributeFilter: ['class'] });
    }

    function frame(now) {
      if (!visible) { running = false; return; }
      mood = mix(mood, moodWant, .05);
      ptr.x += (ptr.tx - ptr.x) * .16; ptr.y += (ptr.ty - ptr.y) * .16;
      draw(now);

      // the tint drives the CSS aurora too; restyling is costly, so cap to ~8/s and skip no-op writes
      if (now - moodAt > 120) {
        const s = mood.map(Math.round).join(',');
        if (s !== moodStr) { moodStr = s; root.style.setProperty('--mood', s); }
        moodAt = now;
      }
      const settling = mood.some((v, i) => Math.abs(v - moodWant[i]) > .5) || rings.length || ptr.on && Math.hypot(ptr.tx - ptr.x, ptr.ty - ptr.y) > .5;
      if (now < awakeUntil || settling) requestAnimationFrame(frame);
      else running = false;
    }

    function draw(now) {
      g.clearRect(0, 0, W, H);
      const isLight = light();
      const oy = (scrollY * .18) % GAP;
      const [mr, mg, mb] = mood.map(Math.round);
      for (let i = rings.length - 1; i >= 0; i--) if (now - rings[i].t0 >= RING_MS) rings.splice(i, 1);
      const px = ptr.on ? ptr.x : -1e4, py = ptr.on ? ptr.y : -1e4;

      const hot = [];                                   // dots touched by the pointer or a ring: drawn individually
      g.beginPath();                                    // everything else: one batched path
      for (let gy = -GAP, row = 0; gy < H + GAP; gy += GAP, row++) {
        const y0 = gy - oy, off = row & 1 ? GAP / 2 : 0;
        for (let gx = -GAP; gx < W + GAP; gx += GAP) {
          const x0 = gx + off;
          let x = x0, y = y0, r = 1.05, a = 0, glow = 0;
          let col = null, colW = 0;
          const dx = x0 - px, dy = y0 - py, d2 = dx * dx + dy * dy;
          if (d2 < 52900) {
            const k = Math.exp(-d2 / 9000), d = Math.sqrt(d2) || 1;
            x += dx / d * k * 14; y += dy / d * k * 14; r += k * 2.4; a += k * .55; glow = k;
            if (hoverRgb) { col = hoverRgb; colW = k; }   // hovering a party row: dots near the cursor take its colour
          }
          for (let q = 0; q < rings.length; q++) {
            const rg = rings[q], age = (now - rg.t0) / RING_MS, rad = age * 620 * (.6 + rg.s * .4);
            const rx = x0 - rg.x, ry = y0 - rg.y, rd = Math.sqrt(rx * rx + ry * ry), diff = rd - rad;
            if (diff > 90 || diff < -90) continue;
            const w = Math.exp(-diff * diff / 1600) * (1 - age) * rg.s;
            if (w > .02) {
              r += w * 2.2; a += w * .5; glow = Math.max(glow, Math.min(1, w)); x += rx / (rd || 1) * w * 6; y += ry / (rd || 1) * w * 6;
              if (rg.c && w > colW) { col = rg.c; colW = w; }   // event rings keep their own colour
            }
          }
          if (glow > .02) hot.push(x, y, r, a, col);
          else { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832); }
        }
      }
      g.fillStyle = isLight ? 'rgba(90,90,120,.17)' : 'rgba(190,190,220,.14)';
      g.fill();
      if (hot.length) {
        for (let i = 0; i < hot.length; i += 5) {
          const c = hot[i + 4], cr = c ? Math.round(c[0]) : mr, cg = c ? Math.round(c[1]) : mg, cb = c ? Math.round(c[2]) : mb;
          g.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(.9, .15 + hot[i + 3])})`;
          g.beginPath(); g.arc(hot[i], hot[i + 1], hot[i + 2], 0, 6.2832); g.fill();
        }
      }
    }

    resize();
  })();

  /* ── 9. Redesigned chamber charts (separate file, has its own Original/Redesigned toggle) ── */
  (() => {
    const me = document.currentScript && document.currentScript.src;
    const s = document.createElement('script');
    s.src = 'parliament-v2-chart.js' + (me && me.includes('?') ? me.slice(me.indexOf('?')) : '');
    document.body.appendChild(s);
  })();

  /* ── 10. Backup / transfer ─────────────────────────────
     Everything the app saves lives in this browser's localStorage, so it can't follow you to another
     device. This adds Export / Import (and a share-sheet button on phones) to the presets panel:
     one JSON file with presets, snapshots, coalitions, autosave and the election states. */
  (() => {
    const panel = document.getElementById('persist-panel');
    if (!panel) return;

    // per-device preferences stay out of the backup
    const SKIP = new Set(['parliament_theme', 'parliament_style', 'parliament_v2', 'parliament_v2_chart', 'parliament_v2_order']);
    const inBackup = k => !SKIP.has(k) && (k.startsWith('parliament_') || k.startsWith('us_election_') || k.startsWith('catalonia_simulator'));
    const keys = () => { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && inBackup(k)) out.push(k); } return out; };

    // flush pending autosaves so the file has the latest state
    const flush = () => { try { window.dispatchEvent(new Event('pagehide')); } catch (e) {} };

    function makeBackup() {
      flush();
      const data = {};
      keys().forEach(k => { data[k] = localStorage.getItem(k); });
      return { app: 'parliament-simulator', version: 1, exportedAt: new Date().toISOString(), data };
    }
    const fileName = () => `parliament-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const toFile = b => new File([JSON.stringify(b)], fileName(), { type: 'application/json' });

    function applyBackup(b) {
      const incoming = Object.entries(b.data).filter(([k, v]) => inBackup(k) && typeof v === 'string');
      const previous = {};
      keys().forEach(k => { previous[k] = localStorage.getItem(k); });
      try {
        keys().forEach(k => localStorage.removeItem(k));                 // replace, so stale portraits don't linger
        incoming.forEach(([k, v]) => localStorage.setItem(k, v));
        return incoming.length;
      } catch (e) {                                                       // e.g. storage full: put things back
        keys().forEach(k => localStorage.removeItem(k));
        Object.entries(previous).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (e2) {} });
        throw e;
      }
    }

    /* UI */
    const sec = document.createElement('div');
    sec.innerHTML = `
      <div class="persist-divider"></div>
      <div class="persist-section-label">Backup &amp; transfer</div>
      <p class="bk-note">Save everything on this device to one file, then import it on another device (phone, laptop…). Importing replaces what's saved there.</p>
      <div class="persist-save-row bk-row">
        <button class="persist-save-btn" type="button" data-bk="export">Export backup</button>
        <button class="persist-save-btn" type="button" data-bk="share" hidden>Share…</button>
        <button class="persist-save-btn bk-alt" type="button" data-bk="import">Import backup</button>
        <input type="file" accept="application/json,.json" data-bk="file" hidden />
      </div>
      <div class="bk-status" role="status"></div>`;
    panel.appendChild(sec);
    const status = $('.bk-status', sec), fileIn = $('[data-bk=file]', sec), shareBtn = $('[data-bk=share]', sec);
    const say = (msg, kind) => { status.textContent = msg; status.dataset.kind = kind || ''; };

    // Share sheet (AirDrop / Messages / Files) where the browser can share files, i.e. most phones
    try { if (navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })) shareBtn.hidden = false; } catch (e) {}

    sec.addEventListener('click', async e => {
      const btn = e.target.closest('[data-bk]');
      if (!btn) return;
      const act = btn.dataset.bk;
      if (act === 'export') {
        const f = toFile(makeBackup());
        const url = URL.createObjectURL(f);
        const a = document.createElement('a');
        a.href = url; a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        say(`Saved ${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`, 'ok');
      } else if (act === 'share') {
        try { await navigator.share({ files: [toFile(makeBackup())], title: 'Parliament backup' }); say('Shared', 'ok'); }
        catch (err) { if (err && err.name !== 'AbortError') say('Could not open the share sheet — use Export instead', 'err'); }
      } else if (act === 'import') {
        fileIn.value = ''; fileIn.click();
      }
    });

    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      try {
        const b = JSON.parse(await f.text());
        if (!b || b.app !== 'parliament-simulator' || !b.data || typeof b.data !== 'object') throw new Error('not a backup');
        const n = Object.keys(b.data).filter(inBackup).length;
        const when = b.exportedAt ? new Date(b.exportedAt).toLocaleString() : 'unknown date';
        if (!confirm(`Replace the data saved on this device with the backup from ${when} (${n} items)?`)) { say('Import cancelled'); return; }
        applyBackup(b);
        say('Imported — reloading…', 'ok');
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        say(err && err.name === 'QuotaExceededError' ? 'Not enough storage on this device — nothing was changed' : "That file isn't a Parliament backup", 'err');
      }
    });
  })();
})();
