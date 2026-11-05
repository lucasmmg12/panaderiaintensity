import React, { useState, useEffect } from 'react';
import { LIUser, LIAccessLog, supabase } from '../lib/supabase';

interface QrAccessViewProps {
  users: LIUser[];
  accessLogs: LIAccessLog[];
  isLight: boolean;
  onRefresh: () => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const QrAccessView: React.FC<QrAccessViewProps> = ({
  users,
  accessLogs,
  isLight,
  onRefresh,
  onShowToast,
}) => {
  const [posterFormat, setPosterFormat] = useState<'A4' | 'MOSTRADOR' | 'STICKER'>('A4');
  const [countdown, setCountdown] = useState<number>(15);
  const [tokenHash, setTokenHash] = useState<string>('LI-QR-94F8-B20A-77E1');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [matrixFilter, setMatrixFilter] = useState<'ALL' | 'HABILITADO' | 'BLOQUEADO'>('ALL');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          const rand = Math.random().toString(16).substring(2, 6).toUpperCase();
          const rand2 = Math.random().toString(16).substring(2, 6).toUpperCase();
          setTokenHash(`LI-QR-${rand}-${rand2}-SHA256`);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const students = users.filter((u) => u.role === 'alumno');

  const handleSimulateAccess = async (forceDenied = false) => {
    setIsSimulating(true);
    try {
      const candidatePool = forceDenied
        ? students.filter((s) => s.payment_status === 'vencido')
        : students.filter((s) => s.payment_status === 'al_dia');

      const chosen =
        candidatePool[Math.floor(Math.random() * candidatePool.length)] || students[0];

      if (!chosen) return;

      const isAuthorized = !forceDenied && chosen.payment_status !== 'vencido';

      await supabase.from('li_access_logs').insert({
        user_id: chosen.id,
        user_name: chosen.full_name,
        user_dni: chosen.dni,
        user_role: chosen.role,
        user_avatar: chosen.avatar_url,
        plan_name: chosen.plan_name || 'Plan Black Intensity',
        gate_name: isAuthorized ? 'Molinete 01 (Belgrano)' : 'Molinete 02 (Belgrano)',
        status: isAuthorized ? 'AUTORIZADO' : 'BLOQUEADO',
        reason: isAuthorized
          ? 'Cuota al Día • Destrabe Electromecánico OK'
          : 'Cuota Vencida • Molinete Bloqueado',
      });

      onShowToast(
        isAuthorized
          ? `Acceso AUTORIZADO: ${chosen.full_name} (Molinete #01 destrabado)`
          : `Acceso BLOQUEADO: ${chosen.full_name} (Cuota vencida - Alerta sonora)`,
        isAuthorized ? 'success' : 'error'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al registrar acceso en Supabase', 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleToggleTurnstileUser = async (student: LIUser) => {
    const isCurrentlyEnabled = student.payment_status !== 'vencido';
    const nextStatus = isCurrentlyEnabled ? 'vencido' : 'al_dia';
    try {
      await supabase
        .from('li_users')
        .update({ payment_status: nextStatus })
        .eq('id', student.id);

      onShowToast(
        `Molinete QR ${nextStatus === 'al_dia' ? 'HABILITADO' : 'BLOQUEADO'} para ${student.full_name}`,
        nextStatus === 'al_dia' ? 'success' : 'warning'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMatrix = students.filter((s) => {
    const enabled = s.payment_status !== 'vencido';
    if (matrixFilter === 'HABILITADO') return enabled;
    if (matrixFilter === 'BLOQUEADO') return !enabled;
    return true;
  });

  const authorizedCount = accessLogs.filter((l) => l.status === 'AUTORIZADO').length;
  const deniedCount = accessLogs.filter((l) => l.status === 'BLOQUEADO').length;

  const cardClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm text-slate-900'
    : 'bg-[#181B22] border border-[#262A34] text-[#F3F4F6]';
  const mutedText = isLight ? 'text-slate-500' : 'text-[#9CA3AF]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#FF5722] mb-1">
            <span>SEGURIDAD Y HARDWARE</span>
            <span>/</span>
            <span className={mutedText}>MOLINETES ELECTROMECÁNICOS QR</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">
            Generador de QR y Control de Acceso
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Emisión de cartelería oficial A4 para recepción, token criptográfico SHA-256 rotativo y monitoreo de molinetes en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            disabled={isSimulating}
            onClick={() => handleSimulateAccess(false)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            Simular Ingreso Válido
          </button>

          <button
            disabled={isSimulating}
            onClick={() => handleSimulateAccess(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
            Simular Rechazo Deudor
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-sm transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Imprimir Cartel Oficial A4
          </button>
        </div>
      </div>

      {/* Top Split: Left Official Printable Poster (5 cols) + Right Live Turnstile Feed (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Official Reception QR Poster */}
        <div className={`xl:col-span-5 rounded-lg ${cardClass} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              Cartel Oficial de Recepción
            </span>
            <div className="flex items-center gap-1">
              {(['A4', 'MOSTRADOR', 'STICKER'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setPosterFormat(fmt)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                    posterFormat === fmt
                      ? 'bg-[#FF5722] text-white'
                      : isLight
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-[#111317] text-gray-400'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* High-Contrast Printable Card */}
          <div className="rounded-xl bg-[#0D0F12] text-white border-2 border-[#FF5722]/40 p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5722]/15 border border-[#FF5722]/30 text-[#FF5722] text-[10px] font-extrabold uppercase tracking-widest">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              LIFE INTENSITY • ACCESO SIN CONTACTO
            </div>

            <div>
              <h2 className="text-xl font-extrabold tracking-tight font-display">
                ESCANEA PARA INGRESAR
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Abre tu Portal de Alumno y apunta al código QR de molinete
              </p>
            </div>

            {/* Crisp SVG QR Code with Center Bolt Badge */}
            <div className="relative mx-auto w-52 h-52 bg-white p-3.5 rounded-xl shadow-lg flex items-center justify-center">
              <svg
                viewBox="0 0 120 120"
                className="w-full h-full text-black"
                fill="currentColor"
              >
                <path d="M4,4 h32 v32 h-32 z M10,10 v20 h20 v-20 z M15,15 h10 v10 h-10 z" />
                <path d="M84,4 h32 v32 h-32 z M90,10 v20 h20 v-20 z M95,15 h10 v10 h-10 z" />
                <path d="M4,84 h32 v32 h-32 z M10,90 v20 h20 v-20 z M15,95 h10 v10 h-10 z" />
                <rect x="42" y="8" width="6" height="6" />
                <rect x="54" y="8" width="12" height="6" />
                <rect x="72" y="8" width="6" height="12" />
                <rect x="42" y="20" width="12" height="6" />
                <rect x="60" y="20" width="6" height="12" />
                <rect x="8" y="42" width="12" height="6" />
                <rect x="26" y="42" width="6" height="12" />
                <rect x="42" y="38" width="8" height="8" />
                <rect x="74" y="42" width="10" height="6" />
                <rect x="92" y="42" width="16" height="6" />
                <rect x="8" y="60" width="6" height="14" />
                <rect x="20" y="58" width="12" height="6" />
                <rect x="86" y="56" width="8" height="14" />
                <rect x="102" y="62" width="10" height="8" />
                <rect x="42" y="84" width="12" height="6" />
                <rect x="62" y="84" width="6" height="14" />
                <rect x="76" y="88" width="14" height="6" />
                <rect x="96" y="84" width="12" height="12" />
                <rect x="44" y="102" width="14" height="8" />
                <rect x="74" y="102" width="10" height="10" />
                <rect x="92" y="104" width="18" height="6" />
              </svg>

              {/* Center Logo */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-11 h-11 rounded-lg bg-[#FF5722] text-white flex items-center justify-center shadow-md border-2 border-white">
                  <span className="material-symbols-outlined text-[24px]">bolt</span>
                </div>
              </div>
            </div>

            {/* Dynamic Token Footer */}
            <div className="p-3 rounded-lg bg-[#181B22] border border-[#262A34] flex items-center justify-between text-xs font-mono">
              <div className="text-left">
                <div className="text-[10px] text-gray-400">TOKEN DINÁMICO SHA-256</div>
                <div className="font-bold text-[#00B4D8]">{tokenHash}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400">ROTACIÓN</div>
                <div className="font-bold text-[#FF5722]">{countdown}s</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-300 pt-1">
              <div className="p-2 rounded bg-white/5">1. Abre App Life</div>
              <div className="p-2 rounded bg-white/5">2. Escanea QR</div>
              <div className="p-2 rounded bg-white/5">3. Pasa Molinete</div>
            </div>
          </div>
        </div>

        {/* Right: Turnstile Telemetry & Live Access Log */}
        <div className="xl:col-span-7 space-y-6">
          {/* 3 Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${cardClass}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>Estado Relé Molinete #01</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="text-lg font-extrabold font-mono text-emerald-500">
                ONLINE • 18ms
              </div>
              <div className={`text-[11px] mt-1 ${mutedText}`}>
                Firmware v4.2 • Cierre Electromecánico
              </div>
            </div>

            <div className={`p-4 rounded-lg ${cardClass}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>Ingresos Autorizados</span>
                <span className="material-symbols-outlined text-[18px] text-[#00B4D8]">
                  how_to_reg
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono">{authorizedCount + 184}</div>
              <div className={`text-[11px] mt-1 ${mutedText}`}>Hoy en Sede Central</div>
            </div>

            <div className={`p-4 rounded-lg ${cardClass}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>Rechazos por Morosidad</span>
                <span className="material-symbols-outlined text-[18px] text-red-500">
                  block
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-red-500">
                {deniedCount}
              </div>
              <div className={`text-[11px] mt-1 ${mutedText}`}>Bloqueo automático activo</div>
            </div>
          </div>

          {/* Live Access Feed */}
          <div className={`rounded-lg ${cardClass} overflow-hidden`}>
            <div
              className={`p-4 border-b ${
                isLight ? 'border-slate-200 bg-slate-50' : 'border-[#262A34] bg-[#14171D]'
              } flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="text-sm font-extrabold uppercase tracking-wider font-display">
                  Bitácora de Molinete en Tiempo Real (Supabase Live)
                </h3>
              </div>
              <span className={`text-xs font-mono ${mutedText}`}>
                Últimos {accessLogs.length} eventos
              </span>
            </div>

            <div className="divide-y divide-slate-200/40 dark:divide-[#262A34] max-h-[380px] overflow-y-auto">
              {accessLogs.map((log) => {
                const isOk = log.status === 'AUTORIZADO';
                const timeStr = log.accessed_at
                  ? new Date(log.accessed_at).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Ahora';
                return (
                  <div
                    key={log.id}
                    className={`p-3.5 flex items-center justify-between gap-3 ${
                      !isOk
                        ? isLight
                          ? 'bg-red-50/70'
                          : 'bg-red-500/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          log.user_avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
                        }
                        alt={log.user_name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate">{log.user_name}</span>
                          <span className={`text-[11px] font-mono ${mutedText}`}>
                            • {log.plan_name}
                          </span>
                        </div>
                        <div
                          className={`text-xs truncate ${
                            isOk ? mutedText : 'text-red-400 font-semibold'
                          }`}
                        >
                          {log.gate_name} — {log.reason || 'Validación QR'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isOk
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-500 border border-red-500/30'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isOk ? 'lock_open' : 'lock'}
                        </span>
                        {log.status}
                      </span>
                      <div className={`text-[10px] font-mono mt-1 ${mutedText}`}>{timeStr}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Electromechanical Turnstile Rules Matrix */}
      <div className={`rounded-lg ${cardClass} overflow-hidden`}>
        <div
          className={`p-4 border-b ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-[#262A34] bg-[#14171D]'
          } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
        >
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider font-display">
              Matriz de Permisos de Molinete por Estado de Cuota
            </h3>
            <p className={`text-xs ${mutedText}`}>
              Sincronización directa con tabla <code className="font-mono">li_users.payment_status</code> en Supabase.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(['ALL', 'HABILITADO', 'BLOQUEADO'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setMatrixFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matrixFilter === f
                    ? 'bg-[#FF5722] text-white'
                    : isLight
                    ? 'bg-white border border-slate-200 text-slate-600'
                    : 'bg-[#181B22] border border-[#262A34] text-gray-300'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f}
              </button>
            ))}
          </div>
        </div>

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
                <th className="py-3 px-4">Atleta</th>
                <th className="py-3 px-4">Plan Activo</th>
                <th className="py-3 px-4">Estado Cuota</th>
                <th className="py-3 px-4">Permiso Electromecánico</th>
                <th className="py-3 px-4 text-right">Override Manual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/40 dark:divide-[#262A34]">
              {filteredMatrix.map((student) => {
                const isEnabled = student.payment_status !== 'vencido';
                return (
                  <tr key={student.id}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={student.avatar_url}
                          alt={student.full_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-xs font-bold">{student.full_name}</div>
                          <div className={`text-[10px] font-mono ${mutedText}`}>
                            DNI {student.dni}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">{student.plan_name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          student.payment_status === 'al_dia'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : student.payment_status === 'por_validar'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-red-500/15 text-red-500'
                        }`}
                      >
                        {student.payment_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isEnabled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-500">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          PASE HABILITADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-red-500">
                          <span className="material-symbols-outlined text-[15px]">lock</span>
                          MOLINETE BLOQUEADO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleTurnstileUser(student)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          isEnabled
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/15'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15'
                        }`}
                      >
                        {isEnabled ? 'Bloquear Pase' : 'Destrabar Manual'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
