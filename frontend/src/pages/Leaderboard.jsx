import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrophyIcon } from '@heroicons/react/24/solid';

const API_URL = import.meta.env.VITE_API_URL;

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

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
                  <tr className="text-left border-b border-gray-700">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Best WPM</th>
                    <th className="py-3 px-4">Average WPM</th>
                    <th className="py-3 px-4">Tests Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user, index) => (
                    <tr key={user._id} className="border-b border-gray-800">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {index < 3 && <TrophyIcon className="h-5 w-5 text-yellow-500" />}
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4">{user.username}</td>
                      <td className="py-3 px-4">{user.highScore?.wpm || 0}</td>
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