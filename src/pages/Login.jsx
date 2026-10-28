import { useState } from 'react'
import './Login.css'

const benefits = [
  {
    icon: '♧',
    title: 'Planes personalizados',
    description: 'Rutinas que se adaptan a vos y a tus objetivos.',
  },
  {
    icon: '↗',
    title: 'Tu progreso, a la vista',
    description: 'Seguí cada logro y mirá cuánto avanzaste.',
  },
  {
    icon: '✳',
    title: 'Una comunidad que acompaña',
    description: 'Compartí el camino con otras personas.',
  },
]

function Login({ onCreateAccount }) {
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')

  const isRecovery = mode === 'recovery'

  function changeMode(nextMode) {
    setMode(nextMode)
    setNotice('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setNotice(
      isRecovery
        ? 'La recuperación de contraseña estará disponible cuando conectemos tu cuenta.'
        : 'El acceso a tu cuenta estará disponible cuando conectemos el servicio de inicio de sesión.',
    )
  }

  return (
    <main className="page-shell">
      <header className="brand">
        <a
          className="brand-name"
          href="#inicio"
          aria-label="Feel & Flow, inicio"
          onClick={() => changeMode('login')}
        >
          <span className="brand-mark" aria-hidden="true">
            f<span>&</span>f
          </span>
          <span>FEEL <i>&amp;</i> FLOW</span>
        </a>
        <p>FITNESS</p>
        <span className="brand-tagline">Tu bienestar, a tu ritmo.</span>
      </header>

      <section className="auth-card" aria-label="Acceso a Feel & Flow">
        <div className="auth-panel">
          <div className="eyebrow"><span /> UN ESPACIO PARA VOS</div>
          <h1>
            {isRecovery
              ? 'Recuperá tu contraseña'
              : 'Qué lindo verte'}
          </h1>
          <p className="form-intro">
            {isRecovery
              ? 'Ingresá tu correo y te ayudaremos a volver a tu cuenta.'
              : 'Iniciá sesión y encontrá todo tu progreso en un solo lugar.'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Correo electrónico</span>
              <span className="input-wrap">
                <span className="input-icon mail-icon" aria-hidden="true">✉</span>
                <input
                  type="email"
                  name="email"
                  placeholder="hola@correo.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            {!isRecovery && (
              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <span className="input-wrap">
                  <span className="input-icon lock-icon" aria-hidden="true">▣</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="current-password"
                    minLength={8}
                    required
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </span>
              </div>
            )}

            {!isRecovery && (
              <div className="form-options">
                <label className="remember-option">
                  <input type="checkbox" name="remember" />
                  <span>Recordarme</span>
                </label>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => changeMode('recovery')}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {notice && <p className="form-notice" role="status">{notice}</p>}

            <button className="submit-button" type="submit">
              {isRecovery ? 'RECUPERAR CONTRASEÑA' : 'INICIAR SESIÓN'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="auth-switch">
            {isRecovery ? (
              <>
                ¿Ya te acordaste?{' '}
                <button type="button" className="text-button switch-link" onClick={() => changeMode('login')}>
                  Volvé a iniciar sesión
                </button>
              </>
            ) : (
              <>
                ¿Todavía no tenés cuenta?{' '}
                <button type="button" className="text-button switch-link" onClick={onCreateAccount}>
                  Crear una cuenta
                </button>
              </>
            )}
          </div>

          <p className="legal">
            Al continuar, aceptás nuestros <a href="#terminos">Términos y condiciones</a>
            <br />y la <a href="#privacidad">Política de privacidad</a>.
          </p>
        </div>

        <aside className="welcome-panel">
          <div className="sunburst" aria-hidden="true">✳</div>
          <div className="welcome-content">
            <span className="welcome-kicker">MÁS QUE UNA RUTINA</span>
            <h2>Sentite bien.<br />Movete a tu manera.</h2>
            <p className="welcome-copy">
              Un espacio para crear hábitos, celebrar avances y conectar con vos.
            </p>
            <ul className="benefit-list">
              {benefits.map((benefit) => (
                <li key={benefit.title}>
                  <span className="benefit-icon" aria-hidden="true">{benefit.icon}</span>
                  <span>
                    <strong>{benefit.title}</strong>
                    <small>{benefit.description}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel-footer">
            <span className="footer-dots" aria-hidden="true">● ● ●</span>
            <span>UN PASO A LA VEZ</span>
          </div>
        </aside>
      </section>

      <footer className="page-footer">
        <span>HECHO PARA SENTIRTE BIEN</span>
        <span className="footer-divider" />
        <span>FEEL &amp; FLOW · 2026</span>
      </footer>
    </main>
  )
}

export default Login
