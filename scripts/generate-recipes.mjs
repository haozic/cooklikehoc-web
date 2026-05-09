import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'pdf_extract', 'recipes');
const IMAGES_DIR = path.join(ROOT, 'pdf_extract', 'recipes', 'images');
const PUBLIC_IMAGES_DIR = path.join(ROOT, 'public', 'images');
const DATA_DIR = path.join(ROOT, 'src', 'data');

// Copy images to public directory
console.log('=== Copying images ===');
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
}

const imageFiles = fs.readdirSync(IMAGES_DIR);
for (const file of imageFiles) {
  const src = path.join(IMAGES_DIR, file);
  const dest = path.join(PUBLIC_IMAGES_DIR, file);
  fs.copyFileSync(src, dest);
}
console.log(`Copied ${imageFiles.length} images`);

// Parse MD files
console.log('\n=== Parsing recipes ===');
const mdFiles = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.md'));
console.log(`Found ${mdFiles.length} MD files`);

const categories = [
  { id: '炒菜', name: '炒菜', icon: '', description: '炒菜类菜品' },
  { id: '炸品', name: '炸品', icon: '🍟', description: '炸品类菜品' },
  { id: '主食', name: '主食', icon: '', description: '主食类菜品' },
  { id: '早餐', name: '早餐', icon: '🌅', description: '早餐类菜品' },
  { id: '饮品', name: '饮品', icon: '🥤', description: '饮品类菜品' }
];

