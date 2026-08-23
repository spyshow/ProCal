import nodemailer from "nodemailer";

/**
 * Captured-lead notification (Approach B, D4 = the HARD merge gate).
 *
 * Branch A in /api/contact is "send-first-then-persist": this must succeed
 * before a ContactRequest row is ever written. So this module resolves a
 * discriminated result — {ok:false} means the route returns an error and
 * persists nothing (the tested invariant T2: send-fail-no-row).
 *
 * Env (all required for send to succeed):
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS — relay credentials
 *   LEADS_TO_ADDRESS — the mailbox leads are delivered to AND the envelope
 *     From (OV-β): Gmail/O365 rewrite the From header to the authenticated
 *     account, so we send FROM our own address and put the requester's email
 *     in Reply-To + the body. That way a reply reaches the lead and the
 *     address survives even if Reply-To is stripped.
 */

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.resend.com",
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    greetingTimeout: 10000,
  });
  return transporter;
}

/**
 * Resolves the outbound "From" address for email delivery.
 * 1. Checks explicit SMTP_FROM_ADDRESS / EMAIL_FROM / SMTP_FROM env variables.
 * 2. If sending via Resend (api or smtp), defaults to 'ProCal <onboarding@resend.dev>'
 *    to comply with Resend unverified test domain rules.
 * 3. Falls back to LEADS_TO_ADDRESS if it's a valid non-local email, or no-reply@procal.app.
 */
export function getFromAddress(): string {
  if (process.env.SMTP_FROM_ADDRESS) return process.env.SMTP_FROM_ADDRESS;
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;

  if (
    process.env.SMTP_HOST?.toLowerCase().includes("resend") ||
    process.env.RESEND_API_KEY ||
    process.env.SMTP_PASS?.startsWith("re_")
  ) {
    return "ProCal <onboarding@resend.dev>";
  }

  const leadsTo = process.env.LEADS_TO_ADDRESS;
  if (leadsTo && !leadsTo.endsWith(".local") && leadsTo.includes("@")) {
    return `ProCal <${leadsTo}>`;
  }

  return "ProCal <no-reply@procal.app>";
}

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string };

export interface SendMailOptions {
  from?: string;
  to: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Unified email sender:
 * Priority 1: Direct Resend HTTPS REST API (bypasses cloud socket/firewall blocks)
 * Priority 2: Standard SMTP via Nodemailer
 */
export async function sendMailUnified(opts: SendMailOptions): Promise<SendResult> {
  const from = opts.from || getFromAddress();
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  const apiKey =
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_PASS?.startsWith("re_") ? process.env.SMTP_PASS : undefined);

