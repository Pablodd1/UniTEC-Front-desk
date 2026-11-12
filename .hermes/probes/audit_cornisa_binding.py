#!/usr/bin/env python3
# Blast radius: every product bound to the generic "CORNISA PVC" row,
# plus the exact current record for the 4 new refs.
import json, os

ROOT = '/home/jasme/UniTEC-Front-desk'
def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)

products = load('products.json')
byid = {str(p['id']): p for p in products}
pm = load('public/price-map.json')
REFS = ['14032001', '14032002', '14032004', '14032014']

print('=== every price-map entry matched to a generic CORNISA row ===')
n = 0
for pid, e in pm.items():
    if 'CORNISA' in str(e.get('row_name', '')).upper():
        n += 1
        print(f"  {pid}  {byid.get(pid, {}).get('name', '?'):48} row={e.get('row_name')!r} {e.get('price_cop')} / {e.get('unit')}")
print(f'  total bound to a CORNISA row: {n}')

print('\n=== the 4 refs, full current records ===')
for r in REFS:
    p = byid.get(r)
    if not p:
        print(f'  {r}: MISSING from products.json'); continue
    print(f"\n  --- {r} ---")
    for k in ['name', 'category', 'subcategory', 'collection', 'price', 'unit', 'items_per_box',
              'price_cop', 'price_usd', 'price_approx', 'price_source', 'catalog_specs',
              'catalog_colors', 'catalog_use', 'image_url', 'stock_status']:
        print(f"    {k}: {p.get(k)!r}")
    print(f"    dimensions: {p.get('dimensions')}")
    print(f"    description: {str(p.get('description'))[:130]!r}")

print('\n=== how many products overall have a non-Unidad unit in products.json? ===')
from collections import Counter
c = Counter(str(p.get('unit')) for p in products)
for u, k in c.most_common(8):
    print(f'  {u!r}: {k}')
print('\n=== units present in price-map.json (all hardcoded?) ===')
print(' ', Counter(str(e.get('unit')) for e in pm.values()).most_common(5))
