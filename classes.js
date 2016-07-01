'use strict';
/*jslint node: true */

let uuid = require('node-uuid');

const SPEED_PER_TICK = 84;//meters/5minutes

class User {
  constructor(profile){
    this.id = profile.sub;
    this.name = profile.name;
    this.killed = 0;
    this.lat = 0;
    this.lon = 0;
  }
}

class It {
  constructor(des){
    if (des){
      this.lat = des.lat;
      this.lon = des.lon;
      this.chain = JSON.parse(des.chain);
      this.killed = JSON.parse(des.killed);
      this.uuid = des.uuid;
    }
    else{
      this.lat = 40.803333;
      this.lon = -76.341667;
      this.chain = [];
      this.killed = [];
      this.uuid = uuid.v4();
    }
  }

  getDistanceToUser(user){
    //user can be substituted with just an object containing lat and lon
    let R = 6371e3; // metres
    let φ1 = toRadians(user.lat);
    let φ2 = toRadians(this.lat);
    let Δφ = toRadians(this.lat-user.lat);
    let Δλ = toRadians(this.lon-user.lon);

    let a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    let d = R * c;
    return d;
  }

  isFollowing(user){
    if (this.chain.length){
      return this.chain[this.chain.length-1].id == user.id;
    }
    else{
      return false;
    }
  }

  getTarget(){
    if (this.chain.length){
      return this.chain[this.chain.length-1].id;
    }
    else{
      return null;
    }
  }

  moveTowards(user){
    /*
    aa = sin((1−f)⋅δ) / sin δ
    b = sin(f⋅δ) / sin δ
    x = aa ⋅ cos φ1 ⋅ cos λ1 + b ⋅ cos φ2 ⋅ cos λ2
    y = aa ⋅ cos φ1 ⋅ sin λ1 + b ⋅ cos φ2 ⋅ sin λ2
    z = aa ⋅ sin φ1 + b ⋅ sin φ2
    φi = atan2(z, √x² + y²)
    λi = atan2(y, x)
    */
    let distance = this.getDistanceToUser(user);
    if (distance < SPEED_PER_TICK){
      this.lat = user.lat;
      this.lon = user.lon;
      return;
    }
    let φ1 = toRadians(this.lat);
    let φ2 = toRadians(user.lat);
    let λ1 = toRadians(this.lon);
    let λ2 = toRadians(user.lon);
    let Δφ = toRadians(user.lat-this.lat);
    let Δλ = toRadians(user.lon-this.lon);
    let a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    let f = SPEED_PER_TICK/distance;
    let aa = Math.sin((1-f)*c)/Math.sin(c);
    let b = Math.sin(f*c)/Math.sin(c);
    let x = aa * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
    let y = aa * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
    let z = aa * Math.sin(φ1) + b * Math.sin(φ2);
    this.lat = toDegrees(Math.atan2(z, Math.sqrt(x*x+y*y)));
    this.lon = toDegrees(Math.atan2(y, x));
  }

  getRandomName(){
    let names = [];
    if (this.chain.length || this.killed.length){
      let lists = [];
      if (this.chain.length){
        lists.push(this.chain);
      }
      if (this.killed.length){
        lists.push(this.killed);
      }
      let list = lists[Math.floor(Math.random()*lists.length)];
      return list[Math.floor(Math.random()*list.length)].name;
    }
    else{
      return "Jay";
    }
  }

  hasEncountered(user){
    for (let k = 0; k < this.killed.length; k++){
      let kill = this.killed[k];
      if (user.id === kill.id){
        return true;
      }
    }
    for (let c = 0; c < this.chain.length; c++){
      let ch = this.chain[c];
      if (user.id === ch.id){
        return true;
      }
    }
    return false;
  }
}

function toRadians(num){
  return num/360*Math.PI*2;
}

function toDegrees(num){
  return num/(Math.PI*2)*360;
}

exports.It = It;
exports.User = User;
