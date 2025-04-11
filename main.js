// utils.js
const Utils = {
    gcd(a, b) {
        while (b > 0) [a, b] = [b, a % b];
        return a;
    },
    disp(pos, dir, amount) {
        return { x: pos.x + dir.x * amount, y: pos.y + dir.y * amount };
    },
    computeSquarePositions(pos, dir, index, squareSize, mrg1, mrg2, moveFirst) {
        let s = [index * squareSize];
        if (moveFirst) {
            s.push(s[0] + (index + 1) * mrg1);
            s.push(s[1] + mrg2);
        } else {
            s.push(s[0] + index * mrg1);
            s.push(s[1] + (index === 0 ? 0 : mrg2));
        }
        return s.map(amount => this.disp(pos, dir, amount));
    }
};

// item.js
class Item {
    constructor(a, b) {
        this.a = a;
        this.b = b;
        this.squares = [];
        this.child = null;
        this.border = null;
        this.maxSize = { lx: 0, ly: 0 };
        this.state = 0;
        this.colors = ['#8af', '#f88', '#4f8']; // Màu cho trạng thái
        this.history = []; // Lưu lịch sử bước
    }

    dispose() {
        if (this.child) this.child.dispose();
        this.squares.forEach(square => square.remove());
        if (this.border) this.border.remove();
    }

    splitBorders() {
        this.border.hide();
        this.squares.forEach((square, i) => {
            square.border.show();
            square.bg.fill(this.colors[1]);
        });
        if (this.child) this.child.border.show();
    }

    joinBorders() {
        this.border.show();
        this.squares.forEach((square, i) => {
            square.border.hide();
            square.bg.fill(this.colors[0]);
        });
        if (this.child) this.child.border.hide();
    }

    stepForward() {
        if (this.state === 0) {
            const m = this.squares.length;
            this.history.push({ state: 0, positions: this.squares.map(s => s.positions[0]) });
            this.splitBorders();
            this.squares.forEach((square, i) => {
                moveSquare(square, 1, 100, 0);
                const t = 50 + (m - 1 - i) * 300;
                moveSquare(square, 2, 400, t);
                if (i > 0 || this.child) {
                    square.bg.animate(400, t + 400).opacity(0.2);
                }
                playSound(); // Phát âm thanh
            });
            this.state = 1;
        } else if (this.child) {
            this.child.stepForward();
        }
    }

    stepBackward() {
        if (this.child && this.child.state > 0) {
            this.child.stepBackward();
        } else if (this.state > 0) {
            this.squares.forEach((square, i) => {
                square.bg.animate(400, 0).opacity(1.0);
                moveSquare(square, 0, 200, 0);
                playSound();
            });
            this.joinBorders();
            this.state = 0;
            if (this.history.length > 0) this.history.pop();
        }
    }

    undo() {
        if (this.history.length === 0) return;
        const lastState = this.history.pop();
        this.state = lastState.state;
        this.squares.forEach((square, i) => {
            const pos = lastState.positions[i];
            square.translate(pos.x, pos.y);
            square.bg.opacity(1.0);
            playSound();
        });
        this.joinBorders();
        if (this.child) this.child.undo();
    }

    isCompleted() {
        return this.state > 0 && (!this.child || this.child.isCompleted());
    }

    open() {
        this.state = 1;
        this.splitBorders();
        this.squares.forEach(square => {
            moveSquare(square, 2, 50, 0);
            playSound();
        });
        if (this.child) this.child.open();
    }

    close() {
        this.state = 0;
        this.joinBorders();
        this.squares.forEach(square => {
            moveSquare(square, 0, 50, 0);
            playSound();
        });
        if (this.child) this.child.close();
    }
}

// viewer.js
class Viewer {
    constructor(elementReference, width, height) {
        this.draw = SVG().addTo(elementReference).size(width, height);
        this.unit = 20;
        this.off = { x: 2.5, y: 2.5 };
        this.item = null;
        this.u = 0;
        this.setPattern(this.unit);
    }

