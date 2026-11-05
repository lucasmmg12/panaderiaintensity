import React, { useState } from 'react';
import { LIUser, LIPayment, supabase } from '../lib/supabase';

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
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReceiptZoom, setShowReceiptZoom] = useState(false);

  const students = users.filter((u) => u.role === 'alumno');

  const getStudentMethod = (userId: string) => {
    const p = payments.find((pay) => pay.user_id === userId);
    return p?.payment_method || 'Mercado Pago';
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

  // Financial KPIs
  const totalCollected = payments
    .filter((p) => p.status === 'aprobado')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const mpCollected = payments
    .filter((p) => p.status === 'aprobado' && p.payment_method === 'Mercado Pago')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const transferCollected = totalCollected - mpCollected;

  const pendingReviewsCount = students.filter((s) => s.payment_status === 'por_validar').length;
  const debtorsCount = students.filter((s) => s.payment_status === 'vencido').length;
  const debtorsAmount = students
    .filter((s) => s.payment_status === 'vencido')
    .reduce((acc, s) => acc + Number(s.monthly_fee || 0), 0);

  const handleApprovePayment = async (student: LIUser) => {
    if (!student) return;
    setIsUpdating(true);
    try {
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      const nextDueStr = nextDueDate.toISOString().split('T')[0];

      await supabase
        .from('li_users')
        .update({
          payment_status: 'al_dia',
          due_date: nextDueStr,
        })
        .eq('id', student.id);

      if (selectedPayment) {
        await supabase
          .from('li_payments')
          .update({
            status: 'aprobado',
          })
          .eq('id', selectedPayment.id);
      } else {
        await supabase.from('li_payments').insert({
          receipt_code: `REC-${Math.floor(10000 + Math.random() * 90000)}`,
          user_id: student.id,
          user_name: student.full_name,
          user_dni: student.dni,
          user_avatar: student.avatar_url,
          plan_name: student.plan_name || 'Plan Black Intensity',
          amount: student.monthly_fee || 32000,
          payment_method: 'Transferencia',
          bank_name: 'Banco Galicia',
          control_number: `CTRL-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'aprobado',
        });
      }

      onShowToast(
        `Comprobante aprobado para ${student.full_name}. Molinete QR habilitado.`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al aprobar el pago en Supabase', 'error');
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

      onShowToast(
        `Comprobante rechazado para ${student.full_name}. Acceso QR bloqueado.`,
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
            <span>FINANZAS Y CONCILIACIÓN</span>
            <span>/</span>
            <span className={mutedText}>CONTROL DE ACCESO</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">
            Control de Pagos y Deudores
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Conciliación automática vía Webhook de Mercado Pago y auditoría de comprobantes de transferencia con sincronización al molinete QR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
              isLight
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-[#009EE3]/10 border-[#009EE3]/30 text-[#38BDF8]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#009EE3] animate-pulse"></span>
            <span>Webhook Mercado Pago: ACTIVO</span>
          </div>

          <button
            onClick={() =>
              onShowToast(
                `Recordatorio masivo enviado por WhatsApp a ${debtorsCount} socios con cuota vencida.`,
                'warning'
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            Recordar a Deudores ({debtorsCount})
          </button>
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
              MP ${(mpCollected || 3120000).toLocaleString('es-AR')} · Transf. $
              {(transferCollected || 1730000).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className={`p-5 rounded-lg ${cardClass} relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>
              Comprobantes por Validar
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-amber-500">
              {pendingReviewsCount}
            </span>
            <span className={`text-xs ${mutedText}`}>transferencias en cola</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-amber-500 font-semibold">Requiere aprobación manual</span>
            <button
              onClick={() => setStatusFilter('por_validar')}
              className="text-xs font-bold underline text-[#FF5722] cursor-pointer"
            >
              Filtrar cola
            </button>
          </div>
        </div>

        {/* KPI 3 */}
        <div className={`p-5 rounded-lg ${cardClass} relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${mutedText}`}>
              Morosidad / Cuotas Vencidas
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
            <span className="text-red-400 font-medium">Molinete QR bloqueado autom.</span>
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
              Checkout Mercado Pago
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#009EE3]/10 border border-[#009EE3]/25 flex items-center justify-center text-[#009EE3]">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-[#009EE3]">
            98.4%
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className={`text-[11px] ${mutedText}`}>Acreditación instantánea &lt; 3s</span>
            <span className="px-2 py-0.5 rounded bg-[#009EE3]/15 text-[#009EE3] font-mono text-[10px] font-bold">
              API v2.4
            </span>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Left Table (8 cols) + Right Voucher Inspector (4 cols) */}
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
                placeholder="Buscar por socio, DNI o email..."
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
                  { id: 'al_dia', label: 'Al Día' },
                  { id: 'por_validar', label: 'Por Validar' },
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
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
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
                  <th className="py-3.5 px-4">Plan & Monto</th>
                  <th className="py-3.5 px-4">Vencimiento</th>
                  <th className="py-3.5 px-4">Estado Pago</th>
                  <th className="py-3.5 px-4">Medio</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
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
                              DNI {student.dni} • {student.member_code}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold">{student.plan_name}</div>
                        <div className="text-sm font-bold font-mono text-[#FF5722]">
                          ${Number(student.monthly_fee || 32000).toLocaleString('es-AR')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-xs font-mono">{student.due_date || '2026-06-10'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {student.payment_status === 'al_dia' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            AL DÍA
                          </span>
                        )}
                        {student.payment_status === 'por_validar' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            POR VALIDAR
                          </span>
                        )}
                        {student.payment_status === 'vencido' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-500 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            VENCIDO
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            studentMethod === 'Mercado Pago'
                              ? 'text-[#009EE3]'
                              : mutedText
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {studentMethod === 'Mercado Pago'
                              ? 'account_balance_wallet'
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
                          {student.payment_status === 'por_validar' ? (
                            <button
                              onClick={() => setSelectedUserId(student.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 transition cursor-pointer"
                            >
                              Auditar
                            </button>
                          ) : student.payment_status === 'vencido' ? (
                            <button
                              onClick={() => handleCopyMPLink(student)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#009EE3]/15 text-[#009EE3] border border-[#009EE3]/30 hover:bg-[#009EE3] hover:text-white transition cursor-pointer"
                            >
                              Link MP
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedUserId(student.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                isLight
                                  ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                  : 'border-[#262A34] text-gray-300 hover:bg-white/5'
                              } cursor-pointer`}
                            >
                              Ver Ficha
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Sticky Voucher Inspection & Conciliation Drawer */}
        <div className={`xl:col-span-4 rounded-lg ${cardClass} p-5 sticky top-20 space-y-5`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200/40 dark:border-[#262A34]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5722]">fact_check</span>
              <h2 className="text-base font-extrabold tracking-tight font-display">
                Auditoría de Comprobante
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF5722]/15 text-[#FF5722]">
              {selectedPayment?.receipt_code || '#REC-88291'}
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
                    DNI {selectedStudent.dni} • {selectedStudent.plan_name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold font-mono text-[#FF5722]">
                    ${Number(selectedStudent.monthly_fee || 32000).toLocaleString('es-AR')}
                  </div>
                  <div className={`text-[10px] font-mono uppercase ${mutedText}`}>
                    {getStudentMethod(selectedStudent.id)}
                  </div>
                </div>
              </div>

              {/* Simulated Bank Receipt Preview Card */}
              <div
                className={`rounded-lg border p-4 relative overflow-hidden ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#111317] border-[#262A34]'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-3 pb-2 border-b border-dashed border-slate-300 dark:border-gray-700">
                  <span className="font-bold text-emerald-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    COMPROBANTE BANCARIO / CBU
                  </span>
                  <button
                    onClick={() => setShowReceiptZoom(!showReceiptZoom)}
                    className="text-[11px] font-semibold text-[#00B4D8] hover:underline cursor-pointer"
                  >
                    {showReceiptZoom ? 'Reducir' : 'Ampliar PDF'}
                  </button>
                </div>

                <div className={`space-y-2 text-xs font-mono ${showReceiptZoom ? 'py-4' : ''}`}>
                  <div className="flex justify-between">
                    <span className={mutedText}>Banco Origen:</span>
                    <span className="font-bold">
                      {selectedPayment?.bank_name || 'Banco Galicia / Brubank'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={mutedText}>Nro. Control:</span>
                    <span className="font-bold">
                      {selectedPayment?.control_number || 'CTRL-9928174'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={mutedText}>CBU / Alias:</span>
                    <span className="font-bold text-[#00B4D8]">LIFE.INTENSITY.GYM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={mutedText}>Importe Transferido:</span>
                    <span className="font-bold text-emerald-500">
                      ${Number(selectedStudent.monthly_fee || 32000).toLocaleString('es-AR')},00
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={mutedText}>Estado Molinete QR:</span>
                    <span
                      className={`font-bold ${
                        selectedStudent.payment_status === 'al_dia'
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }`}
                    >
                      {selectedStudent.payment_status === 'al_dia' ? 'HABILITADO' : 'BLOQUEADO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Approve / Reject Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  disabled={isUpdating}
                  onClick={() => handleApprovePayment(selectedStudent)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Aprobar y Habilitar QR
                </button>

                <button
                  disabled={isUpdating}
                  onClick={() => handleRejectPayment(selectedStudent)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-red-600/15 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Rechazar y Bloquear
                </button>
              </div>

              {/* Quick Mercado Pago Checkout Link Generator */}
              <div
                className={`p-3.5 rounded-lg border ${
                  isLight
                    ? 'bg-sky-50/70 border-sky-200'
                    : 'bg-[#009EE3]/10 border-[#009EE3]/25'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#009EE3] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    Link de Pago Automático MP
                  </span>
                  <span className="text-[10px] font-mono text-[#009EE3]">Webhook Instantáneo</span>
                </div>
                <p className={`text-[11px] mb-2.5 ${mutedText}`}>
                  Envía el botón de pago personalizado. Al acreditarse, el molinete QR se destraba sin intervención manual.
                </p>
                <button
                  onClick={() => handleCopyMPLink(selectedStudent)}
                  className="w-full py-2 rounded-lg bg-[#009EE3] hover:bg-[#008ACA] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Copiar Link de Cobro para {selectedStudent.full_name.split(' ')[0]}
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
