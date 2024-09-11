import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';


// Open a database connection to chat.db in the current directory 
const db = await open({
  filename: 'chat.db',
  driver: sqlite3.Database
});

// create our 'messages' table (you can ignore the 'client_offset' column for now).
await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_offset TEXT UNIQUE,
    context TEXT
  );
`);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
});

io.on('connection', async (socket) => {
  socket.on('chat message', async (msg) => {
    let result;
    try {
      // store the message in the database
      result = await db.run('INSERT INTO messages (context) VALUES (?)', msg);
    } catch (e) {
      // TODO handle the failure
      return;
    }
    // include the offset with the message
    io.emit('chat message', msg, result.lastID);
  });

  if (!socket.recovered) {
    // if the connection state recovery was not successful
    try {
      await db.all('SELECT id, context FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset || 0]);
        rows.forEach((row) => {
          socket.emit('chat message', row.context, row.id);
        });
      } catch (e) {
        console.error("Error retrieving messages from the database:", e.message);
      }
    }
  });

io.on('connection', (socket) => {
    socket.on('chat message', (msg) => {
      console.log('message: ' + msg);
    });
});


io.on('connection', (socket) => {  
  socket.on('chat message', (msg) => {  
    io.emit('chat message', msg);
  });
});


server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});