// Get CANVAS
const canvas = document.getElementById('canvas');
// Note will be rescaled by CSS technically but
canvas.width = document.documentElement.clientWidth // or .getBoundingClientRect().width;
canvas.height = document.documentElement.clientHeight
const ctx = canvas.getContext('2d'); // TODO: consider { alpha: true/false }

// Drawing stim -------
function drawStimRect(colour='white'){
    ctx.fillStyle = colour;
    const {width, height} = canvas;
    const stimSize = Math.min(width, height)*.2;
    ctx.fillRect(0, 0, stimSize, stimSize);
    ctx.fillRect(width-stimSize, height-stimSize, stimSize, stimSize);
}

// Either need this - which maintains a nice square, or can allow for rectangles with CSS:
window.onresize = (e) => {
    console.log(e.type)
    // TODO: is this necessary? keeps this square and on screen with size changes, but might make things higher res and so slower to render...?
    canvas.width = document.documentElement.clientWidth // or .getBoundingClientRect().width;
    canvas.height = document.documentElement.clientHeight
    // // note preliminary sketch to check canvas draw
    // toggleStim('clearRect','hide')
    // toggleStim('clearRect','show')
}

function resetStimStyle(){
    // TODO: Only page reload or new canvas actually resets - run each method in random block order with this
    //  After you've changed a canvas's opacity, Chrome may give it its own compositing layer and keep it that way.
    //  A canvas that has been display: none may have had its GPU resources released.
    //  context settings need fresh canvas anyway
    canvas.style.visibility = '';
    canvas.style.opacity = '';
    canvas.style.display = '';
    canvas.hidden = false;
    // console.log(getComputedStyle(canvas)) // TODO: record this.
}

const methods = {
    canvas: ['clearRect', 'fillRect'],
    style: ['visibility', 'opacity', 'hidden', 'display']
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

    // STYLE changes - note methods below require a pre-drawn stim, which might not suit a complex animation
    else if(method === 'visibility'){ // skips layout step, only repaints.
        if (toggle === 'show') canvas.style.visibility = 'visible';
        else if (toggle === 'hide') canvas.style.visibility = 'hidden';
    } else if(method === 'opacity') { // often handled by compositor without repainting.
        if (toggle === 'show') canvas.style.opacity = '1';
        else if (toggle === 'hide') canvas.style.opacity = '0'
    }

    // browser styles recalculates, redoes the page layout and repaints
    else if(method === 'hidden') {
        if (toggle === 'show') canvas.hidden = false; //note same as style.display = 'none'
        else if (toggle === 'hide') canvas.hidden = true;
    } else if(method === 'display') { // Identical to canvas.hidden = true/false
        if (toggle === 'show') canvas.style.display = 'block';
        else if (toggle === 'hide') canvas.style.display = 'none' // https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display#none
    }
}

function wait(ms) {
    return new Promise(function executor(resolve, reject) {
        setTimeout(resolve, ms);
    });
}

async function runStimMethods(){
    for (const method of [...methods.canvas, ...methods.style]) {
        resetStimStyle()
        for(const toggle of ['show','hide']){
            if(toggle === 'show'){
                // hide first to set the state we want off (style methods), then make sure stim is drawn on canvas, then wait.
                toggleStim(method, 'hide');
                if(methods.style.includes(method)) drawStimRect()
            }
            await wait(1000);   // a timer is created only when the loop reaches this line
            console.log({method, toggle});
            toggleStim(method, toggle);
        }
    }
}

runStimMethods().then(()=> {console.log('finished')})
