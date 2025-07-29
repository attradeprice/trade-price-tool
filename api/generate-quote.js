import { GoogleGenerativeAI } from '@google/generative-ai';
import stringSimilarity from 'string-similarity';

const cleanTitle = (title = '') =>
  title
    .replace(/(pack of\s*\d+|\d+\s?(x|×)\s?\d+\s?(mm|cm|m)?|\d+(mm|cm|m|kg|ltr|sqm|m²)|bulk|single|each)/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[-–|•]+.*/g, '')
    .trim();

const searchWordPressProducts = async (query) => {
  console.log('🔎 [searchWordPressProducts] querying:', query);
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    console.log('🔎 [searchWordPressProducts] status:', res.status);
    if (!res.ok) {
      console.error('❌ WordPress search failed:', await res.text());
      return [];
    }
    const data = await res.json();
    console.log(`🔎 [searchWordPressProducts] got ${data.length} items`);
    return data;
  } catch (err) {
    console.error('❌ Error fetching WordPress API:', err);
    return [];
  }
};

async function getProjectType(jobDescription, genAI) {
  console.log('🧠 getProjectType input:', jobDescription);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Identify the primary construction or trade task for this project: "${jobDescription}". Reply with a short phrase.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  console.log('🧠 getProjectType output:', text);
  return text;
}

async function generateExpertPlan(jobDescription, projectType, genAI) {
  console.log(`🧠 generateExpertPlan for type "${projectType}"`);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `You are a UK expert in ${projectType}. Generate a valid JSON object with:
    - materials: [{ name: string, quantity: number, unit: string }]
    - method: { steps: string[], considerations: string[] }
    - customerQuote: { labourHours: number }
    based on this description: "${jobDescription}"`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  console.log('🧠 Raw AI output:', raw);
  const json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const plan = JSON.parse(json);
  console.log('🧠 Parsed plan:', plan);
  return plan;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { jobDescription } = req.body;
    console.log('🛠️ Incoming jobDescription:', jobDescription);
    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing job description' });
    }

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);

    const projectType = await getProjectType(jobDescription, genAI);
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // Dump the plan so we can see exactly what fields exist
    console.log('🛠️ AI plan object:', JSON.stringify(plan, null, 2));

    const materialsList = Array.isArray(plan.materials) ? plan.materials : [];
    if (!Array.isArray(plan.materials)) {
      console.warn('⚠️ plan.materials is not an array:', plan.materials);
    }

    const method = plan.method && typeof plan.method === 'object'
      ? plan.method
      : { steps: [], considerations: [] };

    const cq = plan.customerQuote && typeof plan.customerQuote === 'object'
      ? plan.customerQuote
      : {};
    const labourHours = Number(cq.labourHours) || 0;
    const labourRate = Number(cq.labourRate) || 35;

    const finalMaterials = [];
    for (const material of materialsList) {
      const materialName = material?.name?.trim?.() || material?.item?.trim?.();
      console.log('🛠️ Processing material:', material);
      if (!materialName) {
        console.warn('⚠️ Skipped malformed material:', material);
        continue;
      }

      const products = await searchWordPressProducts(materialName);
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

      finalMaterials.push({ ...material, name: materialName, options });
    }

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

    console.log('🛠️ Final quote object:', JSON.stringify(quote, null, 2));
    res.status(200).json(quote);

  } catch (err) {
    console.error('❌ Error in /api/generate-quote:', err);
    res.status(500).json({ error: 'Failed to generate quote', details: err.message });
  }
}
