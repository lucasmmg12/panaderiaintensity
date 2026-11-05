import React, { useState } from 'react';
import { LIUser, LIRoutine, LIRoutineDay, LIExercise, supabase } from '../lib/supabase';

interface RoutinesViewProps {
  users: LIUser[];
  routines: LIRoutine[];
  isLight: boolean;
  onRefresh: () => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const RoutinesView: React.FC<RoutinesViewProps> = ({
  users,
  routines,
  isLight,
  onRefresh,
  onShowToast,
}) => {
  const students = users.filter((u) => u.role === 'alumno');
  const coaches = users.filter((u) => u.role === 'profesor');

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id || ''
  );
  const [searchStudent, setSearchStudent] = useState('');
  const [coachFilter, setCoachFilter] = useState('ALL');
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New exercise state
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('Pectoral / Fuerza');
  const [newExSets, setNewExSets] = useState(4);
  const [newExReps, setNewExReps] = useState('8-10');
  const [newExLoad, setNewExLoad] = useState('80kg • RIR 1');
  const [newExRest, setNewExRest] = useState('90s');
  const [newExNotes, setNewExNotes] = useState('Controlar fase excéntrica 3 seg');

  const getCoachName = (student: LIUser) => {
    const c = coaches.find((co) => co.id === student.assigned_coach_id);
    return c?.full_name || 'Prof. Marcos Rossi';
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.dni.includes(searchStudent);
    const matchesCoach =
      coachFilter === 'ALL' || s.assigned_coach_id === coachFilter;
    return matchesSearch && matchesCoach;
  });

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || filteredStudents[0] || students[0];

  const activeRoutine =
    routines.find((r) => r.student_id === selectedStudent?.id) || routines[0];

  const routineDays: LIRoutineDay[] = Array.isArray(activeRoutine?.days_json)
    ? activeRoutine.days_json
    : [];

  const currentDayObj: LIRoutineDay = routineDays[activeDayIdx] || {
    day: `Día ${activeDayIdx + 1}`,
    focus: 'Fuerza Estructural',
    duration: '65 min',
    exercises: [],
  };

  const dayExercises: LIExercise[] = Array.isArray(currentDayObj.exercises)
    ? currentDayObj.exercises
    : [];

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim() || !activeRoutine) return;
    setIsSaving(true);

    const newExercise: LIExercise = {
      order: `B${dayExercises.length + 1}`,
      name: newExName.trim(),
      muscle: newExMuscle,
      sets: Number(newExSets),
      reps: newExReps,
      load: newExLoad,
      rest: newExRest,
      notes: newExNotes,
      completed: false,
    };

    const updatedDays = [...routineDays];
    if (!updatedDays[activeDayIdx]) {
      updatedDays[activeDayIdx] = {
        day: `Día ${activeDayIdx + 1}`,
        focus: newExMuscle,
        duration: '60 min',
        exercises: [newExercise],
      };
    } else {
      updatedDays[activeDayIdx] = {
        ...updatedDays[activeDayIdx],
        exercises: [...dayExercises, newExercise],
      };
    }

    try {
      await supabase
        .from('li_routines')
        .update({
          days_json: updatedDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRoutine.id);

      onShowToast(
        `Ejercicio "${newExercise.name}" añadido a ${currentDayObj.day}`,
        'success'
      );
      setNewExName('');
      setShowAddExerciseModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al guardar ejercicio en Supabase', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveExercise = async (exIdx: number) => {
    if (!activeRoutine || !routineDays[activeDayIdx]) return;
    const updatedDays = [...routineDays];
    updatedDays[activeDayIdx] = {
      ...updatedDays[activeDayIdx],
      exercises: dayExercises.filter((_, i) => i !== exIdx),
    };

    try {
      await supabase
        .from('li_routines')
        .update({
          days_json: updatedDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRoutine.id);
      onShowToast('Ejercicio eliminado del bloque', 'warning');
      onRefresh();
    } catch (err) {
      console.error(err);
      onShowToast('Error al eliminar ejercicio', 'error');
    }
  };

  const handleUploadNewPdf = async () => {
    if (!activeRoutine || !selectedStudent) return;
    const fileName = `Plan_Periodizacion_${selectedStudent.full_name.replace(
      /\s+/g,
      '_'
    )}_Jun2026.pdf`;
    try {
      await supabase
        .from('li_routines')
        .update({
          pdf_file_name: fileName,
          pdf_size_mb: '3.1 MB',
          pdf_updated_at: new Date().toISOString(),
        })
        .eq('id', activeRoutine.id);

      onShowToast(
        `Plan PDF "${fileName}" sincronizado con la App Móvil del alumno`,
        'success'
      );
      onRefresh();
    } catch (err) {
      console.error(err);
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
            <span>DEPARTAMENTO TÉCNICO</span>
            <span>/</span>
            <span className={mutedText}>RUTINAS INTERACTIVAS & PLANES PDF</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">
            Gestión de Alumnos y Creador de Rutinas
          </h1>
          <p className={`text-sm mt-0.5 ${mutedText}`}>
            Asignación de mesociclos, prescripción de cargas (Series, Reps, RIR) y publicación instantánea de planes PDF en el portal del atleta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowPdfPreviewModal(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-[#181B22] border-[#262A34] text-gray-200 hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-[#00B4D8]">
              picture_as_pdf
            </span>
            Previsualizar Plan PDF Oficial
          </button>

          <button
            onClick={() =>
              onShowToast(
                `Mesociclo sincronizado en tiempo real con el Portal de ${selectedStudent?.full_name}`,
                'success'
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-sm transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            Publicar Cambios en App Alumno
          </button>
        </div>
      </div>

      {/* Split Workspace: 4 cols Student Roster + 8 cols Routine & PDF Builder */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Roster */}
        <div className={`xl:col-span-4 rounded-lg ${cardClass} overflow-hidden`}>
          <div
            className={`p-4 border-b ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-[#262A34] bg-[#14171D]'
            } space-y-3`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">
                Cartera de Atletas ({filteredStudents.length})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00B4D8]/15 text-[#00B4D8] font-bold">
                Sincronizado
              </span>
            </div>

            <div className="relative">
              <span
                className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] ${mutedText}`}
              >
                search
              </span>
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Buscar atleta..."
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#111317] border-[#262A34] text-white'
                }`}
              />
            </div>

            <select
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#111317] border-[#262A34] text-gray-300'
              }`}
            >
              <option value="ALL">Todos los Coaches Asignados</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.specialty})
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-slate-200/40 dark:divide-[#262A34] max-h-[620px] overflow-y-auto">
            {filteredStudents.map((student) => {
              const isSelected = selectedStudent?.id === student.id;
              const pct = Math.min(
                100,
                Math.round(((student.classes_attended || 10) / (student.classes_limit || 12)) * 100)
              );
              return (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`p-3.5 flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-orange-50/90 border-l-4 border-[#FF5722]'
                        : 'bg-[#FF5722]/10 border-l-4 border-[#FF5722]'
                      : isLight
                      ? 'hover:bg-slate-50'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={student.avatar_url}
                      alt={student.full_name}
                      className="w-10 h-10 rounded-full object-cover border border-[#FF5722]/30"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{student.full_name}</div>
                      <div className={`text-[11px] truncate ${mutedText}`}>
                        Coach: {getCoachName(student)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-500">
                      {pct}% Asist.
                    </span>
                    <div className={`text-[10px] font-mono mt-0.5 ${mutedText}`}>
                      {student.level}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Builder Workspace */}
        <div className="xl:col-span-8 space-y-6">
          {selectedStudent && (
            <>
              {/* Athlete Hero Profile & Biometrics */}
              <div className={`p-5 rounded-lg ${cardClass}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/40 dark:border-[#262A34]">
                  <div className="flex items-center gap-4">
                    <img
                      src={selectedStudent.avatar_url}
                      alt={selectedStudent.full_name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#FF5722]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold font-display">
                          {selectedStudent.full_name}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF5722]/15 text-[#FF5722]">
                          {selectedStudent.plan_name}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${mutedText}`}>
                        Coach Responsable:{' '}
                        <strong className="text-[#00B4D8]">
                          {getCoachName(selectedStudent)}
                        </strong>{' '}
                        • Nivel Técnico:{' '}
                        <strong className="text-emerald-500">{selectedStudent.level}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Quick Biometrics / PR Badges */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div
                      className={`px-3 py-2 rounded-lg border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111317] border-[#262A34]'
                      }`}
                    >
                      <div className={`text-[10px] uppercase font-bold ${mutedText}`}>Peso / Grasa</div>
                      <div className="text-xs font-extrabold font-mono mt-0.5">
                        {selectedStudent.weight_kg || 78.5}kg · {selectedStudent.body_fat_pct || 12.4}%
                      </div>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-lg border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111317] border-[#262A34]'
                      }`}
                    >
                      <div className={`text-[10px] uppercase font-bold ${mutedText}`}>PR Sentadilla</div>
                      <div className="text-xs font-extrabold font-mono text-[#FF5722] mt-0.5">
                        {selectedStudent.pr_squat_kg || 145} kg
                      </div>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-lg border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111317] border-[#262A34]'
                      }`}
                    >
                      <div className={`text-[10px] uppercase font-bold ${mutedText}`}>PR Peso Muerto</div>
                      <div className="text-xs font-extrabold font-mono text-[#00B4D8] mt-0.5">
                        {selectedStudent.pr_deadlift_kg || 180} kg
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official PDF Plan Manager Bar */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00B4D8]/15 border border-[#00B4D8]/30 flex items-center justify-center text-[#00B4D8]">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-2">
                        <span>
                          {activeRoutine?.pdf_file_name ||
                            'Plan_Hipertrofia_Fuerza_Mesociclo_04.pdf'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-mono text-[10px]">
                          VISIBLE EN APP
                        </span>
                      </div>
                      <div className={`text-[11px] font-mono ${mutedText}`}>
                        Tamaño: {activeRoutine?.pdf_size_mb || '2.4 MB'} • Descargas:{' '}
                        {activeRoutine?.pdf_downloads || 4}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPdfPreviewModal(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        isLight
                          ? 'border-slate-200 text-slate-700 hover:bg-slate-100'
                          : 'border-[#262A34] text-gray-200 hover:bg-white/5'
                      }`}
                    >
                      Ver Documento
                    </button>
                    <button
                      onClick={handleUploadNewPdf}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00B4D8] hover:bg-[#0096B4] text-black transition cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">upload_file</span>
                      Subir Nuevo PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Weekly Routine Builder */}
              <div className={`rounded-lg ${cardClass} overflow-hidden`}>
                <div
                  className={`p-4 border-b ${
                    isLight ? 'border-slate-200 bg-slate-50' : 'border-[#262A34] bg-[#14171D]'
                  } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                >
                  <div>
                    <h3 className="text-base font-extrabold font-display">
                      {activeRoutine?.title || 'Mesociclo #04 — Hipertrofia & Fuerza Base'}
                    </h3>
                    <p className={`text-xs ${mutedText}`}>
                      Mesociclo: {activeRoutine?.mesocycle || 'Semana 3 de 4'} • Enfoque:{' '}
                      {activeRoutine?.focus || 'Fuerza Estructural'}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddExerciseModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#FF5722] hover:bg-[#F4511E] text-white transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Añadir Ejercicio a {currentDayObj.day}
                  </button>
                </div>

                {/* Day Tabs */}
                <div
                  className={`grid grid-cols-2 sm:grid-cols-3 border-b ${
                    isLight ? 'border-slate-200' : 'border-[#262A34]'
                  }`}
                >
                  {(routineDays.length > 0
                    ? routineDays
                    : [
                        { day: 'Día 1', focus: 'Tren Superior Fuerza', duration: '65 min', exercises: [] },
                        { day: 'Día 2', focus: 'Tren Inferior Potencia', duration: '70 min', exercises: [] },
                        { day: 'Día 3', focus: 'Hipertrofia & Core', duration: '60 min', exercises: [] },
                      ]
                  ).map((d, idx) => (
                    <button
                      key={d.day}
                      onClick={() => setActiveDayIdx(idx)}
                      className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer truncate ${
                        activeDayIdx === idx
                          ? 'border-[#FF5722] text-[#FF5722] bg-[#FF5722]/5'
                          : `border-transparent ${mutedText} hover:text-current`
                      }`}
                    >
                      {d.day}: {d.focus}
                    </button>
                  ))}
                </div>

                {/* Exercises Table / Cards */}
                <div className="p-4 space-y-3">
                  {dayExercises.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <span className="material-symbols-outlined text-3xl text-[#FF5722]">
                        fitness_center
                      </span>
                      <p className="text-sm font-bold">
                        Sin ejercicios cargados para {currentDayObj.day}
                      </p>
                      <p className={`text-xs ${mutedText}`}>
                        Haz clic en "+ Añadir Ejercicio" para prescribir series, repeticiones y carga.
                      </p>
                    </div>
                  ) : (
                    dayExercises.map((ex, idx) => (
                      <div
                        key={`${ex.order}-${idx}`}
                        className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isLight
                            ? 'bg-slate-50/70 border-slate-200'
                            : 'bg-[#111317] border-[#262A34]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FF5722]/15 border border-[#FF5722]/30 text-[#FF5722] font-mono font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {ex.order || `B${idx + 1}`}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-extrabold">{ex.name}</h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00B4D8]/15 text-[#00B4D8]">
                                {ex.muscle}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 ${mutedText}`}>{ex.notes}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div className="px-2.5 py-1.5 rounded bg-black/20 border border-white/10 text-center">
                            <div className={`text-[9px] uppercase ${mutedText}`}>Series x Reps</div>
                            <div className="text-xs font-mono font-bold">
                              {ex.sets} × {ex.reps}
                            </div>
                          </div>
                          <div className="px-2.5 py-1.5 rounded bg-black/20 border border-white/10 text-center">
                            <div className={`text-[9px] uppercase ${mutedText}`}>Carga / RIR</div>
                            <div className="text-xs font-mono font-bold text-[#FF5722]">
                              {ex.load}
                            </div>
                          </div>
                          <div className="px-2.5 py-1.5 rounded bg-black/20 border border-white/10 text-center">
                            <div className={`text-[9px] uppercase ${mutedText}`}>Pausa</div>
                            <div className="text-xs font-mono font-bold text-[#00B4D8]">
                              {ex.rest}
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveExercise(idx)}
                            title="Eliminar ejercicio"
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: Add Exercise */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-lg ${cardClass} p-6 space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200/40 dark:border-[#262A34]">
              <h3 className="text-lg font-extrabold font-display">
                Prescribir Ejercicio — {currentDayObj.day}
              </h3>
              <button
                onClick={() => setShowAddExerciseModal(false)}
                className="material-symbols-outlined text-gray-400 hover:text-white cursor-pointer"
              >
                close
              </button>
            </div>

            <form onSubmit={handleAddExercise} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Nombre del Ejercicio</label>
                <input
                  type="text"
                  required
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  placeholder="Ej: Press Inclinado con Mancuernas"
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#111317] border-[#262A34] text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Grupo Muscular / Patrón</label>
                  <input
                    type="text"
                    value={newExMuscle}
                    onChange={(e) => setNewExMuscle(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Carga & RIR</label>
                  <input
                    type="text"
                    value={newExLoad}
                    onChange={(e) => setNewExLoad(e.target.value)}
                    placeholder="Ej: 85kg • RIR 1"
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">Series</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newExSets}
                    onChange={(e) => setNewExSets(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border font-mono ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Reps</label>
                  <input
                    type="text"
                    value={newExReps}
                    onChange={(e) => setNewExReps(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm border font-mono ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Descanso</label>
                  <input
                    type="text"
                    value={newExRest}
                    onChange={(e) => setNewExRest(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm border font-mono ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#111317] border-[#262A34] text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Indicaciones Técnicas</label>
                <input
                  type="text"
                  value={newExNotes}
                  onChange={(e) => setNewExNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#111317] border-[#262A34] text-white'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddExerciseModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#FF5722] text-white cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Official PDF Preview */}
      {showPdfPreviewModal && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white text-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FF5722]">picture_as_pdf</span>
                <span className="font-extrabold text-sm">
                  {activeRoutine?.pdf_file_name || 'Plan_Oficial_Life_Intensity.pdf'}
                </span>
              </div>
              <button
                onClick={() => setShowPdfPreviewModal(false)}
                className="material-symbols-outlined text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                close
              </button>
            </div>

            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <div className="text-xs font-bold uppercase text-[#FF5722]">
                    LIFE INTENSITY HIGH PERFORMANCE CENTER
                  </div>
                  <h4 className="text-lg font-extrabold">{activeRoutine?.title}</h4>
                  <p className="text-xs text-slate-600">
                    Atleta: <strong>{selectedStudent.full_name}</strong> (DNI {selectedStudent.dni})
                  </p>
                </div>
                <div className="text-right text-xs font-mono text-slate-500">
                  <div>Coach: {getCoachName(selectedStudent)}</div>
                  <div>Sede Central Belgrano</div>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {routineDays.flatMap((d) =>
                  (d.exercises || []).map((ex, i) => (
                    <div
                      key={`${d.day}-${i}`}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/70"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          [{d.day}] {ex.name}
                        </span>{' '}
                        <span className="text-slate-500">({ex.muscle})</span>
                      </div>
                      <div className="font-mono font-bold text-slate-800">
                        {ex.sets}x{ex.reps} • {ex.load} • {ex.rest}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Imprimir / Descargar PDF
              </button>
              <button
                onClick={() => setShowPdfPreviewModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#FF5722] text-white cursor-pointer"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
