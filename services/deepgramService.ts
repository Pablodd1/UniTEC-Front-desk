// @ts-nocheck
// deepgramService.ts — Handles Deepgram Voice AI (TTS Aura 2 & STT Nova-2)

export async function speakTextWithDeepgram(
  text: string,
  modelName: string = 'aura-asteria-en',
  fallbackLanguage: string = 'es'
): Promise<void> {
  if (!text || !text.trim()) return;

  try {
    const res = await fetch('/api/deepgram-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: modelName })
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          fallbackWebSpeech(text, fallbackLanguage).then(resolve);
        };
        audio.play().catch(() => {
          fallbackWebSpeech(text, fallbackLanguage).then(resolve);
        });
      });
    }
  } catch (err) {
    console.warn('Deepgram TTS unavailable, falling back to WebSpeech:', err);
  }

  // Fallback to browser WebSpeech if Deepgram key is not configured or fails
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
