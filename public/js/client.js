;$(function() {
  var $since = $('#since'),
      $user_id = $('#members'),
      $main_feed = $('#main_feed'),
      $error = $('#error');

  $since.focus();
  $('#since, #members').keyup(function(evt) {
    if (evt.keyCode == 13 && $('#login').text() !== 'Login') {
      evt.preventDefault();
      $error.text('');
      if ($(this)[0].id == 'since') {
        var v = $since.val();
        var d = parseDate(v);
        get_feed_by_date(d);
      } else {
        if (selectedMember) {
          var v = $since.val();
          var d = parseDate(v);
          get_feed_by_user(selectedMember, d);
        }
      }
    }
  });

  $('#sinceButton, #nameButton').click(function(evt) {
    if ($(this)[0].id == 'sinceButton') {
      var v = $since.val();
      var d = parseDate(v);
      $error.text('');
      get_feed_by_date(d);
    } else {
      if (selectedMember) {
        $error.text('');
        var v = $since.val();
        var d = parseDate(v);
        get_feed_by_user(selectedMember, d);
      }
    }
  });

  $('#login').click(function(evt) {
    if ($(this).text() == 'Login') {
      FB.login(function(res) {
        if (res.authResponse) {
          $('#sinceButton, #nameButton, #since, #members').removeAttr('disabled');
          $('#login').text('Logout');
          get_members();
        } else {
          $error.html("Uh Oh! Looks like you won't give me access :(");
        }
      }, {scope: 'read_stream'});
    } else {
      FB.logout(function(){
        $('#login').text('Login');
        $('#sinceButton, #nameButton, #since, #members').attr('disabled', 'disabled');
        selectedMember = null;
      });
    }
  });

  $('#members').blur(function(evt) {
    if ($(this).val() == '') {
      selectedMember = null;
    }
  });

  $('#main_feed').delegate('.modalLauncher', 'click', function(evt) {
    $('#' + this.id + '_modal').modal();
  });

  var length_of_between_ = 8,
      until_keywords = ['until', 'to', 'up to']
  function parseDate(val) {
    var result = {from: null, to: null};

    val = val.toLowerCase();
    if (val.indexOf('between') === 0 && val.indexOf('and') > -1) {
      var between_what = val.substring(length_of_between_);
      var vals = between_what.split('and');

      return {
        from: parseSingleDate(vals[0]),
        to: parseSingleDate(vals[1])
      };
    }

    for (var i = 0, l = until_keywords.length; i < l; i++) {
      if (val.indexOf(until_keywords[i]) == 0) {
        return {
          to: parseSingleDate(val.substring(until_keywords[i].length + 1))
        };
      }
    }

    return {
      from: parseSingleDate(val)
    };
  }

  function parseSingleDate(val) {
    var d = new Date(val);

    if (d.toString() == "Invalid Date") {
      d = Date.parse(val);
    }

    return d && d.getTime();
  }

  var entriesTemplate = Mustache.compile($('#feed_entries').html());
  $main_feed.html(entriesTemplate({entries:[]}));

  function get_feed_by_date(dateParams) {

    if (dateParams) {
      $main_feed.html('Loading...<hr/>');
      var params = {
        dates: dateParams,
        access_token: FB.getAccessToken()
      };

      get_feed('by_date', params);

    } else {
      $error.html("Uh Oh! I didn't understand you...<br/>Please try again...");
    }
  }

  function get_feed_by_user(user_id, dateParams) {
    if (user_id) {
      $main_feed.html('Loading, this could take a min :/ ...<hr/>');

      var params = {
        user_id: user_id,
        access_token: FB.getAccessToken()
      };

      if (dateParams) {
        params['dates'] = dateParams;
      }

      get_feed('/by_user', params);

    } else {
      $error.html("Uh Oh! I didn't understand you...<br/>Please try again...");
    }
  }

  function get_feed(url, params) {

    $.ajax({
      url: url,
      data: params,
      dataType: 'json',
      success: check_response(function(data) {
        $main_feed.html(entriesTemplate({entries: data}));
      })
    });
  }
});


var membersData = null,
    selectedMember;
function get_members() {
  if (!membersData) {
    $.ajax({
      url: '/members',
      data: {access_token: FB.getAccessToken()},
      dataType: 'json',
      success: check_response(function(data) {
        if (data.length) {
          var members = [];
          membersData = {};
          data.forEach(function(item) {
            membersData[item.name] = item;
            members.push(item.name);
          });
          $('#members').typeahead({
            source: members,
            updater: function(item) {
              selectedMember = membersData[item].id;
              return item;
            }
          });
        }
      })
    });
  }
}

function check_response(callback) {
  return function(data) {
    if (data.message) {
      $('#error').html(data.message);
    } else {
      $('#error').html('');
      callback(data);
    }
  }
}