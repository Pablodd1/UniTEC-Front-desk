const fs = require("fs");

// ============================================================
// FIX 4: ConversationMonitor.tsx
// Replace one-time getMessages() with real-time subscribeToMessages()
// ============================================================
let cmContent = fs.readFileSync("components/ConversationMonitor.tsx", "utf8");

// Update import to include subscribeToMessages
cmContent = cmContent.replace(
  `import { ConversationSession, subscribeToConversation, getMessages, ConversationMessage, addMessage, updateSessionStatus, addConversationTag, addConversationNote } from '../services/conversationService';`,
  `import { ConversationSession, subscribeToConversation, subscribeToMessages, ConversationMessage, addMessage, updateSessionStatus, addConversationTag, addConversationNote } from '../services/conversationService';`
);

// Replace getMessages() call with subscribeToMessages() inside the useEffect
// Original code:
//   // Load messages
//   getMessages(selectedSessionId).then(setMessages);
// New code uses real-time subscription
cmContent = cmContent.replace(
  `    // Load messages
    getMessages(selectedSessionId).then(setMessages);
    
    return () => unsubscribe();`,
  `    // Real-time message subscription
    const unsubMessages = subscribeToMessages(selectedSessionId, (msgs) => {
      setMessages(msgs);
    });
    
    return () => {
      unsubscribe();
      unsubMessages();
    };`
);

fs.writeFileSync("components/ConversationMonitor.tsx", cmContent);
console.log("✅ FIX 4: ConversationMonitor now uses real-time subscribeToMessages()");
