/* Hamza Benfaddoul — field notebook. Vanilla JS, no dependencies.
   Everything here is enhancement: the page is complete and readable without it. */
(function () {
  'use strict';

  var d = document;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------- 1. Reveals: fire once, never reset ---------- */
  var reveals = $$('[data-reveal]');
  if (!hasIO || reduce) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        ro.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveals.forEach(function (el) { ro.observe(el); });
  }
  var stack = $('.stack');
  if (stack) requestAnimationFrame(function () { stack.classList.add('is-in'); });

  /* ---------- 2. Top bar: the menu button on narrow screens; the current section is marked ---------- */
  var barEl = $('.bar'), menuBtn = $('.bar__menu');
  if (barEl && menuBtn) {
    var setMenu = function (open) {
      barEl.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    menuBtn.addEventListener('click', function () { setMenu(!barEl.classList.contains('is-open')); });
    d.addEventListener('click', function (e) { if (barEl.classList.contains('is-open') && !barEl.contains(e.target)) setMenu(false); });
    d.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && barEl.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    $$('.bar__panel a', barEl).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }
  var spyLinks = $$('.bar__nav a');
  var sections = ['about', 'skill', 'portfolio', 'experience', 'contact'].map(function (id) { return d.getElementById(id); }).filter(Boolean);
  if (hasIO && sections.length) {
    var current = null, seen = {};
    var mark = function () {
      var hit = null;
      sections.forEach(function (s) { if (seen[s.id]) hit = s.id; });
      if (hit === current) return;
      current = hit;
      spyLinks.forEach(function (a) {
        if (hit && a.getAttribute('href') === '#' + hit) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      mark();
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- 3. Letter: leader lines from the black notes to the highlighted phrases ---------- */
  var letter = $('[data-letter]');
  var wires = letter && $('.letter__wires', letter);
  function drawWires() {
    if (!wires) return;
    var on = getComputedStyle(letter).getPropertyValue('--wires').trim() === '1';
    var box = letter.getBoundingClientRect();
    var ox = box.left + letter.clientLeft, oy = box.top + letter.clientTop;
    var w = letter.clientWidth, h = letter.clientHeight;
    wires.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var out = '';
    if (on) {
      $$('.pnote[data-for]', letter).forEach(function (note) {
        var target = d.getElementById(note.getAttribute('data-for'));
        if (!target) return;
        var n = note.getBoundingClientRect();
        var rects = target.getClientRects();
        if (!rects.length || !n.width) return;
        var para = target.closest('p, address') || target;
        var col = para.getBoundingClientRect();
        var left = n.left + n.width / 2 < col.left + col.width / 2;
        var r = rects[0], best = Infinity;
        for (var i = 0; i < rects.length; i++) {              // a wrapped phrase: aim at the fragment nearest the note
          var gap = left ? rects[i].left - col.left : col.right - rects[i].right;
          if (gap < best - 0.5) { best = gap; r = rects[i]; }
        }
        var x0 = (left ? n.right : n.left) - ox;
        var y0 = n.top + Math.min(n.height / 2, 22) - oy;
        var xg = (left ? col.left - 14 : col.right + 14) - ox;
        var yu = r.bottom + 2.5 - oy;
        var inset = Math.min(16, r.width / 2);
        var xt = (left ? r.left + inset : r.right - inset) - ox;
        var yt = r.bottom - 1.5 - oy;
        var f = function (v) { return Math.round(v * 10) / 10; };
        out += '<path class="wire" d="M' + f(x0) + ' ' + f(y0) + 'H' + f(xg) + 'V' + f(yu) + 'H' + f(xt) + 'V' + f(yt + 1) + '"/>' +
          '<path class="wire__tip" d="M' + f(xt - 3.4) + ' ' + f(yt + 4.4) + 'L' + f(xt) + ' ' + f(yt) + 'L' + f(xt + 3.4) + ' ' + f(yt + 4.4) + '"/>' +
          '<circle class="wire__dot" cx="' + f(x0) + '" cy="' + f(y0) + '" r="2"/>';
      });
    }
    wires.innerHTML = out;
  }
  if (wires) {
    drawWires();
    window.addEventListener('load', drawWires);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(drawWires);
    if ('ResizeObserver' in window) new ResizeObserver(drawWires).observe(letter);
    else window.addEventListener('resize', drawWires);
  }

  /* ---------- 4. Projects: the index on the left filters the rows ---------- */
  var work = $('.work');
  if (work) {
    var rows = $$('.row', work);
    var filters = $$('[data-filter]', work);
    var count = $('[data-count]', work);
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.getAttribute('data-filter'), n = 0;
        filters.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        rows.forEach(function (row) {
          var show = f === 'all' || row.getAttribute('data-group') === f;
          row.hidden = !show;
          if (show) { n++; row.classList.add('is-in'); }
        });
        if (count) count.textContent = n + (n === 1 ? ' entry' : ' entries') + ' shown';
      });
    });
  }

  /* ---------- 5. Plates with two views (light / dark, cover / diagram) ---------- */
  $$('[data-plate]').forEach(function (plate) {
    var frames = $$('.plate__frame', plate);
    var btns = $$('[data-show]', plate);
    var cap = $('[data-cap]', plate);
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-show');
        frames.forEach(function (f) {
          var on = f.getAttribute('data-view') === v;
          f.classList.toggle('is-on', on);
          if (on && cap) cap.textContent = f.getAttribute('data-caption');
        });
        btns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      });
    });
  });

  /* ---------- 6. Route: a log entry lights its pin on the map ---------- */
  var map = $('.map');
  if (map) {
    $$('.stop[data-stop]').forEach(function (stop) {
      var id = stop.getAttribute('data-stop');
      var hot = function (on) {
        $$('.pin--' + id + ', .map__lab--' + id, map).forEach(function (el) { el.classList.toggle('is-hot', on); });
      };
      stop.addEventListener('mouseenter', function () { hot(true); });
      stop.addEventListener('mouseleave', function () { hot(false); });
      stop.addEventListener('focusin', function () { hot(true); });
      stop.addEventListener('focusout', function () { hot(false); });
    });
  }

  /* ---------- 7. Route map in 3D: one height field, contoured once, re-projected as it spins ----------
     The static SVG in the page is the no-JS drawing. Here the mountain is a function height(x, y) on a
     unit disc; marching squares turns it into contour loops once, and every frame only re-projects them
     (rotate about the vertical axis, keep the camera's tilt). Loops are painted low-to-high and filled
     with the card colour, so nearer, higher ground hides the lines behind it. */
  (function () {
    var fig = $('.map'), stage = fig && $('.map__stage', fig), svg = stage && $('.map__svg', stage);
    var terrainG = svg && $('.map__terrain', svg), routeEl = svg && $('.map__route', svg), pinsG = svg && $('.map__pins', svg);
    if (!terrainG || !routeEl || !pinsG || !window.Float32Array || !window.requestAnimationFrame) return;

    var NS = 'http://www.w3.org/2000/svg';
    var CX = 320, CY = 372, S = 262.2, K = 0.42, ZS = 226;          // the camera of the original drawing
    var UZ = K * S * Math.sqrt(1 - K * K) / ZS, UXY = Math.sqrt(1 - K * K); // a step toward the camera, in model units
    var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var r1 = function (v) { return Math.round(v * 10) / 10; };
    var r3 = function (v) { return Math.round(v * 1000) / 1000; };

    /* the mountain */
    function bump(x, y, cx, cy, a, s) { x -= cx; y -= cy; return a * Math.exp(-(x * x + y * y) / (2 * s * s)); }
    function height(x, y) {
      var r = Math.sqrt(x * x + y * y);
      if (r >= 0.985) return 0;
      var phi = Math.atan2(y, x);
      var t = r / (0.88 + 0.05 * Math.sin(3 * phi + 0.6) + 0.035 * Math.sin(5 * phi + 2.1));
      if (t >= 1) return 0;
      var u = t <= 0.62 ? 0 : (t - 0.62) / 0.38, fall = 1 - u * u * (3 - 2 * u);
      var h = bump(x, y, 0, 0.02, 0.30, 0.50)            // the massif
            + bump(x, y, 0.088, -0.02, 0.70, 0.13)       // summit: Jafar AI
            + bump(x, y, -0.345, 0.05, 0.30, 0.10)       // west shoulder: Ambidex
            + bump(x, y, 0.36, 0.12, 0.22, 0.085)        // east shoulder: Innov X
            + bump(x, y, -0.40, 0.24, 0.20, 0.20)        // the ridge the route climbs
            + bump(x, y, 0.18, -0.42, 0.13, 0.17)        // a buttress, so the far side is not a plain cone
            + bump(x, y, 0.52, -0.10, 0.07, 0.14)        // and a low spur to the east
            + 0.026 * Math.sin(7.3 * x + 1.3) * Math.cos(6.1 * y - 0.6)
            + 0.017 * Math.sin(11.9 * x - 9.4 * y + 0.4)
            + 0.010 * Math.sin(17.0 * x + 13.0 * y + 2.0);
      return h > 0 ? h * fall : 0;
    }

    /* contour loops by marching squares, stitched through shared grid edges */
    var N = 100, LO = -1, STEP = 2 / N, W = N + 1, grid = new Float32Array(W * W), i, j;
    for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) grid[j * W + i] = height(LO + i * STEP, LO + j * STEP);

    function trace(level) {
      var pts = {}, link = {};
      function H(a, b) {                                 // crossing on the edge (a,b)-(a+1,b)
        var id = 2 * (b * W + a), v0 = grid[b * W + a], v1 = grid[b * W + a + 1];
        if (!pts[id]) pts[id] = [LO + (a + (level - v0) / (v1 - v0)) * STEP, LO + b * STEP];
        return id;
      }
      function V(a, b) {                                 // crossing on the edge (a,b)-(a,b+1)
        var id = 2 * (b * W + a) + 1, v0 = grid[b * W + a], v1 = grid[(b + 1) * W + a];
        if (!pts[id]) pts[id] = [LO + a * STEP, LO + (b + (level - v0) / (v1 - v0)) * STEP];
        return id;
      }
      function join(a, b) { (link[a] || (link[a] = [])).push(b); (link[b] || (link[b] = [])).push(a); }
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var tl = grid[y * W + x], tr = grid[y * W + x + 1], bl = grid[(y + 1) * W + x], br = grid[(y + 1) * W + x + 1];
        var k = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
        switch (k) {
          case 1: case 14: join(V(x, y), H(x, y + 1)); break;
          case 2: case 13: join(H(x, y + 1), V(x + 1, y)); break;
          case 3: case 12: join(V(x, y), V(x + 1, y)); break;
          case 4: case 11: join(H(x, y), V(x + 1, y)); break;
          case 6: case 9: join(H(x, y), H(x, y + 1)); break;
          case 7: case 8: join(H(x, y), V(x, y)); break;
          case 5: case 10:
            if ((k === 5) === ((tl + tr + bl + br) / 4 >= level)) { join(H(x, y), V(x, y)); join(H(x, y + 1), V(x + 1, y)); }
            else { join(H(x, y), V(x + 1, y)); join(V(x, y), H(x, y + 1)); }
        }
      }
      var loops = [], seen = {};
      for (var id in link) {
        if (seen[id]) continue;
        var chain = [], cur = id;
        while (cur != null && !seen[cur]) {
          seen[cur] = 1; chain.push(pts[cur]);
          var nb = link[cur], next = null;
          for (var q = 0; q < nb.length; q++) if (!seen[nb[q]]) { next = nb[q]; break; }
          cur = next;
        }
        if (chain.length < 6) continue;
        var xs = new Float32Array(chain.length), ys = new Float32Array(chain.length), mx = 0, my = 0;
        for (var c = 0; c < chain.length; c++) { xs[c] = chain[c][0]; ys[c] = chain[c][1]; mx += xs[c]; my += ys[c]; }
        loops.push({ x: xs, y: ys, mx: mx / chain.length, my: my / chain.length });
      }
      return loops;
    }

    var levels = [], total = 0;
    for (var z = 0.018; z < 1.02; z += 0.031) { var lp = trace(z); if (lp.length) { levels.push({ z: z, loops: lp }); total += lp.length; } }
    if (!total) return;

    /* the route: a spline through the real stops, laid on the surface */
    function spline(P, per) {
      var out = [], cr = function (a, b, c, d, t) { return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t); };
      for (var s = 0; s < P.length - 1; s++) {
        var p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
        for (var q = 0; q < per; q++) out.push([cr(p0[0], p1[0], p2[0], p3[0], q / per), cr(p0[1], p1[1], p2[1], p3[1], q / per)]);
      }
      out.push(P[P.length - 1]);
      return out;
    }
    /* in date order, and each stop higher than the last: 1337 at the foot, two projects on the lower slope,
       Ambidex on the east shoulder, back across to Innov X on the higher west shoulder, then Inception and
       a month at The FORGE on the saddle, and Jafar AI on the summit */
    var WAY = [[-0.69, 0.506], [-0.45, 0.47], [-0.12, 0.43], [0.17, 0.34], [0.36, 0.12], [0.12, 0.21], [-0.15, 0.20], [-0.345, 0.05], [-0.22, 0.02], [-0.11, 0.035], [0.088, -0.02]];
    var route = spline(WAY, 14).map(function (p) { return [p[0], p[1], height(p[0], p[1]) + 0.008]; });

    /* is this surface point behind the mountain, seen from the camera? */
    function occluded(x, y, zz, sn, cs) {
      for (var t = 0.03; t < 1.3; t += 0.03) {
        var qx = x + sn * UXY * t, qy = y + cs * UXY * t;
        if (qx * qx + qy * qy > 0.95) return false;
        if (height(qx, qy) > zz + UZ * t + 0.014) return true;
      }
      return false;
    }

    /* take over the drawing that is already in the page */
    while (terrainG.firstChild) terrainG.removeChild(terrainG.firstChild);
    var paths = [];
    for (i = 0; i < total; i++) { var pe = document.createElementNS(NS, 'path'); terrainG.appendChild(pe); paths.push(pe); }
    var backEl = routeEl.cloneNode(false);
    backEl.setAttribute('class', 'map__route map__route--back');
    routeEl.parentNode.insertBefore(backEl, routeEl);
    var revealEl = $('.map__reveal', svg), ticks = $$('.map__ticks', svg);
    var cards = $$('.map__cards text', svg).map(function (el) {
      return { el: el, a: { N: -Math.PI / 4, E: Math.PI / 4, S: 3 * Math.PI / 4, W: -3 * Math.PI / 4 }[el.textContent.trim()] || 0 };
    });
    var labs = $$('.map__lab', stage);
    var pins = [['school', 0, 52], ['edu', 1, 30, 'Edu platform'], ['matcha', 2, 30, 'Matcha'], ['ambidex', 4, 50], ['innovx', 7, 60], ['inception', 8, 30, 'Inception'], ['forge', 9, 38, null, 'r'], ['jafar', 10, 44]]
      .map(function (d) {
        var el = $('.pin--' + d[0], pinsG); if (!el) return null;
        var disc = $('.pin__disc', el), w = WAY[d[1]], lab = null;
        labs.forEach(function (l) { if (d[3] ? l.textContent.trim() === d[3] : l.classList.contains('map__lab--' + d[0])) lab = l; });
        return { el: el, stem: $('.pin__stem', el), base: $('.pin__base', el), head: $('.pin__head', el), lab: lab,
                 r: disc ? parseFloat(disc.getAttribute('r')) : 6, x: w[0], y: w[1], z: height(w[0], w[1]) + 0.008, up: d[2], left: null, side: d[4] || null, depth: 0 };
      }).filter(Boolean);

    var yaw = calm ? 0 : -0.75, vel = 0, raf = 0, dirty = false, dragging = false, tween = null, touched = false;
    var auto = !calm, arrived = false, onScreen = !window.IntersectionObserver, restAt = 0, prev = 0, odd = false;
    var TURN = 2 * Math.PI / 75000;                                   // idle spin: one turn in 75 seconds

    function loopPath(l, c, s, lift) {
      var d = '', xs = l.x, ys = l.y;
      for (var p = 0; p < xs.length; p++) d += (p ? 'L' : 'M') + r1(CX + S * (xs[p] * c - ys[p] * s)) + ' ' + r1(CY + S * K * (xs[p] * s + ys[p] * c) - lift);
      return d + 'Z';
    }

    function render() {
      var c = Math.cos(yaw), s = Math.sin(yaw), n = 0, p, d, X, Y;
      var nearer = function (a, b) { return (a.mx * s + a.my * c) - (b.mx * s + b.my * c); };
      for (p = 0; p < levels.length; p++) {
        var lv = levels[p];
        if (lv.loops.length > 1) lv.loops.sort(nearer);
        for (var q = 0; q < lv.loops.length; q++) paths[n++].setAttribute('d', loopPath(lv.loops[q], c, s, ZS * lv.z));
      }

      var dm = '', dM = '';
      for (p = 0; p < 120; p++) {
        var a = p * Math.PI / 60 + yaw, ca = Math.cos(a), sa = Math.sin(a), major = p % 5 === 0, far = major ? 1.075 : 1.047;
        d = 'M' + r1(CX + S * 1.02 * ca) + ' ' + r1(CY + S * K * 1.02 * sa) + 'L' + r1(CX + S * far * ca) + ' ' + r1(CY + S * K * far * sa);
        if (major) dM += d; else dm += d;
      }
      if (ticks[0]) ticks[0].setAttribute('d', dm);
      if (ticks[1]) ticks[1].setAttribute('d', dM);
      cards.forEach(function (cd) {                      // letters lie flat on the ground, tops outward
        var b = cd.a + yaw, cb = Math.cos(b), sb = Math.sin(b);
        cd.el.setAttribute('transform', 'matrix(' + r3(-sb) + ' ' + r3(cb * K) + ' ' + r3(-cb) + ' ' + r3(-sb * K) + ' ' + r1(CX + S * 1.078 * cb) + ' ' + r1(CY + S * K * 1.078 * sb) + ')');
      });

      var front = '', back = '', all = '', was = null, lx = 0, ly = 0;
      for (p = 0; p < route.length; p++) {
        var rp = route[p], hid = occluded(rp[0], rp[1], rp[2], s, c);
        X = r1(CX + S * (rp[0] * c - rp[1] * s)); Y = r1(CY + S * K * (rp[0] * s + rp[1] * c) - ZS * rp[2]);
        all += (p ? 'L' : 'M') + X + ' ' + Y;
        d = (hid !== was ? (p ? 'M' + lx + ' ' + ly + 'L' : 'M') : 'L') + X + ' ' + Y;
        if (hid) back += d; else front += d;
        was = hid; lx = X; ly = Y;
      }
      routeEl.setAttribute('d', front); backEl.setAttribute('d', back);
      if (revealEl) revealEl.setAttribute('d', all);

      pins.forEach(function (pn) {
        var xr = pn.x * c - pn.y * s, yr = pn.x * s + pn.y * c, px = r1(CX + S * xr), py = r1(CY + S * K * yr - ZS * pn.z), hy = r1(py - pn.up);
        var gone = occluded(pn.x, pn.y, pn.z, s, c);
        pn.depth = yr;
        if (pn.stem) pn.stem.setAttribute('d', 'M' + px + ' ' + py + 'V' + r1(hy + pn.r));
        if (pn.base) { pn.base.setAttribute('cx', px); pn.base.setAttribute('cy', py); }
        if (pn.head) pn.head.setAttribute('transform', 'translate(' + px + ' ' + hy + ')');
        pn.el.classList.toggle('is-far', gone);
        if (pn.lab) {
          if (pn.side) pn.left = pn.side === 'l';
          else if (pn.left === null) pn.left = px < 320; else if (px < 296) pn.left = true; else if (px > 344) pn.left = false;
          pn.lab.style.setProperty('--x', r1(px / 6.4)); pn.lab.style.setProperty('--y', r1(hy / 5.2));
          pn.lab.classList.toggle('map__lab--l', pn.left); pn.lab.classList.toggle('is-far', gone);
        }
      });
      pins.slice().sort(function (a, b) { return a.depth - b.depth; }).forEach(function (pn) { pinsG.appendChild(pn.el); });
    }

    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      if (tween) {
        if (!tween.t0) tween.t0 = now;
        var u = Math.min(1, (now - tween.t0) / tween.ms);
        yaw = tween.from + (tween.to - tween.from) * (1 - Math.pow(1 - u, 3));
        if (u >= 1) tween = null;
      } else if (!dragging && Math.abs(vel) > 0.0004) { yaw += vel; vel *= 0.94; }
      else if (drifting() && now >= restAt) {                          // idle: keep turning slowly, drawn every other frame
        if (prev) yaw -= TURN * Math.min(60, now - prev);
        prev = now; odd = !odd;
        if (odd && !dirty) { kick(); return; }
      } else if (!dirty) { prev = 0; if (drifting()) kick(); return; }
      if (!drifting() || now < restAt) prev = 0;
      dirty = false; render();
      if (tween || (!dragging && Math.abs(vel) > 0.0004) || drifting()) kick();
    }
    function drifting() { return auto && arrived && onScreen && !dragging; }
    function rest(ms) { restAt = (window.performance ? performance.now() : 0) + ms; prev = 0; }
    function spinTo(target, ms) {
      vel = 0;
      if (calm || !ms) { tween = null; yaw = target; render(); return; }
      tween = { from: yaw, to: target, ms: ms, t0: 0 }; kick();
    }
    function touch() { if (!touched) { touched = true; fig.classList.add('is-spun'); } }

    /* drag to spin: horizontal drags turn the map, vertical swipes still scroll the page */
    var lastX = 0, lastT = 0, perPx = 0.008;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; tween = null; vel = 0; lastX = e.clientX; lastT = e.timeStamp; touch();
      perPx = 3.6 / Math.max(240, stage.getBoundingClientRect().width);
      stage.classList.add('is-dragging');
      if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
      if (e.pointerType === 'mouse') e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var step = -(e.clientX - lastX) * perPx, dt = Math.max(1, e.timeStamp - lastT);
      yaw += step; vel = 0.6 * vel + 0.4 * (step / dt * 16);
      lastX = e.clientX; lastT = e.timeStamp; dirty = true; kick();
    });
    var drop = function () {
      if (!dragging) return;
      dragging = false; stage.classList.remove('is-dragging'); rest(2600);
      if (calm) vel = 0;
      kick();
    };
    stage.addEventListener('pointerup', drop);
    stage.addEventListener('pointercancel', function () { vel = 0; drop(); });

    /* the same thing for keyboards: rotate left, face the route, rotate right */
    var ctl = document.createElement('div');
    ctl.className = 'map__ctl';
    ctl.innerHTML = '<span class="map__hint">Drag to spin</span><span class="pillctl">' +
      '<button type="button" data-spin="-1" aria-label="Rotate the map left">←</button>' +
      '<button type="button" data-spin="0" aria-label="Turn the map back to face the route">front</button>' +
      '<button type="button" data-spin="1" aria-label="Rotate the map right">→</button>' +
      '<button type="button" data-auto aria-pressed="' + auto + '" aria-label="Keep the map turning slowly">' + (auto ? 'pause' : 'spin') + '</button></span>';
    stage.parentNode.insertBefore(ctl, stage.nextSibling);
    $$('[data-spin]', ctl).forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = +b.getAttribute('data-spin'), goal = tween ? tween.to : yaw;
        touch(); rest(dir ? 3200 : 4500);
        spinTo(dir ? goal - dir * Math.PI / 4 : Math.round(goal / (2 * Math.PI)) * 2 * Math.PI, dir ? 520 : 800);
      });
    });
    var autoBtn = $('[data-auto]', ctl);
    if (autoBtn) autoBtn.addEventListener('click', function () {
      auto = !auto; arrived = true; rest(0); touch();
      autoBtn.setAttribute('aria-pressed', auto); autoBtn.textContent = auto ? 'pause' : 'spin';
      kick();
    });
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; prev = 0; if (onScreen) kick(); }, { threshold: 0.05 }).observe(stage);

    fig.classList.add('is-3d');
    render();
    /* first sight: it turns to face you while the route draws itself */
    var arrive = function () { arrived = true; rest(1900); if (!touched && !calm) spinTo(0, 1700); else kick(); fig.classList.add('is-spun'); };
    if (fig.classList.contains('is-in') || !window.MutationObserver) arrive();
    else {
      var mo = new MutationObserver(function () { if (fig.classList.contains('is-in')) { mo.disconnect(); arrive(); } });
      mo.observe(fig, { attributes: true, attributeFilter: ['class'] });
    }
  })();

  /* ---------- 8. Stack figure: the layers float, a signal runs down the rails, and each layer takes a turn ----------
     Nothing here redraws the illustration; it only moves the five slabs that are already in the page, together
     with their leader lines and call-outs. Pointing at a layer (or its label) holds the turn on that layer. */
  (function () {
    var stack = $('.stack'), svg = stack && $('.stack__svg', stack), rails = svg && $('.rails', svg);
    var slabs = svg ? $$('.slab', svg) : [];
    if (!rails || slabs.length < 2) return;
    var NS = 'http://www.w3.org/2000/svg', layers = [];
    slabs.forEach(function (s) {
      var k = parseInt(s.style.getPropertyValue('--k'), 10) || 0;
      var bob = document.createElementNS(NS, 'g');                 // an inner group, so floating never fights the lift
      bob.setAttribute('class', 'slab__bob');
      while (s.firstChild) bob.appendChild(s.firstChild);
      s.appendChild(bob);
      layers[k] = [s];
    });
    var notes = $$('.co', stack);
    notes.forEach(function (li, i) { var k = notes.length - 1 - i; li.style.setProperty('--k', k); if (layers[k]) layers[k].push(li); });
    $$('.lead', svg).forEach(function (g) {                        // leader lines sit 126 units apart, bottom layer first
      var first = $('path', g), m = first ? first.getAttribute('d').split(' ')[1] : null;
      var k = m ? Math.round((576.8 - parseFloat(m)) / 126) : -1;
      g.style.setProperty('--k', k);
      if (layers[k]) layers[k].push(g);
    });
    ['M38.8 81.8V574.8', 'M281.2 81.8V574.8'].forEach(function (dd, i) {   // drawn under the slabs, so the signal
      var p = document.createElementNS(NS, 'path');                         // only shows in the gaps between layers
      p.setAttribute('class', 'flow flow--' + i); p.setAttribute('d', dd); p.setAttribute('pathLength', '100');
      rails.parentNode.insertBefore(p, rails.nextSibling);
    });

    var hot = -1, held = false, seen = !hasIO, timer = 0;
    var setHot = function (k) {
      hot = k;
      layers.forEach(function (parts, i) { if (parts) parts.forEach(function (el) { el.classList.toggle('is-hot', i === k); }); });
    };
    var turn = function () { if (!held && seen) setHot(hot <= 0 ? layers.length - 1 : hot - 1); };   // top to bottom, like the signal
    layers.forEach(function (parts, k) {
      if (!parts) return;
      parts.forEach(function (el) {
        el.addEventListener('mouseenter', function () { held = true; setHot(k); });
        el.addEventListener('mouseleave', function () { held = false; });
      });
    });
    var start = function () {
      stack.classList.add('is-live');
      if (!reduce && !timer) timer = setInterval(turn, 2400);
    };
    if (hasIO) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; if (!seen && !held) setHot(-1); }, { threshold: 0.2 }).observe(stack);
    setTimeout(start, 1400);                                       // after the layers have risen into place
  })();
})();
