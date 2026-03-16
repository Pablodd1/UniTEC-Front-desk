
# UNITEC Design Recepcionista

**UNITEC Design Recepcionista** is an AI-powered front desk coordinator designed for **UNITEC USA DESIGN**, a wholesale distributor of construction materials. The application provides a seamless experience for customers to inquire about products, check stock, and book appointments via both Text Chat and Real-time Voice Calls.

## 🚀 Key Features

*   **🎙️ AI Voice Assistant (Gemini Live)**: Real-time, low-latency voice interaction capable of handling interruptions and complex queries.
*   **💬 Intelligent Chat**: Text-based assistant with context awareness of the entire product catalog (WPC Panels, SPC Flooring, etc.).
*   **📊 Audio Visualizer**: Real-time frequency analysis visualization during voice calls.
*   **🛠️ Tools & CRM Integration**:
    *   **Appointment Booking**: Simulates booking appointments with email confirmation.
    *   **CRM Logging**: Automatically categorizes and logs conversation summaries and sentiment.
*   **🔐 Admin Dashboard**: A PIN-protected (Default: `1234`) master control panel to view CRM logs and toggle "Emergency Mode".
*   **📦 Dynamic Product Catalog**: Visual display of services and products with direct links to chat inquiries.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **AI SDK**: Google GenAI SDK (`@google/genai`)
*   **Icons**: Lucide React
*   **Audio**: Web Audio API (Native implementation for PCM streaming)

## 📦 Deployment to GitHub

To push this code to the repository **Pablodd1/UniTEC-Front-desk**, follow these steps:

1.  **Initialize Git**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```

2.  **Add Remote Origin**:
    ```bash
    git remote add origin https://github.com/Pablodd1/UniTEC-Front-desk.git
    # If it says 'remote origin already exists', run:
    # git remote set-url origin https://github.com/Pablodd1/UniTEC-Front-desk.git
    ```

3.  **Push Code**:
    ```bash
    git branch -M main
    git push -u origin main
    ```

## ⚙️ Prerequisites & Setup

### 1. API Key Requirements
This project requires external APIs to function fully.

**A. Google Gemini API Key (Required)**
*   Powers the core AI chat and real-time voice interactions.
*   Get your key from [Google AI Studio](https://aistudio.google.com/).
*   **Crucial**: The `VITE_API_KEY` must be available in your environment variables.

**B. ElevenLabs API Key (Optional, but recommended for custom voices)**
*   Powers the custom voice cloning and high-quality Text-to-Speech (TTS) features in the Admin Dashboard.
*   Get your key from [ElevenLabs](https://elevenlabs.io/).
*   Can be set in the `.env` file as `VITE_ELEVENLABS_API_KEY` or configured directly within the app's Admin Dashboard.

### 2. Local Development (Vite)

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Create a `.env` file in the root directory:
    ```env
    VITE_API_KEY=your_actual_google_api_key_here
    VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
    ```

3.  **Run the App**:
    ```bash
    npm run dev
    ```

## 📂 Project Structure

*   `App.tsx`: Main entry point and state manager (Dashboard visibility, Routing).
*   `services/geminiService.ts`: Core service handling Google GenAI Chat and Live API connections.
*   `components/CallTab.tsx`: The Voice interface with the Audio Visualizer.
*   `components/ChatTab.tsx`: Text chat interface.
*   `components/AdminDashboard.tsx`: Secure panel for CRM logs and System Status.
*   `constants.ts`: Business logic, Product Data, System Instructions, and Tool Definitions.
*   `utils/audioUtils.ts`: Low-level audio encoding/decoding for the Live API PCM stream.

## 🔒 Security Notes

*   **Admin PIN**: The default PIN for the dashboard is `1234`.
*   **API Key**: Never commit your `.env` file to public repositories.

---
**UNITEC USA DESIGN** - *Direct Importer & Wholesale Distributor*
