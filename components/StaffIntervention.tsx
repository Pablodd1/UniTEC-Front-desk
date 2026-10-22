import React, { useState, useEffect } from 'react';
import { Phone, Headphones, AlertTriangle, CheckCircle, Clock, Eye } from 'lucide-react';
import { 
  ConversationSession, 
  InterventionRequest, 
  getInterventionRequests, 
  subscribeToInterventions,
  acceptIntervention
} from '../services/conversationService';
import { sendTwilioCall } from '../services/twilioService';
import { notifyInterventionAccepted } from '../services/notificationService';

interface StaffInterventionProps {
  sessions: ConversationSession[];
  onCallCustomer: (phone: string) => void;
}

const StaffIntervention: React.FC<StaffInterventionProps> = ({ sessions, onCallCustomer: _onCallCustomer }) => {
  const [interventions, setInterventions] = useState<InterventionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [_selectedIntervention, _setSelectedIntervention] = useState<InterventionRequest | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [_callNotes, _setCallNotes] = useState('');

  useEffect(() => {
    const loadInterventions = async () => {
      const pending = await getInterventionRequests('pending');
      setInterventions(pending);
    };
    loadInterventions();

    const unsubscribe = subscribeToInterventions((allInterventions) => {
      setInterventions(allInterventions);
    });

    return () => unsubscribe();
  }, []);

  const handleTakeOver = async (intervention: InterventionRequest) => {
    setIsTakingOver(true);
    try {
      await acceptIntervention(intervention.id, 'staff_001');
      await notifyInterventionAccepted(intervention.sessionId, 'Staff Member');
      
      // Update the intervention status locally
      setInterventions(prev => 
        prev.map(i => i.id === intervention.id ? { ...i, status: 'accepted' as const } : i)
      );
      
      _setSelectedIntervention(null);
    } catch (e) {
      console.error('Failed to take over:', e);
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleCallCustomer = async (phone: string) => {
    if (!phone) return;
    const result = await sendTwilioCall(phone);
    if (result.success) {
      alert('Call initiated successfully');
    } else {
      alert('Failed to initiate call: ' + result.error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 text-red-600 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const filteredInterventions = interventions.filter(i => {
    if (activeTab === 'pending') return i.status === 'pending';
    if (activeTab === 'active') return i.status === 'accepted';
    return i.status === 'resolved' || i.status === 'timeout';
  });

  const getSessionById = (sessionId: string) => {
    return sessions.find(s => s.id === sessionId);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 p-4">
        <h3 className="text-lg font-bold text-slate-800">Staff Intervention Center</h3>
        <p className="text-sm text-slate-500">Manage customer requests for staff assistance</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="flex gap-1">
          {[
            { id: 'pending', label: 'Pending', count: interventions.filter(i => i.status === 'pending').length },
            { id: 'active', label: 'Active', count: interventions.filter(i => i.status === 'accepted').length },
            { id: 'history', label: 'History', count: interventions.filter(i => i.status === 'resolved' || i.status === 'timeout').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredInterventions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Headphones size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No {activeTab} interventions</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredInterventions.map((intervention) => {
              const session = getSessionById(intervention.sessionId);
              
              return (
                <div
                  key={intervention.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 hover:border-brand-300 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        intervention.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                        intervention.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {session?.customerName || session?.extractedData?.name || 'Anonymous Customer'}
                          {(session?.customerPhone || session?.extractedData?.phone) && (
                            <span className="ml-2 font-normal text-slate-400">
                              {session?.customerPhone || session?.extractedData?.phone}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          Session: {intervention.sessionId.substring(0, 20)}...
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(intervention.priority)}`}>
                      {intervention.priority}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg mb-3">
                    <p className="text-sm text-slate-700">{intervention.reason}</p>
                    {session?.lastMessage && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        <span className="font-medium">Último mensaje:</span> {session.lastMessage}
                      </p>
                    )}
                  </div>

                  {/* Entrada real al chat: "tomé la conversación y no me salía nada" — la BANDEJA no
                      mostraba el historial ni dejaba responder. Este enlace abre la sesión en MONITOR. */}
                  <a
                    href={`${typeof window !== 'undefined' ? window.location.origin : ''}/?admin=true&session=${encodeURIComponent(intervention.sessionId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 w-full mb-3 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                  >
                    <Eye size={14} /> Abrir conversación
                  </a>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Requested: {new Date(intervention.requestedAt).toLocaleTimeString()}
                    </span>
                    <span className="capitalize">{intervention.requestedBy} request</span>
                  </div>

                  {activeTab === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTakeOver(intervention)}
                        disabled={isTakingOver}
                        className="flex-1 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                      >
                        {isTakingOver ? 'Taking Over...' : 'Take Over Conversation'}
                      </button>
                      <button
                        onClick={() => {
                          const phone = session?.extractedData?.phone || session?.customerPhone;
                          if (phone) handleCallCustomer(phone);
                        }}
                        disabled={!session?.extractedData?.phone && !session?.customerPhone}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        <Phone size={14} />
                      </button>
                    </div>
                  )}

                  {activeTab === 'active' && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm">
                      <CheckCircle size={14} />
                      <span>You are handling this conversation</span>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <CheckCircle size={14} />
                      <span>Resolved: {intervention.resolvedAt ? new Date(intervention.resolvedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffIntervention;

