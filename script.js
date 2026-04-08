// DOM Elements
const views = {
    home: document.getElementById('home-view'),
    memorize: document.getElementById('memorize-view'),
    guess: document.getElementById('guess-view'),
    roundResult: document.getElementById('round-result-view'),
    finalResult: document.getElementById('final-result-view')
};

const appCard = document.getElementById('game-card');
const roundBadge = document.getElementById('round-badge');
const roundText = document.getElementById('round-text');

const buttons = {
    start: document.getElementById('start-btn'),
    ok: document.getElementById('ok-btn'),
    nextRound: document.getElementById('next-round-btn'),
    playAgain: document.getElementById('play-again-btn')
};

const ui = {
    timerProgress: document.getElementById('timer-progress'),
    timerText: document.getElementById('timer-text'),
    roundScore: document.getElementById('round-score-text'),
    finalScore: document.getElementById('final-score-text'),
    resGuessHsv: document.getElementById('res-guess-hsv'),
    resTargetHsv: document.getElementById('res-target-hsv'),
    resFlavorText: document.getElementById('round-flavor-text'),
    resLeftPane: document.getElementById('result-left-pane'),
    resRightPane: document.getElementById('result-right-pane')
};

const sliders = {
    hue: document.getElementById('hue-slider'),
    sat: document.getElementById('sat-slider'),
    bri: document.getElementById('bri-slider')
};

// Game Configuration & State
const TOTAL_ROUNDS = 5;
const DISPLAY_DURATION = 5000; // ms

let currentRound = 1;
let scores = [];
let targetHSV = { h: 0, s: 0, v: 0 };
let guessHSV = { h: 180, s: 50, v: 50 };
let animationFrameId;
let timerStart = null;

// Initialize
function initEvents() {
    buttons.start.addEventListener('click', startNewGame);
    buttons.ok.addEventListener('click', submitGuess);
    buttons.nextRound.addEventListener('click', proceedNextRound);
    buttons.playAgain.addEventListener('click', startNewGame);

    ['hue', 'sat', 'bri'].forEach(type => {
        sliders[type].addEventListener('input', updateGuessFromSliders);
    });

    // Set default Home Screen look
    appCard.style.setProperty('--card-bg', '#1e293b');

    window.addEventListener('resize', resizeSliders);
    resizeSliders(); // fire initially
}

function resizeSliders() {
    const container = document.querySelector('.sliders-container');
    if (container) {
        const h = container.clientHeight;
        document.querySelectorAll('.rot-slider').forEach(el => {
            el.style.width = h + 'px';
        });
    }
}

// State Machine
function switchView(viewName) {
    const target = views[viewName];

    Object.values(views).forEach(v => {
        if (v !== target) {
            v.classList.remove('active');
            // allow fade to complete
            setTimeout(() => {
                // Confirm it has not been made active in the meantime
                if (!v.classList.contains('active')) {
                    v.classList.add('hidden');
                }
            }, 300);
        }
    });

    target.classList.remove('hidden');
    requestAnimationFrame(() => {
        target.classList.add('active');
        resizeSliders();
    });

    // Manage Global Badges
    if (viewName === 'home') {
        roundBadge.classList.add('hidden');
    } else {
        roundBadge.classList.remove('hidden');
    }
}

// Hue/Sat/Val converters
function hsvToHslString(h, s, v) {
    s /= 100;
    v /= 100;
    let l = v * (1 - (s / 2));
    let sl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l);
    return `hsl(${Math.round(h)}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%)`;
}

// Engine loops
function startNewGame() {
    currentRound = 1;
    scores = [];
    appCard.style.transition = 'background-color 0.4s ease'; // smooth transitions for setup
    startRoundSequence();
}

function startRoundSequence() {
    generateRandomColor();
    roundText.textContent = `${currentRound}/${TOTAL_ROUNDS}`;
    roundBadge.className = "round-text-plain";

    // Apply Target Color to entire card
    appCard.style.setProperty('--card-bg', hsvToHslString(targetHSV.h, targetHSV.s, targetHSV.v));
    switchView('memorize');

    // Start high-precision timer
    timerStart = null;
    animationFrameId = requestAnimationFrame(animateTimer);
}

function animateTimer(timestamp) {
    if (!timerStart) timerStart = timestamp;
    let elapsed = timestamp - timerStart;
    let remaining = Math.max(0, DISPLAY_DURATION - elapsed);

    ui.timerText.textContent = (remaining / 1000).toFixed(2);
    ui.timerProgress.style.transform = `scaleX(${remaining / DISPLAY_DURATION})`;

    if (remaining > 0) {
        animationFrameId = requestAnimationFrame(animateTimer);
    } else {
        startGuessPhase();
    }
}

