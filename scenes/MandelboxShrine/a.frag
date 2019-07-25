// Created by EvilRyu
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// A simple pathtracer for phong model.

#define SAMPLES 1
#define LIGHT_SAMPLES 1
#define MAX_DEPTH 4

#define PI 3.1415926

float seed;
float rnd() 
{ 
    return fract(sin(seed++)*43758.5453123); 
}

void rz(inout vec3 p , float a)  
{
    float c, s;
    vec3 q=p; c=cos(a); s=sin(a);
    p.x=c*q.x-s*q.y;
    p.y=s*q.x+c*q.y;
}

const float ang = 1.;
const mat2 rot = mat2(cos(ang), sin(ang), 
                      -sin(ang), cos(ang));

//==========  mandelbox ===========================
float fixed_radius2 = 2.0;
float min_radius2 = 0.1;
float folding_limit = 1.4;
float scale = 3.;
vec3 mtl = vec3(0.5, 0.5, 0.6);
vec4 orb = vec4(1000);

void sphere_fold(inout vec3 z, inout float dz) {
    float r2 = dot(z, z);
    if(r2 < min_radius2) {
        float temp = (fixed_radius2 / min_radius2);
        z *= temp;
        dz *= temp;
    }else if(r2 < fixed_radius2) {
        float temp = (fixed_radius2 / r2);
        z *= temp;
        dz *= temp;
    }
}

void box_fold(inout vec3 z, inout float dz) {
    z = clamp(z, -folding_limit, folding_limit) * 2.0 - z;
}

float mb(vec3 z) {
    z.z = mod(z.z + 1.0, 2.0) - 1.0;
    orb = vec4(1000);
    vec3 offset = z;
    float dr = 1.0;
    for(int n = 0; n < 13; ++n) {
        z.xy = rot*z.xy;
        
        box_fold(z, dr);
        sphere_fold(z, dr);

        z = scale * z + offset;
        dr = dr * abs(scale) + 1.;
        orb = min(orb, vec4(abs(z.xyz), dot(z,z)));
    }
    float r = length(z);
    return r / abs(dr);
}


float f(vec3 p){ 
    rz(p, 0.64);
    return mb(p); 
} 


float shadow(vec3 ro, vec3 rd)
{
    float res = 0.0;
    float tmax = 1.0;
    float t = 0.001;
    for(int i=0; i<30; i++ )
    {
        float h = f(ro+rd*t);
        if( h<0.0001 || t>tmax) break;
        t += h;
    }
    if( t>tmax ) res = 1.0;
    return res;
}


float intersect(vec3 ro, vec3 rd)
{
    float res;
    float t = 0.01;
    for(int i = 0; i < 100; ++i)
    {
        vec3 p = ro + rd * t;
        res = f(p);
        if(res < 0.0001 || res > 100.)
            break;
        t += res;
    }
    
    if(res > 100.) t = -1.;
    return t;
}


vec3 get_normal(vec3 pos)
{
    vec3 eps = vec3(0.0001,0.0,0.0);
    return normalize(vec3(
           f(pos+eps.xyy) - f(pos-eps.xyy),
           f(pos+eps.yxy) - f(pos-eps.yxy),
           f(pos+eps.yyx) - f(pos-eps.yyx)));
}

vec3 get_material(vec3 x)
{
    float d = f(x);
    mtl = mix(mtl, vec3(1.2, 0.8, 0.5), clamp(orb.x*orb.x, 0.0, 1.0));
    mtl = mix(mtl, vec3(1.2, 0.4, 0.), clamp(orb.y*orb.y, 0.0, 1.0));
    mtl = mix(mtl, 0.1*vec3(0.5, 0.8, 1.0), clamp(orb.z*orb.z, 0.0, 1.0));

    return mtl;
}

float schlick_fresnel(float rs, float cos_theta) 
{
    return rs + pow(1.0 - cos_theta, 5.) * (1. - rs);
}

// http://orbit.dtu.dk/files/126824972/onb_frisvad_jgt2012_v2.pdf
void basis(vec3 n, out vec3 b1, out vec3 b2) 
{
    if(n.z < -0.999999) {
        b1 = vec3(0 , -1, 0);
        b2 = vec3(-1, 0, 0);
    } else {
        float a = 1./(1. + n.z);
        float b = -n.x*n.y*a;
        b1 = vec3(1. - n.x*n.x*a, b, -n.x);
        b2 = vec3(b, 1. - n.y*n.y*a , -n.y);
    }
}

vec3 local_to_world(vec3 local_dir, vec3 normal)
{
    vec3 a,b;
    basis(normal, a, b);
    return local_dir.x*a + local_dir.y*b + local_dir.z*normal;
}

