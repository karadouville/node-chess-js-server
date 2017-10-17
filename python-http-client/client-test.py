import requests
import time
import json

server = 'http://localhost:3000'

def json_print(j):
    print(json.dumps(j, indent=4))
    return

def post_json(url, json_dict):
    headers = {"Content-Type": "application/json"}
    res = requests.post(url, data=json.dumps(json_dict), headers=headers)
    if res.ok:
        return res.json()
    return {}

def make_best_move(gid, pid):
    b = requests.get('{}/game/{}/player/{}/bestmove'.format(server, gid, pid))
    if not b.ok:
        json_print(b.json())
        print("cannot get best move")
        return
    
    bestmove = b.json()['bestmove']
    print("bestmove={}".format(bestmove));
    move_res = post_json('{}/game/{}/player/{}/move'.format(server, gid, pid), {"move": str(bestmove)})
    if move_res:
        json_print(move_res)
    else:
        print("probably not your turn")
        return

game = {}
game_id = ''
player_id = ''
games = requests.get('{}/games-needing-opponent'.format(server))
if games.ok:
    if not games.json(): # if no game, create it
        game = post_json('{}/game'.format(server), {"player_type":"ai"})
        if game:
            json_print(game)
            player_id = game['player1']['id']
        else:
            print("game creation failed")
            exit()
    else: # else just get first game for now
        print('game needing opponent found, joining')
        game = games.json()[0]
        r_game = post_json('{}/game/{}/join'.format(server, game['id']), {'player_type':'ai'})
        if r_game:
           game = r_game 
        json_print(game)
        player_id = game['player2']['id']

    game_id = game['id']
    print("game id: {}".format(game_id))
    print("your player id: {}".format(player_id))

    while True:
        game_over = requests.get('{}/game/{}/game-over'.format(server, game_id))
        if game_over.ok and game_over.json().get('game_over'):
            print("game over, printing result and exiting")
            result = requests.get('{}/game/{}/result'.format(server, game_id))
            if result.ok:
                json_print(result.json())
            exit()
        turn = requests.get('{}/game/{}/player/{}/turn'.format(server, game_id, player_id))
        if turn.ok:
            json_print(turn.json())
            if turn.json().get('turn'):
                make_best_move(game_id, player_id)
            else:
                print("waiting...")
        else:
            print(turn.status_code)
            print(turn.reason)
            exit()
        time.sleep(1)

