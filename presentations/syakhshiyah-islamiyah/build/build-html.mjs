import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { slides, meta } from './content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function nl2br(s = '') {
  return esc(s).split('\n').map((l) => l).join('<br/>');
}
function svgOf(id) {
  return readFileSync(path.join(root, 'assets', 'icons', `${id}.svg`), 'utf8');
}

function illustration(icon, extraClass = '') {
  return `<div class="illustration ${extraClass}">${svgOf(icon)}</div>`;
}

function bullets(items = []) {
  return `<ul class="bullets">${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
}

function kickerHtml(s) {
  return s.kicker ? `<p class="kicker">${esc(s.kicker)}</p>` : '';
}

function renderSlide(s, i) {
  const side = i % 2 === 0 ? 'right' : 'left';
  let inner = '';

  if (s.layout === 'title') {
    inner = `
      <div class="slide-inner title-layout">
        ${illustration(s.icon, 'illustration--lg')}
        <p class="eyebrow">Kajian Kepribadian Islam</p>
        <h1 class="title-main">${nl2br(s.title)}</h1>
        <p class="subtitle">${esc(s.subtitle)}</p>
        <p class="tag">${esc(s.tag)}</p>
      </div>`;
  } else if (s.layout === 'bigidea') {
    inner = `
      <div class="slide-inner bigidea-layout">
        <span class="quote-mark" aria-hidden="true">&ldquo;</span>
        <p class="bigidea-text">${esc(s.title).replace(/^"|"$/g, '').replace(/^“|”$/g, '')}</p>
        <div class="bigidea-flourish">${svgOf(s.icon)}</div>
      </div>`;
  } else if (s.layout === 'bigstatement') {
    inner = `
      <div class="slide-inner bigstatement-layout side-${side}">
        ${illustration(s.icon, 'illustration--md')}
        <div class="text-col">
          <p class="section-label">${esc(s.section)}</p>
          <h2 class="big-statement">${nl2br(s.title)}</h2>
          ${bullets(s.body)}
        </div>
      </div>`;
  } else if (s.layout === 'compare') {
    inner = `
      <div class="slide-inner compare-layout side-${side}">
        ${illustration(s.icon, 'illustration--md')}
        <div class="text-col">
          <p class="section-label">${esc(s.section)}</p>
          ${kickerHtml(s)}
          <h2>${esc(s.title)}</h2>
          <div class="compare-row">
            <div class="compare-card">
              <p class="compare-label">${esc(s.compareLeft.label)}</p>
              <p class="compare-value">${esc(s.compareLeft.value)}</p>
            </div>
            <div class="compare-vs" aria-hidden="true">vs</div>
            <div class="compare-card compare-card--accent">
              <p class="compare-label">${esc(s.compareRight.label)}</p>
              <p class="compare-value">${esc(s.compareRight.value)}</p>
            </div>
          </div>
          ${bullets(s.body)}
        </div>
      </div>`;
  } else if (s.layout === 'chain') {
    inner = `
      <div class="slide-inner chain-layout">
        <p class="section-label center">${esc(s.section)}</p>
        <h2 class="center">${esc(s.title)}</h2>
        <ol class="chain">
          ${s.chain
            .map(
              (c, idx) => `<li class="${idx === s.chain.length - 1 ? 'chain-root' : ''}">
                <span class="chain-badge">${idx + 1}</span>
                <span class="chain-text">${esc(c)}</span>
              </li>`
            )
            .join('')}
        </ol>
      </div>`;
  } else if (s.layout === 'pillars') {
    inner = `
      <div class="slide-inner pillars-layout">
        <p class="section-label center">${esc(s.section)}</p>
        <h2 class="center">${esc(s.title)}</h2>
        ${illustration(s.icon, 'illustration--md center-block')}
        <div class="pillars-row">
          ${s.pillars
            .map(
              (p, idx) => `<div class="pillar-card ${idx === 1 ? 'pillar-card--gold' : ''}">
                <p class="pillar-label">${esc(p.label)}</p>
                <p class="pillar-desc">${esc(p.desc)}</p>
              </div>`
            )
            .join('')}
        </div>
        <p class="foundation-line">${esc(s.body[0])}</p>
      </div>`;
  } else if (s.layout === 'twopanel') {
    inner = `
      <div class="slide-inner twopanel-layout">
        <p class="section-label center">${esc(s.section)}</p>
        ${kickerHtml(s)}
        <h2 class="center">${esc(s.title)}</h2>
        ${illustration(s.icon, 'illustration--sm center-block')}
        <div class="twopanel-row">
          ${s.panels
            .map(
              (p, idx) => `<div class="panel-card ${idx === 1 ? 'panel-card--gold' : ''}">
                <p class="panel-label">${esc(p.label)}</p>
                <p class="panel-desc">${esc(p.desc)}</p>
                ${p.example ? `<p class="panel-example">${esc(p.example)}</p>` : ''}
              </div>`
            )
            .join('')}
        </div>
      </div>`;
  } else if (s.layout === 'checklist') {
    inner = `
      <div class="slide-inner checklist-layout side-${side}">
        ${illustration(s.icon, 'illustration--md')}
        <div class="text-col">
          <p class="section-label">${esc(s.section)}</p>
          <p class="kicker">${esc(s.kicker)}</p>
          <h2>${esc(s.title)}</h2>
          <ul class="checklist">
            ${s.checklist.map((c) => `<li><span class="box" aria-hidden="true"></span><span>${esc(c)}</span></li>`).join('')}
          </ul>
        </div>
      </div>`;
  } else if (s.layout === 'cta') {
    inner = `
      <div class="slide-inner cta-layout">
        <div class="bigidea-flourish">${svgOf(s.icon)}</div>
        <p class="section-label">${esc(s.section)}</p>
        <h2 class="cta-title">${esc(s.title)}</h2>
        ${bullets(s.body)}
      </div>`;
  } else {
    // statement (default)
    inner = `
      <div class="slide-inner statement-layout side-${side}">
        ${illustration(s.icon, 'illustration--md')}
        <div class="text-col">
          <p class="section-label">${esc(s.section)}</p>
          ${kickerHtml(s)}
          <h2>${esc(s.title)}</h2>
          ${bullets(s.body)}
        </div>
      </div>`;
  }

  const dark = s.layout === 'bigidea' || s.layout === 'cta' ? ' slide--dark' : '';
  return `
  <section class="slide${dark}" data-index="${i}" id="${s.id}" role="group" aria-roledescription="slide" aria-label="Slide ${i + 1} dari ${slides.length}">
    <div class="slide-frame" aria-hidden="true">
      <span class="corner corner--tl"></span><span class="corner corner--tr"></span>
      <span class="corner corner--bl"></span><span class="corner corner--br"></span>
    </div>
    ${inner}
    <footer class="slide-footer">
      <span class="folio">${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}</span>
      <span class="footer-title">${esc(meta.title)}</span>
    </footer>
    <aside class="notes-print"><strong>Catatan presenter:</strong> ${esc(s.note)}</aside>
  </section>`;
}

const slidesHtml = slides.map(renderSlide).join('\n');

const dotsHtml = slides
  .map((s, i) => `<button class="dot" data-goto="${i}" aria-label="Ke slide ${i + 1}: ${esc(s.title.split('\n')[0])}"></button>`)
  .join('');

const notesData = JSON.stringify(slides.map((s) => s.note));

const css = readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const js = readFileSync(path.join(__dirname, 'app.js'), 'utf8').replace('__NOTES_DATA__', notesData);

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.subtitle)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="deck" id="deck">
  ${slidesHtml}
</div>

<nav class="controls" aria-label="Navigasi presentasi">
  <button class="nav-btn" id="prevBtn" aria-label="Slide sebelumnya">&#8592;</button>
  <div class="dots" id="dots">${dotsHtml}</div>
  <button class="nav-btn" id="nextBtn" aria-label="Slide berikutnya">&#8594;</button>
  <button class="notes-toggle" id="notesToggle" aria-expanded="false" aria-controls="notesPanel">Catatan Presenter</button>
</nav>

<div class="notes-panel" id="notesPanel" hidden>
  <div class="notes-panel__inner">
    <p class="notes-panel__label">Catatan Presenter — Slide <span id="notesIndex">1</span></p>
    <p class="notes-panel__text" id="notesText"></p>
  </div>
</div>

<script>${js}</script>
</body>
</html>
`;

writeFileSync(path.join(root, 'index.html'), html, 'utf8');
console.log('index.html generated —', slides.length, 'slides');
