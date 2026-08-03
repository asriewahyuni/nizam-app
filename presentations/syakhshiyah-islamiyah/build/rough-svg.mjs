// Helper: turn roughjs "drawable" objects into inline SVG <path> markup (no DOM needed).
import roughPkg from 'roughjs/bundled/rough.cjs.js';

const gen = roughPkg.generator();

export function pathsFromDrawable(drawable, { stroke = '#2b2118', strokeWidth = 2.2, fill = null, fillStroke = null } = {}) {
  let out = '';
  for (const set of drawable.sets) {
    const d = gen.opsToPath(set);
    if (!d || d.trim() === '') continue;
    if (set.type === 'fillPath') {
      out += `<path d="${d}" fill="${fill || stroke}" stroke="none" fill-rule="${drawable.options.fillRule || 'nonzero'}"/>`;
    } else if (set.type === 'fillSketch') {
      out += `<path d="${d}" fill="none" stroke="${fillStroke || fill || stroke}" stroke-width="${(drawable.options.fillWeight || strokeWidth) * 0.8}" stroke-linecap="round"/>`;
    } else {
      out += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  return out;
}

export function line(x1, y1, x2, y2, opts, seed) {
  return pathsFromDrawable(gen.line(x1, y1, x2, y2, { roughness: 1.4, seed, ...opts }), opts);
}
export function rect(x, y, w, h, opts, seed) {
  return pathsFromDrawable(gen.rectangle(x, y, w, h, { roughness: 1.6, seed, ...opts }), opts);
}
export function circle(x, y, d, opts, seed) {
  return pathsFromDrawable(gen.circle(x, y, d, { roughness: 1.5, seed, ...opts }), opts);
}
export function ellipse(x, y, w, h, opts, seed) {
  return pathsFromDrawable(gen.ellipse(x, y, w, h, { roughness: 1.5, seed, ...opts }), opts);
}
export function curve(points, opts, seed) {
  return pathsFromDrawable(gen.curve(points, { roughness: 1.3, seed, ...opts }), opts);
}
export function linearPath(points, opts, seed) {
  return pathsFromDrawable(gen.linearPath(points, { roughness: 1.4, seed, ...opts }), opts);
}
export function polygon(points, opts, seed) {
  return pathsFromDrawable(gen.polygon(points, { roughness: 1.5, seed, ...opts }), opts);
}
export function svgPath(d, opts, seed) {
  return pathsFromDrawable(gen.path(d, { roughness: 1.4, seed, ...opts }), opts);
}
export function arc(x, y, w, h, start, stop, closed, opts, seed) {
  return pathsFromDrawable(gen.arc(x, y, w, h, start, stop, closed, { roughness: 1.4, seed, ...opts }), opts);
}

export { gen };
