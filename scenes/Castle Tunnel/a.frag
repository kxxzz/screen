/**
 * Castle Tunnel (Buffer A)
 * Author: Gerard Geer
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
 *
 * This buffer is pretty simple. It just marches out to the first intersection.
 *
 * An important note though: While nearly every surface is displacement mapped,
 * no part of the distance field in this buffer uses high frequency noise beyond
 * that of the basic bricks and such.
 * 
 * We forego this so we don't have to calculate a texture-based FBM once per surface
 * per march per ray. It's just not practical. 
 * 
 * Instead I add high frequency stuff in the normal buffer. Since the bumps are so
 * small that one wouldn't notice their actual displacement, this gives us the
 * same result. (Other than the fact we cut out about, I'd say, roughly, a bazillion
 * texture lookups.)
 *
 * Oh, another important thing going on here. You remember all that hoopla about
 * about stateful shaders? Where you store stuff in fragments of one of Shadertoy's
 * fuuuhiiiiiinnee buffer objects? We do that here to calculate the camera position
 * once, and share it with everyone else. It's stored in plain sight at pixel
 * (2,2) in this buffer. (It's obscured by all the other stuff done in the render
 * though).
 *
 * Since we store the camera position and intersection No 1, this buffer also stores
 * ray direction. (Which is ||(intersection - cam position)||
 *
 * Distances are stored at 1/1000th their actual value to sidestep precision issues.
 */

// Main marching steps.
#define V_STEPS 120
// Maximum acceptable marching result.
#define EPSILON .01
// Max ray depth.
#define MAX_DEPTH 75.0

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

// iChannel definition.
#define POS_BUFF iChannel0
#define NOISE_TEX iChannel1


// Some constants for rendering.
#define BUFF_RES iChannelResolution[0].xy
const vec2 TX_CPOS = vec2(2,2);                     // The pixel in which we store the camera position.
const vec3 UP = vec3(0.0, 1.0, 0.0);                // An up vector.
const vec3 SUN_DIR = vec3(0.894427, 0.357771, 0.268328);    // Sun direction.

/* 
    Buff is a value that must be written to fragCoord.
    if the current frag coord is that of where we want to store
    our data, buff is overwritten. Otherwise, buff is returned
    as is.
*/
void write4( inout vec4 buff, in vec4 v, in vec2 p, in vec2 fc )
{
    vec2 off = abs(p-floor(fc));
    buff = mix( v, buff, step(.1,max(off.x,off.y)) );
}

/*
    A linear Bezier function.
*/
vec3 lb(vec3 a, vec3 b, float t)
{
    return mix(a, b, t);
}

/*
    The first derivative of a linear Bezier function.
*/
vec3 dlb(vec3 a, vec3 b, float t)
{
    return normalize( b - a );
}

/*
    A quadratic Bezier function.
*/
vec3 qb(vec3 a, vec3 b, vec3 c, float t)
{
    return mix( mix(a,b,t), mix(b,c,t), t);
}

/*
    The first derivative of a quadratic Bezier function.
*/
vec3 dqb(vec3 a, vec3 b, vec3 c, float t)
{
    return normalize( (2.0-2.0*t)*(b-a) + 2.0*t*(c-b) );
}

/*
    Creates and orientates ray origin and direction vectors based on a
    camera position and direction, with direction and position encoded as
    the camera's basis coordinates.
*/
void camera(in vec2 uv, in vec3 cp, in vec3 cd, in float f, out vec3 ro, out vec3 rd)
{
    ro = cp;
    vec3 fakeLeft = cross(cd,UP);
    vec3 realUp = cross(fakeLeft,cd);
    vec3 realLeft = cross(cd,realUp);
    rd = normalize((cp + cd*f + normalize(realLeft)*uv.x + normalize(realUp)*uv.y)-ro);
}

/*
    Returns a coefficient for a shutter fade.
*/
float shutterfade(in float s, in float e, in float t, in float duration)
{
    return min( smoothstep(s, s+duration, t), smoothstep(e, e-duration, t) );
}

