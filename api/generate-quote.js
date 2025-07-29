// /api/generate-quote.js
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * A set of common words to ignore when extracting keywords from the job description.
 * This helps focus the search on the most important terms.
 */
const stopWords = new Set([
  'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is',
  'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
  'grass', 'metres', 'meter', 'long', 'high', 'by', 'from'
]);

/**
 * Extracts and expands keywords from the user's job description to improve product search.
 * @param {string} text - The user's job description.
 * @returns {string} A space-separated string of keywords.
 */
const extractKeywords = (text) => {
  // Normalize text and filter out stop words and short words.
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter((w) => !stopWords.has(w) && w.length > 2);

  // A dictionary to expand common terms to related product keywords.
  const synonyms = {
    patio: 'paving stone slab flags patio',
    fencing: 'fence panel post timber gravelboard',
    cement: 'cement mortar joint filler bonding',
    aggregate: 'sand gravel ballast mot subbase sub-base hardcore',
    wall: 'bricks blocks render pier footing coping',
  };

  // Expand the initial set of words with synonyms.
  const expanded = new Set(words);
  words.forEach((w) => {
    if (synonyms[w]) {
      synonyms[w].split(' ').forEach((s) => expanded.add(s));
    }
  });

  return Array.from(expanded).join(' ');
};

/**
 * Cleans a product title to create a generic base name for grouping.
 * e.g., "Sandstone Paving Slabs (22mm)" -> "Sandstone Paving Slabs"
 * @param {string} title - The full product title.
 * @returns {string} The cleaned, base name of the product.
 */
const cleanTitle = (title) =>
  title
    .replace(/\s?[\d.]+(m|mm|kg|m²|sqm|inch|")/gi, '') // Remove measurements
    .replace(/(\s+-\s+.*|\(.*\))/, '') // Remove text in parentheses or after a hyphen
    .trim();

/**
 * Groups an array of product results into categories based on their cleaned title.
 * @param {Array<Object>} results - The array of products from the WordPress search.
 * @returns {Object} An object where keys are base names and values are arrays of product variants.
 */
const groupProducts = (results) => {
  const groups = {};
  if (!Array.isArray(results)) return groups; // Return empty object if results is not an array
  results.forEach((p) => {
    const baseName = cleanTitle(p.name);
    if (!groups[baseName]) {
      groups[baseName] = [];
    }
    groups[baseName].push({
      id: p.id, // This should be the product ID from WordPress
      name: p.name,
      image: p.image || null,
      description: p.description || '',
    });
  });
  return groups;
};

/**
 * Fetches products from the custom WordPress REST API endpoint.
 * @param {string} query - The search query string.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of product objects.
 */
const searchWordPressProducts = async (query) => {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('WordPress search failed:', res.status, await res.text());
      throw new Error(`Product search failed with status: ${res.status}`);
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching from WordPress API:', error);
    throw error;
  }
};

/**
 * The main API handler for generating a quote.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing job description' });
    }

    // 1. Search for relevant products on the WordPress site.
    const keywords = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);
    const groupedProducts = groupProducts(searchResults);

    // 2. Format the product data for the AI, providing clear categories and variants.
    const structuredProductData = Object.entries(groupedProducts).map(([baseName, variants]) => {
      const variantDetails = variants.map(v => `- ${v.name} (ID: ${v.id})`).join('\n');
      return `Category: "${baseName}"\nVariants:\n${variantDetails}`;
    }).join('\n\n');

    // [!important] Add a fallback instruction if no products are found.
    const materialInstructions = structuredProductData
      ? `Create a material list. For each required material, you **MUST** use the exact "Category" name (e.g., "Paving Slabs") from the list below. Do not invent new names.`
      : `Create a GENERIC material list based on the project description as no specific products were found. The user will select specific products later.`;

    // 3. Create a detailed prompt for the AI.
    const prompt = `
You are a UK-based quantity surveyor for a builder's merchant. Your task is to analyze a customer's project description and generate a detailed material list and construction method.

**Project Description:**
"${jobDescription}"

**Available Material Categories and Their Variants:**
${structuredProductData || "None found. Please generate a generic list."}

**Instructions:**
1.  Rewrite the project description into a professional summary for the customer.
2.  ${materialInstructions}
3.  Estimate the quantity and appropriate unit for each material.
4.  Estimate the total labour hours required.
5.  Provide a step-by-step construction method based on UK building best practices.
6.  List any important considerations or potential issues.

**Output Format:**
Respond **only** with a single, valid JSON object. Do not include any other text or markdown formatting.

\`\`\`json
{
  "materials": [
    {
      "name": "string",
      "quantity": number,
      "unit": "string"
    }
  ],
  "method": {
    "steps": [ "string" ],
    "considerations": [ "string" ]
  },
  "customerQuote": {
    "rewrittenProjectSummary": "string",
    "labourHours": number
  }
}
\`\`\`
`;

    // 4. Call the Generative AI model.
    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    
    // [!important] More robustly clean the AI response to ensure it's valid JSON.
    const startIndex = rawResponse.indexOf('{');
    const endIndex = rawResponse.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
        throw new Error('AI response did not contain a valid JSON object.');
    }
    const jsonString = rawResponse.substring(startIndex, endIndex + 1);
    const json = JSON.parse(jsonString);

    // 5. Match the AI's material list back to the WordPress products.
    if (json.materials) {
      json.materials.forEach((item) => {
        const cleanName = item.name.replace(/"/g, '');
        const matchingGroup = groupedProducts[cleanName];
        
        item.name = cleanName; // Use the cleaned name for display.
        
        // Assign the corresponding product variants for the dropdown.
        item.options = matchingGroup && matchingGroup.length ? matchingGroup : [
          {
            id: `manual-${cleanName.replace(/\s+/g, '-')}`,
            name: cleanName,
            image: null,
            description: 'Generic item, please select a specific product.',
          },
        ];
      });
    }

    // 6. Add final details to the quote object.
    if (json.customerQuote) {
        json.customerQuote.quoteNumber = `Q-${Date.now()}`;
        json.customerQuote.date = new Date().toLocaleDateString('en-GB');
        json.customerQuote.labourRate = 35; // Set a default labour rate
        json.customerQuote.labourCost = (json.customerQuote.labourHours || 0) * json.customerQuote.labourRate;
    }

    // 7. Send the complete quote object back to the frontend.
    res.status(200).json(json);

  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    res.status(500).json({ error: 'Failed to generate the quote.', details: err.message });
  }
}
