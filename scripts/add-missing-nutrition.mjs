import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'recipes_md');

// Estimated per-100g values for remaining recipes without nutrition data
const estimates = {
  '香芋地瓜丸': { '热量(Kcal)': 250, '蛋白质(g)': 2.0, '脂肪(g)': 10.0, '碳水化合物(g)': 38.0, '钠(mg)': 80 },
  '脆皮鸡翅':   { '热量(Kcal)': 240, '蛋白质(g)': 18.0, '脂肪(g)': 16.0, '碳水化合物(g)': 6.0, '钠(mg)': 400 },
  '薯条':       { '热量(Kcal)': 280, '蛋白质(g)': 3.0, '脂肪(g)': 14.0, '碳水化合物(g)': 35.0, '钠(mg)': 250 },
  '炸肉肠':     { '热量(Kcal)': 520, '蛋白质(g)': 15.0, '脂肪(g)': 42.0, '碳水化合物(g)': 8.0, '钠(mg)': 900 },
};

const mdFiles = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.md'));
let updated = 0;

for (const file of mdFiles) {
  const filePath = path.join(RECIPES_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (!titleMatch) continue;
  const title = titleMatch[1].trim();
  const nutrition = estimates[title];
  if (!nutrition) continue;

  // Check if already has a nutrition section
  if (content.includes('## 营养成分')) continue;

  // Insert after 配料 section
  const ingredientsEnd = content.indexOf('## 配料');
  if (ingredientsEnd === -1) continue;

  // Find next ## section after 配料
  const nextMatch = content.substring(ingredientsEnd + 1).match(/\n## /);
  if (!nextMatch) continue;

  const insertPos = ingredientsEnd + 1 + nextMatch.index;

  const table = `## 营养成分（每 100g）

| 项目 | 含量 |
|------|------|
| 热量(Kcal) | ${nutrition['热量(Kcal)'].toFixed(1)} |
| 蛋白质(g) | ${nutrition['蛋白质(g)'].toFixed(1)} |
| 脂肪(g) | ${nutrition['脂肪(g)'].toFixed(1)} |
| 碳水化合物(g) | ${nutrition['碳水化合物(g)'].toFixed(1)} |
| 钠(mg) | ${nutrition['钠(mg)'].toFixed(1)} |

`;

  const newContent = content.substring(0, insertPos) + table + content.substring(insertPos);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`${file} | ${title}: ${JSON.stringify(nutrition)}`);
  updated++;
}

console.log(`\nUpdated: ${updated}`);
