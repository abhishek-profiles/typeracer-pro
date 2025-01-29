import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
import { UserIcon } from '@heroicons/react/24/solid';

export default function Multiplayer() {
  const { user, getToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState([]);
  const [text, setText] = useState('');
  const [input, setInput] = useState('');
  const [gameStatus, setGameStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(3);
  const [startTime, setStartTime] = useState(null);
  const [progress, setProgress] = useState(0);
  const [wpm, setWPM] = useState(0);
  const [accuracy, setAccuracy] = useState(100);

  const initializeSocket = async () => {
    if (!user?._id) {
      setError('You must be logged in to join a room');
      return null;
    }
  
    try {
      const token = await getToken();
      
      if (!token) {
        setError('Authentication failed. Please log in again.');
        return null;
      }
  
      // Ensure token is set in axios defaults
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  
      // Set token in axios defaults before creating socket
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const connectionId = Math.random().toString(36).substring(7);
      const socketInstance = io(SOCKET_URL, {
        path: '/socket.io',
        auth: { token, connectionId, userId: user._id },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 30000,
        autoConnect: false,
        forceNew: true,
        withCredentials: true
      });

      socketInstance.on('connect_error', async (error) => {
        console.error('Socket connection error:', error);
        if (error.message.includes('Authentication')) {
          const newToken = await getToken();
          if (newToken) {
            socketInstance.auth.token = newToken;
            socketInstance.connect();
          } else {
            setError('Authentication failed. Please log in again.');
            socketInstance.close();
          }
        } else {
          setError(`Connection error: ${error.message}. Attempting to reconnect...`);
          // Don't close the socket, let it attempt to reconnect
          setTimeout(() => socketInstance.connect(), 2000);
        }
      });

      socketInstance.on('connect', () => {
        console.log('Socket connected successfully');
        setError('');
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        if (reason === 'io server disconnect' || reason === 'transport close') {
          setError('Disconnected from server. Attempting to reconnect...');
          setTimeout(() => {
            if (socketInstance) {
              socketInstance.connect();
            }
          }, 2000);
        }
      });
  
      return socketInstance;
    } catch (error) {
      console.error('Socket initialization error:', error);
      setError('Failed to establish connection. Please try again.');
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        setSocket(null);
        setRoom(null);
        setGameStatus('waiting');
        setParticipants([]);
      }
    };
  }, [socket]);



  useEffect(() => {
    if (!socket) return;

    const eventHandlers = {
      userJoined: ({ participants: newParticipants, roomCode }) => {
        setParticipants(newParticipants);
        if (roomCode) setRoomCode(roomCode);
      },
      roomReady: () => {
        setGameStatus('ready');
        setError('');
      },
      countdown: (count) => {
        setCountdown(count);
        setGameStatus('countdown');
      },
      gameStart: ({ text: gameText }) => {
        setText(gameText);
        setStartTime(Date.now());
        setGameStatus('active');
        setInput('');
        setProgress(0);
        setWPM(0);
        setAccuracy(100);
      },
      userProgress: ({ userId, progress, wpm }) => {
        setParticipants(prev =>
          prev.map(p =>
            p.socketId === userId ? { ...p, progress, wpm } : p
          )
        );
      },
      gameEnd: ({ winner, finalScores }) => {
        setGameStatus('completed');
        setParticipants(finalScores);
        // Reset game state
        setStartTime(null);
      },
      roomError: (error) => {
        setError(error);
        setShowJoinForm(true);
        setRoom(null);
      },
      userLeft: ({ participants: updatedParticipants }) => {
        setParticipants(updatedParticipants);
        if (updatedParticipants.length < 2) {
          setGameStatus('waiting');
          setError('Waiting for more players to join...');
        }
      }
    };

    // Register all event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // Clean up all event handlers
      Object.keys(eventHandlers).forEach(event => {
        socket.off(event);
      });
    };
  }, [socket]);

  const createRoom = async () => {
    if (!user) {
      setError('You must be logged in to create a room');
      return;
    }
    
    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      const response = await axios.post(`${API_URL}/api/rooms/create`, 
        { userId: user._id },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          validateStatus: function (status) {
            return status >= 200 && status < 500; // Handle all responses except server errors
          }
        }
      );

      if (!response.data || !response.data.roomId || !response.data.roomCode) {
        throw new Error('Invalid response from server');
      }

      const { roomId, roomCode } = response.data;
      
      // Initialize socket connection when creating room
      const socketInstance = await initializeSocket();
      if (socketInstance) {
        socketInstance.connect();
        setSocket(socketInstance);
        
        // Automatically join room for creator
        socketInstance.emit('joinRoom', { roomId, userId: user._id, username: user.username });
        setRoom(roomId);
        setRoomCode(roomCode);
        setError('');
        
        // Show waiting message
        setError('Waiting for other players to join...');
      }
    } catch (error) {
      console.error('Create room error:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else {
        setError(error.response?.data?.error || 'Failed to create room. Please try again.');
      }
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to join a room');
      return;
    }
    
    if (!roomCode || roomCode.trim().length !== 5) {
      setError('Please enter a valid 5-digit room code.');
      return;
    }

    let socketInstance = null;
    try {
      setError('Validating room...');
      
      // Get fresh token and verify it's valid
      const token = await getToken();
      if (!token) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      // Validate room first before socket connection
      const validateResponse = await axios.post(`${API_URL}/api/rooms/validate`, { 
        roomCode: roomCode.trim(),
        userId: user._id
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!validateResponse.data.valid) {
        setError(validateResponse.data.error || 'Room is not available');
        return;
      }

      // Initialize socket connection after room validation
      socketInstance = await initializeSocket();
      if (!socketInstance) {
        setError('Failed to establish connection. Please try again.');
        return;
      }

      // Connect socket and wait for successful connection
      socketInstance.connect();
      setSocket(socketInstance);

      // Join the room after successful socket connection
      socketInstance.emit('joinRoom', {
        roomId: validateResponse.data.roomId,
        userId: user._id,
        username: user.username
      });
      setRoom(validateResponse.data.roomId);
      return socketInstance;
    } catch (error) {
      console.error('Socket initialization error:', error);
      setError('Failed to establish connection. Please try again.');
      return null;
    }
  };

  const calculateWPM = useCallback(() => {
    if (!startTime) return 0;
    const timeElapsed = (Date.now() - startTime) / 1000 / 60;
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

  const handleInputChange = (e) => {
    if (gameStatus !== 'active') return;
    
    const newInput = e.target.value;
    setInput(newInput);

    const newProgress = Math.round((newInput.length / text.length) * 100);
    const newWPM = calculateWPM();
    const newAccuracy = calculateAccuracy();

    setProgress(newProgress);
    setWPM(newWPM);
    setAccuracy(newAccuracy);

    socket.emit('typingProgress', {
      roomId: room,
      progress: newProgress,
      wpm: newWPM,
      accuracy: newAccuracy
    });
  };

  const readyToStart = () => {
    if (!socket || !room) return;
    socket.emit('playerReady', room);
  };

  return (
    <div className="relative isolate pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-gradient mb-4">
              Multiplayer Race
            </h1>
            <p className="text-lg text-gray-300">
              Compete with other players in real-time
            </p>
          </div>

          {!room ? (
            <div className="space-y-8">
              {error && (
                <div className="rounded-md bg-red-900/50 p-4 border border-red-800">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {!showJoinForm ? (
                <div className="flex justify-center space-x-4">
                  <button onClick={() => setShowJoinForm(true)} className="btn-primary">
                    Join Match
                  </button>
                  <button onClick={createRoom} className="btn-primary">
                    Create Match
                  </button>
                </div>
              ) : (
                <div className="max-w-md mx-auto">
                  <form onSubmit={joinRoom} className="space-y-4">
                    <div>
                      <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300">
                        Enter 5-digit Room Code
                      </label>
                      <input
                        type="text"
                        id="roomCode"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        placeholder="Enter room code"
                        className="mt-1 block w-full rounded-md bg-gray-800 border border-gray-700 text-white px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={5}
                        pattern="[0-9]{5}"
                        required
                      />
                    </div>
                    <div className="flex justify-center space-x-4">
                      <button type="button" onClick={() => setShowJoinForm(false)} className="btn-secondary">
                        Back
                      </button>
                      <button type="submit" className="btn-primary">
                        Join
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {roomCode && (
                <div className="text-center mb-4">
                  <p className="text-gray-300">Room Code: <span className="font-mono font-bold text-blue-500">{roomCode}</span></p>
                  <p className="text-sm text-gray-400">Share this code with others to join the race</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participants.map((participant) => (
                  <div key={participant.socketId} className="card hover:border-blue-500/50 transition-all">
                    <div className="flex items-center gap-4">
                      <UserIcon className="h-8 w-8 text-blue-500" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-lg">{participant.username}</p>
                          {gameStatus === 'ready' && (
                            <span className="text-sm px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                              Waiting
                            </span>
                          )}
                        </div>
                        {(gameStatus === 'active' || gameStatus === 'completed') && (
                          <>
                            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${participant.progress || 0}%` }}
                              />
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                              {participant.wpm || 0} WPM
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {gameStatus === 'ready' && (
                <div className="text-center">
                  <button onClick={readyToStart} className="btn-primary">
                    Ready
                  </button>
                </div>
              )}

              {gameStatus === 'countdown' && (
                <div className="text-center">
                  <p className="text-6xl font-bold text-blue-500">{countdown}</p>
                </div>
              )}

              {(gameStatus === 'active' || gameStatus === 'completed') && (
                <div className="space-y-6">
                  <div className="card">
                    <p className="text-lg text-gray-300 mb-4 leading-relaxed">{text}</p>
                  </div>

                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    disabled={gameStatus === 'completed'}
                    className="w-full h-32 bg-gray-800 text-white border border-gray-700 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Start typing when the race begins..."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}