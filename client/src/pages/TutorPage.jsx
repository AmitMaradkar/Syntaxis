import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Navbar from '../components/Navbar';
import MonacoEditorPanel from '../components/MonacoEditorPanel';
import ChatPanel from '../components/ChatPanel';
import {
  fetchActiveSession,
  createNewSession,
  submitCodeReview,
  getNextHint,
  markSessionSolved
} from '../api/tutorApi';

import { useAuth } from '../context/AuthContext';

const BLANK_STARTER = `// 💡 Blank IDE
// Ask your AI Tutor on the right for theory, explanations, or suggested beginner exercises!
`;export default function TutorPage() {
  const { user, updateUserDifficulty } = useAuth();

  const [code, setCode] = useState(BLANK_STARTER);
  const [language, setLanguage] = useState('javascript');
  const [exerciseTitle, setExerciseTitle] = useState(null);
  const [problemDescription, setProblemDescription] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [currentTier, setCurrentTier] = useState(0);
  const [hintsHistory, setHintsHistory] = useState([]);
  const [lastAnalyzedCode, setLastAnalyzedCode] = useState('');
  const [reviewResult, setReviewResult] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState(user?.currentDifficulty || 'beginner');

  // Fetch or initialize session on mount
  useEffect(() => {
    async function initSession() {
      try {
        const session = await fetchActiveSession();
        if (session) {
          setSessionId(session._id);
          if (session.code && !session.code.includes('twoSum')) {
            setCode(session.code);
            setLastAnalyzedCode(session.code);
            if (session.hintTier) setCurrentTier(session.hintTier);
            if (session.hintsHistory && session.hintsHistory.length > 0) {
              setHintsHistory(session.hintsHistory);
            }
          } else {
            // Clean slate for blank workspace without carrying over TwoSum hints
            setCurrentTier(0);
            setHintsHistory([]);
            setLastAnalyzedCode('');
          }
          if (session.language) setLanguage(session.language);
          if (session.title && session.title !== 'Two Sum Problem' && session.title !== 'Blank Coding Workspace') {
            setExerciseTitle(session.title);
          }
          if (session.problemDescription && !session.problemDescription.includes('Two Sum')) {
            setProblemDescription(session.problemDescription);
          }
        }
      } catch (err) {
        console.warn('Operating in guest session mode.');
      }
    }
    initSession();
  }, []);

  // When student clicks "Load Exercise into IDE" from suggested exercises in chat
  const handleSelectExercise = (exercise) => {
    if (exercise.starterCode) {
      setCode(exercise.starterCode);
    }
    if (exercise.language) {
      setLanguage(exercise.language);
    }
    if (exercise.title) {
      setExerciseTitle(exercise.title);
    }
    if (exercise.description) {
      setProblemDescription(exercise.description);
    }
    // Reset attempt states for fresh exercise
    setCurrentTier(0);
    setHintsHistory([]);
    setLastAnalyzedCode('');
    setReviewResult(null);
  };

  // Language change handler with fresh clean template
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const blankTemplates = {
      javascript: '// 💡 Blank JavaScript Workspace\n// Ask your AI Tutor in chat to explain concepts and suggest practice problems!\n',
      python: '# 💡 Blank Python Workspace\n# Ask your AI Tutor in chat to explain concepts and suggest practice problems!\n',
      java: '// 💡 Blank Java Workspace\n// Ask your AI Tutor in chat to explain concepts and suggest practice problems!\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n',
      cpp: '// 💡 Blank C++ Workspace\n// Ask your AI Tutor in chat to explain concepts and suggest practice problems!\n#include <iostream>\n\nint main() {\n    \n    return 0;\n}\n'
    };
    setCode(blankTemplates[newLang.toLowerCase()] || blankTemplates.javascript);
    setExerciseTitle(null);
    setProblemDescription('');
    setCurrentTier(0);
    setHintsHistory([]);
    setLastAnalyzedCode('');
    setReviewResult(null);
  };

  // Explicit New Session button handler: creates fresh session in DB and cleans editor
  const handleNewSession = async () => {
    try {
      const freshSession = await createNewSession(language);
      if (freshSession) {
        setSessionId(freshSession._id);
        setCode(freshSession.code || '');
        setExerciseTitle(null);
        setProblemDescription('');
        setCurrentTier(0);
        setHintsHistory([]);
        setLastAnalyzedCode('');
        setReviewResult(null);
      }
    } catch (e) {
      handleLanguageChange(language);
    }
  };

  // Clear IDE to blank
  const handleClear = () => {
    setCode('');
    setExerciseTitle(null);
    setProblemDescription('');
    setCurrentTier(0);
    setHintsHistory([]);
    setLastAnalyzedCode('');
    setReviewResult(null);
  };

  // Handle "Get Help" submission
  const handleGetHelp = async () => {
    setIsReviewing(true);
    try {
      const data = await submitCodeReview({
        code,
        language,
        problemDescription: problemDescription || 'Interactive Coding Exercise',
        sessionId,
        title: exerciseTitle || 'Coding Exercise'
      });

      if (data.sessionId) setSessionId(data.sessionId);
      setReviewResult(data);
      setLastAnalyzedCode(code);

      if (data.difficultyLevel) {
        setCurrentDifficulty(data.difficultyLevel);
        updateUserDifficulty(data.difficultyLevel);
      }

      // Add Tier 1 hint specifically tailored to this new code submission
      if (data.tier1Hint) {
        setCurrentTier(1);
        setHintsHistory([
          {
            tier: 1,
            content: data.tier1Hint,
            timestamp: new Date()
          }
        ]);
      } else if (data.hintsHistory && data.hintsHistory.length > 0) {
        setCurrentTier(1);
        setHintsHistory(data.hintsHistory);
      }

      // If passed, celebrate and mark solved
      if (data.passed) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        if (data.sessionId) {
          await markSessionSolved(data.sessionId);
        }
      }
    } catch (err) {
      console.error('Error submitting code for review:', err);
    } finally {
      setIsReviewing(false);
    }
  };

  // Handle Hint Escalation (Next Hint)
  const handleNextHint = async () => {
    if (isLoadingHint) return;

    const isCodeChanged = Boolean(lastAnalyzedCode && code.trim() !== lastAnalyzedCode.trim());
    // If at max tier and code has not changed, don't re-fetch
    if (currentTier >= 3 && !isCodeChanged) return;

    setIsLoadingHint(true);
    try {
      let targetSessionId = sessionId;

      if (!targetSessionId) {
        const reviewData = await submitCodeReview({
          code,
          language,
          problemDescription: problemDescription || 'Independent Exercise',
          title: exerciseTitle || 'Problem Attempt'
        });
        targetSessionId = reviewData.sessionId;
        setSessionId(targetSessionId);
        setReviewResult(reviewData);
        setLastAnalyzedCode(code);

        if (reviewData.tier1Hint) {
          setCurrentTier(1);
          setHintsHistory([
            {
              tier: 1,
              content: reviewData.tier1Hint,
              timestamp: new Date()
            }
          ]);
          setIsLoadingHint(false);
          return;
        }
      }

      // Send the student's current code so the hint is directly grounded in it
      const hintData = await getNextHint({
        sessionId: targetSessionId,
        code,
        language,
        problemDescription: problemDescription || exerciseTitle || 'Interactive Coding Practice'
      });

      setLastAnalyzedCode(code);
      setCurrentTier(hintData.tier);
      if (hintData.difficultyLevel) {
        setCurrentDifficulty(hintData.difficultyLevel);
        updateUserDifficulty(hintData.difficultyLevel);
      }

      if (hintData.hintsHistory && hintData.hintsHistory.length > 0) {
        setHintsHistory(hintData.hintsHistory);
      } else {
        setHintsHistory((prev) => [
          ...prev.filter((h) => h.tier !== hintData.tier),
          {
            tier: hintData.tier,
            content: hintData.hint,
            timestamp: new Date()
          }
        ]);
      }
    } catch (err) {
      console.error('Error fetching next hint:', err);
    } finally {
      setIsLoadingHint(false);
    }
  };

  const isCodeModified = Boolean(lastAnalyzedCode && code.trim() !== lastAnalyzedCode.trim());

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0d14]">
      {/* Top Navigation */}
      <Navbar currentDifficulty={currentDifficulty} />

      {/* Main Workspace: Resizable 2-Panel Split */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side: Monaco Code Editor Panel */}
        <section className="w-full md:w-3/5 h-1/2 md:h-full overflow-hidden flex flex-col">
          <MonacoEditorPanel
            code={code}
            setCode={setCode}
            language={language}
            setLanguage={handleLanguageChange}
            onGetHelp={handleGetHelp}
            isReviewing={isReviewing}
            exerciseTitle={exerciseTitle}
            onClear={handleClear}
            onNewSession={handleNewSession}
          />
        </section>

        {/* Right Side: Chat & Progressive Hint Panel */}
        <section className="w-full md:w-2/5 h-1/2 md:h-full overflow-hidden flex flex-col border-t md:border-t-0 md:border-l border-surface-border">
          <ChatPanel
            code={code}
            language={language}
            sessionId={sessionId}
            currentTier={currentTier}
            hintsHistory={hintsHistory}
            onNextHint={handleNextHint}
            isLoadingHint={isLoadingHint}
            reviewResult={reviewResult}
            problemDescription={problemDescription}
            onSelectExercise={handleSelectExercise}
            isCodeModified={isCodeModified}
          />
        </section>
      </main>
    </div>
  );
}
