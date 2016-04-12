import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import { Router, Route, Link, browserHistory, Redirect } from 'react-router'

require("!style!css!sass!./style/style.scss");

ReactDOM.render((
  <Router history={browserHistory}>
    <Route path="/:uuid" component={App} />
    <Redirect from="/" to="/home" />
  </Router>
), document.querySelector('.container'))
