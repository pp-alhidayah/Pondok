import type { Role } from './auth';

/** Role yang boleh melakukan perubahan data. `pemilik` bersifat read-only. */
export const WRITE_ROLES: Role[] = ['super_admin', 'admin'];
export const ADMIN_ROLES: Role[] = ['super_admin'];
