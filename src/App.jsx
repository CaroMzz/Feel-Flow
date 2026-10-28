import { useState } from 'react'
import Login from './pages/Login.jsx'
import Registration from './pages/Registration.jsx'

function App() {
  const [screen, setScreen] = useState('login')

  if (screen === 'registration') {
    return <Registration onBackToLogin={() => setScreen('login')} />
  }

  return <Login onCreateAccount={() => setScreen('registration')} />
}

export default App