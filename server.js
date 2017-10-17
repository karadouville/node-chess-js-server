var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');
var Chess = require('./node_modules/chess.js/chess.js').Chess;
var net = require('net');
var crypto = require('crypto');
var stockfish = require('./stockfish_wrapper.js');

app.use(bodyParser.json());
app.set('json replacer', replacer);

//-----------------------------------------------
// GLOBALS (use db later)
//-----------------------------------------------

players = []; // currently not using
games = {};

//-----------------------------------------------
// ROUTES
//-----------------------------------------------

//-----------------------------------------------
// '/' (root)
//-----------------------------------------------

app.get('/', function(req, res) {
    res.redirect('/games');
});

//-----------------------------------------------
// /game
//-----------------------------------------------

/*  
    POST new game
    returns game_id and player_id
    client should store both in order to make subsequent requests
    add post body with player name, device, etc.?

    params:
    {
        name: "",
        username: "",
        mode: ['ai'|'human']
    }

    returns:
    {
        game_id: {
            id: '',
            player1: {
                id: '',
                color: ['w'|'b']
            },
            game: {...}
        },
        ...
    }
*/
app.post('/game', validate_create_game, function(req, res) {
    player_type = req.body.player_type;
    opponent_type = req.body.opponent_type; // optional, default human
    var chess = new Chess();
    game = {id: gen_id()};
    game.created  = Date.now();
    game.game = chess;
    game.player1 = create_player(player_type, 'w');
    if (opponent_type === 'ai') {
        game.player2 = create_player(opponent_type, 'b');
        game.result = "*"; // * == in-play/on-going (pgn notation)
    }
    games[game.id] = game;
    res.status(200).json(game);
    console_log("game {0} created by {1}".format(game.id, game.player1.id));
});

// GET game
app.get('/game/:id', validate_gid, function(req, res) {
    game_id = req.params.id;
    res.status(200).json(games[game_id]);
});

// DELETE game
app.delete('/game/:id', validate_gid, function(req, res) {
    game_id = req.params.id;
    delete games[game_id];
    res.sendStatus(200);
    console.log("game %s deleted", game_id);
});

/*  
    POST player to game
    similar to POST /game, add username, device, etc.?

    params:
    {
        name: "",
        username: "",
    }
*/
app.post('/game/:id/join', validate_gid, validate_join_game, function(req, res) {
    game_id = req.params.id;
    player_type = req.body.player_type;
    game = games[game_id];
    if (!game.player2) {
        player2_id = gen_id();
        game.player2 = create_player(player_type, 'b');
        game.result = "*";
        res.status(200).json(game);
        console.log("player %s joined game %s", player2_id, game.id);
        return;
    }

    res.status(404).json({error: "cannot join game, two players already playing"});
});

// GET check if game over
app.get('/game/:id/game-over', validate_gid, function(req, res) {
    game_id = req.params.id;
    res.status(200).json({game_over: games[game_id].game.game_over()});
});

// GET game result (win, draw, etc.)
app.get('/game/:id/result', validate_gid, function(req, res) {
    game_id = req.params.id;
    res.status(200).json({result: games[game_id].result});
});

// GET player object of player who's turn it is
app.get('/game/:id/turn', validate_gid, validate_two_players, function(req, res) {
    game_id = req.params.id;

    chess = games[game_id].game;
    player1 = games[game_id].player1;
    player2 = games[game_id].player2;
    turn = player1;
    if (player2.color === chess.turn())
        turn = player2;
    res.status(200).json(turn);
});

// GET last move (in long algebraic notation)
app.get('/game/:id/last-move', validate_gid, function(req, res) {
    game_id = req.params.id;
    history = games[game_id].game.history({verbose: true});

    if (history.length == 0) {
        res.status(404).json({error: "no moves"});
        return;
    }

    last_move = history[history.length-1];
    res.status(200).json({last_move: last_move.from + last_move.to});
});

// GET game fen
app.get('/game/:id/fen', validate_gid, function(req, res) {
    game_id = req.params.id;
    res.status(200).json(games[game_id].game.fen());
});

