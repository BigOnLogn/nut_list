
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

var NutProvider = require('./nutprovider').NutProvider;

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

    NutProvider.getByDate(dates, function(err, results) {
      res.type('application/json');
      res.send(err || results);
    });
  }
});

app.get('/by_user', function(req, res) {
  if (has_access(req, res)) {
    var dates = req.query['dates'];

    NutProvider.getByUserId(req.param('user_id'), dates, function(err, results) {
      res.type('application/json');
      res.send(err || results);
    });
  }
});

app.get('/feed', function(req, res) {
  if (has_access(req, res)) {
    var params = {};
    if (req.param('user_id')) {
      params['user_id'] = req.param('user_id');
    }
    if (req.query['dates']) {
      params['dates'] = req.query['dates'];
    }
    console.log('params:', params);
    NutProvider.get(params, function(err, results) {
      res.type('application/json');
      res.send(err || results);
    });
  } else {
    console.log('no access');
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

app.get('/embed/:video_id', function(req, res) {
  console.log('params:', req.param('video_id'));
  console.log('query:', req.query);
  res.send('<iframe width="420" height="345" src="http://www.youtube.com/embed/' + req.param('video_id') + '" frameborder="0" allowfullscreen></iframe>');
});

function has_access(req, res) {
  console.log('token:', req.param('access_token'));
  if (req.param('access_token')) {
    graph.setAccessToken(req.param('access_token'));
    // cacher throttles actual cache runs
    cacher.run(graph, {force: startup_run});
    startup_run = false;
    return true;
  }
  console.log('fail');
  res.type('application/json');
  res.send({error: 'no_access'});
  return false;
}

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
  // force cacher to run on startup.
  startup_run = true;
});
