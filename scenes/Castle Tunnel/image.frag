/**
 * Castle Tunnel v 1.1
 * Author: Gerard Geer (http://gerardgeer.com)
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
 *
 * This is a wild adventure in multipass and goofy lighting tricks.
 * Buffer A: Marches out to the first intersection, and stores it.
 * Buffer B: Takes Buffer A's results and calculates the surface normal.
 * Buffer C: Takes all that and calculates texturing for each pixel.
 * Buffer D: Uses an ultra simplified DF and fixt-stehp marching for
 *           those sick crepuscular rays.
 * Image:    Calculates the rest of the lighting and composites everything.
 *
 * Oh and by the way, turning the sconces on looks awful. Leave those lamps
 * off :)
 * 
 * Based loosely on this pciture here:
 * https://commons.wikimedia.org/wiki/File:Tunnels_in_Cardiff_Castle.jpg
 *
 *  * If you want a slight speed boost, you can turn off sampled normal mapping
 *    sampled normal mapping by commenting out DO_IMG_NORM_MAPS in buffer B.
 *  * You can also turn off the crepuscular rays by commenting out 
 *    GO_AHEAD_AND_MAKE_ME_CREPES_FOR_BREAKFAST in buffer D.
 *  * I really wish there was a pre-pre processing step here that would allow us
 *    to have global stuff. I'd write it for you.
 */

// Fine, if you insist. We even took out the stained glass so you could have
// enough light without them.
// #define TURN_THE_LIGHTS_ON_IN_HERE

// Occlusion samples.
#define OCC_SAMPLES 4.0
// Occlusion attenuation samples.
#define OCC_FACTOR 1.5
// Light and reflection penumbra factors.
#define PENUMBRA_FACTOR 80.0
// Oren-Nayar material reflectance coefficient.
#define MAT_REFLECTANCE 4.0
// Main marching steps.
#define V_STEPS 120
// Shadow marching steps.
#define S_STEPS 100
// Maximum acceptable marching result.
#define EPSILON .015
// Max ray depth.
#define MAX_DEPTH 100.0

// Entity IDs.
#define ID_NONE     0.0
#define ID_GROUND   1.0
#define ID_WALLS    2.0
#define ID_CEILING  3.0
#define ID_CUTOUT   4.0
#define ID_CUTCEIL  5.0
#define ID_CAULDR   6.0
#define ID_CANDLES  7.0
#define ID_WINDOW   8.0
#define ID_END      9.0

// iChannel definitions.
#define POS_BUFF iChannel0
#define NRM_BUFF iChannel1
#define TEX_BUFF iChannel2
#define SFT_BUFF iChannel3

// Some constants for rendering.
#define BUFF_RES iChannelResolution[0].xy
const vec2 TX_CPOS = vec2(2,2);                     // The pixel in which we store the camera position.
const vec3 UP = vec3(0.0, 1.0, 0.0);                // An up vector.
const vec3 SUN_DIR = vec3(0.894427, 0.357771, -0.268328);   // Sun direction.
const vec3 SKY_COLOR = vec3(0.53,0.81,0.92);        // Sky color.
const vec3 SUN_COLOR = vec3(4.0);                   // Sun color.
const vec3 GROUND_COLOR = vec3(0.73,0.70,0.75);     // Average color of the ground for GI.
const vec3 TILEA = vec3(.4, .4, .366);              // The fist tile color.
const vec3 TILEB = vec3(0.32, 0.32, 0.2928);        // ... and the second as well.

/* 
    Reads a texel from a sampler2D at a given position.
*/
vec4 readTexel( in sampler2D buff, in vec2 p )
{
    return texture(buff, (p+.5)/BUFF_RES);
}

/* 
    Buff is a value that must be written to fragCoord.
    if the current frag coord is that of where we want to store
    our data, buff is overwritten. Otherwise, buff is returned
    as is.
*/
void write3( inout vec3 buff, in vec3 v, in vec2 p, in vec2 fc )
{
    vec2 off = abs(p-floor(fc));
    buff = mix( v, buff, step(.1,max(off.x,off.y)) );
}

/*
    Returns a psuedo random value given a 3D vector.
    From IQ's 3D Voronoi noise.
*/
float hash( vec3 x )
{
    x = vec3( dot(x,vec3(127.1,311.7, 74.7)),
              dot(x,vec3(269.5,183.3,246.1)),
              dot(x,vec3(113.5,271.9,124.6)));

    return fract(length(sin(x)*43758.5453123));
}

