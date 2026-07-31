let rosbridgeModule = await import(`${base_url}/js/modules/rosbridge.js`);
let persistentModule = await import(`${base_url}/js/modules/persistent.js`);
let joystickModule = await import(`${base_url}/js/modules/joystick.js`);
let StatusModule = await import(`${base_url}/js/modules/status.js`);

let rosbridge = rosbridgeModule.rosbridge;
let settings = persistentModule.settings;
let nipplejs = joystickModule.nipplejs;
let Status = StatusModule.Status;

let topic = getTopic("{uniqueID}");

let status = new Status(
	document.getElementById("{uniqueID}_icon"),
	document.getElementById("{uniqueID}_status")
);

let joy_offset_x = "50%";
let joy_offset_y = "85%";
let cmdVelPublisher = undefined;
let jointStatePublisher = undefined;
let ptJointStatePublisher = undefined;
let ptSteadyStatePublisher = undefined;

const selectionbox = document.getElementById("{uniqueID}_topic");
const icon = document.getElementById("{uniqueID}_icon").getElementsByTagName('img')[0];

// Sliders and checkboxes

const linearVelSlider = document.getElementById('{uniqueID}_linear_velocity');
const angularVelSlider = document.getElementById('{uniqueID}_angular_velocity');
const accelSlider = document.getElementById('{uniqueID}_accel');

const linearVelValue = document.getElementById('{uniqueID}_linear_velocity_value');
const angularVelValue = document.getElementById('{uniqueID}_angular_velocity_value');
const accelValue = document.getElementById('{uniqueID}_accel_value');

const invertAngularCheckbox = document.getElementById('{uniqueID}_invert_angular');
const holonomicSwapCheckbox = document.getElementById('{uniqueID}_holonomic');

const moduleTypeSelect = document.getElementById('{uniqueID}_module_type');
let module_type = document.getElementById('{uniqueID}_module_type').value;

const steadyModeSelect = document.getElementById('{uniqueID}_steady_mode');
let steady_mode = document.getElementById('{uniqueID}_steady_mode').value;

linearVelSlider.addEventListener('input', function () {
	linearVelValue.textContent = this.value;
	saveSettings();
});

angularVelSlider.addEventListener('input', function () {
	angularVelValue.textContent = this.value;
	saveSettings();
});

accelSlider.addEventListener('input', function () {
	accelValue.textContent = this.value;
	saveSettings();
});

accelSlider.addEventListener('input', function () {
	accelValue.textContent = this.value;
	saveSettings();
});

moduleTypeSelect.addEventListener('change', () => {
    module_type = moduleTypeSelect.value;
	saveSettings();
});

steadyModeSelect.addEventListener('click', () => {
    steady_mode = steadyModeSelect.value;
	saveSettings();
    const mode = (steady_mode === 'true') ? 1 : 0;
    console.log(mode)

    steadyCtrl(mode);
});

linearVelSlider.addEventListener('change', saveSettings);
angularVelSlider.addEventListener('change', saveSettings);
accelSlider.addEventListener('change', saveSettings);

invertAngularCheckbox.addEventListener('change', saveSettings);
holonomicSwapCheckbox.addEventListener('change', saveSettings);

// Settings

if (settings.hasOwnProperty('{uniqueID}')) {
	const loaded_data = settings['{uniqueID}'];
	topic = loaded_data.topic;

	// BEAST-01 command spine migration. Settings live in the BROWSER's local
	// storage, so any operator who used this widget before the spine landed
	// still has "/cmd_vel" saved and would go straight back to publishing on
	// twist_mux's own output topic — fighting the mux instead of feeding it.
	// Rewrite it onto the UI rung (twist_mux priority 50).
	// See src/ugv_main/ugv_cockpit/config/twist_mux.yaml.
	// The actual saveSettings() is deferred to the end of this block: calling
	// it here would persist the *defaults* of every field not yet read out of
	// loaded_data below, silently wiping the operator's saved widget config.
	const migrated_off_cmd_vel = (topic == "/cmd_vel" || topic == "cmd_vel");
	if(migrated_off_cmd_vel){
		topic = "/cmd_vel_ui";
	}

	module_type = loaded_data.module_type;
    steady_mode = loaded_data.steady_mode;

	joy_offset_x = loaded_data.joy_offset_x;
	joy_offset_y = loaded_data.joy_offset_y;

	linearVelSlider.value = loaded_data.linear_velocity;
	angularVelSlider.value = loaded_data.angular_velocity;
	accelSlider.value = loaded_data.accel;

	invertAngularCheckbox.checked = loaded_data.invert_angular;
	holonomicSwapCheckbox.checked = loaded_data.holonomic_swap;

	linearVelValue.textContent = linearVelSlider.value;
	angularVelValue.textContent = angularVelSlider.value;
	accelValue.textContent = accelSlider.value;

	// Persist the /cmd_vel -> /cmd_vel_ui rewrite decided above, now that every
	// other field has been restored from loaded_data and saveSettings() will
	// round-trip them unchanged.
	if(migrated_off_cmd_vel){
		status.setWarn("Stored topic /cmd_vel migrated to /cmd_vel_ui (twist_mux UI rung)");
		saveSettings();
	}
}else{
	saveSettings();
}

if(topic == ""){
	// BEAST-01 command spine: /cmd_vel belongs to twist_mux alone. A browser
	// teleop widget is a UI surface, so it defaults onto the UI rung
	// (twist_mux priority 50) exactly like the Foxglove Teleop panel does.
	// See src/ugv_main/ugv_cockpit/config/twist_mux.yaml.
	topic = "/cmd_vel_ui";
	status.setWarn("No topic found, defaulting to /cmd_vel_ui (twist_mux UI rung)");
	saveSettings();
}

