//#define FIXEDFRAMETIME
#define FRAMETIME 1./30.
#define MAXRAYS 50
#define MAXBOUNCES 5
#define PI 3.142
#define SQRT2 1.4143
#define INF 100000.0
#define BRIGHTNESS 0.5

#define kZENITHCOLOUR vec4(0.3, 0.7, 1.0, 5.0)
#define kNADIRCOLOUR vec4(0.7, 0.6, 0.4, 0.0)
#define kHORIZONCOLOUR vec4(0.7,0.8,0.95,3.0)
#define kSUNSIZE 0.3
#define kSUNCOLOUR vec4(1.0, 0.9, 0.7, 10.0)

#define R(p,a) p=cos(a)*p+sin(a)*vec2(-p.y,p.x);
    
struct Ray {
    vec3 origin;
    vec3 dir;
};

// A camera. Has a position and a direction. 
struct Camera {
    vec3 pos;
    Ray ray;
};

struct Sphere {
    vec3 pos;
    float radius;
};
    
struct Box {
    vec3 mi;
    vec3 ma;
};

struct Bounds {
    vec3 minimum;
    vec3 maximum;
};

struct Plane {
    vec3 n; // normal
    float d; // distance from origin
};
        
struct Triangle {
    vec3 v0, edgeA, edgeB, n;
};

struct HitTest {
    float dist;
    vec3 normal;
    vec3 val;
};

struct SceneResult {
    float dist;
    vec3 normal;
    vec4 col;
    float ref;
    float gloss;
};
    
float divergence;
    
#define NOHIT HitTest(INF, vec3(0), vec3(0.0))

bool intersectBox(in Ray r, in Box b, inout HitTest test) {
    vec3 size = b.ma - b.mi;
    
    vec3 dA = (r.origin - b.mi) / -r.dir;
    vec3 dB = (r.origin - b.ma) / -r.dir;
    
    vec3 minD = min(dA, dB); // -
    vec3 maxD = max(dA, dB); // +
    
    float tmin = minD.x;
    float tmax = maxD.x;
    
    if (tmin > maxD.y || tmax < minD.y) return false;
    
    tmin = max(tmin, minD.y); //-
    tmax = min(tmax, maxD.y); //+
               
    if (tmin > maxD.z || tmax < minD.z) return false;
    
    tmin = max(tmin, minD.z); //-
    float insideScaling = sign(tmin);
    
    tmin = tmin <= 0.0 ? INF : tmin; //+
    
    tmax = min(tmax, maxD.z); //+
    tmax = tmax < 0.0 ? INF : tmax; //+
    float testVal = tmax;
    float d = min(tmin, tmax);// tmax
    
    float f = step(0.0, -d);
    d = d * (1.-f) + (f * INF);
    if (d > test.dist) return false;
    
    dA -= d;
    dB -= d;
    
    dA = step(vec3(0.001), abs(dA));
    dB = step(vec3(0.001), abs(dB));
    
    vec3 n = dA + -dB;
    
    test.dist = d;
    test.normal = n * insideScaling;
    
    return true;
}

bool intersectSphere(in Ray r, in Sphere s, inout HitTest test) {
    vec3 o = r.origin - s.pos;
    float v = dot(o, r.dir);
    if(v > 0.) return false;
    
    float disc = (s.radius * s.radius) - (dot(o, o) - (v * v));
    
    if(disc < 0.) return false;
    
    float q = sqrt(disc);
    float dist = length(o);
    float d = dist-q;
    
    //float f = step(0.0, -d);
    //d = d * (1.-f) + (f * INF);
    if (d > test.dist) { return false; }
    
    test.dist = d;
    test.normal = ((r.origin + (r.dir * d)) - s.pos) / s.radius;
    return true;
}

bool intersectPlane(in Ray r, in Plane p, inout HitTest test) {
    // Intersect plane
    float a = dot(r.dir, p.n);
    
    float d = -(dot(r.origin, p.n) + p.d) / a;
    
    float f = step(0.0, -d);
    d = d * (1.-f) + (f * INF);
    
    if (d < test.dist) {
        test.dist = d;
        test.normal = p.n * -sign(a);
        return true;
    }
    return false;   
}

bool intersectTriangle(in Ray r, in Triangle t, inout HitTest test) {
    
    vec3 pvec = cross(r.dir, t.edgeB);
    float det = dot(t.edgeA, pvec);
    if ((det) < 0.001) return false;
    
    float iDet = 1./det;
    
    vec3 tvec = r.origin - t.v0;
    float u = dot(tvec, pvec) * iDet;
    float inside = step(0.0, u) * (1.-step(1.0, u));
    
    vec3 qvec = cross(tvec, t.edgeA);
    float v = dot(r.dir, qvec) * iDet;
    inside *= step(0.0, v) * (1. - step(1., u+v));
    if (inside == 0.0) return false;
    
    float d = dot(t.edgeB, qvec) * iDet;
    
    float f = step(0.0, -d);
    d = d * (1.-f) + (f * INF);    
    if (d > test.dist) { return false; }
    
    test.dist = d;
    test.normal = t.n * sign(det);//((s.n0 * u) + (s.n1 * v) + (s.n2 * (1. - (u + v)))) * -sign(a);
    //test.val = vec3(u, v, 1. - (u+v));
    
    return true;
}

