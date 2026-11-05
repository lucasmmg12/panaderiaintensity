-- Life Intensity Database Schema & Seed Data
CREATE TABLE IF NOT EXISTS public.li_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  dni TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('alumno', 'profesor', 'admin')),
  specialty TEXT,
  level TEXT DEFAULT 'Intermedio',
  assigned_coach_id UUID REFERENCES public.li_users(id) ON DELETE SET NULL,
  plan_name TEXT,
  monthly_fee NUMERIC(12,2) DEFAULT 15000,
  payment_status TEXT NOT NULL DEFAULT 'al_dia' CHECK (payment_status IN ('al_dia', 'vencido', 'por_validar')),
  due_date DATE,
  avatar_url TEXT,
  classes_attended INT DEFAULT 0,
  classes_limit INT DEFAULT 12,
  weight_kg NUMERIC(5,2),
  height_m NUMERIC(4,2),
  body_fat_pct NUMERIC(4,1),
  pr_bench_kg INT DEFAULT 0,
  pr_squat_kg INT DEFAULT 0,
  pr_deadlift_kg INT DEFAULT 0,
  last_access_at TIMESTAMPTZ,
  last_access_gate TEXT DEFAULT 'Molinete 01 (Belgrano)',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.li_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.li_users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_dni TEXT NOT NULL,
  user_avatar TEXT,
  plan_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Mercado Pago', 'Transferencia', 'Efectivo')),
  bank_name TEXT,
  control_number TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('aprobado', 'pendiente', 'rechazado')),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.li_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.li_users(id) ON DELETE CASCADE,
  coach_name TEXT NOT NULL,
  title TEXT NOT NULL,
  mesocycle TEXT NOT NULL,
  focus TEXT NOT NULL,
  pdf_file_name TEXT,
  pdf_size_mb TEXT DEFAULT '1.8 MB',
  pdf_updated_at TIMESTAMPTZ DEFAULT now(),
  pdf_downloads INT DEFAULT 4,
  days_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.li_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  room_box TEXT NOT NULL,
  day_label TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_min INT DEFAULT 60,
  enrolled INT DEFAULT 0,
  capacity INT DEFAULT 20,
  intensity_tag TEXT DEFAULT 'Alta Intensidad',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.li_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.li_users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_dni TEXT NOT NULL,
  user_role TEXT DEFAULT 'alumno',
  user_avatar TEXT,
  plan_name TEXT NOT NULL,
  gate_name TEXT NOT NULL DEFAULT 'Molinete 01 (Belgrano)',
  status TEXT NOT NULL CHECK (status IN ('AUTORIZADO', 'BLOQUEADO')),
  reason TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and Public Policies for seamless client interaction
ALTER TABLE public.li_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.li_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.li_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.li_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.li_access_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'li_users' AND policyname = 'Allow public all on li_users') THEN
    CREATE POLICY "Allow public all on li_users" ON public.li_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'li_payments' AND policyname = 'Allow public all on li_payments') THEN
    CREATE POLICY "Allow public all on li_payments" ON public.li_payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'li_routines' AND policyname = 'Allow public all on li_routines') THEN
    CREATE POLICY "Allow public all on li_routines" ON public.li_routines FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'li_classes' AND policyname = 'Allow public all on li_classes') THEN
    CREATE POLICY "Allow public all on li_classes" ON public.li_classes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'li_access_logs' AND policyname = 'Allow public all on li_access_logs') THEN
    CREATE POLICY "Allow public all on li_access_logs" ON public.li_access_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Clear existing seed if re-running
TRUNCATE TABLE public.li_access_logs, public.li_routines, public.li_payments, public.li_classes, public.li_users RESTART IDENTITY CASCADE;

