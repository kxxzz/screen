// The maximum amount of scattering interactions within a single frame.
// Note, that while this variable correlates with the samples per pixel,
// it is a randomized relationship. The path at the moment of truncation
// (i.e. when the maximum bounces are reached) is ignored to preserve
// unbiasedness.
#define BOUNCES_PER_FRAME 20

#define FOV 90.0 // Field of view in degrees

#define EPSILON 0.001
#define INFINITY 1000.0
#define PI 3.14159265358979323846

// The randX functionality has been copied from https://www.shadertoy.com/view/4lfGWr and slightly modified.
// They do bidirectional path tracing (without MIS and non-physical weights),
// in contrast to the unidirectional path tracing happening in this shader.
float seed;

float rand1()
{
    return fract(sin(seed += 0.1)*43758.5453123);
}

vec2 rand2()
{
    return fract(sin(vec2(seed+=0.1,seed+=0.1))*vec2(43758.5453123,22578.1459123));
}

vec3 rand3()
{
    return fract(sin(vec3(seed+=0.1,seed+=0.1,seed+=0.1))*vec3(43758.5453123,22578.1459123,19642.3490423));
}

// Warping functions used for importance sampling.
vec3 squareToUniformSphere(in vec2 s)
{
    vec3 result;
    result.z = s.y * 2.0 - 1.0;
    
    float ringRadius = sqrt(1.0 - result.z * result.z);
    result.xy = vec2(sin(s.x * 2.0 * PI), cos(s.x * 2.0 * PI)) * ringRadius;
  
    return result;
}

float squareToUniformSpherePdf()
{
    return 1.0 / (4.0 * PI);
}

vec3 squareToUniformSphereCap(in vec2 s, in float height)
{
    vec3 result;
    result.z = s.y * (height - 1.0) + 1.0;
    
    float ringRadius = sqrt(1.0 - result.z * result.z);
    result.xy = vec2(sin(s.x * 2.0 * PI), cos(s.x * 2.0 * PI)) * ringRadius;
  
    return result;
}

float squareToUniformSphereCapPdf(in float height)
{
    return 0.5 / ((1.0 - height) * PI);
}

vec2 squareToUniformDisk(in vec2 s)
{
    float r = sqrt(s.x);
    return vec2(r * sin(2.0 * PI * s.y), r * cos(2.0 * PI * s.y));
}

vec3 squareToCosineHemisphere(in vec2 s)
{
    float r = sqrt(s.x);
    vec2 disc = vec2(r * sin(2.0 * PI * s.y), r * cos(2.0 * PI * s.y));
    
    return vec3(disc, sqrt(1.0 - s.x));
}


// Encodes material type and color.
// if      c.x >= 0.0  then lambertian diffuse with reflectance c
// else if c.x >= -1.0 then smooth mirror
// else                then smooth dielectric with index of refraction c.y
struct Material
{
    vec3 c;
};

// Scene objects
struct Light
{
    vec3 p;
    float r;
    vec3 radiance; // Radiance is emitted equally for all surface points and directions
    int idx;
};
    
struct Quadric
{
    vec3 p;
    vec3 r;
    Material m;
};

struct Sphere
{
    vec3 p;
    float r;
    Material m;
};
    
struct Plane
{
    vec3 p;
    vec3 n;
    Material m;
};

// Encapsulated a ray-object intersection.
// This can likely be packed a lot more efficiently.
struct Intersection
{
    vec3 p;
    vec3 n;
    float t;
    bool isLight;
    Material m;
    Light light;
};

// Encapsulates a direction towards a particular light and the pdf
// for sampling the direction w.r.t. solid angle.
struct LightSample
{
    vec3 d;
    float pdf;
};

// A light ray with origin o and direction d.
//  ray(t) = o + d * t where t in [tmin, tmax]
struct Ray
{
    vec3 o;
    vec3 d;
    
    float tMin;
    float tMax;
};

// A path of consecutive rays. Keeps track of information
// such as the total radiance estimated with the path,
// and the current radiance throughput.
struct Path
{
    vec3 radiance;
    vec3 throughput;
    
    Ray ray;
    float lastBsdfPdf;
    int amountBounces;
    float time;
};

// Functions for getting user input (from buffer B)
vec3 getPos()
{
    return texture(iChannel2, vec2(0.5, 0.5) / iResolution.xy).xyz;
}

