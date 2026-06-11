const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Fix the mangled imports by replacing consecutive commas and dangling commas
content = content.replace(/import\s*{([^}]+)}\s*from\s*'lucide-react'/g, (match, p1) => {
    let cleaned = p1.replace(/,\s*,/g, ',')
                    .replace(/^\s*,\s*/, '')
                    .replace(/,\s*$/, '');
    return `import { ${cleaned} } from 'lucide-react'`;
});

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Success");
