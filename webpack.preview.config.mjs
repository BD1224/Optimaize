import HtmlWebpackPlugin from 'html-webpack-plugin';

// `npm run preview`: shows the UI (src/pages) in a normal browser on mock data,
// without Electron or the backend. `npm start` runs the real desktop app.
export default {
  mode: 'development',
  entry: './src/pages/index.tsx',
  devtool: 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { transpileOnly: true } },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: { extensions: ['.js', '.ts', '.tsx', '.css'] },
  plugins: [new HtmlWebpackPlugin({ template: './src/pages/index.html' })],
  devServer: { port: 3000, open: true },
};
