/**
 * Castle Tunnel (Buffer C)
 * Author: Gerard Geer
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
 *
 * So you take a normal, and you take a position, ya look at 'em really hard,
 * and out pops a texel of a texture!
 *
 * Or rather, we use the products from buffers A and B to compute the various
 * semi-procedural textures used in the scene.
 */

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
#define NOISE_TEX iChannel2
#define STONE_TEX iChannel3

// Some constants for rendering.
#define BUFF_RES iChannelResolution[0].xy
const vec2 TX_CPOS = vec2(2,2);                     // The pixel in which we store the camera position.
const vec3 UP = vec3(0.0, 1.0, 0.0);                // An up vector.
const vec3 SUN_DIR = vec3(0.894427, 0.357771, 0.268328);    // Sun direction.
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
    Creates and orientates ray origin and direction vectors based on a
    camera position and direction, with direction and position encoded as
    the camera's basis coordinates.
*/
void camera(in vec2 uv, in vec3 cp, in vec3 cd, in float f, out vec3 ro, out vec3 rd)
{
    ro = cp;
    rd = normalize((cp + cd*f + cross(cd, UP)*uv.x + UP*uv.y)-ro);
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
    r *= .1 + hash(800.0*floor(p))*.8 + fbm(vec3(p*8.0,0))*.1;
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
    r *= .1 + hash(800.0*floor(p))*.8 + fbm(p*8.0)*.1;
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
    An infinitely long box that extends along the X axis.
*/
float xBox( vec3 p, vec2 b )
{
    vec2 d = abs(p.zy) - b;
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
    b.x *= 20.0;
    // Here's the base distance sampling. Notice how we combine the xBox and 
    // the xCapCyl.
    return max(xBox(b,vec2(1.45,4.5)),
               xCapCyl(c,vec2(3,4.0)));
}

/*
    Mixes between two colors based on the upward angle of the
    ray direction for a plausible sky.
*/
vec3 sky( vec3 d )
{
    vec3 flatD = normalize(vec3(d.x,0.0,d.z));
    float cTheta = dot(vec3(0,0,1),flatD);
    float cPhi = dot(d,flatD);
    vec3 ground = mix(vec3(.5,.7,.3),vec3(.1,.3,.1),fbm(vec3(cTheta,cPhi,0)*5.0));
    return mix(ground,SKY_COLOR*1.75,smoothstep(-.2,-.1,d.y));
}

/*
    Generates the texture for the walls. Notice that there is
    also grout! It's 2D since we only use it on something that's in the YZ plane.
*/
vec3 wallTex2D( in vec2 p )
{
    // Since the cutouts need to be textured on more than one hyperplane,
    // we need to use a 3D texturing function.
    float b = 1.0-wallBump2D(p);
    vec3 grout = mix(vec3(.5),vec3(1.0),hash(p));
    
    // Now we need to to some texture sampling. Let's randomize
    // the patch each brick takes.
    vec2 q = p * 2.0;
    q.x *= .5;
    p += hash(floor(q));
    vec3 bricks = texture(STONE_TEX,p*.025,-1000.0).rgb*.6 + texture(STONE_TEX,(p*2.+.125),-1000.0).rgb*.3+grout*.4;
    return mix(grout,bricks,step(.1,b))*.375;
}

/*
    Generates the texture for the cutout spots. This is 3D.
*/
vec3 wallTex3D( in vec3 p, in vec3 n )
{
    // Since the cutouts need to be textured on more than one hyperplane,
    // we need to use a 3D texturing function.
    float b = 1.0-wallBump3D(p);
    vec3 grout = mix(vec3(.5),vec3(1.0),hash(p));
    
    // Now we need to to some texture sampling. Let's randomize
    // the patch each brick takes.
    vec3 q = p * 2.0;
    q.x *= .5;
    p += hash(floor(q));
    vec3 bricks = tex3D(STONE_TEX,p*.025,n).rgb;
    return mix(grout,bricks,step(.1,b))*.250+.125;
}

/*
    Generates the tiled texture for the ground.
*/
vec3 groundTex( in vec2 p )
{
    vec2 f = fract(p);
    vec2 g = floor(p);
    float tile = .7+fbm(vec3(p*10.0+hash(g),0))*.3;
    vec3 r = mix(vec3(.25),vec3(.75),hash(g))*tile;
    
    r = mix(r,vec3(.0)+hash(p)*.5,step(.975,max(f.x,f.y)));
    return r;
}

vec3 windowTex( in vec3 p, in vec3 d )
{
    // Scale the wires.
    vec3 q = p*5.0;
    
    // Rotate them 45 degrees.
    q.zy *= mat2(0.7071,0.7071,-0.7071,0.7071); // Column major.
    
    // Work in fractional space.
    vec3 f = fract(q);
    f = f*2.0-1.0;
    
    // Get a coefficient for how far away we are from the wires.
    float wires = 1.0-smoothstep(0.8,1.05,max(f.z,f.y));
    
    // Oh the frame is fun. It's the distance to a subfield.
    float frame = step(.15,abs(windowFrame(p)));
    
    // Compute the color of the features.
    vec3 color = mix(vec3(.025,.02,.01),vec3(.01),frame);
    
    // Mix that color with what we would see outside the window.
    return mix(color, sky(d), min(wires,frame));  
}

/*
    Most of the fancy effects are fake. The sss of the candles is
    no exception.
*/
vec3 candleTex( in vec3 p )
{
    vec3 cColor = vec3(.9,.8,.7);
    return mix(cColor,cColor*.5,smoothstep(8.1,7.7,p.y));
}

/*
    Textures the cauldrons.
*/
vec3 cauldronTex( in vec3 p )
{
    float n = noise(p*15.0);
    n = smoothstep(.6,.9,n);
    return mix(vec3(.1),vec3(.2,.14,.1),n);
}

/*
    Takes a position and eye coordinate and returns the
    texture of the nearest object to the given position.
*/
vec3 tex( in vec3 p, in vec3 d, in float i, in vec3 n, in vec3 e )
{
    if( i == ID_WALLS ) return wallTex2D(p.zy);
    else if( i == ID_GROUND ) return groundTex(p.xz);
    else if( i == ID_CAULDR ) return cauldronTex(p);
    else if( i == ID_CANDLES ) return candleTex(p);
    else if( i == ID_WINDOW ) return windowTex(p,d);
    else if( i == ID_CEILING ) return vec3(.6);
    else if( i == ID_CUTOUT ) return wallTex3D(p,n);
    else if( i == ID_CUTCEIL ) return vec3(1.0);
    else if( i == ID_END ) return wallTex2D(p.xy);
    else return vec3(1,0,1);
}

/*
    Shadertoy's entry point.
*/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    // Position, direction, and eye.
    vec3 p,d,n,e;
    float i; // Entity ID.
    
    // Load the camera position from file.
    e = readTexel(POS_BUFF,TX_CPOS).rgb;
    // Load the other stuff.
    vec4 pos = texture(POS_BUFF,fragCoord/iResolution.xy) * vec4(1000,1000,1000,1);
    p = pos.xyz;
    d = normalize(p-e);
    n = texture(NRM_BUFF,fragCoord/iResolution.xy).rgb;
    i = pos.w;
    
    
    // Store the final pixel color.
    fragColor = vec4(tex(p,d,i,n,e),i);
}

