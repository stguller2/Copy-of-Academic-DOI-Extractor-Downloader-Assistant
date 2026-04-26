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
          if (prev < 70) {
            setProgressMessage("Running regex pattern matching...");
            return prev + 3;
          }
          if (prev < 95) {
            setProgressMessage("Cleaning up DOI strings...");
            return prev + 2;
          }
          return prev;
        });
      }, 100);
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
          // 1. Regex Extraction
          let data = await extractDoisFromPdf(base64);
          
          // 2. AI Refinement if enabled
          if (useAI) {
            setProgress(80);
            setProgressMessage("AI is analyzing via Local Engine...");
            
            try {
              const aiData = await aiService.extractWithAI(data.rawText || "");
              if (aiData.references && aiData.references.length > 0) {
                // Merge/Refine logic: Update titles and mark as verified/ai-sourced
                data.references = data.references.map(ref => {
                  const aiRef = aiData.references.find(r => r.doi.toLowerCase() === ref.doi.toLowerCase());
                  return aiRef ? { ...ref, ...aiRef } : { ...ref, source: 'regex' };
                });
              }
            } catch (aiErr) {
              console.warn("AI refinement failed, falling back to regex results:", aiErr);
              data.references = data.references.map(ref => ({ ...ref, source: 'regex' }));
            }
          }

          setResult(data);
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
