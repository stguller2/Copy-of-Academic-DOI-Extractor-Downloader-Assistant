import React from 'react';
import { Download, Copy, Quote, ExternalLink, ClipboardCheck } from 'lucide-react';
import { Button } from './Button';
import { ReferenceItem, CopiedState } from '../types';
import DOMPurify from 'dompurify';

interface ReferenceCardProps {
  item: ReferenceItem;
  index: number;
  onCopy: (text: string, id: CopiedState) => void;
  copiedId: CopiedState;
  generateBibTeX: (item: ReferenceItem) => string;
  getSciHubLink: (doi: string) => string;
}

export const ReferenceCard: React.FC<ReferenceCardProps> = ({
  item,
  index,
  onCopy,
  copiedId,
  generateBibTeX,
  getSciHubLink
}) => {
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
            {index + 1}
          </div>
          {item.isVerified ? (
            <span className="flex items-center gap-1 font-mono bg-emerald-50 px-2 py-0.5 rounded text-[10px] text-emerald-600 font-bold uppercase tracking-wider border border-emerald-100">
              <ClipboardCheck size={10} />
              Verified Metadata
            </span>
          ) : (
            <span className="font-mono bg-slate-50 px-2 py-0.5 rounded text-[10px] text-slate-400 font-bold uppercase tracking-wider border border-slate-100">
              {item.source === 'ai' ? 'AI Extracted' : 'Regex Identified'}
            </span>
          )}
        </div>
        <h4 
          className="text-xl font-bold text-slate-800 leading-tight mb-3 group-hover:text-indigo-600 transition-colors"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.title) }}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-400">
          <span className="font-mono bg-slate-50 px-2 py-1 rounded-md flex items-center gap-2 text-xs border border-slate-100">
            DOI: {item.doi}
            <button 
              onClick={() => onCopy(item.doi, `doi-${index}`)}
              className="hover:text-indigo-600 transition-colors p-0.5 hover:bg-white rounded"
              title="Copy DOI"
            >
              <Copy size={12} />
            </button>
          </span>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <a 
          href={getSciHubLink(item.doi)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex-1 lg:flex-none"
        >
          <Button variant="primary" className="w-full py-4 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-transform active:scale-95">
            <Download size={20} />
            <span>Direct Download</span>
          </Button>
        </a>
        
        <div className="flex gap-2 w-full lg:w-auto">
          <div className="flex gap-2 w-full">
            <Button 
              variant="ghost" 
              onClick={() => onCopy(generateBibTeX(item), index)}
              className={`flex-1 lg:flex-none py-4 px-5 rounded-2xl transition-all ${copiedId === index ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              title="Copy BibTeX (for Zotero/Mendeley)"
            >
              {copiedId === index ? <ClipboardCheck size={20} /> : <Quote size={20} />}
              <span className="text-xs font-bold ml-1">BibTeX</span>
            </Button>
            
            <a 
              href={`https://doi.org/${item.doi}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 lg:flex-none"
            >
              <Button variant="ghost" className="w-full py-4 px-5 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Open official DOI.org page">
                <ExternalLink size={20} />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
