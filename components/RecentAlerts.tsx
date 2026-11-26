import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Clock, Eye, Phone, RefreshCw } from 'lucide-react';
import { ConversationSession } from '../types';
import { alertBrand } from '../brandTheme';

/**
 * Avisos recientes del equipo (auditoría real de `escalations`).
 *
 * Por qué existe: la pestaña "Alertas" solo mostraba docs de `interventions`, así que las
 * alertas de abandono / SLA / cotización llegaban al Telegram del equipo y NO existía ninguna
 * fila donde hacer clic dentro del panel ("no puedo entrar a los usuarios alertados").
 * Este bloque lista lo que de verdad se envió y abre esa conversación con un clic.
 */
interface RecentAlertsProps {
  sessions: ConversationSession[];
  onOpenSession: (sessionId: string) => void;
  /** Brand scope: alerts are only shown for the company selected in the panel header. */
  brandId?: 'unitec' | 'building';
}

interface EscalationRow {
  id: string;
  type: string;
  priority: string;
  sessionId: string;
  customerName: string;
  customerPhone: string;
  message: string;
  at: string;
  delivered: boolean;
  brand?: string;
}

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  quote: { label: 'Cotización', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  staff: { label: 'Pidió asesor', cls: 'bg-red-50 text-red-700 border-red-200' },
  sla: { label: 'Sin respuesta', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  abandon: { label: 'Abandonó', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  contact: { label: 'Dejó contacto', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  custom: { label: 'Aviso', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const RecentAlerts: React.FC<RecentAlertsProps> = ({ sessions, onOpenSession, brandId }) => {
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'staff' | 'quote' | 'abandon'>('all');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/escalations?limit=60')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setRows(Array.isArray(d.escalations) ? d.escalations : []))
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const visible = rows.filter((r) => {
    // Brand scope first: an alert belongs to the company of its session (or its own brand field).
    if (brandId && alertBrand(r, sessions as any[]) !== brandId) return false;
    if (filter === 'all') return true;
    if (filter === 'staff') return r.type === 'staff' || r.type === 'sla';
    return r.type === filter;
  });

  const nameFor = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    return s?.customerName || (s?.extractedData as any)?.name || '';
  };
  const phoneFor = (sessionId: string, fallback: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    return s?.customerPhone || (s?.extractedData as any)?.phone || fallback || '';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BellRing size={15} className="text-brand-600" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Avisos enviados al equipo</h4>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{rows.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'staff', 'quote', 'abandon'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'staff' ? 'Asesor/SLA' : f === 'quote' ? 'Cotización' : 'Abandono'}
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" title="Recargar">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-3">Cargando avisos…</p>
      ) : error ? (
        <p className="text-xs text-red-500 py-3">No se pudieron cargar los avisos: {error}</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-slate-400 py-3">Sin avisos para este filtro.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
          {visible.map((r) => {
            const meta = TYPE_LABEL[r.type] || TYPE_LABEL.custom;
            const name = r.customerName || nameFor(r.sessionId) || 'Anónimo';
            const phone = phoneFor(r.sessionId, r.customerPhone);
            return (
              <div key={r.id} className="flex items-start gap-3 py-2.5">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase shrink-0 mt-0.5 ${meta.cls}`}>
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {name}
                    {phone && <span className="ml-2 font-normal text-slate-400 text-[11px] flex-inline items-center gap-1"><Phone size={10} className="inline" /> {phone}</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{r.message || 'Sin mensaje'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock size={9} />
                    {r.at ? new Date(r.at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '—'}
                    <span className="mx-1">·</span>
                    {r.delivered ? 'entregado' : 'sin confirmar'}
                  </p>
                </div>
                <button
                  onClick={() => onOpenSession(r.sessionId)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-[10px] font-bold hover:bg-brand-100 transition-colors"
                  title="Abrir esta conversación"
                >
                  <Eye size={12} /> Abrir chat
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
        <AlertTriangle size={10} /> Fuente: registro server-side de /api/notify-escalation (las mismas alertas que llegan al teléfono).
      </p>
    </div>
  );
};

export default RecentAlerts;
