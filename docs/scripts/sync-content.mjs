import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourceDir = rootDir;
const targetDir = path.join(rootDir, 'src', 'content', 'docs', 'reference');

const titleOverrides = new Map([
  ['README.md', 'Ringkasan Dokumentasi'],
  ['CORE.md', 'Referensi Modul Inti'],
  ['modules.md', 'Peta Modul dan Route'],
  ['developer-guide.md', 'Panduan Developer'],
  ['architecture.md', 'Arsitektur Sistem'],
  ['database-mode-switching.md', 'Mode Database dan Runtime'],
  ['ecommerce-implementation.md', 'Implementasi E-Commerce'],
  ['ecommerce-next-steps.md', 'Rencana Lanjutan E-Commerce'],
  ['syirkah-accounting.md', 'Akuntansi Syirkah']
]);

const categoryPrefixes = [
  ['BLUEPRINT', 'Blueprint'],
  ['ROADMAP', 'Roadmap'],
  ['PENAWARAN', 'Penawaran']
];

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferTitle(fileName) {
  if (titleOverrides.has(fileName)) return titleOverrides.get(fileName);
  const stem = fileName.replace(/\.md$/i, '');
  for (const [prefix, label] of categoryPrefixes) {
    if (stem.startsWith(prefix)) {
      return `${label}: ${stem.slice(prefix.length + 1).replace(/_/g, ' ')}`.trim();
    }
  }
  return stem
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferDescription(content, fileName) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  const firstParagraph = lines.find((line) => line.length > 30);
  if (firstParagraph) {
    return firstParagraph.replace(/"/g, '\\"').slice(0, 160);
  }

  return `Dokumen referensi sumber untuk ${inferTitle(fileName)} di Nizam Docs.`;
}

function stripLeadingHeading(content) {
  return content.replace(/^#\s+.+?\n+/, '');
}

function normalizeCodeFences(content) {
  return content.replace(/```env\b/g, '```ini');
}

await fs.mkdir(targetDir, { recursive: true });

const entries = await fs.readdir(sourceDir, { withFileTypes: true });
const markdownFiles = entries
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const existingTargets = await fs.readdir(targetDir).catch(() => []);
await Promise.all(
  existingTargets
    .filter((file) => file.endsWith('.md'))
    .map((file) => fs.rm(path.join(targetDir, file), { force: true }))
);

for (const fileName of markdownFiles) {
  const sourcePath = path.join(sourceDir, fileName);
  const raw = await fs.readFile(sourcePath, 'utf8');
  const body = normalizeCodeFences(stripLeadingHeading(raw)).trim();
  const title = inferTitle(fileName);
  const description = inferDescription(raw, fileName);
  const slug = slugify(fileName.replace(/\.md$/i, ''));

  const generated = `---\ntitle: \"${title.replace(/"/g, '\\"')}\"\ndescription: \"${description}\"\nsidebar:\n  label: \"${title.replace(/"/g, '\\"')}\"\n---\n\n> Dokumen ini disinkronkan otomatis dari file sumber \`${fileName}\` di root project docs.\n\n${body}\n`;

  await fs.writeFile(path.join(targetDir, `${slug}.md`), generated, 'utf8');
}

console.log(`Synced ${markdownFiles.length} markdown source files into src/content/docs/reference.`);
