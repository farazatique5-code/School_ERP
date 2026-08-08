// supabase/functions/provision-organization/index.ts
//
// Handles the ONE operation that legitimately needs the service role:
// creating a brand new auth user + organization + school + roles + profile
// as a single atomic signup flow. Every other write in the app goes
// through the normal RLS-protected client — this function is intentionally
// the only place service-role credentials are used, and only for this job.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const signupSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  organizationName: z.string().min(2).max(200),
  organizationSlug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, hyphens only"),
  schoolName: z.string().min(2).max(200),
  schoolCode: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "school code must be uppercase letters/numbers"),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: { code: "method_not_allowed", message: "POST only" } }, 405);
  }

  let input: z.infer<typeof signupSchema>;
  try {
    const body = await req.json();
    input = signupSchema.parse(body);
  } catch (err) {
    return jsonResponse(
      { error: { code: "invalid_input", message: err instanceof Error ? err.message : "Invalid request body" } },
      400,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: create the auth user.
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false, // a confirmation email is sent through the normal Supabase auth flow
    user_metadata: { full_name: input.fullName },
  });

  if (userError || !userData?.user) {
    return jsonResponse(
      { error: { code: "user_creation_failed", message: userError?.message ?? "Could not create user" } },
      400,
    );
  }

  const userId = userData.user.id;

  // Step 2: provision the organization/school/roles/profile atomically via RPC.
  // If this fails, roll back the auth user so we never leave an orphaned
  // login with no organization attached.
  const { data: provisionData, error: provisionError } = await admin.rpc("provision_organization", {
    p_user_id: userId,
    p_user_email: input.email,
    p_user_full_name: input.fullName,
    p_org_name: input.organizationName,
    p_org_slug: input.organizationSlug,
    p_school_name: input.schoolName,
    p_school_code: input.schoolCode,
  });

  if (provisionError) {
    await admin.auth.admin.deleteUser(userId); // compensating action — no orphaned auth user
    const isSlugConflict = provisionError.message?.includes("slug_taken");
    return jsonResponse(
      {
        error: {
          code: isSlugConflict ? "slug_taken" : "provisioning_failed",
          message: isSlugConflict
            ? "That organization URL is already taken. Please choose another."
            : provisionError.message,
        },
      },
      isSlugConflict ? 409 : 500,
    );
  }

  return jsonResponse({ data: provisionData }, 201);
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
