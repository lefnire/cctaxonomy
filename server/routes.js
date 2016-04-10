'use strict';
const async = require('async');
const uuid = require('node-uuid').v4;
const db = require('./db');
const neo = db.neo;
const ensureAuth = require('./passport').ensureAuth;
const router = require('express').Router();
const _ = require('lodash');

router.get('/', (req, res, next) => {
  neo.cypher({
    query: `MATCH (home)-[r*]->(child) RETURN home,r,child`,
  }, (err, results) => {
    if (err) throw err;
    res.json(db.arrToTree(results));
  })
});

router.post('/', ensureAuth, (req, res, next) => {
  neo.cypher({
    query: `
    MATCH (p:Node {id:{parent}})
    WITH p
    CREATE (p)-[:has]->(n:Node {name: {name}, parent: {parent}, ${db.defaults(true)}})
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

router.post('/:id/score/:score', ensureAuth, (req, res, next) => {
  let score = +req.params.score,
    node_id = req.params.id,
    user_id = req.user.id;
  async.waterfall([
    cb => db.Vote.findOne({where: {user_id, node_id}}).then(found => {
      // Already voted
      if (found) {
        if (found.score === score) return cb('ok'); // already voted this direction
        else if (found.score === 0) found.score = score; // previously cancelled, now let them score
        else found.score = 0; // Going the other direction. Cancel the vote
        return found.save().then(() => cb()).catch(cb);
      }
      // Haven't scored this node yet
      db.Vote.create({user_id, node_id, score}).then(() => cb()).catch(cb);
    }),
    cb => neo.cypher({
      query: `
        MATCH (p:Node {id: {node_id}})
        SET p.score = p.score + {score}
        RETURN p
      `,
      params: {score, node_id}
    }, cb),

    //FIXME Delete self & children (see http://goo.gl/uND3gA)
    //cb => neo.cypher({
    //  query:
    //    `MATCH (p:Node) WHERE p.score < 2
    //    OPTIONAL MATCH p-[r*]->x
    //    DELETE r,x`
    //    //`MATCH n WHERE n.score < 2 WITH n
    //    //MATCH (n)-[r]-x-[ss*0..]->y
    //    //WHERE NOT r IN ss
    //    //OPTIONAL MATCH n-[t]->()
    //    //FOREACH (s IN ss | DELETE s)
    //    //DELETE r,y,t,n`
    //}, cb),
  ], (err, results) => {
    if (err && err !== 'ok') throw err;
    res.send(results || {});
  });
});

router.get('/download/:id.json', (req, res, next) => {
  neo.cypher({
    query: `OPTIONAL MATCH (home {id: {id}})-[r*]->(child) RETURN home,r,child`,
    params: {id: req.params.id}
  }, (err, results) => {
    if (err) throw err;
    res.setHeader('Content-disposition', 'attachment; filename=' + results[0].home.properties.name + '.json');
    res.setHeader('Content-type', 'application/json');
    res.json(db.arrToTree(results));
  })
});

module.exports = router;