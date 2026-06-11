const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

content = content.replace("DollarSign, ", "");
content = content.replace("Mic2, ", "");
content = content.replace("Zap, ", "");
content = content.replace("Database, ", "");
content = content.replace("Rocket, ", "");
content = content.replace("TrendingUp, ", "");
content = content.replace("Activity", "");

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Success");
