'use strict';
/*jslint node: true */

const credentials = require('credentials');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const pg = require('pg');
const http = require('http').Server(app);
const verifier = require('google-id-token-verifier');
const classes = require('classes');

const its = [];

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

//custom middleware
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
  pg.connect(credentials.POSTGRES_CONNECTION_STRING, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    client.query("update users set lat = $1, lon = $2 where id = $3",
    [profile.lat, profile.lon, profile.sub],
    function(err){
      if (err){
        console.error('error executing query', err);
        res.status(500);
        res.end();
      }
      done();
    });
  });
  let userStub = {
    id: profile.sub,
    lat: profile.lat,
    lon: profile.lon
  };
  for (let i = 0; i < its.length; i++){
    let it = its[i];
    if (it.isFollowing(userStub) && it.getDistanceToUser(userStub) < 5){
      res.json({
        itNearby: true
      });
      res.end();
      return;
    }
  }
  res.json({
    itNearby: false
  });
  res.end();
});

pg.connect(credentials.POSTGRES_CONNECTION_STRING, function(err, client, done){
  if (err){
    done();
    return console.error('error fetching client from pool', err);
  }
  client.query("select * from it",
  function(err, result){
    if (err){
      console.error('error executing query', err);
    }
    for (let r = 0; r < result.rows.length; r++){
      let row = result.rows[r];
      its.push(new classes.It(row));
    }
    done();
  });
});

//Every 5 seconds save all its
setInterval(function(){
  pg.connect(credentials.POSTGRES_CONNECTION_STRING, function(err, client, done){
    if (err){
      done();
      return console.error('error fetching client from pool', err);
    }
    for (let i = 0; i < its.length; i++){
      let it = its[i];
      client.query("update it set lat = $1, lon = $2, chain = $3 "+
      "where uuid = $4", [it.lat, it.lon, JSON.stringify(it.chain), it.uuid],
      simpleErrorLog);
    }
  });
}, 5000);

function simpleErrorLog(err){
  if (err){
    console.error('error executing query', err);
  }
}
