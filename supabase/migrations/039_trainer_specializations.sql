-- ---------------------------------------------------------------------------
-- 039_trainer_specializations.sql
-- Keeps the controlled specialization list in step with the program catalog:
--   * adds Bookkeeping (the new program)
--   * renumbers the catch-all entries
--   * backfills each trainer's specialization from their program assignments
--     (trainer_programs) so trainer profiles no longer show a blank value
--
-- Idempotent: the insert upserts by slug and the updates only touch rows that
-- still differ.
-- ---------------------------------------------------------------------------

insert into public.specializations (name, slug, sort_order) values
  ('Bookkeeping', 'bookkeeping', 6)
on conflict (slug) do update
  set name = excluded.name, sort_order = excluded.sort_order;

update public.specializations set sort_order = 7  where slug = 'multiple-programs' and sort_order <> 7;
update public.specializations set sort_order = 99 where slug = 'other'           and sort_order <> 99;

-- Single-program trainers take that program's specialization...
with assigned as (
  select tp.trainer_id,
         count(distinct tp.program_id) as programs,
         min(tp.program_id) as program_id
  from public.trainer_programs tp
  group by tp.trainer_id
)
update public.profiles p
set specialization = s.name,
    specialization_id = s.id
from assigned a
join public.specializations s
  on s.slug = case a.program_id
                when 'housekeeping'      then 'housekeeping'
                when 'barista'           then 'barista'
                when 'hilot'             then 'hilot-massage'
                when 'event-management'  then 'event-management'
                when 'virtual-assistant' then 'virtual-assistant'
                when 'bookkeeping'       then 'bookkeeping'
                else 'other'
              end
where p.id = a.trainer_id
  and a.programs = 1
  and (p.specialization_id is distinct from s.id or p.specialization is distinct from s.name);

-- ...trainers handling more than one program are marked as such.
update public.profiles p
set specialization = 'Multiple Programs',
    specialization_id = (select id from public.specializations where slug = 'multiple-programs')
where p.role = 'trainer'
  and (select count(distinct tp.program_id) from public.trainer_programs tp where tp.trainer_id = p.id) > 1
  and p.specialization is distinct from 'Multiple Programs';
