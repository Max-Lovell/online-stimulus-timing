// TODO: consider generalising to use requestVideoFrameCallback for videos too?

function rAFLoop({
                     duration, // number
                     show, // function, optional - can use onFrame instead
                     onFrame, // function, optional - can use show() and hide() instead. receives {frameNumber, timestamp, elapsed, hide}.
                     hide, // function, optional - can use onFrame instead
                     onFinish, // function, optional, can just use show() and hide(). receives `result = getResult()`.
                     frameIntervalEstimate, // this is either a number or a function, and gets passed a interval for the receiver to use
                     guardFrames = 1.5, // 1.5 to always round nearest whole frame
                    }={}) {
    // INPUT TYPE VALIDATION - throws to caller
    function validateInputs(){
        const isOptionalFunction = f => f === undefined || typeof f === 'function'
        const isPositiveNumber = x => typeof x === 'number' && x > 0 // x > 0 rejects NaN
        if(!isPositiveNumber(duration)) throw TypeError('duration must be a positive number or Infinity')
        if(!(typeof guardFrames === 'number' && guardFrames >= 1 && guardFrames <= 2)) throw RangeError('guardFrames must be between 1 and 2')
        if(!(isOptionalFunction(frameIntervalEstimate) || (Number.isFinite(frameIntervalEstimate) && frameIntervalEstimate > 0))) throw TypeError('frameIntervalEstimate must be a positive number or a function')
        for(const [name, f] of Object.entries({show, onFrame, hide, onFinish})) {
            if(!isOptionalFunction(f)) throw TypeError(`${name} must be a function`)
        }
    }
    validateInputs()


    // GLOBALS
    let finished = false, frameNumber = 0, animationId = null, result, cancelled = false, hidden= false;
    const timestamps = [], frameIntervals = [], callbackEndTimes = [];

    // INTERVALS
    function median(interval){
        // TODO: Fill with the pre-block intervals if number (how many?) before the first tick - needs separate arg?
        // insert into array
        const index = frameIntervals.findIndex((ifi) => ifi>interval)
        index === -1 ? frameIntervals.push(interval) : frameIntervals.splice(index, 0, interval) // -1 on splice adds as second to last
        // Pick lower of two values median as missed frames only extend times
        return frameIntervals[Math.floor((frameIntervals.length-1)/2)];
    }

    function getFrameInterval(interval){
        if(typeof frameIntervalEstimate === 'function') return frameIntervalEstimate(interval)
        else if(typeof frameIntervalEstimate === 'number') return frameIntervalEstimate
        // else return median
        return median(interval); // or just grab the global version?
    }

    // End
    function stop(){
        if(finished) return
        finished = true;
        if (animationId) cancelAnimationFrame(animationId)
        animationId = null;
    }

    function getResult(reason, error=null){ // idempotent - safe to call any time, returns result of first call
        if(!result) {
            result = {
                earliestOnset: timestamps[1] ?? null,
                endTime: timestamps[timestamps.length-1] ?? null,
                framesDrawn: frameNumber,
                timestamps,
                callbackEndTimes,
                reason,
                error,
                hidden
            }
        }
        return result;
    }

    function notifyFinish(data) {
        setTimeout(() => {
            if (onFinish && !cancelled) onFinish(data)
        }, 0)
    }

    function handleError(error){
        // Handle error
        console.error(error)
        if(result) return result
        stop()
        // note callbackEndTimes[] may be one shorter than timestamps[]
        if(callbackEndTimes.length < timestamps.length) callbackEndTimes.push(performance.now())
        const data = getResult('error', String(error)) // a deliberately strange throw could rethrow - but ignoring.
        notifyFinish(data)
        return data
    }

    function endAnimation(endTime){
        if(finished) return
        try {
            stop()
            // Push final frame - this is the frame where the stimulus was actually hidden
            timestamps.push(endTime) // note don't increment frameNumber, which is framesDrawn, not refreshes.
            // setTimeout allows endTrial to leave render cycle and run on normal event loop after current frame's paint, incase causes overrun
            // Don't swap for queueMicrotask or promise - Microtasks run straight after each rAF callback, while the frame is still being prepared and before it's painted. Only a new task moves onFinish out of the frame.
            const data = getResult('duration')
            notifyFinish(data)
            callbackEndTimes.push(performance.now())
        } catch(e) {
            handleError(e)
        }

    }

    // Animation frames and callbacks
    function tick(timestamp){ // Note this timestamp should be roughly the start of the render cycle's frame creation
        if(finished) return
        try {
            // Record progress
            timestamps.push(timestamp);

            // Inter-Frame-Interval
            const interFrameInterval = timestamp-timestamps[timestamps.length-2]
            const predictedFrameInterval = getFrameInterval(interFrameInterval);
            if(typeof predictedFrameInterval !== 'number' || !(predictedFrameInterval > 0)) throw Error('predictedFrameInterval must be a positive number')

            // Calculate if final frame
            const earliestOnset = timestamps[1] // frameNumber 1 = earliest actual onset (model) startTime.
            const timeOnScreen = timestamp - earliestOnset
            const timeAtNextFrameRounded = timeOnScreen + (predictedFrameInterval * guardFrames)
            const keepShowing = timeAtNextFrameRounded < duration

            // Elapsed counts from the first callback so it advances every frame; with steady frames it equals the on-screen time of this frame's content.
            const elapsedAnimationTime = timestamp - timestamps[0]
            // Call the frame - optional hide if they want to do it using onFrame
            if(onFrame) onFrame({frameNumber, timestamp, elapsed: elapsedAnimationTime, hide: !keepShowing})
            if(finished) return // NOTE: if onFrame calls cancel() on the hide frame, hide() still runs afterwards without this guard

            // end or redraw
            if (keepShowing) {
                frameNumber++ // counts callbacks. hide() frame is not a stimulus frame draw.
                animationId = requestAnimationFrame(tick)
            } else {
                if(hide) hide()
                hidden = true
                animationId = requestAnimationFrame(endAnimation);   // clear becomes visible when this fires
            }

            callbackEndTimes.push(performance.now())
            // consider putting line above before if(finished) return to keep aligned, although technically this is the end of the callback after hide()
        } catch(e){
            handleError(e)
        }

    }

    function startAnimation(preDrawTimestamp){
        if(finished) return
        try {
            // Separate start animation call as interFrameInterval and earliestOnset can't be derived until next frame
            if(show) show()
            timestamps.push(preDrawTimestamp);

            const elapsed = preDrawTimestamp - timestamps[0] // Necessarily 0...
            if(onFrame) onFrame({frameNumber, timestamp: preDrawTimestamp, elapsed, hide: false})
            frameNumber++; // frameNumber = 0 = 'show called, not yet on screen'
            animationId = requestAnimationFrame(tick)
            callbackEndTimes.push(performance.now())
        } catch(e){
            handleError(e)
        }
    }

    animationId = requestAnimationFrame(startAnimation)

    // Return cancel function
    function cancel() {
        cancelled = true
        stop()
        return getResult('cancelled')
        // consider calling onFinish(result) here
    }

    return cancel;
}
