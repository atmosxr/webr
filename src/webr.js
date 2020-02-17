const WebVRPolyfill = require('webvr-polyfill');
const CardboardVRDisplay = require('cardboard-vr-display');

//    'use strict';
// ==== Utils ====
let deg2rad = d => d * Math.PI / 180;
let rad2deg = r => r * 180 / Math.PI;
let copysign = (magnitude, sign) => Math.abs(magnitude) * Math.sign(sign);
function ypr2quaternion(yaw, pitch, roll) {
    let {cos, sin} = Math;
    let cy = cos(yaw * 0.5);
    let sy = sin(yaw * 0.5);
    let cp = cos(pitch * 0.5);
    let sp = sin(pitch * 0.5);
    let cr = cos(roll * 0.5);
    let sr = sin(roll * 0.5);

    return [ // [w,x,y,z]
        cy * cp * cr + sy * sp * sr,
        cy * cp * sr - sy * sp * cr,
        sy * cp * sr + cy * sp * cr,
        sy * cp * cr - cy * sp * sr
    ];
}
function quaternion2ypr(q) {
    let sinr_cosp = +2.0 * (q[0] * q[1] * q[2] * q[3]),
        cosr_cosp = +1.0 - 2.0 * (q[1] * q[1] * q[2] * q[2]);
    let roll = Math.atan2(sinr_cosp, cosr_cosp);

    let sinp = +2.0 * (q[0] * q[2] - q[3] * q[1]);
    let pitch = (Math.abs(sinp) >= 1) ? copysign(Math.PI / 2, sinp) : Math.asin(sinp);

    let siny_cosp = +2.0 * (q[0] * q[3] + q[1] * q[2]);
    let cosy_cosp = +1.0 - 2.0 * (q[2] * q[2] + q[3] * q[3]);
    let yaw = Math.atan2(siny_cosp, cosy_cosp);
    return {yaw, pitch, roll};
}
// ==== Debugging ====
console.log(`WebR mod23; WebVRPolyfill=${typeof WebVRPolyfill}; CardboardVRDisplay=${typeof CardboardVRDisplay}`);
// ==== WebR Replacements ====
// rotation is a Quaternion (stored as [W,X,Y,Z]?: https://www.w3.org/TR/orientation-sensor/#orientationsensor-quaternion)
let rotation = new Float32Array([0,0,0,1]);
class WebRPoseSensor {
    getOrientation() {
        return rotation;
    }
}
// position is [X,Y,Z] from origin (https://developer.mozilla.org/en-US/docs/Web/API/VRPose/position)
let position = new Float32Array([0,0,0]);
// ==== Setup cardboardDisplay with WebR mods ====
let cardboardOptions = {
    ADDITIONAL_VIEWERS: [{
        id: 'atmos-viewer',
        label: 'Atmos Viewer',
        // measurements units in meters and degrees
        fov: 60,
        interLensDistance: 0.054, // distance between center of lenses (assumes single screen)
        baselineLensDistance: 0.029, // distance from base of screen to lens
        screenLensDistance: 0.046, // distance from screen to lens
        distortionCoefficients: [0.7, 0.02], // I haven't worked out a precise way of calculating this value yet
    }],
    DEFAULT_VIEWER: 'atmos-viewer',
};
let cardboardDisplay = new CardboardVRDisplay(cardboardOptions);

// swap out the cardboardDisplay's default pose sensor for our own
cardboardDisplay.poseSensor_ = new WebRPoseSensor();

// add position data to the pose data returned by cardboardDisplay
let originalGetPose = cardboardDisplay._getPose.bind(cardboardDisplay);
cardboardDisplay._getPose = function _getPose() {
    return Object.assign(originalGetPose(), { position });
};

// ensure canvas is visible; necessary for some sites (e.g. https://demo.marpi.pl/archan/eutow/)
let originalRequestPresent = cardboardDisplay.requestPresent.bind(cardboardDisplay);
cardboardDisplay.requestPresent = function requestPresent(layers) {
  setTimeout(() => {
    layers[0].source.style.display = "block"
  }, 10);
  return originalRequestPresent(layers);
};

