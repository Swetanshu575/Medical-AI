/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, Server, Clock, Users, MessageSquareText } from 'lucide-react';

export default function DatabaseSchemaPanel() {
  const schema = `
-- 1. Users Table
-- Stores user identity and preferences (e.g. preferred Hinglish ratio, default voice).
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    preferred_language VARCHAR(10) DEFAULT 'hinglish',
    last_active_at TIMESTAMP WITH TIME ZONE
);

-- 2. Sessions Table
-- Logs each WebRTC interaction session for analytics and billing.
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    end_reason VARCHAR(50), -- e.g., 'user_disconnected', 'network_error'
    total_duration_seconds INTEGER,
    pipeline_config JSONB -- Stores the exact STT/TTS config used for this session
);

-- 3. Messages Table
-- Stores the exact conversational turns, including raw audio references if recorded.
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'avatar'
    content TEXT NOT NULL,
    emotion_tag VARCHAR(30), -- e.g., 'joy', 'concern', 'neutral' (null for users)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Analytics & Metrics
    stt_latency_ms INTEGER,
    llm_ttft_ms INTEGER,
    tts_latency_ms INTEGER,
    audio_s3_key VARCHAR(255) -- Optional: reference to raw audio storage
);

-- Indexes for performance
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
`;

  return (
    <div className="flex flex-col space-y-6 h-full p-1 scrollbar-thin scrollbar-thumb-slate-800">
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-medium tracking-wide text-white flex items-center space-x-2">
              <Database className="w-4.5 h-4.5 text-emerald-400" />
              <span>Relational Database Schema</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">PostgreSQL schema designed to store conversation history and session metrics.</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" />
            PostgreSQL
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
          <div className="bg-black/40 border border-white/10 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Users className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Users</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Maintains user identity. We use phone numbers as the primary authenticator common in the Indian market.
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-blue-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Sessions</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Captures start/end events for a WebRTC stream. Tracks session-level configurations and billing duration.
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <MessageSquareText className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Messages</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Stores raw text, emotion anchors, and granular latencies (TTFT, STT) to calculate QoS metrics post-session.
            </p>
          </div>
        </div>

        <div className="relative">
          <pre className="text-[11px] sm:text-xs font-mono text-slate-300 bg-[#0a0a0c] border border-white/10 rounded-lg p-4 max-h-[400px] overflow-y-auto whitespace-pre leading-relaxed">
            {schema}
          </pre>
        </div>
      </div>
    </div>
  );
}
