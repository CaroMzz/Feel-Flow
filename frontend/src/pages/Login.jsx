import { useState } from 'react'
import { apiRequest } from '../lib/api.js'
import './Login.css'

function Login({ onCreateAccount, onLogin, initialError = '' }) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [notice, setNotice] = useState(initialError)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setNotice('')
    setIsSubmitting(true)
    try {
      const { user } = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember }),
      })
      onLogin(user)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <img className="login-logo" src="/feel-flow-logo-transparent.png" alt="Feel & Flow — Your fitness journey" />
        <div className="login-header-actions">
          <span className="edition-badge"><span aria-hidden="true">✦</span> Tu espacio de bienestar</span>
          <button type="button" className="help-button" onClick={() => setNotice('Si necesitás ayuda para ingresar, revisá que tu correo y contraseña sean correctos.')}>
            <span aria-hidden="true">?</span> Ayuda
          </button>
        </div>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-tabs" aria-label="Acceso a tu cuenta">
          <button className="login-tab is-selected" type="button" aria-current="page">Iniciar sesión</button>
          <button className="login-tab" type="button" onClick={onCreateAccount}>Crear cuenta</button>
        </div>

        <div className="login-intro">
          <span className="login-kicker">TU PRÓXIMO LOGRO EMPIEZA ACÁ</span>
          <h1 id="login-title">¡Hola de nuevo! <span aria-hidden="true">✦</span></h1>
          <p>Ingresá a tu espacio y continuá tu entrenamiento.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field" htmlFor="login-email">
            <span>Email o usuario</span>
            <span className="login-input">
              <span aria-hidden="true">✉</span>
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Tu correo electrónico"
                autoComplete="email"
                required
              />
            </span>
          </label>

          <div className="login-password-field">
            <div className="login-label-row">
              <label htmlFor="login-password">Contraseña</label>
              <button
                className="login-link"
                type="button"
                onClick={() => setNotice('La recuperación de contraseña todavía no está habilitada.')}
              >
                ¿Olvidaste tu clave?
              </button>
            </div>
            <span className="login-input">
              <span aria-hidden="true">▣</span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresá tu contraseña"
                autoComplete="current-password"
                minLength={8}
                required
              />
              <button
                className="show-password"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </span>
          </div>

          <label className="remember-me">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Recordarme en este equipo</span>
          </label>

          {notice && <p className="login-notice" role="alert">{notice}</p>}

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'INGRESANDO...' : 'ACCEDER A MIS RUTINAS'}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="social-divider"><span>O INICIÁ CON</span></div>
        <div className="social-login" aria-label="Otros métodos de acceso">
          <button type="button" disabled title="Inicio con Apple próximamente">
            <span className="apple-mark" aria-hidden="true">●</span> Apple ID <small>Próximamente</small>
          </button>
          <button type="button" disabled title="Inicio con Google próximamente">
            <span className="google-mark" aria-hidden="true">G</span> Google <small>Próximamente</small>
          </button>
        </div>

        <p className="login-signup">
          ¿Todavía no tenés cuenta?{' '}
          <button type="button" className="login-link" onClick={onCreateAccount}>Crear mi cuenta</button>
        </p>
      </section>

      <footer className="login-footer">
        <span>FEEL &amp; FLOW · TU VIAJE, A TU RITMO</span>
        <span><a href="#terminos">Términos</a> <i>·</i> <a href="#privacidad">Privacidad</a></span>
      </footer>
    </main>
  )
}

export default Login