    dispose() {
        if (this.pattern) this.pattern.remove();
        if (this.item) this.item.dispose();
        this.pattern = null;
        this.u = 0;
        this.item = null;
    }

    createSquare(sz, m) {
        const group = this.draw.group();
        group.bg = group.rect(sz, sz).fill('#8af').stroke('#8af');
        group.fg = group.rect(sz, sz).fill(this.pattern).stroke('none');
        for (let i = 0; i <= m; i++) {
            const c = sz * i / m;
            [group.line(0, c, sz, c), group.line(c, 0, c, sz)].forEach(line => {
                line.stroke({ width: 0.5, color: '#478' }).addClass('gcd-square');
            });
        }
        group.border = group.rect(sz, sz).fill('none').stroke({ width: 1.5, color: 'black' }).addClass('cuts');
        return group;
    }

    _createItem(a, b) {
        const mrg1 = 5, mrg2 = 40;
        const item = new Item(a, b);
        const g = Utils.gcd(a, b);
        if (a === b) {
            const square = this.createSquare(a * this.u, a / g);
            const lx = this.off.x + a * this.u;
            const ly = this.off.y + b * this.u;
            const x = this.off.x;
            const y = this.off.y;
            square.positions = [{ x, y }, { x, y }, { x, y }];
            square.translate(x, y);
            item.squares.push(square);
            item.maxSize = { lx, ly };
        } else {
            let dir, squareSize, r, m, mg = 1;
            let firstSquarePos = { x: this.off.x, y: this.off.y };
            let mrg3 = mrg2;
            if (a > b) {
                dir = { x: 1, y: 0 };
                squareSize = b * this.u;
                mg = b / g;
                r = a % b;
                m = Math.floor(a / b);
                if (r !== 0) {
                    item.child = this._createItem(a % b, b);
                    firstSquarePos.x = this.off.x + r * this.u;
                    mrg3 = mrg2 + item.child.maxSize.lx - firstSquarePos.x;
                }
            } else {
                dir = { x: 0, y: 1 };
                squareSize = a * this.u;
                mg = a / g;
                r = b % a;
                m = Math.floor(b / a);
                if (r !== 0) {
                    item.child = this._createItem(a, b % a);
                    firstSquarePos.y = this.off.y + r * this.u;
                    mrg3 = mrg2 + item.child.maxSize.ly - firstSquarePos.y;
                }
            }
            for (let i = 0; i < m; i++) {
                const square = this.createSquare(squareSize, mg);
                square.positions = Utils.computeSquarePositions(firstSquarePos, dir, i, squareSize, mrg1, mrg3, item.child != null);
                const p = square.positions[0];
                square.translate(p.x, p.y);
                item.squares.push(square);
            }
            const lx = item.squares[m - 1].positions[2].x + squareSize;
            const ly = item.squares[m - 1].positions[2].y + squareSize;
            item.maxSize = { lx: Math.max(lx, item.child?.maxSize.lx || 0), ly: Math.max(ly, item.child?.maxSize.ly || 0) };
        }
        if (item.child) item.child.border.hide();
        item.border = this.draw.rect(a * this.u, b * this.u).translate(this.off.x, this.off.y).stroke({ width: 1.5, color: 'black' }).fill('none');
        return item;
    }

    createItem(a, b) {
        const sz = Math.max(a, b);
        this.unit = 20;
        this.setPattern(this.unit);
        if (this.item) this.item.dispose();
        this.item = this._createItem(a, b);
        const mrg = 20;
        if (this.item.maxSize.lx > this.draw.width() - mrg || this.item.maxSize.ly > this.draw.height() - mrg) {
            let lx = this.item.maxSize.lx / this.unit;
            let ly = this.item.maxSize.ly / this.unit;
            while (this.unit * lx > this.draw.width() - mrg || this.unit * ly > this.draw.height() - mrg) {
                this.unit -= 4;
            }
            this.setPattern(this.unit);
            this.item.dispose();
            this.item = this._createItem(a, b);
        }
        updateCuts();
        updateGcdSquares();
        return this.item;
    }

