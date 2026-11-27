import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  getOptionalFirebaseIdToken,
  validateVoiceReportDraft,
} from '../../services/geminiCivicService';
import {
  LanguageOption,
  LiveTranscriptEntry,
  LiveVoiceConnectionState,
  LiveVoiceExtractedDraft,
  ReportPriority,
} from '../../types/civic';

interface LiveVoiceReporterProps {
  language: LanguageOption;
  autoDetectLanguage: boolean;
  categories: string[];
  neighbourhoods: string[];
  currentDraft: {
    title: string;
    category: string;
    neighbourhood: string;
    address: string;
    description: string;
    duration: string;
    impactAndSafety: string;
  };
  onLanguageDetected: (lang: LanguageOption) => void;
  onLiveDraftUpdate: (draft: LiveVoiceExtractedDraft) => void;
  onConversationCompleted: (params: {
    validatedDraft: LiveVoiceExtractedDraft;
    transcript: LiveTranscriptEntry[];
    durationSeconds: number;
    validationErrors: string[];
  }) => void;
}

const LANGUAGE_DISPLAY: Record<LanguageOption, string> = {
  [LanguageOption.ENGLISH]: 'English',
  [LanguageOption.KANNADA]: 'ಕನ್ನಡ (Kannada)',
  [LanguageOption.HINDI]: 'हिन्दी (Hindi)',
};

const EMPTY_DRAFT: LiveVoiceExtractedDraft = {
  title: '',
  category: '',
  description: '',
  neighbourhood: '',
  address: '',
  duration: '',
  impactAndSafety: '',
  detectedLanguage: LanguageOption.ENGLISH,
  suggestedDepartment: '',
  priority: ReportPriority.MEDIUM,
  originalStatementSummary: '',
  fieldsNeedingConfirmation: ['title', 'category', 'neighbourhood', 'address', 'description'],
  aiSummary: '',
};

/**
 * Downsamples Float32 audio buffer to 16kHz and encodes as little-endian 16-bit PCM base64.
 */
function encodeFloat32ToPcm16Base64(input: Float32Array, inputSampleRate: number): string {
  const targetRate = 16000;
  let samples: Float32Array;

  if (inputSampleRate === targetRate) {
    samples = input;
  } else {
    const ratio = inputSampleRate / targetRate;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    samples = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * ratio;
      const lower = Math.floor(srcIdx);
      const upper = Math.min(lower + 1, input.length - 1);
      const frac = srcIdx - lower;
      samples[i] = input[lower] * (1 - frac) + input[upper] * frac;
    }
  }

  const pcm16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Manually decodes base64 little-endian 16-bit PCM (24kHz) into Float32Array for Web Audio playback.
 */
function decodePcm16Base64ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(byteLength / 2);
  const floats = new Float32Array(new ArrayBuffer(sampleCount * 4));
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    floats[i] = int16 / 32768;
  }
  return floats;
}

