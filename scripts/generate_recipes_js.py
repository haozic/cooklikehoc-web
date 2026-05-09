"""
从 recipes_md/_recipes_metadata.json 生成 src/data/recipes.js
"""
import json
import os
import re

METADATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'recipes_md', '_recipes_metadata.json')
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'data', 'recipes.js')
PUBLIC_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'images')

def fix_ingredient_name(name):
    """Fix known PDF extraction artifacts in ingredient names"""
    # Remove extra commas inserted by PDF line breaks
    name = name.replace('（非，转基因）', '（非转基因）')
    name = name.replace('（,非转基因）', '（非转基因）')
    name = name.replace('，,', '，')
    name = name.replace(',，', '，')
    name = name.replace('、，', '、')
    name = name.replace('，、', '、')
    # Fix spacing in parentheses
    name = re.sub(r'（\s+', '（', name)
    name = re.sub(r'\s+）', '）', name)
    # Remove stray line breaks
    name = name.replace('\n', '')
    name = name.replace('\r', '')
    return name.strip()

def fix_step_text(text):
    """Clean up step text"""
    text = text.replace('\n', '').replace('\r', '').strip()
    # Fix common number+unit spacing issues
    text = re.sub(r'(?<=[^\d])(\d+)\s+分钟', r'\1分钟', text)
    text = re.sub(r'(?<=[^\d])(\d+)\s+小时', r'\1小时', text)
    text = re.sub(r'(?<=[^\d])(\d+)\s+克', r'\1克', text)
    text = re.sub(r'(?<=[^\d])(\d+)\s+g\b', r'\1g', text)
    text = re.sub(r'(?<=[^\d])(\d+)\s+cm', r'\1cm', text)
    text = re.sub(r'焖\s*(\d+)', r'焖\1', text)
    text = re.sub(r'蒸\s*(\d+)', r'蒸\1', text)
    text = re.sub(r'(\d+)\s*\.\s*(\d+)(cm|g|kg)', r'\1.\2\3', text)
    return text.strip()

def fix_supplier_name(name):
    """Fix supplier name merge issues"""
    name = name.replace('\n', '').replace('\r', '').strip()
    name = re.sub(r'有限公司(?=[^\s，。])', '有限公司，', name)
    return name

def is_fragment(text):
    """Check if text is just a continuation fragment, not a full step"""
    text = text.strip()
    if not text or len(text) <= 3:
        return True
    # Just measurement/continuation
    if re.match(r'^(分钟|小时|克|g|kg|cm|mm|焖|毫升|斤|两|个|块|份|颗|条|根|片|段)\d*', text):
        return True
    # Bare number + unit (e.g. "4厘米" "0cm")
    if re.match(r'^\d+\s*(分钟|小时|克|g|kg|cm|mm|毫升|斤|两|个|块|份|颗|条|根|片|段|%)', text):
        return True
    # Just a bare number (e.g. "4" or "0")
    if re.match(r'^\d+$', text):
        return True
    return False

def merge_split_steps(steps):
    """Merge steps that were split by PDF layout."""
    if not steps:
        return steps
    
    # First, merge adjacent fragments
    merged = []
    for step in steps:
        step = step.replace('\n', '').replace('\r', '').strip()
        if not step:
            continue
        
        if merged and is_fragment(step):
            merged[-1] = merged[-1] + step
            continue
        
        if merged:
            prev = merged[-1]
            # If previous doesn't end properly and current looks like continuation
            if not re.search(r'[；。；]$', prev) and not re.match(r'^[\u4e00-\u9fff]*(下入|加入|取|调制|放|将|把|使用|出品|装|盛|淋|炒|烧|煮|蒸|炸|炖|卤|拌)', step):
                if len(step) < 20 or is_fragment(step[:3]):
                    merged[-1] = prev + step
                    continue
        
        merged.append(step)
    
    # Post-process: fix common issues in merged steps
    fixed = []
    for step in merged:
        step = fix_step_text(step)
        if len(step) >= 10:
            fixed.append(step)
    
    return fixed

