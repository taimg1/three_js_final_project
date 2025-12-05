import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import GUI from 'lil-gui'
import gsap from 'gsap'
import fireVertexShader from './shaders/fire/vertex.glsl'
import fireFragmentShader from './shaders/fire/fragment.glsl'
import firefliesVertexShader from './shaders/fireflies/vertex.glsl'
import firefliesFragmentShader from './shaders/fireflies/fragment.glsl'

/**
 * --- CONFIGURATION & DEBUG ---
 */
const gui = new GUI()
const debugObject = {
    sunPosX: 20,
    sunPosY: 30,
    sunPosZ: 20,
    groundDisplacementScale: 0,
    platformRadius: 14.5,
    cameraMinHeight: 1.2,
    cameraMaxHeight: 20
}
// Allow toggling the navigation constraint
debugObject.limitFlight = true

/**
 * --- BASE SETUP ---
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()

// Розміри
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

/**
 * --- LOADERS ---
 */
const loadingBarElement = document.querySelector('.loading-bar')
const loadingManager = new THREE.LoadingManager(
    // Loaded
    () => {
        console.log('All resources loaded!')
        window.setTimeout(() => {
            gsap.to(overlayMaterial.uniforms.uAlpha, { duration: 3, value: 0, delay: 1 })
            loadingBarElement.classList.add('ended')
            loadingBarElement.style.transform = ''
        }, 500)
    },
    // Progress
    (itemUrl, itemsLoaded, itemsTotal) => {
        const progressRatio = itemsLoaded / itemsTotal
        loadingBarElement.style.transform = `scaleX(${progressRatio})`
    }
)

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const gltfLoader = new GLTFLoader(loadingManager)
gltfLoader.setDRACOLoader(dracoLoader)

const textureLoader = new THREE.TextureLoader(loadingManager)
const rgbeLoader = new RGBELoader(loadingManager)
const audioLoader = new THREE.AudioLoader()

/**
 * --- AUDIO ---
 */
const listener = new THREE.AudioListener()
const sound = new THREE.Audio(listener)
let audioReady = false

audioLoader.load('/sounds/music.mp3', (buffer) => {
    sound.setBuffer(buffer)
    sound.setLoop(true)
    sound.setVolume(0.5)
    audioReady = true
})

const audioControls = {
    play: () => {
        if(audioReady && !sound.isPlaying) {
            sound.play()
        }
    },
    pause: () => {
        if(sound.isPlaying) {
            sound.pause()
        }
    },
    volume: 0.5
}

/**
 * --- OVERLAY ---
 */
const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1)
const overlayMaterial = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 1 } },
    vertexShader: `
        void main() { gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: `
        uniform float uAlpha;
        void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha); }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false
})
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
overlay.renderOrder = 9999
scene.add(overlay)

/**
 * --- TEXTURES ---
 */
// Helper function to setup textures
const setupTexture = (texture, repeatX = 1, repeatY = 1) => {
    if(!texture) return null;
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    return texture
}

// Utility clamp function
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Helper to clamp position inside circle in XZ plane
const clampToRadius = (vec3, radius) => {
    const dist = Math.sqrt(vec3.x * vec3.x + vec3.z * vec3.z)
    if(dist > radius) {
        const scale = radius / dist
        vec3.x *= scale
        vec3.z *= scale
    }
}

// Background
const backgroundTexture = textureLoader.load('/textures/background.jpg')
scene.background = backgroundTexture

// HDR Environment Map
rgbeLoader.load('/textures/studio_small_09_1k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = texture
})

// Fire Perlin
const perlinTexture = setupTexture(textureLoader.load('/textures/perlin.png'))

// Mixed Rock Ground Textures
const groundColorTexture = setupTexture(textureLoader.load('/textures/mixedrock/color.jpg'), 8, 8)
const groundDispTexture = setupTexture(textureLoader.load('/textures/mixedrock/displacement.png'), 8, 8)

