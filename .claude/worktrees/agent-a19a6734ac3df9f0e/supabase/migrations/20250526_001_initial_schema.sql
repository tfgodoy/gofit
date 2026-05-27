-- ============================================================
-- FitCoreSys - Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CONTRACTORS (empresas contratantes do sistema)
-- ============================================================
create table if not exists public.contractors (
  id            uuid primary key default uuid_generate_v4(),
  razao_social  text not null,
  nome_fantasia text not null,
  cnpj          text unique,
  email         text not null unique,
  fone          text,
  fuso_horario  text not null default 'America/Sao_Paulo',
  site          text,
  instagram     text,
  cep           text,
  logradouro    text,
  numero        text,
  bairro        text,
  complemento   text,
  cidade        text,
  uf            char(2),
  status        text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'trial')),
  plan          text not null default 'trial' check (plan in ('trial', 'starter', 'profissional', 'empresarial')),
  trial_ends_at timestamptz default now() + interval '14 days',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- CONTRACTOR AUTH (senhas simples — migrar para Supabase Auth depois)
-- ============================================================
create table if not exists public.contractor_auth (
  id             uuid primary key default uuid_generate_v4(),
  contractor_id  uuid not null references public.contractors(id) on delete cascade,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(contractor_id)
);

-- ============================================================
-- STAFF ROLES (funcionários da empresa contratante)
-- ============================================================
create type public.staff_role as enum (
  'teacher',
  'receptionist',
  'sales',
  'nutritionist',
  'physiotherapist',
  'evaluator'
);

create table if not exists public.staff (
  id            uuid primary key default uuid_generate_v4(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  name          text not null,
  email         text not null,
  role          public.staff_role not null,
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(contractor_id, email)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_contractors_email  on public.contractors(email);
create index if not exists idx_contractors_cnpj   on public.contractors(cnpj);
create index if not exists idx_contractors_status on public.contractors(status);
create index if not exists idx_staff_contractor   on public.staff(contractor_id);
create index if not exists idx_staff_email        on public.staff(email);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.contractors   enable row level security;
alter table public.contractor_auth enable row level security;
alter table public.staff         enable row level security;

-- For now, allow service role full access (anon used only for registration)
create policy "Allow insert for anon" on public.contractors
  for insert to anon with check (true);

create policy "Allow insert auth for anon" on public.contractor_auth
  for insert to anon with check (true);

create policy "Allow select own contractor" on public.contractors
  for select to anon using (true);

create policy "Allow select own auth" on public.contractor_auth
  for select to anon using (true);

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_contractors_updated_at
  before update on public.contractors
  for each row execute function public.set_updated_at();

create trigger trg_contractor_auth_updated_at
  before update on public.contractor_auth
  for each row execute function public.set_updated_at();

create trigger trg_staff_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();
