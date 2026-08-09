-- =====================================================================
-- PHASE 2 COMPLETION MARKER
-- =====================================================================
update platform_phases
set status = 'live', completed_at = now()
where id = 2;
