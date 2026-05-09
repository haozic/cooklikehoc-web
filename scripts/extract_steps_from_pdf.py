import fitz, re, json, os

pdf_path = 'e:/cursor/cooklikehoc-web/老乡鸡菜品溯源报告 2.0.pdf'
doc = fitz.open(pdf_path)

# All recipe pages
recipe_pages = [37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,109,111,112,113,115,117,118,119,120,121,122,123,124,125,126,127,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217]

# Build name -> page mapping
name_to_page = {}
for pn in recipe_pages:
    page = doc[pn - 1]
    text = page.get_text()
    name_match = re.search(r'基本信息\s*\n\s*(.+?)(?:\n|$)', text)
    if name_match:
        name = name_match.group(1).strip()
        if name not in name_to_page:
            name_to_page[name] = pn

print(f"Built name→page mapping for {len(name_to_page)} recipes")

# Try multiple patterns to extract cooking steps from PDF text
def extract_steps(text):
    # Pattern 1: 制作工艺（N 份） followed by numbered steps
    patterns = [
        r'制作工艺\s*（?\d+\s*份）?\s*\n+(.+)',
        r'操作工艺\s*（?\d+\s*份）?\s*\n+(.+)',
        r'制作工艺\s*\n+(.+)',
        r'操作工艺\s*\n+(.+)',
        r'餐厅操作\s*\n+(.+)',
    ]
    
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            raw = m.group(1).strip()
            # Cut at next section heading or end of recipe
            cut = re.search(r'\n\s*(?:老乡鸡|第\s*\d+\s*章|原料来源|原料加工|原料配送|营养成分|-\s*\d+\s*-|$)', raw)
            if cut:
                raw = raw[:cut.start()]
            
            # Extract numbered steps
            step_pattern = re.compile(r'(\d+)[\.\、\)）]\s*(.+?)(?=\d+[\.\、\)）]\s|$)', re.DOTALL)
            steps = []
            for sm in step_pattern.finditer(raw):
                step_text = sm.group(2).strip()
                step_text = re.sub(r'\s+', ' ', step_text)
                if len(step_text) > 3:
                    steps.append(step_text)
            
            if steps:
                return steps
            
            # Try semicolons
            parts = [s.strip() for s in raw.replace('；', ';').split(';') if s.strip() and len(s.strip()) > 3]
            if parts:
                return parts
            
            # Return raw as single step
            if len(raw) > 5:
                return [raw.strip()]
    
    return None

# Get list of recipe names that need steps (from Node)
import subprocess
result = subprocess.run(
    ['node', '-e', 'const{recipes}=require("./src/data/recipes.js");console.log(JSON.stringify(recipes.filter(r=>!r.steps||r.steps.length===0).map(r=>r.title)))'],
    capture_output=True, text=True, cwd='e:/cursor/cooklikehoc-web'
)
missing_names = json.loads(result.stdout.strip())
print(f"\n{len(missing_names)} recipes need steps from PDF")

# Try to extract steps
results = {}
not_found = []

for name in missing_names:
    pn = name_to_page.get(name)
    if not pn:
        print(f"  NOT FOUND in PDF: {name}")
        not_found.append(name)
        continue
    
    page = doc[pn - 1]
    text = page.get_text()
    
    steps = extract_steps(text)
    
    if steps:
        results[name] = steps
        print(f"  OK  page {pn}: {name} => {len(steps)} steps")
    else:
        # Show raw text near the end for debugging
        lines = text.split('\n')
        tail = [l.strip() for l in lines[-15:] if l.strip()]
        print(f"  EMPTY  page {pn}: {name}")
        print(f"         tail: {' | '.join(tail)}")
        not_found.append(name)

print(f"\nFound steps: {len(results)} / {len(missing_names)}")
print(f"Still missing: {len(not_found)}")
if not_found:
    for n in not_found:
        print(f"  - {n}")

# Save results
with open('e:/cursor/cooklikehoc-web/scripts/pdf_steps.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

doc.close()
