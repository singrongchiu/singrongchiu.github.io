(function () {
  "use strict";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        resolve(true);
      };
      script.onerror = function () {
        reject(new Error("load-failed: " + src));
      };
      document.body.appendChild(script);
    });
  }

  var ready = window.CloudGamesReady;
  if (!ready || typeof ready.then !== "function") {
    ready = Promise.resolve();
  }

  ready
    .catch(function () {
      return [];
    })
    .then(function () {
      return loadScript("./minigames.js");
    })
    .then(function () {
      return loadScript("./app.js");
    })
    .catch(function (err) {
      // Keep failures visible without breaking the rest of the page.
      console.error(err);
    });
}());
