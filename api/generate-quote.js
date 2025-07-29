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
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => !stopWords.has(w) && w.length > 2);

  const synonyms = {
    patio: 'paving stone slab flags patio',
    fencing: 'fence panel post timber gravelboard',
    cement: 'cement mortar joint filler bonding',
    aggregate: 'sand gravel ballast mot subbase sub-base hardcore',
    wall: 'bricks blocks render pier footing coping',
  };

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
 * @param {string} title - The full product title.
 * @returns {string} The cleaned, base name of the product.
 */
const cleanTitle = (title) =>
  title
    .replace(/\s?[\d.]+(m|mm|kg|m²|sqm|inch|")/gi, '')
    .replace(/(\s+–\s+.*|\(.*\))/gi, '')
    .trim();

/**
 * Groups an array of product results into categories based on their cleaned title.
 * @param {Array<Object>} results - The array of products from the WordPress search.
 * @returns {Object} An object where keys are base names and values are arrays of product variants.
 */
const groupProducts = (results) => {
  const groups = {};
  if (!Array.isArray(results)) return groups;
  results.forEach((p) => {
    const baseName = cleanTitle(p.name);
    if (!groups[baseName]) {
      groups[baseName] = [];
    }
    groups[baseName].push({
      id: p.id,
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

    const keywords = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);
    const groupedProducts = groupProducts(searchResults);

    const structuredProductData = Object.entries(groupedProducts).map(([baseName, variants]) => {
      const variantDetails = variants.map(v => `- ${v.name} (ID: ${v.id})`).join('\n');
      return `Category: "${baseName}"\nVariants:\n${variantDetails}`;
    }).join('\n\n');

    const materialInstructions = structuredProductData
      ? `For each material, you MUST use the exact "Category" name from the list below.`
      : `Create a GENERIC material list as no specific products were found.`;

    // [!important] THIS IS THE NEW, EXPERT-LEVEL PROMPT
    const prompt = `
      You are an expert UK Quantity Surveyor and builder's merchant assistant. Your task is to provide a highly detailed and accurate material quotation and construction method based on a user's project description, adhering strictly to UK building regulations and best practices.

      **USER'S PROJECT DESCRIPTION:**
      "${jobDescription}"

      **AVAILABLE PRODUCTS FROM OUR WEBSITE:**
      ${structuredProductData || "No specific products found. Please specify generic materials."}

      **YOUR TASK:**
      Analyze the user's request and generate a JSON object with the following structure. You must follow all rules and calculations precisely.

      **RULES & CALCULATIONS (MANDATORY):**
      1.  **Sub-Base:** Assume a standard sub-base depth of 150mm (100mm for MOT Type 1, 50mm for sharp sand).
      2.  **MOT Type 1:** Calculate volume (Area x 0.1m depth). Convert to tonnes (Volume x 1.8). One bulk bag is 0.8 tonnes. Round UP to the nearest whole bag.
      3.  **Sharp Sand:** Calculate volume (Area x 0.05m depth). Convert to tonnes (Volume x 1.6). One bulk bag is 0.8 tonnes. Round UP to the nearest whole bag.
      4.  **Cement:** For a 4:1 mortar mix (sand:cement), the cement required is 1/5th of the sand's weight in tonnes. Convert this to 25kg bags (tonnes * 40). Round UP to the nearest whole bag.
      5.  **Paving Slabs:** Calculate the area. Add 10% for wastage and cuts.
      6.  **Weed Membrane:** Must equal the area of the sub-base.
      7.  **Labour:** Estimate labour at 1.5 hours per square metre for a standard patio.
      8.  **Method:** The construction steps must be extremely detailed, clear, and written for a novice builder. Mention depths, tools, safety, and timings.

      **OUTPUT FORMAT (JSON ONLY):**
      Respond with nothing but a single, valid JSON object.

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
          "steps": [
            "**Step 1: Site Preparation & Excavation** - Mark out the patio area using pegs and string. Excavate the soil to a depth of 170mm-200mm below the desired finished patio level. This allows for 100-150mm of sub-base, 30-40mm of mortar bed, and the thickness of the paving slab. Ensure the base of the excavation is firm and level.",
            "**Step 2: Install Edge Restraints** - Install solid edging restraints, such as concrete blocks or timber gravel boards, around the perimeter of the excavated area. Haunch them in place with concrete to ensure they are secure and won't move under pressure.",
            "**Step 3: Lay Weed Control Membrane** - Lay a geotextile weed control membrane over the entire excavated area, overlapping any joins by at least 150mm. This prevents weed growth while allowing water to drain through.",
            "**Step 4: Lay and Compact Sub-Base** - Spread a layer of MOT Type 1 aggregate to a compacted depth of 100-150mm. Use a rake to level it. Compact the sub-base thoroughly using a wacker plate, making at least three passes. The finished sub-base should be flat, solid, and well-compacted.",
            "**Step 5: Prepare the Mortar Bed** - Mix a mortar of 4 parts sharp sand to 1 part cement. It should be a damp, workable consistency - not too wet. Spread the mortar over a section of the sub-base to a depth of 30-40mm.",
            "**Step 6: Lay the Paving Slabs** - Begin laying the slabs, starting from a corner. Gently tap each slab down into the mortar with a rubber mallet until it is level and firm. Use a spirit level to check for level in all directions. Use tile spacers to ensure consistent 10-15mm gaps between each slab.",
            "**Step 7: Pointing the Joints** - Once all slabs are laid and the mortar has set (allow at least 24 hours), fill the joints between the slabs with a suitable jointing compound or a semi-dry mortar mix. Press the pointing material firmly into the joints and smooth it off for a clean finish.",
            "**Step 8: Final Cleaning** - After the jointing material has cured (check manufacturer's instructions), clean the surface of the patio to remove any residue or dirt."
          ],
          "considerations": [
            "Ensure a slight fall (slope) of 1 in 60 away from any buildings to allow for water drainage.",
            "Check for any underground pipes or cables before excavating.",
            "Wear appropriate PPE, including safety boots, gloves, and eye protection.",
            "Do not walk on the patio for at least 48-72 hours after laying to allow the mortar to cure properly."
          ]
        },
        "customerQuote": {
          "rewrittenProjectSummary": "string",
          "labourHours": number
        }
      }
      \`\`\`
      `;

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    
    const startIndex = rawResponse.indexOf('{');
    const endIndex = rawResponse.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
        throw new Error('AI response did not contain a valid JSON object.');
    }
    const jsonString = rawResponse.substring(startIndex, endIndex + 1);
    const json = JSON.parse(jsonString);

    if (json.materials) {
      json.materials.forEach((item) => {
        const cleanName = item.name.replace(/"/g, '');
        const matchingGroup = groupedProducts[cleanName];
        
        item.name = cleanName;
        
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

    if (json.customerQuote) {
        json.customerQuote.quoteNumber = `Q-${Date.now()}`;
        json.customerQuote.date = new Date().toLocaleDateString('en-GB');
        json.customerQuote.labourRate = 35;
        json.customerQuote.labourCost = (json.customerQuote.labourHours || 0) * json.customerQuote.labourRate;
    }

    res.status(200).json(json);

  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    res.status(500).json({ error: 'Failed to generate the quote.', details: err.message });
  }
}
