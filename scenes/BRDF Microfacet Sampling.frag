// BRDF Microfacet Sampling
// CulDeVu, 2017
//
// This technique is based on the paper "Microfacet Models for Refraction
// through Rough Surfaces", found here: 
// https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
//
// Or, if that's not your thing, I wrote a concise little blog post explaining
// the steps: http://djtaylor.me/blog/2016/microfacet-dummies/
// 
// Based on the original shader by Reinder Nijhoff:
// https://www.shadertoy.com/view/4tl3z4
//

#define PI 3.14159

#define eps 0.0001
#define EYEPATHLENGTH 4
#define SAMPLES 2

// uncomment this to get the light sampling window from Reinder's shader
//#define SHOWSPLITLINE
#define FULLBOX

#define ANIMATENOISE

#define LIGHTCOLOR vec3(16.86, 10.76, 8.2)*1.3
#define WHITECOLOR vec3(.7295, .7355, .729)*0.7
#define GREENCOLOR vec3(.117, .4125, .115)*0.7
#define REDCOLOR vec3(.611, .0555, .062)*0.7

#define alpha max(0.001, iMouse.x / (2.*iResolution.x))

float hash1(inout float seed) {
    return fract(sin(seed += 0.1)*43758.5453123);
}

vec2 hash2(inout float seed) {
    return fract(sin(vec2(seed+=0.1,seed+=0.1))*vec2(43758.5453123,22578.1459123));
}

vec3 hash3(inout float seed) {
    return fract(sin(vec3(seed+=0.1,seed+=0.1,seed+=0.1))*vec3(43758.5453123,22578.1459123,19642.3490423));
}

//-----------------------------------------------------
// Intersection functions (by iq)
//-----------------------------------------------------

vec3 nSphere( in vec3 pos, in vec4 sph ) {
    return (pos-sph.xyz)/sph.w;
}

float iSphere( in vec3 ro, in vec3 rd, in vec4 sph ) {
    vec3 oc = ro - sph.xyz;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - sph.w * sph.w;
    float h = b * b - c;
    if (h < 0.0) return -1.0;

  float s = sqrt(h);
  float t1 = -b - s;
  float t2 = -b + s;
  
  return t1 < 0.0 ? t2 : t1;
}

vec3 nPlane( in vec3 ro, in vec4 obj ) {
    return obj.xyz;
}

float iPlane( in vec3 ro, in vec3 rd, in vec4 pla ) {
    return (-pla.w - dot(pla.xyz,ro)) / dot( pla.xyz, rd );
}

//-----------------------------------------------------
// scene
//-----------------------------------------------------

vec3 cosWeightedRandomHemisphereDirection( const vec3 n, inout float seed ) {
    vec2 r = hash2(seed);
    
  vec3  uu = normalize( cross( n, vec3(0.0,1.0,1.0) ) );
  vec3  vv = cross( uu, n );
  
  float ra = sqrt(r.y);
  float rx = ra*cos(6.2831*r.x); 
  float ry = ra*sin(6.2831*r.x);
  float rz = sqrt( 1.0-r.y );
  vec3  rr = vec3( rx*uu + ry*vv + rz*n );
    
    return normalize( rr );
}

vec3 randomSphereDirection(inout float seed) {
    vec2 r = hash2(seed)*6.2831;
  vec3 dr=vec3(sin(r.x)*vec2(sin(r.y),cos(r.y)),cos(r.x));
  return dr;
}

vec3 randomHemisphereDirection( const vec3 n, inout float seed ) {
  vec3 dr = randomSphereDirection(seed);
  return dot(dr,n) * dr;
}

//-----------------------------------------------------
// light
//-----------------------------------------------------

vec4 lightSphere;

void initLightSphere( float time ) {
  lightSphere = vec4( 3.0+2.*sin(time),2.8+2.*sin(time*0.9),3.0+4.*cos(time*0.7), .5 );
}