vec3 getDir()
{
    return texture(iChannel2, vec2(1.5, 0.5) / iResolution.xy).xyz;
}

bool getPressed()
{
    return texture(iChannel2, vec2(2.5, 0.5) / iResolution.xy).x > 0.5;
}

bool getLightPulse()
{
    return texture(iChannel2, vec2(2.5, 0.5) / iResolution.xy).y < 0.5;
}

bool getCorrelation()
{
    return texture(iChannel2, vec2(2.5, 0.5) / iResolution.xy).z > 0.5;
}

float getTime()
{
    return texture(iChannel2, vec2(3.5, 0.5) / iResolution.xy).x;
}

// Generate a new ray starting from the camera.
Ray generateCameraRay(in vec2 uv)
{
    vec3 posCam = getPos();
    vec3 dirCam = getDir();
    vec3 targetCam = posCam + dirCam;
    
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 sidewaysCam = normalize(cross(up, dirCam));
    vec3 upCam = cross(dirCam, sidewaysCam);
    
    float zNear = 1.0;
    float xNear = -tan(radians(FOV) / 2.0) * zNear;
    float yNear = xNear * iResolution.y / iResolution.x;
    
    vec3 posNear =
        xNear * sidewaysCam * 2.0 * (-uv.x + 0.5) +
        yNear * upCam * 2.0 * (-uv.y + 0.5) +
        zNear * dirCam;
    
    Ray ray;
    ray.o = posCam;
    ray.d = normalize(posNear);
    ray.tMin = EPSILON;
    ray.tMax = INFINITY;
    
    return ray;
}

// Generate a new path starting from the camera.
Path generatePath(in vec2 fragCoord)
{
    Path path;
    
    path.radiance = vec3(0.0);
    path.throughput = vec3(1.0);

    vec2 pixelOffset = rand2();
    vec2 uv = (fragCoord.xy + pixelOffset) / iResolution.xy;

    path.ray = generateCameraRay(uv);

    path.lastBsdfPdf = 0.0;
    path.amountBounces = 0;
    path.time = 0.0;
    
    return path;
}

// Object intersection routines.
Intersection intersectQuadric(in Ray ray, in Quadric quadric)
{
    Intersection result;
    result.t = ray.tMax;
    
    vec3 difference = ray.o - quadric.p;

    // We solve ray-quadric intersection with an analytical approach solving the 2nd order polynomial for 0-points
    vec3 Asqrt = ray.d / quadric.r;
    vec3 Csqrt = difference / quadric.r;
    
    float A = dot(Asqrt, Asqrt);
    float B = 2.0 * dot(Asqrt, Csqrt);
    float C = dot(Csqrt, Csqrt) - 1.0;

    float termUnderRoot = B * B - 4.0 * A * C;

    // When solving the quadratic equation the part under the square root needs to be bigger than 0 for a solution to exist.
    if (termUnderRoot < 0.0)
        return result;

    float distance = -B / (2.0 * A);
    float distanceAddition = sqrt(termUnderRoot) / (2.0 * A);
    float normalFactor;
    
    if (distance - distanceAddition > ray.tMin)
        distance -= distanceAddition;
    else if (distance + distanceAddition > ray.tMin)
        distance += distanceAddition;
    else
        return result;

    vec3 intersectionPosition = ray.d * distance + ray.o;
    vec3 intersectionNormal = intersectionPosition - quadric.p;

    // Unlike spheres the normals of quadrics need an additional division
    intersectionNormal = normalize(intersectionNormal / (quadric.r * quadric.r));
    
    result.p = intersectionPosition;
    result.n = intersectionNormal;
    result.t = distance;

    return result;
}

Intersection intersectSphere(in Ray ray, in Sphere sphere)
{
    Quadric quadric;
    quadric.p = sphere.p;
    quadric.r = vec3(sphere.r);
    
    return intersectQuadric(ray, quadric);
}

Intersection intersectLight(in Ray ray, in Light light)
{
    Quadric quadric;
    quadric.p = light.p;
    quadric.r = vec3(light.r);
    
    return intersectQuadric(ray, quadric);
}

Intersection intersectPlane(in Ray ray, in Plane plane)
{
    Intersection result;
    result.t = ray.tMax;
    
    float distance = dot(plane.p, plane.n) - dot(ray.o, plane.n);
    float t = distance / dot(ray.d, plane.n);
    
    if (t < ray.tMin || distance > 0.0)
        return result;
    
    result.t = t;
    result.p = ray.o + ray.d * t;
    result.n = plane.n;
    
    return result;
}

