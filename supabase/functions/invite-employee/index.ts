// supabase/functions/invite-employee/index.ts
//
// Second (and last, for now) legitimate use of the service role, following
// the exact pattern established by provision-organization: create the auth
// user via admin API, then hand off to a Postgres function for everything
// else, with a compensating rollback if the handoff fails.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const inviteSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  organizationId: z.string().uuid(),
  schoolId: z.string().uuid(),
  designation: z.string().min(1).max(200),
  departmentId: z.string().uuid().optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "substitute"]),
  joiningDate: z.string(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: { code: "method_not_allowed", message: "POST only" } }, 405);
  }

  // The caller must already be authenticated as someone holding hr.manage —
  // verified here by checking their JWT against the same RLS-backing
  // function the rest of the app uses, so this function can't be used to
  // silently create employees bypassing permission checks.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: permitted, error: permError } = await callerClient.rpc("auth_has_permission", { perm_key: "hr.manage" });
  if (permError || !permitted) {
    return jsonResponse({ error: { code: "forbidden", message: "You don't have permission to invite employees." } }, 403);
  }

  let input: z.infer<typeof inviteSchema>;
  try {
    input = inviteSchema.parse(await req.json());
  } catch (err) {
    return jsonResponse(
      { error: { code: "invalid_input", message: err instanceof Error ? err.message : "Invalid request body" } },
      400,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: userData, error: userError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.fullName },
  });
  if (userError || !userData?.user) {
    return jsonResponse({ error: { code: "invite_failed", message: userError?.message ?? "Could not send invite" } }, 400);
  }

  const userId = userData.user.id;

  const { error: setupError } = await admin.rpc("provision_employee", {
    p_user_id: userId,
    p_organization_id: input.organizationId,
    p_school_id: input.schoolId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_designation: input.designation,
    p_department_id: input.departmentId ?? null,
    p_employment_type: input.employmentType,
    p_joining_date: input.joiningDate,
  });

  if (setupError) {
    await admin.auth.admin.deleteUser(userId);
    return jsonResponse({ error: { code: "provisioning_failed", message: setupError.message } }, 500);
  }

  return jsonResponse({ data: { profile_id: userId } }, 201);
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
