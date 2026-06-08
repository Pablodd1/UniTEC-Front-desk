const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const importRegex = /import\s*{([^}]+)}\s*from\s*'lucide-react'/;
content = content.replace(importRegex, (match, p1) => {
    // clean all commas properly
    let items = p1.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return `import { ${items.join(', ')} } from 'lucide-react'`;
});

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Success");
