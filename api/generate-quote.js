import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper function to extract keywords from a job description
function extractKeywords(description) {
    const lowerDesc = description.toLowerCase();
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is', 'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of']);
    
    const keywords = lowerDesc
        .replace(/[^\w\s]/g, '') // remove punctuation
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 2);
        
    // Add some common synonyms and related terms to improve search
    const synonyms = {
        'paving': 'paving OR slabs',
        'stone': 'stone OR slate OR sandstone OR limestone',
        'patio': 'patio OR paving',
        'aggregate': 'aggregate OR sand OR cement OR mot'
    };

    let expandedKeywords = [...keywords];
    keywords.forEach(kw => {
        if (synonyms[kw]) {
            expandedKeywords.push(synonyms[kw]);
        }
    });

    return [...new Set(expandedKeywords)].join(' ');
}

// NEW: Helper function to call your WordPress search API
async function searchWordPressProducts(query) {
    const searchUrl = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
    try {
        console.log(`--- WP API FETCH: Attempting to fetch URL: ${searchUrl} ---`);
        const response = await fetch(searchUrl);
        if (!response.ok) {
            console.error(`Failed to fetch from WP API: ${response.statusText}`);
            return [];
        }
        const products = await response.json();
        console.log(`--- WP API FETCH: Products received from WordPress API:`, products);
        return products;
    } catch (error) {
        console.error("Error calling WordPress API:", error);
        return [];
    }
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

    // --- New WordPress API Logic ---
    const keywords = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);
    console.log(`--- AI INPUT: Product catalog for AI:`, searchResults);


    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("API key not found.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and a provided list of relevant products fetched directly from the attradeprice.co.uk website's product catalog.

      **Customer Job Description:**
      "${jobDescription}"

      **Product Catalog from attradeprice.co.uk (JSON format):**
      ${JSON.stringify(searchResults, null, 2)}

      **Instructions & Rules:**
      1.  **Analyze the provided "Product Catalog" list.** This is the ONLY source of available products. Use both the 'title' and the 'description' to understand what each product is.
      2.  Based on the job description, calculate the required quantity for each necessary material. Assume a 10% waste factor for materials like paving and aggregates.
      3.  **CRITICAL:** If you find multiple suitable products for a single material requirement (e.g., different colors of "pointing compound" or different types of "natural stone"), you MUST include them as an array of 'options'. **You MUST use the exact product titles from the provided data for the 'name' in each option.**
      4.  If you identify a material needed for the job (e.g., "MOT Type 1 Sub-base", "Cement") but you **cannot** find a specific product for it in the provided data, you MUST still include it in the material list as a single item (not with options). For these items, set the 'name' to describe the material and add "(to be quoted)" at the end.
      5.  Generate a JSON object with the following exact structure.
          {
            "materials": [
              { 
                "id": "<unique_id_for_material_group>", 
                "name": "<Generic Name like 'Pointing Compound' or 'Natural Stone Paving'>", 
                "quantity": <calculated_quantity>, 
                "unit": "<standard_unit>",
                "options": [
                    { "id": "<product_url_1>", "name": "<EXACT Product Name from Data 1>" },
                    { "id": "<product_url_2>", "name": "<EXACT Product Name from Data 2>" }
                ]
              },
              ...
            ],
            "method": {
              "steps": ["<step_1>", "<step_2>", ...],
              "considerations": ["<consideration_1>", "<consideration_2>", ...]
            }
          }
      6.  Your entire response MUST be only the raw JSON object. Do not include any extra text, explanations, or markdown formatting. The response must start with { and end with }.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let aiResponseText = response.text();

    console.log("--- AI RAW RESPONSE ---");
    console.log(aiResponseText);
    console.log("--- END AI RAW RESPONSE ---");

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
