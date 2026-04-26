import React from 'react';
import { Download, Copy, ExternalLink, ClipboardCheck, BookOpen } from 'lucide-react';
import { Button } from './Button';
import { ReferenceItem, CopiedState } from '../types';
import DOMPurify from 'dompurify';

interface ReferenceCardProps {
  item: ReferenceItem;
  index: number;
  onCopy: (text: string, id: CopiedState) => void;
  copiedId: CopiedState;
  getSciHubLink: (doi: string) => string;
}

export const ReferenceCard: React.FC<ReferenceCardProps> = ({
  item,
  index,
  onCopy,
  copiedId,
  getSciHubLink
}) => {
  const apaId = `apa-${index}`;
  const doiId = `doi-${index}`;

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col gap-5 group">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
              {index + 1}
            </div>
            {item.isVerified ? (
              <span className="flex items-center gap-1 font-mono bg-emerald-50 px-2 py-0.5 rounded text-[10px] text-emerald-600 font-bold uppercase tracking-wider border border-emerald-100">
                <ClipboardCheck size={10} />
                Verified
              </span>
            ) : (
              <span className="font-mono bg-slate-50 px-2 py-0.5 rounded text-[10px] text-slate-400 font-bold uppercase tracking-wider border border-slate-100">
                {item.source === 'ai' ? 'AI Extracted' : 'Regex'}
              </span>
            )}
          </div>
          <h4 
            className="text-lg font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.title) }}
          />
          {/* Author & Year info line */}
          {item.authors && item.authors.length > 0 && (
            <p className="text-sm text-slate-400 mt-1 font-medium">
              {item.authors.slice(0, 3).join(', ')}{item.authors.length > 3 ? ' et al.' : ''} {item.year ? `(${item.year})` : ''}
              {item.journal ? ` — ${item.journal}` : ''}
            </p>
          )}
        </div>
        
        {/* Download Button */}
        <a 
          href={getSciHubLink(item.doi)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <Button variant="primary" className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-transform active:scale-95">
            <Download size={18} />
            <span>Download PDF</span>
          </Button>
        </a>
      </div>

      {/* APA 6 Citation Block */}
      {item.apa6 && (
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative group/apa">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
              <BookOpen size={12} />
              APA 6th Edition
            </span>
            <button
              onClick={() => onCopy(item.apa6!, apaId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                copiedId === apaId 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200'
              }`}
            >
              {copiedId === apaId ? <ClipboardCheck size={14} /> : <Copy size={14} />}
              {copiedId === apaId ? 'Copied!' : 'Copy Reference'}
            </button>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed font-serif select-all cursor-text">
            {item.apa6}
          </p>
        </div>
      )}

      {/* DOI & Links Row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-slate-400 border border-slate-100">
          DOI: {item.doi}
          <button 
            onClick={() => onCopy(item.doi, doiId)}
            className={`transition-colors p-0.5 rounded ${copiedId === doiId ? 'text-emerald-500' : 'hover:text-indigo-600'}`}
            title="Copy DOI"
          >
            {copiedId === doiId ? <ClipboardCheck size={12} /> : <Copy size={12} />}
          </button>
        </span>
        <a 
          href={`https://doi.org/${item.doi}`} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <Button variant="ghost" className="py-1.5 px-3 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 text-xs" title="Open DOI.org page">
            <ExternalLink size={14} />
            <span>DOI.org</span>
          </Button>
        </a>
      </div>
    </div>
  );
};