// POST move by player to game
// post body should contain json move
app.post('/game/:id/player/:pid/move', validate_gid, validate_pid, 
         validate_two_players, validate_move, function(req, res) {
    game_id = req.params.id;
    player_id = req.params.pid;

    chess =   games[game_id].game;
    player1 = games[game_id].player1;
    player2 = games[game_id].player2;
    color = player1.id === player_id ? player1.color : player2.color;

    if (chess.game_over()) {
        res.status(200).json({error: "game is over"});
        return;
    }

    if (chess.turn() == color) {
        move = chess.move(req.body.move, {sloppy: true}); // need sloppy for algebraic notation
        process_end_game(games[game_id]);
        if (move) {
            res.status(200).json(move); // send back move
            game.last_move = Date.now();
            console.log(chess.ascii());
            return;
        }

        res.status(200).json({error: "invalid move"});
        return;
    }

    res.status(200).json({error: "not your turn"});
});

// GET best move for player in game
app.get('/game/:id/player/:pid/bestmove', validate_gid, validate_pid, 
        validate_two_players, function(req, res) {
    game_id = req.params.id;
    player_id = req.params.pid;

    chess = games[game_id].game;
    player1 = games[game_id].player1;
    player2 = games[game_id].player2;
    color = player1.id === player_id ? player1.color : player2.color;
    if (chess.turn() == color) {
        stockfish.bestmove(chess.fen(), 20, function(best_move) {
            res.status(200).json({bestmove: best_move});
        });

        return;
    }

    res.status(404).json({error: "not your turn"});
});

// GET is it this players turn?
app.get('/game/:id/player/:pid/turn', validate_gid, validate_pid, 
        validate_two_players, function(req, res) {
    game_id = req.params.id;
    player_id = req.params.pid;

    chess = games[game_id].game;
    player1 = games[game_id].player1;
    player2 = games[game_id].player2;
    color = player1.id === player_id ? player1.color : player2.color;
    if (chess.turn() == color) {
        res.status(200).json({turn: true});
        return;
    }

    res.status(200).json({turn: false});
});

/* // not yet
function find_match() {
    for (var id in games) {
        if (!games[id].hasOwnProperty('player2') && games[id].hasOwnProperty('waiting_for') && games[id].waiting_for === opponent_type) {
            if (opponent_type === 'ai')
                return create_player('ai', 'b');
        }
    }
}
*/

//-----------------------------------------------
// /games
//-----------------------------------------------

// GET games
app.get('/games', function(req, res) {
    all_games = [];
    for (var id in games) {
        all_games.push(games[id]);
    }
    res.status(200).json(all_games);
});

//-----------------------------------------------
// /games-needing-opponent
//-----------------------------------------------

// GET games-needing-opponent
app.get('/games-needing-opponent', function(req, res) {
    games_needing_opponent = [];
    for (var id in games) {
        if (!games[id].hasOwnProperty('player2')) {
            games_needing_opponent.push(games[id]);
        }
    }
    res.status(200).json(games_needing_opponent);
});

//-----------------------------------------------
// /games-needing-opponent-iter
//-----------------------------------------------

// iterator version of GET games-needing-opponent.
// resource constrained clients can use this to get only one game 
// at a time by iterating through :idx until getting an error
app.get('/games-needing-opponent-iter/:idx', function(req, res) {
    idx = parseInt(req.params.idx, 10);
    games_needing_opponent = [];
    for (var id in games) {
        if (!games[id].hasOwnProperty('player2')) {
            games_needing_opponent.push(games[id]);
        }
    }
    if (!Number.isNaN(idx) && games_needing_opponent.length > idx) {
        res.status(200).json(games_needing_opponent[idx]);
    }
    else {
        res.status(404).json({error: "no such game"});
    }
});


//-----------------------------------------------
// /games-in-play
//-----------------------------------------------

// GET games-in-play
app.get('/games-in-play', function(req, res) {
    games_in_play = [];
    for (var id in games) {
        if (games[id].hasOwnProperty('player2')) {
            games_in_play.push(games[id]);
        }
    }
    res.status(200).json(games_in_play);
});


