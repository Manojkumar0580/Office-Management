import type { Role } from "../types/express";

/** Work progress: SUPER_ADMIN / ADMIN, or the project's assigned TL/CAPTAIN lead. */
export function canAccessProjectProgress(
  role: Role,
  actorUserId: string,
  tlUserId?: string | null,
): boolean {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  if (!tlUserId) return false;
  if (tlUserId !== actorUserId) return false;
  return role === "TL" || role === "CAPTAIN";
}

export function isProjectAdminRole(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Overview/dashboard: see progress on all projects (not only own TL projects). */
export function canViewAllProjectsProgress(role: Role): boolean {
  return isProjectAdminRole(role) || role === "MANAGER";
}
