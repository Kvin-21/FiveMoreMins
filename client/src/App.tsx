import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './components/Landing'
import Login from './components/Login'
import Signup from './components/Signup'
import FocusMode from './components/FocusMode'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        {/* /login handles both the form and the ?token= verification flow */}
        <Route path="/login" element={<Login />} />
        <Route path="/login/verify" element={<Login />} />
        <Route path="/focus" element={<FocusMode />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        {/* Catch-all — send strays back home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
