/*
* created by dmytro rubalskyi (ruba)
*
* all values are in kilometers
*
* references: 
*
* http://nishitalab.org/user/nis/cdrom/sig93_nis.pdf
* 
* http://http.developer.nvidia.com/GPUGems2/gpugems2_chapter16.html
*
* http://www-evasion.imag.fr/people/Eric.Bruneton/
*
* https://software.intel.com/en-us/blogs/2013/09/19/otdoor-light-scattering-sample-update
*
*/

#define M_MAX 1e9
#define KEY_M (float(77)+0.5)/256.0

const float M_PI = 3.1415926535;
const float M_4PI = 4.0 * M_PI;

///////////////////////////////////////
// planet
const float earthRadius     = 6360.0;
const float atmoHeight      = 60.0;
const float atmoRadius      = earthRadius + atmoHeight;
const vec3 earthCenter      = vec3(0.0, 0.0, 0.0);

///////////////////////////////////////
// sun
const float distanceToSun = 1.496e8;
const float sunRadius = 2.0 * 109.0 * earthRadius;
const float sunIntensity = 10.0;

///////////////////////////////////////
// atmosphere
const vec3 betaR            = vec3(5.8e-4, 1.35e-3, 3.31e-3);
const vec3 betaM            = vec3(4.0e-3, 4.0e-3, 4.0e-3);

const vec3 M_4PIbetaR       = M_4PI * betaR;
const vec3 M_4PIbetaM       = M_4PI * betaM;

const float heightScaleRayleight = 6.0;
const float heightScaleMie = 1.2;
const float g = -0.76;

const float NUM_DENSITY_SAMPLES = 8.0;
const float NUM_VIEW_SAMPLES = 8.0;
const int   INT_NUM_DENSITY_SAMPLES = int(NUM_DENSITY_SAMPLES);
const int   INT_NUM_VIEW_SAMPLES = int(NUM_VIEW_SAMPLES);

///////////////////////////////////////
// ray - sphere intersection
vec2 iSphere(vec3 ro, vec3 rd, vec4 sph)
{
    vec3 tmp = ro - sph.xyz;

    float b = dot(rd, tmp);
    float c = dot(tmp, tmp) - sph.w * sph.w;
    
    float disc = b * b - c;
    
    if(disc < 0.0) return vec2(-M_MAX, -M_MAX);
    
    float disc_sqrt = sqrt(disc);
    
    float t0 = -b - disc_sqrt;
    float t1 = -b + disc_sqrt;
    
    return vec2(t0, t1);
}

///////////////////////////////////////
// Henyey-Greenstein phase function
float phase(float nu, float g)
{
    return (3.0 * (1.0 - g * g) * (1.0 + nu * nu)) / (2.0 * (2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * nu, 1.5));
}

///////////////////////////////////////
// density integral calculation from p0 to p1 
// for mie and rayleight
vec2 densityOverPath(vec3 p0, vec3 p1, vec2 prescaler)
{
    float l = length(p1 - p0);
    vec3  v = (p1 - p0) / l;
    
    l /= NUM_DENSITY_SAMPLES;
    
    vec2 density = vec2(0.0);
    float t = 0.0;
    
    for(int i = 0; i < INT_NUM_DENSITY_SAMPLES; i++)
    {
        vec3 sp = p0 + v * (t + 0.5 * l);
        vec2 h = vec2(length(sp) - earthRadius);
        density += exp(-h / prescaler);
        
        t += l;
    }
    
    return l * density;
}