vec3 spherical_to_cartesian(float rho, float phi, float theta) {
    float sin_theta = sin(theta);
    return vec3( sin_theta*cos(phi), sin_theta*sin(phi), cos(theta))*rho;
}

vec3 sample_hemisphere_cos_weighted(vec3 n, float Xi1, float Xi2) 
{
    float theta = acos(sqrt(1.0-Xi1));
    float phi = 2. * PI * Xi2;

    return local_to_world(spherical_to_cartesian(1.0, phi, theta), n);
}

vec3 sample_phone_specular(vec3 n, float roughness, float Xi1, float Xi2)
{
    float theta = acos(pow(Xi1, 1./(roughness + 1.)));
    float phi = 2. * PI * Xi2;
    return local_to_world(spherical_to_cartesian(1., phi, theta), n);
}


vec3 sun_col = 6.0*vec3(1.0,0.8,0.6);
vec3 sun_dir = normalize(vec3(10.0,3.,-3.));
vec3 sky_col = vec3(0.02);
const float shininess = 32.;
const float spec_weight = 0.2;

// standard phong brdf
// kd*(1./pi) + ks*((n+2)/2pi * (reflect * eye)^n
vec3 brdf(vec3 p, vec3 n, vec3 wo, vec3 wi)
{
    vec3 wh = normalize(wi + wo);
    float F = schlick_fresnel(0.1, max(0.,dot(wi, wh)));
    
    float spe = pow(clamp(dot(wo, reflect(-wi, n)), 0.0, 1.0), shininess);
    vec3 mtl = get_material(p);
    
    vec3 spec_refl = spe * vec3(1.) * F * ((shininess + 2.)/(2.*PI));                        
    vec3 diff_refl = mtl * (1. - F) / PI;
    
    return mix(diff_refl, spec_refl, spec_weight);
}


vec3 sample_light(vec3 x, vec3 n, vec3 rd, float t)
{
    vec3 Lo = vec3(0.);
    
    vec3 wi = sun_dir;
    float light_sampling_pdf = 1.;
    
    for(int i = 0; i < LIGHT_SAMPLES; ++i)
    {        
        float n_dot_wi = dot(n, sun_dir);
        if(n_dot_wi > 0.00001) 
        {
            float sha = shadow(x, wi);
        
            // monte carlo estimator
            Lo += sun_col * brdf(x, n, -rd, wi) * n_dot_wi * sha / light_sampling_pdf;
        }
        
    }
    Lo /= float(LIGHT_SAMPLES);
    
    Lo = mix(Lo, sky_col, 1.0-exp(-0.01*t*t*t)); 

    return Lo;
}


vec3 radiance(vec3 ro, vec3 rd)
{
    vec3 Lo = vec3(0.); 

    float t = intersect(ro, rd);
    
    if(t < 0.)
    {
        return sky_col;
    }
    
    
    for(int i = 0; i < MAX_DEPTH; ++i)
    {
        vec3 x = ro + t * rd;
        vec3 n = get_normal(x);

        Lo += sample_light(x, n, rd, t); 

        ro = x;
        
        float Xi1 = rnd();
        float Xi2 = rnd();

        // sample the next ray
        if(rnd() > spec_weight)
        {
            rd = sample_hemisphere_cos_weighted(n, Xi1, Xi2);
        }
        else
        {
            rd = sample_phone_specular(n, shininess, Xi1, Xi2);
        }
        
        t = intersect(ro, rd);
        
        if(t < 0.)
            break;
    }
    
    return Lo;
}

mat3 camera(vec3 ro, vec3 ta)
{
    vec3 cf = normalize(ta - ro);
    vec3 cs = normalize(cross(cf, vec3(0,1,0)));
    vec3 cu = normalize(cross(cs, cf));
    return mat3(cs, cu, cf);
}
 
void mainImage( out vec4 fragColor, in vec2 fragCoord ) 
{ 
    seed = iTime + iResolution.y * fragCoord.x / iResolution.x + fragCoord.y / iResolution.y;

    vec3 ta=vec3(-0.1,0.45,0.);
    vec3 ro = vec3(1.7, .2, -1.6);
    
    vec2 offset = -0.5 + vec2(rnd(), rnd());
    vec2 p = (-iResolution.xy + 2.0*(fragCoord+offset)) / iResolution.y;

    mat3 cam = camera(ro, ta);
    
    vec3 rd = normalize(cam * vec3(p, 3.));
    
    vec3 col = texture(iChannel0, fragCoord/iResolution.xy).xyz;
    if(iFrame==0) col = vec3(0.0);
    
    vec3 col_acc = vec3(0.);
    for(int i = 0; i < SAMPLES; ++i)
    {
        col_acc += radiance(ro, rd);
    }
    
    col_acc /= float(SAMPLES);
     
    col += col_acc;
    fragColor = vec4(col, 1.0);
}



