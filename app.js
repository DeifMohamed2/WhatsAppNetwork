require('dotenv').config(); // Use dotenv for environment variables

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

// Encryption and Decryption Keys
const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const iv = Buffer.from(process.env.INITIALIZATION_VECTOR, 'hex');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB Setup
mongoose.connect(
  'mongodb+srv://3devWay:1qaz2wsx@cluster0.5orkagp.mongodb.net/ChatApp?retryWrites=true&w=majority&appName=Cluster0',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// WebSocket Setup
const Message = require('./models/Message');
const User = require('./models/user');

app.get('/messages/:user/:otherUser', async (req, res) => {
  const { user, otherUser } = req.params;
  const updated = await Message.updateMany(
    { sender: otherUser, recipient: user, readed: false },
    { readed: true }
  );

  // Notify the sender about read status
  const senderSocket = await User.findOne({ userName: otherUser }).select(
    'socketId'
  );
  if (senderSocket) {
    io.to(senderSocket.socketId).emit('messagesRead', { by: user });
  }

  const messages = await Message.find({
    $or: [
      { sender: user, recipient: otherUser },
      { sender: otherUser, recipient: user },
    ],
  }).sort({ createdAt: 1 });

  const decryptedMessages = messages.map((message) => ({
    ...message.toObject(),
    content: decrypt(message.content, message.iv),
  }));
  res.json(decryptedMessages);
});

app.get('/GroupMessage', async (req, res) => {
  try {
    const messages = await Message.find({ recipient: 'Group' }).sort({
      createdAt: 1,
    });
    const decryptedMessages = messages.map((message) => ({
      ...message.toObject(),
      content: decrypt(message.content, message.iv),
    }));
    res.json(decryptedMessages);
    console.log('Group Messages:', decryptedMessages);
  } catch (error) {
    console.error('Error fetching group messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// Encryption Utility Functions
function encrypt(text) {
  try {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encryptedData: encrypted, iv: iv.toString('hex') };
  } catch (err) {
    console.error('Encryption Error:', err.message);
    throw err;
  }
}

function decrypt(encryptedData, iv) {
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption Error:', err.message);
    throw err;
  }
}

const activeChats = new Map(); // Map to track active users and their current chats

io.on('connection', (socket) => {
console.log(`User connected: ${socket.id}`);

    socket.on('activeChat', async ({ userName, chatId }) => {
    activeChats.set(userName, chatId);

    // Mark unread messages as read
    const updated = await Message.updateMany(
        { sender: chatId, recipient: userName, readed: false },
        { readed: true }
    );

    // Notify the sender about the read status
    const senderSocket = await User.findOne({ userName: chatId }).select(
        'socketId'
    );
    if (senderSocket) {
        io.to(senderSocket.socketId).emit('messagesRead', { by: userName });
    }
    });

// Handle login

    socket.on('login', async (userName) => {
    try {
        // Update or create the user in the database
        let user = await User.findOneAndUpdate(
        { userName: userName },
        { socketId: socket.id, status: 'online' }
        );

        if (!user) {
        user = new User({ userName, socketId: socket.id, status: 'online' });
        await user.save();
        }

        // Fetch all users from the database
        const allUsers = await User.find();

        // Generate the personalized user list for the logged-in user
        const personalizedUserList = await Promise.all(
        allUsers.map(async (otherUser) => {
            const unreadMessagesCount = await Message.countDocuments({
            sender: otherUser.userName,
            recipient: userName,
            readed: false,
            });
            return {
            userName: otherUser.userName,
            status: otherUser.status,
            unreadMessagesCount, // Only calculate for the logged-in user
            };
        })
        );

        // Emit the personalized user list to the logged-in user
        socket.emit('userList', personalizedUserList);

        // Notify other users that this user is online, but without sending unread counts
        const broadcastUserList = allUsers.map((otherUser) => ({
        userName: otherUser.userName,
        status: otherUser.status,
        unreadMessagesCount: 0, // No unread count for other users
        }));

        socket.broadcast.emit('userList', broadcastUserList);
        socket.broadcast.emit('newUserIn', {userName});
    } catch (error) {
        console.error('Error handling login:', error.message);
    }
    });


    socket.on('privateMessage', async ({ sender, recipient, content }) => {
    try {
        const { encryptedData } = encrypt(content);
        const message = new Message({
        sender,
        recipient,
        content: encryptedData,
        iv: iv.toString('hex'),
        readed: false, // Initially marked as unread
        });
        await message.save();

        const recipientSocket = await User.findOne({
        userName: recipient,
        }).select('socketId');

        if (recipientSocket) {
        const isRecipientInChat = activeChats.get(recipient) === sender;

        // Emit message to recipient
        io.to(recipientSocket.socketId).emit('newMessage', {
            sender,
            recipient,
            content,
            isRead: isRecipientInChat,
        });

        if (isRecipientInChat) {
            // Mark message as read if recipient is in the chat
            message.readed = true;
            await message.save();

            // Notify sender and recipient about read status
            io.to(socket.id).emit('messagesRead', { by: recipient });
            io.to(recipientSocket.socketId).emit('messagesRead', {
            by: recipient,
            });
        }
        }
    } catch (err) {
        console.error('Error handling privateMessage:', err.message);
    }
    });


    socket.on('groupMessage', async ({ sender, content }) => {
    try {
        console.log('Group Message:', sender, content);
        const { encryptedData } = encrypt(content);
        const message = new Message({
        sender,
        recipient:'Group',
        content: encryptedData,
        iv: iv.toString('hex'),
        });
        await message.save();

        socket.broadcast.emit('newMessage', {
        sender,
        recipient : 'Group',
        content,
        });
    } catch (err) {
        console.error('Error handling groupMessage:', err.message);
    }
    } );

    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);

        // Attempt to find and update the user
        const userData = await User.findOneAndUpdate({ socketId: socket.id }, { status: 'offline' });

        if (!userData) {
            console.log(`No user found for socketId: ${socket.id}`);
            return; // Exit early if no user is found
        }

        // Fetch all users to update the user list
        const users = await User.find();
        const Users = users.map((user) => ({
            userName: user.userName,
            status: user.status,
        }));

        // Broadcast updated user list to all clients
        socket.broadcast.emit('userList', Users);
        socket.broadcast.emit('userLeft', userData.userName);
        activeChats.delete(userData.userName); // Remove user from active chats
    });

});

// Server Start
const PORT = 3200;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
