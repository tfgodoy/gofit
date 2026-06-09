-- ══════════════════════════════════════════════════════════════════
-- Fase 2 — Seed oficial dos 5 módulos GoFit
-- ══════════════════════════════════════════════════════════════════

DELETE FROM modules;

INSERT INTO modules (slug, name, description, route, icon, status, is_visible, sort_order)
VALUES
  (
    'gofit_pay',
    'GoFit Pay',
    'Gateway de pagamento integrado. Gere cobranças por Pix, Boleto e Cartão diretamente pelo GoFit. Seus alunos pagam sem sair da experiência. Receba automaticamente, sem precisar acessar outra plataforma.',
    '/app/gofit-pay',
    'CreditCard',
    'active',
    true,
    1
  ),
  (
    'gofit_mensagens',
    'GoFit Mensagens',
    'Central de comunicação com seus alunos. Envie mensagens por WhatsApp, SMS e push com automações, lembretes de vencimento, aniversários e campanhas segmentadas.',
    null,
    'MessageSquare',
    'coming_soon',
    true,
    2
  ),
  (
    'gofit_ia',
    'GoFit IA',
    'Inteligência artificial integrada ao sistema. Sugestões automáticas de treino, análise de retenção de alunos, insights financeiros e assistente virtual para a equipe.',
    null,
    'Sparkles',
    'coming_soon',
    true,
    3
  ),
  (
    'gofit_nutri',
    'GoFit Nutri',
    'Prescrição de dietas e planos alimentares integrados ao perfil do aluno. Fichas nutricionais, cálculo de macros e acompanhamento de evolução.',
    null,
    'Apple',
    'coming_soon',
    true,
    4
  ),
  (
    'gofit_avaliacoes',
    'GoFit Avaliações',
    'Avaliações físicas completas com gráficos de evolução, comparativo de períodos, protocolos personalizados e compartilhamento com o aluno.',
    null,
    'ClipboardList',
    'coming_soon',
    true,
    5
  );
