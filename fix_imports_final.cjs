const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const importRegex = /import\s*{([^}]+)}\s*from\s*'lucide-react'/;
content = content.replace(importRegex, (match, p1) => {
    let newImports = p1;
    const toRemove = ['Activity', 'TrendingUp', 'Zap', 'Mic2', 'DollarSign', 'Rocket', 'Database'];
    toRemove.forEach(imp => {
        newImports = newImports.replace(new RegExp(`\\b${imp}\\b`, 'g'), '');
    });
    // clean up commas
    newImports = newImports.replace(/,\s*,/g, ',').replace(/^\s*,/, '').replace(/,\s*$/, '');
    return `import { ${newImports} } from 'lucide-react'`;
});

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Success");
