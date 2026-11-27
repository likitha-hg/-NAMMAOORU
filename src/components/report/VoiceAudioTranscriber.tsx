import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileAudio,
  Globe,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { transcribeAudioWithGemini } from '../../services/geminiCivicService';
import { LanguageOption } from '../../types/civic';

interface VoiceAudioTranscriberProps {
  language: LanguageOption;
  autoDetectLanguage: boolean;
  extractingReport: boolean;
  onLanguageDetected: (lang: LanguageOption) => void;
  onTranscriptReady: (params: {
    originalTranscript: string;
    correctedTranscript: string;
    detectedLanguage: LanguageOption;
    sourceLabel: string;
    durationSeconds: number;
  }) => void;
  onConvertTranscriptToReport: (params: {
    originalTranscript: string;
    correctedTranscript: string;
    detectedLanguage: LanguageOption;
    sourceLabel: string;
    durationSeconds: number;
  }) => Promise<void>;
}

type TranscriptionStatus = 'idle' | 'transcribing' | 'completed' | 'error';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_RECORDING_SECONDS = 120;

const ALLOWED_EXTENSIONS = new Set(['mp3', 'wav', 'webm', 'm4a', 'mp4', 'ogg', 'aac', 'flac']);

const LANGUAGE_DISPLAY: Record<LanguageOption, string> = {
  [LanguageOption.ENGLISH]: 'English',
  [LanguageOption.KANNADA]: 'ಕನ್ನಡ (Kannada)',
  [LanguageOption.HINDI]: 'हिन्दी (Hindi)',
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read audio file.'));
    reader.readAsDataURL(blob);
  });
}

