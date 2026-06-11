const fs = require('fs');

const files = ['unitec-chatbot.js', 'building-chatbot.js'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/https:\/\/uni-tec-front-desk\.vercel\.app/g, 'https://chat.building-innovation.us');
  fs.writeFileSync(file, content);
}
console.log("Updated both chatbot scripts.");
