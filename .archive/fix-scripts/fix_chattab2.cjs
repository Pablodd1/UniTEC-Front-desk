const fs = require("fs");

let content = fs.readFileSync("components/ChatTab.tsx", "utf8");

// 1. Fix imports - add extractCustomerData and updateSessionStatus
content = content.replace(
  `import { \r\n  createConversation, \r\n  addMessage, \r\n  requestIntervention,\r\n} from '../services/conversationService';`,
  `import { \r\n  createConversation, \r\n  addMessage, \r\n  requestIntervention,\r\n  extractCustomerData,\r\n  updateSessionStatus,\r\n} from '../services/conversationService';`
);

// 2. Add unmount cleanup after the existing useEffect blocks
// Insert before the Real-time listener effect (line 59-86)
const insertBefore = `  // Real-time listener for human-takeover intervention\r\n  useEffect(() => {`;
const mountEffect = `  // Mark session completed on unmount\r\n  useEffect(() => {\r\n    return () => {\r\n      if (conversationId) {\r\n        updateSessionStatus(conversationId, 'completed').catch(() => {});\r\n      }\r\n    };\r\n  }, [conversationId]);\r\n\r\n  // Real-time listener for human-takeover intervention\r\n  useEffect(() => {`;

if (content.includes(insertBefore) && !content.includes("Mark session completed")) {
  content = content.replace(insertBefore, mountEffect);
  console.log("✅ Added unmount session cleanup");
} else {
  console.log("ℹ️  Cleanup already added or pattern not found");
}

// 3. Fix extract_customer_info handler to call extractCustomerData
const oldExtract = `              } else if (toolName === 'extract_customer_info') {\r\n                  setExtractedPii(prev => ({ ...prev, ...result }));\r\n                  if (result.intent_category) setIntentCategory(result.intent_category);\r\n              }`;
const newExtract = `              } else if (toolName === 'extract_customer_info') {\r\n                  setExtractedPii(prev => {\r\n                    const merged = { ...prev, ...result };\r\n                    // Persist PII immediately to Firestore\r\n                    if (conversationId) {\r\n                      extractCustomerData(conversationId, merged).catch((e: any) =>\r\n                        console.warn('Failed to save customer PII:', e)\r\n                      );\r\n                    }\r\n                    return merged;\r\n                  });\r\n                  if (result.intent_category) setIntentCategory(result.intent_category);\r\n              }`;

if (content.includes("setExtractedPii(prev => ({ ...prev, ...result }));")) {
  content = content.replace(oldExtract, newExtract);
  console.log("✅ Fixed extract_customer_info handler to save PII to Firestore");
} else {
  console.log("ℹ️  extract_customer_info handler pattern not matched, checking alternatives...");
  // Show nearby content
  const idx = content.indexOf("extract_customer_info");
  if (idx > -1) {
    console.log("Found at idx:", idx);
    console.log("Snippet:", JSON.stringify(content.substring(idx, idx + 300)));
  }
}

fs.writeFileSync("components/ChatTab.tsx", content);
console.log("✅ ChatTab.tsx saved");
