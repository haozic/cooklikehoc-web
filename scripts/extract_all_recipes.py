"""
从老乡鸡菜品溯源报告 2.0 PDF 提取第二章菜品信息，每个菜品一个 MD 文件。
V3 - 逐页处理，正确提取多行菜名，处理多页菜品。
"""
import fitz
import re
import json
import os
import shutil

PDF_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), '老乡鸡菜品溯源报告 2.0.pdf')
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'recipes_md')
IMAGES_DIR = os.path.join(OUTPUT_DIR, 'images')
PUBLIC_IMAGES = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'images')

# All recipe pages in Chapter 2
RECIPE_PAGES = [
    37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,
    66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,
    93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,
    109,111,112,113,115,117,118,119,120,121,122,123,124,125,126,127,
    129,130,131,132,133,134,135,136,
    137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,
    157,
    158,159,160,161,162,163,164,165,166,
    167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,
    186,
    187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,
    215,216,217
]

# Pages that might need merging with next (continuation pages without 基本信息)
# These are pages like 108, 110 where recipe data continues from previous page
CONTINUATION_PAGES = set()

PAGE_SECTION = {}
for p in range(37, 66): PAGE_SECTION[p] = ('炒菜', '生鲜现做', '餐厅现做')
for p in range(66, 93): PAGE_SECTION[p] = ('炒菜', '生切现做', '餐厅现做')
for p in range(93, 128): PAGE_SECTION[p] = ('炒菜', '生调现做', '餐厅现做')
for p in range(129, 137): PAGE_SECTION[p] = ('炒菜', '中央厨房半预制', '半预制')
for p in range(137, 157): PAGE_SECTION[p] = ('炒菜', '外采半预制', '半预制')
for p in [157]: PAGE_SECTION[p] = ('炒菜', '复热预制', '复热预制')
for p in range(158, 167): PAGE_SECTION[p] = ('炸品', '炸品', '/')
for p in range(167, 187): PAGE_SECTION[p] = ('主食', '主食', '/')
for p in range(187, 215): PAGE_SECTION[p] = ('早餐', '早餐', '/')
for p in range(215, 218): PAGE_SECTION[p] = ('饮品', '饮品', '/')


def extract_name_from_text(text):
    """Extract dish name handling multi-line names like '西红柿炒\\\\n鸡蛋'"""
    lines = text.strip().split('\n')
    
    found_basic = False
    name_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Skip page numbers like "- 35 -"
        if re.match(r'^-\s*\d+\s*-$', line):
            continue
        
        if line == '基本信息':
            found_basic = True
            continue
        
        if found_basic:
            # Known field markers that end the name
            if line in ('味型', '最佳风味期', '加工等级', '配料', '营养成分',
                       '原料来源', '原料信息', '原料加工', '原料配送',
                       '配送方式', '配送周期', '餐厅', '操作工艺', '烹饪方式', '制作工艺'):
                break
            name_lines.append(line)
    
    if name_lines:
        return ''.join(name_lines)
    return None


def split_ingredients(text):
    """Split ingredient text into list, handling parentheses"""
    text = text.replace('\n', '，').replace('\r', '')
    text = re.sub(r'\s+', '', text)
    
    result = []
    current = ''
    depth = 0
    for char in text:
        if char in '（(':
            depth += 1
            current += char
        elif char in '）)':
            depth -= 1
            current += char
        elif char in '，,、' and depth == 0:
            if current.strip():
                result.append(current.strip())
            current = ''
        else:
            current += char
    if current.strip():
        result.append(current.strip())
    return result


def parse_nutrition(text):
    """Extract nutrition values from text"""
    numbers = re.findall(r'(\d+\.?\d*)', text)
    labels = ['热量(Kcal)', '蛋白质(g)', '脂肪(g)', '碳水化合物(g)', '钠(mg)']
    result = {}
    for i, label in enumerate(labels):
        if i < len(numbers):
            try:
                result[label] = float(numbers[i])
            except:
                result[label] = numbers[i]
    return result


