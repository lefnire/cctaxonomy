import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import { Router, Route, Link, hashHistory, Redirect } from 'react-router'

require("!style!css!sass!./style/style.scss");

ReactDOM.render((
  <Router history={hashHistory}>
    <Route path="/:id" component={App} />
    <Redirect from="/" to="/home" />
  </Router>
), document.querySelector('.container'))