-- Insert Staff & Coaches
INSERT INTO public.li_users (id, member_code, full_name, dni, email, phone, role, specialty, level, plan_name, monthly_fee, payment_status, due_date, avatar_url, classes_attended, classes_limit, last_access_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '#ADM-001', 'Martín Garretón', '31.094.223', 'mgarreton@lifeintensity.com', '+5491144556677', 'admin', 'Head Coach / Director Sede', 'Elite', 'Staff Directivo 24/7', 0, 'al_dia', '2026-12-31', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80', 24, 30, now() - interval '4 hours'),
  ('22222222-2222-2222-2222-222222222222', '#COA-014', 'Marcos Rossi', '34.892.102', 'm.rossi@lifeintensity.com', '+5491155667788', 'profesor', 'Biomecánica & Fuerza', 'Head Coach', 'Contrato Docente Al Día', 0, 'al_dia', '2026-12-31', 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=160&auto=format&fit=crop&q=80', 28, 30, now() - interval '3 hours'),
  ('33333333-3333-3333-3333-333333333333', '#COA-018', 'Valeria Soria', '36.432.887', 'vsoria@lifeintensity.com', '+5491166778899', 'profesor', 'Readaptación Funcional & Kinesiología', 'Senior Coach', 'Contrato Docente Al Día', 0, 'al_dia', '2026-12-31', 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=160&auto=format&fit=crop&q=80', 24, 30, now() - interval '1 hour');

-- Insert Students (Alumnos)
INSERT INTO public.li_users (id, member_code, full_name, dni, email, phone, role, specialty, level, assigned_coach_id, plan_name, monthly_fee, payment_status, due_date, avatar_url, classes_attended, classes_limit, weight_kg, height_m, body_fat_pct, pr_bench_kg, pr_squat_kg, pr_deadlift_kg, last_access_at)
VALUES
  ('44444444-4444-4444-4444-444444444444', '#10842', 'Camila Rodríguez', '39.840.112', 'camila.rodriguez@gmail.com', '+5491133445566', 'alumno', 'Hipertrofia & Rendimiento', 'Avanzado', '22222222-2222-2222-2222-222222222222', 'Pase Libre Mensual', 18500, 'al_dia', '2026-11-28', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80', 18, 20, 62.5, 1.68, 16.4, 65, 105, 125, now() - interval '25 minutes'),
  ('55555555-5555-5555-5555-555555555555', '#10899', 'Lucas Cardozo', '38.291.044', 'lcardozo@gmail.com', '+5491122334455', 'alumno', 'Intensivo Pro 360', 'Avanzado', '22222222-2222-2222-2222-222222222222', 'Plan Mensual Ilimitado', 24500, 'al_dia', '2026-11-15', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80', 18, 20, 78.4, 1.79, 13.8, 100, 140, 160, now() - interval '12 minutes'),
  ('66666666-6666-6666-6666-666666666666', '#12108', 'Sofía Navarro', '40.112.900', 'sofia.navarro@gmail.com', '+5491177889900', 'alumno', 'Post Bariátrica & Readaptación', 'Readaptación', '33333333-3333-3333-3333-333333333333', 'Plan Readaptación 3x', 16500, 'al_dia', '2026-11-22', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80', 10, 12, 71.0, 1.65, 22.0, 40, 65, 80, now() - interval '2 hours'),
  ('77777777-7777-7777-7777-777777777777', '#11402', 'Camila Varela', '39.812.440', 'cvarela@hotmail.com', '+5491188990011', 'alumno', 'CrossFit WOD', 'Intermedio', '22222222-2222-2222-2222-222222222222', 'Pase Libre Mensual', 15000, 'por_validar', '2026-11-05', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80', 14, 16, 59.0, 1.64, 18.2, 50, 85, 100, now() - interval '1 day'),
  ('88888888-8888-8888-8888-888888888888', '#09821', 'Rodrigo Benítez', '35.190.221', 'rbenitez@gmail.com', '+5491199001122', 'alumno', 'Musculación & Potencia', 'Avanzado', '22222222-2222-2222-2222-222222222222', 'Membresía Full Anual', 18500, 'vencido', '2026-10-24', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80', 12, 20, 84.0, 1.82, 15.0, 110, 150, 180, now() - interval '5 days'),
  ('99999999-9999-9999-9999-999999999999', '#09431', 'Lucía Méndez', '38.654.120', 'lucia.mendez@outlook.com', '+5491133221100', 'alumno', 'Acondicionamiento Físico', 'Readaptación', '33333333-3333-3333-3333-333333333333', 'Pase 3 Días/Semana', 12000, 'vencido', '2026-10-28', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&auto=format&fit=crop&q=80', 0, 12, 66.0, 1.67, 21.5, 45, 70, 85, now() - interval '3 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '#12450', 'Nicolás Duarte', '44.908.431', 'nduarte@gmail.com', '+5491144112233', 'alumno', 'Fuerza Inicial', 'Inicial', NULL, 'Pase Libre Intensity', 18500, 'por_validar', '2026-11-05', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&auto=format&fit=crop&q=80', 1, 12, 74.0, 1.76, 17.5, 60, 80, 100, NULL);

-- Insert Payments & Vouchers
INSERT INTO public.li_payments (receipt_code, user_id, user_name, user_dni, user_avatar, plan_name, amount, payment_method, bank_name, control_number, status, created_at)
VALUES
  ('#CP-9041', '77777777-7777-7777-7777-777777777777', 'Camila Varela', '39.812.440', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80', 'Pase Libre Mensual', 15000, 'Transferencia', 'Banco Galicia', '00094182910', 'pendiente', now() - interval '14 minutes'),
  ('#CP-9042', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nicolás Duarte', '44.908.431', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&auto=format&fit=crop&q=80', 'Pase Libre Intensity', 18500, 'Mercado Pago', 'Mercado Pago', 'MP-99812034', 'pendiente', now() - interval '38 minutes'),
  ('#CP-9043', '44444444-4444-4444-4444-444444444444', 'Camila Rodríguez', '39.840.112', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80', 'Pase Libre Mensual', 18500, 'Transferencia', 'BBVA Francés', '00077219402', 'aprobado', now() - interval '1 day'),
  ('#CP-9044', '55555555-5555-5555-5555-555555555555', 'Lucas Cardozo', '38.291.044', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80', 'Plan Mensual Ilimitado', 24500, 'Mercado Pago', 'Mercado Pago Débito', 'MP-88920114', 'aprobado', now() - interval '2 days');

-- Insert Routines
INSERT INTO public.li_routines (student_id, coach_name, title, mesocycle, focus, pdf_file_name, pdf_size_mb, pdf_downloads, days_json)
VALUES
  ('44444444-4444-4444-4444-444444444444', 'Marcos Rossi', 'Hipertrofia & Rendimiento', 'Mesociclo 03 (Semana 2/4)', 'Fuerza Máxima & Estimulación Pectoral / Dorsal', 'Plan_Fuerza_Mesociclo_Marzo.pdf', '1.8 MB', 4, '[
    {
      "day": "Lunes: Tren Superior",
      "focus": "Fuerza Máxima & Estimulación Pectoral / Dorsal",
      "duration": "65 min",
      "exercises": [
        {"order": "01", "name": "Press Banca Plano con Barra", "muscle": "Pecho / Tríceps", "notes": "Escápulas retraídas, pausa de 1 segundo en el punto de máxima contracción.", "sets": 4, "reps": "10", "load": "65 kg", "rest": "90s", "completed": true},
        {"order": "02", "name": "Dominadas Pronadas Asistidas", "muscle": "Espalda / Dorsal", "notes": "Rango completo de movimiento. Evitar balanceo corporal.", "sets": 3, "reps": "12", "load": "Banda Negra", "rest": "60s", "completed": true},
        {"order": "03", "name": "Press Militar con Mancuernas", "muscle": "Hombros", "notes": "Posición sentada con respaldo a 80°. Control en la bajada excéntrica.", "sets": 4, "reps": "10", "load": "16 kg c/u", "rest": "75s", "completed": false},
        {"order": "04", "name": "Remo con Mancuerna en Banco", "muscle": "Dorsal / Bíceps", "notes": "Foco en la aducción escapular unilateral, codo pegado al torso.", "sets": 3, "reps": "12", "load": "22 kg", "rest": "60s", "completed": false}
      ]
    },
    {
      "day": "Miércoles: Tren Inferior",
      "focus": "Potencia de Piernas, Cadena Posterior & Core",
      "duration": "70 min",
      "exercises": [
        {"order": "01", "name": "Sentadilla Trasera Barra Olímpica", "muscle": "Cuádriceps / Glúteo", "notes": "Profundidad rompiendo paralelo con control lumbar.", "sets": 4, "reps": "6", "load": "95 kg", "rest": "120s", "completed": false},
        {"order": "02", "name": "Peso Muerto Rumano", "muscle": "Isquiotibiales", "notes": "Bisagra de cadera estricta, barra pegada a las tibias.", "sets": 4, "reps": "8", "load": "85 kg", "rest": "90s", "completed": false},
        {"order": "03", "name": "Prensa 45° Unilateral", "muscle": "Cuádriceps", "notes": "Bajada controlada en 3 segundos sin bloquear rodilla.", "sets": 3, "reps": "12", "load": "110 kg", "rest": "75s", "completed": false}
      ]
    },
    {
      "day": "Viernes: Full Body & Potencia",
      "focus": "Transferencia Dinámica & Acondicionamiento Metabólico",
      "duration": "60 min",
      "exercises": [
        {"order": "01", "name": "Push Press Olímpico", "muscle": "Hombros / Potencia", "notes": "Impulso explosivo de cadera y bloqueo firme arriba.", "sets": 4, "reps": "6", "load": "50 kg", "rest": "90s", "completed": false},
        {"order": "02", "name": "Kettlebell Swings Pesados", "muscle": "Cadena Posterior", "notes": "Extensión explosiva de cadera hasta altura del pecho.", "sets": 4, "reps": "15", "load": "24 kg", "rest": "60s", "completed": false}
      ]
    }
  ]'::jsonb),
  ('55555555-5555-5555-5555-555555555555', 'Marcos Rossi', 'Intensivo Pro 360', 'Mesociclo 03 (Semana 4/6)', 'Fuerza & Potencia Dinámica', 'Plan_Atleta_Pro360_Lucas.pdf', '2.4 MB', 7, '[
    {
      "day": "Lunes: Torso Pesado",
      "focus": "Fuerza y Potencia Dinámica Tren Superior",
      "duration": "55 min",
      "exercises": [
        {"order": "01", "name": "Press de Banca Plano con Barra", "muscle": "Pecho / Fuerza", "notes": "Barra Olímpica • RPE 8.5", "sets": 4, "reps": "6", "load": "75 kg", "rest": "120s", "completed": true},
        {"order": "02", "name": "Dominadas con Peso Corporal o Lastre", "muscle": "Espalda / Dorsal", "notes": "Agarre Prono Neutro • +10kg", "sets": 4, "reps": "8", "load": "+10 kg", "rest": "90s", "completed": true},
        {"order": "03", "name": "Press Militar Estricto de Pie", "muscle": "Hombros", "notes": "De pie con barra • Cadencia 3-0-1", "sets": 3, "reps": "10", "load": "45 kg", "rest": "90s", "completed": false},
        {"order": "04", "name": "Remo con Mancuerna en Banco", "muscle": "Dorsal", "notes": "Tracción unilateral controlada", "sets": 4, "reps": "10 c/u", "load": "26 kg", "rest": "60s", "completed": false}
      ]
    }
  ]'::jsonb);

-- Insert Classes
INSERT INTO public.li_classes (title, discipline, coach_name, room_box, day_label, start_time, duration_min, enrolled, capacity, intensity_tag)
VALUES
  ('CrossFit WOD Intensity', 'CrossFit', 'Prof. Ignacio Suárez', 'Box 1', 'Hoy', '18:00', 60, 20, 20, 'Alta Intensidad'),
  ('Fuerza & Acondicionamiento', 'Fuerza', 'Prof. Marcos Rossi', 'Box Central A', 'Hoy', '18:30', 60, 14, 16, 'Fuerza & Potencia'),
  ('Spinning Endurance', 'Cardio', 'Prof. Camila Rossi', 'Sala B', 'Hoy', '19:00', 45, 14, 16, 'Cardio Continuo'),
  ('Readaptación & Movilidad', 'Readaptación', 'Prof. Valeria Soria', 'Sala Kinesiología', 'Hoy', '19:45', 50, 11, 15, 'Recuperación Activa'),
  ('Halterofilia Olímpica', 'Fuerza', 'Prof. Marcos Rossi', 'Plataformas Pro', 'Mañana', '08:00', 60, 10, 12, 'Técnica & RM');

-- Insert Real-time Access Logs
INSERT INTO public.li_access_logs (user_id, user_name, user_dni, user_role, user_avatar, plan_name, gate_name, status, reason, accessed_at)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'Lucas Cardozo', '38.291.044', 'alumno', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80', 'Plan Mensual Ilimitado', 'Molinete 01 (Belgrano)', 'AUTORIZADO', 'Cuota al día', now() - interval '2 minutes'),
  ('99999999-9999-9999-9999-999999999999', 'Lucía Méndez', '38.654.120', 'alumno', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&auto=format&fit=crop&q=80', 'Pase 3 Días/Semana', 'Molinete 01 (Belgrano)', 'BLOQUEADO', 'Cuota vencida hace 8 días', now() - interval '6 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'Martín Garretón (Head Coach)', '31.094.223', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80', 'Pase Master 24/7', 'Molinete 01 (Belgrano)', 'AUTORIZADO', 'Staff Directivo', now() - interval '14 minutes'),
  ('44444444-4444-4444-4444-444444444444', 'Camila Rodríguez', '39.840.112', 'alumno', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80', 'Pase Libre Mensual', 'Molinete 01 (Belgrano)', 'AUTORIZADO', 'Cuota al día', now() - interval '22 minutes'),
  ('88888888-8888-8888-8888-888888888888', 'Rodrigo Benítez', '35.190.221', 'alumno', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80', 'Membresía Full Anual', 'Molinete 01 (Belgrano)', 'BLOQUEADO', 'Cuota vencida hace 12 días', now() - interval '35 minutes');



-- ============================================================
-- V2 EXTENSION: AUTHENTICATION, NOTIFICATIONS & CLASS RATINGS
-- ============================================================
ALTER TABLE public.li_users ADD COLUMN IF NOT EXISTS google_linked BOOLEAN DEFAULT false;
ALTER TABLE public.li_users ADD COLUMN IF NOT EXISTS password_hint TEXT DEFAULT '123456';
ALTER TABLE public.li_users ADD COLUMN IF NOT EXISTS mp_checkout_link TEXT DEFAULT 'https://link.mercadopago.com.ar/lifeintensity';

CREATE TABLE IF NOT EXISTS public.li_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.li_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notif_type TEXT NOT NULL DEFAULT 'sistema' CHECK (notif_type IN ('vencimiento', 'clases_restantes', 'pago', 'rutina', 'sistema')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.li_user_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.li_users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.li_classes(id) ON DELETE SET NULL,
  class_title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  room_box TEXT NOT NULL,
  day_label TEXT NOT NULL,
  start_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'asistida' CHECK (status IN ('reservada', 'asistida', 'cancelada')),
  effort_level INT CHECK (effort_level BETWEEN 1 AND 5),
  effort_face TEXT,
  effort_label TEXT,
  effort_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.li_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.li_user_classes ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- V3 SUPERUSER: lmarinero (FULL ACCESS)
-- ============================================================
INSERT INTO public.li_users (
  member_code, full_name, dni, email, phone, role, specialty, level,
  plan_name, monthly_fee, payment_status, due_date, avatar_url,
  classes_attended, classes_limit, weight_kg, height_m, body_fat_pct,
  pr_bench_kg, pr_squat_kg, pr_deadlift_kg, google_linked, password_hint
) VALUES (
  'lmarinero',
  'Lucas Marinero (Super Admin)',
  '38999111',
  'lmarinero@lifeintensity.com',
  '+54 9 11 6000-0001',
  'admin',
  'Dirección General & Full Access',
  'Elite Pro',
  'Pase Total Vitalicio (Super Admin)',
  45000,
  'al_dia',
  '2027-12-31',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  4,
  12,
  80.0,
  1.80,
  11.5,
  120,
  160,
  200,
  true,
  'lmarinero'
) ON CONFLICT (member_code) DO NOTHING;