def parse_sources(text):
    """Parse ingredient source blocks from text"""
    lines = [l.strip() for l in text.strip().split('\n') if l.strip()]
    sources = []
    i = 0
    while i < len(lines):
        name_parts = [lines[i]]
        suppliers = []
        j = i + 1
        while j < len(lines):
            line = lines[j]
            # Supplier indicators
            if any(kw in line for kw in ['公司', '产地', '自制', '中央厨房', '有限', '科技', '食品', '养殖']):
                suppliers.append(line)
                j += 1
                continue
            # Part of multi-line ingredient name (short, no supplier keywords)
            elif len(line) <= 8 and j - i == 1 and not suppliers:
                name_parts.append(line)
                j += 1
                continue
            else:
                break
        name = ''.join(name_parts)
        if len(name) > 1:
            sources.append({'name': name, 'suppliers': suppliers})
        i = j
    return sources


def parse_processing(text):
    """Parse ingredient processing blocks"""
    lines = [l.strip() for l in text.strip().split('\n') if l.strip()]
    processing = []
    i = 0
    while i < len(lines):
        name_parts = [lines[i]]
        process_lines = []
        j = i + 1
        while j < len(lines):
            line = lines[j]
            proc_keywords = ['清洗', '分切', '切配', '挑选', '腌制', '制作', '熬制',
                           '调配', '杀菌', '灌装', '卤制', '烧制', '生产', '包装',
                           '滚揉', '上浆', '裹粉', '预炸', '速冻', '打蛋', '调味',
                           '泡发', '冷却', '预煮', '切片', '杀青', '漂烫', '过油',
                           '炖烧', '餐厅', '供应商', '中央厨房', '屠宰',
                           '炼制', '炒制', '煮制', '搅拌', '混合', '浸泡', '揉搓',
                           '挑拣、', '清洗、', '分切、', '切配、', '新鲜毛菜',
                           '现场', '自建', '自有', '送货']
            if any(kw in line for kw in proc_keywords):
                process_lines.append(line)
                j += 1
                continue
            elif len(line) <= 8 and j - i == 1 and not process_lines:
                name_parts.append(line)
                j += 1
                continue
            else:
                break
        name = ''.join(name_parts)
        if name and process_lines:
            processing.append({'name': name, 'process': '; '.join(process_lines)})
        i = j
    return processing


def parse_delivery(text):
    """Parse delivery info"""
    delivery = {}
    m = re.search(r'配送方式\s*(.+?)(?:\n|$)', text)
    if m: delivery['method'] = m.group(1).strip()
    m = re.search(r'配送周期\s*(.+?)(?:\n|$)', text)
    if m: delivery['cycle'] = m.group(1).strip()
    return delivery


def clean_step_text(text):
    """Clean up step text without losing measurement numbers"""
    # Remove page artifacts but preserve content
    text = re.sub(r'\s+', '', text)
    # Remove leading/trailing punctuation artifacts
    text = text.strip('，、；。')
    return text

def parse_steps(text):
    """
    Parse numbered cooking steps using line-aware parsing.
    Only treats numbers at the START of a line as step delimiters,
    avoiding the bug where measurement numbers (e.g. '蒸4分钟') get split.
    """
    lines = text.strip().split('\n')
    
    steps = []
    current_step_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if this line starts a new step
        # A step delimiter is: number followed by . 、 ) ） or space, at line start
        match = re.match(r'^(\d+)[\.\、)）]\s*(.+)', line)
        if match:
            # Save previous step
            if current_step_lines:
                step_text = ''.join(current_step_lines)
                step_text = clean_step_text(step_text)
                if step_text and len(step_text) > 3:
                    steps.append(step_text)
            # Start new step
            current_step_lines = [match.group(2)]
        else:
            # Continuation of current step
            if current_step_lines:
                current_step_lines.append(line)
            else:
                # First line without explicit numbering
                current_step_lines = [line]
    
    # Save last step
    if current_step_lines:
        step_text = ''.join(current_step_lines)
        step_text = clean_step_text(step_text)
        if step_text and len(step_text) > 3:
            steps.append(step_text)
    
    return steps