/*
    Sets up camera direction and position along a linear Bezier curve, based on
    start and end times, and start and end positions.
*/
void lCamPath(in float s, in float e, in float f, 
                in vec3 a, in vec3 b, float t,
                out vec3 cp, out vec3 cd, out float shutter)
{
    cp = lb(a, b, smoothstep(s, e, t));
    cd = dlb(a, b, smoothstep(s, e, t));
    shutter = shutterfade(s, e, t, f);
}

/*
    Sets up camera direction and position along a quadratic Bezier curve, based
    on start and end times, and start and end positions.
*/
void qCamPath(in float s, in float e, in float f, 
                in vec3 a, in vec3 b, in vec3 c, float t,
                out vec3 cp, out vec3 cd, out float shutter)
{
    cp = qb(a, b, c, smoothstep(s, e, t));
    cd = -cross(dqb(a, b, c, smoothstep(s, e, t)), UP);
    shutter = shutterfade(s, e, t, f);
}

void cCamPath(in float s, in float e, in float f,
              in vec3 c, float d, in float sr, in float er, in float t,
              out vec3 cp, out vec3 cd, out float shutter)
{
    float r = mix(sr,er,smoothstep(s,e,t));
    cp = c+vec3(d*cos(r),0,d*sin(r));
    cd = normalize(cp-c);
    shutter = shutterfade(s, e, t, f);
}

