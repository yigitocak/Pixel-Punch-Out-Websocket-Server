import axios from "axios";
import "dotenv/config";

const API_URL = process.env.BACKEND_URL;
const SECRET_KEY = process.env.SECRET_KEY;

class SocketHandler {
  constructor(io, players, inputsMap) {
    this.io = io;
    this.started = false;
    this.players = players;
    this.inputsMap = inputsMap;
    this.deathHandled = false;
  }

  handleConnection() {
    this.io.on("connection", (socket) => {
      console.log(`A user connected: ${socket.id}`);
      if (this.players.length === 2) {
        socket.emit("ConnectionRefused", "Room is full");
        setTimeout(() => {
          socket.emit("close");
          socket.disconnect();
        }, 3000);
      } else {
        this.addPlayer(socket);
        this.setupPlayerListeners(socket);
        this.listenForBackgroundRequest(socket);
        this.listenForCountdown(socket);
        this.listenForDeath(socket);
        this.listenForNameRequests(socket);
      }
    });
  }

  addPlayer(socket) {
    const playerData = {
      name: null,
      id: socket.id,
      x: this.players.length === 0 ? 65 : 950,
      y: 330,
      health: 100,
      velocity: { x: 0, y: 0 },
    };

    this.players.push(playerData);
    this.inputsMap[socket.id] = {
      up: false,
      left: false,
      right: false,
      attack: false,
    };

    if (this.players.length === 2 && !this.started) {
      this.io.emit("playersReady");
      this.started = true;
    }
  }

  setupPlayerListeners(socket) {
    socket.on("inputs", (inputs) => {
      this.inputsMap[socket.id] = inputs;
      this.io.emit("playerInputs", this.inputsMap);
    });

    socket.on("setName", (nameData) => {
      const player = this.players.find((p) => p.id === nameData.id);
      if (player) {
        player.name = nameData.name;

        if (
            this.players.length === 2 &&
            this.players[0].name &&
            this.players[1].name
        ) {
          if (this.players[0].name === this.players[1].name) {
            console.log("Same user trying to play against themselves.");
            this.io.emit("SameUserError", "You cannot play against yourself.");

            this.players.forEach((p) => {
              const sock = this.io.sockets.sockets.get(p.id);
              if (sock) {
                sock.emit("close");
                sock.disconnect();
              }
            });
            this.players = [];
            this.inputsMap = {};
            this.started = false;
            this.deathHandled = false;
            return;
          }
        }
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", socket.id, reason);
      this.removePlayer(socket);
      setTimeout(() => {
        this.io.emit("close");
      }, 3000);
    });

    socket.on("getHit", (healthData) => {
      const player = this.players.find((p) => p.id === healthData.id);
      if (player) {
        player.health = healthData.health;
      }
    });

    socket.on("startGameRequest", () => {
      if (this.players.length < 2) {
        socket.emit("NotEnoughPlayers", "Waiting for another player");
      } else {
        this.io.emit("startGame", 99);
        this.io.emit("players", this.players); // Send initial player data
      }
    });
  }

  removePlayer(socket) {
    const index = this.players.findIndex((player) => player.id === socket.id);
    if (index !== -1) {
      this.players.splice(index, 1);
      delete this.inputsMap[socket.id];
    }
    this.io.emit("playerDisconnected", { id: socket.id });

    if (this.players.length < 2) {
      this.started = false;
      this.deathHandled = false;
      console.log("Game reset, waiting for players to start a new game.");
    }
  }

  listenForBackgroundRequest(socket) {
    socket.on("getBackground", () => {
      const serverBackgroundData = {
        position: { x: 0, y: 0 },
        imageSrc: `https://pixel-punch-out-server-e08f7052857e.herokuapp.com/img/backgrounds/dojo.png`,
        scale: 1,
        framesMax: 37,
      };
      socket.emit("backgroundData", serverBackgroundData);
      console.log("Sent background data.");
    });
  }

  listenForCountdown(socket) {
    socket.on("startCountdown", () => {
      if (this.players.length === 2 && this.players.every((p) => p.name)) {
        this.startCountdownSequence();
      } else {
        console.log(
            "Countdown aborted: not enough players or players' names are not set.",
        );
        socket.emit(
            "CountdownAborted",
            "Not enough players or players' names are not set.",
        );
      }
    });
  }

  startCountdownSequence() {
    setTimeout(() => {
      this.io.emit(
          "countdown3",
          `${this.players[0].name} vs ${this.players[1].name}`,
      );
      console.log("3");
    }, 1000);

    setTimeout(() => {
      this.io.emit("countdown2");
      console.log("2");
    }, 2000);

    setTimeout(() => {
      this.io.emit("countdown1");
      console.log("1");
    }, 3000);

    setTimeout(() => {
      this.io.emit("startGame", 99);
    }, 4000);
  }

  listenForDeath(socket) {
    const handleDeath = async (id) => {
      if (this.deathHandled) return;

      this.deathHandled = true;

      const alivePlayer = this.players.find((player) => player.id !== id);
      const deadPlayer = this.players.find((player) => player.id === id);

      if (alivePlayer && deadPlayer) {
        const aliveUsername = alivePlayer.name;
        const deadUsername = deadPlayer.name;

        try {
          await axios.post(`${API_URL}profiles/${aliveUsername}/wins`, {
            secret: SECRET_KEY,
          });
        } catch (err) {
          console.error("Error incrementing wins:", err);
        }

        try {
          await axios.post(`${API_URL}profiles/${deadUsername}/losses`, {
            secret: SECRET_KEY,
          });
        } catch (err) {
          console.error("Error incrementing losses:", err);
        }

        socket.off("death", handleDeath);
        setTimeout(() => {
          this.io.emit("close");
        }, 3000);
      }
    };

    socket.on("death", handleDeath);
  }

  listenForNameRequests(socket) {
    socket.on("getNames", () => {
      if (this.players.length === 2 && this.players.every((p) => p.name)) {
        socket.emit(
            "names",
            this.players.map((p) => ({ id: p.id, name: p.name })),
        );
      } else {
        socket.emit("names", false);
      }
    });
  }
}

export default SocketHandler;
