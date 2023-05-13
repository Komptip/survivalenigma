import * as THREE from 'three';

export default class Character {
	constructor(app, model){
		this.app = app;

		this.animations = {};
		this.actions = {};

		this.states = {};
		this._state = false;

		this.direction = {
			body: new THREE.Quaternion(),
			bodyTarget: new THREE.Quaternion(),
			head: new THREE.Quaternion()
		};

		this.mesh = new Promise(resolve => {
			this.app.fbxLoader.load(model, resolve);
		}).then(function(object){
			
			this.mesh = object;
			this.mesh.scale.set(0.02, 0.02, 0.02);
			this.mesh.position.y = 1;
			this.mesh.traverse(c => {
			  c.castShadow = true;
			  if(c.material){
				  c.material.wireframe = true;
			  	
			  }
			});

			this.app.scene.add(this.mesh);
			this.mixer = new THREE.AnimationMixer(this.mesh);
			app.mixersNeedsUpdate.push(this.mixer);

			this.initPhysics();
		}.bind(this));

		this.addState('idle', new IdleState(this));
		this.addState('walk', new WalkState(this));
		this.addState('run', new RunState(this));
	}

	processBone(bone){
		let geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 ); 
	    let material = new THREE.MeshBasicMaterial( {color: 0xff0000, wireframe: true} ); 
	    let cube = new THREE.Mesh( geometry, material );
	    cube.position.copy(bone.getWorldPosition(new THREE.Vector3()));
	    this.app.scene.add( cube );
	    bone.children.forEach(function(subBone){
	    	this.processBone(subBone);
	    }.bind(this));
	}

	initPhysics(){
		const helper = new THREE.SkeletonHelper( this.mesh );
		this.app.scene.add(helper);

		this.processBone(this.mesh.children[1]);


		const boxShape = new Ammo.btSphereShape(1.0);

		// Set up the box's motion state
		const transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z)); // Replace x, y, and z with the desired position of the box
		const motionState = new Ammo.btDefaultMotionState(transform);

		const mass = 1; // Replace with desired mass
		const localInertia = new Ammo.btVector3(0, 0, 0);
		boxShape.calculateLocalInertia(mass, localInertia);
		const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, boxShape, localInertia);
		const rigidBody = new Ammo.btRigidBody(rbInfo);
		rigidBody.setAngularFactor( 0, 1, 0 );


		// // Add the rigid body to the physics world
		// this.app.physicsWorld.addRigidBody(rigidBody);

		// this.mesh.userData.physicsBody = rigidBody;
		// this.app.rigidBodies.push(this.mesh);
	}

	set state(name){
		let old = this._state;

		if(old){
			if(name == old.name) {
				return; 
			};

			old.Exit();
		}

		this._state = this.states[name];
		this._state.Enter(old);
	}

	get state(){
		return this._state.name;
	}

	addState(name, object){
		this.states[name] = object;
	}

	Update(delta){
		if(this._state){
			this._state.Update(delta);
		}
	}

	async waitForLoad(animationName, actionName, params, resolve){
		// Checking is animation and mesh are loaded
		if(this.mesh instanceof Promise) {
		    await this.mesh;
		}
		if(this.animations[animationName] instanceof Promise) {
			await this.animations[animationName];
		}

		// When it is, create action
		this.prepareAction(this.animations[animationName], actionName, params, resolve);
	}

	async createAction(animationName, actionName, defaultAction){
		if(this.mesh instanceof Promise) {
			await this.mesh;
		}
		this.actions[actionName] = this.mixer.clipAction(this.animations[animationName].animations[0]);

		if(defaultAction){
			this.state = actionName;
		}
	}

	loadAnimation(path, name, defaultAction=false){
		this.animations[name] = new Promise(resolve => {
			this.app.fbxLoader.load(path, resolve);
		}).then(function(animation){
			this.animations[name] = animation;
			this.createAction(name, name, defaultAction);
		}.bind(this));

		return this.animations[name];
	}
}

class State {
	constructor(parent){
		this.parent = parent;
	}

	Enter(){}
	Exit(){}
	Update(delta){}
}

class RunState extends State {
	constructor(parent){
		super(parent);
	}

	get name(){
		return 'run';
	}

