/*
    Little JS demo with Tilo image, status bars, alarms and dev console.
*/

'use strict';

import * as LJS from '../../dist/littlejs.esm.js';
const { vec2 } = LJS;

///////////////////////////////////////////////////////////////////////////////
// Game lifecycle
function gameInit()
{
    // called once after the engine starts up
    createTiloButtons();
    createTiloBars();
    createDevConsole();
    createAlarmPopup();
}

function gameUpdate()
{
    // slowly decay hunger and thirst over time
    const decayRate = 0.01; // per frame
    hunger = Math.max(0, hunger - decayRate);
    thirst = Math.max(0, thirst - decayRate);

    // health decay: base rate, increased by 10% for each of hunger/thirst below 50%
    let penaltyCount = 0;
    if (hunger < 50) penaltyCount++;
    if (thirst < 50) penaltyCount++;
    const healthDecay = HEALTH_DECAY_BASE * (1 + HEALTH_DECAY_PENALTY * penaltyCount);
    health = Math.max(0, health - healthDecay);
    health = clampHealth(health);

    // check alarms
    const now = Date.now();
    maybeShowAlarms(now);
    // update dev console display each frame so the decay indicator is live
    updateDevConsole();
}

function gameUpdatePost() {}
function gameRender() {}

///////////////////////////////////////////////////////////////////////////////
// UI state: bars, buttons, alarms
let tiloButtons = null;
let tiloBars = null;
let hunger = 60, thirst = 60, health = 80; // 0..100

// timestamps for actions
let lastFedTimestamp = Date.now();
let lastDrankTimestamp = Date.now();
let lastExerciseTimestamp = Date.now();

// alarm bookkeeping
let alarmPopup = null;
let alarmVisible = false;
let alarmType = null; // 'feed'|'drink'|'exercise'
let lastFeedAlarmTimestamp = 0, lastDrinkAlarmTimestamp = 0, lastExerciseAlarmTimestamp = 0;
const alarmIntervalMs = 15000;
// health decay tuning
const HEALTH_DECAY_BASE = 0.005; // base health decay per frame
const HEALTH_DECAY_PENALTY = 1; // 100% extra per low stat
// when decay exceeds this threshold show a prominent warning in the dev console
const WARNING_DECAY_THRESHOLD = HEALTH_DECAY_BASE * 1.5;

function createTiloButtons()
{
    if (tiloButtons) return;
    tiloButtons = document.createElement('div');
    tiloButtons.id = 'tiloButtons';
    tiloButtons.style.position = 'absolute';
    tiloButtons.style.display = 'none';
    tiloButtons.style.zIndex = '9999';
    tiloButtons.style.pointerEvents = 'auto';
    tiloButtons.style.userSelect = 'none';
    tiloButtons.style.background = 'rgba(0,0,0,0.15)';
    tiloButtons.style.padding = '6px 8px';
    tiloButtons.style.borderRadius = '8px';
    tiloButtons.style.display = 'flex';
    tiloButtons.style.gap = '8px';

    const labels = ['Eat','Drink','Excercise'];
    for (const l of labels)
    {
        const b = document.createElement('button');
        b.textContent = l;
        b.style.fontSize = '14px';
        b.style.padding = '6px 10px';
        b.style.border = 'none';
        b.style.borderRadius = '6px';
        b.style.cursor = 'pointer';
        b.style.background = '#fff';
        b.addEventListener('click', () =>
        {
            if (l === 'Eat')
            {
                hunger = Math.min(100, hunger + 30);
                lastFedTimestamp = Date.now();
                if (alarmType === 'feed') hideAlarm();
            }
            else if (l === 'Drink')
            {
                thirst = Math.min(100, thirst + 30);
                lastDrankTimestamp = Date.now();
                if (alarmType === 'drink') hideAlarm();
            }
            else if (l === 'Excercise')
            {
                hunger = Math.max(0, hunger - 8);
                thirst = Math.max(0, thirst - 8);
                health = Math.min(100, health + 10);
                lastExerciseTimestamp = Date.now();
                if (alarmType === 'exercise') hideAlarm();
            }
            updateDevConsole();
        });
        tiloButtons.appendChild(b);
    }

    document.body.appendChild(tiloButtons);
}

