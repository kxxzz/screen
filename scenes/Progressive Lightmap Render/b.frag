// this buffer is the lightmap render.
// the lightmap is square, the number of pixels used is LM_RES below.

// i came up with a rough approach for tweaking the convergence variables, similar in spirit
// to the recommended steps for tweaking PID controllers.

// step 1 - set this as high as your gpu can take before the framerate suffers. i like
// to have at least 50fps
#define INDIRECT_RAYS 20
#define DIRECT_RAYS 20
// step 2 - starting convergence rate. low values give poor responsiveness to lighting changes,
// while high values give a fizzy/noisy result while the mouse is moving the lighting. i like
// to set this as high as possible
#define START_CONV .4
// step 3 - after the mouse has settled, the image will start to converge. set this speed
// to as high as possible, before the scene starts failing to converge. watch for bright spots
// from the light being close to the wall failing to disappear after the light moves.
#define CONV_SPEED 5.

#define PI 3.14159
#define DIST_MAX 1000.
float LM_RES;

#define LIGHTCOLOR vec3(16.86, 14.76, 10.2)*1.3*9.
#define LIGHTR 0.25
#define WHITECOLOR vec3(.7295, .7355, .729)*0.7
#define GREENCOLOR vec3(.117, .4125, .115)*0.7
#define REDCOLOR vec3(.611, .0555, .062)*0.7


// borrowed from https://www.shadertoy.com/view/4dBXWw
float seed, seed2, haltonIndex;
float rnd() { return fract(sin(seed++)*43758.5453123); }
vec3 uniformHemisphere(float u1, float u2);
vec3 cosWeightedRandomHemisphereDirection( const vec3 n );
vec3 l2w(vec3 l,vec3 normal);
//vec2 Halton();

struct Quad
{
    vec3 p;
    vec3 n;
    vec2 scl;
    vec2 uv_c; // uv center
    vec2 uv_wh; // wh of quad in uv space
    int col;
};

#define QUAD_COUNT 10
Quad quads[QUAD_COUNT];

vec3 GetColor( int idx )
{
    if( idx == 0 ) return WHITECOLOR; //vec3(1.,.99,.8); // white
    if( idx == 1 ) return REDCOLOR; //vec3(1.,.3,.3); // red
    if( idx == 2 ) return GREENCOLOR;//vec3(.3,1.,.3); // green
    return vec3(.3,.3,1.); // blue
}

void InitScene()
{
    // current lightmap packing:
    //         ___
    //        | T |
    //     ___|___|___
    //    | L | B | R |
    //    |___|___|___|
    //Box +XYZ| F |
    //    -X Z|___|
    //
    
    // block - first because a hit on this is likely to be closer than background walls,
    // so only compute local frame etc once
    vec3 bc = vec3(0.,-3.5,0.);
    quads[ 0] = Quad( bc+vec3(0.,0.,-1.5),  vec3(0.,0.,-1.),    vec2(3.),   vec2(2.5/9.,.5/6.), vec2(1./9.,1./6.),  3 );
    quads[ 1] = Quad( bc+vec3(1.5,0.,0.),   vec3(1.,0.,0.),     vec2(3.),   vec2(.5/9.,1.5/6.), vec2(1./9.,1./6.),  3 );
    quads[ 2] = Quad( bc+vec3(-1.5,0.,0.),  vec3(-1.,0.,0.),    vec2(3.),   vec2(.5/9.,.5/6.),  vec2(1./9.,1./6.),  3 );
    quads[ 3] = Quad( bc+vec3(0.,1.5,0.),   vec3(0.,1.,0.),     vec2(3.),   vec2(1.5/9.,1.5/6.),vec2(1./9.,1./6.),  3 );
    quads[ 4] = Quad( bc+vec3(0.,0.,1.5),   vec3(0.,0.,1.),     vec2(3.),   vec2(2.5/9.,1.5/6.),vec2(1./9.,1./6.),  3 );
    
    // floor
    quads[ 5] = Quad(   vec3(0.,-5.,0.),    vec3(0.,1.,0.),     vec2(10.),  vec2(0.5,1./6.),    vec2(1./3.,1./3.),  0 );
    // back
    quads[ 6] = Quad(   vec3(0.,0.,5.),     vec3(0.,0.,-1.),    vec2(10.),  vec2(0.5,.5),       vec2(1./3.,1./3.),  0 );
    // ceil
    quads[ 7] = Quad(   vec3(0.,5.,0.),     vec3(0.,-1.,0.),    vec2(10.),  vec2(0.5,5./6.),    vec2(1./3.,1./3.),  0 );
    // left wall
    quads[ 8] = Quad(   vec3(-5.,0.,0.),    vec3(1.,0.,0.),     vec2(10.),  vec2(1./6.,.5),     vec2(1./3.,1./3.),  1 );
    // right wall
    quads[ 9] = Quad(   vec3(5.,0.,0.),     vec3(-1.,0.,0.),    vec2(10.),  vec2(5./6.,.5),     vec2(1./3.,1./3.),  2 );
    // front
    //quads[10] = Quad( vec3(1000.,0.,-5.), vec3(0.,0.,1.),     vec2(0.),   vec2(100./6.,.5),   vec2(1./3.,1./3.),  0 );
    
    // bring in by HALF a pixel on each edge to stop lerping into the lightmap for another quad
    for( int i = 0; i < QUAD_COUNT; i++ )
    {
        quads[i].uv_wh -= 1./LM_RES;
    }
}


