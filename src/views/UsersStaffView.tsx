import React, { useState } from 'react';
import { LIUser, supabase } from '../lib/supabase';

interface UsersStaffViewProps {
  users: LIUser[];
  isLight: boolean;
  onRefresh: () => void;
  onOpenNewUserModal: () => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const UsersStaffView: React.FC<UsersStaffViewProps> = ({
  users,
  isLight,
  onRefresh,
  onOpenNewUserModal,
  onShowToast,
}) => {
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'alumno' | 'profesor' | 'admin'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const coaches = users.filter((u) => u.role === 'profesor');
  const [selectedCoachId, setSelectedCoachId] = useState<string>(coaches[0]?.id || '');

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.dni.includes(searchQuery);
    return matchesRole && matchesSearch;
  });

  const selectedCoach =
    coaches.find((c) => c.id === selectedCoachId) || coaches[0] || users[0];

  const students = users.filter((u) => u.role === 'alumno');
  const assignedToCoach = students.filter(
    (s) =>
      s.assigned_coach_id === selectedCoach?.id ||
      (!s.assigned_coach_id && selectedCoach?.id === coaches[0]?.id)
  );

  const handleAssignCoach = async (student: LIUser, coach: LIUser) => {
    try {
      await supabase
        .from('li_users')
        .update({
          assigned_coach_id: coach.id,
        })
        .eq('id', student.id);

      onShowToast(
        `${student.full_name} asignado a la cartera de ${coach.full_name}`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al reasignar coach', 'error');
    }
  };

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
            <span>CAPITAL HUMANO Y COMUNIDAD</span>
            <span>/</span>
            <span className={mutedText}>ROLES, STAFF & CARTERA TÉCNICA</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">
            Gestión de Usuarios y Profesores
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Administración integral de atletas, staff de entrenadores, aptos médicos y efectividad de sobrecarga por cartera.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenNewUserModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-sm transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Alta de Usuario / Staff
          </button>
        </div>
      </div>

      {/* 4 Telemetry Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`p-5 rounded-lg ${cardClass}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold uppercase ${mutedText}`}>Padrón Total Activo</span>
            <span className="material-symbols-outlined text-[#FF5722]">groups</span>
          </div>
          <div className="text-2xl font-extrabold font-mono">{users.length}</div>
          <div className={`text-xs mt-1 ${mutedText}`}>
            {students.length} atletas • {coaches.length} profesores
          </div>
        </div>

        <div className={`p-5 rounded-lg ${cardClass}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold uppercase ${mutedText}`}>Ratio Atleta / Coach</span>
            <span className="material-symbols-outlined text-[#00B4D8]">sports</span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#00B4D8]">18 : 1</div>
          <div className="text-xs mt-1 text-emerald-500 font-semibold">
            Óptimo para seguimiento RIR
          </div>
        </div>

        <div className={`p-5 rounded-lg ${cardClass}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold uppercase ${mutedText}`}>Aptos Médicos Vigentes</span>
            <span className="material-symbols-outlined text-emerald-500">medical_services</span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-500">94.8%</div>
          <div className={`text-xs mt-1 ${mutedText}`}>Auditoría clínica al día</div>
        </div>

        <div className={`p-5 rounded-lg ${cardClass}`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold uppercase ${mutedText}`}>Retención Mensual</span>
            <span className="material-symbols-outlined text-amber-500">workspace_premium</span>
          </div>
          <div className="text-2xl font-extrabold font-mono">96.2%</div>
          <div className="text-xs mt-1 text-emerald-500 font-semibold">+2.1% vs trimestre ant.</div>
        </div>
      </div>

      {/* Main Split Grid: Left Directory Table (8 cols) + Right Coach Inspector (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Table */}
        <div className={`xl:col-span-8 rounded-lg ${cardClass} overflow-hidden`}>
          <div
            className={`p-4 border-b ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-[#262A34] bg-[#14171D]'
            } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
          >
            {/* Role Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `Todos (${users.length})` },
                  { id: 'alumno', label: `Alumnos (${students.length})` },
                  { id: 'profesor', label: `Profesores (${coaches.length})` },
                  {
                    id: 'admin',
                    label: `Admins (${users.filter((u) => u.role === 'admin').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    roleFilter === tab.id
                      ? 'bg-[#FF5722] text-white'
                      : isLight
                      ? 'bg-white border border-slate-200 text-slate-600'
                      : 'bg-[#181B22] border border-[#262A34] text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <span
                className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] ${mutedText}`}
              >
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nombre o DNI..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#111317] border-[#262A34] text-white'
                }`}
              />
            </div>
          </div>

          {/* Mobile Responsive Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-200/40 dark:divide-[#262A34]">
            {filteredUsers.map((u) => (
              <div key={u.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={u.avatar_url}
                      alt={u.full_name}
                      className="w-10 h-10 rounded-full object-cover border border-[#FF5722]/30 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">{u.full_name}</div>
                      <div className={`text-xs font-mono truncate ${mutedText}`}>
                        {u.email} • DNI {u.dni}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase shrink-0 ${
                      u.role === 'profesor'
                        ? 'bg-[#00B4D8]/15 text-[#00B4D8]'
                        : u.role === 'admin'
                        ? 'bg-purple-500/15 text-purple-400'
                        : 'bg-[#FF5722]/15 text-[#FF5722]'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-xs font-bold">
                    {u.role === 'profesor' ? u.specialty : u.plan_name}
                  </div>
                  {u.role === 'alumno' && coaches.length > 0 ? (
                    <select
                      value={u.assigned_coach_id || coaches[0].id}
                      onChange={(e) => {
                        const targetCoach = coaches.find((c) => c.id === e.target.value);
                        if (targetCoach) handleAssignCoach(u, targetCoach);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-700'
                          : 'bg-[#111317] border-[#262A34] text-gray-200'
                      }`}
                    >
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setSelectedCoachId(u.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#00B4D8]/15 text-[#00B4D8]"
                    >
                      Ver Ficha Coach
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

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
                  <th className="py-3.5 px-4">Usuario / Rol</th>
                  <th className="py-3.5 px-4">Plan / Especialidad</th>
                  <th className="py-3.5 px-4">Coach Asignado</th>
                  <th className="py-3.5 px-4">Nivel</th>
                  <th className="py-3.5 px-4 text-right">Asignación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-[#262A34]">
                {filteredUsers.map((u) => {
                  const assignedCoachObj = coaches.find(
                    (c) => c.id === u.assigned_coach_id
                  );
                  return (
                    <tr
                      key={u.id}
                      onClick={() => {
                        if (u.role === 'profesor') setSelectedCoachId(u.id);
                      }}
                      className={`transition ${
                        u.role === 'profesor' ? 'cursor-pointer' : ''
                      } ${
                        isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar_url}
                            alt={u.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-[#FF5722]/30"
                          />
                          <div>
                            <div className="text-sm font-bold flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                                  u.role === 'profesor'
                                    ? 'bg-[#00B4D8]/15 text-[#00B4D8]'
                                    : u.role === 'admin'
                                    ? 'bg-purple-500/15 text-purple-400'
                                    : 'bg-[#FF5722]/15 text-[#FF5722]'
                                }`}
                              >
                                {u.role}
                              </span>
                            </div>
                            <div className={`text-xs font-mono ${mutedText}`}>
                              {u.email} • DNI {u.dni}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs font-bold">
                          {u.role === 'profesor' ? u.specialty : u.plan_name}
                        </div>
                        <div className={`text-[11px] font-mono ${mutedText}`}>
                          Clases: {u.classes_attended || 10}/{u.classes_limit || 12}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold">
                        {u.role === 'alumno' ? (
                          <span className="text-[#00B4D8]">
                            {assignedCoachObj?.full_name || 'Prof. Marcos Rossi'}
                          </span>
                        ) : (
                          <span className={mutedText}>Staff Titular</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-500">
                          {u.level || 'Avanzado'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {u.role === 'alumno' && coaches.length > 0 ? (
                          <select
                            value={u.assigned_coach_id || coaches[0].id}
                            onChange={(e) => {
                              const targetCoach = coaches.find((c) => c.id === e.target.value);
                              if (targetCoach) handleAssignCoach(u, targetCoach);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              isLight
                                ? 'bg-white border-slate-200 text-slate-700'
                                : 'bg-[#111317] border-[#262A34] text-gray-200'
                            }`}
                          >
                            {coaches.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.full_name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setSelectedCoachId(u.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#00B4D8]/15 text-[#00B4D8] cursor-pointer"
                          >
                            Inspeccionar Coach
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Coach Inspector Card */}
        <div className={`xl:col-span-4 rounded-lg ${cardClass} p-5 space-y-5 sticky top-20`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200/40 dark:border-[#262A34]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8]">
                FICHA DE RENDIMIENTO DOCENTE
              </span>
              <h3 className="text-base font-extrabold font-display">
                Inspector de Staff Técnico
              </h3>
            </div>
            <div className="flex gap-1">
              {coaches.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCoachId(c.id)}
                  className={`w-7 h-7 rounded-full overflow-hidden border-2 transition cursor-pointer ${
                    selectedCoach?.id === c.id ? 'border-[#FF5722] scale-110' : 'border-transparent opacity-60'
                  }`}
                >
                  <img src={c.avatar_url} alt={c.full_name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {selectedCoach && (
            <>
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedCoach.avatar_url}
                  alt={selectedCoach.full_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#00B4D8]"
                />
                <div>
                  <h4 className="text-base font-extrabold">{selectedCoach.full_name}</h4>
                  <p className="text-xs font-semibold text-[#00B4D8]">
                    {selectedCoach.specialty || 'Head Coach • Fuerza & Powerlifting'}
                  </p>
                  <p className={`text-[11px] font-mono ${mutedText}`}>{selectedCoach.email}</p>
                </div>
              </div>

              {/* Radial Overload Effectiveness Gauge */}
              <div
                className={`p-4 rounded-lg border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111317] border-[#262A34]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold uppercase text-[#FF5722]">
                    Efectividad de Sobrecarga
                  </div>
                  <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                    Progresión promedio de RM y adherencia en mesociclos activos.
                  </p>
                </div>
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="currentColor"
                      className="text-gray-700/30"
                      strokeWidth="3.2"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="#FF5722"
                      strokeWidth="3.2"
                      strokeDasharray="92, 100"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xs font-mono font-extrabold">92%</span>
                </div>
              </div>

              {/* Assigned Athletes List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Atletas Bajo Seguimiento ({assignedToCoach.length})</span>
                  <span className="text-[#00B4D8] font-mono">Cupo Máx: 25</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {assignedToCoach.map((ath) => (
                    <div
                      key={ath.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        isLight
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-[#111317] border-[#262A34]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={ath.avatar_url}
                          alt={ath.full_name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-bold">{ath.full_name}</div>
                          <div className={`text-[10px] font-mono ${mutedText}`}>
                            {ath.plan_name}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-emerald-500">
                        {ath.classes_attended || 10}/{ath.classes_limit || 12}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