function saveSettings() {
	settings['{uniqueID}'] = {
		topic: topic,
		module_type: module_type,
		steady_mode: steady_mode,
		linear_velocity: parseFloat(linearVelSlider.value),
		angular_velocity: parseFloat(angularVelSlider.value),
		joy_offset_x: joy_offset_x,
		joy_offset_y: joy_offset_y,
		accel: parseFloat(accelSlider.value),
		invert_angular: invertAngularCheckbox.checked,
		holonomic_swap: holonomicSwapCheckbox.checked,
	};
	settings.save();
}

// Topic and connections

// BEAST-01 command spine: /cmd_vel is twist_mux's OUTPUT, not an input. It shows
// up in get_topics() like any other Twist topic, so without this filter the
// operator can simply re-select it from the dropdown and undo the migration
// above — publishing into the mux's own output and fighting it for the ESP32.
// Keeping it out of the options list makes the UI rung (/cmd_vel_ui,
// twist_mux priority 50) the only thing this widget can drive.
// See src/ugv_main/ugv_cockpit/config/twist_mux.yaml.
const SPINE_BLOCKED_TOPICS = ["/cmd_vel", "cmd_vel"];

async function loadTopics(){
	let result = await rosbridge.get_topics("geometry_msgs/msg/Twist");
	result = result.filter(element => !SPINE_BLOCKED_TOPICS.includes(element));
	let topiclist = "";
	result.forEach(element => {
		topiclist += "<option value='"+element+"'>"+element+"</option>"
	});
	selectionbox.innerHTML = topiclist;

	if(topic == "")
		topic = selectionbox.value;
	else{
		if(result.includes(topic)){
			selectionbox.value = topic;
		}else{
			topiclist += "<option value='"+topic+"'>"+topic+"</option>"
			selectionbox.innerHTML = topiclist
			selectionbox.value = topic;
		}
	}
	connect();
}

function connect(){
	cmdVelPublisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: topic,
		messageType: 'geometry_msgs/msg/Twist',
		queue_size: 1
	});
	jointStatePublisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: "/web/joint_states",
		messageType: 'sensor_msgs/msg/JointState',
		queue_size: 1
	});	
    ptJointStatePublisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: "/pt_joint_position_controller/commands",
		messageType: 'std_msgs/msg/Float64MultiArray',
		queue_size: 1
	});	
    ptSteadyStatePublisher = new ROSLIB.Topic({
		ros: rosbridge.ros,
		name: "/ugv/pt_steady_ctrl",
		messageType: 'std_msgs/msg/Float32MultiArray',
		queue_size: 1
	});	    
}

function publishTwist(linearX, linearY, angularZ) {
	const twist = new ROSLIB.Message({
		linear: { x: linearX, y: linearY, z: 0 },
		angular: { x: 0, y: 0, z: angularZ },
	});
	cmdVelPublisher.publish(twist);
}

function publishJointState(jointstates) {
	const jointstate = new ROSLIB.Message({
		header: {
			stamp: {},       
			frame_id: ''     
		},
		name: jointstates.name,         
		position: jointstates.position, 
		velocity: [],                   
		effort: []   
	});
	jointStatePublisher.publish(jointstate);
}

function publishPtJointState(positions) {
	const msg = new ROSLIB.Message({
		data: positions  
	});
	ptJointStatePublisher.publish(msg);
}

function publishPtSteadyState(datas) {
	const msg = new ROSLIB.Message({
		data: datas  
	});
	ptSteadyStatePublisher.publish(msg);
}

selectionbox.addEventListener("change", (event) => {
	topic = selectionbox.value;
	saveSettings();
	connect();
	status.setOK();
});

selectionbox.addEventListener("click", (event) => {
	connect();
});

icon.addEventListener("click", (event) => {
	loadTopics();
});

loadTopics();

// Joystick
linearVelSlider.addEventListener('input', function () {
	linearVelValue.textContent = this.value;
});

angularVelSlider.addEventListener('input', function () {
	angularVelValue.textContent = this.value;
});

// Teleop logic
let linearVel = 0;
let angularVel = 0;

let targetLinearVel = 0;
let targetAngularVel = 0;

let interval = undefined;

const joystickContainer  = document.getElementById('{uniqueID}_joystick');
const joypreview = document.getElementById('{uniqueID}_joypreview');
joypreview.style.left = `calc(${joy_offset_x} - 50px)`;
joypreview.style.top = `calc(${joy_offset_y} - 50px)`;

function makeJoystick(){
	return nipplejs.create({
		zone: joystickContainer,
		mode: 'static',
		position: {
			left: joy_offset_x,
			top: joy_offset_y 
		},
		size: 150,
		threshold: 0.1,
		color: 'black',
		restOpacity: 0.7
	})
}

let joystick = makeJoystick();

function addJoystickListeners(){
	joystick.on('move', onJoystickMove);
	joystick.on('touchmove', onJoystickMove);
	joystick.on('end', onJoystickEnd);
	joystick.on('touchend', onJoystickEnd);
}

