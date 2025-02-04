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
      <header className="absolute inset-x-0 top-0 z-50 w-full bg-gray-900/95 backdrop-blur-sm">
        <nav className="nav-container" aria-label="Global">
          <div className="flex items-center gap-4">
            <Link to="/" className="nav-logo">
              TypeRacer Pro
            </Link>
          </div>
          <div className="flex lg:hidden">
            <button
              type="button"
              className="rounded-md p-2 text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="nav-menu">
            {navigation.map((item) => (
              <Link key={item.name} to={item.href} className="nav-link">
                {item.name}
              </Link>
            ))}
          </div>
          <div className="hidden lg:flex lg:items-center lg:gap-x-6">
            {user ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-700 overflow-hidden">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-full w-full p-1.5 text-gray-400" />
                    )}
                  </div>
                  <span className="nav-link">{user.username}</span>
                </div>
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
                    <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-gradient mb-8">
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
                
                  <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
                    <div className="card flex flex-col items-start p-8 border border-gray-800">
                      <ChartBarIcon className="h-10 w-10 text-blue-500 mb-4" />
                      <div>
                        <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
                        <p className="text-gray-400">Monitor your typing speed and accuracy improvements over time</p>
                      </div>
                    </div>
                    <div className="card flex flex-col items-start p-8 border border-gray-800">
                      <TrophyIcon className="h-10 w-10 text-blue-500 mb-4" />
                      <div>
                        <h3 className="text-xl font-semibold mb-2">Compete Globally</h3>
                        <p className="text-gray-400">Join the leaderboard and race against typists worldwide</p>
                      </div>
                    </div>
                    <div className="card flex flex-col items-start p-8 border border-gray-800">
                      <UserIcon className="h-10 w-10 text-blue-500 mb-4" />
                      <div>
                        <h3 className="text-xl font-semibold mb-2">Real-time Races</h3>
                        <p className="text-gray-400">Challenge friends in multiplayer typing competitions</p>
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
