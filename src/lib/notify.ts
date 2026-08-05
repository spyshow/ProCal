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
  // Bounded timeouts (eng-review P1): a down relay fails fast (5s to connect,
  // 10s per socket op) instead of hanging the request.
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 5000,
    socketTimeout: 10000,
    greetingTimeout: 5000,
  });
  return transporter;
}

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string };

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

  // ponytail: full relay config present? If not, still attempt the send — many
  // local/dev SMTP relays accept unauthenticated submit on 25/587. A missing
  // var shouldn't hard-crash boot; the send itself reports what's wrong.
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

  try {
    const info = await getTransporter().sendMail({
      from: to,        // OV-β: envelope From = our own address (rewriting-safe)
      to,              // delivered to the leads mailbox
      replyTo: input.replyToEmail, // a reply reaches the lead directly
      subject,
      text: body,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "SMTP send failed";
    return { ok: false, error };
  }
}

/** Test hook: reset the cached transporter between unit tests (t22 mocks us). */
export function __resetTransporterForTests() {
  transporter = null;
}
