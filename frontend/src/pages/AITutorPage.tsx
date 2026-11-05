import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Database,
  Search,
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
}

const SUGGESTIONS = [
  'What is the minimum number of nodes in an AVL tree of height h?',
  'Explain pipeline data hazards and operand forwarding in COA.',
  'What is the time complexity of Dijkstra algorithm using a Min-Heap?',
  'Explain Belady anomaly in FIFO page replacement with an example.',
  'Difference between LL(1) and LR(0) parsers in Compiler Design.',
];

export const AITutorPage: React.FC<{ onBackToHome?: () => void }> = ({ onBackToHome }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<ITutorHealth | null>(null);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          : 'Failed to retrieve answer from AI Tutor. Please wait a moment and try again.';
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'tutor',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header Banner */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-16 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">RAG-Powered AI Tutor</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Semantic ChromaDB
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contextually grounded in authentic GATE CS previous year questions and official solutions.
              </p>
            </div>
          </div>

          {/* Status & Subject Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">Corpus:</span>
              <span className="font-semibold text-slate-200">
                {health?.questions_indexed ?? 386} PYQs
              </span>
            </div>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500 font-mono"
            >
              <option value="All Subjects">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 flex flex-col">
        {messages.length === 0 ? (
          /* Empty State / Welcome & Starter Queries */
          <div className="my-auto py-8 text-center max-w-2xl mx-auto flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center mb-4 text-violet-400">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Ask Any GATE CS Technical Question
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Our AI Tutor searches the authentic GATE question bank using vector embeddings, retrieves the top 3
              most relevant exam questions, and grounds the explanation strictly in verified reference solutions.
            </p>

            <div className="w-full text-left">
              <span className="text-xs font-mono uppercase text-slate-500 font-semibold mb-3 block text-center">
                Recommended Study Inquiries:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="p-3 text-left rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-violet-500/40 hover:bg-slate-900 transition flex items-center justify-between text-xs text-slate-300 group"
                  >
                    <span>{s}</span>
                    <Send className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Message Thread */
          <div className="space-y-6 pb-24">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'tutor' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-violet-500/10">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded-2xl p-4 sm:p-5 ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-sm shadow-lg'
                  }`}
                >
                  {/* Tutor Header Badges */}
                  {msg.sender === 'tutor' && !msg.error && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80 text-xs">
                      {msg.isGrounded ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold font-mono text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Grounded in {msg.references?.length ?? 3} Authentic GATE PYQs
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold font-mono text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          General Concept (No Direct PYQ Matches in Corpus)
                        </span>
                      )}

                      {msg.latencyMs && (
                        <span className="text-[11px] font-mono text-slate-500">
                          {msg.latencyMs}ms • {msg.modelUsed || 'groq'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Body */}
                  {msg.error ? (
                    <div className="flex items-center gap-2 text-rose-400 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{msg.text}</span>
                    </div>
                  ) : (
                    renderFormattedText(msg.text)
                  )}

                  {/* Retrieved Question References Drawer */}
                  {msg.references && msg.references.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-800/80">
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
                              className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-xs"
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
                                  onClick={() => setExpandedRef(isExpanded ? null : ref.id)}
                                  className="text-slate-400 hover:text-slate-200 transition p-1"
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

                  <div className="mt-2 text-[10px] text-right text-slate-500 font-mono">
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-brand-500/10 text-white font-mono font-bold text-xs">
                    U
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-4 text-xs font-mono text-slate-400 flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                  <span>Searching ChromaDB vector store & synthesizing grounded explanation...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}
      </main>

      {/* Floating Chat Input Bar */}
      <footer className="sticky bottom-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 p-3 sm:p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-end gap-2 sm:gap-3">
          <div className="flex-1 relative bg-slate-900 border border-slate-800 rounded-xl focus-within:border-violet-500 transition-colors shadow-inner">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a GATE CS question (e.g. 'Minimum nodes in an AVL tree', 'LRU cache simulation')..."
              className="w-full bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isLoading}
            className="h-11 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/20 transition-all flex-shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Ask Tutor</span>
              </>
            )}
          </button>
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-3">
          <span>Shift+Enter for newline</span>
          <span>•</span>
          <span>Never fabricates unverified context</span>
          <span>•</span>
          <span>Press Enter to ask</span>
        </div>
      </footer>
    </div>
  );
};
