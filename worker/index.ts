
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ok: number}>();
        return Response.json({
          status: "ok",
          database: result?.ok === 1,
          runtime: "cloudflare-workers-d1"
        });
      } catch {
        return Response.json({
          status: "error",
          database: false
        }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
