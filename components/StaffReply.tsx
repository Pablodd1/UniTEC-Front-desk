import React, { useEffect, useRef, useState } from 'react';
import { ConversationSession, ConversationMessage } from '../types';
import {
  subscribeToConversation,
  subscribeToMessages,
  addMessage,
  updateSessionStatus,
} from '../services/conversationService';

// Vista de respuesta de UN SOLO toque para el staff.
//
// Por qué existe: el link de la alerta apuntaba a /?admin=true&session=<id>, que en un dispositivo sin
// sesión de admin renderiza el muro de login (sessionStorage es por pestaña y NO se hereda en una
// pestaña abierta desde Telegram) — la queja "no hay usuario y no hay forma de entrar al chat".
// Este componente abre SOLO esa conversación (validada por /api/staff-enter con token firmado) y
// permite responder sin exponer el panel de administración.

interface Props {
  sessionId: string;
  /** Datos que devolvió /api/staff-enter (nombre ya conocido, si existe). */
  knownName?: string;
  knownPhone?: string;
}

const STAFF_NAME_KEY = 'unitec_staff_name';
const WA_LINK = 'https://wa.me/573142332147';

const fmtTime = (ts?: string) => {
  try {
    return new Date(ts || Date.now()).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const StaffReply: React.FC<Props> = ({ sessionId, knownName, knownPhone }) => {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [text, setText] = useState('');
  const [staffName, setStaffName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem(STAFF_NAME_KEY) || '' : ''));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u1 = subscribeToConversation(sessionId, setSession);
    const u2 = subscribeToMessages(sessionId, setMessages);
    return () => {
      try { u1?.(); } catch { /* noop */ }
      try { u2?.(); } catch { /* noop */ }
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const customerName = session?.customerName || knownName || '';
  const customerPhone = session?.customerPhone || knownPhone || '';
  const status = session?.status || '';

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const name = staffName.trim() || 'Asesor';
      if (typeof window !== 'undefined') localStorage.setItem(STAFF_NAME_KEY, name);
      await addMessage(sessionId, { role: 'staff', text: body, isStaff: true, staffName: name });
      // Tomar la conversación: deja de contestar la IA y el panel muestra "con asesor".
      await updateSessionStatus(sessionId, 'human_assigned', name);
      setText('');
    } catch (e: any) {
      setError('No se pudo enviar. Revisa tu conexión e intenta de nuevo.');
      console.warn('StaffReply send failed:', e);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-brand-600 font-semibold">UniTEC · Atender conversación</p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {customerName || 'Cliente'} {customerPhone ? <span className="text-slate-400 font-normal">· {customerPhone}</span> : <span className="text-slate-400 font-normal">· sin teléfono</span>}
          </p>
          <p className="text-[11px] text-slate-400">
            {status === 'human_assigned' ? 'Con asesor' : status === 'human_requested' ? 'Esperando asesor' : status || 'activa'} · sesión {sessionId.slice(0, 22)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {customerPhone && (
            <a
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
              href={`https://wa.me/${customerPhone.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
          <a className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" href={WA_LINK} target="_blank" rel="noreferrer">
            Línea de equipo
          </a>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl w-full mx-auto">
        {messages.length === 0 && <p className="text-center text-slate-400 text-sm py-10">Cargando la conversación…</p>}
        {messages.map((m) => {
          const mine = m.role === 'staff';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                  mine ? 'bg-brand-600 text-white rounded-br-sm' : m.role === 'user' ? 'bg-white text-slate-800 rounded-bl-sm' : 'bg-slate-200/80 text-slate-700 rounded-bl-sm'
                }`}
              >
                <p className={`text-[10px] mb-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                  {mine ? `Tú (${m.staffName || 'Asesor'})` : m.role === 'user' ? 'Cliente' : 'Decky (bot)'} · {fmtTime(m.timestamp)}
                </p>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <footer className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <input
            className="w-full mb-2 text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Tu nombre (firma el mensaje)"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
          />
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              rows={2}
              placeholder="Escribe tu respuesta al cliente… (Enter envía, Shift+Enter salto de línea)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              onClick={send}
              disabled={sending || !text.trim()}
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaffReply;
