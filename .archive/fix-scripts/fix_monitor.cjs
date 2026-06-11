const fs = require("fs");

// ============================================================
// FIX: ConversationMonitor.tsx
// Replace getMessages() one-time fetch with subscribeToMessages() real-time listener
// ============================================================
let content = fs.readFileSync("components/ConversationMonitor.tsx", "utf8");

// First check if getMessages is still there
if (content.includes("getMessages(selectedSessionId).then(setMessages)")) {
  content = content.replace(
    `    // Load messages\n    getMessages(selectedSessionId).then(setMessages);\n    \n    return () => unsubscribe();\n  }, [selectedSessionId, lastMessageCount, messages, playSound]);`,
    `    // Real-time message subscription\n    const unsubMessages = subscribeToMessages(selectedSessionId, (msgs) => {\n      setMessages(msgs);\n    });\n    \n    return () => {\n      unsubscribe();\n      unsubMessages();\n    };\n  }, [selectedSessionId, lastMessageCount, playSound]);`
  );
  console.log("✅ Replaced getMessages with subscribeToMessages");
} else {
  console.log("ℹ️  getMessages already replaced or different content found");
}

// Also remove the `getMessages` from imports if present
if (content.includes("getMessages,") || content.includes(", getMessages")) {
  content = content.replace(", getMessages", "");
  content = content.replace("getMessages,", "");
  console.log("✅ Removed getMessages from import");
}

fs.writeFileSync("components/ConversationMonitor.tsx", content);
console.log("✅ ConversationMonitor.tsx saved successfully");
