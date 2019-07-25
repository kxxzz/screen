#define BOUNCES 6

#define MAX_STEPS 100

#define MAX_DISTANCE 30.0
#define EPSILON .01
#define EPSILON_NORMAL .001

// iq
float hash(float seed)
{
    return fract(sin(seed)*43758.5453 );
}

// Projected into 1D, multiplying PI by some prime and using as axis
float hash2D(vec2 x)
{
    float i = dot(x, vec2(123.4031, 46.5244876));
    return fract(sin(i * 7.13) * 268573.103291);
}
 
float hash3D(vec3 x)
{
    float i = dot(x, vec3(123.4031, 46.5244876, 91.106168));
    return fract(sin(i * 7.13) * 268573.103291);
}

// hg
float vmax(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

// hg
float fBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
} 

// hg
float vmax(vec2 v) {
    return max(v.x, v.y);
}

// hg
float fBox2Cheap(vec2 p, vec2 b) {
    return vmax(abs(p)-b);
}

// hg
float fBox2(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0))) + vmax(min(d, vec2(0)));
}

// hg
float fCapsule(vec3 p, float r, float c) {
    return mix(length(p.xz) - r, length(vec3(p.x, abs(p.y) - c, p.z)) - r, step(c, abs(p.y)));
}

// hg
float fCylinder(vec3 p) {
    float d = length(p.xz) - .5;
    d = max(d, abs(p.y) - 1.0);
    return d * .5;
}

vec3 domainRepeat(vec3 p, vec3 size)
{
    return mod(abs(p) + size * .5, size) - size * .5;
}

float domainRepeat1D(float p, float size)
{
    return mod(abs(p) + size * .5, size) - size * .5;
}

// hg
vec2 pModPolar(vec2 p, float repetitions) {
    float angle = 2.0 * 3.1415 / repetitions;
    float a = atan(p.y, p.x) + angle/2.;
    float r = length(p);
    float c = floor(a/angle);
    a = mod(a,angle) - angle/2.;
    return vec2(cos(a), sin(a))*r;
}

// From https://www.shadertoy.com/view/ltXBz8
vec3 SphereRand( uint seed )
{
    float a = (float((seed*0x73493U)&0xfffffU)/float(0x100000))*2. - 1.;
    float b = 6.283*(float((seed*0xAF71fU)&0xfffffU)/float(0x100000));
    float cosa = sqrt(1.-a*a);
    return vec3(cosa*cos(b),a,cosa*sin(b));
}

vec3 HemisphereRand( vec3 a, uint seed )
{
    vec3 r = SphereRand(seed);
    return dot(r,a) > .0 ? r : -r;
}

// hg
void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

vec3 rdX(vec3 p)
{
    return vec3(p.x, p.z, -p.y);
}

vec3 rdY(vec3 p)
{
    return vec3(-p.z, p.y, p.x);
}

vec3 rdZ(vec3 p)
{
    return vec3(-p.y, p.x, p.z);
}

// hg
float fCylinder(vec3 p, float r, float height) {
    float d = length(p.xz) - r;
    d = max(d, abs(p.y) - height);
    return d;
}

// ----------------------------------------------------------

const mat4 tr[3] = mat4[3](
    mat4(1.0, .0, .0, .0, .0, .0, -1.0, .0, .0, 1.0, .0, .0, .0, .0, .0, 1.0),
    mat4(.0, -1.0, .0, .0, 1.0, .0, .0, .0, .0, .0, 1.0, .0, .21, .13, 1.08, 1.0),
    mat4(-.493, -.87, .0, .0, .87, -.493, .0, .0, .0, .0, 1.0, .0, .257, .539, 1.08, 1.0)
);

