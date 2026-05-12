import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'recipes_md');

const mdFiles = fs.readdirSync(RECIPES_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

console.log(`Found ${mdFiles.length} markdown files\n`);

let fixed5 = 0;
let fixedPartial = 0;
let noData = 0;

for (const file of mdFiles) {
  const filePath = path.join(RECIPES_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  const nutritionMatch = content.match(/## 营养成分（每 100g）\r?\n\r?\n\| 项目 \| 含量 \|\r?\n\|------\|------\|\r?\n((?:\| [^\r\n|]+\|[^\r\n|]+\|\r?\n?)+)/);
  if (!nutritionMatch) {
    continue; // no nutrition section
  }

  const tableText = nutritionMatch[1];
  const rows = tableText.trim().split('\n');

  // Parse key-value pairs
  const data = {};
  for (const row of rows) {
    const m = row.match(/\| (.+?)\(.+?\) \| (.+?) \|/);
    if (m) {
      data[m[1]] = parseFloat(m[2]);
    }
  }

  const keys = Object.keys(data);

  if (keys.length === 0) continue;

  // Check if first value is 100.0 (header leak artifact)
  const firstKey = keys[0];
  const firstVal = data[firstKey];

  if (firstVal !== 100.0) {
    continue; // already fixed or different issue
  }

  if (keys.length === 1) {
    // Only one field: 热量=100 — no real data in PDF
    noData++;
    // Leave as-is (or could remove); user already knows these 26 have no data
    continue;
  }

  // Shift right: drop first (100), shift remaining
  // 热量 ← 蛋白质, 蛋白质 ← 脂肪, 脂肪 ← 碳水, 碳水 ← 钠, 钠 ← lost
  const fieldOrder = ['热量', '蛋白质', '脂肪', '碳水化合物', '钠'];
  const orderedKeys = fieldOrder.filter(k => data[k] !== undefined);

  const newData = {};
  for (let i = 0; i < orderedKeys.length - 1; i++) {
    newData[orderedKeys[i]] = data[orderedKeys[i + 1]];
  }
  // Last key (钠) gets nothing — value was lost

  if (Object.keys(newData).length === keys.length - 1) {
    // Successfully shifted all but last
    // Build new table
    const newRows = [];
    for (const k of Object.keys(newData)) {
      const unitMap = { '热量': 'Kcal', '蛋白质': 'g', '脂肪': 'g', '碳水化合物': 'g', '钠': 'mg' };
      const unit = unitMap[k] || '';
      newRows.push(`| ${k}(${unit}) | ${newData[k].toFixed(1)} |`);
    }
    // Add 钠 with placeholder since real value was lost
    newRows.push('| 钠(mg) | — |');

    const newTable = `## 营养成分（每 100g）

| 项目 | 含量 |
|------|------|
${newRows.join('\n')}`;

    const tableRegex = /## 营养成分（每 100g）\r?\n\r?\n\| 项目 \| 含量 \|\r?\n\|------\|------\|\r?\n(?:\| [^\r\n|]+\|[^\r\n|]+\|\r?\n?)+/;

    const updatedContent = content.replace(tableRegex, newTable);

    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    fixed5++;
  } else {
    // Partial data — shift what we can
    const newData = {};
    for (let i = 0; i < orderedKeys.length - 1; i++) {
      newData[orderedKeys[i]] = data[orderedKeys[i + 1]];
    }

    const newRows = [];
    for (const k of Object.keys(newData)) {
      const unitMap = { '热量': 'Kcal', '蛋白质': 'g', '脂肪': 'g', '碳水化合物': 'g', '钠': 'mg' };
      const unit = unitMap[k] || '';
      newRows.push(`| ${k}(${unit}) | ${newData[k].toFixed(1)} |`);
    }

    const newTable = `## 营养成分（每 100g）

| 项目 | 含量 |
|------|------|
${newRows.join('\n')}`;

    const tableRegex = /## 营养成分（每 100g）\r?\n\r?\n\| 项目 \| 含量 \|\r?\n\|------\|------\|\r?\n(?:\| [^\r\n|]+\|[^\r\n|]+\|\r?\n?)+/;

    const updatedContent = content.replace(tableRegex, newTable);

    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    fixedPartial++;
  }
}

console.log(`Fixed (full 5→4 shift): ${fixed5}`);
console.log(`Fixed (partial shift):   ${fixedPartial}`);
console.log(`No data (only 热量=100):  ${noData}`);
console.log(`Total touched:            ${fixed5 + fixedPartial + noData}`);
