# Building Innovation & UNITEC USA - Virtual AI Front Desk 🏢🤖

An advanced, multi-tenant AI-powered front desk coordinator built for **Building Innovation** and **UNITEC USA DESIGN**. This platform provides intelligent Text Chat, Real-time Voice Calls (Gemini Live), and a comprehensive "Mission Control" CRM dashboard for administrators to monitor and refine AI interactions.

## 🏗️ Architecture: Dual-Brand & Embed Modes

This single React application powers two distinct brands and two distinct modes of operation using dynamic URL parameters and context injection.

### 1. Standalone Mode (Mission Control)
*   **URL:** `https://chatbuildinginnovation.us/`
*   **Purpose:** Headquarters for staff and administrators. 
*   **Visibility:** Full access to Chat, Voice, and the **Admin Dashboard**.
*   **Authentication:** Secured by email/password and PIN (`1234`).

### 2. Embed Mode (Website Widget)
*   **URL:** `https://chatbuildinginnovation.us/?embed=true&brandId=building`
*   **Purpose:** Customer-facing chat widget injected into company websites.
*   **Visibility:** Restricted to **Chat** and **Voice** tabs only. The Admin tab is hidden to prevent unauthorized access.
*   **Integration:** Injected via lightweight `<script>` tags (`building-chatbot.js` and `unitec-chatbot.js`).

---

## ✨ Comprehensive Feature Breakdown

### 💬 Intelligent Chat & Voice Assistant
*   **Context-Aware Text Chat:** Trained on specific product catalogs (WPC Panels, SPC Flooring, etc.) based on the active brand.
*   **Real-time Voice (Gemini Live):** Low-latency voice interaction via the Web Audio API (PCM streaming), capable of handling interruptions.
*   **Multi-Language Support:** English and Spanish toggles.

### 🎛️ Mission Control Dashboard (Admin Only)
The centralized hub for staff to oversee the AI, split into *Daily Use* (CRM) and *System* operations:

1.  **Universal Agent Inbox (CRM):** 
    *   Monitors all active and past chat sessions across both brands.
    *   Human staff can intervene and take over chats dynamically.
2.  **Retraining & Analytics:** 
    *   Automatically generates conversation summaries and extracts Q&A pairs for performance review.
3.  **Billing & Token Usage:** 
    *   Tracks exact AI token consumption and calculates estimated operational costs/profit.
4.  **Voice Settings:** 
    *   Test and select AI voices (Kore, Aoede, Zephyr, Puck, Fenrir, Charon).
5.  **Catalog Management:** 
    *   Browse and manage the product database used by the AI.
6.  **Deploy Hub:** 
    *   Provides copy-paste widget installation scripts for external websites.

---

## 🛠️ Developer Instructions: How It Works

### Tech Stack
*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **AI Engine:** Google GenAI SDK (`@google/genai`)
*   **Audio Streaming:** Native Web Audio API

### 1. Brand Context (`BrandContext.js` & `App.tsx`)
The application determines which brand to display based on the `brandId` URL parameter (`?brandId=building` or `?brandId=unitec`). 
*   This triggers `BrandContext` to inject dynamic CSS variables for colors (e.g., green for Building Innovation, blue for UNITEC).
*   It updates Meta tags, titles, and Favicons on the fly.
*   It routes to the correct system instructions in `constants.ts`.

### 2. Local Setup & Installation

1.  **Clone & Install Dependencies**:
    ```bash
    git clone https://github.com/Pablodd1/UniTEC-Front-desk.git
    cd UniTEC-Front-desk
    npm install
    ```

2.  **Configure Environment Variables**:
    Create a `.env` file in the root directory:
    ```env
    VITE_API_KEY=your_google_gemini_api_key
    ```
    *Note: The Gemini API Key is absolutely critical for chat and voice streaming functionality.*

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

### 3. Modifying the Widget Scripts
The widget embed scripts are located in `/public`:
*   `building-chatbot.js`
*   `unitec-chatbot.js`

If you change the deployment domain, you must update the `iframe.src` inside these files. Currently, they point to `https://chatbuildinginnovation.us/`.

### 4. Admin Authentication
*   **Login Email:** `admin@unitecdesign.com`
*   **Password:** `UnitecAdmin2026!`
*   **Backup PIN:** `1234`
