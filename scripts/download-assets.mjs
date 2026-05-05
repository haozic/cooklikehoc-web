import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function httpGetText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      if (res.statusCode === 403 || res.statusCode === 429) {
        console.log(`  Rate limited (${res.statusCode}), waiting 3s...`);
        setTimeout(() => httpGetText(url).then(resolve).catch(reject), 3000);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
    });
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

async function fetchJSON(url) {
  const result = await httpGetText(url);
  return JSON.parse(result.data.toString('utf-8'));
}

async function fetchFileContent(url) {
  const result = await httpGetText(url);
  if (result.status === 200) {
    // GitHub API returns base64 content
    const json = JSON.parse(result.data.toString('utf-8'));
    if (json.content) {
      return Buffer.from(json.content, 'base64').toString('utf-8');
    }
  }
  return null;
}

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

const GITHUB_API = 'https://api.github.com/repos/Gar-b-age/CookLikeHOC/contents';

console.log('=== Fetching all recipes from GitHub API ===\n');
const allRecipes = [];

for (const cat of categories) {
  process.stdout.write(`${cat.name}... `);
  let retries = 3;
  while (retries > 0) {
    try {
      const contents = await fetchJSON(`${GITHUB_API}/${encodeURIComponent(cat.id)}`);
      const mdFiles = contents.filter(f => f.type === 'file' && f.name.endsWith('.md'));
      console.log(`${mdFiles.length} recipes`);

      for (const md of mdFiles) {
        try {
          const text = await fetchFileContent(md.url);
          if (text) {
            const recipe = parseMarkdown(text, cat.id, md.name);
            if (recipe.title) {
              recipe.id = `${cat.id}-${md.name.replace('.md', '')}`;
              recipe.slug = md.name.replace('.md', '');
              recipe.categoryDir = cat.id;
              allRecipes.push(recipe);
            }
          }
        } catch (e) {
          // skip
        }
        await new Promise(r => setTimeout(r, 100));
      }
      break;
    } catch (e) {
      retries--;
      if (retries === 0) console.log(`ERROR after retries: ${e.message}`);
      else { process.stdout.write(` retry...`); await new Promise(r => setTimeout(r, 2000)); }
    }
  }
}

console.log(`\nTotal recipes: ${allRecipes.length}`);

// Save
const outputPath = path.join(DATA_DIR, 'recipes.js');
let js = `// Auto-generated from CookLikeHOC GitHub repo (${allRecipes.length} recipes)\n\n`;

js += `export const categories = ${JSON.stringify(categories, null, 2)};\n\n`;
js += `export const recipes = ${JSON.stringify(allRecipes, null, 2)};\n\n`;
js += `export function getCategories() {\n`;
js += `  return categories.map(cat => ({\n`;
js += `    ...cat,\n`;
js += `    count: recipes.filter(r => r.categoryDir === cat.id).length,\n`;
js += `  }));\n`;
js += `}\n\n`;
js += `export function getRecipesByCategory(categoryId) {\n`;
js += `  return recipes.filter(r => r.categoryDir === categoryId);\n`;
js += `}\n\n`;
js += `export function getRecipeById(id) {\n`;
js += `  return recipes.find(r => r.id === id);\n`;
js += `}\n\n`;
js += `export function getFeaturedRecipes() {\n`;
js += `  const featured = ['主食-大大大块牛腩面', '主食-大排面', '凉拌-口水鸡', '汤-老鸡汤', '炒菜-宫保鸡丁'];\n`;
js += `  return recipes.filter(r => featured.includes(r.id)).map(r => ({ ...r, featured: true }));\n`;
js += `}\n\n`;
js += `export function searchRecipes(query) {\n`;
js += `  const q = query.toLowerCase();\n`;
js += `  return recipes.filter(r =>\n`;
js += `    r.title.toLowerCase().includes(q) ||\n`;
js += `    r.category.toLowerCase().includes(q) ||\n`;
js += `    r.ingredients.some(i => i.toLowerCase().includes(q))\n`;
js += `  );\n`;
js += `}\n`;

fs.writeFileSync(outputPath, js, 'utf-8');
console.log(`\nSaved to: ${outputPath}`);

function parseMarkdown(content, category, filename) {
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Image: from markdown ![name](../images/xxx.png)
  const imageMatch = content.match(/!\[.*?\]\(([^)]+)\)/);
  let imageUrl = null;
  if (imageMatch) {
    const relPath = imageMatch[1];
    if (relPath.startsWith('../images/')) {
      const imgName = encodeURIComponent(path.basename(relPath));
      imageUrl = `https://raw.githubusercontent.com/Gar-b-age/CookLikeHOC/main/images/${imgName}`;
    } else if (relPath.startsWith('http')) {
      imageUrl = relPath;
    }
  }

  const ingredients = [];
  const ingMatch = content.match(/## 食材\n([\s\S]*?)(?=##|$)/);
  if (ingMatch) {
    ingMatch[1].split('\n').forEach(line => {
      const c = line.replace(/^-\s*/, '').trim();
      if (c && !c.startsWith('<') && c.length > 0) ingredients.push(c);
    });
  }

  const steps = [];
  const stepMatch = content.match(/## 做法\n([\s\S]*?)$/);
  if (stepMatch) {
    stepMatch[1].split('\n').forEach(line => {
      const m = line.match(/^\d+\.\s*(.+)/) || line.match(/^-\s*\d+\.\s*(.+)/) || line.match(/^-\s*(.+)/);
      if (m) { const s = m[1].trim(); if (s) steps.push(s); }
    });
  }

  return { title, category, image: imageUrl, ingredients, steps };
}
