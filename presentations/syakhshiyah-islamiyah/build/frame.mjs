// Recurring manuscript motif: a hand-drawn double medallion (roundel) with four
// corner flourish marks, framing the icon on every slide.
import { circle, curve } from './rough-svg.mjs';

export function medallion({ cx = 200, cy = 200, r = 178, gold = '#9c6b12', seed = 1 }) {
  let out = '';
  out += circle(cx, cy, r * 2, { stroke: gold, strokeWidth: 2.6 }, seed);
  out += circle(cx, cy, r * 2 - 22, { stroke: gold, strokeWidth: 1.3 }, seed + 1);
  const corners = [45, 135, 225, 315];
  corners.forEach((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    const x = cx + (r + 14) * Math.cos(rad);
    const y = cy + (r + 14) * Math.sin(rad);
    const nx = -Math.sin(rad), ny = Math.cos(rad);
    const p1 = [x - nx * 16, y - ny * 16];
    const p2 = [x + Math.cos(rad) * 14, y + Math.sin(rad) * 14];
    const p3 = [x + nx * 16, y + ny * 16];
    out += curve([p1, p2, p3], { stroke: gold, strokeWidth: 1.8 }, seed + 2 + i);
  });
  return out;
}

export function composeSlideSVG({ icon, size = 400, ink = '#2b2118', gold = '#9c6b12', seed = 1, bg = 'none' }) {
  const iconBox = 240;
  const offset = (size - iconBox) / 2;
  const bgRect = bg === 'none' ? '' : `<rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${bgRect}
${medallion({ cx: size / 2, cy: size / 2, r: (size / 2) * 0.86, gold, seed })}
<g transform="translate(${offset},${offset})">${icon}</g>
</svg>`;
}
