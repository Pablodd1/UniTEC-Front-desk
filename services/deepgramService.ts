// Service to interact with Deepgram API for Text-to-Speech

export const playDeepgramTTS = async (
  text: string, 
  apiKey: string, 
  voice: string = 'asteria-en',
  onAudioStart?: () => void,
  onAudioEnd?: () => void
) => {
  if (!text.trim() || !apiKey) return;

  try {
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=aura-${voice}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error("Deepgram TTS error", await response.text());
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onplay = () => {
      onAudioStart?.();
    };

    audio.onended = () => {
      onAudioEnd?.();
      URL.revokeObjectURL(url);
    };

    // Attempt playback
    try {
        await audio.play();
    } catch (e) {
        console.warn("Autoplay blocked or playback failed", e);
    }

    return audio; // Return audio instance in case we need to stop it
  } catch (error) {
    console.error("Deepgram Service Error:", error);
  }
};
