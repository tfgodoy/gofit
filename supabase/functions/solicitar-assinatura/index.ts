import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AUTENTIQUE_API_KEY não configurada. Configure a chave no Supabase Dashboard → Edge Functions → Secrets." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const {
      contractor_id,
      student_contract_id,
      student_id,
      student_nome,
      student_email,
      contrato_descricao,
      valor_mensalidade,
      data_inicio,
      data_fim,
      contractor_nome,
    } = await req.json();

    if (!student_email) {
      return new Response(
        JSON.stringify({ error: "E-mail do aluno é obrigatório para enviar assinatura." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    /* ── Gerar PDF simples como texto ─────────────────────────── */
    const contratoHtml = `
      <html><body style="font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto">
      <h1 style="color:#333;border-bottom:2px solid #333;padding-bottom:10px">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
      <h2 style="color:#555">${contractor_nome ?? "Academia"}</h2>
      <hr>
      <p><strong>CONTRATANTE:</strong> ${student_nome}</p>
      <p><strong>PLANO:</strong> ${contrato_descricao ?? "Plano de serviços"}</p>
      <p><strong>VALOR MENSAL:</strong> R$ ${Number(valor_mensalidade).toFixed(2).replace(".", ",")}</p>
      <p><strong>VIGÊNCIA:</strong> ${data_inicio ? new Date(data_inicio + "T00:00:00").toLocaleDateString("pt-BR") : ""} ${data_fim ? "a " + new Date(data_fim + "T00:00:00").toLocaleDateString("pt-BR") : "— Indeterminado"}</p>
      <br>
      <h3>CLÁUSULAS</h3>
      <p>1. O CONTRATANTE se compromete a respeitar as normas internas da academia.</p>
      <p>2. O pagamento deverá ser realizado até o vencimento acordado.</p>
      <p>3. O congelamento é permitido mediante solicitação prévia de 5 dias.</p>
      <p>4. O cancelamento deve ser solicitado com 30 dias de antecedência.</p>
      <br>
      <p style="color:#888;font-size:12px">Gerado automaticamente em ${new Date().toLocaleDateString("pt-BR")} pelo FitCoreSys</p>
      </body></html>`;

    /* Converter HTML para PDF via uma API simples (usando PDF bytes via base64 para upload) */
    const pdfContent = new TextEncoder().encode(contratoHtml);

    /* ── Chamar API Autentique ─────────────────────────────────── */
    const mutation = `
      mutation CreateDocumentMutation(
        $document: DocumentInput!,
        $signers: [SignerInput!]!,
        $file: Upload!
      ) {
        createDocument(document: $document, signers: $signers, file: $file) {
          id
          name
          signatures {
            public_id
            name
            email
            link { short_link }
          }
        }
      }
    `;

    const operations = JSON.stringify({
      query: mutation,
      variables: {
        document: { name: `Contrato — ${student_nome}`, sandbox: false },
        signers: [{ email: student_email, action: "SIGN", delivery_method: "DELIVERY_METHOD_LINK" }],
        file: null,
      },
    });

    const formData = new FormData();
    formData.append("operations", operations);
    formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.append("0", new Blob([pdfContent], { type: "application/pdf" }), `contrato-${student_nome?.replace(/\s+/g, "-")}.pdf`);

    const autResp = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    const autData = await autResp.json();

    if (autData.errors) {
      console.error("Autentique error:", autData.errors);
      return new Response(
        JSON.stringify({ error: "Erro na API Autentique: " + autData.errors[0]?.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const doc       = autData.data?.createDocument;
    const signature = doc?.signatures?.[0];
    const link      = signature?.link?.short_link ?? null;
    const autId     = doc?.id ?? null;

    /* ── Salvar no banco ──────────────────────────────────────── */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabase.from("autentique_documents").insert({
      contractor_id,
      student_contract_id,
      student_id,
      student_nome,
      student_email,
      autentique_id:  autId,
      status:         "aguardando_assinatura",
      link_assinatura: link,
    });

    return new Response(
      JSON.stringify({ success: true, autentique_id: autId, link_assinatura: link }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
