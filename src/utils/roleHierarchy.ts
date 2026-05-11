import type { Role } from "../types/express";

/**
 * Higher number = more authority. Used for "who can create / approve / manage whom".
 *
 * Rule of thumb: a user can create or act on roles with a STRICTLY LOWER level than themselves.
 */
export const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  HR: 80,
  MANAGER: 70,
  TL: 60,
  CAPTAIN: 55,
  ACCOUNTANT: 50,
  CASHIER: 45,
  STAFF: 30,
  TRAINEE: 20,
};

/**
 * Roles that can be CREATED directly via the admin "create user" flow.
 * STAFF and TRAINEE are excluded because they go through public self-registration.
 */
export const ADMIN_CREATABLE_ROLES: Role[] = [
  "ADMIN",
  "HR",
  "MANAGER",
  "TL",
  "CAPTAIN",
  "ACCOUNTANT",
  "CASHIER",
];

/**
 * Returns whether `actor` can create a user with role `target`.
 *
 *  - The actor must have strictly higher authority than the target.
 *  - The target role must be in the admin-creatable set.
 */
export function canCreateRole(actor: Role, target: Role): boolean {
  if (!ADMIN_CREATABLE_ROLES.includes(target)) return false;
  return ROLE_LEVEL[actor] > ROLE_LEVEL[target];
}

/**
 * Returns the list of roles `actor` is allowed to create.
 */
export function creatableRolesFor(actor: Role): Role[] {
  return ADMIN_CREATABLE_ROLES.filter((r) => ROLE_LEVEL[actor] > ROLE_LEVEL[r]);
}

/**
 * Roles allowed to APPROVE or REJECT a self-registered candidate (STAFF / TRAINEE).
 */
export const CANDIDATE_REVIEWER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

/**
 * Roles allowed to call the admin "create user" endpoint at all.
 */
export const USER_CREATOR_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"];