function createTiloBars()
{
    if (tiloBars) return;
    tiloBars = document.createElement('div');
    tiloBars.id = 'tiloBars';
    tiloBars.style.position = 'absolute';
    tiloBars.style.display = 'none';
    tiloBars.style.zIndex = '9999';
    tiloBars.style.userSelect = 'none';
    tiloBars.style.pointerEvents = 'none';
    tiloBars.style.width = '220px';
    tiloBars.style.background = 'rgba(0,0,0,0.18)';
    tiloBars.style.padding = '8px';
    tiloBars.style.borderRadius = '8px';

    const items = ['Hunger','Thirst','Health'];
    for (const name of items)
    {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.marginBottom = '6px';

        const label = document.createElement('div');
        label.textContent = name;
        label.style.width = '70px';
        label.style.fontSize = '14px';
        label.style.color = '#fff';

        const bar = document.createElement('div');
        bar.style.background = 'rgba(255,255,255,0.12)';
        bar.style.borderRadius = '6px';
        bar.style.height = '12px';
        bar.style.flex = '1';
        bar.style.overflow = 'hidden';

        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.width = '50%';
        fill.style.background = name === 'Health' ? '#5ee' : '#ffd166';
        fill.style.transition = 'width 250ms linear';
        fill.dataset.name = name.toLowerCase();

        bar.appendChild(fill);
        row.appendChild(label);
        row.appendChild(bar);
        tiloBars.appendChild(row);
    }

    document.body.appendChild(tiloBars);
}

function createAlarmPopup()
{
    if (alarmPopup) return;
    alarmPopup = document.createElement('div');
    alarmPopup.id = 'tiloAlarm';
    alarmPopup.style.position = 'fixed';
    alarmPopup.style.left = '12px';
    alarmPopup.style.top = '50%';
    alarmPopup.style.transform = 'translateY(-50%)';
    alarmPopup.style.zIndex = '30000';
    alarmPopup.style.background = 'rgba(255,255,255,0.95)';
    alarmPopup.style.color = '#000';
    alarmPopup.style.padding = '12px 16px';
    alarmPopup.style.borderRadius = '8px';
    alarmPopup.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
    alarmPopup.style.fontSize = '16px';
    alarmPopup.style.fontWeight = '600';
    alarmPopup.style.display = 'none';

    const text = document.createElement('div');
    text.textContent = 'feed yourself and me as well';
    alarmPopup._text = text;
    alarmPopup.appendChild(text);

    document.body.appendChild(alarmPopup);
}

function showAlarm(type = 'feed')
{
    createAlarmPopup();
    alarmType = type;
    if (type === 'feed') alarmPopup._text.textContent = 'feed yourself and me as well';
    else if (type === 'drink') alarmPopup._text.textContent = 'drink something now, please';
    else if (type === 'exercise') alarmPopup._text.textContent = 'time to exercise!';
    alarmPopup.style.display = '';
    alarmVisible = true;
}

function hideAlarm()
{
    if (!alarmPopup) return;
    alarmPopup.style.display = 'none';
    alarmVisible = false;
    alarmType = null;
}

function maybeShowAlarms(now)
{
    if (alarmVisible) return;
    if (now - lastFedTimestamp > alarmIntervalMs && now - lastFeedAlarmTimestamp > alarmIntervalMs)
    {
        lastFeedAlarmTimestamp = now;
        showAlarm('feed');
        return;
    }
    if (now - lastDrankTimestamp > alarmIntervalMs && now - lastDrinkAlarmTimestamp > alarmIntervalMs)
    {
        lastDrinkAlarmTimestamp = now;
        showAlarm('drink');
        return;
    }
    if (now - lastExerciseTimestamp > alarmIntervalMs && now - lastExerciseAlarmTimestamp > alarmIntervalMs)
    {
        lastExerciseAlarmTimestamp = now;
        showAlarm('exercise');
        return;
    }
}

