'use strict';
const nconf = require('nconf');
nconf.argv().env().file({ file: 'config.json' });
require('./db');
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const _ = require('lodash');
const routes = require('./routes');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })); //application/x-www-form-urlencoded
app.use(bodyParser.json()); //application/json

app.use('/nodes', routes);
require('./passport').setup(app);

// error handler
app.use((err, req, res, next) => {
  console.log(err);
  if (err.name == 'AuthenticationError') // Passport just gives us "Unauthorized", not sure how to get specifics
    err = {status:401, message: "Login failed, please check email address or password and try again."};
  res.status(err.status || 500).json({message: err.message || err});
});

app.listen(nconf.get('PORT'), () => {
  console.log('Example app listening on port 3000!');
});