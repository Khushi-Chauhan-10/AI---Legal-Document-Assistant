import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, AlertCircle, RefreshCw, Trash2, 
  ChevronRight, HelpCircle, HardDrive, Cpu, Terminal, CheckCircle2,
  Lock, Shield, Check, Loader2
} from 'lucide-react';
import DocumentAnalyzer from './components/DocumentAnalyzer';

// Support absolute API base URL in production (e.g. Render hosted backend)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [healthStatus, setHealthStatus] = useState({ checked: false, online: false, ollama: null });
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  
  // Upload and Analysis State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // High-fidelity analysis steps visualizer
  const [analysisSteps, setAnalysisSteps] = useState([
    { id: 0, label: 'Upload document to secure sandbox', status: 'pending' },
    { id: 1, label: 'Extract text layouts & headings (PyMuPDF/DOCX)', status: 'pending' },
    { id: 2, label: 'Identify contracting parties & jurisdictions (Llama 3.2)', status: 'pending' },
    { id: 3, label: 'Perform clause risk audit (Medium/High risks)', status: 'pending' },
    { id: 4, label: 'Compile vector embeddings index (FAISS/MiniLM)', status: 'pending' }
  ]);

  // Load documents and verify health on mount
  useEffect(() => {
    checkSystemHealth();
    loadDocuments();
  }, []);

  const checkSystemHealth = async () => {
    setIsHealthChecking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus({
          checked: true,
          online: true,
          ollama: data.ollama
        });
      } else {
        setHealthStatus({
          checked: true,
          online: false,
          ollama: null
        });
      }
    } catch (error) {
      setHealthStatus({
        checked: true,
        online: false,
        ollama: null
      });
    } finally {
      setIsHealthChecking(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to load documents', error);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const updateStepStatus = (stepId, status) => {
    setAnalysisSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleFileUpload = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setUploadError('Only PDF and DOCX documents are supported.');
      return;
    }

    setUploadError('');
    setIsUploading(true);
    setUploadProgress(5);
    
    // Reset steps
    setAnalysisSteps([
      { id: 0, label: 'Upload document to secure sandbox', status: 'loading' },
      { id: 1, label: 'Extract text layouts & headings (PyMuPDF/DOCX)', status: 'pending' },
      { id: 2, label: 'Identify contracting parties & jurisdictions (Llama 3.2)', status: 'pending' },
      { id: 3, label: 'Perform clause risk audit (Medium/High risks)', status: 'pending' },
      { id: 4, label: 'Compile vector embeddings index (FAISS/MiniLM)', status: 'pending' }
    ]);

    const formData = new FormData();
    formData.append('file', file);

    // Simulate progress updates and transition visual states
    setTimeout(() => {
      updateStepStatus(0, 'done');
      updateStepStatus(1, 'loading');
      setUploadProgress(20);
    }, 1200);

    setTimeout(() => {
      updateStepStatus(1, 'done');
      updateStepStatus(2, 'loading');
      setUploadProgress(45);
    }, 3000);

    setTimeout(() => {
      updateStepStatus(2, 'done');
      updateStepStatus(3, 'loading');
      setUploadProgress(70);
    }, 5500);

    setTimeout(() => {
      updateStepStatus(3, 'done');
      updateStepStatus(4, 'loading');
      setUploadProgress(90);
    }, 8500);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Upload failed');
      }

      const docData = await response.json();
      
      // All steps complete
      setAnalysisSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
      setUploadProgress(100);
      
      // Update local doc list and select new doc after brief delay
      setDocuments(prev => [docData, ...prev]);
      
      setTimeout(() => {
        setIsUploading(false);
        setSelectedDoc(docData);
      }, 800);

    } catch (error) {
      setIsUploading(false);
      setUploadError(error.message || 'An error occurred during processing.');
    }
  };

  const handleDeleteDoc = async (e, docId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
        if (selectedDoc && selectedDoc.id === docId) {
          setSelectedDoc(null);
        }
      }
    } catch (error) {
      alert('Failed to delete document');
    }
  };

  const handleSelectDoc = async (docId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDoc(data);
      }
    } catch (error) {
      alert('Failed to load document details');
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (selectedDoc) {
    return (
      <DocumentAnalyzer 
        documentData={selectedDoc} 
        onBack={() => {
          setSelectedDoc(null);
          loadDocuments();
        }} 
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 animate-float-3d">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              AI Legal Document Assistant
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Securely upload contracts, deeds, and NDAs for automated RAG summaries and risk diagnostics.
            </p>
          </div>
        </div>

        {/* System Diagnostics Status */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button 
            onClick={checkSystemHealth}
            disabled={isHealthChecking}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Refresh connection status"
          >
            <RefreshCw className={`w-4 h-4 ${isHealthChecking ? 'animate-spin' : ''}`} />
          </button>
          
          {healthStatus.checked && (
            <div className={`flex items-center gap-2 text-xs font-semibold py-2 px-3 rounded-xl border ${
              healthStatus.online && healthStatus.ollama?.connected
                ? 'bg-emerald-55 bg-opacity-10 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                healthStatus.online && healthStatus.ollama?.connected ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />
              {healthStatus.online && healthStatus.ollama?.connected 
                ? 'Services Online (Llama 3.2 Active)' 
                : 'System Offline / LLM Offline'}
            </div>
          )}
        </div>
      </div>

      {/* Troubleshoot Panel if Services Offline */}
      {healthStatus.checked && (!healthStatus.online || !healthStatus.ollama?.connected) && (
        <div className="glass-panel p-6 rounded-2xl border-rose-200 bg-rose-50/30 mb-8 animate-pulse-subtle">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-rose-100 border border-rose-200 text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">AI Environment Configuration Required</h3>
                <p className="text-sm text-slate-600 mt-1">
                  The Legal Assistant depends on a running FastAPI backend and local Ollama server running Llama 3.2. 
                  {!healthStatus.online && ' The Python API backend seems offline.'}
                  {healthStatus.online && !healthStatus.ollama?.connected && ' The API backend is running, but Ollama/Llama 3.2 is not reachable.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Terminal className="w-4 h-4" />
                    1. Run FastAPI Backend
                  </div>
                  <p className="text-xs text-slate-500">Launch this in the repository folder:</p>
                  <code className="block bg-slate-50 py-1.5 px-3 rounded text-indigo-700 font-mono text-xs overflow-x-auto whitespace-nowrap border border-slate-200">
                    cd backend; .\.venv\Scripts\uvicorn main:app --reload
                  </code>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-violet-600 font-bold">
                    <Cpu className="w-4 h-4" />
                    2. Start Ollama & Llama 3.2
                  </div>
                  <p className="text-xs text-slate-500">Ensure Ollama app is open and run in a separate terminal:</p>
                  <code className="block bg-slate-50 py-1.5 px-3 rounded text-violet-700 font-mono text-xs overflow-x-auto whitespace-nowrap border border-slate-200">
                    ollama run llama3.2
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Upload Area & Documents list */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Upload Panel */}
        <div className="md:col-span-5 space-y-6 perspective-container">
          <div className="glass-panel p-6 rounded-2xl border-slate-200 shadow-sm perspective-card">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Upload Legal Document
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Supported formats: PDF and DOCX. Max file size: 10MB.
            </p>

            {/* Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center min-h-[220px] ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/20' 
                  : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
              }`}
            >
              {!isUploading ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 mb-4 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-slate-700 font-semibold mb-1">
                    Drag & drop your document here
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    or click to browse local files
                  </p>
                  
                  <label className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-500/10">
                    Browse Files
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileChange}
                      accept=".pdf,.docx"
                    />
                  </label>
                </>
              ) : (
                <div className="w-full text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 animate-spin shrink-0">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Processing Contract</h4>
                      <p className="text-[10px] text-slate-500">Do not close this window</p>
                    </div>
                  </div>

                  {/* Step Checklist Animation */}
                  <div className="space-y-2 border border-slate-100 bg-slate-50/50 p-3.5 rounded-xl text-xs">
                    {analysisSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-2">
                        {step.status === 'done' && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 font-bold" />
                        )}
                        {step.status === 'loading' && (
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                        )}
                        {step.status === 'pending' && (
                          <div className="w-4 h-4 rounded-full border border-slate-200 shrink-0" />
                        )}
                        <span className={`${
                          step.status === 'done' ? 'text-slate-500 line-through' :
                          step.status === 'loading' ? 'text-slate-800 font-semibold' : 'text-slate-400'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Analysed Document List */}
        <div className="md:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border-slate-200 shadow-sm min-h-[350px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-600" />
                Document Dashboard
              </h3>
              <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 py-1 px-2.5 rounded-lg">
                {documents.length} Total
              </span>
            </div>

            {documents.length > 0 ? (
              <div className="space-y-4 perspective-container">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => handleSelectDoc(doc.id)}
                    className="glass-panel perspective-card p-4 rounded-xl border border-slate-200 bg-white/60 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 shrink-0">
                        <FileText className="w-5.5 h-5.5 text-violet-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-sm md:text-base font-bold text-slate-900 truncate pr-2">
                          {doc.filename}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatBytes(doc.file_size)}</span>
                          <span className="text-slate-300">•</span>
                          <span>{doc.uploaded_at?.split('T')[0]}</span>
                          {doc.governing_law && doc.governing_law !== 'Unknown' && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-indigo-600 font-semibold">{doc.governing_law}</span>
                            </>
                          )}
                        </div>

                        {/* Parties tags */}
                        {doc.parties?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {doc.parties.slice(0, 2).map((party, idx) => (
                              <span key={idx} className="text-[10px] font-medium bg-slate-50 text-slate-600 py-0.5 px-2 rounded border border-slate-200 truncate max-w-[120px]">
                                {party}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Risks Summary Badges & Actions */}
                    <div className="flex items-center gap-4">
                      {doc.risk_counts && (
                        <div className="flex items-center gap-1.5">
                          {doc.risk_counts.high > 0 && (
                            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 py-0.5 px-2 rounded-full">
                              {doc.risk_counts.high} High
                            </span>
                          )}
                          {doc.risk_counts.high === 0 && doc.risk_counts.medium > 0 && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 py-0.5 px-2 rounded-full">
                              {doc.risk_counts.medium} Med
                            </span>
                          )}
                          {doc.risk_counts.high === 0 && doc.risk_counts.medium === 0 && (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 py-0.5 px-2 rounded-full">
                              Clean
                            </span>
                          )}
                        </div>
                      )}

                      <button 
                        onClick={(e) => handleDeleteDoc(e, doc.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Delete analysis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-25" />
                No agreements analyzed yet.
                <p className="text-xs text-slate-500 mt-1">Upload a PDF or DOCX file to get started.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
