
import * as pdfjs from 'pdfjs-dist';

// Use Vite's built-in worker loader for maximum compatibility in the preview environment.
// This bundles the worker and avoids "Failed to fetch dynamically imported module" errors.
// @ts-ignore
import PDFWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// @ts-ignore
pdfjs.GlobalWorkerOptions.workerPort = new PDFWorker();

import { ExtractionResult, ReferenceItem } from "../types";

// Helper to convert base64 to Uint8Array safely
const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const extractDoisFromPdf = async (base64Pdf: string): Promise<ExtractionResult> => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Extraction timeout after 30 seconds")), 30000)
  );

  const extractionPromise = (async () => {
    try {
      const data = base64ToUint8Array(base64Pdf);
      
      // 1. Magic Byte Validation (%PDF-)
      const magic = String.fromCharCode(...data.slice(0, 5));
      if (magic !== '%PDF-') {
        throw new Error("INVALID_PDF_FORMAT: Magic bytes mismatch");
      }

      const loadingTask = pdfjs.getDocument({
        data: data,
        useSystemFonts: true,
        stopAtErrors: false,
        disableFontFace: true, // Security feature
      });

      const pdf = await loadingTask.promise;
      
      // 2. Page Limit Guard
      const totalPages = Math.min(pdf.numPages, 150);
      
      let fullText = "";
      let paperTitle = "Extracted Document";

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // 3. Text Sanitization (Strip null bytes, control chars, Unicode direction overrides)
        const pageText = textContent.items
          .map((item: any) => {
            return item.str
              .replace(/[\x00-\x1F\x7F]/g, "") // Control chars
              .replace(/[\u202E\u202D\u202B\u202A\u200E\u200F]/g, ""); // Direction overrides
          })
          .join(" ");
        
        fullText += pageText + "\n";

        // 4. Memory Guard (2MB limit)
        if (fullText.length > 2 * 1024 * 1024) {
          throw new Error("MEMORY_GUARD: Extracted text exceeds 2MB limit");
        }

        if (i === 1) {
          const firstLines = textContent.items
            .map((item: any) => item.str)
            .filter((str: string) => str.trim().length > 10);
          if (firstLines.length > 0) {
            paperTitle = firstLines[0];
          }
        }
      }

      if (!fullText.trim()) {
        throw new Error("No text content extracted.");
      }

    // DOI Regex: 10.xxxx/yyyy
    const doiRegex = /10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]{5,}/g;
    const matches = fullText.match(doiRegex) || [];
    
    const uniqueDois = Array.from(new Set(matches.map(d => d.replace(/[.,;]$/, ""))))
      .filter(doi => !doi.toLowerCase().startsWith("10.13039")); // DROP funder DOIs
    const references: ReferenceItem[] = [];

    uniqueDois.forEach(cleanDoi => {
      // Find all positions of this DOI
      const indices: number[] = [];
      let lastIndex = fullText.indexOf(cleanDoi);
      while (lastIndex !== -1) {
        indices.push(lastIndex);
        lastIndex = fullText.indexOf(cleanDoi, lastIndex + 1);
      }

      // We usually want the DOI in the bibliography, which is typically towards the end
      // or preceded by a citation number/list pattern.
      // We'll pick the index that has the most "bibliographic" looking context before it.
      let bestIndex = indices[0];
      let maxBibliographicScore = -1;

      indices.forEach(idx => {
        const context = fullText.substring(Math.max(0, idx - 100), idx);
        // Scores higher if preceded by patterns like [21], 21., or Author (Year)
        const score = (context.match(/\[\d+\]|\d+\.\s+|(\d{4})/) ? 10 : 0);
        if (score >= maxBibliographicScore) {
          maxBibliographicScore = score;
          bestIndex = idx;
        }
      });

      const index = bestIndex;
      if (index === undefined) return;

      // Capture a larger context before the DOI
      const contextBefore = fullText.substring(Math.max(0, index - 350), index);
      
      // Clean up common "noise" that appears right before a DOI
      let cleanContext = contextBefore
        .replace(/https?:\/\/\S+/g, '') // Remove URLs
        .replace(/doi:?\s*$/i, '')       // Remove "doi:" prefix
        .replace(/\s+/g, ' ')            // Normalize whitespace
        .trim();

      // HEURISTIC: In most academic styles (APA, MLA, IEEE):
      const segments = cleanContext.split(/(?:\.\s+|"\s*|\(\d{4}\)\s+)/);
      
      let bestTitle = "Cited Article";
      let maxScore = -1;

      // Look at the last 4 segments to find the most "title-like" string
      const candidateSegments = segments.slice(-4); 
      
      candidateSegments.forEach(seg => {
        // Local Title Cleaner: Aggressively strip noise from the segment
        let s = seg.trim();
        
        // 1. Strip leading bibliography clutter
        s = s.replace(/^[\d\s.\-–—\[\](),]+/, '');
        
        // 2. Strip Authors (Surname, I. pattern or Surname Molognoni, etc.)
        // Match words starting with capital followed by comma or initials
        s = s.replace(/^([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(,\s+[A-Z]\.|\s+[A-Z]\.|\s+[A-Z][a-z]+)*[;,\s]+)+/, "");
        s = s.replace(/^([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(\s+[A-Z])+[;,]\s+)+/, "");
        
        // 3. Strip Journal metadata at end (e.g., 27 (2020) 40355...)
        s = s.replace(/,\s*\d+.*$/, '');
        s = s.replace(/\d+\s*\(\d{4}\)\s*\d+[-–—]\d+.*$/, ''); 
        
        // 4. Strip trailing comma/period
        s = s.replace(/[,.]\s*$/, '').trim();
          
        if (s.length < 15 || s.length > 250) return;
        
        // Scoring: words, mixed case, length balance
        const words = s.split(/\s+/).length;
        const upperCount = (s.match(/[A-Z]/g) || []).length;
        const score = words + (upperCount > 2 ? 5 : 0);

        if (score > maxScore) {
          maxScore = score;
          bestTitle = s;
        }
      });
      
      if (bestTitle.length < 15 || bestTitle === "Cited Article") {
        const fallback = cleanContext.split(/[.!?]/).pop()?.trim() || "";
        bestTitle = fallback.length > 20 ? fallback : `Article: ${cleanDoi}`;
      }

      references.push({
        title: bestTitle.substring(0, 250),
        doi: cleanDoi
      });
    });

    // Prioritize the end of the document for rawText as references are usually there
    const tailLength = 10000;
    const bibliographyText = fullText.length > tailLength 
      ? fullText.substring(fullText.length - tailLength) 
      : fullText;

    return {
      paperTitle,
      references,
      skippedCount: 0,
      rawText: bibliographyText
    };
  } catch (error: any) {
    throw error;
  }
})();

  return Promise.race([extractionPromise, timeoutPromise]) as Promise<ExtractionResult>;
};
