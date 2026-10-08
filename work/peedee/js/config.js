'use strict';
/* PeeDee's Dental Defense (c) Joe VanWagner. Plain files, no build step: upload the whole folder, or open index.html. */
/* ============================== CONFIG ============================== */
const GAME_NAME = "PeeDee's Dental Defense";
const PORTFOLIO_URL = 'https://jvanwagner.neocities.org/';
const SHARE_LINK = '';            // link added to shared posts; '' = this page's address (the portfolio when played offline)
const VH = 225;                   // how many world pixels tall the view is; the width adapts to the screen
const VW_MIN = 224, VW_MAX = 480;
let VW = 400;
let CSSPX = 3;                    // CSS pixels per game pixel (set by layout)
let RS = 1;                       // render scale: device pixels per game pixel (set by layout)
let PIXMODE = false;              // true while drawing characters onto the 1x pixel layer
const snap = v => PIXMODE ? Math.round(v) : Math.round(v * RS) / RS;      // align to a real screen pixel (or a game pixel)
