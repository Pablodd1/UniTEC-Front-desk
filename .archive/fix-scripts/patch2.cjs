const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'constants.ts');
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Update QUICK_ACTIONS (lines 42-50)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{ id: \'stock\', title: \'Consultar Stock\'')) {
    lines[i] = "  { id: 'stock', title: 'Consultar Stock', message: 'Cuéntame qué producto deseas consultar si tenemos en stock.', iconName: 'Box' },";
  }
  if (lines[i].includes('{ id: \'quote\', title: \'Cotizar\'')) {
    lines[i] = "  { id: 'quote', title: 'Cotizar', message: 'Dime, ¿qué producto deseas cotizar?', iconName: 'DollarSign' },";
  }
  if (lines[i].includes('{ id: \'install\', title: \'Instalación\'')) {
    lines[i] = "  { id: 'install', title: 'Instalación', message: 'Cuéntame de qué producto deseas saber la instalación.', iconName: 'Hammer' },";
  }
  if (lines[i].includes('{ id: \'contact\', title: \'Contactar Ventas\'')) {
    lines[i] = "  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunícame con un representante de ventas.', iconName: 'BookOpen' },";
  }
  if (lines[i].includes('{ id: \'shipping\', title: \'Envíos\'')) {
    lines[i] = "  { id: 'shipping', title: 'Envíos', message: 'Me gustaría saber cuáles son las opciones de envío y tiempos de entrega.', iconName: 'Truck' },";
  }
  if (lines[i].includes('{ id: \'specs\', title: \'Ficha Técnica\'')) {
    lines[i] = "  { id: 'specs', title: 'Ficha Técnica', message: 'Necesito las especificaciones técnicas de un producto.', iconName: 'FileText' },";
  }
  if (lines[i].includes('{ id: \'returns\', title: \'Devoluciones\'')) {
    lines[i] = "  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su política de devoluciones y cambios?', iconName: 'RefreshCcw' },";
  }
  if (lines[i].includes('{ id: \'discount\', title: \'Descuento\'')) {
    lines[i] = "  { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },";
  }
}

// Update staffDetails
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Paola Andrea (Sales Support')) {
    lines[i] = "    ? `- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337";
  }
  if (lines[i].includes('Yury Marcela Moreno (Ejecutivo marketing Online)')) {
    lines[i] = "    ? `- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337";
  }
  if (lines[i].includes('Patrick Arroyave (Ejecutivo marketing Online)')) {
    lines[i] = "- Henderson Patrick Arroyave (Ejecutivo Marketing Online) | Tel: +57 320 217 4854";
  }
}

// Update getSystemInstruction
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('* For UNITEC questions, refer to')) {
    lines[i] = "   * For UNITEC questions, refer to Yury Marcela Moreno (https://wa.me/573104578337), Yuldor Stiven Avendano (https://wa.me/573105769694), or Henderson Patrick Arroyave (https://wa.me/573202174854).";
  }
  if (lines[i].includes('* For BUILDING INNOVATION questions, refer to')) {
    lines[i] = "   * For BUILDING INNOVATION questions, refer to Johana Mesa (https://wa.me/17869685783) or Alexander Gomez (https://wa.me/573113017763).";
  }
  if (lines[i].includes('3. ROUTE / CALL TO ACTION: Direct the conversation to the specific')) {
    lines[i] = "3. ROUTE / CALL TO ACTION: Direct the conversation to the specific, designated contact details. ALWAYS include direct clickable WhatsApp links exactly in this format: https://wa.me/57XXXXXXXXX";
  }
  // Add STRICT BRAND SEPARATION
  if (lines[i].includes('4. FORMATTING MANDATE:')) {
    lines.splice(i, 0, "4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${isUnitec ? 'Building Innovation' : 'Unitec USA'}.");
    lines[i+1] = lines[i+1].replace('4. FORMATTING', '5. FORMATTING');
    break; // we only want to do this once
  }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('constants.ts updated successfully by line replacement');
