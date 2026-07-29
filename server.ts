import "dotenv/config";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, Transcription } from "@google/genai";
import { WebSocket, WebSocketServer } from "ws";

type ChatRole = "patient" | "doctor";
type ReportStatus = "active" | "ready";

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

const PORT = Number(process.env.PORT || 3000);
const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
const REPORT_STORE_PATH = path.join(process.cwd(), "data", "reports.json");

const reports = new Map<string, ConsultationReport>();

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueList(values: string[], fallback: string[] = []) {
  const seen = new Set<string>();
  const deduped = values
    .map(cleanText)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return deduped.length > 0 ? deduped : fallback;
}

function toSentenceCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createDigitalTwin(reportId: string, startedAt: string): DigitalTwinRecord {
  return {
    patient: {
      label: "Patient",
      sessionId: reportId,
      reportStatus: "active",
      language: "Hinglish voice consultation",
    },
    clinicalSnapshot: {
      chiefConcerns: [],
      reportedMetrics: [],
      lifestyleSignals: [],
      riskSignals: [],
    },
    carePlan: [],
    conversationHistory: [],
    reportReady: false,
    lastUpdated: startedAt,
  };
}

function createReport(): ConsultationReport {
  const startedAt = nowIso();
  const id = randomUUID();

  return {
    id,
    title: "Live consultation report",
    status: "active",
    startedAt,
    summary: "Consultation in progress. The report will be ready when the call ends.",
    transcript: [],
    digitalTwin: createDigitalTwin(id, startedAt),
  };
}

function getSortedReports() {
  return Array.from(reports.values()).sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
  );
}

async function loadReports() {
  try {
    const raw = await fs.readFile(REPORT_STORE_PATH, "utf8");
    const storedReports = JSON.parse(raw) as ConsultationReport[];
    if (!Array.isArray(storedReports)) return;

    for (const report of storedReports) {
      if (report?.id) {
        reports.set(report.id, report);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Unable to load report history:", error);
    }
  }
}

async function saveReports() {
  await fs.mkdir(path.dirname(REPORT_STORE_PATH), { recursive: true });
  await fs.writeFile(
    REPORT_STORE_PATH,
    JSON.stringify(getSortedReports(), null, 2),
    "utf8",
  );
}

function sendWs(clientWs: WebSocket, payload: unknown) {
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(JSON.stringify(payload));
  }
}

function mergeTranscriptText(existing: string, incoming: string) {
  const current = cleanText(existing);
  const next = cleanText(incoming);
  if (!current) return next;
  if (!next) return current;
  if (next.toLowerCase().startsWith(current.toLowerCase())) return next;
  if (current.toLowerCase().endsWith(next.toLowerCase())) return current;
  return `${current} ${next}`;
}

function appendTranscript(report: ConsultationReport, role: ChatRole, text: string) {
  const cleaned = cleanText(text);
  if (!cleaned) return null;

  const entry: TranscriptEntry = {
    id: randomUUID(),
    role,
    text: cleaned,
    createdAt: nowIso(),
    final: true,
  };

  report.transcript.push(entry);
  report.digitalTwin.conversationHistory = report.transcript;
  report.digitalTwin.lastUpdated = entry.createdAt;
  return entry;
}

function splitSentences(text: string) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => cleanText(sentence.replace(/^[\-*]\s*/, "")))
    .filter(Boolean);
}

function extractConcerns(patientText: string) {
  const concerns: string[] = [];
  const concernMatchers: Array<[string, RegExp]> = [
    ["Diabetes or blood sugar concern", /\b(diabetes|diabetic|sugar|glucose|hba1c|a1c)\b/i],
    ["Thyroid concern", /\b(thyroid|tsh|t3|t4|hypothyroid|hyperthyroid)\b/i],
    ["Fatigue or low energy", /\b(fatigue|tired|weak|energy|thakan|kamzori)\b/i],
    ["Weight change", /\b(weight|gain|loss|motapa|wazan)\b/i],
    ["Sleep concern", /\b(sleep|insomnia|neend)\b/i],
    ["Stress concern", /\b(stress|anxiety|tension|chinta)\b/i],
    ["Digestive concern", /\b(acidity|gas|stomach|digestion|pet)\b/i],
    ["Pain concern", /\b(pain|ache|dard)\b/i],
  ];

  for (const [label, matcher] of concernMatchers) {
    if (matcher.test(patientText)) concerns.push(label);
  }

  return uniqueList(concerns, ["General health consultation"]);
}

