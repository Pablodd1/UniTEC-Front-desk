import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Activity, Database, Lock, Power, AlertTriangle } from 'lucide-react';
import { CrmLog } from '../types';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  emergencyMode: boolean;
  setEmergencyMode: (val: boolean) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, emergencyMode, setEmergencyMode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [logs, setLogs] = useState<CrmLog[]>([]);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    
    // Load logs from local storage mock with error handling
    try {
      const stored = localStorage.getItem('unitec_crm_logs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
            setLogs(parsed);
        } else {
            console.warn("CRM logs invalid format");
            setLogs([]);
        }
      }
    } catch (e) {
      console.error("Failed to parse CRM logs", e);
      setLogs([]);
    }
  }, [isOpen]);

  const handleLogin = () => {
    if (pin === '1234') {
      setIsAuthenticated(true);
      setPin('');
      setLoginError('');
    } else {
      setLoginError('Incorrect PIN');
      setPin('');
    }
  };

  const clearLogs = () => {
    if (confirm("Are you sure you want to clear all CRM logs?")) {
        localStorage.removeItem('unitec_crm_logs');
        setLogs([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-800 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-accent-500" />
            <h2 className="font-bold">Master Control</h2>
          </div>
          <button onClick={onClose} className="hover:text-gray-300"><X size={20} /></button>
        </div>

        {/* Content */}
        {!isAuthenticated ? (
          <div className="p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
              <Lock size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">Restricted Access</h3>
            <p className="text-sm text-gray-500 text-center mb-4">Enter Administrator PIN to access system controls and CRM logs.</p>
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setLoginError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className={`w-full text-center text-2xl tracking-widest p-3 border rounded-xl outline-none focus:ring-2 ${
                  loginError ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-500'
              }`}
              placeholder="••••"
              maxLength={4}
            />
            {loginError && <p className="text-red-500 text-xs font-medium">{loginError}</p>}
            <button 
              onClick={handleLogin}
              className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
            >
              Unlock Dashboard
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* System Status */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Status</h3>
              <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                  emergencyMode ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center gap-3">
                  <Activity size={20} className={emergencyMode ? "text-red-500 animate-pulse" : "text-green-500"} />
                  <div>
                    <p className={`font-medium ${emergencyMode ? "text-red-700" : "text-green-700"}`}>
                        {emergencyMode ? "Emergency Override" : "System Operational"}
                    </p>
                    <p className="text-xs opacity-75">
                        {emergencyMode ? "Safety Protocols Active" : "Normal AI Response Mode"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEmergencyMode(!emergencyMode)}
                  className={`p-2 rounded-lg transition-colors ${
                      emergencyMode ? 'bg-red-200 text-red-700 hover:bg-red-300' : 'bg-green-200 text-green-700 hover:bg-green-300'
                  }`}
                  title={emergencyMode ? "Disable Emergency Mode" : "Enable Emergency Mode"}
                >
                  <Power size={18} />
                </button>
              </div>
            </div>

            {/* CRM Logs */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Interactions</h3>
                <div className="flex gap-2">
                    <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{logs.length}</span>
                    {logs.length > 0 && (
                        <button onClick={clearLogs} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                    )}
                </div>
              </div>
              
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4 border border-dashed border-gray-200 rounded-lg">
                      No interactions logged yet.
                  </p>
                ) : (
                  logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm text-sm hover:border-brand-200 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-800">{log.customerName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          log.sentiment === 'Positive' ? 'bg-green-100 text-green-700' :
                          log.sentiment === 'Negative' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{log.sentiment}</span>
                      </div>
                      <p className="text-gray-600 mb-2 text-xs leading-relaxed">{log.summary}</p>
                      <div className="flex items-center gap-1 text-[10px] text-brand-600 bg-brand-50 px-2 py-1 rounded w-fit">
                        <Database size={10} />
                        <span>{log.actionTaken}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={() => setIsAuthenticated(false)} 
              className="w-full text-gray-500 text-sm font-medium py-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              Lock Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;