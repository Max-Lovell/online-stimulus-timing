// TODO: drawImage from a pre-rendered ImageBitmap; putImageData;
//  alpha: false, desynchronized: true, WebGL clear
//  CSS transitions / Web Animations
//  will-change: opacity (or transform)
//  requestFullscreen
//  Record useAgent and navigator.userAgentData.getHighEntropyValues(...) on chrome
//  ordering, repetitions, jitter, timestamps, on method per page load, etc.
//  run validations from runStimMethods(), and consider moving to typeScript.

// Save order to sessionStorage and use location.replace or reload() to move between blocks

// Get CANVAS
const container = document.getElementById('container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d'); // TODO: consider { alpha: true/false }

window.onresize = (e) => {
    console.log({type: e.type, timeStamp: e.timeStamp})
}

// Drawing stim -------
function drawStimRect(colour='white', drawCtx=ctx){
    drawCtx.fillStyle = colour;
    const {width, height} = drawCtx.canvas;
    const stimSize = Math.round(Math.min(width, height)*.2); // 20% of canvas' smallest dimension, rounded to avoid aliasing
    drawCtx.fillRect(0, 0, stimSize, stimSize);
    drawCtx.fillRect(width-stimSize, height-stimSize, stimSize, stimSize);
}

function resizeCanvas(){
    // Note: wipes stim, which will be rescaled by CSS anyway, but keeps square and in bounds...
    if(canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth // or .getBoundingClientRect().width or document.documentElement.clientWidth
    if(canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight
}

function resetCanvas(methodName){
    // TODO: Only page reload or new canvas actually resets - run each method in random block order with this
    //  After you've changed a canvas's opacity, Chrome may give it its own compositing layer and keep it that way.
    //  A canvas that has been display: none may have had its GPU resources released.
    //  context settings need fresh canvas anyway
    canvas.removeAttribute('style')
    canvas.hidden = false;
    if(!canvas.isConnected) container.append(canvas); // Make sure canvas is connected - or container.contains(canvas) or container.children.length === 0
    resizeCanvas()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // TODO: forces a style recalculation so read in the gap, using a property field rather than the method name.
    // if(methodName && getComputedStyle(canvas)[methodName]) console.log('currentStyle: ', getComputedStyle(canvas)[methodName]) // TODO: record this.
}

const displayMethods = {
    // New CANVAS image sent to the screen
    'clearRect': {
        name: 'clearRect',
        type: 'canvas',
        show: ()=> { drawStimRect() }, // Wrap in arrow function to avoid passing show arguments to drawStimRect()
        hide: () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        } // could clear over drawn stim area, but this seems more realistic
    },
    'fillRect': {
        name: 'fillRect',
        type: 'canvas',
        show: ()=> { drawStimRect() },
        hide: () => {
            drawStimRect('black')
        }
    },

    // Style methods
    'visibility': {
        name: 'visibility',
        type: 'style',
        show: () => {
            canvas.style.visibility = 'visible'
        },
        hide: () => {
            canvas.style.visibility = 'hidden'
        }
    },
    'opacity': { // often handled by compositor without repainting.
        name: 'opacity',
        type: 'style',
        show: () => {
            canvas.style.opacity = '1'
        },
        hide: () => {
            canvas.style.opacity = '0'
        }
    },
    'display': { // browser styles recalculates, redoes the page layout and repaints
        name: 'display',
        type: 'style',
        show: () => {
            canvas.style.display = 'block'
        },
        hide: () => {
            canvas.style.display = 'none'
        } // https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#none
    },
    'hidden': { // Should be basically the same as display: 'none'
        name: 'hidden',
        type: 'style',
        show: () => {
            canvas.hidden = false
        },
        hide: () => {
            canvas.hidden = true
        }
    },
    'contentVisibility': {
        name: 'contentVisibility',
        type: 'style',
        show: () => {
            canvas.style.contentVisibility = 'visible'
        },
        hide: () => {
            canvas.style.contentVisibility = 'hidden'
        }
    },

    // transforms
    'left': {
        name: 'left',
        type: 'style',
        show: () => {
            canvas.style.left = '0'
        },
        hide: () => {
            canvas.style.left = '100%'
        }
    },
    'translate': {
        name: 'translate',
        type: 'style',
        show: () => {
            canvas.style.translate = `0%` // TODO: note applied before transform.translate and slightly different...
        },
        hide: () => {
            canvas.style.translate = `100%`
        }
    },
    'scale': {
        name: 'scale',
        type: 'style',
        show: () => {
            canvas.style.scale = '1' // TODO: note applied before transform.scale and slightly different...
        },
        hide: () => {
            canvas.style.scale = '0'
        },
    },

    // DOM
    'html': { // raw HTML insert - jsPsych method
        name: 'html', // Options: innerHTML, insertAdjacentHTML
        type: 'dom',
        show: () => {
            // TODO: check jsPsych actually handles the draw after insert during trial start.
            container.innerHTML = `<canvas id="newCanvas" class="canvas" width="${canvas.width}" height="${canvas.height}"></canvas>`
            const newCanvas = document.getElementById('newCanvas');
            const newCtx = newCanvas.getContext('2d'); // TODO: consider { alpha: true/false }
            drawStimRect('white', newCtx);
        },
        hide: () => {
            container.innerHTML = ''
        }
    },
    'append': { // options: appendChild/removeChild, append/remove, insertBefore, replaceChildren, insertAdjacentElement
        name: 'append',
        type: 'dom',
        show: () => {
            container.append(canvas)
        }, // note appendChild on an already attached node moves it to end
        hide: () => {
            canvas.remove()
        } // or container.removeChild(canvas) - but could throw error
    }
}

// SCHEDULER
function wait(ms) {
    return new Promise(function executor(resolve, reject) {
        setTimeout(resolve, ms);
    });
}

async function runStimMethods(){
    const waitTime = 500
    for (const method of Object.values(displayMethods)) { //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values#description
        if(!(method.type && method.show && method.hide &&
            typeof method.show === 'function' && typeof method.hide === 'function')) {
            // TODO CSS.supports(property, value) and record which methods were skipped on that browser. Adding a property field to each entry makes this easy.
            throw Error('Incomplete method entry')
        }
        console.log(method.name)
        resetCanvas(method.name)
        method.hide() // hide under same show method to prep
        if(method.type !== 'canvas') drawStimRect() // draw stim if remains hidden consider a prepare() method on displayMethods instead
        // reset → prepare → gap → show → duration → hide → gap.
        await wait(waitTime); // consider a requestAnimationFrame draw to ensure hide has gone through
        method.show()
        await wait(waitTime);
        method.hide()
        await wait(waitTime);
    }
}

// RUN ----------
runStimMethods().then(()=> {console.log('finished')}).catch((e)=>{console.error(e)})
// drawStimRect()
