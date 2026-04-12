const fs = require('fs');
const filePath = '/Users/manbook/nizam-app/lib/db/postgres-client.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the broken regex on line 290
const badLine = "      const items = raw.split(',').map((s) => s.trim().replace(/^[\"'\\]|[\"'\\]$/g, ''))";
const goodLine = "      const items = raw.split(',').map((s) => { const t = s.trim(); return t.replace(/^[\"']/, '').replace(/[\"']$/, '') })";

if (content.includes(badLine)) {
  content = content.replace(badLine, goodLine);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS: Fixed broken regex');
} else {
  // Try to find and fix by line number approach
  const lines = content.split('\n');
  let fixed = false;
  for (let i = 285; i < 295; i++) {
    if (lines[i] && lines[i].includes("replace(/^[") && lines[i].includes('notin') === false && lines[i].includes('items')) {
      console.log('Found bad line at', i+1, ':', lines[i]);
      lines[i] = "      const items = raw.split(',').map((s) => { const t = s.trim(); return t.replace(/^[\"']/, '').replace(/[\"']$/, '') })";
      fixed = true;
      break;
    }
  }
  if (fixed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('SUCCESS: Fixed via line search');
  } else {
    // Just show lines 285-295
    console.log('LINES 285-295:');
    for (let i = 284; i < 295; i++) {
      console.log(i+1, ':', lines[i]);
    }
  }
}
