/* Parliament v2 — redesigned chamber charts.
   A second renderer that lives next to the original #parl-svg. The original keeps drawing
   (hidden) and is the trigger: whenever it redraws, this re-reads the app state and updates.
   A toolbar toggle switches between "Redesigned" and "Original" (remembered in localStorage).
   Read-only: it never changes votes, parties or app state. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const wrap = document.getElementById('donut-wrap');
  const oldSvg = document.getElementById('parl-svg');
  const toolbar = document.getElementById('parliament-toolbar');
  if (!wrap || !oldSvg || !toolbar) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const KEY = 'parliament_v2_chart';
  let style = 'new';
  try { if (localStorage.getItem(KEY) === 'classic') style = 'classic'; } catch (e) {}
  const ORDER_KEY = 'parliament_v2_order';
  let orderMode = 'vote';                       // 'vote': yea blocks left, nay blocks right | 'party': fixed party order
  try { if (localStorage.getItem(ORDER_KEY) === 'party') orderMode = 'party'; } catch (e) {}

  /* ── DOM ───────────────────────────────────────────── */
  const box = document.createElement('div');
  box.className = 'pv2';
  box.innerHTML = '<svg class="pv2-svg" viewBox="0 0 1000 520" role="img" aria-label="Parliament chart"></svg><div class="pv2-legend"></div><div class="pv2-tip" hidden></div>';
  oldSvg.after(box);
  const svg = box.querySelector('.pv2-svg');
  const legend = box.querySelector('.pv2-legend');
  const tip = box.querySelector('.pv2-tip');

  const group = document.createElement('div');
  group.className = 'parliament-toggle-group';
  group.setAttribute('aria-label', 'Chart style');
  group.innerHTML = '<button class="parliament-toggle" type="button" data-chart-style="new">Redesigned</button><button class="parliament-toggle" type="button" data-chart-style="classic">Original</button>';
  toolbar.appendChild(group);

  const orderGroup = document.createElement('div');
  orderGroup.className = 'parliament-toggle-group';
  orderGroup.setAttribute('aria-label', 'Seat order');
  orderGroup.innerHTML = '<button class="parliament-toggle" type="button" data-order="vote" title="Parties voting yea move left, nay right">By vote</button><button class="parliament-toggle" type="button" data-order="party" title="Keep every party in its fixed place">By party</button>';
  toolbar.appendChild(orderGroup);

  const el = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };

  // A caucus is drawn with an outer ring in its parent party's colour (as in the original chart)
  const ringColor = p => { try { return isPartyCaucus(p) ? getPartyExteriorColor(p) : ''; } catch (e) { return ''; } };
  const parentName = p => { try { const q = p.parentId && parties.find(x => x.id === p.parentId); return q && q.id !== p.id ? q.name : ''; } catch (e) { return ''; } };

  /* ── Seat maths ────────────────────────────────────── */
  const DOT_CAP = 600;

  // largest-remainder allocation of N dots across the parties; every seated party keeps at least one dot
  function allocate(list, N, total) {
    if (N >= total) return list.map(p => p.seats);
    const raw = list.map(p => p.seats * N / total);
    const out = raw.map(Math.floor);
    let rem = N - out.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { out[i]++; rem--; } });
    out.forEach((v, i) => {
      if (v === 0) { const j = out.indexOf(Math.max(...out)); if (out[j] > 1) { out[j]--; out[i] = 1; } }
    });
    return out;
  }

  // how a party's `count` dots split into yea / nay / abstain / not voted
  function voteSplit(p, count) {
    const e = effectiveSeats(p), s = count / (p.seats || 1);
    let y = Math.round(e.yes * s), n = Math.round(e.no * s), a = Math.round(e.abs * s);
    while (y + n + a > count) { if (y >= n && y >= a) y--; else if (n >= a) n--; else a--; }
    return { y, n, a };
  }

  /* ── Geometry ──────────────────────────────────────── */
  // Half-ellipse (semi-axes stretch*r and r): length of the arc per unit radius, and even-by-length angles
  function ellipseLen(stretch) { return arcAngles(2, stretch).len; }
  function arcAngles(n, stretch) {
    if (stretch === 1) return { len: Math.PI, th: Array.from({ length: n }, (_, j) => n === 1 ? Math.PI / 2 : Math.PI * (1 - j / (n - 1))) };
    const S = 240, cum = [0], t = [];
    for (let i = 1; i <= S; i++) {
      const t0 = Math.PI * (1 - (i - 1) / S), t1 = Math.PI * (1 - i / S), tm = (t0 + t1) / 2;
      cum.push(cum[i - 1] + Math.hypot(stretch * Math.sin(tm), Math.cos(tm)) * (t0 - t1));
    }
    const len = cum[S], th = [];
    for (let j = 0; j < n; j++) {
      const want = n === 1 ? len / 2 : len * j / (n - 1);
      let i = 1; while (i < S && cum[i] < want) i++;
      const f = (want - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      th.push(Math.PI * (1 - (i - 1 + f) / S));
    }
    return { len, th };
  }

  // Hemicycle: pick the fewest rows that fit N dots, spread dots across rows by radius, then sort
  // all seats by angle so each party becomes a clean wedge. `stretch` > 1 widens it into a half-ellipse.
  function hemicycleSeats(N, stretch = 1) {
    const R = 430, r0 = R * .36, L = ellipseLen(stretch);
    let rows = 2, d = 0;
    for (; rows < 40; rows++) {
      d = (R - r0) / (rows - 1);
      let cap = 0;
      for (let i = 0; i < rows; i++) cap += Math.floor(L * (r0 + i * d) / d) + 1;
      if (cap >= N) break;
    }
    const radii = Array.from({ length: rows }, (_, i) => r0 + i * d);
    const sum = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map(r => Math.max(1, Math.round(N * r / sum)));
    let diff = N - counts.reduce((a, b) => a + b, 0);
    for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) { counts[i] += diff > 0 ? 1 : -1; diff += diff > 0 ? -1 : 1; if (counts[i] < 1) counts[i] = 1; }
    const width = 2 * (R * stretch + 70), cx = width / 2, cy = 478, seats = [];
    radii.forEach((r, i) => {
      const n = counts[i], { th } = arcAngles(n, stretch);
      for (let j = 0; j < n; j++) seats.push({ x: cx + r * stretch * Math.cos(th[j]), y: cy - r * Math.sin(th[j]), th: th[j], row: i });
    });
    seats.sort((a, b) => b.th - a.th || a.row - b.row);
    const arc = L * radii[0] / Math.max(1, counts[0] - 1);
    return { seats, cx, cy, R, r0, width, stretch, dot: Math.min(22, .4 * Math.min(d, arc)) };
  }

  // Westminster block: columns of seats filled top-to-bottom, so each party is a contiguous slice
  function blockSeats(n, x, y, w, h) {
    if (!n) return { seats: [], dot: 0 };
    let best = { s: 0, rows: 1 };
    for (let rows = 1; rows <= 14; rows++) {
      const cols = Math.ceil(n / rows), s = Math.min(w / cols, h / rows);
      if (s > best.s) best = { s, rows };
    }
    const { s, rows } = best, cols = Math.ceil(n / rows);
    const ox = x + (w - cols * s) / 2, oy = y + (h - rows * s) / 2;
    const seats = [];
    for (let i = 0; i < n; i++) seats.push({ x: ox + (Math.floor(i / rows) + .5) * s, y: oy + (i % rows + .5) * s, th: 0, row: i % rows });
    return { seats, dot: Math.min(20, s * .38) };
  }

  /* ── Build (only when the seat layout changes) ─────── */
  let sig = '', model = null, fresh = false;

  function build(layout, seated, groups, total, majority) {
    svg.textContent = '';
    fresh = true;
    const N = Math.min(total, DOT_CAP), k = total / N;
    const byParty = new Map();

    const dotsLayer = el('g', { class: 'pv2-dots' });
    const all = [];                       // every seat dot, in party order
    const mkSeat = (s, p, i, dot) => {
      const slot = el('g', { class: 'slot' });
      slot.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      const c = el('circle', { class: 'seat', cx: 0, cy: 0, r: dot.toFixed(1), 'data-p': p.id, 'data-v': 'none' });
      c._slot = i;
      c.style.setProperty('--pc', p.color);
      c.style.setProperty('--ad', Math.min(700, i * 1.4).toFixed(0) + 'ms');
      c.style.setProperty('--td', Math.max(0, Math.min(380, s.x * .38)).toFixed(0) + 'ms');
      if (!reduce) c.classList.add('in');
      const rc = ringColor(p);
      if (rc) {
        const ring = el('circle', { class: 'cring', cx: 0, cy: 0, r: (dot * 1.2 + 1.1).toFixed(1), 'stroke-width': Math.max(1.5, dot * .17).toFixed(1) });
        ring.style.setProperty('--rc', rc);
        ring.style.setProperty('--ad', Math.min(700, i * 1.4 + 120).toFixed(0) + 'ms');
        if (!reduce) ring.classList.add('in');
        slot.appendChild(ring);
        c._ring = ring;
      }
      slot.appendChild(c);
      dotsLayer.appendChild(slot);
      all.push(c);
      if (!byParty.has(p.id)) byParty.set(p.id, []);
      byParty.get(p.id).push(c);
      return c;
    };

    const info = { layout, total, majority, N, k, parties: new Map(), byParty, all, ticks: [] };

    if (layout === 'hemicycle') {
      svg.setAttribute('viewBox', '0 0 1000 520');
      const geo = hemicycleSeats(N);
      const counts = allocate(seated, N, total);
      // faint guide rows behind the dots
      const guides = el('g', { class: 'pv2-guides' });
      svg.appendChild(guides);
      const trackR = geo.R + 30;
      const trackD = `M ${geo.cx - trackR} ${geo.cy} A ${trackR} ${trackR} 0 0 1 ${geo.cx + trackR} ${geo.cy}`;
      svg.appendChild(el('path', { d: trackD, class: 'pv2-track', pathLength: 1 }));
      svg.appendChild(el('path', { d: trackD, class: 'pv2-prog yes', pathLength: 1 }));
      svg.appendChild(el('path', { d: trackD, class: 'pv2-prog no', pathLength: 1 }));
      svg.appendChild(dotsLayer);
      let idx = 0;
      seated.forEach((p, i) => {
        info.parties.set(p.id, { p, count: counts[i] });
        for (let j = 0; j < counts[i]; j++) { mkSeat(geo.seats[idx], p, idx, geo.dot); idx++; }
      });
      // majority markers. Yea blocks fill from the left, so the tick sits where m seats from the left end;
      // nays fill from the right, so they cross at m seats in from the right. They almost coincide for a simple
      // majority (one merged tick); a supermajority separates them (two ticks).
      const m = Math.min(N, Math.max(1, Math.ceil(majority / total * N)));
      const thAt = q => (geo.seats[Math.min(N - 1, Math.max(0, q))].th + geo.seats[Math.min(N - 1, Math.max(0, q + 1))].th) / 2;
      const mkTick = (th, side, alt) => {
        const mx = f => ({ x: geo.cx + f * Math.cos(th), y: geo.cy - f * Math.sin(th) });
        const a = mx(geo.r0 - 6), b = mx(trackR + 12), lab = mx(trackR + 30);
        const cls = alt ? ' alt' : '';
        const halo = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'pv2-maj-halo' + cls });
        const core = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'pv2-maj' + cls });
        const label = el('text', { x: lab.x, y: lab.y + 4, class: 'pv2-maj-label', 'text-anchor': 'middle' }, majority);
        svg.append(halo, core, label);
        info.ticks.push({ side, els: [halo, core] });
      };
      if (Math.abs((N - m - 1) - (m - 1)) <= 3) mkTick(thAt(m - 1), 'both', false);
      else { mkTick(thAt(m - 1), 'yes', false); mkTick(thAt(N - m - 1), 'no', true); }
      // centre readout
      const t = el('g', { class: 'pv2-centre' });
      t.appendChild(el('text', { x: geo.cx, y: geo.cy - 52, class: 'pv2-big', 'text-anchor': 'middle' }, total));
      t.appendChild(el('text', { x: geo.cx, y: geo.cy - 28, class: 'pv2-sub', 'text-anchor': 'middle' }, k > 1.001 ? `seats · 1 dot ≈ ${k.toFixed(1)}` : 'seats'));
      t.appendChild(el('text', { x: geo.cx, y: geo.cy - 6, class: 'pv2-need', 'text-anchor': 'middle' }, `${majority} to pass`));
      svg.appendChild(t);
      info.geo = geo;
    } else {
      svg.setAttribute('viewBox', '0 0 1000 600');
      const gl = ['government', 'opposition', 'crossbench'].map(g => ({ g, list: [...groups[g]] }));
      gl[2].list.push(...groups.speaker);                // speaker's seats sit with the crossbench
      const R = {
        government: { x: 130, y: 72, w: 650, h: 184 },
        opposition: { x: 130, y: 372, w: 650, h: 184 },
        crossbench: { x: 820, y: 170, w: 150, h: 260 },
      };
      const allList = gl.flatMap(o => o.list);
      const counts = new Map(allList.map((p, i) => [p.id, 0]));
      const alloc = allocate(allList, N, total);
      allList.forEach((p, i) => counts.set(p.id, alloc[i]));
      // floor + speaker
      svg.appendChild(el('rect', { x: 118, y: 284, width: 676, height: 40, rx: 14, class: 'pv2-floor' }));
      svg.appendChild(el('text', { x: 456, y: 309, class: 'pv2-sub', 'text-anchor': 'middle' }, 'The floor'));
      svg.appendChild(el('circle', { cx: 62, cy: 300, r: 24, class: 'pv2-speaker' }));
      svg.appendChild(el('text', { x: 62, y: 342, class: 'pv2-sub', 'text-anchor': 'middle' }, 'Speaker'));
      let ord = 0;
      gl.forEach(({ g, list }) => {
        const r = R[g], n = list.reduce((a, p) => a + counts.get(p.id), 0), seatSum = list.reduce((a, p) => a + p.seats, 0);
        svg.appendChild(el('rect', { x: r.x - 14, y: r.y - 14, width: r.w + 28, height: r.h + 28, rx: 16, class: 'pv2-bench' }));
        svg.appendChild(el('text', { x: r.x - 4, y: r.y - 24, class: 'pv2-bench-label' }, `${g[0].toUpperCase()}${g.slice(1)} · ${seatSum}`));
        const blk = blockSeats(n, r.x, r.y, r.w, r.h);
        let idx = 0;
        list.forEach(p => {
          const c = counts.get(p.id);
          info.parties.set(p.id, { p, count: c });
          for (let j = 0; j < c; j++) { mkSeat(blk.seats[idx], p, ord++, blk.dot); idx++; }
        });
      });
      svg.appendChild(dotsLayer);
      const t = el('g', { class: 'pv2-centre' });
      t.appendChild(el('text', { x: 500, y: 592, class: 'pv2-need', 'text-anchor': 'middle' }, `${total} seats · ${majority} to pass${k > 1.001 ? ` · 1 dot ≈ ${k.toFixed(1)}` : ''}`));
      svg.appendChild(t);
    }
    model = info;

    // legend
    legend.textContent = '';
    const order = layout === 'hemicycle' ? seated : [...groups.government, ...groups.opposition, ...groups.crossbench, ...groups.speaker];
    order.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'pv2-chip'; chip.dataset.p = p.id;
      const rc = ringColor(p);
      chip.innerHTML = `<i class="${rc ? 'ringed' : ''}" style="background:${p.color};${rc ? `--rc:${rc}` : ''}"></i><span></span><b>${p.seats}</b>`;
      chip.querySelector('span').textContent = p.name;
      legend.appendChild(chip);
    });
  }

  /* ── Paint (every state change) ────────────────────── */
  // Put every dot in a slot. By vote: yea dots take the leftmost slots, nay dots the rightmost, and
  // abstentions / not-yet-voted fill the middle in party order (so with no votes it matches party order).
  function place() {
    if (!model || model.layout !== 'hemicycle') return;
    const { all, geo, N } = model;
    let order = all;
    if (orderMode === 'vote') {
      const rank = c => c.dataset.v === 'yes' ? 0 : c.dataset.v === 'no' ? 2 : 1;
      // Inside the yea and nay blocks the biggest party sits at the outer edge and smaller ones step down
      // toward the centre (so both blocks taper into the undecided middle). The middle keeps party order.
      const size = new Map();
      all.forEach(c => { const k = rank(c) + '|' + c.dataset.p; size.set(k, (size.get(k) || 0) + 1); });
      order = all.map((c, i) => [c, i]).sort((a, b) => {
        const ra = rank(a[0]), rb = rank(b[0]);
        if (ra !== rb) return ra - rb;
        if (ra !== 1 && a[0].dataset.p !== b[0].dataset.p) {
          const sa = size.get(ra + '|' + a[0].dataset.p), sb = size.get(rb + '|' + b[0].dataset.p);
          if (sa !== sb) return ra === 0 ? sb - sa : sa - sb;     // yea: big first (far left); nay: small first (big ends far right)
        }
        return a[1] - b[1];
      }).map(x => x[0]);
    }
    order.forEach((c, i) => {
      if (c._slot === i) return;
      c._slot = i;
      const s = geo.seats[i], g = c.parentNode;
      g.style.setProperty('--md', Math.round(i / N * 300) + 'ms');
      g.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    });
  }

  function paint() {
    if (!model) return;
    const { total, majority } = model;
    let yes = 0, no = 0;
    model.byParty.forEach((circles, id) => {
      const entry = model.parties.get(id);
      const { y, n, a } = voteSplit(entry.p, circles.length);
      circles.forEach((c, i) => {
        const v = i < y ? 'yes' : i < y + n ? 'no' : i < y + n + a ? 'abs' : 'none';
        if (c.dataset.v !== v) c.dataset.v = v;
      });
      const e = effectiveSeats(entry.p); yes += e.yes; no += e.no;
    });
    const py = svg.querySelector('.pv2-prog.yes'), pn = svg.querySelector('.pv2-prog.no');
    if (py && pn) {
      const fy = Math.min(1, yes / total), fn = Math.min(1 - fy, no / total);
      py.style.strokeDasharray = `${fy} ${1 - fy + .001}`;
      pn.style.strokeDasharray = `${fn} ${1 - fn + .001}`;
      pn.style.strokeDashoffset = `${-(1 - fn)}`;
    }
    (model.ticks || []).forEach(t => {
      const reached = t.side === 'yes' ? yes >= majority : t.side === 'no' ? no >= majority : (yes >= majority || no >= majority);
      t.els.forEach(e => e.classList.toggle('reached', reached));
    });
    if (fresh) {
      svg.classList.add('noanim'); place();
      requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('noanim')));
      fresh = false;
    } else place();
  }

  let raf = 0;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      try { draw(); } catch (err) { console.error('[parliament-v2-chart]', err); }
    });
  }
  function draw() {
    {
      let seated, rc;
      try { seated = seatedParties(); rc = recalc(); } catch (e) { return; }
      const layout = parliamentLayout === 'westminster' ? 'westminster' : 'hemicycle';
      // the original hemicycle is retired; the Original/Redesigned choice only applies to Westminster
      const useNew = layout === 'hemicycle' || style === 'new';
      wrap.classList.toggle('chart-v2', useNew);
      group.hidden = layout === 'hemicycle';
      orderGroup.hidden = layout !== 'hemicycle';
      if (!useNew) return;
      box.dataset.color = parliamentColorMode === 'vote' ? 'vote' : 'party';
      box.dataset.layout = layout;
      if (!seated.length) { svg.textContent = ''; svg.appendChild(el('text', { x: 500, y: 260, class: 'pv2-sub', 'text-anchor': 'middle' }, 'No parties configured')); legend.textContent = ''; sig = ''; model = null; return; }
      const groups = layout === 'westminster' ? westminsterGroups() : null;
      const s = layout + '|' + rc.total + '|' + rc.majority + '|' + (groups
        ? ['government', 'opposition', 'crossbench', 'speaker'].map(g => groups[g].map(p => p.id + ':' + p.seats + p.color + ringColor(p)).join(',')).join('/')
        : seated.map(p => p.id + ':' + p.seats + p.color + ringColor(p)).join(','));
      if (s !== sig) { sig = s; build(layout, seated, groups, rc.total, rc.majority); }
      paint();
    }
  }

  /* ── Style toggle ──────────────────────────────────── */
  function setStyle(next) {
    style = next;
    try { localStorage.setItem(KEY, style); } catch (e) {}
    group.querySelectorAll('[data-chart-style]').forEach(b => b.classList.toggle('active', b.dataset.chartStyle === style));
    sig = ''; render();
  }
  group.addEventListener('click', e => { const b = e.target.closest('[data-chart-style]'); if (b) setStyle(b.dataset.chartStyle); });

  function setOrder(next) {
    orderMode = next;
    try { localStorage.setItem(ORDER_KEY, orderMode); } catch (e) {}
    orderGroup.querySelectorAll('[data-order]').forEach(b => b.classList.toggle('active', b.dataset.order === orderMode));
    place();
  }
  orderGroup.addEventListener('click', e => { const b = e.target.closest('[data-order]'); if (b) setOrder(b.dataset.order); });
  orderGroup.querySelectorAll('[data-order]').forEach(b => b.classList.toggle('active', b.dataset.order === orderMode));

  // The original redraws on every change; use that as the trigger
  new MutationObserver(render).observe(oldSvg, { childList: true });

  /* ── Highlight a party from the list or legend ─────── */
  const highlight = id => {
    box.classList.toggle('dimming', !!id);
    box.querySelectorAll('.seat.lit, .cring.lit').forEach(c => c.classList.remove('lit'));
    legend.querySelectorAll('.pv2-chip.lit').forEach(c => c.classList.remove('lit'));
    if (!id || !model) return;
    (model.byParty.get(id) || []).forEach(c => { c.classList.add('lit'); if (c._ring) c._ring.classList.add('lit'); });
    const chip = legend.querySelector(`.pv2-chip[data-p="${CSS.escape(id)}"]`); if (chip) chip.classList.add('lit');
  };
  const list = document.getElementById('party-list');
  if (list) {
    list.addEventListener('pointerover', e => { const row = e.target.closest('.party-row'); if (row && row.id.startsWith('prow-')) highlight(row.id.slice(5)); });
    list.addEventListener('pointerleave', () => highlight(null));
  }
  legend.addEventListener('pointerover', e => { const c = e.target.closest('.pv2-chip'); if (c) highlight(c.dataset.p); });
  legend.addEventListener('pointerleave', () => highlight(null));

  /* ── Tooltip ───────────────────────────────────────── */
  const VOTE = { yes: 'Yea', no: 'Nay', abs: 'Abstain', none: 'Not voted' };
  svg.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.seat');
    if (!c || !model) { tip.hidden = true; return; }
    const entry = model.parties.get(c.dataset.p);
    if (!entry) { tip.hidden = true; return; }
    const r = box.getBoundingClientRect();
    const rc = ringColor(entry.p), parent = rc ? parentName(entry.p) : '';
    tip.innerHTML = `<i class="${rc ? 'ringed' : ''}" style="background:${entry.p.color};${rc ? `--rc:${rc}` : ''}"></i><div><b></b><span></span></div><em data-v="${c.dataset.v}">${VOTE[c.dataset.v]}</em>`;
    tip.querySelector('b').textContent = entry.p.name;
    tip.querySelector('span').textContent = `${entry.p.seats} seats${parent ? ` · caucus of ${parent}` : ''}${model.k > 1.001 ? ` · ≈${(entry.p.seats / (entry.count || 1)).toFixed(1)} per dot` : ''}`;
    tip.hidden = false;
    const x = Math.min(r.width - tip.offsetWidth - 8, e.clientX - r.left + 14), y = e.clientY - r.top - tip.offsetHeight - 12;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y < 8 ? e.clientY - r.top + 18 : y)}px)`;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });


  /* ── US elections chamber (House / Senate) ──────────────
     The US view rebuilds #chamber-card on every render with positioned HTML dots. We read the seats
     from that markup and swap in the same redesigned hemicycle, stretched into a half-ellipse like the
     original. One persistent node is re-inserted each time, so seats transition as races are called
     instead of replaying the entrance animation. */
  (() => {
    const card = document.getElementById('chamber-card');
    if (!card) return;
    let view = null;

    const parse = host => [...host.querySelectorAll('.chamber-seat')].map(s => ({
      color: s.style.getPropertyValue('--party').trim() || '#64748b',
      uncalled: s.classList.contains('uncalled'),
      title: s.getAttribute('title') || '',
    }));

    function make(N, majority, senate) {
      const geo = hemicycleSeats(N, senate ? 1.3 : 1.6);
      const box = document.createElement('div');
      box.className = 'pv2 pv2-us'; box.dataset.color = 'us';
      const s = el('svg', { class: 'pv2-svg', viewBox: `0 0 ${geo.width} 520`, role: 'img', 'aria-label': senate ? 'Senate chamber' : 'House chamber' });
      box.appendChild(s);
      const tipEl = document.createElement('div'); tipEl.className = 'pv2-tip'; tipEl.hidden = true; box.appendChild(tipEl);

      const trackR = geo.R + 30;
      const rx = trackR * geo.stretch;
      const trackD = `M ${geo.cx - rx} ${geo.cy} A ${rx} ${trackR} 0 0 1 ${geo.cx + rx} ${geo.cy}`;
      s.appendChild(el('path', { d: trackD, class: 'pv2-track', pathLength: 1 }));
      s.appendChild(el('path', { d: trackD, class: 'pv2-prog lead', pathLength: 1 }));
      const dots = el('g', { class: 'pv2-dots' });
      s.appendChild(dots);
      const circles = geo.seats.map((p, i) => {
        const c = el('circle', { class: 'seat', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: geo.dot.toFixed(1), 'data-i': i });
        c.style.setProperty('--ad', Math.min(700, i * 1.4).toFixed(0) + 'ms');
        c.style.setProperty('--td', Math.max(0, Math.min(380, p.x / geo.width * 420)).toFixed(0) + 'ms');
        if (!reduce) c.classList.add('in');
        dots.appendChild(c);
        return c;
      });
      // majority marker (halo + dark long-dash core), at the dot where the majority is reached
      const mi = Math.min(N - 1, Math.max(0, majority - 1));
      const th = (geo.seats[mi].th + geo.seats[Math.min(N - 1, mi + 1)].th) / 2;
      const at = f => ({ x: geo.cx + f * geo.stretch * Math.cos(th), y: geo.cy - f * Math.sin(th) });
      const a = at(geo.r0 - 6), b = at(trackR + 12), lab = at(trackR + 32);
      s.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'pv2-maj-halo' }));
      s.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'pv2-maj' }));
      s.appendChild(el('text', { x: lab.x, y: lab.y + 4, class: 'pv2-maj-label', 'text-anchor': 'middle' }, majority));
      const big = el('text', { x: geo.cx, y: geo.cy - 52, class: 'pv2-big', 'text-anchor': 'middle' }, '0');
      const sub = el('text', { x: geo.cx, y: geo.cy - 28, class: 'pv2-sub', 'text-anchor': 'middle' });
      const need = el('text', { x: geo.cx, y: geo.cy - 6, class: 'pv2-need', 'text-anchor': 'middle' }, `${majority} for majority`);
      s.append(big, sub, need);

      // hover: tooltip + light up every seat of the same colour
      s.addEventListener('pointerover', e => {
        const c = e.target.closest && e.target.closest('.seat');
        box.classList.toggle('dimming', !!c && c.dataset.u !== '1');
        circles.forEach(x => x.classList.toggle('lit', !!c && c.dataset.u !== '1' && x.dataset.c === c.dataset.c));
      });
      s.addEventListener('pointerleave', () => { box.classList.remove('dimming'); circles.forEach(x => x.classList.remove('lit')); tipEl.hidden = true; });
      s.addEventListener('pointermove', e => {
        const c = e.target.closest && e.target.closest('.seat');
        if (!c) { tipEl.hidden = true; return; }
        const seat = view.seats[+c.dataset.i]; if (!seat) return;
        const m = seat.title.match(/^(.*?)\s*(\d+)$/);
        tipEl.innerHTML = `<i style="background:${seat.uncalled ? 'var(--seat-empty)' : seat.color}"></i><div><b></b><span></span></div><em data-v="${seat.uncalled ? 'none' : 'yes'}">${seat.uncalled ? 'Uncalled' : 'Called'}</em>`;
        tipEl.querySelector('b').textContent = m ? m[1] : seat.title;
        tipEl.querySelector('span').textContent = m ? `${m[2]} ${senate ? 'seats' : 'seats'}` : '';
        tipEl.hidden = false;
        const r = box.getBoundingClientRect();
        const x = Math.min(r.width - tipEl.offsetWidth - 8, e.clientX - r.left + 14), y = e.clientY - r.top - tipEl.offsetHeight - 12;
        tipEl.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y < 8 ? e.clientY - r.top + 18 : y)}px)`;
      });
      return { box, svg: s, circles, N, key: `${N}|${majority}|${senate}`, big, sub, seats: [] };
    }

    function paint(seats, majority) {
      view.seats = seats;
      const counts = new Map();
      let called = 0;
      seats.forEach((seat, i) => {
        const c = view.circles[i]; if (!c) return;
        c.style.setProperty('--pc', seat.color);
        const u = seat.uncalled ? '1' : '0';
        if (c.dataset.u !== u) c.dataset.u = u;
        c.dataset.c = seat.color;
        if (!seat.uncalled) { called++; counts.set(seat.color, (counts.get(seat.color) || 0) + 1); }
      });
      let lead = '', best = 0;
      counts.forEach((n, color) => { if (n > best) { best = n; lead = color; } });
      const prog = view.svg.querySelector('.pv2-prog.lead');
      prog.style.setProperty('--lead', lead || 'var(--accent)');
      prog.style.strokeDasharray = `${best / view.N} ${1 - best / view.N + .001}`;
      view.svg.querySelectorAll('.pv2-maj, .pv2-maj-halo').forEach(m => m.classList.toggle('reached', best >= majority));
      view.big.textContent = called;
      view.sub.textContent = `of ${view.N} called`;
    }

    const sync = () => {
      const host = card.querySelector('.chamber-hemicycle');
      if (!host) return;
      const seats = parse(host);
      if (!seats.length) return;
      const majority = parseInt((host.querySelector('.chamber-floor b') || {}).textContent, 10) || Math.floor(seats.length / 2) + 1;
      const senate = host.classList.contains('senate');
      const key = `${seats.length}|${majority}|${senate}`;
      if (!view || view.key !== key) view = make(seats.length, majority, senate);
      paint(seats, majority);
      host.replaceWith(view.box);
      mo.takeRecords();
    };
    const mo = new MutationObserver(sync);
    mo.observe(card, { childList: true });
    sync();
  })();

  setStyle(style);
})();
