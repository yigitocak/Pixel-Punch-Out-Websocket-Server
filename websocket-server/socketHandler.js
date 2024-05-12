import "dotenv/config";
const BACKEND_URL = process.env.BACKEND_URL;

class SocketHandler {
  constructor(io, players, inputsMap) {
    this.io = io;
    this.players = players;
    this.inputsMap = inputsMap;
    this.backgroundData = {};
    this.started = false;
    this.backgrounds = [
      {
        id: "1",
        url: `${BACKEND_URL}img/backgrounds/dragon.png`,
        scale: 1,
        framesMax: 8,
      },
      {
        id: "2",
        url: `${BACKEND_URL}img/backgrounds/dojo.png`,
        scale: 1,
        framesMax: 37,
      },
      {
        id: "3",
        url: `${BACKEND_URL}img/backgrounds/leaf.png`,
        scale: 1,
        framesMax: 38,
      },
    ];
    this.playerImages = [
      {
        id: 1,
        sprites: {
          idle: `${BACKEND_URL}img/PlayerImages/samuraiMack/Idle.png`,
        },
      },
    ];
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
        this.sendBackgroundData(socket);
        this.checkBackgroundStatus(socket);
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
      console.log("yolladim abi");
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
      this.started = false;
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
  }

  sendBackgroundData(socket) {
    socket.on("getBackground", (backgroundId) => {
      console.log("Background Request Received", backgroundId);
      if (backgroundId === "chosen") {
        const serverBackgroundData = {
          position: { x: 0, y: 0 },
          imageSrc: this.backgroundData.imageSrc,
          scale: this.backgroundData.scale,
          framesMax: this.backgroundData.framesMax,
        };
        this.io.emit("backgroundData", serverBackgroundData);
      } else {
        const background = this.backgrounds.find((b) => b.id === backgroundId);
        if (background) {
          const serverBackgroundData = {
            position: { x: 0, y: 0 },
            imageSrc: background.url,
            scale: background.scale,
            framesMax: background.framesMax,
          };
          this.io.emit("backgroundData", serverBackgroundData);
          console.log("Background Sent:", backgroundId);
          this.backgroundData = background;
        }
      }
    });
  }

  checkBackgroundStatus(socket) {
    socket.on("checkBackground", () => {
      if (this.backgroundData !== []) {
        socket.emit("backgroundStatus", true);
      } else {
        socket.emit("backgroundStatus", false);
      }
    });
  }
}

export default SocketHandler;