function startGuessPhase() {
    cancelAnimationFrame(animationFrameId);
    resetSliders();

    // Instantly remove transition for snappy slider dragging feeling
    appCard.style.transition = 'none';

    // Set pill format top left
    roundBadge.className = "round-pill";
    switchView('guess');
}

function resetSliders() {
    sliders.hue.value = 180;
    sliders.sat.value = 50;
    sliders.bri.value = 50;
    updateGuessFromSliders();
}

function updateGuessFromSliders() {
    const h = parseInt(sliders.hue.value);
    const s = parseInt(sliders.sat.value);
    const b = parseInt(sliders.bri.value);
    guessHSV = { h, s, v: b };

    // Colorize card based on sliders instantly
    appCard.style.setProperty('--card-bg', hsvToHslString(h, s, b));

    // Dynamics gradients on slider tracks
    document.documentElement.style.setProperty('--sat-bottom', hsvToHslString(h, 0, b));
    document.documentElement.style.setProperty('--sat-top', hsvToHslString(h, 100, b));

    document.documentElement.style.setProperty('--bri-bottom', hsvToHslString(h, s, 0));
    document.documentElement.style.setProperty('--bri-top', hsvToHslString(h, s, 100));
}

function submitGuess() {
    // Very strict mathematically sound Euclidean color space distance
    const dH = Math.min(Math.abs(targetHSV.h - guessHSV.h), 360 - Math.abs(targetHSV.h - guessHSV.h)) / 180;
    const dS = Math.abs(targetHSV.s - guessHSV.s) / 100;
    const dV = Math.abs(targetHSV.v - guessHSV.v) / 100;
    
    // Heavily punish Hue mismatch since it defines the actual perceived color.
    const dist = Math.sqrt(Math.pow(dH * 3, 2) + Math.pow(dS, 2) + Math.pow(dV, 2));
    const maxDist = Math.sqrt(Math.pow(3, 2) + 1 + 1); // approx 3.316
    
    // Standard score out of 10. We use a power curve so colors that look visibly different score quite poorly (e.g. 3-5/10), 
    // rather than handing out a "60%" for a massive hue shift.
    // Score Formula: 10 * (1 - (dist / maxDist))^1.5
    let rawScore = 10 * Math.pow(Math.max(0, 1 - (dist / maxDist)), 1.5);
    const score = Math.max(0, Math.min(10, rawScore));
    
    scores.push(score);
    
    // Dynamically choose flavorful feedback text based on accuracy
    let flavor = "";
    if(score >= 9.5) flavor = "Absolute perfection. You practically cloned it.";
    else if(score >= 8.5) flavor = "Extremely close! Minor imperfections.";
    else if(score >= 7.0) flavor = "Solid read. The tint shifted slightly.";
    else if(score >= 5.0) flavor = "The read was there. The last stretch did the damage.";
    else if(score >= 3.0) flavor = "Off by a fair chunk. Color perception is hard!";
    else flavor = "Not even in the same ballpark. Shake it off.";

    // Render result to split panes
    ui.resLeftPane.style.backgroundColor = hsvToHslString(guessHSV.h, guessHSV.s, guessHSV.v);
    ui.resRightPane.style.backgroundColor = hsvToHslString(targetHSV.h, targetHSV.s, targetHSV.v);
    
    ui.resGuessHsv.textContent = `H${guessHSV.h} S${guessHSV.s} B${guessHSV.v}`;
    ui.resTargetHsv.textContent = `H${targetHSV.h} S${targetHSV.s} B${targetHSV.v}`;
    ui.roundScore.textContent = score.toFixed(2);
    ui.resFlavorText.textContent = flavor;
    
    // We no longer transition to dark grey backdrop; we simply activate the split view overlay.
    appCard.style.transition = 'background-color 0s';
    switchView('roundResult');
}

function proceedNextRound() {
    if (currentRound < TOTAL_ROUNDS) {
        currentRound++;
        startRoundSequence();
    } else {
        finishGame();
    }
}

function finishGame() {
    const avg = scores.reduce((a, b) => a + b, 0) / TOTAL_ROUNDS;
    ui.finalScore.textContent = `${avg.toFixed(2)}`;
    switchView('finalResult');
}

function generateRandomColor() {
    // Ensuring somewhat visible bounds
    targetHSV = {
        h: Math.floor(Math.random() * 361),
        s: Math.floor(Math.random() * 51) + 50,
        v: Math.floor(Math.random() * 51) + 40
    };
}

initEvents();