  // 1. Try Resend HTTPS REST API if Resend API Key is configured
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          reply_to: opts.replyTo,
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.id) {
        console.log("[Resend API Success] Email sent, id:", data.id);
        return { ok: true, messageId: data.id };
      }

      console.warn("[Resend API Response Error, attempting SMTP fallback]:", data);
    } catch (apiErr) {
      console.warn("[Resend API Request Failed, attempting SMTP fallback]:", apiErr);
    }
  }

  // 2. SMTP Transport via Nodemailer
  try {
    const info = await getTransporter().sendMail({
      from,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    console.log("[SMTP Success] Email sent, messageId:", info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[SMTP Error] Failed to send email:", error);
    return { ok: false, error };
  }
}

export async function sendLeadNotification(input: {
  /** The lead's email — Reply-To + embedded in the body (OV-β). */
  replyToEmail: string;
  /** The lead's display name (User.name) for the subject + salutation. */
  name: string;
  username: string;
  message: string;
  requestedCredits?: number | null;
}): Promise<SendResult> {
  const to = process.env.LEADS_TO_ADDRESS;
  if (!to) {
    return { ok: false, error: "LEADS_TO_ADDRESS is not configured" };
  }

  const subject = `ProCal credit request — ${input.name || input.username}`;
  const body = [
    `New captured lead from ProCal.`,
    ``,
    `Name: ${input.name || "(none)"}`,
    `Username: ${input.username}`,
    `Email: ${input.replyToEmail}`, // OV-β: address also in body, survives Reply-To stripping
    input.requestedCredits != null ? `Requested credits: ${input.requestedCredits}` : ``,
    ``,
    `Message:`,
    input.message,
  ]
    .filter(Boolean)
    .join("\r\n");

  return sendMailUnified({
    to,
    replyTo: input.replyToEmail,
    subject,
    text: body,
  });
}

export async function sendFeedbackNotification(input: {
  category: string;
  subject?: string;
  replyToEmail?: string;
  name?: string;
  username?: string;
  message: string;
  pageUrl?: string;
  projectId?: string;
  projectName?: string;
  errorDetails?: string;
  systemInfo?: string;
}): Promise<SendResult> {
  const to = process.env.LEADS_TO_ADDRESS;
  if (!to) {
    return { ok: true, messageId: "dev-feedback-id" };
  }

  const categoryTag = input.category ? `[${input.category}] ` : "[Feedback] ";
  const subject = `ProCal Feedback: ${categoryTag}${input.subject || input.name || input.username || "User Report"}`;
  const body = [
    `New User Feedback / Error Report from ProCal`,
    `==========================================`,
    ``,
    `Category: ${input.category || "Bug / Error Report"}`,
    `Subject: ${input.subject || "(no subject)"}`,
    `User: ${input.name || "Guest"} (${input.username || "unauthenticated"})`,
    `Email: ${input.replyToEmail || "None provided"}`,
    input.pageUrl ? `Page URL: ${input.pageUrl}` : ``,
    input.projectId ? `Project: ${input.projectName || ""} (ID: ${input.projectId})` : ``,
    input.systemInfo ? `System Info: ${input.systemInfo}` : ``,
    ``,
    `User Message:`,
    `------------------------------------------`,
    input.message,
    ``,
    input.errorDetails ? `Error / Technical Details:\n------------------------------------------\n${input.errorDetails}\n` : ``,
  ]
    .filter(Boolean)
    .join("\r\n");

  return sendMailUnified({
    to,
    replyTo: input.replyToEmail || undefined,
    subject,
    text: body,
  });
}

export async function sendProjectInviteNotification(input: {
  toEmail: string;
  inviteeName: string;
  inviterName: string;
  projectName: string;
  role: string;
  acceptUrl: string;
}): Promise<SendResult> {
  const roleLabel = input.role === "PROJECT_MANAGER" ? "Project Manager" : input.role === "QA" ? "QA Reviewer" : "Engineer";
  const subject = `Invitation to join project "${input.projectName}" on ProCal`;

  const textBody = [
    `Hello ${input.inviteeName},`,
    ``,
    `${input.inviterName} has invited you to collaborate on the electrical engineering project "${input.projectName}" on ProCal as a ${roleLabel}.`,
    ``,
    `To accept this invitation and access the project workspace, please click the link below:`,
    input.acceptUrl,
    ``,
    `This invitation link will expire in 7 days.`,
    ``,
    `Best regards,`,
    `The ProCal Team`,
  ].join("\r\n");

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: bold; color: #ea580c; letter-spacing: -0.5px;">⚡ ProCal</span>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Electrical Load & MDB Design Platform</p>
      </div>
      <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #f8fafc;">You've been invited to join a project</h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #cbd5e1;">
          <strong>${input.inviterName}</strong> has invited you to collaborate on <strong>${input.projectName}</strong> as <strong>${roleLabel}</strong>.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${input.acceptUrl}" style="display: inline-block; background: linear-gradient(to right, #ea580c, #f97316); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
            Accept Invitation & Join Project
          </a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
          Or copy and paste this URL into your browser:<br/>
          <a href="${input.acceptUrl}" style="color: #ea580c; word-break: break-all;">${input.acceptUrl}</a>
        </p>
      </div>
      <p style="margin: 0; font-size: 11px; color: #64748b; text-align: center;">
        This invitation link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  if (!process.env.SMTP_HOST && !process.env.LEADS_TO_ADDRESS && !process.env.RESEND_API_KEY && !process.env.SMTP_PASS) {
    console.log("[DEV INVITE EMAIL] Would send invite to:", input.toEmail, "Accept URL:", input.acceptUrl);
    return { ok: true, messageId: "dev-invite-id" };
  }

  return sendMailUnified({
    to: input.toEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendPasswordResetNotification(input: {
  toEmail: string;
  name: string;
  username: string;
  resetUrl: string;
}): Promise<SendResult> {
  const subject = `Reset your ProCal password`;

  const textBody = [
    `Hello ${input.name || input.username},`,
    ``,
    `We received a request to reset the password for your ProCal account (${input.username}).`,
    ``,
    `To choose a new password, please click the link below:`,
    input.resetUrl,
    ``,
    `This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email; your account remains secure.`,
    ``,
    `Best regards,`,
    `The ProCal Team`,
  ].join("\r\n");

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: bold; color: #ea580c; letter-spacing: -0.5px;">⚡ ProCal</span>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Electrical Load & MDB Design Platform</p>
      </div>
      <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #f8fafc;">Password Reset Request</h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #cbd5e1;">
          Hello <strong>${input.name || input.username}</strong>, we received a request to reset the password for your ProCal account (<code>${input.username}</code>).
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${input.resetUrl}" style="display: inline-block; background: linear-gradient(to right, #ea580c, #f97316); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
            Reset Password
          </a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
          Or copy and paste this URL into your browser:<br/>
          <a href="${input.resetUrl}" style="color: #ea580c; word-break: break-all;">${input.resetUrl}</a>
        </p>
      </div>
      <p style="margin: 0; font-size: 11px; color: #64748b; text-align: center;">
        This password reset link will expire in 1 hour. If you did not request this, please ignore this email.
      </p>
    </div>
  `;

  if (!process.env.SMTP_HOST && !process.env.LEADS_TO_ADDRESS && !process.env.RESEND_API_KEY && !process.env.SMTP_PASS) {
    console.log("[DEV RESET PASSWORD EMAIL] Would send reset email to:", input.toEmail, "Reset URL:", input.resetUrl);
    return { ok: true, messageId: "dev-reset-id" };
  }

  return sendMailUnified({
    to: input.toEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

/** Test hook: reset the cached transporter between unit tests (t22 mocks us). */
export function __resetTransporterForTests() {
  transporter = null;
}

