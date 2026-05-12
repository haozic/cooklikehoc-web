import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'recipes_md');
const RECIPES_JS = path.join(ROOT, 'src', 'data', 'recipes.js');

// Step 1: build nutrition map from fixed markdown files
const nutritionMap = {};
const mdFiles = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.md'));

for (const file of mdFiles) {
  const content = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf-8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (!titleMatch) continue;
  const title = titleMatch[1].trim();

  const nutrition = {};
  const sectionMatch = content.match(/## 营养成分（每 100g）[\s\S]*?(?=##|$)/);
  if (sectionMatch) {
    const rows = sectionMatch[0].matchAll(/\|\s*([^(|]+)\((.+?)\)\s*\|\s*(.+?)\s*\|/g);
    for (const row of rows) {
      const key = row[1].trim().replace(/^\|\s*/, '');
      const unit = row[2].trim();
      const raw = row[3].trim();
      if (raw === '—' || raw === '-' || raw === '') continue;
      const val = parseFloat(raw);
      if (!isNaN(val)) nutrition[`${key}(${unit})`] = val;
    }
  }
  if (Object.keys(nutrition).length > 0) nutritionMap[title] = nutrition;
}

console.log(`Loaded nutrition for ${Object.keys(nutritionMap).length} recipes`);

// Step 2: patch recipes.js using regex replacement
let content = fs.readFileSync(RECIPES_JS, 'utf-8');
let updated = 0;
let skipped = 0;

for (const [title, nutrition] of Object.entries(nutritionMap)) {
  // Build the JSON string for the new nutrition block
  const entries = Object.entries(nutrition)
    .map(([k, v]) => `"${k}": ${v}${Number.isInteger(v) ? '' : ''}`);
  const newBlock = `"nutrition": {\n      ${entries.join(',\n      ')}\n    }`;

  // Escape title for regex (handle special chars like parentheses)
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find the nutrition block that follows this recipe's title
  // The pattern: "title": "ESCAPED_TITLE", followed by "nutrition": { ... }
  const regex = new RegExp(
    `("title":\\s*"${escapedTitle}"[\\s\\S]*?)"nutrition":\\s*\\{[^}]*\\}`,
    ''
  );

  const newContent = content.replace(regex, (match, before) => {
    return before + newBlock;
  });

  if (newContent !== content) {
    content = newContent;
    updated++;
  } else {
    // Recipe may not have a nutrition field at all — insert before "steps"
    const insertRegex = new RegExp(
      `("title":\\s*"${escapedTitle}"[\\s\\S]*?)(\n\\s*"steps")`,
      ''
    );
    const newContent2 = content.replace(insertRegex, `$1\n    ${newBlock},$2`);
    if (newContent2 !== content) {
      content = newContent2;
      updated++;
    } else {
      console.log(`SKIP (no match): ${title}`);
      skipped++;
    }
  }
}

fs.writeFileSync(RECIPES_JS, content, 'utf-8');
console.log(`Updated: ${updated}, Skipped: ${skipped}`);

// Step 3: verify
const verify = fs.readFileSync(RECIPES_JS, 'utf-8');
const checks = ['农家蒸蛋', '清炒青菜', '白切鸡', '奶皮子酸奶', '鹌鹑蛋红烧肉', '什锦蛋炒饭'];
for (const name of checks) {
  const re = new RegExp(`"title":\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,400}?"nutrition":\\s*\\{([^}]+)\\}`, '');
  const m = verify.match(re);
  if (m) console.log(`${name}: { ${m[1].trim()} }`);
  else console.log(`${name}: NOT FOUND`);
}
