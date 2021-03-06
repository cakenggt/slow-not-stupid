'use strict';
/*jshint expr: true*/
/*jslint node: true */
/*jslint mocha: true*/

var expect = require('chai').expect;
var classes = require('./classes');

describe('class tests', function(){
  it('it movement', function(){
    let it = new classes.It();
    let user = {lat: 0, lon: 0};
    let d1 = it.getDistanceToUser(user);
    it.moveTowards(user);
    expect(d1).to.be.gt(it.getDistanceToUser(user));
  });
  it('it random name', function(){
    let it = new classes.It();
    it.killed.push({name: "Jerry"});
    it.chain.push({name: "Ben"});
    expect(it.getRandomName()).to.not.be.empty;
  });
  it('it following', function(){
    let it = new classes.It();
    it.chain.push({
      id: 'a',
      name: 'a name',
      time: new Date().getTime()
    });
    expect(it.isFollowing({id: 'a'})).to.be.true;
  });
  it('it encounter', function(){
    let it = new classes.It();
    it.chain.push({
      id: 'a',
      name: 'a name',
      time: new Date().getTime()
    });
    expect(it.hasEncountered({id: 'a'})).to.be.true;
  });
});
