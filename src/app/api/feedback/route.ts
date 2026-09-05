import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendFeedbackNotification } from "@/lib/notify";
import { db } from "@/lib/db";

/**
 * POST /api/feedback — User feedback and error reporting endpoint.
 *
 * Allows users to report errors, calculation bugs, and feature suggestions directly
 * from any page in the app using the Floating Feedback FAB or modal.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    category = "Bug Report",
    subject = "",
    message,
    pageUrl = "",
    projectId = "",
    projectName = "",
    email: clientEmail = "",
    errorDetails = "",
    systemInfo = "",
    screenshot = "",
  } = (body || {}) as {
    category?: string;
    subject?: string;
    message?: string;
    pageUrl?: string;
    projectId?: string;
    projectName?: string;
    email?: string;
    errorDetails?: string;
    systemInfo?: string;
    screenshot?: string;
  };

  if (typeof message !== "string" || message.trim().length < 3) {
    return NextResponse.json(
      { error: "A message describing the issue or feedback is required (min 3 characters)" },
      { status: 400 }
    );
  }

  const user = await getSessionUser();
  const trimmedMessage = message.trim().slice(0, 4000);
  const trimmedSubject = typeof subject === "string" ? subject.trim().slice(0, 200) : "";
  const trimmedCategory = typeof category === "string" ? category.trim().slice(0, 50) : "Bug Report";
  const trimmedScreenshot = typeof screenshot === "string" && screenshot.length > 0 ? screenshot : undefined;

  // Take the email address directly from authenticated user info
  const replyEmail =
    user?.email ||
    (typeof clientEmail === "string" && clientEmail.trim().length > 0
      ? clientEmail.trim()
      : "");

  // 1. Dispatch email notification to admin / configured lead recipient
  await sendFeedbackNotification({
    category: trimmedCategory,
    subject: trimmedSubject,
    replyToEmail: replyEmail || undefined,
    name: user?.name,
    username: user?.username,
    message: trimmedMessage,
    pageUrl: typeof pageUrl === "string" ? pageUrl.slice(0, 500) : undefined,
    projectId: typeof projectId === "string" ? projectId.slice(0, 100) : undefined,
    projectName: typeof projectName === "string" ? projectName.slice(0, 200) : undefined,
    errorDetails: typeof errorDetails === "string" ? errorDetails.slice(0, 4000) : undefined,
    systemInfo: typeof systemInfo === "string" ? systemInfo.slice(0, 1000) : undefined,
    screenshot: trimmedScreenshot,
  });

  // 2. Persist in database under contact requests if user is authenticated or email provided
  if (user) {
    const formattedLog = [
      `[FEEDBACK / ${trimmedCategory.toUpperCase()}] ${trimmedSubject ? trimmedSubject + " — " : ""}${trimmedMessage}`,
      pageUrl ? `📍 URL: ${pageUrl}` : "",
      projectName ? `📁 Project: ${projectName} (${projectId})` : "",
      trimmedScreenshot ? `📷 Screenshot: Attached (${trimmedScreenshot.startsWith("data:") ? "Image Data" : trimmedScreenshot})` : "",
      errorDetails ? `⚠️ Technical Error:\n${errorDetails}` : "",
      systemInfo ? `💻 Diagnostics: ${systemInfo}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await db.contactRequest.create({
        data: {
          userId: user.id,
          email: replyEmail || user.email || null,
          message: formattedLog.slice(0, 4000),
          status: "OPEN",
        },
      });
    } catch {
      // Non-fatal if DB write fails; notification already attempted
    }
  }

  return NextResponse.json(
    { ok: true, message: "Thank you! Your feedback and report have been received." },
    { status: 201 }
  );
}
