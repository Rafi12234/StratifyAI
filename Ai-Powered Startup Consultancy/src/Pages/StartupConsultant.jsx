import React, { useState, useCallback, useMemo } from 'react';
import {
  LayoutGrid,
  TrendingUp,
  DollarSign,
  Target,
  Zap,
  AlertTriangle,
  MessageSquare,
  Save,
  RotateCcw
} from 'lucide-react';

/**
 * SECURITY NOTE:
 * This keeps the constant for parity with your code, but prefer putting your key behind a server (Express proxy)
 * or use environment variables with a backend. Do NOT ship a client with a hard-coded key.
 */
const API_KEY = "AIzaSyBgcz5W6XWehg-0S9BOxtBwoaoCSwW8abk"; // your provided key (consider rotating & moving server-side)
const API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
const MAX_RETRIES = 5;

/* ----------------- Bot Definitions ----------------- */
const bots = [
  {
    id: 'structure',
    name: 'Structure Bot',
    icon: LayoutGrid,
    description: 'legal setup, team roles, and initial operations.',
    keywords: [
      'team','legal','incorporate','roles','setup','compliance','company','co-founder',
      'org','roadmap','operations','structure','hiring','process'
    ],
    systemInstruction:
      "Act as a seasoned operations and organizational development expert. Your goal is to provide a concise, single-paragraph summary on the optimal business structure (e.g., LLC, Inc.), initial team roles, and required operational setup for the user's startup idea. DO NOT discuss marketing, finance, or product definition (MVP).",
  },
  {
    id: 'marketing',
    name: 'Marketing Bot',
    icon: TrendingUp,
    description: 'target audience, acquisition channels, and brand strategy.',
    keywords: [
      'advertise','audience','channel','brand','seo','growth','sales','customers',
      'promotion','social','content','launch','retention','positioning','awareness','campaign'
    ],
    systemInstruction:
      "Act as a leading digital marketing strategist. Your goal is to suggest a concise, single-paragraph initial marketing strategy, including target audience identification and key acquisition channels (e.g., social, content). DO NOT discuss structure, finance, or product definition (MVP).",
  },
  {
    id: 'financial',
    name: 'Financial Bot',
    icon: DollarSign,
    description: 'revenue models, initial costs, and funding avenues.',
    keywords: [
      'cost','budget','revenue','funding','investment','expense','price','monetize',
      'valuation','raise','cac','ltv','runway','forecast','break-even','pricing'
    ],
    systemInstruction:
      "Act as a financial modeling and planning consultant. Your goal is to provide a concise, single-paragraph overview of potential revenue models (e.g., subscription, one-time sale), initial estimated costs, and potential funding avenues (e.g., bootstrapping, seed round). DO NOT discuss structure, marketing, or product definition (MVP).",
  },
  {
    id: 'mvp',
    name: 'MVP Bot',
    icon: Target,
    description: 'Minimal Viable Product and core feature set for validation.',
    keywords: [
      'feature','product','prototype','mock','validation','core','roadmap','user story',
      'spec','version 1','acceptance criteria','experiment','wireframe','pilot'
    ],
    systemInstruction:
      "Act as a Chief Product Officer (CPO). Your goal is to define a concise, single-paragraph Minimal Viable Product (MVP) for the user's idea, including its absolute core feature set and the primary validation metric (how to measure success). DO NOT discuss structure, marketing, or finance.",
  },
];

/* ----------------- Helpers ----------------- */
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const tokenize = (str) => (str || '').toLowerCase().match(/[a-z0-9]+/g) || [];
const unique = (arr) => Array.from(new Set(arr));
const ideaKeywordsFrom = (idea) => unique(tokenize(idea).filter(w => w.length >= 4)).slice(0, 40);
const GLOBAL_TOPIC_KEYWORDS = unique(bots.flatMap(b => b.keywords));

/**
 * Looser, more practical “idea relation”:
 * - Pass if any overlap with idea tokens OR any bot keyword appears
 * - Block only truly random/unrelated questions
 */
