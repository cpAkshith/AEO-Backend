export const config = { runtime: "edge" };

export default async function handler() {
  const key = process.env.OPENROUTER_API_KEY || "";
  return new Response(JSON.stringify({
    hasKey: !!key,
    endsWith: key ? key.slice(-4) : null
  }), {
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
