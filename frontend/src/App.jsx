import { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { UserIcon, ChartBarIcon, TrophyIcon } from '@heroicons/react/24/solid';
import { useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import Multiplayer from './pages/Multiplayer';
import Leaderboard from './pages/Leaderboard';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Practice', href: '/practice' },
  { name: 'Multiplayer', href: '/multiplayer' },
  { name: 'Leaderboard', href: '/leaderboard' },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="bg-gray-900 text-white min-h-screen w-full">
      <header className="absolute inset-x-0 top-0 z-50 w-full">
        <nav className="flex items-center justify-between p-6 lg:px-8 max-w-full" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link to="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-gradient">TypeRacer Pro</span>
            </Link>
          </div>
          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-400"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <Link key={item.name} to={item.href} className="nav-link">
                {item.name}
              </Link>
            ))}
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:gap-x-4">
            {user ? (
              <>
                <span className="nav-link">{user.username}</span>
                <button onClick={logout} className="nav-link">
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="nav-link">
                Log in <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        </nav>
        <Dialog as="div" className="lg:hidden" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
          <div className="fixed inset-0 z-50" />
          <Dialog.Panel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-gray-900 px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-white/10">
            <div className="flex items-center justify-between">
              <Link to="/" className="-m-1.5 p-1.5" onClick={() => setMobileMenuOpen(false)}>
                <span className="text-2xl font-bold">TypeRacer Pro</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/25">
                <div className="space-y-2 py-6">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-300 hover:bg-gray-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
                <div className="py-6">
                  {user ? (
                    <button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-300 hover:bg-gray-800"
                    >
                      Log out
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-300 hover:bg-gray-800"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log in
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog>
      </header>

      <main>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/multiplayer" element={user ? <Multiplayer /> : <Navigate to="/login" />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/" element={
            <div className="relative isolate pt-14">
              <div className="py-24 sm:py-32 lg:pb-40">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                  <div className="mx-auto max-w-2xl text-center">
                    <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-gradient">
                      Test Your Typing Speed
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-gray-300">
                      Challenge yourself and compete with others in real-time typing races.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                      <Link to="/practice" className="btn-primary">
                        Start Typing Test
                      </Link>
                      <Link to="/leaderboard" className="nav-link">
                        View Leaderboard <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                
                  <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div className="card hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <ChartBarIcon className="h-8 w-8 text-blue-500" />
                        <div>
                          <h3 className="text-lg font-semibold">Track Progress</h3>
                          <p className="text-sm text-gray-400">Monitor your typing speed and accuracy improvements over time</p>
                        </div>
                      </div>
                    </div>
                    <div className="card hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <TrophyIcon className="h-8 w-8 text-blue-500" />
                        <div>
                          <h3 className="text-lg font-semibold">Compete Globally</h3>
                          <p className="text-sm text-gray-400">Join the leaderboard and race against typists worldwide</p>
                        </div>
                      </div>
                    </div>
                    <div className="card hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <UserIcon className="h-8 w-8 text-blue-500" />
                        <div>
                          <h3 className="text-lg font-semibold">Real-time Races</h3>
                          <p className="text-sm text-gray-400">Challenge friends in multiplayer typing competitions</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}
