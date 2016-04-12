'use strict';
const async = require('async');
const uuid = require('node-uuid').v4;
const neo4j = require('neo4j');
const Sequelize = require('sequelize');
const nconf = require('nconf');
const _ = require('lodash');
const pg = nconf.get("postgres");
const passportLocalSequelize = require('passport-local-sequelize');
const WIPE = nconf.get('WIPE');

// ------ Sequelize --------
const sequelize = new Sequelize(pg.database, pg.username, pg.password, {
  host: pg.host,
  dialect: 'postgres',
  logging: false,
  define:{
    underscored: true,
    freezeTableName:true
  }
});

let defaultUserSchema = passportLocalSequelize.defaultUserSchema;
delete defaultUserSchema.username;
let User = sequelize.define('users', _.defaults({
  email: {type:Sequelize.STRING, validate:{ isEmail:true }, unique:true, allowNull:false},
}, defaultUserSchema));
passportLocalSequelize.attachToUser(User, {
  usernameField: 'email',
  usernameLowerCase: true,
  //activationRequired: true
});

// Controls only one vote per person
let Vote = sequelize.define('votes', {
  score: {type: Sequelize.INTEGER, allowNull: true, min: -1, max: 1},
  node_id: Sequelize.UUID
}, {
  indexes: [{unique: true, fields: ['node_id', 'user_id']}]
});

User.hasMany(Vote);
Vote.belongsTo(User);

sequelize.sync(WIPE? {force: true} : null);

// ------ Neo4j --------
const neo = new neo4j.GraphDatabase(nconf.get("neo4j"));


// FIXME manually constructing a tree, since cypher above is returning a flat list. How to return a tree?
const arrToTree = arr => {
  let parent = arr[0].parent.properties;
  let nodes = [parent].concat(_.map(arr, 'child.properties'));
  nodes = _.uniqBy(nodes, 'uuid'); // FIXME I'm getting duplicates of nodes, why?
  nodes.forEach(node => {
    let parent = _.find(nodes, {uuid: node.parent});
    if (parent) {
      if (node.comment) {
        _.defaults(parent, {comments: []}).comments.push(node)
        parent.comments.sort((a,b) => b.created - a.created);

      } else {
        _.defaults(parent, {children:[]}).children.push(node);
        parent.children.sort((a,b) => b.created - a.created);
      }
    }
  });
  return parent;
};

if (WIPE) {
  const defaults = (_uuid) => `uuid: "${_uuid || uuid()}", score: 1, created: {created}`
  async.series([

    // Start fresh
    cb => neo.cypher({query: `MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r`}, cb),
    //cb => neo.cypher({
    //  queries: [
    //    {query: `CREATE INDEX ON :Node(uuid)`},
    //    {query: `CREATE CONSTRAINT ON (node:Node) ASSERT node.uuid IS UNIQUE`}
    //  ]
    //}, cb),

    // Create sample nods
    cb => neo.cypher({
      query: `
      CREATE (home:Node {name: "Home", ${defaults('home')}})
      WITH home
      CREATE (skills:Node {name: "Skills", parent: home.uuid, ${defaults()}})<-[:has]-(home)-[:has]->(states:Node {name: "States", parent: home.uuid, ${defaults()}})
      WITH skills, states
      CREATE (js:Node {name: "JavaScript", parent: skills.uuid, ${defaults()}})<-[:has]-(skills)-[:has]->(python:Node {name: "Python", parent: skills.uuid, ${defaults()}})
      WITH states
      CREATE(ca:Node {name: "California", parent: states.uuid, ${defaults()}})<-[:has]-(states)-[:has]->(ut:Node {name: "Utah", parent: states.uuid, ${defaults()}})
    `,
      params: {created: +new Date}
    }, cb),

  ], (err, results) => {
    if (err) throw err;
  });
}

module.exports = {
  arrToTree,
  User,
  Vote,
  neo,
  sequelize
};