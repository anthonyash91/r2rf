import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cast once so the new tables (not yet in generated types) don't cause TS errors.
const db = supabaseAdmin as any;

async function assertTester(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "tester")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: tester access required");
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin access required");
}

// Verify the run belongs to the caller.
async function assertRunOwner(runId: string, userId: string) {
  const { data } = await db.from("test_runs").select("tester_id").eq("id", runId).single();
  if (!data || data.tester_id !== userId) throw new Error("Forbidden");
}

export const createTestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ label: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertTester(context.userId);
    const { data: run, error } = await db
      .from("test_runs")
      .insert({ tester_id: context.userId, label: data.label })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { run };
  });

export const listMyTestRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTester(context.userId);
    const { data, error } = await db
      .from("test_runs")
      .select("*")
      .eq("tester_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { runs: (data ?? []) as any[] };
  });

export const getRunResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Allow the run's owner OR an admin to read results.
    const { data: run } = await db.from("test_runs").select("tester_id").eq("id", data.runId).maybeSingle();
    if (!run) throw new Error("Run not found");
    if (run.tester_id !== context.userId) {
      await assertAdmin(context.userId);
    }
    const { data: results, error } = await db
      .from("test_run_results")
      .select("*")
      .eq("run_id", data.runId);
    if (error) throw new Error(error.message);
    return { results: (results ?? []) as any[] };
  });

export const upsertTestResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        runId:  z.string().uuid(),
        testId: z.string().min(1).max(20),
        status: z.enum(["untested", "pass", "fail", "blocked", "skipped"]),
        notes:  z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertRunOwner(data.runId, context.userId);
    const { error } = await db.from("test_run_results").upsert(
      {
        run_id:     data.runId,
        test_id:    data.testId,
        status:     data.status,
        notes:      data.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "run_id,test_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeTestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertRunOwner(data.runId, context.userId);
    const { error } = await db
      .from("test_runs")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.runId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reopenTestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertRunOwner(data.runId, context.userId);
    const { error } = await db
      .from("test_runs")
      .update({ completed_at: null })
      .eq("id", data.runId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertRunOwner(data.runId, context.userId);
    const { error } = await db.from("test_runs").delete().eq("id", data.runId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: list all runs from all testers with tester username + result summary.
export const listAllTestRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: runs, error } = await db
      .from("test_runs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Hydrate tester usernames.
    const testerIds = [...new Set(((runs ?? []) as any[]).map((r: any) => r.tester_id as string))];
    const profileMap = new Map<string, string>();
    if (testerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, username")
        .in("user_id", testerIds);
      for (const p of profiles ?? []) profileMap.set(p.user_id, p.username);
    }

    // Aggregate result status counts per run.
    const runIds = ((runs ?? []) as any[]).map((r: any) => r.id as string);
    const countMap = new Map<string, Record<string, number>>();
    if (runIds.length > 0) {
      const { data: results } = await db
        .from("test_run_results")
        .select("run_id, status")
        .in("run_id", runIds);
      for (const r of (results ?? []) as any[]) {
        if (!countMap.has(r.run_id)) countMap.set(r.run_id, {});
        const m = countMap.get(r.run_id)!;
        m[r.status] = (m[r.status] ?? 0) + 1;
      }
    }

    return {
      runs: ((runs ?? []) as any[]).map((r: any) => ({
        id:             r.id,
        label:          r.label,
        tester_id:      r.tester_id,
        testerUsername: profileMap.get(r.tester_id) ?? r.tester_id,
        created_at:     r.created_at,
        completed_at:   r.completed_at ?? null,
        statusCounts:   countMap.get(r.id) ?? {},
      })),
    };
  });

// Admin: fetch full result detail for one run.
export const getAdminRunDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: results, error } = await db
      .from("test_run_results")
      .select("*")
      .eq("run_id", data.runId);
    if (error) throw new Error(error.message);
    return { results: (results ?? []) as any[] };
  });
