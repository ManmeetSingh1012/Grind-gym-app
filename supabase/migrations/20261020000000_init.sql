-- Grind: initial schema
-- Every user-owned table has RLS so a user can only ever see their own rows.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  sex            text check (sex in ('male', 'female')),
  birth_date     date,
  height_cm      numeric(5, 1) check (height_cm between 50 and 260),
  weight_kg      numeric(5, 1) check (weight_kg between 20 and 400),
  activity_level text not null default 'moderate'
                 check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type                text not null check (type in ('lose_fat', 'build_muscle', 'recomp', 'strength', 'endurance', 'maintain')),
  title               text not null,
  target_weight_kg    numeric(5, 1),
  target_body_fat_pct numeric(4, 1),
  target_date         date,
  training_days       smallint not null default 6 check (training_days between 1 and 7),
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id, is_active);
-- At most one active goal per user.
create unique index goals_one_active on public.goals (user_id) where is_active;
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Exercise library (user_id null = shared/global)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete cascade,
  name          text not null,
  muscle_group  text not null,
  secondary_muscles text[] not null default '{}',
  equipment     text,
  category      text not null default 'strength' check (category in ('strength', 'cardio', 'mobility', 'plyometric')),
  instructions  text,
  source_url    text,
  created_at    timestamptz not null default now()
);

create unique index exercises_name_per_owner
  on public.exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index exercises_name_trgm on public.exercises using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Weekly routine: which exercises happen on which weekday (1 = Mon … 7 = Sun)
-- ---------------------------------------------------------------------------
create table public.routine_exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  position     integer not null default 0,
  target_sets  smallint check (target_sets between 1 and 20),
  target_reps  text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, weekday, exercise_id)
);

create index routine_user_day_idx on public.routine_exercises (user_id, weekday, position);
create trigger routine_updated_at before update on public.routine_exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Set logs: the actual work done
-- ---------------------------------------------------------------------------
create table public.set_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  performed_on  date not null default current_date,
  set_number    smallint not null default 1,
  weight_kg     numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps          smallint not null check (reps between 0 and 500),
  rpe           numeric(3, 1) check (rpe between 1 and 10),
  duration_sec  integer check (duration_sec >= 0),
  distance_m    integer check (distance_m >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index set_logs_user_exercise_idx on public.set_logs (user_id, exercise_id, performed_on desc);
create index set_logs_user_date_idx on public.set_logs (user_id, performed_on desc);
create trigger set_logs_updated_at before update on public.set_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on     date not null default current_date,
  meal         text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name         text not null,
  quantity     numeric(8, 2) not null default 1,
  unit         text not null default 'serving',
  calories     numeric(8, 1) not null default 0,
  protein_g    numeric(7, 2) not null default 0,
  carbs_g      numeric(7, 2) not null default 0,
  fat_g        numeric(7, 2) not null default 0,
  -- Micronutrients keyed by the app's nutrient catalogue (see modules/nutrition/nutrients.ts)
  micros       jsonb not null default '{}'::jsonb,
  source       text not null default 'manual' check (source in ('manual', 'ai', 'usda')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, eaten_on desc);
create trigger food_logs_updated_at before update on public.food_logs
  for each row execute function public.set_updated_at();

-- Personal daily targets (calculated from profile or applied from an AI plan)
create table public.nutrition_targets (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calories    numeric(7, 1) not null,
  protein_g   numeric(6, 1) not null,
  carbs_g     numeric(6, 1) not null,
  fat_g       numeric(6, 1) not null,
  micros      jsonb not null default '{}'::jsonb,
  source      text not null default 'calculated' check (source in ('calculated', 'ai_plan', 'manual')),
  updated_at  timestamptz not null default now()
);

create trigger nutrition_targets_updated_at before update on public.nutrition_targets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Body composition scans (InBody etc.) and AI reports
-- ---------------------------------------------------------------------------
create table public.body_scans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  image_path           text,
  scanned_on           date not null default current_date,
  weight_kg            numeric(5, 1),
  body_fat_pct         numeric(4, 1),
  skeletal_muscle_kg   numeric(5, 1),
  fat_mass_kg          numeric(5, 1),
  visceral_fat_level   numeric(4, 1),
  bmr_kcal             integer,
  total_body_water_l   numeric(5, 1),
  metrics              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index body_scans_user_idx on public.body_scans (user_id, scanned_on desc);

create table public.ai_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('workout_insights', 'body_plan')),
  body_scan_id uuid references public.body_scans (id) on delete set null,
  goal_id      uuid references public.goals (id) on delete set null,
  content      jsonb not null,
  model        text not null,
  created_at   timestamptz not null default now()
);

create index ai_reports_user_kind_idx on public.ai_reports (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.goals             enable row level security;
alter table public.exercises         enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.set_logs          enable row level security;
alter table public.food_logs         enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.body_scans        enable row level security;
alter table public.ai_reports        enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "read global or own exercises" on public.exercises
  for select using (user_id is null or user_id = auth.uid());
create policy "write own exercises" on public.exercises
  for insert with check (user_id = auth.uid());
create policy "update own exercises" on public.exercises
  for update using (user_id = auth.uid());
create policy "delete own exercises" on public.exercises
  for delete using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['goals', 'routine_exercises', 'set_logs', 'food_logs',
                           'nutrition_targets', 'body_scans', 'ai_reports']
  loop
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for body composition images, one folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('body-scans', 'body-scans', false)
on conflict (id) do nothing;

create policy "own scan images read" on storage.objects
  for select using (bucket_id = 'body-scans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own scan images write" on storage.objects
  for insert with check (bucket_id = 'body-scans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own scan images delete" on storage.objects
  for delete using (bucket_id = 'body-scans' and (storage.foldername(name))[1] = auth.uid()::text);
