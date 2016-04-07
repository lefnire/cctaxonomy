const webpack = require('webpack');
const PROD = process.env.NODE_ENV === 'production';

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
      { test: /\.scss$/, loaders: ["style", "css", "sass"]}
    ],
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  plugins: PROD ? [
    new webpack.optimize.UglifyJsPlugin({
      minimize: true,
      compress: {
        warnings: false
      }
    })
  ] : [],
  devServer: {
    historyApiFallback: true,
    contentBase: './'
  }
};
