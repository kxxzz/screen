// Sponza with WASD camera. Move around!
// I optimized my previous sponza sdf, although it's even less legible now.
// Some of the tricks I used can be seen through some of the artifacts.
#define MAX_STEPS 60
#define MAX_STEPS_F float(MAX_STEPS)

#define MAX_DISTANCE 30.0
#define MIN_DISTANCE 0.25
#define EPSILON .01
#define EPSILON_NORMAL .01

// Remove if you want fullscreen :)
#define CINEMATIC_BARS

// Play with the amount of lights
#define CELL_SIZE 2.0

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
float fCylinder(vec3 p) {
    float d = length(p.xz) - .5;
    d = max(d, abs(p.y) - 1.0);
    return d;
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

// A shorter, uglier but faster version of https://www.shadertoy.com/view/XddBD2
float sdf(vec3 p)
{
    vec3 a0 = p;
    a0.xz = abs(a0.xz) * vec2(-1.0,1.0);
    vec3 a1 = a0 - vec3(6.24,.0,2.5);
    a1.xz = pModPolar(a1.xz, 4.0);    
    float d1 = -(a1 - vec3(11.49,.0,.0)).x;    
    vec3 a2 = a1 - vec3(11.02,2.15,7.28);
    a2.z = domainRepeat1D(a2.z, 2.0);
    float d3 = fBox(a2 - vec3(-2.64,5.05,.0),vec3(.5,.5,.228));
    d3 = min(d3,fBox(a2 - vec3(-2.275,5.05,.0),vec3(.383,.383,.175)));
    d3 = min(d3,fBox(a2 - vec3(-2.64,6.97,.0),vec3(.5,.283,.111)));
    float d2 = max(-d3,fBox(a2 - vec3(-1.28,6.38,.287),vec3(1.5,1.893,6.673)));
    vec3 a4 = a1 - vec3(9.18,-4.5,-.032);
    a4.y = domainRepeat1D(a4.y, 4.5);
    vec3 a5 = vec3(a4.x, a4.y, domainRepeat1D(a4.z, 2.5));
    vec3 a6 = vec3(-a5.x, a5.y, a5.z);
    vec3 a8 = rdZ(a6 - vec3(.05,-.62,.0));
    float d8 = (fCylinder(a8, 1.398,1.361)*.75);
    d8 = max(-d8,(fCylinder(a8 - vec3(.0,.152,.0), 1.434,.531)*.75));
    float d7 = max(d8,fBox(a6 - vec3(.786,.46,.0),vec3(.523,.747,1.415)));
    float d9 = fBox(a6 - vec3(.47,1.953,.0),vec3(.5,.075,1.5));
    d9 = min(d9,fBox(a6 - vec3(.58,2.2,.0),vec3(.5,.1,1.5)));
    d9 = min(d9,fBox(a6 - vec3(-.45,-2.3,.0),vec3(1.5,.1,1.5)));
    vec3 a10 = a6 - vec3(.463,-.51,1.179);
    a10.z = domainRepeat1D(a10.z, 2.35);
    float d10 = fBox(a10,vec3(.24,.033,.24));
    d10 = min(d10,fBox(a10 - vec3(.0,-.093,.0),vec3(.24,.033,.24)));
    d10 = min(d10,fBox(a10 - vec3(-2.8,-.03,.0),vec3(.25,.075,.25)));
    vec3 a11 = vec3(a10.y, pModPolar(a10.xz , 8.0)).yxz;
    float d11 = fBox(a11 - vec3(.002,-1.07,.0),vec3(.17,1.053,.424));
    vec3 a12 = a6 - vec3(-1.03,-.518,.0);
    vec3 a13 = rdZ(a12);    
    float d13 = fCylinder(vec3(a13.x, -a13.z, a13.y), 1.225,3.0);
    d13 = min(d13,fCylinder(a13, 1.094,2.061));
    float d12 = max(-d13,fBox(a12 - vec3(.12,1.27,.0),vec3(1.5,1.355,1.551)));
    vec3 a14 = a6 - vec3(.463,1.57,1.61);    
    float d14 = fCylinder(vec3(a14.y, -a14.x, a14.z) - vec3(-.19, -.13, -1.08), .105,.046);    
    vec3 polePos = vec3(-a14.y, a14.x, a14.z) - vec3(.042, .596, -1.08);
    polePos.xy += 0.3428 * vec2(polePos.y, -polePos.x);
    d14 = min(d14,fCylinder(polePos, .025,.582));
    return min(min(min(d1,d2),min(min(d7,min(min(d9,min(d10,d11)),d12)),d14)),(a0 - vec3(.0,-2.0,.0)).y);
}

// iq and Paul Malin, tetrahedron (http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm)
vec3 sdfNormal(vec3 p, float epsilon)
{
    float h = epsilon; // or some other value
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*sdf(p + k.xyy*h) + 
                      k.yyx*sdf(p + k.yyx*h) + 
                      k.yxy*sdf(p + k.yxy*h) + 
                      k.xxx*sdf(p + k.xxx*h) );
}

vec3 hash33(vec3 p3)
{
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

vec3 Render(Ray ray, Intersection isect, vec2 uv)
{
    vec3 pos = ray.origin + ray.direction * isect.totalDistance;
    vec3 original = pos;
    vec3 normal = sdfNormal(pos, EPSILON_NORMAL);
   
    vec3 outColor = vec3(0.0);
    float cellSize = CELL_SIZE;
    
    pos += iTime * .5;
    
    vec3 fP = floor(pos / cellSize);
    ivec3 from = ivec3(fP) - ivec3(1);
    ivec3 to = ivec3(fP) + ivec3(1);
    
    for(int x = from.x; x <= to.x; ++x)
    {
        for(int y = from.y; y <= to.y; ++y)
        {
            for(int z = from.z; z <= to.z; ++z)
            {
                vec3 cellPos = vec3(x,y,z) * cellSize;
                
                vec3 lightPos = cellPos + vec3(cellSize * .5) + hash33(cellPos) * cellSize * .5;
                vec3 toLight = lightPos - pos;
                vec3 lightDir = normalize(toLight);
                float atten = 1.0 - clamp(length(toLight) / cellSize, 0.0, 1.0);

                float diffuse = max(0.0, dot(lightDir, normal) * .75 + .25) * atten;
                
                vec3 lightColor = hash33(cellPos * 123.0) * 1.5;
                
                outColor += lightColor * diffuse;
            }
        }   
    }
    

    return outColor;
}

Intersection Raymarch(Ray ray)
{    
    Intersection outData;
    outData.sdf = 0.0;
    outData.totalDistance = MIN_DISTANCE;
        
    for(int j = 0; j < MAX_STEPS; ++j)
    {
        vec3 p = ray.origin + ray.direction * outData.totalDistance;
        outData.sdf = sdf(p);
        outData.totalDistance += outData.sdf;

        if(outData.sdf < EPSILON || outData.totalDistance > MAX_DISTANCE)
            break;
    }
    
    return outData;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 rawUV = fragCoord / iResolution.xy;
    vec2 uv = (-iResolution.xy + (fragCoord*2.0)) / iResolution.y;   
    fragColor = vec4(0.0);
    
    #ifdef CINEMATIC_BARS
    if(abs(uv.y) > .75)
        return;
    #endif
    
    Camera cam = LoadCamera(iChannel0);    
    Ray ray = GetRay(cam, uv, .5, iTime);
    Intersection isect = Raymarch(ray);
    vec3 color = Render(ray, isect, uv);
    fragColor = vec4(color, 1.0);
}

