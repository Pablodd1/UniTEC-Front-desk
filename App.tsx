import React, { useState } from 'react';
import Layout from './components/Layout';
import ChatTab from './components/ChatTab';
import CallTab from './components/CallTab';
import ServicesTab from './components/ServicesTab';
import InfoTab from './components/InfoTab';
import AdminDashboard from './components/AdminDashboard';
import { Tab } from './types';
import { BUSINESS_CONFIG, QUICK_ACTIONS, SERVICES } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.CHAT:
        return <ChatTab quickActions={QUICK_ACTIONS} emergencyMode={emergencyMode} />;
      case Tab.CALL:
        return <CallTab emergencyMode={emergencyMode} />;
      case Tab.SERVICES:
        return <ServicesTab services={SERVICES} />;
      case Tab.INFO:
        return <InfoTab config={BUSINESS_CONFIG} />;
      default:
        return <ChatTab quickActions={QUICK_ACTIONS} emergencyMode={emergencyMode} />;
    }
  };

  return (
    <>
        <Layout 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        config={BUSINESS_CONFIG}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        >
        {renderContent()}
        </Layout>
        
        <AdminDashboard 
            isOpen={isDashboardOpen} 
            onClose={() => setIsDashboardOpen(false)} 
            emergencyMode={emergencyMode}
            setEmergencyMode={setEmergencyMode}
        />
    </>
  );
};

export default App;