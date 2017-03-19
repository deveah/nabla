
/*
 *   .-----------.
 *   \\          /
 *    \\        /       nabla
 *     \\      /        (c) 2017, Vlad Dumitru <dalv.urtimud@gmail.com>
 *      \\    /         https://github.com/deveah/nabla
 *       \\  /
 *        \\/
 *         '
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a
 *  copy of this software and associated documentation files (the "Software"),
 *  to deal in the Software without restriction, including without limitation
 *  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *  and/or sell copies of the Software, and to permit persons to whom the
 *  Software is furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *  DEALINGS IN THE SOFTWARE.
 */

var LevelGenerator = (function () {
    'use strict';
    
    /*
     *  LevelGenerator(width, height) -- create a level generator for a map
     *  of given width and height measurements
     */
    function LevelGenerator(width, height) {
        this.width = width;
        this.height = height;

        this.voronoi = new Voronoi();
        this.bbox = {xl: 0, xr: width, yt: 0, yb: height};
        this.sites = [];
    };

    /*
     *  distance(x0, y0, x1, y1) -- calculate the distance between two 2d
     *  points, (x0, y0), and (x1, y1)
     */
    LevelGenerator.prototype.distance = function(x0, y0, x1, y1) {
        return Math.sqrt((x0-x1)*(x0-x1) + (y0-y1)*(y0-y1));
    };

    /*
     *  minDistance(vectorList, x, y) -- calculate the smallest distance
     *  between the point (x, y) and any of the points in vectorList
     */
    LevelGenerator.prototype.minDistance = function(vectorList, x, y) {
        var md = this.distance(x, y, vectorList[0].x, vectorList[0].y);

        for (var i = 0; i < vectorList.length; i++) {
            var d = this.distance(x, y, vectorList[i].x, vectorList[i].y);
            if (d < md) {
                md = d;
            }
        }

        return md;
    };

    /*
     *  generate(nSites, minDistance) -- generate a level containing nSites
     *  Voronoi cells, whose centers are at least minDistance apart
     */
    LevelGenerator.prototype.generate = function(nSites, minDistance) {
        /*
         *  generate a random map of points which will be the centers of the
         *  sites of the Voronoi diagram
         */
        for (var i = 0; i < nSites; i++) {
            while (true) {
                var rx = Math.floor(Math.random() * this.width);
                var ry = Math.floor(Math.random() * this.height);

                /*  TODO: should add a maximum number of tries before giving
                 *  up and starting all over again */
                if ((i == 0) ||
                    (this.minDistance(this.sites, rx, ry) > minDistance)) {
                    this.sites.push({x: rx, y: ry});
                    break;
                }
            }
        }

        /*
         *  compute the Voronoi diagram
         */
        var diagram = this.voronoi.compute(this.sites, this.bbox);

        /*
         *  filter out cells which are on the border of the map by marking
         *  them "unusable"
         */
        for (var i = 0; i < diagram.cells.length; i++) {
            var cell = diagram.cells[i];
            cell.usable = true;

            for (var j = 0; j < cell.halfedges.length; j++) {
                var edge = cell.halfedges[j].edge;

                if (edge.lSite == null || edge.rSite == null) {
                    cell.usable = false;
                    continue;
                }

                if (edge.va.x == 0 || edge.va.y == 0 ||
                    edge.vb.x == 0 || edge.vb.y == 0)
                    cell.usable = false;

                if (edge.va.x == this.width || edge.va.y == this.height ||
                    edge.vb.x == this.width || edge.vb.y == this.height)
                    cell.usable = false;
            }
        }

        /*
         *  assign new id's to the cells marked "usable"
         */
        var cellCounter = 0;

        for (var i = 0; i < diagram.cells.length; i++) {
            var cell = diagram.cells[i];

            if (cell.usable) {
                cell.newId = cellCounter;
                cellCounter++;
            }
        }

        /*
         *  find each cell's neighbours and store their post-rearrangement id's
         *  in an array
         */
        for (var i = 0; i < diagram.cells.length; i++) {
            var cell = diagram.cells[i];

            if (!cell.usable)
                continue;

            var neighbours = [];

            for (var j = 0; j < cell.halfedges.length; j++) {
                var he = cell.halfedges[j];

                if (he.edge.lSite.voronoiId == i &&
                    diagram.cells[he.edge.rSite.voronoiId].usable) {
                    neighbours.push(diagram.cells[he.edge.rSite.voronoiId].newId);
                }

                if (he.edge.rSite.voronoiId == i &&
                    diagram.cells[he.edge.lSite.voronoiId].usable) {
                    neighbours.push(diagram.cells[he.edge.lSite.voronoiId].newId);
                }
            }

            cell.newNeighbours = neighbours;
        }

        /*
         *  process the cells' edges so that they contain an array of ordered
         *  segments
         */
        for (var i = 0; i < diagram.cells.length; i++) {
            var cell = diagram.cells[i];

            var processedVertices = [];

            processedVertices.push({
                x:  cell.halfedges[0].getStartpoint().x,
                y:  cell.halfedges[0].getStartpoint().y
            });

            for (var j = 0; j < cell.halfedges.length; j++) {
                processedVertices.push({
                    x:  cell.halfedges[j].getEndpoint().x,
                    y:  cell.halfedges[j].getEndpoint().y
                });
            }

            cell.processedVertices = processedVertices;
        }

        /*
         *  finally, rearrange the cells so that only the "usable" ones are
         *  kept, and only select relevant data from their structure
         */
        var cells = [];
        var counter = 0;

        for (var i = 0; i < diagram.cells.length; i++) {
            if (diagram.cells[i].usable) {
                cells.push({
                    id: counter,
                    site: {
                        x: diagram.cells[i].site.x,
                        y: diagram.cells[i].site.y },
                    vertices: diagram.cells[i].processedVertices,
                    neighbours: diagram.cells[i].newNeighbours
                });

                counter++;
            }
        }
        
        return {cells: cells};
    };

    return LevelGenerator;
})();