///////////////////////////////////////////////////////////////////////////////
// Developer console
let devConsole = null;
function createDevConsole()
{
    if (devConsole) return;
    devConsole = document.createElement('div');
    devConsole.id = 'devConsole';
    devConsole.style.position = 'fixed';
    devConsole.style.right = '12px';
    devConsole.style.top = '50%';
    devConsole.style.transform = 'translateY(-50%)';
    devConsole.style.zIndex = '20000';
        devConsole.style.background = 'rgba(0,0,0,0.6)';
        devConsole.style.color = '#fff';
        devConsole.style.padding = '6px';
        devConsole.style.borderRadius = '6px';
        devConsole.style.minWidth = '88px';
        devConsole.style.fontFamily = 'Arial, sans-serif';
        devConsole.style.fontSize = '12px';

    const title = document.createElement('div');
        title.textContent = 'DEV CONSOLE';
        title.style.fontWeight = '700';
        title.style.marginBottom = '6px';
        title.style.fontSize = '12px';
    devConsole.appendChild(title);

    // Warning element for high health decay
    const warn = document.createElement('div');
    warn.textContent = '';
    warn.style.fontWeight = '700';
    warn.style.marginBottom = '8px';
    warn.style.color = '#fff';
    warn.style.background = '#b00';
    warn.style.padding = '6px';
    warn.style.borderRadius = '6px';
    warn.style.display = 'none';
    warn.style.textAlign = 'center';
    warn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    devConsole.appendChild(warn);
    devConsole._warn = warn;

    const makeRow = name =>
    {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.marginBottom = '6px';

        const label = document.createElement('div');
        label.textContent = name;
        label.style.width = '40px';
        label.style.fontSize = '12px';

            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '4px';

            const dec = document.createElement('button');
            dec.textContent = '-';
            dec.style.width = '20px';
            dec.style.height = '20px';
        dec.style.border = 'none';
        dec.style.borderRadius = '4px';
        dec.style.cursor = 'pointer';

            const val = document.createElement('div');
            val.textContent = '0';
            val.style.minWidth = '20px';
            val.style.textAlign = 'center';

            const inc = document.createElement('button');
            inc.textContent = '+';
            inc.style.width = '20px';
            inc.style.height = '20px';
        inc.style.border = 'none';
        inc.style.borderRadius = '4px';
        inc.style.cursor = 'pointer';

        controls.appendChild(dec);
        controls.appendChild(val);
        controls.appendChild(inc);

        row.appendChild(label);
        row.appendChild(controls);
        devConsole.appendChild(row);

        return {row, dec, val, inc};
    };

    const hungerRow = makeRow('Hunger');
    const thirstRow = makeRow('Thirst');
    const healthRow = makeRow('Health');

    hungerRow.inc.addEventListener('click', ()=>{ hunger = Math.min(100, hunger+5); updateDevConsole(); });
    hungerRow.dec.addEventListener('click', ()=>{ hunger = Math.max(0, hunger-5); updateDevConsole(); });
    thirstRow.inc.addEventListener('click', ()=>{ thirst = Math.min(100, thirst+5); updateDevConsole(); });
    thirstRow.dec.addEventListener('click', ()=>{ thirst = Math.max(0, thirst-5); updateDevConsole(); });
    healthRow.inc.addEventListener('click', ()=>{ health = Math.min(100, health+5); updateDevConsole(); });
    healthRow.dec.addEventListener('click', ()=>{ health = Math.max(0, health-5); updateDevConsole(); });

    // Health decay indicator
    const decayRow = document.createElement('div');
    decayRow.style.display = 'flex';
    decayRow.style.alignItems = 'center';
    decayRow.style.justifyContent = 'space-between';
    decayRow.style.marginBottom = '6px';

    const decayLabel = document.createElement('div');
    decayLabel.textContent = 'Decay';
    decayLabel.style.width = '40px';
    decayLabel.style.fontSize = '13px';

    const decayVal = document.createElement('div');
    decayVal.textContent = '';
    decayVal.style.minWidth = '20px';
    decayVal.style.textAlign = 'center';
    decayVal.style.fontSize = '12px';
    decayVal.style.opacity = '0.95';

    decayRow.appendChild(decayLabel);
    decayRow.appendChild(decayVal);
    devConsole.appendChild(decayRow);
    devConsole._decay = decayVal;

    // Manual alarm triggers
    const triggerFeed = document.createElement('button');
    triggerFeed.textContent = 'Trigger Feed Alarm';
    triggerFeed.style.width = '100%';
    triggerFeed.style.marginTop = '8px';
    triggerFeed.style.padding = '6px';
    triggerFeed.style.border = 'none';
    triggerFeed.style.borderRadius = '6px';
    triggerFeed.style.cursor = 'pointer';
    triggerFeed.addEventListener('click', ()=>{ showAlarm('feed'); updateDevConsole(); });
    devConsole.appendChild(triggerFeed);

    const triggerDrink = document.createElement('button');
    triggerDrink.textContent = 'Trigger Drink Alarm';
    triggerDrink.style.width = '100%';
    triggerDrink.style.marginTop = '6px';
    triggerDrink.style.padding = '6px';
    triggerDrink.style.border = 'none';
    triggerDrink.style.borderRadius = '6px';
    triggerDrink.style.cursor = 'pointer';
    triggerDrink.addEventListener('click', ()=>{ showAlarm('drink'); updateDevConsole(); });
    devConsole.appendChild(triggerDrink);

    const triggerExercise = document.createElement('button');
    triggerExercise.textContent = 'Trigger Exercise Alarm';
    triggerExercise.style.width = '100%';
    triggerExercise.style.marginTop = '6px';
    triggerExercise.style.padding = '6px';
    triggerExercise.style.border = 'none';
    triggerExercise.style.borderRadius = '6px';
    triggerExercise.style.cursor = 'pointer';
    triggerExercise.addEventListener('click', ()=>{ showAlarm('exercise'); updateDevConsole(); });
    devConsole.appendChild(triggerExercise);

    // Reset feed timer (simulate feeding)
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Feed Timer';
    resetBtn.style.width = '100%';
    resetBtn.style.marginTop = '6px';
    resetBtn.style.padding = '6px';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '6px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.addEventListener('click', ()=>{ lastFedTimestamp = Date.now(); hideAlarm(); updateDevConsole(); });
    devConsole.appendChild(resetBtn);

    document.body.appendChild(devConsole);
    devConsole._h = hungerRow.val;
    devConsole._t = thirstRow.val;
    devConsole._hp = healthRow.val;
    updateDevConsole();
}

