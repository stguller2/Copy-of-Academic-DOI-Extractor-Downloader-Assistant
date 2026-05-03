import { ExtractionResult } from "../types";
import PDFExtractionWorker from '../workers/pdfExtraction.worker?worker';

export const extractDoisFromPdf = async (
  base64: string,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractionResult> => {
  return new Promise<ExtractionResult>((resolve, reject) => {
    const worker = new PDFExtractionWorker();

    worker.onmessage = (event: MessageEvent) => {
      const { type, result, error, progress, message } = event.data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'done') {
        worker.terminate();
        resolve(result);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    };

    worker.postMessage({ base64 });
  });
};
