/**
 * CALCULATOR.JS - A pocket calculator with a green LCD and 7-segment digits (global: CalculatorApp).
 * Quick reference: open(), input(digit), op(+ - * /), calc(), clear(), clearEntry(), updateDisplay()
 *
 * The digits are drawn as real 7-segment shapes (inline SVG), so they look like a 1990s LCD.
 * Works with the mouse or the keyboard (0-9 . + - * / Enter = Esc Backspace) while its window is in front.
 * Styles: desktop/css/apps.css ("CALCULATOR")
 */
window.CalculatorApp = {
    currentVal: '0',
    previousVal: null,
    operator: null,
    resetNext: false,
    DIGITS: 10,                    // how many characters the LCD can show

    // Which segments light up for each character (a = top, then clockwise, g = middle)
    SEGS: {
        '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc',
        '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', 'E': 'adefg', 'r': 'eg', 'o': 'cdeg', ' ': ''
    },
    // Segment shapes in a 20 x 36 cell
    SHAPES: {
        a: '4,1 16,1 14,4 6,4', b: '17,2 17,17 15,16 15,5', c: '17,19 17,34 15,31 15,20',
        d: '4,35 16,35 14,32 6,32', e: '3,19 5,20 5,31 3,34', f: '3,2 5,5 5,16 3,17', g: '4,18 6,16.5 14,16.5 16,18 14,19.5 6,19.5'
    },

    open() {
        this.currentVal = '0';
        this.previousVal = null;
        this.operator = null;
        this.resetNext = false;

        // [label, action, extra class, tooltip]
        const keys = [
            ['C', 'clear', 'k-red', 'Clear everything'], ['CE', 'clearEntry', 'k-red', 'Clear the number you are typing'],
            ['÷', 'op:/', 'k-op', 'Divide'], ['×', 'op:*', 'k-op', 'Multiply'],
            ['7', 'in:7'], ['8', 'in:8'], ['9', 'in:9'], ['−', 'op:-', 'k-op', 'Subtract'],
            ['4', 'in:4'], ['5', 'in:5'], ['6', 'in:6'], ['+', 'op:+', 'k-op', 'Add'],
            ['1', 'in:1'], ['2', 'in:2'], ['3', 'in:3'], ['=', 'calc', 'k-eq', 'Equals (or press Enter)'],
            ['0', 'in:0', 'k-zero'], ['.', 'in:.', '', 'Decimal point']
        ];
        const html = `
            <div class="calc" tabindex="-1">
                <div class="calc-body">
                    <div class="calc-top">
                        <span class="calc-brand">JV-1999</span>
                        <span class="calc-solar" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                    </div>
                    <div class="calc-lcd" role="status" aria-live="polite" title="The display">
                        <span class="calc-op" aria-hidden="true"></span>
                        <span class="calc-digits"></span>
                    </div>
                    <div class="calc-keys">
                        ${keys.map(([label, act, cls, tip]) =>
                            `<button type="button" class="calc-key ${cls || ''}" data-act="${act}"${tip ? ` title="${tip}"` : ''}>${label}</button>`).join('')}
                    </div>
                </div>
            </div>`;

        if (typeof WM === 'undefined') return;
        WM.open('app-calculator', 'Calculator', html, 'images/icons/os/calculator.png', { width: 264, height: 384 });
        const win = WM.windows['app-calculator'];
        if (!win || win._calcReady) { this.updateDisplay(); return; }
        win._calcReady = true;

        win.querySelector('.calc-keys').addEventListener('click', (e) => {
            const b = e.target.closest('.calc-key');
            if (!b) return;
            this.press(b.dataset.act);
        });

        // A little secret: no button, no hint. A quick double-click on the solar strip turns the
        // whole calculator over (and again to turn it back), the oldest calculator joke there is.
        win.querySelector('.calc-solar').addEventListener('dblclick', () => win.querySelector('.calc').classList.toggle('calc-flip'));

        // Keyboard support while the calculator is the window in front
        const keyMap = { Enter: 'calc', '=': 'calc', Escape: 'clear', Delete: 'clearEntry', Backspace: 'back',
            '+': 'op:+', '-': 'op:-', '*': 'op:*', 'x': 'op:*', '/': 'op:/', '.': 'in:.', ',': 'in:.' };
        win.addEventListener('keydown', (e) => {
            const act = /^[0-9]$/.test(e.key) ? 'in:' + e.key : keyMap[e.key];
            if (!act) return;
            e.preventDefault();
            this.press(act);
            const btn = win.querySelector(`.calc-key[data-act="${act}"]`);   // show the key going down
            if (btn) { btn.classList.add('down'); setTimeout(() => btn.classList.remove('down'), 110); }
        });
        win.addEventListener('mousedown', () => win.querySelector('.calc').focus({ preventScroll: true }));
        this.updateDisplay();
    },

    press(act) {
        if (act.startsWith('in:')) return this.input(act.slice(3));
        if (act.startsWith('op:')) return this.op(act.slice(3));
        if (act === 'back') {
            if (this.resetNext) return;
            this.currentVal = this.currentVal.length > 1 ? this.currentVal.slice(0, -1) : '0';
            if (this.currentVal === '-') this.currentVal = '0';
            return this.updateDisplay();
        }
        this[act]();
    },

    input(num) {
        if (this.resetNext) {
            this.currentVal = num === '.' ? '0.' : num;
            this.resetNext = false;
        } else {
            if (num === '.' && this.currentVal.includes('.')) return;
            if (this.currentVal.replace(/[-.]/g, '').length >= this.DIGITS) return;   // the LCD is full
            this.currentVal = this.currentVal === '0' && num !== '.' ? num : this.currentVal + num;
        }
        this.updateDisplay();
    },

    op(operator) {
        if (this.operator && !this.resetNext) this.calc();
        if (this.currentVal === 'Error') return;
        this.previousVal = this.currentVal;
        this.operator = operator;
        this.resetNext = true;
        this.updateDisplay();
    },

    calc() {
        if (!this.operator || this.previousVal === null) return;
        const num1 = parseFloat(this.previousVal), num2 = parseFloat(this.currentVal);
        let result = 0;
        switch (this.operator) {
            case '+': result = num1 + num2; break;
            case '-': result = num1 - num2; break;
            case '*': result = num1 * num2; break;
            case '/': result = num2 === 0 ? NaN : num1 / num2; break;
        }
        this.operator = null;
        this.previousVal = null;
        this.resetNext = true;
        this.currentVal = this.fit(result);
        this.updateDisplay();
    },

    /** Squeeze a result onto the 10-digit LCD (rounding decimals), or "Error" if it can't fit. */
    fit(n) {
        if (!isFinite(n)) return 'Error';
        let s = String(Math.round(n * 1e8) / 1e8);   // strips floating point noise (0.1 + 0.2)
        const intLen = String(Math.trunc(Math.abs(n))).length;
        if (intLen > this.DIGITS || /e/.test(s)) return Math.abs(n) < 1 ? '0' : 'Error';
        if (s.replace(/[-.]/g, '').length > this.DIGITS) {
            s = String(+n.toFixed(Math.max(0, this.DIGITS - intLen)));
        }
        return s;
    },

    clear() {
        this.currentVal = '0';
        this.previousVal = null;
        this.operator = null;
        this.resetNext = false;
        this.updateDisplay();
    },

    clearEntry() {
        this.currentVal = '0';
        this.updateDisplay();
    },

    /** One 7-segment character as SVG (unlit segments stay faintly visible, like a real LCD). */
    digitSVG(ch, dot) {
        const on = this.SEGS[ch] !== undefined ? this.SEGS[ch] : '';
        const segs = Object.entries(this.SHAPES).map(([k, pts]) =>
            `<polygon points="${pts}" class="${on.includes(k) ? 'on' : 'off'}"/>`).join('');
        return `<svg viewBox="0 0 24 36" class="seg"><g transform="skewX(-6) translate(3 0)">${segs}</g>` +
            `<circle cx="21.5" cy="34" r="1.7" class="${dot ? 'on' : 'off'}"/></svg>`;
    },

    updateDisplay() {
        const win = document.getElementById('window-app-calculator');
        if (!win) return;
        const digits = win.querySelector('.calc-digits');
        const opEl = win.querySelector('.calc-op');
        if (opEl) opEl.textContent = { '+': '+', '-': '−', '*': '×', '/': '÷' }[this.operator] || '';
        if (!digits) return;
        // Turn "12.5" into characters with the decimal point riding on the digit before it
        const text = this.currentVal;
        const cells = [];
        for (const ch of text) {
            if (ch === '.' && cells.length) cells[cells.length - 1].dot = true;
            else if (ch === '.') cells.push({ ch: '0', dot: true });
            else cells.push({ ch, dot: false });
        }
        while (cells.length < this.DIGITS) cells.unshift({ ch: ' ', dot: false });   // right-aligned, like a real one
        digits.innerHTML = cells.slice(-this.DIGITS).map(c => this.digitSVG(c.ch, c.dot)).join('');
        win.querySelector('.calc-lcd').setAttribute('aria-label', 'Display: ' + text);
    }
};