vec3 sampleLight( const in vec3 ro, inout float seed ) {
    vec3 n = randomSphereDirection( seed ) * lightSphere.w;
    return lightSphere.xyz + n;
}

//-----------------------------------------------------
// scene
//-----------------------------------------------------

vec2 intersect( in vec3 ro, in vec3 rd, inout vec3 normal ) {
  vec2 res = vec2( 1e20, -1.0 );
    float t;
  
  t = iPlane( ro, rd, vec4( 0.0, 1.0, 0.0,0.0 ) ); if( t>eps && t<res.x ) { res = vec2( t, 1. ); normal = vec3( 0., 1., 0.); }
  t = iPlane( ro, rd, vec4( 0.0, 0.0,-1.0,8.0 ) ); if( t>eps && t<res.x ) { res = vec2( t, 1. ); normal = vec3( 0., 0.,-1.); }
    t = iPlane( ro, rd, vec4( 1.0, 0.0, 0.0,0.0 ) ); if( t>eps && t<res.x ) { res = vec2( t, 2. ); normal = vec3( 1., 0., 0.); }
#ifdef FULLBOX
    t = iPlane( ro, rd, vec4( 0.0,-1.0, 0.0,5.49) ); if( t>eps && t<res.x ) { res = vec2( t, 1. ); normal = vec3( 0., -1., 0.); }
    t = iPlane( ro, rd, vec4(-1.0, 0.0, 0.0,5.59) ); if( t>eps && t<res.x ) { res = vec2( t, 3. ); normal = vec3(-1., 0., 0.); }
#endif

  t = iSphere( ro, rd, vec4( 1.5,1.0, 2.7, 1.0) ); if( t>eps && t<res.x ) { res = vec2( t, 1. ); normal = nSphere( ro+t*rd, vec4( 1.5,1.0, 2.7,1.0) ); }
    t = iSphere( ro, rd, vec4( 4.0,1.0, 4.0, 1.0) ); if( t>eps && t<res.x ) { res = vec2( t, 6. ); normal = nSphere( ro+t*rd, vec4( 4.0,1.0, 4.0,1.0) ); }
    t = iSphere( ro, rd, lightSphere ); if( t>eps && t<res.x ) { res = vec2( t, 0.0 );  normal = nSphere( ro+t*rd, lightSphere ); }
            
    return res;           
}

bool intersectShadow( in vec3 ro, in vec3 rd, in float dist ) {
    float t;
  
  t = iSphere( ro, rd, vec4( 1.5,1.0, 2.7,1.0) );  if( t>eps && t<dist ) { return true; }
    t = iSphere( ro, rd, vec4( 4.0,1.0, 4.0,1.0) );  if( t>eps && t<dist ) { return true; }

    return false; // optimisation: planes don't cast shadows in this scene
}

//-----------------------------------------------------
// materials
//-----------------------------------------------------

vec3 matColor( const in float mat ) {
  vec3 nor = vec3(1.0, 1.0, 1.0);
  
  if( mat<3.5 ) nor = REDCOLOR;
    if( mat<2.5 ) nor = GREENCOLOR;
  if( mat<1.5 ) nor = WHITECOLOR;
  if( mat<0.5 ) nor = LIGHTCOLOR;
            
    return nor;
}

bool matIsSpecular( const in float mat ) {
    return mat > 4.5;
}

bool matIsLight( const in float mat ) {
    return mat < 0.5;
}

