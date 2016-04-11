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
    query: `MATCH (parent)-[r*0..20]->(child) RETURN parent,r,child`,
  }, (err, results) => {
    if (err) return next(err);
    res.json(db.arrToTree(results));
  })
});

router.post('/', ensureAuth, (req, res, next) => {
  let user_id = req.user.id,
    node_id = uuid();
  async.parallel([
    cb => db.Vote.create({user_id, node_id, score: 1}).then(() => cb()).catch(cb),
    cb => neo.cypher({
      query: `
      MATCH (parent:Node {id: {parent}})
      WITH parent
      CREATE (parent)-[:node]->(n:Node {
        name: {name},
        parent: {parent},
        user_id: {user_id},
        ${db.defaults(true)}
      })
      WITH parent MATCH (parent)-[r*0..]->(child)
      RETURN parent,r,child
    `,
      params: _.defaults(req.body, {
        id: node_id,
        created: +new Date,
        user_id
      })
    }, cb)
  ], (err, results) => {
    if (err) return next(err);
    res.send(db.arrToTree(results[1]));
  })
});

router.post('/:id/score/:score', ensureAuth, (req, res, next) => {
  let score = +req.params.score,
    node_id = req.params.id,
    user_id = req.user.id,
    deleted;
  if (node_id === 'home') {
    return next({code: 400, message: "Nice try."});
  }
  async.waterfall([
    cb => db.Vote.findOne({where: {user_id, node_id}}).then(found => {
      // Already voted
      if (found) {
        if (found.score === score && user_id !== 1) return cb('ok'); // already voted this direction
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

    // If it's been down=voted to hell, we remove it and all its children
    (results, cb) => {
      let score = _.get(results, '[0].p.properties.score');
      if (score > -5)
        return cb(null, results);
      deleted = true;
      neo.cypher({
        query: `MATCH (p:Node {id:{node_id}})-[r*0..]->c DETACH DELETE p, c`,
        params: {node_id}
      }, cb)
    },
  ], (err, results) => {
    if (err && err !== 'ok') return next(err);
    res.send(
      deleted? {deleted: true}
      : results || {}
    );
  });
});

router.get('/download/:id.json', (req, res, next) => {
  neo.cypher({
    query: `MATCH (parent {id: {id}})-[r*0..]->(child) RETURN parent,r,child`,
    params: {id: req.params.id}
  }, (err, results) => {
    if (err) return next(err);
    res.setHeader('Content-disposition', 'attachment; filename=' + results[0].parent.properties.name + '.json');
    res.setHeader('Content-type', 'application/json');
    res.json(db.arrToTree(results));
  })
});

router.post('/:id/comment', ensureAuth, (req, res, next) => {
  neo.cypher({
    query: `
      MATCH (p:Node {id: {id}})
      CREATE (p)-[:comment]->(c:Comment {
        id: {uuid},
        parent: {id},
        user_id: {user_id},
        comment: {comment},
        created: {created}
      })
     return p, c
    `,
    params: {
      uuid: uuid(),
      id: req.params.id,
      user_id: req.user.id,
      comment: req.body.comment,
      created: +new Date // this will be used for sorting
    }
  }, (err, results) => {
    if (err) return next(err);
    res.send(results || {});
  });
});

router.put('/:id', ensureAuth, (req, res, next) => {
  if (!req.body.name)
    return next({code: 400, message: "Name required"});
  neo.cypher({
    query: `
      MATCH (p:Node {id: {id}, user_id: {user_id}})
      SET p += {name: {name}, description: {description}}
      RETURN p
    `,
    params: {
      id: req.params.id,
      user_id: req.user.id,
      name: req.body.name,
      description: req.body.description
    }
  }, (err, results) => {
    if (err) return next(err);
    res.send(results || {});
  })
});

module.exports = router;