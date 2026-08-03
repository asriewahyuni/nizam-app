import pptxgen from 'pptxgenjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { slides, meta } from './content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const iconPath = (id) => path.join(root, 'assets', 'icons-png', `${id}.png`);

const PAPER = 'F4ECDC';
const PAPER_DEEP = 'ECE0C8';
const INK = '2B2118';
const INK_SOFT = '5C4D3C';
const GOLD = '8A5D10';
const GOLD_BRIGHT = 'A8760F';
const GREEN = '0F4C3A';
const GREEN_TINT = 'E4EAE3';
const GOLD_TINT = 'EFE4CC';
const DARK_BG = '211A12';
const PAPER_ON_DARK = 'F4ECDC';

const FONT_HEAD = 'Cambria';
const FONT_BODY = 'Calibri';

const W = 13.333, H = 7.5;
const MARGIN = 0.7;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Nizam App';
pres.title = meta.title;

function frame(slide, dark) {
  const c = dark ? 'F4ECDC33' : '2B211830';
  slide.addShape('rect', { x: 0.28, y: 0.28, w: W - 0.56, h: H - 0.56, fill: { type: 'none' }, line: { color: dark ? 'F4ECDC' : '2B2118', width: 0.75, transparency: dark ? 78 : 82 } });
  // corner brackets
  const gold = dark ? 'CF9A2E' : GOLD;
  const cs = 0.26;
  const corners = [
    [0.4, 0.4, 1, 1],
    [W - 0.4, 0.4, -1, 1],
    [0.4, H - 0.4, 1, -1],
    [W - 0.4, H - 0.4, -1, -1],
  ];
  corners.forEach(([x, y, sx, sy]) => {
    slide.addShape('line', { x: x, y: y, w: cs * sx, h: 0, line: { color: gold, width: 1.5 } });
    slide.addShape('line', { x: x, y: y, w: 0, h: cs * sy, line: { color: gold, width: 1.5 } });
  });
}

function footer(slide, i, dark) {
  const color = dark ? 'C9B896' : INK_SOFT;
  slide.addText(`${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`, {
    x: 0.6, y: H - 0.62, w: 2, h: 0.32, fontFace: FONT_BODY, fontSize: 9, color, charSpacing: 1,
  });
  slide.addText(meta.title.toUpperCase(), {
    x: W - 5.6, y: H - 0.62, w: 5, h: 0.32, align: 'right', fontFace: FONT_BODY, fontSize: 9, color, charSpacing: 1,
  });
}

function baseSlide(s, i) {
  const dark = s.layout === 'bigidea' || s.layout === 'cta';
  const slide = pres.addSlide();
  slide.background = { color: dark ? DARK_BG : PAPER };
  frame(slide, dark);
  footer(slide, i, dark);
  if (s.note) slide.addNotes(s.note);
  return { slide, dark };
}

function sectionLabel(slide, text, opts = {}) {
  slide.addText(text.toUpperCase(), Object.assign({
    x: MARGIN, y: 0.62, w: 8, h: 0.35, fontFace: FONT_BODY, fontSize: 12, bold: true,
    color: GOLD_BRIGHT, charSpacing: 2,
  }, opts));
}

function kickerText(slide, text, opts = {}) {
  slide.addText(text, Object.assign({
    x: MARGIN, y: 1.0, w: 8, h: 0.4, fontFace: FONT_HEAD, italic: true, fontSize: 14, color: INK_SOFT,
  }, opts));
}

function bulletsBlock(slide, items, opts = {}) {
  const paras = items.map((t, idx) => ({
    text: t,
    options: { bullet: { code: '25C6', indent: 18 }, color: INK_SOFT, breakLine: idx < items.length - 1, paraSpaceAfter: 12 },
  }));
  slide.addText(paras, Object.assign({
    x: MARGIN, y: 2.1, w: 6.6, h: 3, fontFace: FONT_BODY, fontSize: 15, valign: 'top', lineSpacingMultiple: 1.25,
  }, opts));
}