// Built with https://github.com/mmerchante/sdf-gen-unity
float sdf(vec3 p)
{
    vec3 wsPos = vec3(.0,.0,.0);
    vec4 a0 = vec4(p, 1.0);
    a0.xz = abs(a0.xz) * vec2(-1.0,1.0);
    vec4 a1 = a0 - vec4(6.24,.0,2.5,.0);
    a1.xz = pModPolar(a1.xz , 4.0);
    float d1 = dot(a1.xyz - vec3(11.49,.0,.0), vec3(-1.0,.0,.0));
    vec4 a2 = a1 - vec4(11.02,2.15,7.28,.0);
    a2.z = domainRepeat1D(a2.z , 2.0);
    vec4 a3 = a2;
    wsPos = a3.xyz - vec3(-2.64,5.05,.0);
    float d3 = fBox(wsPos,vec3(.5,.5,.228));
    wsPos = a3.xyz - vec3(-2.275,5.05,.0);
    d3 = min(d3,fBox(wsPos,vec3(.383,.383,.175)));
    wsPos = a3.xyz - vec3(-2.64,6.97,.0);
    d3 = min(d3,fBox(wsPos,vec3(.5,.283,.111)));
    wsPos = a2.xyz - vec3(-1.28,6.38,.287);
    float d2 = max(-d3,fBox(wsPos,vec3(1.5,1.893,6.673)));
    d1 = min(d1,d2);
    vec4 a4 = a1 - vec4(9.18,-4.5,-.032,.0);
    a4.y = domainRepeat1D(a4.y , 4.5);
    vec4 a5 = a4;
    a5.z = domainRepeat1D(a5.z , 2.5);
    vec4 a6 = a5;
    a6.x = -a6.x;
    vec4 a7 = a6;
    vec4 a8 = a7 - vec4(.05,-.62,.0,.0);
    a8.xyz = rdZ(a8.xyz);
    wsPos = a8.xyz;
    float d8 = (fCylinder(wsPos, 1.398,1.361)*.75);
    wsPos = a8.xyz - vec3(.0,.152,.0);
    d8 = max(-d8,(fCylinder(wsPos, 1.434,.531)*.75));
    wsPos = a7.xyz - vec3(.786,.46,.0);
    float d7 = max(d8,fBox(wsPos,vec3(.523,.747,1.415)));
    vec4 a9 = a6;
    wsPos = a9.xyz - vec3(.47,1.953,.0);
    float d9 = fBox(wsPos,vec3(.5,.075,1.5));
    wsPos = a9.xyz - vec3(.58,2.03,.0);
    d9 = min(d9,fBox(wsPos,vec3(.5,.075,1.5)));
    vec4 a10 = a9 - vec4(.463,-.51,1.179,.0);
    a10.z = domainRepeat1D(a10.z , 2.35);
    wsPos = a10.xyz;
    float d10 = fBox(wsPos,vec3(.24,.033,.24));
    wsPos = a10.xyz - vec3(.0,-.093,.0);
    d10 = min(d10,fBox(wsPos,vec3(.24,.033,.24)));
    wsPos = a10.xyz - vec3(-2.8,-.03,.0);
    d10 = min(d10,fBox(wsPos,vec3(.25,.075,.25)));
    vec4 a11 = a10;
    a11.xz = pModPolar(a11.xz , 8.0);
    wsPos = a11.xyz - vec3(.002,-1.07,.0);
    float d11 = fBox(wsPos,vec3(.17,1.053,.424));
    d10 = min(d10,d11);
    d9 = min(d9,d10);
    vec4 a12 = a9 - vec4(-1.03,-.518,.0,.0);
    vec4 a13 = a12;
    a13.xyz = rdZ(a13.xyz);
    wsPos = (tr[0] * a13).xyz;
    float d13 = fCylinder(wsPos, 1.225,3.0);
    wsPos = a13.xyz;
    d13 = min(d13,fCylinder(wsPos, 1.094,2.061));
    wsPos = a12.xyz - vec3(.12,1.27,.0);
    float d12 = max(-d13,fBox(wsPos,vec3(1.5,1.355,1.551)));
    d9 = min(d9,d12);
    float d6 = min(d7,d9);
    vec4 a14 = a6 - vec4(.463,1.57,1.61,.0);
    wsPos = (tr[1] * a14).xyz;
    float d14 = fCylinder(wsPos, .105,.046);
    wsPos = (tr[2] * a14).xyz;
    d14 = min(d14,fCylinder(wsPos, .025,.582));
    d6 = min(d6,d14);
    float d5 = d6;
    float d4 = d5;
    d1 = min(d1,d4);
    float d0 = min(d1,dot(a0.xyz - vec3(.0,-2.0,.0), vec3(.0,1.0,.0)));
    d0 = min(d0, length(p - vec3(0.0, .35, .0)) - 1.5);
    d0 = min(d0, -(p.y - 11.15));
    return d0;
}

