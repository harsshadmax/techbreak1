import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { isOnboarded } from './lib/onboarding'
import { AppsPage } from './pages/Apps'
import { BreakPage } from './pages/Break'
import { FocusPage } from './pages/Focus'
import { HomePage } from './pages/Home'
import { InsightsPage } from './pages/Insights'
import { LoginPage } from './pages/Login'
import { OnboardingPage } from './pages/Onboarding'
import { ProfilePage } from './pages/Profile'
import { RewardsPage } from './pages/Rewards'
import { SocialPage } from './pages/Social'
import { GridIcon, HomeIcon, StoreIcon, TrophyIcon, UserIcon } from './ui/Icons'
import { Spinner } from './ui/kit'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/apps', label: 'Apps', Icon: GridIcon },
  { to: '/rewards', label: 'Rewards', Icon: StoreIcon },
  { to: '/challenges', label: 'Challenges', Icon: TrophyIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
]

function Shell() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 pt-5 pb-32">
      <Outlet />
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3">
        <ul className="flex h-[4.25rem] w-full max-w-xl items-center justify-around rounded-full bg-ink px-2">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                aria-label={label}
                className={({ isActive }) =>
                  `flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full transition-colors focus-visible:outline-white ${
                    isActive ? 'bg-white text-ink' : 'text-white hover:bg-white/15'
                  }`
                }
              >
                <Icon />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

/** Signed-in routes only; first-time users see onboarding once. */
function RequireUser() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner className="pt-40" />
  if (!user) return <Navigate to="/login" replace />
  if (!isOnboarded(user.id) && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner className="pt-40" />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<RequireUser />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/break" element={<BreakPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/challenges" element={<SocialPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