float nrand(in vec2 n) {
    return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}

vec3 trand(in vec2 n) {
    return texture(iChannel0, n).rgb;
}

vec4 skyCol(in Ray r) {
 // Declare a horizon and extremity (either zenith or nadir)
   // return texture(iChannel1, r.dir);
    return mix(vec4(0.7,0.8,1,0.3), vec4(1,0.9,0.8,1), r.dir.y);
    vec4 base, extremity, texture;
    float x = smoothstep(0.0,1.0,abs(r.dir.y));
    
    if (r.dir.y >= 0.0) {
        // sky: fake as hell clouds
        base = mix(kHORIZONCOLOUR, kZENITHCOLOUR, x);
        texture = vec4(1);
        float cloudFactor = 0.0;
        
        vec2 coord = r.dir.xz / 8.0;
        float scale = 1.0;
        cloudFactor /= 1.5;
        vec4 cloud = mix(vec4(0.4), vec4(1), cloudFactor);
        base = mix(base, cloud, cloudFactor * r.dir.y * r.dir.y);
        
         float sun = distance(r.dir, normalize(vec3(0.6,1., 0.3)));
         sun = 1. - smoothstep(kSUNSIZE, kSUNSIZE * 1.1, sun);
        base.a *= 0.3;
         base = mix(base, kSUNCOLOUR , sun); //
        
    }
    base.rgb *= base.a;
    return base;
}

SceneResult intersectScene(in Ray r, in float t) {
    SceneResult s;
    s.ref = 0.0;
    s.gloss = 0.0;
    
    HitTest test = NOHIT;
    
    if (intersectBox(r, Box(vec3(-20,0,-20), vec3(20,20,20)), test)) {
        // Room
        vec3 op = r.origin+r.dir*test.dist;
        
        float y = step(19.9, op.y);
        vec2 chk = floor(op.xz*0.2);
        chk = mod(chk, 2.0);
        float st = step(0.1, op.y);
        float c = st + mod(chk.x+chk.y, 2.) * (1. - st);
        
        s.col.rgb = mix(vec3(0.8) * c, vec3(1., 0.95, 0.9), y);
        s.col.a = y*3.;     
    }
    
    if (intersectSphere(r, Sphere(vec3(-8,6.0 + abs(sin(t*2.) * 6.),14), 6.0), test) ) {
        // silver ball
        s.col = vec4(.4,.5,.8,0.0);
        s.gloss = 0.3;
        s.ref = 0.0;
    }
    
    Triangle tri;
    float speed = sin(t*0.5) * 20.0;
    vec3 v0 = vec3(0,0,0);
    vec3 v1 = vec3(sin( speed), 1, cos( speed)) * 6.;
    vec3 v2 = vec3(sin( speed + PI * 0.5), 1, cos( speed + PI * 0.5)) * 6.;
    vec3 v3 = vec3(sin( speed + PI), 1, cos(speed + PI)) * 6.;
    vec3 v4 = vec3(sin( speed + PI * 1.5), 1, cos( speed + PI * 1.5)) * 6.;
    
    vec3 edgeA = v1-v0;
    vec3 edgeB = v2-v0;
    vec3 edgeC = v3-v0;
    vec3 edgeD = v4-v0;
    
    tri.v0 = v0;
    tri.edgeA = edgeB;
    tri.edgeB = edgeA;
    tri.n = normalize(cross(tri.edgeA, tri.edgeB));
    
    bool hitTri = false;
    hitTri = hitTri || intersectTriangle(r, tri, test);
    
    tri.edgeA = edgeC;
    tri.edgeB = edgeB;
    tri.n = normalize(cross(tri.edgeA, tri.edgeB));
    hitTri = hitTri || intersectTriangle(r, tri, test);
    
    tri.edgeA = edgeD;
    tri.edgeB = edgeC;
    tri.n = normalize(cross(tri.edgeA, tri.edgeB));
    hitTri = hitTri || intersectTriangle(r, tri, test);
    
    tri.edgeA = edgeA;
    tri.edgeB = edgeD;
    tri.n = normalize(cross(tri.edgeA, tri.edgeB));
    hitTri = hitTri || intersectTriangle(r, tri, test);
    
    // top
    
    edgeA = v2-v1;
    edgeB = v4-v1;
    edgeC = v2-v3;
    edgeD = v4-v3;
    
    tri.v0 = v1;
    tri.edgeA = edgeA;
    tri.edgeB = edgeB;
    tri.n = normalize(cross(tri.edgeA, tri.edgeB));
    hitTri = hitTri || intersectTriangle(r, tri, test);
    
    tri.v0 = v3;
    tri.edgeA = edgeD;
    tri.edgeB = edgeC;
    tri.n = normalize(cross(tri.edgeA, tri.edgeB));
    hitTri = hitTri || intersectTriangle(r, tri, test);
    
    if (hitTri) {
        // Triangle
        s.col = vec4(.8,.5,.5,0);
        s.ref = 1.0;
        s.gloss = 0.0;
    }
    
    if (intersectBox(r, Box(vec3(4,0,-4), vec3(20, 5, -14)), test)) {
        // gold box
        s.col = vec4(0.9, 0.9, 0.6, 0);
        s.ref = 0.9;
        s.gloss = 0.0;
    }
    s.dist = test.dist;
    s.normal = test.normal;
    
    return s;
}

