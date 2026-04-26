import React from 'react';
import { FileUp, HelpCircle, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './Button';

interface UploadZoneProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  useAI: boolean;
  setUseAI: (use: boolean) => void;
  aiStatus: { status: string; progress: number; queueLength: number; isHealthy: boolean };
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileUpload,
  showHelp,
  setShowHelp,
  useAI,
  setUseAI,
  aiStatus
}) => {
  return (
    <div className="space-y-12">
      <div className="border-4 border-dashed border-slate-200 rounded-[2.5rem] p-16 bg-white flex flex-col items-center transition-all hover:border-indigo-400 hover:bg-indigo-50/20 group relative overflow-hidden">
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex items-center gap-2 text-sm font-semibold"
            title="View extraction tips"
          >
            <HelpCircle size={20} />
            <span className="hidden sm:inline">How it works</span>
          </button>
        </div>

        <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <FileUp size={40} />
        </div>
        <h3 className="text-2xl font-bold mb-2 text-slate-800">Analyze Manuscript</h3>
        <p className="text-slate-500 text-center mb-10 max-w-sm text-base leading-relaxed">
          Drop your academic PDF here. We will extract all references with DOI numbers and provide direct download links.
        </p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf"
          onChange={onFileUpload}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Button variant="primary" as="span" className="px-10 py-4 text-lg rounded-2xl shadow-lg shadow-indigo-100">
            Upload & Analyze
          </Button>
        </label>

        <div className="mt-8 pt-8 border-t border-slate-50 w-full flex flex-col items-center text-center">
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <button 
              onClick={() => setUseAI(true)}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${useAI ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Zap size={14} fill={useAI ? "currentColor" : "none"} />
              Smart Metadata Scan
            </button>
            <button 
              onClick={() => setUseAI(false)}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${!useAI ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Fast Scan
            </button>
          </div>
          
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={14} />
              {useAI ? "Official Metadata Shield: Connecting to Crossref & OpenAlex for 100% accuracy" : "Local Scan: Privacy-focused offline algorithm"}
            </p>
            
            {aiStatus.status !== 'ready' && aiStatus.status !== 'idle' && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Zap size={12} />
                  </motion.div>
                  Background AI Prep: {aiStatus.status} ({aiStatus.progress}%)
                </div>
                <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500" 
                    animate={{ width: `${aiStatus.progress}%` }} 
                  />
                </div>
                {aiStatus.queueLength > 0 && (
                  <div className="text-[9px] font-bold text-amber-500 mt-1 uppercase">
                    Queue: {aiStatus.queueLength} tasks ahead
                  </div>
                )}
              </div>
            )}
            {aiStatus.status === 'ready' && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">
                  <CheckCircle2 size={12} />
                  Local AI Engine Ready
                </div>
                {aiStatus.queueLength > 0 && (
                  <div className="text-[9px] font-bold text-indigo-400 uppercase animate-pulse">
                    Processing: {aiStatus.queueLength} items in queue
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
