import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  Bot,
  User,
  HelpCircle,
  BookOpen,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  X,
  Play,
  ArrowRight
} from 'lucide-react';
import HintPanel from './HintPanel';
import { sendChat, explainWhy } from '../api/tutorApi';

const SUGGESTED_PROMPTS = [
  'Teach me Python loops & give exercises',
  'Explain JavaScript arrays & give exercises',
  'How do functions work in Python?',
  'Explain if-else logic with practice problems'
];

/**
 * Extracts embedded ```exercise ... ``` JSON blocks from AI responses
 */
function parseExercisesFromMessage(text) {
  if (!text) return { cleanText: text, exercises: [] };

  const exercises = [];
  const regex = /```(?:exercise|json)?\s*(\{\s*"title"[\s\S]*?\})\s*```/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.title) {
        exercises.push(parsed);
      }
    } catch (e) {}
  }

  // Remove machine-readable exercise blocks from the markdown text to keep display clean
  const cleanText = text.replace(/```(?:exercise|json)?\s*\{\s*"title"[\s\S]*?\}\s*```/gi, '').trim();
  return { cleanText: cleanText || text, exercises };
}

export default function ChatPanel({
  code,
  language,
  sessionId,
  currentTier,
  hintsHistory,
  onNextHint,
  isLoadingHint,
  reviewResult,
  problemDescription,
  onSelectExercise,
  isCodeModified
}) {
  const [activeTab, setActiveTab] = useState('chat'); // Default to chat so user can ask concept question
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: `👋 **Welcome to your AI Coding Tutor!**

Ask me about any programming concept or language topic (for example: *"Teach me loops in Python"*, *"Explain JavaScript arrays"*, or *"How do conditions work?"*).

I will:
1. 📖 **Explain the theory** and core mental models.
2. 💡 **Suggest beginner-friendly practice exercises**.
3. 🚀 Provide a **"Load Exercise into IDE"** button so you can immediately practice coding in the blank editor!`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [explainWhyData, setExplainWhyData] = useState(null);
  const [isLoadingExplainWhy, setIsLoadingExplainWhy] = useState(false);
  const [loadedExerciseTitle, setLoadedExerciseTitle] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, hintsHistory, reviewResult]);

  // When a review result arrives, switch to hints and post a review summary
  useEffect(() => {
    if (reviewResult) {
      setActiveTab('hints');
    }
  }, [reviewResult]);

  const handleSendMessage = async (customPrompt) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isSending) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    try {
      const response = await sendChat({
        message: textToSend,
        language,
        code,
        sessionId
      });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.reply,
        difficultyLevel: response.difficultyLevel,
        patternContextInjected: response.patternContextInjected,
        optimizedViaLtM: response.optimizedViaLtM,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const isSecurityBlocked = err.response?.data?.securityBlocked;
      const errorMsg = isSecurityBlocked
        ? `🛡️ **Prompt Guardrail Triggered:** ${err.response?.data?.reason || 'Instruction override or injection attempt blocked for safety.'}`
        : `⚠️ **Error communicating with AI Tutor:** ${err.response?.data?.message || err.message}`;

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: errorMsg,
          isSecurityAlert: isSecurityBlocked,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };


  const handleTriggerExplainWhy = async (errorItem) => {
    setIsLoadingExplainWhy(true);
    setExplainWhyData({ loading: true });

    try {
      const targetError = errorItem || reviewResult?.errors?.[0];
      const data = await explainWhy({
        code,
        language,
        errorDescription: targetError?.description || 'Review detected logic issue',
        snippet: targetError?.snippet || '',
        line: targetError?.line,
        sessionId
      });

      setExplainWhyData({
        loading: false,
        explanation: data.explanation,
        difficulty: data.difficulty
      });
    } catch (err) {
      setExplainWhyData({
        loading: false,
        error: err.response?.data?.message || err.message
      });
    } finally {
      setIsLoadingExplainWhy(false);
    }
  };

  const handleLoadExercise = (ex) => {
    setLoadedExerciseTitle(ex.title);
    if (onSelectExercise) {
      onSelectExercise(ex);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] relative">
      {/* Top Panel Tabs */}
      <div className="h-12 border-b border-surface-border px-4 flex items-center justify-between bg-[#0e1422] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-sky-400" />
            <span>Theory & Questions</span>
            <span className="text-[10px] text-slate-500">({messages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('hints')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'hints'
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Progressive Hints</span>
            {currentTier > 0 && (
              <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-bold">
                {currentTier}
              </span>
            )}
          </button>
        </div>

        {/* Explain-Why Quick Button if review has errors */}
        {reviewResult?.errors && reviewResult.errors.length > 0 && (
          <button
            onClick={() => handleTriggerExplainWhy()}
            disabled={isLoadingExplainWhy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Explain Why</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active Problem Objective Card (if an exercise is active) */}
        {problemDescription && (
          <div className="p-3.5 rounded-xl bg-[#111728] border border-brand-500/30 text-xs text-slate-300 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-brand-300 font-semibold uppercase tracking-wider text-[10px]">
                <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                Active Exercise Objective
              </span>
              {loadedExerciseTitle && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono">
                  {loadedExerciseTitle}
                </span>
              )}
            </div>
            <p className="leading-relaxed text-slate-200">{problemDescription}</p>
          </div>
        )}

        {/* Code Review Assessment Banner (if submitted) */}
        {reviewResult && (
          <div
            className={`p-3.5 rounded-xl border transition-all animate-fade-in ${
              reviewResult.passed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-[#181d2f] border-brand-500/30 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-semibold text-xs">
                {reviewResult.passed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Solution Verified Correct!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300">Code Analysis Findings</span>
                  </>
                )}
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                Inferred {reviewResult.difficultyLevel || 'Level'}
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-2 leading-relaxed">{reviewResult.summary}</p>

            {/* Error breakdown badges */}
            {reviewResult.errors && reviewResult.errors.length > 0 && (
              <div className="space-y-1.5 mt-2.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Detected Mistake Classifications (Saved to Mistake Memory):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {reviewResult.errors.map((err, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <span className="font-mono text-[11px] font-semibold">{err.errorType}</span>
                      {err.line && <span className="text-rose-400/70 text-[10px]">(line {err.line})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Progressive Hints */}
        {activeTab === 'hints' && (
          <HintPanel
            currentTier={currentTier}
            hintsHistory={hintsHistory}
            onNextHint={onNextHint}
            isLoadingHint={isLoadingHint}
            patternsInjected={reviewResult?.patternsInjected}
            recurringPatternDetected={reviewResult?.recurringPatternDetected}
            onExplainWhy={() => handleTriggerExplainWhy()}
            latestErrors={reviewResult?.errors}
            isCodeModified={isCodeModified}
          />
        )}

        {/* Tab 2: Theory & Chat Messages */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {messages.map((msg) => {
              const { cleanText, exercises } = parseExercisesFromMessage(msg.text);

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 text-xs leading-relaxed ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-brand-400" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl max-w-[90%] ${
                      msg.sender === 'user'
                        ? 'bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-600/20'
                        : msg.isSecurityAlert
                        ? 'bg-rose-950/40 border border-rose-500/50 text-rose-200 rounded-bl-none shadow-md shadow-rose-950/30'
                        : 'glass-card text-slate-200 rounded-bl-none prose-tutor border border-surface-border'
                    }`}
                  >
                    {msg.optimizedViaLtM && (
                      <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full w-fit">
                        <Sparkles className="w-3 h-3" />
                        <span>Optimized with Least-to-Most Reasoning</span>
                      </div>
                    )}
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (

                      <>
                        <ReactMarkdown>{cleanText}</ReactMarkdown>

                        {/* Interactive Suggested Exercises */}
                        {exercises.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-300">
                              <Sparkles className="w-4 h-4 text-brand-400" />
                              <span>Suggested Beginner Practice Exercises:</span>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {exercises.map((ex, exIdx) => (
                                <div
                                  key={exIdx}
                                  className="p-3 rounded-xl bg-[#0e1424] border border-brand-500/30 hover:border-brand-500/60 transition-all flex flex-col gap-2 group"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-white group-hover:text-brand-300 transition-colors">
                                      {ex.title}
                                    </span>
                                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                                      {ex.language || language}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    {ex.description}
                                  </p>

                                  <div className="flex items-center justify-between pt-1">
                                    <button
                                      onClick={() => handleLoadExercise(ex)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-md shadow-brand-600/20 active:scale-95"
                                    >
                                      <Code2 className="w-3.5 h-3.5" />
                                      <span>Load Exercise into IDE</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic animate-pulse">
                <Bot className="w-4 h-4 text-brand-400 animate-spin" />
                AI Tutor is formulating theory and generating practice exercises...
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Concept Topic Chips */}
      <div className="px-4 py-2 border-t border-surface-border/50 bg-[#0a0e19] flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
        <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Ask:</span>
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => {
              setActiveTab('chat');
              handleSendMessage(prompt);
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 whitespace-nowrap transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Field */}
      <div className="p-3 border-t border-surface-border bg-[#0e1422] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 bg-[#090d16] border border-surface-border rounded-xl px-3 py-2 focus-within:border-brand-500 transition-colors shadow-inner"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask a question about a concept, language theory, or request exercises..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-30 disabled:hover:bg-brand-600 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Explain-Why Modal Dialog */}
      {explainWhyData && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#12192a] border border-brand-500/40 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-surface-border flex items-center justify-between bg-[#151d32]">
              <div className="flex items-center gap-2 text-brand-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Explain-Why: Mental Model Analysis</span>
              </div>
              <button
                onClick={() => setExplainWhyData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-200 prose-tutor">
              {explainWhyData.loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  <span>Synthesizing conceptual mental model...</span>
                </div>
              ) : explainWhyData.error ? (
                <div className="text-rose-400 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {explainWhyData.error}
                </div>
              ) : (
                <ReactMarkdown>{explainWhyData.explanation}</ReactMarkdown>
              )}
            </div>

            <div className="p-3 border-t border-surface-border bg-[#0e1422] flex justify-end">
              <button
                onClick={() => setExplainWhyData(null)}
                className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
              >
                Got It, Back to Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
