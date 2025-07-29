import { GoogleGenerativeAI } from '@google/generative-ai';
import stringSimilarity from 'string-similarity';

// --- Helper: Clean product titles
const cleanTitle = (title = '') =>
  title
    .replace(/(pack of\s*\d+|\d+\s?(x|×)\s?\d+\s?(mm|cm|m)?|\d+(mm|cm|m|kg|ltr|sqm|m²)|bulk|single|each)/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[-–|•]+.*/g, '')
    .trim();

// --- Search WordPress products
const searchWordPressProducts = async (query) => {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('WordPress search failed:', res.status, await res.text());
      return [];
    }
    return res.json();
  } catch (err) {
    console.error('Error fetching WordPress API:', err);
    return [];
  }
};

// --- AI: Identify project type
async function getProjectType(jobDescription, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Identify the primary construction or trade task for this project: "${jobDescription}". Reply with a short phrase.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// --- AI: Generate expert plan
async function generateExpertPlan(jobDescription, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `You are a UK expert in ${projectType}. Generate a valid JSON object with:
  - materials: [{ name: string, quantity: number, unit: string }]
  - method: { steps: string[], considerations: string[] }
  - customerQuote: { labourHours: number }
  based on this description: "${jobDescription}"`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// --- Main API handler
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

    // 1. Identify project type
    const projectType = await getProjectType(jobDescription, genAI);

    // 2. Generate expert plan
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // Safe defaults
    const materialsList = Array.isArray(plan.materials) ? plan.materials : [];
    if (!Array.isArray(plan.materials)) {
      console.warn('⚠️ plan.materials was not an array:', plan.materials);
    }

    const method = plan.method && typeof plan.method === 'object'
      ? plan.method
      : { steps: [], considerations: [] };

    const cq = plan.customerQuote && typeof plan.customerQuote === 'object'
      ? plan.customerQuote
      : {};
    const labourHours = Number(cq.labourHours) || 0;
    const labourRate = Number(cq.labourRate) || 35;

    // 3. Build final materials with WordPress matches
    const finalMaterials = [];
    for (const material of materialsList) {
      // support either .name or .item from AI
      const materialName = material?.name?.trim?.() || material?.item?.trim?.();
      if (!materialName) {
        console.warn('⚠️ Skipping material without name/item:', material);
        continue;
      }

      // search and fuzzy-match
      const products = await searchWordPressProducts(materialName);
      console.log(`🔍 Searching for: ${materialName} → ${products.length} matches`);

      const cleanedMat = cleanTitle(materialName);
      const ratings = stringSimilarity.findBestMatch(
        cleanedMat,
        products.map(p => cleanTitle(p.name))
      ).ratings;

      const topMatches = ratings
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map(r => products.find(p => cleanTitle(p.name) === r.target))
        .filter(Boolean);

      // assemble options
      const options = topMatches.length > 0
        ? topMatches.map(p => ({
            id: p.id,
            name: cleanTitle(p.name),
            image: p.image,
            description: p.description,
            link: `https://attradeprice.co.uk/?p=${p.id}`,
          }))
        : [{
            id: `manual-${cleanedMat.replace(/\s+/g, '-')}`,
            name: materialName,
            image: null,
            description: '❌ Not found — please manually price this item.',
            link: null,
          }];

      finalMaterials.push({
        ...material,
        name: materialName,
        options,
      });
    }

    // 4. Compile quote
    const quote = {
      materials: finalMaterials,
      method,
      customerQuote: {
        ...cq,
        quoteNumber: `Q-${Date.now()}`,
        date: new Date().toLocaleDateString('en-GB'),
        labourHours,
        labourRate,
        labourCost: labourHours * labourRate,
      }
    };

    res.status(200).json(quote);
  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    res.status(500).json({ error: 'Failed to generate quote', details: err.message });
  }
}
