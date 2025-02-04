const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const Room = require('./models/Room');
const User = require('./models/User');

// Load environment variables
require('dotenv').config({ path: __dirname + '/.env' });

// MongoDB Connection Configuration
mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 15000,
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 60000,
  retryWrites: true,
  retryReads: true
}).then(() => {
  console.log('Connected to MongoDB successfully');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// MongoDB Connection Error Handling
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure server to listen on main port with improved error handling
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`Server running on port ${port}`);
  console.log('WebSocket server is ready for connections');
});

// Configure CORS with enhanced security
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Origin', 'Authorization'],
  maxAge: 86400,
  optionsSuccessStatus: 204
}));

// Add CORS preflight options
app.options('*', cors());

// Parse JSON bodies
app.use(express.json());

// Socket.IO setup with enhanced security and connection management
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin']
  },
  path: '/socket.io',
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxConnections: 100,
  perMessageDeflate: {
    threshold: 1024,
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    zlibDeflateOptions: {
      level: 4,
      memLevel: 7
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true
  },
  cookie: {
    name: 'io',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000
  }
});

// Track active connections with improved state management
let activeConnections = 0;
const MAX_CONNECTIONS = 100;
const userConnections = new Map();
const connectionIds = new Set();

// Socket authentication middleware with enhanced error handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token not provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      return next(new Error('Invalid token'));
    }
  } catch (error) {
    return next(new Error('Authentication failed'));
  }
});

