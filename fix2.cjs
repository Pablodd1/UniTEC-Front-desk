const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'constants.ts');
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

// Remove the extra line with `? \``
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "? `- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337") {
    lines[i] = "- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337";
  }
}

// Fix the isUnitec issue in STRICT BRAND SEPARATION
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("from ${isUnitec ? 'Building Innovation' : 'Unitec USA'}.")) {
    lines[i] = lines[i].replace("from ${isUnitec ? 'Building Innovation' : 'Unitec USA'}.", "from ${brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}.");
  }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log("fixed lines");
