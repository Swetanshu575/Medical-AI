import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  HeartPulse,
  History,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Volume2,
} from 'lucide-react';
import { pcmToBase64, base64ToPcm } from './lib/audio';
import hanafudaCard from '../assets/medical_hanafuda_card.png';

type ChatRole = 'patient' | 'doctor';
type ReportStatus = 'active' | 'ready';
type UiReportStatus = 'idle' | 'building' | 'ready';

interface TranscriptEntry {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  final: boolean;
}

interface DigitalTwinRecord {
  patient: {
    label: string;
    sessionId: string;
    reportStatus: ReportStatus;
    language: string;
  };
  clinicalSnapshot: {
    chiefConcerns: string[];
    reportedMetrics: string[];
    lifestyleSignals: string[];
    riskSignals: string[];
  };
  carePlan: string[];
  conversationHistory: TranscriptEntry[];
  reportReady: boolean;
  lastUpdated: string;
}

interface ConsultationReport {
  id: string;
  title: string;
  status: ReportStatus;
  startedAt: string;
  endedAt?: string;
  summary: string;
  transcript: TranscriptEntry[];
  digitalTwin: DigitalTwinRecord;
}

interface ServerMessage {
  type?: 'audio' | 'interrupted' | 'session' | 'transcript' | 'transcriptDraft' | 'reportReady' | 'error';
  audio?: string;
  interrupted?: boolean;
  report?: ConsultationReport;
  entry?: TranscriptEntry;
  role?: ChatRole;
  text?: string;
  message?: string;
}

const emptyDrafts: Record<ChatRole, string> = {
  patient: '',
  doctor: '',
};

const roleConfig: Record<ChatRole, { label: string; icon: typeof UserRound; bubbleClass: string; labelColor: string }> = {
  patient: {
    label: 'Patient',
    icon: UserRound,
    bubbleClass: 'bubble-patient',
    labelColor: 'text-[var(--color-ink-muted)]',
  },
  doctor: {
    label: 'Dr. AI',
    icon: Stethoscope,
    bubbleClass: 'bubble-doctor',
    labelColor: 'text-[var(--color-warm-red)]',
  },
};