    setPattern(u) {
        if (u === this.u) return;
        this.u = u;
        if (this.pattern) this.pattern.remove();
        const d = u * 3 / 20;
        this.pattern = this.draw.pattern(u, u, add => {
            add.rect(u, u).fill('transparent');
            add.circle(u - 2 * d).fill('transparent').stroke('#136').move(d, d);
        });
    }
}

// ui.js
const UI = {
    controlsHtml: `
        <div class="controls">
            <div>
                <label>A: <input type="number" id="A" min="1" max="30" value="20" onchange="UI.updateAB()"></label>
                <label>B: <input type="number" id="B" min="1" max="20" value="6" onchange="UI.updateAB()"></label>
            </div>
            <div>
                <label><input type="checkbox" id="cutsCheck" onclick="UI.updateCuts()"> Hiện đường cắt</label>
                <label><input type="checkbox" id="gcdSquaresCheck" onclick="UI.updateGcdSquares()"> Hiện lưới</label>
            </div>
            <div>
                <button id="stepBackwardBtn" onclick="UI.stepBackward()" disabled class="tooltip" data-tooltip="Quay lại bước trước">Trước</button>
                <button id="stepForwardBtn" onclick="UI.stepForward()" class="tooltip" data-tooltip="Tiến tới bước tiếp theo">Tiếp</button>
                <button id="autoRunBtn" onclick="UI.autoRun()" class="tooltip" data-tooltip="Chạy toàn bộ thuật toán">Tự động</button>
                <button id="undoBtn" onclick="UI.undo()" disabled class="tooltip" data-tooltip="Hoàn tác bước trước">Hoàn tác</button>
                <button id="darkModeBtn" onclick="UI.toggleDarkMode()" class="tooltip" data-tooltip="Chuyển sáng/tối">Sáng/Tối</button>
            </div>
            <div id="output" style="font-size: 18px;"></div>
            <div id="output2" style="font-size: 18px;"></div>
        </div>
        <div id="drawing"></div>
    `,
    initialize() {
        const styleEl = document.createElement('style');
        document.head.appendChild(styleEl);
        styleEl.sheet.insertRule(`
            .controls {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 20px;
                background: #f0f0f0;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                transition: background 0.3s, color 0.3s;
            }
            .controls.dark {
                background: #333;
                color: #fff;
            }
            button {
                padding: 10px;
                border: none;
                background: #007bff;
                color: white;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.2s;
            }
            button:hover {
                background: #0056b3;
            }
            button:disabled {
                background: #cccccc;
                cursor: not-allowed;
            }
            input[type="number"] {
                width: 60px;
                padding: 5px;
                border-radius: 5px;
                border: 1px solid #ccc;
            }
            .tooltip {
                position: relative;
            }
            .tooltip:hover::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                padding: 5px;
                border-radius: 3px;
                white-space: nowrap;
                z-index: 10;
            }
            #drawing svg {
                border: solid 1px black;
                border-radius: 5px;
            }
        `, 0);

        const animationDiv = document.getElementById('animation');
        animationDiv.style.display = 'flex';
        animationDiv.style.flexDirection = 'row';
        animationDiv.innerHTML = this.controlsHtml;
        this.viewer = new Viewer('#drawing', 620, 620);
        this.updateAB();
    },
    updateButtonsState() {
        const forwardBtn = document.getElementById('stepForwardBtn');
        const backwardBtn = document.getElementById('stepBackwardBtn');
        const undoBtn = document.getElementById('undoBtn');
        const autoRunBtn = document.getElementById('autoRunBtn');
        if (!this.viewer?.item) {
            forwardBtn.disabled = backwardBtn.disabled = undoBtn.disabled = autoRunBtn.disabled = true;
        } else {
            forwardBtn.disabled = this.viewer.item.isCompleted();
            backwardBtn.disabled = this.viewer.item.state === 0;
            undoBtn.disabled = !this.viewer.item.history.length;
            autoRunBtn.disabled = this.viewer.item.isCompleted();
        }
    },
    stepForward() {
        if (this.viewer?.item) {
            this.viewer.item.stepForward();
            this.updateStatusMessage();
            this.updateButtonsState();
        }
    },
    stepBackward() {
        if (this.viewer?.item) {
            this.viewer.item.stepBackward();
            this.updateStatusMessage();
            this.updateButtonsState();
        }
    },
    undo() {
        if (this.viewer?.item) {
            this.viewer.item.undo();
            this.updateStatusMessage();
            this.updateButtonsState();
        }
    },
    autoRun() {
        const item = this.viewer?.item;
        if (!item || item.isCompleted()) return;
        item.stepForward();
        this.updateStatusMessage();
        this.updateButtonsState();
        if (!item.isCompleted()) {
            setTimeout(() => this.autoRun(), 1000);
        }
    },
    updateCuts() {
        const selector = SVG.find('.cuts');
        if (document.getElementById('cutsCheck').checked) {
            selector.show();
        } else {
            selector.hide();
        }
    },
    updateGcdSquares() {
        const selector = SVG.find('.gcd-square');
        if (document.getElementById('gcdSquaresCheck').checked) {
            selector.show();
        } else {
            selector.hide();
        }
    },
    updateStatusMessage() {
        const output = document.getElementById('output');
        let msg = '';
        let item = this.viewer.item;
        while (item) {
            const { a, b } = item;
            msg += `${Utils.gcd(a, b)} = GCD(${a}, ${b})<br>`;
            if (item.state === 0) break;
            item = item.child;
        }
        output.innerHTML = msg;

        const output2 = document.getElementById('output2');
        const equationSvg = SVG().size(200, 100);
        let yOffset = 10;
        item = this.viewer.item;
        while (item && item.state > 0) {
            const { a, b } = item;
            if (a > b) {
                equationSvg.text(`${a} = ${b} × ${Math.floor(a / b)} + ${a % b}`)
                    .move(10, yOffset)
                    .font({ size: 14, fill: document.body.classList.contains('dark') ? '#fff' : '#000' });
            } else if (a < b) {
                equationSvg.text(`${b} = ${a} × ${Math.floor(b / a)} + ${b % a}`)
                    .move(10, yOffset)
                    .font({ size: 14, fill: document.body.classList.contains('dark') ? '#fff' : '#000' });
            }
            yOffset += 20;
            item = item.child;
        }
        output2.innerHTML = '';
        equationSvg.addTo(output2);
    },
    updateAB() {
        const a = document.getElementById('A').valueAsNumber;
        const b = document.getElementById('B').valueAsNumber;
        this.viewer.createItem(a, b);
        this.updateStatusMessage();
        this.updateButtonsState();
    },
    toggleDarkMode() {
        document.body.classList.toggle('dark');
        const controls = document.querySelector('.controls');
        controls.classList.toggle('dark');
        this.updateStatusMessage(); // Cập nhật màu công thức
    }
};

// main.js
function moveSquare(square, posIndex, duration = 400, delay = 0) {
    const srcPos = square.transform();
    const dstPos = square.positions[posIndex];
    const dx = dstPos.x - srcPos.translateX;
    const dy = dstPos.y - srcPos.translateY;
    return square.animate({ duration, delay, ease: '<>' })
        .translate(dx, dy)
        .after(() => {
            square.cachePos = dstPos;
        });
}

function playSound() {
    const audio = new Audio('https://freesound.org/data/previews/270/270304_5123851-lq.mp3'); // Âm thanh mẫu
    audio.volume = 0.2;
    audio.play().catch(() => {}); // Bỏ qua lỗi nếu trình duyệt chặn
}

document.addEventListener('DOMContentLoaded', () => {
    UI.initialize();
});