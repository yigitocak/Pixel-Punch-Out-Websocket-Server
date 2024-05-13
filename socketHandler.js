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
      console.log(`A user connected ${socket.id}`);
      if (this.players.length === 2) {
        socket.emit("ConnectionRefused", "Room is full");
        socket.disconnect();
      } else {
        this.addPlayer(socket);
        this.setupPlayerListeners(socket);
        this.listenForBackgroundRequest(socket);
        this.listenForCountdown(socket);
        this.listenForDeath(socket);
        this.listenForNameRequests(socket)
      }
    });
  }

  addPlayer(socket) {
    if (this.players.length === 0) {
      this.players.push({
        name: null,
        id: socket.id,
        x: 65,
        y: 330,
        health: 100,
        velocity: {
          x: 0,
          y: 0,
        },
      });
      this.inputsMap[socket.id] = {
        up: false,
        left: false,
        right: false,
        attack: false,
      };
    } else {
      this.players.push({
        name: null,
        id: socket.id,
        x: 950,
        y: 330,
        health: 100,
        velocity: {
          x: 0,
          y: 0,
        },
      });
      this.inputsMap[socket.id] = {
        up: false,
        left: false,
        right: false,
        attack: false,
      };
    }

    if (this.players.length === 2 && !this.started) {
      this.io.emit("playersReady");
      this.started = true;
      console.log("Game Started");
    }
  }

  setupPlayerListeners(socket) {
    socket.on("inputs", (inputs) => {
      this.inputsMap[socket.id] = inputs;
    });

    socket.on("setName", (nameData) => {
      let player = this.players.find((p) => p.id === nameData.id);
      player.name = nameData.name;
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", socket.id, reason);
      this.removePlayer(socket);
    });

    socket.on("getHit", (healthData) => {
      let player = this.players.find((p) => p.id === healthData.id);
      player.health = healthData.health;
    });

    socket.on("startGameRequest", () => {
      if (this.players.length < 2) {
        socket.emit("NotEnoughPlayers", "Waiting for another player");
      } else {
        this.io.emit("startGame", 99);
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
        position: {
          x: 0,
          y: 0,
        },
        imageSrc: `https://pixel-punch-out-server-e08f7052857e.herokuapp.com/img/backgrounds/dojo.png`,
        scale: 1,
        framesMax: 37,
      };
      socket.emit("backgroundData", serverBackgroundData);
      console.log("sent background");
    });
  }

  listenForCountdown(socket) {
    socket.on("startCountdown", () => {
      setTimeout(() => {
        this.io.emit(
            "countdown3",
            `${this.players[0].name} vs ${this.players[1].name}`,
        );
        console.log("3");
      }, 1000);

      // Emit countdown2 after 2 seconds
      setTimeout(() => {
        socket.emit("countdown2");
        console.log("2");
      }, 2000);

      // Emit countdown1 after 3 seconds
      setTimeout(() => {
        socket.emit("countdown1");
        console.log("1");
      }, 3000);

      // Emit go after 4 seconds
      setTimeout(() => {
        socket.emit("startGame", 99);
      }, 4000);
    });
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

        // Incrementing Wins
        try {
          const response = axios.post(
              `${API_URL}profiles/${aliveUsername}/wins`,
              {
                secret: SECRET_KEY,
              },
          );
        } catch (err) {
          console.log(err);
        }

        // Incrementing Losses
        try {
          const response = axios.post(
              `${API_URL}profiles/${deadUsername}/losses`,
              {
                secret: SECRET_KEY,
              },
          );
        } catch (err) {
          console.log(err);
        }

        socket.off("death", handleDeath);
      }
    };

    socket.on("death", handleDeath);
  }

  listenForNameRequests(socket){
    socket.on("getNames", () => {
      if (this.players[0].name && this.players[1].name){
        socket.emit("names", [
          {
            id: this.players[0].id,
            name: this.players[0].name
          },
          {
            id: this.players[1].id,
            name: this.players[1].id
          }
        ])
      }
      else{
        socket.emit("names", false)
      }
    })
    }
}

export default SocketHandler;
