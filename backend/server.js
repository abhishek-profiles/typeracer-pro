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

// Create Express app
const app = express();
const server = http.createServer(app);
const socketServer = http.createServer();

// Configure socket server to listen on SOCKET_PORT
const socketPort = process.env.SOCKET_PORT || 3001;
server.listen(socketPort, () => {
  console.log(`Socket server running on port ${socketPort}`);
});

// Configure CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Origin', 'Authorization'],
  maxAge: 86400
}));

// Add CORS preflight options
app.options('*', cors());

// Parse JSON bodies
app.use(express.json());

// Socket.IO setup with enhanced security and connection management
const io = socketIO(server, {
  cors: {
    origin: ['https://typeracer-pro.vercel.app', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  path: '/socket.io',
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,  // 2 minutes
    skipMiddlewares: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1 MB
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxSocketConnections: 100,
  secure: true,
  rejectUnauthorized: false,
  forceNew: true,
  timeout: 20000,
  upgrade: true,
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': 'https://typeracer-pro.vercel.app',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': true
    });
    res.end();
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

    // Handle game start
    socket.on('startGame', async (roomId) => {
      const room = await Room.findOne({ roomId });
      if (!room) {
        socket.emit('roomError', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
        return;
      }

      // Check if the socket belongs to room creator (first participant)
      const isCreator = room.participants[0]?.socketId === socket.id;
      if (!isCreator) {
        socket.emit('roomError', { message: 'Only room creator can start the game', code: 'NOT_CREATOR' });
        return;
      }

      // Start countdown with initial emit
      let countdown = 3;
      io.to(roomId).emit('countdown', countdown);
      
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown >= 0) {
          io.to(roomId).emit('countdown', countdown);
        } else {
          clearInterval(countdownInterval);
          startGame();
        }
      }, 1000);

      // Separate async function to handle game start
      async function startGame() {
        try {
          const updatedRoom = await Room.findOneAndUpdate(
            { roomId },
            { 
              $set: { 
                status: 'active',
                startTime: new Date()
              }
            },
            { new: true }
          );
          if (updatedRoom) {
            io.to(roomId).emit('gameStart', { text: updatedRoom.text });
          }
        } catch (error) {
          console.error('Error starting game:', error);
          socket.emit('roomError', { message: 'Failed to start game', code: 'START_GAME_ERROR' });
        }
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
        if (authenticatedUser && authenticatedUser._id) {
          userConnections.delete(authenticatedUser._id.toString());
          connectionIds.delete(connectionId);
          activeConnections = Math.max(0, activeConnections - 1);
        }

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        console.error('Error handling transport error:', err);
      } finally {
        session.endSession();
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

// Development 404 handler for all other routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start the server
const port = process.env.PORT || 3000;
const mainServer = app.listen(port, () => {
  console.log(`Main server running on port ${port}`);
});