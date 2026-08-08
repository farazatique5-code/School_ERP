// supabase/functions/ai-generate-exam-questions/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const requestSchema = z.object({
  subjectId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  topic: z.string().min(1).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["mcq", "short_answer", "long_answer"]),
  count: z.number().int().min(1).max(10),
});

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

  const { data: subject } = await supabase.from("subjects").select("name").eq("id", input.subjectId).single();
  if (!subject) return jsonResponse({ error: { code: "not_found", message: "Subject not found." } }, 404);

  const typeInstruction =
    input.questionType === "mcq"
      ? 'For each question include 4 options labeled A-D as an "options" array of {"label","text"} and a "correctAnswer" holding the correct label.'
      : 'Leave "options" as null and put a model answer or marking guidance in "correctAnswer".';

  const prompt = `Generate exactly ${input.count} ${input.difficulty} difficulty ${input.questionType.replace("_", " ")} exam questions for the subject "${subject.name}" on the topic "${input.topic}".
${typeInstruction}
Also classify each question's Bloom's Taxonomy level (one of: remember, understand, apply, analyze, evaluate, create) and suggest a reasonable mark value.

Respond with ONLY a JSON array, no markdown fences, no commentary, in this exact shape:
[{"questionText": string, "options": [{"label": string, "text": string}] | null, "correctAnswer": string, "bloomLevel": string, "marks": number}]`;

  let questions: any[];
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const aiBody = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiBody?.error?.message ?? "AI provider request failed");
    const text = aiBody.content?.map((b: any) => b.text ?? "").join("") ?? "[]";
    questions = JSON.parse(text);
  } catch (err) {
    return jsonResponse(
      { error: { code: "ai_request_failed", message: err instanceof Error ? err.message : "AI request failed or returned invalid JSON" } },
      502,
    );
  }

  const { data: userData } = await supabase.auth.getUser();

  const rows = questions.map((q) => ({
    school_id: null, // set via subject's school below
    subject_id: input.subjectId,
    class_id: input.classId ?? null,
    question_text: q.questionText,
    question_type: input.questionType,
    difficulty: input.difficulty,
    marks: q.marks ?? 1,
    options: q.options ?? null,
    correct_answer: q.correctAnswer ?? null,
    bloom_level: q.bloomLevel ?? null,
    created_by_profile_id: userData?.user?.id,
  }));

  const { data: subjectRow } = await supabase.from("subjects").select("school_id").eq("id", input.subjectId).single();
  for (const row of rows) row.school_id = subjectRow?.school_id;

  const { data: saved, error: saveError } = await supabase.from("question_bank_questions").insert(rows).select();
  if (saveError) return jsonResponse({ error: { code: "save_failed", message: saveError.message } }, 500);

  return jsonResponse({ data: saved }, 200);
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
