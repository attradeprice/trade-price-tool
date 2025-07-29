import { GoogleGenerativeAI } from '@google/generative-ai';
import stringSimilarity from 'string-similarity';

// ——— Helper: strip sizes, “pack of”, parentheses, etc. ————————————
const cleanTitle = (title = '') =>
  title
    .replace(/(pack of\s*\d+|\d+\s?(x|×)\s?\d+\s?(mm|cm|m)?|\d+(mm|cm|m|kg|ltr|sqm|m²)|bulk|single|each)/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[-–|•]+.*/g, '')
    .trim();

// ——— Fetch products from your WP endpoint ——————————————————————
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

// ——— AI: Identify the main task/trade ————————————————————————
async function getProjectType(desc, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Identify in a few words the primary trade or construction task for: "${desc}".`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ——— AI: Generate materials + plan ——————————————————————————
async function generateExpertPlan(desc, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `
You are an expert in ${projectType}.
Based on: "${desc}", output **only** a JSON object:
{
  "materials": [ { "name":"string","quantity":number,"unit":"string" } ],
  "method":   { "steps":[ "string" ], "considerations":[ "string" ] },
  "customerQuote": { "labourHours": number }
}
`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// ——— Main handler ——————————————————————————————————————————
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

    // 1) What are we doing?
    const projectType = await getProjectType(jobDescription, genAI);

    // 2) Materials + method + labour
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // 3) Safe defaults
    const materialsList = Array.isArray(plan.materials) ? plan.materials : [];
    const method = (plan.method && typeof plan.method === 'object')
      ? plan.method
      : { steps: [], considerations: [] };
    const cq = (plan.customerQuote && typeof plan.customerQuote === 'object')
      ? plan.customerQuote
      : {};
    const labourHours = Number(cq.labourHours) || 0;
    const labourRate  = Number(cq.labourRate)  || 35;

    // 4) For each material, return ALL matching products
    const finalMaterials = [];
    for (const mat of materialsList) {
      // accept .name or .item
      const materialName = (mat.name || mat.item || '').trim();
      if (!materialName) continue;

      // strip sizes before search
      const queryTerm = cleanTitle(materialName);

      // fetch all products matching our cleaned query
      let products = await searchWordPressProducts(queryTerm);

      // filter out any “colour” dyes
      products = products.filter(p => !/colour\b/i.test(p.name));

      // if none found, fallback to manual entry
      if (!products.length) {
        finalMaterials.push({
          ...mat,
          name: materialName,
          options: [{
            id: `manual-${queryTerm.replace(/\s+/g,'-')}`,
            name: materialName,
            image: null,
            description: '❌ Not found — please manually price this item.',
            link: null
          }]
        });
        continue;
      }

      // fuzzy-sort **all** returned products by similarity
      const cleanedMat = queryTerm;
      const targets = products.map(p => cleanTitle(p.name));
      const { ratings } = stringSimilarity.findBestMatch(cleanedMat, targets);

      const sortedProducts = ratings
        .map(r => ({
          rating: r.rating,
          product: products.find(p => cleanTitle(p.name) === r.target)
        }))
        .filter(e => e.product)
        .sort((a, b) => b.rating - a.rating)
        .map(e => e.product);

      // build options array with **all** matches
      const options = sortedProducts.map(p => ({
        id: p.id,
        name: cleanTitle(p.name),
        image: p.image,
        description: p.description,
        link: `https://attradeprice.co.uk/?p=${p.id}`
      }));

      finalMaterials.push({
        ...mat,
        name: materialName,
        options
      });
    }

    // 5) Compile and return the quote
    const quote = {
      materials: finalMaterials,
      method,
      customerQuote: {
        ...cq,
        quoteNumber: `Q-${Date.now()}`,
        date:        new Date().toLocaleDateString('en-GB'),
        labourHours,
        labourRate,
        labourCost:  labourHours * labourRate
      }
    };

    return res.status(200).json(quote);

  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    return res.status(500).json({ error: 'Failed to generate quote', details: err.message });
  }
}
