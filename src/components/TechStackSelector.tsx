/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { PipelineConfig, LatencyBreakdown } from '../types';
import { HelpCircle, AlertTriangle, CheckCircle, Zap, ShieldAlert } from 'lucide-react';

interface TechStackSelectorProps {
  config: PipelineConfig;
  onChange: (config: PipelineConfig) => void;
}

export default function TechStackSelector({ config, onChange }: TechStackSelectorProps) {
  // Latency profiles matching our architectural evaluations
  const latencyProfiles = useMemo(() => {
    const latencies: LatencyBreakdown = {
      stt: config.stt === 'deepgram' ? 140 : config.stt === 'azure' ? 180 : 240,
      transport1: 25, // Client -> Server (WebRTC raw audio stream)
      llmTTFT: config.llm === 'gemini_flash' ? 80 : config.llm === 'gemini_pro' ? 160 : 250,
      ttsTTS: config.tts === 'azure' ? 110 : config.tts === 'elevenlabs' ? 175 : 220,
      visemeGen: config.visual === 'rive_web' ? 5 : config.visual === 'unreal_audio2face' ? 15 : 240,
      transport2: 30 // Server -> Client (WebRTC audio + video/viseme stream)
    };

    const total = Object.values(latencies).reduce((a, b) => a + b, 0);
    return { ...latencies, total };
  }, [config]);

  // Comprehensive comparative evaluation notes
  const evaluationNotes = useMemo(() => {
    return {
      stt: {
        deepgram: {
          title: "Deepgram (Nova-2 Mulitlingual)",
          speed: "Extremely Fast (~140ms)",
          hinglish: "Moderate. Handles basic code-switching but struggles with localized Indian slang.",
          verdict: "Best for raw throughput. Requires dense acoustic prompts for heavy Hinglish code-switching."
        },
        sarvam: {
          title: "Sarvam AI (Shaktivani STT)",
          speed: "Moderate Low-Latency (~240ms)",
          hinglish: "Superb. Native understanding of code-switched Hindi-English syntax & phonetic variations.",
          verdict: "Gold standard for localized Hinglish semantics. Slower but highly accurate in noisy environments."
        },
        azure: {
          title: "Azure Speech STT (Indian English / Hindi)",
          speed: "Fast (~180ms)",
          hinglish: "Good. Solid auto-detection when configured with custom accent lexicon.",
          verdict: "Highly stable enterprise route, but dual-language auto-detect is slightly stiffer than Sarvam."
        }
      },
      tts: {
        elevenlabs: {
          title: "ElevenLabs (Multilingual v2)",
          speed: "Fast (~175ms)",
          hinglish: "Excellent. Retains high emotional nuance (joy, irony) and accent consistency.",
          verdict: "Top choice for photorealistic/expressive avatars where tone matches emotional prompt tags."
        },
        azure: {
          title: "Azure Neural TTS (Multilingual Custom Voice)",
          speed: "Ultra Fast (~110ms)",
          hinglish: "Good pronunciation, but sounds slightly formal or robotic on slang transitions.",
          verdict: "Perfect for hitting hard latency deadlines (< 450ms E2E) where speed outweighs theatricality."
        },
        sarvam_tts: {
          title: "Sarvam AI (Bulbul TTS)",
          speed: "Moderate Low-Latency (~220ms)",
          hinglish: "Exceptional Hinglish inflection & colloquial cadence. Perfect local native accents.",
          verdict: "Ultimate choice for accurate Indian vernacular flow and naturally spoken Hinglish rhythmic timing."
        }
      }
    };
  }, []);

  const total = latencyProfiles.total;
  const isBudgetOk = total <= 600;

  return (
    <div className="flex flex-col space-y-6 h-full p-1 scrollbar-thin scrollbar-thumb-slate-800" id="tech-stack-root">
      {/* SECTION 1: Pipeline Selectors */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl space-y-5">
        <h3 className="text-sm font-medium tracking-wide text-slate-300 flex items-center space-x-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>Interactive Pipeline Orchestration</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* STT Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex justify-between items-center">
              <span>Speech-to-Text (STT)</span>
              <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">Auto-Language Detect</span>
            </label>
            <select
              value={config.stt}
              onChange={(e) => onChange({ ...config, stt: e.target.value as any })}
              className="w-full bg-black/40 border border-white/10 text-xs text-slate-300 rounded-lg p-2.5 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            >
              <option value="deepgram">Deepgram Nova-2 (Speed Focus)</option>
              <option value="sarvam">Sarvam AI Shaktivani (Native Hinglish Accuracy)</option>
              <option value="azure">Azure Speech Service (Enterprise Stable)</option>
            </select>
          </div>

          {/* TTS Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex justify-between items-center">
              <span>Text-to-Speech (TTS)</span>
              <span className="text-blue-400 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">Voice Identity Match</span>
            </label>
            <select
              value={config.tts}
              onChange={(e) => onChange({ ...config, tts: e.target.value as any })}
              className="w-full bg-black/40 border border-white/10 text-xs text-slate-300 rounded-lg p-2.5 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            >
              <option value="elevenlabs">ElevenLabs Multilingual v2 (High Emotion)</option>
              <option value="azure">Azure Neural Custom Voice (Sub-120ms)</option>
              <option value="sarvam_tts">Sarvam Bulbul (Hinglish Accent Prosody)</option>
            </select>
          </div>

          {/* LLM Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex justify-between items-center">
              <span>LLM Orchestration</span>
              <span className="text-indigo-400 text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded">Streaming Enabled</span>
            </label>
            <select
              value={config.llm}
              onChange={(e) => onChange({ ...config, llm: e.target.value as any })}
              className="w-full bg-black/40 border border-white/10 text-xs text-slate-300 rounded-lg p-2.5 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            >
              <option value="gemini_flash">Gemini 2.5 Flash (Sub-90ms TTFT - *Recommended*)</option>
              <option value="gemini_pro">Gemini 2.5 Pro (Deep Nuance / Complex Intent)</option>
              <option value="gpt_turbo">GPT-4o Audio Preview (Multimodal Direct)</option>
            </select>
          </div>

          {/* Render Visual Choice */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex justify-between items-center">
              <span>Visual Rendering & Viseme Transport</span>
              <span className="text-rose-400 text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded">Lip Sync Pipeline</span>
            </label>
            <select
              value={config.visual}
              onChange={(e) => onChange({ ...config, visual: e.target.value as any })}
              className="w-full bg-black/40 border border-white/10 text-xs text-slate-300 rounded-lg p-2.5 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            >
              <option value="rive_web">Web UI Rive / Vector Canvas (Client Side ~5ms)</option>
              <option value="unreal_audio2face">Custom 3D: Unreal Engine + Audio2Face (~15ms)</option>
              <option value="heygen_webrtc">Photorealistic API: HeyGen Live WebRTC (~240ms)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 2: Dynamic Latency Budget Meter */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium tracking-wide text-slate-300">
            Conversational Latency Budget
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-slate-500 tracking-wider">TARGET: &lt;600ms</span>
            {isBudgetOk ? (
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{total}ms (OK)</span>
              </span>
            ) : (
              <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{total}ms (BUDGET OVERFLOW)</span>
              </span>
            )}
          </div>
        </div>

        {/* Visual Stacked Bar */}
        <div className="space-y-2">
          <div className="w-full bg-black/40 rounded-lg h-6 overflow-hidden flex relative border border-white/10 shadow-inner">
            {/* STT */}
            <div
              style={{ width: `${(latencyProfiles.stt / total) * 100}%` }}
              className="bg-indigo-600/80 hover:bg-indigo-500 transition-colors duration-200 relative group flex items-center justify-center cursor-pointer border-r border-white/10"
            >
              <span className="text-[9px] font-mono font-bold text-white truncate px-1">STT</span>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded shadow-2xl text-[10px] text-slate-300 w-48 hidden group-hover:block z-50 pointer-events-none font-sans">
                <p className="font-semibold text-indigo-400">Speech-To-Text processing</p>
                <div className="flex justify-between mt-1 text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span>{latencyProfiles.stt}ms</span>
                </div>
              </div>
            </div>

            {/* Transport 1 */}
            <div
              style={{ width: `${(latencyProfiles.transport1 / total) * 100}%` }}
              className="bg-purple-600/80 hover:bg-purple-500 transition-colors duration-200 relative group flex items-center justify-center cursor-pointer border-r border-white/10"
            >
              <span className="text-[9px] font-mono font-bold text-white/80">TX1</span>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded shadow-2xl text-[10px] text-slate-300 w-48 hidden group-hover:block z-50 pointer-events-none font-sans">
                <p className="font-semibold text-purple-400">Media Stream WebRTC Upload</p>
                <p className="text-slate-500 text-[9px] mt-0.5">Raw PCM/Opus mic packets to SFU</p>
                <div className="flex justify-between mt-1 text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span>{latencyProfiles.transport1}ms</span>
                </div>
              </div>
            </div>

            {/* LLM TTFT */}
            <div
              style={{ width: `${(latencyProfiles.llmTTFT / total) * 100}%` }}
              className="bg-emerald-600/70 hover:bg-emerald-500 transition-colors duration-200 relative group flex items-center justify-center cursor-pointer border-r border-white/10"
            >
              <span className="text-[9px] font-mono font-bold text-white truncate px-1">LLM</span>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded shadow-2xl text-[10px] text-slate-300 w-48 hidden group-hover:block z-50 pointer-events-none font-sans">
                <p className="font-semibold text-emerald-400">LLM Generation (TTFT)</p>
                <p className="text-slate-500 text-[9px] mt-0.5">Time to first chunk of response token</p>
                <div className="flex justify-between mt-1 text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span>{latencyProfiles.llmTTFT}ms</span>
                </div>
              </div>
            </div>

            {/* TTS */}
            <div
              style={{ width: `${(latencyProfiles.ttsTTS / total) * 100}%` }}
              className="bg-cyan-600/80 hover:bg-cyan-500 transition-colors duration-200 relative group flex items-center justify-center cursor-pointer border-r border-white/10"
            >
              <span className="text-[9px] font-mono font-bold text-white truncate px-1">TTS</span>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded shadow-2xl text-[10px] text-slate-300 w-48 hidden group-hover:block z-50 pointer-events-none font-sans">
                <p className="font-semibold text-cyan-400">Streamed Text-To-Speech</p>
                <p className="text-slate-500 text-[9px] mt-0.5">Sentence-boundary audio generation</p>
                <div className="flex justify-between mt-1 text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span>{latencyProfiles.ttsTTS}ms</span>
                </div>
              </div>
            </div>

            {/* Visemes */}
            <div
              style={{ width: `${(latencyProfiles.visemeGen / total) * 100}%` }}
              className="bg-blue-600/80 hover:bg-blue-500 transition-colors duration-200 relative group flex items-center justify-center cursor-pointer border-r border-white/10"
            >
              <span className="text-[9px] font-mono font-bold text-white truncate px-1">VIS</span>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded shadow-2xl text-[10px] text-slate-300 w-48 hidden group-hover:block z-50 pointer-events-none font-sans">
                <p className="font-semibold text-blue-400">Viseme & Mesh Deformation</p>
                <p className="text-slate-500 text-[9px] mt-0.5">Lip-sync mesh keyframe extraction</p>
                <div className="flex justify-between mt-1 text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span>{latencyProfiles.visemeGen}ms</span>
                </div>
              </div>
            </div>

            {/* Transport 2 */}
            <div
              style={{ width: `${(latencyProfiles.transport2 / total) * 100}%` }}
              className="bg-indigo-400/80 hover:bg-indigo-300 transition-colors duration-200 relative group flex items-center justify-center cursor-pointer"
            >
              <span className="text-[9px] font-mono font-bold text-white/80">TX2</span>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded shadow-2xl text-[10px] text-slate-300 w-48 hidden group-hover:block z-50 pointer-events-none font-sans">
                <p className="font-semibold text-indigo-300">WebRTC Client Download</p>
                <p className="text-slate-500 text-[9px] mt-0.5">Sub-frame network jitter & buffer transit</p>
                <div className="flex justify-between mt-1 text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span>{latencyProfiles.transport2}ms</span>
                </div>
              </div>
            </div>

            {/* Crucial 600ms marker marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-500/80 z-20 pointer-events-none" style={{ left: '80%' }}>
              <span className="absolute -top-1 -left-1 text-[8px] bg-red-600 text-white font-mono px-0.5 rounded">600ms Target</span>
            </div>
          </div>

          {/* Key items */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-indigo-600 block"></span>
              <span className="text-[10px] text-slate-400 font-mono">{latencyProfiles.stt}ms STT</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-purple-600 block"></span>
              <span className="text-[10px] text-slate-400 font-mono">{latencyProfiles.transport1}ms TX1</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-emerald-600 block"></span>
              <span className="text-[10px] text-slate-400 font-mono">{latencyProfiles.llmTTFT}ms LLM</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-cyan-600 block"></span>
              <span className="text-[10px] text-slate-400 font-mono">{latencyProfiles.ttsTTS}ms TTS</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-blue-600 block"></span>
              <span className="text-[10px] text-slate-400 font-mono">{latencyProfiles.visemeGen}ms Viseme</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-indigo-400 block"></span>
              <span className="text-[10px] text-slate-400 font-mono">{latencyProfiles.transport2}ms TX2</span>
            </div>
          </div>
        </div>

        {/* Warning panel if over limit */}
        {!isBudgetOk && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-start space-x-2.5 text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold">Target Latency Limit Exceeded ({total}ms)</p>
              <p className="opacity-80">
                To stay under the conversational bounds of 600ms, consider swapping to a faster, lighter client-side viseme rendering solution (Web UI Rive) or ultra-fast Azure Neural TTS options.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Detailed Evaluations */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl space-y-4">
        <h3 className="text-sm font-medium tracking-wide text-slate-300 flex items-center space-x-2">
          <HelpCircle className="w-4.5 h-4.5 text-indigo-400" />
          <span>Architect Evaluation Notes: Indian Accent & Latency</span>
        </h3>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* STT Deep dive */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-400 tracking-wide uppercase border-b border-white/10 pb-1.5">
              Speech-to-Text Lexical Accuracy
            </p>
            <div className="space-y-3.5">
              {Object.entries(evaluationNotes.stt).map(([provider, details]: [string, any]) => (
                <div key={provider} className={`text-xs space-y-0.5 ${provider === config.stt ? 'p-2 bg-white/5 rounded-md border border-white/10' : ''}`}>
                  <p className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    {provider === config.stt && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>}
                    <span>{details.title}</span>
                  </p>
                  <p className="text-slate-400">
                    <span className="text-slate-500 font-medium">Auto-Detect Hinglish:</span> {details.hinglish}
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono">
                    <span className="text-slate-400 font-semibold">Speed:</span> {details.speed} | {details.verdict}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* TTS deep dive */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-cyan-400 tracking-wide uppercase border-b border-white/10 pb-1.5">
              Text-to-Speech Prosody & Persona Consistency
            </p>
            <div className="space-y-3.5">
              {Object.entries(evaluationNotes.tts).map(([provider, details]: [string, any]) => (
                <div key={provider} className={`text-xs space-y-0.5 ${provider === config.tts ? 'p-2 bg-white/5 rounded-md border border-white/10' : ''}`}>
                  <p className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    {provider === config.tts && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>}
                    <span>{details.title}</span>
                  </p>
                  <p className="text-slate-400">
                    <span className="text-slate-500 font-medium">Tone Stability:</span> {details.hinglish}
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono">
                    <span className="text-slate-400 font-semibold">Speed:</span> {details.speed}  | {details.verdict}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
