import * as THREE from 'three';
import CSM from 'three-csm';
import * as ammo from 'ammo.js';


import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

import Character from './character.js';
import { Controlls, FirstPersonCamera } from './controlls.js';

export default class App {
	constructor(){
		this.basicInit().then(function(){

			this.physicsInit().then(function(){

				this.graphicsInit().then(function(){
					this.preRenderInit();

					this.renderFrame();
				}.bind(this));
			}.bind(this));
		}.bind(this));
	}

	async basicInit(){
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( '#83C8E4' );

		this.camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.1, 1000 );

		this.camera.position.z = 4;
		this.camera.position.y = 2.5;

		this.clock = new THREE.Clock();
		this.delta = 0;
		this.interval = 1 / 60;

		this.textureLoader = new THREE.TextureLoader();
		this.fbxLoader = new FBXLoader();
		this.mixersNeedsUpdate = [];
	}

	async physicsInit(){
		this.Ammo = await ammo.bind(window)();

		this.tmpTrans = new this.Ammo.btTransform();

		let collisionConfiguration = new this.Ammo.btDefaultCollisionConfiguration(),
		dispatcher = new this.Ammo.btCollisionDispatcher(collisionConfiguration),
		overlappingPairCache = new this.Ammo.btDbvtBroadphase(),
		solver = new this.Ammo.btSequentialImpulseConstraintSolver();
		this.physicsWorld = new this.Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
		this.physicsWorld.setGravity(new this.Ammo.btVector3(0, -9.5, 0));
		this.rigidBodies = [];
	}

	async graphicsInit(){
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		document.body.appendChild( this.renderer.domElement );

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.csm = new CSM({
		  maxFar: this.camera.far,
		  cascades: 4,
		  shadowMapSize: 4096,
		  lightDirection: new THREE.Vector3(2, -1, 1).normalize(),
		  camera: this.camera,
		  parent: this.scene
		});

		this.composer = new EffectComposer( this.renderer );

		let ssaoPass = new SSAOPass( this.scene, this.camera, window.innerWidth, window.innerHeight );
		ssaoPass.kernelRadius = 16;
		ssaoPass.output = SSAOPass.OUTPUT.Beauty;
		this.composer.addPass( ssaoPass );
	}

	createBall(){
		let ballGeometry = new THREE.SphereGeometry(2, 32, 32);
		let ballMaterial = new THREE.MeshPhongMaterial({ map: this.textureLoader.load('/ball.png') }); // Материал мяча
		this.csm.setupMaterial(ballMaterial);
		let ball = new THREE.Mesh(ballGeometry, ballMaterial);
		ball.position.set(0, 0, 0);
		ball.castShadow = true;
		ball.receiveShadow = true;

		let transform = new this.Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin( new this.Ammo.btVector3( 7, 5, 7) );
		transform.setRotation( new this.Ammo.btQuaternion( 0, 0, 0, 1 ));
		let motionState = new this.Ammo.btDefaultMotionState( transform );

		let colShape = new this.Ammo.btSphereShape( 2 );
		colShape.setMargin( 0.05 );

		let localInertia = new this.Ammo.btVector3( 0, 0, 0 );
		colShape.calculateLocalInertia( 1, localInertia );

		let rbInfo = new this.Ammo.btRigidBodyConstructionInfo( 1, motionState, colShape, localInertia );
		let body = new this.Ammo.btRigidBody( rbInfo );

		body.setFriction(4);
		body.setRollingFriction(1);

		this.physicsWorld.addRigidBody(body);
		ball.userData.physicsBody = body;

		this.rigidBodies.push(ball);
		this.scene.add(ball);
	}

	createCharacter(){

		let player = new Character(this, '/models/Main character/Main.fbx');
		player.loadAnimation('/models/Main character/Animations/Walk.fbx', 'walk');
		player.loadAnimation('/models/Main character/Animations/Idle.fbx', 'idle', true);
		player.loadAnimation('/models/Main character/Animations/Fight.fbx', 'fight');
		player.loadAnimation('/models/Main character/Animations/Dance.fbx', 'dance');
		player.loadAnimation('/models/Main character/Animations/Run.fbx', 'run');

		this.player = player;

		let geometry = new THREE.BoxGeometry( 1, 1, 1 ); 
	    let material = new THREE.MeshBasicMaterial( {color: 0x00ff00, wireframe: true} ); 
	    this.cube = new THREE.Mesh( geometry, material ); 
	    this.scene.add( this.cube );
	    this.cube.position.z = 0;
	    this.cube.position.y = 0;
	    this.cube.position.x = 0;

		this.controlls = new Controlls(this.renderer.domElement, this.camera);
		this.controlls.character = this.player;


		this.renderer.domElement.addEventListener("click", async () => {
		  await this.renderer.domElement.requestPointerLock();
		});

	}


	createGroundShape(heightmapArray, texture, width, depth){
		let heights = heightmapArray.flat();

		let ammoHeightData = Ammo._malloc( 4 * texture.image.width * texture.image.height );

		let p = 0;
		let p2 = 0;

		for ( let j = 0; j < texture.image.height; j ++ ) {

				for ( let i = 0; i < texture.image.width; i ++ ) {

						// write 32-bit float data to memory
						Ammo.HEAPF32[ ammoHeightData + p2 >> 2 ] = heights[ p ];

						p ++;

						// 4 bytes/float
						p2 += 4;

				}

		}

		let heightScale = 1;
		let minHeight = -1;
		let maxHeight = 1;
		let heightfieldShape = new Ammo.btHeightfieldTerrainShape(
			texture.image.width,
			texture.image.height,
			ammoHeightData,
			1,
			-1,
			1,
			1,
			false
		);
		heightfieldShape.setLocalScaling( new Ammo.btVector3( width / (texture.image.width - 1), 1, depth / (texture.image.height - 1) ));

		return heightfieldShape;
	}

	readHeightmapToArray(texture){
		let canvas = document.createElement('canvas');
		canvas.width = texture.image.width;
		canvas.height = texture.image.height;
		let context = canvas.getContext('2d');
		context.drawImage(texture.image, 0, 0);
		let imageData = context.getImageData(0, 0, texture.image.width, texture.image.height).data;

		let heights = [];
		for (let y = 0; y < texture.image.height; y++) {
			let line = [];
			for (let x = 0; x < texture.image.width; x++) {

				let i = (y * texture.image.width + x) * 4;
				let height = imageData[i] / 255 * 2 - 1;
				line.push(height);
			}
			heights.push(line);
		}

		return heights;
	}

	generatePhysicalHeightmap(heightmap, texture, width, depth, detailedWidth, detailedHeight){
		let terraingeometry = new THREE.PlaneGeometry(width, depth, detailedWidth, detailedHeight);
		terraingeometry.rotateX(-Math.PI / 2);

		this.applyHeightmapObjectToGeometry(terraingeometry, heightmap, texture);

		return terraingeometry;
	}

	maxInLarageArray(arr) {
		const chunkSize = 100000; // размер каждой части массива
		let max = -Infinity; // начальное значение максимума

		for (let i = 0; i < arr.length; i += chunkSize) {
			// находим максимум в каждой части массива
			const chunkMax = Math.max(...arr.slice(i, i + chunkSize));

			// обновляем максимум для всего массива
			if (chunkMax > max) {
				max = chunkMax;
			}
		}

		return max;
	}

	applyHeightmapObjectToGeometry(geometry, heightmapArray, heightmapTexture){
		let positions = geometry.attributes.position;

		let max = this.maxInLarageArray(positions.array);

		for (let i = 0; i < positions.count; i++) {
			let x = positions.getX(i);
			let z = positions.getZ(i);

			let lineIndex = Math.ceil((heightmapArray.length / ((max * 2) + 1)) * (z + max + 1));
			if(lineIndex > heightmapArray.length){
				lineIndex = heightmapArray.length;
			}

			let lne = heightmapArray[lineIndex - 1];

			let pointIndex = Math.ceil((lne.length / ((max * 2) + 1)) * (x + max + 1));
			if(pointIndex > lne.length){
				pointIndex = lne.length;
			}

			let pos = lne[pointIndex - 1];
			positions.setXYZ(i, x, pos, z);
		}

		positions.needsUpdate = true;


		geometry.needsUpdate = true;

		geometry.computeVertexNormals();
	}



	createTerrain(){
		this.textureLoader.load('/iceland_heightmap.png', function(texture){
    
		    let heights = this.readHeightmapToArray(texture);

		    let terrainGeometry = this.generatePhysicalHeightmap(heights, texture, texture.image.width / 2, texture.image.height / 2, texture.image.width * 1, texture.image.height * 1);

		    let groundDiffuse = this.textureLoader.load('/ground/diffuse.jpg');
		    groundDiffuse.wrapS = groundDiffuse.wrapT = THREE.RepeatWrapping;
		    groundDiffuse.offset.set( 0, 0 );
		    groundDiffuse.repeat.set( 50, 50);
		    let groundDisplacement = this.textureLoader.load('/ground/displacement.png');
		    groundDisplacement.wrapS = groundDisplacement.wrapT = THREE.RepeatWrapping;
		    groundDisplacement.offset.set( 0, 0 );
		    groundDisplacement.repeat.set( 50, 50);

		    let material = new THREE.MeshPhongMaterial({map: groundDiffuse, shininess: 0});
		    this.csm.setupMaterial(material);
		    let terrain = new THREE.Mesh(terrainGeometry, material);
		    terrain.castShadow = true;
		    terrain.receiveShadow = true;

		    let groundShape = this.createGroundShape(heights, texture, texture.image.height / 2, texture.image.height / 2);

		    const groundTransform = new this.Ammo.btTransform();
		    groundTransform.setIdentity();
		    groundTransform.setOrigin( new this.Ammo.btVector3( 0, 0, 0 ) );
		    const groundMass = 0;
		    const groundLocalInertia = new this.Ammo.btVector3( 0, 0, 0 );
		    const groundMotionState = new this.Ammo.btDefaultMotionState( groundTransform );
		    const groundBody = new this.Ammo.btRigidBody( new this.Ammo.btRigidBodyConstructionInfo( groundMass, groundMotionState, groundShape, groundLocalInertia ) );

		    this.physicsWorld.addRigidBody(groundBody);

		    terrain.userData.physicsBody = groundBody;
		    this.rigidBodies.push(terrain);

		    this.scene.add(terrain);

		}.bind(this));
	}

	preRenderInit(){
		this.createBall();
		this.createCharacter();
		this.createTerrain();

		let light = new THREE.AmbientLight( 0xFFFFFF );
		this.scene.add( light );

		let directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
		this.scene.add( directionalLight );
	}

	updatePhysics(delta){
		this.physicsWorld.stepSimulation( delta, 10 );

		this.rigidBodies.forEach(function(object){
	        let ms = object.userData.physicsBody.getMotionState();
	        if ( ms ) {

	            ms.getWorldTransform( this.tmpTrans );
	            let position = this.tmpTrans.getOrigin();
	            let quaternion = this.tmpTrans.getRotation();

	            object.position.set( position.x(), position.y(), position.z() );
	            object.quaternion.set( quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w() );

	        }
		}.bind(this));
	}

	renderFrame(){
		requestAnimationFrame( () => this.renderFrame() );

		this.delta = this.clock.getDelta();
		    this.updatePhysics(this.delta);
		    this?.mixersNeedsUpdate?.map(mixer => {
		    	mixer.update(this.delta);
		    });
			this.controlls.update(this.delta);

		    if(this.player){
		    	this.player.Update(this.delta);
		    	// this.camera.position.copy(this.player.mesh.children[1].children[1].children[0].children[0].children[0].children[0].getWorldPosition(new THREE.Vector3()));
		    	// this.camera.rotateY(Math.PI);
		    }

		 	this.csm.update(this.camera.matrix);
			this.composer.render( this.scene, this.camera );


	}
}