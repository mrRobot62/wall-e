/**
 *  Wall-E - NodeBot
 * 
 *  Two track bot
 * 
 *  Server application
 * 
 * 
 */
var VERSION = "0.1",
    fs = require("fs"),
    log4js = require("log4js"),
    five = require("johnny-five"),
    board = new five.Board(),
    motors = [],
    request = require('request'),
    networkInterfaces = require('os').networkInterfaces(),
    logger = log4js.getLogger(),
    WebSocketServer = require('ws').Server,
    webappURL = 'http://192.168.0.152:3000',
    PORT = '8080',
    led = null,
    localIP,
    PWM = [
      {
        invert : true,
        min : 0,        // minimum value for used motor
        max : 255,      // maximum value for PWM
        offset : 0      // used for speed offset
      },
      {
        invert : true,
        min : 0,      
        max : 255,
        offset : 0
      }
    ],
    MAX_RPM       = 100,
    WHEEL_DIA_MM  = 50,
    WHEEL_DIST_MM = 100,
    PWM_BITS      = 8,
    kinematic     = null,
    CONFIG        = "./server/server_config.json"
    ;



    logger.info("------------------------------------------");
    logger.info(" Wall-E NodeBot " + VERSION);
    logger.info(" (c) by LunaX");
    logger.info("------------------------------------------");
    

    //----------------------------------------------------------
    // read application configuration file
    //----------------------------------------------------------
    var content_config = fs.readFileSync(CONFIG);
    var json_config = JSON.parse(content_config);
    //logger.debug (json_config);

    logger.level = json_config.loglevel;

    var wss = new WebSocketServer({port: PORT});

board.on("ready", function() {
    led = new five.Led(13);
    //--------------------------------------------------------
    // Configure motors
    //--------------------------------------------------------
    logger.debug("configure motors");
    motors = new five.Motors ([
      {pins: {pwm: 5, dir: 4}, invertPWM: false},    // Motor A
      {pins: {pwm: 6, dir: 7}, invertPWM: false},    // Motor B
    ]);


    motors[0].stop();
    motors[1].stop();
    logger.info("all motors off");

  //kinematic = new WheelKinematics(MAX_RPM, WHEEL_DIA_MM, WHEEL_DIST_MM, PWM_BITS);

  //logger.debug(kinematic.getRPM(0,0,1.0));
  //logger.debug("getRPM(" + x +")"); 
  //logger.debug("getPWM(" + kinematic.getPWM(30,30,0) +")"); 
  
  //--------------------------------------------------------
  // use REPL for debugging/tests
  //--------------------------------------------------------

  logger.debug("configure REPL");
  this.repl.inject({
    // Allow limited on/off control access to the
    // Led instance from the REPL.
    led: led,
    
    on: function() {
      console.log("step into on:");
      led.on();
    },
    off: function() {
      console.log("step into off:");
      led.stop();
      led.off();
    },
    blink: function() {
      console.log("step into blink:");
      led.blink(250);
    },
    stop : function() {
      console.log("STOP");
      drive(0,0);
    },
    fwd : function() {
      console.log("FWD");
      drive(0,127);
    },
    rev : function() {
      console.log("REV");
      drive(0,-127);
    },
    right : function() {
      console.log("RIGHT");
      drive(80,127);
    },
    left : function() {
      console.log("LEFT");
      drive(-80,127);
    },
    
    help: function() {
      logger.info("----------------------------");
      logger.info("on     : LED on");
      logger.info("off    : LED off");
      logger.info("blink  : LED blink");
      logger.info("stop   : All Motors OFF");
      logger.info("fwd    : go fwd");
      logger.info("rev    : go bwd");
      logger.info("help   : show this screen");
      logger.info("----------------------------");
    }
  });
});

//-------------------------------------------------------------------------
// WebSocket handling
//-------------------------------------------------------------------------
wss.on('connection', function(ws) {
  ws.on('message', function(data, flags){
    //logger.debug('WebSocket-Data received (' + data + ') Flags: (' + flags + ')');

    if (data === 'on' || data === 'off' || data === 'stop' || data === 'blink') {
      led_handling(data);
     } else {
      // parse_ws_data(data);
      //logger.debug('Message (' + data + ')');
      var raw_cmd = JSON.parse(data);
      //logger.debug ("Radius: %s, X:%s, Y:%s", raw_cmd.cfg.radius, raw_cmd.joystick1.dX , raw_cmd.joystick1.dY);

      if (raw_cmd.joystick1.dX != 0 || raw_cmd.joystick1.dX != 0) {
        drive (raw_cmd.cfg.radius, raw_cmd.joystick1.dX, raw_cmd.joystick1.dY);
      }
    }
});


  ws.on('close', function() {
    logger.info('WebSocket - closed');
  });

  ws.on('close', function(e) {
    logger.error('WebSocket on close - Error => ' + e.message);
  });  
});


// send robot ip to webapplication
if (networkInterfaces.wlan0) {
  localIP = networkInterfaces.wlan0[0].address;
  logger.debug("read wlan0 IP-address => " + localIP);
} else {
  // use en0 (eth0) during cable connection
  logger.info("Connect via LAN (%s",networkInterfaces.eth0.address);
  localIP = networkInterfaces.eth0[0].address;
}