function formatTimeNow(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const LiveVoiceReporter: React.FC<LiveVoiceReporterProps> = ({
  language,
  autoDetectLanguage,
  categories,
  neighbourhoods,
  currentDraft,
  onLanguageDetected,
  onLiveDraftUpdate,
  onConversationCompleted,
}) => {
  const [connectionState, setConnectionState] = useState<LiveVoiceConnectionState>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageOption>(language);
  const [micLevel, setMicLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcript, setTranscript] = useState<LiveTranscriptEntry[]>([]);
  const [liveDraft, setLiveDraft] = useState<LiveVoiceExtractedDraft>({
    ...EMPTY_DRAFT,
    detectedLanguage: language,
  });
  const [sessionError, setSessionError] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [conversationEndedSummary, setConversationEndedSummary] = useState(false);

  // Refs to avoid stale closures inside onaudioprocess and WebSocket callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const activePlaybackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const isMutedRef = useRef<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const transcriptRef = useRef<LiveTranscriptEntry[]>([]);
  const liveDraftRef = useRef<LiveVoiceExtractedDraft>(liveDraft);
  const elapsedSecondsRef = useRef<number>(0);
  const lastTurnCompleteRef = useRef<boolean>(true);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    transcriptRef.current = transcript;
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    liveDraftRef.current = liveDraft;
  }, [liveDraft]);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  // Sync manual language switches while a live session is active
  useEffect(() => {
    setDetectedLanguage(language);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isConnectedRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'language_update',
          language,
          autoDetectLanguage,
        })
      );
    }
  }, [language, autoDetectLanguage]);

  // Live call duration timer
  useEffect(() => {
    if (connectionState === 'Disconnected' || connectionState === 'Connecting') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connectionState]);

  const stopAllOutputPlayback = useCallback(() => {
    activePlaybackSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    });
    activePlaybackSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const teardownMediaAndSocket = useCallback(
    (sendEndFrame: boolean) => {
      isConnectedRef.current = false;
      stopAllOutputPlayback();

      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        try {
          processorRef.current.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        processorRef.current = null;
      }

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        sourceNodeRef.current = null;
      }

      if (silentGainRef.current) {
        try {
          silentGainRef.current.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        silentGainRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (inputAudioCtxRef.current) {
        void inputAudioCtxRef.current.close().catch(() => undefined);
        inputAudioCtxRef.current = null;
      }

      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close().catch(() => undefined);
        outputAudioCtxRef.current = null;
      }

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        if (sendEndFrame && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'end' }));
          } catch {
            // Ignore send errors on teardown
          }
        }
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }

      setMicLevel(0);
      setConnectionState('Disconnected');
    },
    [stopAllOutputPlayback]
  );

  // Clean up automatically if the citizen switches tabs or leaves the page
  useEffect(() => {
    return () => {
      teardownMediaAndSocket(true);
    };
  }, [teardownMediaAndSocket]);

  const appendTranscriptChunk = useCallback((speaker: 'citizen' | 'assistant', chunk: string) => {
    const cleaned = chunk;
    if (!cleaned.trim()) return;

    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && !lastTurnCompleteRef.current) {
        const needsSpace =
          last.text.length > 0 &&
          !last.text.endsWith(' ') &&
          !cleaned.startsWith(' ') &&
          !/^[.,!?;:]/.test(cleaned);
        const updated: LiveTranscriptEntry = {
          ...last,
          text: `${last.text}${needsSpace ? ' ' : ''}${cleaned}`.trim(),
        };
        return [...prev.slice(0, -1), updated];
      }

      lastTurnCompleteRef.current = false;
      return [
        ...prev,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: cleaned.trim(),
          timestamp: formatTimeNow(),
        },
      ];
    });
  }, []);

  const schedulePcm24kPlayback = useCallback((base64Pcm: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const floats = decodePcm16Base64ToFloat32(base64Pcm);
    if (floats.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, floats.length, 24000);
    audioBuffer.copyToChannel(floats, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime + 0.02, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activePlaybackSourcesRef.current.add(source);
    setConnectionState('Speaking');

    source.onended = () => {
      activePlaybackSourcesRef.current.delete(source);
      if (activePlaybackSourcesRef.current.size === 0 && isConnectedRef.current) {
        setConnectionState('Listening');
      }
    };
  }, []);

  const finalizeAndValidateConversation = useCallback(async () => {
    const capturedTranscript = transcriptRef.current;
    const capturedDraft = liveDraftRef.current;
    const durationSecs = elapsedSecondsRef.current;

    if (
      capturedTranscript.length === 0 &&
      !capturedDraft.title &&
      !capturedDraft.description &&
      !capturedDraft.address
    ) {
      return;
    }

    setFinalizing(true);
    setSessionError('');
    try {
      const response = await validateVoiceReportDraft({
        transcript: capturedTranscript.map((t) => ({ speaker: t.speaker, text: t.text })),
        draft: capturedDraft,
        language: detectedLanguage,
        autoDetectLanguage,
        categories,
        neighbourhoods,
        reconcileWithTranscript: capturedTranscript.length > 0,
      });

      setLiveDraft(response.validated);
      setConversationEndedSummary(true);
      onConversationCompleted({
        validatedDraft: response.validated,
        transcript: capturedTranscript,
        durationSeconds: durationSecs,
        validationErrors: response.validationErrors,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not finalize backend validation. Your captured fields have still been applied to the form below.';
      setSessionError(msg);
      onConversationCompleted({
        validatedDraft: capturedDraft,
        transcript: capturedTranscript,
        durationSeconds: durationSecs,
        validationErrors: [],
      });
    } finally {
      setFinalizing(false);
    }
  }, [
    autoDetectLanguage,
    categories,
    detectedLanguage,
    neighbourhoods,
    onConversationCompleted,
  ]);

  const startConversation = async () => {
    setSessionError('');
    setConversationEndedSummary(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setSessionError(
        'Microphone access is not supported in this browser. Please switch to a supported browser or use Text reporting.'
      );
      return;
    }

    setConnectionState('Connecting');
    setIsMuted(false);
    isMutedRef.current = false;
    setElapsedSeconds(0);
    setTranscript([]);
    lastTurnCompleteRef.current = true;

    const initialDraft: LiveVoiceExtractedDraft = {
      ...EMPTY_DRAFT,
      title: currentDraft.title,
      category: currentDraft.category,
      neighbourhood: currentDraft.neighbourhood,
      address: currentDraft.address,
      description: currentDraft.description,
      duration: currentDraft.duration,
      impactAndSafety: currentDraft.impactAndSafety,
      detectedLanguage: language,
    };
    setLiveDraft(initialDraft);

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Initialize separate 16kHz input and 24kHz output AudioContexts (per Live API rules)
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      // 3. Connect to same-origin backend WebSocket bridge (/api/live-voice)
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live-voice`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const authToken = await getOptionalFirebaseIdToken();

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            language,
            autoDetectLanguage,
            categories,
            neighbourhoods,
            currentDraft,
            authToken: authToken ?? undefined,
          })
        );
      };

      ws.onmessage = (event) => {
        let msg: {
          type?: string;
          data?: string;
          text?: string;
          language?: string;
          detectedLanguage?: string;
          draft?: LiveVoiceExtractedDraft;
          message?: string;
          reason?: string;
        };

        try {
          msg = JSON.parse(String(event.data)) as typeof msg;
        } catch {
          return;
        }

        switch (msg.type) {
          case 'ready': {
            isConnectedRef.current = true;
            setConnectionState('Listening');
            if (msg.detectedLanguage) {
              const langVal = msg.detectedLanguage as LanguageOption;
              setDetectedLanguage(langVal);
            }

            // Start streaming 16kHz PCM microphone audio once Live session is open
            if (inputAudioCtxRef.current && mediaStreamRef.current) {
              const source = inputAudioCtxRef.current.createMediaStreamSource(
                mediaStreamRef.current
              );
              const processor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
              // Keep processor alive with zero-gain node to prevent local mic echo
              const silentGain = inputAudioCtxRef.current.createGain();
              silentGain.gain.value = 0;

              source.connect(processor);
              processor.connect(silentGain);
              silentGain.connect(inputAudioCtxRef.current.destination);

              sourceNodeRef.current = source;
              processorRef.current = processor;
              silentGainRef.current = silentGain;

              processor.onaudioprocess = (audioEvent) => {
                if (
                  !isConnectedRef.current ||
                  isMutedRef.current ||
                  !wsRef.current ||
                  wsRef.current.readyState !== WebSocket.OPEN
                ) {
                  setMicLevel(0);
                  return;
                }

                const channelData = audioEvent.inputBuffer.getChannelData(0);
                // Compute RMS for subtle visual speaking meter
                let sumSquares = 0;
                for (let i = 0; i < channelData.length; i += 4) {
                  sumSquares += channelData[i] * channelData[i];
                }
                const rms = Math.sqrt(sumSquares / (channelData.length / 4));
                setMicLevel(Math.min(100, Math.round(rms * 420)));

                const base64Pcm = encodeFloat32ToPcm16Base64(
                  channelData,
                  inputAudioCtxRef.current?.sampleRate ?? 16000
                );
                wsRef.current.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
              };
            }
            break;
          }

          case 'audio': {
            if (msg.data) {
              schedulePcm24kPlayback(msg.data);
            }
            break;
          }

          case 'interrupted': {
            stopAllOutputPlayback();
            lastTurnCompleteRef.current = true;
            if (isConnectedRef.current) {
              setConnectionState('Listening');
            }
            break;
          }

          case 'input_transcript': {
            if (msg.text) {
              appendTranscriptChunk('citizen', msg.text);
            }
            break;
          }

          case 'output_transcript': {
            if (msg.text) {
              appendTranscriptChunk('assistant', msg.text);
            }
            break;
          }

          case 'turn_complete': {
            lastTurnCompleteRef.current = true;
            if (activePlaybackSourcesRef.current.size === 0 && isConnectedRef.current) {
              setConnectionState('Listening');
            }
            break;
          }

          case 'language_detected': {
            if (
              msg.language === LanguageOption.KANNADA ||
              msg.language === LanguageOption.HINDI ||
              msg.language === LanguageOption.ENGLISH
            ) {
              setDetectedLanguage(msg.language);
              if (autoDetectLanguage) {
                onLanguageDetected(msg.language);
              }
            }
            break;
          }

          case 'draft_update': {
            if (msg.draft) {
              setLiveDraft(msg.draft);
              onLiveDraftUpdate(msg.draft);
            }
            break;
          }

          case 'error': {
            setSessionError(
              msg.message || 'Voice conversation could not continue due to a server error.'
            );
            teardownMediaAndSocket(false);
            break;
          }

          case 'closed': {
            const wasConnected = isConnectedRef.current;
            teardownMediaAndSocket(false);
            if (wasConnected) {
              void finalizeAndValidateConversation();
            }
            break;
          }

          default:
            break;
        }
      };

      ws.onerror = () => {
        setSessionError(
          'Unable to connect to the NAMMAOORU Live Voice service. Please check your network connection and try again.'
        );
        teardownMediaAndSocket(false);
      };

      ws.onclose = () => {
        if (isConnectedRef.current) {
          teardownMediaAndSocket(false);
          void finalizeAndValidateConversation();
        }
      };
    } catch (err) {
      teardownMediaAndSocket(false);
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setSessionError(
          'Microphone permission was denied. Please allow microphone access in your browser settings to start a live voice conversation.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setSessionError(
          'No microphone was detected on this device. Please connect a microphone or switch to Text reporting.'
        );
      } else {
        setSessionError(
          err instanceof Error
            ? err.message
            : 'Unable to start voice conversation. Please check microphone permissions and try again.'
        );
      }
    }
  };

  const handleEndConversation = () => {
    teardownMediaAndSocket(true);
    void finalizeAndValidateConversation();
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const isSessionActive = connectionState !== 'Disconnected';
  const needsConfirmSet = new Set(liveDraft.fieldsNeedingConfirmation);

  const statusMeta: Record<
    LiveVoiceConnectionState,
    { label: string; dotClass: string; badgeClass: string; helper: string }
  > = {
    Disconnected: {
      label: 'Disconnected',
      dotClass: 'bg-[#64748B]',
      badgeClass: 'border-[#E2E8E4] bg-white text-[#526058]',
      helper: 'Start a natural two-way conversation in Kannada, English, or Hindi.',
    },
    Connecting: {
      label: 'Connecting',
      dotClass: 'bg-[#D97706] animate-pulse',
      badgeClass: 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]',
      helper: 'Connecting microphone and Gemini Live voice session...',
    },
    Listening: {
      label: isMuted ? 'Listening (Muted)' : 'Listening',
      dotClass: isMuted ? 'bg-[#94A3B8]' : 'bg-[#16A34A] animate-pulse',
      badgeClass: isMuted
        ? 'border-[#CBD5CF] bg-[#F6F8F7] text-[#526058]'
        : 'border-[#BBF7D0] bg-[#DCFCE7] text-[#14532D]',
      helper: isMuted
        ? 'Your microphone is muted. Unmute to continue speaking.'
        : 'Speak naturally — describe the issue, street or landmark, and any safety concern.',
    },
    Speaking: {
      label: 'Speaking',
      dotClass: 'bg-[#14532D] animate-pulse',
      badgeClass: 'border-[#CFE3D5] bg-[#EDF5F0] text-[#14532D]',
      helper: 'NAMMAOORU assistant is responding. You can speak anytime to interrupt.',
    },
  };

  const activeStatus = statusMeta[connectionState];

  const previewRows: Array<{
    key: string;
    label: string;
    value: string;
    optional?: boolean;
  }> = [
    { key: 'title', label: 'Issue Title', value: liveDraft.title },
    { key: 'category', label: 'Issue Category', value: liveDraft.category },
    { key: 'neighbourhood', label: 'Neighbourhood', value: liveDraft.neighbourhood },
    { key: 'address', label: 'Street / Nearby Landmark', value: liveDraft.address },
    { key: 'description', label: 'Problem Description', value: liveDraft.description },
    { key: 'duration', label: 'Duration', value: liveDraft.duration, optional: true },
    {
      key: 'impactAndSafety',
      label: 'Impact & Safety Concerns',
      value: liveDraft.impactAndSafety,
      optional: true,
    },
  ];

  return (
    <div className="rounded-xl border border-[#CFE3D5] bg-[#F6F8F7] p-5 space-y-4">
      {/* Header Row: Title, Live Connection Status & Detected Language */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
            <span className="text-sm font-semibold text-[#1C2420]">
              Real-Time Voice Conversation with Gemini Live
            </span>
          </div>
          <p className="text-xs text-[#526058]">
            Speak naturally in Kannada, English, or Hindi. Gemini asks helpful follow-ups and fills your report draft live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Detected Language Indicator */}
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-white px-2.5 py-1 text-xs font-medium text-[#14532D]"
            aria-live="polite"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {autoDetectLanguage ? 'Detected' : 'Selected'}: {LANGUAGE_DISPLAY[detectedLanguage]}
            </span>
          </span>

          {/* Connection Status Indicator */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${activeStatus.badgeClass}`}
            role="status"
            aria-live="polite"
          >
            <span className={`h-2 w-2 rounded-full ${activeStatus.dotClass}`} aria-hidden="true" />
            <span>{activeStatus.label}</span>
          </span>
        </div>
      </div>

      {/* Primary Voice Control Bar */}
      <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {!isSessionActive ? (
            <button
              type="button"
              disabled={finalizing}
              onClick={() => void startConversation()}
              className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#14532D] px-5 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#166534] disabled:opacity-60 whitespace-nowrap"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span>
                {transcript.length > 0 ? 'Start New Voice Conversation' : 'Start Voice Conversation'}
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={toggleMute}
                disabled={connectionState === 'Connecting'}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-60 ${
                  isMuted
                    ? 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]'
                    : 'border-[#CFE3D5] bg-[#EDF5F0] text-[#14532D] hover:bg-[#DCEEE4]'
                }`}
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-4 w-4" aria-hidden="true" />
                    <span>Unmute Microphone</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" aria-hidden="true" />
                    <span>Mute Microphone</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleEndConversation}
                className="inline-flex items-center gap-2 rounded-lg bg-[#991B1B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7F1D1D] whitespace-nowrap"
              >
                <PhoneOff className="h-4 w-4" aria-hidden="true" />
                <span>End Conversation</span>
              </button>
            </div>
          )}

          {/* Call Timer + Live Audio Indicator */}
          <div className="flex items-center gap-3 text-xs text-[#526058]">
            {connectionState === 'Speaking' && (
              <span className="inline-flex items-center gap-1.5 font-medium text-[#14532D]">
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <span>Assistant speaking</span>
              </span>
            )}
            {connectionState === 'Listening' && !isMuted && (
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="text-[11px] text-[#526058]">Mic</span>
                <div className="h-2 w-16 overflow-hidden rounded-full bg-[#E2E8E4]">
                  <div
                    className="h-full rounded-full bg-[#16A34A] transition-all duration-75"
                    style={{ width: `${Math.max(8, micLevel)}%` }}
                  />
                </div>
              </div>
            )}
            {(isSessionActive || elapsedSeconds > 0) && (
              <span className="font-mono font-medium text-[#1C2420] tabular-nums">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                {String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-[#526058]">{activeStatus.helper}</p>
      </div>

      {/* Error Banner (Missing API key, Mic Permission, or Live API Error) */}
      {sessionError && (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-3 text-xs text-[#991B1B]"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{sessionError}</p>
        </div>
      )}

      {/* Backend Validation / Finalization Banner */}
      {finalizing && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-4 py-3 text-xs font-medium text-[#14532D]"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
          <span>Validating extracted voice details and preparing your editable report form...</span>
        </div>
      )}

      {conversationEndedSummary && !isSessionActive && !finalizing && (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-4 py-3 text-xs text-[#14532D]"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong>Voice conversation complete.</strong> Extracted details have been placed in the report form below. Review or edit any field, confirm any highlighted items, and click{' '}
            <strong>Review Report</strong> when you are ready to submit.
          </p>
        </div>
      )}

      {/* Side-by-Side Live Conversation Transcript & Live Extracted Report Preview */}
      {(isSessionActive || transcript.length > 0 || Boolean(liveDraft.title || liveDraft.description)) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Live Transcript Panel */}
          <div className="flex flex-col rounded-xl border border-[#E2E8E4] bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8E4] bg-[#F6F8F7] px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C2420]">
                <MessageSquare className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                <span>Live Conversation Transcript</span>
              </span>
              <span className="text-[11px] text-[#526058]">
                {transcript.length} {transcript.length === 1 ? 'turn' : 'turns'}
              </span>
            </div>

            <div
              ref={transcriptScrollRef}
              className="h-64 overflow-y-auto p-3.5 space-y-2.5 text-xs"
              aria-live="polite"
            >
              {transcript.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-[#526058] px-4">
                  <p className="font-medium text-[#29322D]">
                    {connectionState === 'Connecting'
                      ? 'Connecting to Gemini Live...'
                      : 'Listening for conversation...'}
                  </p>
                  <p className="mt-1 text-[11px]">
                    Your spoken words in Kannada, English, or Hindi and Gemini&apos;s responses will appear here in real time.
                  </p>
                </div>
              ) : (
                transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex flex-col ${
                      entry.speaker === 'citizen' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-lg px-3 py-2 leading-relaxed ${
                        entry.speaker === 'citizen'
                          ? 'bg-[#14532D] text-white'
                          : 'border border-[#E2E8E4] bg-[#F6F8F7] text-[#1C2420]'
                      }`}
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-3 text-[10px] opacity-80">
                        <span className="font-semibold">
                          {entry.speaker === 'citizen' ? 'You (Citizen)' : 'NAMMAOORU Assistant'}
                        </span>
                        <span>{entry.timestamp}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{entry.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Extracted Report Preview Panel */}
          <div className="flex flex-col rounded-xl border border-[#CFE3D5] bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Live Extracted Report Preview</span>
              </span>
              <span className="text-[11px] font-medium text-[#14532D]">
                Auto-fills form · Never auto-submits
              </span>
            </div>

            <dl className="h-64 overflow-y-auto divide-y divide-[#E2E8E4] px-3.5 py-1 text-xs">
              {previewRows.map((row) => {
                const hasValue = Boolean(row.value && row.value.trim().length > 0);
                const needsConfirm = needsConfirmSet.has(row.key) && !row.optional;

                return (
                  <div key={row.key} className="py-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="font-semibold text-[#526058]">{row.label}</dt>
                      {hasValue ? (
                        <span className="text-[10px] font-semibold text-[#14532D]">Captured</span>
                      ) : needsConfirm ? (
                        <span className="text-[10px] font-semibold text-[#B45309]">
                          Needs confirmation
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#64748B]">Optional</span>
                      )}
                    </div>
                    <dd
                      className={
                        hasValue
                          ? 'text-[#1C2420] leading-relaxed'
                          : 'italic text-[#64748B]'
                      }
                    >
                      {hasValue
                        ? row.value
                        : row.optional
                        ? 'Not mentioned yet'
                        : 'Waiting for spoken details...'}
                    </dd>
                  </div>
                );
              })}

              {liveDraft.originalStatementSummary && (
                <div className="py-2 space-y-0.5">
                  <dt className="font-semibold text-[#526058]">Original Spoken Statement</dt>
                  <dd className="italic text-[#29322D]">
                    &ldquo;{liveDraft.originalStatementSummary}&rdquo;
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
