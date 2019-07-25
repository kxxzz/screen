// Basic PT
// Created by TinyTexel
// Creative Commons Attribution-ShareAlike 4.0 International Public License

/*
basic path tracing setup
camera controls via mouse + shift key
light controls via WASD/Arrow keys
*/

///////////////////////////////////////////////////////////////////////////
//=======================================================================//

#define Frame float(iFrame)
#define Time iTime
#define PixelCount iResolution.xy
#define OUT

/*
#define float2 vec2
#define float3 vec3
#define float4 vec4

#define saturate(x) clamp(x, 0.0, 1.0)
#define frac fract
/**/

#define lerp mix
#define rsqrt inversesqrt
#define clamp01(x) clamp(x, 0.0, 1.0)
#define If(cond, resT, resF) mix(resF, resT, cond)

const float Pi = 3.14159265359;
const float RcpPi = 1.0 / Pi;
const float Pi05 = Pi * 0.5;

float Pow2(float x) {return x*x;}
float Pow3(float x) {return x*x*x;}
float Pow4(float x) {return Pow2(Pow2(x));}

vec2 AngToVec(float ang)
{   
    return vec2(cos(ang), sin(ang));
}


vec3 AngToVec(vec2 ang)
{
    float sinPhi   = sin(ang.x);
    float cosPhi   = cos(ang.x);
    float sinTheta = sin(ang.y);
    float cosTheta = cos(ang.y);    

    return vec3(cosPhi * cosTheta, 
                         sinTheta, 
                sinPhi * cosTheta); 
}


float SqrLen(float v) {return v * v;}
float SqrLen(vec2  v) {return dot(v, v);}
float SqrLen(vec3  v) {return dot(v, v);}
float SqrLen(vec4  v) {return dot(v, v);}

float GammaDecode(float x) {return pow(x,      2.2) ;}
vec2  GammaDecode(vec2  x) {return pow(x, vec2(2.2));}
vec3  GammaDecode(vec3  x) {return pow(x, vec3(2.2));}
vec4  GammaDecode(vec4  x) {return pow(x, vec4(2.2));}

float GammaEncode(float x) {return pow(x,      1.0 / 2.2) ;}
vec2  GammaEncode(vec2  x) {return pow(x, vec2(1.0 / 2.2));}
vec3  GammaEncode(vec3  x) {return pow(x, vec3(1.0 / 2.2));}
vec4  GammaEncode(vec4  x) {return pow(x, vec4(1.0 / 2.2));}



// single iteration of Bob Jenkins' One-At-A-Time hashing algorithm:
//  http://www.burtleburtle.net/bob/hash/doobs.html
// suggested by Spatial on stackoverflow:
//  http://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl
uint BJXorShift(uint x) 
{
    x += x << 10u;
    x ^= x >>  6u;
    x += x <<  3u;
    x ^= x >> 11u;
    x += x << 15u;
    
    return x;
}


// xor-shift algorithm by George Marsaglia
//  https://www.thecodingforums.com/threads/re-rngs-a-super-kiss.704080/
// suggested by Nathan Reed:
//  http://www.reedbeta.com/blog/quick-and-easy-gpu-random-numbers-in-d3d11/
uint GMXorShift(uint x)
{
    x ^= x << 13u;
    x ^= x >> 17u;
    x ^= x <<  5u;
    
    return x;
}

// hashing algorithm by Thomas Wang 
//  http://www.burtleburtle.net/bob/hash/integer.html
// suggested by Nathan Reed:
//  http://www.reedbeta.com/blog/quick-and-easy-gpu-random-numbers-in-d3d11/
uint WangHash(uint x)
{
    x  = (x ^ 61u) ^ (x >> 16u);
    x *= 9u;
    x ^= x >> 4u;
    x *= 0x27d4eb2du;
    x ^= x >> 15u;
    
    return x;
}

//#define Hash BJXorShift
#define Hash WangHash
//#define Hash GMXorShift

// "floatConstruct"          | renamed to "ConstructFloat" here 
// By so-user Spatial        | http://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl
// used under CC BY-SA 3.0   | https://creativecommons.org/licenses/by-sa/3.0/             
// reformatted and changed from original to extend interval from [0..1) to [-1..1) 
//-----------------------------------------------------------------------------------------
// Constructs a float within interval [-1..1) using the low 23 bits + msb of an uint.
// All zeroes yields -1.0, all ones yields the next smallest representable value below 1.0. 
float ConstructFloat(uint m) 
{
    float flt = uintBitsToFloat(m & 0x007FFFFFu | 0x3F800000u);// [1..2)
    float sub = (m >> 31u) == 0u ? 2.0 : 1.0;
    
    return flt - sub;// [-1..1)             
}

