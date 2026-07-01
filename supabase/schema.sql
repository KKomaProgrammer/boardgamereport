-- BoardLab Studio Supabase schema
-- Supabase SQL Editor에서 실행하세요. 운영 전에는 RLS 정책을 프로젝트 상황에 맞게 한 번 더 검토하세요.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique,
  nickname_norm text unique,
  avatar_color text default '#dbeafe',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  owner_id uuid not null references auth.users(id) on delete cascade,
  current_mode text default 'ppt' check (current_mode in ('video','ppt','boardgame')),
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','editor','viewer','commenter')),
  ai_enabled boolean default false,
  invite_status text default 'accepted' check (invite_status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_documents (
  project_id uuid references public.projects(id) on delete cascade,
  document_type text not null check (document_type in ('video_workspace','ppt_workspace','boardgame_workspace')),
  content_enc text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  primary key (project_id, document_type)
);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  document_type text not null,
  content_enc text not null,
  summary text default '자동 저장 버전',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','viewer','commenter')),
  ai_enabled boolean default false,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  responded_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id),
  project_id uuid references public.projects(id) on delete cascade,
  type text not null,
  title text not null,
  body text default '',
  unread boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  slug text unique not null,
  scope text default 'all' check (scope in ('all','ppt','video','boardgame')),
  is_public boolean default true,
  password_hash text,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace view public.project_members_view as
select pm.project_id, pm.user_id, pm.role, pm.ai_enabled, pm.invite_status, p.nickname, p.avatar_color, pm.updated_at
from public.project_members pm
left join public.profiles p on p.id = pm.user_id;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_versions enable row level security;
alter table public.invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.share_links enable row level security;

-- 공개 닉네임 검색용. 이메일은 profiles에 저장하지 않습니다.
drop policy if exists "profiles searchable" on public.profiles;
create policy "profiles searchable" on public.profiles for select using (true);
drop policy if exists "profile self upsert" on public.profiles;
create policy "profile self upsert" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- 프로젝트 접근: 소유자 또는 수락된 팀원.
drop policy if exists "project read members" on public.projects;
create policy "project read members" on public.projects for select using (
  owner_id = auth.uid() or exists(select 1 from public.project_members m where m.project_id = id and m.user_id = auth.uid() and m.invite_status='accepted')
);
drop policy if exists "project owner insert" on public.projects;
create policy "project owner insert" on public.projects for insert with check (owner_id = auth.uid());
drop policy if exists "project edit members" on public.projects;
create policy "project edit members" on public.projects for update using (
  owner_id = auth.uid() or exists(select 1 from public.project_members m where m.project_id = id and m.user_id = auth.uid() and m.role in ('owner','editor') and m.invite_status='accepted')
);

-- 문서와 버전은 프로젝트 권한에 종속.
drop policy if exists "docs read members" on public.project_documents;
create policy "docs read members" on public.project_documents for select using (
  exists(select 1 from public.projects p where p.id=project_id and (p.owner_id=auth.uid() or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=auth.uid() and m.invite_status='accepted')))
);
drop policy if exists "docs edit members" on public.project_documents;
create policy "docs edit members" on public.project_documents for all using (
  exists(select 1 from public.projects p where p.id=project_id and (p.owner_id=auth.uid() or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=auth.uid() and m.role in ('owner','editor') and m.invite_status='accepted')))
) with check (true);

-- 알림은 본인만 읽기.
drop policy if exists "notifications self" on public.notifications;
create policy "notifications self" on public.notifications for select using (user_id = auth.uid());

-- Realtime 설정용: 필요한 테이블을 publication에 추가.
alter publication supabase_realtime add table public.project_documents;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.project_members;