function onJoystickMove(event, data) {
	const maxLinearVel = parseFloat(linearVelSlider.value);
	const maxAngularVel = parseFloat(angularVelSlider.value);
	const force = Math.min(Math.max(data.force, 0.0), 1.0);

	targetLinearVel = maxLinearVel * Math.sin(data.angle.radian) * force;
	targetAngularVel = - maxAngularVel * Math.cos(data.angle.radian) * force;

	if (settings['{uniqueID}'].invert_angular && targetLinearVel < 0 && !settings['{uniqueID}'].holonomic_swap) {
		targetAngularVel = -targetAngularVel;
	}

	if(interval === undefined){
		interval = setInterval(() => {
			let accel = settings['{uniqueID}'].accel;

			if (targetLinearVel == 0 && targetAngularVel == 0)
				accel *= 2;
		
			if(linearVel != targetLinearVel){
				if(linearVel < targetLinearVel){
					linearVel += accel;
		
					if(linearVel > targetLinearVel)
						linearVel = targetLinearVel;
				}
				else if(linearVel > targetLinearVel){
					linearVel -= accel;
		
					if(linearVel < targetLinearVel)
						linearVel = targetLinearVel;
				}
			}

			let angular_accel = settings['{uniqueID}'].accel * 10;

			if(settings['{uniqueID}'].holonomic_swap)
				angular_accel = accel;


			if(angularVel != targetAngularVel){
				if(angularVel < targetAngularVel){
					angularVel += angular_accel;
		
					if(angularVel > targetAngularVel)
						angularVel = targetAngularVel;
				}
				else if(angularVel > targetAngularVel){
					angularVel -= angular_accel;
		
					if(angularVel < targetAngularVel)
						angularVel = targetAngularVel;
				}
			}
		
			if(Math.abs(linearVel) < 0.005 && Math.abs(angularVel) < 0.005){
				linearVel = 0;
				targetLinearVel = 0;
				targetAngularVel = 0;
				publishTwist(0, 0, 0);
				clearInterval(interval);
				interval = undefined;
				return;
			}
		
			if(settings['{uniqueID}'].holonomic_swap){
				publishTwist(linearVel, angularVel, 0);
			}
			else{
				publishTwist(linearVel, 0, angularVel);
			}
			
		}, 1000 / 20);
	}
};

function onJoystickEnd(event) {
	targetLinearVel = 0;
	targetAngularVel = 0;
}

addJoystickListeners();

//preview for moving around

let preview_active = false;

function onStart(event) {
	preview_active = true;
	document.addEventListener('mousemove', onMove);
	document.addEventListener('mouseup', onEnd);
	document.addEventListener('touchmove', onMove);
	document.addEventListener('touchend', onEnd);
}

function onMove(event) {
	if (preview_active) {
		event.preventDefault();
		let currentX, currentY;

		if (event.type === "touchmove") {
			currentX = event.touches[0].clientX;
			currentY = event.touches[0].clientY;
		} else {
			currentX = event.clientX;
			currentY = event.clientY;
		}

		joy_offset_x = (currentX/window.innerWidth * 100) +"%";
		joy_offset_y = (currentY/window.innerHeight * 100) +"%";
		saveSettings();

		joypreview.style.left = `calc(${joy_offset_x} - 50px)`;
		joypreview.style.top = `calc(${joy_offset_y} - 50px)`;

		joystick.destroy();
		joystick = makeJoystick();
	
		addJoystickListeners(joystick);
	}
}

function onEnd() {
	preview_active = false;
	document.removeEventListener('mousemove', onMove);
	document.removeEventListener('mouseup', onEnd);
	document.removeEventListener('touchmove', onMove);
	document.removeEventListener('touchend', onEnd);
}
  
joypreview.addEventListener('mousedown', onStart);
joypreview.addEventListener('touchstart', onStart);

console.log("Teleop Widget Loaded {uniqueID}")

const roarm_m2 = (() => {
    const ARM_L1_LENGTH_MM = 126.06;
    const ARM_L2_LENGTH_MM_A = 236.82;
    const ARM_L2_LENGTH_MM_B = 30.00;
    const ARM_L3_LENGTH_MM_A_0 = 280.15;
    const ARM_L3_LENGTH_MM_B_0 = 1.73;
    const ARM_L4_LENGTH_MM_A = 67.85;
    const ARM_L4_LENGTH_MM_B = 5.98;

    const l1 = ARM_L1_LENGTH_MM;
    const l2A = ARM_L2_LENGTH_MM_A;
    const l2B = ARM_L2_LENGTH_MM_B;
    const l2 = Math.sqrt(l2A * l2A + l2B * l2B);
    const t2rad = Math.atan2(l2B, l2A);

    const l3A = ARM_L3_LENGTH_MM_A_0;
    const l3B = ARM_L3_LENGTH_MM_B_0;
    const l3 = Math.sqrt(l3A * l3A + l3B * l3B);
    const t3rad = Math.atan2(l3B, l3A);

    const l4A = ARM_L4_LENGTH_MM_A;
    const l4B = ARM_L4_LENGTH_MM_B;

    let EOAT_point_RAD_BUFFER = 0;
    let nanIK = false;
    let EEMode = 0; 

    let EoAT_A = 0;
    let EoAT_B = 0;
    let lEA = EoAT_A + l4A;
    let lEB = EoAT_B + l4B;
    let lE = Math.sqrt(lEA * lEA + lEB * lEB);
    let tErad = Math.atan2(lEB, lEA);

    let lastX = l3A + l2B;
    let lastY = 0;
    let lastZ = l2A - l3B;
    let lastT = Math.PI;

    function polarToCartesian(r, theta) {
        return [r * Math.cos(theta), r * Math.sin(theta)];
    }

    function cartesianToPolar(x, y) {
        return [Math.sqrt(x * x + y * y), Math.atan2(y, x)];
    }

    function simpleLinkageIkRad(aIn, bIn) {
        let LA = l2;
        let LB = l3;
        let psi, alpha, omega, beta, L2C, LC, lambda;

        if (Math.abs(bIn) < 1e-6) {
            psi = Math.acos((LA * LA + aIn * aIn - LB * LB) / (2 * LA * aIn)) + t2rad;
            alpha = Math.PI / 2 - psi;
            omega = Math.acos((aIn * aIn + LB * LB - LA * LA) / (2 * aIn * LB));
            beta = psi + omega - t3rad;
        } else {
            L2C = aIn * aIn + bIn * bIn;
            LC = Math.sqrt(L2C);
            lambda = Math.atan2(bIn, aIn);
            psi = Math.acos((LA * LA + L2C - LB * LB) / (2 * LA * LC)) + t2rad;
            alpha = Math.PI / 2 - lambda - psi;
            omega = Math.acos((LB * LB + L2C - LA * LA) / (2 * LC * LB));
            beta = psi + omega - t3rad;
        }

        let delta = Math.PI / 2 - alpha - beta;
        EOAT_point_RAD_BUFFER = delta;
        nanIK = isNaN(alpha) || isNaN(beta) || isNaN(delta);

        return [alpha, beta];

    }

    function computePosbyJointRad(baseRad, shoulderRad, elbowRad, handRad) {
        let x_ee, y_ee, z_ee, r_ee;

        if (EEMode === 0) {
            let [aOut, bOut] = polarToCartesian(l2, Math.PI / 2 - (shoulderRad + t2rad));
            let [cOut, dOut] = polarToCartesian(l3, Math.PI / 2 - (elbowRad + shoulderRad + t3rad));
            r_ee = aOut + cOut;
            z_ee = bOut + dOut;
            [x_ee, y_ee] = polarToCartesian(r_ee, baseRad);
            lastX = x_ee;
            lastY = y_ee;
            lastZ = z_ee;
        } else if (EEMode === 1) {
            let [aOut, bOut] = polarToCartesian(l2, Math.PI / 2 - (shoulderRad + t2rad));
            let [cOut, dOut] = polarToCartesian(l3, Math.PI / 2 - (elbowRad + shoulderRad + t3rad));
            let [eOut, fOut] = polarToCartesian(lE, -((handRad + tErad) - Math.PI - (Math.PI / 2 - shoulderRad - elbowRad)));
            r_ee = aOut + cOut + eOut;
            z_ee = bOut + dOut + fOut;
            [x_ee, y_ee] = polarToCartesian(r_ee, baseRad);
            lastX = x_ee;
            lastY = y_ee;
            lastZ = z_ee;
            lastT = handRad - (Math.PI - shoulderRad - elbowRad) + Math.PI / 2;
        }

        return [lastX, lastY, lastZ, EEMode, lastT];
    }

    function computeJointRadbyPos(x, y, z, t) {
        const [r, theta] = cartesianToPolar(x, y);
        const [shoulder, elbow] = simpleLinkageIkRad(r, z);
        return [theta, shoulder, elbow];
    }

    return {
        polarToCartesian,
        cartesianToPolar,
        simpleLinkageIkRad,
        computePosbyJointRad,
        computeJointRadbyPos,
        setEEMode: mode => EEMode = mode,
        getNanIK: () => nanIK,
    };
})();

