import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const REPO_DIR = path.join(ROOT, 'CookLikeHOC-main');
const IMAGES_DIR = path.join(REPO_DIR, 'images');

const categories = [
  { id: '主食', name: '主食', icon: '🍚', description: '面条、米饭、馄饨等主食' },
  { id: '凉拌', name: '凉拌', icon: '🥗', description: '凉拌菜、口水鸡等' },
  { id: '卤菜', name: '卤菜', icon: '🍖', description: '卤制熟食' },
  { id: '早餐', name: '早餐', icon: '🥟', description: '包子、粥、油条等早餐' },
  { id: '汤', name: '汤', icon: '🍲', description: '鸡汤、汤品' },
  { id: '炒菜', name: '炒菜', icon: '🥘', description: '各种炒菜' },
  { id: '炖菜', name: '炖菜', icon: '🫕', description: '炖煮类菜品' },
  { id: '炸品', name: '炸品', icon: '🍗', description: '炸鸡、炸物' },
  { id: '烤类', name: '烤类', icon: '🥩', description: '烤制食品' },
  { id: '烫菜', name: '烫菜', icon: '🥬', description: '烫熟拌制' },
  { id: '煮锅', name: '煮锅', icon: '🍜', description: '米线、冒菜等' },
  { id: '砂锅菜', name: '砂锅菜', icon: '🫕', description: '砂锅系列' },
  { id: '蒸菜', name: '蒸菜', icon: '🥟', description: '蒸制菜品' },
  { id: '配料', name: '配料', icon: '🧂', description: '酱料、调料' },
  { id: '饮品', name: '饮品', icon: '🥤', description: '饮品' },
];

// Build image name -> local path map
const imageFiles = fs.readdirSync(IMAGES_DIR);
const imageMap = {};
for (const f of imageFiles) {
  const base = f.replace(/\.[^.]+$/, '');
  imageMap[base] = `/CookLikeHOC-main/images/${f}`;
  // Also add normalized key (strip version suffix)
  const normalized = base
    .replace(/\(.*版本\)/g, '')
    .replace(/（.*版本）/g, '')
    .replace(/\(.*版\)/g, '')
    .replace(/（.*版）/g, '')
    .replace(/版$/g, '')
    .trim();
  if (!imageMap[normalized]) {
    imageMap[normalized] = `/CookLikeHOC-main/images/${f}`;
  }
}

