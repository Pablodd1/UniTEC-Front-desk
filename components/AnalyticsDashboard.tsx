import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, BarChart3, Phone, XCircle, Zap, AlertTriangle, Activity, Download, FileJson } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ConversationSession } from '../services/conversationService';

interface AnalyticsDashboardProps {
  sessions: ConversationSession[];
  googleAnalyticsVisits?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ sessions, googleAnalyticsVisits }) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [_liveTime, setLiveTime] = useState(new Date());

  // Refresh live metrics every 30s
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const exportToCSV = () => {
    const headers = [
      'Session ID', 'Created At', 'Last Updated', 'Brand', 'Language', 
      'Status', 'Source', 'Message Count', 'Customer Name', 'Customer Phone', 
      'Customer Email', 'Intent Category', 'Sentiment Score', 'Topics'
    ];

    const rows = filteredSessions.map(s => [
      s.id,
      s.createdAt,
      s.lastUpdated,
      s.brandId,
      s.language,
      s.status,
      s.source,
      s.analytics?.messageCount || 0,
      s.customerName || s.extractedData?.name || '',
      s.customerPhone || s.extractedData?.phone || '',
      s.customerEmail || s.extractedData?.email || '',
      s.intentCategory || '',
      s.sentimentScore || 0,
      (s.topics || []).join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `unitec_chat_analytics_${timeFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredSessions, null, 2)
    )}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `unitec_chat_transcripts_${timeFilter}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Always-live: today metrics (independent of filter)
  const todaySessions = sessions.filter(s => new Date(s.createdAt).getTime() >= todayStart);
  const activeNow = sessions.filter(s => s.status === 'active' || s.status === 'human_assigned').length;
  const pendingInterventionsToday = todaySessions.filter(s => s.status === 'human_requested' || s.status === 'human_assigned').length;
  const avgMsgsToday = todaySessions.length > 0
    ? (todaySessions.reduce((sum, s) => sum + (s.analytics?.messageCount || 0), 0) / todaySessions.length).toFixed(1)
    : '0';
  const unitecToday = todaySessions.filter(s => s.brandId === 'unitec').length;
  const buildingToday = todaySessions.filter(s => s.brandId === 'building').length;

  // Hourly ingestion for today
  const todayHourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}h`,
    count: todaySessions.filter(s => new Date(s.createdAt).getHours() === h).length,
  }));

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');

  const MONTHS_SPANISH = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Apply time, month, and day filter for main metrics
  const filteredSessions = sessions.filter(s => {
    const d = new Date(s.createdAt);
    const sTime = d.getTime();
    
    if (selectedMonth !== 'all' && d.getMonth() !== parseInt(selectedMonth, 10)) return false;
    if (selectedDay !== 'all' && d.getDate() !== parseInt(selectedDay, 10)) return false;

    if (timeFilter === 'today') return sTime >= todayStart;
    if (timeFilter === 'week') return sTime >= weekStart;
    if (timeFilter === 'month') return sTime >= monthStart;
    return true;
  });

  const totalSessions = filteredSessions.length;
  const humanRequested = filteredSessions.filter(s => s.status === 'human_requested').length;
  const humanAssigned = filteredSessions.filter(s => s.status === 'human_assigned').length;
  const startedChatSessions = filteredSessions.filter(s => (s.analytics?.messageCount || 0) > 0).length;
  const noChatSessions = filteredSessions.filter(s => (s.analytics?.messageCount || 0) === 0).length;
  const conversionRate = totalSessions > 0
    ? ((startedChatSessions / totalSessions) * 100).toFixed(1)
    : '0.0';

  const gaVisits = parseInt(googleAnalyticsVisits || '3188', 10) || 3188;
  const gaConversionRate = gaVisits > 0
    ? ((startedChatSessions / gaVisits) * 100).toFixed(1)
    : '0.0';

  // Average Handling Time (AHT) calculation
  const sessionsWithDuration = filteredSessions.filter(s => s.duration && s.duration > 0);
  const avgAhtSeconds = sessionsWithDuration.length > 0
    ? Math.round(sessionsWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) / sessionsWithDuration.length)
    : 0;
  const ahtFormatted = avgAhtSeconds > 0
    ? `${Math.floor(avgAhtSeconds / 60)}m ${avgAhtSeconds % 60}s`
    : 'N/A';
  
  // AHT percentage compared to 3-minute standard (180s = 100%)
  const ahtPercentage = avgAhtSeconds > 0
    ? ((avgAhtSeconds / 180) * 100).toFixed(1)
    : '0.0';

  // Sales Contact & Quotation quantification
  const salesContactSessions = filteredSessions.filter(s =>
    s.status === 'completed' ||
    s.intentCategory === 'cotizacion' ||
    s.topics?.includes('cotizacion') ||
    s.extractedData?.phone ||
    (s.analytics as any)?.salesContactShared
  );
  const salesContactCount = salesContactSessions.length;

  // Hourly distribution for historical sessions
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const hourStr = `${h.toString().padStart(2, '0')}:00`;
    const count = filteredSessions.filter(s => new Date(s.createdAt).getHours() === h).length;
    return { hour: hourStr, count };
  });

  // Brand distribution
  const brandDistribution = filteredSessions.reduce((acc, s) => {
    const brand = s.brandId || 'building';
    acc[brand] = (acc[brand] || 0) + 1;
    return acc;
  }, { unitec: 0, building: 0 } as Record<string, number>);

  // Sentiment analysis count
  const sentimentData = filteredSessions.reduce((acc, s) => {
    const score = s.sentimentScore || 0;
    if (score > 0.3) acc.positive++;
    else if (score < -0.3) acc.negative++;
    else acc.neutral++;
    return acc;
  }, { positive: 0, neutral: 0, negative: 0 });

  // Source distribution
  const sourceDistribution = filteredSessions.reduce((acc, s) => {
    const src = s.source || 'web';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, { web: 0, phone: 0, whatsapp: 0 } as Record<string, number>);

  // Top Topics
  const topTopics = filteredSessions.reduce((acc: Record<string, number>, s) => {
    (s.topics || []).forEach((topic: string) => {
      acc[topic] = (acc[topic] || 0) + 1;
    });
    return acc;
  }, {});
  const sortedTopics = Object.entries(topTopics).sort(([, a], [, b]) => b - a).slice(0, 8);

  // Intent distribution
  const intentDistribution = filteredSessions.reduce((acc, s) => {
    let intent = s.intentCategory || 'Desconocido';
    if (intent === 'unknown') intent = 'Desconocido';
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 pb-20">
      {/* TODAY LIVE PANEL */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #22c55e 0%, transparent 50%), radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 40%)' }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Actividad de hoy</span>
              <span className="px-2 py-0.5 bg-red-500 rounded-full text-[9px] font-black uppercase tracking-wider text-white animate-pulse">En vivo</span>
            </div>
            <span className="text-[10px] text-slate-400">{now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} · Actualizado cada 30s</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={12} className="text-emerald-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Activos Ahora (Interactuando)</span>
              </div>
              <p className="text-3xl font-black text-emerald-400">{activeNow}</p>
              <p className="text-[9px] text-slate-400 mt-1">Clientes en línea en vivo</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={12} className="text-blue-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ingresaron hoy</span>
              </div>
              <p className="text-3xl font-black text-blue-400">{todaySessions.length}</p>
              <p className="text-[9px] text-slate-400 mt-1">Total visitas del día</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={12} className="text-amber-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Intervenciones hoy</span>
              </div>
              <p className="text-3xl font-black text-amber-400">{pendingInterventionsToday}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={12} className="text-purple-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Prom. msgs/chat</span>
              </div>
              <p className="text-3xl font-black text-purple-400">{avgMsgsToday}</p>
            </div>
          </div>
          {/* Brand split */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sky-400" />
                <span className="text-[10px] font-bold text-slate-300">UNITEC hoy</span>
              </div>
              <span className="text-lg font-black text-sky-400">{unitecToday}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-bold text-slate-300">Building hoy</span>
              </div>
              <span className="text-lg font-black text-emerald-400">{buildingToday}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TODAY HOURLY INGESTION */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Ingesta por hora · Hoy</h3>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />EN VIVO
          </span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={todayHourlyData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Chats']} labelStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time, Month, Day filter and export options for historical */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Histórico de Análisis</h2>
          <p className="text-xs text-slate-500 mt-0.5">Filtre por período, mes o día y exporte los datos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Período Rápido */}
          <div className="flex gap-1 bg-slate-200/60 rounded-xl p-1">
            {(['today', 'week', 'month', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${timeFilter === f ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f === 'today' ? 'Hoy' : f === 'week' ? '7 días' : f === 'month' ? '30 días' : 'Todo'}
              </button>
            ))}
          </div>

          {/* Filtro por Mes */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Todos los Meses</option>
            {MONTHS_SPANISH.map((m, idx) => (
              <option key={idx} value={String(idx)}>{m}</option>
            ))}
          </select>

          {/* Filtro por Día */}
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Todos los Días</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={String(d)}>Día {d}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-md hover:bg-emerald-700 transition-colors"
            >
              <Download size={12} />
              Exportar CSV
            </button>
            <button 
              onClick={exportToJSON}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-md hover:bg-blue-700 transition-colors"
            >
              <FileJson size={12} />
              Exportar Transcripts
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-sky-50 rounded-lg"><Activity size={14} className="text-sky-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visitas Web (GA)</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{gaVisits.toLocaleString('es')}</p>
          <p className="text-[10px] text-sky-600 font-bold mt-1">{gaConversionRate}% conv. real</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-brand-50 rounded-lg"><Users size={14} className="text-brand-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sesiones</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{totalSessions}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg"><BarChart3 size={14} className="text-emerald-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tasa Conversión</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{conversionRate}%</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg"><Zap size={14} className="text-purple-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AHT Promedio</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{ahtFormatted}</p>
          <p className="text-[10px] text-purple-600 font-bold mt-1">{ahtPercentage}% respecto a estándar</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg"><MessageSquare size={14} className="text-blue-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cotizaciones / Ventas</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{salesContactCount}</p>
          <p className="text-[10px] text-blue-600 font-bold mt-1">Contactos comerciales entregados</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg"><Phone size={14} className="text-orange-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asistencia Humana</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{humanRequested + humanAssigned}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-red-50 rounded-lg"><XCircle size={14} className="text-red-500" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sin Interacción</span>
          </div>
          <p className="text-2xl font-black text-slate-800">{noChatSessions}</p>
        </div>
      </div>

      {/* Historical Hourly Chart */}
      {timeFilter !== 'today' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Distribución por Hora</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Brand & Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Por Marca</h3>
          <div className="space-y-3">
            {[
              { label: 'UNITEC USA Design', value: brandDistribution.unitec, color: 'bg-sky-500', bg: 'bg-sky-50' },
              { label: 'Building Innovation', value: brandDistribution.building, color: 'bg-emerald-500', bg: 'bg-emerald-50' },
            ].map(b => (
              <div key={b.label} className={`flex items-center justify-between p-3 ${b.bg} rounded-xl`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${b.color}`} />
                  <span className="text-sm font-medium text-slate-700">{b.label}</span>
                </div>
                <span className="font-black text-slate-800">{b.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Conversión</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Iniciaron Chat', value: startedChatSessions },
                    { name: 'Sin Chatear', value: noChatSessions },
                  ]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value"
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3b82f6]" /><span className="text-xs text-slate-600">Chat ({startedChatSessions})</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#64748b]" /><span className="text-xs text-slate-600">Sin Chatear ({noChatSessions})</span></div>
          </div>
        </div>
      </div>

      {/* Sentiment & Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Análisis de Sentimiento</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl"><span className="text-sm font-medium text-emerald-700">Positivo</span><span className="font-bold text-emerald-700">{sentimentData.positive}</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><span className="text-sm font-medium text-slate-700">Neutral</span><span className="font-bold text-slate-700">{sentimentData.neutral}</span></div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl"><span className="text-sm font-medium text-red-700">Negativo</span><span className="font-bold text-red-700">{sentimentData.negative}</span></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Fuente de Tráfico</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl"><span className="text-sm font-medium text-blue-700 flex items-center gap-2"><BarChart3 size={14} /> Web</span><span className="font-bold text-blue-700">{sourceDistribution.web}</span></div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl"><span className="text-sm font-medium text-orange-700 flex items-center gap-2"><Phone size={14} /> Teléfono</span><span className="font-bold text-orange-700">{sourceDistribution.phone}</span></div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl"><span className="text-sm font-medium text-green-700 flex items-center gap-2"><MessageSquare size={14} /> WhatsApp</span><span className="font-bold text-green-700">{sourceDistribution.whatsapp}</span></div>
          </div>
        </div>
      </div>

      {/* Top Topics */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">Temas más Frecuentes</h3>
        {sortedTopics.length === 0 ? (
          <p className="text-sm text-slate-400">Sin datos de temas aún</p>
        ) : (
          <div className="space-y-2">
            {sortedTopics.map(([topic, count]: [string, number], index: number) => (
              <div key={topic} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-6">{index + 1}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${(count / (sortedTopics[0][1] || 1)) * 100}%` }} />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-slate-700">{topic}</span>
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
          <h3 className="font-bold text-slate-800 mb-4">Distribución de Intenciones</h3>
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

      {/* Cotizaciones y Ventas Leads List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Detalle de Cotizaciones y Contactos Comerciales</h3>
            <p className="text-xs text-slate-500 mt-0.5">Clientes que solicitaron cotización o dejaron sus datos de contacto comercial en el chat.</p>
          </div>
          <span className="self-start sm:self-center px-3 py-1 bg-brand-50 text-brand-700 text-xs font-black rounded-full uppercase tracking-wider">
            {salesContactSessions.length} Contactos
          </span>
        </div>
        
        {salesContactSessions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No hay contactos comerciales registrados en este periodo.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Tipo de Proyecto</th>
                  <th className="px-4 py-3">Presupuesto / Tiempo</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {salesContactSessions.map((s) => {
                  const ext = s.extractedData || {};
                  const name = s.customerName || ext.name || 'Anónimo';
                  const phone = s.customerPhone || ext.phone || 'N/A';
                  const email = s.customerEmail || ext.email || 'N/A';
                  const projectType = ext.projectType || ext.profession || 'Consulta General';
                  const budget = ext.budget || 'No especificado';
                  const timeline = ext.timeline || 'N/A';
                  
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString('es')}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 text-xs">{name}</div>
                        {ext.profession && <div className="text-[10px] text-slate-400 mt-0.5">{ext.profession}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 space-y-0.5">
                        <div className="flex items-center gap-1"><span>📞</span> <span className="font-medium">{phone}</span></div>
                        {email !== 'N/A' && <div className="flex items-center gap-1 text-[10px] text-slate-400"><span>📧</span> <span>{email}</span></div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-semibold">{projectType}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-brand-600 font-bold">{budget}</div>
                        {timeline !== 'N/A' && <div className="text-[10px] text-slate-400 mt-0.5">⏳ {timeline}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${s.brandId === 'unitec' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {s.brandId === 'unitec' ? 'UNITEC' : 'Building'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            const details = `Lead de Cotización:\n----------------------\nNombre: ${name}\nTeléfono: ${phone}\nEmail: ${email}\nTipo: ${projectType}\nPresupuesto: ${budget}\nTiempo: ${timeline}\nMarca: ${s.brandId === 'unitec' ? 'UNITEC' : 'Building Innovation'}`;
                            navigator.clipboard.writeText(details);
                            alert('Detalles de contacto copiados al portapapeles.');
                          }}
                          className="px-3 py-1 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 rounded-lg text-[10px] font-bold text-slate-600 transition-all active:scale-95"
                        >
                          Copiar Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Log */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">Registro de Sesiones</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">ID Sesión</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Mensajes</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs">{new Date(s.createdAt).toLocaleString('es')}</td>
                  <td className="px-4 py-3 text-brand-600 font-medium text-xs">{s.id.slice(-10)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${
                      s.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      s.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                      s.status === 'human_requested' ? 'bg-amber-100 text-amber-700' :
                      s.status === 'human_assigned' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.brandId}</td>
                  <td className="px-4 py-3 text-xs">{s.source}</td>
                  <td className="px-4 py-3 text-xs font-bold">{s.analytics?.messageCount || s.messages?.length || 0}</td>
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





