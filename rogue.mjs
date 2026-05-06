function rogue(canvas, mode = '2d') {
    const gl = canvas.getContext('webgl2');
    if (!gl) { console.error("Rogue Error: WebGL2 not supported!"); return; }

    // --- RENDERER MANAGER (Abstraction Layer) ---
    const renderer = {
        program: null,
        locs: {},
        setup() {
            const vs = `#version 300 es
            in vec2 a_position;
            uniform vec2 u_resolution;
            void main() {
                vec2 clipSpace = (a_position / u_resolution * 2.0) - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            }`;

            const fs = `#version 300 es
            precision highp float;
            uniform vec4 u_color;
            out vec4 outColor;
            void main() { outColor = u_color; }`;

            const createS = (type, src) => {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                return s;
            };

            this.program = gl.createProgram();
            gl.attachShader(this.program, createS(gl.VERTEX_SHADER, vs));
            gl.attachShader(this.program, createS(gl.FRAGMENT_SHADER, fs));
            gl.linkProgram(this.program);
            gl.useProgram(this.program);

            this.locs = {
                pos: gl.getAttribLocation(this.program, "a_position"),
                res: gl.getUniformLocation(this.program, "u_resolution"),
                col: gl.getUniformLocation(this.program, "u_color")
            };

            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        },

        draw(x, y, w, h, color, type = gl.TRIANGLES) {
            const x1 = x, x2 = x + w, y1 = y, y2 = y + h;
            const data = type === gl.TRIANGLES 
                ? [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]
                : [x1, y1, x2, y1, x2, y2, x1, y2];

            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
            gl.uniform2f(this.locs.res, canvas.width, canvas.height);
            gl.uniform4fv(this.locs.col, color);
            gl.enableVertexAttribArray(this.locs.pos);
            gl.vertexAttribPointer(this.locs.pos, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(type, 0, data.length / 2);
        },
        drawGrid(camera, spacing = 100) {
        const startX = (camera.x % spacing);
        const startY = (camera.y % spacing);
    
        for (let x = -startX; x < canvas.width; x += spacing) {
            // Draw vertical lines using your existing drawRect with w=1
            this.draw(x, 0, 1, canvas.height, [0.8, 0.8, 0.8, 1]);
        }
        for (let y = -startY; y < canvas.height; y += spacing) {
            // Draw horizontal lines with h=1
            this.draw(0, y, canvas.width, 1, [0.8, 0.8, 0.8, 1]);
        }
}

    };
    renderer.setup();

    // --- ENGINE CLASSES ---
    class Entity {
        constructor(x, y, z = 0, w = 50, h = 50, color = [0, 0, 1, 1]) {
            this.x = x; this.y = y; this.z = z;
            this.width = w; this.height = h;
            this.color = color;
        }
        render(camera = null) {
            const cx = camera ? camera.x : 0;
            const cy = camera ? camera.y : 0;
            renderer.draw(this.x - cx, this.y - cy, this.width, this.height, this.color, gl.TRIANGLES);
        }
        renderHitbox(camera, color = [1, 0, 0, 1]) {
            const cx = camera ? camera.x : 0;
            const cy = camera ? camera.y : 0;
            renderer.draw(this.x - cx, this.y - cy, this.width, this.height, color, gl.LINE_LOOP);
        }
    }
    class UIElement {
        constructor(x, y, w = 100, h = 30, color = [0, 1, 0, 1], bgColor = [0.2, 0.2, 0.2, 1]) {
            this.x = x; this.y = y;
            this.width = w; this.height = h;
            this.color = color;
            this.bgColor = bgColor;
        }
        renderBar(value) {
            value = Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
          
            renderer.draw(this.x, this.y, this.width, this.height, this.bgColor, gl.TRIANGLES); 
            renderer.draw(this.x, this.y, this.width * value, this.height, this.color, gl.TRIANGLES);
        }
        renderSlot() {
            renderer.draw(this.x, this.y, this.width, this.height, this.bgColor, gl.TRIANGLES); 
            renderer.draw(this.x, this.y, this.width, this.height, this.color, gl.LINE_LOOP);
        }
    }
    class Camera {
        constructor(x = 0, y = 0) { this.x = x; this.y = y; }
        attachToEntity(entity, lerpFactor = 0.1) {
            this.x = lerp(this.x, entity.x + (entity.width / 2) - (canvas.width / 2), lerpFactor);
            this.y = lerp(this.y, entity.y + (entity.height / 2) - (canvas.height / 2), lerpFactor);
        }
    }

    class Vec2 {
        constructor(x = 0, y = 0) { this.x = x; this.y = y; }
        normalize() {
            const len = Math.sqrt(this.x * this.x + this.y * this.y);
            if (len > 0) { this.x /= len; this.y /= len; }
            return this;
        }
        set(x, y) {
            this.x = x; 
            this.y = y;
        }
    }
    class Cursor {
        constructor(x = 0, y = 0, width = 10, height = 10, img = null) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.img = img;
        }
        render(camera) {
            if (this.img) {
                const cx = camera ? camera.x : 0;
                const cy = camera ? camera.y : 0;
                if (this.img) { // Ensure image is loaded
                renderer.draw(this.x - cx, this.y - cy, this.img.width, this.img.height, [1, 1, 1, 1], gl.TRIANGLES);
                }
                else {
                    renderer.draw(this.x - cx, this.y - cy, this.width, this.height, [1, 1, 1, 1], gl.TRIANGLES);
                }
            }
        }
        goToMouse(camera) {
            const worldPos = screenToWorld(mouse.x, mouse.y, camera);
            this.x = worldPos.x;
            this.y = worldPos.y;
        }
    }
    class Item {
            constructor(name, img, color = [1, 1, 0, 1]) {
                this.name = name;
                this.img = img; // Image for rendering in inventory
                this.color = color;
            }
            renderInSlot(slot, amount = 1) {
                if (this.img) {
                    renderer.draw(slot.x, slot.y, slot.width, slot.height, [1, 1, 1, 1], gl.TRIANGLES);
                }
                else {
                    renderer.draw(slot.x, slot.y, slot.width, slot.height, this.color, gl.TRIANGLES); // Use item's color
                }
            }

        }
        class Tile {
            constructor(x, y, size, type = 0) {
                this.x = x;
                this.y = y;
                this.size = size;
                this.type = type;
            }
            render(camera) {
                const cx = camera ? camera.x : 0;
                const cy = camera ? camera.y : 0;
            }
        }
        class TileMap {
            constructor(map, tileSize) {
                this.map = map;
                this.tileSize = tileSize;
            }
            //render(camera) {
            //renderer.draw(map)
            //}
        }
    // --- ENGINE FUNCTIONS ---
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    const input = { isPressed: (code) => keys[code] === true };
    //mosue input can be added similarly with event listeners for 'mousedown', 'mouseup', and 'mousemove'
    // Inside mercinary.mjs
const mouse = { 
    x: 0, 
    y: 0, 
    buttons: {} // Store button states here
};

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // 1. Get raw position relative to canvas
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // 2. Scale by DPR to match WebGL resolution
    // This stops the "stuck in top-left" issue on high-res screens
    mouse.x = rawX * dpr;
    mouse.y = rawY * dpr;
});


