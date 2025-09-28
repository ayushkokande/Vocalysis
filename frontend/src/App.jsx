import { NavLink, Outlet, Route, Routes } from 'react-router-dom'
import PracticeStudioPage from './pages/practice-studio'
import ChoirRoomPage from './pages/choir-room'
import { StudioDataProvider } from './context/studio-data'

const navItems = [
  { to: '/', label: 'Vocal Lab' },
  { to: '/choir-room', label: 'Choir Room' },
]

function AppLayout() {
  return (
    <StudioDataProvider>
      <div className="min-h-screen bg-studio-gradient text-slate-100">
        <div className="mx-auto max-w-6xl px-6 pb-16">
          <nav className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <NavLink to="/" className="text-lg font-semibold tracking-tight text-white">
                Vocalysis
              </NavLink>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300/70">Practice Suite</p>
            </div>
            <div className="flex gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-accent/20 text-accent'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <main className="mt-12">
            <Outlet />
          </main>
        </div>
      </div>
    </StudioDataProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PracticeStudioPage />} />
        <Route path="/choir-room" element={<ChoirRoomPage />} />
      </Route>
    </Routes>
  )
}
