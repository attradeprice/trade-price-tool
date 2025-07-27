import { GoogleGenerativeAI } from '@google/generative-ai';

/*
 * This module contains the logic for generating quotes based on a
 * customer’s job description.  It now performs two AI calls: one to
 * extract relevant search keywords from the job description, and a
 * second to generate the final quote based on the resulting product
 * catalogue.  It also filters out concrete slabs when the job
 * specifically calls for natural stone.
 */

// Stopwords to ignore when extracting keywords.
const stopWords = new Set([
  'a','an','the','in','on','for','with','i','want','to','build','and','is',
  'it','will','be','area','size','using','out','of','which','currently',
  'grass','metres','meter','long','high'
]);

/*
 * Fallback synonyms used only if the AI fails to extract any keywords.
 * You can expand these lists as needed.  These help the system fall
 * back gracefully when the keyword extraction step returns nothing.
 */
const fallbackSynonyms = {
  paving:    ['paving','slabs'],
  // Natural stone includes many types
  stone:     ['stone','sandstone','limestone','slate','granite','travertine','quartzite','basalt','yorkstone','porphyry'],
  patio:     ['patio','paving'],
  aggregate: ['aggregate','sand','cement','mot'],
  brick:     ['brick','block','red brick'],
  block:     ['block','concrete block'],
  // Mortar and jointing compounds
  mortar:    ['mortar','jointing','joint','jointing compound','pointing compound','slurry','primer','adhesive','bonding'],
  cement:    ['cement','postcrete'],
};

/**
 * Uses Gemini to extract a set of search keywords from a job description.
 * The model is asked to list only nouns and material types that would
 * be useful for querying the product database.
 *
 * @param {string} description The customer’s job description.
 * @param {Object} model An instance of a generative model.
 * @returns {Promise<string[]>} A list of keywords.
 */
async function getSearchKeywords(description, model) {
  const extractionPrompt = `
    Identify all distinct material or product keywords that could be
    relevant when searching a building materials catalogue for the following
    project description.  Only list nouns and material types (no
    measurements, no verbs, no job‑steps).  Return them as a comma-
    separated list without any additional text.

    Job description: "${description}"
  `;
  try {
    const result = await model.generateContent(extractionPrompt);
    const text = result.response.text().trim();
    // Split on commas and semicolons, trim whitespace, filter empty strings.
    let keywords = text.split(/[;,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    // Filter out stopwords and numeric values.
    keywords = keywords.filter(w => !stopWords.has(w) && !/^\d+(x\d+)?$/.test(w));
    // Remove duplicates.
    return Array.from(new Set(keywords));
  } catch (err) {
    console.error('Keyword extraction failed:', err.message);
    return [];
  }
}

/**
 * Fallback keyword extractor.  If the AI fails to extract any
 * keywords, this function uses a simple heuristic with a limited
 * synonym map.
 *
 * @param {string} description
 * @returns {string[]}
 */
function fallbackKeywordExtractor(description) {
  const words = description.toLowerCase().replace(/[^\w\s]/g,'').split(/\s+/);
  const keywords = new Set();
  for (const w of words) {
    if (w && !stopWords.has(w) && !/^\d+(x\d+)?$/.test(w) && w.length > 2) {
      keywords.add(w);
      if (fallbackSynonyms[w]) {
        fallbackSynonyms[w].forEach(syn => keywords.add(syn));
      }
    }
  }
  return Array.from(keywords);
}

/**
 * Queries the WordPress product search API for each keyword and
 * aggregates the results.  Each keyword is queried separately so
 * that the underlying API doesn’t try to match all keywords in a
 * single wildcard pattern.
 *
 * @param {string[]} keywords List of search keywords.
 * @returns {Promise<Object[]>} Array of product objects.
 */
async function searchWordPressProducts(keywords) {
  const resultsMap = new Map();
  for (const kw of keywords) {
    if (!kw) continue;
    const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(kw)}`;
    console.log(`--- WP API FETCH: Attempting to fetch URL: ${url} ---`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch from WP API (${kw}): ${response.statusText}`);
        continue;
      }
      const products = await response.json();
      products.forEach(p => resultsMap.set(p.url, p));
    } catch (error) {
      console.error(`Error fetching keyword '${kw}':`, error.message);
    }
  }
  return Array.from(resultsMap.values());
}

/**
 * Filter out concrete or utility slabs if the job specifically mentions
 * “natural stone”.  This prevents “pressed concrete” products from
 * appearing in the natural stone options.
 *
 * @param {Object[]} products Product array from WordPress.
 * @param {string} jobDescription The customer's description.
 * @returns {Object[]} Filtered product list.
 */
function filterByNaturalStonePreference(products, jobDescription) {
  const prefersNatural = /natural\s+stone/i.test(jobDescription);
  if (!prefersNatural) return products;
  const naturalStoneTerms = ['sandstone','limestone','slate','granite','travertine','yorkstone','porphyry','stone'];
  return products.filter(p => {
    const text = (p.title + ' ' + p.description).toLowerCase();
    const isNatural   = naturalStoneTerms.some(term => text.includes(term));
    const isConcrete  = /concrete|utility|pressed/.test(text);
    return isNatural && !isConcrete;
  });
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

    // Prepare generative AI client
    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key not found.");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Step 1: Ask the model for relevant search keywords based on the job description.
    let keywords = await getSearchKeywords(jobDescription, model);

    // If the model failed to produce any keywords, fall back to heuristic extraction.
    if (!keywords || keywords.length === 0) {
      keywords = fallbackKeywordExtractor(jobDescription);
    }

    // Step 2: Use those keywords to search the WordPress API.
    let searchResults = await searchWordPressProducts(keywords);

    // Step 3: Optionally filter out concrete slabs if natural stone is requested.
    searchResults = filterByNaturalStonePreference(searchResults, jobDescription);

    console.log(`--- AI INPUT: Product catalog for AI:`, searchResults);

    // Step 4: Ask the model to produce the final materials list and method based on the catalogue.
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
      3.  **CRITICAL:** If you find multiple suitable products for a single material requirement (e.g., different colours of "pointing compound" or different types of "natural stone"), you MUST include them as an array of 'options'. **You MUST use the exact product titles from the provided data for the 'name' in each option.**
      4.  If you identify a material needed for the job (e.g., "MOT Type 1 Sub-base", "Cement", "Pipe", "Sink", "Pointing Compound", "Slurry Primer") but you **cannot** find a specific product for it in the provided data, you MUST still include it in the material list as a single item (not with options). For these items, set the 'name' to describe the material and add "(to be quoted)" at the end.
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
