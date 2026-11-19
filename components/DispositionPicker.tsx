import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, AlertTriangle } from 'lucide-react';
import { saveSessionDisposition } from '../services/conversationService';

// Tipificación obligatoria de las interacciones transferidas como URGENTE.
//
// El backend ya existía (/api/staff-disposition + guard en /api/session-resolve), pero NO había
// ningún selector en la interfaz: el asesor no tenía forma de registrar el resultado y la sesión
// quedaba bloqueada (409) sin manera de cerrarla. Este componente es esa pieza.
//
// Requisito del cliente: estados de la lista de 12, obligatorio antes de cerrar. Campos extra:
// seguimiento → fecha; venta no efectiva / no interesado / fuera de cobertura / reclamación → nota.

const REQUIRED_FIELDS: Record<string, string[]> = {
  VENTA_EFECTIVA: [],
  SEGUIMIENTO_PENDIENTE: ['followUpAt'],
  VENTA_NO_EFECTIVA: ['note'],
  CLIENTE_NO_INTERESADO: ['note'],
  FUERA_COBERTURA: ['note'],
  RECLAMACION: ['note'],
};

export interface DispositionType { code: string; label: string; active?: boolean }

interface Props {
  sessionId: string;
  required: boolean;
  done?: boolean;
  current?: { code?: string; label?: string; note?: string; followUpAt?: string };
  /** Token del enlace de alerta (?staff=…). Con token se usa el endpoint (valida + audita). */
  staffToken?: string;
  staffName?: string;
  onSaved?: (code: string, label: string) => void;
}

const DispositionPicker: React.FC<Props> = ({ sessionId, required, done, current, staffToken, staffName, onSaved }) => {
  const [types, setTypes] = useState<DispositionType[]>([]);
  const [code, setCode] = useState(current?.code || '');
  const [note, setNote] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ code: string; label: string } | null>(
    done && current?.code ? { code: current.code, label: current.label || current.code } : null
  );

  useEffect(() => {
    let alive = true;
    fetch('/api/disposition-types')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.types)) setTypes(d.types.filter((t: DispositionType) => t.active !== false)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const needsNote = useMemo(() => (REQUIRED_FIELDS[code] || []).includes('note'), [code]);
  const needsDate = useMemo(() => (REQUIRED_FIELDS[code] || []).includes('followUpAt'), [code]);

  if (!required && !done) return null;

  const save = async () => {
    setError(null);
    if (!code) { setError('Selecciona el resultado de la atención.'); return; }
    if (needsNote && !note.trim()) { setError('Escribe una nota: es obligatoria para este resultado.'); return; }
    if (needsDate && !followUpAt) { setError('Indica la fecha de seguimiento.'); return; }
    setSaving(true);
    const label = types.find((t) => t.code === code)?.label || code;
    try {
      if (staffToken) {
        const r = await fetch('/api/staff-disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: staffToken, sessionId, code, note: note.trim(), followUpAt, staffName: staffName || 'Asesor' }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d?.ok === false) throw new Error(d?.error || `HTTP ${r.status}`);
      } else {
        // Panel: escribe la sesión + el documento de auditoría desde el cliente (misma sesión de
        // Firestore que ya usa el panel para responder y cerrar).
        await saveSessionDisposition(sessionId, {
          code, label, note: note.trim(), followUpAt, byName: staffName || 'Asesor',
        });
      }
      setSaved({ code, label });
      onSaved?.(code, label);
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la tipificación.');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
        <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-800">
          <p className="font-bold">Tipificación registrada</p>
          <p>{saved.label} · {saved.code}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-amber-800">
        <ClipboardList size={15} />
        <p className="text-xs font-bold uppercase tracking-wide">Tipificación obligatoria</p>
      </div>
      <p className="text-[11px] text-amber-700">
        Esta conversación llegó como atención urgente. Registra el resultado para poder cerrarla.
      </p>
      <select
        value={code}
        onChange={(e) => { setCode(e.target.value); setSaved(null); }}
        className="w-full text-sm p-2 rounded-lg border border-amber-300 bg-white"
      >
        <option value="">— Selecciona el resultado —</option>
        {types.map((t) => (
          <option key={t.code} value={t.code}>{t.label}</option>
        ))}
      </select>
      {needsDate && (
        <input
          type="date"
          value={followUpAt}
          onChange={(e) => setFollowUpAt(e.target.value)}
          className="w-full text-sm p-2 rounded-lg border border-amber-300 bg-white"
        />
      )}
      {needsNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Nota (obligatoria para este resultado)"
          className="w-full text-sm p-2 rounded-lg border border-amber-300 bg-white resize-none"
        />
      )}
      {error && (
        <p className="text-[11px] text-red-700 flex items-center gap-1">
          <AlertTriangle size={12} /> {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={saving || !code}
        className="w-full py-2 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <ClipboardList size={13} />}
        Guardar tipificación
      </button>
    </div>
  );
};

export default DispositionPicker;
