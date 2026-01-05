CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: get_email_for_username(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_email_for_username(p_username text) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select email
  from public.profiles
  where username = p_username
  limit 1;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: wipe_all_salary_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wipe_all_salary_data() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete only current user's earnings and deductions
  DELETE FROM public.earnings
  WHERE salary_record_id IN (
    SELECT id FROM public.salary_records WHERE user_id = current_user_id
  );

  DELETE FROM public.deductions
  WHERE salary_record_id IN (
    SELECT id FROM public.salary_records WHERE user_id = current_user_id
  );

  -- Delete template earnings and deductions for current user's templates
  DELETE FROM public.template_earnings
  WHERE template_id IN (
    SELECT id FROM public.organization_templates WHERE user_id = current_user_id
  );

  DELETE FROM public.template_deductions
  WHERE template_id IN (
    SELECT id FROM public.organization_templates WHERE user_id = current_user_id
  );

  -- Delete current user's salary records and templates
  DELETE FROM public.salary_records WHERE user_id = current_user_id;
  DELETE FROM public.organization_templates WHERE user_id = current_user_id;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: budget_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    net_income numeric DEFAULT 0 NOT NULL,
    total_allocated numeric DEFAULT 0 NOT NULL,
    remaining numeric DEFAULT 0 NOT NULL,
    categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salary_record_id uuid NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salary_record_id uuid NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization text NOT NULL,
    employee_id text,
    joining_date date NOT NULL,
    leaving_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    job_title text,
    location text,
    bio text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    email text
);


--
-- Name: salary_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    payslip_url text,
    gross_salary numeric(12,2) DEFAULT 0 NOT NULL,
    net_salary numeric(12,2) DEFAULT 0 NOT NULL,
    total_earnings numeric(12,2) DEFAULT 0 NOT NULL,
    total_deductions numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization text,
    CONSTRAINT salary_records_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT salary_records_year_check CHECK (((year >= 2000) AND (year <= 2100)))
);


--
-- Name: template_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: template_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_account_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_account_locks (
    user_id uuid NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_passcodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_passcodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    passcode_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: budget_history budget_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_history
    ADD CONSTRAINT budget_history_pkey PRIMARY KEY (id);


--
-- Name: budget_history budget_history_user_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_history
    ADD CONSTRAINT budget_history_user_id_month_year_key UNIQUE (user_id, month, year);


--
-- Name: deductions deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deductions
    ADD CONSTRAINT deductions_pkey PRIMARY KEY (id);


--
-- Name: earnings earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings
    ADD CONSTRAINT earnings_pkey PRIMARY KEY (id);


--
-- Name: employment_history employment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_history
    ADD CONSTRAINT employment_history_pkey PRIMARY KEY (id);


--
-- Name: organization_templates organization_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_templates
    ADD CONSTRAINT organization_templates_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: salary_records salary_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_records
    ADD CONSTRAINT salary_records_pkey PRIMARY KEY (id);


--
-- Name: salary_records salary_records_user_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_records
    ADD CONSTRAINT salary_records_user_id_month_year_key UNIQUE (user_id, month, year);


--
-- Name: template_deductions template_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_deductions
    ADD CONSTRAINT template_deductions_pkey PRIMARY KEY (id);


--
-- Name: template_earnings template_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_earnings
    ADD CONSTRAINT template_earnings_pkey PRIMARY KEY (id);


--
-- Name: user_account_locks user_account_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_account_locks
    ADD CONSTRAINT user_account_locks_pkey PRIMARY KEY (user_id);


--
-- Name: user_passcodes user_passcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_passcodes
    ADD CONSTRAINT user_passcodes_pkey PRIMARY KEY (id);


--
-- Name: user_passcodes user_passcodes_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_passcodes
    ADD CONSTRAINT user_passcodes_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);


--
-- Name: profiles profiles_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: budget_history update_budget_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_budget_history_updated_at BEFORE UPDATE ON public.budget_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_templates update_organization_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organization_templates_updated_at BEFORE UPDATE ON public.organization_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: salary_records update_salary_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salary_records_updated_at BEFORE UPDATE ON public.salary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_passcodes update_user_passcodes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_passcodes_updated_at BEFORE UPDATE ON public.user_passcodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deductions deductions_salary_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deductions
    ADD CONSTRAINT deductions_salary_record_id_fkey FOREIGN KEY (salary_record_id) REFERENCES public.salary_records(id) ON DELETE CASCADE;


