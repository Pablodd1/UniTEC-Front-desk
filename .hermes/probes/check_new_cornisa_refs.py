#!/usr/bin/env python3
# Exact-state check for the 4 new CORNISA refs before writing anything.
import json, os, re

ROOT = '/home/jasme/UniTEC-Front-desk'
REFS = ['14032001', '14032002', '14032004', '14032014']

def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)

for f in ['products.json', 'public/products.json', 'public/catalog-specs.json']:
    try:
        d = load(f)
    except Exception as e:
        print(f"\n== {f}: could not load ({e}) ==\n"); continue
    print(f"\n== {f} ==")
    if isinstance(d, dict):
        # could be {id: {...}} or {"products": [...]}
        items = d.get('products') if isinstance(d.get('products'), list) else None
        if items is None:
            byid = {str(k): v for k, v in d.items()}
            print(f"   dict with {len(byid)} keys; sample keys: {list(byid)[:4]}")
            for r in REFS:
                print(f"   {r}: {'PRESENT' if r in byid else 'absent'}")
            continue
        d = items
    byid = {str(x.get('id')): x for x in d}
    print(f"   list with {len(d)} entries")
    for r in REFS:
        p = byid.get(r)
        if p:
            print(f"   {r}: PRESENT name={p.get('name')!r} price_cop={p.get('price_cop')!r} usd={p.get('price_usd')!r} src={p.get('price_source')!r}")
        else:
            print(f"   {r}: absent")

print("\n== public/price-map.json (what the bot can actually QUOTE) ==")
pm = load('public/price-map.json')
print(f"   {len(pm)} keys")
for r in REFS:
    print(f"   {r}: {'-> ' + json.dumps(pm[r], ensure_ascii=False) if r in pm else 'NO ENTRY (bot will say Consultar precio)'}")

print("\n== raw substring hits per file (which file matched the earlier grep) ==")
for f in ['products.json', 'public/products.json', 'public/catalog-specs.json',
          'public/price-map.json', 'public/price-catalog.json', 'scripts/build-catalog-specs.mjs']:
    path = os.path.join(ROOT, f)
    if not os.path.exists(path):
        continue
    txt = open(path, encoding='utf-8', errors='replace').read()
    hits = [r for r in REFS if r in txt]
    hdr = [t for t in ['AM1001', 'AM1014', 'CORNISA'] if t in txt]
    if hits or hdr:
        print(f"   {f}: refs={hits} markers={hdr}")

print("\n== does the October price sheet contain these CORNISA rows? ==")
SHEET = '/mnt/c/Users/jasme/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx'
print(f"   sheet: {SHEET}  exists={os.path.exists(SHEET)}")
try:
    import openpyxl
    wb = openpyxl.load_workbook(SHEET, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    found = 0
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=6, values_only=True):
        joined = ' '.join(str(c) for c in row if c is not None).upper()
        if 'CORNISA' in joined:
            found += 1
            if found <= 12:
                print(f"   CORNISA row: {[str(c)[:60] for c in row if c is not None]}")
    print(f"   total CORNISA rows in sheet: {found}")
    # also check for the ref numbers anywhere in the first 6 columns
    for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 400), max_col=2, values_only=True):
        for c in row:
            if str(c).strip() in REFS:
                print(f"   ref {c} appears in sheet")
except ImportError:
    print("   openpyxl NOT available — need another reader")
except Exception as e:
    print(f"   sheet read failed: {type(e).__name__}: {e}")
