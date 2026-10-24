// Jest transform: load a .sql file as a string module, matching webpack's asset/source.
module.exports = {
  process: (source) => ({ code: `module.exports = ${JSON.stringify(source)};` }),
};
