
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'department', 'school');
CREATE TYPE public.appointment_status AS ENUM ('active', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'school',
  school_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  head_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create timeslots table
CREATE TABLE public.timeslots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timeslots ENABLE ROW LEVEL SECURITY;

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeslot_id UUID NOT NULL REFERENCES public.timeslots(id),
  requester_id UUID NOT NULL REFERENCES public.profiles(id),
  description TEXT NOT NULL DEFAULT '',
  status public.appointment_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  )
$$;

-- Security definer to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Security definer to get department head's department id
CREATE OR REPLACE FUNCTION public.get_head_department_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.departments WHERE head_id = _user_id LIMIT 1
$$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'school')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: when appointment inserted, mark timeslot unavailable
CREATE OR REPLACE FUNCTION public.handle_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.timeslots SET is_available = false WHERE id = NEW.timeslot_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_insert();

-- Trigger: when appointment cancelled, revert timeslot to available
CREATE OR REPLACE FUNCTION public.handle_appointment_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'cancelled' THEN
    UPDATE public.timeslots SET is_available = true WHERE id = NEW.timeslot_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_cancelled
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_cancel();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for departments
CREATE POLICY "All authenticated can view departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for timeslots
CREATE POLICY "All authenticated can view timeslots" ON public.timeslots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Department heads can manage own timeslots" ON public.timeslots
  FOR INSERT TO authenticated
  WITH CHECK (department_id = public.get_head_department_id(auth.uid()));

CREATE POLICY "Department heads can update own timeslots" ON public.timeslots
  FOR UPDATE TO authenticated
  USING (department_id = public.get_head_department_id(auth.uid()));

CREATE POLICY "Department heads can delete own timeslots" ON public.timeslots
  FOR DELETE TO authenticated
  USING (department_id = public.get_head_department_id(auth.uid()));

CREATE POLICY "Admins can manage all timeslots" ON public.timeslots
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for appointments
CREATE POLICY "All authenticated can view appointments" ON public.appointments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "School users can create appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND public.has_role(auth.uid(), 'school'));

CREATE POLICY "Users can cancel own appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid());

CREATE POLICY "Admins can manage all appointments" ON public.appointments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
