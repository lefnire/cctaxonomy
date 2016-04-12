'use strict';

const passport = require('passport');
const nconf = require('nconf');
const User = require('./db').User;
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

exports.setup = function (app) {
  app.use(passport.initialize());
  passport.use(User.createStrategy());

  var localOpts = {session:false, failWithError:true};
  app.post('/register', function (req, res, next) {
    if (req.body.password != req.body.confirmPassword)
      return next({status: 403, message: 'Password does not match Confirm Password'});

    if (req.body.password.length < 8)
      return next({status: 403, message: 'Password should be at least 8 characters.'});

    User.register({email: req.body.email}, req.body.password, function (err, _user) {
      if (err) return next({status: 403, message: err.message || err});
      passport.authenticate('local', localOpts)(req, res, () => {
        res.json({id: _user.id, token: sign(_user)});
      });
    });
  });

  app.post('/login', passport.authenticate('local', localOpts), function(req, res){
    res.json({id: req.user.id, token: sign(req.user)});
  });
}

var sign = function(user) {
  var u = _.pick(user, ['id', 'email']);
  return jwt.sign(u, nconf.get('secret'), {
    expiresInMinutes: 1440 // expires in 24 hours
  });
}

exports.ensureAuth = function (req, res, next) {
  // check header or url parameters or post parameters for token
  var token = /*req.body.token || req.query.token ||*/ req.headers['x-access-token'];
  if (!token)
    return next({status: 403, message: 'No token provided.'});
  // decode token
  jwt.verify(token, nconf.get('secret'), (err, decoded) => {
    if (err)
      return next({status: 403, message: 'Failed to authenticate token.'});
    // if everything is good, save to request for use in other routes. Note we don't do req.user=decoded, since that
    // contains stale data
    User.findById(decoded.id).then(user => {
      if (user.score < -10)
        return next({code: 403, message: `You've been banned from contributing. Bad!`});

      req.user = user;
      next();
    });
  });
}
