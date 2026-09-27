import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ArrowUpRight, Layers, FileText, CheckSquare, HelpCircle, Sparkles } from 'lucide-react';
import { PORTALS, QUESTIONS } from '../data/formSchema';
import { FormAnswers, FormUploadedFiles } from './PortalRenderer';

export interface GlobalSearchResultItem {
  id: string;
  portalId: number;
  portalTitle: string;
  questionNumber?: number;
  questionId?: string;
  elementSelector?: string;
  matchType:
    | 'Question Number'
    | 'Question Heading'
    | 'Description / Instruction'
    | 'Option'
    | 'Entered Response'
    | 'Uploaded File'
    | 'Section / Portal'
    | 'Form Content / Notice';
  locationLabel: string;
  matchedText: string;
  score: number;
}

interface GlobalSearchBarProps {
  answers: FormAnswers;
  uploadedFiles: FormUploadedFiles;
  onJumpToResult: (result: GlobalSearchResultItem) => void;
}

// Static searchable institutional notices & legal sections present in the form
const STATIC_FORM_BLOCKS: Array<{
  id: string;
  portalId: number;
  questionNumber?: number;
  title: string;
  text: string;
  selector: string;
}> = [
  {
    id: 'block-resident-info',
    portalId: 2,
    questionNumber: 21,
    title: 'Resident Information (निवास स्थान संबंधी विवरण)',
    text: 'Resident Information निवास स्थान संबंधी विवरण स्थायी अथवा वर्तमान लोकैशन lgdirectory.gov.in',
    selector: '#question-box-21',
  },
  {
    id: 'block-bank-qr',
    portalId: 9,
    questionNumber: 110,
    title: 'Official Beneficiary Bank & QR Legal Notice (Q110)',
    text: 'NAND VIDHYA EDUCATION ACADEMY NVEA चालू बैंक खाता संख्या 104321010000244 IFSC UBIN0910431 Union Bank of India UPI ID 72923201@ubin QR Code',
    selector: '#question-box-110',
  },
  {
    id: 'block-live-fee',
    portalId: 9,
    questionNumber: 116,
    title: 'Live Fee Status (Q116–Q117)',
    text: 'Live Fee Status कितनी फीस जमा है कितनी बकाया है उसका विवरण भरो Deposited Fee Outstanding Fee',
    selector: '#question-box-116',
  },
  {
    id: 'block-oath-intro',
    portalId: 10,
    questionNumber: 118,
    title: '1. Oath Declaration Portal (आधिकारिक डिजिटल शपथ पत्र)',
    text: 'Oath Declaration Portal आधिकारिक डिजिटल शपथ पत्र भारतीय वयस्कता अधिनियम 1875 भारतीय अनुबंध अधिनियम 1872 भारतीय साक्ष्य अधिनियम सूचना प्रौद्योगिकी अधिनियम 2000',
    selector: '#question-box-118',
  },
  {
    id: 'block-oath-sec1-2',
    portalId: 10,
    questionNumber: 129,
    title: 'शपथ बयान: 1. संस्थान संबंधी सत्यापन एवं 2. नामांकन स्थिति और सीमा',
    text: 'शपथ बयान संस्थान संबंधी सत्यापन नामांकन स्थिति और सीमा भारतीय शपथ अधिनियम 1969 CLAP Course Class Program',
    selector: '#question-box-129',
  },
  {
    id: 'block-statutory-notice',
    portalId: 10,
    questionNumber: 135,
    title: 'विधिक अधिसूचना / STATUTORY NOTICE (Maximum Intake Limit)',
    text: 'विधिक अधिसूचना STATUTORY NOTICE प्रचलित बैच में लर्नर्स की अधिकतम संख्या की सीमा Maximum Intake Limit 20 Learners',
    selector: '#question-box-135',
  },
  {
    id: 'block-oath-clauses',
    portalId: 10,
    questionNumber: 170,
    title: 'विस्तृत विधिक घोषणा एवं शपथपत्र (Clauses 3 to 19 & Unconditional Legal Declaration)',
    text: 'अविचलनीय विधिक घोषणा एवं शपथपत्र UNCONDITIONAL LEGAL DECLARATION AFFIDAVIT Download Consent Certificate Indian Contract Act Evidence Act IT Act IPC Contempt of Court Act',
    selector: '#question-box-170',
  },
];

function normalizeSearchQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchesAllTokens(haystack: string, tokens: string[]): boolean {
  const lower = haystack.toLowerCase();
  return tokens.every((tok) => lower.includes(tok));
}

function highlightTextSnippet(text: string, rawQuery: string): React.ReactNode {
  const normalized = normalizeSearchQuery(rawQuery);
  if (!normalized || !text) return text;

  const tokens = Array.from(
    new Set(
      normalized
        .split(' ')
        .map((t) => t.replace(/^q\.?/i, '').trim())
        .filter((t) => t.length > 0)
    )
  );
  // Also include full tokens in case user searched "q49"
  const rawTokens = Array.from(
    new Set([... normalized.split(' ').filter(Boolean), ...tokens])
  ).sort((a, b) => b.length - a.length);

  if (rawTokens.length === 0) return text;

  const escaped = rawTokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  if (escaped.length === 0) return text;

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, idx) =>
    regex.test(part) ? (
      <mark
        key={idx}
        className="bg-amber-200 text-[#0F2942] font-bold px-0.5 rounded-xs"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  answers,
  uploadedFiles,
  onJumpToResult,
}) => {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const portalMap = useMemo(() => {
    const map = new Map<number, (typeof PORTALS)[number]>();
    PORTALS.forEach((p) => map.set(p.id, p));
    return map;
  }, []);

  const results = useMemo<GlobalSearchResultItem[]>(() => {
    const cleaned = normalizeSearchQuery(query);
    if (!cleaned) return [];

    const tokens = cleaned.split(' ').filter(Boolean);
    // Support searching "Q49", "q.49", "Question 49", or "49"
    const numericMatch = cleaned.match(/^(?:q(?:uestion)?\.?\s*)?(\d{1,3})$/i);
    const exactQuestionNum = numericMatch ? parseInt(numericMatch[1], 10) : null;

    // Also strip leading "q" or "q." for token matching if user typed "q49"
    const strippedTokens = tokens.map((t) => {
      const m = t.match(/^q\.?(\d+)$/i);
      return m ? m[1] : t;
    });

    const found: GlobalSearchResultItem[] = [];
    const seenKeys = new Set<string>();

    const addResult = (item: GlobalSearchResultItem) => {
      if (seenKeys.has(item.id)) return;
      seenKeys.add(item.id);
      found.push(item);
    };

    // 1. Search Portals / Sections
    for (const p of PORTALS) {
      const sectionCorpus = `Portal ${p.id} Section ${p.id} ${p.shortName} ${p.title} ${
        p.subtitle || ''
      } Questions ${p.questionRange[0]}-${p.questionRange[1]}`;

      if (
        matchesAllTokens(sectionCorpus, tokens) ||
        matchesAllTokens(sectionCorpus, strippedTokens)
      ) {
        const isExactPortalNum = exactQuestionNum === p.id;
        addResult({
          id: `portal-${p.id}`,
          portalId: p.id,
          portalTitle: p.title,
          elementSelector: `#portal-section-${p.id}`,
          matchType: 'Section / Portal',
          locationLabel: `Section ${p.id} — ${p.title} (Q.${p.questionRange[0]}–${p.questionRange[1]})`,
          matchedText: `${p.title}${p.subtitle ? ` — ${p.subtitle}` : ''}`,
          score: isExactPortalNum ? 85 : 70,
        });
      }
    }

    // 2. Search All 172 Questions (Number, Heading/Label, Description, Options, Live Answer, Uploaded File)
    for (const q of QUESTIONS) {
      const portal = portalMap.get(q.portalId);
      const portalTitle = portal ? portal.title : `Portal ${q.portalId}`;
      const baseLocation = `${portalTitle} → Q${q.number} — ${q.label}`;

      // 2a. Exact or partial Question Number match
      const qNumStr = String(q.number);
      const qCodeStr = `q${q.number} q.${q.number} question ${q.number} point ${q.number}`;
      if (exactQuestionNum === q.number) {
        addResult({
          id: `q-num-${q.id}`,
          portalId: q.portalId,
          portalTitle,
          questionNumber: q.number,
          questionId: q.id,
          elementSelector: `#question-box-${q.number}`,
          matchType: 'Question Number',
          locationLabel: baseLocation,
          matchedText: `Q${q.number} — ${q.label}`,
          score: 100,
        });
      } else if (
        tokens.length === 1 &&
        /^\d+$/.test(strippedTokens[0]) &&
        qNumStr.includes(strippedTokens[0])
      ) {
        addResult({
          id: `q-num-partial-${q.id}`,
          portalId: q.portalId,
          portalTitle,
          questionNumber: q.number,
          questionId: q.id,
          elementSelector: `#question-box-${q.number}`,
          matchType: 'Question Number',
          locationLabel: baseLocation,
          matchedText: `Q${q.number} — ${q.label}`,
          score: 80,
        });
      }

      // 2b. Question Heading / Label match
      const headingCorpus = `${qCodeStr} ${q.label}`;
      if (
        matchesAllTokens(headingCorpus, tokens) ||
        matchesAllTokens(headingCorpus, strippedTokens)
      ) {
        const exactLabelInclude = q.label.toLowerCase().includes(cleaned);
        addResult({
          id: `q-label-${q.id}`,
          portalId: q.portalId,
          portalTitle,
          questionNumber: q.number,
          questionId: q.id,
          elementSelector: `#question-box-${q.number}`,
          matchType: 'Question Heading',
          locationLabel: baseLocation,
          matchedText: `Q${q.number} — ${q.label}`,
          score: exactQuestionNum === q.number ? 99 : exactLabelInclude ? 92 : 84,
        });
      }

      // 2c. Question Description / Instruction match
      if (q.description) {
        const descCorpus = `${qCodeStr} ${q.label} ${q.description}`;
        if (
          matchesAllTokens(descCorpus, tokens) ||
          matchesAllTokens(descCorpus, strippedTokens)
        ) {
          addResult({
            id: `q-desc-${q.id}`,
            portalId: q.portalId,
            portalTitle,
            questionNumber: q.number,
            questionId: q.id,
            elementSelector: `#question-box-${q.number}`,
            matchType: 'Description / Instruction',
            locationLabel: baseLocation,
            matchedText: q.description,
            score: 76,
          });
        }
      }

      // 2d. Options match (Dropdown / Checkbox options)
      if (q.options && q.options.length > 0) {
        const matchingOpts = q.options.filter(
          (opt) =>
            matchesAllTokens(`${qCodeStr} ${q.label} ${opt}`, tokens) ||
            matchesAllTokens(`${qCodeStr} ${q.label} ${opt}`, strippedTokens)
        );
        if (matchingOpts.length > 0) {
          const directOptMatch = q.options.filter(
            (opt) =>
              matchesAllTokens(opt, tokens) || matchesAllTokens(opt, strippedTokens)
          );
          const displayOpts =
            directOptMatch.length > 0 ? directOptMatch : matchingOpts;
          addResult({
            id: `q-opt-${q.id}`,
            portalId: q.portalId,
            portalTitle,
            questionNumber: q.number,
            questionId: q.id,
            elementSelector: `#question-box-${q.number}`,
            matchType: 'Option',
            locationLabel: baseLocation,
            matchedText: `Option: ${displayOpts.slice(0, 3).join(' | ')}${
              displayOpts.length > 3 ? ` (+${displayOpts.length - 3} more)` : ''
            }`,
            score: directOptMatch.length > 0 ? 88 : 72,
          });
        }
      }

      // 2e. User's Entered / Selected Response match
      const rawAns = answers[q.id];
      const ansStr = Array.isArray(rawAns)
        ? rawAns.join(', ')
        : typeof rawAns === 'string'
        ? rawAns.trim()
        : '';
      if (ansStr) {
        if (
          matchesAllTokens(ansStr, tokens) ||
          matchesAllTokens(ansStr, strippedTokens)
        ) {
          addResult({
            id: `q-ans-${q.id}`,
            portalId: q.portalId,
            portalTitle,
            questionNumber: q.number,
            questionId: q.id,
            elementSelector: `#question-box-${q.number}`,
            matchType: 'Entered Response',
            locationLabel: baseLocation,
            matchedText: `Response: ${ansStr}`,
            score: 94,
          });
        }
      }

      // 2f. Uploaded File Name match
      const files = uploadedFiles[q.id] || [];
      if (files.length > 0) {
        const fileNames = files.map((f) => f.name).join(', ');
        if (
          matchesAllTokens(`${q.label} ${fileNames}`, tokens) ||
          matchesAllTokens(`${q.label} ${fileNames}`, strippedTokens)
        ) {
          addResult({
            id: `q-file-${q.id}`,
            portalId: q.portalId,
            portalTitle,
            questionNumber: q.number,
            questionId: q.id,
            elementSelector: `#question-box-${q.number}`,
            matchType: 'Uploaded File',
            locationLabel: baseLocation,
            matchedText: `Uploaded File: ${fileNames}`,
            score: 90,
          });
        }
      }
    }

    // 3. Search Static Legal / Instruction / Notice Blocks
    for (const blk of STATIC_FORM_BLOCKS) {
      const portal = portalMap.get(blk.portalId);
      const portalTitle = portal ? portal.title : `Portal ${blk.portalId}`;
      const corpus = `${blk.title} ${blk.text}`;
      if (
        matchesAllTokens(corpus, tokens) ||
        matchesAllTokens(corpus, strippedTokens)
      ) {
        addResult({
          id: blk.id,
          portalId: blk.portalId,
          portalTitle,
          questionNumber: blk.questionNumber,
          elementSelector: blk.selector,
          matchType: 'Form Content / Notice',
          locationLabel: `${portalTitle} → ${blk.title}`,
          matchedText: `${blk.title} — ${blk.text}`,
          score: 68,
        });
      }
    }

    // 4. Live HTML DOM Scanner (captures any buttons, dynamic labels, or extra DOM nodes in #nvea-printable-sheet)
    if (typeof document !== 'undefined') {
      const sheet = document.getElementById('nvea-printable-sheet');
      if (sheet) {
        const domNodes = sheet.querySelectorAll(
          'button, h1, h2, h3, h4, label, p, span, option'
        );
        let domMatchCount = 0;
        for (let i = 0; i < domNodes.length && domMatchCount < 15; i++) {
          const el = domNodes[i] as HTMLElement;
          if (containerRef.current && containerRef.current.contains(el)) continue;
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text || text.length < 2 || text.length > 350) continue;

          if (
            matchesAllTokens(text, tokens) ||
            matchesAllTokens(text, strippedTokens)
          ) {
            const closestQ = el.closest('[id^="question-box-"]') as HTMLElement | null;
            const closestPortal = el.closest('[id^="portal-section-"]') as HTMLElement | null;

            if (closestQ) {
              const qNum = parseInt(closestQ.id.replace('question-box-', ''), 10);
              const qObj = QUESTIONS.find((item) => item.number === qNum);
              if (qObj) {
                const alreadyHasQ =
                  seenKeys.has(`q-num-${qObj.id}`) ||
                  seenKeys.has(`q-label-${qObj.id}`) ||
                  seenKeys.has(`q-desc-${qObj.id}`) ||
                  seenKeys.has(`q-opt-${qObj.id}`) ||
                  seenKeys.has(`q-ans-${qObj.id}`);
                if (alreadyHasQ) continue;

                const portal = portalMap.get(qObj.portalId);
                const portalTitle = portal ? portal.title : `Portal ${qObj.portalId}`;
                addResult({
                  id: `dom-q-${qNum}-${domMatchCount}`,
                  portalId: qObj.portalId,
                  portalTitle,
                  questionNumber: qNum,
                  questionId: qObj.id,
                  elementSelector: `#question-box-${qNum}`,
                  matchType: 'Form Content / Notice',
                  locationLabel: `${portalTitle} → Q${qNum} — ${qObj.label}`,
                  matchedText: text,
                  score: 65,
                });
                domMatchCount++;
              }
            } else if (closestPortal) {
              const pId = parseInt(closestPortal.id.replace('portal-section-', ''), 10);
              const portal = portalMap.get(pId);
              if (portal && !seenKeys.has(`portal-${pId}`)) {
                addResult({
                  id: `dom-p-${pId}-${domMatchCount}`,
                  portalId: pId,
                  portalTitle: portal.title,
                  elementSelector: `#portal-section-${pId}`,
                  matchType: 'Form Content / Notice',
                  locationLabel: `Section ${pId} — ${portal.title}`,
                  matchedText: text,
                  score: 62,
                });
                domMatchCount++;
              }
            }
          }
        }
      }
    }

    return found.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.questionNumber || 999) - (b.questionNumber || 999);
    });
  }, [query, answers, uploadedFiles, portalMap]);

  const handleSelectResult = (item: GlobalSearchResultItem) => {
    setIsOpen(false);
    onJumpToResult(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelectResult(results[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getBadgeStyle = (type: GlobalSearchResultItem['matchType']) => {
    switch (type) {
      case 'Question Number':
      case 'Question Heading':
        return 'bg-[#0F2942] text-white';
      case 'Section / Portal':
        return 'bg-amber-600 text-white';
      case 'Option':
        return 'bg-blue-100 text-[#1E3A8A] border border-blue-300';
      case 'Entered Response':
        return 'bg-emerald-100 text-emerald-900 border border-emerald-300';
      case 'Uploaded File':
        return 'bg-purple-100 text-purple-900 border border-purple-300';
      default:
        return 'bg-slate-200 text-slate-800';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative mb-3 bg-gradient-to-r from-[#0F2942] via-[#163A5F] to-[#0F2942] p-3 rounded-sm border-2 border-[#D97706] shadow-sm no-print"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold tracking-wide">
            GLOBAL FORM SEARCH SYSTEM (पूरे फॉर्म में कुछ भी खोजें — Questions, Headings, Options, Sections, Answers, A–Z / 0–9)
          </span>
        </div>
        <span className="text-[11px] text-amber-200 font-mono-num">
          Live Instant Search • Click any result to jump &amp; highlight
        </span>
      </div>

      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search anything in the form: e.g. Scheme, 49, Q134, Deponent, Session Wise, Aadhaar, Fee, GST, Option, or Answer..."
          aria-label="Global Form Search"
          className="w-full h-10 pl-9 pr-24 text-xs sm:text-sm bg-white text-slate-900 border-2 border-amber-400/80 rounded-sm focus:outline-none focus:border-amber-400 font-hindi placeholder:text-slate-400 shadow-inner"
        />
        {query.trim().length > 0 && (
          <div className="absolute right-2 flex items-center gap-1.5">
            <span className="text-[11px] font-mono-num font-bold px-1.5 py-0.5 bg-slate-100 text-[#0F2942] border border-slate-300 rounded-xs">
              {results.length} {results.length === 1 ? 'Match' : 'Matches'}
            </span>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-500 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded-xs cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Live Search Results Dropdown Panel */}
      {isOpen && normalizeSearchQuery(query).length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border-2 border-[#0F2942] rounded-sm shadow-2xl max-h-96 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs text-slate-700">
            <span className="font-bold text-[#0F2942]">
              Search Results for &ldquo;{query.trim()}&rdquo; ({results.length} found)
            </span>
            <span className="text-[11px] text-slate-500">
              Click any item to scroll &amp; highlight
            </span>
          </div>

          {results.length === 0 ? (
            <div className="p-5 text-center text-xs sm:text-sm text-slate-600">
              No matching content found for <strong>&ldquo;{query.trim()}&rdquo;</strong>. Try another keyword, question number (1–172), option, or phrase.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {results.slice(0, 60).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/80 transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-xs ${getBadgeStyle(
                          item.matchType
                        )}`}
                      >
                        {item.matchType === 'Section / Portal' ? (
                          <Layers className="w-3 h-3" />
                        ) : item.matchType === 'Option' || item.matchType === 'Entered Response' ? (
                          <CheckSquare className="w-3 h-3" />
                        ) : item.matchType === 'Description / Instruction' ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <HelpCircle className="w-3 h-3" />
                        )}
                        <span>{item.matchType}</span>
                      </span>
                      <span className="text-xs font-bold text-[#1E3A8A] font-hindi truncate">
                        → {highlightTextSnippet(item.locationLabel, query)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-hindi line-clamp-2 pl-1 border-l-2 border-amber-400">
                      {highlightTextSnippet(item.matchedText, query)}
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-[#0F2942] bg-slate-100 group-hover:bg-[#0F2942] group-hover:text-white rounded-xs transition-colors">
                    <span>Jump</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
