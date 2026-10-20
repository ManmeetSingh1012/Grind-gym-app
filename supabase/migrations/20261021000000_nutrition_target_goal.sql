-- Remember which goal + pace produced calculated targets, and how they were derived,
-- so the Food screen can show the working and recalculate when a new scan arrives.
alter table public.nutrition_targets
  add column goal_type text check (goal_type in ('lose_fat', 'build_muscle', 'recomp', 'strength', 'endurance', 'maintain')),
  add column pace text check (pace in ('slow', 'moderate', 'fast')),
  add column calculation jsonb;