///////////////////////////////////////
// inscatter integral calculation
vec4 inscatter(vec3 cam, vec3 v, vec3 sun)
{    
    vec4 atmoSphere     = vec4(earthCenter, atmoRadius);
    vec4 earthSphere    = vec4(earthCenter, earthRadius);
        
    vec2 t0 = iSphere(cam, v, atmoSphere);
    vec2 t1 = iSphere(cam, v, earthSphere);
   
    bool bNoPlanetIntersection = t1.x < 0.0 && t1.y < 0.0;
    
    float farPoint = bNoPlanetIntersection ? t0.y : t1.x;
    float nearPoint = t0.x > 0.0 ? t0.x : 0.0;
    
    float l = (farPoint - nearPoint) / NUM_VIEW_SAMPLES;
    cam += nearPoint * v;  
    
    float t = 0.0;

    vec3 rayleight = vec3(0.0);
    vec3 mie = vec3(0.0);
    
    vec2 prescalers = vec2(heightScaleRayleight, heightScaleMie);
    
    vec2 densityPointToCam = vec2(0.0);
    
    for(int i = 0; i < INT_NUM_VIEW_SAMPLES; i++)
    {
        vec3 sp = cam + v * (t + 0.5 * l);
        float tc = iSphere(sp, sun, vec4(earthCenter, atmoRadius)).y;
        
        vec3 pc = sp + tc * sun;
        
        vec2 densitySPCam = densityOverPath(sp, cam, prescalers);
        vec2 densities = densityOverPath(sp, pc, prescalers) + densitySPCam;
        
        vec2 h = vec2(length(sp) - earthRadius);
        vec2 expRM = exp(-h / prescalers);
        
        rayleight   += expRM.x * exp( -M_4PIbetaR * densities.x );
        mie         += expRM.y * exp( -M_4PIbetaM * densities.y );

        densityPointToCam += densitySPCam;
        
        t += l;
    }
    
    rayleight *= l;
    mie *= l;
    
    vec3 extinction = exp( - (M_4PIbetaR * densityPointToCam.x + M_4PIbetaM * densityPointToCam.y));
    
    float nu = dot(sun, -v);
    
    vec3 inscatter_ = sunIntensity * (betaM * mie * phase(nu, g) + betaR * phase(nu, 0.0) * rayleight);
    return vec4(inscatter_, extinction.r * float(bNoPlanetIntersection));
}

///////////////////////////////////////
// rotation around axis Y
vec3 rotate_y(vec3 v, float angle)
{
    vec3 vo = v; float cosa = cos(angle); float sina = sin(angle);
    v.x = cosa*vo.x - sina*vo.z;
    v.z = sina*vo.x + cosa*vo.z;
    return v;
}

///////////////////////////////////////
// noise from iq
float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    
    vec2 uv = (p.xy+vec2(37.0,17.0) * p.z) + f.xy;
    vec2 rg = texture( iChannel0, (uv + 0.5)/256.0, -100.0 ).yx;
    return mix( rg.x, rg.y, f.z );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 sc = 2.0 * fragCoord.xy / iResolution.xy - 1.0;
    sc.x *= iResolution.x / iResolution.y;
    
    vec3 mouse = 4.0 * vec3(2.0 * iMouse.xy / iResolution.xy - 1.0,0.0);
    
    vec3 ro = vec3(0.0);
    
    bool key_m = texture(iChannel1, vec2(KEY_M, 0.75)).x > 0.0;
    ro = key_m ?    2.0 * vec3(earthRadius * sin(mouse.x), 0.0, earthRadius * cos(mouse.x)): 
                    vec3(0.0, earthRadius + 0.1, 1000.0 * abs(cos(iTime / 10.0)));
    
    vec3 rd = normalize(rotate_y(vec3(sc, 1.2), M_PI - mouse.x));
    
    vec3 sun = normalize(vec3(1.0, 1.0, 1.0));
    
    vec4 col = inscatter(ro, rd, sun);
    
    vec3 sunPos = sun * distanceToSun;
    
    vec4 star = vec4(sunPos, sunRadius);
    vec2 t0 = iSphere(ro, rd, star);
    
    if(t0.x > 0.0)
    {
        col.xyz += vec3(1.0,1.0,1.0) * col.a;
    }
    
    vec3 stars = vec3(noise(rd * iResolution.y * 0.75));
    stars += vec3(noise(rd * iResolution.y * 0.5));
    stars += vec3(noise(rd * iResolution.y * 0.25));
    stars += vec3(noise(rd * iResolution.y * 0.1));
    stars = clamp(stars, 0.0, 1.0);
    stars = (vec3(1.0) - stars);
    
    col.xyz = col.xyz + stars * col.a;
    col.xyz = pow(col.xyz, vec3(1.0 / 2.2));
    
    fragColor = col;
}

