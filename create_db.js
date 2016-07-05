'use strict';
/*jslint node: true */

const credentials = require('./credentials');
const pg = require('pg');

pg.connect(credentials.DATABASE_URL, function(err, client, done){
  if (err){
    return console.error('error fetching client from pool', err);
  }
  client.query("drop table if exists users", function(err){
    if (err){
      console.error('error', err);
      return;
    }
    client.query("drop table if exists it", function(err){
      if (err){
        console.error('error', err);
        return;
      }
      client.query("create table users ( "+
      "id text primary key, "+
      "name text, "+
      "lat float, "+
      "lon float, "+
      "killed int, "+
      "highscore int)",
      function(err){
        if (err){
          console.error('error', err);
          return;
        }
        client.query("create table it ( "+
        "uuid text primary key, "+
        "lat float, "+
        "lon float, "+
        "chain text, "+
        "killed text)",
        function(err){
          if (err){
            console.error('error', err);
            return;
          }
          done();
          pg.end();
        });
      });
    });
  });
});
