import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { jobDescription } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing jobDescription in request body' });
    }

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("API key not found.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and use your general knowledge of building materials to create a material list and construction method.

      **Customer Job Description:**
      "${jobDescription}"

      **Instructions & Rules:**
      1.  Based on the job description, calculate the required quantity for each necessary material. Assume a 10% waste factor for materials like paving and aggregates.
      2.  Use your knowledge to identify common UK building materials (e.g., "MOT Type 1 Sub-base", "General Purpose Cement", "Kiln-Dried Sand").
      3.  **Crucially:** For every material you identify, you must present it as a generic item for merchants to quote on. For example, if the user asks for natural stone, you should list "Natural Stone Paving Slabs (to be quoted)". If they need cement, list "General Purpose Cement (to be quoted)".
      4.  Generate a JSON object with the following exact structure:
          {
            "materials": [
              { "id": "<generic-id>", "name": "<Generic Name (to be quoted)>", "quantity": <calculated_quantity>, "unit": "<standard_unit>" },
              ...
            ],
            "method": {
              "steps": ["<step_1>", "<step_2>", ...],
              "considerations": ["<consideration_1>", "<consideration_2>", ...]
            }
          }
      5.  The 'id' for each material should be a generic, descriptive string (e.g., "generic-mot1", "generic-cement").
      6.  Your entire response MUST be only the raw JSON object. Do not include any extra text, explanations, or markdown formatting. The response must start with { and end with }.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let aiResponseText = response.text();

    const jsonStart = aiResponseText.indexOf('{');
    const jsonEnd = aiResponseText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("AI did not return a valid JSON object.");
    }
    aiResponseText = aiResponseText.substring(jsonStart, jsonEnd + 1);

    const parsedJsonResponse = JSON.parse(aiResponseText);

    res.status(200).json(parsedJsonResponse);

  } catch (error) {
    console.error("Error in serverless function:", error);
    res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}