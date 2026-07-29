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

const roleStyles: Record<ChatRole, { label: string; icon: typeof UserRound; bubble: string; labelClass: string }> = {
  patient: {
    label: 'Patient',
    icon: UserRound,
    bubble: 'border-sky-300/20 bg-sky-400/[0.09] text-sky-50 shadow-lg shadow-sky-950/20',
    labelClass: 'text-sky-300',
  },
  doctor: {
    label: 'Dr. AI',
    icon: Stethoscope,
    bubble: 'border-teal-300/20 bg-emerald-400/[0.09] text-emerald-50 shadow-lg shadow-emerald-950/20',
    labelClass: 'text-teal-300',
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
      <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center">
        <FileText className="mx-auto h-7 w-7 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No reports yet.</p>
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
            className={`report-row w-full rounded-lg border px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5 ${
              isSelected
                ? 'is-selected border-emerald-300/35 bg-emerald-300/[0.09] shadow-lg shadow-emerald-950/20'
                : 'border-white/10 bg-white/[0.035] hover:border-sky-300/20 hover:bg-white/[0.065]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{report.title}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(report.startedAt)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  report.status === 'ready'
                    ? 'bg-emerald-300/15 text-emerald-200'
                    : 'bg-amber-400/15 text-amber-300'
                }`}
              >
                {report.status === 'ready' ? 'Ready' : 'Building'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
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

function TwinList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border-t border-white/10 py-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
    <div className="clinical-shell min-h-screen text-slate-100 selection:bg-emerald-500/30 selection:text-white">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#080a0d]/78 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 shadow-lg shadow-emerald-950/30">
              <HeartPulse className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white">
                Curonosis Health
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Telehealth portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-slate-300 sm:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]' : 'bg-slate-600'
                }`}
              />
              {isActive ? 'Call active' : 'Available'}
            </div>
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                reportStatus === 'ready'
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                  : reportStatus === 'building'
                    ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                    : 'border-white/10 bg-white/[0.04] text-slate-400'
              }`}
            >
              {latestReportLabel}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-5 pb-8 pt-24 lg:grid-cols-[330px_minmax(0,1fr)_370px]">
        <section className="glass-panel panel-enter rounded-lg p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Consultation</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {isConnecting ? 'Connecting' : isActive ? 'Live with Dr. AI' : 'Voice consult'}
              </h2>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/25 p-2">
              {isActive ? (
                <Volume2 className="h-5 w-5 text-emerald-300" />
              ) : (
                <Mic className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </div>

          <div className="flex min-h-[292px] flex-col items-center justify-center py-8">
            <button
              onClick={isActive ? () => stopSession(true) : startSession}
              disabled={isConnecting}
              className={`voice-disc group relative flex h-44 w-44 items-center justify-center rounded-full border transition duration-500 ${
                isActive
                  ? 'voice-disc-active border-emerald-300/50'
                  : 'border-white/10 hover:border-emerald-300/30'
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
              <span
                className={`absolute inset-5 rounded-full border transition ${
                  isActive ? 'border-emerald-300/25' : 'border-white/10'
                }`}
              />
              {isConnecting ? (
                <Loader2 className="relative z-10 h-10 w-10 animate-spin text-slate-200" />
              ) : isActive ? (
                <Volume2 className="relative z-10 h-10 w-10 text-emerald-200" />
              ) : (
                <Mic className="relative z-10 h-10 w-10 text-slate-300 transition group-hover:text-emerald-200" />
              )}
            </button>

            <svg
              className="mt-7 h-9 w-full max-w-[250px] text-teal-300/80"
              viewBox="0 0 300 46"
              fill="none"
              aria-hidden="true"
            >
              <path
                className={isActive ? 'ecg-line' : ''}
                d="M2 24H54L64 24L72 9L84 38L96 24H126L136 24L146 16L158 30L172 24H298"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="space-y-3">
            <button
              onClick={isActive ? () => stopSession(true) : startSession}
              disabled={isConnecting}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg transition duration-200 hover:-translate-y-0.5 ${
                isActive
                  ? 'border border-rose-300/25 bg-rose-400/10 text-rose-100 shadow-rose-950/20 hover:bg-rose-400/15'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-950/30 hover:from-emerald-400 hover:to-cyan-300'
              } ${isConnecting ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {isActive ? (
                <>
                  <MicOff className="h-4 w-4" />
                  End call and save report
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Start consultation
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                <MessageSquareText className="h-4 w-4 text-sky-300" />
                <p className="mt-2 text-lg font-semibold text-white">{activeTurnCount}</p>
                <p className="text-[11px] text-slate-500">Turns</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <p className="mt-2 text-lg font-semibold text-white">{readyReportCount}</p>
                <p className="text-[11px] text-slate-500">Ready</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                <Activity className="h-4 w-4 text-amber-300" />
                <p className="mt-2 text-lg font-semibold text-white">{selectedConcernCount}</p>
                <p className="text-[11px] text-slate-500">Signals</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                <p className="text-sm leading-relaxed text-slate-400">
                  The patient report is saved after the call ends and can be downloaded from history.
                </p>
              </div>
            </div>

            {appError && (
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-rose-300" />
                  <p className="text-sm leading-relaxed text-rose-100">{appError}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel panel-enter delay-1 flex min-h-[620px] flex-col rounded-lg">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Chat history
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Consultation transcript</h2>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-400">
              <Clock3 className="h-4 w-4" />
              {messages.length + liveDrafts.length} turns
            </div>
          </div>

          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && liveDrafts.length === 0 ? (
              <div className="flex h-full min-h-[360px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <FileText className="h-7 w-7 text-slate-500" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-300">No transcript yet</p>
                  <p className="mt-1 text-sm text-slate-500">Start a consultation to capture the conversation.</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((entry) => {
                  const meta = roleStyles[entry.role];
                  const Icon = meta.icon;
                  return (
                    <article
                      key={entry.id}
                      className={`message-enter max-w-[88%] rounded-lg border px-4 py-3 ${
                        entry.role === 'patient' ? 'ml-auto' : 'mr-auto'
                      } ${meta.bubble}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className={`flex items-center gap-2 text-xs font-semibold ${meta.labelClass}`}>
                          <Icon className="h-4 w-4" />
                          {meta.label}
                        </div>
                        <time className="text-xs text-slate-500">{formatTime(entry.createdAt)}</time>
                      </div>
                      <p className="break-words text-sm leading-relaxed">{entry.text}</p>
                    </article>
                  );
                })}

                {liveDrafts.map((draft) => {
                  const meta = roleStyles[draft.role];
                  const Icon = meta.icon;
                  return (
                    <article
                      key={`${draft.role}-draft`}
                      className={`message-enter max-w-[88%] rounded-lg border border-dashed px-4 py-3 opacity-80 ${
                        draft.role === 'patient' ? 'ml-auto' : 'mr-auto'
                      } ${meta.bubble}`}
                    >
                      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${meta.labelClass}`}>
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </div>
                      <p className="break-words text-sm leading-relaxed">{draft.text}</p>
                    </article>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </section>

        <aside className="panel-enter delay-2 space-y-5">
          <section className="glass-panel rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Reports</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Patient history</h2>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-2">
                <History className="h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <p className="text-lg font-semibold text-white">{reports.length}</p>
                <p className="text-[11px] text-slate-500">Total reports</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <p className="text-lg font-semibold text-emerald-200">{readyReportCount}</p>
                <p className="text-[11px] text-slate-500">Downloadable</p>
              </div>
            </div>

            <div className="scrollbar-thin mt-4 max-h-[280px] overflow-y-auto pr-1">
              <ReportList
                reports={reports}
                selectedReportId={selectedReport?.id || null}
                onSelect={setSelectedReportId}
              />
            </div>
          </section>

          <section className="glass-panel rounded-lg p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  Digital twin
                </p>
                <h2 className="mt-1 truncate text-xl font-semibold text-white">
                  {selectedReport ? selectedReport.title : 'No saved record'}
                </h2>
              </div>
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-2">
                <Brain className="h-5 w-5 shrink-0 text-emerald-200" />
              </div>
            </div>

            {selectedReport ? (
              <div className="mt-4">
                <div className="mb-4 rounded-lg border border-white/10 bg-black/25 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-300">
                      {selectedReport.status === 'ready' ? 'Report is ready' : 'Report building'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        selectedReport.status === 'ready'
                          ? 'bg-emerald-400/15 text-emerald-300'
                          : 'bg-amber-400/15 text-amber-300'
                      }`}
                    >
                      {selectedReport.digitalTwin.reportReady ? 'Saved' : 'Draft'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {selectedReport.summary}
                  </p>
                </div>

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

                <a
                  href={`/api/reports/${selectedReport.id}/pdf`}
                  download
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg transition duration-200 ${
                    selectedReport.status === 'ready'
                      ? 'bg-gradient-to-r from-white to-emerald-100 text-slate-950 shadow-emerald-950/20 hover:-translate-y-0.5'
                      : 'pointer-events-none border border-white/10 bg-white/[0.04] text-slate-500'
                  }`}
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center">
                <Brain className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-3 text-sm text-slate-500">No digital twin saved yet.</p>
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
