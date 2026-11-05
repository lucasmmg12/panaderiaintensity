import React, { useState } from 'react';
import { LIUser, supabase } from '../lib/supabase';

interface AuthViewProps {
  users: LIUser[];
  isLight: boolean;
  onLoginSuccess: (user: LIUser) => void;
  onRefresh: () => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  users,
  isLight,
  onLoginSuccess,
  onRefresh,
  onShowToast,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [emailOrDni, setEmailOrDni] = useState('lmarinero');
  const [password, setPassword] = useState('lmarinero');

  // Registration state
  const [regName, setRegName] = useState('');
  const [regDni, setRegDni] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPlan, setRegPlan] = useState('Plan Black Intensity');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');

  const superUserLmarinero: LIUser =
    users.find(
      (u) =>
        u.member_code.toLowerCase() === 'lmarinero' ||
        u.email.toLowerCase().includes('lmarinero')
    ) || {
      id: users[0]?.id || '00000000-0000-0000-0000-000000000001',
      member_code: 'lmarinero',
      full_name: 'Lucas Marinero (Super Admin)',
      dni: '38999111',
      email: 'lmarinero@lifeintensity.com',
      role: 'admin',
      specialty: 'Dirección General & Full Access',
      level: 'Elite Pro',
      plan_name: 'Pase Total Vitalicio (Super Admin)',
      monthly_fee: 45000,
      payment_status: 'al_dia',
      due_date: '2027-12-31',
      avatar_url:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      classes_attended: 4,
      classes_limit: 12,
      google_linked: true,
    };

  const handleEnterAsLmarinero = () => {
    onShowToast(
      '👑 Conectado como Superusuario lmarinero — Acceso Total y Modo Demo Habilitado',
      'success'
    );
    onLoginSuccess(superUserLmarinero);
  };

  // Standard Login without Google
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrDni.trim()) return;
    setIsSubmitting(true);

    try {
      const q = emailOrDni.trim().toLowerCase();
      if (q === 'lmarinero' || q === 'lmarinero@lifeintensity.com') {
        handleEnterAsLmarinero();
        return;
      }

      const found =
        users.find(
          (u) =>
            u.email.toLowerCase() === q ||
            u.dni.toLowerCase() === q ||
            u.member_code.toLowerCase() === q ||
            u.full_name.toLowerCase().includes(q)
        ) || superUserLmarinero;

      onShowToast(
        `Bienvenido/a ${found.full_name}. Recuerda que siempre puedes vincular tu cuenta con Google en 1 clic.`,
        'success'
      );
      onLoginSuccess(found);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standard Registration without Google
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regDni.trim()) return;
    setIsSubmitting(true);

    try {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const dueStr = nextMonth.toISOString().split('T')[0];
      const memberCode = `LI-${Math.floor(1000 + Math.random() * 9000)}`;
      const fee = regPlan.includes('Elite') ? 45000 : regPlan.includes('Black') ? 32000 : 24000;

      const { data: newUser, error } = await supabase
        .from('li_users')
        .insert({
          member_code: memberCode,
          full_name: regName.trim(),
          dni: regDni.trim(),
          email: regEmail.trim(),
          role: 'alumno',
          plan_name: regPlan,
          monthly_fee: fee,
          payment_status: 'por_validar',
          due_date: dueStr,
          level: 'Inicial',
          classes_attended: 0,
          classes_limit: 12,
          google_linked: false,
          password_hint: regPassword || '123456',
          avatar_url:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('li_notifications').insert([
        {
          user_id: newUser.id,
          title: '🎉 ¡Bienvenido a Life Intensity!',
          message: `Tu credencial ${memberCode} fue creada. Recuerda vincular tu cuenta con Google y abonar tu ${regPlan} para habilitar el molinete QR.`,
          notif_type: 'sistema',
          is_read: false,
        },
        {
          user_id: newUser.id,
          title: '🎟️ Tienes 12 clases disponibles',
          message: 'Tu ciclo mensual cuenta con 12 clases disponibles para reservar.',
          notif_type: 'clases_restantes',
          is_read: false,
        },
      ]);

      await onRefresh();
      onShowToast(`Cuenta creada para ${newUser.full_name} (${memberCode})`, 'success');
      onLoginSuccess(newUser as LIUser);
    } catch (err) {
      console.error(err);
      onShowToast('Error al crear la cuenta en Supabase', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Sign-In / Sign-Up
  const handleGoogleSelectUser = async (existingUser?: LIUser) => {
    setIsSubmitting(true);
    try {
      if (existingUser) {
        await supabase
          .from('li_users')
          .update({ google_linked: true })
          .eq('id', existingUser.id);
        await onRefresh();
        onShowToast(
          `Autenticado con Google Workspace: ${existingUser.email}`,
          'success'
        );
        onLoginSuccess({ ...existingUser, google_linked: true });
        return;
      }

      const gEmail =
        googleEmailInput.trim() ||
        `atleta.google.${Math.floor(100 + Math.random() * 900)}@gmail.com`;
      const gName = googleNameInput.trim() || 'Atleta Google Life';
      const memberCode = `LI-G${Math.floor(100 + Math.random() * 900)}`;
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const dueStr = nextMonth.toISOString().split('T')[0];

      const { data: created, error } = await supabase
        .from('li_users')
        .insert({
          member_code: memberCode,
          full_name: gName,
          dni: `${Math.floor(35000000 + Math.random() * 10000000)}`,
          email: gEmail,
          role: 'alumno',
          plan_name: 'Plan Black Intensity',
          monthly_fee: 32000,
          payment_status: 'al_dia',
          due_date: dueStr,
          level: 'Intermedio',
          classes_attended: 2,
          classes_limit: 12,
          google_linked: true,
          avatar_url:
            'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('li_notifications').insert([
        {
          user_id: created.id,
          title: '✅ Cuenta verificada con Google',
          message: `Tu cuenta Google (${gEmail}) quedó sincronizada con tu Pase QR ${memberCode}.`,
          notif_type: 'sistema',
          is_read: false,
        },
        {
          user_id: created.id,
          title: '🎟️ Te quedan 10 clases disponibles',
          message: 'Tienes 10 de 12 clases disponibles este mes. ¡Califica cada clase con caras según tu esfuerzo!',
          notif_type: 'clases_restantes',
          is_read: false,
        },
      ]);

      await onRefresh();
      onShowToast(`Cuenta creada y autenticada con Google (${gEmail})`, 'success');
      onLoginSuccess(created as LIUser);
    } catch (err) {
      console.error(err);
      onShowToast('Error al autenticar con Google', 'error');
    } finally {
      setIsSubmitting(false);
      setShowGoogleAccountPicker(false);
    }
  };

  const demoStudentOk = users.find(
    (u) => u.role === 'alumno' && u.payment_status === 'al_dia'
  );
  const demoStudentDebtor = users.find(
    (u) => u.role === 'alumno' && u.payment_status !== 'al_dia'
  );
  const demoCoach = users.find((u) => u.role === 'profesor');

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-3 sm:p-6 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0D0F13] text-[#F3F4F6]'
      }`}
    >
      <div
        className={`w-full max-w-4xl rounded-2xl border overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 ${
          isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#161920] border-[#262A34]'
        }`}
      >
        {/* Left Branding & Value Prop Banner (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#FF5722] via-[#E64A19] to-[#111317] p-6 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-xs font-extrabold tracking-widest uppercase">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              LIFE INTENSITY PLATFORM
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display leading-tight">
              Entrena al Límite. Gestiona Todo desde tu Celular o PC.
            </h1>
            <p className="text-xs text-white/90 leading-relaxed">
              Plataforma 100% responsiva con Modo Demo interactivo, pagos por Transferencia o Mercado Pago, alertas en campanita y calificación de clases con caras de esfuerzo (RPE).
            </p>
          </div>

          {/* 1-Click Superuser lmarinero Card */}
          <div className="space-y-3 pt-6 relative z-10">
            <div className="p-4 rounded-xl bg-black/45 backdrop-blur-md border-2 border-amber-400/60 space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                  SUPERUSUARIO LMARINERO
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-mono text-[10px] font-extrabold">
                  FULL ACCESS
                </span>
              </div>
              <p className="text-[11px] text-white/90">
                Ingresa directamente con el usuario <strong>lmarinero</strong> para gestionar todos los módulos administrativos, staff, molinete QR y portal del alumno con <strong>Modo Demo</strong>.
              </p>
              <button
                type="button"
                onClick={handleEnterAsLmarinero}
                className="w-full py-2.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                Entrar como lmarinero (Acceso Total)
              </button>
            </div>
          </div>
        </div>

        {/* Right Auth Form (7 cols) */}
        <div className="lg:col-span-7 p-5 sm:p-8 space-y-5">
          {/* Always Featured: Google Sign-Up / Sign-In Card */}
          <div
            className={`p-4 rounded-xl border-2 relative ${
              isLight
                ? 'bg-blue-50/60 border-blue-500/40'
                : 'bg-[#1D222D] border-[#00B4D8]/50'
            }`}
          >
            <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#00B4D8] text-black shadow">
              ★ Recomendado • Creá tu cuenta con Google
            </span>

            <div className="text-xs font-extrabold mb-2">
              {mode === 'login'
                ? 'Inicia sesión o crea tu cuenta con Google en 1 clic'
                : 'Recomendado: Crea tu cuenta vinculada con Google'}
            </div>

            <button
              type="button"
              onClick={() => setShowGoogleAccountPicker(true)}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-slate-900 font-extrabold text-xs border border-slate-300 shadow-md flex items-center justify-center gap-3 transition cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Continuar con Google (Crear o Iniciar Sesión)</span>
            </button>
          </div>

          {/* Toggle Mode Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-black/20 border border-white/10">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 rounded-md text-xs font-bold transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#FF5722] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Ingresar sin Google
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 rounded-md text-xs font-bold transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#FF5722] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Crear Cuenta sin Google
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleManualLogin} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Usuario, Email o DNI
                  </label>
                  <input
                    type="text"
                    required
                    value={emailOrDni}
                    onChange={(e) => setEmailOrDni(e.target.value)}
                    placeholder="lmarinero"
                    className={`w-full px-3.5 py-2.5 rounded-lg text-sm border font-mono ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                {isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}
              </button>

              {/* Quick Demo Roles Launcher */}
              <div className="pt-3 border-t border-gray-600/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#00B4D8]">
                    ⚡ Lanzador Rápido Modo Demo (1 Clic):
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleEnterAsLmarinero}
                    className="p-2.5 rounded-lg text-xs font-extrabold bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-black transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>👑</span>
                    <span className="truncate">lmarinero (Todo)</span>
                  </button>

                  {demoCoach && (
                    <button
                      type="button"
                      onClick={() => onLoginSuccess(demoCoach)}
                      className="p-2.5 rounded-lg text-xs font-bold bg-[#00B4D8]/15 border border-[#00B4D8]/40 text-[#00B4D8] hover:bg-[#00B4D8] hover:text-black transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🏋️</span>
                      <span className="truncate">Demo Coach</span>
                    </button>
                  )}

                  {demoStudentOk && (
                    <button
                      type="button"
                      onClick={() => onLoginSuccess(demoStudentOk)}
                      className="p-2.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🎓</span>
                      <span className="truncate">Alumno Al Día</span>
                    </button>
                  )}

                  {demoStudentDebtor && (
                    <button
                      type="button"
                      onClick={() => onLoginSuccess(demoStudentDebtor)}
                      className="p-2.5 rounded-lg text-xs font-bold bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⚠️</span>
                      <span className="truncate">Alumno Deudor</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleManualRegister} className="space-y-3">
              <div className="p-2.5 rounded-lg bg-[#00B4D8]/10 border border-[#00B4D8]/30 text-[11px] text-[#00B4D8] flex items-center justify-between">
                <span>💡 Recomendamos crear tu cuenta con Google para acceso instantáneo</span>
                <button
                  type="button"
                  onClick={() => setShowGoogleAccountPicker(true)}
                  className="underline font-extrabold cursor-pointer shrink-0 ml-2"
                >
                  Usar Google
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Nombre y Apellido</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej: Sofía Martínez"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={regDni}
                    onChange={(e) => setRegDni(e.target.value)}
                    placeholder="39.442.110"
                    className={`w-full px-3 py-2 rounded-lg text-sm border font-mono ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="sofia@email.com"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Selecciona tu Plan</label>
                <select
                  value={regPlan}
                  onChange={(e) => setRegPlan(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#111317] border-[#262A34] text-white'
                  }`}
                >
                  <option value="Plan Black Intensity">Plan Black Intensity ($32.000/mes)</option>
                  <option value="Plan Elite Power">Plan Elite Power ($45.000/mes)</option>
                  <option value="Plan Musculación Base">Plan Musculación Base ($24.000/mes)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                {isSubmitting ? 'Registrando en Supabase...' : 'Crear Cuenta Manualmente'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Google Account Picker Modal */}
      {showGoogleAccountPicker && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-extrabold text-sm">Seleccionar Cuenta de Google</span>
              </div>
              <button
                onClick={() => setShowGoogleAccountPicker(false)}
                className="material-symbols-outlined text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                close
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <button
                onClick={handleEnterAsLmarinero}
                className="w-full p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50/70 hover:bg-amber-100 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={superUserLmarinero.avatar_url}
                    alt={superUserLmarinero.full_name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {superUserLmarinero.full_name}
                    </div>
                    <div className="text-[11px] text-slate-600">{superUserLmarinero.email}</div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-400 text-black uppercase">
                  SUPER ADMIN
                </span>
              </button>

              {users
                .filter((u) => u.member_code !== 'lmarinero')
                .slice(0, 4)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleGoogleSelectUser(u)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:border-blue-300 flex items-center justify-between transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={u.avatar_url}
                        alt={u.full_name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">{u.full_name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                      {u.role}
                    </span>
                  </button>
                ))}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="text-xs font-bold text-slate-700">
                O crear cuenta con otro correo de Google:
              </div>
              <input
                type="text"
                value={googleNameInput}
                onChange={(e) => setGoogleNameInput(e.target.value)}
                placeholder="Tu Nombre y Apellido"
                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300"
              />
              <input
                type="email"
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                placeholder="tucorreo@gmail.com"
                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300"
              />
              <button
                type="button"
                onClick={() => handleGoogleSelectUser(undefined)}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Crear y Continuar con Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
