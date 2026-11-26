// TODO: drawImage from a pre-rendered ImageBitmap; putImageData; Inserting/removing an element in the page
//  alpha: false, desynchronized: true, WebGL clear
//  CSS transitions / Web Animations
//  will-change: opacity (or transform)
//  requestFullscreen

// Get CANVAS
const container = document.getElementById('container');
let canvas = document.getElementById('canvas');
// Note will be rescaled by CSS technically but worth doing here.
canvas.width = document.documentElement.clientWidth // or .getBoundingClientRect().width;
canvas.height = document.documentElement.clientHeight
let ctx = canvas.getContext('2d'); // TODO: consider { alpha: true/false }

// Drawing stim -------
function drawStimRect(colour='white'){
    ctx.fillStyle = colour;
    const {width, height} = canvas;
    const stimSize = Math.min(width, height)*.2; // 20% of canvas' smallest dimension
    ctx.fillRect(0, 0, stimSize, stimSize);
    ctx.fillRect(width-stimSize, height-stimSize, stimSize, stimSize);
}

function loadCanvas(){
    if(!canvas.isConnected) container.append(canvas); // Make sure canvas is connected - or container.contains(canvas) or container.children.length === 0
    if(canvas.width !== document.documentElement.clientWidth) canvas.width = document.documentElement.clientWidth // or .getBoundingClientRect().width;
    if(canvas.height !== document.documentElement.clientHeight) canvas.height = document.documentElement.clientHeight
}

// Either need this - which maintains a nice square, or can allow for rectangles with CSS:
window.onresize = (e) => {
    console.log({type: e.type, timeStamp: e.timeStamp})
    // Keeps square and in bounds but wipes stim...
    canvas.width = document.documentElement.clientWidth // or .getBoundingClientRect().width;
    canvas.height = document.documentElement.clientHeight
}

const methods = {
    canvas: ['clearRect', 'fillRect'],
    style: ['visibility', 'scale', 'opacity', 'display', 'hidden', 'contentVisibility', 'left', 'translate'],
    dom: ['append']
}

function resetStimStyle(method){
    // TODO: Only page reload or new canvas actually resets - run each method in random block order with this
    //  After you've changed a canvas's opacity, Chrome may give it its own compositing layer and keep it that way.
    //  A canvas that has been display: none may have had its GPU resources released.
    //  context settings need fresh canvas anyway

    // Note = '' removes any JS override and resets to specified CSS.
    // Or shorthand with removeAttribute('style')
    canvas.style.visibility = '';
    canvas.style.opacity = '';
    canvas.style.display = '';
    canvas.style.contentVisibility = ''
    canvas.style.left = '';
    canvas.style.scale = ''
    canvas.style.transform = ''
    canvas.hidden = false;
    if(methods.style.includes(method)) console.log(getComputedStyle(canvas)[method]) // TODO: record this.
}

function toggleStim(method='clearRect', toggle='show'){
    // TODO: Style vs CANVAS methods separately
    // New CANVAS image sent to the screen
    if(method === 'clearRect'){
        if(toggle === 'show') drawStimRect()
        else if(toggle === 'hide') ctx.clearRect(0, 0, canvas.width, canvas.height); // TODO: could just clear rect over drawn stim?
    } else if(method === 'fillRect'){
        if(toggle === 'show') drawStimRect()
        else if(toggle === 'hide') drawStimRect('black') //canvas.style.backgroundColor
    }

    // STYLE changes ----- note methods below require a pre-drawn stim, which might not suit a complex animation

    // Visibility/opacity
    else if(method === 'visibility'){ // skips layout step, only repaints.
        if (toggle === 'show') canvas.style.visibility = 'visible';
        else if (toggle === 'hide') canvas.style.visibility = 'hidden';
    } else if(method === 'opacity') { // often handled by compositor without repainting.
        if (toggle === 'show') canvas.style.opacity = '1';
        else if (toggle === 'hide') canvas.style.opacity = '0'
    }

    // browser styles recalculates, redoes the page layout and repaints
    else if(method === 'display') { // Identical to canvas.hidden = true/false, but can override the {display: 'block'} required in CSS
        if (toggle === 'show') canvas.style.display = 'block';
        else if (toggle === 'hide') canvas.style.display = 'none' // https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#none
    } else if(method === 'hidden'){ // Should be same as display: 'none'
        if (toggle === 'show') canvas.hidden = false;
        else if (toggle === 'hide') canvas.hidden = true;
    } else if(method === 'contentVisibility') {
        if (toggle === 'show') canvas.style.contentVisibility = 'visible';
        else if (toggle === 'hide') canvas.style.contentVisibility = 'hidden';
    }

    // Transforms
    else if(method === 'left'){ // position
        if (toggle === 'show') canvas.style.left = '0px';
        else if (toggle === 'hide') canvas.style.left = `${canvas.width}px`;
    } else if(method === 'translate') {
        if (toggle === 'show') canvas.style.transform = `translateX(0px)`;
        else if (toggle === 'hide') canvas.style.transform = `translateX(${canvas.width}px)`;
    } else if(method === 'scale') {
        if (toggle === 'show') canvas.style.scale = '1'; // or .transform = 'scaleX(0)';?
        else if (toggle === 'hide') canvas.style.scale = '0';
    }

    // DOM
    else if(method === 'HTML') { // Options: innerHTML, insertAdjacentHTML
        if (toggle === 'show') container.innerHTML = '<canvas id="canvas"></canvas>'
        else if (toggle === 'hide') container.innerHTML = ''
    } else if(method === 'append') { // options: appendChild/removeChild, append/remove, insertBefore, replaceChildren, insertAdjacentElement
        if (toggle === 'show') {
            drawStimRect()
            container.append(canvas); // adds the canvas to the body element; or appendChild
        } else if (toggle === 'hide') {
            canvas.remove(); // or container.removeChild(canvas)
        }
        console.log(container.innerHTML);
    }

    // Error
    else {
        console.error('UNKNOWN Method ' + method)
    }
}

function wait(ms) {
    return new Promise(function executor(resolve, reject) {
        setTimeout(resolve, ms);
    });
}

async function runStimMethods(){
    for (const method of [...methods.dom, ...methods.canvas, ...methods.style]) {
        resetStimStyle(method)
        for(const toggle of ['show','hide']){
            if(toggle === 'show'){
                // hide first to set the state we want off (style methods), then make sure stim is drawn on canvas, then wait.
                if(!methods.dom.includes(method)) loadCanvas()
                toggleStim(method, 'hide');
                if(!methods.canvas.includes(method)) drawStimRect()
            }
            await wait(1000);   // a timer is created only when the loop reaches this line
            toggleStim(method, toggle);
            console.log({method, toggle});
        }
    }
}

runStimMethods().then(()=> {console.log('finished')})
// drawStimRect()
