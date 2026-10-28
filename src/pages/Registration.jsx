import { useState } from 'react'
import './Registration.css'

const steps = ['Datos básicos', 'Perfil de fitness', 'Preferencias']
const goalOptions = ['Fuerza', 'Pérdida de grasa', 'Flexibilidad', 'Hipertrofia']
const focusOptions = [
  { value: 'full', label: 'Cuerpo completo', icon: '♙' },
  { value: 'upper', label: 'Superior', icon: '♧' },
  { value: 'lower', label: 'Inferior', icon: '♧' },
  { value: 'core', label: 'Core', icon: '⌁' },
]
const integrations = [
  { id: 'appleHealth', label: 'Apple Health', icon: '●' },
  { id: 'googleFit', label: 'Google Fit', icon: '♡' },
  { id: 'spotify', label: 'Spotify', icon: '◉' },
]

const benefitContent = [
  {
    title: 'BENEFICIOS DE USUARIO',
    items: [
      ['▤', 'Planes personalizados', 'Creá rutinas según tus metas.'],
      ['◷', 'Historial completo', 'Completá y consultá tu historial.'],
      ['▥', 'Gráficos de progreso', 'Mirá cómo evoluciona tu entrenamiento.'],
    ],
  },
  {
    title: 'BENEFICIOS DE PERFIL',
    items: [
      ['▤', 'Planes para tu nivel', 'Rutinas adaptadas a tu experiencia.'],
      ['◷', 'Rutinas por disponibilidad', 'Entrená según tu semana.'],
      ['▥', 'Gráficos personalizados', 'Seguí tu propio progreso.'],
      ['↗', 'Gráficos de progreso', 'Celebrá cada avance.'],
    ],
  },
  {
    title: 'BENEFICIOS DE REGISTRO',
    items: [
      ['◷', 'Recordatorios', 'Para mantenerte en camino.'],
      ['▤', 'Preferencias a tu medida', 'Personalizá estadísticas y medidas.'],
      ['↗', 'Conexiones', 'Conectá tus apps favoritas.'],
      ['▥', 'Tu cuenta completa', 'Tus datos en un solo lugar.'],
    ],
  },
]

