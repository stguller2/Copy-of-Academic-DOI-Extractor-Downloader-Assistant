import React, { useState } from 'react';
import { 
  Library, 
  AlertCircle,
  Clock,
  BookOpen,
  CreditCard,
  Info,
  Type,
  Layout,
  Hash,
  FileCheck,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, ReferenceItem } from './types';
import { Button } from './components/Button';
import { useExtraction } from './hooks/useExtraction';
import { UploadZone } from './components/UploadZone';
import { ResultsView } from './components/ResultsView';

const App: React.FC = () => {
  const {
    appState,
    result,
    error,
    progress,
    progressMessage,
    copiedId,
    useAI,
    setUseAI,
    aiStatus,
    handleFileUpload,
    copyToClipboard,
    reset
  } = useExtraction();

  const [showHelp, setShowHelp] = useState(false);

  // BibTeX Generation
  const generateBibTeX = (item: ReferenceItem) => {
    const key = item.title.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + new Date().getFullYear();
    return `@article{${key},\n  title = {${item.title}},\n  doi = {${item.doi}},\n  url = {https://doi.org/${item.doi}},\n  journal = {Extracted via Academic DOI Linker}\n}`;
  };

  // RIS Generation
  const generateRIS = (item: ReferenceItem) => {
    return `TY  - JOUR\nTI  - ${item.title}\nDO  - ${item.doi}\nUR  - https://doi.org/${item.doi}\nER  - `;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSciHubLink = (doi: string) => `/api/scihub/download/${encodeURIComponent(doi)}`;

  const copyAllReferences = () => {
    if (!result) return;
    const text = result.references.map((r, i) => `${i + 1}. ${r.title}\nDOI: ${r.doi}\nURL: https://doi.org/${r.doi}`).join('\n\n');
    copyToClipboard(text, 'copy-all');
  };

  const openAllLinks = () => {
    if (!result || result.references.length === 0) return;
    const count = result.references.length;
    const confirmMessage = `IMPORTANT: This will attempt to open ${count} new tabs.\n\nMost browsers will BLOCK these pop-ups. Please select "Always allow" for this site.\n\nDo you want to proceed?`;

    if (window.confirm(confirmMessage)) {
      result.references.forEach((item, index) => {
        setTimeout(() => {
          window.open(getSciHubLink(item.doi), '_blank');
        }, index * 600);
      });
    }
  };

  const downloadHtmlBinder = () => {
    if (!result) return;
    const htmlContent = `<!DOCTYPE html><html><head><title>Research Dashboard</title><style>body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f9fafb; }.card { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 12px; margin-bottom: 16px; }.title { font-weight: bold; color: #4f46e5; text-decoration: none; }.btn { display: inline-block; background: #4f46e5; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; margin-top: 10px; }</style></head><body><h1>${result.paperTitle || 'Research References'}</h1>${result.references.map(r => `<div class="card"><a href="https://doi.org/${r.doi}" class="title" target="_blank">${r.title}</a><p>DOI: ${r.doi}</p><a href="${getSciHubLink(r.doi)}" class="btn" target="_blank">Download Full Text</a></div>`).join('')}</body></html>`;
    downloadFile(htmlContent, 'Research_Dashboard.html', 'text/html');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-slate-900">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 text-indigo-600 rounded-2xl mb-4 shadow-sm">
          <Library size={32} />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
          Academic DOI Linker
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto font-medium">
          Extract cited articles from your PDF and download them directly.
        </p>
      </header>

      <main>
        {appState === AppState.IDLE && (
          <div className="space-y-12">
            <UploadZone 
              onFileUpload={handleFileUpload}
              showHelp={showHelp}
              setShowHelp={setShowHelp}
              useAI={useAI}
              setUseAI={setUseAI}
              aiStatus={aiStatus}
            />

            {/* Pricing Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PricingCard title="Free Plan" price="$0" features={["3 PDFs per day", "BibTeX Export", "RIS Export"]} buttonText="Current Plan" variant="secondary" />
              <PricingCard title="Researcher Pro" price="$4.99" features={["Unlimited PDFs", "Batch Download", "Priority Support"]} buttonText="Upgrade Now" variant="primary" isBestValue />
              <PricingCard title="Lab / Team" price="$19" features={["Up to 10 members", "Shared Library", "Admin Dashboard"]} buttonText="Contact Sales" variant="secondary" />
            </div>

            {/* Trust Badges */}
            <div className="bg-slate-50 rounded-[2.5rem] p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <Badge icon={<Clock size={24} />} title="Save 2+ Hours" desc="Per paper analyzed." />
              <Badge icon={<BookOpen size={24} />} title="Zotero Ready" desc="Direct BibTeX/RIS exports." />
              <Badge icon={<CreditCard size={24} />} title="Student Friendly" desc="Affordable academic pricing." />
            </div>

            <AnimatePresence>
              {showHelp && <HelpSection onCollapse={() => setShowHelp(false)} />}
            </AnimatePresence>
          </div>
        )}

        {appState === AppState.EXTRACTING && (
          <LoadingView progress={progress} message={progressMessage} />
        )}

        {appState === AppState.ERROR && (
          <ErrorView error={error} onReset={reset} />
        )}

        {appState === AppState.SUCCESS && result && (
          <ResultsView 
            result={result}
            onCopyAll={copyAllReferences}
            onReset={reset}
            copiedId={copiedId}
            onCopy={copyToClipboard}
            getSciHubLink={getSciHubLink}
            onOpenAll={openAllLinks}
            onDownloadFile={downloadFile}
          />
        )}

      </main>
    </div>
  );
};

// Sub-components for cleaner App.tsx
const PricingCard = ({ title, price, features, buttonText, variant, isBestValue }: any) => (
  <div className={`p-8 rounded-[2rem] border ${isBestValue ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 relative' : 'bg-white border-slate-100 shadow-sm'}`}>
    {isBestValue && <div className="absolute top-0 right-0 p-4 bg-indigo-500 text-white text-[10px] font-bold uppercase rounded-bl-xl">Best Value</div>}
    <h4 className="text-lg font-bold mb-2">{title}</h4>
    <div className="text-3xl font-black mb-6">{price}<span className="text-sm font-medium opacity-60">/mo</span></div>
    <ul className="space-y-3 text-sm mb-8">
      {features.map((f: string) => <li key={f} className="flex items-center gap-2"><CheckCircle2 size={16} /> {f}</li>)}
    </ul>
    <Button variant={variant} className={`w-full rounded-xl ${isBestValue ? 'bg-white text-indigo-600' : ''}`}>{buttonText}</Button>
  </div>
);

const Badge = ({ icon, title, desc }: any) => (
  <div className="text-center">
    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-indigo-600">{icon}</div>
    <h5 className="font-bold text-slate-800 mb-2">{title}</h5>
    <p className="text-slate-500 text-xs">{desc}</p>
  </div>
);

const LoadingView = ({ progress, message }: any) => (
  <div className="bg-white rounded-[2.5rem] p-16 shadow-xl text-center max-w-2xl mx-auto">
    <div className="relative w-24 h-24 mx-auto mb-8">
      <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
    </div>
    <h3 className="text-2xl font-bold text-slate-800 mb-2">Processing Document</h3>
    <p className="text-slate-400 font-medium mb-8">{message}</p>
    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-4">
      <motion.div className="h-full bg-indigo-600" animate={{ width: `${progress}%` }} />
    </div>
  </div>
);

const ErrorView = ({ error, onReset }: any) => (
  <div className="bg-rose-50 border-2 border-rose-100 rounded-[2.5rem] p-12 text-center">
    <AlertCircle size={48} className="text-rose-500 mx-auto mb-6" />
    <h3 className="text-2xl font-bold text-rose-800 mb-3">Something went wrong</h3>
    <p className="text-rose-600 mb-10 max-w-md mx-auto">{error}</p>
    <Button variant="primary" className="bg-rose-600" onClick={onReset}>Try Again</Button>
  </div>
);

const HelpSection = ({ onCollapse }: any) => (
  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
    <div className="flex items-center gap-3 mb-6"><Info size={20} className="text-indigo-600" /><h4 className="text-lg font-bold">Extraction Tips</h4></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <HelpItem icon={<Type size={18} />} title="Selectable Text" desc="PDF must have text, not just images." />
      <HelpItem icon={<Layout size={18} />} title="Bibliography" desc="Ensure a clear references section." />
      <HelpItem icon={<Hash size={18} />} title="Visible DOIs" desc="The tool looks for standard DOI strings." />
      <HelpItem icon={<FileCheck size={18} />} title="File Quality" desc="Standard academic layouts work best." />
    </div>
    <button onClick={onCollapse} className="mt-8 text-slate-400 text-xs font-bold flex items-center gap-1 mx-auto"><ChevronUp size={14} /> Collapse</button>
  </motion.div>
);

const HelpItem = ({ icon, title, desc }: any) => (
  <div className="flex gap-4">
    <div className="text-indigo-500 shrink-0">{icon}</div>
    <div><p className="font-bold text-sm mb-1">{title}</p><p className="text-slate-500 text-xs">{desc}</p></div>
  </div>
);

export default App;
