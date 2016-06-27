'use strict';
/*jslint node: true */

let uuid = require('node-uuid');

class User {

}

class It {
  constructor(des){
    if (des){
      this.lat = des.lat;
      this.lon = des.lon;
      this.chain = des.chain;
      this.uuid = des.uuid;
    }
    else{
      this.lat = 40.803333;
      this.lon = -76.341667;
      this.chain = [];//chain of sub values
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
      return this.chain[this.chain.length-1] == user.id;
    }
    else{
      return false;
    }
  }
}

function toRadians(num){
  return num/360*Math.PI*2;
}