const roarm_m3 = (() => {
  const ARM_L1_LENGTH_MM = 126.06;
  const ARM_L2_LENGTH_MM_A = 236.82;
  const ARM_L2_LENGTH_MM_B = 30.0;
  const ARM_L3_LENGTH_MM_A_0 = 144.49;
  const ARM_L3_LENGTH_MM_B_0 = 0;
  const ARM_L3_LENGTH_MM_A_1 = 144.49;
  const ARM_L3_LENGTH_MM_B_1 = 0;
  const ARM_L4_LENGTH_MM_A = 171.67;
  const ARM_L4_LENGTH_MM_B = 13.69;

  const l1 = ARM_L1_LENGTH_MM;
  const l2A = ARM_L2_LENGTH_MM_A;
  const l2B = ARM_L2_LENGTH_MM_B;
  const l2 = Math.sqrt(l2A * l2A + l2B * l2B);
  const t2rad = Math.atan2(l2B, l2A);
  const l3A = ARM_L3_LENGTH_MM_A_0;
  const l3B = ARM_L3_LENGTH_MM_B_0;
  const l3 = Math.sqrt(l3A * l3A + l3B * l3B);
  const t3rad = Math.atan2(l3B, l3A);
  const EoAT_A = 0;
  const EoAT_B = 0;
  const l4A = ARM_L4_LENGTH_MM_A;
  const l4B = ARM_L4_LENGTH_MM_B;
  const lEA = EoAT_A + ARM_L4_LENGTH_MM_A;
  const lEB = EoAT_B + ARM_L4_LENGTH_MM_B;
  const lE = Math.sqrt(lEA * lEA + lEB * lEB);
  const tErad = Math.atan2(lEB, lEA);

  let SHOULDER_JOINT_RAD = 0;
  let ELBOW_JOINT_RAD = Math.PI / 2;
  let EOAT_JOINT_RAD_BUFFER;

  let nanIK = false;
  let nanFK = false;

  let lastX = l2B + l3A + ARM_L4_LENGTH_MM_A;
  let lastY = 0;
  let lastZ = l2A - ARM_L4_LENGTH_MM_B;
  let lastT = 0;
  let lastR = 0;
  let lastG = 3.14;

  let lastValidResult = [0, 0, 0, 0, 0];

  function simpleLinkageIkRad(aIn, bIn) {
    let psi, alpha, omega, beta;
    let L2C, LC, lambda, delta;
    const LA = l2;
    const LB = l3;

    if (Math.abs(bIn) < 1e-6) {
      psi = Math.acos((LA * LA + aIn * aIn - LB * LB) / (2 * LA * aIn)) + t2rad;
      alpha = Math.PI / 2 - psi;
      omega = Math.acos((aIn * aIn + LB * LB - LA * LA) / (2 * aIn * LB));
      beta = psi + omega - t3rad;
    } else {
      L2C = aIn * aIn + bIn * bIn;
      LC = Math.sqrt(L2C);
      lambda = Math.atan2(bIn, aIn);
      psi = Math.acos((LA * LA + L2C - LB * LB) / (2 * LA * LC)) + t2rad;
      alpha = Math.PI / 2 - lambda - psi;
      omega = Math.acos((LB * LB + L2C - LA * LA) / (2 * LC * LB));
      beta = psi + omega - t3rad;
    }

    delta = Math.PI / 2 - alpha - beta;

    SHOULDER_JOINT_RAD = alpha;
    ELBOW_JOINT_RAD = beta;
    EOAT_JOINT_RAD_BUFFER = delta;

    nanIK = Number.isNaN(alpha) || Number.isNaN(beta) || Number.isNaN(delta);
    return [SHOULDER_JOINT_RAD, ELBOW_JOINT_RAD, EOAT_JOINT_RAD_BUFFER];
  }

  function rotatePoint(theta) {
    const alpha = tErad + theta;
    const xB = -lE * Math.cos(alpha);
    const yB = -lE * Math.sin(alpha);
    return [xB, yB];
  }

  function movePoint(xA, yA, s) {
    const distance = Math.sqrt(xA * xA + yA * yA);
    let xB, yB;
    if (distance - s <= 1e-6) {
      xB = 0;
      yB = 0;
    } else {
      const ratio = (distance - s) / distance;
      xB = xA * ratio;
      yB = yA * ratio;
    }
    return [xB, yB];
  }

  function cartesianToPolar(x, y) {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return [r, theta];
  }

  function polarToCartesian(r, theta) {
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    return [x, y];
  }

  function computePosbyJointRad(base_joint_rad, shoulder_joint_rad, elbow_joint_rad, wrist_joint_rad, roll_joint_rad, hand_joint_rad) {
    const [aOut, bOut] = polarToCartesian(l2, Math.PI / 2 - (shoulder_joint_rad + t2rad));
    const [cOut, dOut] = polarToCartesian(l3, Math.PI / 2 - (elbow_joint_rad + shoulder_joint_rad + t3rad));
    const [eOut, fOut] = polarToCartesian(lE, Math.PI / 2 - (elbow_joint_rad + shoulder_joint_rad + wrist_joint_rad + tErad));

    const r_ee = aOut + cOut + eOut;
    const z_ee = bOut + dOut + fOut;

    const [gOut, hOut] = polarToCartesian(r_ee, base_joint_rad);

    lastX = gOut;
    lastY = hOut;
    lastZ = z_ee;
    lastT = elbow_joint_rad + shoulder_joint_rad + wrist_joint_rad - Math.PI / 2;

    return [lastX, lastY, lastZ, roll_joint_rad, lastT];
  }

  function computeJointRadbyPos(x, y, z, roll, pitch, hand_joint_rad) {

    const delta = rotatePoint(pitch - 3.1416);
    const beta = movePoint(x, y, delta[0]);
    const bases = cartesianToPolar(beta[0], beta[1]);
    const radians = simpleLinkageIkRad(bases[0], z + delta[1]);

    const WRIST_JOINT_RAD = radians[2] + pitch;
    const ROLL_JOINT_RAD = roll;

    const result = [bases[1], radians[0], radians[1], WRIST_JOINT_RAD, ROLL_JOINT_RAD, hand_joint_rad];

    if (result.every(v => !Number.isNaN(v))) {
      lastValidResult = result;
      return result;
    } else {
      console.warn("Inverse kinematics returned NaN. Using last valid result.");
      return lastValidResult;
    }
  }

  return {
    simpleLinkageIkRad,
    rotatePoint,
    movePoint,
    cartesianToPolar,
    polarToCartesian,
    computePosbyJointRad,
    computeJointRadbyPos,
    getNanIK: () => nanIK,
  };
})();

