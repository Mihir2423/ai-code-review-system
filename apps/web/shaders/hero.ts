export const VERT_SRC = `
  attribute vec2 a_pos;
  varying   vec2 v_uv;
  void main() {
    v_uv        = a_pos * 0.5 + 0.5;
    v_uv.y      = 1.0 - v_uv.y;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

export const FRAG_SRC = `
  precision highp float;

  uniform sampler2D u_dither;
  uniform sampler2D u_hero;
  uniform vec2      u_mouse;
  uniform float     u_aspect;
  uniform float     u_reveal;
  uniform float     u_time;
  uniform vec4      u_cover_dither;
  uniform vec4      u_cover_hero;

  varying vec2 v_uv;

  vec2 coverUV(vec2 uv, vec4 cover) {
    return uv * cover.xy + cover.zw;
  }

  float hash(vec2 p){
    p = fract(p * vec2(127.1,311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    for(int i=0;i<4;i++){
      v+=a*noise(p);
      p = mat2(0.8,-0.6,0.6,0.8)*p*2.1;
      a*=0.5;
    }
    return v;
  }

  void main(){
    vec2  diff  = v_uv - u_mouse;
    diff.x     *= u_aspect;
    float dist  = length(diff);
    float angle = atan(diff.y, diff.x);

    vec2  nuv = vec2(angle / 6.2832 + u_time * 0.016, dist * 1.2);
    float n   = fbm(nuv * 3.2);
    vec2  wuv = nuv + vec2(fbm(nuv*2.2+1.7), fbm(nuv*2.2+9.1))*0.28;
    float n2  = fbm(wuv * 2.5);
    float nc  = mix(n, n2, 0.45);

    float base_r  = 0.75;
    float noisy_r = base_r + (nc - 0.5) * 0.12;
    float core_r  = base_r * 0.38;

    float rim   = smoothstep(noisy_r, noisy_r * 0.35, dist);
    float core  = smoothstep(core_r,  core_r  * 0.5,  dist);
    float spot  = max(rim, core * 0.7);

    float falloff = pow(1.0 - smoothstep(0.0, noisy_r, dist), 1.6);
    float mask    = spot * (0.45 + 0.55 * falloff) * u_reveal;

    vec2 uvd = coverUV(v_uv, u_cover_dither);
    vec2 uvh = coverUV(v_uv, u_cover_hero);

    vec4 dc = texture2D(u_dither, uvd);
    vec4 hc = texture2D(u_hero,   uvh);
    gl_FragColor = mix(dc, hc, clamp(mask, 0.0, 1.0));
  }
`;
