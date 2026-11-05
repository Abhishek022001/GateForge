import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Send,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { api, IAskResponse, IRetrievedQuestionRef, ITutorHealth } from '../services/api';

declare const katex: any;

interface ChatMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: string;
  isGrounded?: boolean;
  references?: IRetrievedQuestionRef[];
  latencyMs?: number;
  modelUsed?: string;
  error?: boolean;
  queryToRetry?: string;
}

const SUGGESTIONS = [
  { topic: 'Algorithms', q: 'What is the minimum number of nodes in an AVL tree of height h?' },
  { topic: 'COA', q: 'Explain pipeline data hazards and operand forwarding in COA.' },
  { topic: 'Data Structures', q: 'What is the time complexity of Dijkstra algorithm using a Min-Heap?' },
  { topic: 'Operating Systems', q: 'Explain Belady anomaly in FIFO page replacement with an example.' },
  { topic: 'Compiler Design', q: 'Difference between LL(1) and LR(0) parsers in Compiler Design.' },
];

export const AITutorPage: React.FC<{ onBackToHome?: () => void }> = ({ onBackToHome }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<ITutorHealth | null>(null);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Load health & subjects on mount
  useEffect(() => {
    let mounted = true;
    const loadMetadata = async () => {
      try {
        const [h, s] = await Promise.all([
          api.getTutorHealth().catch(() => null),
          api.getTutorSubjects().catch(() => []),
        ]);
        if (mounted) {
          if (h) setHealth(h);
          if (s && s.length > 0) setSubjects(s);
        }
      } catch (_) {}
    };
    loadMetadata();
    return () => {
      mounted = false;
    };
  }, []);

  // Scroll to bottom on messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const resp: IAskResponse = await api.askTutor(
        q,
        selectedSubject === 'All Subjects' ? undefined : selectedSubject,
        3
      );

      const tutorMsg: ChatMessage = {
        id: 'tut-' + Date.now(),
        sender: 'tutor',
        text: resp.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isGrounded: resp.is_grounded,
        references: resp.retrieved_references,
        latencyMs: resp.latency_ms,
        modelUsed: resp.model_used,
      };

      setMessages((prev) => [...prev, tutorMsg]);
    } catch (err: any) {
      const errorText =
        typeof err === 'string'
          ? err
          : typeof err?.message === 'string'
          ? err.message
          : typeof err?.error === 'string'
          ? err.error
          : typeof err?.error?.message === 'string'
          ? err.error.message
          : typeof err?.detail === 'string'
          ? err.detail
          : (err && typeof err === 'object')
          ? JSON.stringify(err)
          : 'Failed to retrieve answer from AI Tutor. Please wait a moment and try again.';
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'tutor',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
        queryToRetry: q,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Comprehensive Markdown & KaTeX Mathematical Formula Formatter
  const renderFormattedText = (rawText: string) => {
    if (!rawText) return null;

    let text = rawText;
    // Normalize \[ ... \] to $$ ... $$ and \( ... \) to $ ... $
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, c) => '\n\n$$\n' + c.trim() + '\n$$\n\n');
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, c) => ' $' + c.trim() + '$ ');
    text = text.replace(/\\\[[^\]]*$/, '');
    text = text.replace(/\\\([^\)]*$/, '');

    const blockTokens: Array<{ type: 'code' | 'display_math'; code?: string; lang?: string; math?: string }> = [];

    // 1. Code blocks: ```lang ... ```
    text = text.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = blockTokens.length;
      blockTokens.push({ type: 'code', lang: lang || 'text', code: code.trim() });
      return `\n\n__BLOCK_PLACEHOLDER_${idx}__\n\n`;
    });

    // 2. Display math blocks: $$ ... $$
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      const idx = blockTokens.length;
      blockTokens.push({ type: 'display_math', math: math.trim() });
      return `\n\n__BLOCK_PLACEHOLDER_${idx}__\n\n`;
    });

    // Inline formatter (handles $...$, `code`, **bold**, *italics*)
    const renderInline = (lineText: string, keyPrefix: string): React.ReactNode => {
      if (!lineText) return null;

      const inlineMathParts = lineText.split(/(\$[^\$\n]+?\$)/g);
      return inlineMathParts.map((part, pIdx) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const mathContent = part.slice(1, -1).trim();
          try {
            if (typeof katex !== 'undefined' && katex.renderToString) {
              const html = katex.renderToString(mathContent, {
                displayMode: false,
                throwOnError: false,
                output: 'htmlAndMathml',
              });
              return (
                <span
                  key={`${keyPrefix}-m-${pIdx}`}
                  className="px-1 text-indigo-300 font-mono text-sm inline-block"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            }
          } catch (_) {}
          return (
            <code key={`${keyPrefix}-rawm-${pIdx}`} className="text-violet-300 font-mono text-xs px-1">
              {part}
            </code>
          );
        }

        // Inline Code `...`
        const codeParts = part.split(/(`[^`\n]+?`)/g);
        return codeParts.map((cPart, cIdx) => {
          if (cPart.startsWith('`') && cPart.endsWith('`') && cPart.length > 2) {
            return (
              <code
                key={`${keyPrefix}-c-${pIdx}-${cIdx}`}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-violet-300 font-mono text-xs border border-slate-700/60"
              >
                {cPart.slice(1, -1)}
              </code>
            );
          }

          // Bold **...**
          const boldParts = cPart.split(/(\*\*[^\*\n]+?\*\*)/g);
          return boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
              return (
                <strong key={`${keyPrefix}-b-${pIdx}-${cIdx}-${bIdx}`} className="font-bold text-white">
                  {bPart.slice(2, -2)}
                </strong>
              );
            }

            // Italics *...*
            const itParts = bPart.split(/(\*[^\*\n]+?\*)/g);
            return itParts.map((itPart, itIdx) => {
              if (itPart.startsWith('*') && itPart.endsWith('*') && itPart.length > 2) {
                return (
                  <em key={`${keyPrefix}-it-${itIdx}`} className="text-slate-300 italic">
                    {itPart.slice(1, -1)}
                  </em>
                );
              }
              return itPart;
            });
          });
        });
      });
    };

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
    let blockquoteLines: string[] = [];
    let tableLines: string[] = [];

    const flushBq = () => {
      if (blockquoteLines.length > 0) {
        const bqKey = `bq-${elements.length}`;
        elements.push(
          <blockquote
            key={bqKey}
            className="border-l-4 border-violet-500 bg-violet-950/20 pl-3.5 py-2.5 my-3 rounded-r-xl text-slate-300 text-xs italic space-y-1"
          >
            {blockquoteLines.map((bLine, bIdx) => (
              <div key={`${bqKey}-${bIdx}`}>{renderInline(bLine, `${bqKey}-${bIdx}`)}</div>
            ))}
          </blockquote>
        );
        blockquoteLines = [];
      }
    };

    const flushTbl = () => {
      if (tableLines.length > 0) {
        const tKey = `tbl-${elements.length}`;
        const parseRow = (line: string) => {
          return line
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());
        };

        const rows = tableLines.map(parseRow);
        const isSep = (r: string[]) => r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));

        let header: string[] | null = null;
        let bodyRows: string[][] = [];

        if (rows.length >= 2 && isSep(rows[1])) {
          header = rows[0];
          bodyRows = rows.slice(2);
        } else {
          bodyRows = rows;
        }

        elements.push(
          <div key={tKey} className="overflow-x-auto my-3 rounded-lg border border-slate-800 bg-slate-950/70 shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              {header && (
                <thead className="bg-slate-900 border-b border-slate-800 text-indigo-300 font-semibold">
                  <tr>
                    {header.map((col, cIdx) => (
                      <th key={`${tKey}-h-${cIdx}`} className="py-2 px-3 border-r border-slate-800/60 last:border-r-0">
                        {renderInline(col, `${tKey}-th-${cIdx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-slate-800/50">
                {bodyRows.map((r, rIdx) => (
                  <tr key={`${tKey}-r-${rIdx}`} className="hover:bg-slate-900/30 transition-colors">
                    {r.map((cell, cIdx) => (
                      <td key={`${tKey}-c-${rIdx}-${cIdx}`} className="py-2 px-3 border-r border-slate-800/40 last:border-r-0 text-slate-200">
                        {renderInline(cell, `${tKey}-td-${rIdx}-${cIdx}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableLines = [];
      }
    };

    const flushLst = () => {
      if (currentList) {
        const lKey = `lst-${elements.length}`;
        if (currentList.type === 'ol') {
          elements.push(
            <ol key={lKey} className="space-y-1.5 my-3 pl-5 list-decimal text-slate-200 text-xs sm:text-sm">
              {currentList.items.map((it, itIdx) => (
                <li key={`${lKey}-${itIdx}`}>{renderInline(it, `${lKey}-${itIdx}`)}</li>
              ))}
            </ol>
          );
        } else {
          elements.push(
            <ul key={lKey} className="space-y-1.5 my-3 pl-5 list-disc text-slate-200 text-xs sm:text-sm">
              {currentList.items.map((it, itIdx) => (
                <li key={`${lKey}-${itIdx}`}>{renderInline(it, `${lKey}-${itIdx}`)}</li>
              ))}
            </ul>
          );
        }
        currentList = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      // Check for table rows (| col1 | col2 |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushBq();
        flushLst();
        tableLines.push(trimmed);
        continue;
      } else {
        flushTbl();
      }

      const bMatch = trimmed.match(/^__BLOCK_PLACEHOLDER_(\d+)__$/);
      if (bMatch) {
        flushBq();
        flushLst();
        flushTbl();
        const bIdx = parseInt(bMatch[1], 10);
        const block = blockTokens[bIdx];

        if (block.type === 'display_math' && block.math) {
          let mathHtml = '';
          try {
            if (typeof katex !== 'undefined' && katex.renderToString) {
              mathHtml = katex.renderToString(block.math, {
                displayMode: true,
                throwOnError: false,
                output: 'htmlAndMathml',
              });
            }
          } catch (_) {}

          elements.push(
            <div
              key={`math-disp-${i}`}
              className="my-4 py-3 px-4 bg-slate-950/80 rounded-xl border border-slate-800 text-center overflow-x-auto shadow-inner"
            >
              {mathHtml ? (
                <div dangerouslySetInnerHTML={{ __html: mathHtml }} />
              ) : (
                <pre className="font-mono text-xs text-indigo-300">{block.math}</pre>
              )}
            </div>
          );
        } else if (block.type === 'code' && block.code) {
          elements.push(
            <div key={`code-blk-${i}`} className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              {block.lang && block.lang !== 'text' && (
                <div className="px-3 py-1 bg-slate-900 border-b border-slate-800/80 text-[10px] font-mono uppercase text-slate-400">
                  {block.lang}
                </div>
              )}
              <pre className="p-3.5 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }
        continue;
      }

      if (trimmed.startsWith('>')) {
        flushLst();
        blockquoteLines.push(trimmed.replace(/^>\s?/, ''));
        continue;
      } else {
        flushBq();
      }

      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        flushLst();
        elements.push(<hr key={`hr-${i}`} className="my-4 border-slate-800" />);
        continue;
      }

      if (/^####\s+/.test(trimmed)) {
        flushLst();
        elements.push(
          <h4 key={`h4-${i}`} className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-4 mb-2">
            {renderInline(trimmed.replace(/^####\s+/, ''), `h4-${i}`)}
          </h4>
        );
        continue;
      }
      if (/^###\s+/.test(trimmed)) {
        flushLst();
        elements.push(
          <h3 key={`h3-${i}`} className="text-sm font-bold text-indigo-300 mt-4 mb-2">
            {renderInline(trimmed.replace(/^###\s+/, ''), `h3-${i}`)}
          </h3>
        );
        continue;
      }
      if (/^##\s+/.test(trimmed)) {
        flushLst();
        elements.push(
          <h2 key={`h2-${i}`} className="text-base font-bold text-white mt-5 mb-2 pb-1 border-b border-slate-800/80 flex items-center gap-2">
            {renderInline(trimmed.replace(/^##\s+/, ''), `h2-${i}`)}
          </h2>
        );
        continue;
      }
      if (/^#\s+/.test(trimmed)) {
        flushLst();
        elements.push(
          <h1 key={`h1-${i}`} className="text-lg font-extrabold text-white mt-5 mb-2.5">
            {renderInline(trimmed.replace(/^#\s+/, ''), `h1-${i}`)}
          </h1>
        );
        continue;
      }

      const ulMatch = rawLine.match(/^(\s*)[-*]\s+(.*)$/);
      if (ulMatch) {
        if (!currentList || currentList.type !== 'ul') {
          flushLst();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(ulMatch[2]);
        continue;
      }

      const olMatch = rawLine.match(/^(\s*)\d+\.\s+(.*)$/);
      if (olMatch) {
        if (!currentList || currentList.type !== 'ol') {
          flushLst();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(olMatch[2]);
        continue;
      }

      flushLst();

      if (!trimmed) continue;

      elements.push(
        <p key={`p-${i}`} className="text-xs sm:text-sm text-slate-200 leading-relaxed my-2">
          {renderInline(rawLine, `p-${i}`)}
        </p>
      );
    }

    flushBq();
    flushLst();
    flushTbl();

    return <div className="space-y-1 font-sans">{elements}</div>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-white">
      {/* 1. Slim Modern Top Utility Bar (~44px) - Replaces the bulky 140px Double Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-16 z-30 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-200 tracking-tight">AI Tutor</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {health?.questions_indexed ?? 386} PYQs Grounded
              </span>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="text-xs font-mono text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-slate-900 border border-slate-800/80 transition cursor-pointer flex items-center gap-1.5"
              title="Start fresh conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Canvas Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 pb-40 flex flex-col">
        {messages.length === 0 ? (
          /* Empty / Welcome State (Clean & Centered like Claude / ChatGPT) */
          <div className="my-auto py-12 text-center max-w-xl mx-auto flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center mb-4 text-violet-400 shadow-lg shadow-violet-500/10">
              <Brain className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
              What GATE concept would you like to master today?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-8 leading-relaxed">
              Every explanation is contextually anchored in authentic GATE questions with rigorous mathematical derivations and zero answer leakage.
            </p>

            <div className="w-full text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(item.q)}
                    className="p-3.5 text-left rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-violet-500/50 hover:bg-slate-900 transition flex flex-col justify-between text-xs text-slate-300 group shadow-sm cursor-pointer"
                  >
                    <span className="text-[10px] font-mono font-medium text-violet-400 mb-1.5">
                      {item.topic}
                    </span>
                    <span className="line-clamp-2 text-slate-300 group-hover:text-white transition-colors leading-relaxed">
                      {item.q}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Thread (Open Canvas, Unboxed Responses) */
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.sender === 'user' ? (
                  /* User Prompt: Muted Dark-Glass Capsule on Right (No Avatars, No Loud Blue) */
                  <div className="flex justify-end my-3">
                    <div className="max-w-[85%] sm:max-w-[78%] rounded-3xl bg-slate-800/90 border border-slate-700/60 px-5 py-3 text-slate-100 text-sm sm:text-base leading-relaxed shadow-sm">
                      <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                    </div>
                  </div>
                ) : (
                  /* Assistant Response: Pure Unboxed Canvas (Like ChatGPT / Claude) */
                  <div className="my-6">
                    {/* Subtle Diagnostic / Grounding Status Line */}
                    {!msg.error && (
                      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-400 font-mono">
                        {msg.isGrounded ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full text-[11px] font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Grounded in {msg.references?.length ?? 2} GATE PYQs
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full text-[11px] font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Core Concept (No direct PYQ matches)
                          </span>
                        )}
                        {msg.latencyMs && (
                          <span className="text-slate-500 text-[11px]">
                            • {msg.latencyMs}ms • {msg.modelUsed || 'groq'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Response Body or Error Card */}
                    {msg.error ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5 text-rose-300 text-xs sm:text-sm bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 leading-relaxed">
                          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-rose-200 block mb-0.5">Tutor Service Notice</span>
                            <span className="break-words">{typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}</span>
                          </div>
                        </div>
                        {msg.queryToRetry && (
                          <button
                            type="button"
                            onClick={() => handleSend(msg.queryToRetry)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-medium text-slate-200 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Retry Question</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-100 leading-relaxed text-sm sm:text-base prose-invert max-w-none">
                        {renderFormattedText(msg.text)}
                      </div>
                    )}

                    {/* Collapsible Retrieved PYQ Drawer */}
                    {msg.references && msg.references.length > 0 && (
                      <div className="mt-5 pt-3 border-t border-slate-800/60">
                        <div className="text-xs font-mono font-semibold text-indigo-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          Retrieved Context References ({msg.references.length}):
                        </div>
                        <div className="space-y-2">
                          {msg.references.map((ref) => {
                            const isExpanded = expandedRef === ref.id;
                            return (
                              <div
                                key={ref.id}
                                className="rounded-xl bg-slate-900/60 border border-slate-800/90 p-3 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-bold text-violet-400">
                                      [{ref.id}]
                                    </span>
                                    {ref.subject && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                        {ref.subject}
                                      </span>
                                    )}
                                    {ref.year && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                        GATE {ref.year}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                                      {(ref.similarity_score * 100).toFixed(0)}% Match
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRef(isExpanded ? null : ref.id)}
                                    className="text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer"
                                    title={isExpanded ? 'Collapse' : 'Expand full question'}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                <p className="mt-2 text-slate-300 line-clamp-2">
                                  {ref.question}
                                </p>

                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-slate-300">
                                    {ref.correct_answer && (
                                      <p>
                                        <strong className="text-emerald-400">Official Answer:</strong>{' '}
                                        {String(ref.correct_answer)}
                                      </p>
                                    )}
                                    {ref.explanation && (
                                      <div>
                                        <strong className="text-indigo-400">Verified Explanation:</strong>
                                        <p className="mt-1 text-slate-400 whitespace-pre-wrap">
                                          {ref.explanation}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Post-Response Minimal Action Row (Copy, Retry) */}
                    {!msg.error && (
                      <div className="mt-3.5 flex items-center gap-3 text-xs text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.text, msg.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-900 hover:text-slate-200 transition text-slate-400 text-xs font-mono cursor-pointer"
                          title="Copy response markdown"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Subtle Loading Animation */}
            {isLoading && (
              <div className="flex items-center gap-3 my-4 text-xs font-mono text-slate-400 py-2">
                <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                <span>Searching ChromaDB vector store & synthesizing grounded explanation...</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}
      </main>

      {/* 3. Floating Command Island (Option A: Integrated Subject Dropdown + Auto-Resize Input + Circular Send) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-6 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/60 backdrop-blur-xl p-2.5 sm:p-3 transition-all focus-within:border-slate-500/80 focus-within:ring-2 focus-within:ring-violet-500/20">
            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={(e) => {
                setInputQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a GATE CS question or concept (e.g. 'Dijkstra algorithm complexity', 'LRU cache simulation')..."
              className="w-full bg-transparent px-3 py-1.5 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none resize-none font-sans max-h-44 leading-relaxed"
            />

            {/* Bottom Controls inside the Pill */}
            <div className="flex items-center justify-between pt-1 px-1">
              {/* Option A: Sleek Subject Dropdown Pill */}
              <div className="relative inline-flex items-center">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="appearance-none bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 text-xs font-mono text-slate-300 rounded-full pl-3 pr-7 py-1 focus:outline-none cursor-pointer transition-colors shadow-sm"
                  title="Filter grounding search by subject"
                >
                  <option value="All Subjects">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s} value={s} className="bg-slate-900 text-slate-200">
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2.5" />
              </div>

              {/* Circular Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputQuery.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shadow-violet-500/25 cursor-pointer flex-shrink-0"
                title="Send inquiry (Enter)"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Minimal Disclaimer */}
          <p className="text-center text-[11px] text-slate-500 font-sans mt-2 tracking-tight">
            GateForge AI Tutor is grounded in official GATE PYQs. Verify critical derivations.
          </p>
        </div>
      </footer>
    </div>
  );
};
