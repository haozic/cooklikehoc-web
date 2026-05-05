import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Categories from the repo
const CATEGORIES = [
  { dir: '主食', name: '主食', icon: '🍚' },
  { dir: '凉拌', name: '凉拌', icon: '🥗' },
  { dir: '卤菜', name: '卤菜', icon: '🍖' },
  { dir: '早餐', name: '早餐', icon: '🥟' },
  { dir: '汤', name: '汤', icon: '🍲' },
  { dir: '炒菜', name: '炒菜', icon: '🥘' },
  { dir: '炖菜', name: '炖菜', icon: '🫕' },
  { dir: '炸品', name: '炸品', icon: '🍗' },
  { dir: '烤类', name: '烤类', icon: '🥩' },
  { dir: '烫菜', name: '烫菜', icon: '🥬' },
  { dir: '煮锅', name: '煮锅', icon: '🍜' },
  { dir: '砂锅菜', name: '砂锅菜', icon: '🫕' },
  { dir: '蒸菜', name: '蒸菜', icon: '🥟' },
  { dir: '配料', name: '配料', icon: '🧂' },
  { dir: '饮品', name: '饮品', icon: '🥤' },
];

const GITHUB_RAW = 'https://raw.githubusercontent.com/Gar-b-age/CookLikeHOC/main';
const GITHUB_API = 'https://api.github.com/repos/Gar-b-age/CookLikeHOC/contents';

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseMarkdown(content, category) {
  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract image URL
  const imageMatch = content.match(/!\[.*?\]\(([^)]+)\)/);
  let imageUrl = imageMatch ? imageMatch[1] : null;
  if (imageUrl && !imageUrl.startsWith('http')) {
    // Convert relative path to GitHub raw URL
    if (imageUrl.startsWith('../images/')) {
      imageUrl = `https://raw.githubusercontent.com/Gar-b-age/CookLikeHOC/main/images/${path.basename(imageUrl)}`;
    }
  }

  // Extract 食材 section
  const ingredients = [];
  const ingredientsMatch = content.match(/## 食材\n([\s\S]*?)(?=##|$)/);
  if (ingredientsMatch) {
    const lines = ingredientsMatch[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^-\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('<')) {
        ingredients.push(cleaned);
      }
    }
  }

  // Extract 做法 section
  const steps = [];
  const stepsMatch = content.match(/## 做法\n([\s\S]*?)$/);
  if (stepsMatch) {
    const lines = stepsMatch[1].split('\n');
    for (const line of lines) {
      // Match numbered steps like "1. xxx" or "- 1. xxx" or just "- xxx"
      const stepMatch = line.match(/^\d+\.\s*(.+)/) || line.match(/^-\s*\d+\.\s*(.+)/) || line.match(/^-\s*(.+)/);
      if (stepMatch) {
        const step = stepMatch[1].trim();
        if (step) steps.push(step);
      }
    }
  }

  return { title, imageUrl, ingredients, steps, category };
}

async function main() {
  const allRecipes = [];
  const dataDir = path.join(ROOT, 'src', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  for (const cat of CATEGORIES) {
    console.log(`Fetching category: ${cat.name}...`);
    try {
      const contents = await fetchJSON(`${GITHUB_API}/${encodeURIComponent(cat.dir)}`);
      if (!Array.isArray(contents)) {
        console.log(`  Skipping ${cat.dir}: not a directory`);
        continue;
      }

      const mdFiles = contents.filter(f => f.name.endsWith('.md'));
      console.log(`  Found ${mdFiles.length} recipes`);

      for (const file of mdFiles) {
        try {
          const content = await fetchText(file.download_url);
          const recipe = parseMarkdown(content, cat.name);
          if (recipe.title) {
            recipe.id = `${cat.dir}/${file.name}`.replace(/\//g, '-').replace('.md', '');
            recipe.categoryDir = cat.dir;
            recipe.slug = file.name.replace('.md', '');
            allRecipes.push(recipe);
          }
        } catch (e) {
          console.error(`  Error fetching ${file.name}: ${e.message}`);
        }
        // Small delay to be nice to GitHub
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (e) {
      console.error(`  Error fetching category ${cat.name}: ${e.message}`);
    }
  }

  // Add featured flag to first 5 recipes
  allRecipes.forEach((r, i) => {
    if (i < 5) r.featured = true;
  });

  // Save to JSON
  const outputPath = path.join(dataDir, 'recipes.json');
  fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), 'utf-8');
  console.log(`\nTotal recipes fetched: ${allRecipes.length}`);
  console.log(`Saved to: ${outputPath}`);
}

main().catch(console.error);
