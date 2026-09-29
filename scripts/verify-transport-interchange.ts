import 'dotenv/config';
import { db } from '../src/lib/db';
import { mintMcpToken, revokeMcpToken } from '../src/lib/mcp-auth';
import { createAgentApiClient } from '../src/mcp/client/agent-api-client';

/**
 * Proves the two transports are interchangeable.
 *
 * This is the claim that makes extracting the MCP server a configuration change
 * rather than a rewrite: the same tool code, unchanged, must get the same answers
 * whether operations are called in-process or over HTTP. The two have never been
 * run side by side before, which is exactly how a shape mismatch between them
 * could have gone unnoticed.
 *
 * Read operations are compared directly against the in-process result. Write
 * operations are exercised for effect but not compared, because running them twice
 * would create two projects rather than prove anything.
 *
 * Usage: npx tsx scripts/verify-transport-interchange.ts http://localhost:3114
 */
const BASE = process.argv[2] || 'http://localhost:3000';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

/**
 * The set of key paths in a value, so two responses can be compared for shape
 * without also requiring their identifiers to match.
 *
 * The two transports are called with *different* inputs on purpose (a template
 * name has to be unique, so it cannot be created twice), so a plain deep-equal
 * would fail on the name and prove nothing. What must be identical is the
 * structure, and the values ProCal derived rather than echoed.
 */
function shapeOf(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.length ? shapeOf(value[0], `${prefix}[]`) : [`${prefix}[]`];
  }
  if (value && typeof value === 'object') {
    if (value instanceof Date) return [`${prefix}:date`];
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      shapeOf(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [`${prefix}:${value === null ? 'null' : typeof value}`];
}

/** Deep compare after stripping the Date instances JSON cannot carry. */
function normalise(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) return '[circular]';
      seen.add(v as object);
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([k]) => k !== 'updatedAt')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => [k, walk(val)])
      );
    }
    return v;
  };
  try {
    return JSON.stringify(walk(value));
  } catch {
    return '[unserialisable]';
  }
}

