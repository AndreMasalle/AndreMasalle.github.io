(() => {
  const svg = document.getElementById('kmPlot');
  const W = 480, H = 320;
  const M = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  // Cluster palette
  const COLORS = [
    { fill: '#5b8def', glow: 'rgba(91,141,239,0.35)' },   // blue
    { fill: '#c08bff', glow: 'rgba(192,139,255,0.35)' },  // purple
    { fill: '#4ade80', glow: 'rgba(74,222,128,0.35)' },   // green
    { fill: '#fb7185', glow: 'rgba(251,113,133,0.35)' },  // pink
    { fill: '#fbbf24', glow: 'rgba(251,191,36,0.35)' }    // amber
  ];

  // Defs
  const defs = el('defs');
  // Point radial gradient
  const gradPt = el('radialGradient', { id: 'kmPt', cx: '35%', cy: '35%' });
  gradPt.append(
    el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.85' }),
    el('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' })
  );
  defs.append(gradPt);
  svg.append(defs);

  // Layers
  const gGrid = el('g');
  const gHulls = el('g');
  const gLine = el('g');   // centroid-to-point faint lines
  const gPts = el('g');
  const gCentroids = el('g');
  svg.append(gGrid, gHulls, gLine, gPts, gCentroids);

  // Scales
  const xScale = x => M.left + x * innerW;
  const yScale = y => M.top + (1 - y) * innerH;
  const xInv = px => (px - M.left) / innerW;
  const yInv = py => 1 - (py - M.top) / innerH;

  // Grid
  (function drawGrid() {
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      gGrid.append(el('line', {
        x1: xScale(t), y1: M.top, x2: xScale(t), y2: M.top + innerH,
        stroke: 'rgba(255,255,255,0.04)', 'stroke-width': 1
      }));
      gGrid.append(el('line', {
        x1: M.left, y1: yScale(t), x2: M.left + innerW, y2: yScale(t),
        stroke: 'rgba(255,255,255,0.04)', 'stroke-width': 1
      }));
    }
  })();

  // State
  let points = [];
  let K = 3;
  let assignments = [];
  let centroids = [];
  let iterations = 0;

  // Seed points (3 visible clusters)
  const seeds = [
    {x:0.15,y:0.20},{x:0.22,y:0.15},{x:0.18,y:0.28},{x:0.28,y:0.22},
    {x:0.75,y:0.78},{x:0.82,y:0.72},{x:0.70,y:0.85},{x:0.85,y:0.80},
    {x:0.50,y:0.40},{x:0.55,y:0.35},{x:0.45,y:0.45}
  ];

  // K-Means with k-means++ init
  function kmeans(pts, k, maxIter = 30) {
    const n = pts.length;
    if (n === 0) return { assignments: [], centroids: [], iterations: 0, inertia: 0 };
    const kk = Math.min(k, n);

    // k-means++ init
    const cents = [];
    cents.push({ ...pts[Math.floor(Math.random() * n)] });
    while (cents.length < kk) {
      const dists = pts.map(p => {
        let minD = Infinity;
        for (const c of cents) {
          const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
          if (d < minD) minD = d;
        }
        return minD;
      });
      const total = dists.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < n; i++) {
        r -= dists[i];
        if (r <= 0) { idx = i; break; }
      }
      cents.push({ ...pts[idx] });
    }

    let asgn = new Array(n).fill(0);
    let iter = 0;
    let converged = false;

    while (iter < maxIter && !converged) {
      iter++;
      // Assign
      const newAsgn = pts.map(p => {
        let best = 0, bestD = Infinity;
        cents.forEach((c, i) => {
          const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        });
        return best;
      });

      // Check convergence
      converged = newAsgn.every((v, i) => v === asgn[i]);
      asgn = newAsgn;

      // Update
      const sums = Array.from({ length: kk }, () => ({ x: 0, y: 0, n: 0 }));
      pts.forEach((p, i) => {
        const c = asgn[i];
        sums[c].x += p.x;
        sums[c].y += p.y;
        sums[c].n++;
      });
      for (let i = 0; i < kk; i++) {
        if (sums[i].n > 0) {
          cents[i] = { x: sums[i].x / sums[i].n, y: sums[i].y / sums[i].n };
        } else {
          cents[i] = { ...pts[Math.floor(Math.random() * n)] };
        }
      }
    }

    // Inertia
    let inertia = 0;
    pts.forEach((p, i) => {
      const c = cents[asgn[i]];
      inertia += (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    });

    return { assignments: asgn, centroids: cents, iterations: iter, inertia };
  }

  function runKMeans() {
    const res = kmeans(points, K);
    assignments = res.assignments;
    centroids = res.centroids;
    iterations = res.iterations;
    document.getElementById('kmStatIter').textContent = res.iterations;
    document.getElementById('kmStatInertia').textContent =
      points.length ? res.inertia.toFixed(3) : '–';
  }

  function render() {
    runKMeans();

    // Centroid-to-point lines
    gLine.innerHTML = '';
    points.forEach((p, i) => {
      const c = centroids[assignments[i]];
      if (!c) return;
      const color = COLORS[assignments[i] % COLORS.length];
      gLine.append(el('line', {
        x1: xScale(p.x), y1: yScale(p.y),
        x2: xScale(c.x), y2: yScale(c.y),
        stroke: color.fill, 'stroke-width': 1,
        'stroke-opacity': 0.15
      }));
    });

    // Points
    gPts.innerHTML = '';
    points.forEach((p, i) => {
      const color = COLORS[assignments[i] % COLORS.length];
      const g = el('g', { 'data-idx': i, style: 'cursor:pointer' });

      // Outer glow
      g.append(el('circle', {
        cx: xScale(p.x), cy: yScale(p.y), r: 9,
        fill: color.glow
      }));

      // Main point
      g.append(el('circle', {
        cx: xScale(p.x), cy: yScale(p.y), r: 5,
        fill: color.fill,
        stroke: '#0c121e', 'stroke-width': 1.2
      }));

      // Highlight
      g.append(el('circle', {
        cx: xScale(p.x) - 1.5, cy: yScale(p.y) - 1.5, r: 1.6,
        fill: 'rgba(255,255,255,0.85)'
      }));

      gPts.append(g);
    });

    // Centroids
    gCentroids.innerHTML = '';
    centroids.forEach((c, i) => {
      const color = COLORS[i % COLORS.length];
      const g = el('g');

      // Pulsing ring
      const ring = el('circle', {
        cx: xScale(c.x), cy: yScale(c.y), r: 10,
        fill: 'none',
        stroke: color.fill, 'stroke-width': 1.5,
        'stroke-opacity': 0.7
      });
      const anim = el('animate', {
        attributeName: 'r',
        values: '10;16;10',
        dur: '2s',
        repeatCount: 'indefinite'
      });
      const animOp = el('animate', {
        attributeName: 'stroke-opacity',
        values: '0.7;0;0.7',
        dur: '2s',
        repeatCount: 'indefinite'
      });
      ring.append(anim, animOp);
      g.append(ring);

      // Centroid marker (diamond-ish)
      g.append(el('circle', {
        cx: xScale(c.x), cy: yScale(c.y), r: 8,
        fill: color.fill,
        stroke: '#ffffff', 'stroke-width': 1.5,
        filter: `drop-shadow(0 0 8px ${color.fill})`
      }));

      // X mark
      const cx = xScale(c.x), cy = yScale(c.y);
      g.append(el('path', {
        d: `M ${cx-3} ${cy} L ${cx+3} ${cy} M ${cx} ${cy-3} L ${cx} ${cy+3}`,
        stroke: '#0c121e', 'stroke-width': 1.8, 'stroke-linecap': 'round'
      }));

      gCentroids.append(g);
    });

    // Stats
    document.getElementById('kmStatK').textContent = K;
    document.getElementById('kmStatN').textContent = points.length;
  }

  // Coordinate transform
  function toSvg(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  // Click to add point
  svg.addEventListener('click', (e) => {
    if (e.target.closest('g[data-idx]')) return;
    const p = toSvg(e);
    if (p.x < M.left || p.x > M.left + innerW) return;
    if (p.y < M.top  || p.y > M.top + innerH) return;
    const x = xInv(p.x);
    const y = yInv(p.y);
    points.push({ x, y });
    render();
  });

  // Double click to remove
  svg.addEventListener('dblclick', (e) => {
    const g = e.target.closest('g[data-idx]');
    if (!g) return;
    points.splice(parseInt(g.dataset.idx, 10), 1);
    render();
  });

  // K buttons
  document.querySelectorAll('.km-k-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      K = parseInt(btn.dataset.k, 10);
      document.querySelectorAll('.km-k-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  // Reset
  document.getElementById('kmReset').addEventListener('click', () => {
    points = seeds.map(p => ({ ...p }));
    render();
  });

  // Init
  points = seeds.map(p => ({ ...p }));
  render();
})();