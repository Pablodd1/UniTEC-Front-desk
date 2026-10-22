// @ts-nocheck
// grokVoiceService.ts — llamada de voz con Grok Voice 3.0 (speech-to-speech, WebSocket).
//
// Por qué existe: el motor anterior hacía STT → LLM (texto) → TTS, y medido en vivo eran ~3.5-4.5 s
// desde que el cliente calla hasta que oye la respuesta (el TTS era 2.1-2.5 s). Con speech-to-speech
// de xAI el audio de respuesta empieza en menos de un segundo (docs: 0.7-1.0 s tras el silencio).
//
// PARIDAD con el chat de texto:
//   · mismas instrucciones (getSystemInstruction + trainingData que entrega /api/xai-voice-token)
//   · mismos turnos grabados en Firestore (addMessage user/model) y mismos contadores
//   · mismo escalamiento a asesor (palabras clave espejo de api/turn-text.js)
//   · misma extracción de nombre/teléfono para el CRM (extractCustomerData)
// Lo único distinto es el modelo que redacta (grok-voice en vez de gemini-flash) y el acento.
//
// Auth: el navegador NO lleva la API key: /api/xai-voice-token acuña un client secret efímero y aquí se
// conecta con el subprotocolo `xai-client-secret.<token>`.
import { getSystemInstruction } from '../constants';
import { addMessage, extractCustomerData, updateSessionStatus } from './conversationService';
import { triggerEscalation } from './notificationService';

const WS_URL = 'wss://api.x.ai/v1/realtime?model=grok-voice-latest';
const SAMPLE_RATE = 24000;
const VOICE = 'celeste'; // voz de soporte, cálida y profesional; 'eve' es acento británico (no sirve para es-CO)
// xAI no lista es-CO: se usa es-MX como variante regional y el acento colombiano se pide por prompt.
const LANG_HINT = 'es-MX';

// Espejo de api/turn-text.js (STAFF_WORDS + QUOTE_WORDS) — mantener en sync.
const ESCALATION_WORDS = ['asesor', 'humano', 'human', 'agente', 'agent', 'staff', 'llamar',
  'call me', 'speak to someone', 'talk to someone', 'hablar con alguien', 'hablar con una persona',
  'persona real', 'ejecutivo', 'vendedor', 'representante', 'comunicame', 'comunícame',
  'me contacte', 'me contacten', 'que me llame', 'que me llames',
  'urgente', 'urgencia', 'emergencia', 'cotiz', 'presupuesto', 'quote', 'budget'];

const b64FromBytes = (bytes: Uint8Array): string => {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(bin);
};

const bytesFromB64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const floatToPcm16 = (input: Float32Array): Int16Array => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

export interface GrokVoiceCallbacks {
  onOpen?: () => void;
  onStatusChange?: (s: string) => void;
  onMessage?: (text: string, audio?: any, isTakeover?: boolean, role?: 'user' | 'model') => void;
  onError?: (err: any) => void;
  onClose?: () => void;
}

/**
 * Conecta la llamada con Grok Voice. Lanza si el token o el socket fallan ANTES de abrir sesión,
 * para que CallTab pueda caer al motor anterior sin dejar al cliente sin llamada.
 */
