#!/usr/bin/env python3
# Exact diff of the rebuilt price map against the previous one.
import json, os

ROOT = '/home/jasme/UniTEC-Front-desk'
BEFORE = '/home/jasme/.hermes/cache/scratch/unitec/price-map.before.json'
after = json.load(open(os.path.join(ROOT, 'public/price-map.json'), encoding='utf-8'))
before = json.load(open(BEFORE, encoding='utf-8'))
products = json.load(open(os.path.join(ROOT, 'products.json'), encoding='utf-8'))
byname = {str(p['id']): p.get('name', '?') for p in products}
REFS = ['14032001', '14032002', '14032004', '14032014']

print(f'entries before={len(before)}  after={len(after)}')
print(f'added ids : {sorted(set(after) - set(before)) or "none"}')
print(f'removed ids: {sorted(set(before) - set(after)) or "none"}')

price_changed, unit_changed, other = [], [], []
for pid in sorted(set(before) & set(after)):
    b, a = before[pid], after[pid]
    if b.get('price_cop') != a.get('price_cop'):
        price_changed.append(pid)
    if b.get('unit') != a.get('unit'):
        unit_changed.append(pid)
    keys = set(b) | set(a)
    if any(b.get(k) != a.get(k) for k in keys if k not in ('price_cop', 'unit')):
        other.append(pid)

print(f'\nPRICE changes: {len(price_changed)}')
for pid in price_changed:
    print(f"  {pid} {byname.get(pid)[:44]:44} {before[pid]['price_cop']:>10} -> {after[pid]['price_cop']:>10}  ({before[pid].get('unit')} -> {after[pid].get('unit')})")
print(f'\nUNIT changes: {len(unit_changed)}')
from collections import Counter
c = Counter(f"{before[p].get('unit')} -> {after[p].get('unit')}" for p in unit_changed)
for k, n in c.most_common():
    print(f'  {k}: {n}')
print(f'\nOTHER field changes (only price/unit were meant to move): {len(other)}')
for pid in other[:12]:
    diff = {k: (before[pid].get(k), after[pid].get(k)) for k in set(before[pid]) | set(after[pid]) if before[pid].get(k) != after[pid].get(k) and k not in ('price_cop', 'unit')}
    print(f'  {pid}: {diff}')

print('\n=== the 4 CORNISA refs now ===')
for r in REFS:
    e = after.get(r)
    print(f'  {r}  {json.dumps(e, ensure_ascii=False) if e else "MISSING"}')

print('\n=== sanity: any entry still bound to the generic CORNISA row? ===')
left = [p for p, e in after.items() if 'CORNISA PVC' == str(e.get('row_name', '')).strip()]
print(' ', left or 'none - all 4 now pinned')
