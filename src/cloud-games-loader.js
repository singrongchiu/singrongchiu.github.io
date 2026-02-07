(function () {
  "use strict";

  var MANIFEST_URL = "https://noodleheads-tartanhacks.s3.us-east-1.amazonaws.com/games/manifest.json";
  var MANIFEST_TIMEOUT_MS = 1200;
  var SCRIPT_TIMEOUT_MS = 4000;
  var ALLOWED_PREFIX = "https://d34anrzmbcnfx3.cloudfront.net/games/";
  var DEBUG = (function () {
    var hostname = "";
    try {
      hostname = (window.location && window.location.hostname) || "";
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return true;
      }
      if (window.location && /(?:\?|&)cloudDebug=1(?:&|$)/.test(window.location.search)) {
        return true;
      }
      if (window.localStorage && window.localStorage.getItem("cloudGamesDebug") === "1") {
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }());

  var cloudGames = [];
  window.CloudMiniGames = cloudGames;
  window.CloudGamesStatus = {
    debugEnabled: DEBUG,
    manifestUrl: MANIFEST_URL,
    allowedPrefix: ALLOWED_PREFIX,
    startedAt: Date.now(),
    state: "booting",
    manifestEntries: 0,
    allowedEntries: 0,
    loadedScripts: 0,
    failedScripts: 0,
    lastError: ""
  };

  function toErrorMessage(err) {
    if (!err) {
      return "";
    }
    if (typeof err.message === "string") {
      return err.message;
    }
    return String(err);
  }

  function setState(state) {
    window.CloudGamesStatus.state = state;
  }

  function setError(err) {
    window.CloudGamesStatus.lastError = toErrorMessage(err);
  }

  function logDebug(message, extra) {
    if (!DEBUG) {
      return;
    }
    if (typeof extra === "undefined") {
      console.info("[cloud-games] " + message);
      return;
    }
    console.info("[cloud-games] " + message, extra);
  }

  function logWarn(message, extra) {
    if (!DEBUG) {
      return;
    }
    if (typeof extra === "undefined") {
      console.warn("[cloud-games] " + message);
      return;
    }
    console.warn("[cloud-games] " + message, extra);
  }

  logDebug("Loader initialized", {
    manifestUrl: MANIFEST_URL,
    allowedPrefix: ALLOWED_PREFIX
  });

  window.registerCloudMiniGame = function (factory) {
    if (typeof factory !== "function") {
      logWarn("Rejected cloud mini-game registration: factory is not a function");
      return;
    }

    try {
      var game = factory();
      if (!game || typeof game.id !== "string" || typeof game.render !== "function") {
        logWarn("Rejected cloud mini-game registration: invalid game object");
        return;
      }
      cloudGames.push(game);
      logDebug("Registered cloud mini-game", {
        id: game.id,
        label: game.label || "",
        totalRegistered: cloudGames.length
      });
    } catch (err) {
      setError(err);
      logWarn("Cloud mini-game registration threw", toErrorMessage(err));
    }
  };

  function withTimeout(promise, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var isDone = false;
      var timer = window.setTimeout(function () {
        if (isDone) {
          return;
        }
        isDone = true;
        reject(new Error("timeout"));
      }, timeoutMs);

      promise.then(function (value) {
        if (isDone) {
          return;
        }
        isDone = true;
        window.clearTimeout(timer);
        resolve(value);
      }).catch(function (err) {
        if (isDone) {
          return;
        }
        isDone = true;
        window.clearTimeout(timer);
        reject(err);
      });
    });
  }

  function isAllowedUrl(url) {
    return typeof url === "string" && url.indexOf(ALLOWED_PREFIX) === 0;
  }

  function loadScript(url) {
    logDebug("Loading cloud game script", { url: url });
    return withTimeout(new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = function () {
        window.CloudGamesStatus.loadedScripts += 1;
        logDebug("Loaded cloud game script", {
          url: url,
          loadedScripts: window.CloudGamesStatus.loadedScripts
        });
        resolve(true);
      };
      script.onerror = function () {
        window.CloudGamesStatus.failedScripts += 1;
        logWarn("Failed to load cloud game script", {
          url: url,
          failedScripts: window.CloudGamesStatus.failedScripts
        });
        reject(new Error("script-failed"));
      };
      document.head.appendChild(script);
    }), SCRIPT_TIMEOUT_MS);
  }

  function fetchManifest() {
    setState("fetching-manifest");
    logDebug("Fetching cloud manifest");
    return fetch(MANIFEST_URL, { cache: "no-store" })
      .then(function (response) {
        logDebug("Manifest response received", {
          ok: response.ok,
          status: response.status
        });
        if (!response.ok) {
          throw new Error("manifest-http-" + String(response.status));
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.games)) {
          logWarn("Manifest payload is missing games array");
          return [];
        }

        window.CloudGamesStatus.manifestEntries = payload.games.length;
        var allowedEntries = payload.games.filter(function (entry) {
          return entry && entry.enabled !== false && isAllowedUrl(entry.scriptUrl);
        });
        window.CloudGamesStatus.allowedEntries = allowedEntries.length;

        if (allowedEntries.length < payload.games.length) {
          logWarn("Some manifest entries were filtered out by enabled flag or allowed prefix", {
            manifestEntries: payload.games.length,
            allowedEntries: allowedEntries.length
          });
        } else {
          logDebug("All manifest entries are eligible", {
            manifestEntries: payload.games.length
          });
        }
        return allowedEntries;
      });
  }

  window.CloudGamesReady = withTimeout(fetchManifest(), MANIFEST_TIMEOUT_MS)
    .then(function (entries) {
      setState("loading-scripts");
      return Promise.all(entries.map(function (entry) {
        return loadScript(entry.scriptUrl).catch(function (err) {
          setError(err);
          return false;
        });
      }));
    })
    .then(function () {
      setState("ready");
      logDebug("Cloud game loading complete", {
        loadedScripts: window.CloudGamesStatus.loadedScripts,
        failedScripts: window.CloudGamesStatus.failedScripts,
        registeredGames: window.CloudMiniGames.length
      });
      return [];
    })
    .catch(function (err) {
      setError(err);
      setState("offline-or-failed");
      logWarn("Cloud game loading skipped", toErrorMessage(err));
      return [];
    });
}());
