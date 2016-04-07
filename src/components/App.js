import React, {Component} from 'react';
import update from 'react-addons-update';
import uuid from 'node-uuid';
import _ from 'lodash';
import request from 'superagent';
import {
  ButtonGroup,
  Button,
  DropdownButton,
  MenuItem,
  Glyphicon,
  Input
} from 'react-bootstrap';
const SERVER = 'http://localhost:3000';

let app;

class Row extends Component {
  constructor() {
    super();
    this.state = {
      adding: null
    };
  }

  componentWillMount() {
    this.setState(this.props.row);
  }

  score = delta => {
    request.post(`${SERVER}/node/${this.state.id}/score/${delta}`).end(_.noop);
    this.setState({score: this.state.score + delta});
  };

  add = e => {
    e.preventDefault();
    let child = {
      name: this.state.adding,
      children: [],
      expanded: true,
      score: 0,
      id: uuid.v4(),
      parent: this.props.row
    };
    request.post(SERVER + '/node')
      .send(_.assign({}, child, {parent: child.parent.id}))
      .end((err, res) => {});
    //this.props.row.children.unshift(child); // master data (later this will be POST)
    this.setState(update(this.state, {
      children: {$unshift: [child]},
      adding: {$set: ''}
    }));
  };

  render() {
    if (!this.props.row)
      return null;
    let {
      expanded,
      name,
      children,
      score,
      adding
    } = this.state;
    let scoreClass = {
      '-1': 'bad',
      '0': 'neutral',
      '1': 'good'
    }[''+ _.clamp(score, -1, 1)];

    return (
      <li>
        <div className="contents">

          <span className="expander">
            {!children.length? null : expanded ? (
              <a onClick={() => this.setState({expanded: false})}>-</a>
            ) : (
              <a onClick={() => this.setState({expanded:true})}>+</a>
            )}
          </span>

          <span className={'name ' + scoreClass} onClick={() => app.onDrill(this.props.row)}>{name}</span>

          <span className="actions">
            <span>{score}</span>
            <a onClick={() => this.score(1)}>&#9650;</a>
            <a onClick={() => this.score(-1)}>&#9660;</a>
            <a onClick={() => this.setState({adding: ''})}>Add Child</a>
          </span>
        </div>

        {expanded && children && (
          <ul>
            {adding !== null && (
              <form onSubmit={this.add}>
                <Input
                  type="text"
                  ref="add"
                  autoFocus
                  value={this.state.adding}
                  placeholder="Enter text"
                  onChange={e => this.setState({adding: e.target.value})}
                  onBlur={e => this.setState({adding: null})}
                />
              </form>
            )}
            {children.map(r => <Row row={r} key={r.id} />)}
          </ul>
        )}
      </li>
    );
  }
}

export default class App extends Component {
  constructor() {
    super();
    app = this;
  }

  makeTree = (node, parent) => {
    _(node).defaults({expanded: true, children: []}).assign({parent}).value();
    node.children.forEach(child => this.makeTree(child, node));
    return node;
  };

  componentWillMount() {
    request.get(SERVER + '/nodes').end((err, res) => {
      this.root = this.makeTree(res.body);
      this.setState({drill: this.root});
    });
  }

  onDrill = row => {
    this.setState({drill: row})
  };

  render() {
    if (!this.root)
      return null;

    let drill = this.state.drill;
    let {name, children, parent, id} = drill;

    let breadCrumbs = [];
    while(parent) {
      breadCrumbs.unshift(parent);
      parent = parent.parent;
    }

    return (
      <div className="app">
        {breadCrumbs.map(b => <a className='cc-breadcrumb' onClick={() => this.onDrill(b)}>{b.name}</a>)}

        <ul style={{paddingLeft:0}}><Row row={drill} key={drill.id} /></ul>

        <div className="downloads">
          <a href={SERVER + '/download/' + id + '.json'} target="_blank">Download JSON</a>
        </div>
      </div>
    );
  }
}
