// Hand-drawn (sketch-style) SVG icon library — objects & geometry only, no human/animal figures.
import { line, rect, circle, ellipse, curve, linearPath, polygon, svgPath, arc } from './rough-svg.mjs';

const INK = '#2b2118';
const GOLD = '#9c6b12';
const GREEN = '#0f4c3a';

// --- helpers -----------------------------------------------------------
function tick(x, y, len, angleDeg, opts, seed) {
  const r = (angleDeg * Math.PI) / 180;
  const x2 = x + len * Math.cos(r);
  const y2 = y + len * Math.sin(r);
  return line(x, y, x2, y2, opts, seed);
}

function check(cx, cy, s, opts, seed) {
  return linearPath([[cx - s, cy], [cx - s * 0.25, cy + s * 0.7], [cx + s, cy - s * 0.8]], opts, seed);
}

function qmark(cx, cy, s, opts, seed) {
  let out = svgPath(
    `M ${cx - s * 0.55} ${cy - s * 0.7}
     C ${cx - s * 0.55} ${cy - s * 1.15}, ${cx + s * 0.6} ${cy - s * 1.15}, ${cx + s * 0.55} ${cy - s * 0.55}
     C ${cx + s * 0.5} ${cy - s * 0.15}, ${cx} ${cy - s * 0.1}, ${cx} ${cy + s * 0.35}`,
    opts, seed
  );
  out += circle(cx, cy + s * 0.85, s * 0.16, { ...opts, fill: opts.stroke, fillStyle: 'solid' }, seed + 1);
  return out;
}

function crescent(cx, cy, r, opts, seed) {
  let out = arc(cx, cy, r * 2, r * 2, -100, 100, false, opts, seed);
  out += arc(cx + r * 0.55, cy, r * 1.5, r * 1.9, -110, 105, false, opts, seed + 1);
  return out;
}

// --- icons ---------------------------------------------------------------
// Each icon draws inside a 240x240 box. Returns SVG markup (paths only).

