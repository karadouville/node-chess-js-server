function validateForm(form) {
	if(!form.ptype.value) {
		alert("You need to select if you're a human or an AI!")
	}
	return !!form.ptype.value;
}

function refreshGames() {
		api.findGames(function(games) {	
		var $select = $("select");
		$('select').empty();
		$('select').append($('<option>', {text: "New Game"}));
		for(var idx in games) {
			$('select').append($('<option>', {
    			text: games[idx].id
			}));
		}

    }, function onFail() {
    	
    });
}