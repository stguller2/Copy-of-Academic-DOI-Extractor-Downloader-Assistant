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
  getSciHubLink: (doi: string) => string;
  onOpenAll: () => void;
  onDownloadFile: (content: string, filename: string, type: string) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  result,
  onCopyAll,
  onReset,
  copiedId,
  onCopy,
  getSciHubLink,
  onOpenAll,
  onDownloadFile,
}) => {
  // Copy all APA 6 references
  const copyAllAPA = () => {
    const apaList = result.references
      .filter(r => r.apa6)
      .map((r, i) => r.apa6)
      .join('\n\n');
    onCopy(apaList || 'No APA citations available', 'copy-all-apa');
  };

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
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="ghost" 
            onClick={copyAllAPA} 
            className={`font-bold ${copiedId === 'copy-all-apa' ? 'text-green-600 bg-green-50' : 'text-indigo-600 hover:bg-indigo-50'}`}
          >
            {copiedId === 'copy-all-apa' ? <ClipboardCheck size={18} /> : <BookOpen size={18} />}
            <span>{copiedId === 'copy-all-apa' ? 'Copied All!' : 'Copy All APA References'}</span>
          </Button>
          <div className="w-px h-6 bg-slate-100 hidden md:block" />
          <Button variant="ghost" onClick={onReset} className="text-slate-400 hover:text-rose-500 font-bold">
            <Trash2 size={18} />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Proxy Info */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm">
        <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shrink-0">
          <ShieldCheck size={20} />
        </div>
        <p className="text-sm text-indigo-700 leading-relaxed">
          <span className="font-bold">Dynamic Proxy Active:</span> Download links rotate between mirrors automatically.
          Papers after 2021 may have limited availability.
        </p>
      </div>

      {/* Skipped Notification */}
      {result.skippedCount > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4 text-amber-800 shadow-sm">
          <AlertCircle size={20} className="flex-shrink-0" />
          <p className="font-medium text-sm">
            <span className="font-bold">{result.skippedCount}</span> references without DOI were skipped.
          </p>
        </div>
      )}

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

      {/* Batch Actions */}
      {result.references.length > 0 && (
        <div className="bg-indigo-900 text-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Zap size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Layers size={28} />
              Batch Actions
            </h3>
            <p className="mb-8 text-indigo-100 max-w-2xl leading-relaxed text-lg">
              Export all references at once or open all download links in new tabs.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                variant="primary" 
                className="bg-white text-indigo-900 hover:bg-indigo-50 border-none px-8 py-4 rounded-2xl font-bold shadow-xl"
                onClick={onOpenAll}
              >
                <OpenIcon size={20} />
                Open All Downloads ({result.references.length})
              </Button>
              
              <Button 
                variant="secondary" 
                className="bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700 px-8 py-4 rounded-2xl font-bold"
                onClick={() => {
                  const apaContent = result.references
                    .filter(r => r.apa6)
                    .map(r => r.apa6)
                    .join('\n\n');
                  onDownloadFile(apaContent, 'references_apa6.txt', 'text/plain');
                }}
              >
                <BookOpen size={20} />
                Export APA 6 References
              </Button>

              <Button 
                variant="secondary" 
                className="bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700 px-8 py-4 rounded-2xl font-bold"
                onClick={() => {
                  const risContent = result.references.map(r => 
                    `TY  - JOUR\nTI  - ${r.title}\nDO  - ${r.doi}${r.authors ? '\n' + r.authors.map(a => `AU  - ${a}`).join('\n') : ''}${r.year ? `\nPY  - ${r.year}` : ''}${r.journal ? `\nJO  - ${r.journal}` : ''}${r.volume ? `\nVL  - ${r.volume}` : ''}${r.issue ? `\nIS  - ${r.issue}` : ''}${r.pages ? `\nSP  - ${r.pages}` : ''}\nUR  - https://doi.org/${r.doi}\nER  - `
                  ).join('\n\n');
                  onDownloadFile(risContent, 'references.ris', 'text/plain');
                }}
              >
                <Share2 size={20} />
                Export RIS (Zotero/Mendeley)
              </Button>

              <Button 
                variant="ghost" 
                className="text-indigo-200 hover:bg-white/10 px-8 py-4 rounded-2xl"
                onClick={() => {
                  const text = result.references.map((r, i) => 
                    `[${i+1}] ${r.apa6 || r.title}\n    Download: ${getSciHubLink(r.doi)}`
                  ).join('\n\n');
                  onDownloadFile(text, 'reading_list.txt', 'text/plain');
                }}
              >
                <FileText size={20} />
                Export Reading List
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
