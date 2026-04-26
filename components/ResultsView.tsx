import React from 'react';
import { 
  CheckCircle2, 
  ClipboardCheck, 
  Copy, 
  Trash2, 
  Info, 
  ShieldCheck, 
  AlertCircle, 
  Library, 
  Zap, 
  Layers, 
  BookOpen, 
  Share2, 
  Download,
  ExternalLink as OpenIcon,
  FileText
} from 'lucide-react';
import { Button } from './Button';
import { ReferenceCard } from './ReferenceCard';
import { ExtractionResult, ReferenceItem, CopiedState } from '../types';
import DOMPurify from 'dompurify';

interface ResultsViewProps {
  result: ExtractionResult;
  onCopyAll: () => void;
  onReset: () => void;
  copiedId: CopiedState;
  onCopy: (text: string, id: CopiedState) => void;
  generateBibTeX: (item: ReferenceItem) => string;
  generateRIS: (item: ReferenceItem) => string;
  getSciHubLink: (doi: string) => string;
  onOpenAll: () => void;
  onDownloadFile: (content: string, filename: string, type: string) => void;
  onDownloadHtml: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  result,
  onCopyAll,
  onReset,
  copiedId,
  onCopy,
  generateBibTeX,
  generateRIS,
  getSciHubLink,
  onOpenAll,
  onDownloadFile,
  onDownloadHtml
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Summary Banner */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 text-green-600 p-3 rounded-2xl">
            <CheckCircle2 size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 
              className="text-xl font-bold text-slate-800 line-clamp-1"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.paperTitle || "Analysis Complete") }}
            />
            <p className="text-slate-500 font-medium">{result.references.length} References with DOI identified</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            onClick={onCopyAll} 
            className={`text-slate-400 font-bold ${copiedId === 'copy-all' ? 'text-green-600 bg-green-50' : 'hover:text-indigo-600'}`}
          >
            {copiedId === 'copy-all' ? <ClipboardCheck size={20} /> : <Copy size={20} />}
            <span>{copiedId === 'copy-all' ? 'Copied All!' : 'Copy All'}</span>
          </Button>
          <div className="w-px h-6 bg-slate-100 hidden md:block" />
          <Button variant="ghost" onClick={onReset} className="text-slate-400 hover:text-rose-500 font-bold">
            <Trash2 size={20} />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Research & Proxy Note */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-6 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
        <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shrink-0">
          <Info size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-indigo-900 flex items-center gap-2">
            <ShieldCheck size={16} />
            Safe Dynamic Proxy Active
          </h4>
          <p className="text-sm text-indigo-700 leading-relaxed mt-1">
            Our system automatically rotates between multiple Sci-Hub mirrors to find your paper. 
            <span className="font-semibold block mt-1">Note: Papers published after 2021 may have limited availability.</span>
          </p>
        </div>
      </div>

      {/* Reference List */}
      <div className="grid grid-cols-1 gap-6">
        {result.references.length > 0 ? (
          result.references.map((item, idx) => (
            <ReferenceCard 
              key={idx}
              item={item}
              index={idx}
              onCopy={onCopy}
              copiedId={copiedId}
              generateBibTeX={generateBibTeX}
              getSciHubLink={getSciHubLink}
            />
          ))
        ) : (
          <div className="bg-white py-20 rounded-[2.5rem] border border-slate-100 text-center flex flex-col items-center">
            <div className="bg-slate-50 p-6 rounded-full mb-4 text-slate-300">
              <Library size={48} />
            </div>
            <h3 className="text-xl font-bold text-slate-700">No DOIs Detected</h3>
            <Button variant="secondary" className="mt-8" onClick={onReset}>Try Another PDF</Button>
          </div>
        )}
      </div>

      {/* Bulk Download Info */}
      {result.references.length > 0 && (
        <div className="bg-indigo-900 text-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Zap size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Layers size={28} />
              Batch Actions & Bulk Download
            </h3>
            <p className="mb-8 text-indigo-100 max-w-2xl leading-relaxed text-lg">
              Process all extracted references at once. You can open all links in tabs or download a portable research binder.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                variant="primary" 
                className="bg-white text-indigo-900 hover:bg-indigo-50 border-none px-8 py-4 rounded-2xl font-bold shadow-xl"
                onClick={onOpenAll}
              >
                <OpenIcon size={20} />
                Open All Links ({result.references.length})
              </Button>
              
              <Button 
                variant="secondary" 
                className="bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700 px-8 py-4 rounded-2xl font-bold"
                onClick={() => {
                  const bibContent = result.references.map(generateBibTeX).join('\n\n');
                  onDownloadFile(bibContent, 'references.bib', 'text/plain');
                }}
              >
                <BookOpen size={20} />
                Export BibTeX
              </Button>

              <Button 
                variant="secondary" 
                className="bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700 px-8 py-4 rounded-2xl font-bold"
                onClick={() => {
                  const risContent = result.references.map(generateRIS).join('\n\n');
                  onDownloadFile(risContent, 'references.ris', 'text/plain');
                }}
              >
                <Share2 size={20} />
                Export RIS
              </Button>

              <Button 
                variant="secondary" 
                className="bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700 px-8 py-4 rounded-2xl font-bold"
                onClick={onDownloadHtml}
              >
                <Download size={20} />
                HTML Binder
              </Button>
              
              <Button 
                variant="ghost" 
                className="text-indigo-200 hover:bg-white/10 px-8 py-4 rounded-2xl"
                onClick={() => {
                  const text = result.references.map(r => `${r.title}\nDOI: ${r.doi}\nDownload: ${getSciHubLink(r.doi)}\n`).join('\n---\n\n');
                  onDownloadFile(text, 'reading_list.txt', 'text/plain');
                }}
              >
                <FileText size={20} />
                Export Text List
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