function Registration({ onBackToLogin, onGoHome }) {
  const [step, setStep] = useState(0)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState({ name: '', email: '' })
  const [passwords, setPasswords] = useState({ password: '', confirmPassword: '' })
  const [fitness, setFitness] = useState({
    experience: 2,
    days: 3,
    goals: ['Fuerza'],
    focus: 'full',
  })
  const [preferences, setPreferences] = useState({
    workoutReminders: true,
    weeklySummary: true,
    newPlans: false,
    units: 'kg',
    language: 'Español',
    appleHealth: false,
    googleFit: false,
    spotify: false,
  })

  function updatePreference(name, value) {
    setPreferences((current) => ({ ...current, [name]: value }))
  }

  function toggleGoal(goal) {
    setFitness((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((selected) => selected !== goal)
        : [...current.goals, goal],
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (step === 0) {
      if (passwords.password !== passwords.confirmPassword) {
        setError('Las contraseñas no coinciden. Revisalas e intentá de nuevo.')
        return
      }
      setStep(1)
      return
    }

    if (step === 1) {
      setStep(2)
      return
    }

    setComplete(true)
  }

  const currentBenefits = benefitContent[step]

  return (
    <main className="registration-page">
      <header className="registration-brand">
        <a
          className="registration-brand-name"
          href="#inicio"
          aria-label="Feel & Flow, volver al inicio de sesión"
          onClick={(event) => {
            event.preventDefault()
            onBackToLogin()
          }}
        >
          <span className="registration-brand-mark" aria-hidden="true">f<span>&</span>f</span>
          <span>FEEL <i>&amp;</i> FLOW</span>
        </a>
        <p>FITNESS</p>
        <span>Tu bienestar, a tu ritmo.</span>
      </header>

      <h1 className="registration-title">CREAR TU CUENTA</h1>

      <section className="registration-card" aria-label="Registro de cuenta">
        <nav className="registration-steps" aria-label="Pasos del registro">
          {steps.map((label, index) => {
            const isDone = complete || index < step
            const isCurrent = !complete && index === step
            return (
              <div
                className={`registration-step${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
                key={label}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="step-marker" aria-hidden="true">
                  {isDone ? '✓' : index + 1}
                </span>
                <span>{index + 1}. {label}</span>
              </div>
            )
          })}
        </nav>

        <div className="registration-form-panel">
          {complete ? (
            <div className="registration-success" role="status">
              <span className="success-icon" aria-hidden="true">✓</span>
              <h2>¡Tu perfil está listo!</h2>
              <p>
                El perfil está listo en esta vista de demostración. Las cuentas y el
                guardado permanente todavía no están conectados.
              </p>
              <button className="registration-primary" type="button" onClick={onGoHome}>
                IR AL INICIO <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <form className="registration-form" onSubmit={handleSubmit}>
              {step === 0 && (
                <div className="registration-fields">
                  <label className="registration-input">
                    <span className="registration-input-icon" aria-hidden="true">♙</span>
                    <input
                      name="name"
                      type="text"
                      placeholder="Nombre y apellido"
                      autoComplete="name"
                      required
                      value={account.name}
                      onChange={(event) => setAccount((current) => ({
                        ...current,
                        name: event.target.value,
                      }))}
                    />
                  </label>
                  <label className="registration-input">
                    <span className="registration-input-icon" aria-hidden="true">✉</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="Correo electrónico"
                      autoComplete="email"
                      required
                      value={account.email}
                      onChange={(event) => setAccount((current) => ({
                        ...current,
                        email: event.target.value,
                      }))}
                    />
                  </label>
                  <label className="registration-input">
                    <span className="registration-input-icon" aria-hidden="true">▣</span>
                    <input
                      name="password"
                      type="password"
                      placeholder="Contraseña (mínimo 8 caracteres)"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={passwords.password}
                      onChange={(event) => setPasswords((current) => ({
                        ...current,
                        password: event.target.value,
                      }))}
                    />
                  </label>
                  <label className="registration-input">
                    <span className="registration-input-icon" aria-hidden="true">▣</span>
                    <input
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirmar contraseña"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={passwords.confirmPassword}
                      onChange={(event) => setPasswords((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))}
                    />
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="fitness-fields">
                  <fieldset className="registration-fieldset">
                    <legend>Nivel de experiencia</legend>
                    <div className="range-labels">
                      <span>Principiante</span><span>Intermedio</span><span>Avanzado</span>
                    </div>
                    <input
                      aria-label="Nivel de experiencia"
                      className="registration-range"
                      type="range"
                      min="1"
                      max="3"
                      value={fitness.experience}
                      onChange={(event) => setFitness((current) => ({
                        ...current,
                        experience: Number(event.target.value),
                      }))}
                    />
                  </fieldset>

                  <fieldset className="registration-fieldset">
                    <legend>Días disponibles por semana</legend>
                    <div className="range-labels day-labels">
                      <span>2</span><span>3</span><span>4</span><span>5+</span>
                    </div>
                    <input
                      aria-label="Días disponibles por semana"
                      className="registration-range"
                      type="range"
                      min="2"
                      max="5"
                      value={fitness.days}
                      onChange={(event) => setFitness((current) => ({
                        ...current,
                        days: Number(event.target.value),
                      }))}
                    />
                  </fieldset>

                  <fieldset className="registration-fieldset">
                    <legend>Objetivos de fitness</legend>
                    <div className="choice-grid goal-grid">
                      {goalOptions.map((goal, index) => (
                        <button
                          className={`choice-card goal-card${fitness.goals.includes(goal) ? ' is-selected' : ''}`}
                          type="button"
                          aria-pressed={fitness.goals.includes(goal)}
                          onClick={() => toggleGoal(goal)}
                          key={goal}
                        >
                          <span aria-hidden="true">{['↔', '◉', '⌁', '♧'][index]}</span>
                          {goal}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="registration-fieldset">
                    <legend>Enfoque de entrenamiento</legend>
                    <div className="choice-grid focus-grid">
                      {focusOptions.map((option) => (
                        <button
                          className={`choice-card focus-card${fitness.focus === option.value ? ' is-selected' : ''}`}
                          type="button"
                          aria-pressed={fitness.focus === option.value}
                          onClick={() => setFitness((current) => ({ ...current, focus: option.value }))}
                          key={option.value}
                        >
                          <span aria-hidden="true">{option.icon}</span>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {step === 2 && (
                <div className="preference-fields">
                  <section className="preference-group">
                    <h2>Notificaciones</h2>
                    <label className="preference-row">
                      <span>Recordatorios de entrenamiento</span>
                      <input
                        type="checkbox"
                        checked={preferences.workoutReminders}
                        onChange={(event) => updatePreference('workoutReminders', event.target.checked)}
                      />
                    </label>
                    <label className="preference-row">
                      <span>Resúmenes de progreso</span>
                      <input
                        type="checkbox"
                        checked={preferences.weeklySummary}
                        onChange={(event) => updatePreference('weeklySummary', event.target.checked)}
                      />
                    </label>
                    <label className="preference-row">
                      <span>Nuevos planes</span>
                      <input
                        type="checkbox"
                        checked={preferences.newPlans}
                        onChange={(event) => updatePreference('newPlans', event.target.checked)}
                      />
                    </label>
                  </section>

                  <section className="preference-group">
                    <h2>Sistema de unidades</h2>
                    <div className="unit-options" role="group" aria-label="Sistema de unidades">
                      {['kg', 'Lb'].map((unit) => (
                        <button
                          className={preferences.units === unit ? 'is-selected' : ''}
                          type="button"
                          aria-pressed={preferences.units === unit}
                          onClick={() => updatePreference('units', unit)}
                          key={unit}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                    <label className="language-select">
                      <span>Idioma</span>
                      <select
                        value={preferences.language}
                        onChange={(event) => updatePreference('language', event.target.value)}
                      >
                        <option>Español</option>
                        <option>English</option>
                      </select>
                    </label>
                  </section>

                  <section className="integration-group">
                    <h2>Integraciones</h2>
                    <div className="integration-options">
                      {integrations.map((integration) => (
                        <label className="integration-option" key={integration.id}>
                          <span className={`integration-icon ${integration.id}`} aria-hidden="true">
                            {integration.icon}
                          </span>
                          <span>{integration.label}</span>
                          <input
                            type="checkbox"
                            checked={preferences[integration.id]}
                            onChange={(event) => updatePreference(integration.id, event.target.checked)}
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {error && <p className="registration-error" role="alert">{error}</p>}

              <div className="registration-actions">
                {step > 0 && (
                  <button
                    className="registration-back"
                    type="button"
                    onClick={() => {
                      setError('')
                      setStep((current) => current - 1)
                    }}
                  >
                    ← ATRÁS
                  </button>
                )}
                <button className="registration-primary" type="submit">
                  {step === 2 ? 'FINALIZAR' : step === 1 ? 'CONTINUAR' : 'REGISTRARME'}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          )}

          <p className="registration-legal">
            Términos y Condiciones <span>|</span> Política de Privacidad
          </p>
        </div>

        <aside className="registration-benefits">
          <h2>{currentBenefits.title}</h2>
          <ul>
            {currentBenefits.items.map(([icon, title, description]) => (
              <li key={title}>
                <span className="registration-benefit-icon" aria-hidden="true">{icon}</span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  )
}

export default Registration