// Floor Tiles (for pedestal)
const floorTilesColorTexture = setupTexture(textureLoader.load('/textures/floortiles/color.jpg'), 1, 1)
const floorTilesDispTexture = setupTexture(textureLoader.load('/textures/floortiles/displacement.png'), 1, 1)
const floorTilesRoughnessTexture = setupTexture(textureLoader.load('/textures/floortiles/roughness.jpg'), 1, 1)

// Marble Tiles (for columns)
const marbleColorTexture = setupTexture(textureLoader.load('/textures/marble/color.jpg'), 1, 1)
const marbleDispTexture = setupTexture(textureLoader.load('/textures/marble/displacement.png'), 1, 1)


/**
 * --- LIGHTS ---
 */
const ambientLight = new THREE.AmbientLight('#ffffff', 0.4)
scene.add(ambientLight)

const hemisphereLight = new THREE.HemisphereLight('#87ceeb', '#d2b48c', 0.5)
scene.add(hemisphereLight)

const directionalLight = new THREE.DirectionalLight('#ffffff', 1.2)
directionalLight.position.set(debugObject.sunPosX, debugObject.sunPosY, debugObject.sunPosZ)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(2048, 2048)
directionalLight.shadow.camera.near = 1
directionalLight.shadow.camera.far = 100
directionalLight.shadow.normalBias = 0.05
directionalLight.shadow.camera.top = 30
directionalLight.shadow.camera.bottom = -30
directionalLight.shadow.camera.left = -30
directionalLight.shadow.camera.right = 30
scene.add(directionalLight)

const pointLight = new THREE.PointLight('#ffa500', 1.5, 20)
pointLight.position.set(-4, 8, -4)
pointLight.castShadow = true
scene.add(pointLight)


/**
 * --- OBJECTS ---
 */

// 1. GLTF Model
gltfLoader.load('/models/scene.gltf', (gltf) => {
    const model = gltf.scene
    model.scale.set(2, 2, 2)
    model.position.set(0, 1.5, 2)
    model.traverse((child) => {
        if(child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
        }
    })
    scene.add(model)
})

// Pedestal for statue
const pedestalGeometry = new THREE.CylinderGeometry(1.8, 2.2, 1.5, 64)
const pedestalMaterial = new THREE.MeshStandardMaterial({
    map: floorTilesColorTexture,
    roughnessMap: floorTilesRoughnessTexture,
    displacementMap: floorTilesDispTexture,
    displacementScale: 0.05,
    roughness: 0.8,
    metalness: 0.1
})
const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial)
pedestal.position.y = 0.75
pedestal.castShadow = true
pedestal.receiveShadow = true
pedestal.geometry.setAttribute('uv2', pedestal.geometry.attributes.uv)
scene.add(pedestal)
// Small decorative ring to hide seam at top edge of pedestal
const ringGeometry = new THREE.TorusGeometry(1.8, 0.06, 8, 64) 
const ring = new THREE.Mesh(ringGeometry, pedestalMaterial)
ring.rotation.x = Math.PI * 0.5
ring.position.y = 1.5 - 0.02 // near the top of the pedestal
ring.castShadow = true
ring.receiveShadow = true
scene.add(ring)

// 2. Floor
const floorMaterial = new THREE.MeshStandardMaterial({
    map: groundColorTexture,
    displacementMap: groundDispTexture,
    displacementScale: 0.3,
    roughness: 0.95,
    metalness: 0.02
})

const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 128), floorMaterial)
floor.rotation.x = - Math.PI * 0.5
floor.position.y = 0.01
floor.receiveShadow = true
scene.add(floor)

// 3. Columns & Fire
const columnMaterial = new THREE.MeshStandardMaterial({
    map: marbleColorTexture,
    displacementMap: marbleDispTexture,
    displacementScale: 0.02,
    roughness: 0.3,
    metalness: 0.1
})

const fireGeometry = new THREE.PlaneGeometry(0.6, 1.2, 32, 32)
const fireMaterials = [] 
const fireLights = []
const fireMeshes = []

const numColumns = 12
const columnRadius = 12

