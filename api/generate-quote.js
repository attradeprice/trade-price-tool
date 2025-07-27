import { GoogleGenerativeAI } from '@google/generative-ai';

// words to ignore during keyword extraction
const stopWords = new Set([
  'a','an','the','in','on','for','with','i','want','to','build','and','is',
  'it','will','be','area','size','using','out','of','which','currently',
  'grass','metres','meter','long','high'
]);

// synonyms map – arrays of related search terms
const synonyms = {
  paving:    ['paving','slabs'],
  stone:     ['stone','slate','sandstone','limestone'],
  patio:     ['patio','paving'],
  aggregate: ['aggregate','sand','cement','mot'],
  brick:     ['brick','block','red brick'],
  block:     ['block','concrete block']
};

// Extracts a set of meaningful keywords (and their synonyms) from the job description
function extractKeywords(description) {
  const words = description.toLowerCase().replace(/[^\w\s]/g,'').split(/\s+/);
  const keywords = new Set();
  for (const w of words) {
    // skip stop‑words, numbers and very short tokens
    if (w && !stopWords.has(w) && !/^\d+(x\d+)?$/.test(w) && w.length > 2) {
      keywords.add(w);
      if (synonyms[w]) {
        synonyms[w].forEach(syn => keywords.add(syn));
      }
    }
  }
  return Array.from(keywords);
}

// Calls your WP search endpoint once, with all keywords as a single query string
async function searchWordPressProducts(keywords) {
  if (!keywords.length) return [];
  // Join all keywords with spaces – the WP endpoint uses wildcard matching internally
  const query = keywords.join(' ');
  const url   = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  console.log(`--- WP API FETCH: Attempting to fetch URL: ${url} ---`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch from WP API: ${response.statusText}`);
    return [];
  }
  const products = await response.json();
  console.log(`--- WP API FETCH: Products received from WordPress API:`, products);
  return products;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow',['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing jobDescription in request body' });
    }

    // Extract all relevant keywords and run a single search
    const keywords      = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);
    console.log(`--- AI INPUT: Product catalog for AI:`, searchResults);

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key not found.");

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

    const result    = await model.generateContent(prompt);
    const aiText    = result.response.text();
    const jsonStart = aiText.indexOf('{');
    const jsonEnd   = aiText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI did not return a valid JSON object.");
    const parsed    = JSON.parse( aiText.slice(jsonStart, jsonEnd + 1) );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Error in serverless function:", error);
    return res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}
