// supabase/functions/invite-portal-user/index.ts
//
// Fourth and last service-role use in this codebase. Same shape as
// invite-employee: verify the caller's permission, invite the auth user,
// hand off to a Postgres function, roll back on failure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const inviteSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  organizationId: z.string().uuid(),
  portalType: z.enum(["student", "guardian"]),
  targetId: z.string().uuid(), // students.id or guardians.id
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: { code: "method_not_allowed", message: "POST only" } }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: { code: "unauthorized", message: "Missing Authorization header" } }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  // Both students.update and admissions.manage-tier staff should be able
  // to send a portal invite; students.update is the narrowest permission
  // that already covers "editing this student's record," which sending
  // a portal invite for them is a form of.
  const { data: permitted, error: permError } = await callerClient.rpc("auth_has_permission", {
    perm_key: "students.update",
  });
  if (permError || !permitted) {
    return jsonResponse({ error: { code: "forbidden", message: "You don't have permission to send portal invites." } }, 403);
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

  const { error: provisionError } = await admin.rpc("provision_portal_profile", {
    p_user_id: userId,
    p_organization_id: input.organizationId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_portal_type: input.portalType,
    p_target_id: input.targetId,
  });

  if (provisionError) {
    await admin.auth.admin.deleteUser(userId);
    return jsonResponse({ error: { code: "provisioning_failed", message: provisionError.message } }, 500);
  }

  return jsonResponse({ data: { profile_id: userId } }, 201);
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
