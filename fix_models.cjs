const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'services', 'geminiService.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/gemini-3-flash-preview/g, 'gemini-2.5-flash');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed gemini-3-flash-preview to gemini-2.5-flash");
