import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ChatTab from './components/ChatTab';
import CallTab from './components/CallTab';
import ServicesTab from './components/ServicesTab';
import InfoTab from './components/InfoTab';
import AdminDashboard from './components/AdminDashboard';
import { Tab, Language, VoiceName, VoiceProvider } from './types';
import { BUSINESS_CONFIG, QUICK_ACTIONS, SERVICES } from './constants';
import { resetChatSession } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  
  // Voice Settings
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('gemini');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  const [deepgramKey, setDeepgramKey] = useState<string>('');
  
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);

  // Reset chat session when settings change to ensure new context/language is used
  useEffect(() => {
    resetChatSession();
  }, [emergencyMode, language]);

  const handleConsultProduct = (productName: string) => {
    const msg = language === 'en' 
        ? `Tell me more about ${productName}` 
        : `Cuéntame más sobre ${productName}`;
    setInitialMessage(msg);
    setActiveTab(Tab.CHAT);
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.CHAT:
        return <ChatTab 
            quickActions={QUICK_ACTIONS} 
            emergencyMode={emergencyMode} 
            language={language}
            initialMessage={initialMessage}
        />;
      case Tab.CALL:
        return <CallTab 
            emergencyMode={emergencyMode} 
            language={language}
            voiceName={voiceName}
            voiceProvider={voiceProvider}
            deepgramKey={deepgramKey}
        />;
      case Tab.SERVICES:
        return <ServicesTab 
            services={SERVICES} 
            language={language} 
            onConsultProduct={handleConsultProduct}
        />;
      case Tab.INFO:
        return <InfoTab 
            config={BUSINESS_CONFIG} 
            language={language}
        />;
      default:
        return <ChatTab 
            quickActions={QUICK_ACTIONS} 
            emergencyMode={emergencyMode} 
            language={language}
        />;
    }
  };

  return (
    <>
        <Layout 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        config={BUSINESS_CONFIG}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        language={language}
        setLanguage={setLanguage}
        >
        {renderContent()}
        </Layout>
        
        <AdminDashboard 
            isOpen={isDashboardOpen} 
            onClose={() => setIsDashboardOpen(false)} 
            emergencyMode={emergencyMode}
            setEmergencyMode={setEmergencyMode}
            voiceName={voiceName}
            setVoiceName={setVoiceName}
            voiceProvider={voiceProvider}
            setVoiceProvider={setVoiceProvider}
            deepgramKey={deepgramKey}
            setDeepgramKey={setDeepgramKey}
        />
    </>
  );
};

export default App;