export async function connectGrokVoice(
  callbacks: GrokVoiceCallbacks,
  language: 'es' | 'en' = 'es',
  brandId: string = 'unitec',
  sessionId: string = '',
  customGreeting?: string,
) {
  // ── 1. Token efímero + training ────────────────────────────────────────────
  const tokenRes = await fetch('/api/xai-voice-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'grok-voice-latest' }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData?.token) {
    throw new Error(tokenData?.error || `voice_token_${tokenRes.status}`);
  }

  // ── 2. Micrófono (24 kHz mono) ─────────────────────────────────────────────
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new Ctx({ sampleRate: SAMPLE_RATE });

  // ── 3. Instrucciones: MISMO prompt que el texto + training del panel ────────
  let instructions = getSystemInstruction(language as any, customGreeting, brandId as any, undefined, true);
  if (tokenData.training) {
    instructions += `\n\n[CUSTOM MODEL TRAINING - FOLLOW THESE PAUTAS/RESPONSE GUIDELINES EXACTLY]:\n${tokenData.training}`;
  }
  instructions += '\n\n# VOZ (Grok Voice)' +
    '\n- REGLA DE PRECEDENCIA: si el [CUSTOM MODEL TRAINING] pide enviar un texto "sin cambiar la redacción", eso aplica al chat ESCRITO. En VOZ se resume: lee solo lo esencial y ofrece el resto por WhatsApp.' +
    '\n- Habla con acento colombiano neutro, cálido y profesional. Tuteo cordial.' +
    '\n- NUNCA uses apelativos íntimos ni diminutivos: prohibido "mi amor", "corazón", "cariño", "mi rey", "bebé".' +
    '\n- Empieza saludando en UNA frase y luego espera: "¡Hola! Bienvenido a UNITEC USA DESIGN, ¿en qué te ayudo?"' +
    '\n- Cada turno: 1-2 frases cortas, máximo 20 palabras, sin URLs ni listas. Estás HABLANDO, no escribiendo: nada de párrafos.' +
    '\n- SHOWROOM/UBICACIÓN: di SOLO "Tenemos showroom en Miami, en 6100 NW 74th Ave, y la atención es con cita previa" y ofrece enviarle la dirección y los detalles por WhatsApp. NUNCA leas el párrafo completo del training en voz alta.' +
    '\n- ASESOR/COTIZACIÓN: di "Ya avisé a un asesor del equipo, te escribirá por aquí en breve" y pide nombre y número solo si todavía no los tienes.';

  // ── 4. Socket ─────────────────────────────────────────────────────────────
  const ws = new WebSocket(WS_URL, [`xai-client-secret.${tokenData.token}`]);
  let sessionReady = false;
  let closed = false;

  const status = (s: string) => callbacks.onStatusChange?.(s);
  const say = (text: string, role: 'user' | 'model') => {
    if (!text || !text.trim()) return;
    callbacks.onMessage?.(text.trim(), null, false, role);
    if (sessionId) {
      addMessage(sessionId, {
        id: (role === 'user' ? 'gv_u_' : 'gv_b_') + Date.now(),
        role,
        text: text.trim(),
      }).catch(() => {});
    }
  };

  // Playback: se encola el PCM16 de `response.output_audio.delta` sin cortes.
  let playCursor = 0;
  let speakingUntil = 0;
  const enqueueAudio = (b64: string) => {
    const pcm = bytesFromB64(b64);
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
    if (!samples.length) return;
    const buf = audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 0x8000;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const at = Math.max(audioCtx.currentTime + 0.02, playCursor);
    src.connect(audioCtx.destination);
    src.start(at);
    playCursor = at + buf.duration;
    speakingUntil = Date.now() + buf.duration * 1000;
  };

  // Turnos: transcripción del cliente y del bot.
  let userTurn = '';
  let botTurn = '';
  let escalated = false;

  const finalizeUserTurn = () => {
    const text = userTurn.trim();
    userTurn = '';
    if (!text) return;
    say(text, 'user');
    // CRM: misma extracción que en el chat de texto.
    if (sessionId) {
      const name = (text.match(/(?:me\s+llamo|mi\s+nombre\s+es|soy)\s+([a-záéíóúñ]{2,30})/i) || [])[1];
      const phone = (text.match(/(\+?\d[\d\s\-().]{6,})/) || [])[1];
      if (name || phone) {
        extractCustomerData(sessionId, {
          ...(name ? { name: name.charAt(0).toUpperCase() + name.slice(1) } : {}),
          ...(phone ? { phone: phone.trim() } : {}),
        } as any).catch(() => {});
      }
    }
    // Escalamiento: mismos disparadores que el texto, una vez por llamada.
    const low = text.toLowerCase();
    if (!escalated && sessionId && ESCALATION_WORDS.some((k) => low.includes(k))) {
      escalated = true;
      const isQuote = /cotiz|presupuesto|quote|budget/.test(low);
      triggerEscalation({
        type: isQuote ? 'quote' : 'staff',
        priority: 'high',
        message: text,
        brand: brandId,
        sessionId,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        waitingSince: new Date().toISOString(),
      }).catch(() => {});
      updateSessionStatus(sessionId, 'human_requested', undefined, {
        escalationType: isQuote ? 'quote' : 'staff',
      }).catch(() => {});
      say(language === 'en'
        ? '✅ I let our team know — an advisor will write to you shortly.'
        : '✅ Ya avisé a un asesor del equipo: te escribirá por aquí en breve.', 'model');
    }
  };

  const finalizeBotTurn = () => {
    const text = botTurn.trim();
    botTurn = '';
    if (text) say(text, 'model');
  };

  // ── 5. Micrófono → socket (PCM16 base64, ~100 ms por frame) ────────────────
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  let pending: number[] = [];
  const FRAME = SAMPLE_RATE / 10; // 100 ms
  processor.onaudioprocess = (e) => {
    if (closed || !sessionReady) return;
    // No mandar audio mientras el bot habla (evita el eco del altavoz); 0,3 s de cola.
    if (Date.now() < speakingUntil + 300) return;
    const data = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) pending.push(data[i]);
    while (pending.length >= FRAME) {
      const frame = new Float32Array(pending.slice(0, FRAME));
      pending = pending.slice(FRAME);
      const pcm = floatToPcm16(frame);
      try {
        ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: b64FromBytes(new Uint8Array(pcm.buffer)),
        }));
      } catch (_) { /* socket cerrando */ }
    }
  };
  source.connect(processor);
  processor.connect(audioCtx.destination);

  // ── 6. Eventos del servidor ────────────────────────────────────────────────
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        voice: tokenData.voice || VOICE,
        instructions,
        turn_detection: { type: 'server_vad', silence_duration_ms: 700, prefix_padding_ms: 300 },
        audio: {
          input: { format: { type: 'audio/pcm', rate: SAMPLE_RATE }, transcription: { model: 'grok-transcribe', language_hint: LANG_HINT } },
          output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
        },
      },
    }));
  };

  ws.onmessage = (ev) => {
    let event: any;
    try { event = JSON.parse(String(ev.data)); } catch (_) { return; }
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        if (!sessionReady) {
          sessionReady = true;
          status('connected');
          callbacks.onOpen?.();
          // Saludo hablado: el prompt ya lo pide; este response.create lo dispara.
          ws.send(JSON.stringify({ type: 'response.create' }));
        }
        break;
      case 'input_audio_buffer.speech_started':
        status('listening');
        break;
      case 'conversation.item.input_audio_transcription.updated':
        userTurn = event.transcript || userTurn;
        break;
      case 'conversation.item.input_audio_transcription.completed':
        userTurn = event.transcript || userTurn;
        finalizeUserTurn();
        break;
      case 'response.output_audio.delta':
        status('speaking');
        enqueueAudio(event.delta);
        break;
      case 'response.output_audio_transcript.delta':
        botTurn += event.delta || '';
        break;
      case 'response.done':
        finalizeBotTurn();
        if (!closed) status('listening');
        break;
      case 'error':
        console.warn('[grok-voice] error event', event?.error || event);
        if (!sessionReady) {
          closed = true;
          callbacks.onError?.(new Error(event?.error?.message || 'grok_voice_error'));
        }
        break;
      default:
        break;
    }
  };

  ws.onerror = () => {
    if (!sessionReady && !closed) {
      closed = true;
      callbacks.onError?.(new Error('grok_voice_socket_error'));
    }
  };

  ws.onclose = () => {
    if (!closed) {
      closed = true;
      status('idle');
      callbacks.onClose?.();
    }
  };

  // ── 7. Cierre limpio ──────────────────────────────────────────────────────
  const disconnect = async () => {
    closed = true;
    try { processor.disconnect(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
    try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { ws.close(); } catch (_) {}
    try { await audioCtx.close(); } catch (_) {}
    callbacks.onClose?.();
  };

  return { disconnect, provider: 'grok-voice' as const };
}
