
import express from 'express';
import { z } from 'zod';
import { getLlama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { logger } from '../middleware/logging';

const router = express.Router();

const MODEL_DIR = path.join(process.cwd(), "models");
const MODEL_PATH = path.join(MODEL_DIR, "bonsai-1.7b-q1_0.gguf");
const MODEL_URL = "https://huggingface.co/prism-ml/Bonsai-1.7B-gguf/resolve/main/Bonsai-1.7B-q1_0.gguf";

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
    logger.info('SaaS-Engine: Loading model with Metal/GPU acceleration...');
    
    const llama = await getLlama();
    
    // explicit GPU optimization for Mac (Metal)
    modelPtr = await llama.loadModel({ 
      modelPath: MODEL_PATH,
      gpuLayers: 32 // Move all layers to GPU if possible
    });
    
    contextPtr = await modelPtr.createContext({ 
      contextSize: 4096 // Increased for better extraction context
    });
    
    initStatus = 'ready';
    initRetries = 0; // Reset retries on success
    logger.info('SaaS-Engine: Local AI is RESIDENT and optimized for high-concurrency.');
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
 * Metadata Refinement (Official APIs)
 * Highly parallelized for SaaS speed
 */
router.post('/refine', async (req, res) => {
  try {
    const validated = RefineSchema.parse(req.body);
    
    // Increase parallelism for SaaS speed, but keep a reasonable limit
    const cleanReferences = await Promise.all(validated.references
      .slice(0, 100)
      .map(async (ref) => {
        const cleanDoi = ref.doi.trim();
        
        // Parallel check OpenAlex and Crossref
        const results = await Promise.allSettled([
          axios.get(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`, {
            timeout: 4000,
            headers: { 'User-Agent': 'AcademicDOIApp/1.0 (mailto:admin@doiscan.ai)' }
          }),
          axios.get(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
            timeout: 4000,
            headers: { 'User-Agent': 'AcademicDOIApp/1.0 (mailto:admin@doiscan.ai)' }
          })
        ]);

        for (const res of results) {
          if (res.status === 'fulfilled') {
            const data = res.value.data;
            const title = data?.title || data?.message?.title?.[0];
            if (title) return { 
              title, 
              doi: cleanDoi, 
              isVerified: true, 
              source: 'official' as const 
            };
          }
        }

        return { 
          title: ref.title, 
          doi: cleanDoi, 
          isVerified: false, 
          source: 'ai' as const 
        };
      }));

    res.json({ references: cleanReferences, skippedCount: 0 });
  } catch (error: any) {
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