vec3 sdfNormal(vec3 p)
{
    float s = sdf(p);
    vec3 eps = vec3(EPSILON_NORMAL, -EPSILON_NORMAL, 0.0);    
    float dX = s - sdf(p + eps.yzz);
    float dY = s - sdf(p + eps.zyz);
    float dZ = s - sdf(p + eps.zzy);
    return normalize(vec3(dX,dY,dZ));
}

// ----------------------------------------------------------
struct Intersection
{
    float totalDistance;
    float mediumDistance;
    float sdf;
    float density;
    int materialID;
};

struct Camera
{
    vec3 origin;
    vec3 direction;
};

Camera GetCamera(vec2 uv, float zoom, float time)
{
    float dist = 6.5;
    
    vec3 target = vec3(0.4, 2.0, 0.0);
    vec3 p = vec3(0.4, -.75, -10.0);
    
    float sa = hash(hash2D(uv) + 1113.1*time);
    vec2 offset = -0.5 + vec2( hash(sa+13.271), hash(sa+63.216));
    offset *= .125;

    vec3 forward = normalize(target - p);
    vec3 left = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(forward, left));

    Camera cam;   
    cam.origin = p;
    cam.direction = normalize(forward - left * uv.x * zoom - up * uv.y * zoom);
        
    // Intersect focal plane
    float d = 10.0 / dot(cam.direction, forward);
    vec3 focalPoint = cam.origin + (cam.direction * d);

    cam.origin += (left * offset.x) + (up * offset.y);
    cam.direction = normalize(focalPoint - cam.origin);
        
    return cam;
}

int BounceFrame(int frame)
{
    return frame % BOUNCES;
}

void Bounce(int frame, inout Camera camera, inout vec3 normal)
{
    normal = sdfNormal(camera.origin);
    camera.origin += normal * EPSILON * 2.0;
    
    if(length(camera.origin - vec3(0.0, .35, .0)) < 1.75)
        camera.direction = reflect(camera.direction, normal);
    else
        camera.direction = HemisphereRand(normal, uint(hash3D(camera.origin) * 23248765.0) + uint(frame));    
}

void RebuildFrame(int frame, vec4 rawData, inout Camera camera, inout vec3 normal)
{
    int frameBounce = BounceFrame(frame);
    
    if(frameBounce > 0)
    {        
        if(frameBounce > 1)
        {
            // Jump once
            camera.origin = rawData.yzw;
            Bounce(frame, camera, normal);
        }
        
        camera.origin = camera.origin + camera.direction * rawData.r;
        Bounce(frame, camera, normal);
    }    
}

void EvaluateBRDF(vec3 wo, vec3 wi, vec3 normal, vec3 p, inout vec3 totalEnergy, inout float throughput)
{
    // Some rays end too far from the geo, so just assume it is losing some energy
    if(sdf(p) > EPSILON * 2.0)
    {
        throughput *= .15;
        return;
    }
    
    float brdf = max(0.0, dot(normal, wi));    
    brdf = mix(brdf, 1.0, step(length(p), 2.2));
    
    vec3 emission = vec3(1.3, .7, .4) * step(7.0, p.y) * smoothstep(1.75, 2.5, p.x) * 3.0;
    emission = mix(emission, vec3(.1, .3, 1.0), step(11.0, p.y));

    totalEnergy += throughput * emission;
    throughput *= brdf;
}
