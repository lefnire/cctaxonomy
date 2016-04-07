import React, {Component} from 'react';
import update from 'react-addons-update';
import uuid from 'node-uuid';
import _ from 'lodash';
import Auth, {_fetch} from './Auth';
import {
  ButtonGroup,
  Button,
  DropdownButton,
  MenuItem,
  Glyphicon,
  Input
} from 'react-bootstrap';

let app;

const onErr = err => {throw err};

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
    _fetch(`/nodes/${this.state.id}/score/${delta}`, {method: "POST"})
      .then(app.onAjax).catch(onErr)
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
    _fetch('/nodes', {
      method: "POST",
      body: _.assign({}, child, {parent: child.parent.id})
    }).then(app.onAjax).catch(onErr);

    // This conflicts with $unshift below. I'd think $unshift'd be the right way, but the added content gets lost during
    // navigation using that method (where this doesn't). *Shrug*
    this.props.row.children.unshift(child);
    this.setState(update(this.state, {
      //children: {$unshift: [child]},
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
    _fetch('/nodes').then(body => {
      this.root = this.makeTree(body);
      this.setState({drill: this.root});
    }).catch(onErr);
  }

  onDrill = row => {
    this.setState({drill: row})
  };

  // FIXME temporary: refreshing on *anything*
  onAjax = () => {
    //_fetch('/nodes').then(body => {
    //  this.root = this.makeTree(body);
    //  this.setState({
    //    drill: _.find(body, {id: this.state.drill.id})
    //  });
    //})
  };

  render() {
    if (!this.root)
      return null;

    let drill = this.state.drill;
    let {parent, id} = drill;

    let breadCrumbs = [];
    while(parent) {
      breadCrumbs.unshift(parent);
      parent = parent.parent;
    }

    return (
      <div className="app">
        <div className="auth">
          <Auth />
        </div>

        {breadCrumbs.map(b =>
          <a key={b.id} className='cc-breadcrumb' onClick={() => this.onDrill(b)}>{b.name}</a>
        )}

        <ul style={{paddingLeft:0}}><Row row={drill} key={drill.id} /></ul>

        <div className="downloads">
          <a href={'/download/' + id + '.json'} target="_blank">Download JSON</a>
        </div>
      </div>
    );
  }
}
