/**
 * Differential Steering algorithm
 * -------------------------------------------
 * (c)  LunaX
 * 
 * Convert an input vector (e.g. from Joystick) into a differential
 * drive motor control, with support for both drives and a pivot operation
 * 
 * 
 */
'use strict'

module.exports = class DiffSteering {

    /**
     * 
     */

    static getDefaultGeometry() {
        var dg = {
            numberOfWheels  : 2,
            wheelDiameter   : 25,
            wheelDistance   : 100,
            pwmLimits       : [-127, 128],
            inputLimits     : [-127,128],
            speedOffsets    : [0,0],
            pivotLimit      : 50.0          // percentage of max pwmLimit
        }
        return dg;
    } 

    /**
     * map number x from range in_min/in_max to out_min, out_max
     * 
     * if x < in_min set x = in_min
     * if x > in_max set x = in_max
     */
    static map (x, in_min, in_max, out_min, out_max) {
        x = Math.min(Math.max(x, in_min), in_max);
        return Math.ceil((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
    }

    /**
     * 
     * @param {Array}  
     *  {
     *       numberOfWheels  : 2,
     *       wheelDiameter   : 25,   // millimeter
     *       wheelDistance   : 100,  // millimeter
     *       pwmLimits      : [-255, 255],
     *       inputLimits     : [-100,100],
     *       speedOffsets    : [0,0],
     *       pivotLimit      : 32.0          // 0..127
     *              // pivotLimit represent a scaling factor.
     *              // if inputY < pivotScale than this scaling factor
     *              // is used to recalculate steering speed per motor
     *              // 
     *   } 
     */
    constructor (default_geometry) {
        if (default_geometry != null) {
            this.geometry = default_geometry;
        } else {
            this.geometry = DiffSteering.getDefaultGeometry();
        }
        this.R = (this.geometry.inputLimits[1] * Math.log10(2) / Math.log2(this.geometry.pwmLimits[1]));
    }

    setPivotLimit(limit) {
        if (limit > 0) {
            this.geometry.pivotLimit = limit;
        }
        else {
            this.geometry.pivotLimit = 0;           
        }
    }

    getPWM(inputX, inputY) {
        var pwmLeft, pwmRight;

        //
        // map input value to speedLimits
        //
        // calculate a turn due to inputX value
        if (inputY >= 0) {
            // Forward
            pwmLeft = (inputX >= 0) 
                        ? this.geometry.inputLimits[1] 
                        : (this.geometry.inputLimits[1] - inputX);
            pwmRight = (inputX >= 0) 
                        ? (this.geometry.inputLimits[1] + inputX) 
                        : this.geometry.inputLimits[1];
        } else {
            // Backward
            pwmLeft = (inputX >= 0) 
                        ? (this.geometry.inputLimits[1] + inputX)
                        : this.geometry.inputLimits[1];
            pwmRight = (inputX >= 0) 
                        ? this.geometry.inputLimits[1]
                        : (this.geometry.inputLimits[1] - inputX);      
        }

        // scale drive output due to inputY input
        // (throttle)
        pwmLeft = pwmLeft * inputY / this.geometry.inputLimits[1];
        pwmRight = pwmRight * inputY / this.geometry.inputLimits[1];
        
        //
        // now calculate a pivot amount
        // - strength of pivot (pivotSpeed) based inputX
        // - blending of pivot vs drive (pivotScale) based on inputY
        var pivotSpeed = inputX;
        var pivL = this.geometry.pwmLimits[1] * (this.geometry.pivotLimit / 100);
        var pivotScale = (Math.abs(inputY) > pivL)
                            ? 0.0 
                            : (1.0 - (Math.abs(inputY) / pivL));
   
        //
        // mix pwmValues and pivot

        var left = (1.0 - pivotScale) * pwmLeft + pivotScale * (-pivotSpeed);
        var right = (1.0 - pivotScale) * pwmRight + pivotScale * (pivotSpeed);
        
        //
        // convert steering values into
        // robot pwm relevant data
        left = DiffSteering.map(left, 
            this.geometry.inputLimits[0],
            this.geometry.inputLimits[1],
            this.geometry.pwmLimits[0],
            this.geometry.pwmLimits[1]           
        );

        right = DiffSteering.map(right, 
            this.geometry.inputLimits[0],
            this.geometry.inputLimits[1],
            this.geometry.pwmLimits[0],
            this.geometry.pwmLimits[1]          
        );

        return [left, right];
    }


    
    getExpoPWM(inputx, inputy) {
        var pwmSpeed = this.getPWM(inputx, inputy);
        console.log("getExpoPWM() => speed [%s]", pwmSpeed);
        console.log("getExpoPWM() => R: %s" , this.R);
        pwmSpeed[0] = Math.pow(2, (pwmSpeed[0] / this.R)) - 1; 
        pwmSpeed[1] = Math.pow(2, (pwmSpeed[1] / this.R)) - 1; 
        console.log("getExpoPWM() => speed [%s]", pwmSpeed);
        return pwmSpeed;
    }
}

//module.exports.DiffSteering = DiffSteering;