var Nabla = (function () {

    /*
     *  Nabla(canvasElement) -- create a new Nabla game instance, using
     *  the given `canvasElement' to render on.
     */
    function Nabla(canvasElement) {
        "use strict";

        this.canvasElement = canvasElement;
        this.canvasContext = this.canvasElement.getContext('2d');

        this.stageWidth = 600;
        this.stageHeight = 300;
        this.aspectRatio = this.stageWidth / this.stageHeight;

        this.canvasElement.width = this.stageWidth;
        this.canvasElement.height = this.stageHeight;

        /*  create a secondary buffer, in order to achieve double-
         *  -buffering */
        this.bufferElement = document.createElement('canvas');
        this.bufferElement.width = this.stageWidth;
        this.bufferElement.height = this.stageHeight;
        this.bufferContext = this.bufferElement.getContext('2d');

        this.startTime = (new Date()).getTime();

        this.preload();
        this.create();
        this.resize();

        /* adapted from: https://github.com/substack/point-in-polygon */
        this.pointInPolygon = function (point, vs) {
            var x = point.x, y = point.y;
            
            var inside = false;
            for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                var xi = vs[i].x, yi = vs[i].y;
                var xj = vs[j].x, yj = vs[j].y;
                
                var intersect = ((yi > y) != (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }

            return inside;
        };

        this.inTitle = true;
    };

    /*
     *  nabla.resize() -- resize the attached canvas to fit nicely into
     *  the browser's window
     */
    Nabla.prototype.resize = function () {
        "use strict";

        this.currentWidth = window.innerWidth * 0.9;
        this.currentHeight = this.currentWidth / this.aspectRatio;
        this.canvasElement.style.width = this.currentWidth + 'px';
        this.canvasElement.style.height = this.currentHeight + 'px';
    };

    Nabla.prototype.preload = function () {
        /*  TODO: preload font to avoid FOUT */
    };
    
    /*
     *  nabla.create() -- create a new level and initialize game session
     *  data
     */
    Nabla.prototype.create = function () {
        "use strict";

        /*  generate level */
        this.levelGenerator = new LevelGenerator(this.stageWidth, this.stageHeight);
        this.level = this.levelGenerator.generate(40, 20);
        this.cells = this.level.cells;

        /*  the center-top informational text */
        this.warningText = '';

        this.globalAlphaAnimation = {
            running: false,
            argument: 1,
            increment: 0.001
        };

        /*  reset all cells' animations */
        for (var i = 0; i < this.level.cells.length; i++) {
            this.cells[i].animation = { kind: 'none' };
        }

        /*  store the polygons' data */
        this.polygons = [];
        for (var i = 0; i < this.cells.length; i++) {
            this.polygons.push(this.cells[i].vertices);
        }

        /*  reset frame counter */
        this.frameCount = 0;
    };

    Nabla.prototype.updateWin = function() {
        this.warningText = '';

        var fadeInAnimation = {
            running: true,
            argument: 0,
            increment: 0.02,
            isDone: (function(x) {
                if (x >= 1) {
                    this.globalAlphaAnimation.running = false;
                    return true;
                }
                return false;
            }).bind(this)
        };

        var fadeOutAnimation = {
            running: true,
            argument: 1,
            increment: -0.02,
            isDone: (function(x) {
                if (x <= 0) {
                    this.create();
                    this.globalAlphaAnimation = fadeInAnimation;
                    return false;
                }
                return false;
            }).bind(this)
        };

        var fadeInAnimation = {
            running: true,
            argument: 0,
            increment: 0.05,
            isDone: (function(x) {
                if (x >= 1) {
                    this.globalAlphaAnimation.running = false;
                    return true;
                }
                return false;
            }).bind(this)
        };

        this.globalAlphaAnimation = fadeOutAnimation;
    };

    Nabla.prototype.processInput = function(ev) {
        "use strict";

        if (this.inTitle) {
            if (ev.type == 'tap' || ev.type == 'press') {
                this.inTitle = false;
                this.globalAlphaAnimation = {
                    running: true,
                    argument: 0,
                    increment: 0.02,
                    isDone: (function(x) {
                        if (x >= 1) {
                            this.globalAlphaAnimation.running = false;
                            return true;
                        }
                        return false;
                    }).bind(this)
                };
            }
        }

        /*  ignore input if level transition fading is taking place */
        if (this.globalAlphaAnimation.running) {
            return;
        }

        /*  calculate actual coordinates in the game stage's coordinate
         *  space */
        var actual_x = (ev.center.x - this.canvasElement.offsetLeft) /
                       (this.currentWidth / this.canvasElement.width),
            actual_y = (ev.center.y - this.canvasElement.offsetTop) /
                       (this.currentHeight / this.canvasElement.height);

        /*  'tap' event catching */
        if (ev.type == 'tap') {

            /*  search for the clicked cell */
            var clickedCell = null;

            for (var i = 0; i < this.cells.length; i++) {
                if (this.pointInPolygon(
                    {x: actual_x, y: actual_y},
                    this.cells[i].vertices)) {
                    clickedCell = i;
                    break;
                }
            }

            if (clickedCell != null) {
                /*  trigger the clicked cell's animation */
                this.cells[clickedCell].animation = {
                    running: true,
                    arg: 0
                };

                /*  rotate between the color palette */
                if (this.cells[clickedCell].color == undefined) {
                    this.cells[clickedCell].color = 0;
                } else {
                    this.cells[clickedCell].color = (this.cells[clickedCell].color + 1) % 4;
                }

                /*  check if the player has done a winning move */
                var win = true;
                var allCellsColored = true;
                var warning = '';
                for (var i = 0; i < this.cells.length; i++) {
                    var cell = this.cells[i];

                    /*  the game can't be won if at least one cell is not
                     *  colored */
                    if (cell.color == undefined) {
                        this.warningText = '';
                        allCellsColored = false;
                    }

                    for (var j = 0; j < cell.neighbours.length; j++) {
                        /*  the game can't be won if at least one pair of
                         *  neighbouring territories have the same color */
                        if (cell.color == this.cells[cell.neighbours[j]].color) {
                            win = false;
                            warning = i + '; ' + cell.neighbours[j];
                        }
                    }
                }

                if (allCellsColored) {
                    if (win) {
                        /*  if all the cells have been colored, and there are
                         *  no game rules broke, transition to the next level */
                        this.updateWin();
                    } else {
                        /*  if all the cells have been colored, but there are
                         *  some game rules broken, show a pair of territories
                         *  that have an invalid color configuration */
                        this.warningText = warning;
                    }
                }
            }
        }

        /*  'press' event catching */
        if (ev.type == 'press') {

            /*  search for the clicked cell */
            var clickedCell = null;

            for (var i = 0; i < this.cells.length; i++) {
                if (this.pointInPolygon(
                    {x: actual_x, y: actual_y},
                    this.cells[i].vertices)) {
                    clickedCell = i;
                    break;
                }
            }

            if (clickedCell != null) {
                /*  reset the cells' color */
                this.cells[clickedCell].color = undefined;
            }
        }
    };

    /*
     *  nabla.update() -- update the game state before rendering
     */
    Nabla.prototype.update = function() {
        "use strict";

        /*  update animations */
        if (this.globalAlphaAnimation.running) {
            this.globalAlphaAnimation.argument += this.globalAlphaAnimation.increment;

            if (this.globalAlphaAnimation.isDone(this.globalAlphaAnimation.argument)) {
                this.globalAlphaAnimation.running = false;
            }
        }

        for (var i = 0; i < this.cells.length; i++) {
            var cell = this.cells[i];

            if (cell.animation.running) {
                cell.animation.arg += 0.5;
            }

            if (cell.animation.arg >= 1) {
                cell.animation.arg = 1;
                cell.animation.running = false;
            }
        }

        this.frameCount++;
    };

    /*
     *  nabla.renderTitle() -- render the title screen
     */
    Nabla.prototype.renderTitle = function() {
        "use strict";

        var currentTime = (new Date()).getTime() - this.startTime;

        this.bufferContext.clearRect(0, 0, this.stageWidth, this.stageHeight);

        /*  render text */
        this.bufferContext.globalAlpha = 1;
        this.bufferContext.font = '72px Old Standard TT';

        var hue = 128 + Math.floor(128 *
            Math.sin(2 * Math.PI * currentTime / (1000 * 60 / 14)));
        var alpha = 0.05 + 0.05 *
            Math.sin(Math.PI + 2 * Math.PI * currentTime / (1000 * 60 / 14));
        this.bufferContext.fillStyle = 'hsl(' + hue + ',100%,50%)';
        this.bufferContext.strokeStyle = 'hsla(' + hue + ',100%,50%,' + alpha + ')';
        this.bufferContext.lineWidth = 100 + 100 *
            Math.sin(2 * Math.PI * currentTime / (1000 * 60 / 14));
        this.bufferContext.lineJoin = 'round';
        this.bufferContext.textAlign = 'center';
        this.bufferContext.fillText('∇', this.stageWidth / 2, this.stageHeight / 2);
        this.bufferContext.strokeText('∇', this.stageWidth / 2, this.stageHeight / 2);

        this.canvasContext.clearRect(0, 0, this.stageWidth, this.stageHeight);
        if (this.globalAlphaAnimation.running) {
            this.canvasContext.fillStyle = 'white';
            this.canvasContext.fillRect(0, 0, this.stageWidth, this.stageHeight);
        }
        this.canvasContext.globalAlpha = this.globalAlphaAnimation.argument;
        this.canvasContext.drawImage(this.bufferElement, 0, 0);
    };

    /*
     *  nabla.renderPlayground() -- render the playground
     */
    Nabla.prototype.renderPlayground = function() {
        "use strict";

        var currentTime = (new Date()).getTime() - this.startTime;

        /*  clear the buffer */
        this.bufferContext.clearRect(0, 0, this.stageWidth, this.stageHeight);

        /*  linear interpolation function, needed below */
        var lerp = function(a, b, x) {
            return (a * x) + b * (1 - x);
        };

        /*  render outlines */
        for (var i = 0; i < this.cells.length; i++) {
            var cell = this.cells[i];

            /*  set the context's render state */
            this.bufferContext.strokeStyle = 'black';
            this.bufferContext.lineWidth = 1.5 + 0.5 *
                Math.sin(2 * Math.PI * (currentTime / (1000 * 60 / 14)));
            this.bufferContext.lineCap = 'round';
            this.bufferContext.setLineDash([10, 7, 1]);

            /*  draw a polygon from following the points contained in this
             *  structure */
            this.bufferContext.beginPath();
            this.bufferContext.moveTo(cell.vertices[0].x, cell.vertices[0].y);
            for (var j = 1; j < cell.vertices.length; j++) {
                this.bufferContext.lineTo(cell.vertices[j].x, cell.vertices[j].y);
            }
            this.bufferContext.stroke();

        }

        /*  render fill */
        for (var i = 0; i < this.cells.length; i++) {
            var cell = this.cells[i];

            /*  set the cell's background color */
            if (cell.color != undefined) {
                if (cell.color == 0) {
                    this.bufferContext.fillStyle = '#f7567c';
                } else if (cell.color == 1) {
                    this.bufferContext.fillStyle = '#f7ef81';
                } else if (cell.color == 2) {
                    this.bufferContext.fillStyle = '#99e1d9';
                } else if (cell.color == 3) {
                    this.bufferContext.fillStyle = '#aeea60';
                }

                this.bufferContext.globalAlpha = cell.animation.arg;
            } else {
                /*  empty cell 'pulsating' animation */
                this.bufferContext.globalAlpha = 0.07 + 0.03 *
                    Math.sin(Math.PI + 2 * Math.PI * currentTime /
                        (1000 * 60 / 14));

                this.bufferContext.fillStyle = 'black';
            }

            /*  start rendering the fill outline */
            this.bufferContext.beginPath();

            /*  interpolate between the points' coordinates and the cell sites'
             *  centers, to create a faux-border */
            this.bufferContext.moveTo(
                lerp(cell.vertices[0].x, cell.site.x * 0.9, 0.9),
                lerp(cell.vertices[0].y, cell.site.y * 0.9, 0.9));
            for (var j = 1; j < cell.vertices.length; j++) {
                this.bufferContext.lineTo(
                    lerp(cell.vertices[j].x, cell.site.x * 0.9, 0.9),
                    lerp(cell.vertices[j].y, cell.site.y * 0.9, 0.9));
            }

            this.bufferContext.closePath();
            this.bufferContext.fill();

            /*  render the animated border of the filled cells */
            this.bufferContext.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.bufferContext.lineCap = 'round';

            this.bufferContext.lineWidth = 75 + 25 *
                Math.sin(Math.PI * 2 * currentTime / (1000 * 60 / 14));
            this.bufferContext.setLineDash([1]);
            this.bufferContext.stroke();

            this.bufferContext.globalAlpha = 1;
        }

        /*  render text */
        this.bufferContext.font = '18px Old Standard TT';
        this.bufferContext.fillStyle = 'rgba(0, 0, 0, 1)';
        this.bufferContext.textAlign = 'center';
        for (var i = 0; i < this.cells.length; i++) {
            var cell = this.cells[i];

            this.bufferContext.fillText(i, cell.site.x, cell.site.y);
        }

        this.bufferContext.textAlign = 'center';
        this.bufferContext.fillText(this.warningText, this.stageWidth / 2, 18);

        /*  render to screen */
        this.canvasContext.clearRect(0, 0, this.stageWidth, this.stageHeight);
        if (this.globalAlphaAnimation.running) {
            this.canvasContext.fillStyle = 'white';
            this.canvasContext.fillRect(0, 0, this.stageWidth, this.stageHeight);
        }
        this.canvasContext.globalAlpha = this.globalAlphaAnimation.argument;
        this.canvasContext.drawImage(this.bufferElement, 0, 0);
    };

    /*
     *  nabla.render() -- render the game screen
     */
    Nabla.prototype.render = function() {
        if (this.inTitle) {
            this.renderTitle();
        } else {
            this.renderPlayground();
        }
    };

    return Nabla;
})();

