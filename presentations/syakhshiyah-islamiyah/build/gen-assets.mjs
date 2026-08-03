import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import sharp from 'sharp';
import { renderIcon, INK, GOLD } from './icons.mjs';
import { composeSlideSVG } from './frame.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgDir = path.join(root, 'assets', 'icons');
const pngDir = path.join(root, 'assets', 'icons-png');
mkdirSync(svgDir, { recursive: true });
mkdirSync(pngDir, { recursive: true });

export const SLIDES_ICONS = [
  { id: 'title', icon: 'star8' },
  { id: 's01', icon: 'checklistScroll' },
  { id: 's02', icon: 'compassWaver' },
  { id: 's03', icon: 'mizanTilt' },
  { id: 's04', icon: 'fiveWhyChain' },
  { id: 's05', icon: 'keyReveal' },
  { id: 's06', icon: 'mirrorSplit' },
  { id: 's07', icon: 'rootedVsFloating' },
  { id: 's08', icon: 'foundationLoad' },
  { id: 's09', icon: 'flourishDivider' },
  { id: 's10', icon: 'twoPillars' },
  { id: 's11', icon: 'bulbAndCompass' },
  { id: 's12', icon: 'jarAndCloth' },
  { id: 's13', icon: 'openBook' },
  { id: 's14', icon: 'checklistClock' },
  { id: 's15', icon: 'halaqahRing' },
  { id: 's16', icon: 'quillQuestion' },
];

async function main() {
  for (const [i, s] of SLIDES_ICONS.entries()) {
    const iconMarkup = renderIcon(s.icon, i * 17 + 3);
    const svg = composeSlideSVG({ icon: iconMarkup, size: 400, ink: INK, gold: GOLD, seed: i * 17 + 3 });
    const svgPath = path.join(svgDir, `${s.id}.svg`);
    writeFileSync(svgPath, svg, 'utf8');
    const pngPath = path.join(pngDir, `${s.id}.png`);
    await sharp(Buffer.from(svg), { density: 300 }).resize(900, 900).png().toFile(pngPath);
    console.log('generated', s.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