function extractMetrics(patientText: string) {
  const metrics: string[] = [];
  const metricPatterns = [
    /\b(?:hba1c|a1c)\s*(?:is|was|:|=)?\s*\d+(?:\.\d+)?\s*%?/gi,
    /\b(?:tsh|t3|t4)\s*(?:is|was|:|=)?\s*\d+(?:\.\d+)?\b/gi,
    /\b(?:fasting|post[-\s]?meal|random)\s+(?:sugar|glucose)\s*(?:is|was|:|=)?\s*\d{2,3}\b/gi,
    /\b(?:bp|blood pressure)\s*(?:is|was|:|=)?\s*\d{2,3}\/\d{2,3}\b/gi,
    /\b\d{2,3}\s*(?:mg\/dl|bpm|kg)\b/gi,
  ];

  for (const pattern of metricPatterns) {
    metrics.push(...(patientText.match(pattern) || []));
  }

  return uniqueList(metrics, ["No numeric vitals or lab values captured"]);
}

function extractLifestyleSignals(patientText: string) {
  const signals: string[] = [];
  const lifestyleMatchers: Array<[string, RegExp]> = [
    ["Diet or meal timing discussed", /\b(diet|food|meal|eat|breakfast|lunch|dinner|roti|rice|sugar|sweet)\b/i],
    ["Physical activity discussed", /\b(exercise|walk|gym|activity|yoga|running)\b/i],
    ["Sleep pattern discussed", /\b(sleep|neend|insomnia|late night)\b/i],
    ["Stress level discussed", /\b(stress|tension|anxiety|workload)\b/i],
    ["Medication or supplement discussed", /\b(medicine|tablet|dose|insulin|thyroxine|supplement)\b/i],
  ];

  for (const [label, matcher] of lifestyleMatchers) {
    if (matcher.test(patientText)) signals.push(label);
  }

  return uniqueList(signals, ["Lifestyle history not yet captured"]);
}

function extractRiskSignals(patientText: string) {
  const risks: string[] = [];
  const riskMatchers: Array<[string, RegExp]> = [
    ["Chest pain mentioned", /\b(chest pain|seene mein dard)\b/i],
    ["Breathing difficulty mentioned", /\b(breathless|shortness of breath|saans|breathing)\b/i],
    ["Fainting or unconsciousness mentioned", /\b(faint|unconscious|behosh|chakkar)\b/i],
    ["Severe or sudden symptom mentioned", /\b(severe|sudden|bahut zyada|worst)\b/i],
    ["Very high fever mentioned", /\b(high fever|fever.*10[3-9]|bukhar)\b/i],
  ];

  for (const [label, matcher] of riskMatchers) {
    if (matcher.test(patientText)) risks.push(label);
  }

  return uniqueList(risks, ["No urgent red-flag symptoms captured in transcript"]);
}

function extractCarePlan(doctorText: string) {
  const guidanceWords = /\b(consult|doctor|physician|check|test|monitor|diet|avoid|include|exercise|walk|water|medicine|report|lab|follow)\b/i;
  const plan = splitSentences(doctorText)
    .filter((sentence) => guidanceWords.test(sentence))
    .slice(-6)
    .map(toSentenceCase);

  return uniqueList(plan, [
    "Review symptoms and medical history with a licensed clinician.",
    "Carry current medicines, lab reports, and vitals for the next appointment.",
  ]);
}

function buildReportTitle(report: ConsultationReport, patientText: string) {
  const firstPatientTurn = report.transcript.find((entry) => entry.role === "patient")?.text;
  if (!firstPatientTurn) return "Voice consultation report";

  const firstSentence = splitSentences(firstPatientTurn)[0] || patientText;
  const compact = firstSentence.length > 72 ? `${firstSentence.slice(0, 69)}...` : firstSentence;
  return compact || "Voice consultation report";
}

function updateDigitalTwin(report: ConsultationReport) {
  const patientText = report.transcript
    .filter((entry) => entry.role === "patient")
    .map((entry) => entry.text)
    .join(" ");
  const doctorText = report.transcript
    .filter((entry) => entry.role === "doctor")
    .map((entry) => entry.text)
    .join(" ");

  report.digitalTwin = {
    patient: {
      ...report.digitalTwin.patient,
      reportStatus: report.status,
    },
    clinicalSnapshot: {
      chiefConcerns: extractConcerns(patientText),
      reportedMetrics: extractMetrics(patientText),
      lifestyleSignals: extractLifestyleSignals(patientText),
      riskSignals: extractRiskSignals(patientText),
    },
    carePlan: extractCarePlan(doctorText),
    conversationHistory: report.transcript,
    reportReady: report.status === "ready",
    lastUpdated: nowIso(),
  };
}

