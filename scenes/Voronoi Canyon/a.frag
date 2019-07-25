//BUF_A

// Created by genis sole - 2017
// License Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.

const float PI = 3.141592;

//From http://marc-b-reynolds.github.io/math/2016/03/29/weyl_hash.html
uint hash(uvec2 x) {
    x = uvec2(0x3504f333, 0xf1bbcdcb)*x; 
    return (x.x^x.y) * 741103597u;
}

//From http://iquilezles.org/www/articles/sfrand/sfrand.htm
float uintBitsToFloat01(uint x) {
    return uintBitsToFloat((x >> 9u) | 0x3f800000u) - 1.0;
}

float uintBitsToFloat11(uint x) {
    return uintBitsToFloat((x >> 9u) | 0x40000000u) - 3.0;
}

vec2 hash2(vec2 p) {
    uvec2 x = floatBitsToUint(p);   
    return vec2(uintBitsToFloat01(hash(x)),
                uintBitsToFloat01(hash(x + 868867u))); 
}

float hash(vec2 p) {
    uvec2 x = floatBitsToUint(p);
    return uintBitsToFloat01(hash(x));
}

vec3 uniformUnitHemisphere(uvec2 seed, vec3 n) {
    float t = uintBitsToFloat01(hash(seed))*2.0*PI;
    float u = uintBitsToFloat11(hash(seed + 6756984u));
    
    vec3 p = vec3(vec2(cos(t), sin(t)) * sqrt(1.0 - u*u), u);
    return p * (dot(n, p) > 0.0 ? 1.0 : -1.0); // sign(dot(n, p)) could result 0.0;
}

//From http://www.amietia.com/lambertnotangent.html
vec3 cosUnitHemisphere(uvec2 seed, vec3 n) {
    float t = uintBitsToFloat01(hash(seed))*(2.0*PI);
    float u = uintBitsToFloat11(hash(seed + 6756984u));
    
    return normalize(n + vec3(vec2(cos(t), sin(t)) * sqrt(1.0 - u*u), u));
}


void voronoi_s(in vec2 x, inout vec2 n,  inout vec2 f, 
                          inout vec2 mg, inout vec2 mr) {

    n = floor(x);
    f = fract(x);

    float md = 8.0;
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2 g = vec2(float(i),float(j));
        vec2 o = hash2( n + g );
        vec2 r = g + o - f;
        float d = dot(r,r);

        if (d < md) {
            md = d;
            mr = r;
            mg = g;
        }
    }   
}

vec3 voronoi_n(in vec2 rd, in vec2 n,  in vec2 f, 
               inout vec2 mg, inout vec2 mr) {
    float md = 1e5;
    vec2 mmg = mg;
    vec2 mmr = mr;
    vec2 ml = vec2(0.0);
    
    for( int j=-2; j<=2; j++ )
    for( int i=-2; i<=2; i++ )
    {   
        vec2 g = mmg + vec2(i, j);
        vec2 o = hash2(n + g);
        vec2 r = g + o - f;

        vec2 l = r - mmr;
        if(dot(l, l) > 1e-5) {
            l = normalize(l);
            if (dot(rd, l) > 1e-5) {
                float d = dot(0.5*(mmr + r), l)/dot(rd, l);
                if (d < md) {
                    md = d;
                    mg = g;
                    mr = r;
                    ml = l;
                }
            }
        }
    }
    
    return vec3(md, ml);
}

float path(in float x) {
    return sin(x*0.1)*4.0;
}

float path_df(in float x) {
    return cos(x*0.1)*0.4;
}

float map(in vec2 p) {
    p.x -= path(p.y);
    float h = pow(abs(p.x) + 0.1, 4.0)*0.1;
    return clamp(h, 0.0, 30.0) - hash(p)*0.5;
}

