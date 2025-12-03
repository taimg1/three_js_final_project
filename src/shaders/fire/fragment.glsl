uniform float uTime;
uniform sampler2D uPerlinTexture;

varying vec2 vUv;
varying float vProgress;

void main() {
    vec2 noiseUV = vUv;
    noiseUV.y -= uTime * 0.5;

    float noiseValue = texture2D(uPerlinTexture, noiseUV).r;

    float radial = 1.0 - abs((vUv.x - 0.5) * 2.0); 
    radial = pow(radial, 2.0);

    float fadeTop = 1.0 - vProgress;

    float fireMask = noiseValue * radial * fadeTop;

    float alpha = smoothstep(0.1, 0.5, fireMask);

    vec3 color1 = vec3(1.0, 0.2, 0.0);
    vec3 color2 = vec3(1.0, 0.8, 0.2);

    vec3 finalColor = mix(color1, color2, fireMask * 2.0);

    gl_FragColor = vec4(finalColor, alpha);
}