function card(slide, { x, y, w, h, label, value, fill, valueColor }) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: { color: 'D8C9A3', width: 0.75 } });
  slide.addText(label.toUpperCase(), { x: x + 0.22, y: y + 0.14, w: w - 0.44, h: 0.3, fontFace: FONT_BODY, fontSize: 10, color: INK_SOFT, charSpacing: 1 });
  slide.addText(value, { x: x + 0.22, y: y + 0.44, w: w - 0.44, h: h - 0.6, fontFace: FONT_HEAD, bold: true, fontSize: 17, color: valueColor || INK, valign: 'top' });
}

// ---------------------------------------------------------------- layouts

function renderTitle(s, i) {
  const { slide } = baseSlide(s, i);
  slide.addImage({ path: iconPath(s.icon), x: W / 2 - 1.05, y: 0.55, w: 2.1, h: 2.1 });
  slide.addText('KAJIAN KEPRIBADIAN ISLAM', { x: 0, y: 2.75, w: W, h: 0.35, align: 'center', fontFace: FONT_BODY, fontSize: 13, color: GOLD_BRIGHT, charSpacing: 2 });
  slide.addText(s.title.replace(/\n/g, ' '), { x: 0.8, y: 3.1, w: W - 1.6, h: 1.5, align: 'center', fontFace: FONT_HEAD, bold: true, fontSize: 40, color: INK, valign: 'top' });
  slide.addText(s.subtitle, { x: 1.4, y: 4.55, w: W - 2.8, h: 0.9, align: 'center', fontFace: FONT_HEAD, italic: true, fontSize: 18, color: INK_SOFT });
  slide.addText(s.tag.toUpperCase(), { x: 0, y: 5.55, w: W, h: 0.4, align: 'center', fontFace: FONT_BODY, fontSize: 12, color: GOLD, charSpacing: 1.5 });
}

function renderSideLayout(s, i, opts = {}) {
  const { slide } = baseSlide(s, i);
  const iconRight = i % 2 === 0;
  const iconX = iconRight ? W - 4.1 : MARGIN;
  const textX = iconRight ? MARGIN : 4.6;
  slide.addImage({ path: iconPath(s.icon), x: iconX, y: 2.35, w: 3.1, h: 3.1 });

  let y = 0.62;
  sectionLabel(slide, s.section, { x: textX, y, w: 6.6 });
  y += 0.42;
  if (s.kicker) { kickerText(slide, s.kicker, { x: textX, y, w: 6.6 }); y += 0.42; }
  const titleLines = s.title.split('\n').length;
  slide.addText(s.title, { x: textX, y, w: 6.9, h: 0.55 * titleLines + 0.3, fontFace: FONT_HEAD, bold: true, fontSize: opts.bigTitle ? 32 : 28, color: INK, valign: 'top' });
  y += 0.55 * titleLines + 0.5;

  if (s.layout === 'compare') {
    const cw = 2.9, ch = 1.0, gap = 0.5;
    card(slide, { x: textX, y, w: cw, h: ch, label: s.compareLeft.label, value: s.compareLeft.value, fill: PAPER_DEEP });
    slide.addText('vs', { x: textX + cw, y: y + 0.3, w: gap, h: 0.4, align: 'center', italic: true, fontFace: FONT_HEAD, color: GOLD, fontSize: 14 });
    card(slide, { x: textX + cw + gap, y, w: cw, h: ch, label: s.compareRight.label, value: s.compareRight.value, fill: GREEN_TINT, valueColor: GREEN });
    y += ch + 0.35;
  }

  if (s.layout === 'checklist') {
    const items = s.checklist;
    items.forEach((t, idx) => {
      const iy = y + idx * 0.72;
      slide.addShape('roundRect', { x: textX, y: iy + 0.03, w: 0.24, h: 0.24, rectRadius: 0.03, fill: { color: PAPER }, line: { color: GOLD, width: 1.4 } });
      slide.addText(t, { x: textX + 0.4, y: iy - 0.05, w: 6.4, h: 0.65, fontFace: FONT_BODY, fontSize: 15, color: INK_SOFT, valign: 'top' });
    });
  } else {
    bulletsBlock(slide, s.body, { x: textX, y, w: 6.9, h: 2.6 });
  }
}