vec2 ConstructFloat(uvec2 m) { return vec2(ConstructFloat(m.x), ConstructFloat(m.y)); }
vec3 ConstructFloat(uvec3 m) { return vec3(ConstructFloat(m.xy), ConstructFloat(m.z)); }
vec4 ConstructFloat(uvec4 m) { return vec4(ConstructFloat(m.xyz), ConstructFloat(m.w)); }


uint Hash(uint  v, uint  r) { return Hash(v ^ r); }
uint Hash(uvec2 v, uvec2 r) { return Hash(Hash(v.x , r.x ) ^ (v.y ^ r.y)); }
uint Hash(uvec3 v, uvec3 r) { return Hash(Hash(v.xy, r.xy) ^ (v.z ^ r.z)); }
uint Hash(uvec4 v, uvec4 r) { return Hash(Hash(v.xy, r.xy) ^ Hash(v.zw, r.zw)); }

// Pseudo-random float value in interval [-1:1).
float Hash(float v, uint  r) { return ConstructFloat(Hash(floatBitsToUint(v), r)); }
float Hash(vec2  v, uvec2 r) { return ConstructFloat(Hash(floatBitsToUint(v), r)); }
float Hash(vec3  v, uvec3 r) { return ConstructFloat(Hash(floatBitsToUint(v), r)); }
float Hash(vec4  v, uvec4 r) { return ConstructFloat(Hash(floatBitsToUint(v), r)); }


float HashFlt(uint   v, uint  r) { return ConstructFloat(Hash(v, r)); }
float HashFlt(uvec2  v, uvec2 r) { return ConstructFloat(Hash(v, r)); }
float HashFlt(uvec3  v, uvec3 r) { return ConstructFloat(Hash(v, r)); }
float HashFlt(uvec4  v, uvec4 r) { return ConstructFloat(Hash(v, r)); }

uint HashUInt(float v, uint  r) { return Hash(floatBitsToUint(v), r); }
uint HashUInt(vec2  v, uvec2 r) { return Hash(floatBitsToUint(v), r); }
uint HashUInt(vec3  v, uvec3 r) { return Hash(floatBitsToUint(v), r); }
uint HashUInt(vec4  v, uvec4 r) { return Hash(floatBitsToUint(v), r); }


struct Cam
{
    vec3 Front, Right, Up;
    float Aspect;
    float AxisLen;  
};

Cam NewCam(vec2 ang, float fov, float aspect)
{
    Cam cam;

    float sinPhi   = sin(ang.x);
    float cosPhi   = cos(ang.x);
    float sinTheta = sin(ang.y);
    float cosTheta = cos(ang.y);    

    cam.Front = vec3(cosPhi * cosTheta, 
                              sinTheta, 
                     sinPhi * cosTheta);

    cam.Right = vec3(-sinPhi, 0.0, cosPhi);
    cam.Up    = cross(cam.Right, cam.Front);

    cam.Aspect = aspect;
    cam.AxisLen = aspect * tan(Pi05 - fov * 0.5);

    return cam;
}

// tc [-1..1]
vec3 NewRay(Cam cam, vec2 tc)
{
    tc.x *= cam.Aspect;

    vec3 imgPos = cam.Front * cam.AxisLen + (cam.Right * tc.x + cam.Up * tc.y);
    
    vec3 dir = normalize(imgPos);

    return dir;
}

// tc [-1..1]
vec3 NewRay(Cam cam, vec2 tc, vec2 llp, float S1, out vec3 glp)
{
    tc.x *= cam.Aspect;

    vec3 imgPos = cam.Front + (cam.Right * tc.x + cam.Up * tc.y) / cam.AxisLen;
    
    glp = cam.Right * llp.x + cam.Up * llp.y;
    
    vec3 dir = normalize(imgPos * S1 - glp);

    return dir;
}

