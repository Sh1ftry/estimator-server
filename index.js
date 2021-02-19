const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

class Participant {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.vote = "";
    }

    setVote(vote) {
        this.vote = vote;
    }
}

class Room {
    constructor(host, estimates) {
        this.host = host;
        this.task = "";
        this.participants = [];
        this.estimates = estimates;
    }

    addParticipant(participant) {
        this.participants.push(participant);
    }

    deleteParticipant(participant) {
        this.participants =
            this.participants.filter(p => p.id !== participant.id);
    }

    setParticipantVote(participant, vote) {
        this.participants.find(p => p.id !== participant.id).setVote(vote);
    }

    setTask(task) {
        this.task = task;
    }
}

let rooms = new Map();

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('User connected');
    socket.on('start', (id, name, estimates, callback) => {
        const participant = new Participant(id, name);
        const room_id = Math.random().toString(36).substr(2, 9);
        socket.join(room_id);
        socket.participant = participant;
        socket.room_id = room_id;
        rooms.set(room_id, new Room(participant, estimates));
        console.log(rooms.get(room_id));
        callback(room_id);
    });
    socket.on('join', (room_id, id, name, callback) => {
        if (rooms.has(room_id)) {
            console.log('joined');
            const participant = new Participant(id, name);
            socket.join(room_id);
            socket.participant = participant;
            socket.room_id = room_id;
            const room = rooms.get(room_id);
            room.addParticipant(participant);
            rooms.set(room_id, room);
            socket.to(room_id).emit('joined', room.participants.length + 1);
            console.log(rooms.get(room_id));
            callback({
                estimates: room.estimates,
                task: room.task,
                users: room.participants.length + 1,
            });
        }
    });
    socket.on('disconnect', () => {
        console.log('someone disconnected');
        const room_id = socket.room_id;
        const participant = socket.participant;
        if (rooms.get(room_id) && rooms.get(room_id).host.id === participant.id) {
            console.log('host disconnected');
            socket.to(room_id).emit('host left');
            rooms.delete(room_id);
        } else if (rooms.get(room_id)) {
            console.log('user disconnected');
            const room = rooms.get(room_id);
            room.participants = room.participants.filter(p => p.id !== participant.id);
            socket.to(room_id).emit('user left', room.participants.length + 1);
        }
        console.log(rooms.get(room_id));
    });
    socket.on('change', (task) => {
        const room_id = socket.room_id;
        const room = rooms.get(socket.room_id);
        room.setTask(task);
        socket.to(room_id).emit('changed', task);
        console.log(rooms.get(room_id));
    });
    socket.on('finish', () => {
        const room_id = socket.room_id;
        const room = rooms.get(room_id);
        const participants = room.participants;
        room.setTask("");
        const results = participants.map(p => {
            return {
                vote: p.vote,
                name: p.name,
            };
        });
        results.push({
            vote: room.host.vote,
            name: room.host.name,
        });
        io.to(room_id).emit('finished', results);
        room.host.setVote("");
        participants.forEach(participant => {
            participant.setVote("");
        });
        console.log(rooms.get(room_id));
    });
    socket.on('vote', (vote) => {
        console.log(vote);
        const room_id = socket.room_id;
        const room = rooms.get(room_id);
        socket.participant.setVote(vote);
        let voted = room.participants.filter(participant => participant.vote !== "").length;
        if (room.host.vote != "") {
            voted = voted + 1;
        }
        io.to(room_id).emit('voted', voted);
        console.log(rooms.get(room_id));
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});