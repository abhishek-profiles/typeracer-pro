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
socketServer.listen(socketPort, () => {
  console.log(`Socket server running on port ${socketPort}`);
});

// Configure CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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

// Socket.IO setup with connection management
const io = socketIO(socketServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io',
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,  // 2 minutes
    skipMiddlewares: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1 MB
  transports: ['websocket', 'polling'],  // Allow fallback to polling
  allowUpgrades: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxSocketConnections: 100
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
        );

        if (!updatedRoom) return;

        socket.to(roomId).emit('userProgress', {
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
            finalScores: updatedRoom.participants
          });
        }
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    });

    // Handle ready state
    socket.on('playerReady', async (roomId) => {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const participant = room.participants.find(p => p.socketId === socket.id);
      if (participant) {
        participant.ready = true;
        await room.save();

        // Check if all participants are ready
        const allReady = room.participants.every(p => p.ready);
        if (allReady) {
          // Start countdown
          let countdown = 3;
          const timer = setInterval(() => {
            if (countdown > 0) {
              io.to(roomId).emit('countdown', countdown);
              countdown--;
            } else {
              clearInterval(timer);
              room.status = 'active';
              room.startTime = new Date();
              room.save();
              io.to(roomId).emit('gameStart', { text: room.text });
            }
          }, 1000);
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

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/dist/index.html'));
  });
}

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});