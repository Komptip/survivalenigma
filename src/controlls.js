import * as THREE from 'three';

class Controlls {
	constructor(canvas, camera){
		this.canvas = canvas;
		this.currentState = {
			mouse: {
				position: {
					x: 0,
					y: 0
				},
				documentposition: {
					x: 0,
					y: 0
				},
				delta: {
					x: 0,
					y: 0
				},
				buttons: {
					left: false,
					right: false
				}
			}
		};
		this.lastPhi = 0;
		this.headLocalDirection = new THREE.Quaternion();
		this.bodyTarget = null;
		this.keys = {};

		this.camera = new FirstPersonCamera(camera);

		document.addEventListener('mousedown', this.onMouseDown.bind(this), false);
		document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
		document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
		document.addEventListener('keydown', this.onKeyDown.bind(this), false);
		document.addEventListener('keyup', this.onKeyUp.bind(this), false);
	}

	onMouseDown(event){
		switch(event.button){
			case 0: {
				this.currentState.mouse.buttons.left = true;
				break;
			}
			case 1: {
				this.currentState.mouse.buttons.right = true;
				break;
			}
		}
	}

	onMouseUp(event){
		switch(event.button){
			case 0: {
				this.currentState.mouse.buttons.left = false;
				break;
			}
			case 1: {
				this.currentState.mouse.buttons.right = false;
				break;
			}
		}
	}

	onMouseMove(event){

		if(this.currentState.mouse.documentposition.x === event.pageX - window.innerWidth / 2 &&
		   this.currentState.mouse.documentposition.y === event.pageY - window.innerHeight / 2){
			this.currentState.mouse.position.x = Math.max(-window.innerWidth / 2, Math.min(this.currentState.mouse.position.x + event.movementX, window.innerWidth / 2));
			this.currentState.mouse.position.y = Math.max(-window.innerHeight / 2, Math.min(this.currentState.mouse.position.y + event.movementY, window.innerHeight / 2));
		} else {
			this.currentState.mouse.position.x = event.pageX - window.innerWidth / 2;
			this.currentState.mouse.position.y = event.pageY - window.innerHeight / 2;
			this.currentState.mouse.documentposition.x = event.pageX - window.innerWidth / 2;
			this.currentState.mouse.documentposition.y = event.pageY - window.innerHeight / 2;
		}

		this.currentState.mouse.delta.x = event.movementX;
		this.currentState.mouse.delta.y = event.movementY;
	}

	onKeyDown(event){
		this.keys[event.keyCode] = true;

		if(event.keyCode == 87){
			this.character.state = 'walk';
		}

		if(event.keyCode == 16){
			if(this.character.state == 'walk'){
				this.character.state = 'run';
			}
		}
	}

	onKeyUp(event){
		this.keys[event.keyCode] = false;

		if(event.keyCode == 87){
			
			this.character.state = 'idle';
		}

		if(event.keyCode == 16){
			if(this.character.state == 'run'){
				this.character.state = 'walk';
			}
		}
	}

	update(delta){
		this.camera.updateRotation(delta);

		let xh = this.currentState.mouse.delta.x / window.innerWidth;
		let yh = -(this.currentState.mouse.delta.y / window.innerHeight);

		this.camera.phi = (this.camera.phi + -xh * 10);
		this.camera.theta = (Math.max(-Math.PI / 4, Math.min(this.camera.theta + -yh * 10, Math.PI / 4)));


		let qx = new THREE.Quaternion();
		qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.phi);
		let qz = new THREE.Quaternion();
		qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.camera.theta);
	
		this.character.direction.head.copy(qx);
		this.character.direction.head.multiply(qz);



		if(this.character){
			
			//this.camera.camera.quaternion.copy(this.character.direction.head);
	 		//this.character.mesh.quaternion.copy(this.character.direction.body);
		}

		this.currentState.mouse.delta.x = 0;
		this.currentState.mouse.delta.y = 0;

	}
}

class FirstPersonCamera {
	constructor(camera){
		this.camera = camera;
		this.rotation = new THREE.Quaternion();
		this.translation = new THREE.Vector3();
		this.phi = 0;
		this.theta = 0;
	}

	updateRotation(delta){
		
	}
}

export {
	FirstPersonCamera,
	Controlls
};