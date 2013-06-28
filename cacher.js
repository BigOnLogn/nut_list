var NutProvider = require('./nutprovider').NutProvider,
    client = new NutProvider('localhost', 27017);

var Cacher = exports.Cacher = function Cacher(options) {
  this.options = options = options || {};
  this.last_checked = null;
  // default the interval to 30 minutes (in mils)
  this.options['interval'] = options['interval'] || 30 * 60000;

  client.getLastChecked().then(function(value) {
    this.last_checked = value;
  }.bind(this));

  this.isRunning = false;
};

Cacher.prototype.run = function(graph, options) {
  options = options || this.options;

  // throttle the caching runs based on set interval
  if (options['force'] || !this.last_checked ||
      (new Date().getTime() - this.last_checked > options.interval)) {
    checker(graph, this);
  }
};

Cacher.prototype.process = function(graph) {
  console.log('isRunning:', this.isRunning);
  if (!this.isRunning) {
    this.isRunning = true;
    var url = '/287924391262333/feed';
    url += '?limit=1000'
    if (this.last_checked) {
      url += '&since=' + this.last_checked / 1000;
    }

    console.log('url:', url);
    graph.get(url, function process_response(err, response) {
      var data = response['data'] || [];
      data.forEach(function (item) {
        if (item['type'] == 'video') {
          console.log('adding item:', item['id']);
          client.processNut(item).done();
        }
      });
      this.last_checked = new Date().getTime();
      client.setLastChecked(this.last_checked);
      this.isRunning = false;
      console.log('process done:', data.length);
    }.bind(this));
  }
};

function checker(graph, cacher) {
  var url = '/287924391262333/feed';
  url += '?limit=1';

  // check db top post
  client.getLatest().then(function(latest) {
    console.log('latest:', latest);
    if (latest) {
      // check the FB top post
      graph.get(url, function checker_response(err, response) {
        var data = response['data'] || [];
        if (data.length &&
            ((new Date(data[0]['updated_time'])).getTime() > latest.updated_time)) {
          cacher.process(graph);
        }
      });
    } else {
      cacher.process(graph);
    }
  }, function(err) {
    console.log('getLatest error:', err);
  })

}