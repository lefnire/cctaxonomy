import React, {Component} from 'react';
import Error from './Error';
import {
  Input,
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import fetch from 'isomorphic-fetch';
export const SERVER = "<nconf:server>";

// ----- Helper bits ------
let [jwt, uid] = [localStorage.getItem('jwt'), localStorage.getItem('uid')];

export function login(body) {
  [jwt, uid] = [body.token, body.id];
  localStorage.setItem('jwt', jwt);
  localStorage.setItem('uid', uid);
  let d = new Date();
  window.localStorage.setItem('expire', d.setDate(d.getDate() + 30)); // expire token in 30d
}

export function logout() {
  localStorage.clear();
  location.reload();
}

export let loggedIn = () => !!jwt;
export let userId = () => +uid;

// Handle initial "still logged in?" check on page load
let expire = localStorage.getItem('expire');
if (expire && expire < new Date)
  logout(); // expired, log out


export function _fetch(url, opts={}) {
  opts = _.merge({headers: {'Accept': 'application/json', 'Content-Type': 'application/json'}}, opts);
  if (jwt) opts.headers['x-access-token'] = jwt;
  if (opts.body) opts.body = JSON.stringify(opts.body);
  return fetch(SERVER + url, opts)
    .then(response => {
      // If client gets an "unauthorized" response while logged in, log them out.
      if (response.status === 403 && jwt)
        return logout();
      if (_.inRange(response.status, 200, 300)) {
        // NOTE response.json() fails when there's no body, figure work-around
        return response.json();
      } else {
        return response.json().then(json => Promise.reject({response, json}));
      }
    });
}

// ----- /Helper bits ------


class Register extends Component {
  constructor() {
    super();
    this.state = {};
  }

  submit = e => {
    e.preventDefault();
    if (this.state.loading) return;
    this.setState({loading: true});
    _fetch('/register', {method: 'POST', body: this.state})
      .then(body => {
        this.setState({loading: false});
        this.props.onLogin(body);
      }).catch(error => this.setState({error, loading: false}));
  };

  render() {
    return (
      <form onSubmit={this.submit}>
        <Error error={this.state.error} />
        <Input
          type="email"
          value={this.state.email}
          placeholder="Email"
          onChange={e => this.setState({email: e.target.value})}
        />
        <Input
          type="password"
          value={this.state.password}
          placeholder="Password"
          onChange={e => this.setState({password: e.target.value})}
        />
        <Input
          type="password"
          value={this.state.confirmPassword}
          placeholder="Confirm Password"
          onChange={e => this.setState({confirmPassword: e.target.value})}
        />
        <Button type="submit" disabled={this.state.loading}>Submit</Button>
      </form>
    );
  }
}

class Login extends Component {
  constructor() {
    super();
    this.state = {};
  }

  submit = e => {
    e.preventDefault();
    if (this.state.loading) return;
    this.setState({loading: true});
    _fetch('/login', {method: "POST", body: this.state})
      .then(body => {
        this.setState({loading: false});
        this.props.onLogin(body);
      }).catch(error => this.setState({error, loading: false}));
  };

  render(){
    return (
      <form onSubmit={this.submit}>
        <Error error={this.state.error} />
        <Input
          type="email"
          value={this.state.email}
          placeholder="Email"
          onChange={e => this.setState({email: e.target.value})}
        />
        <Input
          type="password"
          value={this.state.password}
          placeholder="Password"
          onChange={e => this.setState({password: e.target.value})}
        />
        <Button type="submit" disabled={this.state.loading}>Submit</Button>
      </form>
    );
  }
}

export default class Auth extends Component {
  constructor(){
    super();
    this.state = {
      show: false,
      loggedIn: !!jwt
    };
  }

  onLogin = body => {
    login(body);
    this.setState({loggedIn: true});
    this.props.onLogin && this.props.onLogin();
  };

  render() {
    let {show, loggedIn} = this.state;
    return loggedIn ? <a className="btn btn-default" onClick={logout}>Log Out</a>
      : !show? <a className="btn btn-default" onClick={() => this.setState({show:true})}>Login / Register</a>
      : (
        <div className="auth-tabs">
          <a style={{position:'absolute', right: 5, top: 5}} onClick={() => this.setState({show: false})}>&#x2715;</a>
          <Tabs defaultActiveKey={1} animation={false}>
            <Tab eventKey={1} title="Login">
              <Login onLogin={this.onLogin}/>
            </Tab>
            <Tab eventKey={2} title="Register">
              <Register onLogin={this.onLogin} />
            </Tab>
          </Tabs>
        </div>
      );

  }
}