def extract_recipe_from_page(doc, page_num):
    """
    Extract a single recipe from one or more PDF pages.
    For multi-page recipes (like 鱼香肉丝盖饭 on p107-108),
    merge text from continuation pages.
    """
    # Get main text
    page = doc[page_num - 1]
    text = page.get_text()
    
    # Check if this is a recipe page
    if '基本信息' not in text:
        return None
    
    # Extract name
    name = extract_name_from_text(text)
    if not name or len(name) < 2:
        return None
    
    # Try to merge with next page(s) if recipe continues
    # A recipe is multi-page if it doesn't have 制作工艺 on current page
    has_steps = '制作工艺' in text or '操作工艺' in text
    
    if not has_steps:
        # Check next page for continuation
        next_pn = page_num + 1
        # Handle page gaps
        if next_pn in RECIPE_PAGES or next_pn + 1 in RECIPE_PAGES:
            # Try to find which next page has the steps
            for check_pn in [next_pn, next_pn + 1, next_pn + 2]:
                if check_pn > 217:
                    break
                try:
                    next_page = doc[check_pn - 1]
                    next_text = next_page.get_text()
                    if ('制作工艺' in next_text or '操作工艺' in next_text) and '基本信息' not in next_text:
                        # This is a continuation page - merge texts
                        text = text + '\n' + next_text
                        has_steps = True
                        break
                except:
                    pass
    
    if not has_steps:
        return None
    
    # === Parse all sections from combined text ===
    
    # Helper: find section between two markers
    def get_section(text, start_marker, end_markers):
        idx = text.find(start_marker)
        if idx < 0:
            return ''
        content = text[idx + len(start_marker):]
        earliest = len(content)
        for em in end_markers:
            ei = content.find(em)
            if ei >= 0 and ei < earliest:
                earliest = ei
        section = content[:earliest].strip() if earliest < len(content) else content.strip()
        return section
    
    all_field_markers = [
        '基本信息', '味型', '最佳风味期', '加工等级', '配料',
        '营养成分', '原料来源', '原料信息', '原料加工',
        '原料配送', '配送方式', '配送周期',
        '餐厅', '操作工艺', '烹饪方式', '制作工艺',
        '老乡鸡菜品溯源报告'
    ]
    
    # Extract each field
    flavor_text = get_section(text, '\n味型\n', all_field_markers)
    flavor = flavor_text.strip().split('\n')[0] if flavor_text else '/'
    
    period_text = get_section(text, '\n最佳风味期\n', all_field_markers)
    period = period_text.strip().split('\n')[0] if period_text else '/'
    
    level_text = get_section(text, '\n加工等级\n', all_field_markers)
    level = level_text.strip().split('\n')[0] if level_text else '/'
    
    method_text = get_section(text, '\n烹饪方式\n', all_field_markers)
    method = method_text.strip().split('\n')[0] if method_text else '/'
    
    # Ingredients
    ingr_text = get_section(text, '\n配料\n', all_field_markers)
    ingredients = split_ingredients(ingr_text) if ingr_text else []
    
    # Nutrition
    nutr_text = get_section(text, '\n营养成分\n', all_field_markers)
    nutrition = parse_nutrition(nutr_text) if nutr_text else {}
    
    # Sources
    src_text = get_section(text, '\n原料来源\n', all_field_markers)
    if not src_text:
        src_text = get_section(text, '\n原料信息\n', all_field_markers)
    sources = parse_sources(src_text) if src_text else []
    
    # Processing
    proc_text = get_section(text, '\n原料加工\n', all_field_markers)
    processing = parse_processing(proc_text) if proc_text else []
    
    # Delivery
    deliv_text = get_section(text, '\n原料配送\n', all_field_markers)
    delivery = parse_delivery(deliv_text) if deliv_text else {}
    
    # Steps
    steps_text = get_section(text, '\n制作工艺\n', all_field_markers)
    steps = parse_steps(steps_text) if steps_text else []
    
    # Category
    cat_info = PAGE_SECTION.get(page_num, ('炒菜', '生鲜现做', '餐厅现做'))
    
    return {
        'page': page_num,
        'title': name,
        'category': cat_info[0],
        'subcategory': cat_info[1],
        'flavor_type': flavor if flavor != '/' else '/',
        'best_flavor_period': period if period != '/' else '/',
        'processing_level': level if level != '/' else cat_info[2],
        'cooking_method': method if method != '/' else '/',
        'ingredients': ingredients,
        'nutrition': nutrition,
        'ingredient_sources': sources,
        'ingredient_processing': processing,
        'delivery': delivery,
        'steps': steps,
    }


def extract_images(doc, page_num, recipe_name):
    """Extract images from a PDF page"""
    page = doc[page_num - 1]
    images = []
    
    for img in page.get_images(full=True):
        xref = img[0]
        base = doc.extract_image(xref)
        if len(base["image"]) < 5000:
            continue
        
        safe = recipe_name.replace('/', '_').replace('\\', '_').replace(':', '_').replace('?', '').replace('*', '')
        fname = f"{page_num:03d}_{safe}.{base['ext']}"
        fpath = os.path.join(IMAGES_DIR, fname)
        
        with open(fpath, 'wb') as f:
            f.write(base["image"])
        
        images.append(fname)
    
    return images


