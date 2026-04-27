import { useState, useEffect, useCallback } from 'react';
import { AppState, ExtractionResult, CopiedState } from '../types';
import { extractDoisFromPdf } from '../services/pdfService';
import { aiService } from '../services/aiService';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit

export const useExtraction = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [copiedId, setCopiedId] = useState<CopiedState>(null);
  const [useAI, setUseAI] = useState(true);
  const [aiStatus, setAiStatus] = useState({ status: 'idle', progress: 0, queueLength: 0, isHealthy: false });

  // Poll AI Status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await aiService.getStatus();
        setAiStatus(res);
      } catch (e) {
        console.error("Failed to fetch AI status");
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle progress simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (appState === AppState.EXTRACTING) {
      setProgress(5);
      setProgressMessage("Reading document structure...");
      
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev < 30) {
            setProgressMessage("Parsing PDF layers...");
            return prev + 5;
          }
          if (prev < 60) {
            setProgressMessage("Running regex pattern matching...");
            return prev + 3;
          }
          if (prev < 85) {
            setProgressMessage("Fetching metadata from Crossref & OpenAlex...");
            return prev + 1;
          }
          if (prev < 95) {
            setProgressMessage("Generating APA 6 citations...");
            return prev + 0.5;
          }
          return prev;
        });
      }, 200);
    } else {
      setProgress(0);
      setProgressMessage("");
    }
    return () => clearInterval(interval);
  }, [appState]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError("Please upload a valid PDF file.");
      setAppState(AppState.ERROR);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large (max 15MB).");
      setAppState(AppState.ERROR);
      return;
    }

    setAppState(AppState.EXTRACTING);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileContent = reader.result;
        if (typeof fileContent !== 'string') return;
        
        const base64 = fileContent.split(',')[1];
        if (!base64) {
          setError("Failed to read PDF data.");
          setAppState(AppState.ERROR);
          return;
        }

        try {
          // ── Step 1: Regex Extraction (client-side) ──
          const regexData = await extractDoisFromPdf(base64);
          
          if (regexData.references.length === 0) {
            setResult(regexData);
            setAppState(AppState.SUCCESS);
            return;
          }

          // ── Step 2: Metadata Enrichment via Crossref/OpenAlex (server-side) ──
          // This is the CRITICAL step that adds APA 6 citations.
          // It works independently of the LLM — uses official academic APIs.
          setProgress(70);
          setProgressMessage("Fetching metadata from Crossref & OpenAlex...");
          
          try {
            const enrichedData = await aiService.refineReferences(regexData.references);
            
            if (enrichedData.references && enrichedData.references.length > 0) {
              // Merge enriched metadata back onto the original DOI list
              regexData.references = regexData.references.map(regexRef => {
                const enriched = enrichedData.references.find(
                  r => r.doi.toLowerCase() === regexRef.doi.toLowerCase()
                );
                if (enriched) {
                  return {
                    ...regexRef,
                    title: enriched.title || regexRef.title,
                    authors: enriched.authors,
                    year: enriched.year,
                    journal: enriched.journal,
                    volume: enriched.volume,
                    issue: enriched.issue,
                    pages: enriched.pages,
                    apa6: enriched.apa6,
                    isVerified: enriched.isVerified,
                    source: enriched.source
                  };
                }
                return { ...regexRef, source: 'regex' as const };
              });
            }
          } catch (refineErr) {
            console.warn("Metadata enrichment failed, showing regex results:", refineErr);
            // Graceful degradation: regex results are still usable
            regexData.references = regexData.references.map(ref => ({ 
              ...ref, 
              source: 'regex' as const 
            }));
          }

          // ── Step 3 (Optional): AI Discovery ──
          // Try to find DOIs that regex missed (bonus, not critical)
          if (useAI && regexData.rawText) {
            try {
              setProgressMessage("AI scanning for missed references...");
              const aiData = await aiService.extractWithAI(regexData.rawText);
              
              if (aiData.references && aiData.references.length > 0) {
                // Only add genuinely NEW DOIs not already found by regex
                const existingDois = new Set(
                  regexData.references.map(r => r.doi.toLowerCase())
                );
                
                const newRefs = aiData.references.filter(
                  r => !existingDois.has(r.doi.toLowerCase())
                );
                
                if (newRefs.length > 0) {
                  // Enrich the newly discovered references too
                  try {
                    const enrichedNew = await aiService.refineReferences(newRefs);
                    regexData.references.push(...enrichedNew.references.map(r => ({
                      ...r,
                      source: 'ai' as const
                    })));
                  } catch {
                    // Just add them raw if enrichment fails
                    regexData.references.push(...newRefs.map(r => ({
                      ...r,
                      source: 'ai' as const
                    })));
                  }
                }
              }
            } catch (aiErr) {
              // AI is optional — silence errors completely
              console.info("AI discovery skipped:", (aiErr as any)?.message);
            }
          }

          setResult(regexData);
          setAppState(AppState.SUCCESS);
        } catch (err: any) {
          setError(err.message || "Failed to process document.");
          setAppState(AppState.ERROR);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Unexpected error during upload.");
      setAppState(AppState.ERROR);
    }
  };

  const copyToClipboard = useCallback((text: string, id: CopiedState) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      alert("Failed to copy to clipboard.");
    });
  }, []);

  const reset = () => {
    setAppState(AppState.IDLE);
    setResult(null);
    setError(null);
  };

  return {
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
    reset,
    setAppState,
    setResult
  };
};