function splitIngredients(text) {
  // Split by comma but keep parentheses content together
  const result = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(' || char === '（') {
      parenDepth++;
      current += char;
    } else if (char === ')' || char === '）') {
      parenDepth--;
      current += char;
    } else if ((char === ',' || char === '，') && parenDepth === 0) {
      if (current.trim()) {
        result.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    result.push(current.trim());
  }
  
  return result;
}

function parseMarkdown(content, filename) {
  const recipe = {};
  
  // Extract title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    recipe.title = titleMatch[1].trim();
  }
  
  // Extract image
  const imgMatch = content.match(/!\[.*?\]\(\.\/images\/(.+?)\)/);
  if (imgMatch) {
    recipe.image = `/images/${imgMatch[1]}`;
  }
  
  // Extract basic info
  const basicInfoMatch = content.match(/##\s*基本信息\s*\n([\s\S]*?)(?=##|$)/);
  if (basicInfoMatch) {
    const basicInfo = basicInfoMatch[1];
    
    const categoryMatch = basicInfo.match(/\|\s*分类\s*\|\s*(.+?)\s*\|/);
    if (categoryMatch) recipe.category = categoryMatch[1].trim();
    
    const flavorMatch = basicInfo.match(/\|\s*味型\s*\|\s*(.+?)\s*\|/);
    if (flavorMatch) recipe.flavorType = flavorMatch[1].trim();
    
    const periodMatch = basicInfo.match(/\|\s*最佳风味期\s*\|\s*(.+?)\s*\|/);
    if (periodMatch) recipe.bestFlavorPeriod = periodMatch[1].trim();
    
    const levelMatch = basicInfo.match(/\|\s*加工等级\s*\|\s*(.+?)\s*\|/);
    if (levelMatch) recipe.processingLevel = levelMatch[1].trim();
  }
  
  // Extract ingredients
  const ingredientsMatch = content.match(/##\s*配料\s*\n([\s\S]*?)(?=##|$)/);
  if (ingredientsMatch) {
    const ingredientsText = ingredientsMatch[1].trim();
    // Split by comma but keep parentheses content together
    recipe.ingredients = splitIngredients(ingredientsText);
  }
  
  // Extract steps
  const stepsMatch = content.match(/##\s*制作工艺\s*\n([\s\S]*?)(?=##|$)/);
  if (stepsMatch) {
    const stepsText = stepsMatch[1].trim();
    const stepLines = stepsText.split('\n').filter(line => /^\d+\./.test(line.trim()));
    recipe.steps = stepLines.map(line => line.replace(/^\d+\.\s*/, '').trim());
  }
  
  // Extract cooking method
  const methodMatch = content.match(/\|\s*烹饪方式\s*\|\s*(.+?)\s*\|/);
  if (methodMatch) {
    recipe.cookingMethod = methodMatch[1].trim();
  }
  
  // Extract ingredient sources
  const sourcesMatch = content.match(/##\s*原料来源\s*\n([\s\S]*?)(?=##|$)/);
  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1].trim();
    const sourceLines = sourcesText.split('\n').filter(line => line.startsWith('- **'));
    recipe.ingredientSources = sourceLines.map(line => {
      const match = line.match(/-\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        return {
          name: match[1].trim(),
          supplier: match[2].trim()
        };
      }
      return null;
    }).filter(Boolean);
  }
  
  // Extract ingredient processing
  const processingMatch = content.match(/##\s*原料加工\s*\n([\s\S]*?)(?=##|$)/);
  if (processingMatch) {
    const processingText = processingMatch[1].trim();
    const processingLines = processingText.split('\n').filter(line => line.startsWith('- **'));
    recipe.ingredientProcessing = processingLines.map(line => {
      const match = line.match(/-\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        return {
          name: match[1].trim(),
          process: match[2].trim()
        };
      }
      return null;
    }).filter(Boolean);
  }
  
  return recipe;
}

const allRecipes = [];

for (const file of mdFiles) {
  const content = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf-8');
  const recipe = parseMarkdown(content, file);
  
  if (recipe.title) {
    // Determine category
    if (!recipe.category) {
      // Try to infer from filename or content
      recipe.category = '炒菜'; // Default
    }
    
    recipe.id = `recipe-${allRecipes.length + 1}`;
    recipe.slug = recipe.title;
    recipe.categoryDir = recipe.category;
    
    allRecipes.push(recipe);
    console.log(`Parsed: ${recipe.title} (${recipe.category})`);
  }
}

// Generate recipes.js
const withImg = allRecipes.filter(r => r.image).length;
const noIng = allRecipes.filter(r => !r.ingredients?.length).length;
const noStep = allRecipes.filter(r => !r.steps?.length).length;

console.log(`\nTotal: ${allRecipes.length} | with images: ${withImg} | no ingredients: ${noIng} | no steps: ${noStep}`);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const outputPath = path.join(DATA_DIR, 'recipes.js');
const outputContent = `// 数据来源：老乡鸡菜品溯源报告 2.0 PDF
// 共 ${allRecipes.length} 道菜谱

export const categories = ${JSON.stringify(categories, null, 2)};

export const recipes = ${JSON.stringify(allRecipes, null, 2)};

// Helper functions
export const getCategories = () => categories;

export const getFeaturedRecipes = () => recipes.slice(0, 10);

export const getRecipesByCategory = (category) => recipes.filter(r => r.categoryDir === category);

export const getRecipeById = (id) => recipes.find(r => r.id === id);

export const searchRecipes = (query) => {
  const q = query.toLowerCase();
  return recipes.filter(r => 
    r.title.toLowerCase().includes(q) ||
    r.ingredients?.some(ing => ing.toLowerCase().includes(q)) ||
    r.category.toLowerCase().includes(q)
  );
};

export const getFlavorTypes = () => [...new Set(recipes.map(r => r.flavorType).filter(Boolean))];

export const getCookingMethods = () => [...new Set(recipes.map(r => r.cookingMethod).filter(Boolean))];

export const getProcessingLevels = () => [...new Set(recipes.map(r => r.processingLevel).filter(Boolean))];

export const filterRecipes = (filters) => {
  let result = recipes;
  if (filters.category) {
    result = result.filter(r => r.categoryDir === filters.category);
  }
  if (filters.flavorType) {
    result = result.filter(r => r.flavorType === filters.flavorType);
  }
  if (filters.cookingMethod) {
    result = result.filter(r => r.cookingMethod === filters.cookingMethod);
  }
  if (filters.processingLevel) {
    result = result.filter(r => r.processingLevel === filters.processingLevel);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(r => 
      r.title.toLowerCase().includes(q) ||
      r.ingredients?.some(ing => ing.toLowerCase().includes(q))
    );
  }
  return result;
};
`;

fs.writeFileSync(outputPath, outputContent, 'utf-8');
console.log(`\nGenerated: ${outputPath}`);
