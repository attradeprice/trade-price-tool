import { GoogleGenerativeAI } from '@google/generative-ai';

/*
 * This module drives the quote generation logic.  It:
 *  1. Extracts search keywords via Gemini.
 *  2. Falls back to a synonym-based extractor if needed.
 *  3. Queries the WordPress API once per keyword, deduplicating results.
 *  4. Filters out concrete slabs if the job specifies natural stone.
 *  5. Asks Gemini to produce a detailed materials list and method,
 *     including sub-base depths, bedding layer thickness, primers,
 *     jointing compounds and safety considerations.
 */

// Stopwords to ignore when extracting keywords.
const stopWords = new Set([
  'a','an','the','in','on','for','with','i','want','to','build','and','is',
  'it','will','be','area','size','using','out','of','which','currently',
  'grass','metres','meter','long','high'
]);

/*
 * Fallback synonyms used only if the AI fails to extract any keywords.
 * Expand these lists as needed.  They cover natural stone types,
 * aggregates, mortar/jointing, adhesives and primers.
 */
const fallbackSynonyms = {
  paving:    ['paving','slabs'],
  stone:     ['stone','sandstone','limestone','slate','granite','travertine','quartzite','basalt','yorkstone','porphyry'],
  patio:     ['patio','paving'],
  aggregate: ['aggregate','sand','cement','mot'],
  brick:     ['brick','block','red brick'],
  block:     ['block','concrete block'],
  mortar:    ['mortar','jointing','joint','jointing compound','pointing compound','slurry','primer','adhesive','bonding','bonding agent'],
  cement:    ['cement','postcrete'],
  adhesive:  ['adhesive','primer','slurry primer','sbr','pva','bonding agent','tile adhesive']
};

/**
 * Ask Gemini to extract relevant material, product and accessory keywords
 * from a job description.  The model returns a comma-separated list of nouns.
 */
async function getSearchKeywords(description, model) {
  const extractionPrompt = `
    Identify all distinct material, product, consumable or accessory keywords
    that could be relevant when searching a building materials catalogue for
    the following project description.  Include not only primary materials
    (e.g. "stone", "cement") but also ancillary items such as primers, bonding
    slurry, jointing compound, fixings, adhesives, pipes, taps, etc.  Only
    list nouns and material types (no measurements, no verbs, no job steps).
    Return them as a comma-separated list without any additional text.

    Job description: "${description}"
  `;
  try {
    const result = await model.generateContent(extractionPrompt);
    const text = result.response.text().trim();
    let keywords = text.split(/[;,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    keywords = keywords.filter(w => !stopWords.has(w) && !/^\d+(x\d+)?$/.test(w));
    return Array.from(new Set(keywords));
  } catch (err) {
    console.error('Keyword extraction failed:', err.message);
    return [];
  }
}

/**
 * Fallback keyword extractor.  If the AI fails to extract any keywords,
 * this function uses a simple heuristic with a limited synonym map.
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
 * Query the WP product search API for each keyword separately.
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

    // Prepare Gemini client
    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key not found.");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1) Extract search keywords via AI
    let keywords = await getSearchKeywords(jobDescription, model);
    if (!keywords || keywords.length === 0) {
      keywords = fallbackKeywordExtractor(jobDescription);
    }

    // 2) Query each keyword separately and combine results
    let searchResults = await searchWordPressProducts(keywords);

    // 3) Optionally filter out concrete slabs if natural stone is requested
    searchResults = filterByNaturalStonePreference(searchResults, jobDescription);

    console.log(`--- AI INPUT: Product catalog for AI:`, searchResults);

    // 4) Ask the model to produce a detailed materials list and construction method
    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and a provided list of relevant products fetched directly from the attradeprice.co.uk website's product catalog.

      **Customer Job Description:**
      "${jobDescription}"

      **Product Catalog from attradeprice.co.uk (JSON format):**
      ${JSON.stringify(searchResults, null, 2)}

      **Instructions & Rules:**
      1.  **Analyze the provided "Product Catalog" list.** This is the ONLY source of available products. Use both the 'title' and the 'description' to understand what each product is.
      2.  Based on the job description, calculate the required quantity for each necessary material. For patios, use:
          • Excavation depth: 100 mm for foot traffic, 150 mm for vehicular loads.  
          • Sub-base volume = area × excavation depth; add 10 % waste.  
          • Bedding layer thickness: 30 mm of mortar; calculate volume and convert to bags of sand and cement.  
          • Paving coverage: number of slabs = area ÷ slab area; add 10 % waste.  
          Adjust similar calculations for other trades (e.g. pipe runs, number of taps, length of conduit).
      3.  **Include ancillary materials:** primers/bonding slurries, jointing compounds or mortar (with mix ratios and curing times), weed membranes, edge restraints, drainage channels, fixings, safety equipment (PPE), or any other consumables required.  If no matching product exists in the catalogue, list the item as "(to be quoted)".
      4.  **When listing products in the "options" array, strip any size or pack information** (e.g. "450 × 450", "600 mm × 600 mm", "Pack of 25") from the product names before presenting them to the user.  Use only the descriptive part of the name.
      5.  If you identify multiple suitable products for a single material (e.g. different colours of "pointing compound" or different types of natural stone), include them as an array of 'options'.  Use the exact product titles from the provided data (after stripping sizes) for the 'name' in each option.
      6.  Provide a **detailed step-by-step construction method and important considerations**, including excavation depths, layer thicknesses, mix ratios, priming instructions, jointing, drainage falls (e.g. 1:80 away from buildings) and curing times.
      7.  Generate a JSON object with the following exact structure:
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
      8.  Your entire response MUST be only the raw JSON object. Do not include any extra text, explanations, or markdown formatting.  The response must start with { and end with }.
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
