/*
 *
 * This uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
 * https://github.com/juniorxsound/THREE.Multiplayer
 * And a WEBRTC chat app made by Mikołaj Wargowski:
 * https://github.com/Miczeq22/simple-chat-app
 *
 * Aidan Nelson, April 2020
 *
 *
 */
const WebSocket = require('ws');

let ws = new WebSocket('ws://192.168.1.22:8080/websocket');

ws.on('close', function open() {
  console.log('something error');
  ws = new WebSocket('ws://192.168.1.22:8080/websocket');
});

// express will run our server
const express = require("express");
const app = express();
app.use(express.static("public"));

// HTTP will expose our server to the web
const http = require("http").createServer(app);

// decide on which port we will use
const port = process.env.PORT || 8080;

//Server
const server = app.listen(port);
console.log("Server is running on http://localhost:" + port);

/////SOCKET.IO///////
const io = require("socket.io")().listen(server);

// an object where we will store innformation about active clients
let peers = {};

function main() {
  setupSocketServer();

  setInterval(function () {
    ws.send('getpos ap1');
    // update all clients of positions
    io.sockets.emit("positions", peers);
  }, 10);
}

main();

function setupSocketServer() {

  ws.on('message', (data) => {
    let resp = data.toString()
    // console.log('resp 2: %s',resp)

    if(resp.includes('getpos ap1:')){
      let ap_pos = resp.split(': ')[1]
      // console.log('ap_pos: %s', ap_pos)
      peers['ap1'] = {
        sta_name: 'ap1',
        position: ap_pos
            .replace('[','')
            .replace(']','')
            .replace(' ','')
            .split(',')
            .map((a)=>{
              return parseFloat(a)
            }),
        rotation: [0, 0, 0, 1], // stored as XYZW values of Quaternion
      };

    }
  });

  // Set up each socket connection
  io.on("connection", (socket) => {
    // console.log(peers)
    console.log(
      "Peer joined with ID",
      socket.id,
      ". There are " +
      io.engine.clientsCount +
      " peer(s) connected."
    );

    ws.send('add');

    ws.on('message', (data) => {
      let resp = data.toString()
      // console.log('resp 1: %s',resp)
      if(resp.includes('new station')){
        let sta_name = resp.split(' ')[3]
        console.log('sta_name: %s', sta_name)
        peers[socket.id] = {
          sta_name: sta_name,
          position: [0, 0.5, 0],
          rotation: [0, 0, 0, 1], // stored as XYZW values of Quaternion
        };

      }
    });

      // console.log('sta_name not ?')

      // //Add a new client indexed by their socket id
      // peers[socket.id] = {
      //   sta_name: sta_name,
      //   position: [0, 0.5, 0],
      //   rotation: [0, 0, 0, 1], // stored as XYZW values of Quaternion
      // };

      // Make sure to send the client their ID and a list of ICE servers for WebRTC network traversal
      socket.emit(
          "introduction",
          Object.keys(peers)
      );

      // also give the client all existing clients positions:
      socket.emit("userPositions", peers);

      //Update everyone that the number of users has changed
      io.emit(
          "newUserConnected",
          socket.id
      );

      // whenever the client moves, update their movements in the clients object
      socket.on("move", (data) => {
        // console.log(data)
        if (peers[socket.id]) {
          peers[socket.id].position = data[0];
          console.log('setpos ' + peers[socket.id].sta_name + ' ' + data[0][0] + "," + data[0][1] + "," + data[0][2]);
          ws.send('setpos ' + peers[socket.id].sta_name + ' ' + data[0][0] + "," + data[0][1] + "," + data[0][2]);
          peers[socket.id].rotation = data[1];
        }
      });

      // Relay simple-peer signals back and forth
      socket.on("signal", (to, from, data) => {
        console.log("signal")
        if (to in peers) {
          io.to(to).emit("signal", to, from, data);
        } else {
          console.log("Peer not found!");
        }
      });

      //Handle the disconnection
      socket.on("disconnect", () => {
        //Delete this client from the object
        delete peers[socket.id];
        io.sockets.emit(
            "userDisconnected",
            io.engine.clientsCount,
            socket.id,
            Object.keys(peers)
        );
        console.log(
            "User " +
            socket.id +
            " diconnected, there are " +
            io.engine.clientsCount +
            " clients connected"
        );
      });
  });
}
