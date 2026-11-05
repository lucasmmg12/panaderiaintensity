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
  const [activeTab, setActiveTab] = useState<NavTab>('student_portal');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isLight, setIsLight] = useState<boolean>(false);

  // Logged-in user state (null shows AuthView or can be toggled)
  const [currentUser, setCurrentUser] = useState<LIUser | null>(null);
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(true);
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
  const [newPlanName, setNewPlanName] = useState('Plan Black Intensity');
  const [newPlanPrice, setNewPlanPrice] = useState(32000);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'Mercado Pago' | 'Transferencia'>(
    'Mercado Pago'
  );
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
          setCurrentUser(loadedUsers.find((u) => u.role === 'alumno') || loadedUsers[0]);
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

  const handleDashboardApprovePayment = async (paymentId: string, userId: string) => {
    try {
      await supabase
        .from('li_payments')
        .update({ status: 'aprobado' })
        .eq('id', paymentId);
      if (userId) {
        await supabase
          .from('li_users')
          .update({ payment_status: 'al_dia' })
          .eq('id', userId);
        await supabase.from('li_notifications').insert({
          user_id: userId,
          title: '✅ Pago validado por Administración',
          message: 'Tu comprobante fue aprobado y tu credencial QR de molinete está habilitada.',
          notif_type: 'pago',
          is_read: false,
        });
      }
      showToast('Comprobante aprobado y molinete QR habilitado.', 'success');
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
          plan_name: newRole === 'profesor' ? 'Staff Coach' : newPlanName,
          monthly_fee: newRole === 'profesor' ? 0 : Number(newPlanPrice),
          payment_status: 'al_dia',
          due_date: dueStr,
          specialty: newRole === 'profesor' ? 'Fuerza & Acondicionamiento' : 'Hipertrofia',
          level: 'Intermedio',
          classes_attended: 1,
          classes_limit: 12,
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
          plan_name: newPlanName,
          amount: Number(newPlanPrice),
          payment_method: newPaymentMethod,
          bank_name: newPaymentMethod === 'Mercado Pago' ? 'Mercado Pago' : 'Banco Galicia',
          control_number: `CTRL-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'aprobado',
        });
      }

      showToast(
        `Usuario ${newFullName} (${memberCode}) dado de alta en Supabase con QR habilitado`,
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
  const unreadBellCount = userNotifications.filter((n) => !n.is_read).length;

  const navItems: {
    id: NavTab;
    label: string;
    icon: string;
    badge?: number | string;
  }[] = [
    {
      id: 'student_portal',
      label: 'Portal del Alumno',
      icon: 'smartphone',
      badge: 'MI CUENTA',
    },
    {
      id: 'dashboard',
      label: 'Panel de Control',
      icon: 'space_dashboard',
    },
    {
      id: 'payments',
      label: 'Pagos y Deudores',
      icon: 'account_balance_wallet',
      badge: pendingReviewsBadge > 0 ? pendingReviewsBadge : undefined,
    },
    {
      id: 'routines',
      label: 'Rutinas y Planes PDF',
      icon: 'fitness_center',
    },
    {
      id: 'qr_access',
      label: 'QR y Molinete',
      icon: 'qr_code_scanner',
    },
    {
      id: 'users_staff',
      label: 'Usuarios y Profesores',
      icon: 'groups',
    },
  ];

  return (
    <div
      className={`min-h-screen flex transition-colors duration-200 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#111317] text-[#F3F4F6]'
      }`}
    >
      {/* Collapsible Sidebar */}
      <aside
        id="app-sidebar"
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } shrink-0 border-r transition-all duration-200 flex flex-col justify-between sticky top-0 h-screen z-30 ${
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
                    PRO GYM OS v2.6
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
                          : item.badge === 'MI CUENTA'
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

        {/* Bottom Logged-In User & Logout / Switch Account */}
        <div
          className={`p-3 border-t space-y-3 ${
            isLight ? 'border-slate-200' : 'border-[#262A34]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  currentUser?.avatar_url ||
                  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=120'
                }
                alt="User"
                className="w-9 h-9 rounded-full object-cover border border-[#FF5722]"
              />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {currentUser?.full_name || 'Usuario Activo'}
                  </div>
                  <div
                    className={`text-[10px] font-mono truncate ${
                      isLight ? 'text-slate-500' : 'text-gray-400'
                    }`}
                  >
                    {currentUser?.google_linked ? 'Google Vinculado ✓' : currentUser?.email}
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                onClick={() => setShowAuthScreen(true)}
                title="Cambiar cuenta / Iniciar sesión con Google"
                className="p-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-[#FF5722] hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header
          className={`h-16 px-6 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md ${
            isLight
              ? 'bg-white/95 border-slate-200'
              : 'bg-[#14171D]/90 border-[#262A34]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-[#181B22] border-[#262A34] text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#FF5722]">
                person
              </span>
              Sesión: {currentUser?.full_name} ({currentUser?.role.toUpperCase()})
            </span>
          </div>

          <div className="flex items-center gap-2.5 relative">
            {/* Global Notification Bell ("Campanita") */}
            <button
              onClick={() => setShowTopBellDropdown(!showTopBellDropdown)}
              className={`relative p-2 rounded-lg border transition cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-[#181B22] border-[#262A34] text-gray-200 hover:border-[#FF5722]'
              }`}
              title="Notificaciones de Vencimiento y Clases"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadBellCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF5722] text-white text-[10px] font-mono font-extrabold flex items-center justify-center">
                  {unreadBellCount}
                </span>
              )}
            </button>

            {/* Dropdown for Top Bell */}
            {showTopBellDropdown && (
              <div
                className={`absolute right-0 top-12 w-80 sm:w-96 rounded-xl border shadow-2xl p-4 z-50 space-y-3 ${
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
                    Campanita de Alertas ({userNotifications.length})
                  </span>
                  <button
                    onClick={() => setShowTopBellDropdown(false)}
                    className="material-symbols-outlined text-sm cursor-pointer"
                  >
                    close
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {userNotifications.map((n) => (
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                isLight
                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  : 'bg-[#181B22] border-[#262A34] text-gray-200 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isLight ? 'dark_mode' : 'light_mode'}
              </span>
              <span className="hidden md:inline">
                {isLight ? 'Modo Dark' : 'Modo Clínico Light'}
              </span>
            </button>

            <button
              onClick={() => setShowAuthScreen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 border border-slate-300 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-blue-600">
                account_circle
              </span>
              <span className="hidden sm:inline">Login / Google</span>
            </button>
          </div>
        </header>

        {/* Active View Container */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
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
                    <label className="block text-xs font-bold mb-1">Plan</label>
                    <select
                      value={newPlanName}
                      onChange={(e) => {
                        setNewPlanName(e.target.value);
                        if (e.target.value.includes('Elite')) setNewPlanPrice(45000);
                        else if (e.target.value.includes('Black')) setNewPlanPrice(32000);
                        else setNewPlanPrice(24000);
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#111317] border-[#262A34] text-white'
                      }`}
                    >
                      <option value="Plan Black Intensity">Plan Black ($32.000)</option>
                      <option value="Plan Elite Power">Plan Elite ($45.000)</option>
                      <option value="Plan Musculación Base">Plan Base ($24.000)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Medio de Pago</label>
                    <select
                      value={newPaymentMethod}
                      onChange={(e) =>
                        setNewPaymentMethod(
                          e.target.value as 'Mercado Pago' | 'Transferencia'
                        )
                      }
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#111317] border-[#262A34] text-white'
                      }`}
                    >
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
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border bg-[#181B22] border-[#262A34] text-white text-xs font-bold">
          <span
            className={`material-symbols-outlined text-[20px] ${
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
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
export default App;