export const ICONS = {
  // Title: eight-point star (rub el hizb) — two overlapping squares
  star8(seed = 1) {
    const o = { stroke: GOLD, strokeWidth: 2.6 };
    const sq1 = [[120, 30], [210, 120], [120, 210], [30, 120]];
    const sq2 = [[75, 55], [185, 55], [185, 185], [75, 185]];
    let out = polygon(sq1, o, seed);
    out += polygon(sq2, o, seed + 1);
    out += circle(120, 120, 26, { stroke: INK, strokeWidth: 2 }, seed + 2);
    return out;
  },

  // Slide 1: rolled scroll with three checked lines — ibadah checklist
  checklistScroll(seed = 2) {
    let out = rect(46, 40, 148, 160, { stroke: INK, strokeWidth: 2.4 }, seed);
    out += curve([[46, 40], [30, 60], [46, 78]], { stroke: INK, strokeWidth: 2.2 }, seed + 1);
    out += curve([[194, 122], [212, 140], [194, 160]], { stroke: INK, strokeWidth: 2.2 }, seed + 2);
    [72, 112, 152].forEach((y, i) => {
      out += line(66, y, 170, y, { stroke: INK, strokeWidth: 1.6 }, seed + 3 + i);
      out += check(60, y - 8, 12, { stroke: GREEN, strokeWidth: 2.6 }, seed + 6 + i);
    });
    return out;
  },

  // Slide 2: compass with an off-true, wavering needle — unease/goyah
  compassWaver(seed = 10) {
    let out = circle(120, 120, 150, { stroke: INK, strokeWidth: 2.4 }, seed);
    out += circle(120, 120, 118, { stroke: INK, strokeWidth: 1.4 }, seed + 1);
    for (let a = 0; a < 360; a += 30) out += tick(120, 120, 78, a, { stroke: INK, strokeWidth: 1.2 }, seed + a);
    out += svgPath(`M120 120 L150 60 L162 96 Z`, { stroke: GOLD, strokeWidth: 2, fill: GOLD, fillStyle: 'solid' }, seed + 2);
    out += svgPath(`M120 120 L96 176 L138 168 Z`, { stroke: INK, strokeWidth: 1.6 }, seed + 3);
    out += circle(120, 120, 10, { stroke: INK, strokeWidth: 2, fill: INK, fillStyle: 'solid' }, seed + 4);
    return out;
  },

  // Slide 3: tilted balance (mizan) — ibadah heavy, keseharian light
  mizanTilt(seed = 20) {
    let out = line(120, 30, 120, 190, { stroke: INK, strokeWidth: 2.4 }, seed);
    out += svgPath(`M104 30 L136 30 L120 14 Z`, { stroke: INK, strokeWidth: 2 }, seed + 1);
    out += line(50, 96, 190, 60, { stroke: INK, strokeWidth: 2.2 }, seed + 2);
    out += line(50, 96, 50, 60, { stroke: INK, strokeWidth: 1.4 }, seed + 3);
    out += line(190, 60, 190, 40, { stroke: INK, strokeWidth: 1.4 }, seed + 4);
    out += arc(50, 122, 64, 40, 10, 170, true, { stroke: INK, strokeWidth: 2 }, seed + 5);
    out += arc(190, 92, 64, 34, 10, 170, true, { stroke: INK, strokeWidth: 1.6 }, seed + 6);
    // small dome (mosque silhouette) sitting in the low, heavy pan
    out += arc(50, 116, 30, 26, 180, 360, false, { stroke: GREEN, strokeWidth: 2 }, seed + 7);
    out += line(50, 103, 50, 92, { stroke: GREEN, strokeWidth: 1.6 }, seed + 8);
    return out;
  },

  // Slide 4: five linked rings leading to a lit lantern — Five Why -> root cause
  fiveWhyChain(seed = 30) {
    let out = '';
    const ys = 120;
    const xs = [40, 78, 116, 154];
    xs.forEach((x, i) => {
      out += circle(x, ys, 26, { stroke: INK, strokeWidth: 2 }, seed + i);
    });
    for (let i = 0; i < xs.length - 1; i++) out += line(xs[i] + 13, ys, xs[i + 1] - 13, ys, { stroke: INK, strokeWidth: 1.6 }, seed + 10 + i);
    out += line(xs[3] + 13, ys, 196, ys, { stroke: INK, strokeWidth: 1.6 }, seed + 15);
    // lantern (root cause) — bigger, gold, with a small flame
    out += rect(184, 100, 40, 42, { stroke: GOLD, strokeWidth: 2.4 }, seed + 16);
    out += line(184, 100, 224, 100, { stroke: GOLD, strokeWidth: 2 }, seed + 17);
    out += svgPath(`M198 92 L210 92 L204 76 Z`, { stroke: GOLD, strokeWidth: 2 }, seed + 18);
    out += svgPath(`M200 116 C200 108, 208 108, 208 116 C208 122, 200 124, 200 116`, { stroke: GOLD, strokeWidth: 1.8, fill: GOLD, fillStyle: 'solid' }, seed + 19);
    return out;
  },

  // Slide 5: a key beside an open lock — the simple truth revealed
  keyReveal(seed = 40) {
    let out = circle(66, 90, 44, { stroke: INK, strokeWidth: 2.6 }, seed);
    out += circle(66, 90, 16, { stroke: INK, strokeWidth: 1.6 }, seed + 1);
    out += line(88, 108, 168, 176, { stroke: INK, strokeWidth: 2.6 }, seed + 2);
    out += line(150, 158, 164, 144, { stroke: INK, strokeWidth: 2 }, seed + 3);
    out += line(160, 168, 176, 156, { stroke: INK, strokeWidth: 2 }, seed + 4);
    out += line(168, 176, 184, 164, { stroke: INK, strokeWidth: 2 }, seed + 5);
    return out;
  },

  // Slide 6: split oval mirror — checklist vs question mark
  mirrorSplit(seed = 50) {
    let out = ellipse(120, 110, 168, 190, { stroke: INK, strokeWidth: 2.4 }, seed);
    out += line(120, 24, 120, 196, { stroke: INK, strokeWidth: 1.6 }, seed + 1);
    out += check(80, 108, 20, { stroke: GREEN, strokeWidth: 2.8 }, seed + 2);
    out += qmark(160, 100, 26, { stroke: GOLD, strokeWidth: 2.6 }, seed + 3);
    out += rect(96, 196, 48, 14, { stroke: INK, strokeWidth: 2 }, seed + 4);
    return out;
  },

  // Slide 7: unrooted shape drifting vs a rooted pillar with crescent
  rootedVsFloating(seed = 60) {
    let out = polygon([[60, 60], [80, 90], [60, 120], [40, 90]], { stroke: GOLD, strokeWidth: 2.2 }, seed);
    out += curve([[30, 140], [50, 148], [70, 140]], { stroke: INK, strokeWidth: 1.4 }, seed + 1);
    out += curve([[24, 156], [50, 166], [76, 156]], { stroke: INK, strokeWidth: 1.4 }, seed + 2);
    out += rect(166, 60, 28, 110, { stroke: INK, strokeWidth: 2.4 }, seed + 3);
    out += crescent(180, 44, 14, { stroke: GREEN, strokeWidth: 2.2 }, seed + 4);
    out += line(180, 170, 180, 200, { stroke: INK, strokeWidth: 2 }, seed + 5);
    out += line(180, 178, 156, 198, { stroke: INK, strokeWidth: 1.8 }, seed + 6);
    out += line(180, 182, 204, 202, { stroke: INK, strokeWidth: 1.8 }, seed + 7);
    out += line(120, 200, 220, 200, { stroke: INK, strokeWidth: 1.6 }, seed + 8);
    return out;
  },

  // Slide 8: two foundations (cracked / solid) carrying a stack of weights
  foundationLoad(seed = 70) {
    let out = line(20, 190, 220, 190, { stroke: INK, strokeWidth: 2 }, seed);
    out += rect(30, 150, 70, 40, { stroke: INK, strokeWidth: 2.2 }, seed + 1);
    out += svgPath(`M35 150 L55 170 L45 175 L65 190`, { stroke: GOLD, strokeWidth: 2 }, seed + 2);
    out += rect(140, 150, 70, 40, { stroke: GREEN, strokeWidth: 2.2 }, seed + 3);
    [160, 172, 184].forEach((y, i) => (out += line(140, y, 210, y, { stroke: GREEN, strokeWidth: 1.2 }, seed + 4 + i)));
    out += rect(48, 118, 36, 22, { stroke: INK, strokeWidth: 1.8 }, seed + 8);
    out += rect(158, 118, 36, 22, { stroke: INK, strokeWidth: 1.8 }, seed + 9);
    out += rect(56, 96, 108, 18, { stroke: INK, strokeWidth: 2 }, seed + 10);
    return out;
  },

  // Slide 9: quiet ornamental flourish only — the Big Idea moment holds on typography
  flourishDivider(seed = 80) {
    let out = curve([[30, 120], [90, 96], [120, 120], [150, 144], [210, 120]], { stroke: GOLD, strokeWidth: 2 }, seed);
    out += crescent(120, 60, 16, { stroke: GOLD, strokeWidth: 2.2 }, seed + 1);
    out += circle(60, 120, 5, { stroke: GOLD, strokeWidth: 1.6, fill: GOLD, fillStyle: 'solid' }, seed + 2);
    out += circle(180, 120, 5, { stroke: GOLD, strokeWidth: 1.6, fill: GOLD, fillStyle: 'solid' }, seed + 3);
    return out;
  },

  // Slide 10: two pillars on a shared base, joined by a pointed arch — overview
  twoPillars(seed = 90) {
    let out = rect(40, 190, 160, 18, { stroke: INK, strokeWidth: 2.4 }, seed);
    out += rect(60, 80, 30, 112, { stroke: GREEN, strokeWidth: 2.2 }, seed + 1);
    out += rect(150, 80, 30, 112, { stroke: GOLD, strokeWidth: 2.2 }, seed + 2);
    out += line(56, 80, 94, 80, { stroke: GREEN, strokeWidth: 1.8 }, seed + 3);
    out += line(146, 80, 184, 80, { stroke: GOLD, strokeWidth: 1.8 }, seed + 4);
    out += svgPath(`M75 80 C75 40, 165 40, 165 80`, { stroke: INK, strokeWidth: 2.2 }, seed + 5);
    return out;
  },

  // Slide 11: lightbulb (idea/'aqliyah) beside a compass rose (sikap/nafsiyah)
  bulbAndCompass(seed = 100) {
    let out = circle(66, 90, 40, { stroke: INK, strokeWidth: 2.4 }, seed);
    out += rect(54, 126, 24, 16, { stroke: INK, strokeWidth: 1.8 }, seed + 1);
    out += line(58, 148, 74, 148, { stroke: INK, strokeWidth: 1.6 }, seed + 2);
    out += svgPath(`M54 84 L64 100 L60 84 L72 96`, { stroke: GOLD, strokeWidth: 1.8 }, seed + 3);
    for (let a = 0; a < 360; a += 45) out += tick(66, 90, 54, a, { stroke: INK, strokeWidth: 1 }, seed + 4 + a);
    out += circle(176, 100, 46, { stroke: INK, strokeWidth: 2.2 }, seed + 20);
    out += svgPath(`M176 60 L188 100 L176 140 L164 100 Z`, { stroke: GREEN, strokeWidth: 2 }, seed + 21);
    out += circle(176, 100, 6, { stroke: INK, strokeWidth: 1.6 }, seed + 22);
    return out;
  },

  // Slide 12: jar tipping out (khamr dibuang) + cloth draped over a frame (hijab)
  jarAndCloth(seed = 110) {
    let out = svgPath(`M40 60 L52 60 L58 120 C58 136, 24 136, 24 120 Z`, { stroke: INK, strokeWidth: 2.2 }, seed);
    out += line(40 - 6, 60, 40 + 18, 52, { stroke: INK, strokeWidth: 2 }, seed + 1);
    out += curve([[58, 70], [80, 62], [100, 74]], { stroke: GOLD, strokeWidth: 2 }, seed + 2);
    out += curve([[64, 84], [88, 78], [108, 92]], { stroke: GOLD, strokeWidth: 1.8 }, seed + 3);
    out += circle(112, 96, 4, { stroke: GOLD, strokeWidth: 1.4, fill: GOLD, fillStyle: 'solid' }, seed + 4);
    out += rect(150, 50, 60, 90, { stroke: INK, strokeWidth: 2.2 }, seed + 5);
    out += curve([[150, 60], [180, 78], [156, 100], [200, 120], [180, 140]], { stroke: GREEN, strokeWidth: 2 }, seed + 6);
    out += curve([[158, 56], [186, 74], [162, 96], [206, 116], [186, 138]], { stroke: GREEN, strokeWidth: 1.6 }, seed + 7);
    return out;
  },

  // Slide 13: open manuscript with an ornamental title cartouche — kitab rujukan
  openBook(seed = 120) {
    let out = svgPath(`M120 60 C90 46, 50 50, 30 62 L30 172 C50 160, 90 156, 120 170 Z`, { stroke: INK, strokeWidth: 2.2 }, seed);
    out += svgPath(`M120 60 C150 46, 190 50, 210 62 L210 172 C190 160, 150 156, 120 170 Z`, { stroke: INK, strokeWidth: 2.2 }, seed + 1);
    [80, 96, 112].forEach((y, i) => (out += line(44, y, 104, y, { stroke: INK, strokeWidth: 1.2 }, seed + 2 + i)));
    out += rect(140, 76, 56, 60, { stroke: GOLD, strokeWidth: 1.8 }, seed + 6);
    out += rect(146, 82, 44, 48, { stroke: GOLD, strokeWidth: 1.2 }, seed + 7);
    out += line(150, 96, 186, 96, { stroke: GOLD, strokeWidth: 1 }, seed + 8);
    out += line(150, 108, 186, 108, { stroke: GOLD, strokeWidth: 1 }, seed + 9);
    return out;
  },

  // Slide 14: small checklist card + a clock — quick win, achievable today
  checklistClock(seed = 130) {
    let out = rect(30, 60, 108, 108, { stroke: INK, strokeWidth: 2.2 }, seed);
    [[54, 84], [54, 112], [54, 140]].forEach(([x, y], i) => {
      out += rect(x, y, 16, 16, { stroke: INK, strokeWidth: 1.6 }, seed + 1 + i);
      if (i < 2) out += check(x + 8, y + 8, 8, { stroke: GREEN, strokeWidth: 2.2 }, seed + 10 + i);
      out += line(x + 26, y + 8, x + 74, y + 8, { stroke: INK, strokeWidth: 1.2 }, seed + 20 + i);
    });
    out += circle(184, 92, 40, { stroke: GOLD, strokeWidth: 2.2 }, seed + 30);
    out += line(184, 92, 184, 68, { stroke: GOLD, strokeWidth: 1.8 }, seed + 31);
    out += line(184, 92, 202, 100, { stroke: GOLD, strokeWidth: 1.8 }, seed + 32);
    return out;
  },

  // Slide 15: a ring of small lanterns around a central open book — halaqah
  halaqahRing(seed = 140) {
    let out = svgPath(`M108 108 C96 100, 80 102, 72 110 L72 132 C80 126, 96 128, 108 134 Z`, { stroke: INK, strokeWidth: 1.8 }, seed);
    out += svgPath(`M108 108 C120 100, 136 102, 144 110 L144 132 C136 126, 120 128, 108 134 Z`, { stroke: INK, strokeWidth: 1.8 }, seed + 1);
    const R = 82, cx = 108, cy = 120;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = cx + R * Math.cos(a);
      const y = cy + R * Math.sin(a) * 0.86;
      out += arc(x, y, 20, 22, 180, 360, false, { stroke: GOLD, strokeWidth: 1.8 }, seed + 2 + i);
      out += line(x, y - 1, x, y - 9, { stroke: GOLD, strokeWidth: 1.4 }, seed + 20 + i);
    }
    return out;
  },

  // Slide 16: a closing question mark crossed with a feather quill — reflective CTA
  quillQuestion(seed = 150) {
    let out = qmark(140, 100, 50, { stroke: GOLD, strokeWidth: 3 }, seed);
    out += svgPath(`M40 190 C60 150, 70 100, 100 60 C90 100, 78 150, 60 186 Z`, { stroke: INK, strokeWidth: 2.2 }, seed + 5);
    out += line(100, 60, 40, 190, { stroke: INK, strokeWidth: 1.4 }, seed + 6);
    for (let t = 0.2; t < 1; t += 0.18) {
      const x = 100 + (40 - 100) * t;
      const y = 60 + (190 - 60) * t;
      out += line(x, y, x - 14, y + 6, { stroke: INK, strokeWidth: 1 }, seed + 7 + t * 10);
    }
    return out;
  },
};

export function renderIcon(name, seed) {
  const fn = ICONS[name];
  if (!fn) throw new Error(`Unknown icon: ${name}`);
  return fn(seed);
}

export { INK, GOLD, GREEN };