const passesIdeaAndTopic = (question, idea) => {
  const qTokens = tokenize(question);
  const iTokens = ideaKeywordsFrom(idea);
  const hasIdeaOverlap = qTokens.some(t => iTokens.includes(t));
  const touchesAnyTopic = qTokens.some(t => GLOBAL_TOPIC_KEYWORDS.includes(t));
  // If user saved a very short/abstract idea, allow topic-only matches
  if (iTokens.length < 3) return touchesAnyTopic || hasIdeaOverlap;
  return hasIdeaOverlap || touchesAnyTopic;
};

/* ----------------- Component ----------------- */
const StartupConsultant = () => {
  const [startupIdea, setStartupIdea] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [selectedBotId, setSelectedBotId] = useState(bots[0].id);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedBot = useMemo(
    () => bots.find(b => b.id === selectedBotId),
    [selectedBotId]
  );

  // Find if message belongs to another bot more strongly
  const checkMisdirection = useCallback((query, currentBot) => {
    if (!currentBot) return null;
    const q = query.toLowerCase();

    const scoreFor = (bot) =>
      bot.keywords.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0);

    const currentScore = scoreFor(currentBot);
    let best = { bot: null, score: currentScore };

    for (const b of bots) {
      const sc = scoreFor(b);
      if (sc > best.score) best = { bot: b, score: sc };
    }

    // If some other bot scores higher → suggest it
    if (best.bot && best.bot.id !== currentBot.id) return best.bot;

    // If currentScore = 0 but any other bot has >0, suggest that
    if (currentScore === 0) {
      for (const b of bots) {
        if (b.id !== currentBot.id) {
          const sc = scoreFor(b);
          if (sc > 0) return b;
        }
      }
    }
    return null;
  }, []);

  // Gemini call with exponential backoff
  const callGeminiApi = useCallback(async (userQuery, systemPrompt) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const payload = {
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 429) {
          if (attempt < MAX_RETRIES - 1) {
            await delay(Math.pow(2, attempt) * 1000);
            continue;
          } else {
            throw new Error("Maximum retry attempts reached for rate limiting.");
          }
        }

        if (!res.ok) {
          throw new Error(`API call failed with status: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();
        const text =
          json?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Sorry, I couldn't generate a meaningful response based on your pitch.";
        return text;
      } catch (e) {
        setError(`An error occurred: ${e.message}`);
        break;
      }
    }
    return null;
  }, []);

  /* ----------------- Submit Handler ----------------- */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!currentInput || !selectedBot) return;

    // PHASE 1: Save idea first
    if (!startupIdea) {
      if (currentInput.trim().length < 20) {
        setError("Please provide a more detailed pitch (at least 20 characters) to start the consultation.");
        return;
      }
      setStartupIdea(currentInput.trim());
      setChatHistory([{
        sender: 'system',
        text: `🚀 Idea Saved! Your startup pitch: **"${currentInput.trim()}"**. Now, select a bot below and ask a specific question about your idea's structure, marketing, finance, or MVP!`,
        botName: 'System',
        botId: 'system',
      }]);
      setCurrentInput('');
      setError(null);
      return;
    }

    // PHASE 2: Ask a bot
    setLoading(true);
    setError(null);

    const userMessage = {
      sender: 'user',
      text: currentInput,
      botName: selectedBot.name,
      botId: selectedBot.id,
    };
    setChatHistory(prev => [...prev, userMessage]);

    // 1) Block truly unrelated questions (no relation to idea, no topic tokens)
    if (!passesIdeaAndTopic(currentInput, startupIdea)) {
      const msg =
        `⚠️ **Out of scope for this app:** Please ask something related to your saved startup idea and the domains **Structure**, **Marketing**, **Finance**, or **MVP**.`;
      setChatHistory(prev => [...prev, {
        sender: 'bot',
        botId: 'system',
        botName: 'System',
        text: msg
      }]);
      setLoading(false);
      setCurrentInput('');
      return;
    }

    // 2) Enforce bot specialization (misdirection → refuse + suggest)
    const redirect = checkMisdirection(currentInput, selectedBot);
    if (redirect) {
      const pickedDesc = selectedBot.description.split(', ')[0];
      const targetDesc = redirect.description.split(', ')[0];

      const msg =
        `⚠️ **Misdirected Query:** I am the **${selectedBot.name}**, specializing in ${pickedDesc}.\n\n` +
        `This question aligns better with **${redirect.name}** (${targetDesc}).\n` +
        `Please switch to **${redirect.name}** for the most relevant guidance.`;
      setChatHistory(prev => [...prev, {
        sender: 'bot',
        botId: selectedBot.id,
        botName: selectedBot.name,
        text: msg
      }]);
      setLoading(false);
      setCurrentInput('');
      return; // Do not answer out-of-scope
    }

    // 3) On-topic → ask Gemini with a scoped instruction
    const fullQuery =
      `Startup idea: "${startupIdea}". ` +
      `Only answer within your specialty and keep it concise. ` +
      `User question: "${currentInput}".`;
    const botText = await callGeminiApi(fullQuery, selectedBot.systemInstruction);

    if (botText) {
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: botText,
          botName: selectedBot.name,
          botId: selectedBot.id,
        }
      ]);
    }

    setLoading(false);
    setCurrentInput('');
  }, [currentInput, selectedBot, startupIdea, callGeminiApi, checkMisdirection]);

  /* ----------------- UI Helpers ----------------- */
  const resetConsultation = () => {
    setStartupIdea('');
    setCurrentInput('');
    setChatHistory([]);
    setError(null);
  };

  const ChatMessage = ({ message }) => {
    const isUser = message.sender === 'user';
    const isSystem = message.botId === 'system';
    const Icon = isUser
      ? MessageSquare
      : isSystem
        ? Zap
        : (bots.find(b => b.id === message.botId)?.icon || Zap);

    let containerClass = 'chat-message-container';
    let iconClass = 'chat-icon-default';
    let textClass = 'chat-text-default';

    if (isSystem) {
      containerClass += ' chat-message-system';
      iconClass = 'chat-icon-system chat-icon-wrapper';
      textClass = 'chat-text-system';
    } else if (isUser) {
      containerClass += ' chat-message-user';
      iconClass = 'chat-icon-user chat-icon-wrapper';
      textClass = 'chat-text-user';
    } else {
      containerClass += ' chat-message-bot';
      iconClass = 'chat-icon-bot chat-icon-wrapper';
      textClass = 'chat-text-bot';
    }

    const renderText = (text) => {
      const parts = text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (typeof part === 'string' && part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="chat-bold-text">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < parts.length - 1 && typeof part === 'string' && part.endsWith('\n') && <br />}
        </React.Fragment>
      ));
    };

    return (
      <div className={containerClass}>
        <div className={iconClass}>
          <Icon className="icon-small" />
        </div>
        <div className={`chat-content ${textClass}`}>
          <div className="chat-header">
            {isUser ? `You asked the ${message.botName}:` : `${message.botName} Message:`}
          </div>
          <p className="chat-body">
            {renderText(message.text)}
          </p>
        </div>
      </div>
    );
  };

  /* ----------------- Render ----------------- */
  return (
    <div className="app-container">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {/* Inline styles kept from your version */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');

        .app-container { min-height: 100vh; background-color: #f9fafb; padding: 1rem; font-family: 'Inter', sans-serif; }
        @media (min-width: 640px) { .app-container { padding: 2rem; } }

        .app-header { text-align: center; margin-bottom: 2rem; }
        .header-title { font-size: 2.25rem; font-weight: 800; color: #111827; display: flex; align-items: center; justify-content: center; }
        .header-icon { width: 2rem; height: 2rem; color: #4f46e5; margin-right: 0.5rem; }
        .header-subtitle { color: #6b7280; margin-top: 0.5rem; font-size: 1.125rem; }

        .main-content-wrapper { max-width: 56rem; margin: 0 auto; }

        .idea-display { padding: 1rem; margin-bottom: 1.5rem; background-color: #eef2ff; border-left: 4px solid #6366f1;
          border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }
        .idea-text { color: #3730a3; font-weight: 500; }
        .idea-reset-button { font-size: 0.875rem; color: #4f46e5; font-weight: 600; display: flex; align-items: center; padding: 0.5rem;
          border-radius: 9999px; transition: background-color .2s, color .2s; }
        .idea-reset-button:hover { color: #3730a3; background-color: #e0e7ff; }
        .idea-reset-button svg { width: 1rem; height: 1rem; margin-right: 0.25rem; }

        .input-card { background-color: #fff; padding: 1.5rem; border-radius: .75rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1),
          0 8px 10px -6px rgba(0,0,0,0.1); margin-bottom: 2rem; border: 1px solid #f3f4f6; }
        .card-header { font-size: 1.25rem; font-weight: 700; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: .75rem; margin-bottom: 1rem; }

        .input-form-area { margin-top: 1rem; }
        .input-textarea { width: 100%; padding: .75rem; border: 1px solid #d1d5db; border-radius: .5rem; transition: all .15s;
          resize: vertical; height: 8rem; color: #374151; }
        .input-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241, .5); }

        .submit-button { width: 100%; background-color: #4f46e5; color: #fff; padding: .75rem 0; border-radius: .5rem; font-weight: 600;
          transition: background-color .2s; display: flex; align-items: center; justify-content: center; margin-top: .75rem; }
        .submit-button:hover:not(:disabled) { background-color: #4338ca; }
        .submit-button:disabled { background-color: #818cf8; cursor: not-allowed; }
        .submit-button svg { width: 1.25rem; height: 1.25rem; margin-right: .5rem; }

        .bot-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (min-width: 768px) { .bot-grid { grid-template-columns: repeat(4, 1fr); } }

        .bot-card { padding: .75rem; border-radius: .75rem; text-align: center; transition: all .2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1);
          transform: scale(1); border: 1px solid #fff; background: #fff; color: #374151; }
        .bot-card:hover:not(.bot-card-selected) { transform: scale(1.02); background: #eef2ff; color: #4f46e5; }
        .bot-card-selected { background: #4f46e5; color: #fff; border: 4px solid #a5b4fc; transform: scale(1.02); }
        .bot-card-icon { width: 1.5rem; height: 1.5rem; margin: 0 auto .25rem; }
        .bot-card-name { font-weight: 600; font-size: .875rem; display: block; line-height: 1.25; }

        .phase2-header { display: flex; align-items: center; padding-bottom: .75rem; margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; }
        .phase2-icon-wrapper { width: 2.5rem; height: 2.5rem; border-radius: 9999px; background: #eef2ff; color: #4f46e5;
          display: flex; align-items: center; justify-content: center; margin-right: .75rem; }
        .phase2-icon-wrapper svg { width: 1.5rem; height: 1.5rem; }
        .phase2-title { font-size: 1.25rem; font-weight: 700; color: #1f2937; }
        .phase2-desc { font-size: .875rem; color: #6b7280; margin-bottom: 1rem; }

        .error-box { padding: 1rem; margin-bottom: 1rem; background: #fee2e2; border-left: 4px solid #ef4444; color: #b91c1c;
          border-radius: .5rem; display: flex; align-items: center; gap: .5rem; }
        .error-box svg { width: 1.25rem; height: 1.25rem; }
        .error-box p { font-weight: 500; }

        .log-section { margin-top: 1.5rem; }
        .log-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: .5rem; margin-bottom: 1rem; }
        .log-empty { padding: 2rem; text-align: center; background: #fff; border-radius: .75rem; box-shadow: inset 0 2px 4px rgba(0,0,0,.06);
          color: #6b7280; }

        .chat-message-container { padding: 1rem; border-radius: .75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1);
          margin-bottom: 1rem; display: flex; gap: 1rem; transition: all .3s; max-width: 90%; border: 1px solid; }
        .chat-message-user { background: #eef2ff; border-color: #c7d2fe; margin-left: auto; }
        .chat-message-bot { background: #fff; border-color: #e5e7eb; margin-right: auto; }
        .chat-message-system { background: #f0fdf4; border-color: #bbf7d0; margin-right: auto; }

        .chat-icon-wrapper { flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 9999px; display: flex; align-items: center;
          justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); }
        .chat-icon-user { background: #6366f1; color: #fff; }
        .chat-icon-bot { background: #374151; color: #fff; }
        .chat-icon-system { background: #16a34a; color: #fff; }
        .icon-small { width: 1.25rem; height: 1.25rem; }

        .chat-content { flex-grow: 1; }
        .chat-header { font-weight: 600; margin-bottom: .25rem; }
        .chat-body { white-space: pre-wrap; font-size: .875rem; line-height: 1.5; }
        .chat-bold-text { font-weight: 700; }

        .chat-text-user { color: #3730a3; }
        .chat-text-bot { color: #1f2937; }
        .chat-text-system { color: #15803d; }

        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <header className="app-header">
        <h1 className="header-title">
          <Zap className="header-icon" />
          AI Startup Consultant
        </h1>
        <p className="header-subtitle">
          Your two-phase journey: Pitch your idea first, then consult the experts.
        </p>
      </header>

      <div className="main-content-wrapper">
        {startupIdea && (
          <div className="idea-display">
            <p className="idea-text">
              <span className="chat-bold-text">Idea:</span> {startupIdea}
            </p>
            <button onClick={resetConsultation} className="idea-reset-button" title="Reset Idea and Start New Consultation">
              <RotateCcw /> Reset Idea
            </button>
          </div>
        )}

        <div className="input-card">
          {!startupIdea && (
            <>
              <h2 className="card-header">Phase 1: Define Your Startup Idea</h2>
              <form onSubmit={handleSubmit} className="input-form-area">
                <textarea
                  className="input-textarea"
                  placeholder="Describe your entire startup idea fully (e.g., 'A mobile app that uses computer vision to identify plants and recommend care tips to amateur gardeners')."
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  required
                />
                <button type="submit" className="submit-button">
                  <Save className="icon-small" />
                  Save Idea and Start Consultation
                </button>
              </form>
            </>
          )}

          {startupIdea && (
            <>
              <div className="bot-grid">
                {bots.map((bot) => {
                  const isSelected = bot.id === selectedBotId;
                  const Icon = bot.icon;
                  return (
                    <button
                      key={bot.id}
                      onClick={() => setSelectedBotId(bot.id)}
                      className={`bot-card ${isSelected ? 'bot-card-selected' : ''}`}
                      title={bot.description}
                    >
                      <Icon className="bot-card-icon" />
                      <span className="bot-card-name">{bot.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="phase2-header">
                <div className="phase2-icon-wrapper">
                  {selectedBot && <selectedBot.icon className="icon-small" />}
                </div>
                <h2 className="phase2-title">Ask the {selectedBot?.name}</h2>
              </div>

              <p className="phase2-desc">
                The {selectedBot?.name} specializes in **{selectedBot?.description}**
              </p>

              <form onSubmit={handleSubmit} className="input-form-area">
                <textarea
                  className="input-textarea"
                  style={{ height: '6rem' }}
                  placeholder={`Ask a specific question related to ${selectedBot?.name}'s expertise, such as "What team roles should I prioritize?" or "How can I price this?"`}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  disabled={loading}
                  required
                />
                <button type="submit" className="submit-button" disabled={loading || !currentInput}>
                  {loading ? (
                    <>
                      <svg className="spinner icon-small" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Consulting...
                    </>
                  ) : (
                    <>
                      <Zap className="icon-small" />
                      Get Advice
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {error && (
          <div className="error-box">
            <AlertTriangle className="icon-small" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="log-section">
          <h2 className="log-title">Conversation Log</h2>
          {chatHistory.length === 0 ? (
            <div className="log-empty">
              Start by defining your startup idea above to unlock the expert bots.
            </div>
          ) : (
            [...chatHistory].reverse().map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StartupConsultant;
