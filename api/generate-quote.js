// /api/generate-quote.js

import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Helper to call your intelligent WordPress API ---
async function searchWordPressProducts(query) {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('WP search failed:', res.status, await res.text());
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error('Error fetching WP API:', err);
    return [];
  }
}

// --- AI functions to generate the initial plan ---
async function getProjectType(desc, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `In a few words, identify the primary trade or construction task for: "${desc}".`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateExpertPlan(desc, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a UK-based expert quantity surveyor and construction project planner for ${projectType}.

You must generate a detailed quote based on the following project description:
"${desc}"

Your output must be a single JSON object only:
{
  "materials": [ 
    { "name": "string", "quantity": number, "unit": "string" } 
  ],
  "method": {
    "steps": [ "string" ],
    "considerations": [ "string" ]
  },
  "customerQuote": {
    "labourHours": number
  }
}

Guidance:
- Materials must reflect accurate quantities, units (e.g. m², bags, kg), and types.
- Choose materials appropriate for UK Building Regulations, trade norms, and job context.
- Exclude mismatched materials (e.g. fire cement for patios, or trade packs when bulk bags are more appropriate).
- In "method", provide a **step-by-step guide** that a beginner could follow, but that a professional could print and give to a crew.
- Steps must be written clearly, in sequence, and describe every necessary phase of the job including setup, prep, execution, and cleanup.
- In "considerations", include:
  - site conditions,
  - regulatory issues,
  - accessibility,
  - weather factors,
  - delivery or storage,
  - safety,
  - disposal,
  - waste,
  - PPE.

Do not include explanations outside the JSON object.
  `.trim();

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// --- Main Handler ---
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

    // 1. Determine project type
    const projectType = await getProjectType(jobDescription, genAI);

    // 2. Generate initial plan from the main AI
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // 3. Safely extract data from the plan
    const materialsList = Array.isArray(plan.materials) ? plan.materials : [];
    const method = plan.method || { steps: [], considerations: [] };
    const cq = plan.customerQuote || {};
    const labourHours = Number(cq.labourHours) || 0;
    const labourRate = 35;

    // 4. Find matching products for each material using your smart WordPress API
    const finalMaterials = [];
    for (const mat of materialsList) {
      const materialName = (mat.name || '').trim();
      if (!materialName) continue;

      const productMatches = await searchWordPressProducts(materialName);

      const options = productMatches.map(p => ({
        id: p.id,
        name: p.name,
        image: p.image,
        description: p.description,
        link: p.link,
      }));

      options.unshift({
        id: `manual-${materialName.replace(/\s+/g, '-')}`,
        name: `Manually Select a "${materialName}"...`,
        image: null,
        description: 'Choose one of the suggested products or search your catalogue.',
        link: null,
      });

      finalMaterials.push({ ...mat, name: materialName, options });
    }

    // 5. Assemble and return the final quote
    const quote = {
      materials: finalMaterials,
      method,
      customerQuote: {
        ...cq,
        quoteNumber: `Q-${Date.now()}`,
        date: new Date().toLocaleDateString('en-GB'),
        labourHours,
        labourRate,
      },
    };

    return res.status(200).json(quote);
  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    return res.status(500).json({
      error: 'Failed to generate quote',
      details: err.message,
    });
  }
}
