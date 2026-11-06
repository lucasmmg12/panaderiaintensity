import React, { useState, useEffect } from 'react';
import {
  LIUser,
  LIPayment,
  LIRoutine,
  LIRoutineDay,
  LIExercise,
  LIClass,
  LINotification,
  LIUserClass,
  LIAccessLog,
  EFFORT_FACES,
  GYM_PLANS,
  getPlanConfig,
  isUnlimitedPlan,
  supabase,
} from '../lib/supabase';

interface StudentPortalViewProps {
  users: LIUser[];
  payments: LIPayment[];
  routines: LIRoutine[];
  classes: LIClass[];
  notifications: LINotification[];
  userClasses: LIUserClass[];
  accessLogs: LIAccessLog[];
  loggedInUser?: LIUser | null;
  isLight: boolean;
  onRefresh: () => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  users,
  payments,
  routines,
  classes,
  notifications,
  userClasses,
  accessLogs,
  loggedInUser,
  isLight,
  onRefresh,
  onShowToast,
}) => {
  const students = users.filter((u) => u.role === 'alumno');
  const [activeStudentId, setActiveStudentId] = useState<string>(
    loggedInUser?.role === 'alumno' ? loggedInUser.id : students[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<
    'inicio' | 'pagos' | 'clases' | 'rutina' | 'perfil'
  >('inicio');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Payment Hub state
  const [selectedPayMethod, setSelectedPayMethod] = useState<
    'transferencia' | 'mercadopago' | 'efectivo'
  >('efectivo');
  const [chosenPlanName, setChosenPlanName] = useState<string>('Plan 12 Clases');
  const [bankName, setBankName] = useState('Banco Galicia');
  const [controlNumber, setControlNumber] = useState('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [mpRedirectUrl, setMpRedirectUrl] = useState<string>(
    import.meta.env.VITE_MERCADOPAGO_CHECKOUT_URL ||
      'https://link.mercadopago.com.ar/lifeintensity'
  );
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Routine interactive state
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>({
    '0-0-0': true,
    '0-0-1': true,
  });
  const [restSeconds, setRestSeconds] = useState<number>(90);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Class filter state
  const [disciplineFilter, setDisciplineFilter] = useState<string>('Todas');

  useEffect(() => {
    if (loggedInUser && loggedInUser.role === 'alumno') {
      setActiveStudentId(loggedInUser.id);
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const t = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          onShowToast('¡Tiempo de descanso finalizado! A la barra 🔥', 'warning');
          return 90;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isTimerRunning, onShowToast]);

  const currentStudent =
    students.find((s) => s.id === activeStudentId) || students[0];

  const chosenPlanCfg = getPlanConfig(chosenPlanName || currentStudent?.plan_name);
  const studentUnlimited = currentStudent ? isUnlimitedPlan(currentStudent) : false;

  const studentRoutine =
    routines.find((r) => r.student_id === currentStudent?.id) || routines[0];
  const routineDays: LIRoutineDay[] = Array.isArray(studentRoutine?.days_json)
    ? studentRoutine.days_json
    : [];
  const currentDayObj = routineDays[selectedDayIdx] || routineDays[0];
  const dayExercises: LIExercise[] = Array.isArray(currentDayObj?.exercises)
    ? currentDayObj.exercises
    : [];

  // Personal records filtered for this student
  const myPayments = payments.filter((p) => p.user_id === currentStudent?.id);
  const myClasses = userClasses.filter((uc) => uc.user_id === currentStudent?.id);
  const myNotifications = notifications.filter((n) => n.user_id === currentStudent?.id);
  const myAccessLogs = accessLogs.filter(
    (l) => l.user_id === currentStudent?.id || l.user_dni === currentStudent?.dni
  );

  // Dynamic remaining classes & expiration calculation
  const classesRemaining = Math.max(
    0,
    (currentStudent?.classes_limit || 12) - (currentStudent?.classes_attended || 0)
  );
  const unreadNotifsCount = myNotifications.filter((n) => !n.is_read).length;

  const handleMarkAllNotificationsRead = async () => {
    if (!currentStudent) return;
    try {
      await supabase
        .from('li_notifications')
        .update({ is_read: true })
        .eq('user_id', currentStudent.id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Option 1: Request Cash Payment (waits for Profesor or Admin to accept)
  const handleRequestCashPayment = async () => {
    if (!currentStudent) return;
    setIsSubmittingPayment(true);
    try {
      const code = `EFE-${Math.floor(10000 + Math.random() * 90000)}`;
      await supabase
        .from('li_users')
        .update({
          payment_status: 'por_validar',
          plan_name: chosenPlanCfg.name,
          monthly_fee: chosenPlanCfg.price,
        })
        .eq('id', currentStudent.id);

      await supabase.from('li_payments').insert({
        receipt_code: code,
        user_id: currentStudent.id,
        user_name: currentStudent.full_name,
        user_dni: currentStudent.dni,
        user_avatar: currentStudent.avatar_url,
        plan_name: chosenPlanCfg.name,
        amount: chosenPlanCfg.price,
        payment_method: 'Efectivo',
        bank_name: 'Efectivo en Recepción / Profesor',
        control_number: `CAJA-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'pendiente',
      });

      await supabase.from('li_notifications').insert({
        user_id: currentStudent.id,
        title: `💵 Pago en Efectivo informado (${code})`,
        message: `Informaste pago en efectivo por ${chosenPlanCfg.name} ($${chosenPlanCfg.price.toLocaleString(
          'es-AR'
        )}). En cuanto el Profesor o Admin acepte el pago, tendrás tus ${
          chosenPlanCfg.isUnlimited ? 'Pase Libre ∞' : `${chosenPlanCfg.classesLimit} clases`
        } disponibles.`,
        notif_type: 'pago',
        is_read: false,
      });

      onShowToast(
        `Orden en Efectivo ${code} generada. Cuando el Profesor/Admin acepte el pago se acreditarán tus ${chosenPlanCfg.shortName}.`,
        'warning'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Simulate Profesor/Admin accepting the payment right away
  const handleSimulateProfessorAcceptsPayment = async (pay?: LIPayment) => {
    if (!currentStudent) return;
    setIsSubmittingPayment(true);
    try {
      const activePlanCfg = pay ? getPlanConfig(pay.plan_name) : chosenPlanCfg;
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      const nextDueStr = nextDueDate.toISOString().split('T')[0];

      await supabase
        .from('li_users')
        .update({
          payment_status: 'al_dia',
          plan_name: activePlanCfg.name,
          monthly_fee: activePlanCfg.price,
          classes_limit: activePlanCfg.classesLimit,
          classes_attended: 0,
          due_date: nextDueStr,
        })
        .eq('id', currentStudent.id);

      await supabase
        .from('li_payments')
        .update({ status: 'aprobado' })
        .eq('user_id', currentStudent.id)
        .eq('status', 'pendiente');

      const creditsText = activePlanCfg.isUnlimited
        ? 'PASE LIBRE ILIMITADO (∞ clases)'
        : `${activePlanCfg.classesLimit} CLASES DISPONIBLES`;

      await supabase.from('li_notifications').insert({
        user_id: currentStudent.id,
        title: `✅ ¡El Profesor aceptó tu pago! (${activePlanCfg.name})`,
        message: `Ya tienes acreditadas tus ${creditsText} en tu cuenta y tu QR de molinete está habilitado.`,
        notif_type: 'clases_restantes',
        is_read: false,
      });

      onShowToast(
        `¡Pago aceptado por el Profesor! Se acreditaron ${creditsText} a ${currentStudent.full_name}.`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleUploadTransferReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    setIsSubmittingPayment(true);
    try {
      const code = `REC-${Math.floor(10000 + Math.random() * 90000)}`;
      const ctrl = controlNumber.trim() || `CBU-${Math.floor(100000 + Math.random() * 900000)}`;

      await supabase
        .from('li_users')
        .update({
          payment_status: 'por_validar',
          plan_name: chosenPlanCfg.name,
          monthly_fee: chosenPlanCfg.price,
        })
        .eq('id', currentStudent.id);

      await supabase.from('li_payments').insert({
        receipt_code: code,
        user_id: currentStudent.id,
        user_name: currentStudent.full_name,
        user_dni: currentStudent.dni,
        user_avatar: currentStudent.avatar_url,
        plan_name: chosenPlanCfg.name,
        amount: chosenPlanCfg.price,
        payment_method: 'Transferencia',
        bank_name: bankName,
        control_number: ctrl,
        receipt_url: receiptFileName || 'comprobante_transferencia.pdf',
        status: 'pendiente',
      });

      await supabase.from('li_notifications').insert({
        user_id: currentStudent.id,
        title: `📄 Comprobante recibido (${chosenPlanCfg.name})`,
        message: `Recibimos tu comprobante ${code} (${bankName}) por $${chosenPlanCfg.price.toLocaleString(
          'es-AR'
        )}. Al ser aceptado por el Profesor/Admin se acreditarán tus ${chosenPlanCfg.shortName}.`,
        notif_type: 'pago',
        is_read: false,
      });

      setControlNumber('');
      setReceiptFileName('');
      onShowToast(
        `Comprobante ${code} subido (${chosenPlanCfg.name}). Al ser aceptado tendrás tus ${chosenPlanCfg.shortName}.`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al subir comprobante', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleMercadoPagoRedirectAndPay = async () => {
    if (!currentStudent) return;
    setIsSubmittingPayment(true);
    try {
      window.open(mpRedirectUrl, '_blank', 'noopener,noreferrer');

      const code = `MP-${Math.floor(10000 + Math.random() * 90000)}`;
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      const nextDueStr = nextDueDate.toISOString().split('T')[0];

      await supabase
        .from('li_users')
        .update({
          payment_status: 'al_dia',
          plan_name: chosenPlanCfg.name,
          monthly_fee: chosenPlanCfg.price,
          classes_limit: chosenPlanCfg.classesLimit,
          classes_attended: 0,
          due_date: nextDueStr,
        })
        .eq('id', currentStudent.id);

      await supabase.from('li_payments').insert({
        receipt_code: code,
        user_id: currentStudent.id,
        user_name: currentStudent.full_name,
        user_dni: currentStudent.dni,
        user_avatar: currentStudent.avatar_url,
        plan_name: chosenPlanCfg.name,
        amount: chosenPlanCfg.price,
        payment_method: 'Mercado Pago',
        bank_name: 'Mercado Pago Checkout Redirección',
        control_number: `MP-WH-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'aprobado',
      });

      const creditsText = chosenPlanCfg.isUnlimited
        ? 'PASE LIBRE ILIMITADO (∞ clases)'
        : `${chosenPlanCfg.classesLimit} CLASES DISPONIBLES`;

      await supabase.from('li_notifications').insert({
        user_id: currentStudent.id,
        title: `✅ Pago acreditado vía Mercado Pago (${chosenPlanCfg.name})`,
        message: `Tu pago ${code} fue procesado. Se acreditaron tus ${creditsText} hasta el ${nextDueStr}.`,
        notif_type: 'clases_restantes',
        is_read: false,
      });

      onShowToast(
        `¡Pago Mercado Pago acreditado! Tienes ${creditsText}.`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleBookNewClass = async (cls: LIClass) => {
    if (!currentStudent) return;
    if (!studentUnlimited && classesRemaining <= 0) {
      onShowToast(
        'Has agotado tus clases disponibles. Renueva tu plan (8, 12 o Pase Libre) en la pestaña Pagos.',
        'error'
      );
      setActiveTab('pagos');
      return;
    }
    try {
      await supabase.from('li_user_classes').insert({
        user_id: currentStudent.id,
        class_id: cls.id,
        class_title: cls.title,
        discipline: cls.discipline,
        coach_name: cls.coach_name,
        room_box: cls.room_box,
        day_label: cls.day_label,
        start_time: cls.start_time,
        status: 'asistida',
      });

      const nextAttended = Math.min(
        currentStudent.classes_limit || 12,
        (currentStudent.classes_attended || 0) + 1
      );
      const nextRem = Math.max(0, (currentStudent.classes_limit || 12) - nextAttended);

      await supabase
        .from('li_users')
        .update({ classes_attended: nextAttended })
        .eq('id', currentStudent.id);

      await supabase
        .from('li_classes')
        .update({ enrolled: Math.min(cls.capacity, cls.enrolled + 1) })
        .eq('id', cls.id);

      await supabase.from('li_notifications').insert({
        user_id: currentStudent.id,
        title: `🎟️ Reserva confirmada: ${cls.title}`,
        message: `Te quedan ${nextRem} clases disponibles en tu pase mensual. ¡Recuerda calificar la clase con caras según tu esfuerzo!`,
        notif_type: 'clases_restantes',
        is_read: false,
      });

      onShowToast(
        `Clase "${cls.title}" sumada a tu registro. ¡Califícala con caras según tu esfuerzo!`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateClassEffort = async (
    userClass: LIUserClass,
    effortObj: (typeof EFFORT_FACES)[number]
  ) => {
    try {
      await supabase
        .from('li_user_classes')
        .update({
          effort_level: effortObj.level,
          effort_face: effortObj.face,
          effort_label: `${effortObj.label} (${effortObj.desc})`,
        })
        .eq('id', userClass.id);

      onShowToast(
        `Calificaste "${userClass.class_title}" con ${effortObj.face} ${effortObj.label}`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al guardar calificación de esfuerzo', 'error');
    }
  };

  const handleLinkGoogleAccount = async () => {
    if (!currentStudent) return;
    try {
      await supabase
        .from('li_users')
        .update({ google_linked: true })
        .eq('id', currentStudent.id);
      onShowToast(
        `¡Cuenta de ${currentStudent.full_name} vinculada exitosamente con Google!`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSet = (key: string) => {
    setCompletedSets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next[key]) {
        setRestSeconds(90);
        setIsTimerRunning(true);
      }
      return next;
    });
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const mutedText = isLight ? 'text-slate-500' : 'text-[#9CA3AF]';

  return (
    <div className="space-y-6">
      {/* Top Simulator Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#FF5722] mb-1">
            <span>PORTAL DE AUTOGESTIÓN DEL ALUMNO</span>
            <span>/</span>
            <span className={mutedText}>PAGOS, CLASES CON RPE, NOTIFICACIONES & RUTINAS</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">
            Experiencia Completa del Usuario
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Campanita de notificaciones (vencimiento y clases restantes), pagos por Transferencia (con subida de comprobante) o redirección a Mercado Pago, registro personal completo y calificación de clases con caras de esfuerzo.
          </p>
        </div>

        {/* Switch Active Student & Screen Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${mutedText}`}>Alumno activo:</span>
            <select
              value={currentStudent?.id || ''}
              onChange={(e) => setActiveStudentId(e.target.value)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-[#181B22] border-[#262A34] text-white'
              }`}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.payment_status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#181B22] border border-[#262A34]">
            {(
              [
                { id: 'inicio', label: 'Inicio', icon: 'home' },
                { id: 'pagos', label: 'Pagar & Mis Pagos', icon: 'payments' },
                { id: 'clases', label: 'Mis Clases & Esfuerzo', icon: 'mood' },
                { id: 'rutina', label: 'Mi Rutina', icon: 'fitness_center' },
                { id: 'perfil', label: 'Mi Perfil', icon: 'person' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-[#FF5722] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout: Mobile Interactive Device (7 cols) + Expanded Desktop Records & Notifications Summary (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left/Center: Mobile Device Frame */}
        <div className="xl:col-span-7 flex justify-center">
          <div className="w-full max-w-[460px] rounded-2xl sm:rounded-[36px] bg-[#0B0D11] border sm:border-[6px] border-[#262A34] shadow-2xl overflow-hidden text-[#F3F4F6] flex flex-col sm:min-h-[820px] relative">
            {/* Mobile Status Bar (Shown on Desktop Simulator >= sm) */}
            <div className="hidden sm:flex px-6 pt-3 pb-2 items-center justify-between text-[11px] font-mono text-gray-400 bg-[#111317]">
              <span>09:41</span>
              <div className="w-20 h-4 rounded-full bg-black border border-white/10"></div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">wifi</span>
                <span className="material-symbols-outlined text-[14px]">battery_full</span>
              </div>
            </div>

            {/* Mobile App Top Header with Bell ("Campanita") & QR Pass */}
            {currentStudent && (
              <div className="px-4 py-3.5 bg-[#111317] border-b border-[#262A34] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={currentStudent.avatar_url}
                    alt={currentStudent.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#FF5722] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF5722] font-bold">
                        {currentStudent.member_code}
                      </span>
                      {currentStudent.google_linked && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[9px] font-bold">
                          Google ✓
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold truncate">
                      {currentStudent.full_name}
                    </div>
                  </div>
                </div>

                {/* Right Header Actions: Notification Bell ("Campanita") + QR Pass */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
                    title="Campanita de Notificaciones"
                    className="relative p-2 rounded-xl bg-[#181B22] border border-[#262A34] hover:border-[#FF5722] text-white transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      notifications
                    </span>
                    {unreadNotifsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF5722] text-white text-[10px] font-mono font-extrabold flex items-center justify-center animate-pulse">
                        {unreadNotifsCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setShowQrModal(true)}
                    className="px-3 py-2 rounded-xl bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                    QR
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Body Content */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[640px] bg-[#111317]">
              {/* Google Account Banner if not linked yet */}
              {currentStudent && !currentStudent.google_linked && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-blue-200">
                    <strong className="text-white block">
                      ★ Recomendado: Vincula tu cuenta con Google
                    </strong>
                    Accede en 1 clic y respalda tus pagos y clases.
                  </div>
                  <button
                    onClick={handleLinkGoogleAccount}
                    className="px-2.5 py-1.5 rounded-lg bg-white text-slate-900 text-[11px] font-extrabold shrink-0 cursor-pointer shadow"
                  >
                    Vincular Google
                  </button>
                </div>
              )}

              {/* TAB 1: INICIO (RESUMEN DE ALERTAS, CUOTA, CLASES Y ACCESOS) */}
              {activeTab === 'inicio' && currentStudent && (
                <>
                  {/* Quick Alert Strip: Pass Expiration & Remaining Classes */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div
                      onClick={() => setShowNotificationsDrawer(true)}
                      className="p-3 rounded-xl bg-[#181B22] border border-amber-500/30 cursor-pointer hover:border-amber-500 transition"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-400">
                        <span>Vencimiento Pase</span>
                        <span className="material-symbols-outlined text-[15px]">
                          notifications_active
                        </span>
                      </div>
                      <div className="text-sm font-mono font-extrabold mt-1">
                        {currentStudent.due_date || '2026-06-10'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Estado: {currentStudent.payment_status.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('clases')}
                      className="p-3 rounded-xl bg-[#181B22] border border-[#00B4D8]/30 cursor-pointer hover:border-[#00B4D8] transition"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#00B4D8]">
                        <span>Clases Disponibles</span>
                        <span className="material-symbols-outlined text-[15px]">
                          confirmation_number
                        </span>
                      </div>
                      <div className="text-sm font-mono font-extrabold mt-1">
                        {currentStudent.payment_status !== 'al_dia'
                          ? '0 habilitadas (Pendiente)'
                          : studentUnlimited
                          ? '∞ PASE LIBRE'
                          : `Quedan ${classesRemaining} de ${currentStudent.classes_limit || 8}`}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {currentStudent.classes_attended || 0} clases asistidas este ciclo
                      </div>
                    </div>
                  </div>

                  {/* Membership & Quick Payment Action Card */}
                  <div className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-gray-400">
                        Mi Plan Activo
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          currentStudent.payment_status === 'al_dia'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : currentStudent.payment_status === 'por_validar'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {currentStudent.payment_status === 'al_dia'
                          ? 'PAGO ACEPTADO • AL DÍA'
                          : currentStudent.payment_status === 'por_validar'
                          ? 'ESPERANDO ACEPTACIÓN PROFESOR/ADMIN'
                          : 'VENCIDO / SIN CRÉDITOS'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-base font-extrabold">{currentStudent.plan_name}</div>
                        <div className="text-xs text-gray-400 font-mono">
                          {studentUnlimited
                            ? 'Acceso ilimitado a clases del mes'
                            : `Pack mensual de ${currentStudent.classes_limit || 8} clases`}
                        </div>
                      </div>
                      <div className="text-xl font-extrabold font-mono text-[#FF5722]">
                        ${Number(currentStudent.monthly_fee || 32000).toLocaleString('es-AR')}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setSelectedPayMethod('efectivo');
                          setActiveTab('pagos');
                        }}
                        className="py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">payments</span>
                        Efectivo
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPayMethod('mercadopago');
                          setActiveTab('pagos');
                        }}
                        className="py-2 px-2 rounded-lg bg-[#009EE3] hover:bg-[#008ACA] text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">bolt</span>
                        MercadoPago
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPayMethod('transferencia');
                          setActiveTab('pagos');
                        }}
                        className="py-2 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-[#262A34] text-gray-200 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">upload_file</span>
                        Transferir
                      </button>
                    </div>
                  </div>

                  {/* Recent Class to Rate with Faces */}
                  {myClasses.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase text-[#FF5722]">
                          ¿CÓMO TE SENTISTE EN TU ÚLTIMA CLASE?
                        </span>
                        <button
                          onClick={() => setActiveTab('clases')}
                          className="text-[11px] font-bold text-[#00B4D8] cursor-pointer"
                        >
                          Ver todas ({myClasses.length})
                        </button>
                      </div>

                      <div className="text-sm font-extrabold">{myClasses[0].class_title}</div>
                      <div className="text-[11px] text-gray-400">
                        {myClasses[0].day_label} • {myClasses[0].start_time} •{' '}
                        {myClasses[0].coach_name}
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        {EFFORT_FACES.map((ef) => {
                          const isSelected = myClasses[0].effort_level === ef.level;
                          return (
                            <button
                              key={ef.level}
                              onClick={() => handleRateClassEffort(myClasses[0], ef)}
                              className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                                isSelected
                                  ? ef.color + ' scale-105 shadow-md'
                                  : 'bg-[#111317] border-[#262A34] hover:border-gray-500'
                              }`}
                            >
                              <div className="text-xl leading-none">{ef.face}</div>
                              <div className="text-[9px] font-bold mt-1 truncate">{ef.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick Access to Today's Routine */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-[#FF5722]/20 to-[#181B22] border border-[#FF5722]/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#FF5722]">
                        MI RUTINA Y PLAN PDF
                      </span>
                      <span className="text-[11px] font-mono text-gray-300">
                        {studentRoutine?.coach_name || 'Prof. Marcos Rossi'}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold">
                      {studentRoutine?.title || 'Hipertrofia & Fuerza Base'}
                    </h3>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-300">
                        {routineDays.length} días • PDF Oficial listo
                      </span>
                      <button
                        onClick={() => setActiveTab('rutina')}
                        className="px-3 py-1.5 rounded-lg bg-[#FF5722] text-white text-xs font-bold cursor-pointer"
                      >
                        Abrir Rutina →
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: PAGOS (SELECTOR DE PLAN 8, 12, PASE LIBRE + PASARELA MULTIMÉTODO) */}
              {activeTab === 'pagos' && currentStudent && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold">
                      Elegir Plan y Abonar Membresía
                    </h3>
                    <p className="text-xs text-gray-400">
                      Una vez que el Profesor o Admin acepte tu pago, se acreditan tus clases inmediatamente.
                    </p>
                  </div>

                  {/* PASO 1: ELEGIR PLAN (8 CLASES, 12 CLASES, PASE LIBRE) */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono font-bold uppercase text-[#FF5722]">
                      Paso 1: Selecciona tu Plan de Clases
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {GYM_PLANS.map((plan) => {
                        const isSelected = chosenPlanCfg.id === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setChosenPlanName(plan.name)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer relative ${
                              isSelected
                                ? 'bg-[#FF5722]/15 border-[#FF5722] text-white shadow-md'
                                : 'bg-[#181B22] border-[#262A34] text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            <div className="text-[9px] font-mono font-extrabold uppercase text-[#00B4D8] truncate">
                              {plan.frequencyLabel}
                            </div>
                            <div className="text-xs font-extrabold mt-0.5 leading-tight">
                              {plan.shortName}
                            </div>
                            <div className="text-xs font-mono font-extrabold text-[#FF5722] mt-1">
                              ${plan.price.toLocaleString('es-AR')}
                            </div>
                            <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">
                              {plan.isUnlimited ? '∞ Clases libres' : `${plan.classesLimit} créditos/mes`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PASO 2: ELEGIR MÉTODO DE PAGO */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono font-bold uppercase text-[#00B4D8]">
                      Paso 2: Cómo deseas abonar ({chosenPlanCfg.name} — $
                      {chosenPlanCfg.price.toLocaleString('es-AR')})
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#181B22] border border-[#262A34]">
                      <button
                        onClick={() => setSelectedPayMethod('efectivo')}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          selectedPayMethod === 'efectivo'
                            ? 'bg-emerald-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        1. Efectivo (Prof.)
                      </button>
                      <button
                        onClick={() => setSelectedPayMethod('transferencia')}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          selectedPayMethod === 'transferencia'
                            ? 'bg-[#FF5722] text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        2. Transferencia
                      </button>
                      <button
                        onClick={() => setSelectedPayMethod('mercadopago')}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          selectedPayMethod === 'mercadopago'
                            ? 'bg-[#009EE3] text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        3. Mercado Pago
                      </button>
                    </div>
                  </div>

                  {/* METHOD 1: EFECTIVO CON PROFESOR / RECEPCIÓN */}
                  {selectedPayMethod === 'efectivo' && (
                    <div className="p-4 rounded-xl bg-[#181B22] border border-emerald-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                          Pago en Efectivo al Profesor o Admin
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold">
                          +{chosenPlanCfg.isUnlimited ? '∞ Clases' : `${chosenPlanCfg.classesLimit} Clases`}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed">
                        1. Informa tu pago aquí y entrega <strong>${chosenPlanCfg.price.toLocaleString('es-AR')}</strong> en efectivo a tu Profesor o en Recepción.<br />
                        2. Apenas el Profesor/Admin presione <strong>"Aceptar Pago"</strong> en su celular o panel, el sistema te acreditará automáticamente tus{' '}
                        <strong>
                          {chosenPlanCfg.isUnlimited
                            ? 'clases ilimitadas (Pase Libre ∞)'
                            : `${chosenPlanCfg.classesLimit} clases disponibles`}
                        </strong>.
                      </p>

                      <button
                        type="button"
                        disabled={isSubmittingPayment}
                        onClick={handleRequestCashPayment}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition"
                      >
                        <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                        {isSubmittingPayment
                          ? 'Registrando aviso...'
                          : `Informar Pago en Efectivo (${chosenPlanCfg.shortName} - $${chosenPlanCfg.price.toLocaleString('es-AR')})`}
                      </button>

                      {/* Botón Demo directo para probar la aceptación del profesor sin salir del celular */}
                      <div className="pt-2 border-t border-[#262A34]">
                        <button
                          type="button"
                          onClick={() => handleSimulateProfessorAcceptsPayment()}
                          className="w-full py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <span className="material-symbols-outlined text-[15px]">verified</span>
                          ⚡ Demo: Simular que el Profesor/Admin Acepta el Pago Ahora
                        </button>
                      </div>
                    </div>
                  )}

                  {/* METHOD 2: TRANSFERENCIA + UPLOAD COMPROBANTE */}
                  {selectedPayMethod === 'transferencia' && (
                    <form
                      onSubmit={handleUploadTransferReceipt}
                      className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#262A34] pb-2">
                        <span className="text-xs font-extrabold text-[#00B4D8]">
                          Datos Bancarios para Transferir
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText('LIFE.INTENSITY.GYM');
                            onShowToast('Alias copiado: LIFE.INTENSITY.GYM', 'success');
                          }}
                          className="text-[11px] font-bold underline text-[#FF5722] cursor-pointer"
                        >
                          Copiar Alias
                        </button>
                      </div>

                      <div className="text-xs font-mono space-y-1 bg-[#111317] p-3 rounded-lg border border-[#262A34]">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Alias CBU:</span>
                          <span className="font-bold text-white">LIFE.INTENSITY.GYM</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Plan elegido:</span>
                          <span className="font-bold text-[#00B4D8]">{chosenPlanCfg.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Monto a transferir:</span>
                          <span className="font-bold text-emerald-400">
                            ${chosenPlanCfg.price.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1 space-y-2.5">
                        <div className="text-xs font-bold text-white">
                          Sube tu comprobante aquí mismo:
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">
                              Banco / Billetera
                            </label>
                            <input
                              type="text"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                              placeholder="Galicia, Brubank, MP..."
                              className="w-full px-2.5 py-2 rounded-lg text-xs bg-[#111317] border border-[#262A34] text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">
                              Nro. Operación / Referencia
                            </label>
                            <input
                              type="text"
                              value={controlNumber}
                              onChange={(e) => setControlNumber(e.target.value)}
                              placeholder="Ej: 8829104"
                              className="w-full px-2.5 py-2 rounded-lg text-xs bg-[#111317] border border-[#262A34] text-white font-mono"
                            />
                          </div>
                        </div>

                        {/* File Upload Dropzone */}
                        <label className="block p-3.5 rounded-xl border-2 border-dashed border-[#FF5722]/40 hover:border-[#FF5722] bg-[#111317] text-center cursor-pointer transition">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setReceiptFileName(file.name);
                            }}
                          />
                          <span className="material-symbols-outlined text-[24px] text-[#FF5722]">
                            cloud_upload
                          </span>
                          <div className="text-xs font-bold mt-1">
                            {receiptFileName
                              ? `Archivo listo: ${receiptFileName}`
                              : 'Toca para adjuntar foto o PDF del comprobante'}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Al ser aceptado se acreditan {chosenPlanCfg.isUnlimited ? '∞ clases' : `${chosenPlanCfg.classesLimit} clases`}
                          </div>
                        </label>

                        <button
                          type="submit"
                          disabled={isSubmittingPayment}
                          className="w-full py-2.5 rounded-xl bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                        >
                          {isSubmittingPayment
                            ? 'Subiendo comprobante...'
                            : `Subir Comprobante (${chosenPlanCfg.shortName})`}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* METHOD 3: MERCADO PAGO REDIRECTION LINK */}
                  {selectedPayMethod === 'mercadopago' && (
                    <div className="p-4 rounded-xl bg-[#181B22] border border-[#009EE3]/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#009EE3] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">bolt</span>
                          Checkout Oficial Mercado Pago
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#009EE3]/20 text-[#009EE3] text-[10px] font-mono font-bold">
                          Acreditación Automática
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed">
                        Serás redirigido al link de <strong>Mercado Pago</strong> para abonar tu <strong>{chosenPlanCfg.name}</strong> y se habilitarán tus{' '}
                        <strong>
                          {chosenPlanCfg.isUnlimited ? 'clases ilimitadas (∞)' : `${chosenPlanCfg.classesLimit} clases`}
                        </strong>{' '}
                        en el acto.
                      </p>

                      <div>
                        <label className="block text-[10px] font-mono text-gray-400 mb-1">
                          Link de Redirección Configurado:
                        </label>
                        <input
                          type="url"
                          value={mpRedirectUrl}
                          onChange={(e) => setMpRedirectUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-[#111317] border border-[#262A34] text-[#38BDF8]"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSubmittingPayment}
                        onClick={handleMercadoPagoRedirectAndPay}
                        className="w-full py-3 rounded-xl bg-[#009EE3] hover:bg-[#008ACA] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        Pagar {chosenPlanCfg.shortName} con Mercado Pago ($
                        {chosenPlanCfg.price.toLocaleString('es-AR')})
                      </button>
                    </div>
                  )}

                  {/* USER'S COMPLETE PAYMENT HISTORY */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                        Mi Registro de Pagos ({myPayments.length})
                      </span>
                    </div>

                    {myPayments.length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] text-xs text-gray-400 text-center">
                        Aún no registras pagos en el historial.
                      </div>
                    ) : (
                      myPayments.map((pay) => (
                        <div
                          key={pay.id}
                          className="p-3 rounded-xl bg-[#181B22] border border-[#262A34] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-extrabold font-mono text-white">
                                  {pay.receipt_code}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  • {pay.payment_method}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {pay.plan_name} • {pay.bank_name || 'Caja'}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xs font-mono font-extrabold text-[#FF5722]">
                                ${Number(pay.amount).toLocaleString('es-AR')}
                              </div>
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  pay.status === 'aprobado'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : pay.status === 'pendiente'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-red-500/15 text-red-400'
                                }`}
                              >
                                {pay.status === 'aprobado' ? 'ACEPTADO' : pay.status}
                              </span>
                            </div>
                          </div>

                          {pay.status === 'pendiente' && (
                            <button
                              type="button"
                              onClick={() => handleSimulateProfessorAcceptsPayment(pay)}
                              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Aceptar Pago (Vista Profesor/Admin) y Acreditar Clases
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: MIS CLASES + CALIFICACIÓN CON CARAS SEGÚN NIVEL DE ESFUERZO */}
              {activeTab === 'clases' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold">
                        Mis Clases y Nivel de Esfuerzo
                      </h3>
                      <p className="text-xs text-gray-400">
                        {currentStudent?.payment_status !== 'al_dia' ? (
                          <span className="text-amber-400 font-bold">
                            Pago pendiente de aceptación por el Profesor/Admin para habilitar reservas.
                          </span>
                        ) : studentUnlimited ? (
                          <span>
                            Tienes <strong className="text-emerald-400">∞ PASE LIBRE ILIMITADO</strong> activo este mes.
                          </span>
                        ) : (
                          <span>
                            Te quedan <strong className="text-[#00B4D8]">{classesRemaining}</strong> de{' '}
                            <strong>{currentStudent?.classes_limit || 8}</strong> clases disponibles este mes.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Attended & Booked Classes with Effort Face Rating */}
                  <div className="space-y-3">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#FF5722]">
                      Historial de mis clases (Toca una cara para calificar esfuerzo)
                    </div>

                    {myClasses.map((uc) => (
                      <div
                        key={uc.id}
                        className="p-3.5 rounded-xl bg-[#181B22] border border-[#262A34] space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-[#00B4D8] uppercase">
                              {uc.day_label} • {uc.start_time}
                            </span>
                            <h4 className="text-sm font-extrabold">{uc.class_title}</h4>
                            <p className="text-[11px] text-gray-400">
                              {uc.coach_name} • {uc.room_box}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                              uc.status === 'asistida'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-sky-500/15 text-sky-400'
                            }`}
                          >
                            {uc.status}
                          </span>
                        </div>

                        {/* Effort Faces Selector */}
                        <div className="pt-1 border-t border-[#262A34]">
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
                            <span>Califica tu nivel de esfuerzo percibido (RPE):</span>
                            {uc.effort_face && (
                              <span className="font-bold text-[#FF5722]">
                                {uc.effort_face} {uc.effort_label}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-5 gap-1.5">
                            {EFFORT_FACES.map((ef) => {
                              const selected = uc.effort_level === ef.level;
                              return (
                                <button
                                  key={ef.level}
                                  type="button"
                                  onClick={() => handleRateClassEffort(uc, ef)}
                                  className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                                    selected
                                      ? ef.color + ' scale-105 shadow-md'
                                      : 'bg-[#111317] border-[#262A34] hover:border-gray-500'
                                  }`}
                                >
                                  <div className="text-xl leading-none">{ef.face}</div>
                                  <div className="text-[9px] font-bold mt-1 truncate">
                                    {ef.label}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Available Classes to Book */}
                  <div className="space-y-2.5 pt-2 border-t border-[#262A34]">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                      Reservar Nueva Clase en el Box
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {['Todas', 'Fuerza', 'CrossFit', 'Weightlifting', 'MetCon'].map((disc) => (
                        <button
                          key={disc}
                          onClick={() => setDisciplineFilter(disc)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 cursor-pointer ${
                            disciplineFilter === disc
                              ? 'bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/40'
                              : 'bg-[#181B22] text-gray-400'
                          }`}
                        >
                          {disc}
                        </button>
                      ))}
                    </div>

                    {classes
                      .filter(
                        (c) =>
                          disciplineFilter === 'Todas' ||
                          c.discipline.toLowerCase().includes(disciplineFilter.toLowerCase())
                      )
                      .map((cls) => (
                        <div
                          key={cls.id}
                          className="p-3 rounded-xl bg-[#181B22] border border-[#262A34] flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-[10px] font-mono text-[#00B4D8] font-bold">
                              {cls.day_label} • {cls.start_time}
                            </div>
                            <div className="text-xs font-extrabold">{cls.title}</div>
                            <div className="text-[10px] text-gray-400">
                              {cls.coach_name} • {cls.enrolled}/{cls.capacity} cupos
                            </div>
                          </div>
                          <button
                            onClick={() => handleBookNewClass(cls)}
                            className="px-3 py-1.5 rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-bold shrink-0 cursor-pointer"
                          >
                            + Reservar
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 4: MI RUTINA */}
              {activeTab === 'rutina' && (
                <div className="space-y-4">
                  {/* PDF Official Plan Banner */}
                  <div className="p-3.5 rounded-xl bg-[#181B22] border border-[#00B4D8]/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-[#00B4D8]">
                        picture_as_pdf
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {studentRoutine?.pdf_file_name || 'Plan_Mesociclo_04.pdf'}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {studentRoutine?.pdf_size_mb || '2.4 MB'} • Descarga Oficial
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        onShowToast('Descargando Plan PDF Oficial en el dispositivo...', 'success')
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#00B4D8] text-black text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      Descargar
                    </button>
                  </div>

                  {/* Interactive Rest Timer */}
                  <div className="p-3.5 rounded-xl bg-[#181B22] border border-[#262A34] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-gray-400">
                        CRONÓMETRO DE PAUSA RIR
                      </div>
                      <div className="text-2xl font-mono font-extrabold text-[#FF5722]">
                        {formatTimer(restSeconds)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className="px-3 py-1.5 rounded-lg bg-[#FF5722] text-white text-xs font-bold cursor-pointer"
                      >
                        {isTimerRunning ? 'Pausar' : 'Iniciar'}
                      </button>
                      <button
                        onClick={() => {
                          setIsTimerRunning(false);
                          setRestSeconds(90);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs font-bold cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Day Selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {routineDays.map((d, idx) => (
                      <button
                        key={d.day}
                        onClick={() => setSelectedDayIdx(idx)}
                        className={`py-2 rounded-lg text-xs font-bold cursor-pointer truncate px-2 ${
                          selectedDayIdx === idx
                            ? 'bg-[#FF5722] text-white'
                            : 'bg-[#181B22] text-gray-400 border border-[#262A34]'
                        }`}
                      >
                        {d.day}
                      </button>
                    ))}
                  </div>

                  {/* Exercises with interactive set checkboxes */}
                  <div className="space-y-3">
                    {dayExercises.map((ex, exIdx) => (
                      <div
                        key={`${ex.order}-${exIdx}`}
                        className="p-3.5 rounded-xl bg-[#181B22] border border-[#262A34] space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-extrabold">{ex.name}</h4>
                            <p className="text-[11px] text-gray-400">{ex.notes}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF5722]/15 text-[#FF5722]">
                            {ex.load}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Array.from({ length: Number(ex.sets) || 4 }).map((_, idx) => {
                            const setKey = `${selectedDayIdx}-${exIdx}-${idx}`;
                            const done = !!completedSets[setKey];
                            return (
                              <button
                                key={setKey}
                                onClick={() => toggleSet(setKey)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
                                  done
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : 'bg-[#111317] border-[#262A34] text-gray-400'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {done ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                                S{idx + 1}: {ex.reps}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: MI PERFIL & ACCESOS QR */}
              {activeTab === 'perfil' && currentStudent && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] text-center space-y-2">
                    <img
                      src={currentStudent.avatar_url}
                      alt={currentStudent.full_name}
                      className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-[#FF5722]"
                    />
                    <h3 className="text-base font-extrabold">{currentStudent.full_name}</h3>
                    <p className="text-xs font-mono text-gray-400">
                      DNI {currentStudent.dni} • {currentStudent.email}
                    </p>
                    <div className="pt-1">
                      {currentStudent.google_linked ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">
                          ✓ Cuenta Google Vinculada
                        </span>
                      ) : (
                        <button
                          onClick={handleLinkGoogleAccount}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-extrabold cursor-pointer"
                        >
                          Vincular con Google ahora
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Biometrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-xl bg-[#181B22] border border-[#262A34]">
                      <div className="text-[10px] text-gray-400 uppercase">Peso</div>
                      <div className="text-sm font-mono font-extrabold mt-0.5">
                        {currentStudent.weight_kg || 78.5} kg
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#181B22] border border-[#262A34]">
                      <div className="text-[10px] text-gray-400 uppercase">Altura</div>
                      <div className="text-sm font-mono font-extrabold mt-0.5">
                        {currentStudent.height_m || 1.78} m
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#181B22] border border-[#262A34]">
                      <div className="text-[10px] text-gray-400 uppercase">% Graso</div>
                      <div className="text-sm font-mono font-extrabold text-[#00B4D8] mt-0.5">
                        {currentStudent.body_fat_pct || 12.4}%
                      </div>
                    </div>
                  </div>

                  {/* Personal Records (PRs) */}
                  <div className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] space-y-2.5">
                    <div className="text-xs font-bold uppercase text-[#FF5722]">
                      Mis Marcas Personales (1RM)
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-lg bg-[#111317]">
                        <div className="text-[10px] text-gray-400">Press Banca</div>
                        <div className="text-sm font-mono font-extrabold">
                          {currentStudent.pr_bench_kg || 105} kg
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#111317]">
                        <div className="text-[10px] text-gray-400">Sentadilla</div>
                        <div className="text-sm font-mono font-extrabold text-[#FF5722]">
                          {currentStudent.pr_squat_kg || 145} kg
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#111317]">
                        <div className="text-[10px] text-gray-400">Peso Muerto</div>
                        <div className="text-sm font-mono font-extrabold text-[#00B4D8]">
                          {currentStudent.pr_deadlift_kg || 180} kg
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* My Turnstile Access Logs */}
                  <div className="p-4 rounded-xl bg-[#181B22] border border-[#262A34] space-y-2">
                    <div className="text-xs font-bold uppercase text-gray-400">
                      Mis Ingresos por Molinete QR ({myAccessLogs.length})
                    </div>
                    {myAccessLogs.slice(0, 4).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-[#262A34] last:border-none"
                      >
                        <span>{l.gate_name}</span>
                        <span
                          className={`font-mono font-bold ${
                            l.status === 'AUTORIZADO' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation Bar (5 Tabs) */}
            <div className="px-2 py-2.5 bg-[#181B22] border-t border-[#262A34] grid grid-cols-5 gap-1">
              {(
                [
                  { id: 'inicio', label: 'Inicio', icon: 'home' },
                  { id: 'pagos', label: 'Pagos', icon: 'payments' },
                  { id: 'clases', label: 'Clases/RPE', icon: 'mood' },
                  { id: 'rutina', label: 'Rutina', icon: 'fitness_center' },
                  { id: 'perfil', label: 'Mi Perfil', icon: 'person' },
                ] as const
              ).map((nav) => (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id)}
                  className={`flex flex-col items-center justify-center py-1 rounded-lg transition cursor-pointer ${
                    activeTab === nav.id ? 'text-[#FF5722]' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[19px]">{nav.icon}</span>
                  <span className="text-[9px] font-bold mt-0.5">{nav.label}</span>
                </button>
              ))}
            </div>

            {/* Notification Bell Drawer ("Campanita") inside Mobile Frame */}
            {showNotificationsDrawer && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col justify-end z-30">
                <div className="bg-[#181B22] border-t-2 border-[#FF5722] rounded-t-3xl p-5 max-h-[82%] flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-[#262A34] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#FF5722]">
                        notifications_active
                      </span>
                      <span className="text-sm font-extrabold">
                        Mis Notificaciones ({myNotifications.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotifsCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[11px] font-bold text-[#00B4D8] underline cursor-pointer"
                        >
                          Marcar leídas
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotificationsDrawer(false)}
                        className="material-symbols-outlined text-gray-400 hover:text-white cursor-pointer"
                      >
                        close
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto pr-1">
                    {myNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-xl border space-y-1 ${
                          !n.is_read
                            ? 'bg-[#FF5722]/10 border-[#FF5722]/40'
                            : 'bg-[#111317] border-[#262A34]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold">{n.title}</span>
                          {!n.is_read && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FF5722] text-white text-[9px] font-bold uppercase">
                              Nueva
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* QR Modal inside Mobile Frame */}
            {showQrModal && currentStudent && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 z-20">
                <div className="w-full rounded-2xl bg-[#181B22] border border-[#262A34] p-5 text-center space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#FF5722]">
                      CREDENCIAL QR DE ACCESO
                    </span>
                    <button
                      onClick={() => setShowQrModal(false)}
                      className="material-symbols-outlined text-gray-400 hover:text-white cursor-pointer"
                    >
                      close
                    </button>
                  </div>

                  <div className="text-sm font-extrabold">{currentStudent.full_name}</div>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      currentStudent.payment_status !== 'vencido'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {currentStudent.payment_status !== 'vencido'
                      ? 'MOLINETE HABILITADO'
                      : 'ACCESO BLOQUEADO POR DEUDA'}
                  </div>

                  <div className="w-44 h-44 mx-auto bg-white p-3 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[120px] text-black">
                      qr_code_2
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Acerca este código al lector óptico del Molinete Principal.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Student Telemetry & Admin Notification Sender (5 cols) */}
        <div className="xl:col-span-5 space-y-5">
          {/* Card 1: Effort Face Summary */}
          <div
            className={`p-5 rounded-xl border ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                : 'bg-[#181B22] border-[#262A34] text-[#F3F4F6]'
            } space-y-3`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5722]">mood</span>
              <h3 className="text-base font-extrabold font-display">
                Escala de Esfuerzo Percibido (RPE con Caras)
              </h3>
            </div>
            <p className={`text-xs ${mutedText}`}>
              Cada vez que el alumno califica una clase desde su celular, el registro queda guardado en <code className="font-mono">li_user_classes</code> para que el profesor ajuste las cargas:
            </p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {EFFORT_FACES.map((ef) => (
                <div
                  key={ef.level}
                  className={`p-2.5 rounded-xl border ${ef.color}`}
                >
                  <div className="text-2xl">{ef.face}</div>
                  <div className="text-[10px] font-extrabold mt-1">{ef.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Complete Personal Record Overview */}
          {currentStudent && (
            <div
              className={`p-5 rounded-xl border ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                  : 'bg-[#181B22] border-[#262A34] text-[#F3F4F6]'
              } space-y-3`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold font-display">
                  Expediente Integral de {currentStudent.full_name}
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#00B4D8]/15 text-[#00B4D8] text-xs font-mono font-bold">
                  {currentStudent.member_code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-black/20 border border-white/10">
                  <div className={mutedText}>Pagos Registrados</div>
                  <div className="text-lg font-mono font-extrabold text-emerald-400">
                    {myPayments.length} comprobantes
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/20 border border-white/10">
                  <div className={mutedText}>Clases Restantes</div>
                  <div className="text-lg font-mono font-extrabold text-[#00B4D8]">
                    {classesRemaining} / {currentStudent.classes_limit || 12}
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  await supabase.from('li_notifications').insert({
                    user_id: currentStudent.id,
                    title: '🔔 Aviso de Vencimiento y Clases',
                    message: `Hola ${currentStudent.full_name}, recuerda que te quedan ${classesRemaining} clases disponibles y tu pase vence el ${
                      currentStudent.due_date || '2026-06-10'
                    }.`,
                    notif_type: 'vencimiento',
                    is_read: false,
                  });
                  onShowToast(
                    `Alerta enviada a la campanita de ${currentStudent.full_name}`,
                    'success'
                  );
                  onRefresh();
                }}
                className="w-full py-2.5 rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  notifications_active
                </span>
                Enviar Alerta de Vencimiento / Clases a la Campanita
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