async function main() {
  const owner = await db.user.findFirst({
    where: { disabled: false, projects: { some: {} } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      credits: true,
      email: true,
      projects: { take: 1, select: { id: true, name: true } },
    },
  });
  if (!owner) throw new Error('No user with a project found.');

  const project = owner.projects[0];
  const { token, record } = await mintMcpToken(owner.id, 'transport-probe');
  const actor = { id: owner.id, role: owner.role, name: owner.name, username: owner.username };

  const local = createAgentApiClient({ actor, transport: 'in-process' });
  const remote = createAgentApiClient({ actor, transport: 'http', baseUrl: BASE, token });

  console.log(`base     : ${BASE}`);
  console.log(`identity : ${owner.username}  project: ${project.name}\n`);

  try {
    console.log('=== read operations must agree across transports ===');

    const localProjects = await local.listProjects();
    const remoteProjects = await remote.listProjects();
    check(
      normalise(localProjects) === normalise(remoteProjects),
      'listProjects',
      `local ${localProjects.length} / remote ${remoteProjects.length}`
    );

    const localBrief = await local.getProjectBrief(project.id);
    const remoteBrief = await remote.getProjectBrief(project.id);
    check(
      normalise(localBrief) === normalise(remoteBrief),
      'getProjectBrief',
      remoteBrief ? 'shapes match' : 'remote returned nothing'
    );

    const localSummary = await local.getDesignSummary(project.id);
    const remoteSummary = await remote.getDesignSummary(project.id);
    check(
      normalise(localSummary) === normalise(remoteSummary),
      'getDesignSummary',
      `local ${localSummary.length} / remote ${remoteSummary.length}`
    );

    const localBundle = await local.loadReportBundle(project.id);
    const remoteBundle = await remote.loadReportBundle(project.id);
    check(
      normalise(localBundle) === normalise(remoteBundle),
      'loadReportBundle',
      `equipment ${(localBundle.equipment as unknown[])?.length} / ${(remoteBundle?.equipment as unknown[])?.length}`
    );

    // Recalculate is a write, but it is idempotent once the engine version is
    // current, so both transports can safely observe the same no-op result.
    const localRecalc = await local.recalculateProject(project.id);
    const remoteRecalc = await remote.recalculateProject(project.id);
    check(
      normalise(localRecalc) === normalise(remoteRecalc),
      'recalculateProject',
      `local ${JSON.stringify(localRecalc)} / remote ${JSON.stringify(remoteRecalc)}`
    );

    console.log('\n=== write operations must agree in shape across transports ===');

    // A template is the cheapest reversible write, and the response shape is the
    // thing most likely to differ: the route returns `templateId` for a public
    // contract, while the in-process client returns the row. A tool reading `.id`
    // would work in-process and fail over HTTP.
    const mkName = (tag: string) => `transport-probe-${tag}-${Date.now()}`;
    const room = [{ name: 'Living', type: 'LIVING_ROOM', area: 24, loadDensity: 100 }];

    const localTpl = await local.defineApartmentTemplate({
      projectId: project.id, name: mkName('local'), phases: 1, rooms: room,
    });
    const remoteTpl = await remote.defineApartmentTemplate({
      projectId: project.id, name: mkName('remote'), phases: 1, rooms: room,
    });

    check(
      shapeOf(localTpl).join('|') === shapeOf(remoteTpl).join('|'),
      'defineApartmentTemplate response shape',
      `local keys [${Object.keys(localTpl).join(',')}] / remote keys [${Object.keys(remoteTpl).join(',')}]`
    );
    check(Boolean(localTpl.id) && Boolean(remoteTpl.id), 'both transports report the id under the same key');
    check(
      localTpl.rooms[0].connectedLoad === remoteTpl.rooms[0].connectedLoad &&
        remoteTpl.rooms[0].connectedLoad === 2400,
      'connected load derived server-side on both paths',
      `${localTpl.rooms[0].connectedLoad} / ${remoteTpl.rooms[0].connectedLoad} VA`
    );

    // Building upsert: the in-process shape nests under `building`, so a mismatch
    // here would be a silent behaviour change on switching transport.
    const bldgLocal = await local.upsertBuilding({
      projectId: project.id, name: mkName('b-local'), floors: [{ floorNumber: 1 }],
    });
    const bldgRemote = await remote.upsertBuilding({
      projectId: project.id, name: mkName('b-remote'), floors: [{ floorNumber: 1 }],
    });
    check(
      shapeOf(bldgLocal).join('|') === shapeOf(bldgRemote).join('|'),
      'upsertBuilding response shape',
      `local keys [${Object.keys(bldgLocal).join(',')}] / remote keys [${Object.keys(bldgRemote).join(',')}]`
    );
    check(
      Boolean(bldgLocal.building?.id) && Boolean(bldgRemote.building?.id),
      'both transports nest the building identically'
    );

    // Building loads: in-process returns the array directly, the route an envelope.
    const loadLib = await db.loadLibraryItem.findMany({ where: { projectId: project.id }, take: 1 });
    if (loadLib.length) {
      const loadName = loadLib[0].name;
      const loadsLocal = await local.setBuildingLoads({
        projectId: project.id, buildingId: bldgLocal.building.id,
        loads: [{ name: loadName, quantity: 2 }],
      });
      const loadsRemote = await remote.setBuildingLoads({
        projectId: project.id, buildingId: bldgRemote.building.id,
        loads: [{ name: loadName, quantity: 2 }],
      });
      check(
        Array.isArray(loadsLocal) && Array.isArray(loadsRemote),
        'setBuildingLoads returns an array on both transports',
        `local isArray=${Array.isArray(loadsLocal)} remote isArray=${Array.isArray(loadsRemote)}`
      );
      check(
        normalise(loadsLocal) === normalise(loadsRemote),
        'setBuildingLoads entries agree',
        `${JSON.stringify(loadsLocal)} / ${JSON.stringify(loadsRemote)}`
      );

      const loadsRemoteViaBuilding = await remote.setBuildingLoads({
        projectId: project.id, buildingId: bldgRemote.building.id,
        loads: [{ name: 'no-such-load-name-probe' }],
      }).then(() => 'accepted', (e: Error) => `rejected: ${e.message.slice(0, 40)}`);
      check(
        String(loadsRemoteViaBuilding).startsWith('rejected'),
        'an unknown load name is rejected over HTTP rather than silently emptied',
        String(loadsRemoteViaBuilding)
      );
    }

    const checkout = await remote.createCheckout({});
    check(
      checkout !== null && typeof checkout === 'object',
      'createCheckout over HTTP returns entitlement',
      JSON.stringify(checkout).slice(0, 80)
    );

    console.log(failures === 0 ? '\nTRANSPORTS INTERCHANGEABLE' : `\n${failures} CHECK(S) FAILED`);
  } finally {
    await revokeMcpToken(owner.id, record.id);
    await db.mcpToken.delete({ where: { id: record.id } }).catch(() => undefined);
    await db.agentRateLimit.deleteMany({ where: { key: { contains: record.id } } }).catch(() => undefined);
    // Remove everything the probe created, so repeated runs start clean.
    await db.apartmentTemplate
      .deleteMany({ where: { projectId: project.id, name: { startsWith: 'transport-probe-' } } })
      .catch(() => undefined);
    await db.building
      .deleteMany({ where: { projectId: project.id, name: { startsWith: 'transport-probe-' } } })
      .catch(() => undefined);
    console.log('\nCleaned up probe token, rate windows, templates and buildings');
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-transport-interchange failed:', e);
  process.exit(1);
});
