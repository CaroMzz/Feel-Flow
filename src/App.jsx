import { useState } from 'react'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Registration from './pages/Registration.jsx'

function App() {
  const [screen, setScreen] = useState('login')

  if (screen === 'home') {
    return <Home onSignOut={() => setScreen('login')} />
  }

  if (screen === 'registration') {
    return (
      <Registration
        onBackToLogin={() => setScreen('login')}
        onGoHome={() => setScreen('home')}
      />
    )
  }

  return (
    <Login
      onCreateAccount={() => setScreen('registration')}
      onLogin={() => setScreen('home')}
    />
  )
}

export default App