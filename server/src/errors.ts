import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'ERROR'
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string) => new HttpError(400, message, 'BAD_REQUEST');
export const notFound = (message: string) => new HttpError(404, message, 'NOT_FOUND');
export const forbidden = (message = 'Akses ditolak') => new HttpError(403, message, 'FORBIDDEN');
export const conflict = (message: string) => new HttpError(409, message, 'CONFLICT');

export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new HttpError(status, message);
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }

  const mysqlError = error as { code?: string; errno?: number };
  if (mysqlError?.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: 'CONFLICT', message: 'Data sudah digunakan (duplikat)' });
    return;
  }
  if (mysqlError?.code === 'ER_NO_REFERENCED_ROW_2') {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Referensi data tidak ditemukan' });
    return;
  }
  if (mysqlError?.code === 'ER_ROW_IS_REFERENCED_2') {
    res.status(409).json({ error: 'CONFLICT', message: 'Data masih digunakan transaksi lain' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'INTERNAL', message: 'Terjadi kesalahan pada server' });
}
