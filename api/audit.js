
// Serverless API: POST /api/audit  { "url": "https://example.com" }
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.text());
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 8000);

    const prompt = `
You are an AEO editor. Using ONLY the provided text, return JSON with:
{
 "summary": "2-sentence summary",
 "faqs": [{"q":"...","a":"..."}],
 "qas":  [{"q":"...","a":"..."}],
 "howto": null
}`;
    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. Do not invent facts." },
          { role: "user", content: prompt + "\n\nTEXT:\n" + text }
        ]
      })
    }).then(r => r.json());

    const content = ai?.choices?.[0]?.message?.content || "{}";
    const output = JSON.parse(content);

    const score = (out => {
      let s = 0;
      if (out.summary) s += 20;
      if (out.faqs && out.faqs.length >= 5) s += 20;
      if (out.qas && out.qas.length >= 3) s += 20;
      return s + 40; // basic completeness
    })(output);

    return res.status(200).json({ score, output });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
