// ============================================================
// FILE: RetrainingAnalytics.tsx
// PURPOSE: Permanent chat memory, AI summaries, Q&A extraction,
//          backfill of all historical sessions, daily analytics.
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain, RefreshCw, Download, ChevronDown, ChevronUp,
  MessageSquare, Tag, Calendar, Sparkles, AlertCircle,
  CheckCircle2, Clock, Filter, Database, Zap, Users
} from "lucide-react";
import { ConversationSession } from "../services/conversationService";
import { generateConversationSummary } from "../services/geminiService";
import {
  saveConversationSummary,
  getSessionsWithSummaries,
  getAllSessionsForBackfill
} from "../services/conversationService";

interface RetrainingAnalyticsProps {
  liveSessions: ConversationSession[];
}

interface GroupedByDay { [date: string]: ConversationSession[]; }

interface BackfillState {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  running: boolean;
  done: boolean;
  currentName: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  products:    "bg-blue-100 text-blue-700",
  pricing:     "bg-emerald-100 text-emerald-700",
  shipping:    "bg-orange-100 text-orange-700",
  services:    "bg-purple-100 text-purple-700",
  general:     "bg-slate-100 text-slate-700",
  complaint:   "bg-red-100 text-red-700",
  appointment: "bg-cyan-100 text-cyan-700",
};

