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

  /* ---------- 2. Dock: takes over when the top bar scrolls away; marks the current section ---------- */
  var dock = $('.dock');
  var bar = $('.bar');
  if (dock && bar && hasIO) {
    new IntersectionObserver(function (entries) {
      dock.classList.toggle('is-away', entries[0].isIntersecting);
    }, { threshold: 0 }).observe(bar);
  } else if (dock) {
    dock.classList.remove('is-away');
  }
  var spyLinks = $$('.bar__nav a, .dock a[href^="#"]');
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

  /* ---------- 4. Terrain: a small procedural map, redrawn on click ---------- */
  /*TERRAIN-CORE-START*/
  function terrainMarkup(seed) {
    var s = seed >>> 0;
    function R() { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function int(n) { return Math.floor(R() * n); }
    var C = 17, RW = 11, c = 24, m = 12, half = c / 2;
    var g = new Uint8Array(C * RW);                       // 0 paper, 1 light, 2 dark, 3 hatch, 4 tree
    function at(i, j) { return i < 0 || j < 0 || i >= C || j >= RW ? 0 : g[j * C + i]; }
    var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    function grow(type, i0, j0, n) {
      i0 = Math.max(1, Math.min(C - 2, i0)); j0 = Math.max(1, Math.min(RW - 2, j0));
      var tries = 0;
      while (at(i0, j0) !== 0 && tries++ < 40) { i0 = 1 + int(C - 2); j0 = 1 + int(RW - 2); }
      if (at(i0, j0) !== 0) return;
      g[j0 * C + i0] = type;
      var cells = [[i0, j0]], guard = 0;
      while (cells.length < n && guard++ < n * 40) {
        var best = null, score = -1;
        for (var k = 0; k < 5; k++) {
          var p = cells[int(cells.length)], dir = DIRS[int(4)], x = p[0] + dir[0], y = p[1] + dir[1];
          if (x < 0 || y < 0 || x >= C || y >= RW || at(x, y) !== 0) continue;
          var sc = (at(x + 1, y) === type) + (at(x - 1, y) === type) + (at(x, y + 1) === type) + (at(x, y - 1) === type) + R() * 0.8;
          if (sc > score) { score = sc; best = [x, y]; }
        }
        if (best) { g[best[1] * C + best[0]] = type; cells.push(best); }
      }
    }
    var flip = R() < 0.5;
    var A = [1 + int(4), RW - 2 - int(3)], B = [C - 2 - int(4), 1 + int(3)];
    if (flip) { A[0] = C - 1 - A[0]; B[0] = C - 1 - B[0]; }
    grow(1, A[0], A[1], 11 + int(9));
    grow(1, B[0], B[1], 8 + int(8));
    var mx = Math.round((A[0] + B[0]) / 2), my = Math.round((A[1] + B[1]) / 2);
    grow(2, mx + int(5) - 2, my + int(3) - 1, 9 + int(10));
    grow(3, mx + (flip ? 3 : -3) + int(3) - 1, my - 2 - int(2), 6 + int(7));
    grow(1, mx + (flip ? -3 : 3) + int(3) - 1, my + 2 + int(2), 8 + int(9));
    if (R() < 0.55) grow(2, 1 + int(C - 2), 1 + int(RW - 2), 3 + int(4));
    if (R() < 0.45) grow(3, 1 + int(C - 2), 1 + int(RW - 2), 3 + int(5));
    var trees = 5 + int(8), guard2 = 0;
    while (trees > 0 && guard2++ < 400) {
      var ti = int(C), tj = int(RW);
      if (at(ti, tj) !== 0) continue;
      var near = 0;
      for (var q = 0; q < 4; q++) if (at(ti + DIRS[q][0], tj + DIRS[q][1]) !== 0) near++;
      if (near === 0 && R() < 0.8) continue;
      g[tj * C + ti] = 4; trees--;
      if (trees > 0 && at(ti + 1, tj) === 0 && ti + 1 < C && R() < 0.6) { g[tj * C + ti + 1] = 4; trees--; }
    }
    function cellPath(i, j, t) {
      var x = m + i * c, y = m + j * c, x2 = x + c, y2 = y + c;
      var up = at(i, j - 1) === t, dn = at(i, j + 1) === t, lf = at(i - 1, j) === t, rt = at(i + 1, j) === t;
      var tl = !up && !lf ? half : 0, tr = !up && !rt ? half : 0, br = !dn && !rt ? half : 0, bl = !dn && !lf ? half : 0;
      return 'M' + (x + tl) + ' ' + y + 'H' + (x2 - tr) + (tr ? 'A' + tr + ' ' + tr + ' 0 0 1 ' + x2 + ' ' + (y + tr) : '') +
        'V' + (y2 - br) + (br ? 'A' + br + ' ' + br + ' 0 0 1 ' + (x2 - br) + ' ' + y2 : '') +
        'H' + (x + bl) + (bl ? 'A' + bl + ' ' + bl + ' 0 0 1 ' + x + ' ' + (y2 - bl) : '') +
        'V' + (y + tl) + (tl ? 'A' + tl + ' ' + tl + ' 0 0 1 ' + (x + tl) + ' ' + y : '') + 'Z';
    }
    var paths = ['', '', '', ''], dots = '', dotsDark = '', treeD = '';
    for (var j = 0; j < RW; j++) for (var i = 0; i < C; i++) {
      var t = g[j * C + i], cx = m + i * c + half, cy = m + j * c + half;
      if (t >= 1 && t <= 3) paths[t] += cellPath(i, j, t);
      if (t === 4) treeD += 'M' + cx + ' ' + (cy - 8) + 'l5 6.4h-2.6l5.2 6.8h-15.2l5.2-6.8h-2.6z';
      else {
        var dot = 'M' + (cx - 1.3) + ' ' + cy + 'a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0';
        if (t === 2) dotsDark += dot; else dots += dot;
      }
    }
    var pos = function (p) { return [m + p[0] * c + half, m + p[1] * c + half]; };
    var a = pos(A), b = pos(B);
    return '<path class="tb tb--hatch" style="--i:2" d="' + paths[3] + '"/>' +
      '<path class="tb tb--light" style="--i:0" d="' + paths[1] + '"/>' +
      '<path class="tb tb--dark" style="--i:1" d="' + paths[2] + '"/>' +
      '<path class="td" d="' + dots + '"/><path class="td td--dark" d="' + dotsDark + '"/>' +
      '<path class="tb tt" style="--i:3" d="' + treeD + '"/>' +
      '<circle class="tb ts" style="--i:4" cx="' + a[0] + '" cy="' + a[1] + '" r="6.6"/>' +
      '<circle class="tb tg" style="--i:4" cx="' + b[0] + '" cy="' + b[1] + '" r="5.6"/>';
  }
  /*TERRAIN-CORE-END*/
  var terrain = $('[data-terrain]');
  if (terrain) {
    var layer = $('.terrain__layer', terrain);
    var seedOut = $('[data-seed]', terrain);
    var hex = function (n) { return ('0000' + (n >>> 0).toString(16).toUpperCase()).slice(-4); };
    var redraw = function () {
      var seed = (Math.random() * 0xFFFF) | 0;
      layer.innerHTML = terrainMarkup(seed);
      if (seedOut) seedOut.textContent = hex(seed);
      terrain.classList.remove('is-fresh');
      void terrain.offsetWidth;                         // restart the staged fade
      terrain.classList.add('is-fresh');
    };
    $$('[data-redraw]', terrain).forEach(function (b) { b.addEventListener('click', redraw); });
  }

  /* ---------- 5. Projects: the index on the left filters the rows ---------- */
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

  /* ---------- 6. Plates with two views (light / dark, cover / diagram) ---------- */
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

  /* ---------- 7. Route: a log entry lights its pin on the map ---------- */
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
})();
