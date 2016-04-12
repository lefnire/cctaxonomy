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
    node_id = uuid(),
    parent = req.body.parent,
    name = req.body.name;

  if (_.isEmpty(name))
    return next({code: 400, message: 'Name cannot be empty'});

  async.waterfall([

    // Make sure not to create same name on same level
    cb => neo.cypher({
      query: `
        MATCH (parent:Node {uuid: {parent}})-[r]->(child:Node)
        WHERE child.name =~ {regex}
        RETURN child`,
      params: {parent, regex: '(?i)' + name}
    }, cb),

    (results, cb) => {
      if (results[0])
        return cb({code:400, message: 'Node already exists with that name at this level'});
      cb();
    } ,

    async.apply(async.parallel, [
      cb => db.Vote.create({user_id, node_id, score: 1}).then(() => cb()).catch(cb),
      cb => neo.cypher({
        query: `
          MATCH (parent:Node {uuid: {parent}})
          WITH parent
          CREATE (parent)-[:node]->(n:Node {
            name: {name},
            parent: {parent},
            user_id: {user_id},
            uuid: {uuid},
            score: 1,
            created: {created}
          })
          WITH parent MATCH (parent)-[r*0..]->(child)
          RETURN parent,r,child
        `,
        params: {parent, name, user_id, uuid: uuid(), created: +new Date}
      }, cb)
    ])
  ], (err, results) => {
    if (err) return next(err);
    res.send(db.arrToTree(results[1]));
  })
});

router.post('/:uuid/score/:score', ensureAuth, (req, res, next) => {
  let score = +req.params.score,
    node_id = req.params.uuid,
    user_id = req.user.id,
    deleted;
  if (node_id === 'home')
    return next({code: 400, message: "Nice try."});

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
        MATCH (p:Node {uuid: {node_id}})
        SET p.score = p.score + {score}
        RETURN p
      `,
      params: {score, node_id}
    }, cb),

    // If it's been down=voted to hell, we remove it and all its children
    (results, cb) => {

      // Downvote that user, too. Too many marks and they're banned
      db.sequelize.query(`UPDATE users SET score = score + :score WHERE id = :id`, {
        replacements: {score, id: _.get(results, '[0].p.properties.user_id')}
      }).then(_.noop);

      let _score = _.get(results, '[0].p.properties.score');
      if (_score > -5)
        return cb(null, results);
      deleted = true;
      neo.cypher({
        query: `MATCH (p:Node {uuid:{node_id}})-[r*0..]->c DETACH DELETE p, c`,
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

router.get('/download/:uuid.json', (req, res, next) => {
  neo.cypher({
    query: `MATCH (parent {uuid: {uuid}})-[r*0..]->(child) RETURN parent,r,child`,
    params: {uuid: req.params.uuid}
  }, (err, results) => {
    if (err) return next(err);
    res.setHeader('Content-disposition', 'attachment; filename=' + results[0].parent.properties.name + '.json');
    res.setHeader('Content-type', 'application/json');
    res.json(db.arrToTree(results));
  })
});

router.post('/:uuid/comment', ensureAuth, (req, res, next) => {
  neo.cypher({
    query: `
      MATCH (p:Node {uuid: {uuid}})
      CREATE (p)-[:comment]->(c:Comment {
        uuid: {cid},
        parent: {uuid},
        user_id: {user_id},
        comment: {comment},
        created: {created}
      })
     return p, c
    `,
    params: {
      cid: uuid(),
      uuid: req.params.uuid,
      user_id: req.user.id,
      comment: req.body.comment,
      created: +new Date // this will be used for sorting
    }
  }, (err, results) => {
    if (err) return next(err);
    res.send(results || {});
  });
});

router.put('/:uuid', ensureAuth, (req, res, next) => {
  if (!req.body.name)
    return next({code: 400, message: "Name required"});
  neo.cypher({
    query: `
      MATCH (p:Node {uuid: {uuid}, user_id: {user_id}})
      SET p += {name: {name}, description: {description}}
      RETURN p
    `,
    params: {
      uuid: req.params.uuid,
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