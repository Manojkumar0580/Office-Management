import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function hashPassword(password: string) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return await bcrypt.compare(password, passwordHash);
}

export function generateTempPassword(length = 12) {
  // URL-safe base64; slice for length
  return crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

export function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** 6-digit OTP for password reset (plain — only emailed, never persisted). */
export function randomSixDigitOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Deterministic hash for storing OTP. Uses OTP_PEPPER or JWT_SECRET (set in production).
 */
export function hashPasswordResetOtp(userId: string, email: string, otp: string) {
  const pepper = process.env.OTP_PEPPER || process.env.JWT_SECRET || "insecure-dev-only-otp-pepper";
  return sha256Hex(`${pepper}:${userId}:${email.toLowerCase()}:${otp}`);
}