let ptPoseState = { x: 0, y: 0 };
let ptlastPoseState = { x: 0, y: 0 };
let armPoseState = { x: 230, y: 0, z: 80, r: 0, p: 0 };
let armlastPoseState = { x: 230, y: 0, z: 80, r: 0, p: 0 };
let armJointState = { base: 0, shoulder: 0.0191, elbow: 2.9569, wrist: -1.4053, roll: 0, hand: 0 };
let armlastJointState = { base: 0, shoulder: 0.0191, elbow: 2.9569, wrist: -1.4053, roll: 0, hand: 0 };
let rosBaseSpeedState = { x: 0, z: 0 };

armJointState = createStateManager(armJointState, armJointCtrl);
armPoseState = createStateManager(armPoseState, armPoseCtrl);
ptPoseState = createStateManager(ptPoseState, ptPoseCtrl);
rosBaseSpeedState = createStateManager(rosBaseSpeedState, rosBaseSpeedCtrl);

function createStateManager(initialState, onChange) {
  const handler = {
    set(target, prop, value) {
      if (target[prop] !== value) {
        target[prop] = value;
        if (onChange && !handler._suspend) {
          onChange({ ...target });
        }
      }
      return true;
    }
  };

  handler._suspend = true; 
  const proxy = new Proxy(initialState, handler);
  proxy._raw = initialState;

  setTimeout(() => handler._suspend = false, 0);

  return proxy;
}

function format(value, digits = 5) {
    return parseFloat(value.toFixed(digits));
}

function lookAhead() {   
    if (module_type === "roarm_m2" || module_type === "roarm_m3") {
        armJointState.base = 0;
        armJointState.shoulder = 0.0191;
        armJointState.elbow = 2.9569;
        armJointState.wrist = -1.4053;
        armJointState.roll = 0;
        armJointState.hand = 0;
    }else if (module_type === "pt" ) {
        ptPoseState.x = 0;
        ptPoseState.y = 0;
    }
}

let updatingJoint = false;

