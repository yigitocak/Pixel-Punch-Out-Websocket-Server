import express from "express";
import http from "http";
import { Server } from "socket.io";
import tick from "./tick.js";
import SocketHandler from "./socketHandler.js"

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
    pingInterval: 2000,
    pingTimeout: 5000,
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
const port = process.env.PORT || 5050;

// Globals
const players = [];
const inputsMap = {};

// Gravity
const GRAVITY = 2;
const JUMPSPEED = -30;

// Socket Listeners
const socketHandler = new SocketHandler(io, players, inputsMap);
socketHandler.handleConnection();

// Tick Loop
setInterval(() => {
    if (socketHandler.started) {
        tick(players, inputsMap, GRAVITY, JUMPSPEED);
        io.emit("playerInputs", inputsMap);
        io.emit("players", players);
    }
}, 1000 / 30);

server.listen(port, () => {
    console.log(`Running on ${port}`);
});
