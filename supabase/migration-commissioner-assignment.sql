-- Commissioner officiating: a commissioner is assigned to each match they
-- officiate. They can hold many matches across the season, but the app
-- keeps them to one not-yet-ended match at a time (same rule as officials).
alter table public.matches
  add column if not exists commissioner_id uuid
  references public.profiles (id)
  on delete set null;
