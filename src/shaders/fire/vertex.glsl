uniform float uTime;
varying vec2 vUv;
varying float vProgress;

void main() {
    vUv = uv;
    vProgress = uv.y;

    vec3 newPos = position;

    float intensity = uv.y * uv.y;
    
    float wave1 = sin(uTime * 1.5 + position.y * 2.0) * 0.15 * intensity;
    float wave2 = sin(uTime * 4.0 + position.y * 3.0) * 0.08 * intensity;
    float wave3 = cos(uTime * 2.3 + position.y * 1.5) * 0.1 * intensity;

    newPos.x += wave1 + wave2;
    newPos.z += wave3;

    newPos.y += sin(uTime * 3.0 + position.x) * 0.05 * intensity;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
