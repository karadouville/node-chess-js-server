var PlayerFactory = {
	getPlayer :  function(type, pid, gameid, color) {
		if(type === "ai") {
			return new AiPlayer(pid, gameid, color);
		} else {
			return new HumanPlayer(pid, gameid, color);
		}
	}
}

function AiPlayer(id, gameid, color) {
	var self = this;
	self.gameId = gameid;
	self.playerId = id;
	self.color = color
	self.takeTurn = function(onFinish) {
		setTimeout(function() {
			api.bestMove(self.gameId, self.playerId, function(bestMove) {
			api.makeMove(self.gameId, self.playerId, {move : bestMove.bestmove},
				function(gamestate) {
					onFinish(gamestate);
				});
			});				
		}, 1500);
		
	}
}

function HumanPlayer(id, gameid, color) {
	var self = this;
	self.gameId = gameid;
	self.playerId = id;
	self.color = color

	self.$board = $("#board");
	self.takeTurn = function(onFinish) {
		// no op? 
		// api.makeMove(self.gameId, self.playerId, {move : },
		// 	function(gamestate) {
		// 		onFinish(gamestate);
		// 	});
		// };	
	}

}