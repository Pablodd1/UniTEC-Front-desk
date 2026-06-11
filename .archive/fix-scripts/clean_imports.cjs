const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const importsToRemove = ['Activity', 'TrendingUp', 'Zap', 'Mic2', 'DollarSign', 'Rocket', 'Database'];
importsToRemove.forEach(imp => {
    // Only remove them if they are inside the lucide-react import
    // Let's just do a string replace for them inside the specific line.
    content = content.replace(new RegExp(`\\b${imp}\\b,?`, 'g'), '');
});

// clean up multiple commas
content = content.replace(/,\s*,/g, ',');
content = content.replace(/{\s*,/g, '{');

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Success");