logger.info('Local server address ws://%s:%s', localIP, PORT);

webappURL += '/locate?local_ip=' + localIP;
logger.info('webappURL=', webappURL);

request.post(webappURL, function(e,r,body) {
  if (e) {
    logger.error('WebSocket - Error - POST request failed => ' + e.message);

  }
});

//----------------------------------------------------
//            END
//----------------------------------------------------

//----------------------------------------------------
// general functions
//----------------------------------------------------

var led_handling = function ( mode) {
  if (mode === 'on') {
    led.on();
  } else if (mode === 'off') {
    led.stop();
    led.off();
  } else if (mode === 'blink') {
    led.blink(250);
  }
}


//----------------------------------------------------
// Differential Steering kinematic
//----------------------------------------------------
/**
 * drive function - calles via websocket
 * calculate due to vector (x,y) speed values for left/right motor
 * 
 * @param {*} r max radius from joystick
 * @param {*} x x position of joystick
 * @param {*} y y position of joystick
 */
var drive = function(r, x,y) {
  const kinematic = require("./Kinematics.js");
  var g = kinematic.getDefaultGeometry();

  // set limits to joystick radius
  g.inputLimits[0] = -r;
  g.inputLimits[1] = r;

  g.pwmLimits[0] = -r;
  g.pwmLimits[1] = r;
  
  g.pivotLimit = 35.0;

  var ds = new kinematic(g);
  var speeds = ds.getPWM(x,y);
  console.log("Kinematic => %s", speeds);

  driveMotors(r,motors, speeds);

};

/**
 * set motor speed for all three motors. Negative speed = forward, positiv speed = reverse
 * @param {*} jR representation of joystick max radius, used for mapping pwm speed 
 * @param {*} motors array for all three motors
 * @param {*} speeds array for all three motors based for an omniwheel movement
 */

 
var driveMotors = function (jR, motors, speeds) {
  var msg = "";
  for(var i=0; i < motors.length; i++) {
    msg += "[M" + i + " ";
    speed = Math.abs(speeds[i]);
    sign = Math.sign(speeds[i]);

    // set speed into PWM range    
    speed = Math.ceil(speed);
    speed = map(speed, 0, jR , PWM[i].min, PWM[i].max);
    //
    // set an offset value to current motor to adapt technical motor variations 
    speed = clamp (speed + PWM[i].offset,PWM[i].min, PWM[i].max);

    //
    // forward/reverse/stop motion
    if (PWM[i].invert) sign *= -1;
    switch (sign) {
      case 0: motors[i].stop(); msg += 'STOP];'; break;
      case 1: motors[i].forward(speed); msg += 'FWD:' + speed + ']; '; break;
      case -1: motors[i].reverse(speed); msg += 'REV:' + speed + ']; '; break;
    }
  }
  logger.debug(msg);
};


/** 
 * change cartesian (x/y) position into a polar system (radius/degree)
 * 
 * return an array [radius, degree, vangular]
*/
var cartesian2Polor = function(x,y) {
  theta = Math.atan2(x,y);
  r = Math.sqrt(y*y + x*x);
  logger.debug("cartesian2Polor (R:" + r + ", Theta: " + theta + ")");
  // [radius, angle, vangular]
  return [r,theta, 0];
};


/*
//var OmniMotor = function (angle, vlinear, vangular) {
var calculateSpeeds = function (vector) {
  // ------------- TWO-WHEEL kinematic ------------------
  // Notations:
  // Vr, Vl = right/left wheel velocity
  // I/2    = wheel spearation (center to wheel-center)
  // W      = is the angular velocity of the robot (rate at which the robot is rotating aoubt the vertical axis)
  // ICC    = Instantaneous center of curvature
  // R      = distance between ICC and robot base center
  // (x,y)  = robot position
  // O      = robot orientation
  // S      = speed

  // From basic equations of motion
  // (1) Vr   = (R + I/2) * W + S
  // (2) Vl   = (R - I/2) * W + S
  // Solving :
  // (3) R    = I/2 * (Vl * Vr) / (Vr - Vl)
  // (4) W    = (Vr - Vl) / I/2
  //
  // if Vr = Vl : we get R as infinity and the robot travels straigt
  // if Vr = -Vl: R becomes 0 (zero) and the robot turns on its ICC or base center
  // all other values: robot will steer left/right 
  //
  //
  // Example: (I/2 = 10)
  // Straight forward with Speed 100 (max 255)
  // R = 0, W = 0
  // (1) Vr = (0 + 10) * 0 + 50 = 50
  // (2) Vl = (0 - 10) * 0 + 50 = 50
  //
  // (3) R = 10 * (0 * 0) / (0-0) = 0
  // (4) W = (0 - 0) / 0 = 0
  //
  // R = 15, W = 1  => Left-Turn
  // (1) Vr = (15 + 10) * 1 = 25 + 50 = 75
  // (2) Vl = (15 - 10) * 1 = 5 + 50 = 55
  //
  // R = -15, W=1 => Right-Turn
  // (1) Vr = (-15 + 10) * 1 = 5 + 50 = 55
  // (2) Vl = (-15 - 10) * 1 = -25 + 50 = 

  vlinear = vector[0];    // radius = velocity
  angle = vector[1];      // theta
  vangular = vector[2];   // pitch rate - Drehgeschwindigkeit
  //vlinear = 100
  //angle = 90;
  VwA = vangular + vlinear * Math.cos(angle);
  VwB = vangular + vlinear * (-0.5 * Math.cos(angle) - 0.866 * Math.sin(angle));
  VwC = vangular + vlinear * (-0.5 * Math.cos(angle) + 0.866 * Math.sin(angle));

  logger.debug("calculateSpeeds [" + [VwA, VwB, VwC] + "]");

  return [VwA, VwB, VwC];
}

*/
//------------------------------------------------------
// little helper functions
//------------------------------------------------------

