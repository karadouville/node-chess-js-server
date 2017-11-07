'use strict'
function logFailure(failureCallBack) {
	return function(xhr, status, error) {
		console.log("Failed!: " + error + ", Status: " + status + ", xhr: " + xhr.responseText);
		if(failureCallBack) {
			failureCallBack(xhr, status, error);	
		}	
	}
}

function parseFenString(fen) {
	var parts = fen.split(" ");
	return {
		board : parts[0],
		turn : parts[1],
		castleing : parts[2],
		enPassent : parts[3],
		halfMoves : parts[4],
		fullMoves : parts[5]		
	}
}

var api =  {	
	findGames : function(onSuccess, onFailure) {
		$.ajax({
			url : "/games/needing-opponent",
			success : onSuccess,
			error : logFailure(onFailure)
		})
	},

	createGame : function(options, onSuccess, onFailure) {
		$.ajax({
			url : "/game",
			method : "POST",
			data : options,
			success : onSuccess,
			error : logFailure(onFailure, xhr, status, error)
		})
	},
	getGame : function(id, onSuccess, onFailure) {
		$.ajax({
			url : "/game/" + id,
			success : function(data, status, xhr) {
				data["fen"] = data.game
				data["game"] = parseFenString(data.game);
				onSuccess(data, status, xhr);
			},
			error : logFailure(onFailure)
		})
	},

	joinGame : function(id, playerType, onSuccess, onFailure) {
		$.ajax({
			url : "/game/" + id + "/join",
			method: "POST",
			data : {"player_type" : playerType},
			success : onSuccess,
			error : logFailure(onFailure)
		})
		
	},

	bestMove : function(id, playerid, onSuccess, onFailure) {
		$.ajax({
			method : "GET",
			url : "/game/" + id + "/player/" + playerid + "/bestmove",
			success : onSuccess,
			error : logFailure(onFailure)
		});
	},

	makeMove : function(id, playerid, move, onSuccess) {
		$.ajax({
			method : "POST",
			url : "/game/" + id + "/player/" + playerid + "/move",
			data : JSON.stringify(move),
			success : function(game) {
				game.fen = game.game;
				game.game = parseFenString(game.game);
				onSuccess(game);
			},
			error : logFailure(function() {
				game.game = parseFenString(game.game);
			}),
			contentType : "application/json"
		});
	}
}