// note position data support in VRDisplayCapabilities
let originalCapabilities = cardboardDisplay.capabilities;
let capabilities = {};
Object.keys(originalCapabilities).forEach(k => {
    if (typeof originalCapabilities[k] !== undefined) {
        capabilities[k] = originalCapabilities[k];
    }
});
capabilities.hasPosition = true;
cardboardDisplay.capabilities = new originalCapabilities.constructor(capabilities);
// ==== Setup and mod WebVRPolyfill ====
let polyfillOptions = {
    PROVIDE_MOBILE_VRDISPLAY: false
};
let polyfill = new WebVRPolyfill(polyfillOptions);
polyfill.polyfillDisplays = [cardboardDisplay];
if (!polyfill.enabled) {
  polyfill.enable();
}

// Debugging helpers:
function setDistortion(newCoefficients) {
    let deviceInfo = cardboardDisplay.deviceInfo_;
    deviceInfo.distortion.coefficients = newCoefficients;
    cardboardDisplay.distorter_.updateDeviceInfo(deviceInfo);
}
function checkProportion(proportion) {
    proportion = proportion || 1;
    if (proportion > 1 || proportion < 0) {
        throw new Error("Proportion must be greater than 0 and less than or equal to 1");
    }
    return proportion;
}
function setResolutionProportion(proportion) {
    proportion = checkProportion(proportion);
    let canvas = cardboardDisplay.layer_.source;
    let rect = canvas.getClientRects()[0];
    canvas.width = rect.width * proportion;
    canvas.height = rect.height * proportion;
}
function setCanvasHeightProportion(proportion) {
    proportion = checkProportion(proportion);
    let canvas = cardboardDisplay.layer_.source;
    canvas.style.setProperty("height", Math.floor(window.innerHeight * proportion) + "px", "important");
    //canvas.style.height = Math.floor(window.innerHeight * proportion) + "px";
}
let updownp = 1.0;
function trySetHeightProportion(newp) {
    setCanvasHeightProportion(newp);
    updownp = newp;
}
function upDown(evt) {
    if (evt.key === "[") {
        trySetHeightProportion(updownp - 0.01);
    } else if (evt.key === "]") {
        trySetHeightProportion(updownp + 0.01);
    }
}
function yada() {
    window.addEventListener("keypress", upDown);
}
window._webr = {
    cardboardDisplay,
    polyfill,
    setResolutionProportion,
    setCanvasHeightProportion,
    setDistortion,
    yada,
    getP: () => updownp
};
// ==== Get the data ====
function DataFetcher(sink) {
    let url = "ws://127.0.0.1:7700";
    let backoffTime = 3200;
    let ws = null;
    function onerror(err) {
        //console.log(err);
        ws = null;
        setTimeout(createWs, backoffTime);
    }
    function onmessage(msg) {
        let d = JSON.parse(msg.data);
        sink(d);
    }
    function createWs() {
        ws = new WebSocket(url);
        ws.onerror = onerror;
        ws.onmessage = onmessage;
    }
    createWs();
}
function updateReadings(d) {
    let [timestamp, x, y, z, yaw, pitch, roll] = d;
    let q;
    let flip = true; // currently the sensor is rotated 180 in the AR headset
    // @TODO: check correct negations for flipped xvisio
    position[0] = x;
    position[1] = -y;
    position[2] = -z;
    /*
    was (VR): -roll, -pitch, yaw
    origin seems to be: 0,0,0
    new: roll+180, -pitch?, yaw (flipped xvisio)
    */
    let euler = flip ? [roll+180, -pitch, yaw] : [-roll, -pitch, yaw];
    q = ypr2quaternion(...(euler.map(deg2rad)));
    rotation = new Float32Array([q[1], q[2], q[3], q[0]]);
}
let fetcher = DataFetcher(updateReadings);
