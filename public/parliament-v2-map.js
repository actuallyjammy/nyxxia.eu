/* Parliament v2 — reactive US election map.
   The app rebuilds the whole map SVG on every render, so nothing can transition on the paths themselves.
   This keeps a tiny memory of the previous map and, after each rebuild, animates only what changed:
   a colour tween + flash + ripple when a race is called or flips, an entrance wave when a new map
   appears, an outline that follows the pointer, and a draw-in outline for the selected race.
   Everything is a one-shot Web Animation; there is no loop and no work while idle. Read-only. */
(() => {
  'use strict';
  const svg = document.getElementById('real-us-map');
  const wrap = document.getElementById('us-election-wrap');
  if (!svg || !wrap) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const SEL = 'path[data-state],path[data-county],path[data-district]';
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const MAX_ANIMATED = 120;          // entrance / dimming only for maps this small (states, senate), not 435 districts
  const MAX_FLASHES = 14, MAX_PULSES = 8;

  let prev = new Map();               // key -> { fill, op, called }
  let sig = '';                       // identifies "the same map" across rebuilds
  let selKey = '';
  let raf = 0;
  let fx = null, hoverEl = null, selEl = null;

  const keyOf = p => [p.dataset.state, p.dataset.county, p.dataset.district].filter(Boolean).join('|');
  const read = p => ({ fill: p.style.fill || getComputedStyle(p).fill, op: p.style.fillOpacity || '1', called: !p.classList.contains('uncalled') });

  function layerOf() { return svg.querySelector(':scope > .map-camera-layer'); }

  // Some paths (Nebraska / Maine district overlays) carry their own transform to line up with the state
  // outline, so anything drawn from a path has to copy it too, not just its `d`.
  function mirror(el, p) {
    el.setAttribute('d', p.getAttribute('d'));
    const t = p.getAttribute('transform');
    if (t) el.setAttribute('transform', t); else el.removeAttribute('transform');
  }

  // overlay group lives inside the camera layer so it follows zoom and pan
  function ensureFx() {
    const layer = layerOf();
    if (!layer) return null;
    if (fx && fx.parentNode === layer) return fx;
    fx = document.createElementNS(NS, 'g');
    fx.setAttribute('class', 'v2-fx');
    selEl = document.createElementNS(NS, 'path'); selEl.setAttribute('class', 'v2-sel'); selEl.setAttribute('pathLength', '1');
    hoverEl = document.createElementNS(NS, 'path'); hoverEl.setAttribute('class', 'v2-hover');
    fx.append(selEl, hoverEl);
    layer.appendChild(fx);
    return fx;
  }

  /* ── one-shot effects ──────────────────────────────── */
  function tween(p, from, to, flash) {
    const frames = flash
      ? [{ fill: from.fill, fillOpacity: from.op, filter: 'brightness(1)' }, { offset: .28, filter: 'brightness(1.9) saturate(1.3)' }, { fill: to.fill, fillOpacity: to.op, filter: 'brightness(1)' }]
      : [{ fill: from.fill, fillOpacity: from.op }, { fill: to.fill, fillOpacity: to.op }];
    p.animate(frames, { duration: flash ? 750 : 450, easing: EASE });
  }

  function pulse(p, color) {
    const f = ensureFx();
    if (!f) return;
    let b;
    try { b = p.getBBox(); } catch (e) { return; }
    let cx = b.x + b.width / 2, cy = b.y + b.height / 2, k = 1;
    try {
      const m = p.transform.baseVal.numberOfItems ? p.transform.baseVal.consolidate().matrix : null;
      if (m) { const pt = new DOMPoint(cx, cy).matrixTransform(m); cx = pt.x; cy = pt.y; k = Math.hypot(m.a, m.b) || 1; }
      b = { width: b.width * k, height: b.height * k };
    } catch (e) {}
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy);
    c.setAttribute('class', 'v2-pulse'); c.setAttribute('fill', 'none'); c.setAttribute('stroke', color);
    c.setAttribute('vector-effect', 'non-scaling-stroke');
    f.appendChild(c);
    const R = Math.max(b.width, b.height) * .9 + 6;
    const a = c.animate([{ r: R * .15, opacity: .95, strokeWidth: 3 }, { r: R, opacity: 0, strokeWidth: 1 }], { duration: 900, easing: EASE });
    a.onfinish = () => c.remove();
  }

  function entrance(paths) {
    const bw = svg.getBoundingClientRect().width || 1;
    const items = paths.map(p => { let x = 0; try { const b = p.getBBox(); x = b.x + b.width / 2; } catch (e) {} return [p, x]; });
    const xs = items.map(i => i[1]), min = Math.min(...xs), span = (Math.max(...xs) - min) || 1;
    items.forEach(([p, x]) => {
      const box = { transformBox: 'fill-box', transformOrigin: 'center' };
      // animating `transform` would override a path's own transform attribute, so those only fade
      const frames = p.hasAttribute('transform')
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'scale(.9)', ...box }, { opacity: 1, transform: 'scale(1)', ...box }];
      p.animate(frames, { duration: 520, delay: (x - min) / span * 380, easing: EASE, fill: 'backwards' });
    });
  }

  /* ── after each rebuild ────────────────────────────── */
  function sync() {
    raf = 0;
    if (!wrap.classList.contains('visible')) { prev.clear(); sig = ''; return; }
    const layer = layerOf();
    if (!layer) return;
    ensureFx();
    const paths = [...layer.querySelectorAll(SEL)];
    if (!paths.length) { prev.clear(); sig = ''; return; }

    const next = new Map();
    // "same map" = same view and same kind of shapes. Deliberately not the path count: split-district overlays
    // come and go as races are called, and that must not replay the entrance.
    let nS = 0, nC = 0, hasD = 0;
    paths.forEach(p => { if (p.dataset.county) nC++; else if (p.dataset.district) hasD = 1; else nS++; });
    const newSig = (svg.getAttribute('viewBox') || '') + '|' + nS + '|' + nC + '|' + hasD;
    const sameMap = sig === newSig;
    const changed = [];
    paths.forEach(p => {
      const k = keyOf(p), cur = read(p);
      next.set(k, cur);
      if (sameMap && !reduce) {
        const old = prev.get(k);
        if (old && (old.fill !== cur.fill || old.called !== cur.called)) changed.push([p, old, cur]);
      }
    });

    if (!reduce) {
      if (!sameMap && paths.length <= MAX_ANIMATED) entrance(paths);
      // biggest visual changes first: a newly called race, then a flip
      changed.sort((a, b) => (b[2].called - b[1].called) - (a[2].called - a[1].called));
      changed.forEach(([p, from, to], i) => tween(p, from, to, i < MAX_FLASHES));
      changed.filter(c => c[2].called).slice(0, MAX_PULSES).forEach(([p, , to]) => pulse(p, to.fill));
    }
    prev = next; sig = newSig;
    svg.classList.toggle('v2-many', paths.length > MAX_ANIMATED);
    syncSelection(false);
  }

  const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };
  new MutationObserver(schedule).observe(svg, { childList: true });    // direct children only: our overlay lives deeper
  schedule();

  /* ── selected race: outline that draws itself in ───── */
  function syncSelection(animate) {
    const layer = layerOf(); if (!layer || !ensureFx()) return;
    const p = layer.querySelector('path.selected[data-state], path.selected[data-county], path.selected[data-district]');
    if (!p) { selEl.classList.remove('on'); selKey = ''; return; }
    const k = keyOf(p);
    mirror(selEl, p);
    selEl.classList.add('on');
    if (k !== selKey) {
      const first = selKey === '';
      selKey = k;
      if (animate && !first && !reduce) {
        selEl.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: 650, easing: EASE });
        const card = document.querySelector('#us-election-wrap .race-sidebar .race-card');
        if (card) card.animate([{ opacity: .45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
      }
    }
  }
  wrap.addEventListener('click', () => requestAnimationFrame(() => syncSelection(true)), { passive: true });

  /* ── hover outline (one path, moved around) ────────── */
  svg.addEventListener('pointerover', e => {
    const p = e.target.closest && e.target.closest(SEL);
    if (!p || !ensureFx()) return;
    mirror(hoverEl, p);
    hoverEl.classList.add('on');
    svg.classList.add('v2-hovering');
  });
  const leave = () => { if (hoverEl) hoverEl.classList.remove('on'); svg.classList.remove('v2-hovering'); };
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('pointerout', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(SEL)) leave(); });
})();