/*
IN:
    rp      : ray start position
    rd      : ray direction (normalized)
    
    cp      : cube position
    cth     : cube thickness (cth = 0.5 -> unit cube)
    
OUT:
    t       : distances to intersection points (negative if in backwards direction)

EXAMPLE:    
    vec2 t;
    float hit = Intersect_Ray_Cube(pos, dir, vec3(0.0), vec3(0.5), OUT t);
*/
float Intersect_Ray_Cube(
vec3 rp, vec3 rd, 
vec3 cp, vec3 cth, 
out vec2 t)
{   
    rp -= cp;
    
    vec3 m = 1.0 / -rd;
    vec3 o = If(lessThan(rd, vec3(0.0)), -cth, cth);
    
    vec3 uf = (rp + o) * m;
    vec3 ub = (rp - o) * m;
    
    t.x = max(uf.x, max(uf.y, uf.z));
    t.y = min(ub.x, min(ub.y, ub.z));
    
    // if(ray start == inside cube) 
    if(t.x < 0.0 && t.y > 0.0) {t.xy = t.yx;  return 1.0;}
    
    return t.y < t.x ? 0.0 : (t.x > 0.0 ? 1.0 : -1.0);
}

/*
[...]

OUT:
    n0 : normal for t.x
    n1 : normal for t.y

EXAMPLE:    
    vec2 t; vec3 n0, n1;
    float hit = Intersect_Ray_Cube(pos, dir, vec3(0.0), vec3(0.5), OUT t, n0, n1);
*/
float Intersect_Ray_Cube(
vec3 rp, vec3 rd, 
vec3 cp, vec3 cth, 
out vec2 t, out vec3 n0, out vec3 n1)
{   
    rp -= cp;
    
    vec3 m = 1.0 / -rd;
    vec3 os = If(lessThan(rd, vec3(0.0)), vec3(1.0), vec3(-1.0));
    //vec3 os = sign(-rd);
    vec3 o = -cth * os;
    
    
    vec3 uf = (rp + o) * m;
    vec3 ub = (rp - o) * m;
    
    //t.x = max(uf.x, max(uf.y, uf.z));
    //t.y = min(ub.x, min(ub.y, ub.z));
    
    if(uf.x > uf.y) {t.x = uf.x; n0 = vec3(os.x, 0.0, 0.0);} else 
                    {t.x = uf.y; n0 = vec3(0.0, os.y, 0.0);}
    if(uf.z > t.x ) {t.x = uf.z; n0 = vec3(0.0, 0.0, os.z);}
    
    if(ub.x < ub.y) {t.y = ub.x; n1 = vec3(os.x, 0.0, 0.0);} else 
                    {t.y = ub.y; n1 = vec3(0.0, os.y, 0.0);}
    if(ub.z < t.y ) {t.y = ub.z; n1 = vec3(0.0, 0.0, os.z);}
    
    
    // if(ray start == inside cube) 
    if(t.x < 0.0 && t.y > 0.0) 
    {
        t.xy = t.yx;  
        
        vec3 n00 = n0;
        n0 = n1;
        n1 = n00;
        
        return 1.0;
    }
    
    return t.y < t.x ? 0.0 : (t.x > 0.0 ? 1.0 : -1.0);
}

/*
IN:
    rp      : ray start position
    rd      : ray direction (normalized)
    
    sp2     : sphere position
    sr2     : sphere radius squared
    
OUT:
    t       : distances to intersection points (negative if in backwards direction)

EXAMPLE:    
    vec2 t;
    float hit = Intersect_Ray_Sphere(pos, dir, vec3(0.0), 1.0, OUT t);
*/
float Intersect_Ray_Sphere(
vec3 rp, vec3 rd, 
vec3 sp, float sr2, 
out vec2 t)
{   
    rp -= sp;
    
    float a = dot(rd, rd);
    float b = 2.0 * dot(rp, rd);
    float c = dot(rp, rp) - sr2;
    
    float D = b*b - 4.0*a*c;
    
    if(D < 0.0) return 0.0;
    
    float sqrtD = sqrt(D);
    // t = (-b + (c < 0.0 ? sqrtD : -sqrtD)) / a * 0.5;
    t = (-b + vec2(-sqrtD, sqrtD)) / a * 0.5;
    
    // if(start == inside) ...
    if(c < 0.0) t.xy = t.yx;

    // t.x > 0.0 || start == inside ? infront : behind
    return t.x > 0.0 || c < 0.0 ? 1.0 : -1.0;
}

