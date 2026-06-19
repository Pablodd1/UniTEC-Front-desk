import React, { useState } from 'react';
import { Users, MessageSquare, Clock, BarChart3, Phone, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ConversationSession } from '../services/conversationService';

interface AnalyticsDashboardProps {
  sessions: ConversationSession[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ sessions }) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Apply time filter
  const filteredSessions = sessions.filter(s => {
    const sTime = new Date(s.createdAt).getTime();
    if (timeFilter === 'today') return sTime >= todayStart;
    if (timeFilter === 'week') return sTime >= weekStart;
    if (timeFilter === 'month') return sTime >= monthStart;
    return true;
  });

  // Calculate metrics based on filtered sessions
  const totalSessions = filteredSessions.length;

  const humanRequested = filteredSessions.filter(s => s.status === 'human_requested').length;
  const humanAssigned = filteredSessions.filter(s => s.status === 'human_assigned').length;

  const startedChatSessions = filteredSessions.filter(s => (s.analytics?.messageCount || 0) > 0).length;
  const noChatSessions = filteredSessions.filter(s => (s.analytics?.messageCount || 0) === 0).length;
  const conversionRate = totalSessions > 0 
    ? ((startedChatSessions / totalSessions) * 100).toFixed(1) 
    : '0.0';
  
  const brandDistribution = {
    unitec: filteredSessions.filter(s => s.brandId === 'unitec').length,
    building: filteredSessions.filter(s => s.brandId === 'building').length,
  };
  
  const sourceDistribution = {
    web: filteredSessions.filter(s => s.source === 'web').length,
    phone: filteredSessions.filter(s => s.source === 'phone').length,
    whatsapp: filteredSessions.filter(s => s.source === 'whatsapp').length,
  };
  
  const intentDistribution = filteredSessions.reduce((acc, s) => {
    const intent = s.intentCategory || 'unknown';
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const hourlyDistribution = filteredSessions.reduce((acc, s) => {
    const hour = new Date(s.createdAt).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const hourlyData = Object.entries(hourlyDistribution)
    .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  
  const sentimentData = filteredSessions.reduce((acc, s) => {
    const score = s.sentimentScore || 0;
    if (score > 0.3) acc.positive++;
    else if (score < -0.3) acc.negative++;
    else acc.neutral++;
    return acc;
  }, { positive: 0, neutral: 0, negative: 0 });
  
  // Unused but defined for future color customization
  void ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#ec4899'];
  
  const topTopics = filteredSessions.reduce((acc: Record<string, number>, s) => {
    s.topics?.forEach((topic: string) => {
      acc[topic] = (acc[topic] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  const sortedTopics = Object.entries(topTopics)
    .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
    .slice(0, 10);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">Analytics Overview</h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              LIVE
            </span>
          </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
          <button 
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeFilter === 'all' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeFilter === 'month' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Mes
          </button>
          <button 
            onClick={() => setTimeFilter('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeFilter === 'week' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Semana
          </button>
          <button 
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeFilter === 'today' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entradas Totales</span>
            <Users size={16} className="text-brand-600" />
          </div>
          <p className="text-2xl font-black text-slate-800">{totalSessions}</p>
          <p className="text-xs text-slate-400 mt-1">Visitas únicas al widget</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Iniciaron Chat</span>
            <MessageSquare size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-800">{startedChatSessions}</p>
          <p className="text-xs text-slate-400 mt-1">Usuarios que escribieron</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sin Chatear</span>
            <XCircle size={16} className="text-slate-500" />
          </div>
          <p className="text-2xl font-black text-slate-800">{noChatSessions}</p>
          <p className="text-xs text-slate-400 mt-1">Solo leyeron bienvenida</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tasa Conversión</span>
            <BarChart3 size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-800">{conversionRate}%</p>
          <p className="text-xs text-slate-400 mt-1">Conversión de visita a chat</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Intervención Humana</span>
            <Users size={16} className="text-orange-600" />
          </div>
          <p className="text-2xl font-black text-slate-800">{humanRequested + humanAssigned}</p>
          <p className="text-xs text-slate-400 mt-1">{humanRequested} pendientes de staff</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duración Promedio</span>
            <Clock size={16} className="text-cyan-600" />
          </div>
          <p className="text-2xl font-black text-slate-800">
            {filteredSessions.length > 0
              ? (filteredSessions.reduce((acc, s) => acc + (s.duration || 0), 0) / filteredSessions.length / 60).toFixed(1)
              : 0}m
          </p>
          <p className="text-xs text-slate-400 mt-1">Por conversación</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Hourly Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Brand Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'UNITEC', value: brandDistribution.unitec },
                    { name: 'Building Innovation', value: brandDistribution.building },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#2563eb" />
                  <Cell fill="#16a34a" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#2563eb]" />
              <span className="text-xs text-slate-600">UNITEC ({brandDistribution.unitec})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
              <span className="text-xs text-slate-600">Building Innovation ({brandDistribution.building})</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Conversion Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Iniciaron Chat', value: startedChatSessions },
                    { name: 'Sin Chatear', value: noChatSessions },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
              <span className="text-xs text-slate-600">Chat ({startedChatSessions})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#64748b]" />
              <span className="text-xs text-slate-600">Sin Chatear ({noChatSessions})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment & Source Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Sentiment Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
              <span className="text-sm font-medium text-emerald-700">Positive</span>
              <span className="font-bold text-emerald-700">{sentimentData.positive}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-medium text-slate-700">Neutral</span>
              <span className="font-bold text-slate-700">{sentimentData.neutral}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <span className="text-sm font-medium text-red-700">Negative</span>
              <span className="font-bold text-red-700">{sentimentData.negative}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Source Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <span className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <BarChart3 size={14} /> Web
              </span>
              <span className="font-bold text-blue-700">{sourceDistribution.web}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
              <span className="text-sm font-medium text-orange-700 flex items-center gap-2">
                <Phone size={14} /> Phone
              </span>
              <span className="font-bold text-orange-700">{sourceDistribution.phone}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <span className="text-sm font-medium text-green-700 flex items-center gap-2">
                <MessageSquare size={14} /> WhatsApp
              </span>
              <span className="font-bold text-green-700">{sourceDistribution.whatsapp}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Topics */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">Top Conversation Topics</h3>
        {sortedTopics.length === 0 ? (
          <p className="text-sm text-slate-400">No topic data available yet</p>
        ) : (
          <div className="space-y-2">
            {sortedTopics.map(([topic, count]: [string, number], index: number) => (
              <div key={topic} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-6">{index + 1}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-brand-500 h-full rounded-full transition-all"
                    style={{ width: `${(count / sortedTopics[0][1]) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-slate-700">
                    {topic}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-600 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Intent Distribution */}
      {Object.keys(intentDistribution).length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Intent Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(intentDistribution).map(([intent, count]) => (
              <div key={intent} className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{intent}</p>
                <p className="text-lg font-bold text-slate-800">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* All Transactions Log Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">Transaction History Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Session ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Messages</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-brand-600 font-medium">{s.id.split('_').slice(1).join('_')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'abandoned' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{s.brandId}</td>
                  <td className="px-4 py-3">{s.source}</td>
                  <td className="px-4 py-3">{s.analytics?.messageCount || s.messages?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;


