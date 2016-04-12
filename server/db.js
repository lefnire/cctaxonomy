'use strict';
const async = require('async');
const uuid = require('node-uuid').v4;
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
  // If user content gets downvoted all the time, they're banned
  score: {type: Sequelize.INTEGER, allowNull: false, defaultValue: 1}
}, defaultUserSchema));
passportLocalSequelize.attachToUser(User, {
  usernameField: 'email',
  usernameLowerCase: true,
  //activationRequired: true
});

// http://stackoverflow.com/questions/34125090/reverse-aggregation-inside-of-common-table-expression
let Node = sequelize.define('nodes', {
  name: {type: Sequelize.STRING, allowNull: false},
  description: Sequelize.STRING,
  score: {type: Sequelize.INTEGER, allowNull: false, defaultValue: 1},
  deleted: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false}
});
Node.hasMany(Node);
Node.belongsTo(Node);
User.hasMany(Node);
Node.belongsTo(User);

// Controls only one vote per person
let Vote = sequelize.define('votes', {
  score: {type: Sequelize.INTEGER, allowNull: true, min: -1, max: 1},
}, {
  indexes: [{unique: true, fields: ['id', 'user_id']}]
});
User.hasMany(Vote);
Vote.belongsTo(User);
Node.hasMany(Vote);
Vote.belongsTo(Node);

let Comment = sequelize.define('comments', {
  comment: Sequelize.TEXT
});
Node.hasMany(Comment)
Comment.belongsTo(Node);
User.hasMany(Comment);
Comment.belongsTo(User);


if (WIPE) {
  sequelize.sync({force: true}).then(() => Node.create({name: 'Home'}))
    .then(created => Promise.all([
      Node.create({name: 'Skills', node_id: created.id}),
      Node.create({name: 'States', node_id: created.id})
    ]))
    .then(res => Promise.all([
      Node.create({name: 'JavaScript', node_id: res[0].id}),
      Node.create({name: 'Python', node_id: res[0].id}),
      Node.create({name: 'CA', node_id: res[1].id}),
      Node.create({name: 'MA', node_id: res[1].id}),
    ]))
}


module.exports = {
  User,
  Vote,
  Comment,
  Node,
  sequelize
};