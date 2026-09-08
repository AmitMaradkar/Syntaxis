import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  Sparkles,
  Upload,
  Eraser,
  Terminal,
  FileCode,
  ChevronDown,
  Code2,
  RotateCcw
} from 'lucide-react';

import { executeCode } from '../api/tutorApi';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: '.js', monaco: 'javascript' },
  { id: 'python', name: 'Python', ext: '.py', monaco: 'python' },
  { id: 'java', name: 'Java', ext: '.java', monaco: 'java' },
  { id: 'cpp', name: 'C++', ext: '.cpp', monaco: 'cpp' }
];

export default function MonacoEditorPanel({
  code,
  setCode,
  language,
  setLanguage,
  onGetHelp,
  isReviewing,
  exerciseTitle,
  onClear,
  onNewSession
}) {

  const [localCode, setLocalCode] = useState(code);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [showOutputDrawer, setShowOutputDrawer] = useState(false);
  const fileInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync local code if parent updates from outside (e.g. loaded from suggested exercise)
  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  // Debounce code changes to parent (500ms debounce)
  const handleEditorChange = (value) => {
    const val = value || '';
    setLocalCode(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setCode(val);
    }, 500);
  };

  // Run code via execution sandbox
  const handleRunCode = async () => {
    setIsRunning(true);
    setShowOutputDrawer(true);
    setOutput({ status: 'running', message: 'Executing code...' });

    try {
      const result = await executeCode({
        code: localCode,
        language
      });

      setOutput({
        status: result.stderr ? 'error' : 'success',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code
      });
    } catch (err) {
      setOutput({
        status: 'error',
        stderr: err.response?.data?.stderr || err.message || 'Execution error'
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Switch language
  const handleLanguageSelect = (newLang) => {
    setLanguage(newLang);
  };

  // Clear IDE to blank
  const handleClearEditor = () => {
    setLocalCode('');
    setCode('');
    if (onClear) onClear();
  };

  // File upload auto-detect language
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    let detectedLang = language;
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts')) detectedLang = 'javascript';
    else if (fileName.endsWith('.py')) detectedLang = 'python';
    else if (fileName.endsWith('.java')) detectedLang = 'java';
    else if (fileName.endsWith('.cpp') || fileName.endsWith('.cc') || fileName.endsWith('.cxx')) detectedLang = 'cpp';

    setLanguage(detectedLang);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setLocalCode(content);
        setCode(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#0d121f] border-r border-surface-border relative">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-surface-border px-3.5 flex items-center justify-between bg-[#111726]/80 backdrop-blur-sm gap-2 shrink-0">
        {/* Left: Language Selector & Status */}
        <div className="flex items-center gap-2">
          {/* Language Dropdown */}
          <div className="relative">
            <select
              value={language}
              onChange={(e) => handleLanguageSelect(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-md text-xs font-medium text-slate-200 py-1.5 pl-2.5 pr-7 appearance-none focus:outline-none focus:border-brand-500 cursor-pointer hover:bg-white/10 transition-colors"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id} className="bg-[#111726] text-slate-200">
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>

          {/* Active Exercise Badge or Blank IDE Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-slate-300">
            <Code2 className="w-3.5 h-3.5 text-brand-400" />
            <span className="font-medium max-w-[180px] truncate">
              {exerciseTitle || 'Blank IDE'}
            </span>
          </div>

          {/* New Clean Session */}
          <button
            onClick={onNewSession}
            title="Start fresh blank session (resets previous code and hints)"
            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs border border-white/10"
          >
            <RotateCcw className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden md:inline text-[11px] font-medium">New Session</span>
          </button>

          {/* Clear Editor */}
          <button
            onClick={handleClearEditor}
            title="Clear editor to blank"
            className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 text-xs"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Clear</span>
          </button>


          {/* Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".js,.jsx,.ts,.py,.java,.cpp,.c"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload code file (Auto-detects language)"
            className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors hidden md:flex items-center gap-1 text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[11px]">Upload</span>
          </button>
        </div>

        {/* Right: Actions (Run & Get Help) */}
        <div className="flex items-center gap-2">
          {/* Toggle Terminal Button */}
          <button
            onClick={() => setShowOutputDrawer(!showOutputDrawer)}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              showOutputDrawer
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title="Toggle execution console"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">Console</span>
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>

          {/* Get Help Button (AI Review & Hint Tier 1) */}
          <button
            onClick={onGetHelp}
            disabled={isReviewing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isReviewing ? 'animate-spin' : ''}`} />
            <span>{isReviewing ? 'Analyzing...' : 'Get Help'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={localCode}
          onChange={handleEditorChange}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            lineNumbers: 'on',
            roundedSelection: true,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: 'smooth',
            automaticLayout: true,
            tabSize: 2
          }}
        />
      </div>

      {/* Output Console Drawer */}
      {showOutputDrawer && (
        <div className="h-44 border-t border-surface-border bg-[#080b12] flex flex-col transition-all">
          <div className="h-8 px-3 border-b border-surface-border flex items-center justify-between text-xs text-slate-400 bg-[#0e1320]">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>Sandbox Console ({language})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOutput(null)}
                className="hover:text-slate-200 text-[11px]"
              >
                Clear
              </button>
              <button
                onClick={() => setShowOutputDrawer(false)}
                className="hover:text-slate-200 font-bold px-1"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 font-mono text-xs overflow-auto select-text leading-relaxed">
            {!output && (
              <span className="text-slate-500 italic">
                Press &quot;Run&quot; above to execute your program and inspect stdout/stderr.
              </span>
            )}
            {output?.status === 'running' && (
              <span className="text-amber-400 flex items-center gap-2">
                <span className="animate-spin">⏳</span> Executing your program...
              </span>
            )}
            {output?.stdout && (
              <pre className="text-emerald-300 whitespace-pre-wrap">{output.stdout}</pre>
            )}
            {output?.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap mt-1">{output.stderr}</pre>
            )}
            {output && !output.stdout && !output.stderr && output.status !== 'running' && (
              <span className="text-slate-400 italic">Program finished with no output. (Exit Code: {output.exitCode ?? 0})</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
