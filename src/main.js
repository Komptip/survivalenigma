import * as THREE from 'three';
import CSM from 'three-csm';
import * as ammo from 'ammo.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Character from './character.js';
import App from './app.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';


let app = new App();



