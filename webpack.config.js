const webpack = require('webpack');
const PROD = process.env.NODE_ENV === 'production';
const StringReplacePlugin = require("string-replace-webpack-plugin");
const nconf = require('nconf');
nconf.argv().env().file({ file: 'config.json' });

module.exports = {
  entry: [
    './client/index.js'
  ],
  output: {
    path: __dirname,
    publicPath: '/',
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { loader: 'babel', exclude: /node_modules/ },
      { test: /\.css$/, loader: "style!css" }, // "style-loader!css-loader?importLoaders=1"
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader:  'url-loader' }, //'url-loader?limit=100000'
      { test: /\.scss$/, loaders: ["style", "css", "sass"]},
      {test: /\.json$/, loader: 'json'},
      {
        exclude: /node_modules/,
        loader: StringReplacePlugin.replace({
          replacements: [{
            // replace server url based on release (ie, localhost:3000 or cctaxonomy.herokuapp.com)
            pattern: /<nconf:server>/g,
            replacement: (match, p1, offset, string) => nconf.get('server:' + (PROD ? 'production' : 'development'))
          }]
        })
      }
    ],
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  plugins: [
    // Replace <nconf:*>
    new StringReplacePlugin(),
  ].concat(PROD ? [
    new webpack.optimize.UglifyJsPlugin({
      minimize: true,
      compress: {
        warnings: false
      }
    })
  ] : []),
  devServer: {
    historyApiFallback: true,
    contentBase: './'
  }
};
