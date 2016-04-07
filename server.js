'use strict';
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const _ = require('lodash');
const nconf = require('nconf');
nconf.argv().env().file({ file: 'config.json' });
const Sequelize = require('sequelize');

//----------------

const sequelize = new Sequelize('cctaxonomies', 'lefnire', null, {
  host: 'localhost',
  dialect: 'postgres',
  define:{
    underscored: true,
    freezeTableName:true
  }
});

let Node = sequelize.define('node', {
  text: Sequelize.STRING,
  score: Sequelize.INTEGER,
  //parent: {type: Sequelize.INTEGER, references: {model: Node, key: 'id'}}
});
Node.belongsTo(Node);

sequelize.sync({force:true}).then(() => Node.create({text: 'Skills', score: 1000}))
.then(created => Promise.all([
  Node.create({text: 'Web Development', score: 0, node_id: created.id}),
  Node.create({text: 'Medical', score: 0, node_id: created.id})
])).then(created => Promise.all([
  Node.create({text: 'JavaScript', score: 0, node_id: created[0].id}),
  Node.create({text: 'Billing & Coding', score: 0, node_id: created[1].id}),
]));

//----------------

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })); //application/x-www-form-urlencoded
app.use(bodyParser.json()); //application/json

app.get('/nodes', (req, res, next) => {
  sequelize.query(`
    WITH RECURSIVE all_nodes AS (
      SELECT * FROM node WHERE node_id IS NULL
      UNION ALL
      SELECT parent.*
        FROM node parent
        JOIN all_nodes children ON (parent.id = children.node_id)
    )
    SELECT * FROM all_nodes;
    `, {
    type: sequelize.QueryTypes.SELECT
  }).then(nodes => res.send(nodes));
});

app.post('/node', (req, res, next) => {
  Node.create(req.body).then(res.send({}));
});

app.listen(nconf.get('PORT'), () => {
  console.log('Example app listening on port 3000!');
});

//----------------