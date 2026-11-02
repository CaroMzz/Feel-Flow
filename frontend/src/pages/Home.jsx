import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import './Home.css'

const weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const workoutDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const allowedMediaTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm',
])
const maxMediaSize = 20 * 1024 * 1024

function ExerciseMediaPreview({ media, exerciseName }) {
  if (!media?.url || !media.contentType) return null

  return media.contentType.startsWith('video/')
    ? <video className="exercise-media-preview" src={media.url} controls preload="metadata" aria-label={`Video de ${exerciseName}`} />
    : <img className="exercise-media-preview" src={media.url} alt={`Referencia de ${exerciseName}`} />
}

function getCalendarDays(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const mondayOffset = (firstDay.getDay() + 6) % 7

  return [
    ...Array(mondayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
}

function Home({ user, onSignOut }) {
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [dashboard, setDashboard] = useState(null)
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(
    () => window.location.hash.slice(1) || 'inicio',
  )
  const [isRoutineDialogOpen, setIsRoutineDialogOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [routineName, setRoutineName] = useState('')
  const [routineDay, setRoutineDay] = useState('Lunes')
  const [routineExercises, setRoutineExercises] = useState([
    { id: 'exercise-1', exerciseId: null, name: '', media: null, mediaFile: null, removeMedia: false },
  ])
  const [routineFormError, setRoutineFormError] = useState('')
  const [isSavingRoutine, setIsSavingRoutine] = useState(false)
  const routineDialogRef = useRef(null)
  const nextExerciseId = useRef(2)

  const calendarDays = useMemo(() => getCalendarDays(calendarDate), [calendarDate])
  const monthIsCurrent = calendarDate.getFullYear() === new Date().getFullYear()
    && calendarDate.getMonth() === new Date().getMonth()
  const attendedDays = useMemo(
    () => new Set((dashboard?.attendance ?? []).map(({ date }) => Number(date.slice(-2)))),
    [dashboard],
  )
  const attendedCount = dashboard?.attendance.length ?? 0
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate()
  const monthNumber = calendarDate.getMonth() + 1
  const workouts = dashboard?.workouts ?? []

  const fetchDashboard = useCallback(
    () => apiRequest(`/api/dashboard?year=${calendarDate.getFullYear()}&month=${monthNumber}`),
    [calendarDate, monthNumber],
  )

  useEffect(() => {
    let isCurrent = true

    async function loadDashboard() {
      try {
        const data = await fetchDashboard()
        if (isCurrent) setDashboard(data)
      } catch (loadError) {
        if (isCurrent) setError(loadError.message)
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    loadDashboard()
    return () => {
      isCurrent = false
    }
  }, [fetchDashboard])

  useEffect(() => {
    if (!isRoutineDialogOpen || !routineDialogRef.current) return undefined

    const dialog = routineDialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [isRoutineDialogOpen])

  useEffect(() => {
    function syncActiveSection() {
      setActiveSection(window.location.hash.slice(1) || 'inicio')
    }

    window.addEventListener('hashchange', syncActiveSection)
    return () => window.removeEventListener('hashchange', syncActiveSection)
  }, [])

  function changeMonth(offset) {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    setSelectedDay(null)
    setIsLoading(true)
    setError('')
  }

  function openRoutineDialog(workout = null) {
    setEditingWorkout(workout)
    setRoutineName(workout?.name ?? '')
    setRoutineDay(workout?.day ?? 'Lunes')
    setRoutineExercises(workout?.exercises.length
      ? workout.exercises.map((exercise, index) => ({
        id: `exercise-${index + 1}`,
        exerciseId: exercise.id,
        name: exercise.name,
        media: exercise.media,
        mediaFile: null,
        removeMedia: false,
      }))
      : [{ id: 'exercise-1', exerciseId: null, name: '', media: null, mediaFile: null, removeMedia: false }])
    nextExerciseId.current = workout?.exercises.length + 1 || 2
    setRoutineFormError('')
    setIsRoutineDialogOpen(true)
  }

  function updateRoutineExercise(exerciseId, field, value) {
    setRoutineExercises((current) => current.map((exercise) => (
      exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise
    )))
  }

  function addRoutineExercise() {
    if (routineExercises.length >= 30) {
      setRoutineFormError('Una rutina puede tener hasta 30 ejercicios.')
      return
    }

    setRoutineExercises((current) => [
      ...current,
      {
        id: `exercise-${nextExerciseId.current++}`,
        exerciseId: null,
        name: '',
        media: null,
        mediaFile: null,
        removeMedia: false,
      },
    ])
    setRoutineFormError('')
  }

  function removeRoutineExercise(exerciseId) {
    setRoutineExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
    setRoutineFormError('')
  }

  async function saveWorkout(event) {
    event.preventDefault()
    const name = routineName.trim()
    if (name.length < 2 || name.length > 60) {
      setRoutineFormError('El nombre debe tener entre 2 y 60 caracteres.')
      return
    }
    if (routineExercises.length < 1) {
      setRoutineFormError('Agregá al menos un ejercicio.')
      return
    }
    const exercises = routineExercises.map((exercise) => ({
      ...(exercise.exerciseId ? { id: exercise.exerciseId } : {}),
      name: exercise.name.trim(),
    }))
    const invalidExerciseIndex = exercises.findIndex((exercise) => (
      exercise.name.length < 2 || exercise.name.length > 80
    ))
    if (invalidExerciseIndex >= 0) {
      setRoutineFormError(`Revisá los datos del ejercicio ${invalidExerciseIndex + 1}.`)
      return
    }

    setIsSavingRoutine(true)
    setRoutineFormError('')
    setError('')
    try {
      const { workout } = await apiRequest(
        editingWorkout ? `/api/workouts/${editingWorkout.id}` : '/api/workouts',
        {
          method: editingWorkout ? 'PUT' : 'POST',
          body: JSON.stringify({ name, day: routineDay, exercises }),
        },
      )
      const mediaFailures = []
      for (const [index, exercise] of routineExercises.entries()) {
        const savedExercise = workout.exercises[index]
        if (exercise.removeMedia && exercise.media && !exercise.mediaFile) {
          try {
            await apiRequest(
              `/api/workouts/${workout.id}/exercises/${savedExercise.id}/media`,
              { method: 'DELETE' },
            )
          } catch (requestError) {
            mediaFailures.push({ index, message: requestError.message })
          }
        }
        if (exercise.mediaFile) {
          try {
            await apiRequest(
              `/api/workouts/${workout.id}/exercises/${savedExercise.id}/media`,
              {
                method: 'PUT',
                headers: { 'Content-Type': exercise.mediaFile.type },
                body: exercise.mediaFile,
              },
            )
          } catch (requestError) {
            mediaFailures.push({ index, message: requestError.message })
          }
        }
      }

      const updatedDashboard = await fetchDashboard()
      setDashboard(updatedDashboard)
      const savedWorkout = updatedDashboard.workouts.find((item) => item.id === workout.id)
      if (editingWorkout && activeWorkout === editingWorkout.id) {
        setActiveWorkout(null)
      }
      if (mediaFailures.length > 0) {
        const failedIndexes = new Set(mediaFailures.map(({ index }) => index))
        setEditingWorkout(savedWorkout)
        setRoutineExercises((current) => current.map((exercise, index) => ({
          ...exercise,
          exerciseId: savedWorkout.exercises[index].id,
          media: savedWorkout.exercises[index].media,
          mediaFile: failedIndexes.has(index) ? exercise.mediaFile : null,
          removeMedia: failedIndexes.has(index) && exercise.removeMedia,
        })))
        setRoutineFormError(
          `La rutina se guardó, pero no se pudieron guardar los archivos de los ejercicios ${
            [...new Set(mediaFailures.map(({ index }) => index + 1))].join(', ')
          }. ${mediaFailures[0].message} Podés volver a intentarlo.`,
        )
        return
      }
      setNotice(editingWorkout
        ? `Actualizaste ${workout.name}. Su progreso volvió a cero.`
        : `¡Creaste la rutina ${workout.name}!`)
      setIsRoutineDialogOpen(false)
    } catch (requestError) {
      setRoutineFormError(requestError.message)
    } finally {
      setIsSavingRoutine(false)
    }
  }

  async function toggleWorkout(workoutId, workoutName) {
    if (activeWorkout !== workoutId) {
      setActiveWorkout(workoutId)
      setNotice(`Empezaste la rutina ${workoutName}.`)
      return
    }

    setError('')
    try {
      await apiRequest(`/api/workouts/${workoutId}/complete`, { method: 'POST' })
      setActiveWorkout(null)
      setNotice(`¡Completaste la rutina ${workoutName}!`)
      setDashboard(await fetchDashboard())
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteWorkout(workout) {
    const confirmed = window.confirm(
      `¿Eliminar la rutina "${workout.name}"? Esta acción también quitará sus ejercicios y archivos adjuntos.`,
    )
    if (!confirmed) return

    setError('')
    try {
      await apiRequest(`/api/workouts/${workout.id}`, { method: 'DELETE' })
      setDashboard((current) => current && ({
        ...current,
        workouts: current.workouts.filter((item) => item.id !== workout.id),
      }))
      if (activeWorkout === workout.id) setActiveWorkout(null)
      setNotice(`Eliminaste la rutina ${workout.name}.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function closeSidebar() {
    setIsSidebarOpen(false)
  }

  return (
    <div className="home-shell">
      {isSidebarOpen && (
        <button
          type="button"
          className="home-sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={closeSidebar}
        />
      )}

      <aside className={`home-sidebar${isSidebarOpen ? ' is-open' : ''}`}>
        <a className="home-brand" href="#inicio" aria-label="Feel & Flow, inicio" onClick={closeSidebar}>
          <img src="/feel-flow-logo-transparent.png" alt="Feel & Flow" />
        </a>

        <span className="sidebar-label">TU ESPACIO</span>
        <nav className="sidebar-navigation" aria-label="Navegación principal">
          <a
            className={`sidebar-link${activeSection === 'inicio' ? ' is-current' : ''}`}
            href="#inicio"
            aria-current={activeSection === 'inicio' ? 'page' : undefined}
            onClick={() => {
              setActiveSection('inicio')
              closeSidebar()
            }}
          >
            <span aria-hidden="true">⌂</span> Inicio
          </a>
          <a
            className={`sidebar-link${activeSection === 'rutinas' ? ' is-current' : ''}`}
            href="#rutinas"
            aria-current={activeSection === 'rutinas' ? 'page' : undefined}
            onClick={() => {
              setActiveSection('rutinas')
              closeSidebar()
            }}
          >
            <span aria-hidden="true">▤</span> Mis rutinas
          </a>
          <a
            className={`sidebar-link${activeSection === 'calendario' ? ' is-current' : ''}`}
            href="#calendario"
            aria-current={activeSection === 'calendario' ? 'page' : undefined}
            onClick={() => {
              setActiveSection('calendario')
              closeSidebar()
            }}
          >
            <span aria-hidden="true">◷</span> Mi progreso
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <span className="home-user-avatar" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="sidebar-profile-copy">
              <strong>{user.name}</strong>
              <span>Mi cuenta</span>
            </span>
          </div>
          <button
            type="button"
            className="home-signout"
            onClick={() => {
              setError('')
              onSignOut().catch((signOutError) => setError(signOutError.message))
            }}
          >
            <span aria-hidden="true">↪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="home-main">
        <header className="home-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={isSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <a className="mobile-brand" href="#inicio" aria-label="Feel & Flow, inicio">
            <img src="/feel-flow-logo-transparent.png" alt="Feel & Flow" />
          </a>
          <span className="topbar-greeting">Tu bienestar, a tu ritmo</span>
          <span className="topbar-user">{user.name}</span>
        </header>

        <div className="home-content">
          <section className="home-welcome" id="inicio">
            <div>
              <span className="home-eyebrow">MI ESPACIO · MI PROGRESO</span>
              <h1>¡Qué bueno verte, {user.name.split(' ')[0]}!</h1>
              <p>Un paso a la vez. Hoy también cuenta.</p>
            </div>
            <div className="preview-badge">
              <span aria-hidden="true">✦</span> TU ESPACIO PERSONAL
            </div>
          </section>

          <div className="home-dashboard">
            <section className="week-panel" id="rutinas" aria-labelledby="week-heading">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">ENCUENTRA TU RITMO</span>
                  <h2 id="week-heading">Tus rutinas</h2>
                </div>
                <button className="create-routine-button" type="button" onClick={() => openRoutineDialog()}>
                  <span aria-hidden="true">＋</span> Crear rutina
                </button>
              </div>

              {isLoading && <p className="home-loading" role="status">Cargando tus rutinas...</p>}
              {!isLoading && dashboard && workouts.length === 0 && (
                <div className="empty-routines">
                  <span className="empty-routines-icon" aria-hidden="true">✦</span>
                  <h3>Todavía no tenés rutinas</h3>
                  <p>Creá tu primera rutina y empezá a entrenar a tu manera.</p>
                  <button className="empty-routines-button" type="button" onClick={() => openRoutineDialog()}>
                    Crear mi primera rutina <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {workouts.length > 0 && (
                <>
                  <div className="workout-count">
                    {workouts.length} {workouts.length === 1 ? 'rutina' : 'rutinas'} en tu espacio
                  </div>
                  <div className="workout-list">
                    {workouts.map((workout) => {
                      const isActive = activeWorkout === workout.id
                      const progress = Math.min((workout.completed / workout.totalExercises) * 100, 100)
                      return (
                        <article
                          className={`workout-card${isActive ? ' is-active' : ''}`}
                          key={workout.id}
                        >
                          <span className="workout-icon" aria-hidden="true">{workout.icon}</span>
                          <div className="workout-content">
                            <div className="workout-title-row">
                              <div>
                                <span className="workout-day">{workout.day}</span>
                                <h3>{workout.name}</h3>
                              </div>
                              {isActive && <span className="workout-live">EN CURSO</span>}
                            </div>
                            <div className="workout-progress-label">
                              <span>{workout.completed}/{workout.totalExercises} ejercicios completos</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div
                              className="workout-progress"
                              role="progressbar"
                              aria-label={`Progreso de ${workout.name}`}
                              aria-valuemin="0"
                              aria-valuemax="100"
                              aria-valuenow={Math.round(progress)}
                            >
                              <span style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                          <div className="workout-actions">
                            <button
                              className="edit-workout"
                              type="button"
                              onClick={() => openRoutineDialog(workout)}
                            >
                              Editar
                            </button>
                            <button
                              className="delete-workout"
                              type="button"
                              aria-label={`Eliminar ${workout.name}`}
                              onClick={() => deleteWorkout(workout)}
                            >
                              Eliminar
                            </button>
                            <button
                              className="start-workout"
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => toggleWorkout(workout.id, workout.name)}
                            >
                              {isActive ? 'Finalizar' : 'Iniciar'}
                            </button>
                          </div>
                          {workout.exercises.length > 0 ? (
                            <ul className="workout-exercises">
                              {workout.exercises.map((exercise, index) => (
                                <li key={exercise.id}>
                                  <span className="exercise-number" aria-label={`Ejercicio ${index + 1}`}>
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  <div className="exercise-details">
                                    <span className="exercise-name">{exercise.name}</span>
                                    {exercise.media && (
                                      <ExerciseMediaPreview media={exercise.media} exerciseName={exercise.name} />
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="workout-no-exercises">
                              Esta rutina todavía no tiene ejercicios detallados. Podés agregarlos al editarla.
                            </p>
                          )}
                        </article>
                      )
                    })}
                  </div>
                  {notice && <p className="home-notice" role="status">{notice}</p>}
                </>
              )}
              {notice && workouts.length === 0 && <p className="home-notice" role="status">{notice}</p>}
              {error && <p className="home-error" role="alert">{error}</p>}
            </section>

            <section className="calendar-panel" id="calendario" aria-labelledby="calendar-heading">
              <div className="section-heading calendar-heading">
                <div>
                  <span className="section-kicker">MANTENÉ EL HÁBITO</span>
                  <h2 id="calendar-heading">Calendario de asistencia</h2>
                </div>
                <div className="month-controls" aria-label="Cambiar mes">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    onClick={() => changeMonth(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    onClick={() => changeMonth(1)}
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="calendar-month">
                <button type="button" onClick={() => changeMonth(-1)}>Anterior</button>
                <h3>{monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}</h3>
                <button type="button" onClick={() => changeMonth(1)}>Siguiente</button>
              </div>

              <div className="calendar-grid" role="grid" aria-label="Calendario mensual">
                {weekdayNames.map((day) => (
                  <span className="calendar-weekday" role="columnheader" key={day}>{day}</span>
                ))}
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <span className="calendar-empty" role="gridcell" key={`empty-${index}`} />
                  }

                  const isToday = monthIsCurrent && day === new Date().getDate()
                  const wasAttended = attendedDays.has(day)
                  const isSelected = selectedDay === day
                  return (
                    <button
                      className={`calendar-day${wasAttended ? ' is-attended' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                      type="button"
                      role="gridcell"
                      aria-label={`${day} de ${monthNames[calendarDate.getMonth()]}${isToday ? ', hoy' : ''}${wasAttended ? ', entrenamiento completado' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDay(day)}
                      key={day}
                    >
                      {day}
                      {isToday && <span>Hoy</span>}
                    </button>
                  )
                })}
              </div>

              <div className="calendar-legend">
                <span><i className="legend-dot attended" /> Entrenamiento</span>
                <span><i className="legend-dot today" /> Hoy</span>
              </div>

              <div className="monthly-summary">
                <div>
                  <span className="summary-icon" aria-hidden="true">◷</span>
                  <span>Días asistidos este mes</span>
                  <strong>{attendedCount}/{daysInMonth}</strong>
                </div>
                <div>
                  <span className="summary-icon" aria-hidden="true">↗</span>
                  <span>Total levantado</span>
                  <strong>{(dashboard?.kilogramsLifted ?? 0).toLocaleString('es-AR')} kg</strong>
                </div>
              </div>
            </section>
          </div>

          <footer className="home-footer">
            <span>CONSTANCIA ANTES QUE PERFECCIÓN</span>
            <span className="home-footer-dot" />
            <span>FEEL &amp; FLOW · 2026</span>
          </footer>
        </div>
      </main>

      {isRoutineDialogOpen && (
        <dialog
          className="routine-dialog"
          ref={routineDialogRef}
          aria-labelledby="routine-dialog-title"
          onClose={() => setIsRoutineDialogOpen(false)}
        >
          <form className="routine-form" onSubmit={saveWorkout}>
            <button
              className="routine-dialog-close"
              type="button"
              aria-label="Cerrar"
              onClick={() => setIsRoutineDialogOpen(false)}
            >
              ×
            </button>
            <span className="section-kicker">EMPEZÁ A TU MANERA</span>
            <h2 id="routine-dialog-title">
              {editingWorkout ? 'Editar rutina' : 'Crear una rutina'}
            </h2>
            <p>Definí el día y agregá los ejercicios. Podés adjuntar una foto o un video como referencia.</p>

            <label htmlFor="routine-name">Título de la rutina</label>
            <input
              id="routine-name"
              name="name"
              type="text"
              value={routineName}
              onChange={(event) => setRoutineName(event.target.value)}
              placeholder="Ej. Fuerza y movilidad"
              minLength={2}
              maxLength={60}
              autoFocus
              required
            />

            <label htmlFor="routine-day">Día de entrenamiento</label>
            <select
              id="routine-day"
              name="day"
              value={routineDay}
              onChange={(event) => setRoutineDay(event.target.value)}
            >
              {workoutDays.map((day) => <option key={day}>{day}</option>)}
            </select>

            <div className="routine-exercise-heading">
              <span>Ejercicios</span>
              <span>{routineExercises.length}/30</span>
            </div>
            <div className="routine-exercise-list">
              {routineExercises.map((exercise, index) => (
                <fieldset className="routine-exercise-fields" key={exercise.id}>
                  <legend>
                    <span>Ejercicio {index + 1}</span>
                    {routineExercises.length > 1 && (
                      <button
                        type="button"
                        className="remove-exercise"
                        onClick={() => removeRoutineExercise(exercise.id)}
                        aria-label={`Quitar ejercicio ${index + 1}`}
                      >
                        Quitar
                      </button>
                    )}
                  </legend>
                  <label htmlFor={`${exercise.id}-name`}>Nombre</label>
                  <input
                    id={`${exercise.id}-name`}
                    type="text"
                    value={exercise.name}
                    onChange={(event) => updateRoutineExercise(exercise.id, 'name', event.target.value)}
                    placeholder="Ej. Sentadillas"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                  <label htmlFor={`${exercise.id}-media`}>Foto o video (opcional, hasta 20 MB)</label>
                  <input
                    key={`${exercise.id}-${exercise.mediaFile?.name ?? 'empty'}-${exercise.removeMedia}`}
                    id={`${exercise.id}-media`}
                    className="exercise-media-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      if (!allowedMediaTypes.has(file.type)) {
                        setRoutineFormError('Elegí una imagen JPG, PNG o WebP, o un video MP4 o WebM.')
                        event.target.value = ''
                        return
                      }
                      if (file.size > maxMediaSize) {
                        setRoutineFormError('El archivo no puede superar los 20 MB.')
                        event.target.value = ''
                        return
                      }
                      updateRoutineExercise(exercise.id, 'mediaFile', file)
                      updateRoutineExercise(exercise.id, 'removeMedia', false)
                      setRoutineFormError('')
                    }}
                  />
                  {exercise.removeMedia ? (
                    <p className="exercise-media-status">El archivo se quitará al guardar.</p>
                  ) : (
                    <>
                      {(exercise.media || exercise.mediaFile) && (
                        <div className="exercise-media-selection">
                          <ExerciseMediaPreview
                            media={exercise.mediaFile ? null : exercise.media}
                            exerciseName={exercise.name}
                          />
                          <span>{exercise.mediaFile?.name ?? 'Archivo adjunto'}</span>
                        </div>
                      )}
                      {(exercise.media || exercise.mediaFile) && (
                        <button
                          className="remove-exercise-media"
                          type="button"
                          onClick={() => {
                            updateRoutineExercise(exercise.id, 'mediaFile', null)
                            updateRoutineExercise(exercise.id, 'removeMedia', Boolean(exercise.media))
                          }}
                        >
                          Quitar archivo
                        </button>
                      )}
                    </>
                  )}
                </fieldset>
              ))}
            </div>
            <button
              className="add-routine-exercise"
              type="button"
              onClick={addRoutineExercise}
              disabled={routineExercises.length >= 30}
            >
              <span aria-hidden="true">＋</span> Agregar ejercicio
            </button>

            {routineFormError && <p className="routine-form-error" role="alert">{routineFormError}</p>}
            {editingWorkout && (
              <p className="routine-edit-note">
                Al guardar cambios, el progreso de esta rutina se reiniciará.
              </p>
            )}
            <button className="routine-submit" type="submit" disabled={isSavingRoutine}>
              {isSavingRoutine
                ? 'Guardando...'
                : editingWorkout
                  ? 'Guardar cambios'
                  : 'Guardar rutina'}
            </button>
          </form>
        </dialog>
      )}
    </div>
  )
}

export default Home
