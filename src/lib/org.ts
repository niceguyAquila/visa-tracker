import { supabase } from "./supabase";

/** Single-tenant helper: first organization row (admins share one workspace). */
export async function getDefaultOrgId(): Promise<{
  orgId: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { orgId: null, error: error.message };
  }
  if (!data?.id) {
    return { orgId: null, error: "No organization found. Create one in Supabase first." };
  }
  return { orgId: data.id as string, error: null };
}
