import { auth } from '../firebase';
import {
  GeminiReportAnalysis,
  LanguageOption,
  LiveTranscriptEntry,
  LiveVoiceExtractedDraft,
  ReportMethod,
  TranscribeAudioResponse,
} from '../types/civic';

export interface AnalyzeCivicReportRequest {
  mode: ReportMethod;
  language: LanguageOption;
  autoDetectLanguage: boolean;
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  categories: string[];
  neighbourhoods: string[];
  currentDraft?: {
    title?: string;
    category?: string;
    neighbourhood?: string;
    address?: string;
    description?: string;
    duration?: string;
    impactAndSafety?: string;
  };
  followUpAnswers?: Array<{
    question: string;
    field: string;
    answer: string;
  }>;
}

export interface TranscribeAudioRequest {
  audioBase64: string;
  audioMimeType: string;
  preferredLanguage?: LanguageOption;
  autoDetectLanguage?: boolean;
  fileName?: string;
}

export interface ValidateVoiceReportRequest {
  transcript: Array<Pick<LiveTranscriptEntry, 'speaker' | 'text'>>;
  draft: Partial<LiveVoiceExtractedDraft>;
  language: LanguageOption;
  autoDetectLanguage: boolean;
  categories: string[];
  neighbourhoods: string[];
  reconcileWithTranscript?: boolean;
}

export interface ValidateVoiceReportResponse {
  validated: LiveVoiceExtractedDraft;
  validationErrors: string[];
  isValidForSubmission: boolean;
}

export async function getOptionalFirebaseIdToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Dedicated backend audio transcription using Gemini 3.5 Transcribe (gemini-3.5-transcribe).
 */
export async function transcribeAudioWithGemini(
  payload: TranscribeAudioRequest
): Promise<TranscribeAudioResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const idToken = await getOptionalFirebaseIdToken();
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/gemini/transcribe-audio', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<TranscribeAudioResponse>;

  if (!response.ok) {
    throw new Error(
      data.error || `Audio transcription failed with status ${response.status}. Please retry.`
    );
  }

  return data as TranscribeAudioResponse;
}

/**
 * Dedicated frontend service calling the server-side Gemini API proxy.
 * Structured cleanly so the endpoint can later point to a Python FastAPI / Cloud Run backend
 * without modifying UI components.
 */
export async function analyzeCivicReportWithGemini(
  payload: AnalyzeCivicReportRequest
): Promise<GeminiReportAnalysis> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const idToken = await getOptionalFirebaseIdToken();
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/gemini/analyze-report', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<GeminiReportAnalysis>;

  if (!response.ok) {
    throw new Error(
      data.error || `Civic AI analysis failed with status ${response.status}. Please try again.`
    );
  }

  return data as GeminiReportAnalysis;
}

/**
 * Validates and reconciles extracted fields from a Gemini Live voice conversation on the backend.
 */
export async function validateVoiceReportDraft(
  payload: ValidateVoiceReportRequest
): Promise<ValidateVoiceReportResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const idToken = await getOptionalFirebaseIdToken();
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/gemini/validate-voice-report', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<ValidateVoiceReportResponse>;

  if (!response.ok) {
    throw new Error(
      data.error || `Voice report validation failed with status ${response.status}.`
    );
  }

  return data as ValidateVoiceReportResponse;
}

