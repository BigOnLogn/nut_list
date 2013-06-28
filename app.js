
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path')
  , graph = require('fbgraph');

var app = express();

var graph_conf = {
    client_id: process.env.config_client_id
  , client_secret: process.env.config_client_secret
  , scope: 'read_stream'
  , redirect_uri: process.env.config_domain_and_port + '/auth_callback'
};

var Cacher = require('./cacher').Cacher,
    cacher = new Cacher({interval: 5 * 60000}),
    startup_run = false;

var NutProvider = require('./nutprovider').NutProvider,
    client = new NutProvider('localhost', 27017);

// all environments
app.set('port', process.env.PORT || 10001);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session({secret: 'session secret'}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
app.configure('development', function() {
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

app.configure('production', function() {
  app.use(express.errorHandler());
});

app.get('/by_date', function(req, res) {
  if (has_access(req, res)) {
    var dates = req.query['dates'];

    console.log('req:', req.query);
    console.log('dates:', dates);
    console.log('res.send:', res.send);
    client.getByDate(dates)
    .then(function(results) {
      res.type('application/json');
      res.send(results);
    }, function(err) {
      res.type('application/json');
      res.send(err);
    });
  }
});

app.get('/by_user', function(req, res) {
  console.log('by_user:', req.query);
  if (has_access(req, res)) {
    var dates = req.query['dates'];

    client.getByUserId(req.param('user_id'), dates)
    .then(function(results) {
      console.log('getByUserId:', results);
      res.type('application/json');
      res.send(results);
    }, function(err) {
      console.log('getByUserId err:', err);
      res.type('application/json');
      res.send(err);
    });
  }
});

app.get('/members', function(req, res) {
  if (has_access(req, res)) {
    // always get member list from FB.
    var url = '/287924391262333/members';

    graph.get(url, function(err, response) {
      res.type('application/json');
      if (err) {
        res.send(err);
      } else {
        var data = response.data || [];
        data.sort(function(a, b) {
          return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
        });
        res.send(data);
      }
    });
  }
});

function has_access(req, res) {
  if (req.param('access_token')) {
    graph.setAccessToken(req.param('access_token'));
    // cacher throttles actual cache runs
    cacher.run(graph, {force: startup_run});
    startup_run = false;
    return true;
  }
  res.send({error: 'no_access'});
  return false;
}

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
  // force cacher to run on startup.
  startup_run = true;
});
