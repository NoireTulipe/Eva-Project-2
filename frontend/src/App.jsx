import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { auth } from './shared/api.js'
import Layout from './components/web/Layout.jsx'

// Pages communes
import LoginPage   from './pages/web/LoginPage.jsx'
import Dashboard   from './pages/web/Dashboard.jsx'

// Maison d'Édition
import MeVentes       from './pages/web/me/Ventes.jsx'
import MeProduits     from './pages/web/me/Produits.jsx'
import MePDV          from './pages/web/me/PDV.jsx'
import MeDepots       from './pages/web/me/Depots.jsx'
import MeCompta       from './pages/web/me/Compta.jsx'
import MeReferentiels from './pages/web/me/Referentiels.jsx'

// EVA
import EvaChat        from './pages/web/eva/Chat.jsx'
import EvaSupervision from './pages/web/eva/Supervision.jsx'
import EvaMails       from './pages/web/eva/Mails.jsx'
import EvaMemoire     from './pages/web/eva/Memoire.jsx'
import EvaAgenda      from './pages/web/eva/Agenda.jsx'
import EvaNotes       from './pages/web/eva/Notes.jsx'
import EvaSite        from './pages/web/eva/Site.jsx'
import EvaInstagram   from './pages/web/eva/Instagram.jsx'

// Admin
import AdminParametrage   from './pages/web/admin/Parametrage.jsx'
import AdminCrons         from './pages/web/admin/Crons.jsx'
import AdminUtilisateurs  from './pages/web/admin/Utilisateurs.jsx'
import AdminLogs          from './pages/web/admin/Logs.jsx'
import AdminSauvegardes   from './pages/web/admin/Sauvegardes.jsx'
import AdminNotifications from './pages/web/admin/Notifications.jsx'

function PrivateRoute() {
  return auth.isLoggedIn() ? <Outlet /> : <Navigate to="/login" replace />
}

function AdminRoute() {
  const user = auth.getUser()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>

            <Route path="/dashboard" element={<Dashboard />} />

            {/* Maison d'Édition */}
            <Route path="/me">
              <Route index element={<Navigate to="ventes" replace />} />
              <Route path="ventes"       element={<MeVentes />} />
              <Route path="produits"     element={<MeProduits />} />
              <Route path="pdv"          element={<MePDV />} />
              <Route path="depots"       element={<MeDepots />} />
              <Route path="compta"       element={<MeCompta />} />
              <Route path="referentiels" element={<MeReferentiels />} />
            </Route>

            {/* EVA */}
            <Route path="/eva">
              <Route index element={<Navigate to="chat" replace />} />
              <Route path="chat"        element={<EvaChat />} />
              <Route path="supervision" element={<EvaSupervision />} />
              <Route path="mails"       element={<EvaMails />} />
              <Route path="memoire"     element={<EvaMemoire />} />
              <Route path="agenda"      element={<EvaAgenda />} />
              <Route path="notes"       element={<EvaNotes />} />
              <Route path="site"        element={<EvaSite />} />
              <Route path="instagram"   element={<EvaInstagram />} />
            </Route>

            {/* Admin — rôle admin uniquement */}
            <Route element={<AdminRoute />}>
              <Route path="/admin">
                <Route index element={<Navigate to="parametrage" replace />} />
                <Route path="parametrage"   element={<AdminParametrage />} />
                <Route path="crons"         element={<AdminCrons />} />
                <Route path="utilisateurs"  element={<AdminUtilisateurs />} />
                <Route path="logs"          element={<AdminLogs />} />
                <Route path="sauvegardes"   element={<AdminSauvegardes />} />
                <Route path="notifications" element={<AdminNotifications />} />
              </Route>
            </Route>

          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
