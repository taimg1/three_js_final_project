uniform sampler2D uColorTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uAOTexture;
uniform sampler2D uRoughnessTexture;
uniform vec3 uLightPosition;
uniform float uTime;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {

    vec4 colorMap = texture2D(uColorTexture, vUv);
    vec3 normalMap = texture2D(uNormalTexture, vUv).rgb;
    float ao = texture2D(uAOTexture, vUv).r;
    float roughness = texture2D(uRoughnessTexture, vUv).r;

    normalMap = normalMap * 2.0 - 1.0;
    vec3 bumpNormal = normalize(vNormal + normalMap * 0.3);

    vec3 lightDir = normalize(uLightPosition - vPosition);
    float diff = max(dot(bumpNormal, lightDir), 0.0);

    float heightVariation = sin(vPosition.x * 3.0) * cos(vPosition.z * 3.0) * 0.1 + 1.0;

    vec3 ambient = colorMap.rgb * 0.4 * ao;
    vec3 diffuse = colorMap.rgb * diff * 0.6 * heightVariation;

    float wave = sin(vPosition.x * 0.5 + uTime * 0.3) * 0.05 + 0.95;
    
    vec3 finalColor = (ambient + diffuse) * wave;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
