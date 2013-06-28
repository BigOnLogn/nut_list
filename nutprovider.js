var mongodb = require('mongodb'),
    Db = mongodb.Db,
    Server = mongodb.Server;
var Q = require('q');
var querystring = require('querystring');

var NutProvider = exports.NutProvider = function NutProvider(host, port, check_db) {
  this.db = new Db('nutlist', new Server(host, port, {auto_reconnect: true}, {w: 1}), {safe: false});
  this.db.open(function(err, db){
    if (err) { console.log('open error:', err); }
    else {
      if (check_db) {
        var col = db.collection('nuts');
        col.find().toArray(function(err, results) {
          console.log('db check err:', err);
          console.log('db check results:', results);
          console.log('db check results:', results.length);
        });
      }
    }
  });
};

NutProvider.prototype.getCollection = function() {
  var deferred = Q.defer();

  this.db.collection('nuts', function(err, collection) {
    if (err) {
      this.db.createCollection('nuts', function(cr_err, cr_col) {
        if (cr_err) deferred.reject(cr_err);
        else deferred.resolve(cr_col);
      });
    }
    else deferred.resolve(collection);
  });

  return deferred.promise;
};

NutProvider.prototype.getByDate = function(dates) {
  var deferred = Q.defer();

  this.getCollection().then(function(collection) {
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
      if (find_err) deferred.reject(find_err);
      else deferred.resolve(map_results(docs));
    });
  }, function(err){ deferred.reject(err); });

  return deferred.promise;
};

NutProvider.prototype.getByUserId = function(userId, dates) {
  var deferred = Q.defer();

  this.getCollection().then(function(collection) {
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
      if (find_err) deferred.reject(find_err);
      else deferred.resolve(map_results(docs));
    });
  }, function(err){ deferred.reject(err); });

  return deferred.promise;
};

NutProvider.prototype.getLatest = function() {
  var deferred = Q.defer();

  this.getCollection().then(function(collection) {
    collection.find({'id': {'$gt': '0'}}).sort('updated_time', -1).limit(1).toArray(function(find_err, result) {
      if (find_err) deferred.reject(find_err);
      else deferred.resolve(result && result.length ? result[0] : null);
    });
  }, function(err){ deferred.reject(err); });

  return deferred.promise;
};

NutProvider.prototype.getLastChecked = function() {
  var deferred = Q.defer();

  this.getCollection().then(function(collection) {
    collection.find({'key': 'last_checked'}).toArray(function(find_err, docs) {
      if (find_err) deferred.reject(find_err);
      else deferred.resolve(docs && docs.length ? docs[0]['time'] : null);
    });
  }, function(err){ deferred.reject(err); })

  return deferred.promise;
};

NutProvider.prototype.setLastChecked = function(last_checked) {
  var deferred = Q.defer();

  this.getCollection().then(function(collection) {
    collection.update({'key': 'last_checked'}, {$set: {'time': last_checked}}, {upsert: true});
  }, function(err){ deferred.reject(err); });

  return deferred.promise;
};

NutProvider.prototype.processNut = function(nut) {
  var deferred = Q.defer();
  
  nut = process_raw_nut(nut);

  this.getCollection().then(function(collection) {
    collection.find({'id': nut['id']}).toArray(function(find_err, docs) {
      if (find_err || !docs || !docs.length) {
        collection.save(nut);
        console.log('saved nut:', nut['id']);
      }
      deferred.resolve(nut);
    });
  }, function(err){ deferred.reject(err); });

  return deferred.promise;
};

function process_raw_nut(nut) {
  ['created_time', 'updated_time'].forEach(function(time) {
    if (nut[time]) {
      nut[time] = new Date(nut[time]).getTime();
    }
  });
  if (nut['link'] && nut['link'].indexOf('youtu') > 0) {
    nut['embed_link'] = create_embed_link(nut['link']);
  }
  return nut;
}

function create_embed_link(link) {
  var qs
  if (link.indexOf('youtu.be') >= 0) {
    qs = link.substring(link.indexOf('.be/') + 4);
    return '<iframe width="420" height="345" src="http://www.youtube.com/embed/' + qs + '" frameborder="0" allowfullscreen></iframe>';
  }
  qs = querystring.parse(link.substring(link.indexOf('?') + 1));
  return '<iframe width="420" height="345" src="http://www.youtube.com/embed/' + qs['v'] + '" frameborder="0" allowfullscreen></iframe>';
}

function map_results(results) {
  return results.map(result_mapper);
}

function result_mapper(item) {
  if (item['updated_time'])
    item['updated_time'] = new Date(item['updated_time']).toString("M/d/yyyy h:mm tt");
  return item;
}