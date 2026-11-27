import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
  Type,
} from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Load Firebase projectId from local applet config for lightweight token claim verification
let FIREBASE_PROJECT_ID = '';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { projectId?: string };
    FIREBASE_PROJECT_ID = parsed.projectId ?? '';
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json:', err);
}

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/flac',
]);

function normalizeAudioMimeType(rawMime: unknown): string {
  const base = String(rawMime ?? 'audio/webm').split(';')[0].trim().toLowerCase();
  if (base === 'audio/x-wav' || base === 'audio/wave') return 'audio/wav';
  if (base === 'audio/x-m4a' || base === 'audio/m4a') return 'audio/mp4';
  if (base === 'audio/mpeg') return 'audio/mp3';
  return base;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Sliding-window in-memory rate limiter for unlocked preview requests (25 requests / 15 min per IP)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 25;
const ipRequestTimestamps = new Map<string, number[]>();

// Shared Firebase Auth JWT claim verification helper (used by HTTP routes & Live WebSocket)
function verifyBearerTokenClaims(token: string): { ok: true; uid: string } | { ok: false; status: number; error: string } {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return { ok: false, status: 401, error: 'Invalid authentication token format.' };
  }

  try {
    const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf-8');
    const claims = JSON.parse(payloadJson) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    if (!claims.sub || typeof claims.sub !== 'string') {
      return { ok: false, status: 401, error: 'Invalid user subject in authentication token.' };
    }
    if (typeof claims.exp !== 'number' || claims.exp < nowSec) {
      return { ok: false, status: 401, error: 'Your session token has expired. Please sign in again.' };
    }
    if (FIREBASE_PROJECT_ID) {
      const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
      if (claims.aud !== FIREBASE_PROJECT_ID || claims.iss !== expectedIssuer) {
        return {
          ok: false,
          status: 403,
          error: 'Authentication token does not match this NAMMAOORU project.',
        };
      }
    }

    return { ok: true, uid: claims.sub };
  } catch {
    return { ok: false, status: 401, error: 'Unable to parse authentication token.' };
  }
}

// Verify Bearer Firebase Auth JWT claims when provided, and apply rate limiting for unlocked preview sessions
function verifyOptionalBearerWithRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const nowMs = Date.now();
  const recent = (ipRequestTimestamps.get(ip) ?? []).filter(
    (ts) => nowMs - ts < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too many AI analysis requests right now. Please wait a few minutes and try again.',
    });
    return;
  }
  recent.push(nowMs);
  ipRequestTimestamps.set(ip, recent);

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next();
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Invalid authorization header format.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verification = verifyBearerTokenClaims(token);
  if (!verification.ok) {
    res.status(verification.status).json({ error: verification.error });
    return;
  }

  next();
}

const DEFAULT_CATEGORIES = [
  'Roads & Potholes',
  'Waste & Sanitation',
  'Streetlights & Power',
  'Water & Drainage',
  'Parks & Trees',
  'Footpaths & Safety',
];

const DEFAULT_NEIGHBOURHOODS = [
  'Indiranagar',
  'Jayanagar',
  'Whitefield',
  'Malleshwaram',
  'Koramangala',
  'HSR Layout',
  'Rajajinagar',
  'Yelahanka',
];

interface SanitizedVoiceDraft {
  title: string;
  category: string;
  description: string;
  neighbourhood: string;
  address: string;
  duration: string;
  impactAndSafety: string;
  detectedLanguage: 'English' | 'Kannada' | 'Hindi';
  suggestedDepartment: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  originalStatementSummary: string;
  fieldsNeedingConfirmation: string[];
  aiSummary: string;
}

function detectLanguageFromScript(text: string): 'English' | 'Kannada' | 'Hindi' | null {
  if (/[\u0C80-\u0CFF]/.test(text)) return 'Kannada';
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
  if (/[a-zA-Z]{4,}/.test(text)) return 'English';
  return null;
}

function matchAllowedValue(raw: unknown, allowed: string[]): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const exact = allowed.find((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const partial = allowed.find(
    (item) =>
      item.toLowerCase().includes(trimmed.toLowerCase()) ||
      trimmed.toLowerCase().includes(item.toLowerCase())
  );
  return partial ?? '';
}

function cleanShortText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function sanitizeVoiceDraft(
  raw: Record<string, unknown>,
  allowedCategories: string[],
  allowedNeighbourhoods: string[],
  fallbackLanguage: 'English' | 'Kannada' | 'Hindi'
): SanitizedVoiceDraft {
  const title = cleanShortText(raw.title, 160);
  const category = matchAllowedValue(raw.category, allowedCategories);
  const neighbourhood = matchAllowedValue(raw.neighbourhood, allowedNeighbourhoods);
  const address = cleanShortText(raw.address, 240);
  const description = cleanShortText(raw.description, 2000);
  const duration = cleanShortText(raw.duration, 160);
  const impactAndSafety = cleanShortText(raw.impactAndSafety, 500);
  const suggestedDepartment = cleanShortText(raw.suggestedDepartment, 120);
  const originalStatementSummary = cleanShortText(raw.originalStatementSummary, 1000);
  const aiSummary = cleanShortText(raw.aiSummary, 480);

  const rawLang = cleanShortText(raw.detectedLanguage, 32);
  const detectedLanguage: 'English' | 'Kannada' | 'Hindi' =
    rawLang === 'Kannada' || rawLang === 'Hindi' || rawLang === 'English'
      ? rawLang
      : fallbackLanguage;

  const rawPriority = cleanShortText(raw.priority, 20);
  const priority: 'Low' | 'Medium' | 'High' | 'Urgent' =
    rawPriority === 'Low' ||
    rawPriority === 'Medium' ||
    rawPriority === 'High' ||
    rawPriority === 'Urgent'
      ? rawPriority
      : 'Medium';

  const allowedConfirmFields = new Set([
    'title',
    'category',
    'neighbourhood',
    'address',
    'description',
    'duration',
    'impactAndSafety',
  ]);
  const confirmSet = new Set<string>();

  if (Array.isArray(raw.fieldsNeedingConfirmation)) {
    for (const item of raw.fieldsNeedingConfirmation) {
      const f = String(item);
      if (allowedConfirmFields.has(f)) {
        confirmSet.add(f);
      }
    }
  }

  // Always flag missing core fields so citizen confirms before submitting
  if (!title || title.length < 3) confirmSet.add('title');
  if (!category) confirmSet.add('category');
  if (!neighbourhood) confirmSet.add('neighbourhood');
  if (!address || address.length < 2) confirmSet.add('address');
  if (!description || description.length < 5) confirmSet.add('description');

  return {
    title,
    category,
    description,
    neighbourhood,
    address,
    duration,
    impactAndSafety,
    detectedLanguage,
    suggestedDepartment,
    priority,
    originalStatementSummary,
    fieldsNeedingConfirmation: Array.from(confirmSet),
    aiSummary,
  };
}

const UPDATE_CIVIC_REPORT_DRAFT_TOOL: FunctionDeclaration = {
  name: 'update_civic_report_draft',
  description:
    'Updates the live NAMMAOORU civic report preview with structured details extracted strictly from what the citizen has spoken so far. Call this whenever the citizen shares or clarifies the problem, category, neighbourhood, street/landmark, duration, or impact/safety concerns. Never invent missing details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Concise factual issue title based only on spoken details (or empty string if unclear).',
      },
      category: {
        type: Type.STRING,
        description: 'Best matching issue category from the allowed NAMMAOORU categories list.',
      },
      description: {
        type: Type.STRING,
        description:
          'Clear, structured factual description preserving the citizen’s exact meaning without inventing facts.',
      },
      neighbourhood: {
        type: Type.STRING,
        description:
          'Bengaluru neighbourhood from the allowed list ONLY if explicitly spoken by the citizen; otherwise empty string.',
      },
      address: {
        type: Type.STRING,
        description:
          'Street, cross road, or nearby landmark ONLY if explicitly spoken by the citizen; otherwise empty string.',
      },
      duration: {
        type: Type.STRING,
        description: 'How long the problem has existed, ONLY if stated by the citizen; otherwise empty string.',
      },
      impactAndSafety: {
        type: Type.STRING,
        description:
          'Impact on residents/commuters or safety hazards ONLY if mentioned by the citizen; otherwise empty string.',
      },
      detectedLanguage: {
        type: Type.STRING,
        description: 'Currently detected spoken language: "English", "Kannada", or "Hindi".',
      },
      suggestedDepartment: {
        type: Type.STRING,
        description:
          'Suggested Bengaluru municipal department (e.g. BBMP Road Infrastructure, BBMP Solid Waste Management, BWSSB & Stormwater Drains, BESCOM Streetlighting Cell, BBMP Forest & Horticulture, Traffic & Pedestrian Safety Desk).',
      },
      priority: {
        type: Type.STRING,
        description: 'Estimated urgency based on spoken safety risk: "Low", "Medium", "High", or "Urgent".',
      },
      originalStatementSummary: {
        type: Type.STRING,
        description:
          'Faithful summary preserving the citizen’s original spoken words/meaning in their language.',
      },
      fieldsNeedingConfirmation: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'List of field names still uncertain or not yet provided (from: "title", "category", "neighbourhood", "address", "description", "duration", "impactAndSafety").',
      },
      aiSummary: {
        type: Type.STRING,
        description: 'One-sentence factual summary of what has been captured so far.',
      },
    },
    required: ['detectedLanguage'],
  },
};

