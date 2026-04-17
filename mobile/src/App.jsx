import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Caisse from './pages/Caisse.jsx'
import Stock from './pages/Stock.jsx'
import Sessions from './pages/Sessions.jsx'
import Compta from './pages/Compta.jsx'
import BottomNav from './components/BottomNav.jsx'
import Toast from './components/Toast.jsx'
import { auth } from './shared/api.js'
import { usePushNotifications } from './shared/usePushNotifications.js'

function PrivateRoute({ children }) {
  return auth.isLoggedIn() ? children : <Navigate to="/login" replace />
}

function AppLayout() {
  usePushNotifications()
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/caisse"   element={<PrivateRoute><Caisse /></PrivateRoute>} />
          <Route path="/stock"    element={<PrivateRoute><Stock /></PrivateRoute>} />
          <Route path="/sessions" element={<PrivateRoute><Sessions /></PrivateRoute>} />
          <Route path="/compta"   element={<PrivateRoute><Compta /></PrivateRoute>} />
          <Route path="*"         element={<Navigate to="/caisse" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Toast />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*"     element={<AppLayout />} />
      </Routes>
    </HashRouter>
  )
}
