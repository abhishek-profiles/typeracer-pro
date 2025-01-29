const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  roomCode: {
    type: String,
    required: true,
    unique: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    socketId: String,
    progress: {
      type: Number,
      default: 0
    },
    wpm: {
      type: Number,
      default: 0
    },
    accuracy: {
      type: Number,
      default: 0
    }
  }],
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed'],
    default: 'waiting'
  },
  text: {
    type: String,
    required: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  maxParticipants: {
    type: Number,
    default: 10
  }
}, {
  timestamps: true
});

// Method to check if room is full
roomSchema.methods.isFull = function() {
  return this.participants.length >= this.maxParticipants;
};

// Method to add participant
roomSchema.methods.addParticipant = function(userId, socketId) {
  if (!userId || !socketId) {
    throw new Error('Both userId and socketId are required');
  }
  if (!this.isFull()) {
    this.participants.push({ userId, socketId });
    return true;
  }
  return false;
};

// Method to remove participant
roomSchema.methods.removeParticipant = function(socketId) {
  this.participants = this.participants.filter(p => p.socketId !== socketId);
};

// Method to update participant progress
roomSchema.methods.updateProgress = function(socketId, progress, wpm, accuracy) {
  const participant = this.participants.find(p => p.socketId === socketId);
  if (participant) {
    participant.progress = progress;
    participant.wpm = wpm;
    participant.accuracy = accuracy;
  }
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;