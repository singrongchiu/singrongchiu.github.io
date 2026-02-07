(function () {
  "use strict";

  var WIRE_COUNT = 3;
  var WIRE_DEFS = [
    { key: "red", label: "Red", color: "#d96363" },
    { key: "blue", label: "Blue", color: "#4f8fdc" },
    { key: "green", label: "Green", color: "#49a55f" }
  ];
  // Keeps sockets visually fixed while forcing non-trivial line routes.
  var SOCKET_EXPECTED_WIRE = [2, 0, 1];

  function normalizeIndex(value, length) {
    var n = Number(value);
    var size = Number(length);
    if (!Number.isInteger(n) || !Number.isInteger(size) || size <= 0) {
      return -1;
    }
    if (n < 0 || n >= size) {
      return -1;
    }
    return n;
  }

  function createDisconnectedLinks() {
    return [-1, -1, -1];
  }

  function normalizeLinks(list) {
    var links = Array.isArray(list) ? list.slice(0, WIRE_COUNT) : createDisconnectedLinks();
    while (links.length < WIRE_COUNT) {
      links.push(-1);
    }
    return links.map(function (value) {
      return Number.isInteger(value) ? value : -1;
    });
  }

  function normalizeExpected(list) {
    var expected = Array.isArray(list) ? list.slice(0, WIRE_COUNT) : SOCKET_EXPECTED_WIRE.slice();
    while (expected.length < WIRE_COUNT) {
      expected.push(expected.length);
    }
    return expected.map(function (value, index) {
      var safe = normalizeIndex(value, WIRE_COUNT);
      return safe >= 0 ? safe : index;
    });
  }

  function countConnectedWires(wireToSocket) {
    return normalizeLinks(wireToSocket).filter(function (socketIndex) {
      return socketIndex >= 0;
    }).length;
  }

  function isCorrectMatch(socketExpectedWire, wireIndex, socketIndex) {
    var safeExpected = normalizeExpected(socketExpectedWire);
    var safeWireIndex = normalizeIndex(wireIndex, WIRE_COUNT);
    var safeSocketIndex = normalizeIndex(socketIndex, WIRE_COUNT);
    if (safeWireIndex < 0 || safeSocketIndex < 0) {
      return false;
    }
    return safeExpected[safeSocketIndex] === safeWireIndex;
  }

  function applyConnection(wireToSocket, socketToWire, wireIndex, socketIndex, socketExpectedWire) {
    var nextWireToSocket = normalizeLinks(wireToSocket);
    var nextSocketToWire = normalizeLinks(socketToWire);
    var safeExpected = normalizeExpected(socketExpectedWire);
    var safeWireIndex = normalizeIndex(wireIndex, WIRE_COUNT);
    var safeSocketIndex = normalizeIndex(socketIndex, WIRE_COUNT);

    if (safeWireIndex < 0 || safeSocketIndex < 0) {
      return {
        didConnect: false,
        wireToSocket: nextWireToSocket,
        socketToWire: nextSocketToWire,
        completed: countConnectedWires(nextWireToSocket) >= WIRE_COUNT
      };
    }

    if (nextWireToSocket[safeWireIndex] >= 0 || nextSocketToWire[safeSocketIndex] >= 0) {
      return {
        didConnect: false,
        wireToSocket: nextWireToSocket,
        socketToWire: nextSocketToWire,
        completed: countConnectedWires(nextWireToSocket) >= WIRE_COUNT
      };
    }

    if (!isCorrectMatch(safeExpected, safeWireIndex, safeSocketIndex)) {
      return {
        didConnect: false,
        wireToSocket: nextWireToSocket,
        socketToWire: nextSocketToWire,
        completed: countConnectedWires(nextWireToSocket) >= WIRE_COUNT
      };
    }

    nextWireToSocket[safeWireIndex] = safeSocketIndex;
    nextSocketToWire[safeSocketIndex] = safeWireIndex;
    return {
      didConnect: true,
      wireToSocket: nextWireToSocket,
      socketToWire: nextSocketToWire,
      completed: countConnectedWires(nextWireToSocket) >= WIRE_COUNT
    };
  }

  function createMeterMarkup() {
    var html = "";
    var i = 0;
    for (i = 0; i < WIRE_COUNT; i += 1) {
      html += "<span class='wires-meter-segment' data-meter='" + i + "' aria-hidden='true'></span>";
    }
    return html;
  }

  function createWireMarkup() {
    var html = "";
    var i = 0;
    for (i = 0; i < WIRE_COUNT; i += 1) {
      var wire = WIRE_DEFS[i];
      html +=
        "<button type='button' class='wires-start' data-wire='" + i + "' " +
        "style='--wire-color:" + wire.color + ";' aria-label='Drag " + wire.label + " wire'>" +
        "<span class='wires-start-dot'></span>" +
        "<span class='wires-start-pin'></span>" +
        "</button>";
    }
    return html;
  }

  function createSocketMarkup(socketExpectedWire) {
    var safeExpected = normalizeExpected(socketExpectedWire);
    var html = "";
    var socketIndex = 0;
    for (socketIndex = 0; socketIndex < WIRE_COUNT; socketIndex += 1) {
      var wire = WIRE_DEFS[safeExpected[socketIndex]];
      html +=
        "<div class='wires-socket' data-socket='" + socketIndex + "' " +
        "style='--wire-color:" + wire.color + ";' aria-label='" + wire.label + " socket'>" +
        "<span class='wires-socket-ring'></span>" +
        "</div>";
    }
    return html;
  }

  function createLineMarkup() {
    var html = "";
    var i = 0;
    for (i = 0; i < WIRE_COUNT; i += 1) {
      html +=
        "<line class='wires-line' data-wire-line='" + i + "' " +
        "stroke='" + WIRE_DEFS[i].color + "' stroke-width='8' stroke-linecap='round'></line>";
    }
    html +=
      "<line class='wires-line wires-active-line' data-active-wire='1' " +
      "stroke='#7d94a8' stroke-width='8' stroke-linecap='round'></line>";
    return html;
  }

  function createMiniGamePlugin() {
    return {
      id: "wires",
      title: "Connect Wires",
      initialWeight: 1,
      timing: {
        roundMs: 14000
      },
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function"
          ? api.complete
          : function () {};
        var noteInteraction = typeof api.noteInteraction === "function"
          ? api.noteInteraction
          : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};

        var wireToSocket = createDisconnectedLinks();
        var socketToWire = createDisconnectedLinks();
        var done = false;
        var invalidTimer = 0;
        var drag = {
          active: false,
          pointerId: -1,
          wireIndex: -1,
          x: 0,
          y: 0
        };

        mount.innerHTML =
          "<div class='wires-game'>" +
          "<div class='chip mini-instruction wires-chip'>Match each wire to its color socket</div>" +
          "<div class='wires-stage'>" +
          "<div class='wires-meter'>" +
          createMeterMarkup() +
          "</div>" +
          "<div class='wires-panel'>" +
          "<svg class='wires-canvas' aria-hidden='true'>" +
          createLineMarkup() +
          "</svg>" +
          "<div class='wires-side wires-left'>" +
          createWireMarkup() +
          "</div>" +
          "<div class='wires-side wires-right'>" +
          createSocketMarkup(SOCKET_EXPECTED_WIRE) +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>";

        var panel = mount.querySelector(".wires-panel");
        var hintNode = mount.querySelector(".wires-chip");
        var wires = Array.prototype.slice.call(mount.querySelectorAll(".wires-start"));
        var sockets = Array.prototype.slice.call(mount.querySelectorAll(".wires-socket"));
        var meterSegments = Array.prototype.slice.call(mount.querySelectorAll(".wires-meter-segment"));
        var lineNodes = [];
        var i = 0;
        for (i = 0; i < WIRE_COUNT; i += 1) {
          lineNodes.push(mount.querySelector("[data-wire-line='" + i + "']"));
        }
        var activeLine = mount.querySelector("[data-active-wire='1']");

        registerControl(panel);

        function clearInvalidPulse() {
          if (invalidTimer) {
            window.clearTimeout(invalidTimer);
            invalidTimer = 0;
          }
          panel.classList.remove("is-invalid");
        }

        function pulseInvalidFeedback() {
          clearInvalidPulse();
          panel.classList.add("is-invalid");
          invalidTimer = window.setTimeout(function () {
            panel.classList.remove("is-invalid");
            invalidTimer = 0;
          }, 240);
        }

        function toPanelPoint(clientX, clientY) {
          var rect = panel.getBoundingClientRect();
          return {
            x: clientX - rect.left,
            y: clientY - rect.top
          };
        }

        function centerPointFor(node, panelRect) {
          var nodeRect = node.getBoundingClientRect();
          return {
            x: (nodeRect.left - panelRect.left) + (nodeRect.width * 0.5),
            y: (nodeRect.top - panelRect.top) + (nodeRect.height * 0.5)
          };
        }

        function setLine(node, fromPoint, toPoint, visible, stroke) {
          if (!node || !fromPoint || !toPoint) {
            return;
          }
          node.setAttribute("x1", fromPoint.x.toFixed(2));
          node.setAttribute("y1", fromPoint.y.toFixed(2));
          node.setAttribute("x2", toPoint.x.toFixed(2));
          node.setAttribute("y2", toPoint.y.toFixed(2));
          node.style.opacity = visible ? "1" : "0";
          if (stroke) {
            node.setAttribute("stroke", stroke);
          }
        }

        function findSocketAtPoint(clientX, clientY) {
          var socketIndex = 0;
          for (socketIndex = 0; socketIndex < sockets.length; socketIndex += 1) {
            var rect = sockets[socketIndex].getBoundingClientRect();
            var padding = 18;
            if (
              clientX >= rect.left - padding &&
              clientX <= rect.right + padding &&
              clientY >= rect.top - padding &&
              clientY <= rect.bottom + padding
            ) {
              return socketIndex;
            }
          }
          return -1;
        }

        function renderHint(connectedCount) {
          if (!hintNode) {
            return;
          }
          if (connectedCount >= WIRE_COUNT) {
            hintNode.textContent = "Power restored!";
          } else {
            hintNode.textContent = "Match each wire to its color socket";
          }
        }

        function renderLines() {
          var panelRect = panel.getBoundingClientRect();
          var wireIndex = 0;
          for (wireIndex = 0; wireIndex < WIRE_COUNT; wireIndex += 1) {
            var socketIndex = wireToSocket[wireIndex];
            if (socketIndex < 0 || socketIndex >= WIRE_COUNT) {
              setLine(
                lineNodes[wireIndex],
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                false
              );
              continue;
            }
            setLine(
              lineNodes[wireIndex],
              centerPointFor(wires[wireIndex], panelRect),
              centerPointFor(sockets[socketIndex], panelRect),
              true
            );
          }

          if (drag.active && drag.wireIndex >= 0 && drag.wireIndex < WIRE_COUNT) {
            setLine(
              activeLine,
              centerPointFor(wires[drag.wireIndex], panelRect),
              { x: drag.x, y: drag.y },
              true,
              WIRE_DEFS[drag.wireIndex].color
            );
          } else {
            setLine(activeLine, { x: 0, y: 0 }, { x: 0, y: 0 }, false);
          }
        }

        function renderState() {
          var connectedCount = countConnectedWires(wireToSocket);
          wires.forEach(function (wireNode, wireIndex) {
            wireNode.classList.toggle("is-connected", wireToSocket[wireIndex] >= 0);
          });
          sockets.forEach(function (socketNode, socketIndex) {
            socketNode.classList.toggle("is-filled", socketToWire[socketIndex] >= 0);
          });
          meterSegments.forEach(function (segment, index) {
            segment.classList.toggle("is-on", index < connectedCount);
          });
          renderHint(connectedCount);
          renderLines();
        }

        function stopActiveDrag() {
          drag.active = false;
          drag.pointerId = -1;
          drag.wireIndex = -1;
        }

        function onWirePointerDown(evt) {
          if (done) {
            return;
          }
          evt.stopPropagation();
          var wireIndex = normalizeIndex(evt.currentTarget.getAttribute("data-wire"), WIRE_COUNT);
          if (wireIndex < 0 || wireToSocket[wireIndex] >= 0) {
            return;
          }

          noteInteraction();
          clearInvalidPulse();
          drag.active = true;
          drag.pointerId = evt.pointerId;
          drag.wireIndex = wireIndex;
          var local = toPanelPoint(evt.clientX, evt.clientY);
          drag.x = local.x;
          drag.y = local.y;
          if (typeof evt.currentTarget.setPointerCapture === "function") {
            try {
              evt.currentTarget.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore pointer-capture failures.
            }
          }
          renderLines();
        }

        function onWireClick(evt) {
          evt.preventDefault();
          evt.stopPropagation();
        }

        function onPanelPointerMove(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          var local = toPanelPoint(evt.clientX, evt.clientY);
          drag.x = local.x;
          drag.y = local.y;
          renderLines();
        }

        function onPanelPointerUp(evt) {
          finishDrag(evt, false);
        }

        function onPanelPointerCancel(evt) {
          finishDrag(evt, true);
        }

        function finishDrag(evt, cancelled) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          var draggedWire = drag.wireIndex;
          var targetSocket = cancelled ? -1 : findSocketAtPoint(evt.clientX, evt.clientY);
          stopActiveDrag();

          if (done || cancelled) {
            renderLines();
            return;
          }

          var next = applyConnection(
            wireToSocket,
            socketToWire,
            draggedWire,
            targetSocket,
            SOCKET_EXPECTED_WIRE
          );
          wireToSocket = next.wireToSocket;
          socketToWire = next.socketToWire;

          if (next.didConnect) {
            clearInvalidPulse();
            renderState();
            if (!done && next.completed) {
              done = true;
              window.setTimeout(function () {
                complete();
              }, 120);
            }
            return;
          }

          pulseInvalidFeedback();
          renderState();
        }

        function onResize() {
          renderLines();
        }

        wires.forEach(function (wireNode) {
          registerControl(wireNode);
          wireNode.addEventListener("pointerdown", onWirePointerDown);
          wireNode.addEventListener("click", onWireClick);
        });
        panel.addEventListener("pointermove", onPanelPointerMove);
        panel.addEventListener("pointerup", onPanelPointerUp);
        panel.addEventListener("pointercancel", onPanelPointerCancel);
        panel.addEventListener("lostpointercapture", onPanelPointerCancel);
        window.addEventListener("resize", onResize);

        renderState();

        return function cleanup() {
          clearInvalidPulse();
          window.removeEventListener("resize", onResize);
          wires.forEach(function (wireNode) {
            wireNode.removeEventListener("pointerdown", onWirePointerDown);
            wireNode.removeEventListener("click", onWireClick);
          });
          panel.removeEventListener("pointermove", onPanelPointerMove);
          panel.removeEventListener("pointerup", onPanelPointerUp);
          panel.removeEventListener("pointercancel", onPanelPointerCancel);
          panel.removeEventListener("lostpointercapture", onPanelPointerCancel);
        };
      }
    };
  }

  var api = {
    WIRE_COUNT: WIRE_COUNT,
    WIRE_DEFS: WIRE_DEFS.map(function (wire) {
      return {
        key: wire.key,
        label: wire.label,
        color: wire.color
      };
    }),
    SOCKET_EXPECTED_WIRE: SOCKET_EXPECTED_WIRE.slice(),
    createDisconnectedLinks: createDisconnectedLinks,
    countConnectedWires: countConnectedWires,
    isCorrectMatch: isCorrectMatch,
    applyConnection: applyConnection,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.ConnectWiresMiniGame = api;
  }
}());
