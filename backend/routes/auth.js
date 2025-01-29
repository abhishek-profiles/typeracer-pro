const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'No authorization token provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.userId) {
        return res.status(401).json({ 
          error: 'Invalid token format', 
          code: 'INVALID_TOKEN_FORMAT' 
        });
      }
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired', 
          code: 'TOKEN_EXPIRED' 
        });
      }
      return res.status(401).json({ 
        error: 'Invalid token', 
        code: 'INVALID_TOKEN' 
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found', 
        code: 'USER_NOT_FOUND' 
      });
    }
    
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      error: 'Authentication failed', 
      code: 'AUTH_FAILED',
      details: error.message 
    });
  }
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password });
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    res.status(201).json({ 
      user,
      token,
      expiresAt: expiresAt.toISOString(),
      code: 'REGISTRATION_SUCCESS'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Email or username already exists',
        code: 'DUPLICATE_USER'
      });
    }
    res.status(500).json({ 
      error: 'Server error during registration',
      code: 'SERVER_ERROR'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        error: 'Invalid login credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    res.json({ 
      user,
      token,
      expiresAt: expiresAt.toISOString(),
      code: 'LOGIN_SUCCESS'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error during login',
      code: 'SERVER_ERROR'
    });
  }
});

// Verify token
router.get('/verify', auth, async (req, res) => {
  try {
    res.json({ valid: true, user: req.user });
  } catch (error) {
    res.status(401).json({ valid: false, error: error.message });
  }
});

// Refresh token
router.post('/refresh', auth, async (req, res) => {
  try {
    const newToken = jwt.sign(
      { userId: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token: newToken, user: req.user });
  } catch (error) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  res.json(req.user);
});

// Update user profile
router.patch('/profile', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['username', 'email', 'password'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));
  
  if (!isValidOperation) {
    return res.status(400).json({ error: 'Invalid updates' });
  }
  
  try {
    updates.forEach(update => req.user[update] = req.body[update]);
    await req.user.save();
    res.json(req.user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;