/*
SOURCE: 
    "Building an Orthonormal Basis from a 3D Unit Vector Without Normalization"
        http://orbit.dtu.dk/files/126824972/onb_frisvad_jgt2012_v2.pdf
        
    "Building an Orthonormal Basis, Revisited" 
        http://jcgt.org/published/0006/01/01/
    
    - modified for right-handedness here
    
DESCR:
    Constructs a right-handed, orthonormal coordinate system from a given vector of unit length.

IN:
    n  : normalized vector
    
OUT:
    ox  : orthonormal vector
    oz  : orthonormal vector
    
EXAMPLE:
    float3 ox, oz;
    OrthonormalBasis(N, OUT ox, oz);
*/
void OrthonormalBasisRH(vec3 n, out vec3 ox, out vec3 oz)
{
    float sig = n.z < 0.0 ? 1.0 : -1.0;
    
    float a = 1.0 / (n.z - sig);
    float b = n.x * n.y * a;
    
    ox = vec3(1.0 + sig * n.x * n.x * a, sig * b, sig * n.x);
    oz = vec3(b, sig + n.y * n.y * a, n.y);
}

// s0 [-1..1], s1 [-1..1]
// samples spherical cap for s1 [cosAng05..1]
// samples hemisphere if s1 [0..1]
vec3 Sample_Sphere(float s0, float s1)
{
    float ang = Pi * s0;
    float s1p = sqrt(1.0 - s1*s1);
    
    return vec3(cos(ang) * s1p, 
                           s1 , 
                sin(ang) * s1p);
}

// s0 [-1..1], s1 [-1..1]
// samples spherical cap for s1 [cosAng05..1]
vec3 Sample_Sphere(float s0, float s1, vec3 normal)
{    
    vec3 sph = Sample_Sphere(s0, s1);

    vec3 ox, oz;
    OrthonormalBasisRH(normal, ox, oz);

    return (ox * sph.x) + (normal * sph.y) + (oz * sph.z);
}

// s0 [-1..1], s1 [-1..1]
vec3 Sample_Hemisphere(float s0, float s1, vec3 normal)
{
    vec3 smpl = Sample_Sphere(s0, s1);

    if(dot(smpl, normal) < 0.0)
        return -smpl;
    else
        return smpl;
}

// s0 [-1..1], s1 [0..1]
vec2 Sample_Disk(float s0, float s1)
{
    return vec2(cos(Pi * s0), sin(Pi * s0)) * sqrt(s1);
}

// s0 [-1..1], s1 [0..1]
vec3 Sample_ClampedCosineLobe(float s0, float s1)
{    
    vec2 d  = Sample_Disk(s0, s1);
    float y = sqrt(clamp01(1.0 - s1));
    
    return vec3(d.x, y, d.y);
}

// s0 [-1..1], s1 [0..1]
vec3 Sample_ClampedCosineLobe(float s0, float s1, vec3 normal)
{    
    vec2 d  = Sample_Disk(s0, s1);
    float y = sqrt(clamp01(1.0 - s1));

    vec3 ox, oz;
    OrthonormalBasisRH(normal, ox, oz);

    return (ox * d.x) + (normal * y) + (oz * d.y);
}

// s [-1..1]
float Sample_Triangle(float s) 
{ 
    float v = 1.0 - sqrt(abs(s));
    
    return s < 0.0 ? -v : v; 
}

#define KEY_LEFT  37
#define KEY_UP    38
#define KEY_RIGHT 39
#define KEY_DOWN  40

#define KEY_SHIFT 0x10
#define KEY_A 0x41
#define KEY_D 0x44
#define KEY_S 0x53
#define KEY_W 0x57

#define KeyBoard iChannel1

float ReadKey(int keyCode) {return texelFetch(KeyBoard, ivec2(keyCode, 0), 0).x;}


#define VarTex iChannel0
#define OutCol outCol
#define OutChannel w

#define WriteVar(v, cx, cy) {if(uv.x == float(cx) && uv.y == float(cy)) OutCol.OutChannel = v;}
#define WriteVar4(v, cx, cy) {WriteVar(v.x, cx, cy) WriteVar(v.y, cx, cy + 1) WriteVar(v.z, cx, cy + 2) WriteVar(v.w, cx, cy + 3)}