def main():
    with open(METADATA_PATH, 'r', encoding='utf-8') as f:
        recipes = json.load(f)
    
    print(f"Processing {len(recipes)} recipes...")
    
    # Verify images exist in public/images/
    os.makedirs(PUBLIC_IMAGES_DIR, exist_ok=True)
    missing_images = 0
    for recipe in recipes:
        if recipe.get('image'):
            img_filename = os.path.basename(recipe['image'])
            dst_path = os.path.join(PUBLIC_IMAGES_DIR, img_filename)
            if not os.path.exists(dst_path):
                print(f"  WARNING: Missing image {img_filename} for {recipe['title']}")
                missing_images += 1
    
    if missing_images:
        print(f"WARNING: {missing_images} images missing from public/images/")
    else:
        print("All recipe images present in public/images/")
    
    # Generate recipes array
    lines = []
    lines.append("// 数据来源：老乡鸡菜品溯源报告 2.0 PDF")
    lines.append(f"// 共 {len(recipes)} 道菜谱")
    lines.append(f"// 自动生成于：{__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append("")
    
    # Categories
    categories = [
        {"id": "炒菜", "name": "炒菜", "icon": "🍳", "description": "炒菜类菜品"},
        {"id": "炸品", "name": "炸品", "icon": "🍟", "description": "炸品类菜品"},
        {"id": "主食", "name": "主食", "icon": "🍚", "description": "主食类菜品"},
        {"id": "早餐", "name": "早餐", "icon": "🥐", "description": "早餐类菜品"},
        {"id": "饮品", "name": "饮品", "icon": "🥤", "description": "饮品类菜品"},
    ]
    
    lines.append("export const categories = " + json.dumps(categories, ensure_ascii=False, indent=2) + ";")
    lines.append("")
    lines.append("export const recipes = [")
    
    for i, recipe in enumerate(recipes):
        # Fix steps
        fixed_steps = merge_split_steps(recipe.get('steps', []))
        
        # Fix ingredients
        fixed_ingredients = [fix_ingredient_name(ing) for ing in recipe.get('ingredients', [])]
        # Remove empty/trash entries
        fixed_ingredients = [ing for ing in fixed_ingredients if ing and len(ing) > 0 and ing not in ('/', '-', '。')]
        
        # Fix ingredient sources
        fixed_sources = []
        for src in recipe.get('ingredient_sources', []):
            name = fix_ingredient_name(src.get('name', ''))
            suppliers = src.get('suppliers', [])
            # Clean supplier names
            clean_suppliers = [fix_supplier_name(s) for s in suppliers if s.strip()]
            supplier_str = '；'.join(clean_suppliers) if clean_suppliers else '/'
            if name:
                fixed_sources.append({"name": name, "supplier": supplier_str})
        
        # Fix ingredient processing
        fixed_processing = []
        for proc in recipe.get('ingredient_processing', []):
            name = fix_ingredient_name(proc.get('name', ''))
            process = proc.get('process', '').replace('\n', '；')
            if name and process:
                fixed_processing.append({"name": name, "process": process})
        
        # Build recipe object
        entry = {
            "id": f"recipe-{i+1}",
            "slug": recipe['title'],
            "title": recipe['title'],
            "category": recipe['category'],
            "categoryDir": recipe['category'],
            "subcategory": recipe.get('subcategory', '/'),
            "flavorType": recipe.get('flavor_type', '/'),
            "cookingMethod": recipe.get('cooking_method', '/'),
            "processingLevel": recipe.get('processing_level', '/'),
            "bestFlavorPeriod": recipe.get('best_flavor_period', '/'),
            "image": recipe.get('image'),
            "ingredients": fixed_ingredients,
            "nutrition": recipe.get('nutrition', {}),
            "steps": fixed_steps,
            "ingredientSources": fixed_sources,
            "ingredientProcessing": fixed_processing,
            "delivery": recipe.get('delivery', {}),
            "pdfPage": recipe.get('page', '/'),
        }
        
        # Filter out empty optional fields
        if not entry['nutrition']:
            del entry['nutrition']
        if not entry['delivery']:
            del entry['delivery']
        if not entry['ingredientSources']:
            del entry['ingredientSources']
        if not entry['ingredientProcessing']:
            del entry['ingredientProcessing']
        
        lines.append("  " + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n  ') + ",")
    
    lines.append("];")
    lines.append("")
    
    # Append helper functions
    lines.append("export function getCategories() {")
    lines.append("  return categories.map(cat => ({")
    lines.append("    ...cat,")
    lines.append("    count: recipes.filter(r => r.categoryDir === cat.id).length,")
    lines.append("  }));")
    lines.append("}")
    lines.append("")
    lines.append("export function getFeaturedRecipes() {")
    lines.append("  return recipes.filter(r => r.categoryDir === '炒菜' && r.steps && r.steps.length > 0).slice(0, 8);")
    lines.append("}")
    lines.append("")
    lines.append("export function getRecipesByCategory(categoryDir) {")
    lines.append("  return recipes.filter(r => r.categoryDir === categoryDir);")
    lines.append("}")
    lines.append("")
    lines.append("export function getRecipeById(id) {")
    lines.append("  return recipes.find(r => r.id === id || r.slug === decodeURIComponent(id) || r.title === decodeURIComponent(id));")
    lines.append("}")
    lines.append("")
    lines.append("export function searchRecipes(query) {")
    lines.append("  const q = query.toLowerCase();")
    lines.append("  return recipes.filter(r =>")
    lines.append("    r.title.toLowerCase().includes(q) ||")
    lines.append("    (r.flavorType && r.flavorType.toLowerCase().includes(q)) ||")
    lines.append("    (r.cookingMethod && r.cookingMethod.toLowerCase().includes(q)) ||")
    lines.append("    r.ingredients.some(i => i.toLowerCase().includes(q))")
    lines.append("  );")
    lines.append("}")
    lines.append("")
    lines.append("export function getFlavorTypes() {")
    lines.append("  const map = {};")
    lines.append("  for (const r of recipes) {")
    lines.append("    if (r.flavorType && r.flavorType !== '/') {")
    lines.append("      map[r.flavorType] = (map[r.flavorType] || 0) + 1;")
    lines.append("    }")
    lines.append("  }")
    lines.append("  return Object.entries(map)")
    lines.append("    .map(([name, count]) => ({ name, count }))")
    lines.append("    .sort((a, b) => b.count - a.count);")
    lines.append("}")
    lines.append("")
    lines.append("export function getCookingMethods() {")
    lines.append("  const map = {};")
    lines.append("  for (const r of recipes) {")
    lines.append("    if (r.cookingMethod && r.cookingMethod !== '/') {")
    lines.append("      map[r.cookingMethod] = (map[r.cookingMethod] || 0) + 1;")
    lines.append("    }")
    lines.append("  }")
    lines.append("  return Object.entries(map)")
    lines.append("    .map(([name, count]) => ({ name, count }))")
    lines.append("    .sort((a, b) => b.count - a.count);")
    lines.append("}")
    lines.append("")
    lines.append("export function getProcessingLevels() {")
    lines.append("  const map = {};")
    lines.append("  for (const r of recipes) {")
    lines.append("    if (r.processingLevel && r.processingLevel !== '/') {")
    lines.append("      map[r.processingLevel] = (map[r.processingLevel] || 0) + 1;")
    lines.append("    }")
    lines.append("  }")
    lines.append("  return Object.entries(map)")
    lines.append("    .map(([name, count]) => ({ name, count }))")
    lines.append("    .sort((a, b) => b.count - a.count);")
    lines.append("}")
    lines.append("")
    lines.append("export function filterRecipes({ category, flavorType, cookingMethod, processingLevel, query }) {")
    lines.append("  let result = recipes;")
    lines.append("  if (category && category !== 'all') {")
    lines.append("    result = result.filter(r => r.categoryDir === category);")
    lines.append("  }")
    lines.append("  if (flavorType) {")
    lines.append("    result = result.filter(r => r.flavorType === flavorType);")
    lines.append("  }")
    lines.append("  if (cookingMethod) {")
    lines.append("    result = result.filter(r => r.cookingMethod === cookingMethod);")
    lines.append("  }")
    lines.append("  if (processingLevel) {")
    lines.append("    result = result.filter(r => r.processingLevel === processingLevel);")
    lines.append("  }")
    lines.append("  if (query) {")
    lines.append("    const q = query.toLowerCase();")
    lines.append("    result = result.filter(r =>")
    lines.append("      r.title.toLowerCase().includes(q) ||")
    lines.append("      (r.flavorType && r.flavorType.toLowerCase().includes(q)) ||")
    lines.append("      (r.cookingMethod && r.cookingMethod.toLowerCase().includes(q)) ||")
    lines.append("      r.ingredients.some(i => i.toLowerCase().includes(q))")
    lines.append("    );")
    lines.append("  }")
    lines.append("  return result;")
    lines.append("}")
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"\nGenerated: {OUTPUT_PATH}")
    
    # Stats
    cat_counts = {}
    for r in recipes:
        cat = r['category']
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    
    img_count = sum(1 for r in recipes if r.get('image'))
    step_count = sum(1 for r in recipes if r.get('steps'))
    
    print(f"\nStatistics:")
    for cat, count in sorted(cat_counts.items()):
        print(f"  {cat}: {count}")
    print(f"  Images: {img_count}/{len(recipes)}")
    print(f"  With steps: {step_count}/{len(recipes)}")

if __name__ == '__main__':
    main()
