const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const auth = require('./auth');
const mongoose = require('mongoose');

// Create a new room
router.post('/create', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const roomId = Math.random().toString(36).substring(2, 8);
    const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
    
    // Get a random text for the room
    const texts = [
      "The quick brown fox jumps over the lazy dog and runs through the meadow.",
      "To be or not to be, that is the question that Shakespeare posed in Hamlet.",
      "All that glitters is not gold, but it sure does shine bright in the sunlight.",
      "A journey of a thousand miles begins with a single step forward into the unknown.",
      "Actions speak louder than words, so let your actions define who you are."
    ];
    const randomText = texts[Math.floor(Math.random() * texts.length)];
    
    const room = new Room({
      roomId,
      roomCode,
      text: randomText,
      maxParticipants: req.body.maxParticipants || 10
    });
    
    await room.save({ session });
    await session.commitTransaction();
    res.status(201).json({ ...room.toObject(), roomCode });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
});

// Get all active rooms
router.get('/', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rooms = await Room.find(
      { status: { $ne: 'completed' } },
      { roomId: 1, participants: 1, status: 1, startTime: 1 },
      { session }
    ).exec();
    await session.commitTransaction();
    res.json(rooms);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      error: error.message,
      code: 'FETCH_ROOMS_ERROR'
    });
  } finally {
    session.endSession();
  }
});

// Get room by ID
router.get('/:roomId', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const room = await Room.findOne(
      { roomId: req.params.roomId },
      null,
      { session }
    ).populate('participants.userId', 'username');
    
    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ 
        error: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      });
    }

    await session.commitTransaction();
    res.json(room);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      error: error.message,
      code: 'FETCH_ROOM_ERROR'
    });
  } finally {
    session.endSession();
  }
});

// Validate room
router.post('/validate', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { roomCode } = req.body;
    
    if (!roomCode) {
      await session.abortTransaction();
      return res.status(400).json({
        valid: false,
        error: 'Room code is required'
      });
    }

    console.log('Validating room with code:', roomCode);
    const room = await Room.findOne(
      { roomCode: roomCode.toString() },
      null,
      { session }
    );
    console.log('Room found:', room);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({
        valid: false,
        error: 'Room not found. Please check the room code and try again.'
      });
    }

    if (room.status === 'active') {
      await session.abortTransaction();
      return res.status(403).json({
        valid: false,
        error: 'Game has already started in this room.'
      });
    }

    if (room.isFull()) {
      await session.abortTransaction();
      return res.status(403).json({
        valid: false,
        error: 'Room is full. Please try another room.'
      });
    }

    await session.commitTransaction();
    res.json({
      valid: true,
      roomId: room.roomId
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      valid: false,
      error: 'Server error. Please try again later.'
    });
  } finally {
    session.endSession();
  }
});

// Update room status
router.patch('/:roomId/status', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const room = await Room.findOne(
      { roomId: req.params.roomId },
      null,
      { session }
    );

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ 
        error: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      });
    }
    
    room.status = req.body.status;
    if (req.body.status === 'active') {
      room.startTime = new Date();
    } else if (req.body.status === 'completed') {
      room.endTime = new Date();
    }
    
    await room.save({ session });
    await session.commitTransaction();
    res.json(room);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ 
      error: error.message,
      code: 'UPDATE_ROOM_ERROR'
    });
  } finally {
    session.endSession();
  }
});

// Join a room by code
router.post('/join', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user || !req.user._id) {
      await session.abortTransaction();
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { roomCode } = req.body;
    if (!roomCode) {
      await session.abortTransaction();
      return res.status(400).json({ 
        error: 'Room code is required',
        code: 'ROOM_CODE_REQUIRED'
      });
    }

    const room = await Room.findOne({ roomCode }).session(session);
    
    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ 
        error: 'Invalid room code',
        code: 'INVALID_ROOM_CODE'
      });
    }

    if (room.status !== 'waiting') {
      await session.abortTransaction();
      return res.status(403).json({ 
        error: 'Room is no longer accepting participants',
        code: 'ROOM_NOT_ACCEPTING'
      });
    }

    if (room.isFull()) {
      await session.abortTransaction();
      return res.status(403).json({ 
        error: 'Room is full',
        code: 'ROOM_FULL'
      });
    }

    // Check if user is already in the room
    const isAlreadyParticipant = room.participants.some(p => 
      p.userId && p.userId.toString() === req.user._id.toString()
    );
    if (isAlreadyParticipant) {
      await session.abortTransaction();
      return res.status(400).json({ 
        error: 'You are already in this room',
        code: 'ALREADY_IN_ROOM'
      });
    }

    // Validate socket connection
    const socketId = req.body.socketId;
    if (!socketId || typeof socketId !== 'string' || socketId.trim().length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Valid socket connection required',
        code: 'INVALID_SOCKET'
      });
    }

    try {
      const success = room.addParticipant(req.user._id, socketId.trim());
      if (!success) {
        await session.abortTransaction();
        return res.status(403).json({
          error: 'Failed to add participant to room',
          code: 'ADD_PARTICIPANT_FAILED'
        });
      }
    } catch (error) {
      await session.abortTransaction();
      return res.status(400).json({
        error: error.message,
        code: 'PARTICIPANT_VALIDATION_FAILED'
      });
    }

    await room.save({ session });
    await session.commitTransaction();

    res.json({ 
      roomId: room.roomId, 
      isJoined: true,
      code: 'JOIN_SUCCESS'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Room join error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'JOIN_ROOM_ERROR'
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;