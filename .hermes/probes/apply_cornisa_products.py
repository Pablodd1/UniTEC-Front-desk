#!/usr/bin/env python3
# Fill in the 4 CORNISA PVC refs from the client's supplied line data.
# These refs already existed: 14032001 was a real record, the other 3 were stubs
# (category "NUEVOS", no specs, dimensions {}). All 4 had a wrong price from a fuzzy
# sheet match ($ 9.500 / "Unidad") - the price itself is pinned in scripts/price-overrides.json;
# this script only writes the product KNOWLEDGE (specs / colours / unit / description).
import json, os, copy

ROOT = '/home/jasme/UniTEC-Front-desk'
SRC = 'CORNISA PVC (cliente - nuevos)'

SHARED = ('Producto de la categoría cielo raso pvc, subcategoría techos, desarrollado para aplicaciones '
          'arquitectónicas y de diseño interior. Fabricado con materiales de alto desempeño que garantizan '
          'estabilidad, resistencia y durabilidad. Permite una instalación eficiente y un acabado uniforme, '
          'ideal para proyectos residenciales, comerciales y corporativos. Especificaciones técnicas: '
          'dimensiones de 30 x 595 cm, espesor de 8.5 mm.')

# first sentence + colour come verbatim from the client's rows; nothing here is inferred.
DATA = {
    '14032001': ('CORNISA PVC BLANCA BRILLANTE AM1001',    'BLANCO BRILLANTE',        'Cornisa Pvc Blanca Brillante Am1001.'),
    '14032002': ('CORNISA PVC BLANCO MADERA BRILLANTE AM1002', 'BLANCO MADERA BRILLANTE', 'Cornisa Pvc Blanco Madera Brillante Am1002.'),
    '14032004': ('CORNISA PVC BEIGE BRILLANTE AM1004',    'BEIGE BRILLANTE',         'Cornisa Pvc Beige Brillante Am1004.'),
    '14032014': ('CORNISA PVC BLANCO EJECUTIVO AM1014',   'BLANCO EJECUTIVO',        'Cornisa Pvc Blanco Ejecutivo Am1014.'),
}

DIMS = {
    'latam': {'width_cm': 30, 'length_cm': 595, 'thickness_mm': 8.5},
    'usa': {'width_in': 11.811, 'length_ft': 19.521, 'thickness_in': 0.335},
}

def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)

def save(p, data):
    with open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

report = []
for f in ['products.json', 'public/products.json']:
    data = load(f)
    byid = {str(i.get('id')): i for i in data}
    for ref, (name, color, first) in DATA.items():
        p = byid.get(ref)
        if p is None:
            print(f'  !! {ref} not found in {f} - skipping (nothing invented)')
            continue
        before = (p.get('category'), p.get('unit'), p.get('price_cop'), p.get('items_per_box'),
                  None if not p.get('catalog_colors') else p['catalog_colors'])
        p['name'] = name
        p['category'] = 'CIELO RASO PVC'
        p['subcategory'] = 'CIELO RASO PVC'
        p['collection'] = 'INTERIOR'
        p['price'] = '$ 14.999'
        p['unit'] = 'Paquete / Package'
        p['items_per_box'] = '32'
        p['price_cop'] = '$ 14.999'
        p['price_usd'] = 'Consultar precio'
        p['price_approx'] = True
        p['price_source'] = SRC
        p['dimensions'] = copy.deepcopy(DIMS)
        p['catalog_specs'] = 'Ancho: 30cm | Largo: 5.95m | Espesor: 8.5mm | Empaque: 32 unidades'
        p['catalog_colors'] = [color]
        p['catalog_use'] = 'Cielo raso y paredes interior'
        p['description'] = f'{first} {SHARED}'
        p['style_tags'] = ['CIELO RASO PVC', 'INTERIOR']
        after = (p.get('category'), p.get('unit'), p.get('price_cop'), p.get('items_per_box'), p['catalog_colors'])
        report.append((f, ref, before, after, p.get('image_url')))
    save(f, data)
    print(f'wrote {f}: {len(data)} products')

print('\n=== before -> after ===')
for f, ref, b, a, img in report:
    print(f'\n  [{f}] {ref}')
    print(f'    category : {b[0]!r}  ->  {a[0]!r}')
    print(f'    unit     : {b[1]!r}  ->  {a[1]!r}')
    print(f'    price_cop: {b[2]!r}  ->  {a[2]!r}')
    print(f'    per_box  : {b[3]!r}  ->  {a[3]!r}')
    print(f'    colors   : {b[4]!r}  ->  {a[4]!r}')
    print(f'    image_url: {img!r}  {"<-- STILL EMPTY, client must supply" if not img else ""}')