function armJointCtrl() {
    if (updatingJoint) return;

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const limits = {
        base: [-Math.PI, Math.PI],
        shoulder: [-Math.PI / 2, Math.PI / 2],
        elbow: [-Math.PI / 6, Math.PI],
        wrist: [-Math.PI / 2, Math.PI / 2],
        roll: [-Math.PI, Math.PI],
        hand: [0, Math.PI/2]
    };

    const clampedState = {};
    for (let joint in limits) {
        if (armJointState.hasOwnProperty(joint)) {
            const [minVal, maxVal] = limits[joint];
            clampedState[joint] = clamp(armJointState[joint], minVal, maxVal);
        }
    }

    const isInvalid = Object.values(clampedState).some(v => isNaN(v));
    const jointToSend = isInvalid ? armlastJointState : clampedState;

    if (!isInvalid) {
        updatingJoint = true;
        for (let joint in jointToSend) {
            armJointState[joint] = jointToSend[joint];  
        }
        armlastJointState = { ...jointToSend };
        updatingJoint = false;
    } else {
        console.warn("Invalid joint value detected, reverting to last valid joint state.");
        return;
    }

    const poseRaw = armPoseState._raw;
    if (module_type === "roarm_m2" ) {
		publishJointState({
			name: [
			"base_link_to_link1", 
			"link1_to_link2",
			"link2_to_link3",
			"link3_to_gripper_link"
			],
			position: [
			jointToSend.base,
			jointToSend.shoulder,
            jointToSend.elbow,
            jointToSend.hand]
		});
        [poseRaw.x, poseRaw.y, poseRaw.z] = roarm_m2.computePosbyJointRad(
            jointToSend.base,
            jointToSend.shoulder,
            jointToSend.elbow,
            jointToSend.hand
        );
    }else if (module_type === "roarm_m3" ) {
		publishJointState({
			name: [
			"base_link_to_link1", 
			"link1_to_link2",
			"link2_to_link3",
			"link3_to_link4",
			"link4_to_link5",
			"link5_to_gripper_link"
			],
			position: [
			jointToSend.base,
			jointToSend.shoulder,
            jointToSend.elbow,
            jointToSend.wrist,
            jointToSend.roll,
            jointToSend.hand]
		});

        [poseRaw.x, poseRaw.y, poseRaw.z, poseRaw.r, poseRaw.p] = roarm_m3.computePosbyJointRad(
            jointToSend.base,
            jointToSend.shoulder,
            jointToSend.elbow,
            jointToSend.wrist,
            jointToSend.roll,
            jointToSend.hand
        );       
    }
}

let updatingPose = false;

function armPoseCtrl() {
    if (updatingPose) return;
    updatingPose = true;

    if (module_type === "roarm_m2") {
        roarm_m2.setEEMode(0);

        let jointAngles = roarm_m2.computeJointRadbyPos(
            armPoseState.x,
            armPoseState.y,
            armPoseState.z,
            armJointState.hand
        );

        if (!roarm_m2.getNanIK()) {
            armJointState.base = format(jointAngles[0]);
            armJointState.shoulder = format(jointAngles[1]);
            armJointState.elbow = format(jointAngles[2]);
            armJointState.hand = format(armJointState.hand);

            armlastJointState = {
                base: jointAngles[0],
                shoulder: jointAngles[1],
                elbow: jointAngles[2],
                hand: jointAngles[5] !== undefined ? jointAngles[5] : armJointState.hand,
            };

            armlastPoseState = { ...armPoseState };
        } else {
            console.warn("Invalid IK solution. Reverting to last joint state.");
            armJointState.base = format(armlastJointState.base);
            armJointState.shoulder = format(armlastJointState.shoulder);
            armJointState.elbow = format(armlastJointState.elbow);
            armJointState.hand = format(armJointState.hand);
        }
    } else if (module_type === "roarm_m3") {
        let jointAngles = roarm_m3.computeJointRadbyPos(
            armPoseState.x,
            armPoseState.y,
            armPoseState.z,
            armPoseState.r,
            armPoseState.p,
            armJointState.hand
        );
        if (!roarm_m3.getNanIK()) {
            armJointState.base = format(jointAngles[0]);
            armJointState.shoulder = format(jointAngles[1]);
            armJointState.elbow = format(jointAngles[2]);
            armJointState.wrist = format(jointAngles[3]);
            armJointState.roll = format(jointAngles[4]);
            armJointState.hand = format(armJointState.hand);

            armlastJointState = {
                base: jointAngles[0],
                shoulder: jointAngles[1],
                elbow: jointAngles[2],
                wrist: jointAngles[3],
                roll: jointAngles[4],
                hand: jointAngles[5] !== undefined ? jointAngles[5] : armJointState.hand,
            };

            armlastPoseState = { ...armPoseState };
        } else {
            console.warn("Invalid IK solution. Reverting to last joint state.");
            armJointState.base = format(armlastJointState.base);
            armJointState.shoulder = format(armlastJointState.shoulder);
            armJointState.elbow = format(armlastJointState.elbow);
            armJointState.wrist = format(armlastJointState.wrist);
            armJointState.roll = format(armlastJointState.roll);            
            armJointState.hand = format(armJointState.hand);
        }
    }

    updatingPose = false;
}

function degToRadian(deg) {
    return deg * Math.PI / 180;
}

let updatingPt = false;

function ptPoseCtrl() {
    if (updatingPt) return;

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const limits = {
        x: [-180, 180],
        y: [-30, 90],
    };

    const clampedState = {};
    for (let axis in limits) {
        if (Object.prototype.hasOwnProperty.call(ptPoseState, axis)) {
            const [minVal, maxVal] = limits[axis];
            clampedState[axis] = clamp(ptPoseState[axis], minVal, maxVal);
        }
    }

    const isInvalid = Object.values(clampedState).some(v => isNaN(v));
    if (isInvalid) {
        console.warn("Invalid pose value detected, reverting to last valid pose state.");
        return;
    }

    updatingPt = true;

    for (let axis in clampedState) {
        ptPoseState[axis] = clampedState[axis];
    }
    ptlastPoseState = { ...clampedState };	

    if (steady_mode) {
        publishPtSteadyState([0,ptPoseState.y]);
    } else {
        console.log(clampedState)
		publishPtJointState([
			degToRadian(clampedState.x),
			degToRadian(clampedState.y)
		]);		
    }
    updatingPt = false;
}

