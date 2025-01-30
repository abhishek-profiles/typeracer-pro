import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, ChartBarIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    averageWPM: 0,
    averageAccuracy: 0,
    totalTests: 0,
    bestWPM: 0,
    recentImprovement: 0
  });
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filterDays, setFilterDays] = useState(30);

  useEffect(() => {
    if (user?.typingHistory) {
      const now = new Date();
      const filteredHistory = user.typingHistory.filter(test => {
        const testDate = new Date(test.date);
        const diffTime = Math.abs(now - testDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= filterDays;
      });

      const totalTests = filteredHistory.length;
      
      if (totalTests > 0) {
        const totalWPM = filteredHistory.reduce((sum, test) => sum + test.wpm, 0);
        const totalAccuracy = filteredHistory.reduce((sum, test) => sum + test.accuracy, 0);
        const bestWPM = Math.max(...filteredHistory.map(test => test.wpm));

        // Calculate improvement (compare average of last 3 tests with first 3 tests)
        const recentTests = filteredHistory.slice(-3);
        const oldTests = filteredHistory.slice(0, 3);
        const recentAvg = recentTests.reduce((sum, test) => sum + test.wpm, 0) / recentTests.length;
        const oldAvg = oldTests.reduce((sum, test) => sum + test.wpm, 0) / oldTests.length;
        const improvement = recentAvg - oldAvg;

        setStats({
          averageWPM: Math.round(totalWPM / totalTests),
          averageAccuracy: Math.round(totalAccuracy / totalTests),
          totalTests,
          bestWPM,
          recentImprovement: Math.round(improvement)
        });
      }
    }
  }, [user, filterDays]);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedHistory = () => {
    if (!user?.typingHistory) return [];
    
    return [...user.typingHistory]
      .sort((a, b) => {
        if (sortConfig.key === 'date') {
          return sortConfig.direction === 'asc' 
            ? new Date(a.date) - new Date(b.date)
            : new Date(b.date) - new Date(a.date);
        }
        return sortConfig.direction === 'asc'
          ? a[sortConfig.key] - b[sortConfig.key]
          : b[sortConfig.key] - a[sortConfig.key];
      });
  };

  return (
    <div className="relative isolate pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-gradient">
              Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <select
                value={filterDays}
                onChange={(e) => setFilterDays(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-4">
                <UserIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">Username</p>
                  <p className="text-xl font-semibold">{user?.username}</p>
                </div>
              </div>
            </div>

            <div className="card transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-4">
                <ChartBarIcon className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-400">Average WPM</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold">{stats.averageWPM}</p>
                    {stats.recentImprovement !== 0 && (
                      <span className={`text-sm ${stats.recentImprovement > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.recentImprovement > 0 ? '+' : ''}{stats.recentImprovement}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-4">
                <ClockIcon className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-400">Best WPM</p>
                  <p className="text-xl font-semibold">{stats.bestWPM}</p>
                </div>
              </div>
            </div>

            <div className="card transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-4">
                <CheckCircleIcon className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-400">Accuracy</p>
                  <p className="text-xl font-semibold">{stats.averageAccuracy}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Recent Tests</h2>
              <p className="text-sm text-gray-400">{stats.totalTests} tests completed</p>
            </div>

            {user?.typingHistory && user.typingHistory.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr className="text-left">
                      <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('date')}>
                        Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('wpm')}>
                        WPM {sortConfig.key === 'wpm' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('accuracy')}>
                        Accuracy {sortConfig.key === 'accuracy' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedHistory().map((test, index) => (
                      <tr key={index} className="border-t border-gray-800 hover:bg-gray-800/30">
                        <td className="py-3 px-4">{new Date(test.date).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</td>
                        <td className="py-3 px-4">{test.wpm}</td>
                        <td className="py-3 px-4">{test.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-800/20 rounded-lg border border-gray-800">
                <p className="text-gray-400">No typing tests completed yet. Start practicing to see your progress!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}