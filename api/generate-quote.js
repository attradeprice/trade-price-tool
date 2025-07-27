import { GoogleGenerativeAI } from '@google/generative-ai';

// Stopwords to ignore when extracting keywords.
const stopWords = new Set([
  'a','an','the','in','on','for','with','i','want','to','build','and','is',
  'it','will','be','area','size','using','out','of','which','currently',
  'grass','metres','meter','long','high'
]);

// Fallback synonyms used only if the AI fails to extract any keywords.
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

async function searchWordPressProducts(keywords) {
  const resultsMap = new Map();
  for (const kw of keywords) {
    if (!kw) continue;
    const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(kw)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const products = await response.json();
      products.forEach(p => resultsMap.set(p.url, p));
    } catch {}
  }
  return Array.from(resultsMap.values());
}

function filterByNaturalStonePreference(products, jobDescription) {
  const prefersNatural = /natural\s+stone/i.test(jobDescription);
  if (!prefersNatural) return products;
  const naturalStoneTerms = ['sandstone','limestone','slate','granite','travertine','yorkstone','porphyry','stone'];
  return products.filter(p => {
    const text = (p.title + ' ' + p.description).toLowerCase();
    const isNatural = naturalStoneTerms.some(term => text.includes(term));
    const isConcrete = /concrete|utility|pressed/.test(text);
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

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key not found.");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let keywords = await getSearchKeywords(jobDescription, model);
    if (!keywords || keywords.length === 0) {
      keywords = fallbackKeywordExtractor(jobDescription);
    }

    let searchResults = await searchWordPressProducts(keywords);
    searchResults = filterByNaturalStonePreference(searchResults, jobDescription);

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and a provided list of relevant products fetched directly from the attradeprice.co.uk website's product catalog.

      **Customer Job Description:**
      "${jobDescription}"

      **Product Catalog from attradeprice.co.uk (JSON format):**
      ${JSON.stringify(searchResults, null, 2)}

      **Instructions & Rules:**
      1. Analyze the provided "Product Catalog" list.
      2. Based on the job description, calculate the required quantity for each necessary material.
      3. Include ancillary materials such as primers, membranes, fixings, PPE, etc. Mark unavailable items as "(to be quoted)".
      4. Strip any size or pack info from product names in the 'options'.
      5. For multiple product matches, return them as option arrays with 'id' and 'name'.
      6. Include a detailed construction method with excavation, bedding, priming, jointing, drainage and curing steps.
      7. Return the JSON object with this exact format:
         {
           "materials": [...],
           "method": {
             "steps": [...],
             "considerations": [...]
           }
         }
      8. Respond with the raw JSON only. No markdown, text, or formatting.
    `;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();
    const jsonStart = aiText.indexOf('{');
    const jsonEnd = aiText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI did not return a valid JSON object.");
    const parsed = JSON.parse( aiText.slice(jsonStart, jsonEnd + 1) );
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Error in serverless function:", error);
    return res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}
