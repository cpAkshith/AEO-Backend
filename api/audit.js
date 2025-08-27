export const config = { runtime: "edge" };

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

export default async function handler(req) {
  // CORS & method
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { url } = await req.json();
    if (!url) return json({ error: "Missing url" }, 400);

    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.text());
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);

    const prompt = `
You are an AEO editor. Using ONLY the provided text, return STRICT JSON:
{
 "summary": "2 sentences",
 "faqs": [{"q":"...","a":"..."} x5],
 "qas":  [{"q":"...","a":"..."} x3],
 "howto": null
}
If info is missing, return empty arrays/null. Return ONLY the JSON.
TEXT:
${text}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-domain.example",
        "X-Title": "AEO Audit API"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. Do not invent facts." },
          { role: "user", content: prompt }
        ]
      })
    });

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || "{}";
    const output = JSON.parse(content);

    let score = 0;
    if (output.summary) score += 20;
    if (Array.isArray(output.faqs) && output.faqs.length >= 5) score += 20;
    if (Array.isArray(output.qas) && output.qas.length >= 3) score += 20;
    score += 40;

    return json({ score, output }, 200);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
