import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MAP: Record<string, number> = {
  seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    /* Buscar todas as grades ativas */
    const { data: grids } = await supabase
      .from("schedule_grids")
      .select("id, contractor_id, modalidade_id, modalidade_nome, staff_id, staff_nome, dias_semana, hora_inicio, hora_fim, capacidade_maxima, cor")
      .eq("ativo", true);

    if (!grids?.length) {
      return new Response(JSON.stringify({ ok: true, generated: 0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    /* Gerar slots para os próximos 30 dias que ainda não existem */
    const futureEnd = new Date(today);
    futureEnd.setDate(today.getDate() + 30);
    const fromStr = today.toISOString().split("T")[0];
    const toStr   = futureEnd.toISOString().split("T")[0];

    /* Buscar slots já existentes no período */
    const { data: existing } = await supabase
      .from("schedule_slots")
      .select("grid_id, data")
      .gte("data", fromStr)
      .lte("data", toStr);

    const existingSet = new Set((existing ?? []).map((s: any) => `${s.grid_id}_${s.data}`));

    let toInsert: any[] = [];

    for (const grid of grids as any[]) {
      const allowedJs = (grid.dias_semana as string[]).map(d => DAY_MAP[d]).filter(v => v !== undefined);

      for (let i = 0; i <= 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (!allowedJs.includes(d.getDay())) continue;

        const dateStr = d.toISOString().split("T")[0];
        const key = `${grid.id}_${dateStr}`;
        if (existingSet.has(key)) continue;

        toInsert.push({
          contractor_id:     grid.contractor_id,
          grid_id:           grid.id,
          modalidade_id:     grid.modalidade_id,
          modalidade_nome:   grid.modalidade_nome,
          staff_id:          grid.staff_id,
          staff_nome:        grid.staff_nome,
          data:              dateStr,
          hora_inicio:       grid.hora_inicio,
          hora_fim:          grid.hora_fim,
          capacidade_maxima: grid.capacidade_maxima,
          cor:               grid.cor,
          status:            "agendado",
        });
      }
    }

    let generated = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await supabase.from("schedule_slots").insert(chunk);
      if (!error) generated += chunk.length;
    }

    return new Response(
      JSON.stringify({ ok: true, generated, grids: grids.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
