import { ApiError } from "../utils/apiError";
import { IdSequenceModel, type SequenceKey } from "../models/IdSequence";
import type { Role } from "../types/express";

const PREFIX_BY_KEY: Record<SequenceKey, string> = {
  EMPLOYEE: "EMP",
  TRAINEE: "TRN",
  ADMIN: "ADM",
  HR: "HR",
  MANAGER: "MGR",
  TL: "TL",
  CASHIER: "CSH",
  CAPTAIN: "CPT",
  ACCOUNTANT: "ACT",
};

function padNumber(value: number, width: number) {
  const s = String(value);
  if (s.length >= width) return s;
  return "0".repeat(width - s.length) + s;
}

export async function nextHumanId(key: SequenceKey) {
  const prefix = PREFIX_BY_KEY[key];
  if (!prefix) throw new ApiError(500, `No prefix configured for sequence key ${key}`);
  const width = 6;

  const seq = await IdSequenceModel.findOneAndUpdate(
    { key },
    { $inc: { nextValue: 1 } },
    { new: true, upsert: true },
  );

  if (!seq?.nextValue) throw new ApiError(500, "Failed to generate ID");
  const current = seq.nextValue - 1;
  return `${prefix}${padNumber(current, width)}`;
}

/**
 * Maps a role to the right SequenceKey for human-readable IDs.
 * SUPER_ADMIN doesn't get a generated humanId (only one exists).
 */
export function sequenceKeyForRole(role: Role): SequenceKey | null {
  switch (role) {
    case "SUPER_ADMIN":
      return null;
    case "ADMIN":
      return "ADMIN";
    case "HR":
      return "HR";
    case "MANAGER":
      return "MANAGER";
    case "TL":
      return "TL";
    case "STAFF":
      return "EMPLOYEE";
    case "TRAINEE":
      return "TRAINEE";
    case "CASHIER":
      return "CASHIER";
    case "CAPTAIN":
      return "CAPTAIN";
    case "ACCOUNTANT":
      return "ACCOUNTANT";
    default:
      return null;
  }
}