LightSample sampleLight(in vec3 p, in Light light)
{
    vec3 difference = light.p - p;
    float distance = length(difference);
    vec3 direction = difference / distance;
    
    float sinTheta = light.r / distance;
    float cosTheta = sqrt(1.0 - sinTheta * sinTheta);
    
    LightSample result;
    
    vec3 hemi = squareToUniformSphereCap(rand2(), cosTheta);
    result.pdf = squareToUniformSphereCapPdf(cosTheta);
    
    vec3 s = normalize(cross(direction, vec3(0.433, 0.433, 0.433)));
    vec3 t = cross(direction, s);
    
    result.d = (direction * hemi.z + s * hemi.x + t * hemi.y);
    return result;
}

#define AMOUNT_LIGHTS 2
Light lights[AMOUNT_LIGHTS];

#define AMOUNT_PLANES 5
Plane planes[AMOUNT_PLANES];

#define AMOUNT_SPHERES 2
Sphere spheres[AMOUNT_SPHERES];

void setupScene()
{
    float time = getTime();
    
    // LIGHTS
    lights[0].p = vec3(
        0.0 + sin(time) * 0.75,
        0.4,
        2.0 + cos(time) * 0.75
    );
    lights[0].r = 0.2;
    lights[0].radiance = vec3(50.0 / PI);
    lights[0].idx = 0;
    
    lights[1].p = vec3(
        0.04,
        0.0 + sin(time * 0.66 + 1.0) * 0.4,
        2.0 + cos(time * 0.66 + 1.0) * 0.4
    );
    lights[1].r = 0.1;
    lights[1].radiance = vec3(5.0, 20.0, 5.0) / PI;
    lights[1].idx = 1;
    
    // PLANES

    // BOTTOM
    planes[0].p = vec3(0.0, -0.8, 0.0);
    planes[0].n = vec3(0.0, 1.0, 0.0);
    planes[0].m.c = vec3(0.5, 0.5, 0.5);
    
    // TOP
    planes[1].p = vec3(0.0, 1.0, 0.0);
    planes[1].n = vec3(0.0, -1.0, 0.0);
    planes[1].m.c = vec3(0.5, 0.5, 0.5);
    
    // LEFT (RED)
    planes[2].p = vec3(-1.3, 0.0, 0.0);
    planes[2].n = vec3(1.0, 0.0, 0.0);
    planes[2].m.c = vec3(0.8, 0.05, 0.05);
    
    // RIGHT (BLUE)
    planes[3].p = vec3(1.3, 0.0, 0.0);
    planes[3].n = vec3(-1.0, 0.0, 0.0);
    planes[3].m.c = vec3(0.05, 0.05, 0.8);
    
    // BACK
    planes[4].p = vec3(0.0, 0.0, 4.0);
    planes[4].n = vec3(0.0, 0.0, -1.0);
    planes[4].m.c = vec3(0.5, 0.5, 0.5);
    
    // SPHERES
    spheres[0].p = vec3(0.6, -0.399, 1.9);
    spheres[0].r = 0.4;
    spheres[0].m.c = vec3(-2.0, 1.5, 0.0);
    
    spheres[1].p = vec3(-0.5, -0.399, 2.33);
    spheres[1].r = 0.4;
    spheres[1].m.c = vec3(-1.0, 0.0, 0.0);
}

// Intersects each object in the scene.
Intersection trace(in Ray ray)
{
    Intersection bestIts;
    bestIts.t = ray.tMax;
    
    for (int i = 0; i < AMOUNT_LIGHTS; ++i)
    {
        Intersection its = intersectLight(ray, lights[i]);
        if (its.t < bestIts.t)
        {
            bestIts = its;
            bestIts.isLight = true;
            bestIts.light = lights[i];
        }
    }
    
    for (int i = 0; i < AMOUNT_SPHERES; ++i)
    {
        Intersection its = intersectSphere(ray, spheres[i]);
        if (its.t < bestIts.t)
        {
            bestIts = its;
            bestIts.m = spheres[i].m;
            bestIts.isLight = false;
        }
    }
    
    for (int i = 0; i < AMOUNT_PLANES; ++i)
    {
        Intersection its = intersectPlane(ray, planes[i]);
        if (its.t < bestIts.t)
        {
            bestIts = its;
            bestIts.m = planes[i].m;
            bestIts.isLight = false;
        }
    }

    return bestIts;
}

