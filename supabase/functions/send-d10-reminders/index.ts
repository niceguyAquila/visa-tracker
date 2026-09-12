/**
 * Daily job: email managers when a visa expires in exactly 10 days (UTC calendar date).
 * Invoke with header: x-cron-secret: <CRON_SECRET>
 *
 * Secrets (Supabase Dashboard → Edge Functions):
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (often injected automatically)
 * - CRON_SECRET
 * - RESEND_API_KEY
 * - RESEND_FROM (e.g. "Visa Tracker <onboarding@resend.dev>" for Resend tests)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type VisaRow = {
  id: string;
  visa_label: string;
  expiry_date: string;
  workers: { full_name: string; org_id: string; organizations: { name: string } | null } | null;
};

function addUtcDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
      },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM");

  if (!resendKey || !resendFrom) {
    return new Response(
      JSON.stringify({ error: "Missing RESEND_API_KEY or RESEND_FROM" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const today = utcToday();
  const target = addUtcDays(today, 10);

  const { data: visas, error: visaError } = await supabase
    .from("visa_records")
    .select(
      `
      id,
      visa_label,
      expiry_date,
      reminder_10d_sent,
      workers (
        full_name,
        org_id,
        organizations ( name )
      )
    `
    )
    .eq("expiry_date", target)
    .eq("reminder_10d_sent", false);

  if (visaError) {
    return new Response(JSON.stringify({ error: visaError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const list = (visas ?? []) as unknown as VisaRow[];
  if (list.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No visas on D-10 window" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const orgIds = [...new Set(list.map((v) => v.workers?.org_id).filter(Boolean))] as string[];

  const { data: members, error: memError } = await supabase
    .from("organization_members")
    .select("org_id, profiles ( email )")
    .in("org_id", orgIds);

  if (memError) {
    return new Response(JSON.stringify({ error: memError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  type MemberRow = { org_id: string; profiles: { email: string } | null };
  const byOrg = new Map<string, Set<string>>();
  for (const row of (members ?? []) as MemberRow[]) {
    const email = row.profiles?.email;
    if (!email) continue;
    if (!byOrg.has(row.org_id)) byOrg.set(row.org_id, new Set());
    byOrg.get(row.org_id)!.add(email);
  }

  const visaIdsToMark: string[] = [];
  let emailsSent = 0;

  for (const orgId of orgIds) {
    const recipients = [...(byOrg.get(orgId) ?? [])];
    const orgVisas = list.filter((v) => v.workers?.org_id === orgId);
    if (recipients.length === 0 || orgVisas.length === 0) continue;

    const orgName = orgVisas[0]?.workers?.organizations?.name ?? "Your organization";
    const rowsHtml = orgVisas
      .map((v) => {
        const name = v.workers?.full_name ?? "Worker";
        return `<tr><td style="padding:8px;border:1px solid #e2e8f0">${name}</td><td style="padding:8px;border:1px solid #e2e8f0">${v.visa_label}</td><td style="padding:8px;border:1px solid #e2e8f0">${v.expiry_date}</td></tr>`;
      })
      .join("");

    const html = `
      <p>Visa expiry reminder (${orgName}): the following visas expire in <strong>10 days</strong> (${target}).</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <thead><tr><th align="left" style="padding:8px;border:1px solid #e2e8f0">Worker</th><th align="left" style="padding:8px;border:1px solid #e2e8f0">Visa</th><th align="left" style="padding:8px;border:1px solid #e2e8f0">Expiry</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top:16px;color:#64748b;font-size:14px">This is an automated message from Visa Tracker.</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: recipients,
        subject: `Visa expiry in 10 days — ${orgName}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "Resend failed", detail: text }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    emailsSent += 1;
    orgVisas.forEach((v) => visaIdsToMark.push(v.id));
  }

  if (visaIdsToMark.length > 0) {
    const { error: upErr } = await supabase
      .from("visa_records")
      .update({ reminder_10d_sent: true })
      .in("id", visaIdsToMark);

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message, partial: true }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({
      target,
      visas: list.length,
      batches: emailsSent,
      marked: visaIdsToMark.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
