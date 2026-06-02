import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingPayload {
  lead_email:    string | null;
  lead_nome:     string;
  lead_telefone: string | null;
  anamnese_link: string;
  modalidade:    string;
  data_fmt:      string;   // ex: "segunda-feira, 09 de junho"
  hora_fmt:      string;   // ex: "07:00 — 08:00"
  professor:     string | null;
  academia_nome: string;
  academia_fone: string | null;
  academia_end:  string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const payload: BookingPayload = await req.json();
    const resendKey = Deno.env.get("RESEND_API_KEY");

    /* ── Email para o lead ─────────────────────────────────── */
    if (payload.lead_email && resendKey) {
      const html = buildEmailHtml(payload);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:    "FitCoreSys <noreply@fitcoresys.com.br>",
          to:      [payload.lead_email],
          subject: `✅ Aula Experimental confirmada — ${payload.academia_nome}`,
          html,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Resend error:", err);
      }
    } else if (!resendKey) {
      console.log("RESEND_API_KEY not set — skipping email");
    } else {
      console.log("No lead email — skipping email");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

/* ── Template de e-mail ──────────────────────────────────── */

function buildEmailHtml(p: BookingPayload): string {
  const professor = p.professor ? `Prof. ${p.professor}` : "";
  const fone      = p.academia_fone
    ? `<a href="https://wa.me/55${p.academia_fone.replace(/\D/g,"")}" style="color:#7c3aed">${p.academia_fone}</a>`
    : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:32px 32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:rgba(255,255,255,.2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
        <span style="color:#fff;font-size:22px;font-weight:900">${p.academia_nome.slice(0,2).toUpperCase()}</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0">${p.academia_nome}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="font-size:16px;color:#374151;margin:0 0 8px">Olá, <strong>${p.lead_nome.split(" ")[0]}</strong>! 👋</p>
      <p style="font-size:15px;color:#6b7280;margin:0 0 24px">Sua aula experimental foi confirmada com sucesso.</p>

      <!-- Resumo -->
      <div style="background:#f5f3ff;border-radius:12px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Modalidade</td>
              <td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;text-align:right">${p.modalidade}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Data</td>
              <td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;text-align:right;text-transform:capitalize">${p.data_fmt}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Horário</td>
              <td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;text-align:right">${p.hora_fmt}${professor ? ` · ${professor}` : ""}</td></tr>
          ${p.academia_end ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Endereço</td>
              <td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;text-align:right">${p.academia_end}</td></tr>` : ""}
        </table>
      </div>

      <!-- Anamnese CTA -->
      <div style="background:#fff1f2;border:2px solid #fecdd3;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#be123c;font-size:14px;font-weight:800;margin:0 0 6px">⚠️ Preencha sua Ficha de Saúde</p>
        <p style="color:#9f1239;font-size:13px;margin:0 0 16px">
          <strong>Obrigatório antes da aula.</strong> Você não poderá participar sem preencher a ficha de saúde.
        </p>
        <a href="${p.anamnese_link}"
           style="display:block;background:#ef4444;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:.5px">
          PREENCHER FICHA DE SAÚDE →
        </a>
      </div>

      <!-- Footer info -->
      ${fone ? `<p style="font-size:13px;color:#9ca3af;text-align:center;margin:0">Dúvidas? Fale conosco: ${fone}</p>` : ""}
    </div>

    <div style="background:#f9fafb;padding:16px;text-align:center">
      <p style="font-size:11px;color:#d1d5db;margin:0">Powered by FitCoreSys</p>
    </div>
  </div>
</body>
</html>`.trim();
}
