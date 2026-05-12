import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import estimates from './estimated-nutrition.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'recipes_md');

let updated = 0;
let skipped = 0;

for (const [title, nutrition] of Object.entries(estimates)) {
  // Find the markdown file for this recipe
  const files = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.md'));
  const file = files.find(f => {
    const content = fs.readFileSync(path.join(RECIPES_DIR, f), 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch && titleMatch[1].trim() === title;
  });

  if (!file) {
    console.log(`NOT FOUND: ${title}`);
    skipped++;
    continue;
  }

  const filePath = path.join(RECIPES_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Build nutrition table
  const rows = [
    `| 热量(Kcal) | ${nutrition['热量(Kcal)'].toFixed(1)} |`,
    `| 蛋白质(g) | ${nutrition['蛋白质(g)'].toFixed(1)} |`,
    `| 脂肪(g) | ${nutrition['脂肪(g)'].toFixed(1)} |`,
    `| 碳水化合物(g) | ${nutrition['碳水化合物(g)'].toFixed(1)} |`,
    `| 钠(mg) | ${nutrition['钠(mg)'].toFixed(1)} |`,
  ];

  const newTable = `## 营养成分（每 100g）

| 项目 | 含量 |
|------|------|
${rows.join('\n')}`;

  // Replace existing nutrition section
  const updatedContent = content.replace(
    /## 营养成分（每 100g）\r?\n\r?\n\| 项目 \| 含量 \|\r?\n\|------\|------\|\r?\n(?:\| [^\r\n|]+\|[^\r\n|]+\|\r?\n?)+/,
    newTable
  );

  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`${file} | ${title} → 热量:${nutrition['热量(Kcal)']} 蛋白:${nutrition['蛋白质(g)']} 脂肪:${nutrition['脂肪(g)']} 碳水:${nutrition['碳水化合物(g)']} 钠:${nutrition['钠(mg)']}`);
    updated++;
  } else {
    console.log(`SKIP ${title}: no match`);
    skipped++;
  }
}

console.log(`\nUpdated: ${updated}, Skipped: ${skipped}`);
