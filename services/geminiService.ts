
import { GoogleGenAI, Type } from "@google/genai";
import { ConfigSection, TargetSpec, ConversionResult, LogEntry } from "../types";

export class GeminiConverter {
  /**
   * Helper to handle retries with exponential backoff for 429 errors.
   */
  private async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || "";
        const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || error.status === 429;
        
        if (isRateLimit && i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Rate limit hit (429), retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Verifies the Gemini API connection.
   */
  public async testConnection(model: string = 'gemini-3-flash-preview'): Promise<boolean> {
    try {
      return await this.callWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model,
          contents: "ping",
        });
        return !!response.text;
      });
    } catch (e) {
      console.error("Gemini connection test failed", e);
      return false;
    }
  }

  /**
   * Attempts to identify hardware and IOS version from a config snippet.
   */
  public async identifyHardware(config: string, model: string = 'gemini-3-flash-preview'): Promise<{ model?: string; ios?: string } | null> {
    return await this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Analyze the following Cisco configuration snippet and identify the hardware model and IOS version.
        Look for 'version', '! Last configuration change', 'Boot' strings, or model-specific command syntax.
        Return exactly in JSON: { "model": string, "ios": string }
        Snippet:
        ${config.substring(0, 5000)}
      `;

      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                model: { type: Type.STRING },
                ios: { type: Type.STRING }
              }
            }
          }
        });
        return JSON.parse(response.text || '{}');
      } catch (e) {
        console.warn("Hardware identification failed", e);
        return null;
      }
    });
  }

  public async convertSection(
    section: ConfigSection,
    target: TargetSpec,
    model: string = 'gemini-3-flash-preview'
  ): Promise<ConversionResult> {
    return await this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        You are a World-Class Cisco Configuration Migration AI. 
        Convert the following configuration section to the target platform.

        METADATA:
        - Source: ${target.sourceModel || 'Unknown Model'} (${target.sourceIOS || 'Unknown IOS'})
        - Target: ${target.model || 'Modern Catalyst/Nexus'} (${target.targetIOS || 'Current IOS-XE/NX-OS'})

        IMPORTANT: If Source metadata is 'Unknown', infer the platform from the command syntax provided below. 
        If Target metadata is empty, assume a modern Cisco Catalyst 9300 running IOS-XE 17.x as the default blueprint.

        SOURCE CONFIG SECTION: [${section.name}]
        Commands:
        ${section.commands.join('\n')}

        STRICT CISCO SYNTAX & HIERARCHY RULES:
        1. COPY-PASTE READY: Output must be structured for direct paste at 'config t'.
        2. LOGICAL ORDERING & DEPENDENCIES: 
           - Commands must be ordered so dependencies are met (e.g., NTP before Logging).
           - VLANs defined before interface assignment.
        3. HIERARCHY AWARENESS: 
           - Always use '!' to separate major configuration blocks.
           - Sub-mode blocks must end with '!' or 'exit' to return to global config level.
        4. ADVISORIES: For every warning, include 'instructions' (simple English) and 'suggestedConfig' (CLI fix).
        5. WORKFLOW: If critical (AAA, INT, ROUTING), generate 'deploymentSteps'.

        Output JSON format:
        {
          "sectionId": string,
          "status": "success" | "warning",
          "convertedCommands": string[],
          "warnings": [{ "severity": "high" | "medium", "message": string, "instructions": string, "suggestedConfig": string }],
          "deploymentSteps": [{ "order": number, "phase": string, "task": string, "verificationCmd": string, "expectedResult": string }],
          "notes": string[],
          "confidence": "high" | "medium"
        }
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sectionId: { type: Type.STRING },
              status: { type: Type.STRING },
              convertedCommands: { type: Type.ARRAY, items: { type: Type.STRING } },
              warnings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING },
                    message: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    suggestedConfig: { type: Type.STRING }
                  },
                  required: ["severity", "message", "instructions"]
                }
              },
              deploymentSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    order: { type: Type.NUMBER },
                    phase: { type: Type.STRING },
                    task: { type: Type.STRING },
                    verificationCmd: { type: Type.STRING },
                    expectedResult: { type: Type.STRING }
                  }
                }
              },
              notes: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.STRING }
            },
            required: ["sectionId", "status", "convertedCommands", "confidence"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as ConversionResult;
      result.sectionId = section.id;
      return result;
    });
  }

  public async runFinalReview(fullConfig: string, target: TargetSpec, model: string = 'gemini-3-flash-preview'): Promise<LogEntry[]> {
    return await this.callWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Review this final Cisco configuration for ${target.model || 'Target Platform'}. 
        Check for syntax errors, hierarchy breaks (missing '!' or 'exit'), and logical ordering.
        Config:
        ${fullConfig}
        
        Return a JSON array of LogEntry objects: [{ "type": "SUCCESS" | "WARNING" | "ERROR", "message": string }]
      `;
      
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                message: { type: Type.STRING }
              }
            }
          }
        }
      });
      const parsed = JSON.parse(response.text || '[]') as any[];
      return parsed.map(entry => ({
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        ...entry
      })) as LogEntry[];
    });
  }
}