def generate_md(recipe, images):
    """Generate markdown content"""
    lines = []
    lines.append(f"# {recipe['title']}")
    lines.append("")
    lines.append("## 基本信息")
    lines.append("")
    lines.append("| 项目 | 内容 |")
    lines.append("|------|------|")
    lines.append(f"| 分类 | {recipe['category']} |")
    lines.append(f"| 子分类 | {recipe['subcategory']} |")
    lines.append(f"| 味型 | {recipe['flavor_type']} |")
    lines.append(f"| 最佳风味期 | {recipe['best_flavor_period']} |")
    lines.append(f"| 加工等级 | {recipe['processing_level']} |")
    lines.append(f"| 烹饪方式 | {recipe['cooking_method']} |")
    lines.append(f"| PDF 页码 | 第 {recipe['page']} 页 |")
    lines.append("")
    
    if images:
        for img in images:
            lines.append(f"![{recipe['title']}](./images/{img})")
            lines.append("")
    
    if recipe['ingredients']:
        lines.append("## 配料")
        lines.append("")
        for ing in recipe['ingredients']:
            lines.append(f"- {ing}")
        lines.append("")
    
    if recipe['nutrition']:
        lines.append("## 营养成分（每 100g）")
        lines.append("")
        lines.append("| 项目 | 含量 |")
        lines.append("|------|------|")
        for key, val in recipe['nutrition'].items():
            lines.append(f"| {key} | {val} |")
        lines.append("")
    
    if recipe['steps']:
        lines.append("## 制作工艺")
        lines.append("")
        for i, step in enumerate(recipe['steps'], 1):
            lines.append(f"{i}. {step}")
        lines.append("")
    
    if recipe['ingredient_sources']:
        lines.append("## 原料来源")
        lines.append("")
        for src in recipe['ingredient_sources']:
            lines.append(f"- **{src['name']}**")
            for supplier in src['suppliers']:
                lines.append(f"  - {supplier}")
        lines.append("")
    
    if recipe['ingredient_processing']:
        lines.append("## 原料加工")
        lines.append("")
        for proc in recipe['ingredient_processing']:
            lines.append(f"- **{proc['name']}**：{proc['process']}")
        lines.append("")
    
    if recipe['delivery']:
        lines.append("## 原料配送")
        lines.append("")
        lines.append(f"- 配送方式：{recipe['delivery'].get('method', '/')}")
        lines.append(f"- 配送周期：{recipe['delivery'].get('cycle', '/')}")
        lines.append("")
    
    return '\n'.join(lines)


def main():
    print(f"Opening PDF: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)
    
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(PUBLIC_IMAGES, exist_ok=True)
    
    all_recipes = []
    processed = set()
    
    for page_num in RECIPE_PAGES:
        if page_num in processed:
            continue
        
        recipe = extract_recipe_from_page(doc, page_num)
        
        if recipe is None:
            continue
        
        processed.add(page_num)
        
        # Extract images
        images = extract_images(doc, page_num, recipe['title'])
        
        if images:
            src = os.path.join(IMAGES_DIR, images[0])
            dst = os.path.join(PUBLIC_IMAGES, images[0])
            if os.path.exists(src):
                shutil.copy2(src, dst)
            recipe['image'] = f"/images/{images[0]}"
        else:
            recipe['image'] = None
        
        # Generate MD
        md = generate_md(recipe, images)
        
        safe = recipe['title'].replace('/', '_').replace('\\', '_').replace(':', '_').replace('?', '').replace('*', '')
        fname = f"{len(all_recipes)+1:03d}_{safe}.md"
        
        with open(os.path.join(OUTPUT_DIR, fname), 'w', encoding='utf-8') as f:
            f.write(md)
        
        all_recipes.append(recipe)
        print(f"  [{len(all_recipes)}] {recipe['title']} ({recipe['category']} | {recipe['cooking_method']} | {len(recipe['steps'])} steps)")
    
    doc.close()
    
    # Save metadata
    meta_path = os.path.join(OUTPUT_DIR, '_recipes_metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(all_recipes, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Done: {len(all_recipes)} recipes")
    
    cats = {}
    for r in all_recipes:
        cats[r['category']] = cats.get(r['category'], 0) + 1
    for cat, count in sorted(cats.items()):
        print(f"  {cat}: {count}")


if __name__ == '__main__':
    main()