function formatDateTime(value?: string) {
  if (!value) return 'In progress';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function sortReports(reports: ConsultationReport[]) {
  return [...reports].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

function upsertReport(reports: ConsultationReport[], report: ConsultationReport) {
  return sortReports([report, ...reports.filter((item) => item.id !== report.id)]);
}

/* ─── Report List ───────────────────────────────────── */

function ReportList({
  reports,
  selectedReportId,
  onSelect,
}: {
  reports: ConsultationReport[];
  selectedReportId: string | null;
  onSelect: (id: string) => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="editorial-card px-4 py-6 text-center">
        <FileText className="mx-auto h-7 w-7 text-[var(--color-stone-400)]" />
        <p className="mt-3 text-sm text-[var(--color-stone-400)]">No reports yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => {
        const isSelected = report.id === selectedReportId;
        return (
          <button
            key={report.id}
            onClick={() => onSelect(report.id)}
            className={`report-row w-full rounded px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5 ${
              isSelected
                ? 'is-selected editorial-card-selected editorial-card'
                : 'editorial-card'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-ink)]">{report.title}</p>
                <p className="mt-1 text-xs text-[var(--color-stone-400)]">{formatDateTime(report.startedAt)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  report.status === 'ready' ? 'badge-ready' : 'badge-building'
                }`}
              >
                {report.status === 'ready' ? 'Ready' : 'Building'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-stone-400)]">
              <span className="inline-flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                {report.transcript.length} turns
              </span>
              <span className="inline-flex items-center gap-1">
                <Brain className="h-3.5 w-3.5" />
                Twin saved
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Twin List ─────────────────────────────────────── */

function TwinList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="twin-section">
      <p className="section-label">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-[var(--color-ink-light)]">
            <span className="twin-dot" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Main App ──────────────────────────────────────── */

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<ChatRole, string>>(emptyDrafts);
  const [reports, setReports] = useState<ConsultationReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<UiReportStatus>('idle');
  const [appError, setAppError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeReportIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedReport = useMemo(() => {
    if (!reports.length) return null;
    return reports.find((report) => report.id === selectedReportId) || reports[0];
  }, [reports, selectedReportId]);

  const liveDrafts = useMemo(
    () =>
      (Object.entries(drafts) as Array<[ChatRole, string]>)
        .filter(([, text]) => text.trim())
        .map(([role, text]) => ({ role, text })),
    [drafts],
  );

  const latestReportLabel =
    reportStatus === 'ready'
      ? 'Report ready'
      : reportStatus === 'building'
        ? 'Report building'
        : 'Ready for consult';

  const readyReportCount = reports.filter((report) => report.status === 'ready').length;
  const activeTurnCount = messages.length + liveDrafts.length;
  const selectedConcernCount =
    selectedReport?.digitalTwin.clinicalSnapshot.chiefConcerns.length || 0;

  const loadReports = useCallback(async () => {
    try {
      const response = await fetch('/api/reports', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load report history');
      const data = (await response.json()) as { reports: ConsultationReport[] };
      const sorted = sortReports(data.reports || []);

      setReports(sorted);
      setSelectedReportId((current) => {
        if (current && sorted.some((report) => report.id === current)) return current;
        return sorted[0]?.id || null;
      });

      const activeReportId = activeReportIdRef.current;
      const activeReport = activeReportId
        ? sorted.find((report) => report.id === activeReportId)
        : null;
      if (activeReport?.status === 'ready') {
        setMessages(activeReport.transcript);
        setReportStatus('ready');
        activeReportIdRef.current = null;
      }
    } catch (error) {
      console.error(error);
      setAppError(error instanceof Error ? error.message : 'Unable to load report history');
    }
  }, []);

  const cleanupMedia = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current && inputCtxRef.current.state !== 'closed') {
      inputCtxRef.current.close().catch(console.error);
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
      outputCtxRef.current.close().catch(console.error);
      outputCtxRef.current = null;
    }
  };

  const closeSocket = (requestReport = false) => {
    const ws = wsRef.current;
    if (!ws) return;

    if (requestReport && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'endSession' }));
      window.setTimeout(() => {
        if (
          wsRef.current === ws &&
          ws.readyState !== WebSocket.CLOSED &&
          ws.readyState !== WebSocket.CLOSING
        ) {
          ws.close();
        }
      }, 3000);
      return;
    }

    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    wsRef.current = null;
  };

  const stopSession = (requestReport = false) => {
    setIsActive(false);
    setIsConnecting(false);
    cleanupMedia();

    if (requestReport) {
      setReportStatus('building');
    }

    closeSocket(requestReport);
  };

  const startSession = async () => {
    if (isActive || isConnecting) return;

    try {
      setAppError('');
      setIsConnecting(true);
      setReportStatus('building');
      setMessages([]);
      setDrafts(emptyDrafts);
      closeSocket(false);

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      await outputCtx.resume();
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            const audio = pcmToBase64(event.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ type: 'audio', audio }));
          }
        };

        setIsActive(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;

          if (msg.type === 'error') {
            setAppError(msg.message || 'The live consultation could not start.');
            stopSession(false);
            return;
          }

          if (msg.type === 'session' && msg.report) {
            activeReportIdRef.current = msg.report.id;
            setReports((current) => upsertReport(current, msg.report!));
            setSelectedReportId(msg.report.id);
            setReportStatus('building');
            return;
          }

          if (msg.type === 'transcript' && msg.entry) {
            setMessages((current) =>
              current.some((entry) => entry.id === msg.entry!.id)
                ? current
                : [...current, msg.entry!],
            );
            setDrafts((current) => ({ ...current, [msg.entry!.role]: '' }));
            return;
          }

          if (msg.type === 'transcriptDraft' && msg.role) {
            setDrafts((current) => ({ ...current, [msg.role!]: msg.text || '' }));
            return;
          }

          if (msg.type === 'reportReady' && msg.report) {
            activeReportIdRef.current = null;
            setReportStatus('ready');
            setMessages(msg.report.transcript);
            setReports((current) => upsertReport(current, msg.report!));
            setSelectedReportId(msg.report.id);
            void loadReports();
            return;
          }

          if (msg.interrupted || msg.type === 'interrupted') {
            nextStartTimeRef.current = outputCtxRef.current?.currentTime || 0;
            return;
          }

          if (msg.audio) {
            const outputCtx = outputCtxRef.current;
            if (!outputCtx) return;

            const pcmData = base64ToPcm(msg.audio);
            const audioBuffer = outputCtx.createBuffer(1, pcmData.length, 24000);
            audioBuffer.copyToChannel(pcmData, 0);

            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputCtx.destination);

            const startAt = Math.max(outputCtx.currentTime, nextStartTimeRef.current);
            source.start(startAt);
            nextStartTimeRef.current = startAt + audioBuffer.duration;
          }
        } catch (error) {
          console.error('Error processing message from server', error);
        }
      };

      ws.onclose = () => {
        cleanupMedia();
        if (wsRef.current === ws) wsRef.current = null;
        setIsActive(false);
        setIsConnecting(false);

        if (activeReportIdRef.current) {
          window.setTimeout(() => {
            void loadReports();
          }, 600);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error', event);
        setAppError('Connection failed. Check the server, microphone permission, and Gemini key.');
        stopSession(false);
      };
    } catch (error) {
      console.error('Failed to start session:', error);
      setAppError(
        error instanceof Error
          ? error.message
          : 'Microphone or consultation connection could not start.',
      );
      stopSession(false);
      setReportStatus('idle');
    }
  };

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, liveDrafts]);

  useEffect(() => {
    return () => {
      cleanupMedia();
      closeSocket(false);
    };
  }, []);

  return (
    <div className="editorial-shell">
      {/* ═══ Navigation Bar ═══ */}
      <header className="nav-bar fixed inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--color-stone-200)] bg-white/60">
              <HeartPulse className="h-4.5 w-4.5 text-[var(--color-warm-red)]" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-normal text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-serif)' }}>
                Curonosis
              </h1>
            </div>
          </div>

          {/* Center: Navigation */}
          <nav className="hidden items-center gap-8 sm:flex">
            <span className="nav-link active">Consult</span>
            <span className="nav-link">History</span>
            <span className="nav-link">Twin</span>
          </nav>

          {/* Right: Status + Dots */}
          <div className="flex items-center gap-4">
            <div className={`rounded px-3 py-1.5 text-xs font-semibold ${
              reportStatus === 'ready'
                ? 'badge-ready'
                : reportStatus === 'building'
                  ? 'badge-building'
                  : isActive
                    ? 'badge-active'
                    : 'text-[var(--color-stone-400)]'
            }`}>
              {isActive ? 'Live' : latestReportLabel}
            </div>
            <div className="page-dots hidden sm:flex">
              <span className="page-dot filled" />
              <span className="page-dot" />
              <span className="page-dot" />
              <span className="page-dot" />
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-12 pt-20">

        {/* ─── Hero Section ─── */}
        <section className="editorial-section panel-enter">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_auto]">
            {/* Left: Chapter + Hero text */}
            <div>
              <div className="section-chapter">
                Chapter 01 · Voice Consultation
              </div>

              <div className="mt-6 flex items-end gap-4">
                <h2 className="editorial-year" style={{ fontSize: 'clamp(4rem, 12vw, 9rem)' }}>
                  診察
                </h2>
                <div className="mb-2">
                  <p className="text-sm leading-relaxed text-[var(--color-ink-muted)] max-w-md">
                    {isConnecting
                      ? 'Establishing connection with the AI physician…'
                      : isActive
                        ? 'Live consultation in progress. The AI physician is listening and responding in real-time.'
                        : 'Begin a real-time voice consultation with the AI physician. Your conversation will be transcribed and a clinical report generated automatically.'}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
                <div className="stat-card">
                  <p className="stat-value">{activeTurnCount}</p>
                  <p className="stat-label">Turns</p>
                </div>
                <div className="stat-card">
                  <p className="stat-value">{readyReportCount}</p>
                  <p className="stat-label">Reports</p>
                </div>
                <div className="stat-card">
                  <p className="stat-value">{selectedConcernCount}</p>
                  <p className="stat-label">Signals</p>
                </div>
              </div>
            </div>

            {/* Right: Hanafuda Card + Voice Disc */}
            <div className="flex flex-col items-center gap-6">
              {/* Decorative hanafuda card */}
              <div className="hanafuda-card w-48 p-3">
                <img
                  src={hanafudaCard}
                  alt="Medical consultation card"
                  className="w-full h-auto"
                />
              </div>

              {/* Voice button */}
              <button
                onClick={isActive ? () => stopSession(true) : startSession}
                disabled={isConnecting}
                className={`voice-disc group relative flex h-28 w-28 items-center justify-center rounded-full transition duration-500 ${
                  isActive ? 'voice-disc-active' : ''
                } ${isConnecting ? 'cursor-not-allowed opacity-60' : ''}`}
                aria-label={isActive ? 'End consultation' : 'Start consultation'}
              >
                {isActive && (
                  <>
                    <span className="signal-ring one" />
                    <span className="signal-ring two" />
                    <span className="signal-ring three" />
                  </>
                )}
                {isConnecting ? (
                  <Loader2 className="relative z-10 h-7 w-7 animate-spin text-[var(--color-ink-muted)]" />
                ) : isActive ? (
                  <Volume2 className="relative z-10 h-7 w-7 text-[var(--color-warm-red)]" />
                ) : (
                  <Mic className="relative z-10 h-7 w-7 text-[var(--color-ink-muted)] transition group-hover:text-[var(--color-warm-red)]" />
                )}
              </button>

              {/* Action button */}
              <button
                onClick={isActive ? () => stopSession(true) : startSession}
                disabled={isConnecting}
                className={`flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition duration-200 ${
                  isActive ? 'btn-danger' : 'btn-primary'
                } ${isConnecting ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {isActive ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    End consultation
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Start consultation
                  </>
                )}
              </button>

              {/* ECG trace */}
              <svg
                className="h-7 w-full max-w-[200px] text-[var(--color-warm-red)]"
                viewBox="0 0 300 46"
                fill="none"
                aria-hidden="true"
                style={{ opacity: 0.5 }}
              >
                <path
                  className={isActive ? 'ecg-line' : ''}
                  d="M2 24H54L64 24L72 9L84 38L96 24H126L136 24L146 16L158 30L172 24H298"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Notice + Error */}
          <div className="mt-6 max-w-2xl">
            <div className="flex items-start gap-3 rounded border border-[var(--color-stone-200)] bg-white/40 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--color-stone-400)]" />
              <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                The patient report is saved after the call ends and can be downloaded from history.
              </p>
            </div>

            {appError && (
              <div className="mt-3 flex items-start gap-3 rounded border border-[var(--color-warm-red)]/20 bg-[var(--color-warm-red)]/5 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--color-warm-red)]" />
                <p className="text-sm leading-relaxed text-[var(--color-warm-red-dark)]">{appError}</p>
              </div>
            )}
          </div>
        </section>

        {/* ─── Transcript + Sidebar ─── */}
        <section className="editorial-section panel-enter delay-1">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">

            {/* Transcript */}
            <div>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-stone-200)] pb-4">
                <div>
                  <div className="section-chapter">Chapter 02 · Transcript</div>
                  <h2 className="mt-2 font-serif text-3xl text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-serif)' }}>
                    会話記録
                  </h2>
                </div>
                <div className="flex items-center gap-2 rounded border border-[var(--color-stone-200)] px-3 py-1.5 text-xs text-[var(--color-stone-400)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {messages.length + liveDrafts.length} turns
                </div>
              </div>

              <div className="scrollbar-thin mt-5 max-h-[520px] space-y-4 overflow-y-auto pr-2">
                {messages.length === 0 && liveDrafts.length === 0 ? (
                  <div className="flex min-h-[300px] items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded border border-[var(--color-stone-200)] bg-white/50">
                        <FileText className="h-7 w-7 text-[var(--color-stone-400)]" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-[var(--color-ink)]">No transcript yet</p>
                      <p className="mt-1 text-sm text-[var(--color-stone-400)]">Start a consultation to capture the conversation.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((entry) => {
                      const meta = roleConfig[entry.role];
                      const Icon = meta.icon;
                      return (
                        <article
                          key={entry.id}
                          className={`message-enter max-w-[88%] rounded px-4 py-3 ${
                            entry.role === 'patient' ? 'ml-auto' : 'mr-auto'
                          } ${meta.bubbleClass}`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className={`flex items-center gap-2 text-xs font-semibold ${meta.labelColor}`}>
                              <Icon className="h-4 w-4" />
                              {meta.label}
                            </div>
                            <time className="text-xs text-[var(--color-stone-400)]">{formatTime(entry.createdAt)}</time>
                          </div>
                          <p className="break-words text-sm leading-relaxed text-[var(--color-ink)]">{entry.text}</p>
                        </article>
                      );
                    })}

                    {liveDrafts.map((draft) => {
                      const meta = roleConfig[draft.role];
                      const Icon = meta.icon;
                      return (
                        <article
                          key={`${draft.role}-draft`}
                          className={`message-enter max-w-[88%] rounded border-dashed px-4 py-3 opacity-70 ${
                            draft.role === 'patient' ? 'ml-auto' : 'mr-auto'
                          } ${meta.bubbleClass}`}
                        >
                          <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${meta.labelColor}`}>
                            <Icon className="h-4 w-4" />
                            {meta.label}
                          </div>
                          <p className="break-words text-sm leading-relaxed text-[var(--color-ink)]">{draft.text}</p>
                        </article>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Sidebar: Reports */}
            <aside className="space-y-6">
              <div className="editorial-card rounded p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="section-label">Reports</p>
                    <h3 className="mt-1 font-serif text-xl text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-serif)' }}>
                      Patient History
                    </h3>
                  </div>
                  <div className="rounded border border-[var(--color-stone-200)] p-2 bg-white/50">
                    <History className="h-4 w-4 text-[var(--color-stone-400)]" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="stat-card">
                    <p className="stat-value">{reports.length}</p>
                    <p className="stat-label">Total</p>
                  </div>
                  <div className="stat-card">
                    <p className="stat-value" style={{ color: 'var(--color-warm-red)' }}>{readyReportCount}</p>
                    <p className="stat-label">Ready</p>
                  </div>
                </div>

                <div className="scrollbar-thin mt-4 max-h-[260px] overflow-y-auto pr-1">
                  <ReportList
                    reports={reports}
                    selectedReportId={selectedReport?.id || null}
                    onSelect={setSelectedReportId}
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* ─── Digital Twin Section ─── */}
        <section className="editorial-section panel-enter delay-2">
          <div className="section-chapter">Chapter 03 · Digital Twin</div>
          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
            {/* Left: Title area */}
            <div>
              <h2 className="editorial-jp-large">
                診断
              </h2>
            </div>

            {/* Right: Twin content */}
            <div>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--color-stone-200)] pb-4">
                <div className="min-w-0">
                  <p className="section-label">Clinical Record</p>
                  <h3 className="mt-1 font-serif text-2xl text-[var(--color-ink)] truncate" style={{ fontFamily: 'var(--font-serif)' }}>
                    {selectedReport ? selectedReport.title : 'No saved record'}
                  </h3>
                </div>
                <div className="rounded border border-[var(--color-warm-red)]/20 bg-[var(--color-warm-red)]/5 p-2">
                  <Brain className="h-5 w-5 shrink-0 text-[var(--color-warm-red)]" />
                </div>
              </div>

              {selectedReport ? (
                <div className="mt-5">
                  {/* Report summary */}
                  <div className="editorial-card rounded p-4 mb-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--color-ink)]">
                        {selectedReport.status === 'ready' ? 'Report is ready' : 'Report building'}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        selectedReport.status === 'ready' ? 'badge-ready' : 'badge-building'
                      }`}>
                        {selectedReport.digitalTwin.reportReady ? 'Saved' : 'Draft'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                      {selectedReport.summary}
                    </p>
                  </div>

                  {/* Twin lists */}
                  <div className="space-y-0">
                    <TwinList
                      title="Chief concerns"
                      items={selectedReport.digitalTwin.clinicalSnapshot.chiefConcerns}
                    />
                    <TwinList
                      title="Reported metrics"
                      items={selectedReport.digitalTwin.clinicalSnapshot.reportedMetrics}
                    />
                    <TwinList
                      title="Lifestyle signals"
                      items={selectedReport.digitalTwin.clinicalSnapshot.lifestyleSignals}
                    />
                    <TwinList
                      title="Risk signals"
                      items={selectedReport.digitalTwin.clinicalSnapshot.riskSignals}
                    />
                    <TwinList title="Care plan" items={selectedReport.digitalTwin.carePlan} />
                  </div>

                  {/* Download button */}
                  <a
                    href={`/api/reports/${selectedReport.id}/pdf`}
                    download
                    className={`mt-6 flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition duration-200 ${
                      selectedReport.status === 'ready'
                        ? 'btn-primary hover:-translate-y-0.5'
                        : 'btn-outline pointer-events-none opacity-50'
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </a>
                </div>
              ) : (
                <div className="mt-6 editorial-card rounded px-5 py-10 text-center">
                  <Brain className="mx-auto h-8 w-8 text-[var(--color-stone-400)]" />
                  <p className="mt-3 text-sm text-[var(--color-stone-400)]">No digital twin saved yet.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Footer Timeline ─── */}
        <footer className="mt-8 flex items-center justify-between gap-4 text-xs text-[var(--color-stone-400)] border-t border-[var(--color-stone-200)] pt-4 pb-2">
          <div className="flex items-center gap-6 overflow-x-auto">
            {reports.slice(0, 5).map((r, i) => (
              <button
                key={r.id}
                onClick={() => setSelectedReportId(r.id)}
                className={`whitespace-nowrap transition hover:text-[var(--color-ink)] ${
                  r.id === selectedReport?.id ? 'text-[var(--color-ink)] font-semibold' : ''
                }`}
              >
                {formatDateTime(r.startedAt)}
              </button>
            ))}
          </div>
          <span className="shrink-0 text-[var(--color-stone-400)]">Curonosis Health</span>
        </footer>
      </main>
    </div>
  );
}
