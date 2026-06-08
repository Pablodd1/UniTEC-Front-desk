const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const targetArrayStart = content.indexOf("{/* SYSTEM / OWNER GROUP */}");
const mapStart = content.indexOf("].map((t: any) => (", targetArrayStart);

if (targetArrayStart !== -1 && mapStart !== -1) {
    const replacement = `{/* SYSTEM / OWNER GROUP */}
               {[
                 { id: 'training',        label: 'AI Training',  icon: <Brain size={13} /> },
                 { id: 'general',         label: 'Settings',     icon: <ShieldCheck size={13} /> },
                 { id: 'conversations',   label: 'Conversations',icon: <MessageSquare size={13} /> },
                 { id: 'interventions',   label: 'Interventions',icon: <Headphones size={13} /> },
                 { id: 'analytics',       label: 'Analytics',    icon: <BarChart3 size={13} /> },
               `;
    const before = content.slice(0, targetArrayStart);
    const after = content.slice(mapStart);
    fs.writeFileSync('components/AdminDashboard.tsx', before + replacement + after);
    console.log("Success");
} else {
    console.log("Not found");
}
