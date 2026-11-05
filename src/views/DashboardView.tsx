import React from 'react';
import { LIUser, LIPayment, LIClass, LIAccessLog } from '../lib/supabase';

interface DashboardViewProps {
  users: LIUser[];
  payments: LIPayment[];
  classes: LIClass[];
  accessLogs: LIAccessLog[];
  isClinicalTheme: boolean;
  onApprovePayment: (paymentId: string, userId: string) => void;
  onRejectPayment: (paymentId: string) => void;
  onNavigate: (view: string) => void;
  onQuickAction: (action: 'new_user' | 'new_payment' | 'qr_scan') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  users,
  payments,
  classes,
  accessLogs,
  isClinicalTheme,
  onApprovePayment,
  onRejectPayment,
  onNavigate,
  onQuickAction
}) => {
  const [period, setPeriod] = React.useState<'month' | 'quarter'>('month');
  const [remindedIds, setRemindedIds] = React.useState<string[]>([]);
  const [massSent, setMassSent] = React.useState(false);

  const alumnos = users.filter(u => u.role === 'alumno');
  const pendingPayments = payments.filter(p => p.status === 'pendiente');
  const approvedPayments = payments.filter(p => p.status === 'aprobado');
  const overdueUsers = alumnos.filter(u => u.payment_status === 'vencido');

  const totalRevenue = approvedPayments.reduce((acc, p) => acc + Number(p.amount), 0) + (period === 'month' ? 3407000 : 9850000);
  const totalReceivable = overdueUsers.reduce((acc, u) => acc + Number(u.monthly_fee), 0) + 450000;

  const cardBg = isClinicalTheme
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-surface-container border-slate-800/80 text-white shadow-md';

  const subCardBg = isClinicalTheme
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-surface-container-low border-slate-800/60 text-slate-100';

  const mutedText = isClinicalTheme ? 'text-slate-500' : 'text-slate-400';
  const primaryAccent = isClinicalTheme ? 'text-blue-600' : 'text-energy-orange-bright';
  const primaryBtn = isClinicalTheme
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-energy-orange hover:bg-energy-orange-bright text-white';

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Top Banner / Control Bar */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 ${isClinicalTheme ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex flex-col">
          <div className={`flex items-center gap-1.5 mb-1 ${primaryAccent}`}>
            <span className="material-symbols-outlined text-[18px]">electric_bolt</span>
            <span className="font-headline uppercase tracking-widest text-xs font-bold">
              LIFE INTENSITY LIVE MONITOR · VÍNCULOS QUE SUMAN
            </span>
          </div>
          <h1 className={`font-headline text-2xl md:text-3xl uppercase tracking-tight font-bold ${isClinicalTheme ? 'text-slate-900' : 'text-white'}`}>
            HOLA, MARTÍN 👋{' '}
            <span className={`text-xs font-body font-normal normal-case tracking-normal ml-2 ${mutedText}`}>
              Alto Rendimiento & Auditoría Operativa en Tiempo Real
            </span>
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Sede Belgrano operando en intensidad programada: aforo al{' '}
            <span className="text-emerald-500 font-semibold">86%</span> en turnos pico.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Period Selector */}
          <div className={`flex items-center p-1 rounded-lg border ${isClinicalTheme ? 'bg-slate-100 border-slate-200' : 'bg-surface-container border-slate-800'}`}>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3.5 py-1.5 rounded-lg font-headline uppercase tracking-wider text-xs transition-all ${
                period === 'month'
                  ? primaryBtn + ' shadow-sm'
                  : mutedText + ' hover:opacity-80'
              }`}
            >
              Este mes
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className={`px-3.5 py-1.5 rounded-lg font-headline uppercase tracking-wider text-xs transition-all ${
                period === 'quarter'
                  ? primaryBtn + ' shadow-sm'
                  : mutedText + ' hover:opacity-80'
              }`}
            >
              Último trimestre
            </button>
          </div>

          <button
            onClick={() => onQuickAction('new_user')}
            className={`flex items-center gap-2 font-headline uppercase tracking-wider text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all active:scale-95 ${primaryBtn}`}
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>+ Nuevo Atleta</span>
          </button>

          <button
            onClick={() => onQuickAction('qr_scan')}
            className={`flex items-center gap-2 font-headline uppercase tracking-wider text-xs px-4 py-2.5 rounded-lg border transition-all active:scale-95 ${
              isClinicalTheme
                ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                : 'bg-surface-container-high border-slate-700 text-white hover:bg-surface-bright'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-telemetry-cyan">qr_code_scanner</span>
            <span>Simular Paso QR</span>
          </button>
        </div>
      </div>

      {/* 4 High Impact KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Facturación */}
        <div className={`p-5 rounded-lg border transition-all relative overflow-hidden flex flex-col justify-between ${cardBg}`}>
          <div className="flex items-start justify-between">
            <span className={`font-headline tracking-wider text-xs uppercase font-semibold ${mutedText}`}>
              Facturación ({period === 'month' ? 'Mes' : 'Trimestre'})
            </span>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isClinicalTheme ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'}`}>
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="font-headline text-3xl tracking-tight leading-none font-bold">
              ${totalRevenue.toLocaleString('es-AR')}{' '}
              <span className={`text-xs font-body font-semibold ${mutedText}`}>ARS</span>
            </span>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-bold">
                <span className="material-symbols-outlined text-[13px]">trending_up</span> +14.2%
              </span>
              <span className={`text-xs font-medium ${mutedText}`}>vs periodo anterior</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Atletas Activos */}
        <div className={`p-5 rounded-lg border transition-all relative overflow-hidden flex flex-col justify-between ${cardBg}`}>
          <div className="flex items-start justify-between">
            <span className={`font-headline tracking-wider text-xs uppercase font-semibold ${mutedText}`}>
              Atletas Activos
            </span>
            <div className="w-9 h-9 rounded-lg bg-telemetry-cyan/15 border border-telemetry-cyan/30 flex items-center justify-center text-telemetry-cyan">
              <span className="material-symbols-outlined text-[18px]">fitness_center</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="font-headline text-3xl tracking-tight leading-none font-bold">
              {411 + alumnos.length}{' '}
              <span className={`text-xs font-body font-semibold ${mutedText}`}>socios</span>
            </span>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-telemetry-cyan/15 text-telemetry-cyan border border-telemetry-cyan/30 text-xs font-bold">
                94% Retención
              </span>
              <span className="text-xs text-emerald-500 font-semibold">+{alumnos.length} en base activa</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Ocupación Horas Pico */}
        <div className={`p-5 rounded-lg border transition-all relative overflow-hidden flex flex-col justify-between ${cardBg}`}>
          <div className="flex items-start justify-between">
            <span className={`font-headline tracking-wider text-xs uppercase font-semibold ${mutedText}`}>
              Ocupación Horas Pico
            </span>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isClinicalTheme ? 'bg-slate-100 text-blue-600' : 'bg-surface-container-high text-energy-orange-bright'}`}>
              <span className="material-symbols-outlined text-[18px]">speed</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <div className="flex items-baseline justify-between">
              <span className="font-headline text-3xl tracking-tight leading-none font-bold">86%</span>
              <span className="text-xs text-telemetry-cyan font-bold font-headline uppercase tracking-wider">18:00 - 21:00 hs</span>
            </div>
            <div className={`mt-3 w-full rounded-full h-2 overflow-hidden flex ${isClinicalTheme ? 'bg-slate-200' : 'bg-surface-container-highest'}`}>
              <div className={isClinicalTheme ? 'bg-blue-600 h-full' : 'bg-energy-orange h-full'} style={{ width: '54%' }}></div>
              <div className="bg-telemetry-cyan h-full" style={{ width: '24%' }}></div>
              <div className="bg-emerald-500 h-full" style={{ width: '8%' }}></div>
            </div>
            <span className={`mt-2 text-xs truncate ${mutedText}`}>Intensity Cross (98%) · Fuerza (84%)</span>
          </div>
        </div>

        {/* KPI 4: Saldo Por Cobrar */}
        <div className={`p-5 rounded-lg border transition-all relative overflow-hidden flex flex-col justify-between ${cardBg}`}>
          <div className="flex items-start justify-between">
            <span className={`font-headline tracking-wider text-xs uppercase font-semibold ${mutedText}`}>
              Saldo Por Cobrar
            </span>
            <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="font-headline text-3xl tracking-tight leading-none font-bold text-red-500">
              ${totalReceivable.toLocaleString('es-AR')}{' '}
              <span className={`text-xs font-body font-semibold ${mutedText}`}>ARS</span>
            </span>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-red-500/15 text-red-500 border border-red-500/30 text-xs font-bold">
                {overdueUsers.length + 32} cuotas pendientes
              </span>
              <span className={`text-xs ${mutedText}`}>{pendingPayments.length} por validar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Financial Chart & Pending Vouchers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart Section (8 cols) */}
        <div className={`lg:col-span-8 p-6 rounded-lg border flex flex-col justify-between ${cardBg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-headline text-lg uppercase tracking-wide font-bold">
                Evolución de Ingresos y Cobros
              </h2>
              <p className={`text-xs ${mutedText}`}>
                Rendimiento semanal clasificado por canal de pago (Sincronizado con Supabase)
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isClinicalTheme ? 'bg-blue-600' : 'bg-energy-orange-bright'}`}></span>
                <span className={`text-xs font-medium ${mutedText}`}>Mercado Pago (68%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-telemetry-cyan"></span>
                <span className={`text-xs font-medium ${mutedText}`}>Transferencias (24%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className={`text-xs font-medium ${mutedText}`}>Efectivo (8%)</span>
              </div>
            </div>
          </div>

          {/* SVG Curve Area */}
          <div className="relative w-full h-52 pt-2">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 680 180">
              <defs>
                <linearGradient id="primaryGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={isClinicalTheme ? '#2563eb' : '#ea580c'} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={isClinicalTheme ? '#2563eb' : '#ea580c'} stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="secondaryGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00b4d8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line stroke={isClinicalTheme ? '#e2e8f0' : '#2a2d35'} strokeDasharray="4 4" strokeWidth="1" x1="0" x2="680" y1="30" y2="30" />
              <line stroke={isClinicalTheme ? '#e2e8f0' : '#2a2d35'} strokeDasharray="4 4" strokeWidth="1" x1="0" x2="680" y1="80" y2="80" />
              <line stroke={isClinicalTheme ? '#e2e8f0' : '#2a2d35'} strokeDasharray="4 4" strokeWidth="1" x1="0" x2="680" y1="130" y2="130" />
              <line stroke={isClinicalTheme ? '#cbd5e1' : '#334155'} strokeWidth="1" x1="0" x2="680" y1="170" y2="170" />
              <path d="M 0,140 Q 110,95 220,105 T 440,55 T 680,30 L 680,170 L 0,170 Z" fill="url(#primaryGrad)" />
              <path d="M 0,160 Q 110,135 220,140 T 440,115 T 680,95 L 680,170 L 0,170 Z" fill="url(#secondaryGrad)" />
              <path d="M 0,140 Q 110,95 220,105 T 440,55 T 680,30" fill="none" stroke={isClinicalTheme ? '#2563eb' : '#f97316'} strokeLinecap="round" strokeWidth="3" />
              <path d="M 0,160 Q 110,135 220,140 T 440,115 T 680,95" fill="none" stroke="#00b4d8" strokeLinecap="round" strokeWidth="2.5" />
              <path d="M 0,165 Q 110,158 220,160 T 440,150 T 680,142" fill="none" stroke="#10b981" strokeLinecap="round" strokeWidth="2" />
              <circle cx="440" cy="55" fill={isClinicalTheme ? '#2563eb' : '#f97316'} r="4.5" />
              <circle cx="680" cy="30" fill={isClinicalTheme ? '#2563eb' : '#f97316'} r="5" />
            </svg>
          </div>

          <div className={`flex justify-between items-center px-2 pt-3 font-headline uppercase tracking-wider text-xs ${mutedText}`}>
            <span>Sem 01 (01-07)</span>
            <span>Sem 02 (08-14)</span>
            <span>Sem 03 (15-21)</span>
            <span className={`font-bold ${primaryAccent}`}>Sem 04 (Actual)</span>
          </div>

          <div className={`mt-4 pt-4 p-4 rounded-lg border grid grid-cols-1 sm:grid-cols-3 gap-3 ${subCardBg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${isClinicalTheme ? 'bg-blue-100 text-blue-600' : 'bg-orange-500/15 text-orange-400'}`}>
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-medium uppercase tracking-wider font-headline ${mutedText}`}>Mercado Pago (68%)</span>
                <span className="font-headline text-base font-bold tracking-wide">$2.346.000</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-telemetry-cyan/15 text-telemetry-cyan flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-medium uppercase tracking-wider font-headline ${mutedText}`}>Transferencia (24%)</span>
                <span className="font-headline text-base font-bold tracking-wide">$828.000</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[18px]">payments</span>
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-medium uppercase tracking-wider font-headline ${mutedText}`}>Efectivo Mostrador (8%)</span>
                <span className="font-headline text-base font-bold tracking-wide">$276.000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Receipts Awaiting Validation (4 cols) */}
        <div className={`lg:col-span-4 p-6 rounded-lg border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="font-headline text-lg uppercase tracking-wide font-bold">Validar Comprobantes</h2>
                <span className="px-2 py-0.5 rounded-lg bg-red-500/15 text-red-500 text-xs font-bold border border-red-500/30">
                  {pendingPayments.length} pend.
                </span>
              </div>
              <button
                onClick={() => onNavigate('pagos')}
                className={`font-headline uppercase tracking-wider text-xs font-bold hover:underline ${primaryAccent}`}
              >
                Ver todos
              </button>
            </div>
            <p className={`text-xs mb-4 ${mutedText}`}>
              Transferencias recibidas pendientes de conciliación en Supabase.
            </p>

            <div className="flex flex-col gap-2.5">
              {pendingPayments.length === 0 ? (
                <div className={`p-6 rounded-lg border text-center ${subCardBg}`}>
                  <span className="material-symbols-outlined text-emerald-500 text-3xl mb-1">verified</span>
                  <p className="text-xs font-bold uppercase tracking-wider">¡Todos los comprobantes al día!</p>
                  <p className={`text-[11px] mt-1 ${mutedText}`}>No hay transferencias pendientes de validación.</p>
                </div>
              ) : (
                pendingPayments.map(v => (
                  <div
                    key={v.id}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-all ${subCardBg}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={v.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={v.user_name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-500/30"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-headline uppercase tracking-wide text-xs font-bold truncate">
                          {v.user_name}
                        </span>
                        <span className={`text-xs font-bold ${primaryAccent}`}>
                          ${Number(v.amount).toLocaleString('es-AR')} · {v.plan_name}
                        </span>
                        <span className={`text-[11px] truncate ${mutedText}`}>
                          {v.bank_name || v.payment_method} · {v.receipt_code}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onApprovePayment(v.id, v.user_id)}
                        className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-sm"
                        title="Aprobar pago en Supabase"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </button>
                      <button
                        onClick={() => onRejectPayment(v.id)}
                        className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-all border border-red-500/30"
                        title="Rechazar comprobante"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isClinicalTheme ? 'border-slate-200' : 'border-slate-800'} ${mutedText}`}>
            <span className="font-headline uppercase tracking-wider text-[11px]">Sync Hook MercadoPago Bot</span>
            <span className="flex items-center gap-1.5 text-emerald-500 font-bold font-headline uppercase tracking-wider text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Activo
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Operational Hub (3 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stream 1: Check-in / Accesos QR en Vivo */}
        <div className={`p-6 rounded-lg border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-telemetry-cyan animate-ping"></span>
                <h3 className="font-headline text-lg uppercase tracking-wide font-bold">Accesos en Puerta (QR)</h3>
              </div>
              <span className={`font-headline uppercase tracking-wider text-xs font-bold ${primaryAccent}`}>Molinete 01</span>
            </div>
            <p className={`text-xs mb-4 ${mutedText}`}>Ingresos registrados en tiempo real vía código dinámico.</p>
            <div className="flex flex-col gap-2.5">
              {accessLogs.slice(0, 4).map(log => (
                <div
                  key={log.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${subCardBg}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={log.user_avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100'}
                      alt={log.user_name}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline uppercase tracking-wide text-xs font-bold truncate">
                        {log.user_name}
                      </span>
                      <span className={`text-[11px] truncate ${mutedText}`}>
                        DNI {log.user_dni} · {log.plan_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-headline uppercase tracking-wide border ${
                        log.status === 'AUTORIZADO'
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-500 border-red-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigate('qr')}
            className={`mt-4 w-full py-2.5 rounded-lg font-headline uppercase tracking-wider text-xs border transition-colors flex items-center justify-center gap-1.5 font-bold ${subCardBg} hover:opacity-90`}
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
            <span>Abrir Monitor de Molinete ({accessLogs.length})</span>
          </button>
        </div>

        {/* Stream 2: Próxima Hora Turnos */}
        <div className={`p-6 rounded-lg border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[20px] ${primaryAccent}`}>alarm</span>
                <h3 className="font-headline text-lg uppercase tracking-wide font-bold">Grilla de Clases Hoy</h3>
              </div>
              <span className="font-headline uppercase tracking-wider text-xs text-telemetry-cyan font-bold">
                {classes.reduce((acc, c) => acc + c.enrolled, 0)} Reservas
              </span>
            </div>
            <p className={`text-xs mb-4 ${mutedText}`}>Clases y ocupación técnica programada en sede.</p>
            <div className="flex flex-col gap-2.5">
              {classes.slice(0, 4).map(cls => {
                const pct = Math.round((cls.enrolled / cls.capacity) * 100);
                return (
                  <div
                    key={cls.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${subCardBg}`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-headline uppercase tracking-wide text-xs font-bold truncate">
                          {cls.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-headline uppercase font-bold ${primaryBtn}`}>
                          {cls.room_box}
                        </span>
                      </div>
                      <span className={`text-[11px] truncate ${mutedText}`}>
                        {cls.coach_name} · {cls.start_time} hs
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-headline text-sm font-bold ${pct >= 100 ? 'text-amber-500' : 'text-telemetry-cyan'}`}>
                        {cls.enrolled} / {cls.capacity}
                      </span>
                      <span className={`block text-[10px] ${mutedText}`}>{pct}% cupo</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => onNavigate('mobile')}
            className={`mt-4 w-full py-2.5 rounded-lg font-headline uppercase tracking-wider text-xs border transition-colors flex items-center justify-center gap-1.5 font-bold ${subCardBg} hover:opacity-90`}
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            <span>Gestionar Reservas en App Alumno</span>
          </button>
        </div>

        {/* Stream 3: Vencimientos y Morosidad */}
        <div className={`p-6 rounded-lg border flex flex-col justify-between ${cardBg}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[20px]">notification_important</span>
                <h3 className="font-headline text-lg uppercase tracking-wide font-bold">Alertas de Cobranza</h3>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-red-500/15 text-red-500 text-xs font-headline uppercase tracking-wider font-bold">
                Acción Rápida
              </span>
            </div>
            <p className={`text-xs mb-4 ${mutedText}`}>Avisos automáticos por WhatsApp con link Mercado Pago.</p>
            <div className="flex flex-col gap-2.5">
              {overdueUsers.map(u => {
                const sent = remindedIds.includes(u.id) || massSent;
                return (
                  <div
                    key={u.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${subCardBg}`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-headline uppercase tracking-wide text-xs font-bold truncate">
                          {u.full_name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 text-[10px] font-headline uppercase font-bold">
                          Vencido
                        </span>
                      </div>
                      <span className={`text-[11px] truncate ${mutedText}`}>
                        {u.plan_name} · ${Number(u.monthly_fee).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <button
                      disabled={sent}
                      onClick={() => setRemindedIds(prev => [...prev, u.id])}
                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-headline uppercase tracking-wider text-xs transition-all ${
                        sent
                          ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 cursor-default'
                          : primaryBtn
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {sent ? 'done_all' : 'send'}
                      </span>
                      <span>{sent ? 'Enviado' : 'WhatsApp'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            disabled={massSent}
            onClick={() => setMassSent(true)}
            className={`mt-4 w-full py-2.5 rounded-lg font-headline uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm font-bold ${
              massSent ? 'bg-emerald-600 text-white' : primaryBtn
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {massSent ? 'check_circle' : 'forward_to_inbox'}
            </span>
            <span>
              {massSent ? 'Recordatorios Masivos Enviados' : `Disparar Recordatorio Masivo (${overdueUsers.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

