// This is a serverless function for Vercel or Netlify.
// It acts as a secure backend to call the Google AI API.

// We need to install the Google Generative AI SDK
// Run this command in your terminal: npm install @google/generative-ai
import { GoogleGenerativeAI } from '@google/generative-ai';

// This is the main function that will be executed when the API endpoint is called.
export default async function handler(req, res) {
  // 1. Check for the correct request method (we only accept POST)
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // 2. Get the job description and product list from the request body
    const { jobDescription, products } = req.body;

    if (!jobDescription || !products) {
      return res.status(400).json({ error: 'Missing jobDescription or products in request body' });
    }

    // 3. Securely get the API key from environment variables
    //    For local development, create a .env.local file. For Vercel, use the dashboard.
    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("API key not found. Please set the VITE_GOOGLE_API_KEY environment variable.");
    }

    // 4. Initialize the Google Generative AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 5. Construct the detailed prompt for the AI
    //    This is the most important part - we are "prompt engineering" here.
    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier.
      Your task is to analyze a customer's job description and a list of available products to create a detailed material list and a step-by-step construction method.

      **Customer Job Description:**
      "${jobDescription}"

      **Available Products (JSON format):**
      ${JSON.stringify(products, null, 2)}

      **Your Task:**
      Based on the job description and the available products, generate a JSON object with the following exact structure:
      {
        "materials": [
          { "id": <product_id>, "name": "<product_name>", "quantity": <calculated_quantity>, "unit": "<product_unit>" },
          ...
        ],
        "method": {
          "steps": ["<step_1>", "<step_2>", ...],
          "considerations": ["<consideration_1>", "<consideration_2>", ...]
        }
      }

      **CRITICAL INSTRUCTION:** Your entire response MUST be only the raw JSON object. Do not include any extra text, explanations, apologies, or markdown formatting like \`\`\`json before or after the JSON object. The response must start with { and end with }.
    `;

    // 6. Call the AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let aiResponseText = response.text();

    // --- NEW DEBUG LOGS ---
    console.log("--- RAW AI RESPONSE ---");
    console.log(aiResponseText);
    console.log("--- END RAW AI RESPONSE ---");

    // 7. Clean up the AI's response to ensure it's valid JSON.
    //    This finds the first '{' and the last '}' to extract the JSON block.
    const jsonStart = aiResponseText.indexOf('{');
    const jsonEnd = aiResponseText.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("AI response did not contain '{' or '}'.");
      throw new Error("AI did not return a valid JSON object.");
    }

    let jsonString = aiResponseText.substring(jsonStart, jsonEnd + 1);
    
    console.log("--- EXTRACTED JSON STRING ---");
    console.log(jsonString);
    console.log("--- END EXTRACTED JSON STRING ---");

    // 8. The AI returns a JSON string, so we need to parse it before sending it back.
    const parsedJsonResponse = JSON.parse(jsonString);

    console.log("--- SUCCESSFULLY PARSED JSON ---");

    // 9. Send the successful response back to the front-end
    res.status(200).json(parsedJsonResponse);

  } catch (error) {
    // 10. Handle any errors that occur during the process
    console.error("--- ERROR IN SERVERLESS FUNCTION ---");
    console.error(error);
    res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}
