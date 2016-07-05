'use strict';
/*jslint node: true */

const credentials = require('./credentials');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const pg = require('pg');
const http = require('http').Server(app);
const GoogleAuth = require('google-auth-library');
const authFactory = new GoogleAuth();
const oauth2client = new authFactory.OAuth2();
const classes = require('./classes');
const argv = require('yargs').argv;

const KILL_DISTANCE = 5;
const IT_TIME_STEP = 300000;

const its = {};

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

//custom middleware
if (argv.DEVELOPMENT || argv.DEV || argv.D){
  console.log('Starting in Development mode');
  app.use(function(req, res, next){
    req.profile = {
      sub: req.body.token,
      name: req.body.token
    };
    next();
  });
}
else{
  app.use(function(req, res, next){
    let token;
    if (req.method == 'GET'){
      token = req.query.token;
    }
    else{
      token = req.body.token;
    }
    if (token){
      oauth2client.verifyIdToken(token, credentials.APP_CLIENT_ID, function(err, tokenInfo){
        if (!err){
          req.profile = tokenInfo.getPayload();
          next();
        }
        else{
          res.json({
            "errors": ['Invalid token', err.message]
          });
          res.end();
        }
      });
    }
    else{
      console.log(req);
      res.json({
        "errors": ['Missing token']
      });
      res.end();
    }
  });
}


http.listen(credentials.PORT, function(){
  console.log('Example app listening on port', credentials.PORT, '!');
});

app.post('/location', function(req, res){
  let profile = req.profile;
  if (req.body.lat === undefined || req.body.lon === undefined){
    res.json({
      "errors": ['Missing location data']
    });
    res.end();
    return;
  }
  let userStub = {
    id: profile.sub,
    name: profile.name || 'Jay Height',
    lat: req.body.lat,
    lon: req.body.lon,
    killed: 0,
    highscore: 0
  };
  let responseJSON = {
    nearby: "",
    killed: 0
  };
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      res.json({
        "errors": ['DB error']
      });
      res.end();
      done();
      return console.error('error fetching client from pool', err);
    }
    getUser(client, userStub.id).then(function(result){
      let row = result.rows[0];
      responseJSON.killed = row.killed;
      updateUser(client, userStub).catch(function(err){
        console.error('error executing query', err);
        res.json({
          "errors": ['DB error']
        });
        res.end();
      })
      .then(function(){
        done();
      });
    })
    .catch(function(err){
      createUser(client, userStub).catch(function(err){
        console.error('error executing query', err);
        res.json({
          "errors": ['DB error']
        });
        res.end();
      })
      .then(function(){
        done();
      });
    })
    .then(function(){
      let keys = Object.keys(its);
      for (let i = 0; i < keys.length; i++){
        let it = its[keys[i]];
        if (it.isFollowing(userStub) &&
            it.getDistanceToUser(userStub) < KILL_DISTANCE){
          responseJSON.nearby = it.getRandomName();
          break;
        }
      }
      res.json(responseJSON);
      res.end();
    });
  });
});

app.post('/create', function(req, res){
  let profile = req.profile;
  let it = new classes.It();
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      res.json({
        "errors": ['DB error']
      });
      res.end();
      done();
      return console.error('error fetching client from pool', err);
    }
    getUser(client, profile.sub).then(function(result){
      if (!result.rows.length){
        res.json({
          "errors": ['No user with that token']
        });
        return;
      }
      let row = result.rows[0];
      let lat = row.lat + Math.random()*4-2;
      if (lat < -180){
        lat = -180;
      }
      else if (lat > 180){
        lat = 180;
      }
      let lon = row.lon + Math.random()*4-2;
      if (lon < -180){
        lon = -180;
      }
      else if (lon > 180){
        lon = 180;
      }
      it.lat = lat;
      it.lon = lon;
      it.chain.push({
        id: row.id,
        name: row.name,
        time: new Date().getTime()
      });
      let promises = [];
      promises.push(createIt(client, it)
      .then(function(){
        res.json({
          "id": it.uuid
        });
        its[it.uuid] = it;
      })
      .catch(function(err){
        console.error('error executing query', err);
        res.json({
          "errors": ['DB error']
        });
      }));
      return Promise.all(promises);
    })
    .catch(function(err){
      console.error('error executing query', err);
      res.json({
        "errors": ['DB error']
      });
    })
    .then(function(){
      res.end();
      done();
    });
  });
});

app.post('/infect', function(req, res){
  let profile = req.profile;
  let id = req.body.id;
  let first;
  let second = new classes.User(profile);
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      res.json({
        "errors": ['DB error']
      });
      res.end();
      done();
      return console.error('error fetching client from pool', err);
    }
    let promises = [];
    promises.push(getUser(client, id).then(function(result){
      if (!result.rows.length){
        res.json({
          "errors": ['No user with that id']
        });
        return;
      }
      first = result.rows[0];
      let promises = [];
      let keys = Object.keys(its);
      for (let i = 0; i < keys.length; i++){
        let it = its[keys[i]];
        let isFollowingFirst = it.isFollowing(first);
        let hasEncounteredFirst = it.hasEncountered(first);
        let isFollowingSecond = it.isFollowing(second);
        let hasEncounteredSecond = it.hasEncountered(second);
        let addFirstToIt = isFollowingSecond && !hasEncounteredFirst;
        let addSecondToIt = isFollowingFirst && !hasEncounteredSecond;
        if (addSecondToIt){
          it.chain.push({
            id: second.id,
            name: second.name,
            time: new Date().getTime()
          });
        }
        if (addFirstToIt){
          it.chain.push({
            id: first.id,
            name: first.name,
            time: new Date().getTime()
          });
        }
        if (addSecondToIt || addFirstToIt){
          promises.push(updateIt(client, it));
        }
      }
      return Promise.all(promises).then(function(){
        res.json({
          "success": true
        });
      }, function(err){
        res.json({
          "errors": [err]
        });
      });
    })
    .catch(function(err){
      console.error('error executing query', err);
      res.json({
        "errors": ['DB error']
      });
    })
    .then(function(){
      res.end();
      done();
    }));
    return Promise.all(promises);
  });
});

