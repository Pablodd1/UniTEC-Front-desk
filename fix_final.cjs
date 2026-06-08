const fs = require("fs");

// Fix AdminDashboard privacy mode default (line 75)
let ad = fs.readFileSync("components/AdminDashboard.tsx", "utf8");
if (ad.includes("return stored !== 'false';")) {
  ad = ad.replace(
    "return stored !== 'false';",
    "// Default to FALSE so chats are saved by default\n    return stored === 'true';"
  );
  fs.writeFileSync("components/AdminDashboard.tsx", ad);
  console.log("✅ Fixed AdminDashboard privacy mode default");
} else {
  console.log("ℹ️  AdminDashboard privacy mode already fixed");
}

// Fix ChatTab.tsx - the extractedPii closure reference needs the current value from callback
// The issue: inside the tool callback, extractedPii may be stale (closure)
// Fix: use functional update pattern
let ct = fs.readFileSync("components/ChatTab.tsx", "utf8");
if (ct.includes("const merged = { ...extractedPii, ...result };")) {
  ct = ct.replace(
    `              } else if (toolName === 'extract_customer_info') {
                  const merged = { ...extractedPii, ...result };
                  setExtractedPii(merged);
                  if (result.intent_category) setIntentCategory(result.intent_category);
                  // Persist PII to Firestore conversation session
                  if (conversationId) {
                    extractCustomerData(conversationId, merged).catch((e: any) =>
                      console.warn('Failed to persist customer data:', e)
                    );
                  }
              }`,
    `              } else if (toolName === 'extract_customer_info') {
                  setExtractedPii((prev) => {
                    const merged = { ...prev, ...result };
                    // Persist PII to Firestore
                    if (conversationId) {
                      extractCustomerData(conversationId, merged).catch((e: any) =>
                        console.warn('Failed to persist customer data:', e)
                      );
                    }
                    return merged;
                  });
                  if (result.intent_category) setIntentCategory(result.intent_category);
              }`
  );
  fs.writeFileSync("components/ChatTab.tsx", ct);
  console.log("✅ Fixed ChatTab extractCustomerData with functional setExtractedPii");
} else {
  console.log("ℹ️  ChatTab already uses functional update or different pattern");
}