function steadyCtrl(inputCmd) {
    if (inputCmd === 0) {
        steady_mode = false;
        publishPtSteadyState([0.0,ptPoseState.y]);
    } else if (inputCmd === 1) {
        steady_mode = true;
        publishPtSteadyState([1.0,ptPoseState.y]);
    }
}

let updatingRosSpeed = false;
let speed_rate = 0.3;

function speedRateCtrl(inputRate) {
    speed_rate = inputRate;
}

function rosBaseSpeedCtrl() {
    if (updatingRosSpeed) return;

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const limits = {
        x: [-1.5, 1.5],
        z: [-3.1416, 3.1416],
    };

    const clampedState = {};
    for (let axis in limits) {
        if (Object.prototype.hasOwnProperty.call(rosBaseSpeedState, axis)) {
            const [minVal, maxVal] = limits[axis];
            clampedState[axis] = clamp(rosBaseSpeedState[axis], minVal, maxVal);
        }
    }

    const isInvalid = Object.values(clampedState).some(v => isNaN(v));
    if (isInvalid) {
        console.warn("Invalid speed value detected, skipping command.");
        return;
    }

    updatingRosSpeed = true;

    for (let axis in clampedState) {
        rosBaseSpeedState[axis] = clampedState[axis];
    }

    const now = new Date();
    console.log(`[${now.toISOString()}] publishTwist: x=${clampedState.x}, z=${clampedState.z}`);
    
	publishTwist(clampedState.x,0,clampedState.z);
    updatingRosSpeed = false;
}

// keyboard ctrl 
const keyMap = {
    37: 'left',      // ←
    38: 'up',        // ↑
    39: 'right',     // →
    40: 'down',      // ↓
    83: 's',         // swith 
    48: 'ahead_on',  //0
    49: 'base',      //1
    50: 'shoulder',  //2
    51: 'elbow',     //3
    52: 'wrist',     //4
    53: 'roll',      //5
    82: 'r',
    80: 'p',
    71: 'g',
    88: 'x',
    89: 'y',
    90: 'z',
};

const keyState = {};
for (const code in keyMap) {
    keyState[keyMap[code]] = 0;
}

let directionReversed = false;
const repeatInterval = 100;
const keyTimers = {};

function keyboardCtrl() {
    const direction = directionReversed ? -1 : 1;

    const left = keyState.left;
    const right = keyState.right;
    const up = keyState.up;
    const down = keyState.down;

    if (up && !down) {
        rosBaseSpeedState.x = speed_rate * max_speed;
    } else if (!up && down) {
        rosBaseSpeedState.x = -speed_rate * max_speed;
    } else {
        rosBaseSpeedState.x = 0;
    }

    if (left && !right) {
        rosBaseSpeedState.z = speed_rate * max_turn_speed;
    } else if (!left && right) {
        rosBaseSpeedState.z = -speed_rate * max_turn_speed;
    } else {
        rosBaseSpeedState.z = 0;
    }

    if (keyState.s) directionReversed = !directionReversed;

    const moveXYZ = keyState.x || keyState.y || keyState.z || keyState.r || keyState.p;
    if (moveXYZ) {
        if (module_type === "pt") {
            if (keyState.x) ptPoseState.x += 5 * direction;
            if (keyState.y) ptPoseState.y += 5 * direction;
        } else if (module_type === "roarm_m2" || module_type === "roarm_m3") {
            if (keyState.x) armPoseState.x += 5 * direction;
            if (keyState.y) armPoseState.y += 5 * direction;
            if (keyState.z) armPoseState.z += 5 * direction;
            if (keyState.r) armPoseState.r += -0.02 * direction;
            if (keyState.p) armPoseState.p += 0.02 * direction;
        }
    }

    const moveJoint = keyState.base || keyState.shoulder || keyState.elbow || keyState.wrist || keyState.roll;
    if (moveJoint) {
        if (keyState.base)     armJointState.base     += 0.03 * direction;
        if (keyState.shoulder) armJointState.shoulder += 0.03 * direction;
        if (keyState.elbow)    armJointState.elbow    += 0.03 * direction;
        if (keyState.wrist)    armJointState.wrist    += 0.03 * direction;
        if (keyState.roll)     armJointState.roll     += -0.03 * direction;
    }

    if (keyState.g) {
        armJointState.hand -= 0.01 * direction;
        document.getElementById('slider').value = 3.1416 - armJointState.hand;
    }

    if (keyState.ahead_on) lookAhead();
}

document.onkeydown = function (event) {

    const key = keyMap[event.keyCode];
    if (!key) return;

    if (['left', 'right', 'up', 'down'].includes(key)) {
        event.preventDefault();
    }

    if (keyState[key] === 0) {
        keyState[key] = 1;
        keyboardCtrl();

        const repeatableKeys = ['x', 'y', 'z', 'r', 'p', 'g', 'base', 'shoulder', 'elbow', 'wrist', 'roll', 'up', 'down', 'left', 'right'];
        if (repeatableKeys.includes(key) && !keyTimers[key]) {
            keyTimers[key] = setInterval(() => {
                keyboardCtrl();
            }, repeatInterval);
        }
    }
};

document.onkeyup = function (event) {
    const key = keyMap[event.keyCode];
    if (!key) return;

    if (keyState[key] === 1) {
        keyState[key] = 0;
        keyboardCtrl();
    }

    if (keyTimers[key]) {
        clearInterval(keyTimers[key]);
        delete keyTimers[key];
    }
};

// 全局变量
let gp_x = 0.0;  
let gp_z = 0.0;  
let last_gp_x = 0.0;
let last_gp_z = 0.0;

var last_gp_lt1 = false;
var last_gp_lt2 = false;
var last_gp_rt1 = false;
var last_gp_rt2 = false;

let last_btn4 = false;
let last_btn6 = false;

const speed_levels = [1/4, 2/4, 3/4, 1]; 
let speed_index = 0;
let lastSwitchTime = 0;
const switchCooldown = 300; 

