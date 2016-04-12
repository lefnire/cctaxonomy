'use strict';
const async = require('async');
const uuid = require('node-uuid').v4;
const db = require('./db');
const ensureAuth = require('./passport').ensureAuth;
const router = require('express').Router();
const _ = require('lodash');

const recurse = () => {
  //http://stackoverflow.com/a/34259344/362790
  sequelize.query(`
    WITH RECURSIVE cte AS (
       SELECT id, node_id, name, NULL::JSON AS children
       FROM nodes p
       WHERE NOT EXISTS ( -- only leaf nodes; see link below
          SELECT 1 FROM nodes
          WHERE node_id = p.id
       )
       UNION ALL
       SELECT p.id, p.node_id, p.name, row_to_json(c) AS children
       FROM cte c
       JOIN nodes p ON p.id = c.node_id
    )
    SELECT id, name, json_agg(children) AS children
    FROM cte
    WHERE id = 1
    GROUP BY 1, 2
  `, {type: Sequelize.QueryTypes.SELECT})
}

// FIXME manually constructing a tree, can't get above query working
const buildTree = (nodes, comments, root_id) => {
  let root;
  let _nodes = {}; // = _.keyBy(nodes, 'id');
  nodes.forEach(n => _nodes[n.id] = _.defaults(n, {children: [], comments: []}));
  nodes.forEach(n => {
    let parent = _nodes[n.node_id];
    if (parent) {
      parent.children.push(n);
      parent.children.sort((a,b) => b.created_at - a.created_at);
    } else {
      root = n; //root ? _.concat(root, n) : n;
    }
    n.comments = _.filter(comments, {node_id: n.id}).sort((a,b) => b.created_at - a.created_at);
  });
  return root_id ? _nodes[root_id] : root;
};

router.get('/', (req, res, next) => {
  //FIXME optimize this based on their route
  Promise.all([
    db.Node.findAll({where: {deleted: false}, raw: true}),
    db.Comment.findAll({raw: true})
  ]).then(vals => {
    let root = buildTree(vals[0], vals[1], 1);
    res.json(root);
  }).catch(next);
});

router.post('/', ensureAuth, (req, res, next) => {
  let user_id = req.user.id,
    node_id = req.body.parent,
    name = req.body.name;
  if (_.isEmpty(name))
    throw {code: 400, message: 'Name cannot be empty'};

  db.Node.find({where: {node_id, name: {$iLike: name}}})
    .then(found => {
      if (found)
        throw {code: 400, message: 'Node already exists with that name at this level'};
      return db.Vote.create({user_id, node_id});
    })
    .then(() => db.Node.create({user_id, node_id, name}))
    .then(() => Promise.all([
      db.Node.findAll({where: {/*node_id, */deleted: false}, raw: true}),
      db.Comment.findAll({/*where: {node_id}, */raw: true})
    ]))
    .then(vals => res.json(buildTree(vals[0], vals[1], node_id)))
    .catch(next);
});

router.post('/:id/score/:score', ensureAuth, (req, res, next) => {
  let score = +req.params.score,
    node_id = req.params.id,
    user_id = req.user.id;
  if (node_id === 'home')
    return next({code: 400, message: "Nice try."});

  db.Vote.findOne({where: {user_id, node_id}}).then(found => {
    // Already voted
    if (found) {
      if (found.score === score && user_id !== 1) throw 'ok'; // already voted this direction
      else if (found.score === 0) found.score = score; // previously cancelled, now let them score
      else found.score = 0; // Going the other direction. Cancel the vote
      return found.save();
    }
    // Haven't scored this node yet
    return db.Vote.create({user_id, node_id, score});
  })
  .then(() => db.sequelize.query(`UPDATE nodes SET score = score + :score WHERE id = :node_id RETURNING *`, {
    replacements: {score, node_id}
  }))
  .then(ret => {
    let node = ret[0][0];

    // Downvote that user, too. Too many marks and they're banned
    db.sequelize.query(`UPDATE users SET score = score + :score WHERE id = :id`, {
      replacements: {score, id: node.user_id}
    }).then(_.noop);

    if (node.score > -5) {
      return res.json(node);
    }

    // Detach the node; don't delete (in case there's a complaint)
    return db.sequelize.query(`UPDATE nodes SET deleted = true WHERE id = :id`, {
      replacements: {id: node.id}
    }).then(() => res.json({deleted: true}));
  }).catch(err => {
    if (err === 'ok') return res.json({});
    next(err);
  })
});

router.get('/download/:id.json', (req, res, next) => {
  db.Node.findAll({deleted: false, raw: true}).then(nodes => {
    let tree = buildTree(nodes, [], req.params.id);
    res.setHeader('Content-disposition', 'attachment; filename=' + tree.name + '.json');
    res.setHeader('Content-type', 'application/json');
    res.json(tree);
  }).catch(next);
});

router.post('/:id/comment', ensureAuth, (req, res, next) => {
  db.Comment.create({
    node_id: req.params.id,
    user_id: req.user.id,
    comment: req.body.comment
  }).then(created => res.json(created)).catch(next);
});

router.put('/:id', ensureAuth, (req, res, next) => {
  if (!req.body.name)
    return next({code: 400, message: "Name required"});
  db.Node.update(req.body, {
    where: {id: req.params.id, user_id: req.user.id},
    returning: true
  }).then((updated,b,c) => res.json(updated)).catch(next);
});

module.exports = router;