function updateDevConsole()
{
    if (!devConsole) return;
    devConsole._h.textContent = Math.round(hunger);
    devConsole._t.textContent = Math.round(thirst);
    devConsole._hp.textContent = Math.round(health);
    // update decay indicator
    if (devConsole._decay)
    {
        let penaltyCount = 0;
        if (hunger < 50) penaltyCount++;
        if (thirst < 50) penaltyCount++;
        const decay = HEALTH_DECAY_BASE * (1 + HEALTH_DECAY_PENALTY * penaltyCount);
        const mult = (1 + HEALTH_DECAY_PENALTY * penaltyCount).toFixed(2);
        devConsole._decay.textContent = `${decay.toFixed(4)} (x${mult})`;
        // colorize when penalties active
        devConsole._decay.style.color = penaltyCount > 0 ? '#ffd166' : '#5ee';
        // show/hide warning when decay above threshold or any penalty active
        if (devConsole._warn)
        {
            if (decay > WARNING_DECAY_THRESHOLD || penaltyCount > 0)
            {
                devConsole._warn.style.display = '';
                devConsole._warn.textContent = `WARNING: High health decay — ${decay.toFixed(4)} (x${mult})`;
            }
            else
            {
                devConsole._warn.style.display = 'none';
            }
        }
    }
}

