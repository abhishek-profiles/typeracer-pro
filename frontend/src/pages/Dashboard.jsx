import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, ChartBarIcon } from '@heroicons/react/24/solid';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    averageWPM: 0,
    averageAccuracy: 0,
    totalTests: 0,
    bestWPM: 0
  });

  useEffect(() => {
    if (user?.typingHistory) {
      const history = user.typingHistory;
      const totalTests = history.length;
      
      if (totalTests > 0) {
        const totalWPM = history.reduce((sum, test) => sum + test.wpm, 0);
        const totalAccuracy = history.reduce((sum, test) => sum + test.accuracy, 0);
        const bestWPM = Math.max(...history.map(test => test.wpm));

        setStats({
          averageWPM: Math.round(totalWPM / totalTests),
          averageAccuracy: Math.round(totalAccuracy / totalTests),
          totalTests,
          bestWPM
        });
      }
    }
  }, [user]);

  return (
    <div className="relative isolate pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-gradient mb-8">
            Dashboard
          </h1>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="flex items-center gap-4">
                <UserIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">Username</p>
                  <p className="text-xl font-semibold">{user?.username}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">Average WPM</p>
                  <p className="text-xl font-semibold">{stats.averageWPM}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">Best WPM</p>
                  <p className="text-xl font-semibold">{stats.bestWPM}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-4">
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">Accuracy</p>
                  <p className="text-xl font-semibold">{stats.averageAccuracy}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Recent Tests</h2>
            {user?.typingHistory && user.typingHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">WPM</th>
                      <th className="py-3 px-4">Accuracy</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.typingHistory.slice(0, 10).map((test, index) => (
                      <tr key={index} className="border-b border-gray-800">
                        <td className="py-3 px-4">{index + 1}</td>
                        <td className="py-3 px-4">{test.wpm}</td>
                        <td className="py-3 px-4">{test.accuracy}%</td>
                        <td className="py-3 px-4">{new Date(test.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">No typing tests completed yet. Start practicing to see your progress!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}