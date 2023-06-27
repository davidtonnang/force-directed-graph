import { select } from 'd3-selection';
import { zoomTransform, zoom } from 'd3-zoom';
import { drag } from 'd3-drag';
import { min, max } from 'd3-array';
import { throttle } from 'lodash-es';
import TWEEN from '@tweenjs/tween.js';
import Kapsule from 'kapsule';
import accessorFn from 'accessor-fn';
import ColorTracker from 'canvas-color-tracker';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceRadial } from 'd3-force-3d';
import { Bezier } from 'bezier-js';
import indexBy from 'index-array-by';
import { scaleOrdinal } from 'd3-scale';
import { schemePaired } from 'd3-scale-chromatic';

function styleInject(css, ref) {
  if (ref === void 0) ref = {};
  var insertAt = ref.insertAt;
  if (!css || typeof document === 'undefined') {
    return;
  }
  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';
  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css_248z = ".force-graph-container canvas {\r\n  display: block;\r\n  user-select: none;\r\n  outline: none;\r\n  -webkit-tap-highlight-color: transparent;\r\n}\r\n\r\n.force-graph-container .graph-tooltip {\r\n  position: absolute;\r\n  top: 0;\r\n  font-family: sans-serif;\r\n  font-size: 16px;\r\n  padding: 4px;\r\n  border-radius: 3px;\r\n  color: #eee;\r\n  background: rgba(0,0,0,0.65);\r\n  visibility: hidden; /* by default */\r\n}\r\n\r\n.force-graph-container .clickable {\r\n  cursor: pointer;\r\n}\r\n\r\n.force-graph-container .grabbable {\r\n  cursor: move;\r\n  cursor: grab;\r\n  cursor: -moz-grab;\r\n  cursor: -webkit-grab;\r\n}\r\n\r\n.force-graph-container .grabbable:active {\r\n  cursor: grabbing;\r\n  cursor: -moz-grabbing;\r\n  cursor: -webkit-grabbing;\r\n}\r\n";
styleInject(css_248z);

const autoColorScale = scaleOrdinal(schemePaired);

// Autoset attribute colorField by colorByAccessor property
// If an object has already a color, don't set it
// Objects can be nodes or links
function autoColorObjects(objects, colorByAccessor, colorField) {
  if (!colorByAccessor || typeof colorField !== 'string') return;
  objects.filter(obj => !obj[colorField]).forEach(obj => {
    obj[colorField] = autoColorScale(colorByAccessor(obj));
  });
}

function getDagDepths ({
  nodes,
  links
}, idAccessor, {
  nodeFilter = () => true,
  onLoopError = loopIds => {
    throw `Invalid DAG structure! Found cycle in node path: ${loopIds.join(' -> ')}.`;
  }
} = {}) {
  // linked graph
  const graph = {};
  nodes.forEach(node => graph[idAccessor(node)] = {
    data: node,
    out: [],
    depth: -1,
    skip: !nodeFilter(node)
  });
  links.forEach(({
    source,
    target
  }) => {
    const sourceId = getNodeId(source);
    const targetId = getNodeId(target);
    if (!graph.hasOwnProperty(sourceId)) throw `Missing source node with id: ${sourceId}`;
    if (!graph.hasOwnProperty(targetId)) throw `Missing target node with id: ${targetId}`;
    const sourceNode = graph[sourceId];
    const targetNode = graph[targetId];
    sourceNode.out.push(targetNode);
    function getNodeId(node) {
      return typeof node === 'object' ? idAccessor(node) : node;
    }
  });
  const foundLoops = [];
  traverse(Object.values(graph));
  const nodeDepths = Object.assign({}, ...Object.entries(graph).filter(([, node]) => !node.skip).map(([id, node]) => ({
    [id]: node.depth
  })));
  return nodeDepths;
  function traverse(nodes, nodeStack = [], currentDepth = 0) {
    for (let i = 0, l = nodes.length; i < l; i++) {
      const node = nodes[i];
      if (nodeStack.indexOf(node) !== -1) {
        const loop = [...nodeStack.slice(nodeStack.indexOf(node)), node].map(d => idAccessor(d.data));
        if (!foundLoops.some(foundLoop => foundLoop.length === loop.length && foundLoop.every((id, idx) => id === loop[idx]))) {
          foundLoops.push(loop);
          onLoopError(loop);
        }
        continue;
      }
      if (currentDepth > node.depth) {
        // Don't unnecessarily revisit chunks of the graph
        node.depth = currentDepth;
        traverse(node.out, [...nodeStack, node], currentDepth + (node.skip ? 0 : 1));
      }
    }
  }
}

//

const DAG_LEVEL_NODE_RATIO = 2;

// whenever styling props are changed that require a canvas redraw
const notifyRedraw = (_, state) => state.onNeedsRedraw && state.onNeedsRedraw();
const updDataPhotons = (_, state) => {
  if (!state.isShadow) {
    // Add photon particles
    const linkParticlesAccessor = accessorFn(state.linkDirectionalParticles);
    state.graphData.links.forEach(link => {
      const numPhotons = Math.round(Math.abs(linkParticlesAccessor(link)));
      if (numPhotons) {
        link.__photons = [...Array(numPhotons)].map(() => ({}));
      } else {
        delete link.__photons;
      }
    });
  }
};
var CanvasForceGraph = Kapsule({
  props: {
    graphData: {
      default: {
        nodes: [],
        links: []
      },
      onChange(_, state) {
        state.engineRunning = false; // Pause simulation
        updDataPhotons(_, state);
      }
    },
    dagMode: {
      onChange(dagMode, state) {
        // td, bu, lr, rl, radialin, radialout
        !dagMode && (state.graphData.nodes || []).forEach(n => n.fx = n.fy = undefined); // unfix nodes when disabling dag mode
      }
    },

    dagLevelDistance: {},
    dagNodeFilter: {
      default: node => true
    },
    onDagError: {
      triggerUpdate: false
    },
    nodeRelSize: {
      default: 4,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    // area per val unit
    nodeId: {
      default: 'id'
    },
    nodeVal: {
      default: 'val',
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    nodeColor: {
      default: 'color',
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    nodeAutoColorBy: {},
    nodeCanvasObject: {
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    nodeCanvasObjectMode: {
      default: () => 'replace',
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    nodeVisibility: {
      default: true,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkSource: {
      default: 'source'
    },
    linkTarget: {
      default: 'target'
    },
    linkVisibility: {
      default: true,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkColor: {
      default: 'color',
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkAutoColorBy: {},
    linkLineDash: {
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkWidth: {
      default: 1,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkCurvature: {
      default: 0,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkCanvasObject: {
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkCanvasObjectMode: {
      default: () => 'replace',
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkDirectionalArrowLength: {
      default: 0,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkDirectionalArrowColor: {
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    linkDirectionalArrowRelPos: {
      default: 0.5,
      triggerUpdate: false,
      onChange: notifyRedraw
    },
    // value between 0<>1 indicating the relative pos along the (exposed) line
    linkDirectionalParticles: {
      default: 0,
      triggerUpdate: false,
      onChange: updDataPhotons
    },
    // animate photons travelling in the link direction
    linkDirectionalParticleSpeed: {
      default: 0.01,
      triggerUpdate: false
    },
    // in link length ratio per frame
    linkDirectionalParticleWidth: {
      default: 4,
      triggerUpdate: false
    },
    linkDirectionalParticleColor: {
      triggerUpdate: false
    },
    globalScale: {
      default: 1,
      triggerUpdate: false
    },
    d3AlphaMin: {
      default: 0,
      triggerUpdate: false
    },
    d3AlphaDecay: {
      default: 0.0228,
      triggerUpdate: false,
      onChange(alphaDecay, state) {
        state.forceLayout.alphaDecay(alphaDecay);
      }
    },
    d3AlphaTarget: {
      default: 0,
      triggerUpdate: false,
      onChange(alphaTarget, state) {
        state.forceLayout.alphaTarget(alphaTarget);
      }
    },
    d3VelocityDecay: {
      default: 0.4,
      triggerUpdate: false,
      onChange(velocityDecay, state) {
        state.forceLayout.velocityDecay(velocityDecay);
      }
    },
    warmupTicks: {
      default: 0,
      triggerUpdate: false
    },
    // how many times to tick the force engine at init before starting to render
    cooldownTicks: {
      default: Infinity,
      triggerUpdate: false
    },
    cooldownTime: {
      default: 15000,
      triggerUpdate: false
    },
    // ms
    onUpdate: {
      default: () => {},
      triggerUpdate: false
    },
    onFinishUpdate: {
      default: () => {},
      triggerUpdate: false
    },
    onEngineTick: {
      default: () => {},
      triggerUpdate: false
    },
    onEngineStop: {
      default: () => {},
      triggerUpdate: false
    },
    onNeedsRedraw: {
      triggerUpdate: false
    },
    isShadow: {
      default: false,
      triggerUpdate: false
    }
  },
  methods: {
    // Expose d3 forces for external manipulation
    d3Force: function (state, forceName, forceFn) {
      if (forceFn === undefined) {
        return state.forceLayout.force(forceName); // Force getter
      }

      state.forceLayout.force(forceName, forceFn); // Force setter
      return this;
    },
    d3ReheatSimulation: function (state) {
      state.forceLayout.alpha(1);
      this.resetCountdown();
      return this;
    },
    // reset cooldown state
    resetCountdown: function (state) {
      state.cntTicks = 0;
      state.startTickTime = new Date();
      state.engineRunning = true;
      return this;
    },
    isEngineRunning: state => !!state.engineRunning,
    tickFrame: function (state) {
      !state.isShadow && layoutTick();
      paintLinks();
      !state.isShadow && paintArrows();
      !state.isShadow && paintPhotons();
      paintNodes();
      return this;

      //

      function layoutTick() {
        if (state.engineRunning) {
          if (++state.cntTicks > state.cooldownTicks || new Date() - state.startTickTime > state.cooldownTime || state.d3AlphaMin > 0 && state.forceLayout.alpha() < state.d3AlphaMin) {
            state.engineRunning = false; // Stop ticking graph
            state.onEngineStop();
          } else {
            state.forceLayout.tick(); // Tick it
            state.onEngineTick();
          }
        }
      }
      function paintNodes() {
        const getVisibility = accessorFn(state.nodeVisibility);
        const getVal = accessorFn(state.nodeVal);
        const getColor = accessorFn(state.nodeColor);
        const getNodeCanvasObjectMode = accessorFn(state.nodeCanvasObjectMode);
        const ctx = state.ctx;

        // Draw wider nodes by 1px on shadow canvas for more precise hovering (due to boundary anti-aliasing)
        const padAmount = state.isShadow / state.globalScale;
        const visibleNodes = state.graphData.nodes.filter(getVisibility);
        ctx.save();
        visibleNodes.forEach(node => {
          const nodeCanvasObjectMode = getNodeCanvasObjectMode(node);
          if (state.nodeCanvasObject && (nodeCanvasObjectMode === 'before' || nodeCanvasObjectMode === 'replace')) {
            // Custom node before/replace paint
            state.nodeCanvasObject(node, ctx, state.globalScale);
            if (nodeCanvasObjectMode === 'replace') {
              ctx.restore();
              return;
            }
          }

          // Draw wider nodes by 1px on shadow canvas for more precise hovering (due to boundary anti-aliasing)
          const r = Math.sqrt(Math.max(0, getVal(node) || 1)) * state.nodeRelSize + padAmount;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = getColor(node) || 'rgba(31, 120, 180, 0.92)';
          ctx.fill();
          if (state.nodeCanvasObject && nodeCanvasObjectMode === 'after') {
            // Custom node after paint
            state.nodeCanvasObject(node, state.ctx, state.globalScale);
          }
        });
        ctx.restore();
      }
      function paintLinks() {
        const getVisibility = accessorFn(state.linkVisibility);
        const getColor = accessorFn(state.linkColor);
        const getWidth = accessorFn(state.linkWidth);
        const getLineDash = accessorFn(state.linkLineDash);
        const getCurvature = accessorFn(state.linkCurvature);
        const getLinkCanvasObjectMode = accessorFn(state.linkCanvasObjectMode);
        const ctx = state.ctx;

        // Draw wider lines by 2px on shadow canvas for more precise hovering (due to boundary anti-aliasing)
        const padAmount = state.isShadow * 2;
        const visibleLinks = state.graphData.links.filter(getVisibility);
        visibleLinks.forEach(calcLinkControlPoints); // calculate curvature control points for all visible links

        let beforeCustomLinks = [],
          afterCustomLinks = [],
          defaultPaintLinks = visibleLinks;
        if (state.linkCanvasObject) {
          const replaceCustomLinks = [],
            otherCustomLinks = [];
          visibleLinks.forEach(d => (({
            before: beforeCustomLinks,
            after: afterCustomLinks,
            replace: replaceCustomLinks
          })[getLinkCanvasObjectMode(d)] || otherCustomLinks).push(d));
          defaultPaintLinks = [...beforeCustomLinks, ...afterCustomLinks, ...otherCustomLinks];
          beforeCustomLinks = beforeCustomLinks.concat(replaceCustomLinks);
        }

        // Custom link before paints
        ctx.save();
        beforeCustomLinks.forEach(link => state.linkCanvasObject(link, ctx, state.globalScale));
        ctx.restore();

        // Bundle strokes per unique color/width/dash for performance optimization
        const linksPerColor = indexBy(defaultPaintLinks, [getColor, getWidth, getLineDash]);
        ctx.save();
        Object.entries(linksPerColor).forEach(([color, linksPerWidth]) => {
          const lineColor = !color || color === 'undefined' ? 'rgba(0,0,0,0.15)' : color;
          Object.entries(linksPerWidth).forEach(([width, linesPerLineDash]) => {
            const lineWidth = (width || 1) / state.globalScale + padAmount;
            Object.entries(linesPerLineDash).forEach(([dashSegments, links]) => {
              const lineDashSegments = getLineDash(links[0]);
              ctx.beginPath();
              links.forEach(link => {
                const start = link.source;
                const end = link.target;
                if (!start || !end || !start.hasOwnProperty('x') || !end.hasOwnProperty('x')) return; // skip invalid link

                ctx.moveTo(start.x, start.y);
                const controlPoints = link.__controlPoints;
                if (!controlPoints) {
                  // Straight line
                  ctx.lineTo(end.x, end.y);
                } else {
                  // Use quadratic curves for regular lines and bezier for loops
                  ctx[controlPoints.length === 2 ? 'quadraticCurveTo' : 'bezierCurveTo'](...controlPoints, end.x, end.y);
                }
              });
              ctx.strokeStyle = lineColor;
              ctx.lineWidth = lineWidth;
              ctx.setLineDash(lineDashSegments || []);
              ctx.stroke();
            });
          });
        });
        ctx.restore();

        // Custom link after paints
        ctx.save();
        afterCustomLinks.forEach(link => state.linkCanvasObject(link, ctx, state.globalScale));
        ctx.restore();

        //

        function calcLinkControlPoints(link) {
          const curvature = getCurvature(link);
          if (!curvature) {
            // straight line
            link.__controlPoints = null;
            return;
          }
          const start = link.source;
          const end = link.target;
          if (!start || !end || !start.hasOwnProperty('x') || !end.hasOwnProperty('x')) return; // skip invalid link

          const l = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)); // line length

          if (l > 0) {
            const a = Math.atan2(end.y - start.y, end.x - start.x); // line angle
            const d = l * curvature; // control point distance

            const cp = {
              // control point
              x: (start.x + end.x) / 2 + d * Math.cos(a - Math.PI / 2),
              y: (start.y + end.y) / 2 + d * Math.sin(a - Math.PI / 2)
            };
            link.__controlPoints = [cp.x, cp.y];
          } else {
            // Same point, draw a loop
            const d = curvature * 70;
            link.__controlPoints = [end.x, end.y - d, end.x + d, end.y];
          }
        }
      }
      function paintArrows() {
        const ARROW_WH_RATIO = 1.6;
        const ARROW_VLEN_RATIO = 0.2;
        const getLength = accessorFn(state.linkDirectionalArrowLength);
        const getRelPos = accessorFn(state.linkDirectionalArrowRelPos);
        const getVisibility = accessorFn(state.linkVisibility);
        const getColor = accessorFn(state.linkDirectionalArrowColor || state.linkColor);
        const getNodeVal = accessorFn(state.nodeVal);
        const ctx = state.ctx;
        ctx.save();
        state.graphData.links.filter(getVisibility).forEach(link => {
          const arrowLength = getLength(link);
          if (!arrowLength || arrowLength < 0) return;
          const start = link.source;
          const end = link.target;
          if (!start || !end || !start.hasOwnProperty('x') || !end.hasOwnProperty('x')) return; // skip invalid link

          const startR = Math.sqrt(Math.max(0, getNodeVal(start) || 1)) * state.nodeRelSize;
          const endR = Math.sqrt(Math.max(0, getNodeVal(end) || 1)) * state.nodeRelSize;
          const arrowRelPos = Math.min(1, Math.max(0, getRelPos(link)));
          const arrowColor = getColor(link) || 'rgba(0,0,0,0.28)';
          const arrowHalfWidth = arrowLength / ARROW_WH_RATIO / 2;

          // Construct bezier for curved lines
          const bzLine = link.__controlPoints && new Bezier(start.x, start.y, ...link.__controlPoints, end.x, end.y);
          const getCoordsAlongLine = bzLine ? t => bzLine.get(t) // get position along bezier line
          : t => ({
            // straight line: interpolate linearly
            x: start.x + (end.x - start.x) * t || 0,
            y: start.y + (end.y - start.y) * t || 0
          });
          const lineLen = bzLine ? bzLine.length() : Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const posAlongLine = startR + arrowLength + (lineLen - startR - endR - arrowLength) * arrowRelPos;
          const arrowHead = getCoordsAlongLine(posAlongLine / lineLen);
          const arrowTail = getCoordsAlongLine((posAlongLine - arrowLength) / lineLen);
          const arrowTailVertex = getCoordsAlongLine((posAlongLine - arrowLength * (1 - ARROW_VLEN_RATIO)) / lineLen);
          const arrowTailAngle = Math.atan2(arrowHead.y - arrowTail.y, arrowHead.x - arrowTail.x) - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(arrowHead.x, arrowHead.y);
          ctx.lineTo(arrowTail.x + arrowHalfWidth * Math.cos(arrowTailAngle), arrowTail.y + arrowHalfWidth * Math.sin(arrowTailAngle));
          ctx.lineTo(arrowTailVertex.x, arrowTailVertex.y);
          ctx.lineTo(arrowTail.x - arrowHalfWidth * Math.cos(arrowTailAngle), arrowTail.y - arrowHalfWidth * Math.sin(arrowTailAngle));
          ctx.fillStyle = arrowColor;
          ctx.fill();
        });
        ctx.restore();
      }
      function paintPhotons() {
        const getNumPhotons = accessorFn(state.linkDirectionalParticles);
        const getSpeed = accessorFn(state.linkDirectionalParticleSpeed);
        const getDiameter = accessorFn(state.linkDirectionalParticleWidth);
        const getVisibility = accessorFn(state.linkVisibility);
        const getColor = accessorFn(state.linkDirectionalParticleColor || state.linkColor);
        const ctx = state.ctx;
        ctx.save();
        state.graphData.links.filter(getVisibility).forEach(link => {
          const numCyclePhotons = getNumPhotons(link);
          if (!link.hasOwnProperty('__photons') || !link.__photons.length) return;
          const start = link.source;
          const end = link.target;
          if (!start || !end || !start.hasOwnProperty('x') || !end.hasOwnProperty('x')) return; // skip invalid link

          const particleSpeed = getSpeed(link);
          const photons = link.__photons || [];
          const photonR = Math.max(0, getDiameter(link) / 2) / Math.sqrt(state.globalScale);
          const photonColor = getColor(link) || 'rgba(0,0,0,0.28)';
          ctx.fillStyle = photonColor;

          // Construct bezier for curved lines
          const bzLine = link.__controlPoints ? new Bezier(start.x, start.y, ...link.__controlPoints, end.x, end.y) : null;
          let cyclePhotonIdx = 0;
          let needsCleanup = false; // whether some photons need to be removed from list
          photons.forEach(photon => {
            const singleHop = !!photon.__singleHop;
            if (!photon.hasOwnProperty('__progressRatio')) {
              photon.__progressRatio = singleHop ? 0 : cyclePhotonIdx / numCyclePhotons;
            }
            !singleHop && cyclePhotonIdx++; // increase regular photon index

            photon.__progressRatio += particleSpeed;
            if (photon.__progressRatio >= 1) {
              if (!singleHop) {
                photon.__progressRatio = photon.__progressRatio % 1;
              } else {
                needsCleanup = true;
                return;
              }
            }
            const photonPosRatio = photon.__progressRatio;
            const coords = bzLine ? bzLine.get(photonPosRatio) // get position along bezier line
            : {
              // straight line: interpolate linearly
              x: start.x + (end.x - start.x) * photonPosRatio || 0,
              y: start.y + (end.y - start.y) * photonPosRatio || 0
            };
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, photonR, 0, 2 * Math.PI, false);
            ctx.fill();
          });
          if (needsCleanup) {
            // remove expired single hop photons
            link.__photons = link.__photons.filter(photon => !photon.__singleHop || photon.__progressRatio <= 1);
          }
        });
        ctx.restore();
      }
    },
    emitParticle: function (state, link) {
      if (link) {
        !link.__photons && (link.__photons = []);
        link.__photons.push({
          __singleHop: true
        }); // add a single hop particle
      }

      return this;
    }
  },
  stateInit: () => ({
    forceLayout: forceSimulation().force('link', forceLink()).force('charge', forceManyBody()).force('center', forceCenter()).force('dagRadial', null).stop(),
    engineRunning: false
  }),
  init(canvasCtx, state) {
    // Main canvas object to manipulate
    state.ctx = canvasCtx;
  },
  update(state) {
    state.engineRunning = false; // Pause simulation
    state.onUpdate();
    if (state.nodeAutoColorBy !== null) {
      // Auto add color to uncolored nodes
      autoColorObjects(state.graphData.nodes, accessorFn(state.nodeAutoColorBy), state.nodeColor);
    }
    if (state.linkAutoColorBy !== null) {
      // Auto add color to uncolored links
      autoColorObjects(state.graphData.links, accessorFn(state.linkAutoColorBy), state.linkColor);
    }

    // parse links
    state.graphData.links.forEach(link => {
      link.source = link[state.linkSource];
      link.target = link[state.linkTarget];
    });

    // Feed data to force-directed layout
    state.forceLayout.stop().alpha(1) // re-heat the simulation
    .nodes(state.graphData.nodes);

    // add links (if link force is still active)
    const linkForce = state.forceLayout.force('link');
    if (linkForce) {
      linkForce.id(d => d[state.nodeId]).links(state.graphData.links);
    }

    // setup dag force constraints
    const nodeDepths = state.dagMode && getDagDepths(state.graphData, node => node[state.nodeId], {
      nodeFilter: state.dagNodeFilter,
      onLoopError: state.onDagError || undefined
    });
    const maxDepth = Math.max(...Object.values(nodeDepths || []));
    const dagLevelDistance = state.dagLevelDistance || state.graphData.nodes.length / (maxDepth || 1) * DAG_LEVEL_NODE_RATIO * (['radialin', 'radialout'].indexOf(state.dagMode) !== -1 ? 0.7 : 1);

    // Fix nodes to x,y for dag mode
    if (state.dagMode) {
      const getFFn = (fix, invert) => node => !fix ? undefined : (nodeDepths[node[state.nodeId]] - maxDepth / 2) * dagLevelDistance * (invert ? -1 : 1);
      const fxFn = getFFn(['lr', 'rl'].indexOf(state.dagMode) !== -1, state.dagMode === 'rl');
      const fyFn = getFFn(['td', 'bu'].indexOf(state.dagMode) !== -1, state.dagMode === 'bu');
      state.graphData.nodes.filter(state.dagNodeFilter).forEach(node => {
        node.fx = fxFn(node);
        node.fy = fyFn(node);
      });
    }

    // Use radial force for radial dags
    state.forceLayout.force('dagRadial', ['radialin', 'radialout'].indexOf(state.dagMode) !== -1 ? forceRadial(node => {
      const nodeDepth = nodeDepths[node[state.nodeId]] || -1;
      return (state.dagMode === 'radialin' ? maxDepth - nodeDepth : nodeDepth) * dagLevelDistance;
    }).strength(node => state.dagNodeFilter(node) ? 1 : 0) : null);
    for (let i = 0; i < state.warmupTicks && !(state.d3AlphaMin > 0 && state.forceLayout.alpha() < state.d3AlphaMin); i++) {
      state.forceLayout.tick();
    } // Initial ticks before starting to render

    this.resetCountdown();
    state.onFinishUpdate();
  }
});

function linkKapsule (kapsulePropNames, kapsuleType) {
  const propNames = kapsulePropNames instanceof Array ? kapsulePropNames : [kapsulePropNames];
  const dummyK = new kapsuleType(); // To extract defaults

  return {
    linkProp: function (prop) {
      // link property config
      return {
        default: dummyK[prop](),
        onChange(v, state) {
          propNames.forEach(propName => state[propName][prop](v));
        },
        triggerUpdate: false
      };
    },
    linkMethod: function (method) {
      // link method pass-through
      return function (state, ...args) {
        const returnVals = [];
        propNames.forEach(propName => {
          const kapsuleInstance = state[propName];
          const returnVal = kapsuleInstance[method](...args);
          if (returnVal !== kapsuleInstance) {
            returnVals.push(returnVal);
          }
        });
        return returnVals.length ? returnVals[0] : this; // chain based on the parent object, not the inner kapsule
      };
    }
  };
}

const HOVER_CANVAS_THROTTLE_DELAY = 800; // ms to throttle shadow canvas updates for perf improvement
const ZOOM2NODES_FACTOR = 4;

// Expose config from forceGraph
const bindFG = linkKapsule('forceGraph', CanvasForceGraph);
const bindBoth = linkKapsule(['forceGraph', 'shadowGraph'], CanvasForceGraph);
const linkedProps = Object.assign(...['nodeColor', 'nodeAutoColorBy', 'nodeCanvasObject', 'nodeCanvasObjectMode', 'linkColor', 'linkAutoColorBy', 'linkLineDash', 'linkWidth', 'linkCanvasObject', 'linkCanvasObjectMode', 'linkDirectionalArrowLength', 'linkDirectionalArrowColor', 'linkDirectionalArrowRelPos', 'linkDirectionalParticles', 'linkDirectionalParticleSpeed', 'linkDirectionalParticleWidth', 'linkDirectionalParticleColor', 'dagMode', 'dagLevelDistance', 'dagNodeFilter', 'onDagError', 'd3AlphaMin', 'd3AlphaDecay', 'd3VelocityDecay', 'warmupTicks', 'cooldownTicks', 'cooldownTime', 'onEngineTick', 'onEngineStop'].map(p => ({
  [p]: bindFG.linkProp(p)
})), ...['nodeRelSize', 'nodeId', 'nodeVal', 'nodeVisibility', 'linkSource', 'linkTarget', 'linkVisibility', 'linkCurvature'].map(p => ({
  [p]: bindBoth.linkProp(p)
})));
const linkedMethods = Object.assign(...['d3Force', 'd3ReheatSimulation', 'emitParticle'].map(p => ({
  [p]: bindFG.linkMethod(p)
})));
function adjustCanvasSize(state) {
  if (state.canvas) {
    let curWidth = state.canvas.width;
    let curHeight = state.canvas.height;
    if (curWidth === 300 && curHeight === 150) {
      // Default canvas dimensions
      curWidth = curHeight = 0;
    }
    const pxScale = window.devicePixelRatio; // 2 on retina displays
    curWidth /= pxScale;
    curHeight /= pxScale;

    // Resize canvases
    [state.canvas, state.shadowCanvas].forEach(canvas => {
      // Element size
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;

      // Memory size (scaled to avoid blurriness)
      canvas.width = state.width * pxScale;
      canvas.height = state.height * pxScale;

      // Normalize coordinate system to use css pixels (on init only)
      if (!curWidth && !curHeight) {
        canvas.getContext('2d').scale(pxScale, pxScale);
      }
    });

    // Relative center panning based on 0,0
    const k = zoomTransform(state.canvas).k;
    state.zoom.translateBy(state.zoom.__baseElem, (state.width - curWidth) / 2 / k, (state.height - curHeight) / 2 / k);
    state.needsRedraw = true;
  }
}
function resetTransform(ctx) {
  const pxRatio = window.devicePixelRatio;
  ctx.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
}
function clearCanvas(ctx, width, height) {
  ctx.save();
  resetTransform(ctx); // reset transform
  ctx.clearRect(0, 0, width, height);
  ctx.restore(); //restore transforms
}

//

var forceGraph = Kapsule({
  props: {
    width: {
      default: window.innerWidth,
      onChange: (_, state) => adjustCanvasSize(state),
      triggerUpdate: false
    },
    height: {
      default: window.innerHeight,
      onChange: (_, state) => adjustCanvasSize(state),
      triggerUpdate: false
    },
    graphData: {
      default: {
        nodes: [],
        links: []
      },
      onChange: (d, state) => {
        [{
          type: 'Node',
          objs: d.nodes
        }, {
          type: 'Link',
          objs: d.links
        }].forEach(hexIndex);
        state.forceGraph.graphData(d);
        state.shadowGraph.graphData(d);
        function hexIndex({
          type,
          objs
        }) {
          objs.filter(d => {
            if (!d.hasOwnProperty('__indexColor')) return true;
            const cur = state.colorTracker.lookup(d.__indexColor);
            return !cur || !cur.hasOwnProperty('d') || cur.d !== d;
          }).forEach(d => {
            // store object lookup color
            d.__indexColor = state.colorTracker.register({
              type,
              d
            });
          });
        }
      },
      triggerUpdate: false
    },
    backgroundColor: {
      onChange(color, state) {
        state.canvas && color && (state.canvas.style.background = color);
      },
      triggerUpdate: false
    },
    nodeLabel: {
      default: 'name',
      triggerUpdate: false
    },
    nodePointerAreaPaint: {
      onChange(paintFn, state) {
        state.shadowGraph.nodeCanvasObject(!paintFn ? null : (node, ctx, globalScale) => paintFn(node, node.__indexColor, ctx, globalScale));
        state.flushShadowCanvas && state.flushShadowCanvas();
      },
      triggerUpdate: false
    },
    linkPointerAreaPaint: {
      onChange(paintFn, state) {
        state.shadowGraph.linkCanvasObject(!paintFn ? null : (link, ctx, globalScale) => paintFn(link, link.__indexColor, ctx, globalScale));
        state.flushShadowCanvas && state.flushShadowCanvas();
      },
      triggerUpdate: false
    },
    linkLabel: {
      default: 'name',
      triggerUpdate: false
    },
    linkHoverPrecision: {
      default: 4,
      triggerUpdate: false
    },
    minZoom: {
      default: 0.01,
      onChange(minZoom, state) {
        state.zoom.scaleExtent([minZoom, state.zoom.scaleExtent()[1]]);
      },
      triggerUpdate: false
    },
    maxZoom: {
      default: 1000,
      onChange(maxZoom, state) {
        state.zoom.scaleExtent([state.zoom.scaleExtent()[0], maxZoom]);
      },
      triggerUpdate: false
    },
    enableNodeDrag: {
      default: true,
      triggerUpdate: false
    },
    enableZoomInteraction: {
      default: true,
      triggerUpdate: false
    },
    enablePanInteraction: {
      default: true,
      triggerUpdate: false
    },
    enableZoomPanInteraction: {
      default: true,
      triggerUpdate: false
    },
    // to be deprecated
    enablePointerInteraction: {
      default: true,
      onChange(_, state) {
        state.hoverObj = null;
      },
      triggerUpdate: false
    },
    autoPauseRedraw: {
      default: true,
      triggerUpdate: false
    },
    onNodeDrag: {
      default: () => {},
      triggerUpdate: false
    },
    onNodeDragEnd: {
      default: () => {},
      triggerUpdate: false
    },
    onNodeClick: {
      triggerUpdate: false
    },
    onNodeRightClick: {
      triggerUpdate: false
    },
    onNodeHover: {
      triggerUpdate: false
    },
    onLinkClick: {
      triggerUpdate: false
    },
    onLinkRightClick: {
      triggerUpdate: false
    },
    onLinkHover: {
      triggerUpdate: false
    },
    onBackgroundClick: {
      triggerUpdate: false
    },
    onBackgroundRightClick: {
      triggerUpdate: false
    },
    onZoom: {
      triggerUpdate: false
    },
    onZoomEnd: {
      triggerUpdate: false
    },
    onRenderFramePre: {
      triggerUpdate: false
    },
    onRenderFramePost: {
      triggerUpdate: false
    },
    ...linkedProps
  },
  aliases: {
    // Prop names supported for backwards compatibility
    stopAnimation: 'pauseAnimation'
  },
  methods: {
    graph2ScreenCoords: function (state, x, y) {
      const t = zoomTransform(state.canvas);
      return {
        x: x * t.k + t.x,
        y: y * t.k + t.y
      };
    },
    screen2GraphCoords: function (state, x, y) {
      const t = zoomTransform(state.canvas);
      return {
        x: (x - t.x) / t.k,
        y: (y - t.y) / t.k
      };
    },
    centerAt: function (state, x, y, transitionDuration) {
      if (!state.canvas) return null; // no canvas yet

      // setter
      if (x !== undefined || y !== undefined) {
        const finalPos = Object.assign({}, x !== undefined ? {
          x
        } : {}, y !== undefined ? {
          y
        } : {});
        if (!transitionDuration) {
          // no animation
          setCenter(finalPos);
        } else {
          new TWEEN.Tween(getCenter()).to(finalPos, transitionDuration).easing(TWEEN.Easing.Quadratic.Out).onUpdate(setCenter).start();
        }
        return this;
      }

      // getter
      return getCenter();

      //

      function getCenter() {
        const t = zoomTransform(state.canvas);
        return {
          x: (state.width / 2 - t.x) / t.k,
          y: (state.height / 2 - t.y) / t.k
        };
      }
      function setCenter({
        x,
        y
      }) {
        state.zoom.translateTo(state.zoom.__baseElem, x === undefined ? getCenter().x : x, y === undefined ? getCenter().y : y);
        state.needsRedraw = true;
      }
    },
    zoom: function (state, k, transitionDuration) {
      if (!state.canvas) return null; // no canvas yet

      // setter
      if (k !== undefined) {
        if (!transitionDuration) {
          // no animation
          setZoom(k);
        } else {
          new TWEEN.Tween({
            k: getZoom()
          }).to({
            k
          }, transitionDuration).easing(TWEEN.Easing.Quadratic.Out).onUpdate(({
            k
          }) => setZoom(k)).start();
        }
        return this;
      }

      // getter
      return getZoom();

      //

      function getZoom() {
        return zoomTransform(state.canvas).k;
      }
      function setZoom(k) {
        state.zoom.scaleTo(state.zoom.__baseElem, k);
        state.needsRedraw = true;
      }
    },
    zoomToFit: function (state, transitionDuration = 0, padding = 10, ...bboxArgs) {
      const bbox = this.getGraphBbox(...bboxArgs);
      if (bbox) {
        const center = {
          x: (bbox.x[0] + bbox.x[1]) / 2,
          y: (bbox.y[0] + bbox.y[1]) / 2
        };
        const zoomK = Math.max(1e-12, Math.min(1e12, (state.width - padding * 2) / (bbox.x[1] - bbox.x[0]), (state.height - padding * 2) / (bbox.y[1] - bbox.y[0])));
        this.centerAt(center.x, center.y, transitionDuration);
        this.zoom(zoomK, transitionDuration);
      }
      return this;
    },
    getGraphBbox: function (state, nodeFilter = () => true) {
      const getVal = accessorFn(state.nodeVal);
      const getR = node => Math.sqrt(Math.max(0, getVal(node) || 1)) * state.nodeRelSize;
      const nodesPos = state.graphData.nodes.filter(nodeFilter).map(node => ({
        x: node.x,
        y: node.y,
        r: getR(node)
      }));
      return !nodesPos.length ? null : {
        x: [min(nodesPos, node => node.x - node.r), max(nodesPos, node => node.x + node.r)],
        y: [min(nodesPos, node => node.y - node.r), max(nodesPos, node => node.y + node.r)]
      };
    },
    pauseAnimation: function (state) {
      if (state.animationFrameRequestId) {
        cancelAnimationFrame(state.animationFrameRequestId);
        state.animationFrameRequestId = null;
      }
      return this;
    },
    resumeAnimation: function (state) {
      if (!state.animationFrameRequestId) {
        this._animationCycle();
      }
      return this;
    },
    _destructor: function () {
      this.pauseAnimation();
      this.graphData({
        nodes: [],
        links: []
      });
    },
    ...linkedMethods
  },
  stateInit: () => ({
    lastSetZoom: 1,
    zoom: zoom(),
    forceGraph: new CanvasForceGraph(),
    shadowGraph: new CanvasForceGraph().cooldownTicks(0).nodeColor('__indexColor').linkColor('__indexColor').isShadow(true),
    colorTracker: new ColorTracker() // indexed objects for rgb lookup
  }),

  init: function (domNode, state) {
    // Wipe DOM
    domNode.innerHTML = '';

    // Container anchor for canvas and tooltip
    const container = document.createElement('div');
    container.classList.add('force-graph-container');
    container.style.position = 'relative';
    domNode.appendChild(container);
    state.canvas = document.createElement('canvas');
    if (state.backgroundColor) state.canvas.style.background = state.backgroundColor;
    container.appendChild(state.canvas);
    state.shadowCanvas = document.createElement('canvas');

    // Show shadow canvas
    //state.shadowCanvas.style.position = 'absolute';
    //state.shadowCanvas.style.top = '0';
    //state.shadowCanvas.style.left = '0';
    //container.appendChild(state.shadowCanvas);

    const ctx = state.canvas.getContext('2d');
    const shadowCtx = state.shadowCanvas.getContext('2d', {
      willReadFrequently: true
    });
    const pointerPos = {
      x: -1e12,
      y: -1e12
    };
    const getObjUnderPointer = () => {
      let obj = null;
      const pxScale = window.devicePixelRatio;
      const px = pointerPos.x > 0 && pointerPos.y > 0 ? shadowCtx.getImageData(pointerPos.x * pxScale, pointerPos.y * pxScale, 1, 1) : null;
      // Lookup object per pixel color
      px && (obj = state.colorTracker.lookup(px.data));
      return obj;
    };

    // Setup node drag interaction
    select(state.canvas).call(drag().subject(() => {
      if (!state.enableNodeDrag) {
        return null;
      }
      const obj = getObjUnderPointer();
      return obj && obj.type === 'Node' ? obj.d : null; // Only drag nodes
    }).on('start', ev => {
      const obj = ev.subject;
      obj.__initialDragPos = {
        x: obj.x,
        y: obj.y,
        fx: obj.fx,
        fy: obj.fy
      };

      // keep engine running at low intensity throughout drag
      if (!ev.active) {
        obj.fx = obj.x;
        obj.fy = obj.y; // Fix points
      }

      // drag cursor
      state.canvas.classList.add('grabbable');
    }).on('drag', ev => {
      const obj = ev.subject;
      const initPos = obj.__initialDragPos;
      const dragPos = ev;
      const k = zoomTransform(state.canvas).k;
      const translate = {
        x: initPos.x + (dragPos.x - initPos.x) / k - obj.x,
        y: initPos.y + (dragPos.y - initPos.y) / k - obj.y
      };

      // Move fx/fy (and x/y) of nodes based on the scaled drag distance since the drag start
      ['x', 'y'].forEach(c => obj[`f${c}`] = obj[c] = initPos[c] + (dragPos[c] - initPos[c]) / k);

      // prevent freeze while dragging
      state.forceGraph.d3AlphaTarget(0.3) // keep engine running at low intensity throughout drag
      .resetCountdown(); // prevent freeze while dragging

      state.isPointerDragging = true;
      obj.__dragged = true;
      state.onNodeDrag(obj, translate);
    }).on('end', ev => {
      const obj = ev.subject;
      const initPos = obj.__initialDragPos;
      const translate = {
        x: obj.x - initPos.x,
        y: obj.y - initPos.y
      };
      if (initPos.fx === undefined) {
        obj.fx = undefined;
      }
      if (initPos.fy === undefined) {
        obj.fy = undefined;
      }
      delete obj.__initialDragPos;
      if (state.forceGraph.d3AlphaTarget()) {
        state.forceGraph.d3AlphaTarget(0) // release engine low intensity
        .resetCountdown(); // let the engine readjust after releasing fixed nodes
      }

      // drag cursor
      state.canvas.classList.remove('grabbable');
      state.isPointerDragging = false;
      if (obj.__dragged) {
        delete obj.__dragged;
        state.onNodeDragEnd(obj, translate);
      }
    }));

    // Setup zoom / pan interaction
    state.zoom(state.zoom.__baseElem = select(state.canvas)); // Attach controlling elem for easy access

    state.zoom.__baseElem.on('dblclick.zoom', null); // Disable double-click to zoom

    state.zoom.filter(ev =>
    // disable zoom interaction
    !ev.button && state.enableZoomPanInteraction && (state.enableZoomInteraction || ev.type !== 'wheel') && (state.enablePanInteraction || ev.type === 'wheel')).on('zoom', ev => {
      const t = ev.transform;
      [ctx, shadowCtx].forEach(c => {
        resetTransform(c);
        c.translate(t.x, t.y);
        c.scale(t.k, t.k);
      });
      state.onZoom && state.onZoom({
        ...t,
        ...this.centerAt()
      }); // report x,y coordinates relative to canvas center
      state.needsRedraw = true;
    }).on('end', ev => state.onZoomEnd && state.onZoomEnd({
      ...ev.transform,
      ...this.centerAt()
    }));
    adjustCanvasSize(state);
    state.forceGraph.onNeedsRedraw(() => state.needsRedraw = true).onFinishUpdate(() => {
      // re-zoom, if still in default position (not user modified)
      if (zoomTransform(state.canvas).k === state.lastSetZoom && state.graphData.nodes.length) {
        state.zoom.scaleTo(state.zoom.__baseElem, state.lastSetZoom = ZOOM2NODES_FACTOR / Math.cbrt(state.graphData.nodes.length));
        state.needsRedraw = true;
      }
    });

    // Setup tooltip
    const toolTipElem = document.createElement('div');
    toolTipElem.classList.add('graph-tooltip');
    container.appendChild(toolTipElem);

    // Capture pointer coords on move or touchstart
    ['pointermove', 'pointerdown'].forEach(evType => container.addEventListener(evType, ev => {
      if (evType === 'pointerdown') {
        state.isPointerPressed = true; // track click state
        state.pointerDownEvent = ev;
      }

      // detect pointer drag on canvas pan
      !state.isPointerDragging && ev.type === 'pointermove' && state.onBackgroundClick // only bother detecting drags this way if background clicks are enabled (so they don't trigger accidentally on canvas panning)
      && (ev.pressure > 0 || state.isPointerPressed) // ev.pressure always 0 on Safari, so we use the isPointerPressed tracker
      && (ev.pointerType !== 'touch' || ev.movementX === undefined || [ev.movementX, ev.movementY].some(m => Math.abs(m) > 1)) // relax drag trigger sensitivity on touch events
      && (state.isPointerDragging = true);

      // update the pointer pos
      const offset = getOffset(container);
      pointerPos.x = ev.pageX - offset.left;
      pointerPos.y = ev.pageY - offset.top;

      // Move tooltip
      toolTipElem.style.top = `${pointerPos.y}px`;
      toolTipElem.style.left = `${pointerPos.x}px`;

      // adjust horizontal position to not exceed canvas boundaries
      toolTipElem.style.transform = `translate(-${pointerPos.x / state.width * 100}%, ${
      // flip to above if near bottom
      state.height - pointerPos.y < 100 ? 'calc(-100% - 8px)' : '21px'})`;

      //

      function getOffset(el) {
        const rect = el.getBoundingClientRect(),
          scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
          scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return {
          top: rect.top + scrollTop,
          left: rect.left + scrollLeft
        };
      }
    }, {
      passive: true
    }));

    // Handle click/touch events on nodes/links
    container.addEventListener('pointerup', ev => {
      state.isPointerPressed = false;
      if (state.isPointerDragging) {
        state.isPointerDragging = false;
        return; // don't trigger click events after pointer drag (pan / node drag functionality)
      }

      const cbEvents = [ev, state.pointerDownEvent];
      requestAnimationFrame(() => {
        // trigger click events asynchronously, to allow hoverObj to be set (on frame)
        if (ev.button === 0) {
          // mouse left-click or touch
          if (state.hoverObj) {
            const fn = state[`on${state.hoverObj.type}Click`];
            fn && fn(state.hoverObj.d, ...cbEvents);
          } else {
            state.onBackgroundClick && state.onBackgroundClick(...cbEvents);
          }
        }
        if (ev.button === 2) {
          // mouse right-click
          if (state.hoverObj) {
            const fn = state[`on${state.hoverObj.type}RightClick`];
            fn && fn(state.hoverObj.d, ...cbEvents);
          } else {
            state.onBackgroundRightClick && state.onBackgroundRightClick(...cbEvents);
          }
        }
      });
    }, {
      passive: true
    });
    container.addEventListener('contextmenu', ev => {
      if (!state.onBackgroundRightClick && !state.onNodeRightClick && !state.onLinkRightClick) return true; // default contextmenu behavior
      ev.preventDefault();
      return false;
    });
    state.forceGraph(ctx);
    state.shadowGraph(shadowCtx);

    //

    const refreshShadowCanvas = throttle(() => {
      // wipe canvas
      clearCanvas(shadowCtx, state.width, state.height);

      // Adjust link hover area
      state.shadowGraph.linkWidth(l => accessorFn(state.linkWidth)(l) + state.linkHoverPrecision);

      // redraw
      const t = zoomTransform(state.canvas);
      state.shadowGraph.globalScale(t.k).tickFrame();
    }, HOVER_CANVAS_THROTTLE_DELAY);
    state.flushShadowCanvas = refreshShadowCanvas.flush; // hook to immediately invoke shadow canvas paint

    // Kick-off renderer
    (this._animationCycle = function animate() {
      // IIFE
      const doRedraw = !state.autoPauseRedraw || !!state.needsRedraw || state.forceGraph.isEngineRunning() || state.graphData.links.some(d => d.__photons && d.__photons.length);
      state.needsRedraw = false;
      if (state.enablePointerInteraction) {
        // Update tooltip and trigger onHover events
        const obj = !state.isPointerDragging ? getObjUnderPointer() : null; // don't hover during drag
        if (obj !== state.hoverObj) {
          const prevObj = state.hoverObj;
          const prevObjType = prevObj ? prevObj.type : null;
          const objType = obj ? obj.type : null;
          if (prevObjType && prevObjType !== objType) {
            // Hover out
            const fn = state[`on${prevObjType}Hover`];
            fn && fn(null, prevObj.d);
          }
          if (objType) {
            // Hover in
            const fn = state[`on${objType}Hover`];
            fn && fn(obj.d, prevObjType === objType ? prevObj.d : null);
          }
          const tooltipContent = obj ? accessorFn(state[`${obj.type.toLowerCase()}Label`])(obj.d) || '' : '';
          toolTipElem.style.visibility = tooltipContent ? 'visible' : 'hidden';
          toolTipElem.innerHTML = tooltipContent;

          // set pointer if hovered object is clickable
          state.canvas.classList[obj && state[`on${objType}Click`] || !obj && state.onBackgroundClick ? 'add' : 'remove']('clickable');
          state.hoverObj = obj;
        }
        doRedraw && refreshShadowCanvas();
      }
      if (doRedraw) {
        // Wipe canvas
        clearCanvas(ctx, state.width, state.height);

        // Frame cycle
        const globalScale = zoomTransform(state.canvas).k;
        state.onRenderFramePre && state.onRenderFramePre(ctx, globalScale);
        state.forceGraph.globalScale(globalScale).tickFrame();
        state.onRenderFramePost && state.onRenderFramePost(ctx, globalScale);
      }
      TWEEN.update(); // update canvas animation tweens

      state.animationFrameRequestId = requestAnimationFrame(animate);
    })();
  },
  update: function updateFn(state) {}
});

export { forceGraph as default };