var clamp = function (num, min, max) {
  //return num <= min ? min : num >= max ? max : num;
  return Math.max(min,Math.min(num,max));
};

var mapRange = function(n) {
  n = Math.ceil((n*255) / 122.4744871391589);

};

/**
 * map number x from range in_min/in_max to out_min, out_max
 * 
 * if x < in_min set x = in_min
 * if x > in_max set x = in_max
 */
var map = function (x, in_min, in_max, out_min, out_max) {
  x = Math.min(Math.max(x, in_min), in_max);
  return Math.ceil((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
};

/**
 * 
   * @param {*} max_rpm 
   * @param {*} wheel_diameter  in millimeters
   * @param {*} base_width      in milimeters
 */

 /*
class WheelKinematics {
  constructor(max_rpm, wheel_diameter, base_width, pwm_bits) {
    this.max_rpm = max_rpm;
    // calculated in meters
    this.wheel_diameter = wheel_diameter / 1000;
    this.circumference = Math.PI * (wheel_diameter / 1000);
    this.base_width = base_width / 1000;
    this.pwm_resolution = Math.pow(2,pwm_bits)-1;

    this.motors = {
      m1 : {rpm:0,pwm:0},
      m2 : {rpm:0,pwm:0},
      m3 : {rpm:0,pwm:0},
      m4 : {rpm:0,pwm:0}
    };

    this.velocity = {
      linear_x : 0,
      linear_y : 0,
      angular_z : 0
    };
  }

  getRPM(linear_x, linear_y, angular_z) {
    // convert m/s to m/min
    var linear_vel_x_mins = linear_x * 60;
    var linear_vel_y_mins = linear_y * 60;

    // convert rad/s to rad/min
    var angular_vel_z_mins = angular_z * 60;

    // Vt = w * radius
    var tan_vel = angular_vel_z_mins * this.base_width;

    var x_rpm = linear_vel_x_mins / this.circumference;
    var y_rpm = linear_vel_y_mins / this.circumference;
    var tan_rpm = tan_vel / this.circumference;

    // two wheels (rpm1 = left, rpm2 = right)
    this.motors.m1.rpm = x_rpm - y_rpm - tan_rpm;
    this.motors.m2.rpm = x_rpm + y_rpm + tan_rpm;

    // four wheels (rpm3 - left-rear, rpm4=right-rear)
    //this.motors.m3.rpm = x_rpm + y_rpm - tan_rpm;
    //this.motors.m4.rpm = x_rpm - y_rpm + tan_rpm;

    return this.motors;
  };

  getPWM(linear_x, linear_y, angular_z) {
    var rpm = this.getRPM(linear_x, linear_y, angular_z);

    // convert from RPM to PWM
    this.motors.m1.pwm = this._convertRPMToPWM(rpm.motor1);
    this.motors.m2.pwm = this._convertRPMToPWM(rpm.motor2);
    //this.motors.m3.pwm = this._convertRPMToPWM(rpm.motor3);
    //this.motors.m4.pwm = this._convertRPMToPWM(rpm.motor4);
    
    return this.motors;
  };

  getVelocities(rpm_motor1, rpm_motor2) {
    // Left
    avg_rpm_x = (rpm_motor1 + rpm_motor2) / 2;
    // LEFT convert revolutions/min in rev/sec
    avg_rps_x = avg_rpm_x / 60;
    this.velocity.linear_x = (avg_rps_x * (this.wheel_diameter * Math.PI));

    // right
    avg_rpm_y = (-rpm_motor1 + rpm_motor2) / 2;
    // RIGHT convert revolutions/min in rev/sec
    avg_rps_y = avg_rpm_y / 60;
    this.velocity.linear_y = (avg_rps_y * (this.wheel_diameter * Math.PI));  
  
    // angular in rad/s
    
    avg_rpm_a = (-motor1 - rpm_motor2) / 2;
    avg_rps_a = avg_rpm_a / 60;
    this.velocity.angular_z = (avg_rps_a * (this.wheel_diameter * Math.PI)) / this.base_width;

    return this.velocity;
  };

  _convertRPMToPWM(rpm) {
    return (rpm / this.max_rpm) / this.pwm_resolution;
  }

};

*/