function clampHealth(v)
{
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
}

///////////////////////////////////////////////////////////////////////////////
// Rendering: draw Tilo (or sad) centered and position DOM UI
function gameRenderPost()
{
    const tiloTexture = LJS.textureInfos.find(ti => ti.image?.src?.endsWith('Tilo.png') || ti.image?.src?.includes('/Tilo.png'));
    const tiloSadTexture = LJS.textureInfos.find(ti => ti.image?.src?.endsWith('Tilo - sad.png') || ti.image?.src?.includes('/Tilo - sad.png') || ti.image?.src?.includes('/Tilo-sad.png') || ti.image?.src?.includes('sad'));

    if (tiloTexture?.image?.complete || tiloSadTexture?.image?.complete)
    {
        const sad = Math.min(hunger, thirst, health) <= 50;
        const curTexture = (sad && tiloSadTexture?.image?.complete) ? tiloSadTexture : (tiloTexture?.image?.complete ? tiloTexture : tiloSadTexture);
        const size = curTexture?.size || vec2(64,64);
        const scale = 0.5;
        const w = size.x * scale;
        const h = size.y * scale;
        const x = (LJS.mainCanvasSize.x - w) / 2;
        const y = (LJS.mainCanvasSize.y - h) / 2;
        LJS.mainContext.drawImage(curTexture.image, x, y, w, h);

        // position buttons below image
        if (tiloButtons)
        {
            tiloButtons.style.display = '';
            const canvasRect = LJS.mainCanvas.getBoundingClientRect();
            const containerRect = tiloButtons.getBoundingClientRect();
            const left = canvasRect.left + x + (w/2) - (containerRect.width/2);
            const top = canvasRect.top + y + h + 10;
            tiloButtons.style.left = Math.max(left, 0) + 'px';
            tiloButtons.style.top = Math.max(top, 0) + 'px';
        }

        // position bars above image
        if (tiloBars)
        {
            tiloBars.style.display = '';
            const canvasRect = LJS.mainCanvas.getBoundingClientRect();
            const containerRect = tiloBars.getBoundingClientRect();
            const left = canvasRect.left + x + (w/2) - (containerRect.width/2);
            const top = canvasRect.top + y - containerRect.height - 10;
            tiloBars.style.left = Math.max(left, 0) + 'px';
            tiloBars.style.top = Math.max(top, 0) + 'px';

            const updateFill = (name, value) =>
            {
                const fill = tiloBars.querySelector(`div[data-name="${name}"]`);
                if (fill) fill.style.width = `${value}%`;
            };
            updateFill('hunger', Math.round(hunger));
            updateFill('thirst', Math.round(thirst));
            updateFill('health', Math.round(health));

            const setColor = (name, value) =>
            {
                const fill = tiloBars.querySelector(`div[data-name="${name}"]`);
                if (!fill) return;
                if (value <= 50) fill.style.background = '#ff6b6b';
                else if (name === 'health') fill.style.background = '#5ee';
                else fill.style.background = '#ffd166';
            };
            setColor('hunger', hunger);
            setColor('thirst', thirst);
            setColor('health', health);
        }

        // position persistent alarm (left center)
        if (alarmVisible && alarmPopup)
        {
            alarmPopup.style.display = '';
            alarmPopup.style.right = '';
            alarmPopup.style.left = '12px';
            alarmPopup.style.top = '50%';
            alarmPopup.style.transform = 'translateY(-50%)';
        }
    }
    else
    {
        LJS.drawTextScreen('Hello World!', LJS.mainCanvasSize.scale(.5), 80);
        if (tiloButtons) tiloButtons.style.display = 'none';
        if (tiloBars) tiloBars.style.display = 'none';
    }
}

///////////////////////////////////////////////////////////////////////////////
// Startup LittleJS Engine
LJS.engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, ['tiles.png','Tilo.png','Tilo - sad.png']);