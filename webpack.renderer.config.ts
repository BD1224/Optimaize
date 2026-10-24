import type { Configuration } from 'webpack';

import { rendererRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

const rules = [
  ...rendererRules,
  {
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
  },
];

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