// Intersects only lights and spheres, since in our particular scenes
// the planes can not cast shadows (they form a convex hull of the scene).
Intersection traceShadow(in Ray ray)
{
    Intersection bestIts;
    bestIts.t = ray.tMax;
    bestIts.isLight = false;
    
    for (int i = 0; i < AMOUNT_LIGHTS; ++i)
    {
        Intersection its = intersectLight(ray, lights[i]);
        if (its.t < bestIts.t)
        {
            bestIts = its;
            bestIts.isLight = true;
            bestIts.light = lights[i];
        }
    }
    
    for (int i = 0; i < AMOUNT_SPHERES; ++i)
    {
        Intersection its = intersectSphere(ray, spheres[i]);
        if (its.t < bestIts.t)
        {
            bestIts = its;
            bestIts.m = spheres[i].m;
            bestIts.isLight = false;
            return bestIts;
        }
    }

    return bestIts;
}

// Heuristics for multiple importance sampling.
float balanceHeuristic(in float pdf1, in float pdf2)
{
    return pdf1 / (pdf1 + pdf2);
}

float powerHeuristic(in float pdf1, in float pdf2)
{
    return (pdf1 * pdf1) / ((pdf1 * pdf1) + (pdf2 * pdf2));
}

// Adapted from http://mitsuba-renderer.org
// Used only to determine the ratio between refraction and reflection.
float fresnelDielectricExt(in float cosThetaI_, in float eta) {
    if (eta == 1.0) {
        return 0.0;
    }

    /* Using Snell's law, calculate the squared sine of the
       angle between the normal and the transmitted ray */
    float scale = (cosThetaI_ > 0.0) ? 1.0/eta : eta,
          cosThetaTSqr = 1.0 - (1.0-cosThetaI_*cosThetaI_) * (scale*scale);

    /* Check for total internal reflection */
    if (cosThetaTSqr <= 0.0) {
        return 1.0;
    }

    /* Find the absolute cosines of the incident/transmitted rays */
    float cosThetaI = abs(cosThetaI_);
    float cosThetaT = sqrt(cosThetaTSqr);

    float Rs = (cosThetaI - eta * cosThetaT)
             / (cosThetaI + eta * cosThetaT);
    float Rp = (eta * cosThetaI - cosThetaT)
             / (eta * cosThetaI + cosThetaT);

    /* No polarization -- return the unpolarized reflectance */
    return 0.5 * (Rs * Rs + Rp * Rp);
}

// Determines whether this pixel should show femto-photography
// (light propagation) or the full image.
float xCoord;
bool isFemto()
{
    float mouseX = iMouse.x > 0.0 ?
        iMouse.x :
        (iResolution.x / 2.0);
    
    return xCoord >= mouseX;
}

// Collects radiance for a given intersection.
float time;
void collectRadiance(inout Path path, in float extraTime, in vec3 radiance)
{
    bool isLightPulse = getLightPulse();
    
    float pathTime = path.time + extraTime;
    
    if (!isFemto()
     || (pathTime < time && (!isLightPulse || pathTime > time - 0.2)))
        path.radiance += radiance * path.throughput;
}

