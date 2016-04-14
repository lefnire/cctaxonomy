import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import Error from './Error';
import {Link, browserHistory} from 'react-router';
import update from 'react-addons-update';
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
  Alert,
  Modal
} from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

let app;

const onErr = error => app.setState({error});

let hash = {};

const xform = (node, parent) => {
  _(node).defaults({expanded: true, children: []}).assign({parent}).value();
  hash[node.id] = node;
  if (/*!parent*/ node.id === 1) hash['home'] = node;
  node.children.forEach(child => xform(child, node));
  return node;
};

let warningShown = localStorage.getItem('warningShown');
class VoteWarning extends React.Component {
  constructor() {
    super();
    this.state = {show: false};
  }
  close = () => {
    this.setState({show: false});
    setTimeout(() => localStorage.setItem('warningShown', true));
    warningShown = true;
  };
  open = () => this.setState({show: true});

  render() {
    return (
      <Modal modal={true} show={this.state.show} onHide={this.close}>
        <Modal.Body>
          <p>Careful with downvotes; they're meant for <b>inappropriate</b> content. (eg, some punk kid added <em>penis</em>; or <em>Iceland</em> is inside <em>USA</em>). When a tag gets sufficiently downvoted, it and its children disappear. It's a moderation tool rather than a liking tool.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.close}>Got it</Button>
        </Modal.Footer>
      </Modal>
    );
  }
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
    if (delta < 0 && !warningShown)
      return app.refs.voteWarning.open();
    _fetch(`/nodes/${this.state.id}/score/${delta}`, {method: "POST"})
      .then(body => {
        if (_.isEmpty(body)) return;
        if (body.deleted)
          return this.props.onChildDeleted(this.state.id);
        let score = body.score;
        this.props.row.score = score; // FIXME: not updating parents
        this.setState({score});
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

class Sidebar extends Component {
  componentWillMount() {
    this.setState(this.props.row);
  }

  comment = e => {
    e.preventDefault();
    let {id, comment} = this.state;
    _fetch(`/nodes/${id}/comment`, {method: "POST", body: {comment}})
      .then(res => {
        // FIXME
        location.reload();
      })
      .catch(onErr);
  };

  save = e => {
    e.preventDefault();
    let {id, name, description} = this.state;
    _fetch(`/nodes/${id}`, {method: "PUT", body: {name, description}})
      .then(res => {
        // FIXME
        location.reload();
      })
      .catch(onErr);
  };

  render() {
    if (!this.state)
      return null;
    let {
      id, name, description, user_id, comments, // from row
      comment, showSuggest // local state
    } = this.state;
    let mine = user_id && +user_id === userId();
    let isHome = id === 1;
    let suggestions = []; // TODO
    return (
      <div className="well" style={{position:'relative'}}>
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
                onChange={e => this.setState({name: e.target.value})}
                placeholder="Name (required)"
              />
              <Input
                type="textarea"
                value={description}
                onChange={e => this.setState({description: e.target.value})}
                placeholder="Description (optional)"
              />
              <Button type="submit">Submit</Button>
            </form>
            <hr/>
          </div>
        ) : (
          <div>
            <h4>{isHome ? 'Creative Commons Taxonomy' : name}</h4>
            <div>{description ?  <ReactMarkdown source={description} />
              : isHome ? (
                <div>
                  <p>A project for building lists of things to be used in developer projects. Think of those times you need data: countries to cities, professional industries and their skills, insurance companies and their plans. Sourcing data across the internet lands you gobs of CSVs; JSON & XML APIs (some costing an arm and a leg!); copy-pasta from Wikipedia...</p>
                  <p>With CC-Taxonomy, anyone can add a list (say <em>JS Frameworks</em> and its children). The community can add items, vote on items (aka relevant / appropriate), comment, and suggest edits. Importantly, you can download any list's latest in <a href="https://github.com/lefnire/cctaxonomy/issues/3" target="_blank">various formats</a></p>
                  <p>If interested, make an appearance: <a href="https://github.com/lefnire/cctaxonomy" target="_blank">fork the repo</a> and <a href="https://news.ycombinator.com/item?id=11488734" target="_blank">upvote on HN</a>!</p>
                  <hr/>
                  <p>
                    <small>Interface inspired by <a href="https://workflowy.com" target="_blank">Workflowy</a>; check them out, they rock.</small>
                  </p>
                  <iframe style={{border:'none'}} src="https://ghbtns.com/github-btn.html?user=lefnire&repo=cctaxonomy&type=fork&count=true&size=large" frameborder="0" scrolling="0" width="158px" height="30px"></iframe>
                </div>
              ) : <p>Description N/A</p>
            }</div>
            {!isHome && (
              <ul className="suggest-edits">
                {suggestions.map(s => <li></li>)}
                <li>
                  {showSuggest ? (
                    <Alert bsStyle="warning">
                      "Suggested edits" not currently supported, <a href="https://github.com/lefnire/cctaxonomy/issues/1" target="_blank">express interest here</a>.
                    </Alert>
                  ) : (
                    <a onClick={()=> this.setState({showSuggest: !showSuggest})}>Suggest Edits</a>
                  )}
                </li>
              </ul>
            )}
          </div>
        )}

        <form onSubmit={this.comment}>
          <Input
            type="textarea"
            value={comment}
            onChange={e => this.setState({comment: e.target.value})}
            placeholder="Comment"
          />
          <Button type="submit">Comment</Button>
        </form>
        <br/>
        {comments && comments.map(c =>
          <p key={c.id}>
            <span className="label label-default">User {c.user_id}</span> {c.comment}
          </p>
        )}
      </div>
    );

  }
}

export default class App extends Component {
  constructor() {
    super();
    this.state = {loading: true};
    app = this;
  }

  componentWillMount() {
    _fetch('/nodes').then(body => {
      this.setState({loading: false});
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
    this.setState({drill: hash[this.props.params.id]});
  };


  componentDidUpdate(prevProps) {
    if (this.props.params.id !== prevProps.params.id)
      this.drill()
  }

  render() {
    let {drill, loading} = this.state;

    if (loading || !drill) {
      return (
        <div>
          <Modal modal={true} backdrop={true} animation={false} show={true}>
            <Modal.Body><h4>Waking server, one moment...</h4></Modal.Body>
          </Modal>
        </div>
      );
    }

    let {parent} = drill;
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

          <div className="col-md-6">
            <Sidebar row={drill} key={drill.id} />
          </div>
        </div>

        <VoteWarning ref="voteWarning" />

        {/*<a href="https://github.com/lefnire/cctaxonomy" target="_blank"><img style={{position: 'absolute', top: 0, left: 0, border: 0}} src="https://camo.githubusercontent.com/c6625ac1f3ee0a12250227cf83ce904423abf351/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f6c6566745f677261795f3664366436642e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_left_gray_6d6d6d.png" /></a>*/}
      </div>
    );
  }
}
