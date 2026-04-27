
import express from 'express';
import { z } from 'zod';
import { getLlama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { logger } from '../middleware/logging';

const router = express.Router();

const MODEL_DIR = path.join(process.cwd(), "models");
const MODEL_PATH = path.join(MODEL_DIR, "smollm2-1.7b-instruct-q4_k_m.gguf");
const MODEL_URL = "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf";

let modelPtr: LlamaModel | null = null;
let contextPtr: LlamaContext | null = null;
let initStatus: 'idle' | 'downloading' | 'loading' | 'ready' | 'error' = 'idle';
let downloadProgress = 0;
let errorMessage = "";
let initRetries = 0;
const MAX_RETRIES = 5;

/**
 * Queue Management:
 * Ensures we don't overwhelm the local LLM with multiple concurrent requests.
 */
class AIQueue {
  private queue: Array<{ 
    resolve: (val: any) => void, 
    reject: (err: any) => void, 
    task: () => Promise<any> 
  }> = [];
  private processing = false;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, task });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const { resolve, reject, task } = this.queue.shift()!;
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      this.process(); // Process next in queue
    }
  }

  get length() { return this.queue.length; }
}

const aiQueue = new AIQueue();

/**
 * Background Initialization:
 * Triggers as soon as the server starts.
 */
export async function initializeLocalModel() {
  if (initStatus === 'ready' || initStatus === 'downloading' || initStatus === 'loading') return;

  try {
    if (!fs.existsSync(MODEL_DIR)) fs.mkdirSync(MODEL_DIR, { recursive: true });

    if (!fs.existsSync(MODEL_PATH)) {
      initStatus = 'downloading';
      logger.info({ url: MODEL_URL }, 'SaaS-Engine: Starting model download...');
      
      const response = await axios({ 
        method: "get", 
        url: MODEL_URL, 
        responseType: "stream"
      });

      const totalLength = parseInt(response.headers['content-length'] || "0", 10);
      let downloadedLength = 0;
      const writer = fs.createWriteStream(MODEL_PATH);
      
      response.data.on('data', (chunk: any) => {
        downloadedLength += chunk.length;
        if (totalLength > 0) {
          downloadProgress = Math.round((downloadedLength / totalLength) * 100);
        }
      });

      response.data.pipe(writer);
      
      await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", (err) => {
          fs.unlink(MODEL_PATH, () => {});
          reject(err);
        });
      });
      logger.info('SaaS-Engine: Download complete');
    }

    initStatus = 'loading';
    logger.info('SaaS-Engine: Loading model (auto-detect: CUDA / CPU / Metal)...');
    
    // node-llama-cpp auto-detects the best backend:
    // Linux + NVIDIA GPU → CUDA
    // Linux without GPU  → CPU
    // macOS Apple Silicon → Metal
    const llama = await getLlama();
    
    // GPU_LAYERS env var: default 0 (CPU-only, no GPU required)
    const gpuLayersEnv = process.env.GPU_LAYERS;
    const gpuLayers = gpuLayersEnv === undefined ? 0 
                    : gpuLayersEnv === "auto" ? "auto" as const
                    : parseInt(gpuLayersEnv, 10);
    
    modelPtr = await llama.loadModel({ 
      modelPath: MODEL_PATH,
      gpuLayers: gpuLayers
    });
    
    // CPU-only: smaller context = faster inference
    contextPtr = await modelPtr.createContext({ 
      contextSize: 2048
    });
    
    initStatus = 'ready';
    initRetries = 0;
    logger.info({ gpuLayers }, 'SaaS-Engine: Local AI is RESIDENT. Hardware acceleration active.');
  } catch (err: any) {
    initStatus = 'error';
    errorMessage = err.message;
    logger.error({ error: err.message, retry: initRetries }, 'SaaS-Engine: Init Failed');
    
    if (initRetries < MAX_RETRIES) {
      initRetries++;
      const delay = Math.pow(2, initRetries) * 1000;
      logger.info({ delay }, 'SaaS-Engine: Retrying initialization...');
      setTimeout(initializeLocalModel, delay);
    }
  }
}

