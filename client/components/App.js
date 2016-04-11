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

const makeTree = (node, parent) => {
  _(node).defaults({expanded: true, children: []}).assign({parent}).value();
  node.children.forEach(child => makeTree(child, node));
  return node;
};

class Row extends Component {
  constructor() {
    super();
    this.children = [];
    this.state = {
      adding: null,
      searching: false
    };
  }

  componentWillMount() {
    this.setState(this.props.row);
  }

  score = delta => {
    _fetch(`/nodes/${this.state.id}/score/${delta}`, {method: "POST"})
      .then(results => {
        let score = _.get(results, '[0].p.properties.score');
        if (score !== undefined)
          this.setState({score});
      }).catch(onErr)
  };

  add = e => {
    e.preventDefault();
    let body = {
      name: this.state.adding,
      parent: this.props.row.id
    };
    _fetch('/nodes', {body, method: "POST"}).then(body => {
      this.setState({
        children: makeTree(body).children,
        adding: ''
      })
    }).catch(onErr);
  };

  onSearch = (search, cb) => {
    if (search === '') {
      this.setState({searching: false});
      return this.childRefs.forEach(c => c.onSearch(search));
    }
    let found = !!~this.state.name.toLowerCase().indexOf(search);
    this.childRefs.forEach(c => c.onSearch(search, _found => {
      found = found || _found;
    }));
    this.setState({found, searching: true});
    cb(found);
  };

  render() {
    if (!this.props.row) return null;

    let {
      expanded,
      name,
      children,
      score,
      adding,
      searching,
      found
    } = this.state;

    this.childRefs = [];

    let scoreClass = {
      '-1': 'bad',
      '0': 'neutral',
      '1': 'good'
    }[''+ _.clamp(score, -1, 1)];

    return (
      <li style={{display: searching && !found ? 'none': 'inline'}}>
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
            {children.map(r =>
              <Row row={r} key={r.id} ref={c => c && this.childRefs.push(c)} />
            )}
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

  componentWillMount() {
    _fetch('/nodes').then(body => {
      this.root = makeTree(body);
      this.setState({drill: this.root});
    }).catch(onErr);
  }

  onDrill = row => {
    this.setState({drill: row})
  };

  renderSearch = () => {
    return (
      <Input
        type="text"
        ref="search"
        value={this.state.search}
        placeholder="Search"
        onChange={e => {
          let search = e.target.value;
          this.setState({search});
          this.refs.row.onSearch(search.toLowerCase(), _.noop);
        }}
      />
    );
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
        {this.renderSearch()}

        <div className="auth">
          <Auth />
        </div>

        {breadCrumbs.map(b =>
          <a key={b.id} className='cc-breadcrumb' onClick={() => this.onDrill(b)}>{b.name}</a>
        )}

        <ul style={{paddingLeft:0}}>
          <Row row={drill} key={drill.id} ref="row" />
        </ul>

        <div className="downloads">
          <a href={'/download/' + id + '.json'} target="_blank">Download JSON</a>
        </div>
      </div>
    );
  }
}
