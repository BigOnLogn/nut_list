var NutProvider = require('./nutprovider').NutProvider;
var fs = require('fs');

var Cacher = exports.Cacher = function Cacher(options) {
  this.options = options = options || {};
  this.last_checked = null;
  // default the interval to 30 minutes (in mils)
  this.options['interval'] = options['interval'] || 30 * 60000;

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
    url += '?limit=500'
    if (this.last_checked) {
      url += '&since=' + Math.floor(this.last_checked / 1000);
    }

    console.log('url:', url);
    graph.get(url, function process_response(err, response) {
      if (err) {console.log('proc err:', err);}
      var data = response['data'] || [];
      console.log('data length:', data.length);
      NutProvider.processNuts(data, function(p_err) {
        if (err) {
          console.log('processing err:', p_err);
        }
        else {
          console.log('saved ids');
        }
        this.last_checked = new Date().getTime();
        NutProvider.setLastChecked(this.last_checked, function(err) { if (err) {console.log('failed to update last_checked:', err); }});
        this.isRunning = false;
      }.bind(this));
    }.bind(this));
  }
};

function checker(graph, cacher) {
  var url = '/287924391262333/feed';
  url += '?limit=1';

  // check db top post
  NutProvider.getLatest(function(err, latest) {
    if (err) { console.log('getLatest error:', err); }
    console.log('latest:', latest);
    if (latest) {
      // check the FB top post
      console.log('url:', url);
      graph.get(url, function checker_response(err, response) {
        var data = response['data'] || [];
        console.log('data:', data);
        console.log('test:', (data.length &&
            ((new Date(data[0]['updated_time'])).getTime() > latest.updated_time)));
        if (data.length &&
            ((new Date(data[0]['updated_time'])).getTime() > latest.updated_time)) {
          cacher.process(graph);
        }
      });
    } else {
      cacher.process(graph);
    }
  });

}