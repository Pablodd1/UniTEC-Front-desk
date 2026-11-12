#!/usr/bin/env python3
"""Diff price-map + price-catalog before/after rebuild."""
import json

base = '/home/jasme/UniTEC-Front-desk'
old = json.load(open(f'{base}/.hermes/probes/price-map.before.json'))
new = json.load(open(f'{base}/public/price-map.json'))
print('price-map: old', len(old), '-> new', len(new))
added = sorted(set(new) - set(old))
removed = sorted(set(old) - set(new))
print('added (%d):' % len(added), added[:25])
print('removed (%d):' % len(removed), removed[:25])
print('kit 14122904 in new:', '14122904' in new, '|', new.get('14122904'))
print('legacy 14122895 in new:', '14122895' in new)
# spot check: entries that exist in both but changed price/name
changed = [k for k in (set(new) & set(old)) if new[k] != old[k]]
print('existing keys with changed values (%d):' % len(changed), changed[:15])

oldc = json.load(open(f'{base}/.hermes/probes/price-catalog.before.json'))
newc = json.load(open(f'{base}/public/price-catalog.json'))
print('\nprice-catalog: old', len(oldc), '-> new', len(newc))
print('catalog added:', sorted(set(newc) - set(oldc))[:10])
print('catalog removed:', sorted(set(oldc) - set(newc))[:10])
