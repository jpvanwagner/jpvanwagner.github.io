/**
 * SHUTDOWN.JS - Start > Shut Down: the "Please wait..." screen, then the orange
 * "It is now safe to turn off your computer." The power button reloads the site (and re-boots).
 * Global: ShutdownSequence.init(). Styles: desktop/css/effects.css
 */
const ShutdownSequence = {
    init() {
        // --- ADDED SYSTEM BUSY CLASS ---
        document.body.classList.add('system-busy');

        this.container = document.createElement('div');
        this.container.id = 'shutdown-screen';
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100vw', height: '100vh',
            backgroundColor: 'black',
            zIndex: '100000', 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            boxSizing: 'border-box'
        });


        document.body.appendChild(this.container);

        if (document.getElementById('desktop')) document.getElementById('desktop').style.display = 'none';
        if (document.getElementById('brick-layer')) document.getElementById('brick-layer').style.display = 'none';
        
        const windowContainers = document.querySelectorAll('.window'); // Updated selector for your WM
        windowContainers.forEach(win => win.style.display = 'none');

        this.showPleaseWait();
    },

    showPleaseWait() {
        this.container.innerHTML = '';
        this.container.style.backgroundImage = "url('images/wallpapers/clouds.png')";
        this.container.style.backgroundSize = 'cover';
        this.container.style.backgroundPosition = 'center';

        const textContainer = document.createElement('div');
        Object.assign(textContainer.style, {
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%'
        });

        const text1 = document.createElement('div');
        text1.className = 'win95-shutdown-text';
        text1.innerText = "Please wait while your computer";
        Object.assign(text1.style, {
            color: 'black', fontSize: '24px', marginBottom: '5px',
            textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white'
        });

        const text2 = document.createElement('div');
        text2.className = 'win95-shutdown-text';
        text2.innerText = "shuts down.";
        Object.assign(text2.style, {
            color: 'black', fontSize: '24px',
            textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white'
        });

        textContainer.appendChild(text1);
        textContainer.appendChild(text2);
        this.container.appendChild(textContainer);

        setTimeout(() => { this.showSafeToTurnOff(); }, 1500);
    },

    showSafeToTurnOff() {
        this.container.innerHTML = '';
        this.container.style.backgroundImage = 'none';
        this.container.style.backgroundColor = 'black';

        const textContainer = document.createElement('div');
        Object.assign(textContainer.style, {
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%'
        });

        const text1 = document.createElement('div');
        text1.className = 'win95-shutdown-text';
        text1.innerText = "It is now safe to turn off";
        Object.assign(text1.style, { color: '#FF9900', fontSize: '28px' });

        const text2 = document.createElement('div');
        text2.className = 'win95-shutdown-text';
        text2.innerText = "your computer.";
        Object.assign(text2.style, { color: '#FF9900', fontSize: '28px' });

        textContainer.appendChild(text1);
        textContainer.appendChild(text2);
        this.container.appendChild(textContainer);

        // Big green, gently glowing power button with "ON" underneath, so it's obvious how to restart
        const powerBtn = document.createElement('button');
        powerBtn.type = 'button';
        powerBtn.className = 'power-on-btn';
        powerBtn.title = 'Turn the computer back on';
        powerBtn.setAttribute('aria-label', 'Turn the computer back on');
        powerBtn.innerHTML = '<span class="power-icon">&#x23FB;</span><span class="power-label">ON</span>';

        powerBtn.onclick = () => {
            sessionStorage.removeItem('hasBooted'); 
            location.reload();
        };

        this.container.appendChild(powerBtn);
    }
};

window.ShutdownSequence = ShutdownSequence;