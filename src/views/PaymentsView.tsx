import React, { useState } from 'react';
import {
  LIUser,
  LIPayment,
  GYM_PLANS,
  getPlanConfig,
  isUnlimitedPlan,
  supabase,
} from '../lib/supabase';

interface PaymentsViewProps {
  users: LIUser[];
  payments: LIPayment[];
  isLight: boolean;
  onRefresh: () => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  users,
  payments,
  isLight,
  onRefresh,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    users.find((u) => u.payment_status === 'por_validar')?.id || users[0]?.id || ''
  );
  const [overridePlanName, setOverridePlanName] = useState<string>('');
  const [overrideMethod, setOverrideMethod] = useState<
    'Efectivo' | 'Transferencia' | 'Mercado Pago'
  >('Efectivo');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReceiptZoom, setShowReceiptZoom] = useState(false);

  const students = users.filter((u) => u.role === 'alumno');

  const getStudentMethod = (userId: string) => {
    const p = payments.find((pay) => pay.user_id === userId);
    return p?.payment_method || 'Efectivo';
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.dni.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.payment_status === statusFilter;
    const method = getStudentMethod(s.id);
    const matchesMethod = methodFilter === 'ALL' || method === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const selectedStudent =
    students.find((s) => s.id === selectedUserId) || filteredStudents[0] || students[0];
  const selectedPayment = payments.find((p) => p.user_id === selectedStudent?.id);

  const activePlanForSelected = getPlanConfig(
    overridePlanName || selectedPayment?.plan_name || selectedStudent?.plan_name
  );

  // Financial KPIs
  const totalCollected = payments
    .filter((p) => p.status === 'aprobado')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const mpCollected = payments
    .filter((p) => p.status === 'aprobado' && p.payment_method === 'Mercado Pago')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const cashAndTransferCollected = totalCollected - mpCollected;

  const pendingReviewsCount = students.filter((s) => s.payment_status === 'por_validar').length;
  const debtorsCount = students.filter((s) => s.payment_status === 'vencido').length;
  const debtorsAmount = students
    .filter((s) => s.payment_status === 'vencido')
    .reduce((acc, s) => acc + Number(s.monthly_fee || 0), 0);

  // =========================================================================
  // ACCEPT PAYMENT (PROFESOR / ADMIN) & CREDIT 8, 12 OR PASE LIBRE CLASSES
  // =========================================================================
  const handleApprovePayment = async (
    student: LIUser,
    customPlanName?: string,
    customMethod?: 'Efectivo' | 'Transferencia' | 'Mercado Pago'
  ) => {
    if (!student) return;
    setIsUpdating(true);
    try {
      const planCfg = getPlanConfig(
        customPlanName || overridePlanName || selectedPayment?.plan_name || student.plan_name
      );
      const payMethod =
        customMethod ||
        (selectedPayment?.payment_method as 'Efectivo' | 'Transferencia' | 'Mercado Pago') ||
        overrideMethod ||
        'Efectivo';

      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      const nextDueStr = nextDueDate.toISOString().split('T')[0];

      // 1. Update Student: Set Al Día + Recharge exact class credits (8, 12, or 999 for Pase Libre)
      await supabase
        .from('li_users')
        .update({
          payment_status: 'al_dia',
          plan_name: planCfg.name,
          monthly_fee: planCfg.price,
          classes_limit: planCfg.classesLimit,
          classes_attended: 0, // Reset attended counter so all credits are available!
          due_date: nextDueStr,
        })
        .eq('id', student.id);

      // 2. Approve existing pending payment or insert new approved payment
      if (selectedPayment && selectedPayment.user_id === student.id) {
        await supabase
          .from('li_payments')
          .update({
            status: 'aprobado',
            plan_name: planCfg.name,
            amount: planCfg.price,
            payment_method: payMethod,
          })
          .eq('id', selectedPayment.id);
      } else {
        await supabase.from('li_payments').insert({
          receipt_code: `APR-${Math.floor(10000 + Math.random() * 90000)}`,
          user_id: student.id,
          user_name: student.full_name,
          user_dni: student.dni,
          user_avatar: student.avatar_url,
          plan_name: planCfg.name,
          amount: planCfg.price,
          payment_method: payMethod,
          bank_name:
            payMethod === 'Efectivo'
              ? 'Efectivo Aceptado por Profesor/Admin'
              : payMethod === 'Mercado Pago'
              ? 'Mercado Pago'
              : 'Transferencia Bancaria',
          control_number: `OK-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'aprobado',
        });
      }

      // 3. Send Notification to Student's Bell ("Campanita")
      const creditsText = planCfg.isUnlimited
        ? 'PASE LIBRE ILIMITADO (∞ clases)'
        : `${planCfg.classesLimit} CLASES DISPONIBLES`;

      await supabase.from('li_notifications').insert([
        {
          user_id: student.id,
          title: `✅ Pago en ${payMethod} Aceptado`,
          message: `El Profesor/Admin aceptó tu pago de $${planCfg.price.toLocaleString(
            'es-AR'
          )} (${planCfg.name}). Ya tienes acreditadas tus ${creditsText} y el molinete QR habilitado hasta el ${nextDueStr}.`,
          notif_type: 'clases_restantes',
          is_read: false,
        },
      ]);

      setOverridePlanName('');
      onShowToast(
        `¡Pago en ${payMethod} aceptado! ${student.full_name} ahora tiene ${creditsText}.`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al aceptar el pago en Supabase', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectPayment = async (student: LIUser) => {
    if (!student) return;
    setIsUpdating(true);
    try {
      await supabase
        .from('li_users')
        .update({
          payment_status: 'vencido',
          classes_attended: student.classes_limit || 8, // 0 remaining
        })
        .eq('id', student.id);

      if (selectedPayment) {
        await supabase
          .from('li_payments')
          .update({
            status: 'rechazado',
          })
          .eq('id', selectedPayment.id);
      }

      await supabase.from('li_notifications').insert({
        user_id: student.id,
        title: '⚠️ Pago pendiente de regularización',
        message:
          'Tu pago no pudo ser validado. Por favor acércate al profesor o sube nuevamente tu comprobante para habilitar tus clases.',
        notif_type: 'pago',
        is_read: false,
      });

      onShowToast(
        `Pago rechazado para ${student.full_name}. Sin créditos disponibles y QR bloqueado.`,
        'warning'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al rechazar comprobante', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyMPLink = (student: LIUser) => {
    const slug = student.full_name.toLowerCase().replace(/\s+/g, '-');
    const url = `https://mpago.la/life-intensity-${slug}`;
    navigator.clipboard?.writeText(url);
    onShowToast(`Link de Mercado Pago copiado: ${url}`, 'success');
  };

  const renderClassesBadge = (student: LIUser) => {
    const unlimited = isUnlimitedPlan(student);
    if (student.payment_status === 'vencido') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30">
          0 Clases (Bloqueado)
        </span>
      );
    }
    if (unlimited) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          ∞ Pase Libre Activo
        </span>
      );
    }
    const limit = student.classes_limit || 12;
    const remaining = Math.max(0, limit - (student.classes_attended || 0));
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
          remaining <= 2
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-[#00B4D8]/15 text-[#00B4D8] border-[#00B4D8]/30'
        }`}
      >
        🎟️ {remaining} de {limit} disp.
      </span>
    );
  };

  const cardClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm text-slate-900'
    : 'bg-[#181B22] border border-[#262A34] text-[#F3F4F6]';

  const mutedText = isLight ? 'text-slate-500' : 'text-[#9CA3AF]';

  return (
    <div className="space-y-6">
      {/* Page Title & Action Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#FF5722] mb-1">
            <span>CAJA, RECEPCIÓN Y ACREDITACIÓN DE CLASES</span>
            <span>/</span>
            <span className={mutedText}>PLANES 8, 12 Y PASE LIBRE ∞</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">
            Control de Pagos y Acreditación de Clases
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Cuando el Profesor o Admin acepta un pago en <strong>Efectivo</strong> o <strong>Transferencia</strong>, el sistema acredita automáticamente las <strong>8 clases, 12 clases o Pase Libre ∞</strong> al alumno.
          </p>
        </div>

        {/* Plan Reference Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {GYM_PLANS.map((pl) => (
            <div
              key={pl.id}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${pl.badgeColor}`}
            >
              <span>{pl.name}:</span>
              <span className="font-mono">${pl.price.toLocaleString('es-AR')}</span>
              <span className="opacity-75">({pl.shortName})</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className={`p-5 rounded-lg ${cardClass} relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>
              Recaudación Mes Actual
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight">
            ${(totalCollected > 0 ? totalCollected : 4850000).toLocaleString('es-AR')}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[15px]">trending_up</span>
              +18.4% vs mes ant.
            </span>
            <span className={`font-mono text-[11px] ${mutedText}`}>
              MP ${(mpCollected || 3120000).toLocaleString('es-AR')} · Efec/Transf $
              {(cashAndTransferCollected || 1730000).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className={`p-5 rounded-lg ${cardClass} relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>
              Pagos Esperando Aceptación
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-amber-500">
              {pendingReviewsCount}
            </span>
            <span className={`text-xs ${mutedText}`}>efectivo / transf. por aceptar</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-amber-500 font-semibold">Profesor o Admin debe aceptar</span>
            <button
              onClick={() => setStatusFilter('por_validar')}
              className="text-xs font-bold underline text-[#FF5722] cursor-pointer"
            >
              Ver pendientes
            </button>
          </div>
        </div>

        {/* KPI 3 */}
        <div className={`p-5 rounded-lg ${cardClass} relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>
              Morosidad / Sin Clases
            </span>
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-[20px]">gpp_bad</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-red-500">
              ${(debtorsAmount || 368000).toLocaleString('es-AR')}
            </span>
            <span className={`text-xs font-mono ${mutedText}`}>({debtorsCount} socios)</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-red-400 font-medium">0 clases disp. • QR bloqueado</span>
            <button
              onClick={() => setStatusFilter('vencido')}
              className="text-xs font-bold underline text-red-400 cursor-pointer"
            >
              Ver deudores
            </button>
          </div>
        </div>

        {/* KPI 4 */}
        <div className={`p-5 rounded-lg ${cardClass} relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>
              Acreditación de Clases
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#00B4D8]/10 border border-[#00B4D8]/25 flex items-center justify-center text-[#00B4D8]">
              <span className="material-symbols-outlined text-[20px]">confirmation_number</span>
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono tracking-tight text-[#00B4D8]">
            8 · 12 · Pase Libre ∞
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className={`text-[11px] ${mutedText}`}>Recarga instantánea al aceptar</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold">
              AUTO-SYNC
            </span>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Left Table (8 cols) + Right Acceptance Drawer (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Debtors & Payments Table */}
        <div className={`xl:col-span-8 rounded-lg ${cardClass} overflow-hidden`}>
          {/* Filter Bar */}
          <div
            className={`p-4 border-b ${
              isLight ? 'border-slate-200 bg-slate-50/70' : 'border-[#262A34] bg-[#14171D]'
            } flex flex-col md:flex-row md:items-center justify-between gap-3`}
          >
            <div className="relative flex-1">
              <span
                className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] ${mutedText}`}
              >
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por socio, DNI o plan..."
                className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#FF5722]/40 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#111317] border-[#262A34] text-white'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: 'Todos' },
                  { id: 'por_validar', label: 'Por Aceptar' },
                  { id: 'al_dia', label: 'Al Día' },
                  { id: 'vencido', label: 'Vencidos' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-[#FF5722] text-white shadow-sm'
                      : isLight
                      ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-[#181B22] border border-[#262A34] text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-700'
                    : 'bg-[#181B22] border-[#262A34] text-gray-300'
                }`}
              >
                <option value="ALL">Todos los medios</option>
                <option value="Efectivo">Efectivo (Profesor/Caja)</option>
                <option value="Transferencia">Transferencia CBU</option>
                <option value="Mercado Pago">Mercado Pago</option>
              </select>
            </div>
          </div>

          {/* Mobile Responsive Card List (< md) */}
          <div className="md:hidden divide-y divide-slate-200/40 dark:divide-[#262A34]">
            {filteredStudents.map((student) => {
              const isSelected = selectedStudent?.id === student.id;
              const studentMethod = getStudentMethod(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => {
                    setSelectedUserId(student.id);
                    document
                      .getElementById('voucher-inspector')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`p-4 space-y-3 transition ${
                    isSelected
                      ? isLight
                        ? 'bg-orange-50/70'
                        : 'bg-[#FF5722]/10'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={student.avatar_url}
                        alt={student.full_name}
                        className="w-10 h-10 rounded-full object-cover border border-[#FF5722]/40 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold truncate">
                          {student.full_name}
                        </div>
                        <div className={`text-xs font-mono ${mutedText}`}>
                          {student.plan_name} • {studentMethod}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold font-mono text-[#FF5722]">
                        ${Number(student.monthly_fee || 32000).toLocaleString('es-AR')}
                      </div>
                      <div className="mt-0.5">{renderClassesBadge(student)}</div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      {student.payment_status === 'al_dia' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                          ● AL DÍA
                        </span>
                      )}
                      {student.payment_status === 'por_validar' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">
                          ● ESPERANDO ACEPTACIÓN
                        </span>
                      )}
                      {student.payment_status === 'vencido' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-500">
                          ● VENCIDO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleApprovePayment(student)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-600 text-white shadow"
                      >
                        ✓ Aceptar Pago y Dar Clases
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className={`text-[11px] font-bold uppercase tracking-wider border-b ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-[#14171D] border-[#262A34] text-[#9CA3AF]'
                  }`}
                >
                  <th className="py-3.5 px-4">Socio / DNI</th>
                  <th className="py-3.5 px-4">Plan & Clases Acreditadas</th>
                  <th className="py-3.5 px-4">Estado Pago</th>
                  <th className="py-3.5 px-4">Medio</th>
                  <th className="py-3.5 px-4 text-right">Acción Profesor / Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-[#262A34]">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id;
                  const studentMethod = getStudentMethod(student.id);
                  const isBlocked = student.payment_status === 'vencido';
                  return (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedUserId(student.id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? isLight
                            ? 'bg-orange-50/70'
                            : 'bg-[#FF5722]/10'
                          : isLight
                          ? 'hover:bg-slate-50'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatar_url}
                            alt={student.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-[#FF5722]/30"
                          />
                          <div>
                            <div className="text-sm font-bold flex items-center gap-1.5">
                              <span>{student.full_name}</span>
                              {isBlocked && (
                                <span
                                  title="Molinete QR bloqueado"
                                  className="material-symbols-outlined text-[15px] text-red-500"
                                >
                                  lock
                                </span>
                              )}
                            </div>
                            <div className={`text-xs font-mono ${mutedText}`}>
                              DNI {student.dni} • Vence {student.due_date || '2026-06-10'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold">{student.plan_name}</span>
                          <span className="text-xs font-bold font-mono text-[#FF5722]">
                            ${Number(student.monthly_fee || 32000).toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="mt-1">{renderClassesBadge(student)}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {student.payment_status === 'al_dia' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ACEPTADO / AL DÍA
                          </span>
                        )}
                        {student.payment_status === 'por_validar' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            PENDIENTE ACEPTAR
                          </span>
                        )}
                        {student.payment_status === 'vencido' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-500 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            VENCIDO / SIN CLASES
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            studentMethod === 'Mercado Pago'
                              ? 'text-[#009EE3]'
                              : studentMethod === 'Efectivo'
                              ? 'text-emerald-400'
                              : mutedText
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {studentMethod === 'Mercado Pago'
                              ? 'account_balance_wallet'
                              : studentMethod === 'Efectivo'
                              ? 'payments'
                              : 'receipt_long'}
                          </span>
                          {studentMethod}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleApprovePayment(student)}
                            className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-sm"
                          >
                            ✓ Aceptar Pago
                          </button>
                          <button
                            onClick={() => setSelectedUserId(student.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                              isLight
                                ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                : 'border-[#262A34] text-gray-300 hover:bg-white/5'
                            } cursor-pointer`}
                          >
                            Configurar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Profesor / Admin Payment Acceptance & Class Credit Drawer */}
        <div
          id="voucher-inspector"
          className={`xl:col-span-4 rounded-lg ${cardClass} p-4 sm:p-5 sticky top-20 space-y-5`}
        >
          <div className="flex items-center justify-between border-b pb-3 border-slate-200/40 dark:border-[#262A34]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5722]">verified</span>
              <h2 className="text-base font-extrabold tracking-tight font-display">
                Aceptar Pago y Acreditar Clases
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF5722]/15 text-[#FF5722]">
              {selectedPayment?.receipt_code || '#CAJA-001'}
            </span>
          </div>

          {selectedStudent ? (
            <>
              {/* Selected Student Header */}
              <div className="flex items-center gap-3">
                <img
                  src={selectedStudent.avatar_url}
                  alt={selectedStudent.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#FF5722]"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold truncate">{selectedStudent.full_name}</h3>
                  <p className={`text-xs font-mono ${mutedText}`}>
                    DNI {selectedStudent.dni} • {renderClassesBadge(selectedStudent)}
                  </p>
                </div>
              </div>

              {/* Step 1: Select Plan to Credit (8, 12, or Pase Libre) */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#00B4D8]">
                  1. Plan y Cantidad de Clases a Acreditar:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GYM_PLANS.map((pl) => {
                    const isSelected = activePlanForSelected.id === pl.id;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => setOverridePlanName(pl.name)}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF5722]/15 border-[#FF5722] text-white ring-1 ring-[#FF5722]'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-[#111317] border-[#262A34] text-gray-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold">{pl.shortName}</div>
                        <div className="text-[11px] font-mono text-[#FF5722] font-bold mt-0.5">
                          ${pl.price.toLocaleString('es-AR')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Payment Method Received (Efectivo / Transferencia / MP) */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-400">
                  2. Medio de Pago Recibido por Profesor/Admin:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Efectivo', 'Transferencia', 'Mercado Pago'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOverrideMethod(m)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        overrideMethod === m
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-[#111317] border-[#262A34] text-gray-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Box of What Will Happen on Accept */}
              <div
                className={`rounded-xl border p-4 space-y-2 text-xs font-mono ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#111317] border-[#262A34]'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-emerald-400 border-b border-gray-700/40 pb-1.5">
                  <span>RESUMEN DE ACREDITACIÓN</span>
                  <span>{overrideMethod.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedText}>Plan Seleccionado:</span>
                  <span className="font-bold">{activePlanForSelected.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedText}>Clases a Acreditar:</span>
                  <span className="font-extrabold text-[#00B4D8]">
                    {activePlanForSelected.isUnlimited
                      ? '∞ PASE LIBRE ILIMITADO'
                      : `${activePlanForSelected.classesLimit} CLASES DISPONIBLES`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedText}>Importe a Cobrar:</span>
                  <span className="font-extrabold text-emerald-400">
                    ${activePlanForSelected.price.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedText}>Molinete QR:</span>
                  <span className="font-bold text-emerald-400">SE HABILITA AL INSTANTE</span>
                </div>
              </div>

              {/* Approve / Reject Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  disabled={isUpdating}
                  onClick={() =>
                    handleApprovePayment(
                      selectedStudent,
                      activePlanForSelected.name,
                      overrideMethod
                    )
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Aceptar Pago y Acreditar {activePlanForSelected.shortName}
                </button>

                <button
                  disabled={isUpdating}
                  onClick={() => handleRejectPayment(selectedStudent)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-red-600/15 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Rechazar Pago y Bloquear Clases
                </button>
              </div>
            </>
          ) : (
            <p className={`text-sm ${mutedText}`}>Selecciona un socio de la tabla para auditar.</p>
          )}
        </div>
      </div>
    </div>
  );
};
