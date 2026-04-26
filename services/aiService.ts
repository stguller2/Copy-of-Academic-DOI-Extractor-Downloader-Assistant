
import { ExtractionResult } from "../types";

export class AIService {
  /**
   * Calls the local AI model (Bonsai-1.7B) which is pre-loaded in the background.
   */
  async extractWithAI(text: string): Promise<ExtractionResult> {
    try {
      // 1. Try local extraction
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      // Defensive check: Ensure response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Non-JSON response from server:", errorText.substring(0, 500));
        throw new Error(`Server at ${response.status} returned invalid format: ${errorText.substring(0, 100)}...`);
      }

      const data = await response.json();

      if (response.status === 503) {
        // Model is still downloading/loading in the background
        throw new Error(`AI is warming up... ${data.error}. Please wait a moment.`);
      }

      if (!response.ok) {
        throw new Error(data.error || "AI_FAILED");
      }

      // 2. Refine results using backend metadata shield
      const refineResponse = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: data.references })
      });

      const refineType = refineResponse.headers.get("content-type");
      if (refineResponse.ok && refineType && refineType.includes("application/json")) {
        return await refineResponse.json();
      }

      return data;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      throw new Error(error.message || "Local AI is currently preparing in the background.");
    }
  }

  async getStatus(): Promise<{ status: string; progress: number }> {
    try {
      const res = await fetch("/api/ai/status");
      return await res.json();
    } catch {
      return { status: "unknown", progress: 0 };
    }
  }

  isLoaded(): boolean {
    return true; 
  }
}

export const aiService = new AIService();