// -------------------------------------------------------
// cook torrace microfacet functions
// -------------------------------------------------------
float BeckmanD(vec3 m, vec3 norm)
{
  float NDotM = dot(m, norm);
  
  float positivity = (NDotM > 0.) ? 1.0f : 0.0f;

  float theta_m = clamp(acos(NDotM), -PI / 2. + 0.001f, PI / 2. - 0.001f);
  float coef = -pow(tan(theta_m), 2.) / (alpha * alpha);
  float denom = pow(alpha, 2.) * pow(NDotM, 4.);
  if (denom < 0.001)
    denom = 0.001;
  float total = positivity * max(0.001, exp(coef)) / (PI * denom);
  return total;
}
float SmithG1Approx(vec3 v, vec3 m, vec3 norm)
{ 
  float VDotM = dot(v, m);
  float VDotN = dot(v, norm);

  float theta_v = acos(VDotN);
  float a = 1. / (alpha * tan(theta_v));

  float positivity = (VDotM / VDotN > 0.) ? 1.0 : 0.0;

  if (a < 1.6)
    return (3.535 * a + 2.181 * a * a) / (1. + 2.276 * a + 2.577 * a * a);
  else
    return 1.;
}

vec3 BRDFMicro(vec3 norm, vec3 lDir, vec3 vDir)
{
    vec3 hDir = normalize(lDir + vDir);
    
    float LDotH = max(0.001, dot(lDir, hDir));
  float NDotH = max(0.001, dot(norm, hDir));

  float LDotN = dot(lDir, norm);
  float ODotN = dot(vDir, norm);

  vec3 FresnelTerm = vec3(1.); // not calculating because it doesn't play nice with the light sampling
    // probably not physically correct though :(

  float DistributionTerm = BeckmanD(hDir, norm);

  float GeometryTerm = SmithG1Approx(lDir, hDir, norm) * SmithG1Approx(vDir, hDir, norm);

  float denom = max(0.001, 4. * LDotN * ODotN);

  vec3 f_microfacet = FresnelTerm * GeometryTerm * DistributionTerm / denom;

  return f_microfacet;
}

//-----------------------------------------------------
// brdf
//-----------------------------------------------------
vec3 getTangent(vec3 norm)
{
  vec3 tangent;
  vec3 c1 = cross(norm, vec3(0.0, 0.0, 1.0));
  vec3 c2 = cross(norm, vec3(0.0, 1.0, 0.0));
  if (dot(c1, c1) > dot(c2, c2))
    tangent = c1;
  else
    tangent = c2;
  return tangent;
}

vec3 importanceBRDFHalf(float mat, vec3 norm, vec3 oDir, inout bool specularBounce, inout float seed)
{
    if(!matIsSpecular( mat ))
    {
        vec3 iDir = cosWeightedRandomHemisphereDirection(norm, seed);
        specularBounce = false;
        return normalize(oDir + iDir);
    }
    
    specularBounce = true;
        
    float r1 = hash1(seed);
    float r2 = hash1(seed);
    float theta_m = atan(sqrt(-alpha * alpha * log(1.0 - r1)));
    float phi_m = 2. * PI * r2;

    float mY = cos(theta_m);
    float mX = cos(phi_m) * sin(theta_m);
    float mZ = sin(phi_m) * sin(theta_m);

    vec3 tangent = getTangent(norm);
    vec3 bitangent = cross(norm, tangent);
    vec3 m = normalize(tangent * mX + norm * mY + bitangent * mZ);

    return m;
}



//-----------------------------------------------------
// eyepath
//-----------------------------------------------------

