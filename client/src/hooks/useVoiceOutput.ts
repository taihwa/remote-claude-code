import { useState, useCallback, useEffect, useRef } from 'react';

interface UseVoiceOutputReturn {
  isSpeaking: boolean;
  ttsEnabled: boolean;
  toggleTts: () => void;
  speak: (text: string) => void;
  stop: () => void;
}

const TTS_STORAGE_KEY = 'rcc-tts-enabled';

const getInitialTtsEnabled = (): boolean => {
  try {
    return localStorage.getItem(TTS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export function useVoiceOutput(lang = 'ko-KR'): UseVoiceOutputReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(getInitialTtsEnabled);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TTS_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      // Stop any ongoing speech when disabling
      if (!next && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [lang],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    ttsEnabled,
    toggleTts,
    speak,
    stop,
  };
}
