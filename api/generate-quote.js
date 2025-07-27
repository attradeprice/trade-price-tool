import { GoogleGenerativeAI } from '@google/generative-ai';

// STEP 1: Call Gemini to extract intelligent search terms
async function extractSearchKeywordsFromAI(description, model) {
  const prompt = `
    Based on the following construction job description, return a list of concise search keywords
    you would use to find relevant UK building materials from a merchant's online product catalog.

    Focus on material types, tools, and job components.
    Output as a plain JavaScript array of lowercase search terms.

    Job Description:
    """
    ${description}
    """

    Response format:
    ["keyword1", "keyword2", "keyword3"]
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']') + 1;
  const cleaned = text.substring(jsonStart, jsonEnd);
  return JSON.parse(cleaned);
}

// STEP 2: Fetch matching products from WordPress
async function searchWordPressProducts(keywords) {
  const query = keywords.join(' ');
  const searchUrl = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl);
  if (!response.ok) throw new Error(`WP search failed: ${response.statusText}`);
  return await response.json();
}

// STEP 3: Generate final plan and materials
async function generatePlanWithAI(description, catalog, model) {
  const prompt = `
    You are a UK construction quantity surveyor AI assistant.
    Based on the job description and product catalog, generate a material list and method.

    Job Description:
    """
    ${description}
    """

    Product Catalog:
    ${JSON.stringify(catalog, null, 2)}

    Rules:
    1. You may infer required materials based on UK standards.
    2. You may include materials even if no product match exists, label them as "(to be quoted)".
    3. For matching products, use exact title and link.
    4. If multiple products match a material need, group them under 'options'.
    5. Include image URLs.
    6. Provide a detailed step-by-step method with technical depth, build-up layers, correct depths, and considerations.

    Output JSON only:
    {
      "materials": [...],
      "method": {
        "steps": [...],
        "considerations": [...]
      }
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}') + 1;
  return JSON.parse(text.substring(jsonStart, jsonEnd));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) return res.status(400).json({ error: 'Missing jobDescription' });

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Google API key not found');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Step 1: Extract smart keywords
    const keywords = await extractSearchKeywordsFromAI(jobDescription, model);
    console.log('Extracted Keywords:', keywords);

    // Step 2: Search WP
    const products = await searchWordPressProducts(keywords);
    console.log('Products Found:', products);

    // Step 3: Generate Plan
    const output = await generatePlanWithAI(jobDescription, products, model);
    res.status(200).json(output);

  } catch (error) {
    console.error('AI Quote Generator Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
