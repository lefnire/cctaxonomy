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

app.listen(nconf.get('PORT'), () => {
  console.log('Example app listening on port 3000!');
});