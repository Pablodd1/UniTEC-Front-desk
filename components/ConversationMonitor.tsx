// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, Phone, Clock, AlertTriangle, CheckCircle, X, 
  ChevronRight, Volume2, VolumeX, Tag, StickyNote, 
  Zap, Search, Globe, Monitor, 
  ArrowUpRight, Eye, UserCheck, Timer, 
  Check
} from 'lucide-react';
import { ConversationSession, subscribeToConversation, subscribeToMessages, ConversationMessage, addMessage, updateSessionStatus, addConversationTag, addConversationNote, bumpSessionCounter } from '../services/conversationService';
import { playNotificationSound } from '../services/soundService';

interface ConversationMonitorProps {
  sessions: ConversationSession[];
  onSelectSession: (session: ConversationSession | null) => void;
  onRequestIntervention: (sessionId: string) => void;
  staffId?: string;
  staffName?: string;
  /** When set, the monitor opens this session's conversation automatically (deep-link target). */
  focusSessionId?: string | null;
}

// Canned responses templates
const CANNED_RESPONSES = {
  en: [
    { label: 'Greeting', text: 'Hello! Thank you for contacting us. How can I assist you today?' },
    { label: 'Hold', text: 'Please hold on while I check that for you.' },
    { label: 'Transfer', text: 'I\'m going to transfer you to a specialist who can better assist you.' },
    { label: 'Closing', text: 'Is there anything else I can help you with today?' },
    { label: 'Thanks', text: 'Thank you for choosing us! Have a great day.' },
    { label: 'Follow-up', text: 'I\'ll follow up with you via email shortly.' },
  ],
  es: [
    { label: 'Saludo', text: '¡Hola! Gracias por contactarnos. ¿Cómo puedo ayudarle hoy?' },
    { label: 'Espera', text: 'Por favor espere mientras verifico eso para usted.' },
    { label: 'Transferir', text: 'Voy a transferirle a un especialista que puede ayudarle mejor.' },
    { label: 'Cierre', text: '¿Hay algo más en lo que pueda ayudarle hoy?' },
    { label: 'Gracias', text: '¡Gracias por elegirnos! Que tenga un buen día.' },
    { label: 'Seguimiento', text: 'Me pondré en contacto con usted por correo electrónico en breve.' },
  ]
};

// Chat tags
const CHAT_TAGS = [
  { id: 'sales', label: 'Sales', color: 'bg-green-100 text-green-700' },
  { id: 'support', label: 'Support', color: 'bg-blue-100 text-blue-700' },
  { id: 'complaint', label: 'Complaint', color: 'bg-red-100 text-red-700' },
  { id: 'pricing', label: 'Pricing', color: 'bg-purple-100 text-purple-700' },
  { id: 'technical', label: 'Technical', color: 'bg-orange-100 text-orange-700' },
  { id: 'urgent', label: 'Urgent', color: 'bg-amber-100 text-amber-700' },
  { id: 'follow-up', label: 'Follow-up', color: 'bg-slate-100 text-slate-700' },
];

/** Format timestamp into DD/MM/YY HH:mm for default connection date display */
const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return dateStr;
  }
};

