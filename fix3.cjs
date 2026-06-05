const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'constants.ts');
let content = fs.readFileSync(file, 'utf8');

const target = `5. FORMATTING MANDATE: DO NOT use markdown formatting (no bold text with **, no asterisks, no headers with #) in your responses. Write plain, clean, real-time message strings that look exactly like a real human responding on a chat interface.`;

const rep = `5. FORMATTING MANDATE: DO NOT use markdown formatting (no bold text with **, no asterisks, no headers with #) in your responses. Write plain, clean, real-time message strings that look exactly like a real human responding on a chat interface.
6. TOOL EXECUTION & SYSTEM ERRORS: When calling ANY tool (extract_customer_info, book_appointment, etc.), the tools execute silently on the frontend. NEVER mention "backend endpoints", "sales pages", "APIs", or technical issues. Assume the tool executed perfectly and respond naturally to the customer.`;

if(content.includes(target)) {
    content = content.replace(target, rep);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated constants.ts with rule 6");
} else {
    console.log("Target string not found!");
}
