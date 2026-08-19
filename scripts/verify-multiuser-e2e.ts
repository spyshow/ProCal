import "dotenv/config";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";

const BASE_URL = "http://localhost:3000";

interface TestContext {
  pmUser: { id: string; username: string; role: string };
  pmToken: string;
  projectId: string;
  engineerInviteToken: string;
  qaInviteToken: string;
  engineerUser?: { id: string; username: string };
  engineerToken?: string;
  qaUser?: { id: string; username: string };
  qaToken?: string;
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
    failedCount++;
  }
}

async function runE2ETests() {
  console.log("\n========================================================");
  console.log("  PROCAL MULTI-USER RBAC & AUDIT TRAIL E2E TEST SUITE   ");
  console.log("========================================================\n");

  // Setup PM User
  let pm = await db.user.findFirst({ where: { username: "engineer" } });
  if (!pm) {
    throw new Error("Admin/Engineer user not found in DB");
  }

  const pmToken = await signJWT({ userId: pm.id, username: pm.username, role: pm.role });
  const pmHeaders = {
    "Content-Type": "application/json",
    Cookie: `session_token=${pmToken}`,
  };

  const ctx: TestContext = {
    pmUser: pm,
    pmToken,
    projectId: "",
    engineerInviteToken: "",
    qaInviteToken: "",
  };

  // ----------------------------------------------------
  // SCENARIO 1: Project Creation & PM Member Assignment
  // ----------------------------------------------------
  console.log("Scenario 1: Project Creation & Primary PM Assignment");
  const projRes = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: pmHeaders,
    body: JSON.stringify({
      name: `E2E MultiUser Test Project ${Date.now()}`,
      client: "Al-Hamra Holdings",
      consultant: "Khatib & Alami",
      location: "Damascus Central",
      voltage: 400,
      frequency: 50,
    }),
  });

  assert(projRes.status === 200, "POST /api/projects creates project (200 OK)");
  const projData = await projRes.json();
  ctx.projectId = projData.id;
  assert(!!ctx.projectId, "Project ID generated", ctx.projectId);

  // Check project membership in DB
  const pmMember = await db.projectMember.findFirst({
    where: { projectId: ctx.projectId, userId: pm.id },
  });
  assert(pmMember?.role === "PROJECT_MANAGER", "Creator automatically assigned PROJECT_MANAGER role");

  // Check initial audit log
  const initialAudit = await db.projectAuditLog.findFirst({
    where: { projectId: ctx.projectId, entityType: "PROJECT", action: "CREATE" },
  });
  assert(!!initialAudit, "Initial CREATE PROJECT audit log recorded");

  // ----------------------------------------------------
  // SCENARIO 2: Team Member Invitations & Seat Limit Cap (5 Seats)
  // ----------------------------------------------------
  console.log("\nScenario 2: Sending Invitations & Enforcing 5-Seat Cap");

  // Invite Engineer
  const engEmail = `engineer_${Date.now()}@procal.test`;
  const engInviteRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members`, {
    method: "POST",
    headers: pmHeaders,
    body: JSON.stringify({
      name: "Tariq Engineer",
      email: engEmail,
      role: "ENGINEER",
      permissions: {
        cableSchedule: "EDIT",
        breakerSchedule: "VIEW",
        sldDesigner: "NONE",
      },
    }),
  });

  assert(engInviteRes.status === 200, "PM invites Engineer with custom permissions (200 OK)");
  const engInviteData = await engInviteRes.json();
  assert(engInviteData.success === true, "Engineer invite payload success is true");
  ctx.engineerInviteToken = engInviteData.invite.acceptUrl.split("token=")[1];
  assert(!!ctx.engineerInviteToken, "7-Day Crypto token generated for Engineer");

  // Invite QA
  const qaEmail = `qa_${Date.now()}@procal.test`;
  const qaInviteRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members`, {
    method: "POST",
    headers: pmHeaders,
    body: JSON.stringify({
      name: "Rana QA",
      email: qaEmail,
      role: "QA",
    }),
  });
  assert(qaInviteRes.status === 200, "PM invites QA Reviewer (200 OK)");
  const qaInviteData = await qaInviteRes.json();
  ctx.qaInviteToken = qaInviteData.invite.acceptUrl.split("token=")[1];

  // Check Members & Pending Invites count
  const listRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members`, {
    headers: pmHeaders,
  });
  const listData = await listRes.json();
  assert(listData.usedSeats === 3, "Seat count reflects 1 active member + 2 pending invites (3/5)", `used: ${listData.usedSeats}`);
  assert(listData.totalSeats === 5, "Total seats is capped at 5");

  // Invite 2 more users to fill up to 5 seats
  await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members`, {
    method: "POST",
    headers: pmHeaders,
    body: JSON.stringify({ name: "User 4", email: `u4_${Date.now()}@procal.test`, role: "ENGINEER" }),
  });
  await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members`, {
    method: "POST",
    headers: pmHeaders,
    body: JSON.stringify({ name: "User 5", email: `u5_${Date.now()}@procal.test`, role: "ENGINEER" }),
  });

  // Attempt 6th invite (Must be rejected)
  const overflowRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members`, {
    method: "POST",
    headers: pmHeaders,
    body: JSON.stringify({ name: "User 6", email: `u6_${Date.now()}@procal.test`, role: "ENGINEER" }),
  });
  assert(overflowRes.status === 400, "6th invite is rejected with 400 Bad Request");
  const overflowData = await overflowRes.json();
  assert(overflowData.error?.includes("maximum seat limit"), "Seat limit error message returned");

  // ----------------------------------------------------
  // SCENARIO 3: Public Invitation Verification & Acceptance
  // ----------------------------------------------------
  console.log("\nScenario 3: Public Invitation Acceptance & New User Registration");

  // Step 3a: Verify token
  const verifyRes = await fetch(`${BASE_URL}/api/invites/verify?token=${ctx.engineerInviteToken}`);
  assert(verifyRes.status === 200, "GET /api/invites/verify returns 200 OK");
  const verifyData = await verifyRes.json();
  assert(verifyData.valid === true, "Token validated as active and pending");
  assert(verifyData.invite.email === engEmail, "Invitee email matches");
  assert(verifyData.invite.role === "ENGINEER", "Invitee assigned role matches");

  // Step 3b: Accept invite as new user
  const acceptRes = await fetch(`${BASE_URL}/api/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: ctx.engineerInviteToken,
      name: "Tariq Engineer",
      password: "password123",
      confirmPassword: "password123",
    }),
  });

  assert(acceptRes.status === 200, "POST /api/invites/accept accepts invitation (200 OK)");
  const acceptData = await acceptRes.json();
  assert(acceptData.success === true, "Account registered and joined workspace");

  const setCookie = acceptRes.headers.get("set-cookie");
  assert(!!setCookie && setCookie.includes("session_token"), "Session token cookie issued on acceptance");

  // Also accept QA invite
  const qaAcceptRes = await fetch(`${BASE_URL}/api/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: ctx.qaInviteToken,
      name: "Rana QA",
      password: "password123",
      confirmPassword: "password123",
    }),
  });
  const qaAcceptData = await qaAcceptRes.json();
  ctx.qaUser = qaAcceptData.user;
  ctx.qaToken = await signJWT({ userId: ctx.qaUser!.id, username: ctx.qaUser!.username, role: "USER" });

  ctx.engineerUser = acceptData.user;
  ctx.engineerToken = await signJWT({ userId: ctx.engineerUser!.id, username: ctx.engineerUser!.username, role: "USER" });

  // ----------------------------------------------------
  // SCENARIO 4: Granular RBAC Permissions Verification
  // ----------------------------------------------------
  console.log("\nScenario 4: Granular RBAC Module Permissions");

  const engHeaders = {
    "Content-Type": "application/json",
    Cookie: `session_token=${ctx.engineerToken}`,
  };

  const qaHeaders = {
    "Content-Type": "application/json",
    Cookie: `session_token=${ctx.qaToken}`,
  };

  // Engineer can read project details
  const engProjGet = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}`, {
    headers: engHeaders,
  });
  assert(engProjGet.status === 200, "Engineer can view project details (200 OK)");
  const engProjDetails = await engProjGet.json();
  assert(engProjDetails.currentMemberRole === "ENGINEER", "Response enriches active member role as ENGINEER");
  assert(engProjDetails.currentMemberPermissions.cableSchedule === "EDIT", "Permission for cableSchedule is EDIT");
  assert(engProjDetails.currentMemberPermissions.breakerSchedule === "VIEW", "Permission for breakerSchedule is VIEW");
  assert(engProjDetails.currentMemberPermissions.sldDesigner === "NONE", "Permission for sldDesigner is NONE");

  // QA cannot perform PUT edits on project
  const qaPut = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}`, {
    method: "PUT",
    headers: qaHeaders,
    body: JSON.stringify({ notes: "QA Unauthorized modification attempt" }),
  });
  assert(qaPut.status === 403, "QA role cannot edit project settings (403 Forbidden)");

  // ----------------------------------------------------
  // SCENARIO 5: QA Compliance Punch List Notes
  // ----------------------------------------------------
  console.log("\nScenario 5: QA Review Notes & Punch List Management");

  // QA creates review note
  const qaNoteRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/review-items`, {
    method: "POST",
    headers: qaHeaders,
    body: JSON.stringify({
      pageKey: "cableSchedule",
      severity: "CRITICAL",
      title: "Feeder Cable F1 Voltage Drop Exceeds 3%",
      description: "Cable length is 85m. Voltage drop calculates at 3.7%. Upsize cable to 35mm².",
    }),
  });

  assert(qaNoteRes.status === 200, "QA creates CRITICAL review note (200 OK)");
  const qaNoteData = await qaNoteRes.json();
  const noteId = qaNoteData.item.id;
  assert(!!noteId, "Review note ID created", noteId);

  // List review notes for pageKey
  const getNotesRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/review-items?pageKey=cableSchedule`, {
    headers: engHeaders,
  });
  const notesData = await getNotesRes.json();
  assert(notesData.items.length === 1, "Engineer can list QA review items for cableSchedule");
  assert(notesData.items[0].status === "OPEN", "New QA note is in OPEN status");

  // PM marks note as RESOLVED
  const resolveRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/review-items/${noteId}`, {
    method: "PATCH",
    headers: pmHeaders,
    body: JSON.stringify({ status: "RESOLVED" }),
  });
  assert(resolveRes.status === 200, "PM resolves QA review note (200 OK)");

  // ----------------------------------------------------
  // SCENARIO 6: Activity Audit Trail & CSV Export
  // ----------------------------------------------------
  console.log("\nScenario 6: Activity Audit Trail & CSV Export");

  // Query audit logs
  const logsRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/audit-logs`, {
    headers: pmHeaders,
  });
  assert(logsRes.status === 200, "GET /api/projects/[id]/audit-logs returns 200 OK");
  const logsData = await logsRes.json();
  assert(logsData.logs.length >= 3, `Audit log contains ${logsData.logs.length} events`);
  assert(logsData.activeUsers.length >= 2, "Active users list aggregated in audit query");

  // Keyword search
  const searchRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/audit-logs?search=Voltage`, {
    headers: pmHeaders,
  });
  const searchData = await searchRes.json();
  assert(searchData.logs.length >= 1, "Audit log search returns matching keyword entries");

  // CSV Export
  const csvRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/audit-logs?format=csv`, {
    headers: pmHeaders,
  });
  assert(csvRes.status === 200, "GET /api/projects/[id]/audit-logs?format=csv returns 200 OK");
  assert(csvRes.headers.get("Content-Type")?.includes("text/csv") === true, "Content-Type is text/csv");
  const csvText = await csvRes.text();
  assert(csvText.includes("Timestamp,User,Role,Action,Category,Description"), "CSV header correctly formatted");
  assert(csvText.includes("Feeder Cable F1"), "CSV contains recorded QA and engineering descriptions");

  // ----------------------------------------------------
  // SCENARIO 7: Member Management & Ownership Protection
  // ----------------------------------------------------
  console.log("\nScenario 7: Member Updates & Ownership Protection");

  // PM updates Engineer permissions
  const engMember = await db.projectMember.findFirst({
    where: { projectId: ctx.projectId, userId: ctx.engineerUser!.id },
  });

  const updateMemberRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members/${engMember!.id}`, {
    method: "PATCH",
    headers: pmHeaders,
    body: JSON.stringify({
      role: "ENGINEER",
      permissions: {
        cableSchedule: "EDIT",
        breakerSchedule: "EDIT",
        sldDesigner: "VIEW",
      },
    }),
  });
  assert(updateMemberRes.status === 200, "PM updates Engineer permissions matrix");

  // Attempt to remove owner/creator (Must be rejected)
  const removeOwnerRes = await fetch(`${BASE_URL}/api/projects/${ctx.projectId}/members/${pmMember!.id}`, {
    method: "DELETE",
    headers: pmHeaders,
  });
  assert(removeOwnerRes.status === 400, "Cannot remove project owner (400 Bad Request)");

  // Cleanup: Delete test project
  await fetch(`${BASE_URL}/api/projects/${ctx.projectId}`, {
    method: "DELETE",
    headers: pmHeaders,
  });

  // Final Summary
  console.log("\n========================================================");
  console.log(`  E2E TEST RUN COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error("Fatal E2E Test Error:", err);
  process.exit(1);
});
