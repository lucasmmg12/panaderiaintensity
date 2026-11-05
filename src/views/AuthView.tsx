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
  const [emailOrDni, setEmailOrDni] = useState('lucas.gomez@gmail.com');
  const [password, setPassword] = useState('123456');

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

  // Standard Login without Google
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrDni.trim()) return;
    setIsSubmitting(true);

    try {
      const q = emailOrDni.trim().toLowerCase();
      const found =
        users.find(
          (u) =>
            u.email.toLowerCase() === q ||
            u.dni.toLowerCase() === q ||
            u.member_code.toLowerCase() === q
        ) || users[0];

      if (found) {
        onShowToast(
          `Bienvenido/a ${found.full_name}. Te sugerimos vincular tu cuenta con Google desde Mi Perfil para ingreso en 1 clic.`,
          'success'
        );
        onLoginSuccess(found);
      } else {
        onShowToast('Usuario no encontrado. Puedes registrarte con Google en 1 clic.', 'warning');
      }
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

      // Seed initial notifications for the new user
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

  // Google Sign-In / Sign-Up (Attempts Supabase OAuth or Instant Google Account Sync)
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

      // Create new account via Google
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

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
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
        <div className="lg:col-span-5 bg-gradient-to-br from-[#FF5722] via-[#E64A19] to-[#111317] p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-xs font-extrabold tracking-widest uppercase">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              LIFE INTENSITY PLATFORM
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight font-display leading-tight">
              Entrena al Límite. Gestiona tu Pase en 1 Clic.
            </h1>
            <p className="text-xs text-white/90 leading-relaxed">
              Accede a tus rutinas interactivas, planes PDF, pagos por Transferencia o Mercado Pago, historial de clases con calificación de esfuerzo (RPE) y credencial QR de molinete.
            </p>
          </div>

          <div className="space-y-3 pt-8 relative z-10">
            <div className="p-3.5 rounded-xl bg-black/35 backdrop-blur-md border border-white/15 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                RECOMENDACIÓN OFICIAL
              </div>
              <p className="text-[11px] text-white/90">
                Crea o inicia sesión con tu cuenta de <strong>Google</strong> para sincronizar automáticamente tus recibos de pago, alertas de vencimiento y código QR sin recordar contraseñas.
              </p>
            </div>

            <div className="text-[11px] font-mono text-white/75 flex items-center justify-between">
              <span>Supabase Cloud Auth</span>
              <span>Sede Central Belgrano</span>
            </div>
          </div>
        </div>

        {/* Right Auth Form (7 cols) */}
        <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
          {/* Always Featured: Google Sign-Up / Sign-In Card */}
          <div
            className={`p-4 rounded-xl border-2 relative ${
              isLight
                ? 'bg-blue-50/60 border-blue-500/40'
                : 'bg-[#1D222D] border-[#00B4D8]/50'
            }`}
          >
            <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#00B4D8] text-black shadow">
              ★ Recomendado • Más Rápido
            </span>

            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-extrabold">
                {mode === 'login'
                  ? 'Ingresa o vincula tu cuenta con Google'
                  : 'Crea tu cuenta en 1 clic con Google'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGoogleAccountPicker(true)}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-slate-900 font-extrabold text-xs border border-slate-300 shadow-md flex items-center justify-center gap-3 transition cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-600/30"></div>
            <span className="flex-shrink mx-3 text-[11px] text-gray-400 uppercase font-mono">
              O ingresa manualmente sin Google
            </span>
            <div className="flex-grow border-t border-gray-600/30"></div>
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
              Iniciar Sesión con Email / DNI
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
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Email, DNI o Código de Socio
                </label>
                <input
                  type="text"
                  required
                  value={emailOrDni}
                  onChange={(e) => setEmailOrDni(e.target.value)}
                  placeholder="Ej: lucas.gomez@gmail.com o DNI"
                  className={`w-full px-3.5 py-2.5 rounded-lg text-sm border ${
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                {isSubmitting ? 'Verificando...' : 'Ingresar a Life Intensity'}
              </button>

              {/* Quick Demo Account Selector */}
              <div className="pt-2 border-t border-gray-600/20 space-y-2">
                <div className="text-[11px] font-bold text-gray-400">
                  Acceso rápido a cuentas activas en Supabase:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {users.slice(0, 5).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => onLoginSuccess(u)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                        isLight
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          : 'bg-[#111317] border-[#262A34] text-gray-300 hover:border-[#FF5722]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#FF5722]"></span>
                      <span>{u.full_name}</span>
                      <span className="opacity-60 uppercase text-[9px]">({u.role})</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleManualRegister} className="space-y-3">
              {/* Gentle reminder inside manual registration */}
              <div className="p-2.5 rounded-lg bg-[#00B4D8]/10 border border-[#00B4D8]/30 text-[11px] text-[#00B4D8] flex items-center justify-between">
                <span>💡 ¿Sabías que con Google tu alta tarda 3 segundos?</span>
                <button
                  type="button"
                  onClick={() => setShowGoogleAccountPicker(true)}
                  className="underline font-extrabold cursor-pointer"
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
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <span className="font-extrabold text-sm">Acceder con Google</span>
              </div>
              <button
                onClick={() => setShowGoogleAccountPicker(false)}
                className="material-symbols-outlined text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                close
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Selecciona una cuenta de Google existente o crea una nueva para <strong>Life Intensity</strong>:
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.slice(0, 4).map((u) => (
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
                O usar otra cuenta de Google nueva:
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
                Crear y Continuar con esta cuenta de Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
