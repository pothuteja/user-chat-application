require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // <--- Add this line
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

// --- MONGOOSE CONNECT ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulsechat';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- SCHEMAS & MODELS ---
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const MessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: String, required: true },
  status: { type: String, default: 'delivered' },
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

let onlineUsers = new Map(); // socket.id -> username

// Helper: Broadcast online user count
const broadcastOnlineUsers = () => {
  const activeUsers = Array.from(new Set(Array.from(onlineUsers.values())));
  io.emit('online_users_update', { users: activeUsers });
};

// --- AUTH ROUTES ---

// 1. REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const cleanUsername = username.trim();
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken. Please choose a different username.',
      });
    }

    const newUser = new User({ username: cleanUsername, password });
    await newUser.save();

    return res.json({ success: true, username: cleanUsername });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// 2. LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const cleanUsername = username.trim();
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
    });

    if (!existingUser) {
      return res.status(401).json({ success: false, message: 'Incorrect username.' });
    }

    if (existingUser.password !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    return res.json({ success: true, username: existingUser.username });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Fetch messages history
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ _id: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// Clear Message Database History
app.delete('/api/clear-history', async (req, res) => {
  try {
    await Message.deleteMany({});
    io.emit('chat_cleared');
    return res.json({ success: true, message: 'Message history cleared successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to clear chat history.' });
  }
});

// --- SOCKET.IO HANDLERS ---
io.on('connection', (socket) => {
  broadcastOnlineUsers();

  socket.on('user_joined', (username) => {
    if (!username || !username.trim()) return;
    onlineUsers.set(socket.id, username.trim());
    broadcastOnlineUsers();
  });

  socket.on('typing_start', (username) => {
    socket.broadcast.emit('user_typing', username);
  });

  socket.on('typing_stop', () => {
    socket.broadcast.emit('user_stopped_typing');
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        username: data.username.trim(),
        text: data.text,
        timestamp: data.timestamp,
        status: 'delivered',
      });

      const savedMessage = await newMessage.save();
      io.emit('receive_message', savedMessage);
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  });

  socket.on('mark_messages_read', async ({ readerUsername }) => {
    if (!readerUsername) return;
    const cleanReader = readerUsername.trim().toLowerCase();

    try {
      const result = await Message.updateMany(
        { username: { $ne: cleanReader }, status: {$ne: 'read' } },
        { $set: { status: 'read' } }
      );

      if (result.modifiedCount > 0) {
        io.emit('messages_marked_read', { readerUsername });
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    broadcastOnlineUsers();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));