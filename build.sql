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

create table if not exists Students (
  student_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  graduation_year int,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists Judges (
  judge_id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  certification text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists Coaches (
  coach_id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  phone text,
  years_experience int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists Administrator (
  admin_id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  school text,
  email text not null unique,
  role_title text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  speaking_order int,
  is_captain boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint s_participation_team_number_check check (team_number > 0),
  constraint s_participation_speaking_order_check check (speaking_order is null or speaking_order > 0),
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

drop trigger if exists trg_students_updated_at on Students;
create trigger trg_students_updated_at
before update on Students
for each row execute function set_updated_at();

drop trigger if exists trg_judges_updated_at on Judges;
create trigger trg_judges_updated_at
before update on Judges
for each row execute function set_updated_at();

drop trigger if exists trg_coaches_updated_at on Coaches;
create trigger trg_coaches_updated_at
before update on Coaches
for each row execute function set_updated_at();

drop trigger if exists trg_administrator_updated_at on Administrator;
create trigger trg_administrator_updated_at
before update on Administrator
for each row execute function set_updated_at();

drop trigger if exists trg_tournament_updated_at on Tournament;
create trigger trg_tournament_updated_at
before update on Tournament
for each row execute function set_updated_at();

drop trigger if exists trg_tournament_round_updated_at on Tournament_Round;
create trigger trg_tournament_round_updated_at
before update on Tournament_Round
for each row execute function set_updated_at();

drop trigger if exists trg_debate_updated_at on Debate;
create trigger trg_debate_updated_at
before update on Debate
for each row execute function set_updated_at();

drop trigger if exists trg_s_participation_updated_at on S_Participation;
create trigger trg_s_participation_updated_at
before update on S_Participation
for each row execute function set_updated_at();

drop trigger if exists trg_j_participation_updated_at on J_Participation;
create trigger trg_j_participation_updated_at
before update on J_Participation
for each row execute function set_updated_at();

drop trigger if exists trg_c_participation_updated_at on C_Participation;
create trigger trg_c_participation_updated_at
before update on C_Participation
for each row execute function set_updated_at();

drop trigger if exists trg_images_updated_at on Images;
create trigger trg_images_updated_at
before update on Images
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Sample seed data
-- ------------------------------------------------------------

insert into Administrator (
  admin_id, first_name, last_name, school, email, role_title, phone
) values
  ('30000000-0000-0000-0000-000000000001', 'Avery', 'Patel', 'Eastview High School', 'avery.patel@eastview.edu', 'Tournament Director', '555-0101'),
  ('30000000-0000-0000-0000-000000000002', 'Morgan', 'Reed', 'Lakewood Academy', 'morgan.reed@lakewood.edu', 'Assistant Tournament Director', '555-0102')
on conflict (admin_id) do nothing;

insert into Students (
  student_id, first_name, last_name, school, email, graduation_year, phone
) values
  ('00000000-0000-0000-0000-000000000001', 'Taylor', 'Morgan', 'Eastview High School', 'taylor.morgan@eastview.edu', 2027, '555-1001'),
  ('00000000-0000-0000-0000-000000000002', 'Alex', 'Chen', 'Eastview High School', 'alex.chen@eastview.edu', 2027, '555-1002'),
  ('00000000-0000-0000-0000-000000000003', 'Jordan', 'Lee', 'Lakewood Academy', 'jordan.lee@lakewood.edu', 2028, '555-1003'),
  ('00000000-0000-0000-0000-000000000004', 'Casey', 'Nguyen', 'Eastview High School', 'casey.nguyen@eastview.edu', 2028, '555-1004'),
  ('00000000-0000-0000-0000-000000000005', 'Riley', 'Johnson', 'Northfield High School', 'riley.johnson@northfield.edu', 2027, '555-1005'),
  ('00000000-0000-0000-0000-000000000006', 'Sam', 'Gupta', 'Lakewood Academy', 'sam.gupta@lakewood.edu', 2029, '555-1006')
on conflict (student_id) do nothing;

insert into Judges (
  judge_id, first_name, last_name, school, email, certification, phone
) values
  ('10000000-0000-0000-0000-000000000001', 'Mia', 'Rodriguez', 'Independent', 'mia.rodriguez@judges.org', 'NSDA Gold', '555-2001'),
  ('10000000-0000-0000-0000-000000000002', 'Noah', 'Kim', 'Northfield High School', 'noah.kim@northfield.edu', 'NSDA Silver', '555-2002'),
  ('10000000-0000-0000-0000-000000000003', 'Olivia', 'Turner', 'Independent', 'olivia.turner@judges.org', 'NSDA Bronze', '555-2003')
on conflict (judge_id) do nothing;

insert into Coaches (
  coach_id, first_name, last_name, school, email, phone, years_experience
) values
  ('20000000-0000-0000-0000-000000000001', 'Renee', 'Davis', 'Eastview High School', 'renee.davis@eastview.edu', '555-3001', 9),
  ('20000000-0000-0000-0000-000000000002', 'Evan', 'Brooks', 'Lakewood Academy', 'evan.brooks@lakewood.edu', '555-3002', 6),
  ('20000000-0000-0000-0000-000000000003', 'Priya', 'Shah', 'Northfield High School', 'priya.shah@northfield.edu', '555-3003', 11)
on conflict (coach_id) do nothing;

insert into Tournament (
  tournament_id, name, host_school, location, start_date, end_date, status, created_by_admin_id
) values
  ('40000000-0000-0000-0000-000000000001', 'Spring Invitational 2026', 'Eastview High School', 'St. Paul, MN', '2026-04-12', '2026-04-13', 'scheduled', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'Metro Classic 2026', 'Lakewood Academy', 'Minneapolis, MN', '2026-05-03', '2026-05-04', 'scheduled', '30000000-0000-0000-0000-000000000002')
on conflict (tournament_id) do nothing;

insert into Tournament_Round (
  tournament_round_id, tournament_id, debate_type, round_number, round_name, scheduled_start, room
) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Public Forum', 1, 'Prelim 1', '2026-04-12 09:00:00+00', 'A101'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Public Forum', 2, 'Prelim 2', '2026-04-12 11:00:00+00', 'A103'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'Public Forum', 1, 'Prelim 1', '2026-05-03 09:30:00+00', 'B201'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Public Forum', 2, 'Prelim 2', '2026-05-03 12:00:00+00', 'B204')
on conflict (tournament_round_id) do nothing;

insert into Debate (
  debate_id, tournament_id, tournament_round_id, debate_date, debate_time, topic, room, status, team_a_name, team_b_name
) values
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-04-12', '09:00:00', 'Resolved: Public schools should adopt AI tutoring systems.', 'A101', 'completed', 'Eastview A', 'Lakewood A'),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '2026-04-12', '11:00:00', 'Resolved: Urban public transit should be fare-free.', 'A103', 'scheduled', 'Eastview A', 'Northfield A'),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-05-03', '09:30:00', 'Resolved: Social media platforms should be held liable for misinformation.', 'B201', 'completed', 'Eastview B', 'Northfield A'),
  ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004', '2026-05-03', '12:00:00', 'Resolved: College should be tuition-free at public universities.', 'B204', 'scheduled', 'Lakewood B', 'Eastview A')
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
  ('70000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 2, 'Negative', 2, false)
on conflict (s_participation_id) do nothing;

insert into J_Participation (
  j_participation_id, debate_id, judge_id, panel_number, ruling, score, feedback
) values
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'Team 1 (Affirmative) wins', 29.50, 'Strong weighing and clear summary speeches.'),
  ('80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1, 'Team 1 (Affirmative) wins', 28.75, 'Good evidence comparison; improve crossfire pacing.'),
  ('80000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1, null, null, null),
  ('80000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 2, 'Team 2 (Negative) wins', 28.25, 'Negative rebuttal turned on impact calculus.'),
  ('80000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 1, null, null, null)
on conflict (j_participation_id) do nothing;

insert into C_Participation (
  c_participation_id, debate_id, coach_id, mentored_team_number, notes
) values
  ('90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'Focus on second rebuttal collapse and impact framing.'),
  ('90000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 2, 'Prioritize defense extension in final focus.'),
  ('90000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1, 'Prep transport and evidence packets before round start.'),
  ('90000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 1, 'Emphasize frontlines in second summary.'),
  ('90000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 2, 'Rebuild link chain with clearer warrants.'),
  ('90000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 1, 'Prepare extra evidence blocks on cost burden.')
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

-- ------------------------------------------------------------
-- Supabase auth + RLS policies
-- ------------------------------------------------------------

alter table Students enable row level security;
alter table Judges enable row level security;
alter table Coaches enable row level security;
alter table Administrator enable row level security;
alter table Debate enable row level security;
alter table Tournament enable row level security;
alter table Tournament_Round enable row level security;
alter table S_Participation enable row level security;
alter table J_Participation enable row level security;
alter table C_Participation enable row level security;
alter table Images enable row level security;

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