const VALIDATE_VOICE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    category: { type: Type.STRING },
    description: { type: Type.STRING },
    neighbourhood: { type: Type.STRING },
    address: { type: Type.STRING },
    duration: { type: Type.STRING },
    impactAndSafety: { type: Type.STRING },
    detectedLanguage: { type: Type.STRING },
    suggestedDepartment: { type: Type.STRING },
    priority: { type: Type.STRING },
    originalStatementSummary: { type: Type.STRING },
    fieldsNeedingConfirmation: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    aiSummary: { type: Type.STRING },
  },
  required: [
    'title',
    'category',
    'description',
    'neighbourhood',
    'address',
    'duration',
    'impactAndSafety',
    'detectedLanguage',
    'suggestedDepartment',
    'priority',
    'originalStatementSummary',
    'fieldsNeedingConfirmation',
    'aiSummary',
  ],
};

function buildLiveCivicSystemInstruction(params: {
  preferredLanguage: 'English' | 'Kannada' | 'Hindi';
  autoDetectLanguage: boolean;
  categories: string[];
  neighbourhoods: string[];
}): string {
  return `You are NAMMAOORU's warm, helpful Bengaluru civic voice reporting assistant ("NAMMA JAVABDARI — Our City, Our Responsibility").

Your goal is to have a natural, concise, real-time spoken conversation to help a Bengaluru citizen report a neighbourhood civic problem.

LANGUAGE RULES:
- Initial preferred language: ${params.preferredLanguage}.
- Automatic language detection enabled: ${params.autoDetectLanguage ? 'Yes' : 'No'}.
- Supported languages: Kannada (ಕನ್ನಡ), English, and Hindi (हिन्दी).
- If Auto-Detect is enabled and the citizen speaks Kannada, immediately respond naturally in polite, everyday Bengaluru Kannada. If they speak English, respond in natural Indian English. If they speak Hindi, respond in natural conversational Hindi. If Auto-Detect is disabled, speak in ${params.preferredLanguage}.
- Never force the citizen to switch languages. Preserve the meaning of what they say accurately.

CONVERSATION STYLE:
- Keep every spoken response brief, warm, and natural (1–2 short sentences at a time, ideal for real-time voice).
- Start by briefly greeting the citizen and asking what neighbourhood problem they have noticed.
- Listen carefully, understand the civic issue, and identify the likely category from: ${params.categories.join(', ')}.
- Ask ONE contextual, dynamic follow-up question at a time based strictly on what is missing or unclear — NOT a rigid checklist!
- Naturally gather when relevant:
  1. Exact Bengaluru neighbourhood (from: ${params.neighbourhoods.join(', ')})
  2. Street, cross road, or nearby landmark
  3. How long the problem has been happening (duration)
  4. Impact on residents/commuters or any safety hazard (e.g., elders walking, school zone, monsoon flooding, live wires)
- If anything sounds unclear or uncertain (such as a landmark or neighbourhood), politely ask the citizen to clarify instead of assuming or inventing it.

LIVE REPORT EXTRACTION TOOL:
- Whenever the citizen provides new or clarified details, call the \`update_civic_report_draft\` function with the cumulative details gathered strictly from what the citizen actually said.
- NEVER invent, guess, or fabricate missing streets, landmarks, neighbourhoods, durations, or hazards. Leave unspoken fields as empty strings "" and include them in \`fieldsNeedingConfirmation\`.
- Always map \`category\` to one of: ${params.categories.join(', ')}, and \`neighbourhood\` to one of: ${params.neighbourhoods.join(', ')} (only when stated).
- NEVER say the report has been submitted or filed with BBMP/BWSSB/BESCOM. Once the key details are captured, briefly summarize what you noted and let the citizen know they can end the conversation to review, edit, and submit their report themselves.`;
}

function isOriginAllowed(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Non-browser or same-origin without Origin header
  try {
    const parsedOrigin = new URL(origin);
    const forwardedHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim();
    const hostHeader = forwardedHost || String(req.headers.host ?? '').trim();
    if (!hostHeader) return true;
    const expectedHost = hostHeader.split(':')[0].toLowerCase();
    const originHost = parsedOrigin.hostname.toLowerCase();
    return (
      originHost === expectedHost ||
      originHost === 'localhost' ||
      originHost === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedLanguage: {
      type: Type.STRING,
      description: 'Detected language: must be exactly one of "English", "Kannada", or "Hindi".',
    },
    transcription: {
      type: Type.STRING,
      description: 'Clean transcription of voice input if audio was provided, otherwise empty string.',
    },
    extracted: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Concise, factual issue title based strictly on provided input, or empty string if unclear.',
        },
        category: {
          type: Type.STRING,
          description: 'Best matching category from the provided list, or empty string if unclear.',
        },
        neighbourhood: {
          type: Type.STRING,
          description: 'Bengaluru neighbourhood ONLY if explicitly stated or clearly visible on a sign; otherwise empty string.',
        },
        address: {
          type: Type.STRING,
          description: 'Street, cross road, or landmark ONLY if explicitly stated or visibly readable in the photo; otherwise empty string.',
        },
        description: {
          type: Type.STRING,
          description: 'Clear, structured factual description of the civic problem observed without inventing unstated facts.',
        },
        duration: {
          type: Type.STRING,
          description: 'How long the problem has persisted ONLY if explicitly stated; otherwise empty string.',
        },
        impactAndSafety: {
          type: Type.STRING,
          description: 'Public impact or safety concerns ONLY if explicitly stated or clearly visible; otherwise empty string.',
        },
        suggestedDepartment: {
          type: Type.STRING,
          description: 'Suggested Bengaluru municipal department for this issue type (e.g. BBMP Road Infrastructure, BBMP Solid Waste Management, BWSSB & Stormwater Drains, BESCOM Streetlighting Cell, BBMP Forest & Horticulture, Traffic & Pedestrian Safety Desk).',
        },
        priority: {
          type: Type.STRING,
          description: 'One of "Low", "Medium", "High", or "Urgent" based on visible/stated public safety impact.',
        },
        aiSummary: {
          type: Type.STRING,
          description: 'Short 1-2 sentence explanation of what Gemini observed and why it suggested this routing.',
        },
      },
      required: [
        'title',
        'category',
        'neighbourhood',
        'address',
        'description',
        'duration',
        'impactAndSafety',
        'suggestedDepartment',
        'priority',
        'aiSummary',
      ],
    },
    missingFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of missing required fields that the citizen still needs to clarify (e.g. "neighbourhood", "address", "duration", "safety_impact").',
    },
    followUpQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          field: {
            type: Type.STRING,
            description: 'One of "title", "category", "neighbourhood", "address", "description", "safety_impact", or "duration".',
          },
          question: {
            type: Type.STRING,
            description: 'Specific, helpful follow-up question tailored to THIS exact photo/voice/text input in the citizen language.',
          },
          reason: {
            type: Type.STRING,
            description: 'Short note explaining why this detail helps routing or field teams.',
          },
          placeholder: {
            type: Type.STRING,
            description: 'Short example answer placeholder.',
          },
        },
        required: ['id', 'field', 'question', 'reason', 'placeholder'],
      },
      description: '1 to 4 dynamic follow-up questions generated specifically for this report. Empty array if all key details are already complete.',
    },
    readyForReview: {
      type: Type.BOOLEAN,
      description: 'True if title, category, neighbourhood, address/landmark, and description are sufficiently complete for citizen review.',
    },
    confidenceNote: {
      type: Type.STRING,
      description: 'Brief note clarifying what was extracted directly vs what requires citizen verification.',
    },
  },
  required: [
    'detectedLanguage',
    'transcription',
    'extracted',
    'missingFields',
    'followUpQuestions',
    'readyForReview',
    'confidenceNote',
  ],
};

