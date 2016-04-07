import React, {Component} from 'react';
import update from 'react-addons-update';
import uuid from 'node-uuid';
import _ from 'lodash';
import data from '../data';
import {
  ButtonGroup,
  Button,
  DropdownButton,
  MenuItem,
  Glyphicon,
  Input
} from 'react-bootstrap';

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
    this.props.row.children.unshift(child); // master data (later this will be POST)
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
    this.root = data; // keep handle on top for nav'ing back
    this.state = {drill: data};
  }

  onDrill = row => {
    this.setState({drill: row})
  };

  render() {
    let {name, children, parent} = this.state.drill;

    let breadCrumbs = [];
    while(parent) {
      breadCrumbs.unshift(parent);
      parent = parent.parent;
    }

    return (
      <div className="app">
        {breadCrumbs.map(b => <a className='cc-breadcrumb' onClick={() => this.onDrill(b)}>{b.name}</a>)}
        <div>
          {name}
          <ul>{children && children.map(r => <Row row={r} key={r.id} />)}</ul>
        </div>
      </div>
    );
  }
}
