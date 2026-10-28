import { useMemo, useState } from 'react'
import './Home.css'

const initialWorkouts = [
  {
    id: 'legs',
    day: 'Martes',
    name: 'Día de Pierna',
    icon: '🧘🏻‍♀️',
    completed: 3,
    exercises: 4,
  },
  {
    id: 'cardio',
    day: 'Jueves',
    name: 'Cardio & Core',
    icon: '🏃🏻‍♀️',
    completed: 1,
    exercises: 11,
  },
  {
    id: 'full-body',
    day: 'Sábado',
    name: 'Full Body',
    icon: '🏋🏻‍♀️',
    completed: 2,
    exercises: 2,
  },
  {
    id: 'mobility',
    day: 'Domingo',
    name: 'Movilidad & Yoga',
    icon: '🧘🏻‍♀️',
    completed: 1,
    exercises: 4,
  },
]

const weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const sampleWorkoutDays = new Set([2, 5, 8, 10, 14, 17, 20, 24, 27])
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getCalendarDays(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const mondayOffset = (firstDay.getDay() + 6) % 7

  return [
    ...Array(mondayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
}

function Home({ onSignOut }) {
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [workouts, setWorkouts] = useState(initialWorkouts)
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [notice, setNotice] = useState('')

  const calendarDays = useMemo(() => getCalendarDays(calendarDate), [calendarDate])
  const monthIsCurrent = calendarDate.getFullYear() === new Date().getFullYear()
    && calendarDate.getMonth() === new Date().getMonth()
  const attendedCount = monthIsCurrent ? sampleWorkoutDays.size : 0
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate()

  function changeMonth(offset) {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    setSelectedDay(null)
  }

  function addExercise() {
    setWorkouts((current) => current.map((workout, index) => (
      index === 0 ? { ...workout, exercises: workout.exercises + 1 } : workout
    )))
    setNotice('Se agregó un ejercicio a tu rutina de Día de Pierna.')
  }

  function toggleWorkout(workoutId, workoutName) {
    const isStarting = activeWorkout !== workoutId
    setActiveWorkout(isStarting ? workoutId : null)
    setNotice(isStarting ? `Empezaste la rutina ${workoutName}.` : `Pausaste la rutina ${workoutName}.`)
  }

  return (
    <main className="home-page">
      <header className="home-header">
        <a className="home-brand" href="#inicio" aria-label="Feel & Flow, inicio">
          <span className="home-brand-mark" aria-hidden="true">f<span>&</span>f</span>
          <span className="home-brand-name">FEEL <i>&amp;</i> FLOW</span>
          <span className="home-brand-caption">FITNESS · TU BIENESTAR, A TU RITMO</span>
        </a>
        <div className="home-header-actions">
          <span className="home-user-avatar" aria-hidden="true">C</span>
          <button type="button" className="home-signout" onClick={onSignOut}>Salir</button>
        </div>
      </header>

      <section className="home-welcome">
        <div>
          <span className="home-eyebrow">MI ESPACIO · MI PROGRESO</span>
          <h1>¡Qué bueno verte de nuevo!</h1>
          <p>Un paso a la vez. Hoy también cuenta.</p>
        </div>
        <div className="preview-badge">
          <span aria-hidden="true">✳</span> VISTA DE DEMOSTRACIÓN · DATOS DE EJEMPLO
        </div>
      </section>

      <div className="home-dashboard">
        <section className="week-panel" aria-labelledby="week-heading">
          <div className="section-heading">
            <div>
              <span className="section-kicker">ENCUENTRA TU RITMO</span>
              <h2 id="week-heading">Tu semana de entrenamiento</h2>
            </div>
            <span className="week-counter">4 <span>sesiones</span></span>
          </div>

          <div className="workout-list">
            {workouts.map((workout) => {
              const isActive = activeWorkout === workout.id
              const progress = Math.min((workout.completed / workout.exercises) * 100, 100)
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
                      <span>{workout.completed}/{workout.exercises} ejercicios completos</span>
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
                  <button
                    className="start-workout"
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => toggleWorkout(workout.id, workout.name)}
                  >
                    {isActive ? 'Pausar' : 'Iniciar rutina'}
                  </button>
                </article>
              )
            })}
          </div>

          <div className="week-panel-footer">
            <button type="button" className="add-exercise" onClick={addExercise}>
              <span aria-hidden="true">＋</span> Añadir ejercicio
            </button>
            {notice && <p className="home-notice" role="status">{notice}</p>}
          </div>
        </section>

        <section className="calendar-panel" aria-labelledby="calendar-heading">
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
              const wasAttended = monthIsCurrent && sampleWorkoutDays.has(day)
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
              <strong>1250 kg</strong>
            </div>
          </div>
        </section>
      </div>

      <footer className="home-footer">
        <span>CONSTANCIA ANTES QUE PERFECCIÓN</span>
        <span className="home-footer-dot" />
        <span>FEEL &amp; FLOW · 2026</span>
      </footer>
    </main>
  )
}

export default Home