--
-- Name: earnings earnings_salary_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings
    ADD CONSTRAINT earnings_salary_record_id_fkey FOREIGN KEY (salary_record_id) REFERENCES public.salary_records(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: template_deductions template_deductions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_deductions
    ADD CONSTRAINT template_deductions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.organization_templates(id) ON DELETE CASCADE;


--
-- Name: template_earnings template_earnings_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_earnings
    ADD CONSTRAINT template_earnings_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.organization_templates(id) ON DELETE CASCADE;


--
-- Name: user_passcodes user_passcodes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_passcodes
    ADD CONSTRAINT user_passcodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_account_locks Admins can manage account locks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage account locks" ON public.user_account_locks USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles First user can become admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "First user can become admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((NOT (EXISTS ( SELECT 1
   FROM public.user_roles user_roles_1
  WHERE (user_roles_1.role = 'admin'::public.app_role)))));


--
-- Name: budget_history Users can delete own budget history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own budget history" ON public.budget_history FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: deductions Users can delete own deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own deductions" ON public.deductions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = deductions.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: earnings Users can delete own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own earnings" ON public.earnings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = earnings.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: employment_history Users can delete own employment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own employment history" ON public.employment_history FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_passcodes Users can delete own passcode; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own passcode" ON public.user_passcodes FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: salary_records Users can delete own salary records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own salary records" ON public.salary_records FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: template_deductions Users can delete own template deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own template deductions" ON public.template_deductions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_deductions.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: template_earnings Users can delete own template earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own template earnings" ON public.template_earnings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_earnings.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: organization_templates Users can delete their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own templates" ON public.organization_templates FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: budget_history Users can insert own budget history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own budget history" ON public.budget_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: deductions Users can insert own deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own deductions" ON public.deductions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = deductions.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: earnings Users can insert own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own earnings" ON public.earnings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = earnings.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: employment_history Users can insert own employment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own employment history" ON public.employment_history FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_passcodes Users can insert own passcode; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own passcode" ON public.user_passcodes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: salary_records Users can insert own salary records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own salary records" ON public.salary_records FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: template_deductions Users can insert own template deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own template deductions" ON public.template_deductions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_deductions.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: template_earnings Users can insert own template earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own template earnings" ON public.template_earnings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_earnings.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: organization_templates Users can insert their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own templates" ON public.organization_templates FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: budget_history Users can update own budget history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own budget history" ON public.budget_history FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: deductions Users can update own deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own deductions" ON public.deductions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = deductions.salary_record_id) AND (salary_records.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = deductions.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: earnings Users can update own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own earnings" ON public.earnings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = earnings.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: employment_history Users can update own employment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own employment history" ON public.employment_history FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_passcodes Users can update own passcode; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own passcode" ON public.user_passcodes FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: salary_records Users can update own salary records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own salary records" ON public.salary_records FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: template_deductions Users can update own template deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own template deductions" ON public.template_deductions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_deductions.template_id) AND (organization_templates.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_deductions.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: template_earnings Users can update own template earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own template earnings" ON public.template_earnings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_earnings.template_id) AND (organization_templates.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_earnings.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: organization_templates Users can update their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own templates" ON public.organization_templates FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: budget_history Users can view own budget history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own budget history" ON public.budget_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: deductions Users can view own deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own deductions" ON public.deductions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = deductions.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: earnings Users can view own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own earnings" ON public.earnings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.salary_records
  WHERE ((salary_records.id = earnings.salary_record_id) AND (salary_records.user_id = auth.uid())))));


--
-- Name: employment_history Users can view own employment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own employment history" ON public.employment_history FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_passcodes Users can view own passcode; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own passcode" ON public.user_passcodes FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: salary_records Users can view own salary records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own salary records" ON public.salary_records FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: template_deductions Users can view own template deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own template deductions" ON public.template_deductions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_deductions.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: template_earnings Users can view own template earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own template earnings" ON public.template_earnings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_templates
  WHERE ((organization_templates.id = template_earnings.template_id) AND (organization_templates.user_id = auth.uid())))));


--
-- Name: organization_templates Users can view their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own templates" ON public.organization_templates FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: budget_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budget_history ENABLE ROW LEVEL SECURITY;

--
-- Name: deductions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;

--
-- Name: earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: employment_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employment_history ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

--
-- Name: template_deductions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_deductions ENABLE ROW LEVEL SECURITY;

--
-- Name: template_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_account_locks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_account_locks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_passcodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_passcodes ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;