//Related to https://www.shadertoy.com/view/MtyGWK
mat2x4 rayTrace(in vec3 ro, in vec3 rd) {
    vec3 p0 = ro;

    vec2 dir = normalize(rd.xz);
    float s = rd.y / length(rd.xz);
    
    vec2 mg = vec2(0.0), mr = vec2(0.0), n = vec2(0.0), f = vec2(0.0);
    voronoi_s(p0.xz, n, f, mg, mr);
    
    vec2 pmg = mg, pmr = mr;
    float h = map(n + pmg);
    
    vec3 dn = voronoi_n(dir, n, f, mg, mr);
    vec3 pdn = dn;
    
    float rh = p0.y + dn.x*s, prh = p0.y;
    
    const int steps = 128;
    for (int  i = 0; i < steps; ++i) { 
        if (h > prh || h > rh || rh > 32.0) break; 
        
        prh = rh; 
        pmg = mg; pmr = mr;
        pdn = dn;

        h = map(n + mg);
        dn = voronoi_n(dir, n, f, mg, mr);
        
        rh = p0.y + dn.x*s;
    }
    
    if (!(h > prh || h > rh || rh < 32.0)) return mat2x4(0.0); 

    
    vec3 p = vec3(p0.xz + dir*abs((p0.y - h)/s), h).xzy;
    vec3 nor = vec3(0.0, 1.0, 0.0);
    if (h > prh) {
        p = vec3(p0.xz + dir*pdn.x, prh).xzy;
        nor = vec3(-pdn.yz, 0.0).xzy;
    }
    
    return mat2x4(vec4(nor, 1.0), vec4(p, 1.0));
}

const vec3 m = vec3(0.3, 0.3, 0.2) / PI;

vec3 pathTrace(vec3 ro, vec3 rd, int s) {
    const vec3 ld = normalize(vec3(1.0, 1.7, 1.0));
    
    const int bounces = 3;
    const float sun = 130.0;
    const vec3 sky = vec3(0.25, 0.6, 0.98) * 7.0;
    
    vec3 cm = vec3(1.0);
    vec3 acc = vec3(0.0);
    mat2x4 r = mat2x4(1.0);// r[0].xyz = normal; r[1].xyz = position; r[1].w = hit.
    
    for (int i = bounces; i > 0; --i) {
        r = rayTrace(ro, rd);
        
        if (r[1].w == 0.0) break;
        
        ro = r[1].xyz + r[0].xyz*0.0001;
        
        cm *= m;
        acc += cm * sun * dot(r[0].xyz, ld) * (1.0 - rayTrace(ro, ld)[1].w); 
        
        rd = cosUnitHemisphere(uvec2(s*bounces + i, iFrame), r[0].xyz);
    }
    
    acc += cm * sky * (step(r[1].w, 0.5));
                       
    return acc;
}

mat4 cameraTransform() {
    float t = 363.0;
         
    vec2 m = vec2(atan(path_df(t+1.0)), 0.3) * vec2(0.4, 1.0);
  
    mat3 rotY = mat3(cos(m.x), 0.0, -sin(m.x), 
                     0.0, 1.0, 0.0, 
                     sin(m.x), 0.0, cos(m.x));
    mat3 rotX = mat3(1.0, 0.0, 0.0,
                     0.0, cos(m.y), -sin(m.y), 
                     0.0, sin(m.y), cos(m.y));
    mat3 rot = rotY*rotX;

    return mat4(vec4(rot[0], 0), vec4(rot[1], 0), vec4(rot[2], 0), 
                vec4(path(t), 5.0, t, 1.0));
}

void cameraRay(vec2 fragCoord, mat4 t, int s, out vec3 ro, out vec3 rd) {
    uvec2 seed = uvec2(s, iFrame);
    vec2 o = vec2(uintBitsToFloat01(hash(seed)),
                  uintBitsToFloat01(hash(seed + 2797941u)));
    
    vec2 p = ((fragCoord - 0.75 + o*1.5) - iResolution.xy*0.5)  / iResolution.x;

    rd = mat3(t)*normalize(vec3(p, 0.4)); 
    ro = t[3].xyz;
}

bool isSpacePressed() {
    const float KEY_SP = 32.5/256.0;
    return bool(step(0.5, texture( iChannel3, vec2(KEY_SP, 0.5) ).x));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    fragColor = vec4(0.0);
    if (iFrame == 0 || isSpacePressed()) return;

    vec3 ro = vec3(0.0);
    vec3 rd = vec3(0.0);
    mat4 t = cameraTransform();
    
    int s = int(fragCoord.x *iResolution.x + fragCoord.y);
    cameraRay(fragCoord, t, s, ro, rd);
    vec3 c = pathTrace(ro, rd, s);

    fragColor = vec4(c, 0.0) + texelFetch(iChannel0, ivec2(fragCoord), 0);
}



