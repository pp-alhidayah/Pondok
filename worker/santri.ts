interface Env {
  DB: D1Database;
}

const ALLOWED_CATEGORIES = new Set(["Mukim", "Nduduk", "Kilatan"]);
const ALLOWED_STATUS = new Set(["Aktif", "Tidak Aktif"]);
const FIELDS = [
  "nis", "nama", "nama_wali", "no_hp_santri", "no_hp_wali",
  "kategori", "status", "tanggal_masuk", "tanggal_keluar", "foto", "catatan",
] as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function fail(status: number, message: string, code: string): Response {
  return json({ message, code }, status);
}

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function pick(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const field of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) result[field] = body[field];
  }
  return result;
}

export async function handleSantriApi(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[2];

  if (method === "GET" && !id) {
    const search = (url.searchParams.get("search") || "").trim();
    const status = url.searchParams.get("status");
    const kategori = url.searchParams.get("kategori");
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (search) {
      conditions.push("(nama LIKE ? OR nis LIKE ? OR nama_wali LIKE ?)");
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== "Semua") { conditions.push("status = ?"); values.push(status); }
    if (kategori && kategori !== "Semua") { conditions.push("kategori = ?"); values.push(kategori); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await env.DB.prepare(
      `SELECT * FROM santri ${where} ORDER BY created_at DESC`
    ).bind(...values).all();
    return json({ data: result.results || [] });
  }

  if (method === "GET" && id) {
    const row = await env.DB.prepare("SELECT * FROM santri WHERE id = ? LIMIT 1").bind(id).first();
    return row ? json({ data: row }) : fail(404, "Data santri tidak ditemukan", "NOT_FOUND");
  }

  if (method === "POST" && !id) {
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; }
    catch { return fail(400, "Format data tidak valid", "BAD_REQUEST"); }
    const data = pick(body);
    const nis = String(data.nis || "").trim();
    const nama = String(data.nama || "").trim();
    if (!nis || !nama) return fail(400, "NIS dan nama santri wajib diisi", "BAD_REQUEST");
    if (!ALLOWED_CATEGORIES.has(String(data.kategori))) return fail(400, "Kategori santri tidak valid", "BAD_REQUEST");
    if (data.status !== undefined && !ALLOWED_STATUS.has(String(data.status))) return fail(400, "Status santri tidak valid", "BAD_REQUEST");
    if (!validDate(data.tanggal_masuk)) return fail(400, "Tanggal masuk tidak valid", "BAD_REQUEST");
    if (data.tanggal_keluar && !validDate(data.tanggal_keluar)) return fail(400, "Tanggal keluar tidak valid", "BAD_REQUEST");
    if (data.tanggal_keluar && String(data.tanggal_keluar) < String(data.tanggal_masuk)) {
      return fail(400, "Tanggal keluar tidak boleh sebelum tanggal masuk", "BAD_REQUEST");
    }
    const duplicate = await env.DB.prepare("SELECT id FROM santri WHERE lower(nis) = lower(?) LIMIT 1").bind(nis).first();
    if (duplicate) return fail(409, "NIS sudah digunakan", "DUPLICATE_NIS");
    const now = new Date().toISOString();
    const newId = typeof body.id === "string" && body.id ? body.id : crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO santri
      (id, nis, nama, nama_wali, no_hp_santri, no_hp_wali, kategori, status,
       tanggal_masuk, tanggal_keluar, foto, catatan, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId, nis, nama, String(data.nama_wali || ""), String(data.no_hp_santri || ""),
      String(data.no_hp_wali || ""), String(data.kategori), String(data.status || "Aktif"),
      String(data.tanggal_masuk), data.tanggal_keluar || null, data.foto || null,
      data.catatan || null, now, now, userId, userId,
    ).run();
    const created = await env.DB.prepare("SELECT * FROM santri WHERE id = ?").bind(newId).first();
    return json({ data: created }, 201);
  }

  if (method === "PUT" && id) {
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; }
    catch { return fail(400, "Format data tidak valid", "BAD_REQUEST"); }
    const existing = await env.DB.prepare("SELECT * FROM santri WHERE id = ?").bind(id).first<Record<string, unknown>>();
    if (!existing) return fail(404, "Data santri tidak ditemukan", "NOT_FOUND");
    const data = pick(body);
    if (!Object.keys(data).length) return fail(400, "Tidak ada data yang diubah", "BAD_REQUEST");
    const merged = { ...existing, ...data };
    if (!String(merged.nis || "").trim() || !String(merged.nama || "").trim()) return fail(400, "NIS dan nama santri wajib diisi", "BAD_REQUEST");
    if (!ALLOWED_CATEGORIES.has(String(merged.kategori))) return fail(400, "Kategori santri tidak valid", "BAD_REQUEST");
    if (!ALLOWED_STATUS.has(String(merged.status))) return fail(400, "Status santri tidak valid", "BAD_REQUEST");
    if (!validDate(merged.tanggal_masuk)) return fail(400, "Tanggal masuk tidak valid", "BAD_REQUEST");
    if (merged.tanggal_keluar && !validDate(merged.tanggal_keluar)) return fail(400, "Tanggal keluar tidak valid", "BAD_REQUEST");
    if (merged.tanggal_keluar && String(merged.tanggal_keluar) < String(merged.tanggal_masuk)) return fail(400, "Tanggal keluar tidak boleh sebelum tanggal masuk", "BAD_REQUEST");
    const duplicate = await env.DB.prepare("SELECT id FROM santri WHERE lower(nis) = lower(?) AND id <> ? LIMIT 1").bind(String(merged.nis).trim(), id).first();
    if (duplicate) return fail(409, "NIS sudah digunakan", "DUPLICATE_NIS");
    const keys = Object.keys(data);
    const assignments = keys.map((key) => `${key} = ?`).join(", ");
    await env.DB.prepare(`UPDATE santri SET ${assignments}, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(...keys.map((key) => data[key]), new Date().toISOString(), userId, id).run();
    const updated = await env.DB.prepare("SELECT * FROM santri WHERE id = ?").bind(id).first();
    return json({ data: updated });
  }

  if (method === "DELETE" && id) {
    const existing = await env.DB.prepare("SELECT id FROM santri WHERE id = ?").bind(id).first();
    if (!existing) return fail(404, "Data santri tidak ditemukan", "NOT_FOUND");
    const payment = await env.DB.prepare(
      "SELECT id FROM iuran_pembayaran WHERE santri_id = ? LIMIT 1"
    ).bind(id).first();
    if (payment) {
      return fail(409, "Santri memiliki riwayat pembayaran sehingga tidak dapat dihapus. Ubah statusnya menjadi Tidak Aktif.", "HAS_PAYMENT_HISTORY");
    }
    await env.DB.prepare("DELETE FROM santri WHERE id = ?").bind(id).run();
    return new Response(null, { status: 204 });
  }

  return fail(405, "Metode atau alamat API tidak didukung", "METHOD_NOT_ALLOWED");
}
