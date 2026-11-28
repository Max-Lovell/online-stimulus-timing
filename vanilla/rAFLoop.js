// TODO: consider generalising to use requestVideoFrameCallback for videos too?
// noinspection DuplicatedCode

function rAFLoop({
                     duration, // number, ms. use end() to end trial if using Infinity.
                     show, // function, optional - can use onFrame instead
                     onFrame, // function, optional - can use show() and hide() instead. receives {frameNumber, timestamp, elapsed, hide}.
                     hide, // function, optional - can use onFrame instead
                     onFinish, // function, optional, can just use show() and hide(). receives `result = getResult()`. not called after cancel()
                     frameIntervalEstimate, // this is either a number or a function which receives the previous inter-frame-interval
                     guardFrames = 1.5, // 1 = never shorter than duration, 1.5 = nearest frame, 2 = never longer
                        // TODO: 'guardFrames' could be renamed to ... 'stopFramesAhead'?
                     // TODO: clearer dx on guardFrames might be adding 1 to it later so e.g. 0.5 = current 1.5 = half frame ahead
                    }={}) {

    // INPUT TYPE VALIDATION ----- throws to caller
    const isOptionalFunction = f => f === undefined || typeof f === 'function'
    const isPositiveNumber = x => typeof x === 'number' && x > 0 // x > 0 rejects NaN
    // if(duration === undefined) duration = Infinity
    if(!isPositiveNumber(duration)) throw TypeError('duration must be a positive number or Infinity')
    if(!(typeof guardFrames === 'number' && guardFrames >= 1 && guardFrames <= 2)) throw RangeError('guardFrames must be between 1 and 2')
    if(!(isOptionalFunction(frameIntervalEstimate) || (Number.isFinite(frameIntervalEstimate) && frameIntervalEstimate > 0))) throw TypeError('frameIntervalEstimate must be a positive number or a function')
    for(const [name, f] of Object.entries({show, onFrame, hide, onFinish})) {
        if(!isOptionalFunction(f)) throw TypeError(`${name} must be a function`)
    }


    // GLOBALS -----
    let finished = false, frameNumber = 0, animationId = null, result = null,
        cancelled = false, hidden= false, endRequested = false,
        endReason = null, offsetTimestamp = null
    const timestamps = [], frameIntervals = [], callbackEndTimes = []


    // INTERVALS -----
    // Median is a fallback function if one isn't provided.
    function median(interval){
        // TODO: Fill with the pre-block intervals if number (how many?) before the first tick - needs separate arg?
        // insert into array
        const index = frameIntervals.findIndex((ifi) => ifi>interval)
        index === -1 ? frameIntervals.push(interval) : frameIntervals.splice(index, 0, interval) // -1 on splice adds as second to last
        // Pick lower of two values in an even length array median, as missed frames only extend times
        return frameIntervals[Math.floor((frameIntervals.length-1)/2)];
    }

    function getFrameInterval(interval){
        if(typeof frameIntervalEstimate === 'function') return frameIntervalEstimate(interval)
        else if(typeof frameIntervalEstimate === 'number') return frameIntervalEstimate
        // else return median
        return median(interval);
    }


    // END -----
    function stop(){
        if(finished) return
        finished = true;
        if(animationId) cancelAnimationFrame(animationId)
        animationId = null;
    }

    function getResult(reason, error=null){ // idempotent - safe to call any time, returns result of first call
        if(!result) {
            result = {
                earliestOnset: timestamps[1] ?? null,
                endTime: offsetTimestamp, // null after cancel() as not ended properly
                framesDrawn: frameNumber,
                timestamps,
                callbackEndTimes, // Doesn't include rendering, just a performance.now() call at the end of the callback.
                reason, // 'duration' | 'ended' | 'cancelled' | 'error'
                hidden, // if hide() function was called
                error
            }
        }
        return result;
    }

    function finish(reason, error=null){
        if(finished) return
        stop()
        const data = getResult(reason, error)
        setTimeout(() => {
            if (onFinish && !cancelled) onFinish(data) // Cancelled returns data directly, caller has control
        }, 0)
    }


    // ANIMATION FRAMES -----
    // Frame wrapper - every rAF callback goes through here - cleans up repeated try/catch's and guards
    function frame(step){
        return timestamp => {
            if(finished) return
            timestamps.push(timestamp)
            try {
                step(timestamp)
            } catch(error) {
                console.error(error)
                finish('error', String(error)) // the stimulus is left as it is - the caller decides, via onFinish
            } finally {
                // Note this can present a confusing order of events, but will run before the final onFinish(data) in finish() runs
                if(callbackEndTimes.length < timestamps.length) callbackEndTimes.push(performance.now()) // skipped if stop() already pushed
            }
        }
    }

    // Separate start animation call as interFrameInterval and earliestOnset can't be derived until next frame
    const startAnimation = frame(timestamp => {
        if(show) show()
        if(onFrame) onFrame({frameNumber, timestamp, elapsed: 0, hide: false})
        if(finished) return // cancel() was called inside onFrame
        frameNumber++ // frameNumber 0 = 'show called, not yet on screen'
        animationId = requestAnimationFrame(tick)
    })

    // After first call, decide to keep running or hide stim based on timestamp.
    const tick = frame(timestamp => {
        const predictedFrameInterval = getFrameInterval(timestamp - timestamps[timestamps.length - 2])
        if(!isPositiveNumber(predictedFrameInterval)) throw Error('frameIntervalEstimate must give a positive number')

        //Show for another frame if waiting lands closer to duration (with guardFrames = 1.5),
        const timeOnScreen = timestamp - timestamps[1] // frame 1 = earliest onset (model)
        //ceil(duration / F − x)
        const durationReached = !(timeOnScreen + predictedFrameInterval * guardFrames < duration)
        const keepShowing = !durationReached && !endRequested

        // elapsed counts from frame 0 so it advances every frame, although draw on screen was at frame 1
        //  if steady framerate, elapsed is on-screen time for current draw, despite 'timestamp' referring to a past moment
        if(onFrame) onFrame({frameNumber, timestamp, elapsed: timestamp - timestamps[0], hide: !keepShowing})
        if(finished) return // cancel() was called inside onFrame

        if(keepShowing) {
            frameNumber++ // committed to showing another frame. The hide frame is not a stimulus frame
            animationId = requestAnimationFrame(tick)
        } else { // hide stim and record next callback time
            endReason = durationReached ? 'duration' : 'ended'
            if(hide) hide()
            hidden = true
            animationId = requestAnimationFrame(endAnimation) // the hide is on screen when this fires (model)
        }
    })

    const endAnimation = frame(function(timestamp){
        offsetTimestamp = timestamp
        finish(endReason)
    })


    // MANUAL END FUNCTIONS -----
    // Stop now and hand control to the caller. hide() and onFinish() not called, endTime is added when callback returns
    // hidden exists to report if hide() has already run for this caller.
    function cancel() {
        cancelled = true
        stop()
        return getResult('cancelled') // consider calling onFinish(result) here
    }

    // End early through the normal path: hide() runs in the next frame callback and the offset frame is timestamped
    function end(){ // Useful for ending next frame after a button press
        if(finished) return
        if(timestamps.length === 0) finish('ended') // first frame hasn't run: nothing shown, nothing to hide
        else endRequested = true // picked up by the next tick. If hide() has already run, the trial is ending anyway
    }

    // START ANIMATING -----
    animationId = requestAnimationFrame(startAnimation)
    // return manual ending functions
    return {cancel, end};
}
