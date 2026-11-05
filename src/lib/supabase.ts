import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dtjmckbrofevgfqbkzli.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0am1ja2Jyb2ZldmdmcWJremxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTQxMTgsImV4cCI6MjA4NjI5MDExOH0.JhZPg8DhTBu9nnbKYFKvluDirqKgehDzDP44g_nlqM8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface LIUser {
  id: string;
  member_code: string;
  full_name: string;
  dni: string;
  email: string;
  phone?: string;
  role: 'alumno' | 'profesor' | 'admin';
  specialty?: string;
  level: string;
  assigned_coach_id?: string | null;
  plan_name?: string;
  monthly_fee: number;
  payment_status: 'al_dia' | 'vencido' | 'por_validar';
  due_date?: string;
  avatar_url?: string;
  classes_attended: number;
  classes_limit: number;
  weight_kg?: number;
  height_m?: number;
  body_fat_pct?: number;
  pr_bench_kg?: number;
  pr_squat_kg?: number;
  pr_deadlift_kg?: number;
  last_access_at?: string;
  last_access_gate?: string;
  google_linked?: boolean;
  password_hint?: string;
  mp_checkout_link?: string;
  created_at?: string;
}

export interface LIPayment {
  id: string;
  receipt_code: string;
  user_id: string;
  user_name: string;
  user_dni: string;
  user_avatar?: string;
  plan_name: string;
  amount: number;
  payment_method: 'Mercado Pago' | 'Transferencia' | 'Efectivo';
  bank_name?: string;
  control_number?: string;
  status: 'aprobado' | 'pendiente' | 'rechazado';
  receipt_url?: string;
  created_at: string;
}

export interface LIExercise {
  order: string;
  name: string;
  muscle: string;
  notes: string;
  sets: number;
  reps: string;
  load: string;
  rest: string;
  completed?: boolean;
}

export interface LIRoutineDay {
  day: string;
  focus: string;
  duration: string;
  exercises: LIExercise[];
}

export interface LIRoutine {
  id: string;
  student_id: string;
  coach_name: string;
  title: string;
  mesocycle: string;
  focus: string;
  pdf_file_name: string;
  pdf_size_mb: string;
  pdf_updated_at: string;
  pdf_downloads: number;
  days_json: LIRoutineDay[];
}

export interface LIClass {
  id: string;
  title: string;
  discipline: string;
  coach_name: string;
  room_box: string;
  day_label: string;
  start_time: string;
  duration_min: number;
  enrolled: number;
  capacity: number;
  intensity_tag: string;
}

export interface LIAccessLog {
  id: string;
  user_id?: string;
  user_name: string;
  user_dni: string;
  user_role: string;
  user_avatar?: string;
  plan_name: string;
  gate_name: string;
  status: 'AUTORIZADO' | 'BLOQUEADO';
  reason?: string;
  accessed_at: string;
}

export interface LINotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notif_type: 'vencimiento' | 'clases_restantes' | 'pago' | 'rutina' | 'sistema';
  is_read: boolean;
  created_at: string;
}

export interface LIUserClass {
  id: string;
  user_id: string;
  class_id?: string;
  class_title: string;
  discipline: string;
  coach_name: string;
  room_box: string;
  day_label: string;
  start_time: string;
  status: 'reservada' | 'asistida' | 'cancelada';
  effort_level?: number | null;
  effort_face?: string | null;
  effort_label?: string | null;
  effort_comment?: string | null;
  created_at: string;
}

export const EFFORT_FACES = [
  { level: 1, face: '😄', label: 'Muy Suave', desc: 'Recuperación activa (RPE 2-3)', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15' },
  { level: 2, face: '😊', label: 'Moderado', desc: 'Trabajo aeróbico controlado (RPE 4-5)', color: 'text-sky-400 border-sky-500/40 bg-sky-500/15' },
  { level: 3, face: '😤', label: 'Intenso', desc: 'Fuerte y exigente (RPE 7)', color: 'text-amber-400 border-amber-500/40 bg-amber-500/15' },
  { level: 4, face: '🥵', label: 'Muy Duro', desc: 'Alta intensidad muscular (RPE 8.5)', color: 'text-orange-400 border-orange-500/40 bg-orange-500/15' },
  { level: 5, face: '🤯', label: 'Al Límite', desc: 'Esfuerzo máximo / Fallo (RPE 10)', color: 'text-red-400 border-red-500/40 bg-red-500/15' },
] as const;