//-----------------------------------------------
// HELPER FUNCTIONS
//-----------------------------------------------

String.prototype.format = function() {
  a = this;
  for (k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}

// use fen notation rather than return whole chess object
function replacer(key, value) {
    if (key == "game") {
        return value.fen()
    }
    return value;
}

function console_log(message) {
    timestamp = (new Date()).toISOString();
    console.log("[%s] %s", timestamp, message);
}

// helper function to generate ids
// probably need to use key based on unique device id (MAC, IP, etc.)
// in reality this is not for security but rather uniqeness
function gen_id() {
    key = "You're a wizard Harry...";
    var now  = Date.now().valueOf().toString();
    var rand = Math.random().toString();
    id = crypto.createHmac('sha1', key).update(now + rand).digest('hex');
    return id;
}

function process_end_game(game) {
    chess = game.game;
    if (chess.game_over()) {
        if (chess.in_checkmate()) {
            game.result = chess.turn() === 'w' ? '0-1' : '1-0'; // 0-1 == black won, 1-0 == white won (pgn)
        } else if (chess.in_draw() || chess.in_stalemate() || chess.in_threefold_repetition()) {
            game.result = '1/2-1/2'; // draw (pgn)
        }
    }
}

function create_player(player_type, color) {
    if (player_type === 'ai')
        return {id: gen_id(), color: color, type: 'ai'};
    return {id: gen_id(), color: color, type: 'human'}; // else create human
}

function valid_game(game_id) {
    if (game_id && games[game_id])
        return true;
    return false;
}

function valid_player(game_id, player_id) {
    if (valid_game(game_id)) {
        player1 = games[game_id].player1;
        player2 = games[game_id].player2;
        if ((player1 && player_id === player1.id) || 
            (player2 && player_id === player2.id)) {
            return true;
        }
    }
    return false;
}

function both_players_ready(game_id) {
    player1 = games[game_id].player1;
    player2 = games[game_id].player2;
    if (player1 && player2) {
        return true;
    }
    return false;
}

//-----------------------------------------------
// VALIDATORS (middleware)
//-----------------------------------------------

function validate_two_players(req, res, next) {
    game_id = req.params.id;
    if (!both_players_ready(game_id)) {
        res.status(200).json({error: "need two players"});
        next('route');
        return;
    }
    next();
}

function validate_pid(req, res, next) {
    game_id = req.params.id;
    player_id = req.params.pid;
    if (!valid_player(game_id, player_id)) {
        res.status(404).json({error: "player not in game"});
        next('route');
        return;
    }
    next();
}

function validate_gid(req, res, next) {
    game_id = req.params.id;
    if (!valid_game(game_id)) {
        res.status(404).json({error: "game not found"});
        next('route');
        return;
    }
    next();
}

function validate_move(req, res, next) {
    if (!req.body.move) {
        res.status(200).json({error: "move required"});
        next('route');
        return;
    }
    next();
}

function validate_create_game(req, res, next) {
    if (!req.body.player_type) {
        res.status(200).json({error: "player_type required"});
        next('route');
        return;
    }
    next();
}

// same as validate_create_game (for now)
function validate_join_game(req, res, next) {
    validate_create_game(req, res, next);
}

//-----------------------------------------------
// TESTING
//-----------------------------------------------

// register device, 
app.get('/reg', function(req, res) {
    if (players.length < 2) {
        player_id = gen_id();
        res.status(200).json({id: player_id});
        players.push(player_id);
        console.log("player %s has joined", player_id);
    } else {
        res.status(404).json({error: "two players already exist"});
    }
});

//-----------------------------------------------
// APP START
//-----------------------------------------------

// start server
var server = app.listen(3000, "0.0.0.0", function() {
    var host = server.address().address;
    var port = server.address().port;
    
    console_log("rest api server listening at http://{0}:{1}".format(host, port));
});

/*
var telnet_server = net.createServer(function(socket) {
	socket.write('Echo server\r\n');
	socket.pipe(socket);
});

telnet_server.listen(8080, '127.0.0.1');
console.log("telnet server listenting at 127.0.0.1 at port 8080");
*/