function inferMimeTypeFromFile(file: File): string {
  if (file.type && file.type.startsWith('audio/')) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3':
      return 'audio/mp3';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    default:
      return file.type || '';
  }
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const VoiceAudioTranscriber: React.FC<VoiceAudioTranscriberProps> = ({
  language,
  autoDetectLanguage,
  extractingReport,
  onLanguageDetected,
  onTranscriptReady,
  onConvertTranscriptToReport,
}) => {
  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supportsPauseResume, setSupportsPauseResume] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Audio asset state (either recorded clip or uploaded audio file)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState('');
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [audioSourceKind, setAudioSourceKind] = useState<'recorded' | 'uploaded' | null>(null);
  const [audioSourceName, setAudioSourceName] = useState('');
  const [audioByteSize, setAudioByteSize] = useState(0);

  // Transcription state
  const [status, setStatus] = useState<TranscriptionStatus>('idle');
  const [audioError, setAudioError] = useState('');
  const [transcribeError, setTranscribeError] = useState('');
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [correctedTranscript, setCorrectedTranscript] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageOption>(language);

  useEffect(() => {
    if (!isRecording || isPaused) return;
    const timer = window.setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev >= MAX_RECORDING_SECONDS - 1) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          return MAX_RECORDING_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRecording, isPaused]);

  // Clean up object URL and active mic tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  const clearAudioAndTranscript = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    setAudioBase64('');
    setAudioSourceKind(null);
    setAudioSourceName('');
    setAudioByteSize(0);
    setRecordingSeconds(0);
    setOriginalTranscript('');
    setCorrectedTranscript('');
    setStatus('idle');
    setAudioError('');
    setTranscribeError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    setAudioError('');
    setTranscribeError('');

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAudioError(
        'Audio recording is not supported in this browser. You can upload an existing MP3, WAV, M4A, or WebM audio file instead.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const supportedType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      setSupportsPauseResume(
        typeof recorder.pause === 'function' && typeof recorder.resume === 'function'
      );

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onpause = () => setIsPaused(true);
      recorder.onresume = () => setIsPaused(false);

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        setIsPaused(false);

        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size < 200) {
          setAudioError('Recording was too short. Please speak for at least 2 seconds.');
          return;
        }
        if (blob.size > MAX_AUDIO_BYTES) {
          setAudioError('Recording exceeded the 10 MB limit. Please record a shorter message.');
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });

        try {
          const b64 = await blobToBase64(blob);
          setAudioBase64(b64);
          setAudioMimeType(mime);
          setAudioSourceKind('recorded');
          setAudioSourceName('Microphone Recording');
          setAudioByteSize(blob.size);
          setOriginalTranscript('');
          setCorrectedTranscript('');
          setStatus('idle');
        } catch (readErr) {
          setAudioError(
            readErr instanceof Error ? readErr.message : 'Unable to read recorded audio.'
          );
        }
      };

      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setAudioBase64('');
      setOriginalTranscript('');
      setCorrectedTranscript('');
      setStatus('idle');
      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setAudioError(
          'Microphone permission was denied. Please allow microphone access in your browser settings or upload an existing audio file below.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setAudioError(
          'No microphone was detected on this device. You can upload an existing audio file instead.'
        );
      } else {
        setAudioError(
          'Unable to access the microphone right now. You can retry or upload an existing audio file.'
        );
      }
    }
  };

  const pauseOrResumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    try {
      if (recorder.state === 'recording' && typeof recorder.pause === 'function') {
        recorder.pause();
      } else if (recorder.state === 'paused' && typeof recorder.resume === 'function') {
        recorder.resume();
      }
    } catch {
      setAudioError('Pause/resume is not supported on this device browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioError('');
    setTranscribeError('');

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mime = inferMimeTypeFromFile(file);
    if (!mime.startsWith('audio/') && !ALLOWED_EXTENSIONS.has(ext)) {
      setAudioError(
        'Unsupported file type. Please upload an MP3, WAV, WebM, M4A, OGG, AAC, or FLAC audio file.'
      );
      return;
    }

    if (file.size === 0) {
      setAudioError('The selected audio file is empty. Please choose a valid audio recording.');
      return;
    }

    if (file.size > MAX_AUDIO_BYTES) {
      setAudioError(
        `File is too large (${formatFileSize(file.size)}). Please upload an audio file smaller than 10 MB.`
      );
      return;
    }

    try {
      const b64 = await blobToBase64(file);
      const url = URL.createObjectURL(file);
      setAudioPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setAudioBase64(b64);
      setAudioMimeType(mime || 'audio/mp3');
      setAudioSourceKind('uploaded');
      setAudioSourceName(file.name);
      setAudioByteSize(file.size);
      setRecordingSeconds(0);
      setOriginalTranscript('');
      setCorrectedTranscript('');
      setStatus('idle');
    } catch {
      setAudioError('Could not read the selected audio file. Please try another file.');
    }
  };

  const runTranscription = async () => {
    if (!audioBase64) {
      setTranscribeError('Please record an audio message or upload an audio file first.');
      return;
    }

    setStatus('transcribing');
    setTranscribeError('');

    try {
      const result = await transcribeAudioWithGemini({
        audioBase64,
        audioMimeType,
        preferredLanguage: language,
        autoDetectLanguage,
        fileName: audioSourceName,
      });

      setOriginalTranscript(result.transcript);
      setCorrectedTranscript(result.transcript);
      setDetectedLanguage(result.detectedLanguage);
      setStatus('completed');

      if (autoDetectLanguage && result.detectedLanguage) {
        onLanguageDetected(result.detectedLanguage);
      }

      const sourceLabel =
        audioSourceKind === 'uploaded'
          ? `Uploaded audio (${audioSourceName})`
          : `Recorded voice message (${formatDuration(recordingSeconds)})`;

      onTranscriptReady({
        originalTranscript: result.transcript,
        correctedTranscript: result.transcript,
        detectedLanguage: result.detectedLanguage,
        sourceLabel,
        durationSeconds: recordingSeconds,
      });
    } catch (err) {
      setStatus('error');
      setTranscribeError(
        err instanceof Error
          ? err.message
          : 'Gemini 3.5 Transcribe could not process this audio. Please retry.'
      );
    }
  };

  const handleConvertClick = async () => {
    const textToExtract = correctedTranscript.trim() || originalTranscript.trim();
    if (!textToExtract) {
      setTranscribeError('Please transcribe audio first before extracting report fields.');
      return;
    }

    const sourceLabel =
      audioSourceKind === 'uploaded'
        ? `Uploaded audio (${audioSourceName})`
        : `Recorded voice message (${formatDuration(recordingSeconds)})`;

    await onConvertTranscriptToReport({
      originalTranscript,
      correctedTranscript: textToExtract,
      detectedLanguage,
      sourceLabel,
      durationSeconds: recordingSeconds,
    });
  };

  const handleCorrectedChange = (nextText: string) => {
    setCorrectedTranscript(nextText);
    const sourceLabel =
      audioSourceKind === 'uploaded'
        ? `Uploaded audio (${audioSourceName})`
        : `Recorded voice message (${formatDuration(recordingSeconds)})`;
    onTranscriptReady({
      originalTranscript,
      correctedTranscript: nextText,
      detectedLanguage,
      sourceLabel,
      durationSeconds: recordingSeconds,
    });
  };

  const hasTranscriptEdits =
    originalTranscript.trim().length > 0 &&
    correctedTranscript.trim() !== originalTranscript.trim();

  const statusBadge = {
    idle: {
      label: audioBase64 ? 'Audio ready to transcribe' : 'Awaiting audio',
      className: 'border-[#E2E8E4] bg-white text-[#526058]',
    },
    transcribing: {
      label: 'Transcribing with Gemini 3.5...',
      className: 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]',
    },
    completed: {
      label: 'Transcription ready',
      className: 'border-[#BBF7D0] bg-[#DCFCE7] text-[#14532D]',
    },
    error: {
      label: 'Transcription failed',
      className: 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]',
    },
  }[status];

  return (
    <div className="rounded-xl border border-[#CFE3D5] bg-[#F6F8F7] p-5 space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FileAudio className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
            <span className="text-sm font-semibold text-[#1C2420]">
              Audio Recording &amp; Upload Transcription (Gemini 3.5 Transcribe)
            </span>
          </div>
          <p className="text-xs text-[#526058]">
            Record a voice message or upload an audio clip in Kannada, English, or Hindi. Review and correct the transcript, then extract structured report fields.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}
          role="status"
          aria-live="polite"
        >
          {status === 'transcribing' && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {status === 'completed' && (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{statusBadge.label}</span>
        </span>
      </div>

      {/* Two Audio Input Options: Record with Microphone OR Upload Existing File */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Option A: Record Audio Message */}
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1C2420]">
                1. Record Audio Message
              </span>
              <span className="font-mono text-xs font-semibold text-[#14532D] tabular-nums">
                {formatDuration(recordingSeconds)} / {formatDuration(MAX_RECORDING_SECONDS)}
              </span>
            </div>
            <p className="text-xs text-[#526058]">
              {isRecording
                ? isPaused
                  ? 'Recording paused. Resume to continue or stop to finish.'
                  : 'Recording in progress... describe the issue, location, and impact.'
                : 'Use your device microphone to record a voice message.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                disabled={status === 'transcribing'}
                onClick={() => void startRecording()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60 whitespace-nowrap"
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{audioSourceKind === 'recorded' ? 'Record Again' : 'Start Recording'}</span>
              </button>
            ) : (
              <>
                {supportsPauseResume && (
                  <button
                    type="button"
                    onClick={pauseOrResumeRecording}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#DCEEE4] whitespace-nowrap"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#991B1B] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#7F1D1D] whitespace-nowrap"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Stop Recording</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Option B: Upload Existing Audio File */}
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1C2420]">
                2. Upload Existing Audio File
              </span>
              <span className="text-[11px] font-medium text-[#14532D]">Up to 10 MB</span>
            </div>
            <p className="text-xs text-[#526058]">
              Upload MP3, WAV, WebM, M4A, OGG, AAC, or FLAC audio recorded earlier on your phone.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#14532D] bg-white px-4 py-2 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0] whitespace-nowrap ${
                isRecording || status === 'transcribing' ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{audioSourceKind === 'uploaded' ? 'Choose Another File' : 'Upload Audio'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/webm,audio/mp4,audio/x-m4a,audio/ogg,audio/aac,audio/flac,.mp3,.wav,.webm,.m4a,.ogg,.aac,.flac"
                onChange={(e) => void handleAudioFileUpload(e)}
                disabled={isRecording || status === 'transcribing'}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Audio Capture / File Validation Error */}
      {audioError && (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-2.5 text-xs text-[#9A3412]"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{audioError}</p>
        </div>
      )}

      {/* Audio Playback & Transcription Action Card */}
      {audioPreviewUrl && audioBase64 && !isRecording && (
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileAudio className="h-4 w-4 shrink-0 text-[#14532D]" aria-hidden="true" />
              <span className="truncate text-xs font-semibold text-[#1C2420]">
                {audioSourceName}
              </span>
              {audioByteSize > 0 && (
                <span className="text-[11px] text-[#526058] whitespace-nowrap">
                  ({formatFileSize(audioByteSize)})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={clearAudioAndTranscript}
              disabled={status === 'transcribing'}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E4] bg-white px-2.5 py-1 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remove</span>
            </button>
          </div>

          <audio controls src={audioPreviewUrl} className="w-full h-10" />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[#526058]">
              Audio stays in-session for transcription and is not permanently published.
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {status === 'error' || originalTranscript ? (
                <button
                  type="button"
                  disabled={status === 'transcribing'}
                  onClick={() => void runTranscription()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#14532D] bg-white px-3.5 py-2 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0] disabled:opacity-60 whitespace-nowrap"
                >
                  {status === 'transcribing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {status === 'transcribing' ? 'Retrying Transcription...' : 'Retry Transcription'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={status === 'transcribing'}
                  onClick={() => void runTranscription()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60 whitespace-nowrap"
                >
                  {status === 'transcribing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {status === 'transcribing'
                      ? 'Transcribing Audio...'
                      : 'Transcribe with Gemini 3.5'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transcription Error Banner */}
      {transcribeError && (
        <div
          className="flex items-start justify-between gap-3 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-3 text-xs text-[#991B1B]"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{transcribeError}</p>
          </div>
          {audioBase64 && (
            <button
              type="button"
              onClick={() => void runTranscription()}
              disabled={status === 'transcribing'}
              className="shrink-0 rounded-md border border-[#FCA5A5] bg-white px-2.5 py-1 text-xs font-semibold text-[#991B1B] hover:bg-[#FEF2F2]"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Original Spoken Transcript + Citizen Correction & Report Extraction */}
      {originalTranscript && (
        <div className="rounded-xl border border-[#CFE3D5] bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8E4] pb-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-[#14532D]">
                Gemini 3.5 Transcribe Result
              </h3>
              <p className="text-xs text-[#526058]">
                Review the original spoken transcript below and fix any word or landmark errors before filling the report form.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-2.5 py-1 text-xs font-medium text-[#14532D]">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Detected: {LANGUAGE_DISPLAY[detectedLanguage]}</span>
            </span>
          </div>

          {/* Preserved Read-Only Original Transcript */}
          <div className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3 space-y-1">
            <span className="block text-[11px] font-semibold text-[#526058]">
              Original Spoken Transcription (Preserved)
            </span>
            <p className="text-sm text-[#29322D] whitespace-pre-wrap leading-relaxed">
              &ldquo;{originalTranscript}&rdquo;
            </p>
          </div>

          {/* Editable Citizen Correction Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="voice-corrected-transcript"
                className="text-xs font-semibold text-[#1C2420]"
              >
                Review &amp; Correct Transcription (Optional)
              </label>
              {hasTranscriptEdits && (
                <button
                  type="button"
                  onClick={() => handleCorrectedChange(originalTranscript)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#14532D] hover:underline"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Reset to original</span>
                </button>
              )}
            </div>
            <textarea
              id="voice-corrected-transcript"
              rows={3}
              value={correctedTranscript}
              onChange={(e) => handleCorrectedChange(e.target.value)}
              placeholder="Correct any street names, ward names, or spelling if needed..."
              className="w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-[#526058]">
              Extracts structured fields &amp; checks missing details without submitting automatically.
            </span>
            <button
              type="button"
              disabled={extractingReport || !correctedTranscript.trim()}
              onClick={() => void handleConvertClick()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60 whitespace-nowrap"
            >
              {extractingReport ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {extractingReport
                  ? 'Extracting Report Details...'
                  : 'Convert Transcript to Civic Report'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
