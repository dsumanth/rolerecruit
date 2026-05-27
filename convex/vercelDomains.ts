import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const VERCEL_API = "https://api.vercel.com";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} not set`);
  return val;
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

async function vercelFetch(path: string, init: RequestInit = {}) {
  const token = requireEnv("VERCEL_TOKEN");
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  let parsed: any = null;
  try { parsed = body ? JSON.parse(body) : null; } catch {}
  if (!res.ok) {
    const msg = parsed?.error?.message ?? parsed?.message ?? body ?? `HTTP ${res.status}`;
    throw new Error(`Vercel API ${res.status}: ${msg}`);
  }
  return parsed;
}

async function upsertEdgeConfigDomainMap(map: Record<string, string>) {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const token = process.env.EDGE_CONFIG_TOKEN ?? process.env.VERCEL_TOKEN;
  if (!edgeConfigId || !token) {
    console.warn("EDGE_CONFIG_ID or EDGE_CONFIG_TOKEN not set — skipping Edge Config update");
    return;
  }
  const res = await fetch(
    `${VERCEL_API}/v1/edge-config/${edgeConfigId}/items${teamQuery()}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: "customDomains", value: map }],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Config update failed: ${res.status} ${text}`);
  }
}

export const registerDomain = internalAction({
  args: {
    schoolId: v.id("schools"),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const projectId = requireEnv("VERCEL_PROJECT_ID");
      await vercelFetch(
        `/v10/projects/${projectId}/domains${teamQuery()}`,
        {
          method: "POST",
          body: JSON.stringify({ name: args.domain }),
        },
      );
    } catch (err: any) {
      // 409 = already added to project (e.g. retry). Treat as success.
      if (!/409|already/i.test(String(err?.message))) {
        await ctx.runMutation(internal.schools.setCustomDomainStatusInternal, {
          schoolId: args.schoolId,
          status: "failed",
          error: err?.message ?? "Failed to register domain with Vercel",
        });
        return;
      }
    }
    // Kick off an immediate status check; the cron will continue polling.
    await ctx.scheduler.runAfter(0, internal.vercelDomains.checkDomainStatus, {
      schoolId: args.schoolId,
      domain: args.domain,
    });
  },
});

export const checkDomainStatus = internalAction({
  args: {
    schoolId: v.id("schools"),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    const projectId = requireEnv("VERCEL_PROJECT_ID");

    let domainInfo: any;
    try {
      domainInfo = await vercelFetch(
        `/v9/projects/${projectId}/domains/${encodeURIComponent(args.domain)}${teamQuery()}`,
      );
    } catch (err: any) {
      await ctx.runMutation(internal.schools.setCustomDomainStatusInternal, {
        schoolId: args.schoolId,
        status: "failed",
        error: err?.message ?? "Domain lookup failed",
      });
      return;
    }

    let config: any = {};
    try {
      config = await vercelFetch(
        `/v6/domains/${encodeURIComponent(args.domain)}/config${teamQuery()}`,
      );
    } catch {
      // Non-fatal — fall through with empty config
    }

    const verified = domainInfo?.verified === true;
    const misconfigured = config?.misconfigured === true;

    if (verified && !misconfigured) {
      await ctx.runMutation(internal.schools.setCustomDomainStatusInternal, {
        schoolId: args.schoolId,
        status: "verified",
        error: undefined,
      });
      await ctx.runAction(internal.vercelDomains.syncEdgeConfig, {});
    } else if (verified && misconfigured) {
      await ctx.runMutation(internal.schools.setCustomDomainStatusInternal, {
        schoolId: args.schoolId,
        status: "verifying_ssl",
        error: undefined,
      });
    } else {
      await ctx.runMutation(internal.schools.setCustomDomainStatusInternal, {
        schoolId: args.schoolId,
        status: "pending_dns",
        error: misconfigured
          ? "CNAME not detected. Confirm the record at your DNS provider points to cname.vercel-dns.com."
          : undefined,
      });
    }
  },
});

export const unregisterDomain = internalAction({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    try {
      const projectId = requireEnv("VERCEL_PROJECT_ID");
      await vercelFetch(
        `/v9/projects/${projectId}/domains/${encodeURIComponent(args.domain)}${teamQuery()}`,
        { method: "DELETE" },
      );
    } catch (err: any) {
      // 404 = already gone. Anything else, log but don't block — Edge Config sync will reflect truth.
      if (!/404|not.found/i.test(String(err?.message))) {
        console.error("Vercel domain delete failed:", err?.message);
      }
    }
    await ctx.runAction(internal.vercelDomains.syncEdgeConfig, {});
  },
});

export const syncEdgeConfig = internalAction({
  args: {},
  handler: async (ctx) => {
    const verified = await ctx.runQuery(internal.schools.listVerifiedCustomDomains, {});
    const map: Record<string, string> = {};
    for (const v of verified) {
      map[v.domain] = v.slug;
    }
    await upsertEdgeConfigDomainMap(map);
  },
});

export const pollPendingDomains = internalAction({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.runQuery(internal.schools.listPendingCustomDomains, {});
    for (const p of pending) {
      await ctx.runAction(internal.vercelDomains.checkDomainStatus, {
        schoolId: p._id,
        domain: p.customDomain,
      });
    }
  },
});