// uv - lightmap uv in [0,1]^2
// out - world position
vec3 uvToWorld( vec2 uv, out vec3 n )
{
    for( int i = 0; i < QUAD_COUNT; i++ )
    {
        vec2 uvoff = (uv - quads[i].uv_c)/quads[i].uv_wh;
        if( abs(uvoff.x) < .5
         && abs(uvoff.y) < .5 )
        {
            n = quads[i].n;
            uvoff *= quads[i].scl;
            vec3 u = l2w( vec3(1.,0.,0.), quads[i].n );
            vec3 v = l2w( vec3(0.,0.,1.), quads[i].n );
            return quads[i].p + uvoff.x * u + uvoff.y * v;
        }
    }
    
    return n = vec3(0.);
}

// will return either NaN or negative number if no intersection!
float rayPlane( vec3 ro, vec3 rd, vec3 po, vec3 pn )
{
    return -dot( ro - po, pn ) / dot( rd, pn );
}
// if this returns false, uv will be incorrect (offset by 0.5)
bool rayQuadUV( vec3 ro, vec3 rd, vec3 po, vec3 pn, vec2 psz, out vec2 uv, out float rt )
{
    rt = rayPlane( ro, rd, po, pn );
    if( !(rt > 0.) ) return false; // NaN caught here!
    vec3 pos = ro + rt * rd;
    float x = dot(pos - po, l2w( vec3(1.,0.,0.), pn ) );
    float y = dot(pos - po, l2w( vec3(0.,0.,1.), pn ) );
    uv = vec2(x,y)/psz;
    if( abs(uv.x) >= .5001 || abs(uv.y) >= .5001 ) return false;
    uv += .5; 
    return true;
}
// rd does not have to be normalized - this is used as an optimisation in the primary light raycast
float castRay( vec3 ro, vec3 rd, out vec2 uv, out vec3 col, out vec3 n )
{
    uv = vec2(0.); n = uv.xxx;
    
    float rt = DIST_MAX;
    for( int i = 0; i < QUAD_COUNT; i++ )
    {
        vec2 uvi; float rti;
        if( rayQuadUV( ro, rd, quads[i].p, quads[i].n, quads[i].scl, uvi, rti ) 
          && rti < rt )
        {
            uv = quads[i].uv_c + (uvi-.5)*quads[i].uv_wh;
            col = GetColor(quads[i].col);
            n = quads[i].n;
            rt = rti;
        }
    }
    
    return rt;
}

