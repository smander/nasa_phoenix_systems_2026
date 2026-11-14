/* @ds-bundle: {"format":4,"namespace":"PolarWindow","components":[{"name":"SkyHero"},{"name":"StateBadge"},{"name":"Readout"},{"name":"MonthBar"},{"name":"PickItem"},{"name":"QualityBadge"},{"name":"Button"},{"name":"PlayButton"},{"name":"SegmentedControl"},{"name":"Select"},{"name":"Slider"},{"name":"Panel"},{"name":"RuleRow"},{"name":"Terminal"},{"name":"GlossaryTip"},{"name":"HonestyNote"},{"name":"HorizonRule"},{"name":"Skeleton"}]} */
(function () {
  var React = window.React;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useMemo = React.useMemo;
  var uid = 0; function useId(p) { var r = useRef(null); if (r.current === null) r.current = (p || 'pw') + (++uid); return r.current; }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  var STATES = {
    both: { badge: 'Power and contact', head: 'Sun and Earth both up', sub: 'Arrays generate and the direct-to-Earth link is open.' },
    sun: { badge: 'Power only', head: 'Sunlit, Earth out of sight', sub: 'Arrays generate; data waits for Earth to rise.' },
    earth: { badge: 'Contact only', head: 'Earth in view, Sun hidden', sub: 'Radio link open; running on stored energy.' },
    none: { badge: 'Blackout', head: 'No sunlight, no Earth', sub: 'Batteries carry the lander; no direct radio link.' }
  };
  var LANE = { both: 'var(--both)', sun: 'var(--sun)', earth: 'var(--earth)', none: 'var(--none)' };

  /* ---------- small pieces ---------- */
  function StateBadge(p) {
    var s = p.state || 'both';
    return h('span', { className: cx('pw-pill', p.animateKey != null && 'pw-flip'), key: p.animateKey, 'data-state': s, role: 'status' },
      h('i', { 'aria-hidden': true }), h('span', null, p.label || STATES[s].badge));
  }

  var QICON = {
    region: h('svg', { width: 11, height: 11, viewBox: '0 0 11 11', 'aria-hidden': true }, h('rect', { x: 1, y: 1, width: 9, height: 9, rx: 2, fill: 'none', stroke: 'currentColor', strokeDasharray: '2 1.5' })),
    exact: h('svg', { width: 11, height: 11, viewBox: '0 0 11 11', 'aria-hidden': true }, h('circle', { cx: 5.5, cy: 5.5, r: 2.5, fill: 'currentColor' }), h('circle', { cx: 5.5, cy: 5.5, r: 4.5, fill: 'none', stroke: 'currentColor' })),
    approximate: h('svg', { width: 11, height: 11, viewBox: '0 0 11 11', 'aria-hidden': true }, h('text', { x: 5.5, y: 9, textAnchor: 'middle', fontSize: 10, fill: 'currentColor', fontFamily: 'var(--font-mono)' }, '≈')),
    custom: h('svg', { width: 11, height: 11, viewBox: '0 0 11 11', 'aria-hidden': true }, h('path', { d: 'M5.5 1v9M1 5.5h9', stroke: 'currentColor', strokeWidth: 1.4 }))
  };
  var QLABEL = { region: 'region centre', exact: 'exact point', approximate: 'approximate', custom: 'custom point' };
  function QualityBadge(p) {
    var q = p.quality || 'region';
    return h('span', { className: 'pw-qbadge', 'data-q': q, title: p.source || undefined }, QICON[q], p.label || QLABEL[q]);
  }

  function HonestyNote(p) { return h('span', { className: 'pw-note', 'data-on': p.onSky ? 'sky' : undefined }, p.children); }

  function Button(p) {
    var rest = Object.assign({}, p); delete rest.variant; delete rest.icon;
    return h('button', Object.assign({ type: 'button' }, rest, { className: cx('pw-btn', 'pw-btn-' + (p.variant || 'primary'), p.className) }), p.icon, p.children);
  }

  function PlayButton(p) {
    return h('button', { type: 'button', className: 'pw-play', 'aria-label': p.playing ? 'Pause' : 'Play the month', 'aria-pressed': !!p.playing, onClick: p.onClick },
      h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true },
        p.playing ? h('g', { fill: 'currentColor' }, h('rect', { x: 2.5, y: 2, width: 3, height: 10, rx: 1 }), h('rect', { x: 8.5, y: 2, width: 3, height: 10, rx: 1 }))
          : h('path', { d: 'M3.5 1.8v10.4L12 7z', fill: 'currentColor' })));
  }

  function SegmentedControl(p) {
    var st = useState(p.value != null ? p.value : p.options[0].value), v = p.value != null ? p.value : st[0];
    return h('div', { className: 'pw-seg', role: 'group', 'aria-label': p.label },
      p.options.map(function (o) {
        return h('button', { key: o.value, type: 'button', 'aria-pressed': o.value === v, disabled: o.disabled,
          onClick: function () { st[1](o.value); p.onChange && p.onChange(o.value); } }, o.label);
      }));
  }

  function Select(p) {
    var id = useId('sel');
    return h('label', { className: 'pw-field-inline', htmlFor: id },
      p.label && h('span', { className: 'pw-eyebrow' }, p.label),
      h('select', { id: id, className: 'pw-select', defaultValue: p.value, onChange: p.onChange && function (e) { p.onChange(e.target.value); } },
        p.options.map(function (o) { return h('option', { key: o.value || o, value: o.value || o }, o.label || o); })));
  }

  function Slider(p) {
    var st = useState(p.value != null ? p.value : p.min), id = useId('sl');
    return h('div', { className: 'pw-field' },
      h('label', { className: 'pw-eyebrow', htmlFor: id }, p.label),
      h('div', { className: 'pw-slider' },
        h('input', { id: id, type: 'range', min: p.min, max: p.max, step: p.step || 1, value: st[0],
          onChange: function (e) { var n = +e.target.value; st[1](n); p.onChange && p.onChange(n); } }),
        h('output', { htmlFor: id }, (p.format ? p.format(st[0]) : st[0] + (p.unit ? ' ' + p.unit : '')))));
  }

  function useCountUp(target, decimals) {
    var st = useState(reduced() ? target : 0), ref = useRef(st[0]);
    useEffect(function () {
      if (reduced() || typeof target !== 'number') { st[1](target); return; }
      var from = ref.current, t0 = performance.now(), D = 900, raf;
      function step(now) { var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 4), v = from + (target - from) * e; ref.current = v; st[1](v); if (k < 1) raf = requestAnimationFrame(step); }
      raf = requestAnimationFrame(step); return function () { cancelAnimationFrame(raf); };
    }, [target]);
    return typeof target === 'number' ? st[0].toFixed(decimals || 0) : target;
  }
  function fmtSigned(s, signed) { return signed && +s > 0 ? '+' + s : String(s).replace('-', '−'); }

  function Readout(p) {
    var n = useCountUp(p.value, p.decimals);
    return h('div', { className: cx('pw-stat', p.bracket && 'pw-bracket') },
      h('div', { className: 'pw-head' }, h('span', { className: 'pw-eyebrow' }, p.label),
        p.state && h('span', { className: 'pw-state', 'data-tone': p.tone || 'none' }, p.state)),
      h('div', { className: 'pw-big' }, h('span', { 'data-count': true }, fmtSigned(n, p.signed) + (p.suffix || '')), p.unit && h('small', null, p.unit)),
      p.caption && h('p', null, p.caption),
      p.rows && h('dl', { className: 'pw-dl' }, p.rows.map(function (r, i) { return [h('dt', { key: 't' + i }, r[0]), h('dd', { key: 'd' + i }, r[1])]; })));
  }

  /* ---------- month bar (combined state or two lanes) ---------- */
  function MonthBar(p) {
    var label = p.label || 'Availability over the month', ph = p.playhead;
    var pct = function (x) { return (x * 100).toFixed(3) + '%'; };
    var fill = function (k, from, to, col, extra) { return h('i', { key: k, className: 'pw-mb-fill', style: Object.assign({ left: pct(from), width: pct(to - from), background: col }, extra) }); };
    var head = ph != null && h('span', { className: 'pw-mb-head', style: { left: pct(ph) } });
    if (p.lanes) {
      return h('div', { className: 'pw-monthbar', role: 'img', 'aria-label': label },
        h('div', { className: 'pw-mb-lanes labelled' },
          h('div', { className: 'pw-mb-row' }, h('span', { className: 'pw-mb-name', style: { '--c': 'var(--sun)' } }, 'Sun'),
            h('div', { className: 'pw-mb-track pw-mb-lane' }, (p.lanes.sun || []).map(function (s, i) { return fill(i, s[0], s[1], 'var(--sun)'); }))),
          h('div', { className: 'pw-mb-row' }, h('span', { className: 'pw-mb-name', style: { '--c': 'var(--earth)' } }, 'Earth'),
            h('div', { className: 'pw-mb-track pw-mb-lane' }, (p.lanes.earth || []).map(function (s, i) { return fill(i, s[0], s[1], 'var(--earth)'); }))),
          h('div', { className: 'pw-mb-overlay' },
            p.window && h('span', { className: 'pw-mb-window', style: { left: pct(p.window[0]), width: pct(p.window[1] - p.window[0]) } }),
            (p.violations || []).map(function (v, i) { return h('span', { key: 'v' + i, className: 'pw-mb-violation', style: { left: pct(v) } }); }),
            head)),
        p.ticks && h('div', { className: 'pw-mb-ticks labelled' }, p.ticks.map(function (t, i) { return h('span', { key: i, style: { left: pct(t[0]), transform: t[0] === 0 ? 'none' : t[0] === 1 ? 'translateX(-100%)' : 'translateX(-50%)' } }, t[1]); })));
    }
    return h('div', { className: 'pw-monthbar', role: 'img', 'aria-label': label },
      h('div', { className: 'pw-mb-track pw-mb-state' },
        (p.segments || []).filter(function (s) { return s.state !== 'none'; }).map(function (s, i) { return fill(i, s.from, s.to, LANE[s.state], { borderRadius: 0 }); })),
      head);
  }

  function PickItem(p) {
    return h('button', { type: 'button', className: 'pw-pick', 'aria-pressed': !!p.selected, onClick: p.onClick },
      h('span', null, h('span', { className: 'nm' }, p.name, p.quality && h(QualityBadge, { quality: p.quality, source: p.source })), h('span', { className: 'meta' }, p.meta)),
      h('span', { className: 'nums' }, h('span', { style: { color: 'var(--sun)' } }, p.sun + '% Sun'), h('span', { style: { color: 'var(--earth)' } }, p.earth + '% Earth')),
      p.segments && h('span', { className: 'bar' }, h(MonthBar, { segments: p.segments, label: p.name + ' month availability' })));
  }

  function Panel(p) {
    var st = useState(false);
    return h('section', { className: cx('pw-panel', p.bracket && 'pw-bracket') },
      p.title && h('h3', null, p.title), p.description && h('p', null, p.description),
      st[0] && p.table ? p.table : p.children,
      (p.note || p.table) && h('div', { className: 'pw-panel-foot' }, p.note ? h(HonestyNote, null, p.note) : h('span'),
        p.table && h('button', { type: 'button', className: 'pw-linkbtn', onClick: function () { st[1](!st[0]); } }, st[0] ? 'Show as chart' : 'Show as table')));
  }

  /* ---------- verification ---------- */
  function RuleRow(p) {
    var v = p.verdict || 'holds', cls = v === 'holds' ? 'ok' : v === 'violated' ? 'bad' : 'prev';
    var word = v === 'holds' ? 'Pass' : v === 'violated' ? 'Fail' : 'Not checked yet';
    var icon = v === 'holds' ? h('path', { d: 'M3 7.5l2.6 2.6L11 4.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' })
      : v === 'violated' ? h('path', { d: 'M4 4l6 6M10 4l-6 6', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' })
        : h('circle', { cx: 7, cy: 7, r: 1.6, fill: 'currentColor' });
    return h('div', { className: cx('pw-rule', v === 'violated' && 'violated') },
      h('span', { key: v, className: cx('ic', cls, 'flip'), 'aria-hidden': true }, h('svg', { width: 14, height: 14, viewBox: '0 0 14 14' }, icon)),
      h('span', { className: 'nm' }, p.title || p.name),
      h('span', { className: cx('verdict', cls) }, word),
      h('span', { className: 'why' }, v === 'violated' && p.at ? h('span', { className: 'at' }, 'Fails on ' + p.at + ' UTC. ') : null, p.why),
      p.showTech && h('span', { className: 'tech' }, p.name + ' · ' + p.kind + ' · ', h('code', null, p.expr)));
  }

  function Terminal(p) {
    var lines = p.output || [], st = useState(reduced() || !p.typeOn ? lines.length : 0);
    useEffect(function () {
      if (reduced() || !p.typeOn) { st[1](lines.length); return; }
      st[1](0); var i = 0, t = setInterval(function () { i++; st[1](i); if (i >= lines.length) clearInterval(t); }, 260);
      return function () { clearInterval(t); };
    }, [p.runKey]);
    var paint = function (ln) {
      if (/✓/.test(ln)) return h('span', { className: 'g' }, ln);
      if (/✗/.test(ln)) return h('span', { className: 'r' }, ln);
      if (/^\$/.test(ln)) return h('span', { className: 'k' }, ln);
      return ln;
    };
    var term = h('div', { className: 'pw-term' },
      h('div', { className: 'pw-term-bar' }, h('span', { className: 'dots', 'aria-hidden': true }, h('i'), h('i'), h('i')), p.title,
        p.preview && h('span', { className: 'pw-preview-tag', style: { marginLeft: 'auto' } }, 'preview')),
      p.code && h('pre', null, p.code),
      lines.length > 0 && h('pre', { className: 'out', 'aria-live': 'polite' },
        lines.slice(0, st[0]).map(function (ln, i) { return h('div', { key: i }, paint(ln)); }),
        st[0] < lines.length && h('span', { className: 'pw-caret', 'aria-hidden': true })));
    return p.collapsed ? h('details', { className: 'pw-details' }, h('summary', null, p.summary || 'Technical details', p.summaryNote && h('small', null, p.summaryNote)), term) : term;
  }

  function GlossaryTip(p) {
    var st = useState(!!p.defaultOpen), id = useId('tip');
    return h('span', { className: 'pw-tip-wrap', onMouseEnter: function () { st[1](true); }, onMouseLeave: function () { if (!p.defaultOpen) st[1](false); } },
      h('button', { type: 'button', className: 'pw-term-word', 'aria-describedby': st[0] ? id : undefined, 'aria-expanded': st[0],
        onClick: function () { st[1](!st[0]); }, onKeyDown: function (e) { if (e.key === 'Escape') st[1](false); } }, p.children || p.term),
      st[0] && h('span', { id: id, role: 'tooltip', className: 'pw-tip' }, h('b', null, p.term), h('span', null, p.definition)));
  }

  function HorizonRule(p) {
    var pts = [], W = 600, i, y;
    for (i = 0; i <= 60; i++) { y = 11 - 4 * Math.sin(i * .37) - 2.5 * Math.sin(i * 1.13 + 1) - 1.5 * Math.sin(i * 2.7); pts.push((i * W / 60).toFixed(1) + ' ' + y.toFixed(1)); }
    var d = 'M' + pts.join(' L'), a = Math.round((p.litFrom || .18) * 60), b = Math.round((p.litTo || .42) * 60);
    var lit = 'M' + pts.slice(a, b + 1).join(' L');
    return h('svg', { className: 'pw-horizon', viewBox: '0 0 ' + W + ' 18', preserveAspectRatio: 'none', 'aria-hidden': true },
      h('path', { className: 'ridge', d: d, vectorEffect: 'non-scaling-stroke' }),
      h('path', { className: 'lit', d: lit, vectorEffect: 'non-scaling-stroke' }));
  }

  function Skeleton(p) {
    return h('div', { className: 'pw-stack', style: { padding: 0 } },
      h('div', { className: 'pw-skel', style: { height: p.height || 140 }, 'aria-hidden': true }),
      p.progress != null && h('div', { className: 'pw-progress', role: 'progressbar', 'aria-valuenow': Math.round(p.progress * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': p.label || 'Computing' },
        h('i', { style: { width: (p.progress * 100) + '%' } })),
      p.label && h('span', { className: 'pw-note' }, p.label));
  }

  /* ---------- the signature: lunar sky hero with live scrubber ---------- */
  // Illustrative model of Malapert Massif, Jan 2027 (hour 0 = Jan 1 00:00 UTC). Real views use computed series.
  var T0 = 376, HOURS = 744, SYN = 708.7, ANOM = 655.7, CENTER = 352.7;
  function terrain(az) { var r = az * Math.PI / 180; return .55 * (1.6 * Math.sin(r * 2 + .4) + 1.1 * Math.sin(r * 5 + 1.3) + .25 * Math.sin(r * 11 + .2) + .08 * Math.sin(r * 23)) - 2.3888 * Math.cos(r) + 1.0394 * Math.sin(r) + .9; }
  function sunAt(t) { var az = ((72.7 + (t - T0) * 360 / SYN) % 360 + 360) % 360; return { az: az, el: .55 + 1.6 * Math.cos((az - 40) * Math.PI / 180) }; }
  function earthAt(t) { var k = (t - T0) * 2 * Math.PI / ANOM + 1.32; return { az: CENTER + 6 * Math.sin(k * .5), el: 3.75 + 6.75 * Math.sin(k), lit: (Math.cos((t - T0) * 2 * Math.PI / SYN + 2.73) + 1) / 2 }; }
  function stateAt(t) { var s = sunAt(t), e = earthAt(t), su = s.el + .27 > terrain(s.az), eu = e.el + .97 > terrain(e.az); return su && eu ? 'both' : su ? 'sun' : eu ? 'earth' : 'none'; }
  function fmtTime(t) { var d = new Date(Date.UTC(2027, 0, 1) + Math.round(t) * 3600e3); var M = ['Jan', 'Feb'][d.getUTCMonth()] || 'Feb'; return { date: M + ' ' + d.getUTCDate() + ', 2027', time: ('0' + d.getUTCHours()).slice(-2) + ':00 UTC' }; }

  function SkyHero(p) {
    var W = 960, H = p.height || 320, HZ = H * .66, EX = p.exaggeration || 5, PX = W / 360;
    var tS = useState(p.time != null ? p.time : T0), t = tS[0], setT = tS[1];
    var plS = useState(!!p.autoplay && !reduced()), playing = plS[0];
    var id = useId('sky'), dragging = useRef(false), barRef = useRef(null);
    var X = function (az) { return ((az - CENTER + 180) % 360 + 360) % 360 * PX; };
    var Y = function (el) { return HZ - el * PX * EX; };

    useEffect(function () {
      if (!playing) return; var raf, last = performance.now();
      function step(now) { var dt = now - last; last = now; setT(function (v) { return (v + dt / 12000 * SYN) % HOURS; }); raf = requestAnimationFrame(step); }
      raf = requestAnimationFrame(step); return function () { cancelAnimationFrame(raf); };
    }, [playing]);

    var ridge = useMemo(function () { var s = 'M0 ' + H, i, az; for (i = 0; i <= 720; i++) { az = CENTER - 180 + i / 2; s += ' L' + (i / 2 * PX).toFixed(1) + ' ' + Y(terrain(az)).toFixed(1); } return s + ' L' + W + ' ' + H + 'Z'; }, [H]);
    var stars = useMemo(function () { var a = [], s = 7, i; function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; } for (i = 0; i < 90; i++) a.push({ x: rnd() * W, y: rnd() * HZ * .9, r: rnd() * 1.1 + .3, d: (rnd() * 3.2).toFixed(2) }); return a; }, []);
    var lanes = useMemo(function () {
      var sun = [], earth = [], hh, s0 = null, e0 = null, st;
      for (hh = 0; hh <= HOURS; hh += 2) {
        st = hh < HOURS ? stateAt(hh) : 'x';
        var su = st === 'both' || st === 'sun', eu = st === 'both' || st === 'earth';
        if (su && s0 === null) s0 = hh; if (!su && s0 !== null) { sun.push([s0 / HOURS, hh / HOURS]); s0 = null; }
        if (eu && e0 === null) e0 = hh; if (!eu && e0 !== null) { earth.push([e0 / HOURS, hh / HOURS]); e0 = null; }
      }
      return { sun: sun, earth: earth };
    }, []);
    var track = useMemo(function () {
      var segs = [], cur = null, hh, s, x, y, up, lastX = -1;
      for (hh = 0; hh <= SYN; hh += 3) {
        s = sunAt(hh); x = X(s.az); y = Y(s.el); up = s.el + .27 > terrain(s.az);
        if (!cur || cur.up !== up || x < lastX) { cur = { up: up, d: 'M' + x.toFixed(1) + ' ' + y.toFixed(1) }; segs.push(cur); } else cur.d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
        lastX = x;
      }
      return segs;
    }, [H]);

    var sun = sunAt(t), earth = earthAt(t), state = stateAt(t), S = STATES[state];
    var sx = X(sun.az), sy = Y(sun.el), ex = X(earth.az), ey = Y(earth.el);
    var sr = Math.max(4, .271 * PX * EX), er = Math.max(9, .968 * PX * EX);
    var clear = (sun.el + .27 - terrain(sun.az)) / .54, glow = Math.max(0, Math.min(1, clear));
    var tm = fmtTime(t);

    function seekFromEvent(e) { var r = barRef.current.getBoundingClientRect(); setT(Math.max(0, Math.min(HOURS - 1, (e.clientX - r.left) / r.width * HOURS))); }
    var compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    return h('div', { className: 'pw-sky' },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': S.head + '. Sun elevation ' + sun.el.toFixed(2) + ' degrees, Earth elevation ' + earth.el.toFixed(2) + ' degrees.' },
        h('defs', null,
          h('radialGradient', { id: id + 'g' }, h('stop', { offset: 0, stopColor: 'var(--sky-sun-core)' }), h('stop', { offset: .35, stopColor: 'var(--sky-sun)', stopOpacity: .9 }), h('stop', { offset: 1, stopColor: 'var(--sky-sun)', stopOpacity: 0 })),
          h('clipPath', { id: id + 'e' }, h('circle', { cx: ex, cy: ey, r: er }))),
        h('g', null, stars.map(function (s, i) {
          var near = Math.hypot(s.x - sx, s.y - sy), fade = Math.min(1, near / 260) * (1 - glow * .5 * (near < 260 ? 1 : 0));
          return h('circle', { key: i, className: 'star', cx: s.x, cy: s.y, r: s.r, fill: 'var(--sky-ink)', opacity: fade, style: { animationDelay: s.d + 's' } });
        })),
        track.map(function (sg, i) { return h('path', { key: i, d: sg.d, fill: 'none', stroke: 'var(--sky-sun)', strokeOpacity: .35, strokeWidth: 1, strokeDasharray: sg.up ? null : '3 4' }); }),
        h('circle', { cx: sx, cy: sy, r: sr * 9, fill: 'url(#' + id + 'g)', opacity: .25 + .75 * glow }),
        h('circle', { cx: sx, cy: sy, r: sr, fill: 'var(--sky-sun-core)' }),
        h('g', null,
          h('circle', { cx: ex, cy: ey, r: er, fill: 'var(--sky-earth)' }),
          h('circle', { cx: ex + (earth.lit * 2 - 1) * -er * 1.05 - er * .02, cy: ey, r: er, fill: 'var(--sky-bg)', fillOpacity: .88, clipPath: 'url(#' + id + 'e)' }),
          h('circle', { cx: ex, cy: ey, r: er, fill: 'none', stroke: 'var(--sky-earth)', strokeOpacity: .35 })),
        h('path', { d: ridge, fill: 'var(--terrain)' }),
        h('line', { x1: 0, x2: W, y1: HZ, y2: HZ, stroke: 'var(--sky-ink)', strokeOpacity: .12, strokeDasharray: '2 5' }),
        compass.map(function (c, i) { var x = X(i * 45); return h('text', { key: c, x: x, y: H - 12, fill: 'var(--sky-sub)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-text)', textAnchor: 'middle' }, c); }),
        h('text', { x: 12, y: HZ - 6, fill: 'var(--sky-sub)', fontSize: 13, fontFamily: 'var(--font-text)' }, 'Flat horizon (0°)'),
        h('text', { className: 'label', x: sx, y: sy - sr * 9 * .55, fill: 'var(--sky-sun)', textAnchor: 'middle' }, 'Sun'),
        h('text', { className: 'label', x: ex, y: ey - er - 10, fill: 'var(--sky-earth)', textAnchor: 'middle' }, 'Earth')),
      h('div', { className: 'pw-sky-head' },
        h(StateBadge, { state: state, animateKey: state }),
        h('h1', { key: 'h' + state, className: 'pw-flip' }, S.head),
        h('div', { key: 's' + state, className: 'sub pw-flip' }, S.sub)),
      h('div', { className: 'pw-sky-time' }, h('b', null, tm.date), tm.time),
      h('div', { className: 'pw-sky-foot' }, h(HonestyNote, { onSky: true }, 'elevation ×' + EX + (p.illustrative !== false ? ' · illustrative motion' : ''))),
      p.scrubber !== false && h('div', { className: 'pw-sky-ctl', style: { background: 'var(--bg)' } },
        h(PlayButton, { playing: playing, onClick: function () { plS[1](!playing); } }),
        h('div', { ref: barRef, role: 'slider', tabIndex: 0, 'aria-label': 'Time', 'aria-valuemin': 0, 'aria-valuemax': HOURS, 'aria-valuenow': Math.round(t), 'aria-valuetext': tm.date + ' ' + tm.time,
          style: { cursor: 'ew-resize', touchAction: 'none', borderRadius: 8 },
          onPointerDown: function (e) { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); plS[1](false); seekFromEvent(e); },
          onPointerMove: function (e) { if (dragging.current) seekFromEvent(e); },
          onPointerUp: function () { dragging.current = false; },
          onKeyDown: function (e) { var k = e.shiftKey ? 24 : 1; if (e.key === 'ArrowRight') { setT(Math.min(HOURS - 1, t + k)); e.preventDefault(); } if (e.key === 'ArrowLeft') { setT(Math.max(0, t - k)); e.preventDefault(); } if (e.key === ' ') { plS[1](!playing); e.preventDefault(); } } },
          h(MonthBar, { lanes: lanes, playhead: t / HOURS, window: p.window, ticks: [[0, 'Jan 1'], [.33, 'Jan 11'], [.5, 'Jan 16'], [.67, 'Jan 21'], [1, 'Jan 31']], label: 'Sun and Earth lanes for January 2027' }))));
  }

  window.PolarWindow = Object.assign(window.PolarWindow || {}, {
    SkyHero: SkyHero, StateBadge: StateBadge, Readout: Readout, MonthBar: MonthBar, PickItem: PickItem, QualityBadge: QualityBadge,
    Button: Button, PlayButton: PlayButton, SegmentedControl: SegmentedControl, Select: Select, Slider: Slider, Panel: Panel,
    RuleRow: RuleRow, Terminal: Terminal, GlossaryTip: GlossaryTip, HonestyNote: HonestyNote, HorizonRule: HorizonRule, Skeleton: Skeleton,
    STATES: STATES
  });
})();
