var Game = {}; // the state of the game according to the server

/* the state of the game according to the client. Used for optimized UI
 * I'm not happy about having two game states, but it's better than waiting
 * For an HTTP round trip for UI elements. 
 * Ideal, the chess will be re-set everytime the server sends a new gamestate.
 */
var chess = new Chess(); 
var board = null; // the UI baord
var userid = null;
var Player = null;
var $board = null;
var urlParams = new URLSearchParams(window.location.search);

window.onresize = function(){
	board.resize();
};

function pollForPlayerTwo(gameid) {
	setTimeout(function() {
		api.getGame(gameid, function onSuccess(gameres) {
			Game = gameres;
			if(Game.result === '?') {
				console.log("waiting on playertwo")
				pollForPlayerTwo(gameid);
			} else {
				$("#loading").remove();
				createBoard(gameres);
				gameloop();
			}
		})
	}, 5000)
}

function gameloop() {
	api.getGame(Game.id, function onSuccess(gameres) {
		Game = gameres;
		chess.load(Game.fen);
		board.position(Game.game.board);
		if(!(Game.result === "*" || Game.result === "?")) {
			console.log("game over! - game state: " + Game.result);
			gameover();
		} else if(Game.game.turn.startsWith(Player.color))  {
			Player.takeTurn(updateGame);
		} else {
			setTimeout(gameloop, 50);
		}
	});
}

function gameover() {
	var $message = $("#message");
	if(Game.result === "1/2 - 1/2/") {
		$message.html("tie!");
	} else if(Game.result === "1-0") {
		$message.html("White wins!");
	} else if(Game.result === "0-1") {
		$message.html("Black wins!");
	} else {
		$message.html("Unknown state: " + Game.result);
	}
}

/**
 * @param game - Server response object
 */
function updateGame(game) {
	Game = game;
	chess.load(game.fen);
	board.position(Game.game.board);
	gameloop()
}

// do not pick up pieces if the game is over
// only pick up pieces for the side to move
var onDragStart = function(source, piece, position, orientation) {
  if (!(Game.result === "*" || Game.result === "?") ||
      (Game.game.turn=== 'w' && piece.search(/^b/) !== -1) ||
      (Game.game.turn === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
};


/*
 * Once a piece has been legally moved, tell the server about the move
 */
var onDrop = function(source, target, piece, newPos, oldPos, orientation) {
  removeGreySquares();

  //doesn't move the piece on the board, only calculates if it's a valid move.
  var move = chess.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  if(move !== null) {
	api.makeMove(urlParams.get("gameid"), urlParams.get("playerid"), {move : source + target}, function(gamestate) {
		updateGame(gamestate);
	});
	return true;
  } else {
  	return 'snapback';
  }
  
};


var removeGreySquares = function() {
  $('#board .square-55d63').css('background', '');
};


var greySquare = function(square) {
  var squareEl = $('#board .square-' + square);
  
  var background = '#a9a9a9';
  if (squareEl.hasClass('black-3c85d') === true) {
    background = '#696969';
  }

  squareEl.css('background', background);
};

var onMouseoverSquare = function(square, piece) {
  // get list of possible moves for this square
  var moves = chess.moves({
    square: square,
    verbose: true
  });

  // exit if there are no moves available for this square
  if (moves.length === 0) return;

  // highlight the square they moused over
  greySquare(square);

  // highlight the possible squares for this piece
  for (var i = 0; i < moves.length; i++) {
    greySquare(moves[i].to);
  }
};

var onMouseoutSquare = function(square, piece) {
  removeGreySquares();
};

var createBoard = function(game) {
	Game = game;
	var cfg = {
		position : game.game.board || 'start',
		orientation : urlParams.get('user') === 'w' ? 'white' : 'black',
		draggable : urlParams.get('ptype')  !== 'ai',
		dropOffBoard : 'snapback',
		onDragStart : onDragStart,
		onMouseoutSquare: onMouseoutSquare,
		onMouseoverSquare: onMouseoverSquare,
		onDrop : onDrop
	}
	board = ChessBoard('board', cfg);
	$("#message").html("Have fun!");
}
window.onload = function() {
	gameid = urlParams.get("gameid");
	userid = urlParams.get("playerid")
	Player = PlayerFactory.getPlayer(urlParams.get('ptype'), userid, gameid, urlParams.get("user"));
	$board = $("#board");
	api.getGame(urlParams.get('gameid'), function(game) {		
		if(game.player1 && game.player2) {
			createBoard(game);
        	$("#loading").remove();
        	gameloop();
		} else {
    		pollForPlayerTwo(gameid);
		}
    }, function onFail() {
    	$("#loading").html("Game not found :(");
    });

   
}