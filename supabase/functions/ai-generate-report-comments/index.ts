// supabase/functions/ai-generate-report-comments/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const requestSchema = z.object({ examId: z.string().uuid(), studentId: z.string().uuid() });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: { code: "method_not_allowed", message: "POST only" } }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: { code: "not_configured", message: "ANTHROPIC_API_KEY is not set on this project." } }, 501);
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await req.json());
  } catch (err) {
    return jsonResponse({ error: { code: "invalid_input", message: err instanceof Error ? err.message : "Invalid body" } }, 400);
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authorized } = await supabase.rpc("auth_has_permission", { perm_key: "ai.generate_content" });
  if (!authorized) return jsonResponse({ error: { code: "forbidden", message: "You don't have permission to generate content." } }, 403);

  const { data: student } = await supabase.from("students").select("first_name, last_name").eq("id", input.studentId).single();
  const { data: exam } = await supabase.from("exams").select("name").eq("id", input.examId).single();
  const { data: marks } = await supabase
    .from("student_marks")
    .select("marks_obtained, is_absent, grade_label, exam_schedule:exam_schedules!inner(max_marks, exam_id, subject:subjects(name))")
    .eq("student_id", input.studentId)
    .eq("exam_schedule.exam_id", input.examId);

  if (!student || !exam || !marks?.length) {
    return jsonResponse({ error: { code: "not_found", message: "Could not find marks for this student and exam." } }, 404);
  }

  const marksSummary = marks
    .map((m: any) => `${m.exam_schedule.subject?.name}: ${m.is_absent ? "Absent" : `${m.marks_obtained}/${m.exam_schedule.max_marks}`}${m.grade_label ? ` (${m.grade_label})` : ""}`)
    .join("; ");

  const prompt = `Write a short (3-4 sentences), warm but honest report card comment for a student named ${student.first_name} for "${exam.name}". Their results: ${marksSummary}. Mention one genuine strength and one specific area to improve. Do not use generic filler phrases. Write it as if addressed to the parent, third person about the student.`;

  let commentText: string;
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const aiBody = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiBody?.error?.message ?? "AI provider request failed");
    commentText = aiBody.content?.map((b: any) => b.text ?? "").join("") ?? "";
  } catch (err) {
    return jsonResponse({ error: { code: "ai_request_failed", message: err instanceof Error ? err.message : "AI request failed" } }, 502);
  }

  // Always saved unpublished — a teacher must review and explicitly
  // publish, per the PRD's own "Teachers can edit before publishing."
  const { data: saved, error: saveError } = await supabase
    .from("exam_report_comments")
    .upsert(
      { exam_id: input.examId, student_id: input.studentId, comment_text: commentText, was_ai_generated: true, is_published: false },
      { onConflict: "exam_id,student_id" },
    )
    .select()
    .single();
  if (saveError) return jsonResponse({ error: { code: "save_failed", message: saveError.message } }, 500);

  return jsonResponse({ data: saved }, 200);
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