//vec4 hash4( vec2 p ) { return fract(sin(vec4( 1.0+dot(p,vec2(37.0,17.0)), 2.0+dot(p,vec2(11.0,47.0)), 3.0+dot(p,vec2(41.0,29.0)), 4.0+dot(p,vec2(23.0,31.0))))*103.); }

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    LM_RES = .75*iResolution.y;
    
    fragColor.w = 0.;
    
    vec2 uv = fragCoord/LM_RES;
    
    if( uv.x >= 1. || uv.y >= 1. )
    {
        fragColor = vec4(0.);
        return;
    }
    
    InitScene();
    
    vec3 n;
    vec3 pos = uvToWorld( uv, n );
    if( dot(pos,pos) < 0.0001 ) // zero position means this lightmap texel is not being used
    {
        fragColor = vec4(0.);
        return;
    }
    
    seed = 1.19364353*(fragCoord.x + LM_RES*fragCoord.y) + float(iFrame)/60.*12.37929;
    haltonIndex = 1.;
    
    vec2 p = -1.0 + 2.0 * (fragCoord.xy) / iResolution.xy;
    p.x *= iResolution.x/iResolution.y;
    seed2 = p.x + p.y * 3.43121412313 + fract(1.12345314312*iTime);

    vec3 addLight = vec3(0.);
    
    // cast a ray in a random direction to collect radiance
    for( int i = 0; i < INDIRECT_RAYS; i++ )
    {
        // from https://www.shadertoy.com/view/4tcXD2
        // doesn't need pdf term - cancels out: http://www.rorydriscoll.com/2009/01/07/better-sampling/
        vec3 dir = cosWeightedRandomHemisphereDirection( n );

        vec2 hituv; vec3 col; vec3 n;
        float dist = castRay( pos, dir, hituv, col, n );
        if( dist < DIST_MAX && dot( n, dir ) < 0. )
        {
            vec2 LM_UV_SCALE = LM_RES/iResolution.xy;
            addLight += col * textureLod( iChannel0, hituv*LM_UV_SCALE, 0. ).xyz;
        }
    }
    addLight /= float(INDIRECT_RAYS);
    
    // sample random point on sphere light
    vec3 lc = vec3(-2.,-3.,-1.5);
    vec2 m = iMouse.xy;
    //m = iResolution.xy/2. + vec2(100.*sin(4.*iTime),0.);
    if( iMouse.z > 0. && (m.x > LM_RES/2. || m.y > LM_RES/2.) )
        lc = vec3(22.*(m.x/iResolution.x-.5),-6.+12.*m.y/iResolution.y,-3.+6.*m.x/iResolution.x);
    
    vec3 directLight = vec3(0.);
    for( int i = 0; i < DIRECT_RAYS; i++ )
    {
        vec3 lp = LIGHTR*normalize(vec3(rnd(),rnd(),rnd())-.5) + lc;
        vec3 lv = (lp-pos);
        float ldp = dot(lv,n);
        if( ldp < 0. )
            continue;

        vec2 luv; vec3 col, ln;
        float first_coll = castRay( pos, lv, luv, col, ln ); // lv is NOT normalised..
        if( first_coll > 1. ) // lv is NOT normalised..
        {
            vec3 nlv = normalize(lv);
            float cos_a_max = sqrt(1. - clamp(LIGHTR * LIGHTR / dot(lc-pos, lc-pos), 0., 1.));
            float weight = 2. * (1. - cos_a_max);

            directLight +=  LIGHTCOLOR * (weight * clamp(dot( nlv, n ), 0., 1.));
        }
    }
    addLight += directLight / float(DIRECT_RAYS);
    
    float btnTime = textureLod(iChannel1,.5/iResolution.xy, 0.).w;
    float convergeFactor = START_CONV / (CONV_SPEED*btnTime+1.);
    
    fragColor.xyz = mix( textureLod( iChannel0, fragCoord/iResolution.xy, 0. ).xyz, addLight, convergeFactor );
}

// from reindeer: https://www.shadertoy.com/view/4tl3z4
vec2 hash2() {
    return fract(sin(vec2(seed2+=0.1,seed2+=0.1))*vec2(43758.5453123,22578.1459123));
}
vec3 cosWeightedRandomHemisphereDirection( const vec3 n ) {
    vec2 r = hash2();
    //vec2 r = Halton();
    
    vec3  uu = normalize( cross( n, vec3(0.0,1.0,1.0) ) );
    vec3  vv = cross( uu, n );
    
    float ra = sqrt(r.y);
    float rx = ra*cos(6.2831*r.x); 
    float ry = ra*sin(6.2831*r.x);
    float rz = sqrt( 1.0-r.y );
    vec3  rr = vec3( rx*uu + ry*vv + rz*n );
    
    return normalize( rr );
}

/*
// from http://www.rorydriscoll.com/2009/01/07/better-sampling/ 
vec3 cosineSampleHemisphere(float u1, float u2)
{
    const float r = Sqrt(u1);
    const float theta = 2 * kPi * u2;
 
    const float x = r * Cos(theta);
    const float y = r * Sin(theta);
 
    return Vector3(x, y, Sqrt(Max(0.0f, 1 - u1)));
}
*/

vec3 uniformHemisphere(float u1, float u2)
{
    float r=sqrt(1.-u1*u1);
    float phi=2.*PI*u2;
    return vec3(r*cos(phi),u1, r*sin(phi));
}

vec3 l2w( vec3 l,vec3 normal )
{
    vec3 binormal,tangent;
    if( abs(normal.x) > abs(normal.z) )
    {
        binormal.x = -normal.y; binormal.y = normal.x; binormal.z = 0.;
    }
    else
    {
        binormal.x = 0.; binormal.y = -normal.z; binormal.z = normal.y;
    }
    binormal = normalize(binormal);
    tangent = cross( binormal, normal );
    return l.x*tangent + l.y*normal + l.z*binormal;
}

/*
vec2 Halton( float index, float base );
vec2 Halton()
{
    vec2 result = vec2( Halton(haltonIndex,2.), Halton(haltonIndex,3.) );
    haltonIndex++;
    return result;
}
float Halton( float index, float base )
{
    float result = 0.;
    float f = 1.;
    float i = index;
    
    for( int c = 0; c < 32; c++ )
    {
        f /= base;
        i = floor( i / base );
        result += f * mod(i, base);
        if( i == 0. ) break;
    }
    
    return result;
}
*/

