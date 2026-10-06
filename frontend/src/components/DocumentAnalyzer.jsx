import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, FileText, Scale, ShieldAlert, Calendar, Users, 
  Download, MessageSquare, Send, Sparkles, AlertTriangle, 
  HelpCircle, Clock, CheckCircle2, ChevronRight, CornerDownRight,
  ShieldCheck, Info
} from 'lucide-react';

// Support absolute API base URL in production (e.g. Render hosted backend)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function DocumentAnalyzer({ documentData, onBack }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I have analyzed **${documentData.filename}**. You can ask me any specific questions about its terms, liabilities, obligations, or dates, and I will answer directly from the text.`,
      sources: []
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentData.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer from AI');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer,
        sources: data.sources || []
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠️ Error: Could not get a response. Please make sure the backend server and Ollama are running.`,
        sources: []
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDownloadReport = () => {
    window.open(`${API_BASE_URL}/api/documents/${documentData.id}/report`, '_blank');
  };

  const getRiskBadgeColor = (level) => {
    switch (level) {
      case 'High':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getRiskLevelIcon = (level) => {
    switch (level) {
      case 'High':
        return <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'Medium':
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
  };

  const getClauseBadgeColor = (level) => {
    const norm = (level || '').toLowerCase();
    if (norm.includes('high')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (norm.includes('medium')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (norm.includes('low')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getClauseBadgeIcon = (level) => {
    const norm = (level || '').toLowerCase();
    if (norm.includes('high')) return <ShieldAlert className="w-3.5 h-3.5 mr-1" />;
    if (norm.includes('medium')) return <AlertTriangle className="w-3.5 h-3.5 mr-1" />;
    if (norm.includes('low')) return <ShieldCheck className="w-3.5 h-3.5 mr-1" />;
    return <Info className="w-3.5 h-3.5 mr-1" />;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 animate-fade-in text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-0.5">
              <Scale className="w-3.5 h-3.5" />
              Legal Document Audit
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              {documentData.filename}
            </h1>
          </div>
        </div>

        <button 
          onClick={handleDownloadReport}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-5 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all cursor-pointer text-sm border border-indigo-700 w-full md:w-auto"
        >
          <Download className="w-4 h-4" />
          Download Analysis Report
        </button>
      </div>

      {/* Quick Stats Grid - Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 perspective-container">
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center gap-4 shadow-sm perspective-card">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Parties</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {documentData.parties?.length || 2} Identified
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center gap-4 shadow-sm perspective-card">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 border border-violet-100 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Key Clauses</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {documentData.clauses?.length || 0} Extracted
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center gap-4 shadow-sm perspective-card">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Key Risks</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {documentData.risks?.length || 0} Flagged
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center gap-4 shadow-sm perspective-card">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Timeline Deadlines</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {documentData.dates?.length || 0} Extracted
            </div>
          </div>
        </div>
      </div>

      {/* Main Analysis Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Document Information Tabs (Summary, Clauses, Risks, Dates) */}
        <div className="lg:col-span-7 flex flex-col glass-panel rounded-2xl overflow-hidden min-h-[500px] lg:min-h-[600px] border border-slate-200 shadow-sm">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all cursor-pointer shrink-0 ${
                activeTab === 'summary' 
                  ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              Summary & Confidence
            </button>
            <button
              onClick={() => setActiveTab('clauses')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all cursor-pointer shrink-0 ${
                activeTab === 'clauses' 
                  ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Scale className="w-4 h-4 text-violet-600" />
              Clauses
            </button>
            <button
              onClick={() => setActiveTab('risks')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all cursor-pointer shrink-0 ${
                activeTab === 'risks' 
                  ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Risk Audit
            </button>
            <button
              onClick={() => setActiveTab('dates')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all cursor-pointer shrink-0 ${
                activeTab === 'dates' 
                  ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-4 h-4 text-emerald-600" />
              Timeline
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-h-[500px] lg:max-h-[550px]">
            
            {/* Tab: Summary */}
            {activeTab === 'summary' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-3 border-b border-slate-100 pb-2">
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                      Executive Summary
                    </h3>
                    <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl shadow-sm text-indigo-700 font-bold text-sm">
                      Confidence {documentData.confidence_score || 97}%
                    </div>
                  </div>
                  <div className="text-slate-700 leading-relaxed space-y-4 whitespace-pre-line text-sm md:text-base bg-slate-50/50 p-4 rounded-xl border border-slate-200/50">
                    {documentData.summary}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Governing Law & Jurisdiction
                    </h4>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium w-24">Governing Law:</span>
                        <span className="font-bold text-slate-900 text-sm bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {documentData.governing_law || 'India'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium w-24">Jurisdiction:</span>
                        <span className="font-semibold text-slate-800 text-sm bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {documentData.jurisdiction || 'Ahmedabad, Gujarat'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Contract Parties
                    </h4>
                    <div className="space-y-3">
                      {documentData.parties_dict ? (
                        <div className="perspective-container space-y-2">
                          <div className="perspective-card">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disclosing Party</span>
                            <div className="flex items-center gap-2 bg-white py-2.5 px-4 rounded-xl border border-slate-200 text-slate-800 text-sm font-bold shadow-sm mt-0.5">
                              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                              {documentData.parties_dict.disclosing_party}
                            </div>
                          </div>
                          <div className="perspective-card mt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receiving Party</span>
                            <div className="flex items-center gap-2 bg-white py-2.5 px-4 rounded-xl border border-slate-200 text-slate-800 text-sm font-bold shadow-sm mt-0.5">
                              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                              {documentData.parties_dict.receiving_party}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Fallback to standard array structure
                        documentData.parties?.map((party, idx) => (
                          <li 
                            key={idx}
                            className="flex items-center gap-2 bg-white py-2.5 px-4 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium shadow-sm list-none"
                          >
                            <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                            {party}
                          </li>
                        )) || <div className="text-slate-500 text-sm italic">No parties extracted.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Clauses */}
            {activeTab === 'clauses' && (
              <div className="space-y-4 animate-fade-in perspective-container">
                <h3 className="text-lg font-semibold text-slate-950 mb-1">Key Legal Clauses</h3>
                <p className="text-xs text-slate-500 mb-5">Categorized extraction of rights, responsibilities, and termination conditions.</p>

                {documentData.clauses?.length > 0 ? (
                  documentData.clauses.map((clause, idx) => (
                    <div 
                      key={idx}
                      className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white/50 hover:bg-white/95 transition-colors shadow-sm space-y-3 perspective-card"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center ${getClauseBadgeColor(clause.risk_level)}`}>
                          {getClauseBadgeIcon(clause.risk_level)}
                          {clause.risk_level || 'Information'}
                        </span>
                        
                        <h4 className="text-sm md:text-base font-bold text-slate-900 mr-auto ml-2">
                          {clause.title}
                        </h4>
                        
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                          {clause.category}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {clause.description}
                      </p>
                      {clause.reference && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-500 italic flex gap-2">
                          <CornerDownRight className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>"{clause.reference}"</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No major clauses extracted from the document.
                  </div>
                )}
              </div>
            )}

            {/* Tab: Risks */}
            {activeTab === 'risks' && (
              <div className="space-y-4 animate-fade-in perspective-container">
                <h3 className="text-lg font-semibold text-slate-950 mb-1">Liability & Risk Audit</h3>
                <p className="text-xs text-slate-500 mb-5">Detailed analysis of potentially unfavorable, strict, or ambiguous conditions.</p>

                {documentData.risks?.length > 0 ? (
                  documentData.risks.map((risk, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 sm:p-5 rounded-xl border bg-white/50 hover:bg-white/95 transition-colors border-slate-200 shadow-sm flex gap-4 perspective-card`}
                    >
                      <div className="pt-0.5">
                        {getRiskLevelIcon(risk.level)}
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getRiskBadgeColor(risk.level)}`}>
                            {risk.level} Risk
                          </span>
                          <h4 className="text-sm md:text-base font-bold text-slate-900">
                            {risk.name}
                          </h4>
                        </div>
                        <p className="text-sm text-slate-700">
                          {risk.explanation}
                        </p>
                        {risk.clause && (
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-500 italic flex gap-2">
                            <CornerDownRight className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>"{risk.clause}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-500" />
                    No significant risk clauses detected in the document.
                  </div>
                )}
              </div>
            )}

            {/* Tab: Dates */}
            {activeTab === 'dates' && (
              <div className="space-y-4 animate-fade-in perspective-container">
                <h3 className="text-lg font-semibold text-slate-950 mb-1">Document Timeline & Key Periods</h3>
                <p className="text-xs text-slate-500 mb-5">Chronological layout of deadlines, validity terms, and notice period obligations.</p>

                {documentData.dates?.length > 0 ? (
                  <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6 py-2">
                    {documentData.dates.map((dateObj, idx) => (
                      <div key={idx} className="relative">
                        {/* Timeline node */}
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                        
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 perspective-card">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-emerald-600" />
                              {dateObj.event}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-150">
                              {dateObj.value}
                            </span>
                          </div>
                          
                          <p className="text-sm text-slate-700 leading-relaxed pt-1">
                            {dateObj.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No important dates or deadlines extracted.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: RAG Chat Assistant */}
        <div className="lg:col-span-5 flex flex-col glass-panel rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] lg:min-h-[600px]">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">AI Legal Assistant</h3>
                <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  RAG Chat active (Answers from document only)
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              Llama 3.2
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[400px] lg:max-h-[460px] bg-slate-50/50">
            {chatMessages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex flex-col max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div 
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-md' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>

                {/* Citations / Sources */}
                {msg.role === 'assistant' && msg.sources?.length > 0 && (
                  <div className="mt-1.5 pl-2 space-y-1 w-full">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Scale className="w-3 h-3 text-indigo-600" />
                      Document References
                    </div>
                    {msg.sources.map((src, sIdx) => (
                      <div 
                        key={sIdx} 
                        className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200/60 italic shadow-sm"
                      >
                        "...{src.content}..." 
                        {src.score && <span className="text-[9px] text-indigo-600 font-medium ml-1">({Math.round(src.score * 100)}% match)</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {isChatLoading && (
              <div className="mr-auto items-start max-w-[85%] flex flex-col">
                <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-tl-none shadow-sm">
                  {/* AI typing cursor animation */}
                  <div className="flex gap-1.5 items-center py-1">
                    <span className="text-xs text-slate-400 mr-1 italic">Thinking</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form 
            onSubmit={handleSendMessage} 
            className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about liabilities, payments, dates..."
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 shadow-sm"
              disabled={isChatLoading}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                chatInput.trim() && !isChatLoading
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-400'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
