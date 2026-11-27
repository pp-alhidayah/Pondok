import bcrypt from "bcryptjs";
import { handleSantriApi } from "./santri";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

type UserRow = {
  id: string;
  username: string;
  nama: string;
  role: "super_admin" | "admin" | "pemilik";
  status: string;
  password_hash?: string;
};

const COOKIE = "al_hidayah_sid";
const SESSION_HOURS = 12;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}

function error(status: number, message: string, code: string): Response {
  return json({ message, code }, status);
}

function randomHex(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(rest.join("=")); } catch { return null; }
    }
  }
  return null;
}

function setCookie(value: string, maxAge: number): string {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function currentSession(request: Request, env: Env) {
  const sid = cookieValue(request, COOKIE);
  if (!sid) return null;

  const row = await env.DB.prepare(
    `SELECT s.id AS sid, s.csrf_token, s.expires_at,
            u.id, u.username, u.nama, u.role, u.status
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? LIMIT 1`
  ).bind(sid).first<any>();

  if (!row || row.status !== "Aktif" || Date.parse(String(row.expires_at)) <= Date.now()) {
    if (row) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }

  return {
    sid,
    csrfToken: String(row.csrf_token),
    user: {
      id: String(row.id),
      username: String(row.username),
      nama: String(row.nama),
      role: row.role as UserRow["role"],
    },
  };
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/auth/setup-status" && method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS jumlah FROM users")
      .first<{ jumlah: number }>();
    return json({ data: { needsSetup: Number(row?.jumlah || 0) === 0 } });
  }

  if (path === "/api/auth/setup" && method === "POST") {
    let body: any;
    try { body = await request.json(); }
    catch { return error(400, "Format data tidak valid", "BAD_REQUEST"); }

    const nama = cleanText(body?.nama);
    const username = cleanText(body?.username).toLowerCase();
    const password = cleanText(body?.password);

    if (!nama || !username || !password) {
      return error(400, "Nama, username, dan password wajib diisi", "BAD_REQUEST");
    }
    if (password.length < 8) {
      return error(400, "Password minimal 8 karakter", "BAD_REQUEST");
    }

    const existing = await env.DB.prepare("SELECT COUNT(*) AS jumlah FROM users")
      .first<{ jumlah: number }>();
    if (Number(existing?.jumlah || 0) > 0) {
      return error(409, "Super Admin sudah dibuat", "CONFLICT");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(password, 12);

    try {
      await env.DB.prepare(
        `INSERT INTO users (id, nama, username, password_hash, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'super_admin', 'Aktif', ?, ?)`
      ).bind(id, nama, username, hash, now, now).run();
    } catch {
      return error(409, "Username sudah digunakan atau Super Admin sudah dibuat", "CONFLICT");
    }

    return json({ data: { id, username, nama, role: "super_admin" } }, 201);
  }

  if (path === "/api/auth/login" && method === "POST") {
    let body: any;
    try { body = await request.json(); }
    catch { return error(400, "Format data tidak valid", "BAD_REQUEST"); }

    const username = cleanText(body?.username).toLowerCase();
    const password = cleanText(body?.password);
    if (!username || !password) {
      return error(400, "Username dan password wajib diisi", "BAD_REQUEST");
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? LIMIT 1")
      .bind(username).first<UserRow>();

    if (!user || !(await bcrypt.compare(password, String(user.password_hash || "")))) {
      return error(401, "Username atau password salah", "INVALID_CREDENTIALS");
    }
    if (user.status !== "Aktif") {
      return error(403, "Akun tidak aktif", "ACCOUNT_INACTIVE");
    }

    const sid = randomHex(32);
    const csrf = randomHex(24);
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);

    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(sid, user.id, csrf, expires.toISOString(), now.toISOString()).run();

    return json({
      data: {
        user: { id: user.id, username: user.username, nama: user.nama, role: user.role },
        csrfToken: csrf,
      },
    }, 200, { "set-cookie": setCookie(sid, SESSION_HOURS * 60 * 60) });
  }

  if (path === "/api/auth/me" && method === "GET") {
    const session = await currentSession(request, env);
    if (!session) {
      return json({ message: "Login diperlukan", code: "UNAUTHORIZED" }, 401, {
        "set-cookie": clearCookie(),
      });
    }
    return json({ data: { user: session.user, csrfToken: session.csrfToken } });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const session = await currentSession(request, env);
    if (!session) return error(401, "Login diperlukan", "UNAUTHORIZED");

    if (request.headers.get("x-csrf-token") !== session.csrfToken) {
      return error(403, "Token CSRF tidak valid", "FORBIDDEN");
    }

    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.sid).run();
    return json({ data: { ok: true } }, 200, { "set-cookie": clearCookie() });
  }

  if (
    path === "/api/santri" || path.startsWith("/api/santri/") ||
    path === "/api/master/santri" || path.startsWith("/api/master/santri/")
  ) {
    const session = await currentSession(request, env);
    if (!session) return error(401, "Login diperlukan", "UNAUTHORIZED");
    if (!["GET", "HEAD"].includes(method) &&
        request.headers.get("x-csrf-token") !== session.csrfToken) {
      return error(403, "Token CSRF tidak valid", "FORBIDDEN");
    }
    // Frontend API bridge uses /api/master/santri; direct service uses /api/santri.
    const target = new URL(request.url);
    target.pathname = target.pathname.replace(/^\\/api\\/master\\/santri/, "/api/santri");
    return handleSantriApi(new Request(target, request), env, session.user.id);
  }

  if (path.startsWith("/api/")) {
    return error(501, "Endpoint API ini belum dimigrasikan ke Cloudflare Workers", "NOT_IMPLEMENTED");
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({
          status: "ok",
          database: result?.ok === 1,
          runtime: "cloudflare-workers-d1",
          api: "auth+santri-v1",
        });
      }
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (cause) {
      console.error("Worker request failed", cause);
      return error(500, "Terjadi kesalahan pada server", "INTERNAL_ERROR");
    }
  },
};
