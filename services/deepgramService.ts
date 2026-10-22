// @ts-nocheck
// deepgramService.ts — Voice TTS/STT with cascading fallback
// Priority: Fish Audio S2 Pro → Deepgram Aura 2 → Browser WebSpeech
// Same exports as before — callers (geminiService.ts) need zero changes

// ─── Audio Player Helper ──────────────────────────────────────────────────
function playAudioBlob(blob: Blob): Promise<void> {
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  return new Promise((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(audioUrl); resolve(); };
    audio.play().catch(() => { URL.revokeObjectURL(audioUrl); resolve(); });
  });
}

// ─── Fish Audio (primary) ─────────────────────────────────────────────────
// Si la key no está configurada en el servidor, cada turno gastaba una ida y vuelta (400) antes
// de caer a Deepgram. Se recuerda el fallo y se salta Fish por el resto de la sesión.
let fishDisabled = false;

async function speakWithFishAudio(
  text: string,
  language: string
): Promise<boolean> {
  if (fishDisabled) return false;
  try {
    const res = await fetch('/api/fish-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(9000)
    });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 100) {  // ponytail: sanity check — not an empty/error response
        await playAudioBlob(blob);
        return true;
      }
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
      fishDisabled = true; // sin key / key inválida: no volver a intentarlo en esta sesión
      console.warn('Fish Audio TTS not configured (status ' + res.status + ') → usando Deepgram directo');
    }
  } catch (err) {
    console.warn('Fish Audio TTS unavailable, trying Deepgram:', err);
  }
  return false;
}

// ─── Deepgram (fallback) ──────────────────────────────────────────────────
async function speakWithDeepgram(
  text: string,
  modelName: string,
  language: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/deepgram-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: modelName })
    });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 100) {
        await playAudioBlob(blob);
        return true;
      }
    }
  } catch (err) {
    console.warn('Deepgram TTS unavailable, falling back to WebSpeech:', err);
  }
  return false;
}

// ─── Main TTS Export (same signature, same callers) ───────────────────────
export async function speakTextWithDeepgram(
  text: string,
  modelName: string = 'aura-asteria-en',
  fallbackLanguage: string = 'es'
): Promise<void> {
  if (!text || !text.trim()) return;

  // 1. Try Fish Audio — superior Spanish, emotion-capable
  if (await speakWithFishAudio(text, fallbackLanguage)) return;

  // 2. Fall back to Deepgram Aura 2
  if (await speakWithDeepgram(text, modelName, fallbackLanguage)) return;

  // 3. Last resort: browser WebSpeech
  return fallbackWebSpeech(text, fallbackLanguage);
}

function fallbackWebSpeech(text: string, language: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = language === 'en' ? 'en-US' : 'es-CO';
    utterance.lang = targetLang;

    // Search for explicit Colombian Spanish voice in browser
    if (language !== 'en') {
      const voices = synth.getVoices();
      const coVoice = voices.find(v => v.lang.includes('es-CO') || v.name.toLowerCase().includes('colombia'));
      if (coVoice) {
        utterance.voice = coVoice;
      }
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

export async function transcribeAudioWithDeepgram(
  audioBlob: Blob,
  language: string = 'es'
): Promise<string> {
  try {
    const res = await fetch(`/api/deepgram-stt?language=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: { 'Content-Type': audioBlob.type || 'audio/wav' },
      body: audioBlob
    });

    if (res.ok) {
      const data = await res.json();
      if (data.transcript) {
        return data.transcript;
      }
    }
  } catch (err) {
    console.warn('Deepgram STT failed:', err);
  }
  return '';
}
