// /api/generate-quote.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Helper Functions (Keyword Extraction, Product Grouping) ---

const stopWords = new Set([
  'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is',
  'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
  'grass', 'metres', 'meter', 'long', 'high', 'by', 'from'
]);

const extractKeywords = (text) => {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  const synonyms = {
    patio: 'paving stone slab flags patio',
    fencing: 'fence panel post timber gravelboard',
    cement: 'cement mortar joint filler bonding',
    aggregate: 'sand gravel ballast mot subbase sub-base hardcore',
    wall: 'bricks blocks render pier footing coping',
  };
  const expanded = new Set(words);
  words.forEach(w => {
    if (synonyms[w]) synonyms[w].split(' ').forEach(s => expanded.add(s));
  });
  return Array.from(expanded).join(' ');
};

const cleanTitle = (title) =>
  title.replace(/\s?[\d.]+(m|mm|kg|m²|sqm|inch|")/gi, '').replace(/(\s+–\s+.*|\(.*\))/gi, '').trim();

const groupProducts = (results) => {
  const groups = {};
  if (!Array.isArray(results)) return groups;
  results.forEach(p => {
    const baseName = cleanTitle(p.name);
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push({ id: p.id, name: p.name, image: p.image, description: p.description });
  });
  return groups;
};

const searchWordPressProducts = async (query) => {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('WordPress search failed:', res.status, await res.text());
      return [];
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching from WordPress API:', error);
    return [];
  }
};

// --- NEW DYNAMIC AI-POWERED LOGIC ---

/**
 * Step 1: Use AI to analyze the user's request and identify the core task.
 */
async function getProjectType(jobDescription, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `
    Analyze the following job description and identify the primary construction or trade task being described.
    Respond with a short, descriptive phrase. Examples: "Patio Construction", "Fence Installation", "Sink Plumbing", "Carburetor Reassembly", "Roof Tiling".
    Description: "${jobDescription}"
    Task:`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Step 2: Use AI with an "expert persona" to generate a detailed, accurate plan.
 */
async function generateExpertPlan(jobDescription, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `
    You are a world-class expert in **${projectType}**. Your task is to provide a highly detailed material quotation and construction method based on the user's project, adhering strictly to UK standards and best practices.

    **USER'S PROJECT DESCRIPTION:**
    "${jobDescription}"

    **YOUR TASK:**
    Analyze the request and generate a JSON object with the following structure. You must follow all rules precisely.

    **RULES & GUIDELINES:**
    1.  **Material Names:** Use generic, industry-standard names for materials (e.g., "MOT Type 1", "Sharp Sand", "Cement"). DO NOT include tools like "Wacker Plate" or "Spirit Level" in the material list.
    2.  **Quantities:** Provide realistic, accurate quantity estimations based on the project description. For common tasks like patios, use standard calculations (e.g., 150mm sub-base, 4:1 mortar mix).
    3.  **Method:** The construction steps must be extremely detailed, clear, and written for a novice. Explain the 'why' behind each step. Be comprehensive.
    4.  **Labour:** Provide a realistic estimate of the total labour hours required.

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
  
  const result = await model.generateContent(prompt);
  const rawResponse = result.response.text();
  const jsonString = rawResponse.substring(rawResponse.indexOf('{'), rawResponse.lastIndexOf('}') + 1);
  return JSON.parse(jsonString);
}


// --- Main API Handler ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing job description' });
    }

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);

    // Step 1: Understand what the user wants to do.
    const projectType = await getProjectType(jobDescription, genAI);

    // Step 2: Generate the expert plan based on the project type.
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // Step 3: Search for relevant products on your website.
    const keywords = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);
    const groupedProducts = groupProducts(searchResults);

    // Step 4: Match the AI-generated materials with your website's products.
    const finalMaterials = plan.materials.map(material => {
      const cleanName = cleanTitle(material.name);
      const matchingGroup = groupedProducts[cleanName];
      
      return {
        ...material,
        options: matchingGroup && matchingGroup.length ? matchingGroup : [{
          id: `manual-${cleanName.replace(/\s+/g, '-')}`,
          name: material.name,
          image: null,
          description: 'Generic item. Please select a specific product.',
        }]
      };
    });

    // Step 5: Build the final quote object.
    const quote = {
      materials: finalMaterials,
      method: plan.method,
      customerQuote: {
        ...plan.customerQuote,
        quoteNumber: `Q-${Date.now()}`,
        date: new Date().toLocaleDateString('en-GB'),
        labourRate: 35,
        labourCost: (plan.customerQuote.labourHours || 0) * 35,
      }
    };

    res.status(200).json(quote);

  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    res.status(500).json({ error: 'Failed to generate the quote.', details: err.message });
  }
}
