/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import TechStackSelector from './TechStackSelector';
import ArchitectureDiagram from './ArchitectureDiagram';
import PromptEngineeringPanel from './PromptEngineeringPanel';
import CodeScaffoldPanel from './CodeScaffoldPanel';
import PipelineVisualizer from './PipelineVisualizer';
import DatabaseSchemaPanel from './DatabaseSchemaPanel';
import { PipelineConfig } from '../types';
import { Layers, Network, Terminal, Wand2, Database, Activity } from 'lucide-react';

export function ArchitectWorkspace() {
  const [config, setConfig] = useState<PipelineConfig>({
    stt: 'deepgram',
    tts: 'elevenlabs',
    llm: 'gemini_flash',
    visual: 'rive_web'
  });

  const [activeTab, setActiveTab] = useState<'tech' | 'diagram' | 'prompt' | 'code' | 'pipeline' | 'db'>('tech');

  const tabs = [
    { id: 'tech', label: 'Tech Stack', icon: Layers },
    { id: 'diagram', label: 'Architecture', icon: Network },
    { id: 'prompt', label: 'Prompts', icon: Wand2 },
    { id: 'code', label: 'Code Scaffold', icon: Terminal },
    { id: 'pipeline', label: 'Visualizer', icon: Activity },
    { id: 'db', label: 'Database', icon: Database },
  ] as const;

  return (
    <div className="flex w-full max-w-6xl h-[80vh] border border-white/10 rounded-2xl overflow-hidden bg-[#0a0a0c]/80 backdrop-blur-xl shadow-2xl">
      
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0 bg-black/40 border-r border-white/10 p-4 flex flex-col space-y-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Architect Views</div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-3 w-full px-3 py-3 rounded-lg transition-all text-sm font-medium ${
              activeTab === tab.id
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
          {activeTab === 'tech' && <TechStackSelector config={config} onChange={setConfig} />}
          {activeTab === 'diagram' && <ArchitectureDiagram />}
          {activeTab === 'prompt' && <PromptEngineeringPanel />}
          {activeTab === 'code' && <CodeScaffoldPanel />}
          {activeTab === 'pipeline' && <PipelineVisualizer config={config} />}
          {activeTab === 'db' && <DatabaseSchemaPanel />}
        </div>
      </div>
    </div>
  );
}
