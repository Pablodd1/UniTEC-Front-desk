const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const importRegex = /import\s*{([^}]+)}\s*from\s*'lucide-react'/;
content = content.replace(importRegex, (match, p1) => {
    return `import { Phone, ShieldCheck, Database, Mic2, Save, RefreshCw, Check, Loader2, Volume2, TrendingUp, Zap, Gauge, Building2, Store, Brain, Code, Copy, ExternalLink, Rocket, ToggleRight, ToggleLeft, DollarSign, MessageSquare, Activity, Headphones, BarChart3 } from 'lucide-react'`;
});

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Imports restored");
