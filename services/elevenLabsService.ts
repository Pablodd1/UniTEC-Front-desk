
// Service to interact with ElevenLabs API for Cloned Voice TTS

export const playElevenLabsTTS = async (
  text: string, 
  apiKey: string, 
  voiceId: string,
  onAudioStart?: () => void,
  onAudioEnd?: () => void
) => {
  if (!text.trim() || !apiKey || !voiceId) return;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5", // Fast model for low latency
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }),
    });

    if (!response.ok) {
      console.error("ElevenLabs TTS error", await response.text());
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

    try {
        await audio.play();
    } catch (e) {
        console.warn("Autoplay blocked or playback failed", e);
    }

    return audio;
  } catch (error) {
    console.error("ElevenLabs Service Error:", error);
  }
};
