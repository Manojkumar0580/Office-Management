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

/** Every role value (for validation / Super Admin manual assignment). */
export const ALL_ROLES = Object.keys(ROLE_LEVEL) as Role[];

/** Roles allowed on POST /users (all except STAFF / TRAINEE — those self-register). */
export const ADMIN_CREATE_USER_ROLES = ALL_ROLES.filter((r) => r !== "STAFF" && r !== "TRAINEE");

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

/** Roles an existing user can be promoted into (includes STAFF for TRAINEE → STAFF). */
export const PROMOTABLE_TARGET_ROLES: Role[] = [...ADMIN_CREATABLE_ROLES, "STAFF"];

/**
 * Returns whether `actor` can create a user with role `target`.
 *
 *  - Super Admin may create any role except STAFF / TRAINEE (including another SUPER_ADMIN).
 *  - Other actors: target must be in the admin-creatable set and strictly below the actor.
 */
export function canCreateRole(actor: Role, target: Role): boolean {
  // STAFF / TRAINEE always come from public self-registration, not admin create.
  if (target === "STAFF" || target === "TRAINEE") return false;
  if (actor === "SUPER_ADMIN") return true;
  if (!ADMIN_CREATABLE_ROLES.includes(target)) return false;
  return ROLE_LEVEL[actor] > ROLE_LEVEL[target];
}

/**
 * Returns the list of roles `actor` is allowed to create.
 */
export function creatableRolesFor(actor: Role): Role[] {
  if (actor === "SUPER_ADMIN") {
    return [...ADMIN_CREATE_USER_ROLES];
  }
  return ADMIN_CREATABLE_ROLES.filter((r) => ROLE_LEVEL[actor] > ROLE_LEVEL[r]);
}

/**
 * Whether a non–Super Admin may change `subject`'s role from `fromRole` to `toRole`.
 * Super Admin bypasses this and may set any role manually (see `promoteUser` in userService).
 *
 * - Subject must be below the actor; new role must be strictly below the actor.
 * - New role must be strictly higher than the old role (promotion only).
 * - SUPER_ADMIN is never a valid promotion target or source here.
 */
export function canPromoteUser(actor: Role, fromRole: Role, toRole: Role): boolean {
  if (fromRole === "SUPER_ADMIN" || toRole === "SUPER_ADMIN") return false;
  if (!PROMOTABLE_TARGET_ROLES.includes(toRole)) return false;
  if (ROLE_LEVEL[actor] <= ROLE_LEVEL[fromRole]) return false;
  if (ROLE_LEVEL[actor] <= ROLE_LEVEL[toRole]) return false;
  if (ROLE_LEVEL[toRole] <= ROLE_LEVEL[fromRole]) return false;
  return true;
}

/**
 * Roles allowed to APPROVE or REJECT a self-registered candidate (STAFF / TRAINEE).
 */
export const CANDIDATE_REVIEWER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

/**
 * Roles allowed to call the admin "create user" endpoint at all.
 */
export const USER_CREATOR_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"];
