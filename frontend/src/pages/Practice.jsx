import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export default function Practice() {
  const { user, getToken } = useAuth();
  const [text, setText] = useState('');
  const [input, setInput] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWPM] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);

  const fetchText = async () => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('No valid token available');
        setText('The quick brown fox jumps over the lazy dog.');
        return;
      }

      const response = await axios.get(`${API_URL}/api/texts/random`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setText(response.data.text);
    } catch (error) {
      console.error('Error fetching text:', error);
      setText('The quick brown fox jumps over the lazy dog.');
    }
  };

  useEffect(() => {
    fetchText();
  }, []);

  const calculateWPM = useCallback(() => {
    if (!startTime) return 0;
    const timeElapsed = (Date.now() - startTime) / 1000 / 60; // in minutes
    const wordsTyped = input.trim().split(/\s+/).length;
    return Math.round(wordsTyped / timeElapsed);
  }, [input, startTime]);

  const calculateAccuracy = useCallback(() => {
    const textWords = text.split(' ');
    const inputWords = input.trim().split(' ');
    let correctWords = 0;

    inputWords.forEach((word, index) => {
      if (textWords[index] === word) correctWords++;
    });

    return Math.round((correctWords / inputWords.length) * 100) || 100;
  }, [text, input]);

  const handleInputChange = async (e) => {
    const newInput = e.target.value;
    if (!startTime && newInput) setStartTime(Date.now());
    setInput(newInput);

    // Update stats
    setWPM(calculateWPM());
    setAccuracy(calculateAccuracy());

    // Check if finished
    if (newInput.length >= text.length) {
      setIsFinished(true);
      if (user && user._id) {
        try {
          // Get fresh token before saving results
          const token = await getToken();
          if (!token) {
            console.error('Failed to save results: No valid token');
            return;
          }

          const testData = {
            userId: user._id,
            wpm: Math.round(calculateWPM()),
            accuracy: Math.round(calculateAccuracy()),
            date: new Date().toISOString()
          };

          const response = await axios.post(`${API_URL}/api/users/typing-history`, testData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('Typing history saved successfully:', response.data);
        } catch (error) {
          console.error('Error saving typing history:', error.response?.data?.error || error.message);
        }
      }
    }
  };

  const resetTest = () => {
    setInput('');
    setStartTime(null);
    setWPM(0);
    setAccuracy(100);
    setIsFinished(false);
    fetchText();
  };

  return (
    <div className="relative isolate pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-gradient mb-4 animate-fade-in">
              Practice Typing
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Improve your typing speed and accuracy with our interactive typing test
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="card transform hover:scale-105 transition-all">
              <div className="text-center p-4">
                <p className="text-4xl font-bold text-blue-500 mb-2">{wpm}</p>
                <p className="text-sm text-gray-400 uppercase tracking-wider">WPM</p>
              </div>
            </div>
            <div className="card transform hover:scale-105 transition-all">
              <div className="text-center p-4">
                <p className="text-4xl font-bold text-green-500 mb-2">{accuracy}%</p>
                <p className="text-sm text-gray-400 uppercase tracking-wider">Accuracy</p>
              </div>
            </div>
            <div className="card transform hover:scale-105 transition-all">
              <div className="text-center p-4">
                <p className="text-4xl font-bold text-purple-500 mb-2">
                  {Math.round((input.length / text.length) * 100)}%
                </p>
                <p className="text-sm text-gray-400 uppercase tracking-wider">Progress</p>
              </div>
            </div>
          </div>

          <div className="card mb-8 p-8 backdrop-blur-sm bg-gray-800/50">
            <p className="text-xl text-gray-300 mb-6 leading-relaxed font-mono">{text}</p>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <textarea
                value={input}
                onChange={handleInputChange}
                disabled={isFinished}
                className="w-full h-40 bg-gray-800/80 text-white border border-gray-700 rounded-xl p-6 font-mono text-lg leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Start typing..."
              />
              {isFinished && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm rounded-xl">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gradient mb-4">Test Complete!</p>
                    <button
                      onClick={resetTest}
                      className="btn-primary animate-bounce"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}