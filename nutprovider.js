var MongoClient = require('mongodb').MongoClient;
var querystring = require('querystring');
var async = require('async');

// Helper functions
function get_collection(callback) {
  MongoClient.connect('mongodb://localhost:27017/nutlist', {
    db: {safe: false, w: 1},
    server: {auto_reconnect: true, w: 1}
  }, function(err, db) {
    if (err) { callback(err); }
    else {
      db.collection('nuts', {strict:true}, function(get_err, col) {
        if (get_err) {
          db.createCollection('nuts', callback);
        }
        else { callback(null, col); }
      });
    }
  });
}

function process_raw_nut(nut) {
  ['created_time', 'updated_time'].forEach(function(time) {
    if (nut[time]) {
      nut[time] = new Date(nut[time]).getTime();
    }
  });
  if (nut['link'] && nut['link'].indexOf('youtu') > 0) {
    nut['video_id'] = extract_video_id(nut['link']);
  }
  return nut;
}

function filter_video(nut) {
  return nut['type'] == 'video';
}

function extract_video_id(link) {
  var qs
  if (link.indexOf('youtu.be') >= 0) {
    qs = link.substring(link.indexOf('.be/') + 4);
    return qs;
  }
  qs = querystring.parse(link.substring(link.indexOf('?') + 1));
  return qs['v'];
  // return '<iframe width="420" height="345" src="http://www.youtube.com/embed/' + qs['v'] + '" frameborder="0" allowfullscreen></iframe>';
}

function map_results(results) {
  return results.map(result_mapper);
}

function result_mapper(item) {
  if (item['updated_time'])
    item['updated_time'] = new Date(item['updated_time']).toString("M/d/yyyy h:mm tt");
  return item;
}

// External API
var NutProvider = exports.NutProvider = {

  getByDate: function(dates, callback) {
    get_collection(function(err, collection) {
      if (err) { callback(err); }
      else {
        var query = {};
        if (dates['from']) {
          query['$gte'] = parseInt(dates['from'], 10);
        }
        if (dates['to']) {
          query['$lt'] = parseInt(dates['to'], 10);
        }
        collection.find({'updated_time': query}).sort('updated_time', 1).toArray(function(find_err, docs) {
          console.log('err:', find_err);
          console.log('results:', map_results(docs));
          if (find_err) callback(find_err);
          else callback(null, map_results(docs));
        });
      }
    });
  },

  getByUserId: function(userId, dates, callback) {
    get_collection(function(err, collection) {
      if (err) { callback(err); }
      else {
        var query = {
          'from.id': userId
        };
        if (dates) {
          if (dates['from']) {
            query['updated_time'] = query['updated_time'] || {};
            query['updated_time']['$gte'] = dates['from'];
          }
          if (dates['to']) {
            query['updated_time'] = query['updated_time'] || {};
            query['updated_time']['$lt'] = dates['to'];
          }
        }
        console.log('got collection:', query);
        collection.find(query).sort('updated_time', -1).toArray(function(find_err, docs) {
          console.log('actual results:', find_err);
          if (find_err) callback(find_err);
          else callback(null, map_results(docs));
        });
      }
    });
  },

  get: function(params, callback) {
    get_collection(function(err, collection) {
      if (err) { callback(err); }
      else {
        var query = {};
        if (params['user_id']) {
          query['from.id'] = params['user_id'];
        }
        if (params['dates']) {
          var dates = params['dates'];
          if (dates['from']) {
            query['updated_time'] = {'$gte': parseInt(dates['from'], 10)};
          }
          if(dates['to']) {
            query['updated_time'] = query['updated_time'] || {};
            query['updated_time']['$lt'] = parseInt(dates['to'], 10);
          }
        }
        console.log('get query:', query);
        collection.find(query).sort('updated_time', -1).toArray(function(find_err, docs) {
          console.log('get docs:', docs.length);
          if (find_err) { callback(find_err); }
          else { callback(null, map_results(docs)); }
        });
      }
    });
  },

  getLatest: function(callback) {
    get_collection(function(err, collection) {
      if (err) { callback(err); }
      else {
        collection.find({'id': {'$gt': '0'}}).sort('updated_time', -1).limit(1).toArray(function(find_err, result) {
          if (find_err) callback(find_err);
          else callback(null, result && result.length ? result[0] : null);
        });
      }
    });
  },

  getLastChecked: function(callback) {
    get_collection(function(err, collection) {
      if (err) { callback(err); }
      else{
        collection.find({'key': 'last_checked'}).toArray(function(find_err, docs) {
          if (find_err) callback(find_err);
          else callback(null, docs && docs.length ? docs[0]['time'] : null);
        });
      }
    });
  },

  setLastChecked: function(last_checked, callback) {
    get_collection(function(err, collection) {
      if (err) { callback(err); }
      else {
        collection.update({'key': 'last_checked'}, {$set: {'time': last_checked}}, {upsert: true}, function(upd_err) {
          if (upd_err || callback) callback(upd_err);
        });
      }
    });
  },

  processNuts: function(raw_nuts, callback) {
    // filter and map raw_nuts
    var processed_nuts = raw_nuts.filter(filter_video).map(process_raw_nut);

    // Get a connection for the id lookups
    get_collection(function(err, coll) {
      if (err) callback(err);
      else {
        // Extract ids
        var ids = processed_nuts.map(function(n) {
          return n['id'];
        });
        // Find all existing nuts
        coll.find({'id': {$in: ids}}, {'id': 1}).toArray(function(find_err, results) {
          if (results.length == processed_nuts.length) callback(null, []);
          else {
            // Filter for new nuts
            var new_nuts = processed_nuts.filter(function(n) {
              return !results.some(function(r) {
                return r['id'] == n['id'];
              });
            });
            // insert new nuts, if any
            coll.insert(new_nuts, callback);
          }
        });
      }
    });
  }

};