void shade(in Intersection its, inout Path path)
{
    if (its.t == path.ray.tMax)
    {
        path.throughput = vec3(0.0);
        return;
    }
    
    // Did we hit an emitter?
    if (its.isLight)
    {
        vec3 incidentRadiance = its.light.radiance;
        
        vec3 difference = its.light.p - path.ray.o;
        float distance = length(difference);
        vec3 direction = difference / distance;

        float sinTheta = its.light.r / distance;
        float cosTheta = sqrt(1.0 - sinTheta * sinTheta);
        
        float pdfLight = squareToUniformSphereCapPdf(cosTheta);

        if (path.lastBsdfPdf > 0.0) {
            incidentRadiance *= powerHeuristic(path.lastBsdfPdf, pdfLight);
        }
        
        collectRadiance(path, its.t, incidentRadiance);
        
        // Terminate path
        path.throughput = vec3(0.0);
        return;
    }
    
    float timeTravelled = its.t;
    
    // DIFFUSE
    if (its.m.c.x >= 0.0)
    {
        path.throughput *= its.m.c;
    
        // EMITTER SAMPLING
        for (int i = 0; i < AMOUNT_LIGHTS; ++i)
        {
            LightSample lightSample = sampleLight(its.p, lights[i]);

            Ray visRay;
            visRay.o = its.p;
            visRay.d = lightSample.d;
            visRay.tMin = EPSILON;
            visRay.tMax = INFINITY;

            float cosineTerm = max(0.0, dot(its.n, visRay.d));
            float pdfBsdf = cosineTerm / PI;

            Intersection visIts = traceShadow(visRay);
            if (visIts.isLight && visIts.light.idx == i)
            {
                vec3 incidentRadiance = 
                    (1.0 / PI)
                  * powerHeuristic(lightSample.pdf, pdfBsdf)
                  * lights[i].radiance
                  * cosineTerm
                  / lightSample.pdf;
                
                if (incidentRadiance.x > 0.0 && incidentRadiance.y > 0.0 && incidentRadiance.z > 0.0)
                    collectRadiance(path, timeTravelled + visIts.t, incidentRadiance);
            }
        }

        // BSDF SAMPLING
        vec3 hemi = squareToCosineHemisphere(rand2());
        path.lastBsdfPdf = hemi.z / PI;
        
        vec3 s = normalize(cross(its.n, vec3(0.433, 0.433, 0.433)));
        vec3 t = cross(its.n, s);

        path.ray.d = its.n * hemi.z + s * hemi.x + t * hemi.y;
    }
    // MIRROR
    else if (its.m.c.x >= -1.0)
    {
        path.ray.d = reflect(path.ray.d, its.n);
        path.lastBsdfPdf = 0.0;
    }
    // DIELECTRIC
    else
    {
        float IOR = its.m.c.y;
        
        float cosThetaI = -dot(its.n, path.ray.d);
        float F = fresnelDielectricExt(cosThetaI, IOR);
        
        vec3 n = cosThetaI > 0.0 ? its.n : -its.n;
        if (rand1() <= F)
        {
            path.ray.d = reflect(path.ray.d, n);
        }
        else
        {
            path.ray.d = refract(path.ray.d, n, cosThetaI > 0.0 ? (1.0 / IOR) : IOR);
        }
        
        if (cosThetaI < 0.0)
            timeTravelled *= IOR;
        
        path.lastBsdfPdf = 0.0;
    }
    
    path.ray.o = its.p;
    path.time += timeTravelled;
    
    ++path.amountBounces;
}

// Probabilistically kills paths with low throughput.
// Returns true if the path has been killed.
bool russianRoulette(inout Path path)
{
    if (path.throughput == vec3(0.0))
        return true;
    
    float successProb = max(0.5, max(path.throughput.z, max(path.throughput.x, path.throughput.y)));
    if (successProb <= 1.0)
    {
        // Path survived russian roulette.
        // Adjust throughput.
        if (rand1() < successProb)
        {
            path.throughput /= successProb;
        }
        // Old path killed by russian roulette.
        // Splat and generate new path.
        else
        {
            return true;
        }
    }
    
    return false;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    time = 1.5 + mod(iTime, 10.0);
    xCoord = fragCoord.x;
    
    setupScene();
    
    seed = 1.0 + texture(iChannel1, vec2(fract(float(iFrame) / 256.0), fract(float(iFrame) / (256.0 * 256.0)))).r;
    if (!getCorrelation())
        seed = 1.2314 + seed * (fragCoord.x + fragCoord.y * 3.43121412313 + fract(1.12345314312*float(iFrame)));
    
    // Globals across paths
    vec3 totalRadiance = vec3(0.0);
    float spp = 0.0;
    
    Path path = generatePath(fragCoord);
    
    for (int i = 0; i < BOUNCES_PER_FRAME; ++i)
    {
        shade(trace(path.ray), path);

        if (russianRoulette(path) || path.amountBounces == BOUNCES_PER_FRAME || (isFemto() && path.time >= time))
        {
            totalRadiance += path.radiance;
            spp += 1.0;

            path = generatePath(fragCoord);
        }

        seed = mod(seed * 1.1234567893490423, 13.);
    }
    
    vec4 accumulated = vec4(totalRadiance, spp);
    if (!getPressed() && !isFemto())
    {
        accumulated += texture(iChannel0, fragCoord.xy / iResolution.xy);
    }

    fragColor = accumulated;
}

