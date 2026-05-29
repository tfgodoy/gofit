import { useState, useEffect, useRef } from "react";
import { Bell, Check, X, AlertCircle, DollarSign, UserPlus, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Notification {
  id:         string;
  tipo:       string;
  titulo:     string;
  mensagem:   string | null;
  lido:       boolean;
  link:       string | null;
  created_at: string;
}

const TIPO_ICON: Record<string, { Icon: React.ComponentType<{className?: string}>; cls: string }> = {
  cobranca_vencendo:   { Icon: AlertCircle, cls: "text-yellow-500 bg-yellow-50" },
  pagamento_confirmado:{ Icon: DollarSign,  cls: "text-green-500 bg-green-50" },
  novo_lead:           { Icon: UserPlus,    cls: "text-blue-500 bg-blue-50" },
  alerta:              { Icon: Zap,         cls: "text-red-500 bg-red-50" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function NotificationBell({ contractorId }: { contractorId?: string }) {
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(false);
  const ref                       = useRef<HTMLDivElement>(null);
  const navigate                  = useNavigate();
  const unread                    = items.filter(n => !n.lido).length;

  useEffect(() => {
    if (!contractorId) return;
    load();
  }, [contractorId]);

  /* close on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function load() {
    if (!contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, tipo, titulo, mensagem, lido, link, created_at")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ lido: true }).eq("id", id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, lido: true } : n));
  }

  async function markAllRead() {
    if (!contractorId) return;
    await supabase.from("notifications").update({ lido: true })
      .eq("contractor_id", contractorId).eq("lido", false);
    setItems(prev => prev.map(n => ({ ...n, lido: true })));
  }

  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setItems(prev => prev.filter(n => n.id !== id));
  }

  function handleClick(n: Notification) {
    markRead(n.id);
    if (n.link) { navigate(n.link); setOpen(false); }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(v => !v); if (!open) load(); }}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900">Notificações</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-8 h-8 text-gray-200" />
                <p className="text-xs text-gray-400">Nenhuma notificação</p>
              </div>
            ) : (
              items.map(n => {
                const tipo = TIPO_ICON[n.tipo] ?? TIPO_ICON.alerta;
                const Icon = tipo.Icon;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 group cursor-pointer transition-colors ${
                      n.lido ? "bg-white hover:bg-gray-50" : "bg-blue-50/50 hover:bg-blue-50"
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tipo.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${n.lido ? "text-gray-700 font-medium" : "text-gray-900 font-semibold"}`}>
                        {n.titulo}
                      </p>
                      {n.mensagem && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.mensagem}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); remove(n.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-gray-500 transition-all flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