interface AnalyzeReportBody {
  mode?: 'Photograph' | 'Voice' | 'Text';
  language?: 'English' | 'Kannada' | 'Hindi';
  autoDetectLanguage?: boolean;
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  categories?: string[];
  neighbourhoods?: string[];
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'nammaooru-citizen-api' });
  });

  // Dedicated server-side audio transcription using Gemini 3.5 Transcribe
  app.post(
    '/api/gemini/transcribe-audio',
    verifyOptionalBearerWithRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as {
          audioBase64?: string;
          audioMimeType?: string;
          preferredLanguage?: 'English' | 'Kannada' | 'Hindi';
          autoDetectLanguage?: boolean;
        };

        const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
        if (audioBase64.length < 20) {
          res.status(400).json({
            error: 'Please record or upload a valid audio clip before transcribing.',
          });
          return;
        }

        // Enforce 10 MB decoded audio file size limit (~13.5 MB base64)
        const estimatedBytes = Math.floor((audioBase64.length * 3) / 4);
        if (estimatedBytes > 10 * 1024 * 1024) {
          res.status(400).json({
            error: 'Audio file exceeds the 10 MB limit. Please upload a shorter clip or compress the audio.',
          });
          return;
        }

        const rawBaseMime = String(body.audioMimeType ?? 'audio/webm')
          .split(';')[0]
          .trim()
          .toLowerCase();
        if (!ALLOWED_AUDIO_MIMES.has(rawBaseMime)) {
          res.status(400).json({
            error:
              'Unsupported audio format. Supported formats: MP3, WAV, WebM, M4A/MP4, OGG, AAC, and FLAC.',
          });
          return;
        }

        const normalizedMime = normalizeAudioMimeType(rawBaseMime);
        const preferredLanguage: 'English' | 'Kannada' | 'Hindi' =
          body.preferredLanguage === 'Kannada' || body.preferredLanguage === 'Hindi'
            ? body.preferredLanguage
            : 'English';
        const autoDetect = body.autoDetectLanguage !== false;

        const ai = getGeminiClient();

        const transcribeInstruction = autoDetect
          ? 'Transcribe this Bengaluru citizen civic issue audio accurately in the exact spoken language (Kannada, English, or Hindi — auto-detect the spoken language). Preserve the speaker’s exact words, meaning, natural conversational phrasing, and pauses cleanly. Do NOT translate unless spoken in multiple languages, and NEVER add or invent any information that was not spoken. Return ONLY the clean transcription text.'
          : `Transcribe this Bengaluru citizen civic issue audio accurately in ${preferredLanguage} (while preserving any naturally spoken words in Kannada, English, or Hindi). Preserve the speaker’s exact words and meaning without adding or inventing any information that was not spoken. Return ONLY the clean transcription text.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: audioBase64,
                },
              },
              { text: transcribeInstruction },
            ],
          },
        });

        const transcript = (response.text ?? '').trim();
        if (!transcript) {
          res.status(422).json({
            error:
              'No clear speech could be transcribed from this audio. Please check your recording or try another clip.',
          });
          return;
        }

        let detectedLanguage: 'English' | 'Kannada' | 'Hindi' = preferredLanguage;
        if (autoDetect) {
          const scriptDetected = detectLanguageFromScript(transcript);
          if (scriptDetected) {
            detectedLanguage = scriptDetected;
          }
        }

        res.json({
          transcript,
          detectedLanguage,
          model: 'gemini-3.5-transcribe',
        });
      } catch (err) {
        console.error('Gemini transcribe-audio error:', err);
        const rawMessage =
          err instanceof Error ? err.message : 'Unable to transcribe audio right now.';
        if (/GEMINI_API_KEY is not configured/i.test(rawMessage)) {
          res.status(503).json({
            error:
              'Audio transcription requires GEMINI_API_KEY to be configured on the backend server (Settings > Secrets).',
          });
          return;
        }
        if (/403|PERMISSION_DENIED|API_KEY_INVALID|400/i.test(rawMessage)) {
          res.status(502).json({
            error:
              'Gemini 3.5 Transcribe rejected the configured server API key or audio payload. Please verify GEMINI_API_KEY in Settings > Secrets or retry with WAV/MP3/WebM audio.',
          });
          return;
        }
        if (/429|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
          res.status(429).json({
            error:
              'Gemini transcription quota is currently reached. Please wait a moment and retry.',
          });
          return;
        }
        res.status(500).json({
          error: `Gemini 3.5 Transcribe could not process this audio: ${rawMessage}`,
        });
      }
    }
  );

  // Real server-side Gemini multimodal civic report analysis (Photo, Voice, Text)
  app.post('/api/gemini/analyze-report', verifyOptionalBearerWithRateLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as AnalyzeReportBody;
      const mode = body.mode === 'Photograph' || body.mode === 'Voice' || body.mode === 'Text'
        ? body.mode
        : 'Text';
      const preferredLanguage =
        body.language === 'Kannada' || body.language === 'Hindi' ? body.language : 'English';
      const autoDetect = Boolean(body.autoDetectLanguage);

      const allowedCategories = Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories.map((c) => String(c).slice(0, 80)).slice(0, 20)
        : [
            'Roads & Potholes',
            'Waste & Sanitation',
            'Streetlights & Power',
            'Water & Drainage',
            'Parks & Trees',
            'Footpaths & Safety',
          ];

      const allowedNeighbourhoods = Array.isArray(body.neighbourhoods) && body.neighbourhoods.length > 0
        ? body.neighbourhoods.map((n) => String(n).slice(0, 80)).slice(0, 20)
        : [
            'Indiranagar',
            'Jayanagar',
            'Whitefield',
            'Malleshwaram',
            'Koramangala',
            'HSR Layout',
            'Rajajinagar',
            'Yelahanka',
          ];

      const textInput = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
      const hasImage = typeof body.imageBase64 === 'string' && body.imageBase64.length > 20;
      const hasAudio = typeof body.audioBase64 === 'string' && body.audioBase64.length > 20;

      if (!textInput && !hasImage && !hasAudio) {
        res.status(400).json({
          error: 'Please provide a photograph, voice recording, or text description to analyze.',
        });
        return;
      }

      if (hasImage) {
        const mime = String(body.imageMimeType ?? '').toLowerCase();
        if (!ALLOWED_IMAGE_MIMES.has(mime)) {
          res.status(400).json({ error: 'Unsupported image format. Please upload JPG, PNG, or WebP.' });
          return;
        }
        if (body.imageBase64!.length > 7_500_000) {
          res.status(400).json({ error: 'Image is too large. Please upload an image under 5 MB.' });
          return;
        }
      }

      if (hasAudio) {
        const baseMime = String(body.audioMimeType ?? 'audio/webm').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_AUDIO_MIMES.has(baseMime)) {
          res.status(400).json({ error: 'Unsupported audio format. Please record again or type a note.' });
          return;
        }
        if (body.audioBase64!.length > 7_500_000) {
          res.status(400).json({ error: 'Audio recording is too large. Please keep voice notes under 60 seconds.' });
          return;
        }
      }

      const ai = getGeminiClient();

      // Step 1: If audio was recorded, transcribe it first with gemini-3.5-transcribe
      let audioTranscript = '';
      if (hasAudio) {
        const cleanMime = String(body.audioMimeType ?? 'audio/webm').split(';')[0].trim().toLowerCase();
        const transcribeResp = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: body.audioBase64!,
                },
              },
              {
                text: 'Transcribe this Bengaluru civic issue voice report accurately in its spoken language (English, Kannada, or Hindi). Return only the spoken transcript.',
              },
            ],
          },
        });
        audioTranscript = (transcribeResp.text ?? '').trim();
      }

      // Step 2: Analyze multimodal evidence + transcript + citizen follow-up answers with gemini-4-hydrogen
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (hasImage) {
        parts.push({
          inlineData: {
            mimeType: String(body.imageMimeType).toLowerCase(),
            data: body.imageBase64!,
          },
        });
      }

      const draftSummary = body.currentDraft
        ? JSON.stringify({
            title: String(body.currentDraft.title ?? '').slice(0, 160),
            category: String(body.currentDraft.category ?? '').slice(0, 80),
            neighbourhood: String(body.currentDraft.neighbourhood ?? '').slice(0, 80),
            address: String(body.currentDraft.address ?? '').slice(0, 240),
            description: String(body.currentDraft.description ?? '').slice(0, 1200),
            duration: String(body.currentDraft.duration ?? '').slice(0, 160),
            impactAndSafety: String(body.currentDraft.impactAndSafety ?? '').slice(0, 500),
          })
        : '{}';

      const answersSummary =
        Array.isArray(body.followUpAnswers) && body.followUpAnswers.length > 0
          ? body.followUpAnswers
              .slice(0, 8)
              .map(
                (item, idx) =>
                  `Q${idx + 1} (${String(item.field)}): ${String(item.question)}\nCitizen Answer: ${String(item.answer).slice(0, 400)}`
              )
              .join('\n\n')
          : 'None yet';

      const promptText = `You are NAMMAOORU's Bengaluru civic intelligence intake assistant.

Reporting Mode: ${mode}
Preferred Language: ${preferredLanguage}
Auto-Detect Language Enabled: ${autoDetect ? 'Yes' : 'No'}
Allowed Civic Categories: ${allowedCategories.join(', ')}
Bengaluru Pilot Neighbourhoods: ${allowedNeighbourhoods.join(', ')}

Citizen Text / Reviewed Voice Transcript Input:
${textInput || '(none provided)'}

Voice Transcription (if raw audio was sent directly):
${audioTranscript || '(none)'}

Existing Citizen Form Draft (preserve already confirmed fields unless clarified by new input):
${draftSummary}

Citizen Answers to Previous Follow-Up Questions:
${answersSummary}

STRICT RULES:
1. Extract structured fields strictly from what is visibly shown in the photograph, spoken in the voice transcript, written in the text, or answered by the citizen — including duration and impactAndSafety when mentioned.
2. NEVER invent or hallucinate missing details (especially street names, cross roads, landmarks, neighbourhoods, durations, or safety impacts). If a detail is not present in the evidence or citizen answers, leave that extracted field as "" (empty string) and list it in missingFields.
3. Generate 1 to 4 DYNAMIC, context-specific follow-up questions tailored specifically to THIS exact photograph/transcript/issue and what is still missing so field teams can act. Never output generic canned questions.
4. If the citizen provided Kannada or Hindi input (or preferred Kannada/Hindi), write followUpQuestions in a warm, accessible style matching that language (or bilingual English + Kannada/Hindi if helpful), while keeping category and neighbourhood mapped cleanly to the allowed Bengaluru lists.
5. Set readyForReview to true ONLY when title, category, neighbourhood, address/landmark, and description are all reasonably complete.
6. Remember: You are preparing a draft for the citizen to review before submission—never claim the report has already been submitted to BBMP/BWSSB/BESCOM.`;

      parts.push({ text: promptText });

      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
        },
      });

      const rawText = analysisResponse.text;
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty analysis response. Please retry.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        detectedLanguage?: string;
        transcription?: string;
        extracted?: Record<string, string>;
        missingFields?: string[];
        followUpQuestions?: Array<Record<string, string>>;
        readyForReview?: boolean;
        confidenceNote?: string;
      };

      const normalizedLang =
        parsed.detectedLanguage === 'Kannada' || parsed.detectedLanguage === 'Hindi'
          ? parsed.detectedLanguage
          : 'English';

      res.json({
        detectedLanguage: normalizedLang,
        transcription: audioTranscript || parsed.transcription || '',
        extracted: {
          title: String(parsed.extracted?.title ?? '').slice(0, 160),
          category: String(parsed.extracted?.category ?? '').slice(0, 80),
          neighbourhood: String(parsed.extracted?.neighbourhood ?? '').slice(0, 80),
          address: String(parsed.extracted?.address ?? '').slice(0, 240),
          description: String(parsed.extracted?.description ?? '').slice(0, 2000),
          duration: String(parsed.extracted?.duration ?? '').slice(0, 160),
          impactAndSafety: String(parsed.extracted?.impactAndSafety ?? '').slice(0, 500),
          suggestedDepartment: String(parsed.extracted?.suggestedDepartment ?? '').slice(0, 120),
          priority: ['Low', 'Medium', 'High', 'Urgent'].includes(String(parsed.extracted?.priority))
            ? String(parsed.extracted?.priority)
            : 'Medium',
          aiSummary: String(parsed.extracted?.aiSummary ?? '').slice(0, 480),
        },
        missingFields: Array.isArray(parsed.missingFields)
          ? parsed.missingFields.map(String).slice(0, 10)
          : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions)
          ? parsed.followUpQuestions.slice(0, 4).map((q, idx) => ({
              id: String(q.id || `fq-${idx + 1}`),
              field: String(q.field || 'description'),
              question: String(q.question || ''),
              reason: String(q.reason || ''),
              placeholder: String(q.placeholder || 'Enter your response...'),
            }))
          : [],
        readyForReview: Boolean(parsed.readyForReview),
        confidenceNote: String(parsed.confidenceNote ?? '').slice(0, 300),
      });
    } catch (err) {
      console.error('Gemini analyze-report error:', err);
      const message =
        err instanceof Error ? err.message : 'Unable to analyze civic report right now.';
      res.status(500).json({
        error: `AI analysis could not be completed: ${message}`,
      });
    }
  });

  // Backend validation & transcript reconciliation for Gemini Live voice reports
  app.post(
    '/api/gemini/validate-voice-report',
    verifyOptionalBearerWithRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as {
          transcript?: Array<{ speaker?: string; text?: string }>;
          draft?: Record<string, unknown>;
          language?: 'English' | 'Kannada' | 'Hindi';
          autoDetectLanguage?: boolean;
          categories?: string[];
          neighbourhoods?: string[];
          reconcileWithTranscript?: boolean;
        };

        const preferredLanguage: 'English' | 'Kannada' | 'Hindi' =
          body.language === 'Kannada' || body.language === 'Hindi' ? body.language : 'English';

        const allowedCategories =
          Array.isArray(body.categories) && body.categories.length > 0
            ? body.categories.map((c) => String(c).slice(0, 80)).slice(0, 20)
            : DEFAULT_CATEGORIES;

        const allowedNeighbourhoods =
          Array.isArray(body.neighbourhoods) && body.neighbourhoods.length > 0
            ? body.neighbourhoods.map((n) => String(n).slice(0, 80)).slice(0, 20)
            : DEFAULT_NEIGHBOURHOODS;

        const transcriptLines = Array.isArray(body.transcript)
          ? body.transcript
              .slice(0, 80)
              .map((entry) => {
                const role = entry.speaker === 'assistant' ? 'Assistant' : 'Citizen';
                const text = cleanShortText(entry.text, 600);
                return text ? `${role}: ${text}` : '';
              })
              .filter(Boolean)
          : [];

        const rawDraft =
          body.draft && typeof body.draft === 'object' && !Array.isArray(body.draft)
            ? body.draft
            : {};

        let validated = sanitizeVoiceDraft(
          rawDraft,
          allowedCategories,
          allowedNeighbourhoods,
          preferredLanguage
        );

        // When ending a live conversation with transcript lines, reconcile strictly with Gemini so no spoken detail is lost
        if (body.reconcileWithTranscript && transcriptLines.length > 0) {
          const ai = getGeminiClient();
          const prompt = `You are validating and structuring a completed NAMMAOORU Bengaluru citizen voice conversation into a draft civic report for citizen review.

Allowed Civic Categories: ${allowedCategories.join(', ')}
Allowed Bengaluru Neighbourhoods: ${allowedNeighbourhoods.join(', ')}
Preferred Language: ${preferredLanguage}
Auto-Detect Language: ${body.autoDetectLanguage ? 'Yes' : 'No'}

Live Extracted Draft So Far:
${JSON.stringify(validated)}

Full Voice Conversation Transcript:
${transcriptLines.join('\n')}

STRICT RULES:
1. Extract and merge ONLY facts explicitly spoken by the citizen in the transcript or confirmed in the draft.
2. NEVER invent or hallucinate missing streets, landmarks, neighbourhoods, durations, or safety impacts. Leave unmentioned fields as "" and list their keys in fieldsNeedingConfirmation.
3. Preserve the citizen's original spoken statement accurately in originalStatementSummary (in their spoken language) and write a clear, accurate factual description without losing meaning.
4. Map category strictly to one of the Allowed Civic Categories (or "" if unclear).
5. Map neighbourhood strictly to one of the Allowed Bengaluru Neighbourhoods ONLY if mentioned (or "" if not stated).
6. Set detectedLanguage to "Kannada", "Hindi", or "English" matching the citizen's spoken language.`;

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: VALIDATE_VOICE_RESPONSE_SCHEMA,
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text) as Record<string, unknown>;
            validated = sanitizeVoiceDraft(
              parsed,
              allowedCategories,
              allowedNeighbourhoods,
              preferredLanguage
            );
          }
        }

        const validationErrors: string[] = [];
        if (!validated.title || validated.title.length < 3) {
          validationErrors.push('Issue title is missing or too short (minimum 3 characters).');
        }
        if (!validated.category) {
          validationErrors.push('Issue category must match an active NAMMAOORU category.');
        }
        if (!validated.neighbourhood) {
          validationErrors.push('Bengaluru neighbourhood still needs confirmation.');
        }
        if (!validated.address || validated.address.length < 2) {
          validationErrors.push('Street, cross road, or nearby landmark is required.');
        }
        if (!validated.description || validated.description.length < 5) {
          validationErrors.push('Problem description is missing or too short.');
        }

        res.json({
          validated,
          validationErrors,
          isValidForSubmission: validationErrors.length === 0,
        });
      } catch (err) {
        console.error('Gemini validate-voice-report error:', err);
        const message =
          err instanceof Error ? err.message : 'Unable to validate voice report right now.';
        res.status(500).json({ error: `Voice report validation failed: ${message}` });
      }
    }
  );

  // Helper: Server-side Google Maps Platform API key & Bengaluru neighbourhood matcher
  const getServerGoogleMapsApiKey = (): string =>
    (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  const buildMapsServerHeaders = (
    apiKey: string,
    fieldMask?: string
  ): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
    };
    if (fieldMask) {
      headers['X-Goog-FieldMask'] = fieldMask;
    }
    const appUrl = (process.env.APP_URL || '').trim();
    if (!process.env.GOOGLE_MAPS_API_KEY && /^https?:\/\//i.test(appUrl)) {
      headers.Referer = appUrl;
    }
    return headers;
  };

  interface MasterLocationDataset {
    city: {
      id: string;
      name: string;
      state: string;
      authority: string;
      center: { lat: number; lng: number };
      datasetVersion: string;
    };
    zones: Array<{
      id: string;
      cityId: string;
      name: string;
      code: string;
      center: { lat: number; lng: number };
      defaultZoom: number;
    }>;
    wards: Array<{
      id: string;
      cityId: string;
      zoneId: string;
      wardNumber: number;
      name: string;
      center: { lat: number; lng: number };
      defaultZoom: number;
    }>;
    localities: Array<{
      id: string;
      cityId: string;
      zoneId: string;
      wardId: string;
      name: string;
      pincode?: string;
      aliases?: string[];
      center: { lat: number; lng: number };
      isCustomAdded?: boolean;
    }>;
  }

  const BENGALURU_LOCATIONS_PATH = path.resolve(__dirname, 'data', 'bengaluru_locations.json');
  let cachedLocationsDataset: MasterLocationDataset | null = null;

  const loadBengaluruLocationsDataset = (): MasterLocationDataset => {
    if (cachedLocationsDataset) {
      return cachedLocationsDataset;
    }
    const raw = fs.readFileSync(BENGALURU_LOCATIONS_PATH, 'utf-8');
    cachedLocationsDataset = JSON.parse(raw) as MasterLocationDataset;
    return cachedLocationsDataset;
  };

  const matchBengaluruWardFromText = (text: string): string => {
    const lower = text.toLowerCase();
    try {
      const dataset = loadBengaluruLocationsDataset();
      // Prefer longest exact locality name or alias match so specific localities win cleanly
      let bestMatch = '';
      let bestLen = 0;
      for (const loc of dataset.localities) {
        const candidates = [loc.name, ...(loc.aliases ?? [])];
        for (const candidate of candidates) {
          const norm = candidate.trim().toLowerCase();
          if (norm.length > bestLen && lower.includes(norm)) {
            bestMatch = loc.name;
            bestLen = norm.length;
          }
        }
      }
      if (bestMatch) return bestMatch;
    } catch (err) {
      console.warn('Fallback ward matching used:', err);
    }

    for (const ward of DEFAULT_NEIGHBOURHOODS) {
      if (lower.includes(ward.toLowerCase())) {
        return ward;
      }
    }
    if (lower.includes('malleswaram')) return 'Malleshwaram';
    if (lower.includes('hsr')) return 'HSR Layout';
    return '';
  };

  // Bengaluru Master Location Hierarchy API (City -> Zone -> Ward -> Locality)
  app.get('/api/locations/bengaluru', (_req: Request, res: Response) => {
    try {
      const dataset = loadBengaluruLocationsDataset();
      res.setHeader('Cache-Control', 'no-cache');
      res.json(dataset);
    } catch (err) {
      console.error('Failed to load Bengaluru locations dataset:', err);
      res.status(500).json({ error: 'Unable to load Bengaluru ward and locality master dataset.' });
    }
  });

  // Add a new Bengaluru Neighbourhood / Locality dynamically without modifying dashboard code
  app.post(
    '/api/locations/bengaluru/localities',
    verifyOptionalBearerWithRateLimit,
    (req: Request, res: Response) => {
      try {
        const body = req.body as {
          name?: unknown;
          zoneId?: unknown;
          wardId?: unknown;
          pincode?: unknown;
          lat?: unknown;
          lng?: unknown;
          aliases?: unknown;
        };

        const name = cleanShortText(body.name, 80);
        const zoneId = cleanShortText(body.zoneId, 60);
        const wardId = cleanShortText(body.wardId, 60);
        const pincodeRaw = cleanShortText(body.pincode, 10);
        const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat);
        const lng = typeof body.lng === 'number' ? body.lng : Number(body.lng);

        if (name.length < 2) {
          res.status(400).json({ error: 'Neighbourhood or locality name must be at least 2 characters.' });
          return;
        }
        if (pincodeRaw && !/^\d{6}$/.test(pincodeRaw)) {
          res.status(400).json({ error: 'Pincode must be a valid 6-digit Indian postal code.' });
          return;
        }
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < 12.6 ||
          lat > 13.35 ||
          lng < 77.2 ||
          lng > 78.05
        ) {
          res.status(400).json({
            error: 'Coordinates must fall within the Bengaluru metropolitan region (lat 12.6–13.35, lng 77.2–78.05).',
          });
          return;
        }

        const dataset = loadBengaluruLocationsDataset();
        const zone = dataset.zones.find((z) => z.id === zoneId);
        if (!zone) {
          res.status(400).json({ error: 'Selected Bengaluru zone was not found.' });
          return;
        }
        const ward = dataset.wards.find((w) => w.id === wardId && w.zoneId === zoneId);
        if (!ward) {
          res.status(400).json({ error: 'Selected BBMP ward does not belong to the chosen zone.' });
          return;
        }

        const duplicate = dataset.localities.find(
          (l) => l.name.toLowerCase() === name.toLowerCase() && l.wardId === wardId
        );
        if (duplicate) {
          res.status(409).json({
            error: `${name} already exists under ${ward.name}.`,
          });
          return;
        }

        const sanitizedAliases = Array.isArray(body.aliases)
          ? body.aliases
              .map((a) => cleanShortText(a, 60))
              .filter((a) => a.length >= 2)
              .slice(0, 8)
          : [];

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40);
        const newId = `loc-${slug || 'area'}-${Date.now().toString(36).slice(-4)}`;

        const newLocality = {
          id: newId,
          cityId: dataset.city.id,
          zoneId: zone.id,
          wardId: ward.id,
          name,
          ...(pincodeRaw ? { pincode: pincodeRaw } : {}),
          ...(sanitizedAliases.length > 0 ? { aliases: sanitizedAliases } : {}),
          center: {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          },
          isCustomAdded: true,
        };

        dataset.localities.push(newLocality);

        try {
          fs.writeFileSync(
            BENGALURU_LOCATIONS_PATH,
            `${JSON.stringify(dataset, null, 2)}\n`,
            'utf-8'
          );
        } catch (writeErr) {
          // Keep in-memory dataset updated even if filesystem is read-only in some deployments
          console.warn('Persisting bengaluru_locations.json skipped:', writeErr);
        }

        res.status(201).json({
          locality: newLocality,
          dataset,
        });
      } catch (err) {
        console.error('Failed to add Bengaluru locality:', err);
        res.status(500).json({ error: 'Unable to add new locality right now.' });
      }
    }
  );

  // Runtime client config for Google Maps JS API (supports GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY)
  app.get('/api/maps/client-config', (_req: Request, res: Response) => {
    const apiKey = getServerGoogleMapsApiKey();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      configured: Boolean(apiKey),
      apiKey,
    });
  });

  // Server-side Reverse Geocoding proxy (Coordinates -> Readable Address)
  app.post(
    '/api/maps/reverse-geocode',
    verifyOptionalBearerWithRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = req.body as { lat?: unknown; lng?: unknown };
        const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat);
        const lng = typeof body.lng === 'number' ? body.lng : Number(body.lng);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
          return;
        }

        const apiKey = getServerGoogleMapsApiKey();
        if (!apiKey) {
          res.status(503).json({
            error: 'Google Maps API key is not configured on the server for address lookup.',
          });
          return;
        }

        // Primary: Google Maps Geocoding API v4 REST
        const v4Url = new URL('https://geocode.googleapis.com/v4/geocode/location');
        v4Url.searchParams.set('location.latitude', lat.toFixed(6));
        v4Url.searchParams.set('location.longitude', lng.toFixed(6));
        v4Url.searchParams.set('languageCode', 'en');
        v4Url.searchParams.set('regionCode', 'IN');

        const v4Resp = await fetch(v4Url.toString(), {
          method: 'GET',
          headers: buildMapsServerHeaders(
            apiKey,
            'results.placeId,results.formattedAddress,results.addressComponents,results.location'
          ),
        });

        if (v4Resp.ok) {
          const v4Data = (await v4Resp.json()) as {
            results?: Array<{
              placeId?: string;
              formattedAddress?: string;
              location?: { latitude?: number; longitude?: number };
              addressComponents?: Array<{ longText?: string; shortText?: string }>;
            }>;
          };
          const top = v4Data.results?.[0];
          if (top?.formattedAddress) {
            const compText = (top.addressComponents ?? [])
              .map((c) => `${c.longText ?? ''} ${c.shortText ?? ''}`)
              .join(' ');
            res.json({
              formattedAddress: cleanShortText(top.formattedAddress, 240),
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
              placeId: cleanShortText(top.placeId, 160) || undefined,
              matchedNeighbourhood:
                matchBengaluruWardFromText(`${top.formattedAddress} ${compText}`) || undefined,
            });
            return;
          }
        }

        // Fallback: Standard Google Maps Geocoding REST API (maps.googleapis.com/maps/api/geocode/json)
        const legacyRestUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        legacyRestUrl.searchParams.set('latlng', `${lat.toFixed(6)},${lng.toFixed(6)}`);
        legacyRestUrl.searchParams.set('language', 'en');
        legacyRestUrl.searchParams.set('region', 'in');
        legacyRestUrl.searchParams.set('key', apiKey);

        const fallbackHeaders: Record<string, string> = {};
        const appUrl = (process.env.APP_URL || '').trim();
        if (!process.env.GOOGLE_MAPS_API_KEY && /^https?:\/\//i.test(appUrl)) {
          fallbackHeaders.Referer = appUrl;
        }

        const restResp = await fetch(legacyRestUrl.toString(), {
          method: 'GET',
          headers: fallbackHeaders,
        });
        const restData = (await restResp.json().catch(() => ({}))) as {
          status?: string;
          error_message?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            address_components?: Array<{ long_name?: string; short_name?: string }>;
          }>;
        };

        if (restData.status === 'OK' && restData.results?.[0]?.formatted_address) {
          const top = restData.results[0];
          const compText = (top.address_components ?? [])
            .map((c) => `${c.long_name ?? ''} ${c.short_name ?? ''}`)
            .join(' ');
          res.json({
            formattedAddress: cleanShortText(top.formatted_address, 240),
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            placeId: cleanShortText(top.place_id, 160) || undefined,
            matchedNeighbourhood:
              matchBengaluruWardFromText(`${top.formatted_address} ${compText}`) || undefined,
          });
          return;
        }

        if (restData.status === 'ZERO_RESULTS') {
          res.status(404).json({
            error:
              'No street address was found for that exact pin. You can move the pin slightly or enter the nearby landmark manually.',
          });
          return;
        }

        if (restData.status === 'OVER_QUERY_LIMIT' || v4Resp.status === 429) {
          res.status(429).json({
            error:
              'Google Maps Geocoding quota is currently reached. You can still keep your pinned coordinates and enter the address manually.',
          });
          return;
        }

        res.status(502).json({
          error:
            restData.error_message ||
            'Unable to convert coordinates to an address right now. You can edit the address field manually.',
        });
      } catch (err) {
        console.error('Reverse geocoding error:', err);
        res.status(500).json({
          error:
            'Address lookup encountered a network error. Your coordinates are kept—please enter or adjust the address manually.',
        });
      }
    }
  );

  // Server-side Forward Geocoding proxy (Address / Landmark -> Coordinates + Formatted Address)
  app.post(
    '/api/maps/geocode',
    verifyOptionalBearerWithRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = req.body as { address?: unknown };
        const rawAddress = cleanShortText(body.address, 240);
        if (rawAddress.length < 2) {
          res.status(400).json({ error: 'Please enter a street, cross road, or landmark to search.' });
          return;
        }

        const apiKey = getServerGoogleMapsApiKey();
        if (!apiKey) {
          res.status(503).json({
            error: 'Google Maps API key is not configured on the server for address search.',
          });
          return;
        }

        const queryAddress = /bengaluru|bangalore|karnataka/i.test(rawAddress)
          ? rawAddress
          : `${rawAddress}, Bengaluru, Karnataka, India`;

        // Primary: Google Maps Geocoding API v4 REST biased to Bengaluru viewport
        const v4Url = new URL(
          `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(queryAddress)}`
        );
        v4Url.searchParams.set('regionCode', 'IN');
        v4Url.searchParams.set('languageCode', 'en');
        v4Url.searchParams.set('locationBias.rectangle.low.latitude', '12.7343');
        v4Url.searchParams.set('locationBias.rectangle.low.longitude', '77.3791');
        v4Url.searchParams.set('locationBias.rectangle.high.latitude', '13.1737');
        v4Url.searchParams.set('locationBias.rectangle.high.longitude', '77.8827');

        const v4Resp = await fetch(v4Url.toString(), {
          method: 'GET',
          headers: buildMapsServerHeaders(
            apiKey,
            'results.placeId,results.location,results.formattedAddress,results.addressComponents'
          ),
        });

        if (v4Resp.ok) {
          const v4Data = (await v4Resp.json()) as {
            results?: Array<{
              placeId?: string;
              formattedAddress?: string;
              location?: { latitude?: number; longitude?: number };
              addressComponents?: Array<{ longText?: string; shortText?: string }>;
            }>;
          };
          const top = v4Data.results?.[0];
          if (
            top?.formattedAddress &&
            typeof top.location?.latitude === 'number' &&
            typeof top.location?.longitude === 'number'
          ) {
            const compText = (top.addressComponents ?? [])
              .map((c) => `${c.longText ?? ''} ${c.shortText ?? ''}`)
              .join(' ');
            res.json({
              formattedAddress: cleanShortText(top.formattedAddress, 240),
              lat: Number(top.location.latitude.toFixed(6)),
              lng: Number(top.location.longitude.toFixed(6)),
              placeId: cleanShortText(top.placeId, 160) || undefined,
              matchedNeighbourhood:
                matchBengaluruWardFromText(`${top.formattedAddress} ${compText}`) || undefined,
            });
            return;
          }
        }

        // Fallback: Standard Google Maps Geocoding REST API
        const restUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        restUrl.searchParams.set('address', queryAddress);
        restUrl.searchParams.set('bounds', '12.7343,77.3791|13.1737,77.8827');
        restUrl.searchParams.set('region', 'in');
        restUrl.searchParams.set('language', 'en');
        restUrl.searchParams.set('key', apiKey);

        const fallbackHeaders: Record<string, string> = {};
        const appUrl = (process.env.APP_URL || '').trim();
        if (!process.env.GOOGLE_MAPS_API_KEY && /^https?:\/\//i.test(appUrl)) {
          fallbackHeaders.Referer = appUrl;
        }

        const restResp = await fetch(restUrl.toString(), {
          method: 'GET',
          headers: fallbackHeaders,
        });
        const restData = (await restResp.json().catch(() => ({}))) as {
          status?: string;
          error_message?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            geometry?: { location?: { lat?: number; lng?: number } };
            address_components?: Array<{ long_name?: string; short_name?: string }>;
          }>;
        };

        const first = restData.results?.[0];
        if (
          restData.status === 'OK' &&
          first?.formatted_address &&
          typeof first.geometry?.location?.lat === 'number' &&
          typeof first.geometry?.location?.lng === 'number'
        ) {
          const compText = (first.address_components ?? [])
            .map((c) => `${c.long_name ?? ''} ${c.short_name ?? ''}`)
            .join(' ');
          res.json({
            formattedAddress: cleanShortText(first.formatted_address, 240),
            lat: Number(first.geometry.location.lat.toFixed(6)),
            lng: Number(first.geometry.location.lng.toFixed(6)),
            placeId: cleanShortText(first.place_id, 160) || undefined,
            matchedNeighbourhood:
              matchBengaluruWardFromText(`${first.formatted_address} ${compText}`) || undefined,
          });
          return;
        }

        if (restData.status === 'ZERO_RESULTS') {
          res.status(404).json({
            error: 'No matching Bengaluru location found for that address. Try a nearby street or drop a pin directly on the map.',
          });
          return;
        }

        if (restData.status === 'OVER_QUERY_LIMIT' || v4Resp.status === 429) {
          res.status(429).json({
            error: 'Google Maps Geocoding quota is currently reached. You can drop a pin directly on the map.',
          });
          return;
        }

        res.status(502).json({
          error:
            restData.error_message ||
            'Could not geocode that address right now. Please drop a pin on the map instead.',
        });
      } catch (err) {
        console.error('Forward geocoding error:', err);
        res.status(500).json({
          error: 'Address search encountered a network error. Please try dropping a pin on the map.',
        });
      }
    }
  );

  // Server-side Google Maps Grounding via Gemini 4 Hydrogen (googleMaps tool)
  app.post(
    '/api/gemini/maps-grounding',
    verifyOptionalBearerWithRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = req.body as {
          lat?: unknown;
          lng?: unknown;
          neighbourhood?: unknown;
          address?: unknown;
          category?: unknown;
          query?: unknown;
        };

        const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat);
        const lng = typeof body.lng === 'number' ? body.lng : Number(body.lng);
        const hasValidCoords =
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180;

        const neighbourhood = cleanShortText(body.neighbourhood, 80) || 'Bengaluru';
        const address = cleanShortText(body.address, 240);
        const category = cleanShortText(body.category, 80);
        const customQuery = cleanShortText(body.query, 280);

        const prompt = customQuery
          ? `For a Bengaluru citizen near ${address || neighbourhood}, answer concisely using verified Google Maps data: ${customQuery}`
          : `For a Bengaluru civic issue (${category || 'neighbourhood infrastructure'}) located near ${
              address || neighbourhood
            }${
              hasValidCoords ? ` (coordinates ${lat.toFixed(5)}, ${lng.toFixed(5)})` : ''
            }, briefly list 3–5 verified nearby public landmarks, major junctions, parks, or civic offices (such as BBMP/BWSSB/BESCOM offices or public transit stops) using up-to-date Google Maps information. Keep the summary concise (2–3 sentences).`;

        const ai = getGeminiClient();
        const config: Record<string, unknown> = {
          tools: [{ googleMaps: {} }],
        };
        if (hasValidCoords) {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          };
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config,
        });

        const summary = (response.text ?? '').trim();
        const rawChunks =
          (
            response.candidates?.[0]?.groundingMetadata as
              | {
                  groundingChunks?: Array<{
                    maps?: {
                      uri?: string;
                      title?: string;
                      placeAnswerSources?: {
                        reviewSnippets?: Array<{
                          content?: string;
                          text?: string;
                          googleMapsUri?: string;
                        }>;
                      };
                    };
                  }>;
                }
              | undefined
          )?.groundingChunks ?? [];

        const seenUris = new Set<string>();
        const places: Array<{ title: string; uri: string; reviewSnippets?: string[] }> = [];

        for (const chunk of rawChunks) {
          const mapsChunk = chunk?.maps;
          if (!mapsChunk) continue;
          const uri = typeof mapsChunk.uri === 'string' ? mapsChunk.uri.trim() : '';
          if (!uri || !/^https:\/\//i.test(uri) || seenUris.has(uri)) continue;
          seenUris.add(uri);

          const title = cleanShortText(mapsChunk.title, 160) || 'View on Google Maps';
          const snippets = (mapsChunk.placeAnswerSources?.reviewSnippets ?? [])
            .map((s) => cleanShortText(s.content || s.text, 240))
            .filter(Boolean)
            .slice(0, 2);

          places.push({
            title,
            uri,
            reviewSnippets: snippets.length > 0 ? snippets : undefined,
          });
        }

        res.json({
          summary:
            summary ||
            'Verified nearby Bengaluru places retrieved from Google Maps.',
          places,
          model: 'gemini-4-hydrogen',
        });
      } catch (err) {
        console.error('Gemini maps-grounding error:', err);
        const rawMessage =
          err instanceof Error ? err.message : 'Unable to retrieve nearby Google Maps context.';
        if (/403|PERMISSION_DENIED|API_KEY_INVALID|400/i.test(rawMessage)) {
          res.status(403).json({
            error:
              'Gemini Maps Grounding could not authenticate with the server API key. Please verify GEMINI_API_KEY in Settings > Secrets.',
          });
          return;
        }
        if (/429|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
          res.status(429).json({
            error:
              'Maps Grounding quota is temporarily exhausted. Please try again shortly.',
          });
          return;
        }
        res.status(502).json({
          error: `Could not load Google Maps Grounding context right now: ${rawMessage}`,
        });
      }
    }
  );

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const httpServer = http.createServer(app);

  // Real-time Gemini Live API WebSocket Bridge (/api/live-voice)
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 512 * 1024, // 512 KB cap per WebSocket frame
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    if (reqUrl.pathname !== '/api/live-voice') {
      return;
    }

    if (!isOriginAllowed(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (clientWs: WebSocket, req: http.IncomingMessage) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let sessionStarting = false;
    let closed = false;
    let allowedCategories = [...DEFAULT_CATEGORIES];
    let allowedNeighbourhoods = [...DEFAULT_NEIGHBOURHOODS];
    let currentLanguage: 'English' | 'Kannada' | 'Hindi' = 'English';
    let autoDetectLanguage = true;
    let latestDraft: Record<string, unknown> = {};

    const safeSend = (payload: Record<string, unknown>) => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close errors during teardown
        }
        liveSession = null;
      }
    };

    // Guard against stale sockets that never send a start frame
    const startTimeout = setTimeout(() => {
      if (!liveSession && !sessionStarting && !closed) {
        safeSend({
          type: 'error',
          code: 'START_TIMEOUT',
          message: 'Voice session timed out waiting to initialize. Please try again.',
        });
        clientWs.close();
      }
    }, 15_000);

    clientWs.on('close', () => {
      clearTimeout(startTimeout);
      cleanup();
    });

    clientWs.on('error', () => {
      clearTimeout(startTimeout);
      cleanup();
    });

    clientWs.on('message', async (rawData) => {
      if (closed) return;

      let msg: {
        type?: string;
        data?: string;
        language?: string;
        autoDetectLanguage?: boolean;
        categories?: string[];
        neighbourhoods?: string[];
        currentDraft?: Record<string, unknown>;
        authToken?: string;
      };

      try {
        msg = JSON.parse(rawData.toString()) as typeof msg;
      } catch {
        safeSend({ type: 'error', code: 'INVALID_PAYLOAD', message: 'Invalid voice payload received.' });
        return;
      }

      if (msg.type === 'start') {
        if (liveSession || sessionStarting) return;
        sessionStarting = true;
        clearTimeout(startTimeout);

        // Apply rate limiting per IP for live voice sessions
        const ip =
          String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() ||
          req.socket.remoteAddress ||
          'unknown';
        const nowMs = Date.now();
        const recent = (ipRequestTimestamps.get(ip) ?? []).filter(
          (ts) => nowMs - ts < RATE_LIMIT_WINDOW_MS
        );
        if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
          safeSend({
            type: 'error',
            code: 'RATE_LIMITED',
            message: 'Too many voice sessions started recently. Please wait a few minutes and try again.',
          });
          clientWs.close();
          return;
        }
        recent.push(nowMs);
        ipRequestTimestamps.set(ip, recent);

        // Verify optional Firebase Auth token if user is signed in
        if (typeof msg.authToken === 'string' && msg.authToken.trim().length > 0) {
          const check = verifyBearerTokenClaims(msg.authToken.trim());
          if (!check.ok) {
            safeSend({
              type: 'error',
              code: 'UNAUTHORIZED',
              message: check.error,
            });
            clientWs.close();
            return;
          }
        }

        if (!process.env.GEMINI_API_KEY) {
          safeSend({
            type: 'error',
            code: 'MISSING_API_KEY',
            message:
              'Real-time voice conversation requires GEMINI_API_KEY to be configured on the backend server (Settings > Secrets).',
          });
          clientWs.close();
          return;
        }

        currentLanguage =
          msg.language === 'Kannada' || msg.language === 'Hindi' ? msg.language : 'English';
        autoDetectLanguage = Boolean(msg.autoDetectLanguage ?? true);
        if (Array.isArray(msg.categories) && msg.categories.length > 0) {
          allowedCategories = msg.categories.map((c) => String(c).slice(0, 80)).slice(0, 20);
        }
        if (Array.isArray(msg.neighbourhoods) && msg.neighbourhoods.length > 0) {
          allowedNeighbourhoods = msg.neighbourhoods.map((n) => String(n).slice(0, 80)).slice(0, 20);
        }
        if (msg.currentDraft && typeof msg.currentDraft === 'object') {
          latestDraft = { ...msg.currentDraft };
        }

        try {
          const ai = getGeminiClient();
          const systemInstruction = buildLiveCivicSystemInstruction({
            preferredLanguage: currentLanguage,
            autoDetectLanguage,
            categories: allowedCategories,
            neighbourhoods: allowedNeighbourhoods,
          });

          const session = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [{ functionDeclarations: [UPDATE_CIVIC_REPORT_DRAFT_TOOL] }],
              systemInstruction,
            },
            callbacks: {
              onopen: () => {
                safeSend({
                  type: 'ready',
                  detectedLanguage: currentLanguage,
                });
              },
              onmessage: (message: LiveServerMessage) => {
                if (closed) return;

                const serverContent = message.serverContent;
                if (serverContent) {
                  if (serverContent.interrupted) {
                    safeSend({ type: 'interrupted' });
                  }

                  if (serverContent.inputTranscription?.text) {
                    const text = serverContent.inputTranscription.text;
                    const scriptLang = autoDetectLanguage ? detectLanguageFromScript(text) : null;
                    if (scriptLang && scriptLang !== currentLanguage) {
                      currentLanguage = scriptLang;
                      safeSend({ type: 'language_detected', language: currentLanguage });
                    }
                    safeSend({ type: 'input_transcript', text });
                  }

                  if (serverContent.outputTranscription?.text) {
                    safeSend({
                      type: 'output_transcript',
                      text: serverContent.outputTranscription.text,
                    });
                  }

                  for (const part of serverContent.modelTurn?.parts ?? []) {
                    if (part.inlineData?.data) {
                      safeSend({
                        type: 'audio',
                        data: part.inlineData.data,
                      });
                    }
                  }

                  if (serverContent.turnComplete) {
                    safeSend({ type: 'turn_complete' });
                  }
                }

                // Handle live structured report extraction function calls
                if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
                  const responses = message.toolCall.functionCalls.map((call) => {
                    if (call.name === 'update_civic_report_draft') {
                      const incomingArgs = (call.args ?? {}) as Record<string, unknown>;
                      // Merge non-empty incoming fields with cumulative draft so previously captured facts aren't accidentally erased
                      const merged: Record<string, unknown> = { ...latestDraft };
                      for (const [k, v] of Object.entries(incomingArgs)) {
                        if (typeof v === 'string' && v.trim().length > 0) {
                          merged[k] = v;
                        } else if (Array.isArray(v)) {
                          merged[k] = v;
                        }
                      }

                      const sanitized = sanitizeVoiceDraft(
                        merged,
                        allowedCategories,
                        allowedNeighbourhoods,
                        currentLanguage
                      );
                      latestDraft = { ...sanitized };

                      if (autoDetectLanguage && sanitized.detectedLanguage !== currentLanguage) {
                        currentLanguage = sanitized.detectedLanguage;
                        safeSend({ type: 'language_detected', language: currentLanguage });
                      }

                      safeSend({ type: 'draft_update', draft: sanitized });

                      return {
                        id: call.id,
                        name: call.name,
                        response: {
                          ok: true,
                          fieldsNeedingConfirmation: sanitized.fieldsNeedingConfirmation,
                          reminder:
                            'Draft preview updated. Do not claim submission; citizen will review and submit manually.',
                        },
                      };
                    }

                    return {
                      id: call.id,
                      name: call.name,
                      response: { error: `Unsupported tool: ${call.name}` },
                    };
                  });

                  try {
                    session.sendToolResponse({ functionResponses: responses });
                  } catch (toolErr) {
                    console.error('Failed to send Live tool response:', toolErr);
                  }
                }
              },
              onerror: (errEvent) => {
                console.error('Gemini Live session error:', errEvent);
                const detail =
                  errEvent instanceof Error
                    ? errEvent.message
                    : (errEvent as { message?: string })?.message ||
                      'Gemini Live API connection encountered an error.';
                safeSend({
                  type: 'error',
                  code: 'LIVE_API_ERROR',
                  message: detail,
                });
              },
              onclose: (closeEvent) => {
                if (!closed) {
                  const reason = (closeEvent as { reason?: string })?.reason;
                  safeSend({
                    type: 'closed',
                    reason: reason || 'Voice conversation ended.',
                  });
                  cleanup();
                }
              },
            },
          });

          if (closed) {
            session.close();
            return;
          }

          liveSession = session;

          // Prompt Gemini to deliver a brief, warm spoken greeting in the selected language
          const greetingPrompt =
            currentLanguage === 'Kannada'
              ? 'Greet the citizen warmly in 1 short sentence in natural Bengaluru Kannada and ask what neighbourhood civic problem they want to report.'
              : currentLanguage === 'Hindi'
              ? 'Greet the citizen warmly in 1 short sentence in natural Hindi and ask what neighbourhood civic problem they want to report.'
              : 'Greet the citizen warmly in 1 short sentence in natural Bengaluru English and ask what neighbourhood civic problem they have noticed.';

          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
            turnComplete: true,
          });
        } catch (err) {
          console.error('Failed to initialize Gemini Live session:', err);
          const rawMessage =
            err instanceof Error ? err.message : 'Unable to connect to Gemini Live API.';
          let userMessage = `Could not start Gemini Live voice conversation: ${rawMessage}`;
          if (/403|PERMISSION_DENIED|API_KEY_INVALID|400/i.test(rawMessage)) {
            userMessage =
              'Gemini Live API rejected the configured server API key. Please check GEMINI_API_KEY in Settings > Secrets.';
          } else if (/429|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
            userMessage =
              'Gemini Live API quota is currently exhausted. Please try again shortly or check quota in Settings > Secrets.';
          } else if (/404|NOT_FOUND/i.test(rawMessage)) {
            userMessage =
              'The requested Gemini Live model (gemini-3.8-live) was not found for this API configuration.';
          }
          safeSend({
            type: 'error',
            code: 'CONNECT_FAILED',
            message: userMessage,
          });
          clientWs.close();
        }
        return;
      }

      if (msg.type === 'audio' && liveSession && typeof msg.data === 'string' && msg.data.length > 0) {
        if (msg.data.length > 350_000) return; // Guard against oversized audio frames
        try {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch (audioErr) {
          console.error('Error forwarding audio chunk to Gemini Live:', audioErr);
        }
        return;
      }

      if (msg.type === 'language_update' && liveSession) {
        const nextLang: 'English' | 'Kannada' | 'Hindi' =
          msg.language === 'Kannada' || msg.language === 'Hindi' ? msg.language : 'English';
        currentLanguage = nextLang;
        autoDetectLanguage = Boolean(msg.autoDetectLanguage);
        try {
          liveSession.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: `[System preference update: The citizen selected ${nextLang} as their preferred language (auto-detect is ${
                      autoDetectLanguage ? 'on' : 'off'
                    }). Continue the conversation naturally in ${nextLang} from your next reply.]`,
                  },
                ],
              },
            ],
            turnComplete: false,
          });
          safeSend({ type: 'language_detected', language: currentLanguage });
        } catch {
          // Ignore if session already closing
        }
        return;
      }

      if (msg.type === 'end') {
        cleanup();
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      }
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NAMMAOORU server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
