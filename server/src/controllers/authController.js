import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { assessDifficulty } from '../services/difficultyEngine.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-coding-tutor-secret-key-development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check existing
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existing) {
      return res.status(409).json({ message: 'User with this email or username already exists' });
    }

    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    await user.save();
    const token = generateToken(user._id);

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        currentDifficulty: user.currentDifficulty
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'Server error during registration', error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { credential, email, username, password } = req.body;
    const loginIdentifier = credential || email || username;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Email/username and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { email: loginIdentifier.toLowerCase() },
        { username: loginIdentifier }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    const difficultyInfo = await assessDifficulty(user._id);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        currentDifficulty: difficultyInfo.level,
        difficultyScore: difficultyInfo.score
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login', error: err.message });
  }
}

export async function getProfile(req, res) {
  try {
    const user = req.user;
    const difficultyInfo = await assessDifficulty(user._id);

    return res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        currentDifficulty: difficultyInfo.level,
        difficultyScore: difficultyInfo.score,
        metrics: difficultyInfo.metrics
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ message: 'Server error fetching profile', error: err.message });
  }
}
