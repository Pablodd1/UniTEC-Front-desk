import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import WebsiteLayout from './components/WebsiteLayout';
import ChatTab from './components/ChatTab';
import CallTab from './components/CallTab';
import AdminDashboard from './components/AdminDashboard';
import CalendarTab from './components/CalendarTab';
import LoginScreen from './components/LoginScreen';
import StaffReply from './components/StaffReply';
import ServicesTab from './components/ServicesTab';
import InfoTab from './components/InfoTab';
import PrivacyTab from './components/PrivacyTab';
import CartSidebar from './components/CartSidebar';
import { Tab, Language, VoiceName, VoiceProvider, CartItem } from './types';
import { UNITEC_CONFIG, BUILDING_INNOVATION_CONFIG, QUICK_ACTIONS } from './constants';
import { resetChatSession } from './services/geminiService';
import { auth, logOut } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// Deep-link support: /admin must behave like ?admin=true (telegram alert buttons point here)
const isAdminPath = (): boolean =>
  typeof window !== 'undefined' && /^\/admin\/?$/i.test(window.location.pathname);

const App: React.FC = () => {
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';

  // Deep-link target from Telegram alerts (?admin=true&session=<id>)
  const [adminDeepLinkSession] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const sid = new URLSearchParams(window.location.search).get('session') || '';
    return /^[\w-]{1,80}$/.test(sid) ? sid : undefined;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Deep-link del STAFF (?staff=<token>): la alerta abre SOLO esa conversación, sin el muro de login
  // del panel (sessionStorage es por pestaña y no se hereda desde Telegram). El token lo firma
  // /api/notify-escalation y lo valida /api/staff-enter.
  const [staffToken] = useState<string>(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('staff') || ''
  );
  const [staffAuth, setStaffAuth] = useState<'checking' | 'ok' | 'denied'>(staffToken ? 'checking' : 'denied');
  const [staffInfo, setStaffInfo] = useState<{ customerName?: string; customerPhone?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const hash = window.location.hash;
      if (search.includes('admin=true') || hash === '#admin' || isAdminPath() || localStorage.getItem('unitec_show_admin') === 'true') {
        return Tab.ADMIN_SETTINGS;
      }
    }
    return Tab.CHAT;
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [language, setLanguage] = useState<Language>('es');
  const [showAdminTab, setShowAdminTab] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const hash = window.location.hash;
      return search.includes('admin=true') || hash === '#admin' || isAdminPath() || localStorage.getItem('unitec_show_admin') === 'true';
    }
    return false;
  });
  
  const [currentBrandId, setCurrentBrandId] = useState<'unitec' | 'building'>('unitec');
  const activeConfig = currentBrandId === 'unitec' ? UNITEC_CONFIG : BUILDING_INNOVATION_CONFIG;

  const [bgImage, setBgImage] = useState<string>(localStorage.getItem('unitec_custom_bg') || "/marble-bg.png");

  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('gemini');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  
  const [initialMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch(err => console.warn('Auto anonymous auth failed:', err));
      } else {
        setIsLoggedIn(true);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const detectCountryAndSetBrand = async () => {
      const urlBrand = new URLSearchParams(window.location.search).get('brandId');
      if (urlBrand === 'unitec' || urlBrand === 'building') {
        setCurrentBrandId(urlBrand as 'unitec' | 'building');
        return;
      }
      // Force unitec per business requirements for Colombia
      setCurrentBrandId('unitec');
    };
    detectCountryAndSetBrand();
  }, []);

  useEffect(() => {
    resetChatSession();
  }, [emergencyMode, language, currentBrandId]);

  // Valida el link firmado del staff contra /api/staff-enter (token atado a la sesión + caducidad).
  useEffect(() => {
    if (!staffToken) return;
    if (!adminDeepLinkSession) { setStaffAuth('denied'); return; }
    let cancelled = false;
    fetch('/api/staff-enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: staffToken, sessionId: adminDeepLinkSession }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok) {
          setStaffInfo({ customerName: j.customerName, customerPhone: j.customerPhone });
          setStaffAuth('ok');
        } else {
          setStaffAuth('denied');
        }
      })
      .catch(() => { if (!cancelled) setStaffAuth('denied'); });
    return () => { cancelled = true; };
  }, [staffToken, adminDeepLinkSession]);

  useEffect(() => {
    const checkAdminMode = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const hasAdminParam = search.includes('admin=true') || hash === '#admin' || isAdminPath();
      const hasStoredAdmin = localStorage.getItem('unitec_show_admin') === 'true';
      
      if (hasAdminParam || hasStoredAdmin) {
        setShowAdminTab(true);
        if (hasAdminParam) {
          localStorage.setItem('unitec_show_admin', 'true');
          setActiveTab(Tab.ADMIN_SETTINGS);
        }
        if (hash === '#admin') {
          setActiveTab(Tab.ADMIN_SETTINGS);
        }
      }
    };
    
    checkAdminMode();
    window.addEventListener('hashchange', checkAdminMode);
    return () => window.removeEventListener('hashchange', checkAdminMode);
  }, []);

  useEffect(() => {
    const isUnitec = currentBrandId === 'unitec';
    document.documentElement.lang = 'es';
    document.title = isUnitec
      ? 'UNITEC USA Design | Recepcionista Virtual IA | Distribución Mayorista'
      : 'Building Innovation | Asistente Virtual IA | Miami, Florida';

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = isUnitec
      ? 'Recepcionista virtual IA para distribución mayorista de materiales de construcción. Consulta catálogo, stock en Florida y cotizaciones al instante.'
      : 'Asistente virtual IA de Building Innovation. Consulta productos, stock en Miami y conecta con ventas. Atención inmediata 24/7.';

    const setOg = (property: string, val: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.content = val;
    };
    setOg('og:title', isUnitec ? 'UNITEC USA Design | Asistente Virtual IA' : 'Building Innovation | Asistente Virtual IA');
    setOg('og:description', isUnitec
      ? 'Consulta catálogo, stock y cotizaciones en tiempo real. Distribuidor mayorista de materiales de construcción premium.'
      : 'Paneles WPC, pisos SPC, fachadas y más. Consulta disponibilidad y cotiza ahora mismo.');
    setOg('og:locale', 'es_ES');

    const unitecSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c4a6e"/><text x="32" y="46" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="white" text-anchor="middle">U</text></svg>';
    const buildingSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#065f46"/><text x="32" y="46" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="white" text-anchor="middle">B</text></svg>';
    const svgContent = isUnitec ? unitecSvg : buildingSvg;
    const encoded = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

    let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    faviconLink.type = 'image/svg+xml';
    faviconLink.href = encoded;

    let shortcutLink = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
    if (!shortcutLink) {
      shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      document.head.appendChild(shortcutLink);
    }
    shortcutLink.href = encoded;
  }, [currentBrandId]);

  const handleLogout = async () => {
    sessionStorage.removeItem('unitec_local_admin');
    localStorage.removeItem('unitec_show_admin');
    setShowAdminTab(false);
    setActiveTab(Tab.CHAT);
    await logOut();
    setIsLoggedIn(false);
  };

  const renderContent = () => {
    if (!isAuthReady) {
      return <div className="h-full w-full flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>;
    }

    if ((activeTab === Tab.ADMIN_SETTINGS || activeTab === Tab.CALENDAR) && !isLoggedIn) {
        return <LoginScreen config={activeConfig} onLogin={() => setIsLoggedIn(true)} />;
    }

    switch (activeTab) {
      case Tab.CHAT:
        return <ChatTab 
            quickActions={QUICK_ACTIONS} 
            emergencyMode={emergencyMode} 
            language={language}
            initialMessage={initialMessage}
            customGreeting={activeConfig.customGreeting}
            bgImage={bgImage}
            brandId={currentBrandId}
        />;
      case Tab.CALL:
        return <CallTab 
            emergencyMode={emergencyMode} 
            language={language}
            voiceName={voiceName}
            voiceProvider={voiceProvider}
            customGreeting={activeConfig.customGreeting}
            brandId={currentBrandId}
        />;
      case Tab.SERVICES:
        return <ServicesTab 
            language={language}
            onConsultProduct={(productName) => {
              const initMsg = language === 'en' 
                ? "I would like to know more about " + productName 
                : "Me gustaría saber más sobre " + productName;
              window.history.pushState({}, '', '?initialMessage=' + encodeURIComponent(initMsg));
              setActiveTab(Tab.CHAT);
            }}
            onAddToCart={(product, quantity) => {
              setCart(prev => {
                const existing = prev.find(item => item.product.id === product.id);
                if (existing) {
                  return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { product, quantity }];
              });
              setIsCartOpen(true);
            }}
        />;
      case Tab.INFO:
        return <InfoTab language={language} config={activeConfig} />;
      case Tab.PRIVACY:
        return <PrivacyTab language={language} config={activeConfig} />;
      case Tab.CALENDAR:
        return <CalendarTab />;
      case Tab.ADMIN_SETTINGS:
        return <AdminDashboard 
            initialSessionId={adminDeepLinkSession}
            emergencyMode={emergencyMode}
            setEmergencyMode={setEmergencyMode}
            voiceName={voiceName}
            setVoiceName={setVoiceName}
            voiceProvider={voiceProvider}
            setVoiceProvider={setVoiceProvider}
            currentBrandId={currentBrandId}
            onToggleBrand={setCurrentBrandId}
            onUpdateBackground={setBgImage}
            language={language}
        />;
      default:
        return <ChatTab 
            quickActions={QUICK_ACTIONS} 
            emergencyMode={emergencyMode} 
            language={language}
            brandId={currentBrandId}
        />;
    }
  };

  if (staffToken && staffAuth === 'ok' && adminDeepLinkSession) {
    return <StaffReply sessionId={adminDeepLinkSession} knownName={staffInfo?.customerName} knownPhone={staffInfo?.customerPhone} />;
  }
  if (staffToken && staffAuth === 'checking') {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }
  if (staffToken && staffAuth === 'denied') {
    // El link de la alerta caducó o fue alterado: se dice QUÉ pasó y se da la entrada al panel, en
    // vez de dejar al staff en una pantalla que no explica nada (la queja original).
    return (
      <div className="min-h-[100dvh] w-full bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-6 text-center">
          <p className="text-3xl mb-2">🔒</p>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">Este enlace de la alerta expiró o no es válido</h1>
          <p className="text-sm text-slate-500 mb-5">
            Los enlaces de atención caducan a las 48 horas. Entra al panel con tu correo y contraseña para ver la conversación.
          </p>
          <a
            className="inline-block px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
            href={`${window.location.origin}/?admin=true${adminDeepLinkSession ? `&session=${encodeURIComponent(adminDeepLinkSession)}` : ''}`}
          >
            Ir al panel
          </a>
        </div>
      </div>
    );
  }

  if (isEmbedMode) {
    const embedTab = (activeTab === Tab.ADMIN_SETTINGS) ? Tab.CHAT : activeTab;
    const handleEmbedTabChange = (tab: Tab) => {
      if (tab === Tab.ADMIN_SETTINGS) {
        window.open(`${window.location.origin}/?brandId=${currentBrandId}`, '_blank');
        return;
      }
      setActiveTab(tab);
    };
    return (
      <div className="h-full w-full bg-transparent overflow-hidden">
        <Layout 
          activeTab={embedTab} 
          onTabChange={handleEmbedTabChange}
          config={activeConfig}
          onOpenDashboard={() => window.open(`${window.location.origin}/?brandId=${currentBrandId}`, "_blank")}
          language={language}
          setLanguage={setLanguage}
          onLogout={handleLogout}
          onCloseWidget={() => window.parent.postMessage("close-chatbot", "*")}
          isEmbedMode={true}
          currentBrandId={currentBrandId}
          onToggleBrand={undefined}
          cart={cart}
          onOpenCart={() => setIsCartOpen(true)}
          showAdminTab={showAdminTab}
        >
          {renderContent()}
        </Layout>
        <CartSidebar 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          setCart={setCart}
          language={language}
        />
      </div>
    );
  }

  if (activeTab === Tab.ADMIN_SETTINGS && !isEmbedMode) {
    const isLocalAdmin = typeof window !== 'undefined' && sessionStorage.getItem('unitec_local_admin') === 'true';
    if (!isLocalAdmin) {
      return (
        <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col font-sans justify-center items-center p-4">
          <LoginScreen config={activeConfig} onLogin={() => { sessionStorage.setItem('unitec_local_admin', 'true'); setIsLoggedIn(true); }} />
        </div>
      );
    }
    return (
      <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col font-sans">
        <AdminDashboard 
            initialSessionId={adminDeepLinkSession}
            emergencyMode={emergencyMode}
            setEmergencyMode={setEmergencyMode}
            voiceName={voiceName}
            setVoiceName={setVoiceName}
            voiceProvider={voiceProvider}
            setVoiceProvider={setVoiceProvider}
            currentBrandId={currentBrandId}
            onToggleBrand={setCurrentBrandId}
            onUpdateBackground={setBgImage}
            language={language}
            onBack={() => setActiveTab(Tab.CHAT)}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-50 overflow-hidden flex flex-col">
      <WebsiteLayout 
        config={activeConfig}
        onOpenDashboard={() => setActiveTab(Tab.ADMIN_SETTINGS)}
        language={language}
        setLanguage={setLanguage}
        onLogout={handleLogout}
        onCloseWidget={() => {}}
        isEmbedMode={false}
        currentBrandId={currentBrandId}
        onToggleBrand={setCurrentBrandId}
        cart={cart}
        onOpenCart={() => setIsCartOpen(true)}
        showAdminTab={showAdminTab}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {renderContent()}
      </WebsiteLayout>
      <CartSidebar 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        setCart={setCart}
        language={language}
      />
    </div>
  );
};

export default App;





