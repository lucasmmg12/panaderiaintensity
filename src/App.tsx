import React, { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  LIUser,
  LIPayment,
  LIRoutine,
  LIClass,
  LIAccessLog,
  LINotification,
  LIUserClass,
  GYM_PLANS,
  getPlanConfig,
} from './lib/supabase';
import { DashboardView } from './views/DashboardView';
import { PaymentsView } from './views/PaymentsView';
import { RoutinesView } from './views/RoutinesView';
import { QrAccessView } from './views/QrAccessView';
import { UsersStaffView } from './views/UsersStaffView';
import { StudentPortalView } from './views/StudentPortalView';
import { AuthView } from './views/AuthView';

export type NavTab =
  | 'dashboard'
  | 'payments'
  | 'routines'
  | 'qr_access'
  | 'users_staff'
  | 'student_portal';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isLight, setIsLight] = useState<boolean>(false);
  const [demoBarExpanded, setDemoBarExpanded] = useState<boolean>(true);
  const [isRunningDemo, setIsRunningDemo] = useState<boolean>(false);

  // Logged-in user state (defaults to lmarinero once loaded)
  const [currentUser, setCurrentUser] = useState<LIUser | null>(null);
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(false);
  const [showTopBellDropdown, setShowTopBellDropdown] = useState<boolean>(false);

  // Supabase state
  const [users, setUsers] = useState<LIUser[]>([]);
  const [payments, setPayments] = useState<LIPayment[]>([]);
  const [routines, setRoutines] = useState<LIRoutine[]>([]);
  const [classes, setClasses] = useState<LIClass[]>([]);
  const [accessLogs, setAccessLogs] = useState<LIAccessLog[]>([]);
  const [notifications, setNotifications] = useState<LINotification[]>([]);
  const [userClasses, setUserClasses] = useState<LIUserClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);

  // New User Modal state
  const [showNewUserModal, setShowNewUserModal] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'alumno' | 'profesor' | 'admin'>('alumno');
  const [newPlanName, setNewPlanName] = useState('Plan 12 Clases');
  const [newPlanPrice, setNewPlanPrice] = useState(32000);
  const [newPaymentMethod, setNewPaymentMethod] = useState<
    'Efectivo' | 'Mercado Pago' | 'Transferencia'
  >('Efectivo');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 4500);
    },
    []
  );

  const fetchAllData = useCallback(async () => {
    try {
      const [uRes, pRes, rRes, cRes, aRes, nRes, ucRes] = await Promise.all([
        supabase.from('li_users').select('*').order('created_at', { ascending: true }),
        supabase.from('li_payments').select('*').order('created_at', { ascending: false }),
        supabase.from('li_routines').select('*').order('updated_at', { ascending: false }),
        supabase.from('li_classes').select('*').order('start_time', { ascending: true }),
        supabase
          .from('li_access_logs')
          .select('*')
          .order('accessed_at', { ascending: false })
          .limit(20),
        supabase
          .from('li_notifications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('li_user_classes')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (uRes.data) {
        const loadedUsers = uRes.data as LIUser[];
        setUsers(loadedUsers);
        if (!currentUser && loadedUsers.length > 0) {
          const lmarineroUser =
            loadedUsers.find(
              (u) =>
                u.member_code.toLowerCase() === 'lmarinero' ||
                u.email.toLowerCase().includes('lmarinero')
            ) || loadedUsers[0];
          setCurrentUser(lmarineroUser);
        }
      }
      if (pRes.data) setPayments(pRes.data as LIPayment[]);
      if (rRes.data) setRoutines(rRes.data as LIRoutine[]);
      if (cRes.data) setClasses(cRes.data as LIClass[]);
      if (aRes.data) setAccessLogs(aRes.data as LIAccessLog[]);
      if (nRes.data) setNotifications(nRes.data as LINotification[]);
      if (ucRes.data) setUserClasses(ucRes.data as LIUserClass[]);
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // =========================================================================
  // INTERACTIVE DEMO MODE ACTIONS (1-Click Simulators for Every Module)
  // =========================================================================
  const runDemoAction = async (
    actionType:
      | 'demo_transfer_pending'
      | 'demo_mp_approved'
      | 'demo_approve_all'
      | 'demo_qr_ok'
      | 'demo_qr_blocked'
      | 'demo_add_routine_day'
      | 'demo_new_athlete'
      | 'demo_bell_expiration'
      | 'demo_bell_classes'
      | 'demo_rate_class'
  ) => {
    setIsRunningDemo(true);
    try {
      const students = users.filter((u) => u.role === 'alumno');
      const targetStudent = students[Math.floor(Math.random() * students.length)] || users[0];

      if (actionType === 'demo_transfer_pending' && targetStudent) {
        const recCode = `DEMO-TRF-${Math.floor(1000 + Math.random() * 9000)}`;
        await supabase
          .from('li_users')
          .update({ payment_status: 'por_validar' })
          .eq('id', targetStudent.id);
        await supabase.from('li_payments').insert({
          receipt_code: recCode,
          user_id: targetStudent.id,
          user_name: targetStudent.full_name,
          user_dni: targetStudent.dni,
          user_avatar: targetStudent.avatar_url,
          plan_name: targetStudent.plan_name || 'Plan Black Intensity',
          amount: targetStudent.monthly_fee || 32000,
          payment_method: 'Transferencia',
          bank_name: 'Banco Galicia (Modo Demo)',
          control_number: `OP-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'pendiente',
        });
        showToast(
          `⚡ Demo: Comprobante ${recCode} de ${targetStudent.full_name} cargado en cola "Por Validar"`,
          'warning'
        );
      } else if (actionType === 'demo_mp_approved' && targetStudent) {
        const recCode = `DEMO-MP-${Math.floor(1000 + Math.random() * 9000)}`;
        await supabase
          .from('li_users')
          .update({ payment_status: 'al_dia' })
          .eq('id', targetStudent.id);
        await supabase.from('li_payments').insert({
          receipt_code: recCode,
          user_id: targetStudent.id,
          user_name: targetStudent.full_name,
          user_dni: targetStudent.dni,
          user_avatar: targetStudent.avatar_url,
          plan_name: targetStudent.plan_name || 'Plan Black Intensity',
          amount: targetStudent.monthly_fee || 32000,
          payment_method: 'Mercado Pago',
          bank_name: 'Mercado Pago Webhook (Demo)',
          control_number: `MP-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'aprobado',
        });
        showToast(
          `⚡ Demo: Pago Mercado Pago ${recCode} acreditado para ${targetStudent.full_name}`,
          'success'
        );
      } else if (actionType === 'demo_approve_all') {
        await supabase
          .from('li_payments')
          .update({ status: 'aprobado' })
          .eq('status', 'pendiente');
        await supabase
          .from('li_users')
          .update({ payment_status: 'al_dia' })
          .eq('payment_status', 'por_validar');
        showToast(
          '⚡ Demo: Todos los comprobantes pendientes fueron aprobados y molinetes destrabados',
          'success'
        );
      } else if (actionType === 'demo_qr_ok' && targetStudent) {
        await supabase.from('li_access_logs').insert({
          user_id: targetStudent.id,
          user_name: targetStudent.full_name,
          user_dni: targetStudent.dni,
          user_role: targetStudent.role,
          user_avatar: targetStudent.avatar_url,
          plan_name: targetStudent.plan_name || 'Plan Black Intensity',
          gate_name: 'Molinete 01 (Modo Demo)',
          status: 'AUTORIZADO',
          reason: 'Demo QR Válido • Relé Destrabado',
        });
        showToast(
          `⚡ Demo Molinete: Ingreso AUTORIZADO para ${targetStudent.full_name}`,
          'success'
        );
      } else if (actionType === 'demo_qr_blocked' && targetStudent) {
        await supabase.from('li_access_logs').insert({
          user_id: targetStudent.id,
          user_name: targetStudent.full_name,
          user_dni: targetStudent.dni,
          user_role: targetStudent.role,
          user_avatar: targetStudent.avatar_url,
          plan_name: targetStudent.plan_name || 'Plan Black Intensity',
          gate_name: 'Molinete 02 (Modo Demo)',
          status: 'BLOQUEADO',
          reason: 'Demo Rechazo por Cuota Vencida',
        });
        showToast(
          `⚡ Demo Molinete: Acceso BLOQUEADO para ${targetStudent.full_name}`,
          'error'
        );
      } else if (actionType === 'demo_add_routine_day' && routines[0]) {
        const r = routines[0];
        const currentDays = Array.isArray(r.days_json) ? r.days_json : [];
        const updatedDays = [
          ...currentDays,
          {
            day: `Día Demo ${currentDays.length + 1}`,
            focus: 'Potencia & Sprints (Demo)',
            duration: '55 min',
            exercises: [
              {
                order: 'A1',
                name: 'Push Press Olímpico con Barra',
                muscle: 'Hombros / Potencia',
                sets: 4,
                reps: '6',
                load: '75kg • RIR 1',
                rest: '120s',
                notes: 'Empuje explosivo de cadera',
              },
              {
                order: 'B1',
                name: 'Dominadas Lastradas Supinas',
                muscle: 'Espalda / Tracción',
                sets: 4,
                reps: '8',
                load: '+15kg • RIR 1',
                rest: '90s',
                notes: 'Rango completo de movimiento',
              },
            ],
          },
        ];
        await supabase
          .from('li_routines')
          .update({
            days_json: updatedDays,
            pdf_file_name: `Plan_Demo_Actualizado_${new Date().getHours()}h${new Date().getMinutes()}m.pdf`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id);
        showToast(
          '⚡ Demo Rutinas: Nuevo día de entrenamiento y PDF agregados automáticamente',
          'success'
        );
      } else if (actionType === 'demo_new_athlete') {
        const randNum = Math.floor(100 + Math.random() * 900);
        const names = [
          'Mateo Pellegrini',
          'Camila Rivas',
          'Bautista Ocampo',
          'Julieta Soriano',
          'Nicolás Villalba',
        ];
        const randomName = names[Math.floor(Math.random() * names.length)];
        await supabase.from('li_users').insert({
          member_code: `LI-D${randNum}`,
          full_name: `${randomName} (Demo)`,
          dni: `41${randNum}882`,
          email: `demo.${randNum}@lifeintensity.com`,
          role: 'alumno',
          plan_name: 'Plan Elite Power',
          monthly_fee: 45000,
          payment_status: 'al_dia',
          due_date: '2026-06-30',
          level: 'Avanzado',
          classes_attended: 5,
          classes_limit: 12,
          google_linked: true,
          avatar_url:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        });
        showToast(
          `⚡ Demo Usuarios: Atleta "${randomName} (Demo)" creado en Supabase`,
          'success'
        );
      } else if (actionType === 'demo_bell_expiration') {
        const targetId = currentUser?.id || targetStudent?.id;
        if (targetId) {
          await supabase.from('li_notifications').insert({
            user_id: targetId,
            title: '⚠️ [Demo] Tu pase está por vencer en 48 hs',
            message:
              'Recordatorio automático: Puedes renovar desde la pestaña Pagos vía Transferencia (subiendo el comprobante) o con el link directo de Mercado Pago.',
            notif_type: 'vencimiento',
            is_read: false,
          });
          showToast(
            '⚡ Demo Campanita: Alerta de vencimiento enviada (mira el ícono 🔔 arriba)',
            'warning'
          );
        }
      } else if (actionType === 'demo_bell_classes') {
        const targetId = currentUser?.id || targetStudent?.id;
        if (targetId) {
          await supabase.from('li_notifications').insert({
            user_id: targetId,
            title: '🎟️ [Demo] Te quedan 2 clases disponibles',
            message:
              'Has asistido a 10 de tus 12 clases del mes. ¡No olvides calificar tu esfuerzo con caras al finalizar hoy!',
            notif_type: 'clases_restantes',
            is_read: false,
          });
          showToast(
            '⚡ Demo Campanita: Alerta de clases restantes enviada (mira el ícono 🔔)',
            'success'
          );
        }
      } else if (actionType === 'demo_rate_class' && userClasses[0]) {
        await supabase
          .from('li_user_classes')
          .update({
            effort_level: 5,
            effort_face: '🤯',
            effort_label: 'Al Límite (Esfuerzo máximo / RPE 10)',
          })
          .eq('id', userClasses[0].id);
        showToast(
          `⚡ Demo Clases: "${userClasses[0].class_title}" calificada con 🤯 Al Límite`,
          'success'
        );
      }

      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast('Error al ejecutar acción Demo', 'error');
    } finally {
      setIsRunningDemo(false);
    }
  };

  const handleDashboardApprovePayment = async (paymentId: string, userId: string) => {
    try {
      const targetPay = payments.find((p) => p.id === paymentId);
      const planCfg = getPlanConfig(targetPay?.plan_name);
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const dueStr = nextMonth.toISOString().split('T')[0];

      await supabase
        .from('li_payments')
        .update({ status: 'aprobado' })
        .eq('id', paymentId);
      if (userId) {
        await supabase
          .from('li_users')
          .update({
            payment_status: 'al_dia',
            plan_name: planCfg.name,
            monthly_fee: planCfg.price,
            classes_limit: planCfg.classesLimit,
            classes_attended: 0,
            due_date: dueStr,
          })
          .eq('id', userId);
        await supabase.from('li_notifications').insert({
          user_id: userId,
          title: `✅ Pago Aceptado • ${
            planCfg.isUnlimited ? 'Pase Libre ∞' : `${planCfg.classesLimit} Clases`
          } acreditadas`,
          message: `El Profesor/Admin aceptó tu pago (${targetPay?.payment_method || 'Efectivo'}). Ya tienes ${
            planCfg.isUnlimited
              ? 'clases ilimitadas (Pase Libre)'
              : `${planCfg.classesLimit} clases disponibles`
          } y tu QR habilitado.`,
          notif_type: 'pago',
          is_read: false,
        });
      }
      showToast(
        `Pago aceptado: ${
          planCfg.isUnlimited ? 'Pase Libre ∞' : `${planCfg.classesLimit} clases`
        } acreditadas y QR activo.`,
        'success'
      );
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDashboardRejectPayment = async (paymentId: string) => {
    try {
      await supabase
        .from('li_payments')
        .update({ status: 'rechazado' })
        .eq('id', paymentId);
      showToast('Comprobante rechazado.', 'warning');
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newDni.trim()) return;
    setIsCreatingUser(true);

    try {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const dueStr = nextMonth.toISOString().split('T')[0];
      const memberCode = `LI-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedCfg = getPlanConfig(newPlanName);

      const { data: insertedUser, error } = await supabase
        .from('li_users')
        .insert({
          member_code: memberCode,
          full_name: newFullName.trim(),
          email:
            newEmail.trim() ||
            `${newFullName.toLowerCase().replace(/\s+/g, '.')}@lifeintensity.com`,
          dni: newDni.trim(),
          phone: '+54 9 11 5500-9900',
          role: newRole,
          avatar_url:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          plan_name: newRole === 'profesor' ? 'Staff Coach' : selectedCfg.name,
          monthly_fee: newRole === 'profesor' ? 0 : Number(selectedCfg.price),
          payment_status: 'al_dia',
          due_date: dueStr,
          specialty: newRole === 'profesor' ? 'Fuerza & Acondicionamiento' : 'Hipertrofia',
          level: 'Intermedio',
          classes_attended: 0,
          classes_limit: selectedCfg.classesLimit,
          weight_kg: 76,
          height_m: 1.76,
          body_fat_pct: 13.5,
          pr_bench_kg: 100,
          pr_squat_kg: 140,
          pr_deadlift_kg: 170,
        })
        .select()
        .single();

      if (error) throw error;

      if (newRole === 'alumno' && insertedUser) {
        await supabase.from('li_payments').insert({
          receipt_code: `ALTA-${Math.floor(10000 + Math.random() * 90000)}`,
          user_id: insertedUser.id,
          user_name: insertedUser.full_name,
          user_dni: insertedUser.dni,
          user_avatar: insertedUser.avatar_url,
          plan_name: selectedCfg.name,
          amount: Number(selectedCfg.price),
          payment_method: newPaymentMethod,
          bank_name:
            newPaymentMethod === 'Efectivo'
              ? 'Caja Efectivo Profesor/Admin'
              : newPaymentMethod === 'Mercado Pago'
              ? 'Mercado Pago'
              : 'Banco Galicia',
          control_number: `CTRL-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'aprobado',
        });
      }

      showToast(
        `Usuario ${newFullName} (${memberCode}) dado de alta con ${
          selectedCfg.isUnlimited ? 'Pase Libre ∞' : `${selectedCfg.classesLimit} clases`
        } disponibles`,
        'success'
      );
      setNewFullName('');
      setNewDni('');
      setNewEmail('');
      setShowNewUserModal(false);
      fetchAllData();
    } catch (err) {
      console.error(err);
      showToast('Error al registrar usuario en Supabase', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (showAuthScreen) {
    return (
      <>
        <AuthView
          users={users}
          isLight={isLight}
          onLoginSuccess={(u) => {
            setCurrentUser(u);
            setShowAuthScreen(false);
            if (u.role === 'alumno') {
              setActiveTab('student_portal');
            } else {
              setActiveTab('dashboard');
            }
          }}
          onRefresh={fetchAllData}
          onShowToast={showToast}
        />
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border bg-[#181B22] border-[#262A34] text-white text-xs font-bold">
            <span className="material-symbols-outlined text-[20px] text-emerald-400">
              check_circle
            </span>
            <span>{toast.message}</span>
          </div>
        )}
      </>
    );
  }

  const pendingReviewsBadge = users.filter(
    (u) => u.role === 'alumno' && u.payment_status === 'por_validar'
  ).length;

  const userNotifications = currentUser
    ? notifications.filter((n) => n.user_id === currentUser.id)
    : notifications.slice(0, 6);
  const unreadBellCount =
    userNotifications.filter((n) => !n.is_read).length ||
    notifications.filter((n) => !n.is_read).length;

  const navItems: {
    id: NavTab;
    label: string;
    shortLabel: string;
    icon: string;
    badge?: number | string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Panel de Control',
      shortLabel: 'Panel',
      icon: 'space_dashboard',
    },
    {
      id: 'payments',
      label: 'Pagos y Deudores',
      shortLabel: 'Pagos',
      icon: 'account_balance_wallet',
      badge: pendingReviewsBadge > 0 ? pendingReviewsBadge : undefined,
    },
    {
      id: 'routines',
      label: 'Rutinas y Planes PDF',
      shortLabel: 'Rutinas',
      icon: 'fitness_center',
    },
    {
      id: 'qr_access',
      label: 'QR y Molinete',
      shortLabel: 'QR',
      icon: 'qr_code_scanner',
    },
    {
      id: 'users_staff',
      label: 'Usuarios y Profesores',
      shortLabel: 'Usuarios',
      icon: 'groups',
    },
    {
      id: 'student_portal',
      label: 'Portal del Alumno',
      shortLabel: 'Alumno',
      icon: 'smartphone',
      badge: 'APP',
    },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-200 pb-20 lg:pb-0 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#111317] text-[#F3F4F6]'
      }`}
    >
      {/* Desktop Collapsible Sidebar (Hidden on Mobile < lg) */}
      <aside
        id="app-sidebar"
        className={`hidden lg:flex ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } shrink-0 border-r transition-all duration-200 flex-col justify-between sticky top-0 h-screen z-30 ${
          isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#14171D] border-[#262A34]'
        }`}
      >
        {/* Top Brand + Nav */}
        <div>
          <div
            className={`h-16 px-4 flex items-center justify-between border-b ${
              isLight ? 'border-slate-200' : 'border-[#262A34]'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-[#FF5722] text-white flex items-center justify-center shrink-0 shadow-md">
                <span className="material-symbols-outlined text-[24px]">bolt</span>
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-base font-extrabold tracking-tight font-display leading-none">
                    LIFE <span className="text-[#FF5722]">INTENSITY</span>
                  </div>
                  <div
                    className={`text-[10px] font-mono uppercase tracking-widest mt-1 ${
                      isLight ? 'text-slate-500' : 'text-gray-400'
                    }`}
                  >
                    SUPERADMIN • DEMO OS
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isLight
                  ? 'text-slate-500 hover:bg-slate-100'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {sidebarCollapsed ? 'left_panel_open' : 'left_panel_close'}
              </span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? isLight
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'bg-[#FF5722] text-white shadow-md'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-100'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                        isActive
                          ? 'bg-white text-black'
                          : item.badge === 'APP'
                          ? 'bg-[#00B4D8]/20 text-[#00B4D8]'
                          : 'bg-amber-500 text-black'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logged-In User & Switch Account */}
        <div
          className={`p-3 border-t space-y-3 ${
            isLight ? 'border-slate-200' : 'border-[#262A34]'
          }`}
        >
          {!sidebarCollapsed && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px]">
              <div className="font-extrabold text-amber-400 flex items-center gap-1">
                <span>👑</span>
                <span>USUARIO: lmarinero</span>
              </div>
              <div className="text-[10px] opacity-80 mt-0.5">
                Acceso Total a Todos los Módulos
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  currentUser?.avatar_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
                }
                alt="User"
                className="w-9 h-9 rounded-full object-cover border-2 border-amber-400"
              />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {currentUser?.full_name || 'Lucas Marinero'}
                  </div>
                  <div
                    className={`text-[10px] font-mono truncate ${
                      isLight ? 'text-slate-500' : 'text-amber-400'
                    }`}
                  >
                    {currentUser?.member_code || 'lmarinero'} • {currentUser?.role.toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                onClick={() => setShowAuthScreen(true)}
                title="Cambiar usuario / Probar Login con Google"
                className="p-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-[#FF5722] hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">switch_account</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer Menu (< lg) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div
            className={`relative w-72 max-w-[85vw] h-full flex flex-col justify-between p-4 z-10 overflow-y-auto ${
              isLight ? 'bg-white text-slate-900' : 'bg-[#14171D] text-white'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-700/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#FF5722] text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">bolt</span>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold font-display">
                      LIFE <span className="text-[#FF5722]">INTENSITY</span>
                    </div>
                    <div className="text-[10px] font-mono text-amber-400">
                      👑 lmarinero (Acceso Total)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition ${
                        isActive
                          ? 'bg-[#FF5722] text-white'
                          : isLight
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[20px]">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-400 text-black">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700/30 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowNewUserModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#FF5722] text-white text-xs font-extrabold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Alta Rápida de Socio
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowAuthScreen(true);
                }}
                className="w-full py-2.5 rounded-xl border border-gray-600 text-xs font-bold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">switch_account</span>
                Pantalla Login / Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Responsive Top Header */}
        <header
          className={`h-14 sm:h-16 px-3 sm:px-6 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md ${
            isLight
              ? 'bg-white/95 border-slate-200'
              : 'bg-[#14171D]/95 border-[#262A34]'
          }`}
        >
          {/* Left: Mobile Menu Button + Active User Badge */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`lg:hidden p-2 rounded-lg border ${
                isLight
                  ? 'border-slate-200 text-slate-700'
                  : 'border-[#262A34] text-white bg-[#181B22]'
              }`}
              title="Abrir menú de gestión"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            <div
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 truncate ${
                isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              <span>👑</span>
              <span className="truncate">
                {currentUser?.member_code === 'lmarinero'
                  ? 'lmarinero (Super Admin)'
                  : currentUser?.full_name || 'lmarinero'}
              </span>
            </div>

            <button
              onClick={() => setDemoBarExpanded(!demoBarExpanded)}
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border transition cursor-pointer ${
                demoBarExpanded
                  ? 'bg-[#00B4D8] text-black border-[#00B4D8]'
                  : 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/30'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">science</span>
              <span>Modo Demo {demoBarExpanded ? 'Activo' : 'Oculto'}</span>
            </button>
          </div>

          {/* Right: Notification Bell + Theme + Login + New User */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 relative shrink-0">
            {/* Notification Bell ("Campanita") */}
            <button
              onClick={() => setShowTopBellDropdown(!showTopBellDropdown)}
              className={`relative p-2 rounded-lg border transition cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-[#181B22] border-[#262A34] text-gray-200 hover:border-[#FF5722]'
              }`}
              title="Campanita de Notificaciones"
            >
              <span className="material-symbols-outlined text-[19px]">notifications</span>
              {unreadBellCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#FF5722] text-white text-[9px] sm:text-[10px] font-mono font-extrabold flex items-center justify-center">
                  {unreadBellCount}
                </span>
              )}
            </button>

            {/* Dropdown for Top Bell */}
            {showTopBellDropdown && (
              <div
                className={`fixed sm:absolute right-3 sm:right-0 top-14 sm:top-12 w-[calc(100vw-24px)] sm:w-96 rounded-xl border shadow-2xl p-4 z-50 space-y-3 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-[#181B22] border-[#262A34] text-white'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-2 border-gray-600/30">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#FF5722]">
                      notifications_active
                    </span>
                    Campanita de Alertas ({notifications.length})
                  </span>
                  <button
                    onClick={() => setShowTopBellDropdown(false)}
                    className="material-symbols-outlined text-sm cursor-pointer"
                  >
                    close
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-lg border text-xs ${
                        !n.is_read
                          ? 'bg-[#FF5722]/10 border-[#FF5722]/40'
                          : 'bg-black/20 border-white/10'
                      }`}
                    >
                      <div className="font-extrabold">{n.title}</div>
                      <p className="text-[11px] opacity-85 mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Theme Mode Switcher */}
            <button
              onClick={() => setIsLight(!isLight)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                isLight
                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  : 'bg-[#181B22] border-[#262A34] text-gray-200 hover:bg-white/5'
              }`}
              title="Cambiar tema visual"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isLight ? 'dark_mode' : 'light_mode'}
              </span>
              <span className="hidden xl:inline">
                {isLight ? 'Modo Dark' : 'Modo Light'}
              </span>
            </button>

            <button
              onClick={() => setShowAuthScreen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 border border-slate-300 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Ver pantalla de Login con Google"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-600">
                account_circle
              </span>
              <span className="hidden md:inline">Login / Google</span>
            </button>

            <button
              onClick={() => setShowNewUserModal(true)}
              className="p-2 sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-bold bg-[#FF5722] hover:bg-[#F4511E] text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Alta rápida de socio"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span className="hidden sm:inline">Nuevo Socio</span>
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* CONTEXTUAL INTERACTIVE DEMO MODE TOOLBAR (FOR ALL MODULES)        */}
        {/* ================================================================= */}
        {demoBarExpanded && (
          <div
            className={`px-3 sm:px-6 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              isLight
                ? 'bg-sky-50 border-sky-200 text-sky-950'
                : 'bg-gradient-to-r from-[#00B4D8]/15 via-[#181B22] to-[#FF5722]/15 border-[#00B4D8]/30 text-white'
            }`}
          >
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00B4D8] text-black text-[10px] font-mono font-extrabold uppercase shrink-0">
                <span className="material-symbols-outlined text-[13px]">bolt</span>
                MODO DEMO INTERACTIVO
              </span>
              <span className="text-xs font-bold truncate">
                Prueba cada función de esta pantalla en 1 clic:
              </span>
              <button
                onClick={() => setDemoBarExpanded(false)}
                className="sm:hidden text-xs opacity-70"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {activeTab === 'dashboard' && (
                <>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_mp_approved')}
                    className="px-2.5 py-1 rounded-lg bg-[#009EE3] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Simular Cobro MP
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_transfer_pending')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-black text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Simular Transferencia por Validar
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_qr_ok')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Simular Ingreso QR
                  </button>
                </>
              )}

              {activeTab === 'payments' && (
                <>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_transfer_pending')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-black text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Recibir Comprobante CBU Demo
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_mp_approved')}
                    className="px-2.5 py-1 rounded-lg bg-[#009EE3] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Simular Pago Mercado Pago
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_approve_all')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Aprobar Toda la Cola
                  </button>
                </>
              )}

              {activeTab === 'routines' && (
                <>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_add_routine_day')}
                    className="px-2.5 py-1 rounded-lg bg-[#FF5722] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Autocompletar Día de Fuerza + PDF Demo
                  </button>
                </>
              )}

              {activeTab === 'qr_access' && (
                <>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_qr_ok')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Simular Pase QR Autorizado
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_qr_blocked')}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Simular Bloqueo Molinete
                  </button>
                </>
              )}

              {activeTab === 'users_staff' && (
                <>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_new_athlete')}
                    className="px-2.5 py-1 rounded-lg bg-[#FF5722] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Generar Atleta Demo Instantáneo
                  </button>
                </>
              )}

              {activeTab === 'student_portal' && (
                <>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_bell_expiration')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-black text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Alerta Vencimiento (🔔)
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_bell_classes')}
                    className="px-2.5 py-1 rounded-lg bg-[#00B4D8] text-black text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Alerta Quedan 2 Clases (🔔)
                  </button>
                  <button
                    disabled={isRunningDemo}
                    onClick={() => runDemoAction('demo_rate_class')}
                    className="px-2.5 py-1 rounded-lg bg-[#FF5722] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    ⚡ Calificar Clase con 🤯
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active View Container (Responsive Padding for Mobile & Desktop) */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto overflow-x-hidden">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-[#FF5722] border-t-transparent animate-spin mx-auto"></div>
              <p className="text-sm font-bold">
                Sincronizando tablas de Life Intensity con Supabase...
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  users={users}
                  payments={payments}
                  accessLogs={accessLogs}
                  classes={classes}
                  isClinicalTheme={isLight}
                  onApprovePayment={handleDashboardApprovePayment}
                  onRejectPayment={handleDashboardRejectPayment}
                  onNavigate={(v) => {
                    if (v === 'pagos' || v === 'payments') setActiveTab('payments');
                    else if (v === 'rutinas' || v === 'routines') setActiveTab('routines');
                    else if (v === 'qr' || v === 'qr_access') setActiveTab('qr_access');
                    else if (v === 'usuarios' || v === 'users_staff') setActiveTab('users_staff');
                    else if (v === 'portal' || v === 'student_portal')
                      setActiveTab('student_portal');
                    else setActiveTab('dashboard');
                  }}
                  onQuickAction={(act) => {
                    if (act === 'new_user') setShowNewUserModal(true);
                    else if (act === 'new_payment') setActiveTab('payments');
                    else if (act === 'qr_scan') setActiveTab('qr_access');
                  }}
                />
              )}

              {activeTab === 'payments' && (
                <PaymentsView
                  users={users}
                  payments={payments}
                  isLight={isLight}
                  onRefresh={fetchAllData}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'routines' && (
                <RoutinesView
                  users={users}
                  routines={routines}
                  isLight={isLight}
                  onRefresh={fetchAllData}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'qr_access' && (
                <QrAccessView
                  users={users}
                  accessLogs={accessLogs}
                  isLight={isLight}
                  onRefresh={fetchAllData}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'users_staff' && (
                <UsersStaffView
                  users={users}
                  isLight={isLight}
                  onRefresh={fetchAllData}
                  onOpenNewUserModal={() => setShowNewUserModal(true)}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'student_portal' && (
                <StudentPortalView
                  users={users}
                  payments={payments}
                  routines={routines}
                  classes={classes}
                  notifications={notifications}
                  userClasses={userClasses}
                  accessLogs={accessLogs}
                  loggedInUser={currentUser}
                  isLight={isLight}
                  onRefresh={fetchAllData}
                  onShowToast={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* ================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR FOR ADMIN & STAFF (< lg screens)     */}
      {/* ================================================================= */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t grid grid-cols-6 gap-0.5 px-1 py-1.5 shadow-2xl ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-700'
            : 'bg-[#14171D]/95 border-[#262A34] text-gray-400'
        } backdrop-blur-md`}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 rounded-lg transition ${
                isActive
                  ? 'text-[#FF5722] font-extrabold'
                  : 'hover:text-current opacity-80'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-[9px] mt-0.5 truncate max-w-full px-0.5">
                {item.shortLabel}
              </span>
              {item.badge !== undefined && typeof item.badge === 'number' && (
                <span className="absolute top-0.5 right-2 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-mono font-extrabold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Modal: Alta de Nuevo Socio / Profesor */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-lg border p-6 space-y-4 shadow-2xl ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#181B22] border-[#262A34] text-white'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200/40 dark:border-[#262A34]">
              <h3 className="text-lg font-extrabold font-display">
                Alta Rápida en Life Intensity
              </h3>
              <button
                onClick={() => setShowNewUserModal(false)}
                className="material-symbols-outlined text-gray-400 hover:text-white cursor-pointer"
              >
                close
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Nombre y Apellido</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ej: Valentín Gómez"
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#111317] border-[#262A34] text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={newDni}
                    onChange={(e) => setNewDni(e.target.value)}
                    placeholder="40.123.456"
                    className={`w-full px-3 py-2 rounded-lg text-sm border font-mono ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Rol</label>
                  <select
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(e.target.value as 'alumno' | 'profesor' | 'admin')
                    }
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  >
                    <option value="alumno">Alumno / Atleta</option>
                    <option value="profesor">Profesor / Coach</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="atleta@lifeintensity.com"
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#111317] border-[#262A34] text-white'
                  }`}
                />
              </div>

              {newRole === 'alumno' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Plan de Clases</label>
                    <select
                      value={newPlanName}
                      onChange={(e) => {
                        const cfg = getPlanConfig(e.target.value);
                        setNewPlanName(cfg.name);
                        setNewPlanPrice(cfg.price);
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#111317] border-[#262A34] text-white'
                      }`}
                    >
                      {GYM_PLANS.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} (${p.price.toLocaleString('es-AR')} •{' '}
                          {p.isUnlimited ? '∞ Libre' : `${p.classesLimit} clases`})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Medio de Pago</label>
                    <select
                      value={newPaymentMethod}
                      onChange={(e) =>
                        setNewPaymentMethod(
                          e.target.value as 'Efectivo' | 'Mercado Pago' | 'Transferencia'
                        )
                      }
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#111317] border-[#262A34] text-white'
                      }`}
                    >
                      <option value="Efectivo">Efectivo (Acepta Profesor/Admin)</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#FF5722] text-white cursor-pointer"
                >
                  {isCreatingUser ? 'Guardando en Supabase...' : 'Confirmar Alta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-16 lg:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border bg-[#181B22] border-[#262A34] text-white text-xs font-bold">
          <span
            className={`material-symbols-outlined text-[20px] shrink-0 ${
              toast.type === 'success'
                ? 'text-emerald-400'
                : toast.type === 'warning'
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {toast.type === 'success'
              ? 'check_circle'
              : toast.type === 'warning'
              ? 'warning'
              : 'error'}
          </span>
          <span className="truncate">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
export default App;
