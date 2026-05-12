import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'recipes_md');

const mdFiles = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.md'));

// Sodium estimate per 100g based on cooking method and dish characteristics
function estimateSodium(recipe) {
  const title = recipe.title || '';
  const method = recipe.cookingMethod || '';
  const cat = recipe.category || '';
  const ingredients = recipe.ingredients || [];
  const steps = recipe.steps || [];
  const stepsText = Array.isArray(steps) ? steps.join(' ') : '';
  const ingText = ingredients.join(' ');

  // Check for high-sodium indicators
  const hasSoySauce = /生抽|老抽|酱油|味极鲜|豉油|蚝油/.test(ingText + stepsText);
  const hasSalt = /盐|食用盐/.test(ingText);
  const hasMSG = /鸡精|味精/.test(ingText);
  const hasDouban = /豆瓣|蚕豆酱|黄豆酱|甜面酱/.test(ingText);
  const hasPickled = /酸菜|泡椒|剁椒|榨菜|雪菜|梅干菜|泡菜/.test(ingText);
  const hasSausage = /香肠|腊肉|火腿|培根/.test(ingText);

  let base = 350; // baseline mg/100g

  // Cooking method adjustments
  if (/卤|红烧/.test(method)) base += 200;
  else if (/烧|炖/.test(method)) base += 100;
  else if (/炒/.test(method)) base += 50;
  else if (/蒸|烫|煮/.test(method)) base += 0;

  // Dish type adjustments
  if (/汤|面|粉|馄饨|粥/.test(title)) base += 100;
  if (/饭/.test(title)) base += 50;

  // Seasoning adjustments
  if (hasSoySauce) base += 100;
  if (hasDouban) base += 100;
  if (hasPickled) base += 150;
  if (hasSausage) base += 100;
  if (hasSalt && hasMSG && hasSoySauce) base += 50;

  // Drink/dessert
  if (cat === '饮品' || /酸奶|豆浆|酒酿|甜羹/.test(title)) base = 40;

  // Specific dish type overrides
  if (/汤/.test(title) && /鸡|骨/.test(title)) base = Math.max(base, 400);

  // Clamp
  base = Math.max(10, Math.min(900, base));

  return base;
}

let updated = 0;
let skipped = 0;

for (const file of mdFiles) {
  const filePath = path.join(RECIPES_DIR, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Check if sodium row has "—" (meaning missing value)
  const sodiumDash = content.match(/\|\s*钠\(mg\)\s*\|\s*[—\-]\s*\|/);
  if (!sodiumDash) continue; // sodium is present or not mentioned

  // Parse basic recipe info for estimation
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const methodMatch = content.match(/\|\s*烹饪方式\s*\|\s*(.+?)\s*\|/);
  const catMatch = content.match(/\|\s*分类\s*\|\s*(.+?)\s*\|/);
  const ingredientsMatch = content.match(/##\s*配料\s*\n([\s\S]*?)(?=##|$)/);
  const stepsMatch = content.match(/##\s*制作工艺\s*\n([\s\S]*?)(?=##|$)/);

  const recipe = {
    title: titleMatch?.[1]?.trim(),
    cookingMethod: methodMatch?.[1]?.trim(),
    category: catMatch?.[1]?.trim(),
    ingredients: ingredientsMatch?.[1]?.trim()?.split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^-\s*/, '').trim()) || [],
    steps: stepsMatch?.[1]?.trim()?.split('\n').filter(l => /^\d+\./.test(l.trim())) || [],
  };

  const sodium = estimateSodium(recipe);
  const roundedSodium = Math.round(sodium / 5) * 5; // round to nearest 5

  // Replace the "—" with the estimated value
  content = content.replace(
    /\|\s*钠\(mg\)\s*\|\s*[—\-]\s*\|/,
    `| 钠(mg) | ${roundedSodium.toFixed(1)} |`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`${file} | ${recipe.title}: Na ~${roundedSodium} mg (method:${recipe.cookingMethod}, soy:${/生抽|老抽|酱油|味极鲜|豉油|蚝油/.test((recipe.ingredients||[]).join(' ')+(recipe.steps||[]).join(' '))}, pickled:${/酸菜|泡椒|剁椒|榨菜|雪菜|梅干菜|泡菜/.test((recipe.ingredients||[]).join(' ')+(recipe.steps||[]).join(' '))})`);
  updated++;
}

console.log(`\nUpdated: ${updated}`);
