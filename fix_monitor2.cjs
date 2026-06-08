const fs = require("fs");

let content = fs.readFileSync("components/ConversationMonitor.tsx", "utf8");

// Fix: Replace the 3 specific lines (147-151) with real-time subscription
// Use exact content with Windows line endings detected
const oldBlock = `    // Load messages\r\n    getMessages(selectedSessionId).then(setMessages);\r\n    \r\n    return () => unsubscribe();\r\n  }, [selectedSessionId, lastMessageCount, messages, playSound]);`;

const newBlock = `    // Real-time message subscription (live updates without refresh)\r\n    const unsubMessages = subscribeToMessages(selectedSessionId, (msgs) => {\r\n      setMessages(msgs);\r\n    });\r\n    \r\n    return () => {\r\n      unsubscribe();\r\n      unsubMessages();\r\n    };\r\n  }, [selectedSessionId, lastMessageCount, playSound]);`;

if (content.includes("getMessages(selectedSessionId)")) {
  content = content.replace(oldBlock, newBlock);
  console.log("✅ Replaced getMessages block with real-time subscribeToMessages");
} else {
  console.log("❌ Could not find target block");
  // Show what's at that area
  const lines = content.split("\r\n");
  for (let i = 145; i <= 155; i++) {
    console.log(`Line ${i+1}: ${JSON.stringify(lines[i])}`);
  }
}

// Also check import line
const importLine = `import { ConversationSession, subscribeToConversation, subscribeToMessages, ConversationMessage, addMessage, updateSessionStatus, addConversationTag, addConversationNote } from '../services/conversationService';`;
if (!content.includes("subscribeToMessages,") && !content.includes(", subscribeToMessages")) {
  content = content.replace(
    `import { ConversationSession, subscribeToConversation, `,
    `import { ConversationSession, subscribeToConversation, subscribeToMessages, `
  );
  console.log("✅ Added subscribeToMessages to import");
} else {
  console.log("ℹ️  subscribeToMessages already in import");
}

fs.writeFileSync("components/ConversationMonitor.tsx", content);
console.log("✅ File saved");
