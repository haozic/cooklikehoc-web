import fitz  # PyMuPDF
import os
import re
import json

pdf_path = '老乡鸡菜品溯源报告 2.0.pdf'
output_dir = 'pdf_extract/recipes'
images_dir = os.path.join(output_dir, 'images')
os.makedirs(output_dir, exist_ok=True)
os.makedirs(images_dir, exist_ok=True)

doc = fitz.open(pdf_path)

# All recipe pages found
recipe_pages = [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 109, 111, 112, 113, 115, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217]

# Category ranges based on PDF structure
# 正餐菜品 (炒菜): pages 37-156
# 炸品: pages 158-166
# 主食: pages 167-186
# 早餐: pages 187-212
# 饮品: pages 213-217

def get_category(page_num):
    """Determine category based on page number"""
    if page_num <= 156:
        return '炒菜'
    elif page_num <= 166:
        return '炸品'
    elif page_num <= 186:
        return '主食'
    elif page_num <= 212:
        return '早餐'
    else:
        return '饮品'

def parse_recipe_text(text, page_num):
    """Parse recipe text from a page"""
    recipe = {}
    recipe['category'] = get_category(page_num)
    
    # Extract dish name - it's usually after "基本信息"
    name_match = re.search(r'基本信息\s*\n\s*(.+?)(?:\n|$)', text)
    if name_match:
        recipe['name'] = name_match.group(1).strip().replace('\n', '')
    
    # Extract flavor type
    flavor_match = re.search(r'味型\s*\n\s*(.+?)(?:\n|$)', text)
    if flavor_match:
        recipe['flavorType'] = flavor_match.group(1).strip()
    
    # Extract best flavor period
    period_match = re.search(r'最佳风味期\s*\n\s*(.+?)(?:\n|$)', text)
    if period_match:
        recipe['bestFlavorPeriod'] = period_match.group(1).strip()
    
    # Extract processing level
    level_match = re.search(r'加工等级\s*\n\s*(.+?)(?:\n|$)', text)
    if level_match:
        recipe['processingLevel'] = level_match.group(1).strip()
    
    # Extract nutrition info
    nutrition = {}
    nutrition_match = re.search(r'营养成分\s*/100g\s*热量/千卡\s*（Kcal）\s*蛋白质/克（g）\s*脂肪/克（g）\s*碳水化合物/\s*克（g）\s*钠/毫克（mg）\s*(\d+)\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*(\d+)', text, re.DOTALL)
    if nutrition_match:
        nutrition = {
            '热量': f"{nutrition_match.group(1)} Kcal",
            '蛋白质': f"{nutrition_match.group(2)} g",
            '脂肪': f"{nutrition_match.group(3)} g",
            '碳水化合物': f"{nutrition_match.group(4)} g",
            '钠': f"{nutrition_match.group(5)} mg"
        }
    recipe['nutrition'] = nutrition
    
    # Extract ingredients
    ingredients_match = re.search(r'配料\s*\n\s*(.+?)(?:\n\s*营养成分|\n\s*原料来源|\n\s*原料加工|\n\s*原料配送|\n\s*餐厅|\n\s*操作工艺|\n\s*烹饪方式|\n\s*制作工艺)', text, re.DOTALL)
    if ingredients_match:
        ingredients_text = ingredients_match.group(1).strip()
        # Clean up the ingredients text
        ingredients_text = re.sub(r'\s+', '', ingredients_text)
        recipe['ingredients'] = [ing.strip() for ing in ingredients_text.split('、') if ing.strip()]
    
    # Extract ingredient sources
    sources = {}
    sources_match = re.search(r'原料来源\s*\n(.+?)(?:\n\s*原料加工|\n\s*原料配送|\n\s*餐厅|\n\s*操作工艺|\n\s*烹饪方式|\n\s*制作工艺)', text, re.DOTALL)
    if sources_match:
        sources_text = sources_match.group(1).strip()
        # Parse ingredient sources
        lines = [line.strip() for line in sources_text.split('\n') if line.strip()]
        current_ingredient = None
        for line in lines:
            # Check if this is an ingredient name (short line, no company info)
            if len(line) < 20 and not any(keyword in line for keyword in ['有限公司', '分公司', '产地', '自制']):
                current_ingredient = line
                sources[current_ingredient] = []
            elif current_ingredient:
                sources[current_ingredient].append(line)
        
        # Convert single-item lists to strings
        for key in sources:
            if len(sources[key]) == 1:
                sources[key] = sources[key][0]
    
    recipe['ingredientSources'] = sources
    
    # Extract ingredient processing
    processing = {}
    processing_match = re.search(r'原料加工\s*\n(.+?)(?:\n\s*原料配送|\n\s*餐厅|\n\s*操作工艺|\n\s*烹饪方式|\n\s*制作工艺)', text, re.DOTALL)
    if processing_match:
        processing_text = processing_match.group(1).strip()
        lines = [line.strip() for line in processing_text.split('\n') if line.strip()]
        current_ingredient = None
        for line in lines:
            if len(line) < 15 and not any(keyword in line for keyword in ['配送', '现场', '清洗', '切配', '炼制', '自制']):
                current_ingredient = line
                processing[current_ingredient] = ''
            elif current_ingredient:
                processing[current_ingredient] += line + ' '
        
        # Clean up processing descriptions
        for key in processing:
            processing[key] = processing[key].strip()
    
    recipe['ingredientProcessing'] = processing
    
    # Extract delivery info
    delivery = {}
    delivery_match = re.search(r'原料配送\s*\n(.+?)(?:\n\s*餐厅|\n\s*操作工艺|\n\s*烹饪方式|\n\s*制作工艺)', text, re.DOTALL)
    if delivery_match:
        delivery_text = delivery_match.group(1).strip()
        # Extract delivery method
        method_match = re.search(r'配送方式\s*\n\s*(.+?)(?:\n|$)', delivery_text)
        if method_match:
            delivery['配送方式'] = method_match.group(1).strip()
        
        # Extract delivery cycle
        cycle_match = re.search(r'配送周期\s*\n\s*(.+?)(?:\n\s*餐厅|\n\s*操作工艺|\n\s*烹饪方式|\n\s*制作工艺|$)', delivery_text, re.DOTALL)
        if cycle_match:
            delivery['配送周期'] = cycle_match.group(1).strip().replace('\n', ' / ')
    
    recipe['delivery'] = delivery
    
    # Extract cooking method
    method_match = re.search(r'烹饪方式\s*\n\s*(.+?)(?:\n|$)', text)
    if method_match:
        recipe['cookingMethod'] = method_match.group(1).strip()
    
    # Extract cooking steps
    steps = []
    steps_match = re.search(r'制作工艺\s*（\d+\s*份）\s*\n(.+?)(?:\n\s*老乡鸡|\n\s*第\s*\d+\s*章|\n\s*-\s*\d+\s*-|$)', text, re.DOTALL)
    if steps_match:
        steps_text = steps_match.group(1).strip()
        # Split by step numbers
        step_pattern = re.compile(r'(\d+)\.\s*(.+?)(?=\d+\.\s|$)', re.DOTALL)
        for match in step_pattern.finditer(steps_text):
            step_num = match.group(1)
            step_text = match.group(2).strip()
            # Clean up step text
            step_text = re.sub(r'\s+', ' ', step_text)
            steps.append(step_text)
    
    recipe['cookingSteps'] = steps
    
    return recipe