const max_speed = parseFloat(linearVelSlider.value);
const max_turn_speed = parseFloat(angularVelSlider.value);

// 游戏手柄连接事件
window.addEventListener("gamepadconnected", function (e) {
    console.log("Gamepad connected: " + e.gamepad.index);

});

// 游戏手柄断开事件
window.addEventListener("gamepaddisconnected", function (e) {
    console.log("Gamepad disconnected: " + e.gamepad.index);
});

function gamepadCtrl() {
    const threshold = 0.001; 
	const pose_sensitivity = 1;
    const joint_sensitivity = 0.01;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp){
            speed_rate = speed_levels[speed_index];
            const now = Date.now();

            // LB 减档，RB 加档切换速度档位
            if (gp.buttons[4].pressed && !last_btn4 && (now - lastSwitchTime > switchCooldown)) {
                speed_index = Math.max(0, speed_index - 1);
                speed_rate = speed_levels[speed_index];
                speedRateCtrl(speed_rate);
                lastSwitchTime = now;
            }
            if (gp.buttons[6].pressed && !last_btn6 && (now - lastSwitchTime > switchCooldown)) {
                speed_index = Math.min(speed_levels.length - 1, speed_index + 1);
                speed_rate = speed_levels[speed_index];
                speedRateCtrl(speed_rate);
                lastSwitchTime = now;
            }

            last_btn4 = gp.buttons[4].pressed;
            last_btn6 = gp.buttons[6].pressed;

            // 方向键控制线速度和角速度（上下左右方向键）
            gp_x = 0;
            if (gp.buttons[12].pressed) gp_x = max_speed * speed_rate;    // 上
            if (gp.buttons[13].pressed) gp_x = -max_speed * speed_rate;   // 下

            gp_z = 0;
            if (gp.buttons[14].pressed) gp_z = max_turn_speed * speed_rate;   // 左
            if (gp.buttons[15].pressed) gp_z = -max_turn_speed * speed_rate;  // 右

            // 防抖
            if (Math.abs(gp_x) < threshold) gp_x = 0;
            if (Math.abs(gp_z) < threshold) gp_z = 0;

            // 速度变化才发布
            // if (gp_x !== last_gp_x || gp_z !== last_gp_z) {
            rosBaseSpeedState.x = gp_x;
            rosBaseSpeedState.z = gp_z;
            last_gp_x = gp_x;
            last_gp_z = gp_z;
            // }

            if (gp.buttons[11].pressed) {
                lookAhead();
            }
            
            if (module_type === "pt") {
                const gp_pt_speed = 1;

                if (gp.buttons[0].pressed) ptPoseState.y -= gp_pt_speed;
                if (gp.buttons[1].pressed) ptPoseState.x -= gp_pt_speed;
                if (gp.buttons[2].pressed) ptPoseState.x += gp_pt_speed;
                if (gp.buttons[3].pressed) ptPoseState.y += gp_pt_speed;

                var change_x = gp.axes[2];
                var change_y = gp.axes[3];

                if (Math.abs(change_x) > threshold || Math.abs(change_y) > threshold) {
                    ptPoseState.x = ptPoseState.x - change_x * gp_pt_speed;
                    ptPoseState.y = ptPoseState.y - change_y * gp_pt_speed;  
                }
            } else if (module_type === "roarm_m2" || module_type === "roarm_m3") {
                if (gp.buttons[5].pressed) {
                    const deltaX = -gp.axes[1];
                    const deltaY = -gp.axes[0];                    
                    const deltaRoll = gp.axes[2]*0.5;
                    const deltaPitch = -gp.axes[3]*0.5;
                    let deltaZ = 0;
                    if (gp.buttons[10].pressed && gp.buttons[7].pressed) {
                        deltaZ = -1;
                    } else if (gp.buttons[10].pressed) {
                        deltaZ = 1;
                    } else {
                        deltaZ = 0;
                    }

                    armPoseState.z += deltaZ;

                    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold || Math.abs(deltaRoll) > threshold || Math.abs(deltaPitch) > threshold) {
                        armPoseState.x += deltaX * pose_sensitivity;
                        armPoseState.y += deltaY * pose_sensitivity;
                        armPoseState.r += deltaRoll * joint_sensitivity;
                        armPoseState.p += deltaPitch * joint_sensitivity;
                    }
                } else {
                    const deltaBase = -gp.axes[0];
                    const deltaShoulder = -gp.axes[1];
                    const deltaRoll = gp.axes[2];
                    const deltaWrist = -gp.axes[3];
                    let deltaElbow = 0;
                    if (gp.buttons[10].pressed && gp.buttons[7].pressed) {
                        deltaElbow = -0.005;
                    } else if (gp.buttons[10].pressed) {
                        deltaElbow = 0.005;
                    } else {
                        deltaElbow = 0;
                    }
                    armJointState.elbow += deltaElbow;

                    if (Math.abs(deltaBase) > threshold || Math.abs(deltaShoulder) > threshold || Math.abs(deltaElbow) > threshold || Math.abs(deltaRoll) > threshold || Math.abs(deltaWrist) > threshold) {
                        armJointState.base += deltaBase * joint_sensitivity;
                        armJointState.shoulder += deltaShoulder * joint_sensitivity;
                        armJointState.roll += deltaRoll * joint_sensitivity;
                        armJointState.wrist += deltaWrist * joint_sensitivity;
                    }
                }
                let deltaHand = 0;
                if (gp.buttons[0].pressed) {
                    deltaHand = 0.005;
                } else if (gp.buttons[1].pressed) {
                    deltaHand = -0.005;
                } else {
                    deltaHand = 0;
                }
                armJointState.hand += deltaHand;
		    }    
        }
    }

    // 持续调用，实现帧轮询
    window.requestAnimationFrame(gamepadCtrl);
}

// 启动
window.requestAnimationFrame(gamepadCtrl);