	Enter(prevState){
		let action = this.parent.actions[this.name];

		if(prevState){
			let prevAction = this.parent.actions[prevState.name];
			action.enabled = true;

			if(prevState.name == 'walk'){
				let ratio = action.getClip().duration / prevAction.getClip().duration;
				action.time = prevAction.time * ratio;
			} else {
				action.time = 0;
				action.setEffectiveTimeScale(1.0);
				action.setEffectiveWeight(1.0);
			}

			action.crossFadeFrom(prevAction);
			// action.play();
		} else {
			// action.play();
		}
	}

	Update(delta){
		let headQuaternion = this.parent.direction.head;
		let xHeadRotation = new THREE.Quaternion();
		let euler = new THREE.Euler().setFromQuaternion(this.parent.direction.head, 'YXZ');
		euler.z = 0;
		euler.x = 0;
		xHeadRotation.setFromEuler(euler);
		this.parent.direction.bodyTarget = xHeadRotation;

		let move = new THREE.Vector3(0, 0, 1);
		move.applyQuaternion(this.parent.direction.body);
		move.multiplyScalar(10 * delta);

		this.parent.mesh.position.add(move);

		if(this.parent.direction.bodyTarget !== null){
			this.parent.direction.body.slerp(this.parent.direction.bodyTarget, 0.1);
		}
	}
}

class WalkState extends State {
	constructor(parent){
		super(parent);
	}

	get name(){
		return 'walk';
	}

	Enter(prevState){
		let action = this.parent.actions[this.name];

		if(prevState){
			let prevAction = this.parent.actions[prevState.name];
			action.enabled = true;

			if(prevState.name == 'run'){
				let ratio = action.getClip().duration / prevAction.getClip().duration;
				action.time = prevAction.time * ratio;
			} else {
				action.time = 0;
				action.setEffectiveTimeScale(1.0);
				action.setEffectiveWeight(1.0);
			}

			action.crossFadeFrom(prevAction);
			// action.play();
		} else {
			// action.play();
		}
	}

	Update(delta){let headQuaternion = this.parent.direction.head;
		let xHeadRotation = new THREE.Quaternion();
		let euler = new THREE.Euler().setFromQuaternion(this.parent.direction.head, 'YXZ');
		euler.z = 0;
		euler.x = 0;
		xHeadRotation.setFromEuler(euler);
		//this.parent.direction.bodyTarget = xHeadRotation;

		let move = new THREE.Vector3(0, 0, 1);
		move.applyQuaternion(this.parent.direction.body);
		move.multiplyScalar(3.25 * delta);

		let ammoMove = new Ammo.btVector3();
		ammoMove.setValue(move.x * 100, move.y * 100, move.z * 100);
		//this.parent.mesh.userData.physicsBody.setLinearVelocity(ammoMove);


		if(this.parent.direction.bodyTarget !== null){
			this.parent.direction.body.slerp(this.parent.direction.bodyTarget, 0.1);
		}
	}
}

class IdleState extends State {
	constructor(parent){
		super(parent);
	}

	get name(){
		return 'idle';
	}

	Enter(prevState){
		let action = this.parent.actions[this.name];

		if(prevState){
			let prevAction = this.parent.actions[prevState.name];
			action.enabled = true;
			action.time = 0;
			action.setEffectiveTimeScale(1.0);
			action.setEffectiveWeight(1.0);
			action.crossFadeFrom(prevAction);
			// action.play();
		} else {
			// action.play();
		}
	}

	Update(delta){
		let headQuaternion = this.parent.direction.head;
		let bodyQuaternion = this.parent.direction.body;

		let headEuler = new THREE.Euler().setFromQuaternion(headQuaternion, 'YXZ');
		let bodyEuler = new THREE.Euler().setFromQuaternion(bodyQuaternion, 'YXZ');

		let headYaw = headEuler.y;
		let bodyYaw = bodyEuler.y;

		let yawDiff = headYaw - bodyYaw;

		if(Math.abs(yawDiff) > Math.PI / 5){
			let xHeadRotation = new THREE.Quaternion();
			let euler = new THREE.Euler().setFromQuaternion(this.parent.direction.head, 'YXZ');
			euler.z = 0;
			euler.x = 0;
			xHeadRotation.setFromEuler(euler);

			this.parent.direction.bodyTarget.copy(xHeadRotation);
		}

		if(this.parent.direction.bodyTarget !== null){
			this.parent.direction.body.slerp(this.parent.direction.bodyTarget, 0.1);
		}
	}
}