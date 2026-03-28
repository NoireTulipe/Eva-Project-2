import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { auth } from './shared/api.js'
import LoginPage from './pages/web/LoginPage.jsx'
import Dashboard from './pages/web/Dashboard.jsx'
import Ventes from './pages/web/Ventes.jsx'
import Admin from './pages/web/Admin.jsx'
import Logs from './pages/web/Logs.jsx'
import Layout from './components/web/Layout.jsx'

function PrivateRoute({ children }) {
  return auth.isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>
        } />
        <Route path="/ventes" element={
          <PrivateRoute><Layout><Ventes /></Layout></PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute><Layout><Admin /></Layout></PrivateRoute>
        } />
        <Route path="/logs" element={
          <PrivateRoute><Layout><Logs /></Layout></PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
