/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mic, ArrowRight, Server, MessageSquare, AudioLines, Sparkles, MonitorPlay, Check, HeartCrack } from 'lucide-react';

interface StageDetails {
  id: number;
  title: string;
  subtitle: string;
  icon: any;
  desc: string;
  payload: string;
  optimizations: string[];
}

export default function ArchitectureDiagram() {
  const [activeStage, setActiveStage] = useState<number>(1);

  const stages: StageDetails[] = [
    {
      id: 1,
      title: "Audio Input (Opus/WebRTC Stream)",
      subtitle: "Client to Edge SFU",
      icon: Mic,
      desc: "The client browser captures raw 16kHz microphone audio. It is compressed via the Opus codec to maintain maximum payload density with custom target bitrates (32kbps mono is optimal for speech) and transmitted over WebRTC SRTP (Secure Real-time Transport Protocol).",
      payload: "Raw Opus frames packaged in RTP packets (20ms payload windows)",
      optimizations: [
        "Acoustic noise suppression enabled in client navigator metadata config",
        "Disabling standard audio playout echo-canceler drift buffers to save ~15ms",
        "Configuring custom jitter buffer constraints in WebRTC peer connection (max-latency: 80ms)"
      ]
    },
    {
      id: 2,
      title: "LiveKit SFU / Media Gateway",
      subtitle: "Low Latency Multiplexing",
      icon: Server,
      desc: "LiveKit SFU acts as the gateway. It intercepts the client input tracks, immediately decodes the Opus stream to raw 16-bit PCM buffer packets, and forwards them directly to our custom Python microservice via a high-performing local secure gRPC pipe.",
      payload: "16kHz Single-channel Linear PCM chunks (320 bytes / 10ms chunks)",
      optimizations: [
        "Co-located SFU and orchestrator server in the same physical cloud host region (e.g. asia-southeast1)",
        "Zero-copy RAM buffers to forward PCM bytes directly into shared socket queues"
      ]
    },
    {
      id: 3,
      title: "Hinglish Streaming STT",
      subtitle: "Persistent gRPC Channel",
      icon: AudioLines,
      desc: "Our orchestrator service maintains an active, persistent WebSocket or gRPC stream to the STT provider. Audio is pushed continuously without waiting for phrase completion. The provider returns interim transcripts with word-level timestamps and confidence metrics.",
      payload: "gRPC Streaming STT Responses containing both interim and finalized text tokens",
      optimizations: [
        "Using persistent chunk channels: avoiding the overhead of connection setup on every utterance",
        "Language detection configured to dual-priority (en-IN + hi-IN) to ensure rapid dialect code-switching"
      ]
    },
    {
      id: 4,
      title: "Semantic LLM & Emotion Tagging",
      subtitle: "Gemini streaming with inline visemes",
      icon: MessageSquare,
      desc: "The finalized transcript is fed into our system-prompted LLM (Gemini 2.5 Flash). Gemini responds instantly over an active server-sent event (SSE) stream. It injects synchronized emotion metadata anchors directly into the Hinglish conversational sentences.",
      payload: "Text Token Stream: '<joy>नमस्ते! How can I assist you with your card </joy> <neutral>today?</neutral>'",
      optimizations: [
        "Generating responses with temperature set to 0.4 to prevent lengthy syntax planning delays",
        "Using pre-warmed context windows and keeping token counts in history compact"
      ]
    },
    {
      id: 5,
      title: "Fast-Multipack Streaming TTS",
      subtitle: "Clause-level Synthesizer",
      icon: Sparkles,
      desc: "The orchestrator splits text tokens at clauses/punctuation delimiters (`,`, `.`, `!`). The resulting phrases are sent immediately to the emotional TTS voice cloning model. High-fidelity audio buffers are fed back as raw bytes.",
      payload: "Linear PCM Audio chunks + Viseme Timestamps mapped per character",
      optimizations: [
        "Sentence slicing: We synthesize the first clause as soon as the LLM outputs it, cutting TTFT wait by 70%",
        "Caching frequent phrases (e.g. greeting prompts, goodbye signatures) locally"
      ]
    },
    {
      id: 6,
      title: "Viseme & Blendshape Mapper",
      subtitle: "Mesh Animation Rigging",
      icon: MonitorPlay,
      desc: "To drive the visual avatar, the TTS audio is analyzed to extract standard blendshape weights (such as Oculus viseme sets, 50 basic mouth coordinates), which are packed as structural JSON or multiplexed inside WebRTC Datachannels directly alongside audio streams.",
      payload: "WebRTC Data Channel packets: Array<[visemeIndex, weight]> metadata timestamped",
      optimizations: [
        "Client-side Rive visual mapping (calculating phonemes directly from audio amplitude peaks in the browser context)",
        "Decoupling audio transmission from visual rendering (saving custom video bandwidth)"
      ]
    }
  ];

  const currentStage = stages.find(s => s.id === activeStage) || stages[0];

  return (
    <div className="flex flex-col space-y-6 h-full p-1" id="architecture-root">
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl">
        <h3 className="text-sm font-medium tracking-wide text-white mb-4 flex items-center space-x-2">
          <Server className="w-4.5 h-4.5 text-blue-400" />
          <span>Interactive Server Data Flow & WebRTC Architecture</span>
        </h3>

        {/* Pipeline Diagram */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pb-2 pt-1 border-b border-white/10">
          {stages.map((stg) => {
            const IconComponent = stg.icon;
            const isSelected = stg.id === activeStage;
            return (
              <button
                key={stg.id}
                onClick={() => setActiveStage(stg.id)}
                className={`relative flex flex-col items-center p-3 rounded-lg border transition-all text-center ${
                  isSelected
                    ? "bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-500/10 text-white"
                    : "bg-black/40 border-white/10 hover:border-white/20 text-slate-400"
                }`}
              >
                {/* Stage number */}
                <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                  isSelected ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
                }`}>
                  {stg.id}
                </span>

                <div className={`p-2 rounded-lg mb-2 ${isSelected ? "bg-blue-500/20 text-blue-400" : "bg-black/40 text-slate-500"}`}>
                  <IconComponent className="w-5 h-5" />
                </div>

                <p className="text-xs font-bold truncate w-full">{stg.title.split(' ')[0]}</p>
                <p className="text-[9px] text-slate-500 font-mono truncate w-full">{stg.subtitle}</p>

                {stg.id < 6 && (
                  <div className="hidden lg:block absolute top-[40%] -right-2 transform translate-x-1/2 z-10 text-slate-700 pointer-events-none">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Detail Panel */}
        <div className="mt-4 bg-[#0a0a0c] border border-white/10 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <span className="text-[10px] font-bold font-mono tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2 py-0.5 rounded-md">
                STAGE {currentStage.id} IN DETAILS
              </span>
              <h4 className="text-sm font-bold text-slate-200 mt-1">{currentStage.title}</h4>
              <p className="text-xs text-slate-500 font-mono italic">{currentStage.subtitle}</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-400 font-mono block">Data Payload Format</span>
              <span className="text-[10px] text-slate-300 font-mono bg-black/40 border border-white/10 px-2 py-1 rounded inline-block mt-0.5 max-w-full truncate">
                {currentStage.payload}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Functional description */}
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-300 tracking-wider uppercase">FUNCTIONAL DESCRIPTION</p>
              <p className="text-xs text-slate-400 leading-relaxed bg-black/40 border border-white/10 rounded-lg p-3">
                {currentStage.desc}
              </p>
            </div>

            {/* Architecture Optimization Panel */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center space-x-1">
                <Check className="w-3.5 h-3.5 text-blue-400" />
                <span>Low-Latency Tuning</span>
              </p>
              <div className="space-y-1.5">
                {currentStage.optimizations.map((opt, i) => (
                  <div key={i} className="flex items-start space-x-2 text-[11px] text-slate-400 leading-normal">
                    <span className="text-blue-500 select-none mt-0.5">•</span>
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low latency design considerations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3 shadow-2xl">
          <h4 className="text-xs font-semibold tracking-wide text-slate-200 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Critical Design: WebRTC DataChannels vs. Video Tracks</span>
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            In our architecture evaluations, we propose <strong className="text-slate-200 font-semibold">WebRTC DataChannels</strong> rather than classic H.264 video streams for delivering visemes. Capturing real-time camera frames and generating a live server-side full H.264 render takes roughly <strong className="text-rose-400">180ms - 320ms</strong> in GPU rendering pools, significantly blowing through the budget. 
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Instead, high fidelity audio is transmitted on a standard media track, while the animation/mouth coordinates are serialized as lightweight float vectors and emitted on a custom <strong className="text-blue-400">WebRTC DataChannel</strong>. The client-side vector shader or web canvas deforms the facial mesh locally. This drops metadata latency down to a mere <strong className="text-emerald-400 font-semibold">5ms</strong> and guarantees flawless audio/visual synchronization.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3 shadow-2xl">
          <h4 className="text-xs font-semibold tracking-wide text-slate-200 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>Bilingual Accent Persistence & Prosody Control</span>
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            A key issue in Indian conversational portals is losing the speaker's brand voice persona during language switches (e.g., using a pleasant British voice for English, but suddenly switching to an standard Indian-English dialect block for bilingual code-switching).
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Using <strong className="text-slate-200 font-semibold">ElevenLabs Multilingual v2</strong> resolves this. It binds physical acoustic voice features (vocal fry, nasal resonance, speed) and translates them into any target script. When the user types or speaks in Hindi, Hinglish, or English, the synthesizer respects the original phonemic profile, preserving brand identity across entire code-switched dialogues.
          </p>
        </div>
      </div>
    </div>
  );
}
