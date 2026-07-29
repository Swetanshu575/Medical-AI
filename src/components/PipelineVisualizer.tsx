/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { PipelineConfig } from '../types';
import { Mic, Sparkles, Volume2, Cpu, RefreshCw, AudioLines } from 'lucide-react';

interface PipelineVisualizerProps {
  config: PipelineConfig;
}

export default function PipelineVisualizer({ config }: PipelineVisualizerProps) {
  const [pipelineState, setPipelineState] = useState<'idle' | 'recording' | 'processing' | 'tts_rendering' | 'speaking'>('idle');
  const [currentTextIndex, setCurrentTextIndex] = useState<number>(-1);
  const [currentViseme, setCurrentViseme] = useState<{ p: string; desc: string }>({ p: 'Rest', desc: 'Relaxed Lips' });
  const [playbackText, setPlaybackText] = useState<string>('');
  const [timer, setTimer] = useState<number>(0);
  const intervalRef = useRef<any>(null);

  // Phrases used to demonstrate Hinglish speaking loops
  const speakingScript = [
    { text: "आप बिल्कुल चिंता मत कीजिए, ", emotion: "concern", viseme: { p: "O", desc: "Round Purse" } },
    { text: "मैं आपका credit card अभी lock कर देता हूँ, ", emotion: "concern", viseme: { p: "MBP", desc: "Closed Flat" } },
    { text: "ताकि secure check complete रहे। ", emotion: "neutral", viseme: { p: "A", desc: "Wide Open" } },
    { text: "Is that perfect, sir?", emotion: "joy", viseme: { p: "E", desc: "Wide Corner" } }
  ];

  // Calculate delays based on selections
  const sttDelay = config.stt === 'deepgram' ? 140 : config.stt === 'azure' ? 180 : 240;
  const llmDelay = config.llm === 'gemini_flash' ? 80 : config.llm === 'gemini_pro' ? 160 : 250;
  const ttsDelay = config.tts === 'azure' ? 110 : config.tts === 'elevenlabs' ? 175 : 220;

  const triggerTestSimulation = () => {
    if (pipelineState !== 'idle') return;

    setPipelineState('recording');
    setPlaybackText('');
    setTimer(0);
    setCurrentTextIndex(-1);

    // 1. User is speaking / Mic Recording simulation
    let recordTime = 1200;
    setTimeout(() => {
      // 2. Audio chunks forwarded to STT -> LLM Processing
      setPipelineState('processing');
      
      const processTimer = setInterval(() => {
        setTimer(prev => prev + 10);
      }, 10);

      const responseTime = sttDelay + llmDelay;
      setTimeout(() => {
        clearInterval(processTimer);
        
        // 3. LLM finished -> TTS starting to render audio chunks
        setPipelineState('tts_rendering');
        
        setTimeout(() => {
          // 4. TTS Buffer full -> Avatar starts playing speech and visemes
          setPipelineState('speaking');
          setCurrentTextIndex(0);
          setPlaybackText(speakingScript[0].text);
          setCurrentViseme(speakingScript[0].viseme);
        }, ttsDelay);

      }, responseTime);

    }, recordTime);
  };

  // Viseme speech progression loop
  useEffect(() => {
    if (pipelineState !== 'speaking' || currentTextIndex === -1) return;

    const speechTimer = setTimeout(() => {
      const nextIndex = currentTextIndex + 1;
      if (nextIndex < speakingScript.length) {
        setCurrentTextIndex(nextIndex);
        setPlaybackText(prev => prev + speakingScript[nextIndex].text);
        setCurrentViseme(speakingScript[nextIndex].viseme);
      } else {
        // Speech finished
        setTimeout(() => {
          setPipelineState('idle');
          setCurrentTextIndex(-1);
          setPlaybackText('');
          setCurrentViseme({ p: 'Rest', desc: 'Relaxed Lips' });
        }, 1200);
      }
    }, 1100);

    return () => clearTimeout(speechTimer);
  }, [pipelineState, currentTextIndex]);

  // Audio waveform animation helper
  const [waveOffsets, setWaveOffsets] = useState<number[]>([10, 20, 15, 30, 12, 25, 18, 40, 15, 20]);
  useEffect(() => {
    if (pipelineState !== 'speaking' && pipelineState !== 'recording') {
      setWaveOffsets([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
      return;
    }

    const interval = setInterval(() => {
      setWaveOffsets(
        Array.from({ length: 12 }, () => Math.floor(Math.random() * (pipelineState === 'speaking' ? 45 : 20)) + 6)
      );
    }, 110);

    return () => clearInterval(interval);
  }, [pipelineState]);

  // Avatar facial rig parameters calculation
  const getAvatarMouthHeight = () => {
    if (pipelineState !== 'speaking') return 3; // Rest state height
    switch (currentViseme.p) {
      case 'A': return 22; // Wide open
      case 'O': return 14; // Open round
      case 'E': return 10; // Wide corner
      case 'MBP': return 1; // Lip closed
      default: return 5;
    }
  };

  const getAvatarMouthWidth = () => {
    if (pipelineState !== 'speaking') return 24; // Rest width
    switch (currentViseme.p) {
      case 'A': return 26;
      case 'O': return 15; // Tight purse
      case 'E': return 32; // Wide stretch
      case 'MBP': return 24;
      default: return 24;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl h-full flex flex-col justify-between" id="visualizer-root">
      
      {/* Dynamic Header */}
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-medium tracking-wide text-white">Live AI Avatar Lip Sync Sandbox</h3>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Dual-Accented Hinglish Prosody Pipeline</p>
        </div>
        <div className="flex items-center space-x-1.5 font-mono text-[10px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-emerald-400 font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">
            {pipelineState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main Avatar Section Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-5 grow items-center">
        
        {/* Left column (Avatar and visual lipsync) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
          
          {/* Avatar Graphic Canvas */}
          <div className="relative w-44 h-44 rounded-full bg-[#0a0a0c] border-2 border-white/10 shadow-inner flex items-center justify-center overflow-hidden group">
            
            {/* Cyber HUD circle overlay */}
            <div className={`absolute inset-1 rounded-full border border-dashed border-sky-400/20 ${pipelineState === 'speaking' ? 'animate-spin' : ''}`} style={{ animationDuration: '30s' }}></div>
            
            {/* Pulsing grid shadow */}
            <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none"></div>

            {/* SVG Interactive Avatar */}
            <svg viewBox="0 0 100 100" className="w-32 h-32 z-10 transition-transform duration-300 hover:scale-105">
              {/* Background Glow */}
              <defs>
                <filter id="avatar-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Head Outline */}
              <path
                d="M30,35 Q10,35 15,60 Q20,85 50,85 Q80,85 85,60 Q90,35 70,35 Z"
                fill="#111115"
                stroke={pipelineState === 'speaking' ? '#818cf8' : '#334155'}
                strokeWidth="1.8"
                filter="url(#avatar-glow)"
                className="transition-colors duration-300"
              />

              {/* Eyes */}
              {/* Left Eye */}
              <g transform="translate(34, 48)">
                <ellipse cx="0" cy="0" rx="4" ry={pipelineState === 'processing' ? '0.5' : '4'} fill="#38bdf8" />
                <circle cx="-1" cy="-1" r="1.2" fill="#ffffff" />
              </g>

              {/* Right Eye */}
              <g transform="translate(66, 48)">
                <ellipse cx="0" cy="0" rx="4" ry={pipelineState === 'processing' ? '0.5' : '4'} fill="#38bdf8" />
                <circle cx="-1" cy="-1" r="1.2" fill="#ffffff" />
              </g>

              {/* Brows */}
              <path d="M28,42 Q34,40 40,43" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M72,42 Q66,40 60,43" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" fill="none" />

              {/* Interactive Lipsync Mouth structure */}
              <g transform="translate(50, 68)">
                <ellipse
                  cx="0"
                  cy="0"
                  rx={getAvatarMouthWidth() / 2.5}
                  ry={getAvatarMouthHeight() / 2.5}
                  fill="#1a1a1f"
                  stroke={pipelineState === 'speaking' ? '#818cf8' : '#38bdf8'}
                  strokeWidth="2"
                  className="transition-all duration-100 ease-out"
                />
                {/* Teeth Line (Inner expression) */}
                {getAvatarMouthHeight() > 8 && (
                  <line
                    x1={-getAvatarMouthWidth() / 4}
                    y1="-1.5"
                    x2={getAvatarMouthWidth() / 4}
                    y2="-1.5"
                    stroke="#f8fafc"
                    strokeWidth="1.2"
                  />
                )}
              </g>

              {/* Cybernetic details */}
              <line x1="50" y1="12" x2="50" y2="24" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
              <circle cx="50" cy="24" r="1.5" fill="#10b981" />
            </svg>

            {/* Phonetic key labels overlay */}
            {pipelineState === 'speaking' && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/80 border border-indigo-500/30 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-indigo-400 z-20 flex space-x-1">
                <span>{currentViseme.p}</span>
                <span className="text-slate-500">|</span>
                <span>{currentViseme.desc}</span>
              </div>
            )}
          </div>

          {/* Active Audio Waveform bar */}
          <div className="flex items-center space-x-0.5 justify-center h-8 w-full px-4">
            {waveOffsets.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full transition-all duration-100 ${
                  pipelineState === 'speaking'
                    ? "bg-indigo-400 glow-indigo-400"
                    : pipelineState === 'recording'
                    ? "bg-rose-400 glow-rose-400"
                    : "bg-white/10"
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* Right column (Status lists, logs, timing analysis) */}
        <div className="md:col-span-7 space-y-4">
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-3.5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Pipeline Execution Sequence
            </h4>

            {/* Step 1 */}
            <div className={`flex items-center justify-between p-2 rounded border text-xs ${
              pipelineState === 'recording'
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                : 'bg-black/20 border-white/5 text-slate-500'
            }`}>
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 shrink-0" />
                <span className="font-semibold">1. Client Audio Feed (Live Microphone)</span>
              </div>
              <span className="text-[10px] font-mono">Capturing...</span>
            </div>

            {/* Step 2 */}
            <div className={`flex items-center justify-between p-2 rounded border text-xs ${
              pipelineState === 'processing'
                ? 'bg-yellow-950/20 border-yellow-500/40 text-yellow-200'
                : 'bg-black/20 border-white/5 text-slate-500'
            }`}>
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 shrink-0" />
                <span className="font-semibold">2. STT + Gemini Orchestration</span>
              </div>
              <span className="text-[10px] font-mono">
                {pipelineState === 'processing' ? `T+: ${timer}ms / Limit: ${sttDelay + llmDelay}ms` : 'Awaiting...'}
              </span>
            </div>

            {/* Step 3 */}
            <div className={`flex items-center justify-between p-2 rounded border text-xs ${
              pipelineState === 'tts_rendering'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : 'bg-black/20 border-white/5 text-slate-500'
            }`}>
              <div className="flex items-center space-x-2">
                <RefreshCw className={`w-4 h-4 shrink-0 ${pipelineState === 'tts_rendering' ? 'animate-spin' : ''}`} />
                <span className="font-semibold">3. Fast TTS Generation (Sentence Slice)</span>
              </div>
              <span className="text-[10px] font-mono">
                {pipelineState === 'tts_rendering' ? `Inbound PCM buffers` : 'Awaiting...'}
              </span>
            </div>

            {/* Step 4 */}
            <div className={`flex items-center justify-between p-2 rounded border text-xs ${
              pipelineState === 'speaking'
                ? 'bg-indigo-950/20 border-indigo-500/40 text-indigo-200'
                : 'bg-black/20 border-white/5 text-slate-500'
            }`}>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">4. Client WebRTC Player ({config.visual === 'rive_web' ? 'Rive' : '3D Audio2Face'})</span>
              </div>
              <span className="text-[10px] font-mono">Playing</span>
            </div>
          </div>

          {/* Subtitle Teleprompter display */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-3.5 h-16 flex items-center">
            {pipelineState === 'speaking' ? (
              <p className="text-xs text-indigo-400 font-serif leading-relaxed animate-fade-in">
                <span className="text-slate-500 text-[10px] font-mono block mb-0.5">CONVERSATIONAL STREAM:</span>
                {playbackText}
              </p>
            ) : pipelineState === 'recording' ? (
              <p className="text-xs text-rose-400 leading-normal italic">
                🎙️ Speak: "मेरा credit card खो गया है, block कर दीजिए!"
              </p>
            ) : pipelineState === 'processing' ? (
              <div className="flex items-center space-x-2 text-xs text-yellow-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Resolving Hinglish intent & predicting audio emotions...</span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Press "Simulate Customer Speech" below to trigger the low-latency pipeline simulation.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Button controls */}
      <div className="flex space-x-2.5">
        <button
          onClick={triggerTestSimulation}
          disabled={pipelineState !== 'idle'}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold tracking-wider transition-all uppercase flex items-center justify-center space-x-2 ${
            pipelineState !== 'idle'
              ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-900/20 border border-white/10"
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Simulate Customer Speech</span>
        </button>
      </div>

    </div>
  );
}