vec4 traceScene(in Camera cam, vec2 seed, float lastB) {
    vec3 startPos = cam.pos;
    vec4 result = vec4(0);

    int maxI = int(float(MAXRAYS) * lastB);
    float rayCount = 0.0;
    float t = iTime;// - iTimeDelta;
    
#ifdef FIXEDFRAMETIME
    float tStep = FRAMETIME / float(maxI);
#else
    float tStep = iTimeDelta / float(maxI);
#endif
    for (int i=0; i<MAXRAYS; i++) {
        if (i==maxI) break;
        Ray r = cam.ray;
        rayCount++;
        t += tStep;

        vec3 rr = (vec3(nrand(seed), nrand(seed.yx), nrand(seed.xx)) * 2. -1.) * divergence*2.0;
        r.dir += rr;
        r.dir = normalize(r.dir);
        
        vec4 impact = vec4(BRIGHTNESS);
        seed++;

        for (int j=0; j<MAXBOUNCES; j++) {
            SceneResult test = intersectScene(r, t);
#ifdef DEBUG
return vec4((test.dist)) / 100.0;
#endif
            if (test.col.a > 0.0) { 
                result += test.col * impact * test.col.a;
                break;
            }
                
            impact *= test.col;
                
            r.origin += r.dir * test.dist;
                
            r.origin += test.normal * 0.1;
                    
            vec3 rs = r.origin + seed.x;
            vec3 random = vec3(
                nrand(rs.xy),
                nrand(rs.yz),
                nrand(rs.zx)
            )*2. - 1.;
                
            float fresnel = clamp(dot(r.dir, test.normal)+1.0, 0., 1.0) * test.gloss;
            
            test.ref = mix(test.ref, 1.0, fresnel);
            
            vec3 matte = normalize(test.normal * SQRT2 + random);
            
            vec3 refl = reflect(r.dir, test.normal);
            vec3 newDir = mix(
                matte,
                refl,
                test.ref
            );
            float s = step(fresnel, nrand(seed));
            r.dir = //newDir;
                
            normalize(newDir * s + refl * (1.-s));
            
        }
    }
    return result / rayCount;// / (float(MAXRAYS));
}

// Sets up a camera at a position, pointing at a target.
// uv = fragment position (-1..1) and fov is >0 (<1 is telephoto, 1 is standard, 2 is fisheye-like)
Camera setupCam(in vec3 pos, in vec3 target, in float fov, in vec2 uv) {
        // cam setup
    vec2 mouse = iMouse.xy / iResolution.xy;
    mouse = mouse * 2. - 0.5;
   // R(pos.xz, mouse.x - 0.5);// + sin(iTime*0.5)*0.5);
    // Create camera at pos
    Camera cam;
    cam.pos = pos;
    
    // A ray too
    Ray ray;
    ray.origin = pos;
    
    // FOV is a simple affair...
    uv *= fov;
    
    // Now we determine hte ray direction
    vec3 cw = normalize (target - pos );
    vec3 cp = vec3 (0.0, 1.0, 0.0);
    vec3 cu = normalize ( cross(cw,cp) );
    vec3 cv = normalize ( cross (cu,cw) );
    
    ray.dir = normalize ( uv.x*cu + uv.y*cv + 0.5 *cw);
    
    // Add the ray to the camera and our work here is done.
    cam.ray = ray;
    
    // Ray divergence
    divergence = fov / iResolution.x;
    //divergence = divergence + length(uv) * 0.01;
    return cam;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
   // t = iTime;
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv = uv * 2. - 1.;
    uv.y /= iResolution.x/iResolution.y;
    Camera cam = setupCam(vec3(sin(iTime * 0.3) * 5. - 7.,sin(iTime * 0.4) * 5. + 7.,sin(iTime * 0.5) * 5. - 7.), vec3(0,5,0), 0.7, uv);
        //Camera(vec3(0, 5, -10), normalize(vec3(uv, 1.0)));
    
    vec4 l = texture(iChannel0, fragCoord / iResolution.xy);
    float ll = (l.r+l.g+l.b) / 3.0;
    vec3 lc = l.rgb - ll;
    
    float bias = iMouse.z > 0.5 || iFrame == 0 ? 1.0 : max(0.2, 1.0 - max(l.r, max(l.g, l.b)));

    vec4 c = traceScene(cam, uv + iTime, bias);// / bias;
    float cl = (c.r+c.g+c.b) / 3.0;
    vec3 cc = c.rgb - cl;
    
    float diff = length(cc-lc);
    diff = max(diff*6., abs(cl-ll));
   // diff = max(abs(c.x-l.x), max(abs(c.y-l.y), abs(c.z-l.z)));

    fragColor = c;//mix(c, l,  clamp(1.-diff, 0.0, 0.97));
}

