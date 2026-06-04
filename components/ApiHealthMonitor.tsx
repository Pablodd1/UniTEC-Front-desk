import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { SystemStatus, getSystemStatus } from '../services/healthService';

interface ApiHealthMonitorProps {
  status?: SystemStatus | null;
}

const ApiHealthMonitor: React.FC<ApiHealthMonitorProps> = ({ status }) => {
  const [currentStatus, setCurrentStatus] = useState<SystemStatus | null>(status || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const newStatus = await getSystemStatus();
      setCurrentStatus(newStatus);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Failed to refresh status:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up': return <CheckCircle size={16} className="text-green-500" />;
      case 'degraded': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'down': return <XCircle size={16} className="text-red-500" />;
      default: return <Activity size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up': return 'bg-green-50 border-green-200 text-green-700';
      case 'degraded': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'down': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-600';
    }
  };

  const getOverallColor = (overall: string) => {
    switch (overall) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-amber-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  if (!currentStatus) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-2 text-slate-400">
          <Activity size={20} />
          <span>Loading system status...</span>
        </div>
      </div>
    );
  }

  const services = [
    { name: 'Gemini AI', key: 'gemini', description: 'AI model API' },
    { name: 'Firebase', key: 'firebase', description: 'Database & Auth' },
    { name: 'Twilio', key: 'twilio', description: 'Voice calls' },
    { name: 'Email Service', key: 'email', description: 'Notifications' },
    { name: 'Telegram', key: 'telegram', description: 'Bot notifications' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">System Health</h3>
          <p className="text-sm text-slate-500">
            Last checked: {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={refreshStatus}
          disabled={isRefreshing}
          className={`p-2 rounded-lg hover:bg-slate-100 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={18} className="text-slate-600" />
        </button>
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-2xl border ${getStatusColor(currentStatus.overall)}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getOverallColor(currentStatus.overall)} ${currentStatus.overall === 'healthy' ? 'animate-pulse' : ''}`} />
          <div>
            <p className="font-bold text-lg capitalize">{currentStatus.overall}</p>
            <p className="text-sm opacity-80">
              {currentStatus.overall === 'healthy' 
                ? 'All systems operational' 
                : currentStatus.overall === 'degraded'
                ? 'Some services experiencing issues'
                : 'Critical system failure detected'}
            </p>
          </div>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => {
          const serviceStatus = currentStatus.services[service.key as keyof typeof currentStatus.services];
          return (
            <div 
              key={service.key}
              className={`p-4 rounded-xl border ${getStatusColor(serviceStatus.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(serviceStatus.status)}
                  <span className="font-semibold">{service.name}</span>
                </div>
                <span className="text-xs font-bold uppercase">
                  {serviceStatus.status}
                </span>
              </div>
              <p className="text-xs opacity-70 mb-2">{service.description}</p>
              <div className="flex items-center gap-1 text-xs">
                <Clock size={12} />
                <span>{serviceStatus.latency}ms</span>
              </div>
              {serviceStatus.error && (
                <p className="text-xs mt-2 opacity-80">{serviceStatus.error}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Metrics */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h4 className="font-bold text-slate-800 mb-4">System Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Conversations</p>
            <p className="text-lg font-bold text-slate-800">{currentStatus.metrics.totalConversations}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Now</p>
            <p className="text-lg font-bold text-slate-800">{currentStatus.metrics.activeConversations}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Interventions</p>
            <p className="text-lg font-bold text-slate-800">{currentStatus.metrics.pendingInterventions}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Response Time</p>
            <p className="text-lg font-bold text-slate-800">{currentStatus.metrics.avgResponseTime.toFixed(2)}s</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Error Rate</p>
            <p className="text-lg font-bold text-slate-800">{currentStatus.metrics.errorRate.toFixed(2)}%</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uptime</p>
            <p className="text-lg font-bold text-slate-800">{currentStatus.metrics.uptime.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Error Log (if any) */}
      {Object.entries(currentStatus.services).some(([, s]) => s.error) && (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
          <h4 className="font-bold text-red-700 mb-2 flex items-center gap-2">
            <AlertTriangle size={16} />
            Active Alerts
          </h4>
          <div className="space-y-2">
            {Object.entries(currentStatus.services)
              .filter(([, s]) => s.error)
              .map(([key, s]) => (
                <div key={key} className="text-sm text-red-600">
                  <span className="font-bold capitalize">{key}:</span> {s.error}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiHealthMonitor;
