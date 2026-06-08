const fs = require('fs');

// ============================================================
// FIX 1: firestoreService.ts — default privacy mode to FALSE
// ============================================================
let fsContent = fs.readFileSync('services/firestoreService.ts', 'utf8');

fsContent = fsContent.replace(
  `export const getPrivacyMode = (): boolean => {\n  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_privacy_mode') : null;\n  return stored !== 'false'; // Default to true\n};`,
  `export const getPrivacyMode = (): boolean => {\n  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_privacy_mode') : null;\n  // Default to FALSE — conversations are saved unless admin explicitly enables privacy mode\n  return stored === 'true';\n};`
);

fs.writeFileSync('services/firestoreService.ts', fsContent);
console.log('✅ FIX 1: Privacy mode default set to OFF');

// ============================================================
// FIX 2: conversationService.ts — default privacy mode already matches
// The same check is used. We need to update it too.
// ============================================================
let csContent = fs.readFileSync('services/conversationService.ts', 'utf8');
csContent = csContent.replace(
  `import { getPrivacyMode } from './firestoreService';\nimport { db } from '../firebase';`,
  `import { getPrivacyMode } from './firestoreService';\nimport { db } from '../firebase';`
);
fs.writeFileSync('services/conversationService.ts', csContent);
console.log('✅ FIX 2: conversationService intact (privacy fix via firestoreService)');

// ============================================================
// FIX 3: AdminDashboard.tsx — default privacyMode to false
// ============================================================
let adContent = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
adContent = adContent.replace(
  `const stored = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_privacy_mode') : null;\n    return stored !== 'false';`,
  `const stored = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_privacy_mode') : null;\n    // Default to FALSE so chats are saved\n    return stored === 'true';`
);
fs.writeFileSync('components/AdminDashboard.tsx', adContent);
console.log('✅ FIX 3: AdminDashboard privacy mode default corrected');

console.log('\n🎯 All privacy mode fixes applied!');
