import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileAudio,
  FileText,
  Globe,
  Loader2,
  MapPin,
  MessageSquareText,
  Mic,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  LocationSource,
  ReportLocationPicker,
  SelectedLocationPayload,
} from '../components/map/ReportLocationPicker';
import { LiveVoiceReporter } from '../components/report/LiveVoiceReporter';
import { VoiceAudioTranscriber } from '../components/report/VoiceAudioTranscriber';
import { DemoNotice } from '../components/ui/DemoNotice';
import { BENGALURU_NEIGHBOURHOOD_LATLNG, BENGALURU_NEIGHBOURHOODS } from '../data/mockData';
import { useCivic } from '../context/CivicContext';
import { useBengaluruLocations } from '../hooks/useBengaluruLocations';
import { findLocalityCoordinates } from '../services/locationMasterService';
import {
  analyzeCivicReportWithGemini,
  validateVoiceReportDraft,
} from '../services/geminiCivicService';
import {
  DynamicFollowUpQuestion,
  GeminiReportAnalysis,
  LanguageOption,
  LiveTranscriptEntry,
  LiveVoiceExtractedDraft,
  ReportMethod,
  ReportPriority,
} from '../types/civic';

export const ReportProblemPage: React.FC = () => {
  const {
    categories,
    preferredLanguage,
    preferredNeighbourhood,
    submitCitizenReport,
    navigateTo,
    openReportDetail,
    showToast,
  } = useCivic();

  const { dataset: bengaluruLocations } = useBengaluruLocations();
  const activeCategories = categories.filter((c) => c.active);
  const allNeighbourhoodNames = useMemo(() => {
    if (bengaluruLocations?.localities?.length) {
      return [...bengaluruLocations.localities]
        .map((l) => l.name)
        .sort((a, b) => a.localeCompare(b));
    }
    return [...BENGALURU_NEIGHBOURHOODS];
  }, [bengaluruLocations]);

  const [method, setMethod] = useState<ReportMethod>(ReportMethod.PHOTOGRAPH);
  const [language, setLanguage] = useState<LanguageOption>(preferredLanguage);
  const [autoDetectLang, setAutoDetectLang] = useState<boolean>(true);

  // Structured civic report draft fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(activeCategories[0]?.name ?? 'Roads & Potholes');
  const [neighbourhood, setNeighbourhood] = useState(preferredNeighbourhood);
  const [address, setAddress] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>('ward_default');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [impactAndSafety, setImpactAndSafety] = useState('');
  const [priority, setPriority] = useState<ReportPriority>(ReportPriority.MEDIUM);
  const [suggestedDepartment, setSuggestedDepartment] = useState('');

  // Natural input for Text mode (or supplemental notes)
  const [naturalTextInput, setNaturalTextInput] = useState('');

  // Photograph state
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | undefined>(undefined);
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [photoMimeType, setPhotoMimeType] = useState<string>('');
  const [photoFileName, setPhotoFileName] = useState<string>('');

  // Voice reporting capabilities (Gemini Live API + Gemini 3.5 Transcribe)
  const [voiceCapability, setVoiceCapability] = useState<'live' | 'transcribe'>('live');
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState<LiveTranscriptEntry[]>([]);
  const [originalVoiceStatement, setOriginalVoiceStatement] = useState('');
  const [correctedVoiceTranscript, setCorrectedVoiceTranscript] = useState('');
  const [voiceAudioSourceLabel, setVoiceAudioSourceLabel] = useState('');
  const [voiceAiSummary, setVoiceAiSummary] = useState('');
  const [fieldsNeedingConfirmation, setFieldsNeedingConfirmation] = useState<string[]>([]);
  const editableFormRef = useRef<HTMLDivElement | null>(null);

  // Real server-side Gemini AI analysis & dynamic follow-up Q&A state (Photograph & Text modes)
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string>('');
  const [aiAnalysis, setAiAnalysis] = useState<GeminiReportAnalysis | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [answeredHistory, setAnsweredHistory] = useState<
    Array<{ question: string; field: string; answer: string }>
  >([]);

  const [showReview, setShowReview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearFieldConfirmation = (fieldKey: string) => {
    setFieldsNeedingConfirmation((prev) =>
      prev.includes(fieldKey) ? prev.filter((item) => item !== fieldKey) : prev
    );
  };

  const handleMapLocationSelected = useCallback(
    (payload: SelectedLocationPayload) => {
      setSelectedCoords({ lat: payload.lat, lng: payload.lng });
      setLocationSource(payload.source);
      if (payload.formattedAddress) {
        setFormattedAddress(payload.formattedAddress);
        setAddress(payload.formattedAddress);
        clearFieldConfirmation('address');
      }
      if (payload.placeId !== undefined) {
        setPlaceId(payload.placeId);
      }
      if (
        payload.matchedNeighbourhood &&
        allNeighbourhoodNames.includes(payload.matchedNeighbourhood)
      ) {
        setNeighbourhood(payload.matchedNeighbourhood);
        clearFieldConfirmation('neighbourhood');
      }
    },
    [allNeighbourhoodNames]
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid JPG, PNG, or WebP photograph.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Please choose an image smaller than 5 MB.');
      return;
    }

    setErrorMsg('');
    setAiError('');
    setPhotoFileName(file.name);
    setPhotoMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreviewUrl(reader.result);
        const commaIdx = reader.result.indexOf(',');
        setPhotoBase64(commaIdx >= 0 ? reader.result.slice(commaIdx + 1) : reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyVoiceDraftToForm = useCallback(
    (draft: LiveVoiceExtractedDraft) => {
      if (autoDetectLang && draft.detectedLanguage) {
        setLanguage(draft.detectedLanguage);
      }
      if (draft.title) setTitle(draft.title);
      if (draft.category && activeCategories.some((c) => c.name === draft.category)) {
        setCategory(draft.category);
      }
      if (draft.neighbourhood && allNeighbourhoodNames.includes(draft.neighbourhood)) {
        setNeighbourhood(draft.neighbourhood);
      }
      if (draft.address) setAddress(draft.address);
      if (draft.description) setDescription(draft.description);
      if (draft.duration) setDuration(draft.duration);
      if (draft.impactAndSafety) setImpactAndSafety(draft.impactAndSafety);
      if (draft.priority) setPriority(draft.priority);
      if (draft.suggestedDepartment) setSuggestedDepartment(draft.suggestedDepartment);
      if (draft.originalStatementSummary) {
        setOriginalVoiceStatement(draft.originalStatementSummary);
      }
      if (draft.aiSummary) {
        setVoiceAiSummary(draft.aiSummary);
      }
      setFieldsNeedingConfirmation(draft.fieldsNeedingConfirmation ?? []);
    },
    [activeCategories, autoDetectLang]
  );

  const handleVoiceConversationCompleted = useCallback(
    (params: {
      validatedDraft: LiveVoiceExtractedDraft;
      transcript: LiveTranscriptEntry[];
      durationSeconds: number;
      validationErrors: string[];
    }) => {
      applyVoiceDraftToForm(params.validatedDraft);
      setVoiceTranscript(params.transcript);
      setVoiceDurationSeconds(params.durationSeconds);

      showToast(
        'Voice report draft ready',
        params.validatedDraft.fieldsNeedingConfirmation.length > 0
          ? 'Review your auto-filled fields below and confirm any highlighted items before submitting.'
          : 'Your report form is filled from the conversation. Review and confirm before submitting.',
        'info'
      );

      // Gently scroll to the editable form so the citizen can review & confirm
      window.setTimeout(() => {
        editableFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    },
    [applyVoiceDraftToForm, showToast]
  );

  const applyGeminiExtraction = (result: GeminiReportAnalysis) => {
    setAiAnalysis(result);
    if (autoDetectLang && result.detectedLanguage) {
      setLanguage(result.detectedLanguage);
    }

    const ext = result.extracted;
    if (ext.title) setTitle(ext.title);
    if (ext.category && activeCategories.some((c) => c.name === ext.category)) {
      setCategory(ext.category);
    }
    if (
      ext.neighbourhood &&
      BENGALURU_NEIGHBOURHOODS.includes(
        ext.neighbourhood as (typeof BENGALURU_NEIGHBOURHOODS)[number]
      )
    ) {
      setNeighbourhood(ext.neighbourhood);
    }
    if (ext.address) setAddress(ext.address);
    if (ext.description) setDescription(ext.description);
    if (ext.duration) setDuration(ext.duration);
    if (ext.impactAndSafety) setImpactAndSafety(ext.impactAndSafety);
    if (ext.priority) setPriority(ext.priority);
    if (ext.suggestedDepartment) setSuggestedDepartment(ext.suggestedDepartment);

    const mappedMissing = (result.missingFields ?? []).map((f) =>
      f === 'safety_impact' ? 'impactAndSafety' : f
    );
    setFieldsNeedingConfirmation(mappedMissing);

    // Initialize answer inputs for newly generated dynamic follow-up questions
    const nextAnswers: Record<string, string> = {};
    result.followUpQuestions.forEach((q) => {
      nextAnswers[q.id] = '';
    });
    setFollowUpAnswers(nextAnswers);
  };

  const runGeminiAnalysis = async (
    newFollowUpQA?: Array<{ question: string; field: string; answer: string }>,
    overrideTextInput?: string
  ) => {
    setAiError('');
    setErrorMsg('');

    const textSource =
      overrideTextInput !== undefined
        ? overrideTextInput.trim()
        : method === ReportMethod.VOICE
        ? (correctedVoiceTranscript.trim() || originalVoiceStatement.trim())
        : [naturalTextInput.trim(), description.trim()].filter(Boolean).join('\n');

    if (method === ReportMethod.PHOTOGRAPH && !photoBase64) {
      setAiError('Please upload a photograph first so Gemini AI can inspect it.');
      return;
    }
    if (method === ReportMethod.VOICE && !textSource) {
      setAiError('Please transcribe audio first before extracting civic report details.');
      return;
    }
    if (method === ReportMethod.TEXT && !textSource && !title.trim()) {
      setAiError('Please describe the civic problem in English, Kannada, or Hindi first.');
      return;
    }

    const mergedQA = newFollowUpQA
      ? [...answeredHistory, ...newFollowUpQA]
      : answeredHistory;

    setAiBusy(true);
    try {
      const result = await analyzeCivicReportWithGemini({
        mode: method,
        language,
        autoDetectLanguage: autoDetectLang,
        text: textSource || title.trim(),
        imageBase64: method === ReportMethod.PHOTOGRAPH ? photoBase64 : undefined,
        imageMimeType: method === ReportMethod.PHOTOGRAPH ? photoMimeType : undefined,
        categories: activeCategories.map((c) => c.name),
        neighbourhoods: [...BENGALURU_NEIGHBOURHOODS],
        currentDraft: {
          title,
          category,
          neighbourhood,
          address,
          description,
          duration,
          impactAndSafety,
        },
        followUpAnswers: mergedQA.length > 0 ? mergedQA : undefined,
      });

      if (newFollowUpQA && newFollowUpQA.length > 0) {
        setAnsweredHistory(mergedQA);
      }
      applyGeminiExtraction(result);
      showToast(
        'Gemini AI analysis ready',
        result.followUpQuestions.length > 0
          ? `Extracted details and generated ${result.followUpQuestions.length} specific follow-up question(s) for missing details.`
          : 'Structured report draft is complete. Please review all fields before submitting.',
        'info'
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Could not complete Gemini AI analysis. You can still fill or edit the fields manually.'
      );
    } finally {
      setAiBusy(false);
    }
  };

  const handleVoiceTranscriptReady = useCallback(
    (params: {
      originalTranscript: string;
      correctedTranscript: string;
      detectedLanguage: LanguageOption;
      sourceLabel: string;
      durationSeconds: number;
    }) => {
      setOriginalVoiceStatement(params.originalTranscript);
      setCorrectedVoiceTranscript(params.correctedTranscript);
      setVoiceAudioSourceLabel(params.sourceLabel);
      setVoiceDurationSeconds(params.durationSeconds);
      setVoiceTranscript([
        {
          id: 'transcribed-citizen',
          speaker: 'citizen',
          text: params.correctedTranscript || params.originalTranscript,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
    []
  );

  const handleConvertTranscriptToReport = async (params: {
    originalTranscript: string;
    correctedTranscript: string;
    detectedLanguage: LanguageOption;
    sourceLabel: string;
    durationSeconds: number;
  }) => {
    handleVoiceTranscriptReady(params);
    setAnsweredHistory([]);
    await runGeminiAnalysis(undefined, params.correctedTranscript || params.originalTranscript);
  };

  const handleApplyFollowUpAnswers = async () => {
    if (!aiAnalysis) return;
    const provided = aiAnalysis.followUpQuestions
      .map((q: DynamicFollowUpQuestion) => ({
        question: q.question,
        field: q.field,
        answer: (followUpAnswers[q.id] ?? '').trim(),
      }))
      .filter((item) => item.answer.length > 0);

    if (provided.length === 0) {
      setAiError('Please answer at least one follow-up question before refining your report.');
      return;
    }

    await runGeminiAnalysis(provided);
  };

  const validateBeforeReview = (): boolean => {
    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Please enter a clear issue title (at least 3 characters).');
      return false;
    }
    if (!address.trim() || address.trim().length < 2) {
      setErrorMsg('Please provide the street, cross road, or nearby landmark so field teams can locate the issue.');
      return false;
    }
    if (!description.trim() || description.trim().length < 5) {
      setErrorMsg('Please include a factual description of the civic problem.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleReviewClick = () => {
    if (validateBeforeReview()) {
      setShowReview(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBeforeReview() || submitting) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      let finalTitle = title.trim();
      let finalCategory = category;
      let finalNeighbourhood = neighbourhood;
      let finalAddress = address.trim();
      let finalDescription = description.trim();
      let finalDuration = duration.trim();
      let finalImpact = impactAndSafety.trim();
      let finalPriority = priority;
      let finalDepartment = suggestedDepartment;

      // Backend validation of all extracted/edited fields for Voice reports before saving
      if (method === ReportMethod.VOICE) {
        const validationRes = await validateVoiceReportDraft({
          transcript: voiceTranscript.map((t) => ({ speaker: t.speaker, text: t.text })),
          draft: {
            title: finalTitle,
            category: finalCategory,
            neighbourhood: finalNeighbourhood,
            address: finalAddress,
            description: finalDescription,
            duration: finalDuration,
            impactAndSafety: finalImpact,
            detectedLanguage: language,
            suggestedDepartment: finalDepartment,
            priority: finalPriority,
            originalStatementSummary: originalVoiceStatement,
            aiSummary: voiceAiSummary,
          },
          language,
          autoDetectLanguage: autoDetectLang,
          categories: activeCategories.map((c) => c.name),
          neighbourhoods: [...BENGALURU_NEIGHBOURHOODS],
          reconcileWithTranscript: false,
        });

        if (!validationRes.isValidForSubmission) {
          setFieldsNeedingConfirmation(validationRes.validated.fieldsNeedingConfirmation);
          setErrorMsg(
            validationRes.validationErrors[0] ||
              'Please review and confirm all required report fields before submitting.'
          );
          return;
        }

        finalTitle = validationRes.validated.title;
        finalCategory = validationRes.validated.category || finalCategory;
        finalNeighbourhood = validationRes.validated.neighbourhood || finalNeighbourhood;
        finalAddress = validationRes.validated.address;
        finalDescription = validationRes.validated.description;
        finalDuration = validationRes.validated.duration;
        finalImpact = validationRes.validated.impactAndSafety;
        finalPriority = validationRes.validated.priority;
        finalDepartment = validationRes.validated.suggestedDepartment || finalDepartment;
      }

      // Preserve optional structured duration, safety impact, and original spoken statement inside the saved description
      const descriptionSections = [finalDescription];
      if (finalDuration && !finalDescription.toLowerCase().includes(finalDuration.toLowerCase())) {
        descriptionSections.push(`Duration: ${finalDuration}`);
      }
      if (finalImpact && !finalDescription.toLowerCase().includes(finalImpact.toLowerCase())) {
        descriptionSections.push(`Impact & Safety Concerns: ${finalImpact}`);
      }
      if (
        method === ReportMethod.VOICE &&
        originalVoiceStatement &&
        !finalDescription.includes(originalVoiceStatement)
      ) {
        descriptionSections.push(`Original Spoken Transcript (${language}): "${originalVoiceStatement}"`);
      }
      if (
        method === ReportMethod.VOICE &&
        correctedVoiceTranscript.trim() &&
        correctedVoiceTranscript.trim() !== originalVoiceStatement.trim() &&
        !finalDescription.includes(correctedVoiceTranscript.trim())
      ) {
        descriptionSections.push(
          `Citizen-Reviewed Transcript (${language}): "${correctedVoiceTranscript.trim()}"`
        );
      }

      const evidenceSummary =
        method === ReportMethod.PHOTOGRAPH
          ? photoFileName
            ? `Photograph uploaded (${photoFileName})${aiAnalysis ? ' · Analyzed with Gemini AI' : ''}`
            : 'Photograph reporting workflow.'
          : method === ReportMethod.VOICE
          ? voiceCapability === 'transcribe'
            ? `${voiceAudioSourceLabel || 'Voice audio'} (${language}) · Transcribed via Gemini 3.5 Transcribe`
            : `Live Voice Conversation (${voiceDurationSeconds}s, ${language}) · Gemini Live API`
          : `Written report in ${language}${aiAnalysis ? ' · Structured with Gemini AI' : ''}.`;

      const fallbackWardCoords =
        findLocalityCoordinates(finalNeighbourhood, bengaluruLocations) ??
        BENGALURU_NEIGHBOURHOOD_LATLNG[finalNeighbourhood] ?? { lat: 12.9716, lng: 77.5946 };
      const finalLat = selectedCoords ? selectedCoords.lat : fallbackWardCoords.lat;
      const finalLng = selectedCoords ? selectedCoords.lng : fallbackWardCoords.lng;

      const created = await submitCitizenReport({
        title: finalTitle,
        description: descriptionSections.join('\n\n'),
        category: finalCategory,
        neighbourhood: finalNeighbourhood,
        address: finalAddress,
        formattedAddress: formattedAddress.trim() || finalAddress,
        placeId: placeId || undefined,
        lat: finalLat,
        lng: finalLng,
        method,
        language,
        priority: finalPriority,
        suggestedDepartment: finalDepartment || undefined,
        aiClassificationNote:
          voiceAiSummary ||
          aiAnalysis?.extracted.aiSummary ||
          'Citizen-reviewed structured report recorded on NAMMAOORU.',
        evidenceSummary,
        evidenceImageUrl: photoPreviewUrl,
      });

      if (!created) return;

      setSubmittedReportId(created.id);
      setShowReview(false);
      setTitle('');
      setAddress('');
      setFormattedAddress('');
      setPlaceId('');
      setSelectedCoords(null);
      setLocationSource('ward_default');
      setDescription('');
      setDuration('');
      setImpactAndSafety('');
      setNaturalTextInput('');
      setSuggestedDepartment('');
      setPriority(ReportPriority.MEDIUM);
      setPhotoPreviewUrl(undefined);
      setPhotoBase64('');
      setPhotoMimeType('');
      setPhotoFileName('');
      setVoiceDurationSeconds(0);
      setVoiceTranscript([]);
      setOriginalVoiceStatement('');
      setCorrectedVoiceTranscript('');
      setVoiceAudioSourceLabel('');
      setVoiceAiSummary('');
      setFieldsNeedingConfirmation([]);
      setAiAnalysis(null);
      setFollowUpAnswers({});
      setAnsweredHistory([]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not validate or submit your report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const languageLabels: Record<LanguageOption, string> = {
    [LanguageOption.ENGLISH]: 'English',
    [LanguageOption.KANNADA]: 'ಕನ್ನಡ (Kannada)',
    [LanguageOption.HINDI]: 'हिन्दी (Hindi)',
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-[#1C2420]">
          Report a Neighbourhood Problem
        </h1>
        <p className="text-sm text-[#526058]">
          Submit a civic issue by photograph, voice, or text in Kannada, English, or Hindi. Gemini AI assists with extracting visible details and asking tailored follow-up questions before you review and submit.
        </p>
      </div>

      {submittedReportId && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-5"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-[#14532D]">
                Platform Report {submittedReportId} Recorded
              </h2>
              <p className="mt-0.5 text-sm text-[#29322D]">
                Your report has been saved to your authenticated NAMMAOORU Citizen account and added to your Bengaluru Neighbourhood Map. Please note this is a NAMMAOORU platform submission and not an official municipal department complaint acknowledgement.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openReportDetail(submittedReportId)}
              className="rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#166534] whitespace-nowrap"
            >
              View Report
            </button>
            <button
              type="button"
              onClick={() => navigateTo('workspace')}
              className="rounded-lg border border-[#CFE3D5] bg-white px-3.5 py-2 text-xs font-medium text-[#14532D] hover:bg-[#F6F8F7] whitespace-nowrap"
            >
              Go to My Reports
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Form Column */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 space-y-6 rounded-xl border border-[#E2E8E4] bg-white p-6"
        >
          {/* Multilingual Selector */}
          <div className="space-y-3 border-b border-[#E2E8E4] pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[#1C2420]">
                  Reporting Language
                </span>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#29322D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDetectLang}
                  onChange={(e) => setAutoDetectLang(e.target.checked)}
                  className="h-4 w-4 rounded border-[#CBD5CF] accent-[#14532D]"
                />
                <span>Automatic language detection with Gemini AI</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Select reporting language">
              {Object.values(LanguageOption).map((lang) => {
                const selected = language === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      selected
                        ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
                        : 'border-[#E2E8E4] bg-white text-[#29322D] hover:bg-[#F6F8F7]'
                    }`}
                  >
                    {languageLabels[lang]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#526058]">
              {autoDetectLang
                ? `Auto-detect active (currently ${languageLabels[language]}). Gemini detects English, ಕನ್ನಡ, or हिन्दी from your voice or text.`
                : `Manual reporting language selected: ${languageLabels[language]}.`}
            </p>
          </div>

          {/* 1. Reporting Method Selector */}
          <div className="space-y-3">
            <span className="block text-sm font-semibold text-[#1C2420]">
              1. Choose Reporting Method
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  id: ReportMethod.PHOTOGRAPH,
                  icon: <Camera className="h-4 w-4" aria-hidden="true" />,
                  desc: 'Upload photo + AI inspection',
                },
                {
                  id: ReportMethod.VOICE,
                  icon: <Mic className="h-4 w-4" aria-hidden="true" />,
                  desc: 'Live voice conversation (Kannada, English, Hindi)',
                },
                {
                  id: ReportMethod.TEXT,
                  icon: <FileText className="h-4 w-4" aria-hidden="true" />,
                  desc: 'Describe naturally + AI structuring',
                },
              ].map((item) => {
                const active = method === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMethod(item.id);
                      setAiError('');
                    }}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
                        : 'border-[#E2E8E4] bg-white text-[#1C2420] hover:bg-[#F6F8F7]'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      {item.icon}
                      <span>{item.id}</span>
                    </div>
                    <span className="text-xs text-[#526058]">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method-Specific Capture & Gemini AI Trigger */}
          {method === ReportMethod.PHOTOGRAPH && (
            <div className="rounded-xl border border-[#CFE3D5] bg-[#F6F8F7] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#1C2420]">
                  Photograph Evidence &amp; Gemini Multimodal Analysis
                </span>
                <span className="text-xs text-[#14532D] font-medium">JPG, PNG, WebP · up to 5 MB</span>
              </div>

              {photoPreviewUrl ? (
                <div className="space-y-3">
                  <img
                    src={photoPreviewUrl}
                    alt="Uploaded civic issue preview"
                    className="max-h-60 w-full rounded-lg border border-[#E2E8E4] object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="truncate text-xs text-[#526058]">{photoFileName}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={aiBusy}
                        onClick={() => void runGeminiAnalysis()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
                      >
                        {aiBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{aiBusy ? 'Analyzing Photo...' : 'Analyze Photo with Gemini AI'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreviewUrl(undefined);
                          setPhotoBase64('');
                          setPhotoFileName('');
                          setAiAnalysis(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5CF] bg-white px-4 py-8 text-center transition-colors hover:border-[#14532D]">
                  <Upload className="h-6 w-6 text-[#14532D]" aria-hidden="true" />
                  <span className="mt-2 text-sm font-medium text-[#1C2420]">
                    Upload a photograph of the neighbourhood issue
                  </span>
                  <span className="mt-1 text-xs text-[#526058]">
                    Gemini inspects the photo to suggest category &amp; department and asks specific follow-up questions for details not visible in the image.
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          )}

          {method === ReportMethod.VOICE && (
            <div className="space-y-4">
              {/* Complementary Voice Capabilities Switcher: Gemini Live API & Gemini 3.5 Transcribe */}
              <div
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 rounded-xl border border-[#E2E8E4] bg-[#F6F8F7] p-2"
                role="tablist"
                aria-label="Choose voice reporting capability"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={voiceCapability === 'live'}
                  onClick={() => {
                    setVoiceCapability('live');
                    setAiError('');
                  }}
                  className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                    voiceCapability === 'live'
                      ? 'border-[#14532D] bg-white text-[#14532D] shadow-xs'
                      : 'border-transparent bg-transparent text-[#526058] hover:bg-white/70 hover:text-[#1C2420]'
                  }`}
                >
                  <Radio className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Live Voice Conversation</p>
                    <p className="text-[11px] opacity-80">
                      Real-time two-way assistant (Gemini Live API)
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={voiceCapability === 'transcribe'}
                  onClick={() => {
                    setVoiceCapability('transcribe');
                    setAiError('');
                  }}
                  className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                    voiceCapability === 'transcribe'
                      ? 'border-[#14532D] bg-white text-[#14532D] shadow-xs'
                      : 'border-transparent bg-transparent text-[#526058] hover:bg-white/70 hover:text-[#1C2420]'
                  }`}
                >
                  <FileAudio className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Record or Upload Audio</p>
                    <p className="text-[11px] opacity-80">
                      Audio-to-text transcription (Gemini 3.5 Transcribe)
                    </p>
                  </div>
                </button>
              </div>

              {voiceCapability === 'live' ? (
                <LiveVoiceReporter
                  language={language}
                  autoDetectLanguage={autoDetectLang}
                  categories={activeCategories.map((c) => c.name)}
                  neighbourhoods={[...BENGALURU_NEIGHBOURHOODS]}
                  currentDraft={{
                    title,
                    category,
                    neighbourhood,
                    address,
                    description,
                    duration,
                    impactAndSafety,
                  }}
                  onLanguageDetected={(detected) => {
                    if (autoDetectLang) {
                      setLanguage(detected);
                    }
                  }}
                  onLiveDraftUpdate={applyVoiceDraftToForm}
                  onConversationCompleted={handleVoiceConversationCompleted}
                />
              ) : (
                <VoiceAudioTranscriber
                  language={language}
                  autoDetectLanguage={autoDetectLang}
                  extractingReport={aiBusy}
                  onLanguageDetected={(detected) => {
                    if (autoDetectLang) {
                      setLanguage(detected);
                    }
                  }}
                  onTranscriptReady={handleVoiceTranscriptReady}
                  onConvertTranscriptToReport={handleConvertTranscriptToReport}
                />
              )}
            </div>
          )}

          {method === ReportMethod.TEXT && (
            <div className="rounded-xl border border-[#CFE3D5] bg-[#F6F8F7] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="natural-text-input" className="text-sm font-semibold text-[#1C2420]">
                  Describe the Civic Problem Naturally ({languageLabels[language]})
                </label>
                <span className="text-xs text-[#526058]">Optional AI assistant</span>
              </div>
              <textarea
                id="natural-text-input"
                rows={3}
                value={naturalTextInput}
                onChange={(e) => setNaturalTextInput(e.target.value)}
                placeholder="Write naturally in Kannada, English, or Hindi — e.g. 'Streetlights near 8th Cross Malleshwaram park gate have not worked for 4 nights, very dark for elders walking.'"
                className="w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void runGeminiAnalysis()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
                >
                  {aiBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{aiBusy ? 'Analyzing Text...' : 'Extract Details & Check Missing Info'}</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Error Alert */}
          {aiError && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{aiError}</p>
            </div>
          )}

          {/* Dynamic Follow-Up Questions Generated by Gemini */}
          {aiAnalysis && (
            <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-[#14532D]">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>Gemini Civic Intelligence Summary</span>
                  </h2>
                  <p className="text-xs text-[#29322D]">{aiAnalysis.extracted.aiSummary}</p>
                </div>
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#14532D] border border-[#CFE3D5]">
                  Language: {aiAnalysis.detectedLanguage}
                </span>
              </div>

              {aiAnalysis.confidenceNote && (
                <p className="text-xs text-[#526058]">{aiAnalysis.confidenceNote}</p>
              )}

              {aiAnalysis.followUpQuestions.length > 0 && (
                <div className="space-y-3 border-t border-[#CFE3D5] pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14532D]">
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    <span>
                      Dynamic Follow-Up Questions (Tailored to Your {method} Input)
                    </span>
                  </div>
                  <p className="text-xs text-[#29322D]">
                    Gemini never guesses unstated locations or facts. Answering these specific questions will refine your structured report draft:
                  </p>

                  <div className="space-y-3">
                    {aiAnalysis.followUpQuestions.map((fq) => (
                      <div
                        key={fq.id}
                        className="rounded-lg border border-[#CFE3D5] bg-white p-3.5 space-y-1.5"
                      >
                        <label
                          htmlFor={`fq-${fq.id}`}
                          className="block text-sm font-medium text-[#1C2420]"
                        >
                          {fq.question}
                        </label>
                        {fq.reason && (
                          <p className="text-xs text-[#526058]">{fq.reason}</p>
                        )}
                        <input
                          id={`fq-${fq.id}`}
                          type="text"
                          value={followUpAnswers[fq.id] ?? ''}
                          onChange={(e) =>
                            setFollowUpAnswers((prev) => ({
                              ...prev,
                              [fq.id]: e.target.value,
                            }))
                          }
                          placeholder={fq.placeholder || 'Type your answer...'}
                          className="w-full rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:bg-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={aiBusy}
                      onClick={() => void handleApplyFollowUpAnswers()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60"
                    >
                      {aiBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{aiBusy ? 'Refining Draft...' : 'Apply Answers & Update Report Draft'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Structured Editable Report Fields */}
          <div ref={editableFormRef} className="space-y-4">
            {fieldsNeedingConfirmation.length > 0 && method === ReportMethod.VOICE && (
              <div
                className="flex items-start gap-2.5 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]"
                role="status"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>Please review highlighted fields:</strong> Some details were not mentioned or need your confirmation before submitting. You can edit any field directly below.
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="report-title" className="block text-sm font-semibold text-[#1C2420]">
                  2. Issue Title <span className="text-[#991B1B]">*</span>
                </label>
                {fieldsNeedingConfirmation.includes('title') && (
                  <span className="text-xs font-medium text-[#B45309]">Needs confirmation</span>
                )}
              </div>
              <input
                id="report-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearFieldConfirmation('title');
                }}
                placeholder="e.g. Overflowing waste bin near 10th Cross park gate"
                className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none ${
                  fieldsNeedingConfirmation.includes('title')
                    ? 'border-[#F59E0B] bg-[#FFFBEB]/50'
                    : 'border-[#E2E8E4] bg-white'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="report-category" className="block text-sm font-semibold text-[#1C2420]">
                    3. Issue Category <span className="text-[#991B1B]">*</span>
                  </label>
                  {fieldsNeedingConfirmation.includes('category') && (
                    <span className="text-xs font-medium text-[#B45309]">Needs confirmation</span>
                  )}
                </div>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    clearFieldConfirmation('category');
                  }}
                  className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none ${
                    fieldsNeedingConfirmation.includes('category')
                      ? 'border-[#F59E0B] bg-[#FFFBEB]/50'
                      : 'border-[#E2E8E4] bg-white'
                  }`}
                >
                  {activeCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="report-neighbourhood"
                    className="block text-sm font-semibold text-[#1C2420]"
                  >
                    4. Bengaluru Neighbourhood <span className="text-[#991B1B]">*</span>
                  </label>
                  {fieldsNeedingConfirmation.includes('neighbourhood') && (
                    <span className="text-xs font-medium text-[#B45309]">Needs confirmation</span>
                  )}
                </div>
                <select
                  id="report-neighbourhood"
                  value={neighbourhood}
                  onChange={(e) => {
                    setNeighbourhood(e.target.value);
                    clearFieldConfirmation('neighbourhood');
                  }}
                  className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none ${
                    fieldsNeedingConfirmation.includes('neighbourhood')
                      ? 'border-[#F59E0B] bg-[#FFFBEB]/50'
                      : 'border-[#E2E8E4] bg-white'
                  }`}
                >
                  {allNeighbourhoodNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="report-address" className="block text-sm font-semibold text-[#1C2420]">
                  5. Street, Cross Road, or Nearby Landmark <span className="text-[#991B1B]">*</span>
                </label>
                {fieldsNeedingConfirmation.includes('address') && (
                  <span className="text-xs font-medium text-[#B45309]">Needs confirmation</span>
                )}
              </div>
              <div className="relative mt-1.5">
                <MapPin
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#526058]"
                  aria-hidden="true"
                />
                <input
                  id="report-address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearFieldConfirmation('address');
                  }}
                  placeholder={`e.g. Near 12th Main Bus Stop, ${neighbourhood}`}
                  className={`w-full rounded-lg border py-2.5 pl-9 pr-3.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none ${
                    fieldsNeedingConfirmation.includes('address')
                      ? 'border-[#F59E0B] bg-[#FFFBEB]/50'
                      : 'border-[#E2E8E4] bg-white'
                  }`}
                />
              </div>
              <p className="mt-1 text-xs text-[#526058]">
                Auto-populated from Google Maps when you search, detect GPS location, or move the map pin below—and always editable by you.
              </p>
            </div>

            {/* Interactive Google Maps Location Picker (Places Autocomplete, Draggable Pin, Current Location, Geocoding, Grounding) */}
            <ReportLocationPicker
              selectedCoords={selectedCoords}
              neighbourhood={neighbourhood}
              address={address}
              formattedAddress={formattedAddress}
              locationSource={locationSource}
              category={category}
              onLocationSelected={handleMapLocationSelected}
            />

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="report-description"
                  className="block text-sm font-semibold text-[#1C2420]"
                >
                  6. Detailed Description <span className="text-[#991B1B]">*</span>
                </label>
                {fieldsNeedingConfirmation.includes('description') && (
                  <span className="text-xs font-medium text-[#B45309]">Needs confirmation</span>
                )}
              </div>
              <textarea
                id="report-description"
                rows={4}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearFieldConfirmation('description');
                }}
                placeholder="Describe what you observed, how long it has persisted, and any safety impact on pedestrians, commuters, or nearby homes."
                className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none ${
                  fieldsNeedingConfirmation.includes('description')
                    ? 'border-[#F59E0B] bg-[#FFFBEB]/50'
                    : 'border-[#E2E8E4] bg-white'
                }`}
              />
            </div>

            {/* Optional Context Fields (Duration & Safety Impact — auto-filled during voice conversation if mentioned) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="report-duration" className="block text-sm font-semibold text-[#1C2420]">
                    7. Duration <span className="text-xs font-normal text-[#526058]">(Optional)</span>
                  </label>
                  {fieldsNeedingConfirmation.includes('duration') && (
                    <span className="text-xs font-medium text-[#B45309]">Check if known</span>
                  )}
                </div>
                <input
                  id="report-duration"
                  type="text"
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    clearFieldConfirmation('duration');
                  }}
                  placeholder="e.g. Past 4 days, since last week's rain"
                  className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="report-impact" className="block text-sm font-semibold text-[#1C2420]">
                    8. Impact &amp; Safety Concerns{' '}
                    <span className="text-xs font-normal text-[#526058]">(Optional)</span>
                  </label>
                  {fieldsNeedingConfirmation.includes('impactAndSafety') && (
                    <span className="text-xs font-medium text-[#B45309]">Check if relevant</span>
                  )}
                </div>
                <input
                  id="report-impact"
                  type="text"
                  value={impactAndSafety}
                  onChange={(e) => {
                    setImpactAndSafety(e.target.value);
                    clearFieldConfirmation('impactAndSafety');
                  }}
                  placeholder="e.g. Slippery for school children and elders"
                  className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"
              role="alert"
            >
              {errorMsg}
            </div>
          )}

          {/* Review Report Section Before Submission */}
          {showReview && (
            <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-[#14532D]">
                  Review Your Report Before Submitting
                </h2>
                <span className="text-xs font-semibold text-[#14532D]">
                  Suggested Priority: {priority}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs text-[#526058]">Title</dt>
                  <dd className="font-medium text-[#1C2420]">{title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#526058]">Category</dt>
                  <dd className="font-medium text-[#1C2420]">{category}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#526058]">Location &amp; Coordinates</dt>
                  <dd className="font-medium text-[#1C2420]">
                    {address}, {neighbourhood}
                  </dd>
                  <dd className="mt-0.5 font-mono text-[11px] text-[#526058] tabular-nums">
                    {(
                      selectedCoords ??
                      BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhood] ?? {
                        lat: 12.9716,
                        lng: 77.5946,
                      }
                    ).lat.toFixed(5)}
                    ° N,{' '}
                    {(
                      selectedCoords ??
                      BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhood] ?? {
                        lat: 12.9716,
                        lng: 77.5946,
                      }
                    ).lng.toFixed(5)}
                    ° E
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#526058]">Method &amp; Language</dt>
                  <dd className="font-medium text-[#1C2420]">
                    {method} · {language}
                  </dd>
                </div>
                {duration.trim() && (
                  <div>
                    <dt className="text-xs text-[#526058]">Duration</dt>
                    <dd className="font-medium text-[#1C2420]">{duration.trim()}</dd>
                  </div>
                )}
                {impactAndSafety.trim() && (
                  <div>
                    <dt className="text-xs text-[#526058]">Impact &amp; Safety Concerns</dt>
                    <dd className="font-medium text-[#1C2420]">{impactAndSafety.trim()}</dd>
                  </div>
                )}
                {suggestedDepartment && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[#526058]">Suggested Bengaluru Department</dt>
                    <dd className="font-medium text-[#1C2420]">{suggestedDepartment}</dd>
                  </div>
                )}
              </dl>

              <div className="text-sm">
                <span className="block text-xs text-[#526058]">Description</span>
                <p className="mt-0.5 text-[#29322D]">{description}</p>
              </div>

              {method === ReportMethod.VOICE && originalVoiceStatement && (
                <div className="space-y-2">
                  <div className="rounded-lg border border-[#CFE3D5] bg-white px-3.5 py-2.5 text-xs">
                    <span className="block font-semibold text-[#14532D]">
                      Preserved Original Spoken Transcript ({language})
                    </span>
                    <p className="mt-0.5 italic text-[#29322D]">&ldquo;{originalVoiceStatement}&rdquo;</p>
                  </div>
                  {correctedVoiceTranscript.trim() &&
                    correctedVoiceTranscript.trim() !== originalVoiceStatement.trim() && (
                      <div className="rounded-lg border border-[#CFE3D5] bg-white px-3.5 py-2.5 text-xs">
                        <span className="block font-semibold text-[#14532D]">
                          Citizen-Corrected Transcript
                        </span>
                        <p className="mt-0.5 text-[#29322D]">&ldquo;{correctedVoiceTranscript.trim()}&rdquo;</p>
                      </div>
                    )}
                </div>
              )}

              <div className="flex items-start gap-2.5 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>Platform Submission Notice:</strong> Clicking submit saves this structured report to your NAMMAOORU Citizen account in Firestore. This is a NAMMAOORU platform record and does not represent an official BBMP, BWSSB, or BESCOM complaint acknowledgement number.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E2E8E4] pt-4">
            {!showReview ? (
              <button
                type="button"
                onClick={handleReviewClick}
                className="rounded-lg border border-[#14532D] bg-white px-5 py-2.5 text-sm font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0]"
              >
                Review Report
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="rounded-lg border border-[#E2E8E4] bg-white px-4 py-2.5 text-sm font-medium text-[#526058] hover:bg-[#F6F8F7]"
              >
                Edit Details
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#14532D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
            >
              {submitting ? 'Submitting Report...' : 'Confirm & Submit Report'}
            </button>
          </div>
        </form>

        {/* Right Side Guidance */}
        <div className="space-y-5">
          <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#14532D]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold">
                AI-Assisted Intake Guardrails
              </h2>
            </div>
            <ul className="space-y-2 text-xs text-[#29322D] leading-relaxed">
              <li>
                <strong className="text-[#14532D]">No invented details:</strong> Gemini extracts only what is visible in your photo or stated in your voice/text input.
              </li>
              <li>
                <strong className="text-[#14532D]">Dynamic follow-ups:</strong> Questions are generated specifically for your photo or message to clarify missing landmarks or hazards.
              </li>
              <li>
                <strong className="text-[#14532D]">Citizen control:</strong> You review and edit every field before saving. Gemini never writes directly to the database.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#1C2420]">
              How Reporting Works
            </h2>
            <ol className="space-y-2.5 text-sm text-[#29322D]">
              <li>
                <span className="font-semibold text-[#14532D]">1. Share locally: </span>
                Upload a photo, have a live voice conversation, or type in Kannada, English, or Hindi.
              </li>
              <li>
                <span className="font-semibold text-[#14532D]">2. Clarify missing details: </span>
                Answer any dynamic follow-up questions generated for your specific issue.
              </li>
              <li>
                <span className="font-semibold text-[#14532D]">3. Review &amp; track: </span>
                Confirm your structured draft, submit to NAMMAOORU, and verify outcomes once resolved.
              </li>
            </ol>
          </div>

          <DemoNotice
            tone="neutral"
            title="Platform Submission vs. Municipal Portal"
            description="Reports submitted here are persisted securely to your NAMMAOORU account for neighbourhood visibility and workflow tracking. Direct automated municipal portal filing is not active in this pilot."
          />
        </div>
      </div>
    </div>
  );
};
