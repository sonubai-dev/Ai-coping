import { GoogleGenAI } from "@google/genai";
import { AIComplexity, DebugStep } from "../types";

// Initialize Gemini Client
// IMPORTANT: The API key is injected via process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const OPENROUTER_API_KEY = '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';

// Fallback function to OpenRouter
const callOpenRouter = async (
  messages: { role: string; content: string }[], 
  modelHint: string
): Promise<string> => {
  try {
    // Map internal model hints to OpenRouter available models
    // Using free/low-cost tiers for backup where possible
    let model = 'google/gemini-2.0-flash-lite-preview-02-05:free'; 
    
    if (modelHint.includes('pro')) {
      model = 'google/gemini-2.0-pro-exp-02-05:free';
    } else if (modelHint.includes('flash')) {
      model = 'google/gemini-2.0-flash-001';
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000", 
        "X-Title": "Thiia AI"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("OpenRouter Fallback Failed:", error);
    throw error; // If both fail, throw the error up
  }
};

export const generateResponse = async (
  prompt: string,
  contextCode: string,
  complexity: AIComplexity,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<string> => {
  let modelName = 'gemini-2.5-flash-lite-latest'; // Default for low complexity/fast response
  let thinkingBudget = 0;
  let systemInstruction = `You are Thiia AI, an advanced intelligent coding assistant. 
      Current Context Code:
      \`\`\`
      ${contextCode}
      \`\`\`
      Always provide concise, correct, and safe code. 
      If in 'High' complexity mode, think deeply before answering.
      If in 'Research' mode, be thorough and explanatory.
      `;

  if (complexity === 'high') {
    modelName = 'gemini-3-pro-preview';
    thinkingBudget = 32768; // Max budget for deep reasoning
  } else if (complexity === 'research') {
    modelName = 'gemini-3-flash-preview'; 
  }

  const config: any = {
    systemInstruction,
  };

  if (thinkingBudget > 0) {
    config.thinkingConfig = { thinkingBudget };
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: config
    });

    return response.text || "No response generated.";

  } catch (error: any) {
    console.warn("Primary Gemini API failed. Attempting OpenRouter fallback...", error.message);
    
    try {
      // Prepare messages for OpenRouter (OpenAI compatible format)
      const messages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ];
      
      const fallbackResponse = await callOpenRouter(messages, modelName);
      return fallbackResponse + "\n\n(Generated via Backup API)";
    } catch (fallbackError: any) {
      return `Error: Service unavailable. Primary: ${error.message}. Backup: ${fallbackError.message}`;
    }
  }
};

export const generateDebugTrace = async (
  code: string,
  language: string
): Promise<DebugStep[]> => {
  const prompt = `
      Act as a code execution engine for ${language}.
      Simulate the execution of the following code step-by-step (line by line).
      
      Code:
      ${code}
      
      Return a JSON array where each element represents a step of execution.
      Each object must have:
      - "line": The 1-based line number being executed.
      - "variables": A flat object showing the state of all local variables at that step. keys are variable names, values are string representations.
      - "output": (Optional) Any stdout/print output generated at this step.

      Rules:
      1. Include every significant line change.
      2. If a loop runs 3 times, show steps for each iteration.
      3. Return ONLY valid JSON. No markdown formatting.
    `;

  try {
    // We use a smart model to simulate execution logic accurately
    const modelName = 'gemini-2.5-flash-latest'; 
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const trace = JSON.parse(text);
    return Array.isArray(trace) ? trace as DebugStep[] : [];

  } catch (error: any) {
    console.warn("Primary Gemini Debug API failed. Attempting OpenRouter fallback...", error.message);
    
    try {
      const messages = [
        { role: "user", content: prompt }
      ];
      
      // Use a smart model for debugging logic
      const fallbackText = await callOpenRouter(messages, 'gemini-2.0-flash-001');
      
      // Attempt to clean markdown if present (e.g. ```json ... ```)
      const cleanedText = fallbackText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const trace = JSON.parse(cleanedText);
      return Array.isArray(trace) ? trace as DebugStep[] : [];
    } catch (fallbackError) {
      console.error("Gemini Debug Error (Primary & Backup failed):", fallbackError);
      return [];
    }
  }
};