def generate_md(recipe, page_num):
    """Generate markdown content for a recipe"""
    md_content = f"""# {recipe.get('name', '未知菜品')}

"""
    
    # Add image if exists
    image_filename = f"page{page_num}_img1.jpeg"
    if os.path.exists(os.path.join(images_dir, image_filename)):
        md_content += f"![{recipe.get('name', '菜品图片')}](./images/{image_filename})\n\n"
    
    # Basic info
    md_content += """## 基本信息

| 项目 | 内容 |
|------|------|
"""
    if recipe.get('category'):
        md_content += f"| 分类 | {recipe['category']} |\n"
    if recipe.get('flavorType'):
        md_content += f"| 味型 | {recipe['flavorType']} |\n"
    if recipe.get('bestFlavorPeriod'):
        md_content += f"| 最佳风味期 | {recipe['bestFlavorPeriod']} |\n"
    if recipe.get('processingLevel'):
        md_content += f"| 加工等级 | {recipe['processingLevel']} |\n"
    
    # Nutrition
    if recipe.get('nutrition'):
        md_content += """
## 营养成分（每100g）

| 热量 | 蛋白质 | 脂肪 | 碳水化合物 | 钠 |
|------|--------|------|------------|-----|
"""
        nutrition = recipe['nutrition']
        md_content += f"| {nutrition.get('热量', '-')} | {nutrition.get('蛋白质', '-')} | {nutrition.get('脂肪', '-')} | {nutrition.get('碳水化合物', '-')} | {nutrition.get('钠', '-')} |\n"
    
    # Ingredients
    if recipe.get('ingredients'):
        md_content += f"""
## 配料

{', '.join(recipe['ingredients'])}
"""
    
    # Ingredient sources
    if recipe.get('ingredientSources'):
        md_content += """
## 原料来源

"""
        for ingredient, source in recipe['ingredientSources'].items():
            if isinstance(source, list):
                md_content += f"- **{ingredient}**: {'、'.join(source)}\n"
            else:
                md_content += f"- **{ingredient}**: {source}\n"
    
    # Ingredient processing
    if recipe.get('ingredientProcessing'):
        md_content += """
## 原料加工

"""
        for ingredient, process in recipe['ingredientProcessing'].items():
            if process:
                md_content += f"- **{ingredient}**: {process}\n"
    
    # Delivery
    if recipe.get('delivery'):
        md_content += """
## 原料配送

| 项目 | 内容 |
|------|------|
"""
        delivery = recipe['delivery']
        if delivery.get('配送方式'):
            md_content += f"| 配送方式 | {delivery['配送方式']} |\n"
        if delivery.get('配送周期'):
            md_content += f"| 配送周期 | {delivery['配送周期']} |\n"
    
    # Cooking method
    if recipe.get('cookingMethod'):
        md_content += f"""
## 餐厅操作工艺

| 项目 | 内容 |
|------|------|
| 烹饪方式 | {recipe['cookingMethod']} |
"""
    
    # Cooking steps
    if recipe.get('cookingSteps'):
        md_content += f"""
## 制作工艺

"""
        for i, step in enumerate(recipe['cookingSteps'], 1):
            md_content += f"{i}. {step}\n"
    
    return md_content

# Process all recipes
all_recipes = []
for page_num in recipe_pages:
    page_idx = page_num - 1  # Convert to 0-indexed
    page = doc[page_idx]
    text = page.get_text()
    
    # Parse recipe
    recipe = parse_recipe_text(text, page_num)
    
    if recipe.get('name'):
        # Extract images
        images = page.get_images(full=True)
        for img_index, img in enumerate(images):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            filename = f"page{page_num}_img{img_index+1}.{image_ext}"
            filepath = os.path.join(images_dir, filename)
            
            with open(filepath, "wb") as f:
                f.write(image_bytes)
        
        # Generate MD file
        md_content = generate_md(recipe, page_num)
        
        # Clean filename
        safe_name = re.sub(r'[^\w\s-]', '', recipe['name']).strip()
        filename = f"{safe_name}.md"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        all_recipes.append(recipe)
        print(f'Processed: {recipe["name"]} ({recipe["category"]}) - Page {page_num}')

# Save all recipes as JSON for programmatic use
json_path = os.path.join(output_dir, 'all_recipes.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(all_recipes, f, ensure_ascii=False, indent=2)

print(f'\nTotal recipes processed: {len(all_recipes)}')
print(f'Files saved to: {output_dir}')