const RetrainingAnalytics: React.FC<RetrainingAnalyticsProps> = ({ liveSessions }) => {
  const [allSessions, setAllSessions]         = useState<ConversationSession[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays]       = useState<Set<string>>(new Set());
  const [summarizingId, setSummarizingId]     = useState<string | null>(null);
  const [filterCategory, setFilterCategory]   = useState<string>("all");
  const [activeView, setActiveView]           = useState<"sessions" | "qa" | "daily">("sessions");
  const [backfill, setBackfill]               = useState<BackfillState>({
    total: 0, processed: 0, succeeded: 0, failed: 0,
    running: false, done: false, currentName: ""
  });
  const abortRef = useRef(false);

  // ── Load sessions (completed + live) ──────────────────────
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await getSessionsWithSummaries();
      const liveCompleted = liveSessions.filter(s => s.status === "completed");
      const existingIds = new Set(fetched.map(s => s.id));
      const merged = [...fetched, ...liveCompleted.filter(s => !existingIds.has(s.id))];
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllSessions(merged);
    } catch (e) {
      console.error("Error loading sessions:", e);
    } finally {
      setIsLoading(false);
    }
  }, [liveSessions]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Auto-summarize newly completed live sessions ──────────
  useEffect(() => {
    liveSessions
      .filter(s => s.status === "completed" && !s.summary && s.messages && s.messages.length > 0)
      .forEach(async (session) => {
        try {
          const msgs = session.messages.map(m => ({ role: m.role, text: m.text }));
          const result = await generateConversationSummary(msgs, session.brandId);
          await saveConversationSummary(session.id, result.summary, result.qaPairs);
          setAllSessions(prev => prev.map(s =>
            s.id === session.id
              ? { ...s, summary: result.summary, qaPairs: result.qaPairs, summaryGeneratedAt: new Date().toISOString() }
              : s
          ));
        } catch (e) { console.error("Auto-summarize failed:", e); }
      });
  }, [liveSessions]);

  // ── Manual single-session summarize ──────────────────────
  const handleGenerateSummary = async (session: ConversationSession) => {
    if (summarizingId) return;
    setSummarizingId(session.id);
    try {
      const msgs = (session.messages || []).map(m => ({ role: m.role, text: m.text }));
      if (!msgs.length) return;
      const result = await generateConversationSummary(msgs, session.brandId);
      await saveConversationSummary(session.id, result.summary, result.qaPairs);
      setAllSessions(prev => prev.map(s =>
        s.id === session.id
          ? { ...s, summary: result.summary, qaPairs: result.qaPairs, summaryGeneratedAt: new Date().toISOString() }
          : s
      ));
    } finally { setSummarizingId(null); }
  };

  // ── BACKFILL: pull every historical chat and summarize ────
  const handleBackfillAll = async () => {
    if (backfill.running) return;
    abortRef.current = false;

    let all: ConversationSession[] = [];
    try {
      all = await getAllSessionsForBackfill();
    } catch (e) {
      console.error("Backfill fetch failed:", e);
      return;
    }

    // Only sessions with messages and no existing summary
    const pending = all.filter(s => s.messages && s.messages.length > 0 && !s.summary);

    if (pending.length === 0) {
      setBackfill(p => ({ ...p, done: true, total: 0 }));
      return;
    }

    setBackfill({ total: pending.length, processed: 0, succeeded: 0, failed: 0, running: true, done: false, currentName: "" });

    // Merge all fetched into state so they show in the UI
    setAllSessions(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const newOnes = all.filter(s => !existingIds.has(s.id));
      return [...prev, ...newOnes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      if (abortRef.current) break;
      const session = pending[i];
      const displayName = session.customerName || `Sesión ${session.id.slice(0, 6)}`;

      setBackfill(p => ({ ...p, processed: i, currentName: displayName }));

      try {
        const msgs = session.messages.map((m: any) => ({ role: m.role, text: m.text }));
        const result = await generateConversationSummary(msgs, session.brandId);
        await saveConversationSummary(session.id, result.summary, result.qaPairs);
        succeeded++;
        setAllSessions(prev => prev.map(s =>
          s.id === session.id
            ? { ...s, summary: result.summary, qaPairs: result.qaPairs, summaryGeneratedAt: new Date().toISOString() }
            : s
        ));
      } catch {
        failed++;
      }

      setBackfill(p => ({ ...p, processed: i + 1, succeeded, failed }));
      // Small pause to avoid API rate limits
      await new Promise(r => setTimeout(r, 800));
    }

    setBackfill(p => ({ ...p, running: false, done: true, currentName: "" }));
  };

  const handleAbortBackfill = () => { abortRef.current = true; };

  // ── Helpers ───────────────────────────────────────────────
  const toggleSession = (id: string) => setExpandedSessions(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleDay = (date: string) => setExpandedDays(prev => {
    const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n;
  });

  const groupedByDay: GroupedByDay = allSessions.reduce((acc, s) => {
    const day = new Date(s.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {} as GroupedByDay);

  const days = Object.keys(groupedByDay);
  const allQAPairs = allSessions.flatMap(s =>
    (s.qaPairs || []).map(qa => ({ ...qa, sessionId: s.id, sessionDate: s.createdAt, brandId: s.brandId }))
  );
  const filteredQA = filterCategory === "all" ? allQAPairs : allQAPairs.filter(qa => qa.category === filterCategory);
  const unsummarizedCount = allSessions.filter(s => !s.summary && s.messages && s.messages.length > 0).length;

  const handleExportQA = () => {
    const rows = allQAPairs.map(qa => ({
      Pregunta: qa.question, Respuesta: qa.answer,
      Categoría: qa.category || "general",
      Fecha: new Date(qa.sessionDate).toLocaleDateString(),
    }));
    const csv = [
      ["Pregunta", "Respuesta", "Categoría", "Fecha"].join(","),
      ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `qa-reentrenamiento-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={32} className="animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Cargando memoria permanente...</p>
        </div>
      </div>
    );
  }

  const backfillProgress = backfill.total > 0 ? Math.round((backfill.processed / backfill.total) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">Memoria Permanente</h2>
            <p className="text-xs text-slate-500">
              {allSessions.length} conversaciones · {allQAPairs.length} pares Q&A · {allSessions.filter(s=>!!s.summary).length} resumidas por IA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* BACKFILL BUTTON */}
          {!backfill.running && (
            <button
              onClick={handleBackfillAll}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-black hover:opacity-90 transition-all shadow-lg"
            >
              <Database size={14} />
              Importar historial completo
            </button>
          )}
          {backfill.running && (
            <button
              onClick={handleAbortBackfill}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-black hover:bg-red-700"
            >
              ⛔ Detener
            </button>
          )}
          {unsummarizedCount > 0 && !backfill.running && (
            <button
              onClick={() => allSessions.filter(s => !s.summary && s.messages?.length).forEach(s => handleGenerateSummary(s))}
              disabled={!!summarizingId}
              className="flex items-center gap-2 px-3 py-2 bg-violet-100 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-200 transition-all"
            >
              <Sparkles size={14} />
              Resumir {unsummarizedCount} pendientes
            </button>
          )}
          <button
            onClick={handleExportQA}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
          >
            <Download size={14} />
            Exportar Q&A
          </button>
          <button onClick={loadSessions} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Backfill Progress Bar ── */}
      {(backfill.running || backfill.done) && (
        <div className={`rounded-2xl p-5 border ${backfill.done && !backfill.running ? "bg-emerald-50 border-emerald-200" : "bg-indigo-50 border-indigo-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {backfill.running ? <Zap size={16} className="text-indigo-600 animate-pulse" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
              <span className="text-sm font-black text-slate-800">
                {backfill.running ? `Procesando historial... ${backfill.processed}/${backfill.total}` : `✅ Importación completa — ${backfill.succeeded} sesiones memorizadas`}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-500">{backfillProgress}%</span>
          </div>
          {backfill.total > 0 && (
            <div className="w-full bg-white rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${backfill.done ? "bg-emerald-500" : "bg-indigo-500"}`}
                style={{ width: `${backfillProgress}%` }}
              />
            </div>
          )}
          {backfill.running && backfill.currentName && (
            <p className="text-[10px] text-slate-500 mt-2">Analizando: <span className="font-bold">{backfill.currentName}</span></p>
          )}
          {backfill.done && backfill.total === 0 && (
            <p className="text-xs text-emerald-700 mt-1">Todas las conversaciones ya están en la memoria permanente. 🎉</p>
          )}
          {(backfill.failed > 0) && (
            <p className="text-[10px] text-red-500 mt-1">{backfill.failed} sesión(es) fallaron (sin mensajes o error de API).</p>
          )}
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Archivadas", value: allSessions.length, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Con Resumen IA",   value: allSessions.filter(s=>!!s.summary).length, icon: Brain, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Pares Q&A",        value: allQAPairs.length, icon: Tag, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Sin Resumir",      value: unsummarizedCount, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 border border-white`}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={14} className={stat.color} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── View Switcher ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["sessions", "qa", "daily"] as const).map(view => (
          <button key={view} onClick={() => setActiveView(view)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === view ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {view === "sessions" ? "📜 Sesiones" : view === "qa" ? "💬 Banco Q&A" : "📊 Reporte Diario"}
          </button>
        ))}
      </div>

      {/* ══════════════ VIEW: SESSIONS ══════════════ */}
      {activeView === "sessions" && (
        <div className="space-y-4">
          {days.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Database size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">Sin conversaciones archivadas</p>
              <p className="text-xs mt-1">Haz clic en <strong>«Importar historial completo»</strong> para traer todos los chats anteriores.</p>
            </div>
          ) : (
            days.map(day => {
              const sessions = groupedByDay[day];
              const withSummary = sessions.filter(s => !!s.summary).length;
              const totalQA = sessions.reduce((a, s) => a + (s.qaPairs?.length || 0), 0);
              const isOpen = expandedDays.has(day);
              return (
                <div key={day} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button onClick={() => toggleDay(day)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Calendar size={16} className="text-brand-600" />
                      <span className="font-bold text-slate-800 text-sm">{day}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{sessions.length} chats</span>
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">{withSummary}/{sessions.length} IA</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{totalQA} Q&A</span>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {sessions.map(session => {
                        const isExpanded = expandedSessions.has(session.id);
                        const msgCount = session.messages?.length || 0;
                        const hasSummary = !!session.summary;
                        return (
                          <div key={session.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800 text-sm truncate">{session.customerName || "Visitante Anónimo"}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase ${session.brandId === "unitec" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>{session.brandId}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black flex items-center gap-1 ${hasSummary ? "bg-violet-100 text-violet-600" : "bg-orange-100 text-orange-600"}`}>
                                    {hasSummary ? <><CheckCircle2 size={8}/> IA Resumida</> : <><Clock size={8}/> Sin resumen</>}
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${session.status === "completed" ? "bg-slate-100 text-slate-500" : session.status === "active" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>{session.status}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-slate-400">{new Date(session.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
                                  <span className="text-[10px] text-slate-400">{msgCount} mensajes</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {!hasSummary && msgCount > 0 && (
                                  <button onClick={() => handleGenerateSummary(session)} disabled={!!summarizingId}
                                    className="flex items-center gap-1 px-2 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-bold hover:bg-violet-700 disabled:opacity-50">
                                    {summarizingId === session.id ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                    {summarizingId === session.id ? "Analizando..." : "Resumir IA"}
                                  </button>
                                )}
                                <button onClick={() => toggleSession(session.id)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                  {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 space-y-4">
                                {hasSummary && (
                                  <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Brain size={14} className="text-violet-600" />
                                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Resumen IA</span>
                                      {session.summaryGeneratedAt && <span className="text-[9px] text-violet-400 ml-auto">{new Date(session.summaryGeneratedAt).toLocaleString("es-CO")}</span>}
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">{session.summary}</p>
                                  </div>
                                )}
                                {session.qaPairs && session.qaPairs.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pares Q&A ({session.qaPairs.length})</p>
                                    {session.qaPairs.map((qa, i) => (
                                      <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <p className="text-xs font-bold text-slate-800">❓ {qa.question}</p>
                                          {qa.category && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${CATEGORY_COLORS[qa.category] || "bg-slate-100 text-slate-600"}`}>{qa.category}</span>}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">💬 {qa.answer}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {session.messages && session.messages.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Transcripción ({msgCount} mensajes)</p>
                                    <div className="max-h-52 overflow-y-auto space-y-2 bg-slate-50 rounded-xl p-3">
                                      {session.messages.map((msg: any, i: number) => (
                                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                          <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${msg.role === "user" ? "bg-brand-600 text-white" : msg.role === "staff" ? "bg-orange-100 text-orange-800 border border-orange-200" : "bg-white text-slate-700 border border-slate-200"}`}>
                                            {msg.isStaff && <span className="text-[9px] font-black block mb-1 opacity-70">STAFF: {msg.staffName}</span>}
                                            {msg.text}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════════════ VIEW: BANCO Q&A ══════════════ */}
      {activeView === "qa" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-slate-400" />
            {["all","products","pricing","shipping","services","general","complaint","appointment"].map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${filterCategory === cat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {cat === "all" ? "Todos" : cat}
              </button>
            ))}
          </div>
          {filteredQA.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Tag size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">Sin pares Q&A disponibles</p>
              <p className="text-xs mt-1">Importa el historial y genera resúmenes IA para extraer Q&A</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredQA.map((qa, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-200 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-slate-800 leading-relaxed">❓ {qa.question}</p>
                    {qa.category && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${CATEGORY_COLORS[qa.category] || "bg-slate-100 text-slate-600"}`}>{qa.category}</span>}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">💬 {qa.answer}</p>
                  <p className="text-[9px] text-slate-400 mt-2">{new Date(qa.sessionDate).toLocaleDateString("es-CO")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ VIEW: REPORTE DIARIO ══════════════ */}
      {activeView === "daily" && (
        <div className="space-y-4">
          {days.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Calendar size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">Sin datos suficientes</p>
            </div>
          ) : (
            days.map(day => {
              const sessions = groupedByDay[day];
              const totalMsg = sessions.reduce((a, s) => a + (s.messages?.length || 0), 0);
              const withSummary = sessions.filter(s => !!s.summary).length;
              const dayQA = sessions.flatMap(s => s.qaPairs || []);
              const catCounts = dayQA.reduce((acc, qa) => {
                const c = qa.category || "general"; acc[c] = (acc[c] || 0) + 1; return acc;
              }, {} as Record<string, number>);
              const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
              const summaries = sessions.filter(s => s.summary).map(s => s.summary!);
              const humanHandoffs = sessions.filter(s => s.status === "human_assigned").length;

              return (
                <div key={day} className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-brand-600" />
                      <h3 className="font-black text-slate-800">{day}</h3>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">{sessions.length} sesiones</span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded-full font-bold">{totalMsg} mensajes</span>
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">{humanHandoffs} handoffs humanos</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Distribución de Temas</p>
                      {topCats.length === 0
                        ? <p className="text-xs text-slate-400">Sin datos de categorías aún</p>
                        : topCats.map(([cat, count]) => (
                          <div key={cat} className="flex items-center gap-2 mb-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${CATEGORY_COLORS[cat] || "bg-slate-100 text-slate-600"}`}>{cat}</span>
                            <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                              <div className="bg-brand-500 h-full rounded-full" style={{ width: `${(count / (topCats[0]?.[1] || 1)) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600">{count}</span>
                          </div>
                        ))
                      }
                    </div>
                    <div className="bg-violet-50 rounded-xl p-4">
                      <p className="text-[10px] font-black text-violet-400 uppercase tracking-wider mb-3">Resúmenes del Día ({summaries.length})</p>
                      {summaries.length === 0
                        ? <p className="text-xs text-slate-400">Sin resúmenes aún — usa el botón "Importar historial"</p>
                        : <div className="space-y-2 max-h-36 overflow-y-auto">
                          {summaries.map((s, i) => <p key={i} className="text-xs text-slate-700 leading-relaxed border-b border-violet-100 pb-2 last:border-0">• {s}</p>)}
                        </div>
                      }
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-slate-500">Cobertura IA</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-200 rounded-full h-1.5">
                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${sessions.length > 0 ? (withSummary/sessions.length)*100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{withSummary}/{sessions.length}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default RetrainingAnalytics;
