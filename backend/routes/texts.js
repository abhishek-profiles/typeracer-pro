const express = require('express');
const router = express.Router();

// Sample texts for typing practice
const typingTexts = [
  "The quick brown fox jumps over the lazy dog.",
  "To be or not to be, that is the question.",
  "All that glitters is not gold.",
  "A journey of a thousand miles begins with a single step.",
  "Practice makes perfect, and perfect practice makes perfect typing."
];

// Get a random typing text
router.get('/random', (req, res) => {
  const randomIndex = Math.floor(Math.random() * typingTexts.length);
  res.json({ text: typingTexts[randomIndex] });
});

module.exports = router;