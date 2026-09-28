/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PresetPhrase } from '../types';
import { Sparkles, MessageSquare, Code, Play, Check, Flame } from 'lucide-react';

export default function PromptEngineeringPanel() {
  const [selectedPreset, setSelectedPreset] = useState<string>('diabetes_initial');
  const [customUserPrompt, setCustomUserPrompt] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [pipelineOutput, setPipelineOutput] = useState<{
    rawOutput: string;
    emotion: string;
    strippedText: string;
    visemeMapping: { frame: number; phoneme: string; shape: string }[];
  } | null>(null);

  // High-fidelity realistic Hinglish medical scenario presets
  const presets: PresetPhrase[] = useMemo(() => [
    {
      id: 'diabetes_initial',
      trigger: "Mujhe diabetes detect hua hai recently. Kya karun?",
      response: "<concern>Oh, I understand. Diabetes sunkar thoda stress hona natural hai, but don't worry.</concern> <neutral>Aapko recently detect hua hai, right? Can you tell me aapki fasting sugar kitni aayi thi? Aur aapka daily eating schedule kaisa rehta hai?</neutral>",
      emotion: 'concern',
      hinglishReason: "Follows protocol: Acknowledges the condition empathetically, then immediately asks for specific data (fasting sugar) and probes into lifestyle (eating schedule)."
    },
    {
      id: 'thyroid_fatigue',
      trigger: "Mujhe thyroid hai aur bohot thakawat rehti hai aajkal. Energy bilkul nahi hai.",
      response: "<concern>I hear you. Thyroid imbalance mein extreme fatigue bohot common hai.</concern> <neutral>Thakawat ke alawa, kya aapne recently koi sudden weight changes ya sleep patterns mein disturbace notice kiya hai? Aur aap abhi koi thyroid medication le rahe hain?</neutral>",
      emotion: 'concern',
      hinglishReason: "Deep Dives into the specific issue (fatigue) mentioned for Thyroid, while probing for further common symptoms (weight, sleep) to gather a complete picture."
    },
    {
      id: 'diabetes_diet',
      trigger: "Sugar levels fluctuate kar rahe hain, diet mein kya change karun?",
      response: "<neutral>Fluctuating sugar ke liye diet timing aur content dono important hain.</neutral> <joy>Aap apni diet mein methi daana (fenugreek) aur jamun include kar sakte hain. Subah khali pet methi ka paani try kiya hai aapne? Also, aap meals mein kitna gap rakhte hain?</joy>",
      emotion: 'joy',
      hinglishReason: "Provides specific natural Indian remedies (methi, jamun) as requested in the protocol, and continues the investigation by asking about meal gaps."
    }
  ], []);

  const systemPromptTemplate = `You are Dr. AI, an expert and empathetic medical assistant created by Ankit Ujjwal and Swetanshu Prasad. You must respond fluently in a natural mix of Hindi and English (Hinglish). You provide helpful, compassionate, and knowledgeable health and wellness advice. Keep your answers concise, conversational, and professional, always reminding users to consult a real physician for serious concerns.

CRITICAL PROTOCOLS FOR DIABETES AND THYROID:
1. IN-DEPTH INVESTIGATION: When a user mentions Diabetes or Thyroid, DO NOT just give immediate generic advice. Instead, ask in-depth diagnostic questions like a real doctor to understand the root cause and lifestyle factors.
2. DIABETES QUESTIONS: Ask about their eating habits, daily routine, physical activity, family history, and when they first noticed symptoms.
3. THYROID QUESTIONS: Ask about weight changes, energy levels, stress, sleep patterns, and current diet.
4. DEEP DIVE: If they mention specific issues (e.g., severe fatigue, sudden sugar spikes), deep dive into those. Ask for specific data/reports (e.g., fasting sugar levels, HbA1c, TSH, T3, T4 levels).
5. NATURAL CURES & DIET: Once you understand their lifestyle, suggest basic daily dietary changes and natural home remedies to manage the condition. Go deep into natural lifestyle adjustments (e.g., specific Indian foods, herbs, meal timings).
6. STEP-BY-STEP: Ask 1-2 questions at a time. Do not overwhelm the user.`;

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setPipelineOutput(null);

    setTimeout(() => {
      let activePreset = presets.find(p => p.id === selectedPreset);
      if (customUserPrompt.trim() !== '') {
        // Mock custom generator
        activePreset = {
          id: 'custom',
          trigger: customUserPrompt,
          response: "<joy>बिल्कुल! I heard your message: \"" + customUserPrompt.slice(0, 30) + "\"... </joy> <neutral>Let me process this query in dynamic Hinglish for you.</neutral>",
          emotion: 'joy',
          hinglishReason: "Synthesized via real-time customized LLM parser simulation. Preserves localized structures."
        };
      }

      if (!activePreset) return;

      // Extract raw/stripped text
      const regex = /<(\w+)>([\s\S]*?)<\/(\w+)>/g;
      let trimmedText = activePreset.response.replace(regex, '$2');
      
      // Simulate viseme keyframes mapping
      // Standard viseme models use ~12 primary lip positions: A, O, U, E, MBP, L, Th, FV, etc.
      const phonemes = ["A", "O", "MBP", "E", "Th", "L", "Rest"];
      const shapes = ["Wide Open", "Round Purse", "Closed Flat", "Wide Corner", "Tongue Out", "Tongue Up", "Relaxed Line"];
      const mapping = trimmedText.split(' ').slice(0, 9).map((word, i) => ({
        frame: i * 8,
        phoneme: phonemes[i % phonemes.length],
        shape: shapes[i % shapes.length] + ` ("${word.replace(/[.,!?]/g, '')}")`
      }));

      setPipelineOutput({
        rawOutput: activePreset.response,
        emotion: activePreset.emotion,
        strippedText: trimmedText,
        visemeMapping: mapping
      });
      setIsSynthesizing(false);
    }, 1100);
  };

  const selectedPresetObj = presets.find(p => p.id === selectedPreset);

  return (
    <div className="flex flex-col space-y-6 h-full p-1" id="prompt-root">
      {/* SECTION 1: System Prompt Blueprint */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium tracking-wide text-white flex items-center space-x-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span>Server System Prompt Blueprint</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono bg-black/40 px-2 py-1 rounded border border-white/10">
            TEMPERATURE: 0.4
          </span>
        </div>
        
        <p className="text-xs text-slate-400">
          This system prompt forces the LLM to structure replies in bilingual, natural Hinglish syntax while strictly embedding emotional overlays for the interactive web rendering system.
        </p>

        <div className="relative">
          <pre className="text-[10px] sm:text-xs font-mono text-slate-300 bg-[#0a0a0c] border border-white/10 rounded-lg p-4 snap-y max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
            {systemPromptTemplate}
          </pre>
          <div className="absolute bottom-2 right-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono px-1.5 py-0.5 rounded cursor-help">
            Deployable Template
          </div>
        </div>
      </div>

      {/* SECTION 2: Interactive Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Playground controls */}
        <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-medium tracking-wide text-slate-300 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Translation & Emotion Sandbox</span>
            </h3>

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">Select Hinglish Customer Presets</label>
              <div className="flex flex-col space-y-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPreset(p.id);
                      setCustomUserPrompt('');
                    }}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-start space-x-2.5 ${
                      selectedPreset === p.id && customUserPrompt === ''
                        ? "bg-emerald-950/30 border-emerald-500/60 text-emerald-100"
                        : "bg-black/40 border-white/10 hover:border-white/20 text-slate-400"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-300">
                        {p.id === 'diabetes_initial' ? "Recently Detected Diabetes" : p.id === 'thyroid_fatigue' ? "Thyroid Fatigue Issue" : "Fluctuating Sugar Levels"}
                      </p>
                      <p className="opacity-70 text-[10px] mt-0.5 truncate max-w-sm">{p.trigger}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom user prompt input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">Or Try Custom Input</label>
              <textarea
                value={customUserPrompt}
                onChange={(e) => {
                  setCustomUserPrompt(e.target.value);
                  setSelectedPreset('');
                }}
                placeholder="Type complex English, Hindi, or Hinglish phrase here..."
                className="w-full text-xs font-sans text-slate-200 bg-[#0a0a0c] border border-white/10 rounded-lg p-2.5 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                rows={2}
              />
            </div>
          </div>

          <button
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-xs tracking-wider transition-all flex items-center justify-center space-x-2 ${
              isSynthesizing
                ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
                : "bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-md shadow-emerald-900/20 border border-white/10"
            }`}
          >
            {isSynthesizing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Synthesizing Hinglish & Visemes...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Pipeline Synthesis</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Execution Simulation Output */}
        <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-xs font-medium tracking-wide text-slate-400">
              Pipeline Output Visualization
            </h4>

            {pipelineOutput ? (
              <div className="space-y-4">
                {/* Visual emotional markup */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">A. RAW TOKEN OUTPUT FROM LLM (With Emotional Tags)</p>
                  <div className="p-3 bg-[#0a0a0c] border border-white/10 rounded-lg text-xs leading-relaxed font-mono">
                    {/* Syntax highlighting for emotion tags */}
                    <span className="text-rose-400">&lt;concern&gt;</span>
                    <span className="text-slate-200">
                      {pipelineOutput.rawOutput.includes('<concern>') ? pipelineOutput.rawOutput.split('<concern>')[1]?.split('</concern>')[0] : ''}
                    </span>
                    <span className="text-rose-400">&lt;/concern&gt;</span>
                    
                    <span className="text-emerald-400">&lt;joy&gt;</span>
                    <span className="text-slate-200">
                      {pipelineOutput.rawOutput.includes('<joy>') ? pipelineOutput.rawOutput.split('<joy>')[1]?.split('</joy>')[0] : ''}
                    </span>
                    <span className="text-emerald-400">&lt;/joy&gt;</span>

                    <span className="text-blue-400">&lt;neutral&gt;</span>
                    <span className="text-slate-200">
                      {pipelineOutput.rawOutput.includes('<neutral>') ? pipelineOutput.rawOutput.split('<neutral>')[1]?.split('</neutral>')[0] : ''}
                    </span>
                    <span className="text-blue-400">&lt;/neutral&gt;</span>
                  </div>
                </div>

                {/* Filtered text to TTS */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">B. AUDIO STREAM SENT TO TTS (Tags Stripped, Clean Pronunciation)</p>
                  <p className="p-3 bg-[#0a0a0c] border border-white/10 rounded-lg text-xs text-slate-300 leading-relaxed italic">
                    "{pipelineOutput.strippedText}"
                  </p>
                </div>

                {/* Resolved Visemes Timeline */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">C. REAL-TIME VISEME BLENDSHAPE TRACK (60fps Interpolation)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                    {pipelineOutput.visemeMapping.map((v, idx) => (
                      <div key={idx} className="bg-slate-950/80 border border-slate-900 p-2 rounded flex flex-col space-y-0.5 justify-center">
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                          <span>Frame {v.frame}</span>
                          <span className="text-sky-400 font-bold">{v.phoneme}</span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-semibold truncate">{v.shape}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col justify-center items-center text-center p-6 border border-dashed border-white/10 rounded-lg bg-black/20">
                <Flame className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs text-slate-400 font-medium">No active synthesis</p>
                <p className="text-[10px] text-slate-500 max-w-sm mt-1">
                  Choose a preset or type a custom phrase on the left, then trigger "Simulate Pipeline Synthesis" to view token streams and viseme coordinate mappings.
                </p>
              </div>
            )}
          </div>

          {selectedPresetObj && (
            <div className="mt-4 p-3.5 bg-black/40 border border-white/10 rounded-lg text-xs leading-relaxed text-slate-400 space-y-1">
              <span className="text-[9px] font-bold tracking-wider text-slate-500 block">ARCHITECT PARSING REASONING:</span>
              <p>{selectedPresetObj.hinglishReason}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