function finalizeReport(report: ConsultationReport) {
  report.status = "ready";
  report.endedAt = nowIso();
  updateDigitalTwin(report);
  report.title = buildReportTitle(
    report,
    report.transcript
      .filter((entry) => entry.role === "patient")
      .map((entry) => entry.text)
      .join(" "),
  );

  const concerns = report.digitalTwin.clinicalSnapshot.chiefConcerns.join(", ").toLowerCase();
  const messageCount = report.transcript.length;
  report.summary =
    messageCount > 0
      ? `Report ready. This digital twin snapshot was saved from ${messageCount} conversation turn${
          messageCount === 1 ? "" : "s"
        }, covering ${concerns}.`
      : "Report ready. No spoken transcript was captured before the consultation ended.";

  return report;
}

function wrapLine(line: string, maxChars: number) {
  const words = line.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function escapePdfText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdf(report: ConsultationReport) {
  const twin = report.digitalTwin;
  const rawLines = [
    "Curonosis Health - Consultation Report",
    `Report ID: ${report.id}`,
    `Status: ${report.status === "ready" ? "Report ready" : "Report in progress"}`,
    `Started: ${new Date(report.startedAt).toLocaleString()}`,
    `Ended: ${report.endedAt ? new Date(report.endedAt).toLocaleString() : "In progress"}`,
    "",
    "Summary",
    report.summary,
    "",
    "Digital Twin Snapshot",
    `Patient label: ${twin.patient.label}`,
    `Session ID: ${twin.patient.sessionId}`,
    `Language: ${twin.patient.language}`,
    `Report saved: ${twin.reportReady ? "Yes" : "No"}`,
    "",
    "Chief Concerns",
    ...twin.clinicalSnapshot.chiefConcerns.map((item) => `- ${item}`),
    "",
    "Reported Metrics",
    ...twin.clinicalSnapshot.reportedMetrics.map((item) => `- ${item}`),
    "",
    "Lifestyle Signals",
    ...twin.clinicalSnapshot.lifestyleSignals.map((item) => `- ${item}`),
    "",
    "Risk Signals",
    ...twin.clinicalSnapshot.riskSignals.map((item) => `- ${item}`),
    "",
    "Care Plan",
    ...twin.carePlan.map((item) => `- ${item}`),
    "",
    "Conversation History",
    ...report.transcript.map(
      (entry) =>
        `${entry.role === "patient" ? "Patient" : "Doctor"} (${new Date(
          entry.createdAt,
        ).toLocaleTimeString()}): ${entry.text}`,
    ),
    "",
    "This report is informational and does not replace advice from a licensed physician.",
  ];

  const wrappedLines = rawLines.flatMap((line) => wrapLine(line, 88));
  const linesPerPage = 48;
  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += linesPerPage) {
    pages.push(wrappedLines.slice(index, index + linesPerPage));
  }

  if (pages.length === 0) pages.push(["No report content available."]);

  const maxObjectNumber = 3 + pages.length * 2;
  const objectBodies: string[] = [];
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objectBodies[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objectBodies[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objectBodies[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const textOps = pageLines
      .map((line, lineIndex) =>
        lineIndex === 0
          ? `(${escapePdfText(line)}) Tj`
          : `T* (${escapePdfText(line)}) Tj`,
      )
      .join("\n");
    const content = `BT\n/F1 10 Tf\n50 800 Td\n14 TL\n${textOps}\nET`;

    objectBodies[pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objectBodies[contentObjectNumber] = `<< /Length ${Buffer.byteLength(
      content,
      "latin1",
    )} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, "latin1");
    pdf += `${objectNumber} 0 obj\n${objectBodies[objectNumber]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${maxObjectNumber + 1}\n0000000000 65535 f \n`;

  for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${maxObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function startServer() {
  await loadReports();

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/reports", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ reports: getSortedReports() });
  });

  app.get("/api/reports/:id", (req, res) => {
    const report = reports.get(req.params.id);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ report });
  });

  app.get("/api/reports/:id/pdf", (req, res) => {
    const report = reports.get(req.params.id);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    if (report.status !== "ready") {
      res.status(409).json({ error: "Report is not ready yet" });
      return;
    }

    const pdf = buildPdf(report);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="curonosis-report-${report.id.slice(0, 8)}.pdf"`,
    );
    res.send(pdf);
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
    : null;

  if (!ai) {
    console.warn("GEMINI_API_KEY is missing. Add it to .env before starting a live call.");
  }

  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs) => {
    if (!ai) {
      sendWs(clientWs, {
        type: "error",
        message: "Gemini API key is missing on the server.",
      });
      clientWs.close();
      return;
    }

    const report = createReport();
    const pendingTranscriptions: Record<ChatRole, string> = {
      patient: "",
      doctor: "",
    };
    let finalized = false;

    const flushPending = (role: ChatRole) => {
      const entry = appendTranscript(report, role, pendingTranscriptions[role]);
      pendingTranscriptions[role] = "";
      if (entry) sendWs(clientWs, { type: "transcript", entry });
    };

    const handleTranscription = (role: ChatRole, transcription?: Transcription) => {
      if (!transcription) return;

      const nextText = cleanText(transcription.text || "");
      if (nextText) {
        pendingTranscriptions[role] = mergeTranscriptText(
          pendingTranscriptions[role],
          nextText,
        );
        sendWs(clientWs, {
          type: "transcriptDraft",
          role,
          text: pendingTranscriptions[role],
        });
      }

      if (transcription.finished) {
        flushPending(role);
      }
    };

    try {
      const session = await ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {
            languageHints: {
              languageCodes: ["en-US", "hi-IN"],
            },
          },
          outputAudioTranscription: {
            languageHints: {
              languageCodes: ["en-US", "hi-IN"],
            },
          },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction:
            "You are Dr. AI, an expert and empathetic medical assistant created by Swetanshu Prasad. You must respond fluently in a natural mix of Hindi and English (Hinglish). You provide helpful, compassionate, and knowledgeable health and wellness advice. Keep your answers concise, conversational, and professional, always reminding users to consult a real physician for serious concerns.\n\nCRITICAL PROTOCOLS FOR DIABETES AND THYROID:\n1. IN-DEPTH INVESTIGATION: When a user mentions Diabetes or Thyroid, DO NOT just give immediate generic advice. Instead, ask in-depth diagnostic questions like a real doctor to understand the root cause and lifestyle factors.\n2. DIABETES QUESTIONS: Ask about their eating habits, daily routine, physical activity, family history, and when they first noticed symptoms.\n3. THYROID QUESTIONS: Ask about weight changes, energy levels, stress, sleep patterns, and current diet.\n4. DEEP DIVE: If they mention specific issues (e.g., severe fatigue, sudden sugar spikes), deep dive into those. Ask for specific data/reports (e.g., fasting sugar levels, HbA1c, TSH, T3, T4 levels).\n5. NATURAL CURES & DIET: Once you understand their lifestyle, suggest basic daily dietary changes and natural home remedies to manage the condition. Go deep into natural lifestyle adjustments (e.g., specific Indian foods, herbs, meal timings).\n6. STEP-BY-STEP: Ask 1-2 questions at a time. Do not overwhelm the user.\n7. REPORTING: At the end of each consultation, keep the final advice clear enough to be saved as a patient report with symptoms, history, risk signals, and care plan.",
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const serverContent = message.serverContent;

            handleTranscription("patient", serverContent?.inputTranscription);
            handleTranscription("doctor", serverContent?.outputTranscription);

            const audioParts = serverContent?.modelTurn?.parts || [];
            for (const part of audioParts) {
              const audio = part.inlineData?.data;
              if (audio) {
                sendWs(clientWs, { type: "audio", audio });
              }
            }

            if (serverContent?.interrupted) {
              sendWs(clientWs, { type: "interrupted", interrupted: true });
            }

            if (serverContent?.turnComplete) {
              if (pendingTranscriptions.patient) flushPending("patient");
              if (pendingTranscriptions.doctor) flushPending("doctor");
            }
          },
        },
      });

      reports.set(report.id, report);
      await saveReports();

      sendWs(clientWs, {
        type: "session",
        report,
        message: "Consultation started. Report is building.",
      });

      console.log("Connected to Gemini Live session:", report.id);
      session.sendRealtimeInput({ text: "Hello! Please introduce yourself to the user." });

      const finishReport = async (notifyClient: boolean) => {
        if (finalized) return;
        finalized = true;

        if (pendingTranscriptions.patient) flushPending("patient");
        if (pendingTranscriptions.doctor) flushPending("doctor");

        finalizeReport(report);
        reports.set(report.id, report);
        await saveReports();

        if (notifyClient) {
          sendWs(clientWs, {
            type: "reportReady",
            report,
            message: "Report is ready and saved as a digital twin.",
          });
        }

        try {
          session.close();
        } catch (error) {
          console.error("Error closing Gemini Live session:", error);
        }

        if (notifyClient && clientWs.readyState === WebSocket.OPEN) {
          setTimeout(() => clientWs.close(), 250);
        }
      };

      clientWs.on("message", (data) => {
        try {
          const payload = JSON.parse(data.toString()) as {
            type?: string;
            audio?: string;
          };

          if (payload.type === "endSession") {
            void finishReport(true);
            return;
          }

          if (payload.audio) {
            session.sendRealtimeInput({
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: payload.audio,
              },
            });
          }
        } catch (error) {
          console.error("Error parsing client message:", error);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected:", report.id);
        void finishReport(false);
      });
    } catch (error) {
      console.error("Error starting live session:", error);
      sendWs(clientWs, {
        type: "error",
        message: "Unable to start Gemini Live session. Check the API key and model access.",
      });
      clientWs.close();
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();
