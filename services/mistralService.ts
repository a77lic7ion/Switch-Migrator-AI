
import { ConfigSection, TargetSpec, ConversionResult, LogEntry } from "../types";

export class MistralConverter {
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey: string, endpoint: string = "https://api.mistral.ai/v1") {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  private async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.status === 429 || error.message?.includes("429");
        
        if (isRateLimit && i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Mistral rate limit hit, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  public async fetchModels(): Promise<string[]> {
    return await this.callWithRetry(async () => {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`Failed to fetch Mistral models: ${response.status}`);
      const data = await response.json();
      return data.data.map((m: any) => m.id);
    });
  }

  public async convertSection(
    section: ConfigSection,
    target: TargetSpec,
    model: string
  ): Promise<ConversionResult> {
    return await this.callWithRetry(async () => {
      const prompt = `
        You are a World-Class Cisco Configuration Migration AI.
        Convert the following Cisco configuration section to the target platform.
        Output ONLY a valid JSON object matching the schema below.

        METADATA:
        - Source: ${target.sourceModel || 'Unknown'} (${target.sourceIOS || 'Unknown'})
        - Target: ${target.model || 'Catalyst 9300'} (${target.targetIOS || 'IOS-XE 17.x'})

        SOURCE CONFIG SECTION: [${section.name}]
        Commands:
        ${section.commands.join('\n')}

        STRICT CISCO SYNTAX & HIERARCHY RULES:
        1. COPY-PASTE READY: Output must be structured for direct paste at 'config t'.
        2. LOGICAL ORDERING & DEPENDENCIES: Commands must be ordered so dependencies are met.
        3. HIERARCHY AWARENESS: Always use '!' to separate major configuration blocks. Sub-mode blocks must end with '!' or 'exit'.
        4. ADVISORIES: If a command is deprecated or requires attention, you MUST generate a "warnings" entry. Include 'instructions' (simple English) and 'suggestedConfig' (CLI fix).
        5. WORKFLOW: For critical infrastructure (AAA, Interfaces, Routing), you MUST generate "deploymentSteps" for verification.

        REQUIRED JSON OUTPUT SCHEMA:
        {
          "sectionId": "string",
          "status": "success" | "warning",
          "convertedCommands": ["string"],
          "warnings": [
            {
              "severity": "high" | "medium",
              "message": "string",
              "instructions": "string",
              "suggestedConfig": "string"
            }
          ],
          "deploymentSteps": [
            {
              "order": number,
              "phase": "string",
              "task": "string",
              "verificationCmd": "string",
              "expectedResult": "string"
            }
          ],
          "notes": ["string"],
          "confidence": "high" | "medium"
        }
      `;

      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) throw new Error(`Mistral API error: ${response.status}`);
      const data = await response.json();
      const content = data.choices[0].message.content;
      const result = JSON.parse(content) as ConversionResult;
      result.sectionId = section.id;
      return result;
    });
  }

  public async runFinalReview(fullConfig: string, target: TargetSpec, model: string): Promise<LogEntry[]> {
    return await this.callWithRetry(async () => {
      const prompt = `
        Review this final Cisco configuration for ${target.model || 'Target Platform'}. 
        Check for syntax errors, hierarchy breaks (missing '!' or 'exit'), and logical ordering.
        
        Config:
        ${fullConfig}
        
        Return ONLY a JSON array of LogEntry objects: [{ "type": "SUCCESS" | "WARNING" | "ERROR", "message": "string" }]
      `;

      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) return [];
      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      // Handle both { "logs": [] } and [] formats
      const logArray = Array.isArray(parsed) ? parsed : (parsed.logs || []);

      return logArray.map((entry: any) => ({
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        type: entry.type || 'INFO',
        message: entry.message || 'Review complete.'
      })) as LogEntry[];
    });
  }
}