/*
    Animates the camera, choosing a path based on the current time. Also
    performs camera shuttering.
    All the camera directions are pre-normalized, so they look a little
    funky in the code itself.
*/
void animCam(in vec2 uv, in float t, out vec3 ro, out vec3 rd, out float shutter)
{
    // "Yeah I'm not gonna const-out all of those positions." ROUND 2
    vec3 cp, cd;
    t = mod(t, 60.0);
    if( t >= 0.0 && t < 5.0 )
    {
        lCamPath(0.0, 5.0, .5, 
                 vec3(-2.25, 8.0, 12.0), vec3(-2.25, 4.0, 12.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(.3,.05,.5));
        cd = vec3(0.512615, 0.0854358, 0.854358);
        camera(uv, cp, cd, .8, ro, rd);
    }
    else if( t >= 5.0 && t < 9.998 )
    {
        lCamPath(5.0, 10.0, .5, 
                 vec3(-2.0, 7.0, 12.0), vec3(-2.0, 7.0, 5.0),
                 t, cp, cd, shutter);
        cd = vec3(1,0,0);
        camera(uv, cp, cd, .8, ro, rd);
    }
    // This is for the screenshot.
    else if(t >= 9.998 && t < 10.016)
    {
        camera(uv, vec3(-2.25, 6.0, 12.0), vec3(0.512615, 0.0854358, 0.854358), .8, ro, rd);
    }
    else if( t > 10.016 && t < 15.0 )
    {
        cCamPath(10.0, 15.0, .5,
                 vec3(-2.5,8.0,0.0), 2.0, -1.2, 1.2,
                 t, cp, cd, shutter);
        camera(uv, cp, -cd, 1.0, ro, rd);
    }
    else if( t >= 15.0 && t < 20.0 )
    {
        lCamPath(15.0, 20.0, .5, 
                 vec3(-2.0, 9.0, 10.0), vec3(-2.0, 9.0, -10.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(.33,-.66,-1));
        cd = vec3(0.265534, -0.531068, -0.804648);
        camera(uv, cp, cd, .80, ro, rd);
    }
    else if( t >= 20.0 && t < 25.0 )
    {
        cCamPath(20.0, 25.0, .5,
                 vec3(3.0,6.0,-37.5), 5.0, 1.6, 4.5,
                 t, cp, cd, shutter);
        camera(uv, cp, -cd, .9, ro, rd);
    }
    else if( t >= 25.0 && t < 30.0 )
    {
        lCamPath(25.0, 30.0, .5, 
                 vec3(-0.0, 3.0, -15.0), vec3(-0.0, 3.0, -5.0),
                 t, cp, cd, shutter);
        cd = vec3(0,0,-1);
        float zoom = mix(4.0,1.25,smoothstep(25.0,30.0,t));
        camera(uv, cp, cd, zoom, ro, rd);
    }
    else if( t >= 30.0 && t < 35.0 )
    {
        lCamPath(30.0, 35.0, .5, 
                 vec3(2.25, 8.0, -30.0), vec3(2.25, 4.0, -30.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(-.3,.05,-.5));
        cd = vec3(-0.512615, 0.0854358, -0.854358);
        camera(uv, cp, cd, .8, ro, rd);     
    }
    else if( t >= 35.0 && t < 40.0 )
    {
        lCamPath(35.0, 40.0, .5, 
                 vec3(2.0, 6.0, 45.0), vec3(-2.0, 6.0, 45.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(.15,0,1));
        cd = vec3(0.14834, 0., 0.988936);
        camera(uv, cp, cd, 4.0, ro, rd);        
    }
    else if( t >= 40.0 && t < 45.0 )
    {
        lCamPath(40.0, 45.0, .5, 
                 vec3(0.0, 2.0, 3.0), vec3(0.0, 2.0, 10.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(.3,.25,.5));
        cd = vec3(0.472866, 0.394055, 0.78811);
        camera(uv, cp, cd, .8, ro, rd);
    }
    else if( t >= 45.0 && t < 50.0 )
    {
        cCamPath(45.0, 50.0, .5,
                 vec3(2.0,4.0,-7.5), 0.1, -1.2, 1.2,
                 t, cp, cd, shutter);
        camera(uv, cp, -cd, .8, ro, rd);
    }
    else if( t >= 50.0 && t < 55.0 )
    {
        lCamPath(50.0, 55.0, .5, 
                 vec3(2.0, 2.5, 21.0), vec3(2.0, 2.5, 21.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(1,2,1));
        cd = vec3(0.408248, 0.816497, 0.408248);
        float zoom = mix(.75,1.5,smoothstep(50.0,55.0,t));
        camera(uv, cp, cd, zoom, ro, rd);
    }
    else if( t >= 55.0 && t < 60.0 )
    {
        lCamPath(55.0, 60.0, .5, 
                 vec3(-2.0, 1.0, -30.0), vec3(-2.0, 1.0, -55.0),
                 t, cp, cd, shutter);
        // cd = normalize(vec3(.4,.3,-.4));
        cd = vec3(0.624695, 0.468521, -0.624695);
        camera(uv, cp, cd, 1.0, ro, rd);
    }
}
/*
    Returns a psuedo random value given a 3D vector.
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
*/
float hash( vec2 x )
{
    x = vec2( dot(x,vec2(311.7, 74.7)),
              dot(x,vec2(183.3,246.1)));

    return fract(length(sin(x)*43758.5453123));
}

/*
    A 2D bumpmap of bricks. This is used for the ceiling only.
    This one doesn't use an external bump map, and so each brick is even.
    This, and all the other brick functions work by creating a local floating
    point space by calling fract(), and then doing transformations on that result.
*/
float brickBump( in vec2 p )
{
    // Go ahead and stretch out the incoming coordinates.
    p.x *= .5;
    // Move over every other row of bricks, using the floor of the
    // Y coordinate.
    p.x += .5*floor(mod(p.y,2.0));
    // Transform the result to -1,1
    vec2 f = 2.0-fract(p) - 1.0;
    
    // blend between a fractional distance (.966) from the center of our local
    // space and the edge of it, so our bricks are a bit rounded. This
    // cuts down some aliasing.
    return smoothstep(.966,1.0,max(f.x,f.y));
}

/*
    This provides the tile bumpmap for the ground.
*/
float groundBump( in vec3 p )
{
    // vec3 f = fract(p);
    p = fract(p); // Reuse p. We weren't using it anyway.
    return smoothstep(.966,.975,max(p.x,max(p.y,p.z)));
}

/*
    Creates the bumpmap for the wall. This is the simple version that's
    defined in 2D space. It's used for the walls and the endcaps. It's
    remarkably similar to brickBump2D(), except it's also influenced by
    a texture based displacement map.
*/
float wallBump2D( in vec2 p )
{
    // Resize and scoot over every other row.
    p *= 2.0;
    p.x *= .5;
    p.x += .5*floor(mod(p.y,2.0));
    
    // Dive into fractional space.
    vec2 f = 2.0*fract(p) - 1.0;
    float r = 1.0 - smoothstep(.825,.95,max(f.x,f.y));
    r *= .1 + hash(800.0*floor(p))*.8 + .05; // We used to add some FBM here, 
                                             // but we don't need it in this 
                                             // pass. So let's just add the 
                                             // average value of what it
                                             // would have been. The FBM is now
                                             // taken care of in the normal pass.
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
    r *= .1 + hash(800.0*floor(p))*.8 + .05; // We used to add some FBM here, 
                                             // but we don't need it in this 
                                             // pass. So let's just add the 
                                             // average value of what it
                                             // would have been.
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
    The seminal signed cube distance function.
*/
float box( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) +
           length(max(d,0.0));
}

/*
    An infinitely long box that extends along the X axis.
*/
float xBox( vec3 p, vec2 b )
{
    vec2 d = abs(p.zy) - b;
    return min(max(d.x,d.y),0.0) +
           length(max(d,0.0));
}

/*
    Another infinitely long box that extends along the Y
    axis.
*/
float yBox( vec3 p, vec2 b )
{
    vec2 d = abs(p.xz) - b;
    return min(max(d.x,d.y),0.0) +
           length(max(d,0.0));
}

/*
    And yet another that goes down the Z.
*/
float zBox( vec3 p, vec2 b )
{
    vec2 d = abs(p.xy) - b;
    return min(max(d.x,d.y),0.0) +
           length(max(d,0.0));
}

/*
    A capped cylinder along the X axis.
*/
float xCapCyl( vec3 p, vec2 c )
{
    // This is basically an infinite cylinder that's being chopped
    // by a bounds.
    vec2 d = abs(vec2(length(p.zy),p.x)) - c;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

/*
    A capped cylinder that stands up tall along the Y axis.
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
    if ( d > .1 ) return d;
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
    else return r + brickBump(p.zx)*.1;
}

/*
    This subfield is just the windowpanes.
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
    // Create a copy of our location so we don't provide wallBump3D()
    // with the same value each repetition.
    vec3 q = p;
    // Translate the original location.
    p.x -= 3.0;
    p.y -= 4.0;
    // Repeat it using modulo.
    p.z = mod(p.z,15.0)-7.5;
    // Get a preliminary result.
    float r = box(p,vec3(1,4.0,1.5));
    // Maybe displace it, if we're close enough to matter.
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
    // These will be on top of the bottom of the cauldrons, so we have to elevate them.
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
        p += d*r*.45;
        r = dist(p);
    }
    return;
}

/*
    Shadertoy's entry point.
*/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    uv.x *= iResolution.x/iResolution.y; //fix aspect ratio
    
    // Position, direction, and eye.
    // Notice that it spells out the Processing file extension?
    vec3 p,d,e;
    
    // Set up the camera.
    float shutter = 0.0;
    animCam(uv, iTime, p, d, shutter);
    
    // Store the eye position.
    e = vec3(p);
    
    // Do the actual ray marching.
    march(p,d);
    
    // Store the camera position so we don't have to recalc it everywhere.
    vec4 buff = vec4(p*.001,distID(p));
    write4(buff, vec4(e,shutter), TX_CPOS, fragCoord);
    
    // Store the final pixel color.
    fragColor = buff;
}

/*
    The Shadertoy VR entrypoint.
*/
void mainVR( out vec4 fragColor, in vec2 fragCoord, 
            in vec3 fragRayOri, in vec3 fragRayDir )
{
   vec2 uv = fragCoord / iResolution.xy - 0.5;
    uv.x *= iResolution.x/iResolution.y; //fix aspect ratio
    
    // Position, direction, and eye.
    // Notice that it spells out the Processing file extension?
    vec3 p,d,e;
    
    // Set up the camera.
    float shutter = 0.0;
    animCam(uv, iTime, p, d, shutter);
    p += fragRayOri;
    
    // Store the eye position.
    e = vec3(p);
    
    // Do the actual ray marching.
    march(p,fragRayDir);
    
    // Store the camera position so we don't have to recalc it everywhere.
    vec4 buff = vec4(p*.001,distID(p));
    write4(buff, vec4(e,shutter), TX_CPOS, fragCoord);
    
    // Store the final pixel color.
    fragColor = buff;
}

