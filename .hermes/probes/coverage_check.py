#!/usr/bin/env python3
"""Check specific keys + overall price coverage after rebuild."""
import json

base = '/home/jasme/UniTEC-Front-desk'
new = json.load(open(f'{base}/public/price-map.json'))
old = json.load(open(f'{base}/.hermes/probes/price-map.before.json'))
prod = json.load(open(f'{base}/products.json'))
ids = {str(p.get('id')) for p in prod}

for k in ['14121214', '14121216', '14122906', '14121509', '14124901', '14124209']:
    e = new.get(k)
    print(f"{k}: old={k in old} new={k in new} in_products={k in ids} | " + (e['price_cop'] + ' · ' + e['row_name'] if e else 'NO ENTRY'))

missing = sorted(i for i in ids if i not in new)
print(f"\nproducts without price entry: {len(missing)} of {len(ids)}")
print('sample missing:', missing[:15])
