import { GoogleGenerativeAI } from '@google/generative-ai';
import stringSimilarity from 'string-similarity';

// --- Helper: Clean product titles for matching and display
const cleanTitle = (title) =>
  title
    .replace(/(pack of\s*\d+|\d+\s?(x|×)\s?\d+\s?(mm|cm|m)?|\d+(mm|cm|m|kg|ltr|sqm|m²)|bulk|single|each)/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[-–|•]+.*/g, '')
    .trim();

// --- WordPress product search
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

// --- AI: Identify project type
async function getProjectType(jobDescription, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Identify the primary construction or trade task for this project: "${jobDescription}". Reply with a short phrase.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// --- AI: Generate expert plan (materials, method, labour)
async function generateExpertPlan(jobDescription, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `You are a UK expert in ${projectType}. Generate a valid JSON object with materials, method steps, considerations, and estimated labour hours based on this project:
"${jobDescription}".`;
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

    const projectType = await getProjectType(jobDescription, genAI);
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    const finalMaterials = [];

    for (const material of plan.materials) {
      const materialName = material?.name?.trim?.();
      if (!materialName) {
        console.warn("⚠️ Skipping material with missing name:", material);
        continue;
      }

      const products = await searchWordPressProducts(materialName);
      console.log(`🔍 Searching for: ${materialName}`);
      console.log(`📦 Found: ${products.length} matches`);

      const cleanedMaterial = cleanTitle(materialName);
      const rated = stringSimilarity.findBestMatch(
        cleanedMaterial,
        products.map(p => cleanTitle(p.name))
      );

      const topMatches = rated.ratings
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map(r => products.find(p => cleanTitle(p.name) === r.target))
        .filter(Boolean);

      finalMaterials.push({
        ...material,
        name: materialName,
        options: topMatches.length > 0
          ? topMatches.map(p => ({
              id: p.id,
              name: cleanTitle(p.name),
              image: p.image,
              description: p.description,
              link: `https://attradeprice.co.uk/?p=${p.id}`
            }))
          : [{
              id: `manual-${materialName.replace(/\s+/g, '-')}`,
              name: materialName,
              image: null,
              description: '❌ Not found — please manually price this item.',
              link: null
            }]
      });
    }

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