app.get('/scores', function(req, res){
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      res.json({
        "errors": ['DB error']
      });
      res.end();
      done();
      return console.error('error fetching client from pool', err);
    }
    getScores(client).then(function(result){
      let scores = [];
      for (let r = 0; r < result.rows.length; r++){
        let row = result.rows[r];
        scores.push({name: row.name, score: row.highscore});
      }
      res.json({scores: scores});
      res.end();
      done();
    });
  });
});

pg.connect(credentials.DATABASE_URL, function(err, client, done){
  if (err){
    done();
    return console.error('error fetching client from pool', err);
  }
  client.query("select * from it",
  function(err, result){
    if (err){
      console.error('error executing query', err);
      done();
      return;
    }
    for (let r = 0; r < result.rows.length; r++){
      let row = result.rows[r];
      let it = new classes.It(row);
      its[it.uuid] = it;
    }
    done();
  });
});

//Every 5 minutes, move all its and save
setInterval(function(){
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    let promises = [];
    let keys = Object.keys(its);
    for (let i = 0; i < keys.length; i++){
      let it = its[keys[i]];
      let target = it.getTarget();
      if (target){
        promises.push(itLogic(client, it, target));
      }
      else{
        delete its[it.uuid];
        promises.push(deleteIt(client, it.uuid));
      }
    }
    Promise.all(promises).then(done, done);
  });
}, IT_TIME_STEP);

function itLogic(client, it, target){
  let promises = [];
  promises.push(getUser(client, target).then(function(result){
    if (!result.rows){
      console.error('No entry for user', target);
      return;
    }
    let row = result.rows[0];
    if (it.getDistanceToUser(row) < KILL_DISTANCE){
      let killed = it.chain.pop();
      it.killed.push({
        id: killed.id,
        name: killed.name,
        time: new Date().getTime()
      });
      row.killed++;
      promises.push(updateUser(client, row, simpleErrorLog));
    }
    else{
      it.moveTowards(row);
    }
    promises.push(updateIt(client, it, simpleErrorLog));
  })
  .catch(function(err){
    console.error('error executing query', err);
  }));
  return Promise.all(promises);
}

setInterval(function(){
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    let promises = [];
    let keys = Object.keys(its);
    for (let i = 0; i < keys.length; i++){
      let it = its[keys[i]];
      for (let c = 0; c < it.chain.length; c++){
        let entry = it.chain[c];
        promises.push(scoreboardLogic(client, entry));
      }
    }
    Promise.all(promises).then(function(){
      done();
    }).catch(done);
  });
}, 10000);

function scoreboardLogic(client, entry){
  let promises = [];
  let userId = entry.id;
  promises.push(getUser(client, userId).then(function(result){
    let user = result.rows[0];
    let now = new Date().getTime();
    if (now - entry.time > user.highscore){
      user.highscore = now - entry.time;
      promises.push(updateUser(client, user).catch(simpleErrorLog));
    }
  }).catch(simpleErrorLog));
  return Promise.all(promises);
}

function createIt(client, it, callback){
  return new Promise(function(resolve, reject){
    client.query("insert into it (lat, lon, chain, killed, uuid) values "+
    "($1, $2, $3, $4, $5)", [it.lat, it.lon, JSON.stringify(it.chain),
      JSON.stringify(it.killed), it.uuid], pgCallback(resolve, reject));
  });
}

function updateIt(client, it, callback){
  return new Promise(function(resolve, reject){
    client.query("update it set lat = $1, lon = $2, chain = $3, killed = $4 "+
    "where uuid = $5", [it.lat, it.lon, JSON.stringify(it.chain),
      JSON.stringify(it.killed), it.uuid], pgCallback(resolve, reject));
  });
}

function deleteIt(client, uuid, callback){
  return new Promise(function(resolve, reject){
    client.query("delete from it where uuid = $1",
      [uuid], pgCallback(resolve, reject));
  });
}

function createUser(client, user, callback){
  return new Promise(function(resolve, reject){
    client.query("insert into users (id, name, lat, lon, killed, highscore) "+
    "values ($1, $2, $3, $4, $5, $6)",
    [user.id, user.name, user.lat, user.lon, user.killed, user.highscore],
    pgCallback(resolve, reject));
  });
}

function updateUser(client, user, callback){
  return new Promise(function(resolve, reject){
    client.query("update users set lat = $1, lon = $2, killed = $3, highscore = $4 where id = $5",
    [user.lat, user.lon, user.killed, user.highscore, user.id], pgCallback(resolve, reject));
  });
}

function getUser(client, id, callback){
  return new Promise(function(resolve, reject){
    client.query("select * from users where id = $1",
    [id], pgCallback(resolve, reject));
  });
}

function getScores(client){
  return new Promise(function(resolve, reject){
    client.query("select name, highscore from users order by highscore desc",
    [], pgCallback(resolve, reject));
  });
}

function pgCallback(resolve, reject){
  return function(err, result){
    if (err){
      reject(err);
    }
    else{
      resolve(result);
    }
  };
}

function simpleErrorLog(err){
  if (err){
    console.error('error executing query', err);
  }
}
