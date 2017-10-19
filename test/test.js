const request = require('supertest');
require('should');
require('should-http');

const root = '/';
const games = '/games';
const game = '/game';
const game_over = 'game-over';
const result = 'result';
const turn = 'turn';
const last_move = 'last-move';
const fen = 'fen';
const move = 'move';
const games_need_opp = '/games/needing-opponent';
const games_in_prog = '/games/in-progress';
const games_in_chkmte = '/games/in-checkmate';
const games_in_draw = '/games/in-draw';

String.prototype.format = function() {
  var a = this;
  for (k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}

function should_be_ok_and_json(res) {
    res.should.have.status(200);
    res.should.be.json();
}

function should_be_err_equal_to(res, err_msg) {
    should.exist(res.body.error);
    should.equal(err_msg, res.body.error);
}

describe('loading initial state tests', function () {
    var server;
  
    beforeEach(function () {
        delete require.cache[require.resolve('../server')];
        server = require('../server.js');
    });
  
    afterEach(function () {
        server.close();
    });
  
    it('get {0} should redirect to {1}'.format(root, games), function (done) {
        request(server).get(root).expect(302, done);
    });
  
    it('everything else should respond 404', function (done) {
        request(server).get('/foo/bar').expect(404, done);
    });
});

describe('loading game creation tests', function () {
    var server;
    var gid;
    var pid;
  
    beforeEach(function (done) {
        delete require.cache[require.resolve('../server')];
        server = require('../server.js');
        request(server).get(games)
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.equal(0, res.body.length);
            request(server).post('/game').send({player_type: "ai"})
            .end(function(err,res){
                should_be_ok_and_json(res);
                gid = res.body.id;
                pid = res.body.player1.id;
                done();
            });
        });
    });
  
    afterEach(function () {
        server.close();
    });
    
    it('get {0}/:gid should exist'.format(game), function (done) {
        request(server).get('{0}/{1}'.format(game, gid))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.exist(res.body);
            done();
        });
    });
    
    it('get {0}/:gid/{1} should be false'.format(game, game_over), function (done) {
        request(server).get('{0}/{1}/{2}'.format(game, gid, game_over))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.exist(res.body);
            res.body.game_over.should.be.false()
            done();
        });
    });
    
    it('get {0}/:gid/{1} should be null'.format(game, result), function (done) {
        request(server).get('{0}/{1}/{2}'.format(game, gid, result))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should(res.body.result).be.null();
            done();
        });
    });
    
    it('get {0}/:gid/{1} should be error'.format(game, turn), function (done) {
        request(server).get('{0}/{1}/{2}'.format(game, gid, turn))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should_be_err_equal_to(res, 'need two players');
            done();
        });
    });
    
    it('get {0}/:gid/{1} should be error'.format(game, last_move), function (done) {
        request(server).get('{0}/{1}/{2}'.format(game, gid, last_move))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should_be_err_equal_to(res, 'no moves');
            done();
        });
    });
    
    it('get {0}/:gid/{1} should be default fen'.format(game, fen), function (done) {
        request(server).get('{0}/{1}/{2}'.format(game, gid, fen))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.exist(res.body.fen);
            should.equal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', res.body.fen);
            done();
        });
    });
    
    it('post {0}/:gid/player/:pid/move should be error'.format(game), function (done) {
        request(server).post('{0}/{1}/player/{2}/move'.format(game, gid, pid)).send({move: 'e2e4'})
        .end(function(err,res){
            should_be_ok_and_json(res);
            should_be_err_equal_to(res, 'need two players');
            done();
        });
    });
    
    it('get {0}/:gid/player/:pid/bestmove should be error'.format(game), function (done) {
        request(server).get('{0}/{1}/player/{2}/bestmove'.format(game, gid, pid))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should_be_err_equal_to(res, 'need two players');
            done();
        });
    });
    
    it('get {0}/:gid/player/:pid/turn should be error'.format(game), function (done) {
        request(server).get('{0}/{1}/player/{2}/turn'.format(game, gid, pid))
        .end(function(err,res){
            should_be_ok_and_json(res);
            should_be_err_equal_to(res, 'need two players');
            done();
        });
    });
  
    it('get {0} length should be 1'.format(games), function (done) {
        request(server).get(games)
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.equal(1, res.body.length);
            done();
        });
    });
    
    it('get {0} length should be 1'.format(games_need_opp), function (done) {
        request(server).get(games_need_opp)
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.equal(1, res.body.length);
            done();
        });
    });
    
    it('get {0}/0 should return game'.format(games_need_opp), function (done) {
        request(server).get('{0}/0'.format(games_need_opp))
        .end(function(err,res) {
            should_be_ok_and_json(res);
            should.exist(res.body);
            done();
        });
    });
    
    it('get {0} length should be 0'.format(games_in_prog), function (done) {
        request(server).get(games_in_prog)
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.equal(0, res.body.length);
            done();
        });
    });
    
    it('get {0} length should be 0'.format(games_in_chkmte), function (done) {
        request(server).get(games_in_chkmte)
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.equal(0, res.body.length);
            done();
        });
    });
    
    it('get {0} length should be 0'.format(games_in_draw), function (done) {
        request(server).get(games_in_draw)
        .end(function(err,res){
            should_be_ok_and_json(res);
            should.equal(0, res.body.length);
            done();
        });
    });
});
