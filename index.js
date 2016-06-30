'use strict';
/*jslint node: true */

const credentials = require('./credentials');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const pg = require('pg');
const http = require('http').Server(app);
const verifier = require('google-id-token-verifier');
const classes = require('./classes');
const argv = require('yargs').argv;

const KILL_DISTANCE = 5;
const IT_TIME_STEP = 300000;

const its = [];

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
    if (req.body.token){
      let token = req.body.token;
      verifier.verify(token, credentials.APP_CLIENT_ID, function(err, tokenInfo){
        if (!err){
          req.profile = tokenInfo;
        }
        next();
      });
    }
    else{
      next();
    }
  });
}


http.listen((process.env.PORT || 3000), function(){
  console.log('Example app listening on port 3000!');
});

app.post('/location', function(req, res){
  let profile = req.profile;
  if (!profile){
    res.status(400);
    res.end();
    return;
  }
  if (req.body.lat === undefined || req.body.lon === undefined){
    res.status(400);
    res.end();
    return;
  }
  let userStub = {
    id: profile.sub,
    name: profile.name || 'Unknown',
    lat: req.body.lat,
    lon: req.body.lon,
    killed: 0
  };
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    getUser(client, userStub.id, function(err, result){
      let responseJSON = {
        nearby: "",
        killed: 0
      };
      if (!err && result.rows.length){
        let row = result.rows[0];
        responseJSON.killed = row.killed;
        updateUser(client, userStub, function(err){
          if (err){
            console.error('error executing query', err);
            res.status(500);
            res.end();
          }
          done();
        });
      }
      else{
        createUser(client, userStub, function(err){
          if (err){
            console.error('error executing query', err);
            res.status(500);
            res.end();
          }
          done();
        });
      }
      for (let i = 0; i < its.length; i++){
        let it = its[i];
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
  if (!profile){
    res.status(400);
    res.end();
    return;
  }
  let it = new classes.It();
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    getUser(client, profile.sub, function(err, result){
      if (err){
        console.error('error executing query', err);
        res.status(500);
        res.end();
        done();
        return;
      }
      if (!result.rows.length){
        res.status(500);
        res.end();
        done();
        return;
      }
      let row = result.rows[0];
      let lat = row.lat + Math.random()*10-10;
      if (lat < -180){
        lat = -180;
      }
      else if (lat > 180){
        lat = 180;
      }
      let lon = row.lon + Math.random()*10-10;
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
      createIt(client, it, function(err){
        if (err){
          console.error('error executing query', err);
          res.status(500);
          res.end();
          done();
          return;
        }
        res.status(200);
        res.end();
        its.push(it);
        done();
      });
    });
  });
});

app.post('/infect', function(req, res){
  let profile = req.profile;
  if (!profile){
    res.status(400);
    res.end();
    return;
  }
  let id = req.body.id;
  let user = {id: id};
  pg.connect(credentials.DATABASE_URL, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    let promises = [];
    for (let i = 0; i < its.length; i++){
      let it = its[i];
      if (it.isFollowing(user)){
        it.chain.push({
          id: profile.sub,
          name: profile.name,
          time: new Date().getTime()
        });
        promises.push(updateIt(client, it));
      }
    }
    Promise.all(promises).then(function(){
      done();
    });
  });
  res.end();
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
      its.push(new classes.It(row));
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
    for (let i = 0; i < its.length; i++){
      let it = its[i];
      let target = it.getTarget();
      if (target){
        itLogic(client, it, target, promises);
      }
    }
    Promise.all(promises).then(function(){
      done();
    });
  });
}, IT_TIME_STEP);

function itLogic(client, it, target, promises){
  promises.push(getUser(client, target, function(err, result){
    if (err || !result.rows){
      if (err){
        console.error('error executing query', err);
      }
      if (!result.rows){
        console.error('No entry for user', target);
      }
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
  }));
}

function createIt(client, it, callback){
  return new Promise(function(resolve, reject){
    client.query("insert into it (lat, lon, chain, killed, uuid) values "+
    "($1, $2, $3, $4, $5)", [it.lat, it.lon, JSON.stringify(it.chain),
      JSON.stringify(it.killed), it.uuid], callback);
    resolve();
  });
}

function updateIt(client, it, callback){
  return new Promise(function(resolve, reject){
    client.query("update it set lat = $1, lon = $2, chain = $3, killed = $4 "+
    "where uuid = $5", [it.lat, it.lon, JSON.stringify(it.chain),
      JSON.stringify(it.killed), it.uuid], callback);
    resolve();
  });
}

function createUser(client, user, callback){
  return new Promise(function(resolve, reject){
    client.query("insert into users (id, name, lat, lon, killed) "+
    "values ($1, $2, $3, $4, $5)",
    [user.id, user.name, user.lat, user.lon, user.killed], callback);
    resolve();
  });
}

function updateUser(client, user, callback){
  return new Promise(function(resolve, reject){
    client.query("update users set lat = $1, lon = $2, killed = $3 where id = $4",
    [user.lat, user.lon, user.killed, user.id], callback);
    resolve();
  });
}

function getUser(client, id, callback){
  return new Promise(function(resolve, reject){
    client.query("select * from users where id = $1",
    [id], callback);
    resolve();
  });
}

function simpleErrorLog(err){
  if (err){
    console.error('error executing query', err);
  }
}