/*
    Returns a psuedo-random value given a 2D vector.
    Not at all, 0% based on IQ's hash function.
*/
float hash( vec2 x )
{
    x = vec2( dot(x,vec2(311.7, 74.7)),
              dot(x,vec2(183.3,246.1)));

    return fract(length(sin(x)*43758.5453123));
}

/*
    Oh no! We're out of iChannels! Looks like we
    have to use IQ's procedural noise.
*/
float hash( float n ) { return fract(sin(n)*753.5453123); }
float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    
    float n = p.x + p.y*157.0 + 113.0*p.z;
    return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                   mix( hash(n+157.0), hash(n+158.0),f.x),f.y),
               mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                   mix( hash(n+270.0), hash(n+271.0),f.x),f.y),f.z);
}

/*
    A 2D bumpmap of bricks. This is used for the ceiling.
*/
float brickBump( in vec2 p, in float s )
{
    p.x *= .5;
    p.x += .5*floor(mod(p.y,2.0));
    vec2 f = 2.0-fract(p) - 1.0;
    return smoothstep(s,1.0,max(f.x,f.y));
}

/*
    This provides the tile bumpmap for the ground.
*/
float groundBump( in vec3 p )
{
    vec3 f = fract(p);
    return smoothstep(.966,.975,max(f.x,max(f.y,f.z)));
}

/*
    Creates the bumpmap for the wall. This is the simple version that's
    defined in 2D space. It's used for the walls and the endcaps.
*/
float wallBump2D( in vec2 p )
{
    p *= 2.0;
    p.x *= .5;
    p.x += .5*floor(mod(p.y,2.0));
    
    vec2 f = 2.0*fract(p) - 1.0;
    float r = 1.0 - smoothstep(.825,.95,max(f.x,f.y));
    r *= .1 + hash(800.0*floor(p))*.8;
    return 1.0 - r;
}

/*
    The 3D version, on the other hand is defined in R^3 to be used in
    the cutouts.
*/
float wallBump3D( in vec3 p )
{
    p *= 2.0;
    p.z *= .5;
    p.z += .5*floor(mod(p.y,2.0));
    
    vec3 f = 2.0*fract(p) - 1.0;
    float r = 1.0 - smoothstep(.825,.95,max(f.x,max(f.y,f.z)));
    r *= .1 + hash(800.0*floor(p))*.8;
    return 1.0 - r;
}

/*
    Samples a texture in each of R^3s principle hyperplanes, and
    then uses the given surface normal to return a linear combination
    of those samples.
*/
vec3 tex3D( in sampler2D t, in vec3 p, in vec3 n )
{
    n = abs(n);
    return texture(t,p.xy).rgb*n.z
          +texture(t,p.xz).rgb*n.y
          +texture(t,p.zy).rgb*n.x;
}

/*
    Takes a vec2 containing a distance and a primitive's ID and returns
    the ID and distance of the nearer primitive, effectively performing
    a solid modeling union.
*/
vec2 u(vec2 a, vec2 b )
{
    if(a.s < b.s) return a;
    else return b;
}

/*
    The seminal signed cube distance function. Back in the early
    days IQ crafted this golden workhorse. Thank him.
*/
float box( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) +
           length(max(d,0.0));
}

/*
    An infinitely long box that extends along the X axis.
    An adaptation of IQ's box.
*/
float xBox( vec3 p, vec2 b )
{
    vec2 d = abs(p.zy) - b;
    return min(max(d.x,d.y),0.0) +
           length(max(d,0.0));
}

/*
    And another that goes down the Z.
*/
float zBox( vec3 p, vec2 b )
{
    vec2 d = abs(p.xy) - b;
    return min(max(d.x,d.y),0.0) +
           length(max(d,0.0));
}

