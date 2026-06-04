# UniTEC AI Chatbot - Website Integration Guide

## Quick Setup (2 minutes)

Add this single line to your website's `<head>` or before `</body>`:

```html
<script src="https://unitec-front-desk.vercel.app/embed-script.js" async></script>
```

That's it! The chatbot will appear automatically.

---

## Manual Integration (More Control)

### Step 1: Add the container

Add this HTML anywhere in your page:

```html
<!-- For unitecusadesign.com -->
<iframe 
  src="https://unitec-front-desk.vercel.app/?embed=true&brandId=unitec&lang=es"
  width="480"
  height="700"
  style="border: none; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);"
  allow="microphone"
  title="AI Chatbot"
></iframe>

<!-- For building-innovation.us -->
<iframe 
  src="https://unitec-front-desk.vercel.app/?embed=true&brandId=building&lang=es"
  width="480"
  height="700"
  style="border: none; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);"
  allow="microphone"
  title="AI Chatbot"
></iframe>
```

### Step 2: Make it a floating widget (recommended)

Add this CSS:

```css
#chatbot-widget {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 480px;
  height: 700px;
  z-index: 9999;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  display: none; /* Hidden by default, show with button */
}

#chatbot-widget iframe {
  width: 100%;
  height: 100%;
  border: none;
}

#chatbot-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  padding: 16px 24px;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(14, 165, 233, 0.4);
}
```

Add this JavaScript:

```javascript
const widget = document.getElementById('chatbot-widget');
const button = document.getElementById('chatbot-button');
let isOpen = false;

button.addEventListener('click', () => {
  isOpen = !isOpen;
  widget.style.display = isOpen ? 'block' : 'none';
  button.style.display = isOpen ? 'none' : 'block';
});
```

---

## Important: Privacy Compliance

✅ **Chat data is NOT saved** - All conversations are ephemeral (privacy mode enabled)
✅ **No user tracking** - No cookies, no analytics, no data collection
✅ **GDPR/CCPA compliant** - No personal data stored

---

## Language Support

- **Default:** Spanish (for Colombia market)
- **Secondary:** English (automatically detected if user writes in English)
- **Switch:** Users can switch languages in the chat interface

---

## Features Available

1. **Chat** - Text-based AI assistant
2. **Voice Call** - AI voice conversation (click "Call" tab)
3. **Quick Actions** - Stock check, quotes, installation info, etc.
4. **Product Catalog** - Browse all 291 products
5. **Admin Dashboard** - Full desktop management (login required)

---

## Direct Access (Full Page)

Visit the app directly for full-screen experience:
- **UNITEC:** https://unitec-front-desk.vercel.app/?brandId=unitec
- **Building Innovation:** https://unitec-front-desk.vercel.app/?brandId=building

---

## Support

For technical support or customization:
- WhatsApp: +1 (786) 968-5783
- Email: Jasmel@medicalbillingmb.com

---

**Last Updated:** June 4, 2026
**Version:** 2.0 (Privacy Mode + Spanish Default)