vec3 traceEyePath( in vec3 ro, in vec3 rd, const in bool directLightSampling, inout float seed ) {
    vec3 tcol = vec3(0.);
    vec3 fcol  = vec3(1.);
    
    bool specularBounce = true;
    
    for( int j=0; j<EYEPATHLENGTH; ++j ) {
        vec3 normal;
        
        vec2 res = intersect( ro, rd, normal );
        if( res.y < -0.5 ) {
            return tcol;
        }
        
        if( matIsLight( res.y ) ) {
            if( directLightSampling ) {
              if( specularBounce ) tcol += fcol*LIGHTCOLOR;
            } else {
                tcol += fcol*LIGHTCOLOR;
            }
            return tcol;
        }
        
        vec3 oDir = -rd;
        vec3 m = importanceBRDFHalf(res.y, normal, -rd, specularBounce, seed);
        rd = reflect(rd, m);
        
        // !!! THESE LINES RIGHT HERE. PLEASE CORRECT IF WRONG !!!
        // essentially, the half vector sampling that happens above
        // can produce microfacet normals that don't actually make
        // sense, making the next ray go below the surface normal when
        // they're not supposed to. I don't know how to combat this,
        // so I just do this. I don't know if this biases the render,
        // please mention in the comments if it does. Thanks!
        if (dot(rd, normal) < 0.)
            rd *= -1.;
        
        vec3 iDir = rd;
        
        if (!specularBounce)
        {
          fcol *= matColor( res.y );
        }
        else
        {
            float G = SmithG1Approx(iDir, m, normal) * SmithG1Approx(oDir, m, normal);
            fcol *= vec3(1.,1.,1.) * G * dot(iDir, m) / (dot(iDir, normal) * dot(m, normal));
        }

        ro = ro - res.x * oDir;
        vec3 ld = sampleLight( ro, seed ) - ro;
        
        if( directLightSampling ) {
      vec3 nld = normalize(ld);
            if(j < EYEPATHLENGTH-1 && !intersectShadow( ro, nld, length(ld)) ) {

                float cos_a_max = sqrt(1. - clamp(lightSphere.w * lightSphere.w / dot(lightSphere.xyz-ro, lightSphere.xyz-ro), 0., 1.));
                float weight = 2. * PI * (1. - cos_a_max);
                
                if (!matIsSpecular( res.y ))
                  tcol += (fcol / PI * LIGHTCOLOR) * (weight * clamp(dot( nld, normal ), 0., 1.));
                //else
                    //tcol += LIGHTCOLOR * BRDFMicro(normal, ld, oDir) * (weight * clamp(dot( nld, normal ), 0., 1.));
            }
        }
    }
    if (tcol != tcol)
        return vec3(1.,0., 0.);
    return tcol;
}

//-----------------------------------------------------
// main
//-----------------------------------------------------

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 q = fragCoord.xy / iResolution.xy;
    
  float splitCoord = iMouse.y;
#ifdef SHOWSPLITLINE
    bool directLightSampling = fragCoord.y < splitCoord;
#else
    bool directLightSampling = true;
#endif
    
    //-----------------------------------------------------
    // camera
    //-----------------------------------------------------

    vec2 p = -1.0 + 2.0 * (fragCoord.xy) / iResolution.xy;
    p.x *= iResolution.x/iResolution.y;

#ifdef ANIMATENOISE
    float seed = p.x + p.y * 3.43121412313 + fract(1.12345314312*iTime);
#else
    float seed = p.x + p.y * 3.43121412313;
#endif
    
    vec3 ro = vec3(2.78, 2.73, -8.00);
    vec3 ta = vec3(2.78, 2.73,  0.00);
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));

    //-----------------------------------------------------
    // render
    //-----------------------------------------------------

    vec3 col = vec3(0.0);
    vec3 tot = vec3(0.0);
    vec3 uvw = vec3(0.0);
    
    for( int a=0; a<SAMPLES; a++ )
    {
        vec2 rpof = 4.*(hash2(seed)-vec2(0.5)) / iResolution.xy;
      vec3 rd = normalize( (p.x+rpof.x)*uu + (p.y+rpof.y)*vv + 3.0*ww );
        
        vec3 rof = ro;
        
        initLightSphere( iTime );
        
        col = traceEyePath( rof, rd, directLightSampling, seed );

        tot += col;
        
        seed = mod( seed*1.1234567893490423, 13. );
    }
    
    tot /= float(SAMPLES);
    
#ifdef SHOWSPLITLINE
  if (abs(fragCoord.y - splitCoord) < 1.0) {
    tot = vec3(1.0, 0.0, 0.0);
  }
#endif
    
  tot = pow( clamp(tot,0.0,1.0), vec3(0.45) );

    fragColor = vec4( tot, 1.0 );
}

