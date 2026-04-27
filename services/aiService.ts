
import { ExtractionResult, ReferenceItem } from "../types";

export class AIService {
  /**
   * Primary method: Enrich existing regex-extracted references with
   * Crossref/OpenAlex metadata and APA 6 citations.
   * This does NOT require the LLM — it uses official academic APIs.
   */
  async refineReferences(references: ReferenceItem[]): Promise<ExtractionResult> {
    try {
      const response = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          references: references.map(r => ({ title: r.title, doi: r.doi }))
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Non-JSON response from refine:", errorText.substring(0, 500));
        throw new Error(`Server returned invalid format`);
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Refinement failed");
      }

      return await response.json();
    } catch (error: any) {
      console.error("Refine Service Error:", error);
      throw error;
    }
  }

  /**
   * Optional: Use local LLM to discover additional DOIs from raw text
   * that regex may have missed. This is a bonus, not the critical path.
   */
  async extractWithAI(text: string): Promise<ExtractionResult> {
    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("AI not available");
      }

      const data = await response.json();

      if (response.status === 503) {
        throw new Error(`AI is warming up... ${data.error}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "AI_FAILED");
      }

      return data;
    } catch (error: any) {
      console.error("AI Extract Error:", error);
      throw error;
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