const ConversationMonitor: React.FC<ConversationMonitorProps> = ({ 
  sessions, 
  onSelectSession,
  onRequestIntervention,
  staffId = 'staff_001',
  staffName = 'Admin',
  focusSessionId = null,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [staffResponse, setStaffResponse] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [filterTag, _setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [unreadSessions, setUnreadSessions] = useState<Set<string>>(new Set());
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [visitorInfo, setVisitorInfo] = useState<any>(null);
  const [showVisitorInfo, setShowVisitorInfo] = useState(false);
  const [conversationTimer, setConversationTimer] = useState(0);
  const [firstResponseTime, setFirstResponseTime] = useState<number | null>(null);
  const [_resolutionTimer, _setResolutionTimer] = useState(0);
  const [showSlaAlert, setShowSlaAlert] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Sound notification setup
  useEffect(() => {
    // AudioContext beep from soundService is used directly to avoid 404 errors
  }, []);

  const playSound = useCallback(() => {
    if (soundEnabled) {
      playNotificationSound();
    }
  }, [soundEnabled]);

  // Subscribe to selected conversation
  useEffect(() => {
    if (!selectedSessionId) return;
    
    const unsubscribe = subscribeToConversation(selectedSessionId, (session) => {
      if (!session) return;
      setSelectedSession(session);
      
      // Check for new messages
      if (session.analytics?.messageCount && session.analytics.messageCount > lastMessageCount) {
        setLastMessageCount(session.analytics.messageCount);
        
        // Mark as unread if not currently selected
        if (selectedSessionId !== session.id) {
          setUnreadSessions(prev => new Set(prev).add(session.id));
        }
        
        // Play sound for new messages from user
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'user') {
          playSound();
        }
      }
      
      // Track visitor info
      if (session.userAgent || session.ipAddress || session.referrer) {
        setVisitorInfo({
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          referrer: session.referrer,
          pageUrl: session.pageUrl,
          device: parseDevice(session.userAgent),
          browser: parseBrowser(session.userAgent),
          location: session.location,
          timeOnSite: session.timeOnSite,
          visitCount: session.visitCount,
        });
      }
    });
    
    // Real-time message subscription (live updates without refresh)
    const unsubMessages = subscribeToMessages(selectedSessionId, (msgs) => {
      setMessages(msgs);
    });
    
    return () => {
      unsubscribe();
      unsubMessages();
    };
  }, [selectedSessionId, lastMessageCount, playSound]);

  // Conversation timer
  useEffect(() => {
    if (!selectedSessionId || !selectedSession) return;
    
    if (selectedSession.status === 'completed' || selectedSession.status === 'abandoned') {
      if (selectedSession.duration) {
        setConversationTimer(selectedSession.duration);
      } else {
        const startTime = new Date(selectedSession.createdAt).getTime();
        const endTime = new Date(selectedSession.lastUpdated).getTime();
        setConversationTimer(Math.floor((endTime - startTime) / 1000));
      }
      return;
    }
    
    timerInterval.current = setInterval(() => {
      const startTime = new Date(selectedSession.createdAt).getTime();
      const now = Date.now();
      setConversationTimer(Math.floor((now - startTime) / 1000));
      
      // SLA Alert: if human requested and no response for 2 minutes
      if (selectedSession.status === 'human_requested') {
        const waitTime = now - new Date(selectedSession.lastUpdated).getTime();
        if (waitTime > 120000) { // 2 minutes
          setShowSlaAlert(true);
        }
      }
    }, 1000);
    
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [selectedSessionId, selectedSession]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectSession = (session: ConversationSession) => {
    setSelectedSessionId(session.id);
    onSelectSession(session);
    
    // Remove from unread
    setUnreadSessions(prev => {
      const next = new Set(prev);
      next.delete(session.id);
      return next;
    });
    
    // Track first response time
    if (session.status === 'human_requested' && !firstResponseTime) {
      setFirstResponseTime(Date.now());
    }
  };

  // Deep-link: when a session is requested from elsewhere (e.g. Analytics "Ver Conversación",
  // or a Telegram alert deep link via ?session=), open that session's conversation automatically.
  // Retries when `sessions` loads late; fires once per focusSessionId so it never fights the user.
  const handledFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusSessionId) return;
    if (handledFocusRef.current === focusSessionId) return;
    const target = sessions.find((s) => s.id === focusSessionId);
    if (!target) return; // sessions may still be loading — retried when the list updates
    handledFocusRef.current = focusSessionId;
    if (selectedSessionId !== target.id) handleSelectSession(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSessionId, sessions]);

  const handleSendAsStaff = async () => {
    if (!staffResponse.trim() || !selectedSessionId) return;
    
    setIsSending(true);
    try {
      await addMessage(selectedSessionId, {
        role: 'staff',
        text: staffResponse.trim(),
        isStaff: true,
        staffName: staffName,
      });
      // `analytics.staffInteractions` seguía en 0 con 6+ mensajes de asesor (métrica muerta en el
      // panel). Se cuenta aquí, con un increment sobre el path punteado (nunca con updateAnalytics,
      // que reemplazaría el mapa entero).
      bumpSessionCounter(selectedSessionId, 'staffInteractions', 1).catch(() => {});
      
      setStaffResponse('');
      
      // Track first response time
      if (!firstResponseTime) {
        setFirstResponseTime(Date.now());
      }
    } catch (e) {
      console.error('Failed to send staff message:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleCannedResponse = (text: string) => {
    setStaffResponse(text);
    setShowCannedResponses(false);
  };

  const handleAddTag = async (tagId: string) => {
    if (!selectedSessionId) return;
    try {
      await addConversationTag(selectedSessionId, tagId);
      setShowTags(false);
    } catch (e) {
      console.error('Failed to add tag:', e);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedSessionId) return;
    try {
      await addConversationNote(selectedSessionId, {
        text: noteText.trim(),
        staffId,
        staffName,
      });
      setNoteText('');
      setShowNotes(false);
    } catch (e) {
      console.error('Failed to add note:', e);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStaffResponse(e.target.value);
    
    // Show typing indicator
    setIsTyping(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    
    const timeout = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
    setTypingTimeout(timeout);
  };

  const handleBulkAssign = async () => {
    // In real implementation, this would assign selected conversations to staff
    console.log('Bulk assign:', Array.from(selectedForBulk));
    setSelectedForBulk(new Set());
    setShowBulkActions(false);
  };

  const handleBulkResolve = async () => {
    for (const sessionId of selectedForBulk) {
      await updateSessionStatus(sessionId, 'completed');
    }
    setSelectedForBulk(new Set());
    setShowBulkActions(false);
  };

  const toggleBulkSelect = (sessionId: string) => {
    setSelectedForBulk(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    if (filterStatus === 'abandoned') {
      if (!String(session.status || '').startsWith('abandoned')) return false;
    } else if (filterStatus !== 'all' && session.status !== filterStatus) {
      return false;
    }
    if (filterBrand !== 'all' && session.brandId !== filterBrand) return false;
    if (filterTag !== 'all' && !session.tags?.includes(filterTag)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const clean = query.replace(/[^\d+]/g, '');
      const name = (session.customerName || session.extractedData?.name || '').toLowerCase();
      const text = (session.lastMessage || '').toLowerCase();
      const email = (session.customerEmail || session.extractedData?.email || '').toLowerCase();
      // Búsqueda por TELÉFONO (con o sin formato): era la queja "busco el número registrado y no hay usuario".
      const phone = String(session.customerPhone || session.extractedData?.phone || '');
      const phoneHit = phone && clean.replace(/[^\d]/g, '') !== '' && phone.replace(/[^\d]/g, '').includes(clean.replace(/[^\d]/g, ''));
      return name.includes(query) || text.includes(query) || email.includes(query) || Boolean(phoneHit);
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'human_requested': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'human_assigned': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'completed': return 'bg-slate-50 text-slate-500 border-slate-200';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'AI Active';
      case 'human_requested': return 'Needs Human';
      case 'human_assigned': return 'Staff Active';
      case 'completed': return 'Closed';
      default: return status;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseDevice = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  };

  const parseBrowser = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  // Session list view
  if (!selectedSessionId) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with filters */}
        <div className="bg-white border-b border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Live Mission Control</h3>
              <p className="text-sm text-slate-500">Real-time conversation monitoring</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                title={soundEnabled ? 'Mute notifications' : 'Enable sound'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              {selectedForBulk.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">{selectedForBulk.size} selected</span>
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium"
                  >
                    Actions
                  </button>
                  {showBulkActions && (
                    <div className="absolute right-4 top-14 bg-white shadow-lg rounded-lg border border-slate-200 py-1 z-50">
                      <button onClick={handleBulkAssign} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2">
                        <UserCheck size={14} /> Assign to me
                      </button>
                      <button onClick={handleBulkResolve} className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2">
                        <CheckCircle size={14} /> Resolve
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="human_requested">Needs Human</option>
              <option value="human_assigned">Staff Active</option>
              <option value="abandoned">Abandoned</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">All Brands</option>
              <option value="unitec">UNITEC</option>
              <option value="building">Building Innovation</option>
            </select>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MessageSquare size={12} /> {sessions.filter(s => s.status === 'active').length} active
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle size={12} /> {sessions.filter(s => s.status === 'human_requested').length} waiting
            </span>
            <span className="flex items-center gap-1 text-blue-600">
              <UserCheck size={12} /> {sessions.filter(s => s.status === 'human_assigned').length} with staff
            </span>
            <span className="flex items-center gap-1">
              <Timer size={12} /> Avg wait: {calculateAvgWaitTime(sessions)}s
            </span>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-2">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No conversations match your filters</p>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isUnread = unreadSessions.has(session.id);
                const isSelected = selectedForBulk.has(session.id);
                const waitTime = session.status === 'human_requested' 
                  ? Math.floor((Date.now() - new Date(session.lastUpdated).getTime()) / 1000)
                  : 0;
                
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`bg-white p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                      isUnread ? 'border-brand-300 shadow-sm' : 'border-slate-200'
                    } ${isSelected ? 'ring-2 ring-brand-500' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Bulk select checkbox */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBulkSelect(session.id);
                        }}
                        className={`mt-1 w-4 h-4 rounded border cursor-pointer flex items-center justify-center ${
                          isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {session.source === 'phone' ? (
                              <Phone size={14} className="text-orange-500" />
                            ) : (
                              <MessageSquare size={14} className="text-blue-500" />
                            )}
                            <p className={`font-semibold text-sm truncate ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                              {session.customerName || session.extractedData?.name || 'Anonymous'}
                            </p>
                            {isUnread && (
                              <span className="w-2 h-2 bg-brand-500 rounded-full" />
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(session.status)}`}>
                            {getStatusLabel(session.status)}
                          </span>
                        </div>
                        
                        {/* Preview of last message */}
                        <p className={`text-sm truncate mb-2 ${isUnread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                          {session.lastMessage || 'No messages yet'}
                        </p>
                        
                        {/* Tags */}
                        {session.tags && session.tags.length > 0 && (
                          <div className="flex gap-1 mb-2">
                            {session.tags.map(tag => {
                              const tagDef = CHAT_TAGS.find(t => t.id === tag);
                              return tagDef ? (
                                <span key={tag} className={`px-2 py-0.5 rounded text-[10px] font-medium ${tagDef.color}`}>
                                  {tagDef.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                              <Clock size={10} />
                              {formatDateTime(session.lastUpdated)}
                            </span>
                            <span>{session.analytics?.messageCount || 0} msgs</span>
                            <span className="capitalize">{session.brandId}</span>
                          </div>
                          
                          {session.status === 'human_requested' && waitTime > 0 && (
                            <span className={`flex items-center gap-1 ${waitTime > 120 ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                              <Timer size={10} />
                              {formatTime(waitTime)} waiting
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight size={16} className="text-slate-300 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedSessionId(null);
                onSelectSession(null);
                setVisitorInfo(null);
                setShowVisitorInfo(false);
              }}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <X size={16} />
            </button>
            <div>
              <p className="font-semibold text-slate-800">
                {selectedSession?.customerName || selectedSession?.extractedData?.name || 'Anonymous'}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="capitalize">{selectedSession?.brandId}</span>
                <span>•</span>
                <span>{selectedSession?.language}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Timer size={10} />
                  {formatTime(conversationTimer)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Visitor info toggle */}
            <button
              onClick={() => setShowVisitorInfo(!showVisitorInfo)}
              className={`p-2 rounded-lg ${showVisitorInfo ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Visitor info"
            >
              <Eye size={16} />
            </button>
            
            {/* Tags */}
            <button
              onClick={() => setShowTags(!showTags)}
              className={`p-2 rounded-lg ${showTags ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Add tags"
            >
              <Tag size={16} />
            </button>
            
            {/* Notes */}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-2 rounded-lg ${showNotes ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Private notes"
            >
              <StickyNote size={16} />
            </button>
            
            {(selectedSession?.status === 'human_requested' || selectedSession?.status === 'active') && (
              <button
                onClick={() => selectedSession && onRequestIntervention(selectedSession.id)}
                className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200"
              >
                Take Over
              </button>
            )}
            
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedSession?.status || '')}`}>
              {getStatusLabel(selectedSession?.status || '')}
            </span>
          </div>
        </div>
        
        {/* SLA Alert */}
        {showSlaAlert && selectedSession?.status === 'human_requested' && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle size={14} />
            <span>SLA Alert: Customer waiting over 2 minutes!</span>
            <button 
              onClick={() => setShowSlaAlert(false)}
              className="ml-auto text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Visitor info panel */}
          {showVisitorInfo && visitorInfo && (
            <div className="bg-slate-50 border-b border-slate-200 p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Monitor size={12} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">{visitorInfo.device}</p>
                    <p className="text-slate-400">{visitorInfo.browser}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">{visitorInfo.location || 'Unknown'}</p>
                    <p className="text-slate-400">{visitorInfo.ipAddress || 'No IP'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpRight size={12} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700 truncate max-w-[120px]">{visitorInfo.referrer || 'Direct'}</p>
                    <p className="text-slate-400 truncate max-w-[120px]">{visitorInfo.pageUrl || 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">{formatTime(visitorInfo.timeOnSite || 0)}</p>
                    <p className="text-slate-400">{visitorInfo.visitCount || 1} visits</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No messages yet
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-slate-100 text-slate-800'
                        : msg.role === 'staff'
                        ? 'bg-blue-600 text-white'
                        : 'bg-brand-50 text-brand-900 border border-brand-100'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] opacity-60">
                        {msg.staffName && `Staff: ${msg.staffName}`}
                      </span>
                      <span className="text-[10px] opacity-60">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-end">
                <div className="bg-blue-50 px-3 py-2 rounded-xl text-xs text-blue-600 flex items-center gap-1">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse delay-75">●</span>
                  <span className="animate-pulse delay-150">●</span>
                  <span className="ml-1">typing...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Staff input area */}
          <div className="bg-white border-t border-slate-200 p-4">
            {/* Canned responses */}
            {showCannedResponses && (
              <div className="mb-2 bg-slate-50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Quick Replies</span>
                  <button onClick={() => setShowCannedResponses(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(selectedSession?.language === 'es' ? CANNED_RESPONSES.es : CANNED_RESPONSES.en).map((resp) => (
                    <button
                      key={resp.label}
                      onClick={() => handleCannedResponse(resp.text)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-brand-50 hover:border-brand-200 transition-colors"
                    >
                      {resp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tags selector */}
            {showTags && (
              <div className="mb-2 bg-slate-50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Add Tags</span>
                  <button onClick={() => setShowTags(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {CHAT_TAGS.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tag.color}`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Notes input */}
            {showNotes && (
              <div className="mb-2 bg-slate-50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Private Note (staff only)</span>
                  <button onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add internal note..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                  />
                  <button
                    onClick={handleAddNote}
                    className="px-3 py-2 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowCannedResponses(!showCannedResponses)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                title="Quick replies"
              >
                <Zap size={16} />
              </button>
              <input
                type="text"
                value={staffResponse}
                onChange={handleTyping}
                placeholder="Type a response as staff..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSendAsStaff()}
              />
              <button
                onClick={handleSendAsStaff}
                disabled={isSending || !staffResponse.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Right sidebar: Conversation details */}
        <div className="w-64 bg-slate-50 border-l border-slate-200 overflow-y-auto hidden lg:block">
          <div className="p-4 space-y-4">
            {/* Customer info */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Customer</h4>
              <div className="space-y-2">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Name</p>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedSession?.extractedData?.name || selectedSession?.customerName || 'Unknown'}
                  </p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedSession?.extractedData?.email || selectedSession?.customerEmail || 'N/A'}
                  </p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Phone</p>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedSession?.extractedData?.phone || selectedSession?.customerPhone || 'N/A'}
                  </p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Company</p>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedSession?.extractedData?.company || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Session metrics */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Metrics</h4>
              <div className="space-y-2">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Duration</p>
                  <p className="text-sm font-medium text-slate-800">{formatTime(conversationTimer)}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Messages</p>
                  <p className="text-sm font-medium text-slate-800">{selectedSession?.analytics?.messageCount || 0}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Sentiment</p>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedSession?.sentimentScore ? (selectedSession.sentimentScore > 0.3 ? 'Positive' : selectedSession.sentimentScore < -0.3 ? 'Negative' : 'Neutral') : 'N/A'}
                  </p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Intent</p>
                  <p className="text-sm font-medium text-slate-800 capitalize">
                    {selectedSession?.intentCategory || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Tags */}
            {selectedSession?.tags && selectedSession.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedSession.tags.map(tag => {
                    const tagDef = CHAT_TAGS.find(t => t.id === tag);
                    return tagDef ? (
                      <span key={tag} className={`px-2 py-1 rounded text-[10px] font-medium ${tagDef.color}`}>
                        {tagDef.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            {/* Private notes */}
            {selectedSession?.notes && selectedSession.notes.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Staff Notes</h4>
                <div className="space-y-2">
                  {selectedSession.notes.map((note, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-700">{note.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-400">{note.staffName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(note.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function calculateAvgWaitTime(sessions: ConversationSession[]): number {
  const waitingSessions = sessions.filter(s => s.status === 'human_requested');
  if (waitingSessions.length === 0) return 0;
  
  const totalWait = waitingSessions.reduce((acc, s) => {
    return acc + (Date.now() - new Date(s.lastUpdated).getTime());
  }, 0);
  
  return Math.floor((totalWait / waitingSessions.length) / 1000);
}

export default ConversationMonitor;