for(let i = 0; i < numColumns; i++) {
    const angle = (i / numColumns) * Math.PI * 2
    const x = Math.cos(angle) * columnRadius
    const z = Math.sin(angle) * columnRadius

    const columnGroup = new THREE.Group()
    columnGroup.position.set(x, 0, z)

    const baseGeometry = new THREE.CylinderGeometry(0.55, 0.65, 0.5, 16)
    const base = new THREE.Mesh(baseGeometry, columnMaterial)
    base.position.y = 0.25
    base.castShadow = true
    base.receiveShadow = true
    base.geometry.setAttribute('uv2', base.geometry.attributes.uv)
    columnGroup.add(base)

    const shaftGeometry = new THREE.CylinderGeometry(0.45, 0.45, 4, 16)
    const shaft = new THREE.Mesh(shaftGeometry, columnMaterial)
    shaft.position.y = 2.5
    shaft.castShadow = true
    shaft.receiveShadow = true
    shaft.geometry.setAttribute('uv2', shaft.geometry.attributes.uv)
    columnGroup.add(shaft)

    const capitalGeometry = new THREE.CylinderGeometry(0.6, 0.5, 0.6, 16)
    const capital = new THREE.Mesh(capitalGeometry, columnMaterial)
    capital.position.y = 4.8
    capital.castShadow = true
    capital.receiveShadow = true
    capital.geometry.setAttribute('uv2', capital.geometry.attributes.uv)
    columnGroup.add(capital)
    
    scene.add(columnGroup)

    const fireLight = new THREE.PointLight('#ff6600', 3, 8)
    fireLight.position.set(x, 5.2, z)
    fireLight.castShadow = false
    scene.add(fireLight)
    fireLights.push(fireLight)

    const fireMaterial = new THREE.ShaderMaterial({
        vertexShader: fireVertexShader,
        fragmentShader: fireFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uPerlinTexture: { value: perlinTexture }
        },
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
    
    const fireMesh = new THREE.Mesh(fireGeometry, fireMaterial)
    fireMesh.position.set(x, 5.5, z)
    scene.add(fireMesh)
    fireMaterials.push(fireMaterial)
    fireMeshes.push(fireMesh)
}

// const shaderMesh = new THREE.Mesh(
//     new THREE.SphereGeometry(0.6, 32, 32),
//     new THREE.ShaderMaterial({
//         vertexShader: `
//             varying vec2 vUv;
//             varying vec3 vPosition;
//             void main() {
//                 vUv = uv;
//                 vPosition = position;
//                 gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//             }
//         `,
//         fragmentShader: `
//             varying vec2 vUv;
//             uniform float uTime;
//             void main() {
//                 float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
//                 float strength = 0.2 / (distance(vec2(vUv.x, (vUv.y - 0.5) * 5.0 + 0.5), vec2(0.5)));
//                 strength *= (0.7 + pulse * 0.3);
//                 vec3 color = mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.4, 0.8), sin(uTime));
//                 gl_FragColor = vec4(color, strength);
//             }
//         `,
//         uniforms: { uTime: { value: 0 } },
//         transparent: true,
//         side: THREE.DoubleSide
//     })
// )
// shaderMesh.position.set(4, 3, 4)
// scene.add(shaderMesh)

const firefliesCount = 250
const firefliesPositions = new Float32Array(firefliesCount * 3)
const firefliesScales = new Float32Array(firefliesCount)

for(let i = 0; i < firefliesCount; i++) {
    firefliesPositions[i * 3 + 0] = (Math.random() - 0.5) * 20
    firefliesPositions[i * 3 + 1] = Math.random() * 6 + 0.5
    firefliesPositions[i * 3 + 2] = (Math.random() - 0.5) * 20
    firefliesScales[i] = Math.random()
}

const firefliesGeometry = new THREE.BufferGeometry()
firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(firefliesPositions, 3))
firefliesGeometry.setAttribute('aScale', new THREE.BufferAttribute(firefliesScales, 1))

const firefliesMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: 100 }
    },
    vertexShader: firefliesVertexShader,
    fragmentShader: firefliesFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
})
const fireflies = new THREE.Points(firefliesGeometry, firefliesMaterial)
scene.add(fireflies)

/**
 * --- RENDERER & CAMERA ---
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4, 4, 8)
camera.add(listener)
scene.add(camera)

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.minDistance = 2
controls.maxDistance = 35
controls.enablePan = true

/**
 * --- GUI SETUP ---
 */
const setupGui = () => {
    const lightsFolder = gui.addFolder('Lights')
    lightsFolder.add(ambientLight, 'intensity', 0, 2).name('Ambient')
    lightsFolder.add(directionalLight, 'intensity', 0, 3).name('Sun Intensity')
    lightsFolder.add(pointLight, 'intensity', 0, 3).name('Point Intensity')
    
    const sunFolder = gui.addFolder('Sun Position')
    const updateSun = () => directionalLight.position.set(debugObject.sunPosX, debugObject.sunPosY, debugObject.sunPosZ)
    sunFolder.add(debugObject, 'sunPosX', -50, 50).onChange(updateSun)
    sunFolder.add(debugObject, 'sunPosY', 0, 50).onChange(updateSun)
    sunFolder.add(debugObject, 'sunPosZ', -50, 50).onChange(updateSun)
    
    gui.add(renderer, 'toneMappingExposure', 0, 3).name('Exposure')

    const navFolder = gui.addFolder('Navigation')
    navFolder.add(debugObject, 'platformRadius', 5, 25).name('Platform Radius')
    navFolder.add(debugObject, 'cameraMinHeight', 0.5, 5).name('Min Height')
    navFolder.add(debugObject, 'cameraMaxHeight', 2, 50).name('Max Height')
    navFolder.add(debugObject, 'limitFlight').name('Limit Flight')

    const audioFolder = gui.addFolder('Music')
    audioFolder.add(audioControls, 'play').name('▶ Play')
    audioFolder.add(audioControls, 'pause').name('⏸ Pause')
    audioFolder.add(audioControls, 'volume', 0, 1).name('Volume').onChange((value) => {
        sound.setVolume(value)
    })
}
setupGui()

/**
 * --- EVENTS ---
 */
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    
    firefliesMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
})

/**
 * --- ANIMATION LOOP ---
 */
const clock = new THREE.Clock()

const tick = () => {
    const elapsedTime = clock.getElapsedTime()

    //shaderMesh.material.uniforms.uTime.value = elapsedTime
    firefliesMaterial.uniforms.uTime.value = elapsedTime
    fireMaterials.forEach(mat => mat.uniforms.uTime.value = elapsedTime)

    //shaderMesh.position.y = 3 + Math.sin(elapsedTime * 1.5) * 0.4
    //shaderMesh.rotation.y = elapsedTime * 0.3

    fireLights.forEach((light, i) => {
        const flicker = Math.sin(elapsedTime * 15 + i) * 0.5 + Math.random() * 0.2
        light.intensity = 3 + flicker
    })

    fireMeshes.forEach((fireMesh) => {
        fireMesh.lookAt(camera.position.x, fireMesh.position.y, camera.position.z)
    })

    controls.update()

    if (debugObject.limitFlight) {
    const platformR = debugObject.platformRadius
    const margin = 0.5
    const maxR = Math.max(2, platformR - margin)

    clampToRadius(controls.target, maxR)
    controls.target.y = clamp(controls.target.y, 0, debugObject.cameraMaxHeight)

    const relX = camera.position.x - controls.target.x
    const relZ = camera.position.z - controls.target.z
    const distXZ = Math.sqrt(relX * relX + relZ * relZ)
    if(distXZ > maxR) {
        const scale = maxR / distXZ
        camera.position.x = controls.target.x + relX * scale
        camera.position.z = controls.target.z + relZ * scale
    }

    camera.position.y = clamp(camera.position.y, debugObject.cameraMinHeight, debugObject.cameraMaxHeight)

    }

    controls.update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()