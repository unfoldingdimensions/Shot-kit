// Stand-in for konva's optional `canvas` dependency.
//
// konva's Node entry (`main`) does `require('canvas')` for server-side
// rendering. We never render Konva on the server — the scene is loaded through a
// client-side dynamic import — but the bundler still has to resolve the module,
// and `canvas` is an uninstalled native package. Turbopack aliases it here.
module.exports = {}
