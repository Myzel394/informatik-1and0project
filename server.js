/**************/
/*** CONFIG ***/
/**************/
const PORT = 5489;


/*************/
/*** SETUP ***/
/*************/
const fs = require("fs");
const express = require('express');
var http = require('http');
const bodyParser = require('body-parser')
const main = express()
const server = http.createServer(main)

const {Server} = require("socket.io")
const io  = new Server(server);
//io.set('log level', 2);

server.listen(PORT, "0.0.0.0", function() {
    console.log("Listening on port " + PORT);
});

// Liste aller channels
const channels = {};

main.get('/', function(req, res){ res.sendFile(__dirname + '/client.html'); });
main.get("/channels", (req, res) => {
    // Liste aller Channels zurückgeben, die noch nicht voll sind

    const availableChannels = Object
        .entries(channels)
        .filter(([name, channel]) => Object.keys(channel).length < 2)
        .map(([name]) => name)
    res.send(availableChannels);
})


const getChannelIDForSocket = (socket) => {
    for (channel in channels) {
        for (id in channels[channel]) {
            if (id === socket.id) {
                return channel;
            }
        }
    }
    return null;
}

io.sockets.on('connection', function (socket) {
    socket.on('disconnect', function () {
        const channel = getChannelIDForSocket(socket);

        if (!channel || !channels[channel]) {
            return;
        }

        // Andere Clients benachrichtigen
        for (id in channels[channel]) {
            channels[channel][id].emit('peerDisconnected');
        }

        delete channels[channel][socket.id];
        if (Object.keys(channels[channel]).length === 0) {
            delete channels[channel];
        }
    });

    socket.on('join', function (message) {
        const channel = message.channel;

        channels[channel] = channels[channel] || {};

        if (Object.keys(channels[channel]).length >= 2) {
            // Bereits 2 Clients verbunden;
            socket.emit('rejectJoin');
            return;
        }

        channels[channel][socket.id] = socket;

        if (Object.keys(channels[channel]).length > 1) {
            // Graph kann starten
            for (id in channels[channel]) {
                channels[channel][id].emit('startGraph');
            }
        }
    });

    // "1" an alle mitteilen
    socket.on("send", () => {
        const channel = getChannelIDForSocket(socket);

        for (id in channels[channel]) {
            channels[channel][id].emit('message');
        }
    })

    // Interval updaten
    socket.on("changeInterval", message => {
        const channel = getChannelIDForSocket(socket);

        for (id in channels[channel]) {
            channels[channel][id].emit("changeInterval", {
                interval: message.interval
            });
        }
    })
});
