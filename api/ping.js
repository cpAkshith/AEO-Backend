export const config = { runtime: "edge" };
export default async function handler() {
  return new Response(JSON.stringify({ ok: true, t: Date.now() }), {
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
