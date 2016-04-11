import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import Error from './Error';
import {Link, browserHistory} from 'react-router';
import update from 'react-addons-update';
import uuid from 'node-uuid';
import _ from 'lodash';
import Auth, {SERVER, _fetch, loggedIn, userId} from './Auth';
import mousetrap from 'mousetrap';
import {
  ButtonGroup,
  Button,
  DropdownButton,
  MenuItem,
  Glyphicon,
  Input,
  Alert
} from 'react-bootstrap';

let app;

const onErr = error => app.setState({error});

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
        if (results && results.deleted) {
          this.props.onChildDeleted(this.state.id);
        }
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

  onChildDeleted = id => {
    let i = _.findIndex(this.state.children, {id});
    this.props.row.children.splice(i, 1);
    return this.setState({children: this.props.row.children});
    //this.setState(update(this.state, {
    //  children: {$splice: [[i, 1]]}
    //}));
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
          <ul className="nodes">
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
              <Row
                row={r}
                key={r.id}
                ref={c => c && this.childRefs.push(c)}
                onChildDeleted={this.onChildDeleted}
              />
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
  };

  comment = e => {
    e.preventDefault();
    _fetch(`/nodes/${this.state.drill.id}/comment`, {method: "POST", body: {comment: this.state.comment}})
      .then(res => {
        // FIXME
        location.reload();
      })
      .catch(onErr);
  };

  save = e => {
    e.preventDefault();
    _fetch(`/nodes/${this.state.drill.id}`, {method: "PUT", body: {
      name: this.state.drill.name,
      description: this.state.drill.description
    }})
      .then(res => {
        // FIXME
        location.reload();
      })
      .catch(onErr);
  };

  componentDidUpdate(prevProps) {
    if (this.props.params.nid !== prevProps.params.nid)
      this.drill()
  }

  render() {
    if (!this.root)
      return null;

    let drill = this.state.drill;
    let {parent, id, user_id, name, description} = drill;
    let mine = +user_id === userId();

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
          <Auth onLogin={() => this.setState({error:null})} />
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

        <div className="row">
          <div className="col-md-6">
            <ul className="nodes" style={{paddingLeft:0}}>
              <Row row={drill} key={drill.id} ref="row" />
            </ul>
          </div>

          <div className="col-md-6 well">
            <div className="downloads">
              <DropdownButton title="Download" id="downloads-dropdown">
                <MenuItem eventKey="1" href={SERVER + '/nodes/download/' + id + '.json'} target="_blank">JSON</MenuItem>
                <MenuItem eventKey="2" disabled>CSV</MenuItem>
                <MenuItem eventKey="2" disabled>YAML</MenuItem>
              </DropdownButton>
            </div>

            {mine ? (
              <div>
                <form onSubmit={this.save}>
                  <Input
                    type="text"
                    value={name}
                    onChange={e => this.setState(update(this.state, {
                      drill: {name: {$set: e.target.value}}
                    }))}
                    placeholder="Name (required)"
                  />
                  <Input
                    type="textarea"
                    value={description}
                    onChange={e => this.setState(update(this.state, {
                      drill: {description: {$set: e.target.value}}
                    }))}
                    placeholder="Description (optional)"
                  />
                  <Button type="submit">Submit</Button>
                </form>
                <hr/>
              </div>
            ) : (
              <div>
                <h4>{drill.name}</h4>
                <p>Description: {drill.description || 'N/A'}</p>
                <ul className="suggest-edits">
                  {drill.suggestions && drill.suggestions.map(s => <li></li>)}
                  <li>
                    {this.state.suggest ? (
                      <Alert bsStyle="warning">
                        Edit suggestions not currently supported, express interest here and I'll jump on it.
                      </Alert>
                    ) : (
                      <a onClick={()=> this.setState({suggest: !this.state.suggest})}>Suggest Edits</a>
                    )}
                  </li>
                </ul>
              </div>
            )}

            <form onSubmit={this.comment}>
              <Input
                type="textarea"
                value={this.state.comment}
                onChange={e => this.setState({comment: e.target.value})}
                placeholder="Comment"
              />
              <Button type="submit">Comment</Button>
            </form>
            <br/>
            {drill.comments && drill.comments.map(c =>
              <p key={c.id}>
                <span className="label label-default">User {c.user_id}</span> {c.comment}
              </p>
            )}

          </div>
        </div>

        <a href="https://github.com/lefnire/cctaxonomy" target="_blank"><img style={{position: 'absolute', top: 0, left: 0, border: 0}} src="https://camo.githubusercontent.com/c6625ac1f3ee0a12250227cf83ce904423abf351/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f6c6566745f677261795f3664366436642e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_left_gray_6d6d6d.png" /></a>
      </div>
    );
  }
}
