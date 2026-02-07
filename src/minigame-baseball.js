(function () {
  "use strict";

  var DEFAULT_METER = {
    cycleMs: 1800,
    yellowMin: 0.2,
    yellowMax: 0.8,
    greenMin: 0.42,
    greenMax: 0.58
  };

  var DEFAULT_PITCH = {
    durationMs: 2200,
    plateProgress: 0.66
  };

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function meterConfig(custom) {
    var input = custom || {};
    var yellowMin = Number.isFinite(input.yellowMin) ? input.yellowMin : DEFAULT_METER.yellowMin;
    var yellowMax = Number.isFinite(input.yellowMax) ? input.yellowMax : DEFAULT_METER.yellowMax;
    var greenMin = Number.isFinite(input.greenMin) ? input.greenMin : DEFAULT_METER.greenMin;
    var greenMax = Number.isFinite(input.greenMax) ? input.greenMax : DEFAULT_METER.greenMax;

    yellowMin = clamp(yellowMin, 0, 1);
    yellowMax = clamp(yellowMax, yellowMin, 1);
    greenMin = clamp(greenMin, yellowMin, yellowMax);
    greenMax = clamp(greenMax, greenMin, yellowMax);

    return {
      cycleMs: Number.isFinite(input.cycleMs) ? Math.max(240, input.cycleMs) : DEFAULT_METER.cycleMs,
      yellowMin: yellowMin,
      yellowMax: yellowMax,
      greenMin: greenMin,
      greenMax: greenMax
    };
  }

  function pitchConfig(custom) {
    var input = custom || {};
    return {
      durationMs: Number.isFinite(input.durationMs) ? Math.max(200, input.durationMs) : DEFAULT_PITCH.durationMs,
      plateProgress: Number.isFinite(input.plateProgress)
        ? clamp(input.plateProgress, 0, 1)
        : DEFAULT_PITCH.plateProgress
    };
  }

  function getPitchProgress(elapsedMs, customPitch) {
    var cfg = pitchConfig(customPitch);
    var elapsed = Number(elapsedMs);
    if (!Number.isFinite(elapsed) || elapsed <= 0) {
      return 0;
    }
    return clamp(elapsed / cfg.durationMs, 0, 1);
  }

  function hasPitchCrossedPlate(pitchProgress, customPitch) {
    var cfg = pitchConfig(customPitch);
    var progress = clamp(pitchProgress, 0, 1);
    return progress >= cfg.plateProgress;
  }

  function getMeterValue(elapsedMs, customMeter) {
    var cfg = meterConfig(customMeter);
    var elapsed = Number(elapsedMs);
    if (!Number.isFinite(elapsed)) {
      elapsed = 0;
    }
    var wrapped = ((elapsed % cfg.cycleMs) + cfg.cycleMs) % cfg.cycleMs;
    var phase = wrapped / cfg.cycleMs;
    if (phase <= 0.5) {
      return phase * 2;
    }
    return (1 - phase) * 2;
  }

  function classifyMeterZone(value, customMeter) {
    var cfg = meterConfig(customMeter);
    var meterValue = clamp(value, 0, 1);
    if (meterValue >= cfg.greenMin && meterValue <= cfg.greenMax) {
      return "green";
    }
    if (meterValue >= cfg.yellowMin && meterValue <= cfg.yellowMax) {
      return "yellow";
    }
    return "red";
  }

  function consumeSwingAttempt(alreadyUsed) {
    if (alreadyUsed) {
      return {
        didSwing: false,
        attemptUsed: true
      };
    }
    return {
      didSwing: true,
      attemptUsed: true
    };
  }

  function resolveSwingOutcome(meterValue, pitchProgress, options) {
    var input = options || {};
    var attempt = consumeSwingAttempt(Boolean(input.attemptUsed));
    var zone = classifyMeterZone(meterValue, input.meter);
    if (!attempt.didSwing) {
      return {
        didSwing: false,
        attemptUsed: true,
        zone: zone,
        outcome: "locked"
      };
    }

    if (hasPitchCrossedPlate(pitchProgress, input.pitch)) {
      return {
        didSwing: true,
        attemptUsed: true,
        zone: zone,
        outcome: "late"
      };
    }

    if (zone === "green") {
      return {
        didSwing: true,
        attemptUsed: true,
        zone: zone,
        outcome: "home_run"
      };
    }

    if (zone === "yellow") {
      return {
        didSwing: true,
        attemptUsed: true,
        zone: zone,
        outcome: "weak_hit"
      };
    }

    return {
      didSwing: true,
      attemptUsed: true,
      zone: zone,
      outcome: "whiff"
    };
  }

  function createMiniGamePlugin() {
    return {
      id: "baseball",
      title: "Baseball Meter Swing",
      initialWeight: 1,
      timing: {
        roundMs: 10000
      },
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function"
          ? api.complete
          : function () {};
        var fail = typeof api.fail === "function"
          ? api.fail
          : function () {};
        var noteInteraction = typeof api.noteInteraction === "function"
          ? api.noteInteraction
          : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};
        var effects = api.effects && typeof api.effects === "object" ? api.effects : {};
        var confetti = typeof effects.confetti === "function" ? effects.confetti : function () {};
        var toast = typeof effects.toast === "function" ? effects.toast : function () {};

        var meter = meterConfig();
        var pitch = pitchConfig();
        var done = false;
        var attemptUsed = false;
        var startMs = 0;
        var rafId = 0;
        var swingPoseTimer = 0;
        var settleTimer = 0;
        var currentMeterValue = 0;
        var currentPitchProgress = 0;

        mount.innerHTML =
          "<div class='baseball-game'>" +
          "<div class='chip mini-instruction baseball-chip'>Swing once while the meter is green</div>" +
          "<div class='baseball-scene'>" +
          "<div class='baseball-sky' aria-hidden='true'></div>" +
          "<div class='baseball-outfield' aria-hidden='true'></div>" +
          "<div class='baseball-target' aria-hidden='true'></div>" +
          "<div class='baseball-meter' aria-hidden='true'>" +
          "<span class='baseball-meter-marker'></span>" +
          "</div>" +
          "<div class='baseball-plate' aria-hidden='true'></div>" +
          "<div class='baseball-ball' aria-hidden='true'></div>" +
          "<div class='baseball-batter' aria-hidden='true'><span class='baseball-bat'></span></div>" +
          "</div>" +
          "<button type='button' class='baseball-swing-btn' aria-label='Swing now'>Swing</button>" +
          "</div>";

        var chip = mount.querySelector(".baseball-chip");
        var scene = mount.querySelector(".baseball-scene");
        var meterNode = mount.querySelector(".baseball-meter");
        var markerNode = mount.querySelector(".baseball-meter-marker");
        var ballNode = mount.querySelector(".baseball-ball");
        var batterNode = mount.querySelector(".baseball-batter");
        var targetNode = mount.querySelector(".baseball-target");
        var swingButton = mount.querySelector(".baseball-swing-btn");

        registerControl(scene);
        registerControl(swingButton);

        function nowMs() {
          if (typeof window !== "undefined" && window.performance && typeof window.performance.now === "function") {
            return window.performance.now();
          }
          return Date.now();
        }

        function setChip(text) {
          if (chip) {
            chip.textContent = String(text || "");
          }
        }

        function renderMeter(value) {
          if (!meterNode || !markerNode) {
            return;
          }
          var zone = classifyMeterZone(value, meter);
          meterNode.classList.toggle("is-green", zone === "green");
          meterNode.classList.toggle("is-yellow", zone === "yellow");
          meterNode.classList.toggle("is-red", zone === "red");
          markerNode.style.left = (clamp(value, 0, 1) * 100).toFixed(2) + "%";
        }

        function renderPitch(progress, outcome) {
          if (!ballNode) {
            return;
          }
          var clamped = clamp(progress, 0, 1);
          var x = 82 - (clamped * 60);
          var y = 34 + (Math.sin(clamped * Math.PI) * 4);
          if (outcome === "home_run") {
            var targetCenterX = 76;
            var targetCenterY = 28;
            if (scene && targetNode) {
              var sceneRect = scene.getBoundingClientRect();
              var targetRect = targetNode.getBoundingClientRect();
              if (
                sceneRect.width > 0 &&
                sceneRect.height > 0 &&
                targetRect.width > 0 &&
                targetRect.height > 0
              ) {
                targetCenterX = (
                  ((targetRect.left - sceneRect.left) + (targetRect.width * 0.5)) /
                  sceneRect.width
                ) * 100;
                targetCenterY = (
                  ((targetRect.top - sceneRect.top) + (targetRect.height * 0.5)) /
                  sceneRect.height
                ) * 100;
              }
            }
            var startX = 20;
            var startY = 46;
            x = startX + ((targetCenterX - startX) * clamped);
            y = startY + ((targetCenterY - startY) * clamped) - (Math.sin(clamped * Math.PI) * 18);
          }
          ballNode.style.left = x.toFixed(2) + "%";
          ballNode.style.top = y.toFixed(2) + "%";
        }

        function clearSwingPoseTimer() {
          if (swingPoseTimer) {
            window.clearTimeout(swingPoseTimer);
            swingPoseTimer = 0;
          }
        }

        function showSwingPose() {
          if (!batterNode) {
            return;
          }
          clearSwingPoseTimer();
          batterNode.classList.add("is-swinging");
          swingPoseTimer = window.setTimeout(function () {
            batterNode.classList.remove("is-swinging");
            swingPoseTimer = 0;
          }, 180);
        }

        function stopLoop() {
          if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          }
        }

        function clearSettleTimer() {
          if (settleTimer) {
            window.clearTimeout(settleTimer);
            settleTimer = 0;
          }
        }

        function settleFail(reason) {
          clearSettleTimer();
          settleTimer = window.setTimeout(function () {
            fail(reason);
          }, 240);
        }

        function setSceneOutcome(outcome) {
          if (!scene) {
            return;
          }
          scene.classList.remove("is-home-run", "is-weak-hit", "is-whiff", "is-late", "is-watched");
          scene.classList.add("is-" + outcome);
        }

        function applyOutcome(outcome, zone) {
          if (done) {
            return;
          }
          done = true;
          stopLoop();
          attemptUsed = true;
          setSceneOutcome(outcome);

          if (swingButton) {
            swingButton.disabled = true;
          }

          if (targetNode) {
            targetNode.classList.toggle("is-hit", outcome === "home_run");
            targetNode.classList.toggle("is-miss", outcome !== "home_run");
          }

          if (outcome === "home_run") {
            renderPitch(1, "home_run");
            setChip("Crushed it! Home run!");
            if (swingButton) {
              swingButton.textContent = "Perfect";
            }
            confetti();
            toast("Home run!");
            complete();
            return;
          }

          if (outcome === "weak_hit") {
            setChip("Contact, but not enough power.");
            if (swingButton) {
              swingButton.textContent = "Too weak";
            }
            settleFail("weak-hit");
            return;
          }

          if (outcome === "late") {
            setChip("Too late. Strike.");
            if (swingButton) {
              swingButton.textContent = "Late";
            }
            settleFail("late-swing");
            return;
          }

          if (outcome === "watched") {
            setChip("No swing before the plate. Strike.");
            if (swingButton) {
              swingButton.textContent = "Missed";
            }
            settleFail("no-swing");
            return;
          }

          setChip(zone === "red" ? "Poor contact. Miss." : "Missed.");
          if (swingButton) {
            swingButton.textContent = "Miss";
          }
          settleFail("whiff");
        }

        function updateFromElapsed(elapsed, forcedOutcome) {
          currentPitchProgress = getPitchProgress(elapsed, pitch);
          currentMeterValue = getMeterValue(elapsed, meter);
          renderMeter(currentMeterValue);
          renderPitch(currentPitchProgress, forcedOutcome);
        }

        function elapsedNow() {
          if (!startMs) {
            startMs = nowMs();
          }
          return Math.max(0, nowMs() - startMs);
        }

        function handleSwingInput(evt) {
          if (evt) {
            evt.stopPropagation();
          }
          if (done) {
            return;
          }

          noteInteraction();
          var elapsed = elapsedNow();
          updateFromElapsed(elapsed);
          var result = resolveSwingOutcome(currentMeterValue, currentPitchProgress, {
            attemptUsed: attemptUsed,
            meter: meter,
            pitch: pitch
          });
          attemptUsed = result.attemptUsed;
          if (!result.didSwing) {
            return;
          }
          showSwingPose();
          applyOutcome(result.outcome, result.zone);
        }

        function onScenePointerDown(evt) {
          if (evt.target === swingButton) {
            return;
          }
          handleSwingInput(evt);
        }

        function onButtonPointerDown(evt) {
          handleSwingInput(evt);
        }

        function onButtonClick(evt) {
          if (evt) {
            evt.preventDefault();
          }
          handleSwingInput(evt);
        }

        function step(ts) {
          if (done) {
            return;
          }
          if (!startMs) {
            startMs = ts;
          }
          var elapsed = ts - startMs;
          updateFromElapsed(elapsed);
          if (!attemptUsed && hasPitchCrossedPlate(currentPitchProgress, pitch)) {
            applyOutcome("watched", "red");
            return;
          }
          rafId = window.requestAnimationFrame(step);
        }

        scene.addEventListener("pointerdown", onScenePointerDown);
        swingButton.addEventListener("pointerdown", onButtonPointerDown);
        swingButton.addEventListener("click", onButtonClick);

        updateFromElapsed(0);
        rafId = window.requestAnimationFrame(step);

        return function cleanup() {
          stopLoop();
          clearSwingPoseTimer();
          clearSettleTimer();
          scene.removeEventListener("pointerdown", onScenePointerDown);
          swingButton.removeEventListener("pointerdown", onButtonPointerDown);
          swingButton.removeEventListener("click", onButtonClick);
        };
      }
    };
  }

  var api = {
    DEFAULT_METER: DEFAULT_METER,
    DEFAULT_PITCH: DEFAULT_PITCH,
    getPitchProgress: getPitchProgress,
    hasPitchCrossedPlate: hasPitchCrossedPlate,
    getMeterValue: getMeterValue,
    classifyMeterZone: classifyMeterZone,
    consumeSwingAttempt: consumeSwingAttempt,
    resolveSwingOutcome: resolveSwingOutcome,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.BaseballMeterMiniGame = api;
  }
}());
