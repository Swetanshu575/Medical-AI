/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type STTProvider = 'deepgram' | 'sarvam' | 'azure';
export type TTSProvider = 'elevenlabs' | 'azure' | 'sarvam_tts';
export type LLMModel = 'gemini_flash' | 'gemini_pro' | 'gpt_turbo';
export type VisualEngine = 'unreal_audio2face' | 'heygen_webrtc' | 'rive_web';

export interface PipelineConfig {
  stt: STTProvider;
  tts: TTSProvider;
  llm: LLMModel;
  visual: VisualEngine;
}

export interface LatencyBreakdown {
  stt: number;      // speech to text
  transport1: number; // client -> server
  llmTTFT: number;  // llm time to first token
  ttsTTS: number;   // text to speech processing
  visemeGen: number; // viseme / visual setup
  transport2: number; // server -> client
}

export interface PresetPhrase {
  id: string;
  trigger: string;
  response: string;
  emotion: 'joy' | 'neutral' | 'sadness' | 'anger' | 'surprise';
  hinglishReason: string;
}
