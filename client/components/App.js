import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import Error from './Error';
import {Link, browserHistory} from 'react-router';
import update from 'react-addons-update';
import uuid from 'node-uuid';
import _ from 'lodash';
import Auth, {SERVER, _fetch, loggedIn} from './Auth';
import mousetrap from 'mousetrap';
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

let hash = {};

const xform = (node, parent) => {
  _(node).defaults({expanded: true, children: []}).assign({parent}).value();
  hash[node.id] = node;
  node.children.forEach(child => xform(child, node));
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
    if (!loggedIn()) {
      return app.setState({error: "You must be logged in to vote"});
    }
    _fetch(`/nodes/${this.state.id}/score/${delta}`, {method: "POST"})
      .then(results => {
        let score = _.get(results, '[0].p.properties.score');
        if (score !== undefined) {
          this.props.row.score = score; // FIXME: not updating parents
          this.setState({score});
        }
      }).catch(onErr)
  };

  showInput = () => {
    if (!loggedIn()) {
      return app.setState({error: "You must be logged in to add content."});
    }
    this.setState({adding: ''});
  };

  add = e => {
    e.preventDefault();
    let body = {
      name: this.state.adding,
      parent: this.props.row.id
    };
    _fetch('/nodes', {body, method: "POST"}).then(body => {
      let xformed = xform(body);
      this.props.row.children = xformed.children; // FIXME
      this.setState({
        children: xformed.children,
        adding: ''
      })
    }).catch(onErr);
  };

  cancelAdd = () => this.setState({adding: null});

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

          <Link className={'name ' + scoreClass} to={'/' + this.props.row.id}>{name}</Link>

          <span className="actions">
            <span>{score}</span>
            <a onClick={() => this.score(1)}>&#9650;</a>
            <a onClick={() => this.score(-1)}>&#9660;</a>
            <a onClick={this.showInput}>Add Child</a>
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
                  onBlur={this.cancelAdd}
                  onKeyDown={e => e.keyCode === 27 && this.cancelAdd()}
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
      this.root = xform(body);
      this.drill();
    }).catch(onErr);
    Mousetrap.bind(['esc'], this.focusSearch);
    Mousetrap.bind(['ctrl+left'], this.goUp);
    Mousetrap.bind(['ctrl+up'], this.goTop);
    //Mousetrap.bind(['esc'], this.kbEsc);
  }

  componentWillUnmount() {
    Mousetrap.unbind(['esc'], this.focusSearch);
    Mousetrap.unbind(['ctrl+left'], this.goUp);
    Mousetrap.unbind(['ctrl+up'], this.goTop);
    //Mousetrap.unbind(['esc'], this.kbEsc);
  }

  focusSearch = () => {
    //let dn = ReactDOM.findDOMNode(this.refs.search);
    let dn = this.refs.search.getInputDOMNode();
    dn.focus();
  };

  goUp = () => browserHistory.push('/' + this.state.drill.parent.id);
  goTop = () => browserHistory.push('/home');

  resetSearch = () => {
    this.setState({search: ''});
    this.onSearch('');
  };

  onSearch = search => {
    this.setState({search});
    this.refs.row.onSearch(search.toLowerCase(), _.noop);
  };

  drill = () => {
    this.setState({drill: hash[this.props.params.nid]});
  }

  componentDidUpdate(prevProps) {
    if (this.props.params.nid !== prevProps.params.nid)
      this.drill()
  }

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
      <div className="app container-fluid">
        <Error error={this.state.error} />

        <Input
          className="search"
          type="text"
          ref="search"
          value={this.state.search}
          placeholder="Search"
          onChange={e => this.onSearch(e.target.value)}
          onKeyDown={e => e.keyCode === 27 && this.resetSearch()}
        />

        <div className="auth">
          <Auth onLogin={()=>this.setState({error:null})} />
        </div>

        {breadCrumbs[0] && (
          <div className="cc-breadcrumbs">
            {breadCrumbs.map((b,i) =>
              <span key={b.id}>
                {i !== 0 && <span> > </span>}
                <Link className='cc-breadcrumb' to={'/' + b.id}>{b.name}</Link>
              </span>
            )}
          </div>
        )}

        <ul style={{paddingLeft:0}}>
          <Row row={drill} key={drill.id} ref="row" />
        </ul>


        <div className="downloads">
          <a href={SERVER + '/nodes/download/' + id + '.json'} target="_blank">Download JSON</a>
        </div>
      </div>
    );
  }
}