float ReadVar(int cx, int cy) {return texelFetch(VarTex, ivec2(cx, cy), 0).OutChannel;}
vec4 ReadVar4(int cx, int cy) {return vec4(ReadVar(cx, cy), ReadVar(cx, cy + 1), ReadVar(cx, cy + 2), ReadVar(cx, cy + 3));}

//=======================================================================//
///////////////////////////////////////////////////////////////////////////


float Intersect_Scene(
vec3 rp, vec3 rd,
out float t, out vec3 n, out vec3 a)
{
     float hit;
   
    {
        vec2 tt; vec3 n0, n1;
        float th = Intersect_Ray_Cube(rp, rd, vec3(0.0, -0.8, 0.0), vec3(1.5, 0.05, 1.5), OUT tt, n0, n1);
      
        hit = th > 0.0 ? 1.0 : 0.0;
        t = tt.x;
        n = n0;
        a = vec3(1.0, 0.005, 0.005) * 0.8;
    }
    
    {
        vec2 tt;
        float th = Intersect_Ray_Sphere(rp, rd, vec3(0.0), 0.5, OUT tt);
        
        if(th > 0.0)
        if(hit <= 0.0 || tt.x < t)
        {
            t = tt.x;
            n = normalize(rp + rd * tt.x);
            a = vec3(1.0);
            
            hit = 1.0;
        }
    }
    
    return hit;
}