const RefineSchema = z.object({
  references: z.array(z.object({
    title: z.string(),
    doi: z.string()
  }))
});

// Endpoint to check background status & Health
router.get('/status', (req, res) => {
  res.json({ 
    status: initStatus, 
    progress: downloadProgress,
    queueLength: aiQueue.length,
    isHealthy: initStatus === 'ready' && !!contextPtr,
    error: errorMessage
  });
});

/**
 * APA 6th Edition Citation Formatter
 * Format: Author, A. A., & Author, B. B. (Year). Title. Journal, volume(issue), pages. https://doi.org/xxx
 */
function formatAPA6(meta: {
  title: string;
  doi: string;
  authors?: string[];
  year?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}): string {
  let citation = '';

  // Authors
  if (meta.authors && meta.authors.length > 0) {
    if (meta.authors.length === 1) {
      citation += meta.authors[0];
    } else if (meta.authors.length === 2) {
      citation += `${meta.authors[0]}, & ${meta.authors[1]}`;
    } else if (meta.authors.length <= 7) {
      const allButLast = meta.authors.slice(0, -1).join(', ');
      citation += `${allButLast}, & ${meta.authors[meta.authors.length - 1]}`;
    } else {
      // APA 6: 7+ authors → first 6, ..., last
      const firstSix = meta.authors.slice(0, 6).join(', ');
      citation += `${firstSix}, . . . ${meta.authors[meta.authors.length - 1]}`;
    }
  }

  // Year
  citation += ` (${meta.year || 'n.d.'}).`;

  // Title (sentence case, no italic for articles)
  citation += ` ${meta.title}.`;

  // Journal (italic in APA, we use plain text for copy)
  if (meta.journal) {
    citation += ` ${meta.journal}`;
    if (meta.volume) {
      citation += `, ${meta.volume}`;
      if (meta.issue) {
        citation += `(${meta.issue})`;
      }
    }
    if (meta.pages) {
      citation += `, ${meta.pages}`;
    }
    citation += '.';
  }

  // DOI
  citation += ` https://doi.org/${meta.doi}`;

  return citation.trim();
}

/**
 * Extract author names in "Surname, I." format from Crossref data
 */
function parseCrossrefAuthors(authors: any[]): string[] {
  if (!authors || !Array.isArray(authors)) return [];
  return authors.map(a => {
    const family = a.family || '';
    const given = a.given || '';
    if (!family) return given;
    // Convert "John Michael" → "J. M."
    const initials = given.split(/\s+/).map((n: string) => n.charAt(0).toUpperCase() + '.').join(' ');
    return `${family}, ${initials}`;
  });
}

/**
 * Extract author names from OpenAlex data
 */
function parseOpenAlexAuthors(authorships: any[]): string[] {
  if (!authorships || !Array.isArray(authorships)) return [];
  return authorships.map(a => {
    const name = a.author?.display_name || '';
    if (!name) return '';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const surname = parts[parts.length - 1];
    const initials = parts.slice(0, -1).map((n: string) => n.charAt(0).toUpperCase() + '.').join(' ');
    return `${surname}, ${initials}`;
  }).filter(Boolean);
}

/**
 * Fetch metadata for a single DOI with controlled concurrency.
 * Returns enriched reference data with APA 6 citation.
 */