function renderChain(s, i) {
  const { slide } = baseSlide(s, i);
  sectionLabel(slide, s.section, { x: 0, y: 0.62, w: W, align: 'center' });
  slide.addText(s.title, { x: 1, y: 1.05, w: W - 2, h: 0.9, align: 'center', fontFace: FONT_HEAD, bold: true, fontSize: 30, color: INK });
  const startY = 2.25;
  const rowH = 0.72;
  s.chain.forEach((c, idx) => {
    const y = startY + idx * rowH;
    const isRoot = idx === s.chain.length - 1;
    if (isRoot) slide.addShape('roundRect', { x: 3.2, y: y - 0.06, w: 6.9, h: rowH - 0.1, rectRadius: 0.06, fill: { color: GOLD_TINT }, line: { type: 'none' } });
    slide.addShape('ellipse', {
      x: 3.35, y: y, w: 0.42, h: 0.42,
      fill: { color: isRoot ? GOLD : PAPER }, line: { color: GOLD, width: 1.5 },
    });
    slide.addText(String(idx + 1), { x: 3.35, y: y, w: 0.42, h: 0.42, align: 'center', valign: 'middle', fontFace: FONT_HEAD, bold: true, fontSize: 14, color: isRoot ? PAPER : GOLD });
    slide.addText(c, {
      x: 3.95, y: y - 0.02, w: 5.9, h: 0.55, valign: 'middle', fontFace: FONT_BODY,
      fontSize: 15, bold: isRoot, color: isRoot ? INK : INK_SOFT,
    });
  });
}

function renderBigstatement(s, i) {
  renderSideLayout(s, i, { bigTitle: true });
}

function renderBigidea(s, i) {
  const { slide } = baseSlide(s, i);
  slide.addText('“', { x: 0, y: 0.55, w: W, h: 1.2, align: 'center', fontFace: FONT_HEAD, bold: true, fontSize: 96, color: GOLD_BRIGHT });
  const quote = s.title.replace(/^“|”$/g, '');
  slide.addText(quote, {
    x: 1.6, y: 1.7, w: W - 3.2, h: 3.2, align: 'center', valign: 'top',
    fontFace: FONT_HEAD, italic: true, bold: true, fontSize: 26, color: PAPER_ON_DARK, lineSpacingMultiple: 1.3,
  });
  slide.addImage({ path: iconPath(s.icon), x: W / 2 - 1.1, y: 5.15, w: 2.2, h: 2.2 });
}

function renderPillars(s, i) {
  const { slide } = baseSlide(s, i);
  sectionLabel(slide, s.section, { x: 0, y: 0.62, w: W, align: 'center' });
  slide.addText(s.title, { x: 1, y: 1.05, w: W - 2, h: 0.7, align: 'center', fontFace: FONT_HEAD, bold: true, fontSize: 30, color: INK });
  slide.addImage({ path: iconPath(s.icon), x: W / 2 - 1.0, y: 1.85, w: 2.0, h: 2.0 });
  const cw = 3.6, ch = 1.5, gap = 0.5, startX = W / 2 - cw - gap / 2;
  s.pillars.forEach((p, idx) => {
    const x = startX + idx * (cw + gap);
    slide.addShape('roundRect', { x, y: 4.15, w: cw, h: ch, rectRadius: 0.08, fill: { color: idx === 1 ? GOLD_TINT : GREEN_TINT }, line: { type: 'none' } });
    slide.addText(p.label, { x: x + 0.25, y: 4.32, w: cw - 0.5, h: 0.5, fontFace: FONT_HEAD, bold: true, fontSize: 18, color: INK, align: 'center' });
    slide.addText(p.desc, { x: x + 0.25, y: 4.82, w: cw - 0.5, h: 0.75, fontFace: FONT_BODY, fontSize: 13, color: INK_SOFT, align: 'center', valign: 'top' });
  });
  slide.addText(s.body[0], { x: 1.5, y: 5.95, w: W - 3, h: 0.5, align: 'center', italic: true, fontFace: FONT_HEAD, fontSize: 16, color: GOLD });
}

