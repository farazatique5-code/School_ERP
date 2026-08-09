// supabase/functions/ai-copilot-query/index.ts
//
// Deliberately does NOT use the service role. Every query this function
// runs uses the CALLER's forwarded JWT, so Postgres RLS applies exactly
// as if the person had queried directly — the AI Copilot can never see
// more than the asking user already could. The LLM is instructed to
// answer only from the context assembled below and to say plainly when
// it doesn't have enough information, rather than inventing numbers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const requestSchema = z.object({
  question: z.string().min(1).max(1000),
  schoolId: z.string().uuid(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: { code: "method_not_allowed", message: "POST only" } }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse(
      {
        error: {
          code: "not_configured",
          message: "The AI Copilot needs an ANTHROPIC_API_KEY secret set on this Supabase project before it can answer questions.",
        },
      },
      501,
    );
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await req.json());
  } catch (err) {
    return jsonResponse({ error: { code: "invalid_input", message: err instanceof Error ? err.message : "Invalid body" } }, 400);
  }

  // RLS-respecting client — uses the caller's own JWT, not service role.
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authorized } = await supabase.rpc("auth_has_permission", { perm_key: "ai.copilot_use" });
  if (!authorized) {
    return jsonResponse({ error: { code: "forbidden", message: "You don't have permission to use the AI Copilot." } }, 403);
  }

  const { data: userData } = await supabase.auth.getUser();
  const profile = userData?.user
    ? await supabase.from("profiles").select("organization_id").eq("id", userData.user.id).single()
    : null;
  const organizationId = profile?.data?.organization_id;

  const { context, contextSummary } = await buildContext(supabase, input.schoolId, input.question);

  const systemPrompt = `You are a school ERP data assistant. Answer the user's question ONLY using the JSON context provided below. Never invent numbers or facts not present in the context. If the context doesn't contain what's needed to answer, say so plainly and suggest what report or page might have it instead. Be concise — 2-4 sentences unless a list is clearly needed.

CONTEXT:
${JSON.stringify(context, null, 2)}`;

  let answer: string;
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: input.question }],
      }),
    });
    const aiBody = await aiResponse.json();
    if (!aiResponse.ok) {
      throw new Error(aiBody?.error?.message ?? "AI provider request failed");
    }
    answer = aiBody.content?.map((block: any) => block.text ?? "").join("") ?? "No response generated.";
  } catch (err) {
    return jsonResponse({ error: { code: "ai_request_failed", message: err instanceof Error ? err.message : "AI request failed" } }, 502);
  }

  if (organizationId) {
    await supabase.from("ai_copilot_logs").insert({
      organization_id: organizationId,
      school_id: input.schoolId,
      asked_by_profile_id: userData?.user?.id,
      question: input.question,
      context_summary: contextSummary,
      answer,
      model: "claude-sonnet-5",
    });
  }

  return jsonResponse({ data: { answer } }, 200);
});

/** Keyword-routed context assembly: pulls small AGGREGATES (counts,
 * averages, top-N lists) relevant to the question's apparent topic —
 * never a raw table dump — keeping the context small, cheap, and low-risk
 * of leaking more than the question actually needs. */
async function buildContext(supabase: any, schoolId: string, question: string) {
  const q = question.toLowerCase();
  const context: Record<string, unknown> = {};
  const categories: string[] = [];

  if (/student|enroll|class|section/.test(q)) {
    const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active");
    context.activeStudentCount = count;
    categories.push("students");
  }

  if (/attend|absen|late/.test(q)) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from("attendance_daily_stats")
      .select("present_count, absent_count, late_count")
      .eq("school_id", schoolId)
      .gte("attendance_date", since.toISOString().slice(0, 10));
    const totals = (data ?? []).reduce(
      (acc: any, row: any) => ({
        present: acc.present + row.present_count,
        absent: acc.absent + row.absent_count,
        late: acc.late + row.late_count,
      }),
      { present: 0, absent: 0, late: 0 },
    );
    context.attendanceLast30Days = totals;
    categories.push("attendance");
  }

  if (/fee|invoice|payment|revenue|collect|outstanding/.test(q)) {
    const { data: invoices } = await supabase.from("fee_invoices").select("status, amount_due, amount_paid, fine_amount").eq("school_id", schoolId);
    const outstanding = (invoices ?? []).reduce((sum: number, inv: any) => sum + Math.max(0, Number(inv.amount_due) + Number(inv.fine_amount) - Number(inv.amount_paid)), 0);
    const byStatus = (invoices ?? []).reduce((acc: any, inv: any) => ({ ...acc, [inv.status]: (acc[inv.status] ?? 0) + 1 }), {});
    context.fees = { totalOutstanding: outstanding, invoiceCountByStatus: byStatus };
    categories.push("fees");
  }

  if (/exam|grade|mark|rank|result/.test(q)) {
    const { data: exams } = await supabase.from("exams").select("id, name, status").eq("school_id", schoolId).order("start_date", { ascending: false }).limit(5);
    context.recentExams = exams;
    categories.push("exams");
  }

  if (/teacher|staff|employee|leave|hr/.test(q)) {
    const { count } = await supabase.from("employees").select("profile_id", { count: "exact", head: true }).eq("school_id", schoolId);
    context.employeeCount = count;
    categories.push("hr");
  }

  if (categories.length === 0) {
    context.note = "No specific data category was detected in this question — a general school snapshot follows.";
    const { count: studentCount } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active");
    context.activeStudentCount = studentCount;
    categories.push("general");
  }

  return { context, contextSummary: categories.join(", ") };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
