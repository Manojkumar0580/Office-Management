import "express";

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "HR"
  | "MANAGER"
  | "TL"
  | "STAFF"
  | "TRAINEE"
  | "CASHIER"
  | "CAPTAIN"
  | "ACCOUNTANT";

/**
 * Roles that an admin/HR/etc. creates directly (no self-registration, no PENDING_APPROVAL).
 */
export type AdminCreatedRole = Exclude<Role, "STAFF" | "TRAINEE">;

/**
 * Roles that self-register via public endpoints and need admin approval.
 */
export type SelfRegisterRole = Extract<Role, "STAFF" | "TRAINEE">;

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      role: Role;
    };
  }
}
