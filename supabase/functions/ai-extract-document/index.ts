// supabase/functions/ai-extract-document/index.ts
//
// Uses a vision-capable model call to read a document image and extract
// structured fields. Returns the extracted data as a SUGGESTION for
// staff to review — it is never written directly to a student/application
// record without a human confirming it first, since OCR/vision extraction
// on handwritten or low-quality scans is genuinely unreliable and a wrong
// auto-fill (e.g. a misread date of birth) is worse than no auto-fill.

import { z } from "https://esm.sh/zod@3.23.8";

const requestSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  documentType: z.enum(["birth_certificate", "previous_school_transcript", "national_id", "passport", "medical_certificate"]),
});

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const FIELD_HINTS: Record<string, string> = {
  birth_certificate: "fullName, dateOfBirth (YYYY-MM-DD), gender, placeOfBirth, guardianNames",
  previous_school_transcript: "studentName, previousSchoolName, lastClassCompleted, overallGrade",
  national_id: "fullName, idNumber, dateOfBirth (YYYY-MM-DD), address",
  passport: "fullName, passportNumber, dateOfBirth (YYYY-MM-DD), nationality, expiryDate (YYYY-MM-DD)",
  medical_certificate: "studentName, bloodGroup, allergies, chronicConditions, physicianName",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: { code: "method_not_allowed", message: "POST only" } }, 405);
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: { code: "not_configured", message: "ANTHROPIC_API_KEY is not set on this project." } }, 501);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await req.json());
  } catch (err) {
    return jsonResponse({ error: { code: "invalid_input", message: err instanceof Error ? err.message : "Invalid body" } }, 400);
  }

  const fields = FIELD_HINTS[input.documentType];
  const prompt = `This is a scanned ${input.documentType.replace(/_/g, " ")}. Extract these fields if visible: ${fields}. If a field isn't visible or legible, use null rather than guessing. Respond with ONLY a JSON object, no markdown fences, no commentary.`;

  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    const aiBody = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiBody?.error?.message ?? "AI provider request failed");
    const text = aiBody.content?.map((b: any) => b.text ?? "").join("") ?? "{}";
    const extracted = JSON.parse(text);
    return jsonResponse({ data: { extracted, disclaimer: "Review every field before saving — extraction from scans is not always accurate." } }, 200);
  } catch (err) {
    return jsonResponse(
      { error: { code: "ai_request_failed", message: err instanceof Error ? err.message : "AI request failed or returned invalid JSON" } },
      502,
    );
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
