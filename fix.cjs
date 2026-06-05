const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'constants.ts');
let content = fs.readFileSync(file, 'utf8');

const target = `  const staffDetails = brandId === 'unitec' 
    ? \`
    ? \`- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337
- Yuldor Stiven Avendano (Ejecutivo Comercial IDEO y Marketing online) | Tel: +57 310 576 9694
- Henderson Patrick Arroyave (Ejecutivo Marketing Online) | Tel: +57 320 217 4854
- Contacto General WhatsApp / Principal: +57 314 233 2147
\`
    : \``;

const rep = `  const staffDetails = brandId === 'unitec' 
    ? \`
- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337
- Yuldor Stiven Avendano (Ejecutivo Comercial IDEO y Marketing online) | Tel: +57 310 576 9694
- Henderson Patrick Arroyave (Ejecutivo Marketing Online) | Tel: +57 320 217 4854
- Contacto General WhatsApp / Principal: +57 314 233 2147
\`
    : \``;

content = content.replace(target, rep);

// Let's also check if I accidentally added `brandName` syntax error in line 321.
// Line 321: `4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${isUnitec ? 'Building Innovation' : 'Unitec USA'}.`
// Wait, is `isUnitec` defined here?
// At line 273: `const staffDetails = brandId === 'unitec'` ... so `brandId` is available, but `isUnitec` might not be defined!
// Let's check if `isUnitec` is defined in `getSystemInstruction`...
// The signature is `export const getSystemInstruction = (language: Language = 'es', customGreeting?: string, brandId: 'unitec' | 'building' = 'building') => {`
// So `isUnitec` is NOT defined!
// Let's fix that as well.

const target2 = `4. STRICT BRAND SEPARATION: You represent ONLY ${"$"}{brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${"$"}{isUnitec ? 'Building Innovation' : 'Unitec USA'}.`;
const rep2 = `4. STRICT BRAND SEPARATION: You represent ONLY ${"$"}{brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${"$"}{brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}.`;
content = content.replace(target2, rep2);

fs.writeFileSync(file, content, 'utf8');
console.log('constants.ts fixed successfully');
