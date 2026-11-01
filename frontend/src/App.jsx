import { useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Registration from './pages/Registration.jsx'
import { apiRequest } from './lib/api.js'

function App() {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/me')
      .then(({ user: authenticatedUser }) => {
        if (active) setUser(authenticatedUser)
      })
      .catch((error) => {
        if (active && error.message !== 'Iniciá sesión para continuar.') {
          setSessionError(`No pudimos comprobar tu sesión: ${error.message}`)
        }
      })
      .finally(() => {
        if (active) setIsCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function signOut() {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setScreen('login')
  }

  if (isCheckingSession) {
    return (
      <main className="app-loading" role="status">
        <img src="/feel-flow-logo-transparent.png" alt="" />
        <span>Preparando tu espacio...</span>
      </main>
    )
  }

  if (user && screen !== 'registration') {
    return <Home user={user} onSignOut={signOut} />
  }

  if (screen === 'registration') {
    return (
      <Registration
        onBackToLogin={() => setScreen('login')}
        onGoHome={(registeredUser) => {
          setUser(registeredUser)
          setScreen('home')
        }}
      />
    )
  }

  return (
    <Login
      initialError={sessionError}
      onCreateAccount={() => setScreen('registration')}
      onLogin={(authenticatedUser) => {
        setSessionError('')
        setUser(authenticatedUser)
      }}
    />
  )
}

export default App