void mainImage( out vec4 outCol, in vec2 uv0 )
{     
    vec2 uv = uv0.xy - 0.5;
    vec2 tex = uv0.xy / PixelCount;
    vec2 tex21 = tex * 2.0 - vec2(1.0);
    
    vec4 mouseAccu  = ReadVar4(1, 0);
    vec4 wasdAccu   = ReadVar4(2, 0);
    float frameAccu = ReadVar (3, 0);

    vec2 ang = vec2(Pi * 0.3, -Pi * 0.02);
    ang += mouseAccu.xy * 0.008;

    Cam cam = NewCam(ang, Pi * 0.5, PixelCount.x / PixelCount.y);
    //vec3 cpos = -cam.Front * 2.5;
    float cdist = exp2(1.2 + mouseAccu.w * 0.02);
    vec3 cpos = -cam.Front * cdist;

    float fId = frameAccu * 1.64683 + 0.84377;
    
    vec3 pxId  = vec3(frameAccu, uv); 
         pxId *= vec3( 0.76032, 1.47035, 0.92526); 
         pxId += vec3(-0.69060, 0.02293, 0.68109);
    
    uint hh = HashUInt(pxId, uvec3(0xB8D3E97Cu, 0x736D370Fu, 0xA7D00135u));
    
    {
        vec2 off;
        {
            float h0 = Hash(fId, 0xAF609A13u);
            float h1 = Hash(fId, 0xE0ABC868u);
        
            //off = vec2(h0, h1) * 0.5;
            off = vec2(Sample_Triangle(h0), Sample_Triangle(h1));
        }
                      
        tex21 = (uv0.xy + off) / PixelCount * 2.0 - vec2(1.0);
    }
    
    vec2 llp;// local sample pos on lens
    {
        float h0 = HashFlt(hh, 0x27BB116Bu);
        float h1 = HashFlt(hh, 0x11A95B42u);
        h1 = clamp01(h1 * 0.5 + 0.5);

        llp = Sample_Disk(h0, h1);
        llp *= 0.05;
    }
    
    vec3 glp;// global sample pos on lens
    float S1 = cdist - 0.0;// set sphere sharp
    vec3 rdir = NewRay(cam, tex21, llp, S1, OUT glp);
    
    /*/
    {
        float h0 = HashFlt(hh, 0xB0D4379Bu);
        float h1 = HashFlt(hh, 0xBD134DF6u);
        h1 = clamp01(h1 * 0.5 + 0.5);
        
        h1 = pow(h1, 32.0);
        h1 = 1.0 - h1;   
        
        h1 = mix(0.0, 1.0, h1);
     
        
        rdir = Sample_Sphere(h0, h1, rdir);
    }
    /**/
    
    vec2 lightAng = vec2(Pi * 0.7, Pi * 0.2);
    lightAng.x += (wasdAccu.y - wasdAccu.w) * 0.06; 
    lightAng.y += (wasdAccu.x - wasdAccu.z) * 0.04;    
    
    vec3 light0 = AngToVec(lightAng);
    vec3 light = light0;
    {
        float h0 = HashFlt(hh, 0x9E2355B4u);
        float h1 = HashFlt(hh, 0xDC305E12u);
        h1 = clamp01(h1 * 0.5 + 0.5);
        
        h1 = mix(0.999, 1.0, h1);
        
        light = Sample_Sphere(h0, h1, light);
    }
    
    
    vec3 pot = vec3(1.0);
    vec3 col = vec3(0.0);
    
    float t; vec3 n; vec3 a;
    vec3 pos = cpos + glp;
    vec3 dir = rdir;

    for(float i = 0.0; i < 4.0; ++i)
    {
        
    if(Intersect_Scene(pos, dir, OUT t, n, a) > 0.0)
    {
        vec3 p = pos + dir * t;

        pot *= a;
        
        float sh;
        {
            float t2; vec3 n2; vec3 a2;
            sh = Intersect_Scene(p + n * 0.0001, light, OUT t2, n2, a2);
            sh = 1.0 - sh;
        }
        
        col += pot * clamp01(dot(light, n)) * sh * 1.0;// * RcpPi;// impl scale prim light E by Pi
        
        pos = p + n * 0.0001;
        {
            float h0 = HashFlt(hh, 0x874C40D4u);
            float h1 = HashFlt(hh, 0xF27BD7E1u);
            //dir = normalize(Sample_Sphere(h0, h1) + n);
            h1 = clamp01(h1 * 0.5 + 0.5);
            
            dir = Sample_ClampedCosineLobe(h0, h1, n);
        }
        
    } 
    else 
    {
        col += pot * (textureLod(iChannel2, dir, 0.0).rgb);//* 0.1;
        
        if(i == 0.0 && dot(light0, dir) > 0.999) col += vec3(1.0);
        
        break;
    }
        
        hh = Hash(hh);
    }
    
    
    vec3 colLast = textureLod(iChannel0, tex, 0.0).rgb;
    
    col = mix(colLast, col, 1.0 / (frameAccu + 1.0));    
    
    outCol = vec4(col, 0.0);
    
    
    {
        vec4 iMouseLast     = ReadVar4(0, 0);
        vec4 iMouseAccuLast = ReadVar4(1, 0);
        vec4 wasdAccuLast   = ReadVar4(2, 0);
        float frameAccuLast = ReadVar (3, 0);


        bool shift = ReadKey(KEY_SHIFT) != 0.0;

        float kW = ReadKey(KEY_W);
        float kA = ReadKey(KEY_A);
        float kS = ReadKey(KEY_S);
        float kD = ReadKey(KEY_D);

        float left  = ReadKey(KEY_LEFT);
        float right = ReadKey(KEY_RIGHT);
        float up    = ReadKey(KEY_UP);
        float down  = ReadKey(KEY_DOWN);
        
        
        bool anyK = false;
        
        anyK = anyK || iMouse.z > 0.0;
        anyK = anyK || shift;
        anyK = anyK || kW != 0.0;
        anyK = anyK || kA != 0.0;
        anyK = anyK || kS != 0.0;
        anyK = anyK || kD != 0.0;
        anyK = anyK || left  != 0.0;
        anyK = anyK || right != 0.0;
        anyK = anyK || up    != 0.0;
        anyK = anyK || down  != 0.0;
        
        
        frameAccuLast += 1.0;
        if(anyK) frameAccuLast = 0.0;
        

        vec4 wasdAccu = wasdAccuLast;
        wasdAccu += vec4(kW, kA, kS, kD);
        wasdAccu += vec4(up, left, down, right);        

        
        vec2 mouseDelta = iMouse.xy - iMouseLast.xy;

        bool cond0 = iMouse.z > 0.0 && iMouseLast.z > 0.0;
        vec2 mouseDelta2 = cond0 && !shift ? mouseDelta.xy : vec2(0.0);
        vec2 mouseDelta3 = cond0 &&  shift ? mouseDelta.xy : vec2(0.0);

        vec4 iMouseAccu = iMouseAccuLast + vec4(mouseDelta2, mouseDelta3);

        
        WriteVar4(iMouse,        0, 0);
        WriteVar4(iMouseAccu,    1, 0);
        WriteVar4(wasdAccu,      2, 0);
        WriteVar (frameAccuLast, 3, 0);
    }
}



