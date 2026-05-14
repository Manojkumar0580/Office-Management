import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { escapeHtml } from "../utils/htmlEscape";
import { renderTemplate } from "../utils/renderTemplate";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function appName() {
  return process.env.APP_NAME?.trim() || "Office management";
}

function getFrom(): string | undefined {
  return process.env.SMTP_FROM?.trim() || undefined;
}

function createTransporter(): Transporter {
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

function resolveEmailTemplate(filename: string): string {
  const besideServices = path.join(__dirname, "..", "templates", "email", filename);
  if (fs.existsSync(besideServices)) return fs.readFileSync(besideServices, "utf8");
  const fromSrc = path.join(process.cwd(), "src", "templates", "email", filename);
  if (fs.existsSync(fromSrc)) return fs.readFileSync(fromSrc, "utf8");
  throw new Error(`Email template not found: ${filename}`);
}

function buildIdSectionHtml(input: {
  employeeId?: string | null;
  traineeId?: string | null;
  humanId?: string | null;
}): string {
  const blocks: string[] = [];
  if (input.employeeId) {
    blocks.push(
      `<p style="margin:8px 0 0 0;"><span style="color:#666;">Employee ID</span><br /><strong>${escapeHtml(String(input.employeeId))}</strong></p>`,
    );
  }
  if (input.traineeId) {
    blocks.push(
      `<p style="margin:8px 0 0 0;"><span style="color:#666;">Trainee ID</span><br /><strong>${escapeHtml(String(input.traineeId))}</strong></p>`,
    );
  }
  if (!input.employeeId && !input.traineeId && input.humanId) {
    blocks.push(
      `<p style="margin:8px 0 0 0;"><span style="color:#666;">Account ID</span><br /><strong>${escapeHtml(String(input.humanId))}</strong></p>`,
    );
  }
  return blocks.join("\n");
}

function buildLoginSectionHtml(): string {
  const raw = process.env.APP_PUBLIC_URL?.trim();
  if (raw) {
    const href = raw.replace(/\/$/, "");
    return (
      `<p style="margin:0;">` +
      `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;background:#3949ab;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Sign in</a>` +
      `</p>` +
      `<p style="margin:10px 0 0 0;font-size:13px;color:#666;word-break:break-all;">${escapeHtml(href)}</p>`
    );
  }
  return `<p style="margin:0;font-size:14px;color:#555;">Sign in using your organisation’s app or website with your registered email and password.</p>`;
}

function buildAccountApprovedPlainText(input: {
  fullName: string;
  role: string;
  employeeId?: string | null;
  traineeId?: string | null;
  humanId?: string | null;
}): string {
  const name = appName();
  const lines = [
    `Hello ${input.fullName},`,
    "",
    `Your ${name} account has been approved and is now active.`,
    "",
    `Role: ${input.role}`,
  ];
  if (input.employeeId) lines.push(`Employee ID: ${input.employeeId}`);
  if (input.traineeId) lines.push(`Trainee ID: ${input.traineeId}`);
  if (!input.employeeId && !input.traineeId && input.humanId) lines.push(`Account ID: ${input.humanId}`);
  const login = process.env.APP_PUBLIC_URL?.trim();
  lines.push("", login ? `Sign in: ${login.replace(/\/$/, "")}` : "Sign in with your registered email and password.");
  lines.push("", `— ${name}`);
  return lines.join("\n");
}

export async function sendPasswordResetOtp(to: string, otp: string, expiresMinutes: number) {
  const from = getFrom();
  if (!smtpConfigured() || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[password-reset] (dev — SMTP not configured) Verification code for ${to}: ${otp}\n` +
          `This code expires in ${expiresMinutes} minute(s). In production, configure SMTP_HOST and SMTP_FROM to send email.`,
      );
    }
    return;
  }

  const transporter = createTransporter();
  const name = appName();

  await transporter.sendMail({
    from,
    to,
    subject: `${name} — password reset verification code`,
    text:
      `Hello,\n\n` +
      `You asked to reset the password for your ${name} account.\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code expires in ${expiresMinutes} minute(s). Do not share this code with anyone.\n\n` +
      `If you did not request a password reset, you can safely ignore this email. Your password will not be changed.\n\n` +
      `— ${name}`,
    html: `<p>Hello,</p>
<p>You asked to reset the password for your <strong>${escapeHtml(name)}</strong> account.</p>
<p>Your verification code is:</p>
<p style="font-size:26px;font-weight:700;letter-spacing:6px;font-family:monospace;margin:16px 0">${escapeHtml(otp)}</p>
<p>This code expires in <strong>${expiresMinutes}</strong> minute(s). Do not share this code with anyone.</p>
<p>If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
<p style="margin-top:24px;color:#555">— ${escapeHtml(name)}</p>`,
  });
}

export async function sendAccountApprovedEmail(
  to: string,
  input: {
    fullName: string;
    role: string;
    employeeId?: string | null;
    traineeId?: string | null;
    humanId?: string | null;
  },
) {
  const from = getFrom();
  const name = appName();

  if (!smtpConfigured() || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[account-approved] (dev — SMTP not configured) Would email ${to}: account approved for ${input.fullName} (${input.role}).`,
      );
    }
    return;
  }

  const rawHtml = resolveEmailTemplate("account-approved.html");
  const idSectionHtml = buildIdSectionHtml(input);
  const loginSectionHtml = buildLoginSectionHtml();
  const html = renderTemplate(rawHtml, {
    appName: escapeHtml(name),
    fullName: escapeHtml(input.fullName),
    role: escapeHtml(input.role),
    idSectionHtml,
    loginSectionHtml,
  });

  const transporter = createTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `${name} — your account has been approved`,
    text: buildAccountApprovedPlainText(input),
    html,
  });
}
