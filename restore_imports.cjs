const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

content = content.replace("import { MessageSquare, Headphones, BarChart3 } from 'lucide-react'", 
"import { DollarSign, Mic2, Zap, Database, Rocket, TrendingUp, Activity, MessageSquare, Headphones, BarChart3 } from 'lucide-react'");

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Success");
