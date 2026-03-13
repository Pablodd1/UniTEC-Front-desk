const fs = require('fs');
const csv = fs.readFileSync('data.csv', 'utf8');

const lines = csv.split('\n');
const headers = lines[0].split(',');

const products = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Simple CSV parser that handles quotes
  const row = [];
  let inQuote = false;
  let currentVal = '';
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      row.push(currentVal);
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  row.push(currentVal);

  if (row.length < 20) continue;

  const RefCode = row[0];
  const Name = row[1];
  const Category = row[2];
  const Subcategory = row[3];
  const Collection = row[4];
  let Price = row[5].replace('$ ', '').replace('.', '');
  Price = parseFloat(Price) || 0;
  const ImageURL = row[16];
  const Description = row[19];

  products.push({
    id: RefCode,
    category: Category,
    name: Name,
    style_tags: [Subcategory, Collection].filter(Boolean),
    price_per_m2: Price,
    description: Description,
    image_url: ImageURL || "https://picsum.photos/seed/" + RefCode + "/400/300",
    pdf_tech_sheet: "",
    stock_status: "In Stock"
  });
}

fs.writeFileSync('src/products.json', JSON.stringify(products, null, 2));
console.log('Done');
