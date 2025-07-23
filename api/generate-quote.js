import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper function to extract keywords from a job description
function extractKeywords(description) {
    const lowerDesc = description.toLowerCase();
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is', 'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of']);
    
    const keywords = lowerDesc
        .replace(/[^\w\s]/g, '') // remove punctuation
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 2);
        
    return [...new Set(keywords)].join(' '); // Return unique keywords as a string
}


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
    
    const keywords = extractKeywords(jobDescription);
    const searchQuery = `site:attradeprice.co.uk ${keywords} OR "natural stone paving" OR "pointing compound"`;
    
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        tools: [{ "google_search_retrieval": {}}]
    });

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description. To do this, you MUST first perform a Google Search on the attradeprice.co.uk website to find relevant products.

      **Search Query to Use:**
      "${searchQuery}"

      **Customer Job Description:**
      "${jobDescription}"

      **Instructions & Rules:**
      1.  Execute a search using the provided query to find products on the website.
      2.  **Analyze the search results VERY carefully.** The search results contain the real product names available on the website.
      3.  Based on the job description, calculate the required quantity for each necessary material. Assume a 10% waste factor for materials like paving and aggregates.
      4.  **CRITICAL:** If you find multiple suitable products for a single material requirement (e.g., different colors of "pointing compound" or different types of "natural stone"), you MUST include them as an array of 'options'. **You MUST use the exact product titles from the search results for the 'name' in each option.** Do not invent or use example names.
      5.  If you identify a material needed for the job (e.g., "MOT Type 1 Sub-base", "Cement") but you **cannot** find a specific product for it in the search results, you MUST still include it in the material list as a single item (not with options). For these items, set the 'name' to describe the material and add "(to be quoted)" at the end.
      6.  Generate a JSON object with the following exact structure.
          {
            "materials": [
              { 
                "id": "<unique_id_for_material_group>", 
                "name": "<Generic Name like 'Pointing Compound' or 'Natural Stone Paving'>", 
                "quantity": <calculated_quantity>, 
                "unit": "<standard_unit>",
                "options": [
                    { "id": "<product_sku_or_url_1>", "name": "<EXACT Product Name from Search Result 1>" },
                    { "id": "<product_sku_or_url_2>", "name": "<EXACT Product Name from Search Result 2>" }
                ]
              },
              ...
            ],
            "method": {
              "steps": ["<step_1>", "<step_2>", ...],
              "considerations": ["<consideration_1>", "<consideration_2>", ...]
            }
          }
      7.  Your entire response MUST be only the raw JSON object. Do not include any extra text, explanations, or markdown formatting. The response must start with { and end with }.
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
