-- DebateHub database schema for Supabase (PostgreSQL)

create extension if not exists pgcrypto;

-- Keep updated_at current automatically.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function create_seed_auth_user(
  seed_user_id uuid,
  seed_email text,
  seed_password text
)
returns void
language plpgsql
security definer
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    seed_user_id,
    'authenticated',
    'authenticated',
    seed_email,
    crypt(seed_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    seed_user_id,
    seed_user_id,
    seed_email,
    jsonb_build_object('sub', seed_user_id::text, 'email', seed_email),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set provider_id = excluded.provider_id,
      identity_data = excluded.identity_data,
      last_sign_in_at = excluded.last_sign_in_at,
      updated_at = now();
end;
$$;

create or replace function sync_updated_at_trigger(target_table regclass)
returns void
language plpgsql
as $$
declare
  trigger_name text := format('trg_%s_updated_at', lower(target_table::text));
begin
  execute format('drop trigger if exists %I on %s', trigger_name, target_table);
  execute format(
    'create trigger %I before update on %s for each row execute function set_updated_at()',
    trigger_name,
    target_table
  );
end;
$$;

create table if not exists Students (
  student_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  graduation_year int,
  phone text,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists Judges (
  judge_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  certification text,
  phone text,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists Coaches (
  coach_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  phone text,
  emergency_contact text,
  years_experience int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists Administrator (
  admin_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  role_title text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill schema updates for existing deployments.
alter table if exists Students add column if not exists emergency_contact text;
alter table if exists Judges add column if not exists emergency_contact text;
alter table if exists Coaches add column if not exists emergency_contact text;
alter table if exists S_Participation add column if not exists worldview text not null default 'Moderate';

-- Add constraint only if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 's_participation_worldview_check'
    and table_name = 's_participation'
  ) then
    alter table S_Participation add constraint s_participation_worldview_check check (worldview in ('Conservative', 'Liberal', 'Moderate'));
  end if;
end $$;

create table if not exists Tournament (
  tournament_id uuid primary key default gen_random_uuid(),
  name text not null,
  host_school text,
  location text,
  start_date date not null,
  end_date date,
  status text,
  created_by_admin_id uuid references Administrator(admin_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_date_check check (end_date is null or end_date >= start_date)
);

create table if not exists Tournament_Round (
  tournament_round_id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references Tournament(tournament_id) on delete cascade,
  debate_type text not null,
  round_number int not null,
  round_name text,
  scheduled_start timestamptz,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_round_number_check check (round_number > 0),
  constraint tournament_round_unique unique (tournament_id, round_number, debate_type)
);

create table if not exists Debate (
  debate_id uuid primary key default gen_random_uuid(),
  tournament_id uuid references Tournament(tournament_id) on delete set null,
  tournament_round_id uuid references Tournament_Round(tournament_round_id) on delete set null,
  debate_date date not null,
  debate_time time,
  topic text,
  room text,
  status text,
  team_a_name text,
  team_b_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists S_Participation (
  s_participation_id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references Debate(debate_id) on delete cascade,
  student_id uuid not null references Students(student_id) on delete cascade,
  team_number int not null,
  debate_stance text not null,
  worldview text not null default 'Moderate',
  speaking_order int,
  is_captain boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint s_participation_team_number_check check (team_number > 0),
  constraint s_participation_speaking_order_check check (speaking_order is null or speaking_order > 0),
  constraint s_participation_worldview_check check (worldview in ('Conservative', 'Liberal', 'Moderate')),
  constraint s_participation_unique unique (debate_id, student_id)
);

create table if not exists J_Participation (
  j_participation_id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references Debate(debate_id) on delete cascade,
  judge_id uuid not null references Judges(judge_id) on delete cascade,
  panel_number int,
  ruling text,
  score numeric(6,2),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint j_participation_panel_number_check check (panel_number is null or panel_number > 0),
  constraint j_participation_unique unique (debate_id, judge_id)
);

create table if not exists C_Participation (
  c_participation_id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references Debate(debate_id) on delete cascade,
  coach_id uuid not null references Coaches(coach_id) on delete cascade,
  mentored_team_number int not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint c_participation_team_number_check check (mentored_team_number > 0),
  constraint c_participation_unique unique (debate_id, coach_id, mentored_team_number)
);

create table if not exists Admin_Change_Log (
  change_log_id uuid primary key default gen_random_uuid(),
  admin_id uuid references Administrator(admin_id) on delete set null,
  admin_auth_user_id uuid,
  admin_email text,
  action_type text not null,
  entity_type text not null,
  target_table text not null,
  target_record_id text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  changed_at timestamptz not null default now(),
  constraint admin_change_log_action_check check (action_type in ('INSERT', 'UPDATE', 'DELETE'))
);

create index if not exists idx_admin_change_log_changed_at on Admin_Change_Log(changed_at desc);
create index if not exists idx_admin_change_log_target_table on Admin_Change_Log(target_table);
create index if not exists idx_admin_change_log_admin_id on Admin_Change_Log(admin_id);

create table if not exists Images (
  image_id uuid primary key default gen_random_uuid(),
  description text,
  file_path text,
  storage_bucket text,
  storage_object_path text,
  mime_type text,
  student_id uuid references Students(student_id) on delete cascade,
  judge_id uuid references Judges(judge_id) on delete cascade,
  coach_id uuid references Coaches(coach_id) on delete cascade,
  admin_id uuid references Administrator(admin_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint images_owner_check check (
    ((case when student_id is not null then 1 else 0 end) +
     (case when judge_id is not null then 1 else 0 end) +
     (case when coach_id is not null then 1 else 0 end) +
     (case when admin_id is not null then 1 else 0 end)) = 1
  )
);

create index if not exists idx_tournament_round_tournament_id on Tournament_Round(tournament_id);
create index if not exists idx_debate_tournament_id on Debate(tournament_id);
create index if not exists idx_debate_tournament_round_id on Debate(tournament_round_id);
create index if not exists idx_s_participation_debate_id on S_Participation(debate_id);
create index if not exists idx_s_participation_student_id on S_Participation(student_id);
create index if not exists idx_j_participation_debate_id on J_Participation(debate_id);
create index if not exists idx_j_participation_judge_id on J_Participation(judge_id);
create index if not exists idx_c_participation_debate_id on C_Participation(debate_id);
create index if not exists idx_c_participation_coach_id on C_Participation(coach_id);

create or replace function public.resolve_admin_actor()
returns table (
  actor_admin_id uuid,
  actor_auth_user_id uuid,
  actor_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_uid uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if viewer_uid is null and viewer_email = '' then
    return;
  end if;

  return query
  select a.admin_id, viewer_uid, viewer_email
  from Administrator a
  where a.auth_user_id = viewer_uid
     or lower(a.email) = viewer_email
  limit 1;
end;
$$;

create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  id_column text := TG_ARGV[0];
  entity_name text := TG_ARGV[1];
  actor record;
  old_json jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
  new_json jsonb := case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(NEW) else null end;
  changed_keys text[] := null;
  target_id text := null;
begin
  select * into actor from public.resolve_admin_actor();
  if actor.actor_admin_id is null then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'UPDATE' then
    select array_agg(key)
    into changed_keys
    from (
      select key from jsonb_object_keys(coalesce(old_json, '{}'::jsonb)) as key
      union
      select key from jsonb_object_keys(coalesce(new_json, '{}'::jsonb)) as key
    ) keys
    where old_json -> key is distinct from new_json -> key;

    if coalesce(array_length(changed_keys, 1), 0) = 0 then
      return NEW;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    target_id := coalesce(old_json ->> id_column, null);
  else
    target_id := coalesce(new_json ->> id_column, null);
  end if;

  insert into Admin_Change_Log (
    admin_id,
    admin_auth_user_id,
    admin_email,
    action_type,
    entity_type,
    target_table,
    target_record_id,
    old_data,
    new_data,
    changed_fields
  ) values (
    actor.actor_admin_id,
    actor.actor_auth_user_id,
    actor.actor_email,
    TG_OP,
    entity_name,
    TG_TABLE_NAME,
    target_id,
    old_json,
    new_json,
    changed_keys
  );

  return coalesce(NEW, OLD);
end;
$$;

select sync_updated_at_trigger(target_table)
from unnest(array[
  'Students'::regclass,
  'Judges'::regclass,
  'Coaches'::regclass,
  'Administrator'::regclass,
  'Tournament'::regclass,
  'Tournament_Round'::regclass,
  'Debate'::regclass,
  'S_Participation'::regclass,
  'J_Participation'::regclass,
  'C_Participation'::regclass,
  'Images'::regclass
]) as trigger_targets(target_table);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_account_type text := lower(coalesce(new.raw_user_meta_data ->> 'account_type', 'student'));
  account_type text := case
    when requested_account_type in ('coach', 'judge') then requested_account_type
    else 'student'
  end;
  email_local_part text := regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[._-]+', ' ', 'g');
  derived_first_name text := coalesce(nullif(initcap(split_part(email_local_part, ' ', 1)), ''), 'New');
  derived_last_name text := coalesce(
    nullif(initcap(btrim(substr(email_local_part, length(split_part(email_local_part, ' ', 1)) + 1))), ''),
    'Member'
  );
begin
  if account_type = 'coach' then
    insert into Coaches (
      auth_user_id, first_name, last_name, school, email, phone, years_experience
    ) values (
      new.id, derived_first_name, derived_last_name, null, new.email, null, null
    )
    on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        updated_at = now();
  elsif account_type = 'judge' then
    insert into Judges (
      auth_user_id, first_name, last_name, school, email, certification, phone
    ) values (
      new.id, derived_first_name, derived_last_name, null, new.email, null, null
    )
    on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        updated_at = now();
  else
    insert into Students (
      auth_user_id, first_name, last_name, school, email, graduation_year, phone
    ) values (
      new.id, derived_first_name, derived_last_name, null, new.email, null, null
    )
    on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

-- ------------------------------------------------------------
-- Sample seed data
-- ------------------------------------------------------------

select create_seed_auth_user(seed_user_id, seed_email, seed_password)
from (values
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'taylor.morgan@eastview.edu', 'student'),
  ('f0000000-0000-0000-0000-000000000002'::uuid, 'mia.rodriguez@judges.org', 'judge'),
  ('f0000000-0000-0000-0000-000000000003'::uuid, 'renee.davis@eastview.edu', 'coach'),
  ('f0000000-0000-0000-0000-000000000004'::uuid, 'avery.patel@eastview.edu', 'admin')
) as seed_users(seed_user_id, seed_email, seed_password);

insert into Administrator (
  admin_id, auth_user_id, first_name, last_name, school, email, role_title, phone
) values
  ('30000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', 'Avery', 'Patel', 'Eastview High School', 'avery.patel@eastview.edu', 'Tournament Director', '555-0101'),
  ('30000000-0000-0000-0000-000000000002', null, 'Morgan', 'Reed', 'Lakewood Academy', 'morgan.reed@lakewood.edu', 'Assistant Tournament Director', '555-0102')
on conflict (admin_id) do update
set auth_user_id = excluded.auth_user_id;

insert into Students (
  student_id, auth_user_id, first_name, last_name, school, email, graduation_year, phone, emergency_contact
) values
  ('00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Taylor', 'Morgan', 'Eastview High School', 'taylor.morgan@eastview.edu', 2027, '555-1001', null),
  ('00000000-0000-0000-0000-000000000002', null, 'Alex', 'Chen', 'Eastview High School', 'alex.chen@eastview.edu', 2027, '555-1002', 'Mei Chen - 555-4102'),
  ('00000000-0000-0000-0000-000000000003', null, 'Jordan', 'Lee', 'Lakewood Academy', 'jordan.lee@lakewood.edu', 2028, '555-1003', 'Pat Lee - 555-4103'),
  ('00000000-0000-0000-0000-000000000004', null, 'Casey', 'Nguyen', 'Eastview High School', 'casey.nguyen@eastview.edu', 2028, '555-1004', 'Linh Nguyen - 555-4104'),
  ('00000000-0000-0000-0000-000000000005', null, 'Riley', 'Johnson', 'Northfield High School', 'riley.johnson@northfield.edu', 2027, '555-1005', 'Dana Johnson - 555-4105'),
  ('00000000-0000-0000-0000-000000000006', null, 'Sam', 'Gupta', 'Lakewood Academy', 'sam.gupta@lakewood.edu', 2029, '555-1006', 'Anita Gupta - 555-4106'),
  ('00000000-0000-0000-0000-000000000007', null, 'Morgan', 'Williams', 'Eastview High School', 'morgan.williams@eastview.edu', 2027, '555-1007', 'Sarah Williams - 555-4107'),
  ('00000000-0000-0000-0000-000000000008', null, 'Drew', 'Thompson', 'Northfield High School', 'drew.thompson@northfield.edu', 2028, '555-1008', 'Mike Thompson - 555-4108'),
  ('00000000-0000-0000-0000-000000000009', null, 'Avery', 'Davis', 'Lakewood Academy', 'avery.davis@lakewood.edu', 2029, '555-1009', 'Chris Davis - 555-4109'),
  ('00000000-0000-0000-0000-000000000010', null, 'Cameron', 'Martinez', 'Eastview High School', 'cameron.martinez@eastview.edu', 2027, '555-1010', 'Rosa Martinez - 555-4110'),
  ('00000000-0000-0000-0000-000000000011', null, 'Jamie', 'Wilson', 'Northfield High School', 'jamie.wilson@northfield.edu', 2028, '555-1011', 'Tom Wilson - 555-4111'),
  ('00000000-0000-0000-0000-000000000012', null, 'Taylor', 'Brown', 'Lakewood Academy', 'taylor.brown@lakewood.edu', 2029, '555-1012', 'Lisa Brown - 555-4112')
on conflict (student_id) do update
set auth_user_id = excluded.auth_user_id,
    emergency_contact = coalesce(Students.emergency_contact, excluded.emergency_contact);

insert into Judges (
  judge_id, auth_user_id, first_name, last_name, school, email, certification, phone, emergency_contact
) values
  ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'Mia', 'Rodriguez', 'Independent', 'mia.rodriguez@judges.org', 'NSDA Gold', '555-2001', 'Carlos Rodriguez - 555-4201'),
  ('10000000-0000-0000-0000-000000000002', null, 'Noah', 'Kim', 'Northfield High School', 'noah.kim@northfield.edu', 'NSDA Silver', '555-2002', 'Sun Kim - 555-4202'),
  ('10000000-0000-0000-0000-000000000003', null, 'Olivia', 'Turner', 'Independent', 'olivia.turner@judges.org', 'NSDA Bronze', '555-2003', 'Mara Turner - 555-4203'),
  ('10000000-0000-0000-0000-000000000004', null, 'Ethan', 'Garcia', 'Lakewood Academy', 'ethan.garcia@lakewood.edu', 'NSDA Gold', '555-2004', 'Maria Garcia - 555-4204'),
  ('10000000-0000-0000-0000-000000000005', null, 'Sophia', 'Anderson', 'Eastview High School', 'sophia.anderson@eastview.edu', 'NSDA Silver', '555-2005', 'David Anderson - 555-4205'),
  ('10000000-0000-0000-0000-000000000006', null, 'Liam', 'Taylor', 'Independent', 'liam.taylor@judges.org', 'NSDA Bronze', '555-2006', 'Emma Taylor - 555-4206'),
  ('10000000-0000-0000-0000-000000000007', null, 'Isabella', 'Moore', 'Northfield High School', 'isabella.moore@northfield.edu', 'NSDA Gold', '555-2007', 'James Moore - 555-4207')
on conflict (judge_id) do update
set auth_user_id = excluded.auth_user_id,
    emergency_contact = coalesce(Judges.emergency_contact, excluded.emergency_contact);

insert into Coaches (
  coach_id, auth_user_id, first_name, last_name, school, email, phone, emergency_contact, years_experience
) values
  ('20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', 'Renee', 'Davis', 'Eastview High School', 'renee.davis@eastview.edu', '555-3001', 'Marcus Davis - 555-4301', 9),
  ('20000000-0000-0000-0000-000000000002', null, 'Evan', 'Brooks', 'Lakewood Academy', 'evan.brooks@lakewood.edu', '555-3002', 'Jill Brooks - 555-4302', 6),
  ('20000000-0000-0000-0000-000000000003', null, 'Priya', 'Shah', 'Northfield High School', 'priya.shah@northfield.edu', '555-3003', 'Raj Shah - 555-4303', 11),
  ('20000000-0000-0000-0000-000000000004', null, 'Marcus', 'Johnson', 'Eastview High School', 'marcus.johnson@eastview.edu', '555-3004', 'Lisa Johnson - 555-4304', 15),
  ('20000000-0000-0000-0000-000000000005', null, 'Sarah', 'Williams', 'Lakewood Academy', 'sarah.williams@lakewood.edu', '555-3005', 'John Williams - 555-4305', 8)
on conflict (coach_id) do update
set auth_user_id = excluded.auth_user_id,
    emergency_contact = coalesce(Coaches.emergency_contact, excluded.emergency_contact);

insert into Tournament (
  tournament_id, name, host_school, location, start_date, end_date, status, created_by_admin_id
) values
  ('40000000-0000-0000-0000-000000000001', 'Spring Invitational 2026', 'Eastview High School', 'St. Paul, MN', '2026-04-12', '2026-04-13', 'scheduled', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'Metro Classic 2026', 'Lakewood Academy', 'Minneapolis, MN', '2026-05-03', '2026-05-04', 'scheduled', '30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', 'State Championship 2026', 'Northfield High School', 'Northfield, MN', '2026-05-17', '2026-05-18', 'scheduled', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000004', 'Regional Qualifier 2026', 'Eastview High School', 'St. Paul, MN', '2026-03-15', '2026-03-15', 'completed', '30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000005', 'Winter Tournament 2026', 'Lakewood Academy', 'Minneapolis, MN', '2026-02-08', '2026-02-09', 'completed', '30000000-0000-0000-0000-000000000001')
on conflict (tournament_id) do nothing;

insert into Tournament_Round (
  tournament_round_id, tournament_id, debate_type, round_number, round_name, scheduled_start, room
) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Public Forum', 1, 'Prelim 1', '2026-04-12 09:00:00+00', 'A101'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Public Forum', 2, 'Prelim 2', '2026-04-12 11:00:00+00', 'A103'),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', 'Public Forum', 3, 'Prelim 3', '2026-04-12 14:00:00+00', 'A105'),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', 'Policy', 1, 'Policy Prelim 1', '2026-04-12 09:30:00+00', 'P201'),
  ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', 'Policy', 2, 'Policy Prelim 2', '2026-04-12 12:30:00+00', 'P202'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'Public Forum', 1, 'Prelim 1', '2026-05-03 09:30:00+00', 'B201'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Public Forum', 2, 'Prelim 2', '2026-05-03 12:00:00+00', 'B204'),
  ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000002', 'Public Forum', 3, 'Prelim 3', '2026-05-03 14:30:00+00', 'B206'),
  ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000002', 'Policy', 1, 'Policy Prelim 1', '2026-05-03 10:00:00+00', 'P301'),
  ('50000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000002', 'Policy', 2, 'Policy Prelim 2', '2026-05-03 13:00:00+00', 'P302'),
  ('50000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000003', 'Public Forum', 1, 'Quarterfinals', '2026-05-17 09:00:00+00', 'C101'),
  ('50000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000003', 'Public Forum', 2, 'Semifinals', '2026-05-17 14:00:00+00', 'C201'),
  ('50000000-0000-0000-0000-00000000000d', '40000000-0000-0000-0000-000000000003', 'Public Forum', 3, 'Finals', '2026-05-18 10:00:00+00', 'Auditorium'),
  ('50000000-0000-0000-0000-00000000000e', '40000000-0000-0000-0000-000000000003', 'Policy', 1, 'Policy Quarterfinals', '2026-05-17 10:30:00+00', 'P401'),
  ('50000000-0000-0000-0000-00000000000f', '40000000-0000-0000-0000-000000000003', 'Policy', 2, 'Policy Semifinals', '2026-05-17 15:30:00+00', 'P501'),
  ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000003', 'Policy', 3, 'Policy Finals', '2026-05-18 13:00:00+00', 'Auditorium'),
  ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000004', 'Public Forum', 1, 'Prelim 1', '2026-03-15 09:00:00+00', 'D101'),
  ('50000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000004', 'Public Forum', 2, 'Prelim 2', '2026-03-15 11:00:00+00', 'D102'),
  ('50000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000005', 'Public Forum', 1, 'Prelim 1', '2026-02-08 09:30:00+00', 'E101'),
  ('50000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000005', 'Public Forum', 2, 'Prelim 2', '2026-02-08 12:00:00+00', 'E102'),
  ('50000000-0000-0000-0000-000000000015', '40000000-0000-0000-0000-000000000005', 'Policy', 1, 'Policy Prelim 1', '2026-02-08 10:00:00+00', 'P601'),
  ('50000000-0000-0000-0000-000000000016', '40000000-0000-0000-0000-000000000005', 'Policy', 2, 'Policy Prelim 2', '2026-02-08 13:30:00+00', 'P602')
on conflict (tournament_round_id) do nothing;

insert into Debate (
  debate_id, tournament_id, tournament_round_id, debate_date, debate_time, topic, room, status, team_a_name, team_b_name
) values
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-04-12', '09:00:00', 'Resolved: Public schools should adopt AI tutoring systems.', 'A101', 'completed', 'Eastview A', 'Lakewood A'),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '2026-04-12', '11:00:00', 'Resolved: Urban public transit should be fare-free.', 'A103', 'scheduled', 'Eastview A', 'Northfield A'),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-05-03', '09:30:00', 'Resolved: Social media platforms should be held liable for misinformation.', 'B201', 'completed', 'Eastview B', 'Northfield A'),
  ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004', '2026-05-03', '12:00:00', 'Resolved: College should be tuition-free at public universities.', 'B204', 'scheduled', 'Lakewood B', 'Eastview A'),
  ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000b', '2026-05-17', '09:00:00', 'Resolved: The United States should implement a universal basic income.', 'C101', 'completed', 'Eastview A', 'Lakewood A'),
  ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000c', '2026-05-17', '14:00:00', 'Resolved: Space exploration should be a global priority.', 'C201', 'scheduled', 'Northfield A', 'Eastview B'),
  ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000d', '2026-05-18', '10:00:00', 'Resolved: Artificial intelligence should be regulated internationally.', 'Auditorium', 'scheduled', 'Lakewood A', 'Eastview A'),
  ('60000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000011', '2026-03-15', '09:00:00', 'Resolved: Renewable energy should replace fossil fuels by 2035.', 'D101', 'completed', 'Eastview A', 'Northfield A'),
  ('60000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000012', '2026-03-15', '11:00:00', 'Resolved: Social media should have age restrictions.', 'D102', 'completed', 'Lakewood A', 'Eastview B'),
  ('60000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000013', '2026-02-08', '09:30:00', 'Resolved: The minimum wage should be $15 per hour.', 'E101', 'completed', 'Northfield A', 'Lakewood A'),
  ('60000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000014', '2026-02-08', '12:00:00', 'Resolved: Online privacy should be a fundamental right.', 'E102', 'completed', 'Eastview A', 'Northfield B')
on conflict (debate_id) do nothing;

insert into S_Participation (
  s_participation_id, debate_id, student_id, team_number, debate_stance, speaking_order, is_captain
) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 1, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000008', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000009', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000011', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000012', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000015', '60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000016', '60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000017', '60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000018', '60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000019', '60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000006', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000020', '60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000009', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000021', '60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000007', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000022', '60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000010', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000023', '60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000024', '60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000011', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000025', '60000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000009', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000026', '60000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000012', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000027', '60000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000004', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000028', '60000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000005', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000029', '60000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000008', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000030', '60000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000031', '60000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000009', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000032', '60000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000012', 2, 'Negative', 2, false),
  ('70000000-0000-0000-0000-000000000033', '60000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', 1, 'Affirmative', 1, true),
  ('70000000-0000-0000-0000-000000000034', '60000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000007', 1, 'Affirmative', 2, false),
  ('70000000-0000-0000-0000-000000000035', '60000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 2, 'Negative', 1, true),
  ('70000000-0000-0000-0000-000000000036', '60000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000006', 2, 'Negative', 2, false)
on conflict (s_participation_id) do nothing;

insert into J_Participation (
  j_participation_id, debate_id, judge_id, panel_number, ruling, score, feedback
) values
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'Team 1 (Affirmative) wins', 29.50, 'Strong weighing and clear summary speeches.'),
  ('80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1, 'Team 1 (Affirmative) wins', 28.75, 'Good evidence comparison; improve crossfire pacing.'),
  ('80000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1, null, null, null),
  ('80000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 2, 'Team 2 (Negative) wins', 28.25, 'Negative rebuttal turned on impact calculus.'),
  ('80000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 1, null, null, null),
  -- Single judge panels
  ('80000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', 1, 'Team 1 (Affirmative) wins', 29.00, 'Excellent case development and rebuttal strategy.'),
  ('80000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000005', 1, 'Team 2 (Negative) wins', 27.50, 'Strong negative position with solid evidence.'),
  ('80000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000006', 1, 'Team 1 (Affirmative) wins', 28.75, 'Clear argumentation and effective cross-examination.'),
  -- Three-judge panels
  ('80000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 1, 'Team 1 (Affirmative) wins', 29.25, 'Outstanding constructive speeches.'),
  ('80000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 1, 'Team 1 (Affirmative) wins', 28.50, 'Good flow and evidence quality.'),
  ('80000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 1, 'Team 1 (Affirmative) wins', 29.00, 'Solid rebuttal work from both sides.'),
  ('80000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004', 2, 'Team 2 (Negative) wins', 28.75, 'Negative successfully defended their position.'),
  ('80000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000005', 2, 'Team 2 (Negative) wins', 27.25, 'Impact calculus favored the negative.'),
  ('80000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006', 2, 'Team 2 (Negative) wins', 28.00, 'Good strategic positioning.'),
  -- Two-judge panels
  ('80000000-0000-0000-0000-000000000015', '60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000007', 1, 'Team 1 (Affirmative) wins', 28.50, 'Affirmative maintained control throughout.'),
  ('80000000-0000-0000-0000-000000000016', '60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 1, 'Team 1 (Affirmative) wins', 29.25, 'Excellent evidence presentation.'),
  ('80000000-0000-0000-0000-000000000017', '60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 1, 'Team 2 (Negative) wins', 27.75, 'Negative turned the round effectively.'),
  ('80000000-0000-0000-0000-000000000018', '60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003', 1, 'Team 2 (Negative) wins', 28.50, 'Strong final rebuttal.')
on conflict (j_participation_id) do nothing;

insert into C_Participation (
  c_participation_id, debate_id, coach_id, mentored_team_number, notes
) values
  ('90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'Focus on second rebuttal collapse and impact framing.'),
  ('90000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 2, 'Prioritize defense extension in final focus.'),
  ('90000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1, 'Prep transport and evidence packets before round start.'),
  ('90000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 1, 'Emphasize frontlines in second summary.'),
  ('90000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 2, 'Rebuild link chain with clearer warrants.'),
  ('90000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 1, 'Prepare extra evidence blocks on cost burden.'),
  ('90000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 1, 'Work on impact comparison in rebuttals.'),
  ('90000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 2, 'Focus on weighing mechanism clarity.'),
  ('90000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 1, 'Practice quick responses to common arguments.'),
  ('90000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', 2, 'Strengthen evidence quality and citation.'),
  ('90000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 1, 'Develop stronger case structure.'),
  ('90000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000005', 2, 'Improve rebuttal timing and delivery.'),
  ('90000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', 1, 'Focus on evidence analysis depth.'),
  ('90000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', 2, 'Work on argument extension techniques.'),
  ('90000000-0000-0000-0000-000000000015', '60000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 1, 'Practice cross-examination responses.'),
  ('90000000-0000-0000-0000-000000000016', '60000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000005', 2, 'Strengthen summary speech organization.'),
  ('90000000-0000-0000-0000-000000000017', '60000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000003', 1, 'Develop better time management skills.'),
  ('90000000-0000-0000-0000-000000000018', '60000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000004', 2, 'Focus on impact weighing clarity.'),
  ('90000000-0000-0000-0000-000000000019', '60000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 1, 'Improve evidence presentation.'),
  ('90000000-0000-0000-0000-000000000020', '60000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000002', 2, 'Work on rebuttal strategy.')
on conflict (c_participation_id) do nothing;

insert into Images (
  image_id, description, file_path, storage_bucket, storage_object_path, mime_type, student_id, judge_id, coach_id, admin_id
) values
  ('a0000000-0000-0000-0000-000000000001', 'Taylor profile picture', '/images/profiles/students/taylor-morgan.jpg', 'profile-images', 'students/taylor-morgan.jpg', 'image/jpeg', '00000000-0000-0000-0000-000000000001', null, null, null),
  ('a0000000-0000-0000-0000-000000000002', 'Judge Mia profile picture', '/images/profiles/judges/mia-rodriguez.png', 'profile-images', 'judges/mia-rodriguez.png', 'image/png', null, '10000000-0000-0000-0000-000000000001', null, null),
  ('a0000000-0000-0000-0000-000000000003', 'Coach Renee profile picture', '/images/profiles/coaches/renee-davis.jpg', 'profile-images', 'coaches/renee-davis.jpg', 'image/jpeg', null, null, '20000000-0000-0000-0000-000000000001', null),
  ('a0000000-0000-0000-0000-000000000004', 'Admin Avery profile picture', '/images/profiles/admins/avery-patel.jpg', 'profile-images', 'admins/avery-patel.jpg', 'image/jpeg', null, null, null, '30000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'Casey profile picture', '/images/profiles/students/casey-nguyen.jpg', 'profile-images', 'students/casey-nguyen.jpg', 'image/jpeg', '00000000-0000-0000-0000-000000000004', null, null, null),
  ('a0000000-0000-0000-0000-000000000006', 'Judge Olivia profile picture', '/images/profiles/judges/olivia-turner.jpg', 'profile-images', 'judges/olivia-turner.jpg', 'image/jpeg', null, '10000000-0000-0000-0000-000000000003', null, null),
  ('a0000000-0000-0000-0000-000000000007', 'Coach Priya profile picture', '/images/profiles/coaches/priya-shah.jpg', 'profile-images', 'coaches/priya-shah.jpg', 'image/jpeg', null, null, '20000000-0000-0000-0000-000000000003', null),
  ('a0000000-0000-0000-0000-000000000008', 'Admin Morgan profile picture', '/images/profiles/admins/morgan-reed.jpg', 'profile-images', 'admins/morgan-reed.jpg', 'image/jpeg', null, null, null, '30000000-0000-0000-0000-000000000002')
on conflict (image_id) do nothing;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists trg_admin_audit_students on Students;
create trigger trg_admin_audit_students
after insert or update or delete on Students
for each row execute function public.log_admin_change('student_id', 'profile');

drop trigger if exists trg_admin_audit_judges on Judges;
create trigger trg_admin_audit_judges
after insert or update or delete on Judges
for each row execute function public.log_admin_change('judge_id', 'profile');

drop trigger if exists trg_admin_audit_coaches on Coaches;
create trigger trg_admin_audit_coaches
after insert or update or delete on Coaches
for each row execute function public.log_admin_change('coach_id', 'profile');

drop trigger if exists trg_admin_audit_debate on Debate;
create trigger trg_admin_audit_debate
after insert or update or delete on Debate
for each row execute function public.log_admin_change('debate_id', 'debate');

drop trigger if exists trg_admin_audit_s_participation on S_Participation;
create trigger trg_admin_audit_s_participation
after insert or update or delete on S_Participation
for each row execute function public.log_admin_change('s_participation_id', 'assignment');

drop trigger if exists trg_admin_audit_j_participation on J_Participation;
create trigger trg_admin_audit_j_participation
after insert or update or delete on J_Participation
for each row execute function public.log_admin_change('j_participation_id', 'assignment');

drop trigger if exists trg_admin_audit_c_participation on C_Participation;
create trigger trg_admin_audit_c_participation
after insert or update or delete on C_Participation
for each row execute function public.log_admin_change('c_participation_id', 'assignment');

-- ------------------------------------------------------------
-- Supabase auth + RLS policies
-- ------------------------------------------------------------

do $$
declare
  target_table regclass;
begin
  foreach target_table in array array[
    'Students'::regclass,
    'Judges'::regclass,
    'Coaches'::regclass,
    'Administrator'::regclass,
    'Debate'::regclass,
    'Tournament'::regclass,
    'Tournament_Round'::regclass,
    'S_Participation'::regclass,
    'J_Participation'::regclass,
    'C_Participation'::regclass,
    'Admin_Change_Log'::regclass,
    'Images'::regclass
  ]
  loop
    execute format('alter table %s enable row level security', target_table);
  end loop;
end;
$$;

-- Tables without policies below default to deny-all until explicit policies are added.

drop policy if exists students_select_own on Students;
create policy students_select_own
on Students
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists students_select_admin on Students;
create policy students_select_admin
on Students
for select
to authenticated
using (
  exists (
    select 1
    from Administrator
    where Administrator.auth_user_id = auth.uid()
      or lower(Administrator.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists students_insert_own on Students;
create policy students_insert_own
on Students
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists students_update_own on Students;
create policy students_update_own
on Students
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or (auth_user_id is null and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email))
)
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists judges_select_own on Judges;
create policy judges_select_own
on Judges
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists judges_select_admin on Judges;
create policy judges_select_admin
on Judges
for select
to authenticated
using (
  exists (
    select 1
    from Administrator
    where Administrator.auth_user_id = auth.uid()
      or lower(Administrator.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists judges_insert_own on Judges;
create policy judges_insert_own
on Judges
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists judges_update_own on Judges;
create policy judges_update_own
on Judges
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or (auth_user_id is null and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email))
)
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists coaches_select_own on Coaches;
create policy coaches_select_own
on Coaches
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists coaches_select_admin on Coaches;
create policy coaches_select_admin
on Coaches
for select
to authenticated
using (
  exists (
    select 1
    from Administrator
    where Administrator.auth_user_id = auth.uid()
      or lower(Administrator.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists administrator_select_own on Administrator;
create policy administrator_select_own
on Administrator
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists administrator_insert_own on Administrator;
create policy administrator_insert_own
on Administrator
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists administrator_update_own on Administrator;
create policy administrator_update_own
on Administrator
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or (auth_user_id is null and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email))
)
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists coaches_insert_own on Coaches;
create policy coaches_insert_own
on Coaches
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists coaches_update_own on Coaches;
create policy coaches_update_own
on Coaches
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or (auth_user_id is null and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email))
)
with check (
  auth.uid() = auth_user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email)
);

drop policy if exists tournament_select_authenticated on Tournament;
create policy tournament_select_authenticated
on Tournament
for select
to authenticated
using (true);

drop policy if exists tournament_round_select_authenticated on Tournament_Round;
create policy tournament_round_select_authenticated
on Tournament_Round
for select
to authenticated
using (true);

drop policy if exists s_participation_select_own on S_Participation;
create policy s_participation_select_own
on S_Participation
for select
to authenticated
using (
  exists (
    select 1
    from Students
    where Students.student_id = S_Participation.student_id
      and (
        Students.auth_user_id = auth.uid()
        or lower(coalesce(auth.jwt() ->> 'email', '')) = lower(Students.email)
      )
  )
);

drop policy if exists j_participation_select_authenticated on J_Participation;
create policy j_participation_select_authenticated
on J_Participation
for select
to authenticated
using (true);

drop policy if exists c_participation_select_authenticated on C_Participation;
create policy c_participation_select_authenticated
on C_Participation
for select
to authenticated
using (true);

drop policy if exists debates_select_authenticated on Debate;
create policy debates_select_authenticated
on Debate
for select
to authenticated
using (true);

drop policy if exists admin_change_log_select_admin on Admin_Change_Log;
create policy admin_change_log_select_admin
on Admin_Change_Log
for select
to authenticated
using (
  exists (
    select 1
    from Administrator
    where Administrator.auth_user_id = auth.uid()
      or lower(Administrator.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create or replace function public.get_visible_profiles_for_user()
returns table (
  account_type text,
  account_id uuid,
  first_name text,
  last_name text,
  school text,
  graduation_year int,
  certification text,
  years_experience int,
  email text,
  phone text,
  can_view_history boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_uid uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  viewer_is_admin boolean := false;
begin
  if viewer_uid is null then
    return;
  end if;

  select exists (
    select 1
    from Administrator a
    where a.auth_user_id = viewer_uid
      or lower(a.email) = viewer_email
  ) into viewer_is_admin;

  if viewer_is_admin then
    return query
      select 'student'::text, s.student_id, s.first_name, s.last_name, s.school, s.graduation_year, null::text, null::int, s.email, s.phone, true
      from Students s
      union all
      select 'judge'::text, j.judge_id, j.first_name, j.last_name, j.school, null::int, j.certification, null::int, j.email, j.phone, true
      from Judges j
      union all
      select 'coach'::text, c.coach_id, c.first_name, c.last_name, c.school, null::int, null::text, c.years_experience, c.email, c.phone, true
      from Coaches c;
    return;
  end if;

  return query
  with active_debates as (
    select d.debate_id
    from Debate d
    where lower(coalesce(d.status, 'scheduled')) not in ('completed', 'finished')
      and coalesce(d.debate_date, current_date) >= current_date
  ),
  viewer_student as (
    select s.student_id
    from Students s
    where s.auth_user_id = viewer_uid
       or lower(s.email) = viewer_email
  ),
  viewer_judge as (
    select j.judge_id
    from Judges j
    where j.auth_user_id = viewer_uid
       or lower(j.email) = viewer_email
  ),
  viewer_coach as (
    select c.coach_id
    from Coaches c
    where c.auth_user_id = viewer_uid
       or lower(c.email) = viewer_email
  ),
  viewer_debates as (
    select sp.debate_id
    from S_Participation sp
    join viewer_student vs on vs.student_id = sp.student_id
    join active_debates ad on ad.debate_id = sp.debate_id
    union
    select jp.debate_id
    from J_Participation jp
    join viewer_judge vj on vj.judge_id = jp.judge_id
    join active_debates ad on ad.debate_id = jp.debate_id
    union
    select cp.debate_id
    from C_Participation cp
    join viewer_coach vc on vc.coach_id = cp.coach_id
    join active_debates ad on ad.debate_id = cp.debate_id
  ),
  shared_students as (
    select distinct s.student_id, s.first_name, s.last_name, s.school, s.graduation_year
    from S_Participation sp
    join viewer_debates vd on vd.debate_id = sp.debate_id
    join Students s on s.student_id = sp.student_id
  ),
  shared_judges as (
    select distinct j.judge_id, j.first_name, j.last_name, j.school, j.certification
    from J_Participation jp
    join viewer_debates vd on vd.debate_id = jp.debate_id
    join Judges j on j.judge_id = jp.judge_id
  ),
  shared_coaches as (
    select distinct c.coach_id, c.first_name, c.last_name, c.school, c.years_experience
    from C_Participation cp
    join viewer_debates vd on vd.debate_id = cp.debate_id
    join Coaches c on c.coach_id = cp.coach_id
  )
  select 'student'::text, ss.student_id, ss.first_name, ss.last_name, ss.school, ss.graduation_year, null::text, null::int, null::text, null::text, false
  from shared_students ss
  union all
  select 'judge'::text, sj.judge_id, sj.first_name, sj.last_name, sj.school, null::int, sj.certification, null::int, null::text, null::text, false
  from shared_judges sj
  union all
  select 'coach'::text, sc.coach_id, sc.first_name, sc.last_name, sc.school, null::int, null::text, sc.years_experience, null::text, null::text, false
  from shared_coaches sc;
end;
$$;

drop function if exists public.get_user_debate_history(text, uuid);
drop function if exists public.get_judge_bias_stats(uuid);

create or replace function public.get_user_debate_history(target_account_type text, target_account_id uuid)
returns table (
  debate_id uuid,
  debate_date date,
  debate_status text,
  tournament_name text,
  round_name text,
  debate_type text,
  room text,
  topic text,
  role_context text,
  ruling_consistency_score numeric,
  ruling_consistency_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_uid uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  viewer_is_admin boolean := false;
  viewer_owns_account boolean := false;
  normalized_type text := lower(coalesce(target_account_type, ''));
begin
  if viewer_uid is null then
    return;
  end if;

  select exists (
    select 1
    from Administrator a
    where a.auth_user_id = viewer_uid
      or lower(a.email) = viewer_email
  ) into viewer_is_admin;

  if not viewer_is_admin then
    if normalized_type = 'student' then
      select exists (
        select 1 from Students s
        where s.student_id = target_account_id
          and (s.auth_user_id = viewer_uid or lower(s.email) = viewer_email)
      ) into viewer_owns_account;
    elsif normalized_type = 'judge' then
      select exists (
        select 1 from Judges j
        where j.judge_id = target_account_id
          and (j.auth_user_id = viewer_uid or lower(j.email) = viewer_email)
      ) into viewer_owns_account;
    elsif normalized_type = 'coach' then
      select exists (
        select 1 from Coaches c
        where c.coach_id = target_account_id
          and (c.auth_user_id = viewer_uid or lower(c.email) = viewer_email)
      ) into viewer_owns_account;
    end if;

    if not viewer_owns_account then
      raise exception 'Access denied.' using errcode = '42501';
    end if;
  end if;

  if normalized_type = 'student' then
    return query
    select
      d.debate_id,
      d.debate_date,
      d.status,
      t.name,
      tr.round_name,
      tr.debate_type,
      coalesce(d.room, tr.room),
      d.topic,
      format('Team %s • %s', sp.team_number, coalesce(sp.debate_stance, 'TBD')),
      null::numeric,
      null::text
    from S_Participation sp
    join Debate d on d.debate_id = sp.debate_id
    left join Tournament t on t.tournament_id = d.tournament_id
    left join Tournament_Round tr on tr.tournament_round_id = d.tournament_round_id
    where sp.student_id = target_account_id
    order by d.debate_date desc, d.debate_time desc nulls last;
  elsif normalized_type = 'judge' then
    return query
    select
      d.debate_id,
      d.debate_date,
      d.status,
      t.name,
      tr.round_name,
      tr.debate_type,
      coalesce(d.room, tr.room),
      d.topic,
      coalesce(jp.ruling, 'No ruling submitted'),
      round(coalesce(consistency.consistency_score, 0.0), 3) as ruling_consistency_score,
      case
        when consistency.consistency_score is null then 'No consistency data'
        when consistency.consistency_score > 0.15 then 'Liberal-leaning ruling'
        when consistency.consistency_score < -0.15 then 'Conservative-leaning ruling'
        else 'Moderate ruling'
      end as ruling_consistency_label
    from J_Participation jp
    join Debate d on d.debate_id = jp.debate_id
    left join Tournament t on t.tournament_id = d.tournament_id
    left join Tournament_Round tr on tr.tournament_round_id = d.tournament_round_id
    left join lateral (
      select avg(case lower(sp.worldview)
                  when 'conservative' then -1
                  when 'liberal' then 1
                  else 0
                end)::numeric as consistency_score
      from S_Participation sp
      where sp.debate_id = d.debate_id
        and (
          (lower(sp.debate_stance) = 'affirmative' and lower(coalesce(jp.ruling, '')) like '%affirmative%')
          or (lower(sp.debate_stance) = 'negative' and lower(coalesce(jp.ruling, '')) like '%negative%')
        )
    ) consistency on true
    where jp.judge_id = target_account_id
    order by d.debate_date desc, d.debate_time desc nulls last;
  elsif normalized_type = 'coach' then
    return query
    select
      d.debate_id,
      d.debate_date,
      d.status,
      t.name,
      tr.round_name,
      tr.debate_type,
      coalesce(d.room, tr.room),
      d.topic,
      coalesce(cp.notes, format('Mentored team %s', cp.mentored_team_number)),
      null::numeric,
      null::text
    from C_Participation cp
    join Debate d on d.debate_id = cp.debate_id
    left join Tournament t on t.tournament_id = d.tournament_id
    left join Tournament_Round tr on tr.tournament_round_id = d.tournament_round_id
    where cp.coach_id = target_account_id
    order by d.debate_date desc, d.debate_time desc nulls last;
  else
    raise exception 'Unsupported account type: %', target_account_type using errcode = '22023';
  end if;
end;
$$;

grant execute on function public.get_visible_profiles_for_user() to authenticated;
grant execute on function public.get_user_debate_history(text, uuid) to authenticated;

create or replace function public.create_policy_debate_setup(
  p_tournament_id uuid,
  p_tournament_round_id uuid,
  p_debate_date date,
  p_debate_time time,
  p_topic text,
  p_room text,
  p_team_a_name text,
  p_team_b_name text,
  p_student_assignments jsonb,
  p_judge_assignments jsonb,
  p_coach_assignments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_uid uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  viewer_is_admin boolean := false;
  created_debate_id uuid;
  student_item jsonb;
  judge_item jsonb;
  coach_item jsonb;
begin
  if viewer_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from Administrator a
    where a.auth_user_id = viewer_uid
      or lower(a.email) = viewer_email
  ) into viewer_is_admin;

  if not viewer_is_admin then
    raise exception 'Only administrators can set up policy debates.' using errcode = '42501';
  end if;

  if p_debate_date is null then
    raise exception 'Debate date is required.' using errcode = '22023';
  end if;

  if coalesce(jsonb_array_length(coalesce(p_student_assignments, '[]'::jsonb)), 0) < 2 then
    raise exception 'At least two student assignments are required.' using errcode = '22023';
  end if;

  if p_topic is not null and length(trim(p_topic)) > 500 then
    raise exception 'Topic is too long.' using errcode = '22023';
  end if;

  if p_room is not null and length(trim(p_room)) > 50 then
    raise exception 'Room is too long.' using errcode = '22023';
  end if;

  if p_team_a_name is not null and length(trim(p_team_a_name)) > 120 then
    raise exception 'Team A name is too long.' using errcode = '22023';
  end if;

  if p_team_b_name is not null and length(trim(p_team_b_name)) > 120 then
    raise exception 'Team B name is too long.' using errcode = '22023';
  end if;

  insert into Debate (
    tournament_id,
    tournament_round_id,
    debate_date,
    debate_time,
    topic,
    room,
    status,
    team_a_name,
    team_b_name
  ) values (
    p_tournament_id,
    p_tournament_round_id,
    p_debate_date,
    p_debate_time,
    p_topic,
    p_room,
    'scheduled',
    nullif(trim(coalesce(p_team_a_name, '')), ''),
    nullif(trim(coalesce(p_team_b_name, '')), '')
  )
  returning debate_id into created_debate_id;

  for student_item in
    select value from jsonb_array_elements(coalesce(p_student_assignments, '[]'::jsonb))
  loop
    if coalesce(student_item ->> 'student_id', '') = '' then
      continue;
    end if;

    insert into S_Participation (
      debate_id,
      student_id,
      team_number,
      debate_stance,
      worldview,
      speaking_order,
      is_captain
    ) values (
      created_debate_id,
      (student_item ->> 'student_id')::uuid,
      greatest(coalesce((student_item ->> 'team_number')::int, 1), 1),
      case
        when lower(coalesce(student_item ->> 'debate_stance', '')) in ('affirmative', 'negative')
          then initcap(lower(student_item ->> 'debate_stance'))
        else 'Affirmative'
      end,
      case
        when lower(coalesce(student_item ->> 'worldview', '')) in ('conservative', 'liberal', 'moderate')
          then initcap(lower(student_item ->> 'worldview'))
        else 'Moderate'
      end,
      nullif(student_item ->> 'speaking_order', '')::int,
      coalesce((student_item ->> 'is_captain')::boolean, false)
    )
    on conflict (debate_id, student_id) do update
    set team_number = excluded.team_number,
        debate_stance = excluded.debate_stance,
        worldview = excluded.worldview,
        speaking_order = excluded.speaking_order,
        is_captain = excluded.is_captain,
        updated_at = now();
  end loop;

  for judge_item in
    select value from jsonb_array_elements(coalesce(p_judge_assignments, '[]'::jsonb))
  loop
    if coalesce(judge_item ->> 'judge_id', '') = '' then
      continue;
    end if;

    insert into J_Participation (
      debate_id,
      judge_id,
      panel_number
    ) values (
      created_debate_id,
      (judge_item ->> 'judge_id')::uuid,
      greatest(coalesce((judge_item ->> 'panel_number')::int, 1), 1)
    )
    on conflict (debate_id, judge_id) do update
    set panel_number = excluded.panel_number,
        updated_at = now();
  end loop;

  for coach_item in
    select value from jsonb_array_elements(coalesce(p_coach_assignments, '[]'::jsonb))
  loop
    if coalesce(coach_item ->> 'coach_id', '') = '' then
      continue;
    end if;

    insert into C_Participation (
      debate_id,
      coach_id,
      mentored_team_number,
      notes
    ) values (
      created_debate_id,
      (coach_item ->> 'coach_id')::uuid,
      greatest(coalesce((coach_item ->> 'mentored_team_number')::int, 1), 1),
      nullif(left(trim(coalesce(coach_item ->> 'notes', '')), 500), '')
    )
    on conflict (debate_id, coach_id, mentored_team_number) do update
    set notes = excluded.notes,
        updated_at = now();
  end loop;

  return created_debate_id;
end;
$$;

grant execute on function public.create_policy_debate_setup(uuid, uuid, date, time, text, text, text, text, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.get_judge_bias_stats(target_judge_id uuid)
returns table (
  decided_count int,
  affirmative_wins int,
  negative_wins int,
  affirmative_pct numeric,
  negative_pct numeric,
  consistency_avg numeric,
  consistency_sd numeric,
  consistency_label text,
  lean_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_uid uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  viewer_is_admin boolean := false;
  aff_count int := 0;
  neg_count int := 0;
  total int := 0;
  aff_pct numeric := 50;
begin
  if viewer_uid is null then
    return;
  end if;

  select exists (
    select 1 from Administrator a
    where a.auth_user_id = viewer_uid or lower(a.email) = viewer_email
  ) into viewer_is_admin;

  if not viewer_is_admin then
    raise exception 'Only administrators can view judge bias statistics.' using errcode = '42501';
  end if;

  with last_30 as (
    select jp.debate_id,
           jp.ruling,
           lower(trim(jp.ruling)) as ruling_text
    from J_Participation jp
    join Debate d on d.debate_id = jp.debate_id
    where jp.judge_id = target_judge_id
      and jp.ruling is not null
      and trim(jp.ruling) <> ''
      and lower(trim(jp.ruling)) <> 'no ruling submitted'
    order by d.debate_date desc nulls last, d.debate_time desc nulls last
    limit 30
  )
  select
    count(*)::int,
    count(*) filter (where ruling_text like '%affirmative%')::int,
    count(*) filter (where ruling_text like '%negative%')::int
  into total, aff_count, neg_count
  from last_30;

  if total = 0 then
    return query select 0::int, 0::int, 0::int, 50.0::numeric, 50.0::numeric, 0.0::numeric, 0.0::numeric, 'No consistency data'::text, 'No rulings on record'::text;
    return;
  end if;

  aff_pct := round((aff_count::numeric / total::numeric) * 100, 1);

  return query
  with last_30 as (
    select jp.debate_id,
           jp.ruling,
           lower(trim(jp.ruling)) as ruling_text
    from J_Participation jp
    join Debate d on d.debate_id = jp.debate_id
    where jp.judge_id = target_judge_id
      and jp.ruling is not null
      and trim(jp.ruling) <> ''
      and lower(trim(jp.ruling)) <> 'no ruling submitted'
    order by d.debate_date desc nulls last, d.debate_time desc nulls last
    limit 30
  ),
  worldview_stats as (
    select
      avg(worldview_score)::numeric as worldview_avg,
      stddev_pop(worldview_score)::numeric as worldview_sd,
      count(*) as world_count
    from (
      select l.debate_id,
             avg(case lower(sp.worldview)
                   when 'conservative' then -1
                   when 'liberal' then 1
                   else 0
                 end)::numeric as worldview_score
      from last_30 l
      join S_Participation sp on sp.debate_id = l.debate_id
      where (
        lower(sp.debate_stance) = 'affirmative' and l.ruling_text like '%affirmative%'
      ) or (
        lower(sp.debate_stance) = 'negative' and l.ruling_text like '%negative%'
      )
      group by l.debate_id
    ) derived
  ),
  -- Calculate dynamic thresholds based on all judges' recent performance
  judge_population_stats as (
    select
      percentile_cont(0.33) within group (order by judge_consistency_sd) as consistency_sd_p33,
      percentile_cont(0.67) within group (order by judge_consistency_sd) as consistency_sd_p67,
      percentile_cont(0.2) within group (order by judge_aff_pct) as aff_pct_p20,
      percentile_cont(0.35) within group (order by judge_aff_pct) as aff_pct_p35,
      percentile_cont(0.45) within group (order by judge_aff_pct) as aff_pct_p45,
      percentile_cont(0.55) within group (order by judge_aff_pct) as aff_pct_p55,
      percentile_cont(0.65) within group (order by judge_aff_pct) as aff_pct_p65,
      percentile_cont(0.8) within group (order by judge_aff_pct) as aff_pct_p80
    from (
      select
        j.judge_id,
        coalesce(stddev_pop(case lower(sp.worldview)
                             when 'conservative' then -1
                             when 'liberal' then 1
                             else 0
                           end), 0) as judge_consistency_sd,
        (count(*) filter (where lower(jp.ruling) like '%affirmative%')::numeric /
         nullif(count(*), 0)::numeric) * 100 as judge_aff_pct
      from Judges j
      left join J_Participation jp on jp.judge_id = j.judge_id
      left join Debate d on d.debate_id = jp.debate_id
      left join S_Participation sp on sp.debate_id = jp.debate_id
      where jp.ruling is not null
        and trim(jp.ruling) <> ''
        and lower(trim(jp.ruling)) <> 'no ruling submitted'
        and d.debate_date >= (current_date - interval '6 months')  -- Last 6 months of data
      group by j.judge_id
      having count(*) >= 5  -- Judges with at least 5 rulings
    ) judge_stats
  )
  select
    total,
    aff_count,
    neg_count,
    aff_pct,
    round(100 - aff_pct, 1)::numeric,
    coalesce(round(ws.consistency_avg, 3), 0.0),
    coalesce(round(ws.consistency_sd, 3), 0.0),
    case
      when ws.world_count = 0 then 'No consistency data'
      when coalesce(round(ws.consistency_sd, 3), 0.0) <= coalesce(pop.consistency_sd_p33, 0.25) then 'High consistency'
      when coalesce(round(ws.consistency_sd, 3), 0.0) <= coalesce(pop.consistency_sd_p67, 0.6) then 'Moderate consistency'
      else 'Mixed consistency'
    end,
    case
      when aff_pct >= coalesce(pop.aff_pct_p80, 80) then 'Strong affirmative lean'
      when aff_pct >= coalesce(pop.aff_pct_p65, 65) then 'Moderate affirmative lean'
      when aff_pct >= coalesce(pop.aff_pct_p55, 55) then 'Slight affirmative lean'
      when aff_pct <= coalesce(pop.aff_pct_p20, 20) then 'Strong negative lean'
      when aff_pct <= coalesce(pop.aff_pct_p35, 35) then 'Moderate negative lean'
      when aff_pct <= coalesce(pop.aff_pct_p45, 45) then 'Slight negative lean'
      else 'Neutral / Balanced'
    end
  from worldview_stats ws
  cross join judge_population_stats pop;
end;
$$;

grant execute on function public.get_judge_bias_stats(uuid) to authenticated;