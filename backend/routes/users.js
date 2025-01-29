const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('./auth');

// Get global leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}, {
      username: 1,
      'highScore.wpm': 1,
      typingHistory: 1
    }).sort({ 'highScore.wpm': -1 }).limit(100);

    const leaderboard = users.map(user => {
      const stats = {
        averageWPM: 0,
        totalTests: user.typingHistory?.length || 0
      };

      if (stats.totalTests > 0) {
        const totalWPM = user.typingHistory.reduce((sum, test) => sum + test.wpm, 0);
        stats.averageWPM = Math.round(totalWPM / stats.totalTests);
      }

      return {
        _id: user._id,
        username: user.username,
        highScore: user.highScore || { wpm: 0 },
        stats,
        typingHistory: user.typingHistory
      };
    });

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save typing history
router.post('/typing-history', auth, async (req, res) => {
  try {
    const { wpm, accuracy, date } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add new test to typing history
    user.typingHistory.push({ wpm, accuracy, date });
    
    // Update high score if necessary
    if (!user.highScore || wpm > (user.highScore.wpm || 0)) {
      if (!user.highScore) user.highScore = {};
      user.highScore.wpm = wpm;
    }
    if (!user.highScore || accuracy > (user.highScore.accuracy || 0)) {
      if (!user.highScore) user.highScore = {};
      user.highScore.accuracy = accuracy;
    }

    // Calculate and update user stats
    const stats = {
      totalTests: user.typingHistory.length,
      averageWPM: 0,
      averageAccuracy: 0
    };

    if (stats.totalTests > 0) {
      const totalWPM = user.typingHistory.reduce((sum, test) => sum + test.wpm, 0);
      const totalAccuracy = user.typingHistory.reduce((sum, test) => sum + test.accuracy, 0);
      stats.averageWPM = Math.round(totalWPM / stats.totalTests);
      stats.averageAccuracy = Math.round(totalAccuracy / stats.totalTests);
    }

    user.stats = stats;
    await user.save();
    
    // Return updated user data
    res.status(201).json({
      typingHistory: user.typingHistory,
      highScore: user.highScore,
      stats: user.stats
    })
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;