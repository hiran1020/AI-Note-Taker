import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptSegment, MeetingHighlight, SummaryData } from "../types";

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generateMeetingSummary = async (
  audioBase64: string,
  context: string,
  transcript: TranscriptSegment[],
  highlights: MeetingHighlight[]
) => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  // Format transcript for the model
  const formattedTranscript = transcript
    .map(t => `[${new Date(t.timestamp * 1000).toISOString().substr(11, 8)}] ${t.text}`)
    .join('\n');

  // Format highlights
  const formattedHighlights = highlights
    .map(h => `User marked important moment at: ${new Date(h.timestamp * 1000).toISOString().substr(11, 8)}`)
    .join('\n');

  const prompt = `
    You are an expert executive assistant and meeting analyst.
    
    INPUT DATA:
    1. Context: ${context}
    2. User Highlights: 
       ${formattedHighlights || 'None provided.'}
    3. Live Transcript (use this for factual accuracy):
       ${formattedTranscript || 'No live transcript available, rely on audio.'}
    
    TASK:
    Analyze the attached meeting audio (and use the transcript as a reference guide). 
    Generate a comprehensive structured report.

    REQUIREMENTS:
    1. Executive Summary: Concise, professional, capturing the main purpose and outcome.
    2. Key Points: Bullet points of major topics.
    3. Action Items: Specific tasks with owners.
    4. Sentiment: Analyze the overall tone (Positive, Neutral, Tense, Energetic).
    5. Follow-up Email: Draft a professional follow-up email to the attendees summarizing the meeting.
    6. Attendees: List inferred names.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/mp3', // Generic container for the raw audio we send
              data: audioBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryText: { type: Type.STRING, description: "Executive summary of the meeting" },
            keyPoints: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of main topics discussed"
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of actionable tasks"
            },
            attendeesDetected: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Names of people identified in the meeting"
            },
            sentiment: {
              type: Type.STRING,
              enum: ['Positive', 'Neutral', 'Tense', 'Energetic'],
              description: "The overall mood of the meeting"
            },
            followUpEmail: {
              type: Type.STRING,
              description: "A complete draft of a follow-up email ready to send"
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    
    // Pass back the transcript so we can display it in the UI even if the model doesn't modify it
    return {
      ...parsed,
      transcript: transcript 
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const askMeetingQuestion = async (
  question: string,
  summaryData: SummaryData
): Promise<string> => {
    if (!apiKey) {
      return "Error: API Key missing.";
    }

    const context = `
      Meeting Title: ${summaryData.meetingTitle}
      Date: ${summaryData.date}
      Executive Summary: ${summaryData.summaryText}
      Key Points: ${summaryData.keyPoints.join('; ')}
      Action Items: ${summaryData.actionItems.join('; ')}
      Transcript: 
      ${summaryData.transcript.map(t => t.text).join(' ')}
    `;

    const prompt = `
      You are a helpful assistant answering a question about a meeting that just occurred.
      Use the provided meeting context to answer the user's question accurately.
      If the answer is not in the context, say "I couldn't find that information in the meeting records."
      
      CONTEXT:
      ${context}

      USER QUESTION:
      ${question}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text || "I couldn't generate an answer.";
    } catch (error) {
      console.error("Chat Error:", error);
      return "Sorry, I encountered an error while processing your question.";
    }
};