/*
    A capped cylinder along the X axis. IQ's again.
*/
float xCapCyl( vec3 p, vec2 c )
{
    // This is basically an infinite cylinder that's being chopped
    // by a bounds.
    vec2 d = abs(vec2(length(p.zy),p.x)) - c;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

/*
    Another that stands up tall along the Y axis.
*/
float yCapCyl( vec3 p, vec2 c )
{
    vec2 d = abs(vec2(length(p.xz),p.y)) - c;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

/*
    A cylinder that extends infinitely along the Z axis.
*/
float zCyl( vec3 p, float r )
{
    return length(p.xy)-r;
}

/*
    IQ's pill function.
*/
float capsule( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
}

/*
    The base tunnel. It's an infinite box, with the middle hollowed
    out by another.
*/
float baseTunnel( in vec3 p )
{
    float d =  max( zBox(p-vec3(0,6,0),vec2(5,7)),
                   -zBox(p-vec3(0,6,0),vec2(3,6)));
    float f = 0.0;
    if ( d > EPSILON*8.0 ) return d;
    else if ( p.y > .15 )  return d + wallBump2D(p.zy)*.15;
    else return d + groundBump(p)*.05;
}

/*
    These form the far walls. We make these their own subfield so that
    we can use a 2D distance function on them and the walls. (As well as
    a 2D texturing function.)
*/
float yourPathEndsHere( in vec3 p )
{
    p.z = mod(p.z,172.0)-86.0;
    float d = box(p,vec3(5,12,1));
    if ( d > EPSILON*8.0 ) return d;
    else return d + wallBump2D(p.xy)*.15;
}

/*
    The ceiling is actually a really large hollowed cylinder. It's
    intersected with the main tunnel so that only the ceiling
    part remains.
*/
float ceiling( in vec3 p )
{
    p.y *= .75;
    float r = max( zCyl(p,8.0),
                  -zCyl(p,7.5));
    r = max(r,zBox(p-vec3(0,6,0),vec2(4,6))); // Trim the excess that is outside the tunnel.
    if( r > EPSILON ) return r;
    else return r + brickBump(p.zx,.975)*.1;
}

/*
    This subfield is just the windowpanes. It's actually just
    one big pane, but nobody's tellin.
*/
float windowPanes( in vec3 p )
{
    return abs(p.x-4.33);
    p.x -= 4.33;
    p.y -= 4.5;
    p.z = mod(p.z,15.0)-7.5;
    return box(p,vec3(.5));
}

/*
    The subfield that cuts out holes in the side of the tunnel. It's
    also a box intersected with a cylinder.
*/
float windowCutouts( in vec3 p )
{
    // Base transformations to get them into position.
    vec3 q = p;
    p.y -= 5.0;
    p.x -= 3.0;
    p.z = mod(p.z, 15.0)-7.5; // Repeat along the Z axis.
    
    // Create copies of the position for the cylinder and the cube.
    vec3 c = p, b = p;
    // Do independent transformations for both parts.
    c.y *= .75;
    b.y -= 4.0;
    // Here's the base distance sampling. Notice how we combine the xBox and 
    // the xCapCyl.
    float r =  max(xBox(b,vec2(1.5,4.5)),
                   xCapCyl(c,vec2(3,4.0)));
    
    // Displacement mapping. If we're a safe distance away, we don't need to
    // worry about calculating the surface. Otherwise...
    if( r > EPSILON ) return r;
    else if( p.y > 3.366 ) return r;// + (1.0-brickBump(p.xy*2.0,.95))*.1;
    else return r+.15-wallBump3D(q)*.12;
}

/*
    This subfield is max()'d with the tunnel to scallop those bits below
    the window. It's just a positioned and mod()'d cube.
*/
float windowScallops( in vec3 p )
{
    vec3 q = p;
    p.x -= 3.0;
    p.y -= 4.0;
    p.z = mod(p.z,15.0)-7.5;
    float r = box(p,vec3(1,4.0,1.5));
    if( r > EPSILON ) return r;
    else return r+.15-wallBump3D(q)*.12;
}

/*
    A smooth version of the window cutout used for the window texture.
*/
float windowFrame( in vec3 p )
{
    // Base transformations to get them into position.
    p.y -= 5.0;
    p.x -= 3.0;
    p.z = mod(p.z, 15.0)-7.5; // Repeat along the Z axis.
    
    // Create copies of the position for the cylinder and the cube.
    vec3 c = p, b = p;
    // Do independent transformations for both parts.
    c.y *= .75;
    b.y -= 4.0;
    // Here's the base distance sampling. Notice how we combine the xBox and 
    // the xCapCyl.
    return max(xBox(b,vec2(1.5,4.5)),
               xCapCyl(c,vec2(3,4.0)));
}

/*
    The candles are just a cylinder.
*/
float candles( in vec3 p )
{
    // These need to be on top of the bottom of the cauldrons, so we have 
    // to elevate them.
    p += vec3(2.4,-7.9,7.5);
    p.z = mod(p.z,15.0)-7.5; // Repeat.
    return yCapCyl(p,vec2(.1,.2));
}

/*
    The cauldrons that house the candles on the other hand
    are a bunch of boxes that subtract from a hollowed box,
    plus two more for the mount.
*/
float cauldrons( in vec3 p )
{
    p += vec3(2.4,-8,7.5); // Translate.
    p.z = mod(p.z,15.0)-7.5; // Repeat.
    
    vec3 q = p; // For the cage.
    q.xz *= 1.0 - (q.y-.5)*.5; // Smush it.
    
    // Start out with a hollowed cube.
    float r = max(-box(q,vec3(.3)*.9),
                   box(q,vec3(.3)));
    
    
    // Then chop out an x-shaped portion with boxes.
    q = mod(q,.3)-.15;
    float cutout = min(xBox(q,vec2(.125)),zBox(q,vec2(.125)));
    r = max(r,-cutout);
    // now we need to make an arm and a mount, with two other box calls.
    p.x += .35;
    r = min(r,box(p,vec3(.175,.025,.025)));
    p.x += .2;
    return min(r,box(p,vec3(.015,.25,.25)));
}

/*
    This field is roughly the shape of the sky light's cast into the
    tunnel. This allows us to use the distance to it as the lighting
    coefficient.
    Okay it's just a magic floating triangle thingy.
*/
float sketchySkyEmitter( in vec3 p )
{
    p.z = mod(p.z, 15.0)-7.5;
    p.y -= 4.0;
    float squish = 1.5 - p.x*.75;
    return box(p,vec3(1.5,3.0,squish));
}

/*
    This is the same idea, except for secondary illumination off the
    wall. It's a giant floating pill!
*/
float sketchySecEmitter( in vec3 p )
{
    p.z = mod(p.z, 15.0)-7.5;
    return capsule(p,vec3(1.0,3.0,0.0),
                     vec3(1.0,7.0,0.0),
                     1.0);
}

/*
    The global distance function.
*/
float dist( in vec3 p )
{
    float r = baseTunnel(p);
    r = min(r,ceiling(p));
    r = max(r,-windowCutouts(p));
    r = max(r,-windowScallops(p));
    r = min(r,cauldrons(p));
    r = min(r,windowPanes(p));
    r = min(r,yourPathEndsHere(p));
    return min(r,candles(p));
}

/*
    A simpler distance function that the shadows
    use. It doesn't take into account the cauldrons
    or the ceiling since neither are ever left unoccluded
    by something else.
*/
float sDist( in vec3 p )
{
    float r = baseTunnel(p);
    r = max(r,-windowCutouts(p));
    return max(r,-windowScallops(p));
}
/*
    An even simpler shadow distance function for the candles.
    The only thing those rays need to hit are the cauldrons.
*/
float csDist( in vec3 p )
{
    float r = baseTunnel(p);
    return min(r,cauldrons(p));
}

/*
    Returns the id and distance of the nearest entity.
*/
float distID( in vec3 p )
{
    // Since the window cutout subfields exist WITHIN the base tunnel and ceiling,
    // we have to make sure negative values don't get into the comparison. Using
    // abs() instead of max() has the added benefit of biasing towards those cutout
    // bits.
    vec2 closest = u(vec2(abs(ceiling(p))+EPSILON, ID_CEILING),
                     vec2(abs(baseTunnel(p)), mix(ID_GROUND,ID_WALLS,step(.1,p.y))));
         closest = u(closest, vec2(abs(windowCutouts(p)), mix(ID_CUTOUT,ID_CUTCEIL,step(8.425,p.y))));
         closest = u(closest, vec2(abs(windowScallops(p)),ID_CUTOUT));
         closest = u(closest, vec2(cauldrons(p), ID_CAULDR));
         closest = u(closest, vec2(candles(p), ID_CANDLES));
         closest = u(closest, vec2(windowPanes(p), ID_WINDOW));
         closest = u(closest, vec2(yourPathEndsHere(p), ID_END));
    return closest.t;

}

/*
    Returns the surface normal of the distance field at the given
    point p.
*/
vec3 norm( vec3 p )
{
    return normalize(vec3(dist(vec3(p.x+EPSILON,p.y,p.z)),
                          dist(vec3(p.x,p.y+EPSILON,p.z)),
                          dist(vec3(p.x,p.y,p.z+EPSILON)))-dist(p));
}

/*
    The ray-marching function. Marches a point p along a direction d
    until it reaches a point within a minimum distance of the distance
    field.
*/
void march( inout vec3 p, vec3 d )
{
    float r = dist(p+d*EPSILON);
    for(int i = 0; i < V_STEPS; i++)
    {
        if(r < EPSILON || r > MAX_DEPTH)
            return;
        p += d*r*.5;
        r = dist(p);
    }
    return;
}

/*
    March-from-surface-to-light shadowing, with IQ's glancing penumbras.
*/
float shadow( in vec3 start, in vec3 ldir, in float md, in float p )
{    
    float t = EPSILON*4.0;
    float res = 1.0;
    for ( int i = 0; i < S_STEPS; ++i )
    {        
        float d = sDist( start + ldir * t );
        if ( d < EPSILON )
            return 0.0;
        
        res = min( res, p * d / t );
        t += d*.25;
        
        if ( t > md)
            break;
    }
    return res;
}

/*
    March-from-surface-to-light shadowing, with IQ's glancing penumbras.
*/
float cShadow( in vec3 start, in vec3 ldir, in float md, in float p )
{    
    float t = EPSILON*4.0;
    float res = 1.0;
    for ( int i = 0; i < S_STEPS; ++i )
    {        
        float d = csDist( start + ldir * t );
        if ( d < EPSILON )
            return 0.0;
        
        res = min( res, p * d / t );
        t += d*.25;
        
        if ( t > md)
            break;
    }
    return res;
}

/*
    IQ's really compact implementation of Oren Nayar reflectance. How he
    goes from the Wikipedia implementation to this I would enjoy learning.
*/
float orenNayar( in vec3 n, in vec3 v, in vec3 ldir )
{
    float r2 = pow(MAT_REFLECTANCE, 2.0);
    float a = 1.0 - 0.5*(r2/(r2+0.57));
    float b = 0.45*(r2/(r2+0.09));

    float nl = dot(n, ldir);
    float nv = dot(n, v);

    float ga = dot(v-n*nv,n-n*nl);

    return max(0.0,nl) * (a + b*max(0.0,ga) * sqrt((1.0-nv*nv)*(1.0-nl*nl)) / max(nl, nv));
}

/*
    Calculates the ambient occlusion factor at a given point in space.
    Uses IQ's marched normal distance comparison technique.
*/
float occlusion(vec3 pos, vec3 norm)
{
    float result = .0;
    float s = -OCC_SAMPLES;
    const float unit = 1.0/OCC_SAMPLES;
    for(float i = unit; i < 1.0; i+=unit)
    {
        result += pow(2.0,i*s)*(i-dist(pos+i*norm));
    }
    return 1.0-result*OCC_FACTOR;
}

/*
    Calculates lighting for a given point.
*/
vec3 light( in vec3 p, in vec3 d, in vec3 e, in vec3 n )
{
    // Get ambient occlusion and shadow values.
    float amb = occlusion(p,n);
    
    // Get light colors and irradiance for the sun light.
    vec3 sun = orenNayar(n,-d,SUN_DIR)*SUN_COLOR;
    // Shadow the sunlight.
    float sdw = shadow(p,SUN_DIR,MAX_DEPTH,PENUMBRA_FACTOR);
    
    
    // Do our distance based sky and secondary lighting.
    float skyd = sketchySkyEmitter(p);
    vec3 sky = clamp(1.0-skyd*.33,.0,1.0)*SKY_COLOR*.25;
    float secd = sketchySecEmitter(p);
    vec3 sec = clamp(1.0/secd,.0,1.0)*SUN_COLOR*.133;
    
    // We're not gonna use P anymore, so let's just reuse it.
    
    //-------------------------------------------------------
    // IT'S CANDLE TIME.
    //-------------------------------------------------------
    #ifdef TURN_THE_LIGHTS_ON_IN_HERE
        // First we make some animation constants.
        float t = iTime * 6.0;
        // Animate the position.
        vec3 pAnim = vec3(noise(p+t),noise(p+1.0-t),noise(p+1.5+t))*.01;
        // Animate the brightness based on time, as well as
        // the 15 unit section in which the candle resides.
        float bAnim = noise(vec3(t+floor((p-vec3(0,0,7.5))*.06667)));

        // Use the same modulo as the candles.
        vec3 q = p+vec3(2.4,-8.0,7.5);
        q.z = mod(q.z,15.0)-7.5;

        // Move it around like it's a candle flame.
        q += pAnim;

        // Get the direction to the *nearest* candle.
        vec3 cDir = -normalize(q); 

        // Do lighting on that point, and work in the
        // brightness animation.
        vec3 can = orenNayar(n,-d,cDir)*vec3(.5,.45,.4)*bAnim;

        // Calc shadows from the cauldron.
        float cSdw = cShadow(p,cDir,length(q),PENUMBRA_FACTOR*.5)*.25;
    #else
        vec3 can = vec3(0);
        float cSdw = 0.0;
    #endif
    
    // Modulate all the lighting results by 
    sec *= amb;
    sky *= amb;
    sun *= sdw;
    can *= cSdw;
    
    // Return the sum.
    return sec+sky+sun+can;
}
/*
    Shades a point, giving it lighting and taking into account distance.
*/
vec3 shade( in vec3 p, in vec3 d, in vec3 t, in float i, in vec3 n, in vec3 e )
{
    // Get the position's distance from the camera.
    float l = length(p-e);
    // And let's get the culled color since we need it.
    vec3 cull = vec3(.06);
    // Shortcut the glass.
    if( i == ID_WINDOW ) return t;
    // Brighten the candles if we need to.
    #ifdef TURN_THE_LIGHTS_ON_IN_HERE
    else if( i == ID_CANDLES ) return t*.75;
    #endif
    // If the ray didn't hit anything, we shortcut out.
    if(l >= MAX_DEPTH)return vec3(.05);
    // Otherwise we do texturing and lighting for this point.
    vec3 result = t*light(p,d,e,n);
    // Smooth out the transition between geometry and emptiness.
    return mix(cull,result,clamp(MAX_DEPTH-l,0.0,1.0));
}

/*
    Performs some quick post-processing. Does gamma correction
    and adds a soft vignette just to make whatever you're doing
    look pretty.
*/
vec3 postProcess( vec2 uv, vec3 c )
{
    float vig = 1.0-dot(uv,uv)*.3;
    return pow(c,vec3(1.0/2.2))*vig;
}

/*
    Shadertoy's entry point.
*/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //fragColor = texture(SFT_BUFF,fragCoord/iResolution.xy);return;
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    uv.x *= iResolution.x/iResolution.y; //fix aspect ratio
    
    // Position, direction, texture, normal, crapuscular ray coeff, and eye position.
    vec3 p,d,t,n,c,e;
    float i,s; // Entity ID and shutter.
    
    // Load the fragment position and entity ID.
    vec4 posData = texture(POS_BUFF,fragCoord/iResolution.xy)*vec4(1000,1000,1000,1);
    // Load the camera position and shutter value.
    vec4 camData = readTexel(POS_BUFF,TX_CPOS);
    p = posData.xyz;
    e = camData.xyz;
    d = normalize(p-e);
    t = texture(TEX_BUFF,fragCoord/iResolution.xy).rgb;
    n = texture(NRM_BUFF,fragCoord/iResolution.xy).rgb;
    c = texture(SFT_BUFF,fragCoord/iResolution.xy).rgb;
    i = posData.w;
    s = camData.w;
    
    // Store the final pixel color.
    fragColor = postProcess(uv,shade(p,d,t,i,n,e)+c).rgbb*s;
}

/*
    The Shadertoy VR entrypoint.
*/
void mainVR( out vec4 fragColor, in vec2 fragCoord, 
            in vec3 fragRayOri, in vec3 fragRayDir )
{
   //fragColor = texture(SFT_BUFF,fragCoord/iResolution.xy);return;
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    uv.x *= iResolution.x/iResolution.y; //fix aspect ratio
    
    // Position, direction, texture, normal, crapuscular ray coeff, and eye position.
    vec3 p,d,t,n,c,e;
    float i,s; // Entity ID and shutter.
    
    // Load the fragment position and entity ID.
    vec4 posData = texture(POS_BUFF,fragCoord/iResolution.xy)*vec4(1000,1000,1000,1);
    // Load the camera position and shutter value.
    vec4 camData = readTexel(POS_BUFF,TX_CPOS);
    p = posData.xyz;
    e = camData.xyz;
    d = normalize(p-e);
    t = texture(TEX_BUFF,fragCoord/iResolution.xy).rgb;
    n = texture(NRM_BUFF,fragCoord/iResolution.xy).rgb;
    c = texture(SFT_BUFF,fragCoord/iResolution.xy).rgb;
    i = posData.w;
    s = camData.w;
    
    // Store the final pixel color.
    fragColor = postProcess(uv,shade(p,d,t,i,n,e)+c).rgbb*s;
}

