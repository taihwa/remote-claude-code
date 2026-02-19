import { useState, useRef, useCallback, useEffect } from 'react';

// Web Speech API type declarations (not in all TS lib configs)
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventInit extends EventInit {
  resultIndex?: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VoiceState = 'idle' | 'listening' | 'error';

interface UseVoiceInputOptions {
  lang?: string;
  onFinalTranscript: (text: string) => void;
}

interface UseVoiceInputReturn {
  voiceState: VoiceState;
  isSupported: boolean;
  errorMessage: string | null;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 접근이 거부되었습니다',
  'no-speech': '음성이 감지되지 않았습니다',
  'audio-capture': '마이크를 찾을 수 없습니다',
  'network': '네트워크 오류가 발생했습니다',
  'aborted': '',  // silent on intentional abort
};

const getSpeechRecognitionCtor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export function useVoiceInput({
  lang = 'ko-KR',
  onFinalTranscript,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const Ctor = getSpeechRecognitionCtor();
  const isSupported = Ctor !== null;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  // Keep callback ref in sync
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!Ctor) return;

    // Clean up any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    clearErrorTimer();
    setErrorMessage(null);
    setInterimTranscript('');

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setVoiceState('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalText.trim()) {
        onFinalTranscriptRef.current(finalText.trim());
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg = ERROR_MESSAGES[event.error] ?? `음성 인식 오류: ${event.error}`;
      if (msg) {
        setVoiceState('error');
        setErrorMessage(msg);
        clearErrorTimer();
        errorTimerRef.current = setTimeout(() => {
          setErrorMessage(null);
          setVoiceState('idle');
        }, 3000);
      } else {
        // Silent error (e.g. aborted)
        setVoiceState('idle');
      }
      setInterimTranscript('');
    };

    recognition.onend = () => {
      // Only reset to idle if not in error state (error handler manages its own state)
      setVoiceState((prev) => (prev === 'error' ? prev : 'idle'));
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [Ctor, lang, clearErrorTimer]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (voiceState === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceState, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      clearErrorTimer();
    };
  }, [clearErrorTimer]);

  return {
    voiceState,
    isSupported,
    errorMessage,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