// Socket.IO connection handling with improved error recovery
io.on('connection', async (socket) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check connection limits
    if (activeConnections >= MAX_CONNECTIONS) {
      socket.emit('error', { message: 'Server is at maximum capacity. Please try again later.', code: 'MAX_CONNECTIONS' });
      socket.disconnect(true);
      await session.abortTransaction();
      return;
    }

    // Check for existing connection from same user
    const authenticatedUser = socket.user;
    const connectionId = socket.handshake.auth.connectionId;

    if (!authenticatedUser || !connectionId) {
      socket.emit('error', { message: 'Authentication required', code: 'AUTH_REQUIRED' });
      socket.disconnect(true);
      return;
    }

    // Prevent duplicate connections with the same connectionId
    if (connectionIds.has(connectionId)) {
      socket.emit('error', { message: 'Duplicate connection detected', code: 'DUPLICATE_CONNECTION' });
      socket.disconnect(true);
      return;
    }

    // Handle existing user connection with cleanup
    if (userConnections.has(authenticatedUser._id.toString())) {
      try {
        const existingSocket = userConnections.get(authenticatedUser._id.toString());
        if (existingSocket) {
          // Clean up existing rooms
          if (existingSocket.currentRoom) {
            await leaveRoom(existingSocket, existingSocket.currentRoom);
          }
          existingSocket.emit('error', { message: 'New connection established', code: 'NEW_CONNECTION' });
          existingSocket.disconnect(true);
        }
        userConnections.delete(authenticatedUser._id.toString());
        connectionIds.delete(connectionId);
        activeConnections = Math.max(0, activeConnections - 1);
      } catch (cleanupError) {
        console.error('Error cleaning up existing connection:', cleanupError);
      }
    }

    // Track new connection with error handling
    try {
      connectionIds.add(connectionId);
      activeConnections++;
      userConnections.set(authenticatedUser._id.toString(), socket);
      socket.currentRoom = null; // Track current room in socket object
      console.log('User connected:', socket.id);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      socket.emit('error', { message: 'Failed to establish connection', code: 'CONNECTION_FAILED' });
      socket.disconnect(true);
      return;
    } finally {
      session.endSession();
    }

    let currentRoom = null;

    // Handle joining a room
    socket.on('joinRoom', async (data) => {
      try {
        const { roomId } = data;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const room = await Room.findOne({ roomId }).populate('participants.userId').session(session);
          
          if (!room) {
            socket.emit('roomError', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
            await session.abortTransaction();
            return;
          }

          if (room.isFull()) {
            socket.emit('roomError', { message: 'Room is full', code: 'ROOM_FULL' });
            await session.abortTransaction();
            return;
          }
          
          // Leave current room if exists
          if (currentRoom) {
            await leaveRoom(socket, currentRoom);
          }

          currentRoom = roomId;
          socket.join(roomId);

          // Use findOneAndUpdate for atomic operation with authenticated user data
          const updatedRoom = await Room.findOneAndUpdate(
            { roomId, status: { $ne: 'completed' } },
            { 
              $push: { 
                participants: { 
                  userId: authenticatedUser._id, 
                  socketId: socket.id,
                  username: authenticatedUser.username 
                } 
              } 
            },
            { new: true, session }
          ).populate('participants.userId');

          if (!updatedRoom) {
            socket.emit('roomError', { message: 'Failed to join room', code: 'JOIN_FAILED' });
            await session.abortTransaction();
            return;
          }

          await session.commitTransaction();

          io.to(roomId).emit('userJoined', { 
            participants: updatedRoom.participants,
            roomCode: room.roomCode 
          });

        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }

      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('roomError', { 
          message: 'Failed to join room', 
          code: 'JOIN_ROOM_ERROR',
          details: error.message 
        });
      }
    });

    // Helper function to handle leaving a room
    async function leaveRoom(socket, roomId) {
      try {
        socket.leave(roomId);
        const updatedRoom = await Room.findOneAndUpdate(
          { roomId },
          { $pull: { participants: { socketId: socket.id } } },
          { new: true }
        );
        
        if (updatedRoom) {
          socket.to(roomId).emit('userLeft', { 
            participants: updatedRoom.participants,
            socketId: socket.id 
          });
        }
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    }

    // Handle typing progress updates
    socket.on('typingProgress', async (data) => {
      const { roomId, progress, wpm, accuracy } = data;
      
      try {
        const updatedRoom = await Room.findOneAndUpdate(
          { roomId, 'participants.socketId': socket.id },
          {
            $set: {
              'participants.$.progress': progress,
              'participants.$.wpm': wpm,
              'participants.$.accuracy': accuracy
            }
          },
          { new: true }
        ).populate('participants.userId');

        if (!updatedRoom) return;

        // Sort participants by progress, WPM, and accuracy
        const sortedParticipants = updatedRoom.participants.sort((a, b) => {
          const progressDiff = (b.progress || 0) - (a.progress || 0);
          if (progressDiff !== 0) return progressDiff;
          const wpmDiff = (b.wpm || 0) - (a.wpm || 0);
          if (wpmDiff !== 0) return wpmDiff;
          return (b.accuracy || 0) - (a.accuracy || 0);
        });

        // Broadcast updated participants list to all users in the room
        io.to(roomId).emit('userProgress', {
          participants: sortedParticipants,
          userId: socket.id,
          progress,
          wpm,
          accuracy
        });

        // Check if game should end (someone reached 100% progress)
        if (progress === 100) {
          const participant = updatedRoom.participants.find(p => p.socketId === socket.id);
          if (participant && participant.userId) {
            // Update user's typing history
            await User.findByIdAndUpdate(participant.userId, {
              $push: { typingHistory: { wpm, accuracy } },
              $max: { 'highScore.wpm': wpm, 'highScore.accuracy': accuracy }
            });
          }

          await Room.findOneAndUpdate(
            { roomId },
            {
              $set: {
                status: 'completed',
                endTime: new Date()
              }
            }
          );
          
          io.to(roomId).emit('gameEnd', {
            winner: socket.id,
            finalScores: sortedParticipants
          });
        }
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    });

    // Handle game start with improved error handling and state management
    socket.on('startGame', async (roomId) => {
      const session = await mongoose.startSession();
      session.startTransaction();
    
      try {
        const room = await Room.findOne({ roomId }).session(session);
        if (!room) {
          await session.abortTransaction();
          socket.emit('roomError', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
          return;
        }
    
        // Check if the socket belongs to room creator (first participant)
        const isCreator = room.participants[0]?.socketId === socket.id;
        if (!isCreator) {
          await session.abortTransaction();
          socket.emit('roomError', { message: 'Only room creator can start the game', code: 'NOT_CREATOR' });
          return;
        }
    
        // Check if room has enough participants
        if (room.participants.length < 2) {
          await session.abortTransaction();
          socket.emit('roomError', { message: 'Need at least 2 players to start', code: 'NOT_ENOUGH_PLAYERS' });
          return;
        }
    
        // Check if game is already in progress
        if (room.status === 'active') {
          await session.abortTransaction();
          socket.emit('roomError', { message: 'Game is already in progress', code: 'GAME_IN_PROGRESS' });
          return;
        }
    
        // Start countdown with initial emit
        let countdown = 3;
        io.to(roomId).emit('countdown', countdown);
        
        const countdownInterval = setInterval(async () => {
          countdown--;
          if (countdown >= 0) {
            io.to(roomId).emit('countdown', countdown);
          } else {
            clearInterval(countdownInterval);
            await startGame();
          }
        }, 1000);
    
        // Separate async function to handle game start with transaction
        async function startGame() {
          const gameSession = await mongoose.startSession();
          gameSession.startTransaction();
    
          try {
            const updatedRoom = await Room.findOneAndUpdate(
              { roomId, status: 'waiting' },
              { 
                $set: { 
                  status: 'active',
                  startTime: new Date()
                }
              },
              { new: true, session: gameSession }
            );
    
            if (!updatedRoom) {
              throw new Error('Failed to update room status');
            }
    
            await gameSession.commitTransaction();
            io.to(roomId).emit('gameStart', { 
              text: updatedRoom.text,
              startTime: updatedRoom.startTime
            });
          } catch (error) {
            await gameSession.abortTransaction();
            console.error('Error starting game:', error);
            io.to(roomId).emit('roomError', { 
              message: 'Failed to start game', 
              code: 'START_GAME_ERROR',
              details: error.message
            });
          } finally {
            gameSession.endSession();
          }
        }
    
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        console.error('Error in game start process:', error);
        socket.emit('roomError', { 
          message: 'Failed to process game start', 
          code: 'GAME_START_ERROR',
          details: error.message
        });
      } finally {
        session.endSession();
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const session = await mongoose.startSession();
      session.startTransaction();
    
      try {
        console.log('User disconnected:', socket.id);
        if (currentRoom) {
          await leaveRoom(socket, currentRoom);
        }
        
        // Clean up connection tracking
        if (socket.user) {
          userConnections.delete(socket.user._id.toString());
        }
        if (socket.handshake.auth.connectionId) {
          connectionIds.delete(socket.handshake.auth.connectionId);
        }
        activeConnections = Math.max(0, activeConnections - 1);
    
        // Notify other users in shared rooms
        socket.rooms.forEach(async (roomId) => {
          try {
            const room = await Room.findOne({ roomId });
            if (room) {
              // Update room status if game was in progress
              if (room.status === 'active' && room.participants.length <= 2) {
                await Room.findOneAndUpdate(
                  { roomId },
                  { 
                    $set: { 
                      status: 'completed',
                      endTime: new Date()
                    }
                  }
                );
                io.to(roomId).emit('gameEnd', {
                  message: 'Game ended due to player disconnection',
                  code: 'PLAYER_DISCONNECTED'
                });
              }
            }
          } catch (error) {
            console.error('Error handling room cleanup on disconnect:', error);
          }
        });
    
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        console.error('Error handling disconnect:', error);
      } finally {
        session.endSession();
      }
    });

    // Error event handler
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      try {
        socket.emit('error', {
          message: 'An unexpected error occurred',
          code: 'SOCKET_ERROR',
          details: error.message
        });
      } catch (emitError) {
        console.error('Error sending error event:', emitError);
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Socket connection error:', error);
  } finally {
    session.endSession();
  }
});




// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const textRoutes = require('./routes/texts');
const userRoutes = require('./routes/users');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/texts', textRoutes);
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404 errors for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Root route handler
app.get('/', (req, res) => {
  res.json({
    message: 'Typing Speed Test API Server',
    status: 'running',
    endpoints: [
      '/api/auth',
      '/api/rooms',
      '/api/texts',
      '/api/users'
    ]
  });
});

// Development 404 handler for all other routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});