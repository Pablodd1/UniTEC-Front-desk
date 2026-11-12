// Probe: dump the October price sheet's real structure + every CORNISA row, all columns.
import ExcelJS from 'exceljs';

const SHEET = process.argv[2] || '/mnt/c/Users/jasme/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SHEET);
console.log('worksheets:', wb.worksheets.map((w) => w.name).join(', '));
const ws = wb.worksheets[0];
console.log(`sheet "${ws.name}": rows=${ws.rowCount} cols=${ws.columnCount}\n`);

const cellStr = (c) => {
  const v = c.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.result !== undefined) return String(v.result);
  if (typeof v === 'object' && v.richText) return v.richText.map((t) => t.text).join('');
  return String(v);
};

console.log('=== header rows (1-5) ===');
for (let i = 1; i <= 5; i++) {
  const cells = [];
  ws.getRow(i).eachCell({ includeEmpty: true }, (c, cn) => cells.push(`${cn}:"${cellStr(c)}"`));
  console.log(`ROW ${i}: ${cells.join(' | ')}`);
}

console.log('\n=== distinct values per column (shows which column holds Paquete/Unidad) ===');
for (let cn = 2; cn <= 8; cn++) {
  const seen = new Map();
  ws.eachRow((row, idx) => {
    if (idx <= 5) return;
    const s = cellStr(row.getCell(cn)).trim();
    if (!s) return;
    seen.set(s, (seen.get(s) || 0) + 1);
  });
  const top = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`col ${cn}: ${top.map(([v, n]) => `${v}(${n})`).join(', ')}`);
}

console.log('\n=== every row containing CORNISA ===');
let n = 0;
ws.eachRow((row, idx) => {
  const cells = [];
  row.eachCell({ includeEmpty: false }, (c, cn) => cells.push(`${cn}:"${cellStr(c)}"`));
  if (cells.join(' ').toUpperCase().includes('CORNISA')) {
    n++;
    console.log(`#${idx}: ${cells.join(' | ')}`);
  }
});
console.log(`total CORNISA rows: ${n}`);