function parseMarkdown(content, category, filename) {
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract image
  const imageMatch = content.match(/!\[.*?\]\(([^)]+)\)/);
  let imageUrl = null;
  if (imageMatch) {
    const relPath = imageMatch[1];
    if (relPath.startsWith('../images/')) {
      const imgName = path.basename(relPath);
      imageUrl = `/CookLikeHOC/images/${imgName}`;
    }
  }
  if (!imageUrl && title) {
    let titleImg = imageMap[title];
    if (titleImg) imageUrl = titleImg;
    else {
      const normalizedTitle = title
        .replace(/\(.*版本\)/g, '').replace(/（.*版本）/g, '')
        .replace(/\(.*版\)/g, '').replace(/（.*版）/g, '').replace(/版$/g, '').trim();
      titleImg = imageMap[normalizedTitle];
      if (titleImg) imageUrl = titleImg;
    }
    if (!imageUrl) {
      for (const [key, val] of Object.entries(imageMap)) {
        if (title.includes(key) || key.includes(title)) { imageUrl = val; break; }
      }
    }
    if (!imageUrl && title.length >= 4) {
      for (const [key, val] of Object.entries(imageMap)) {
        if (key.startsWith(title.slice(0, 4))) { imageUrl = val; break; }
      }
    }
  }

  // Extract ingredients: try heading sections first
  const ingredients = [];
  const ingPatterns = [
    /## 食材([\s\S]*?)(?=##\s|$)/,
    /## 配料([\s\S]*?)(?=##\s|$)/,
    /## 原料[：:\s]([\s\S]*?)(?=##\s|$)/,
    /## 品类([\s\S]*?)(?=##\s|$)/,
  ];
  for (const pat of ingPatterns) {
    const m = content.match(pat);
    if (m && m[1].trim()) {
      m[1].split('\n').forEach(line => {
        const c = line.replace(/^-\s*/, '').trim();
        if (c && !c.startsWith('<') && c.length > 1 && !c.startsWith('_')) ingredients.push(c);
      });
      break;
    }
  }

  // Fallback: check preamble between image and first ##
  if (ingredients.length === 0) {
    const imgIdx = content.indexOf('![');
    const firstHashIdx = content.search(/\n## /);
    if (imgIdx !== -1 && firstHashIdx !== -1 && firstHashIdx > imgIdx) {
      const preamble = content.slice(imgIdx, firstHashIdx);
      preamble.split('\n').forEach(line => {
        const c = line.replace(/^-\s*/, '').trim();
        if (c && !c.startsWith('<') && c.length > 1 && !c.startsWith('_') && !c.startsWith('![') && !c.startsWith('#')) {
          ingredients.push(c);
        }
      });
    }
  }

  // Extract steps: use line-by-line to handle ### sub-headings and ①-style items
  const steps = [];
  const stepHeadingMatch = content.match(/## 做法\n([\s\S]*?)$/) || content.match(/## 步骤[：:\s]*\n([\s\S]*?)$/);
  if (stepHeadingMatch) {
    const rest = stepHeadingMatch[1];
    const lines = rest.split('\n');
    for (const line of lines) {
      if (line.match(/^##[^#]/)) break; // stop at next top-level heading
      const m = line.match(/^(\d+[\.、]\s*.+)/) || line.match(/^-\s*(\d+[\.、]\s*.+)/) || line.match(/^-\s*(.+)/);
      if (m) { const s = m[1].trim(); if (s) steps.push(s); }
    }
  }
  // Also try inline 做法/步骤 heading (no newline after)
  if (steps.length === 0) {
    const inlineMatch = content.match(/## 做法[：:\s]*([\s\S]*?)(?=##\s|$)/) || content.match(/## 步骤[：:\s]*([\s\S]*?)(?=##\s|$)/);
    if (inlineMatch && inlineMatch[1].trim()) {
      inlineMatch[1].split('\n').forEach(line => {
        const m = line.match(/^(\d+[\.、]\s*.+)/) || line.match(/^-\s*(\d+[\.、]\s*.+)/) || line.match(/^-\s*(.+)/);
        if (m) { const s = m[1].trim(); if (s) steps.push(s); }
      });
    }
  }

  return { title, category, image: imageUrl, ingredients, steps };
}

console.log(`Found ${imageFiles.length} images\n=== Parsing recipes ===`);
const allRecipes = [];

for (const cat of categories) {
  const catDir = path.join(REPO_DIR, cat.id);
  if (!fs.existsSync(catDir)) { console.log(`${cat.name}: dir not found`); continue; }
  const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md') && f !== 'README.md');
  console.log(`${cat.name}: ${files.length} recipes`);
  for (const file of files) {
    const content = fs.readFileSync(path.join(catDir, file), 'utf-8');
    const recipe = parseMarkdown(content, cat.name, file);
    if (recipe.title) {
      recipe.id = `${cat.id}-${file.replace('.md', '')}`;
      recipe.slug = file.replace('.md', '');
      recipe.categoryDir = cat.id;
      allRecipes.push(recipe);
    }
  }
}

const withImg = allRecipes.filter(r => r.image).length;
const noIng = allRecipes.filter(r => !r.ingredients?.length).length;
const noStep = allRecipes.filter(r => !r.steps?.length).length;
console.log(`\nTotal: ${allRecipes.length} | with images: ${withImg} | no ingredients: ${noIng} | no steps: ${noStep}`);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const outputPath = path.join(DATA_DIR, 'recipes.js');
let js = `// Auto-generated (${allRecipes.length} recipes)\n\nexport const categories = ${JSON.stringify(categories, null, 2)};\n\nexport const recipes = ${JSON.stringify(allRecipes, null, 2)};\n\nexport function getCategories() {\n  return categories.map(cat => ({ ...cat, count: recipes.filter(r => r.categoryDir === cat.id).length }));\n}\nexport function getRecipesByCategory(id) { return recipes.filter(r => r.categoryDir === id); }\nexport function getRecipeById(id) { return recipes.find(r => r.id === id); }\nexport function getFeaturedRecipes() {\n  const feat = ['主食-大大大块牛腩面','主食-大排面','凉拌-口水鸡','汤-老鸡汤','炒菜-宫保鸡丁'];\n  return recipes.filter(r => feat.includes(r.id)).map(r => ({ ...r, featured: true }));\n}\nexport function searchRecipes(q) {\n  q = q.toLowerCase();\n  return recipes.filter(r => r.title.toLowerCase().includes(q) || r.category.includes(q) || r.ingredients?.some(i => i.toLowerCase().includes(q)));\n}\n`;
fs.writeFileSync(outputPath, js, 'utf-8');
console.log(`Saved to: ${outputPath}`);
