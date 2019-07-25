/**
 * Castle Tunnel (Buffer B)
 * Author: Gerard Geer
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
 *
 * Takes the positions determined in Buffer A, picks them up from Render To Texture,
 * Elementary and throws them right into Fink's Raymarcher's Normal Calculation Factory.
 * Life's tough for a near-post-industrial-revolution fragment. At least they get to
 * live in a castle.
 * 
 * (The surface normals are calculated the normal way one does in raymarched scenes,
 * just with precomputed values.) 
 */

// Comment this out if you want more speed.
#define DO_IMG_NORM_MAPS

// Maximum successful marching distance.
#define EPSILON .005

// iChannel definition.
#define POS_BUFF iChannel0
#define NOISE_TEX iChannel1

// Some constants for rendering.
#define BUFF_RES iChannelResolution[0].xy


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
    We have an extra channel available here, so we can use the
    texture-lookup version of IQ's noise!
*/
float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec2 rg = texture( NOISE_TEX, (uv+0.5)/256.0, -100.0 ).yx;
    return mix( rg.x, rg.y, f.z );
}

/*
    An FBM of such noise.
*/
float fbm( in vec3 p )
{
    float r = noise(p)*.500;
    r += noise(p*2.0)*.250;
    r += noise(p*4.0)*.125;
    return r *1.1429;
}

/*
    A 2D bumpmap of bricks. This is used for the ceiling and the walls.
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
    
    #ifdef DO_IMG_NORM_MAPS
    return smoothstep(.966,.975,max(f.x,max(f.y,f.z)))+fbm(p*2.0+hash(floor(p)));
    #else
    return smoothstep(.966,.975,max(f.x,max(f.y,f.z)))+.5;
    #endif
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
    
    #ifdef DO_IMG_NORM_MAPS
    r *= .1 + hash(800.0*floor(p))*.8 + fbm(vec3(p*8.0,0))*.1;
    #else
    r *= .1 + hash(800.0*floor(p))*.8+.05;
    #endif
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
    #ifdef DO_IMG_NORM_MAPS
    r *= .1 + hash(800.0*floor(p))*.8 + fbm(p*8.0)*.1;
    #else
    r *= .1 + hash(800.0*floor(p))*.8 + .05;
    #endif
    
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
    Shadertoy's entry point.
*/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Load and re-inflate the fragment position.
    vec3 p=texture(POS_BUFF,fragCoord/iResolution.xy).rgb*1000.0;
    
    // Store the surface normal.
    fragColor = vec4(norm(p).rgbb);
}

