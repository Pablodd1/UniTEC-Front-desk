const fs = require('fs');
let content = fs.readFileSync('constants.ts', 'utf8');

const targetStr = `================================================================================
RESPONSE STYLE & GUIDELINES
================================================================================`;

const newStr = `================================================================================
CHECKOUT & PRICING RULES
================================================================================
- When a user asks for a total, checkout, or shipping quote:
- ALWAYS ADD THIS DISCLAIMER: "Please note that the total is missing taxes and shipping cost to the closer port."
- You MUST NOT provide any fake shipping or Stripe/payment links, as we do not have an automated checkout.
- ALWAYS provide this contact number for checkout and final shipping calculations: +1 7866575441

` + targetStr;

content = content.replace(targetStr, newStr);

fs.writeFileSync('constants.ts', content);
console.log("Success replacing constants.ts");
