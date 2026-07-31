-- Same gotcha as 20260729000003/20260729000006, hit again and caught live:
-- an RLS policy alone doesn't grant anything — the previous migration added
-- "users can delete own checks" but never granted the base DELETE
-- privilege, so both an anonymous request AND the actual owner's request
-- got "permission denied for table checks" (not even reaching the RLS
-- check). authenticated only, never anon — anon should never delete.

grant delete on public.checks to authenticated;