function renderTwopanel(s, i) {
  const { slide } = baseSlide(s, i);
  sectionLabel(slide, s.section, { x: 0, y: 0.55, w: W, align: 'center' });
  let y0 = 0.95;
  if (s.kicker) { slide.addText(s.kicker, { x: 0, y: y0, w: W, h: 0.35, align: 'center', italic: true, fontFace: FONT_HEAD, fontSize: 14, color: INK_SOFT }); y0 += 0.4; }
  slide.addText(s.title, { x: 1, y: y0, w: W - 2, h: 0.75, align: 'center', fontFace: FONT_HEAD, bold: true, fontSize: 27, color: INK });
  slide.addImage({ path: iconPath(s.icon), x: W / 2 - 0.85, y: y0 + 0.8, w: 1.7, h: 1.7 });
  const cw = 5.1, ch = 2.15, gap = 0.5, startX = W / 2 - cw - gap / 2, y = y0 + 2.75;
  s.panels.forEach((p, idx) => {
    const x = startX + idx * (cw + gap);
    slide.addShape('roundRect', { x, y, w: cw, h: ch, rectRadius: 0.08, fill: { color: idx === 1 ? GOLD_TINT : PAPER_DEEP }, line: { color: 'D8C9A3', width: 0.75 } });
    slide.addText(p.label, { x: x + 0.28, y: y + 0.2, w: cw - 0.56, h: 0.4, fontFace: FONT_HEAD, bold: true, fontSize: 16, color: INK });
    const bodyParas = [{ text: p.desc, options: { color: INK_SOFT, breakLine: true, paraSpaceAfter: 6 } }];
    if (p.example) bodyParas.push({ text: p.example, options: { color: GREEN, italic: true } });
    slide.addText(bodyParas, { x: x + 0.28, y: y + 0.62, w: cw - 0.56, h: ch - 0.8, fontFace: FONT_BODY, fontSize: 12.5, valign: 'top', lineSpacingMultiple: 1.2 });
  });
}

function renderCta(s, i) {
  const { slide } = baseSlide(s, i);
  slide.addImage({ path: iconPath(s.icon), x: W / 2 - 1.05, y: 0.55, w: 2.1, h: 2.1 });
  sectionLabel(slide, s.section, { x: 0, y: 2.75, w: W, align: 'center' });
  slide.addText(s.title, { x: 1, y: 3.15, w: W - 2, h: 1.0, align: 'center', fontFace: FONT_HEAD, bold: true, fontSize: 32, color: PAPER_ON_DARK });
  const paras = s.body.map((t, idx) => ({ text: t, options: { bullet: { code: '25C6', indent: 18 }, color: 'E7DCC2', breakLine: idx < s.body.length - 1, paraSpaceAfter: 10 } }));
  slide.addText(paras, { x: 2.6, y: 4.35, w: W - 5.2, h: 2.2, fontFace: FONT_BODY, fontSize: 15, valign: 'top', lineSpacingMultiple: 1.25 });
}

const RENDERERS = {
  title: renderTitle,
  statement: renderSideLayout,
  compare: renderSideLayout,
  checklist: renderSideLayout,
  bigstatement: renderBigstatement,
  chain: renderChain,
  bigidea: renderBigidea,
  pillars: renderPillars,
  twopanel: renderTwopanel,
  cta: renderCta,
};

slides.forEach((s, i) => {
  const fn = RENDERERS[s.layout] || renderSideLayout;
  fn(s, i);
});

const outPath = path.join(root, 'Syakhshiyah-Islamiyah.pptx');
pres.writeFile({ fileName: outPath }).then(() => {
  console.log('pptx written to', outPath);
});
