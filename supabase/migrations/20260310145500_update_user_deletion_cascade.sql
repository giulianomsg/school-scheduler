-- Migration to allow deleting users from auth.users (and public.profiles) without foreign key constraint errors

-- Update departments.head_id to SET NULL on delete
DO $$ 
DECLARE
    constraint_name_var text;
BEGIN
    SELECT constraint_name INTO constraint_name_var
    FROM information_schema.key_column_usage
    WHERE table_schema = 'public' 
      AND table_name = 'departments' 
      AND column_name = 'head_id'
      AND position_in_unique_constraint IS NOT NULL;

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.departments DROP CONSTRAINT ' || constraint_name_var;
    END IF;
END $$;

ALTER TABLE public.departments 
  ADD CONSTRAINT departments_head_id_fkey 
  FOREIGN KEY (head_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- Update appointments.requester_id to CASCADE on delete
DO $$ 
DECLARE
    constraint_name_var text;
BEGIN
    SELECT constraint_name INTO constraint_name_var
    FROM information_schema.key_column_usage
    WHERE table_schema = 'public' 
      AND table_name = 'appointments' 
      AND column_name = 'requester_id'
      AND position_in_unique_constraint IS NOT NULL;

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.appointments DROP CONSTRAINT ' || constraint_name_var;
    END IF;
END $$;

ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_requester_id_fkey 
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- Update appointments.requested_attendant_id to SET NULL on delete
DO $$ 
DECLARE
    constraint_name_var text;
BEGIN
    SELECT constraint_name INTO constraint_name_var
    FROM information_schema.key_column_usage
    WHERE table_schema = 'public' 
      AND table_name = 'appointments' 
      AND column_name = 'requested_attendant_id'
      AND position_in_unique_constraint IS NOT NULL;

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.appointments DROP CONSTRAINT ' || constraint_name_var;
    END IF;
END $$;

ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_requested_attendant_id_fkey 
  FOREIGN KEY (requested_attendant_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
