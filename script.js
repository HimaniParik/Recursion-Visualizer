function wait(ms){ return new Promise(res => setTimeout(res, ms)); }

/* animate a small tracer circle from (x1,y1) to (x2,y2) over duration (ms) */
function animateTracer(svg, x1, y1, x2, y2, duration, color = '#ffb74d'){
  return new Promise(resolve => {
    const tracer = document.createElementNS('http://www.w3.org/2000/svg','circle');
    tracer.setAttribute('r',6);
    tracer.setAttribute('fill',color);
    tracer.setAttribute('cx', x1);
    tracer.setAttribute('cy', y1);
    svg.appendChild(tracer);

    const start = performance.now();
    function frame(now){
      const t = Math.min(1, (now - start) / duration);
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      tracer.setAttribute('cx', cx);
      tracer.setAttribute('cy', cy);
      if(t < 1) requestAnimationFrame(frame);
      else { svg.removeChild(tracer); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

/* --------- Tree building & layout --------- */
function buildFibTree(n, depth=0){
  if(n <= 1) return {value: n, depth, children: []};
  const left = buildFibTree(n-1, depth+1);
  const right = buildFibTree(n-2, depth+1);
  return {value: n, depth, children: [left, right]};
}

/* assigns x,y to each node; returns next x offset */
function assignX(node, startX, horizontalSpacing, verticalSpacing, radius){
  if(node.children.length === 0){
    node.x = startX;
    node.y = node.depth * verticalSpacing + radius + 20;
    return startX + horizontalSpacing;
  }
  let cur = startX;
  node.children.forEach(ch => cur = assignX(ch, cur, horizontalSpacing, verticalSpacing, radius));
  const first = node.children[0].x;
  const last = node.children[node.children.length - 1].x;
  node.x = (first + last) / 2;
  node.y = node.depth * verticalSpacing + radius + 20;
  return cur;
}

/* center tree horizontally inside svg width */
function shiftTree(node, dx){
  node.x += dx;
  node.children.forEach(ch => shiftTree(ch, dx));
}

/* --------- DOM/SVG helpers --------- */
function createCircle(svg, x, y, r, cls='node-circle'){
  const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', r);
  c.setAttribute('class', cls);
  svg.appendChild(c);
  return c;
}
function createText(svg, x,y, textContent, cls='node-text'){
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('class', cls);
  t.textContent = textContent;
  svg.appendChild(t);
  return t;
}
function createLine(svg, x1,y1,x2,y2){
  const l = document.createElementNS('http://www.w3.org/2000/svg','line');
  l.setAttribute('x1', x1);
  l.setAttribute('y1', y1);
  l.setAttribute('x2', x2);
  l.setAttribute('y2', y2);
  l.setAttribute('class', 'edge');
  l.setAttribute('marker-end','url(#arrowhead)');
  svg.appendChild(l);
  return l;
}

/* compute edge endpoints outside circle to avoid lines cutting through */
function edgeEndpoints(parent, child, radius){
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const x1 = parent.x + (dx/dist) * radius;
  const y1 = parent.y + (dy/dist) * radius;
  const x2 = child.x - (dx/dist) * radius;
  const y2 = child.y - (dy/dist) * radius;
  return {x1,y1,x2,y2};
}

/* --------- Main traversal/draw logic (sequential children left->right) --------- */
async function drawAndTraverse(svg, node, cfg){
  const { radius, highlightDelay, step } = cfg;

  // draw parent node (node.value currently initial)
  const circle = createCircle(svg, node.x, node.y, radius, 'node-circle');
  const text = createText(svg, node.x, node.y, `fib(${node.value})`, 'node-text');

  // highlight parent when visited
  circle.classList.add('node-highlight');
  await wait(highlightDelay);
  circle.classList.remove('node-highlight');

  // traverse children sequentially (left then right)
  for(const child of node.children){
    // animate tracer going down (parent -> child)
    const { x1: startX, y1: startY, x2: endX, y2: endY } = edgeEndpoints(node, child, radius);
    // But child node is not yet present. We'll animate from parent center to child's future position (endX,endY)
    // Move tracer from parent center to child center (end endpoint).
    await animateTracer(svg, node.x, node.y, child.x, child.y, step ? 700 : 140, '#82b1ff');

    // draw child (recursively)
    await drawAndTraverse(svg, child, cfg);

    // after child returns, animate tracer upward from child -> parent to show return
    await animateTracer(svg, child.x, child.y, node.x, node.y, step ? 650 : 120, '#ffb74d');

    // After child has been computed, draw permanent edge (from parent to child endpoints)
    const pts = edgeEndpoints(node, child, radius);
    createLine(svg, pts.x1, pts.y1, pts.x2, pts.y2);
  }

  // after children done, compute parent's value (sum of children)
  if(node.children.length){
    const left = node.children[0].value;
    const right = node.children[1].value;
    node.value = left + right;
    text.textContent = `fib(${node.value}) = ${left} + ${right}`;
    circle.classList.add('node-highlight');
    await wait(highlightDelay);
    circle.classList.remove('node-highlight');
  }

  // finished
  return node.value;
}

/* --------- Control wiring & UI actions --------- */
function loadTemplate(name){
  const ta = document.getElementById('codeInput');
  if(name==='fibonacci'){
    ta.value = `// Fibonacci example\nint fib(int n){\n  if(n<=1) return n;\n  return fib(n-1) + fib(n-2);\n}`;
  } else if(name==='factorial'){
    ta.value = `// Factorial example\nint fact(int n){\n  if(n<=1) return 1;\n  return n * fact(n-1);\n}`;
  } else {
    ta.value = `// N-Queens placeholder (visualization later)`;
  }
}
document.getElementById('templateSelect').addEventListener('change', e => loadTemplate(e.target.value));
document.getElementById('darkToggle').addEventListener('change', e => {
  document.documentElement.classList.toggle('dark', e.target.checked);
  document.body.classList.toggle('dark', e.target.checked);
});

/* main run */
async function runVisualizer(){
  const svg = document.getElementById('treeSVG');
  // clear svg but keep defs
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if(defs) svg.appendChild(defs);

  const n = parseInt(document.getElementById('nValue').value);
  if(n > 5){
  alert("Try values up to 5 for proper visualization.");
  return;
}
  if(Number.isNaN(n) || n < 0){ alert('Enter a non-negative integer for n'); return; }

  // config
  const radius = 42;
  const verticalSpacing = 120;
  const baseHorizontal = 120;      // base horizontal spacing (will be multiplied for larger depth)
  const highlightDelay = document.getElementById('stepToggle').checked ? 700 : 120;
  const step = document.getElementById('stepToggle').checked;

  // build tree structure
  const tree = buildFibTree(n);

  // assign X with dynamic horizontal spacing: increase spacing if depth large so nodes don't overlap
  // we compute max depth to adapt spacing
  function maxDepth(node){ if(!node.children.length) return node.depth; return Math.max(...node.children.map(maxDepth)); }
  const maxD = maxDepth(tree);
  const horizontalSpacing = baseHorizontal + Math.max(0, (maxD - 4) * 40); // expand spacing for deeper trees

  assignX(tree, 60, horizontalSpacing, verticalSpacing, radius);
  const totalWidth = (function measure(node){ // find max x to center
    let maxx = node.x;
    for(const c of node.children) maxx = Math.max(maxx, measure(c));
    return maxx;
  })(tree) + 60;

  // center
  const svgWidth = svg.clientWidth || 1200;
  const shift = (svgWidth - totalWidth) / 2;
  shiftTree(tree, shift);

  // draw background title text at top showing result as it computes
  const titleText = document.getElementById('outputTitle');
  titleText.textContent = `Computing fib(${n})...`;

  // run traversal & drawing
  await drawAndTraverse(svg, tree, { radius, highlightDelay, step });

  titleText.textContent = `fib(${n}) returns ${tree.value}`;
}

/* init */
loadTemplate('fibonacci');