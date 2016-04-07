'use strict';
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const _ = require('lodash');
const nconf = require('nconf');
nconf.argv().env().file({ file: 'config.json' });
const neo4j = require('neo4j');
const async = require('async');
const uuid = require('node-uuid').v4;

//----------------

const db = new neo4j.GraphDatabase(nconf.get("neo4j"));

const defaults = id => `id: ${id === true? `{id}` : `"${id || uuid()}"`}, score: 0, created: {created}`

// FIXME manually constructing a tree, since cypher above is returning a flat list. How to return a tree?
const arrToTree = arr => {
  let home = arr[0].home.properties;
  let nodes = [home].concat(_.map(arr, 'child.properties'));
  nodes = _.uniqBy(nodes, 'id'); // FIXME I'm getting duplicates of nodes, why?
  nodes.forEach(node => {
    let parent = _.find(nodes, {id: node.parent});
    if (parent)
      _.defaults(parent, {children:[]}).children.push(node);
  });
  return home;
};

async.series([

  // Start fresh
  cb => db.cypher({query: `MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r`}, cb),
  //cb => db.cypher({
  //  queries: [
  //    {query: `CREATE INDEX ON :Node(id)`},
  //    {query: `CREATE CONSTRAINT ON (node:Node) ASSERT node.id IS UNIQUE`}
  //  ]
  //}, cb),

  // Create sample nods
  cb => db.cypher({
    query: `
      CREATE (home:Node {name: "Home", ${defaults()}})
      WITH home
      CREATE (skills:Node {name: "Skills", parent: home.id, ${defaults()}})<-[:has]-(home)-[:has]->(states:Node {name: "States", parent: home.id, ${defaults()}})
      WITH skills, states
      CREATE (js:Node {name: "JavaScript", parent: skills.id, ${defaults()}})<-[:has]-(skills)-[:has]->(python:Node {name: "Python", parent: skills.id, ${defaults()}})
      WITH states
      CREATE(ca:Node {name: "California", parent: states.id, ${defaults()}})<-[:has]-(states)-[:has]->(ut:Node {name: "Utah", parent: states.id, ${defaults()}})
    `,
    params: {created: +new Date}
  }, cb),

], (err, results) => {
  if (err) throw err;
});

//----------------

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })); //application/x-www-form-urlencoded
app.use(bodyParser.json()); //application/json

app.get('/nodes', (req, res, next) => {
  db.cypher({
    query: `MATCH (home)-[r*]->(child) RETURN home,r,child`,
  }, (err, results) => {
    if (err) throw err;
    res.json(arrToTree(results));
  })
});

app.post('/node', (req, res, next) => {
  db.cypher({
    query: `
      MATCH (p:Node {id:{parent}})
      WITH p
      CREATE (p)-[:has]->(n:Node {name: {name}, parent: {parent}, ${defaults(true)}})
    `,
    params: _.assign(req.body, {
      //id: uuid(),
      created: +new Date,
    })
  }, (err, result) => {
    if (err) throw err;
    res.send({});
  })
});

app.post('/node/:id/score/:score', (req, res, next) => {
  async.series([
    cb => db.cypher({
      query: `
        MATCH (p:Node {id: {id}})
        SET p.score = p.score + {score}
        RETURN p
      `,
      params: {
        id: req.params.id,
        score: +req.params.score
      }
    }, cb),

    // FIXME delete self & children
    //cb => db.cypher({
    //  query: `
    //    MATCH (p:Node {id: {id}} WHERE p.score < 2
    //    DETACH DELETE n
    //  `
    //}),
  ], (err, results) => {
    if (err) throw err;
    res.send({});
  });
});

app.get('/download/:id.json', (req, res, next) => {
  db.cypher({
    query: `OPTIONAL MATCH (home {id: {id}})-[r*]->(child) RETURN home,r,child`,
    params: {id: req.params.id}
  }, (err, results) => {
    if (err) throw err;
    res.setHeader('Content-disposition', 'attachment; filename=' + results[0].home.properties.name + '.json');
    res.setHeader('Content-type', 'application/json');
    res.json(arrToTree(results));
  })
});

//----------------

app.listen(nconf.get('PORT'), () => {
  console.log('Example app listening on port 3000!');
});