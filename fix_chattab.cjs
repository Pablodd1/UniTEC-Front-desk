const fs = require("fs");

// ============================================================
// FIX 5: ChatTab.tsx
// The ChatTab already has createConversation + addMessage wired up!
// BUT the extract_customer_info tool call doesn't call extractCustomerData()
// AND the session end doesn't call updateSessionStatus('completed')
// Let's add extractCustomerData and the cleanup on unmount
// ============================================================

let chatContent = fs.readFileSync("components/ChatTab.tsx", "utf8");

// Add extractCustomerData to imports from conversationService
chatContent = chatContent.replace(
  `import { 
  createConversation, 
  addMessage, 
  requestIntervention,
} from '../services/conversationService';`,
  `import { 
  createConversation, 
  addMessage, 
  requestIntervention,
  extractCustomerData,
  updateSessionStatus,
} from '../services/conversationService';`
);

// Fix the extract_customer_info tool handler to persist PII to Firestore
chatContent = chatContent.replace(
  `              } else if (toolName === 'extract_customer_info') {
                  setExtractedPii(prev => ({ ...prev, ...result }));
                  if (result.intent_category) setIntentCategory(result.intent_category);
              }`,
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
              }`
);

// Add cleanup on component unmount — mark session as completed
chatContent = chatContent.replace(
  `  // Real-time listener for human-takeover intervention
  useEffect(() => {`,
  `  // Mark session completed on unmount
  useEffect(() => {
    return () => {
      if (conversationId) {
        updateSessionStatus(conversationId, 'completed').catch(() => {});
      }
    };
  }, [conversationId]);

  // Real-time listener for human-takeover intervention
  useEffect(() => {`
);

fs.writeFileSync("components/ChatTab.tsx", chatContent);
console.log("✅ FIX 5: ChatTab.tsx — extractCustomerData + updateSessionStatus on unmount added");
