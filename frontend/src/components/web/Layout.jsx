import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import SubNav from './SubNav.jsx'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <SubNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