// Use 'button' (the number) to track which one is pressed
window.addEventListener('mousedown', (e) => { 
    mouse.buttons[e.button] = true; 
});

window.addEventListener('mouseup', (e) => { 
    mouse.buttons[e.button] = false; 
});

// Optional: Prevent the right-click menu from popping up 
// so you can use the right-click for your game!
window.addEventListener('contextmenu', (e) => e.preventDefault());
    //resolotion fix
    function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    // Keep visual size consistent
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);

   function start(gameUpdate) {
    let lastTime = performance.now();
    resize(); // Initial resize to set up canvas dimensions
    function loop(currentTime) {
        // Calculate time passed since last frame in seconds
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Pass 'dt' to your game logic
        if (gameUpdate) gameUpdate(dt);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}


    function boundingBoxCollision(a, b) {
        return (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
    }

    function getSeparation(r1, r2) {
        const dx = (r1.x + r1.width / 2) - (r2.x + r2.width / 2);
        const dy = (r1.y + r1.height / 2) - (r2.y + r2.height / 2);
        const w = (r1.width + r2.width) / 2;
        const h = (r1.height + r2.height) / 2;
        if (Math.abs(dx) <= w && Math.abs(dy) <= h) {
            const cw = w * dy, ch = h * dx;
            if (cw > ch) return (cw > -ch) ? {x:0, y:(h-Math.abs(dy))} : {x:-(w-Math.abs(dx)), y:0};
            else return (cw > -ch) ? {x:(w-Math.abs(dx)), y:0} : {x:0, y:-(h-Math.abs(dy))};
        }
        return null;
    }
    function screenToWorld(x, y, camera) {
    return {
        x: x + camera.x,
        y: y + camera.y
    };
}
    function lerp(s, e, t) { return s + (e - s) * t; }
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    function arrayCollision(sprite, array) {
        for (let i = 0; i < array.length; i++) {
            if (boundingBoxCollision(sprite, array[i])) {
                return i; // Return index of collided object
            }
        }        return -1; // No collision
    }
   function tilemapCollision(x, y, map, tileSize) {
    const gridX = Math.floor(x / tileSize);
    const gridY = Math.floor(y / tileSize);

    // 1. Check if the point is outside the map boundaries
    if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
        return true; // Treat "the void" as a wall
    }

    // 2. Return true if the value is 1 (wall), false if 0 (path)
    return map[gridY][gridX] === 1;
}
    // --- FINAL EXPORT ---
    return {
        gl, start, Entity, Camera, Vec2, Cursor, UIElement, Item, Tile,
        input: { isPressed: (code) => keys[code] === true, mouse: mouse},
        boundingBoxCollision,
        getSeparation,
        lerp,
        wait,
        screenToWorld,
        arrayCollision,
        tilemapCollision,
        renderer : renderer,
    };
}

export default rogue;
