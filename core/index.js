/* Game core: everything except rendering. No DOM access, so it runs in the browser,
   Node (tools/*.js) and React Native. Modules attach to a shared `CS` global in load order;
   the engine calls into CS.Con / CS.M at hook points, so the order below matters.

   Node / React Native:  const CS = require('./core');
   Browser (index.php):  loads the same files as classic <script> tags in this order. */
require('./data.js');
require('./addons.js');
require('./engine.js');
require('./consoles.js');
require('./names.js');
require('./managers.js');
require('./offers.js');
require('./advisor.js');
module.exports = globalThis.CS;
