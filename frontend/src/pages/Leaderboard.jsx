import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrophyIcon } from '@heroicons/react/24/solid';

const API_URL = import.meta.env.VITE_API_URL;

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'highScore.wpm', direction: 'desc' });

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedLeaderboard = () => {
    if (!leaderboard) return [];
    
    return [...leaderboard].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      
      if (sortConfig.key === 'username') {
        return direction * a.username.localeCompare(b.username);
      }
      
      if (sortConfig.key === 'highScore.wpm') {
        return direction * ((a.highScore?.wpm || 0) - (b.highScore?.wpm || 0));
      }
      
      if (sortConfig.key === 'stats.averageWPM') {
        return direction * ((a.stats?.averageWPM || 0) - (b.stats?.averageWPM || 0));
      }
      
      if (sortConfig.key === 'typingHistory.length') {
        return direction * ((a.typingHistory?.length || 0) - (b.typingHistory?.length || 0));
      }
      
      return 0;
    });
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users/leaderboard`);
        setLeaderboard(response.data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="relative isolate pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-gradient mb-4">
              Global Leaderboard
            </h1>
            <p className="text-lg text-gray-300">
              Top typists from around the world
            </p>
          </div>

          {loading ? (
            <div className="text-center">
              <p className="text-gray-400">Loading leaderboard...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-700 bg-gray-800/50">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('username')}>Username {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('highScore.wpm')}>Best WPM {sortConfig.key === 'highScore.wpm' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('stats.averageWPM')}>Average WPM {sortConfig.key === 'stats.averageWPM' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-gray-800/80" onClick={() => handleSort('typingHistory.length')}>Tests Completed {sortConfig.key === 'typingHistory.length' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedLeaderboard().map((user, index) => (
                    <tr key={user._id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors duration-200">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <TrophyIcon className="h-5 w-5 text-yellow-500" />}
                          {index === 1 && <TrophyIcon className="h-5 w-5 text-gray-400" />}
                          {index === 2 && <TrophyIcon className="h-5 w-5 text-amber-600" />}
                          <span className={`font-semibold ${index < 3 ? 'text-blue-400' : ''}`}>{index + 1}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{user.username}</td>
                      <td className="py-3 px-4 font-semibold text-green-400">{user.highScore?.wpm || 0}</td>
                      <td className="py-3 px-4">{user.stats?.averageWPM || 0}</td>
                      <td className="py-3 px-4">{user.typingHistory?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}