async function fetchSingleDOIMetadata(ref: { title: string; doi: string }): Promise<any> {
  const cleanDoi = ref.doi.trim();
  
  // Parallel fetch from both APIs
  const results = await Promise.allSettled([
    axios.get(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'AcademicDOIApp/1.0 (mailto:admin@doiscan.ai)' }
    }),
    axios.get(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'AcademicDOIApp/1.0 (mailto:admin@doiscan.ai)' }
    })
  ]);

  let title = ref.title;
  let authors: string[] = [];
  let year = '';
  let journal = '';
  let volume = '';
  let issue = '';
  let pages = '';
  let isVerified = false;

  // Try Crossref first (most complete metadata for APA)
  if (results[0].status === 'fulfilled') {
    const msg = results[0].value.data?.message;
    if (msg) {
      title = msg.title?.[0] || title;
      authors = parseCrossrefAuthors(msg.author);
      year = msg.published?.['date-parts']?.[0]?.[0]?.toString() 
          || msg['published-print']?.['date-parts']?.[0]?.[0]?.toString()
          || msg['published-online']?.['date-parts']?.[0]?.[0]?.toString()
          || '';
      journal = msg['container-title']?.[0] || '';
      volume = msg.volume || '';
      issue = msg.issue || '';
      pages = msg.page || '';
      isVerified = true;
    }
  }

  // Fallback to OpenAlex if Crossref failed or missing authors
  if (authors.length === 0 && results[1].status === 'fulfilled') {
    const oaData = results[1].value.data;
    if (oaData) {
      title = oaData.title || title;
      authors = parseOpenAlexAuthors(oaData.authorships);
      year = year || oaData.publication_year?.toString() || '';
      journal = journal || oaData.primary_location?.source?.display_name || '';
      isVerified = true;
    }
  }

  // Even if only OpenAlex worked, fill in what we can
  if (!isVerified && results[1].status === 'fulfilled') {
    const oaData = results[1].value.data;
    if (oaData) {
      title = oaData.title || title;
      year = oaData.publication_year?.toString() || '';
      journal = oaData.primary_location?.source?.display_name || '';
      isVerified = true;
    }
  }

  const meta = { title, doi: cleanDoi, authors, year, journal, volume, issue, pages };
  const apa6 = formatAPA6(meta);

  return { 
    ...meta,
    apa6,
    isVerified, 
    source: isVerified ? 'official' as const : 'regex' as const
  };
}

/**
 * Process DOIs in controlled batches to avoid overwhelming the APIs
 */
async function processInBatches<T>(
  items: any[], 
  processor: (item: any) => Promise<T>, 
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    // Small delay between batches to be polite to APIs
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

/**
 * Metadata Refinement + APA 6 Citation Generator
 * Fetches full bibliographic data from OpenAlex & Crossref, then formats APA 6.
 * 
 * This endpoint works INDEPENDENTLY of the LLM — it only needs DOIs.
 */
router.post('/refine', async (req, res) => {
  try {
    const validated = RefineSchema.parse(req.body);
    
    logger.info({ count: validated.references.length }, 'Refining references with metadata APIs');
    
    // Process in batches of 5 to avoid API throttling
    const cleanReferences = await processInBatches(
      validated.references.slice(0, 100),
      fetchSingleDOIMetadata,
      5
    );

    const verifiedCount = cleanReferences.filter(r => r.isVerified).length;
    logger.info({ total: cleanReferences.length, verified: verifiedCount }, 'Refinement complete');

    res.json({ references: cleanReferences, skippedCount: 0 });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Refinement failed');
    res.status(500).json({ error: 'Refinement failed.' });
  }
});

/**
 * Local AI Extraction (Queued for Stability)
 */
router.post('/extract', async (req, res) => {
  const { text } = req.body;
  
  if (initStatus !== 'ready' || !contextPtr) {
    return res.status(503).json({ 
      error: `Local AI is warming up. Queue: ${aiQueue.length}` 
    });
  }

  try {
    // Add request to the processing queue
    const result = await aiQueue.add(async () => {
      const session = new LlamaChatSession({ 
        contextSequence: contextPtr!.getSequence() 
      });
      
      const prompt = `### INSTRUCTION:
Extract all academic paper citations from the text below. 
Requirements:
1. Return ONLY valid JSON.
2. Format: {"references": [{"title": "Full Paper Title", "doi": "10.xxxx/yyyy"}]}
3. Clean titles (remove author names, page numbers, or years).
4. If no DOI is found for a title, omit it.

### TEXT:
${text.substring(0, 4000)}

### JSON OUTPUT:`;
      
      const aiResponse = await session.prompt(prompt, { 
        maxTokens: 1500, 
        temperature: 0.1,
        repeatPenalty: { penalty: 1.1 }
      });

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI output error: No JSON found");
      return JSON.parse(jsonMatch[0]);
    });

    res.json(result);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Queue processing error');
    res.status(500).json({ error: `AI Processing error: ${error.message}` });
  }
});

export default router;
