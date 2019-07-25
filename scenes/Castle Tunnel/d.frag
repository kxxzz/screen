/**
 * Castle Tunnel (Buffer D)
 * Author: Gerard Geer
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
 *
 * This shader is fun. It "calculates" crepuscular rays.
 * This pass marches it's own (very simple field) using the camera position and ray 
 * positions stored in buffer A.
 * 
 * What's in this DF, you ask? A super basic version of the tunnel, and some funky
 * flip-turned version of the subfield used to cut out the window openings.
 * 
 * To get the lightshafts we just march fixed-step until we hit the tunnel.
 * And if any step along the way happens to land us inside one of the light shafts,
 * we add a little to our 401k. (Or a value that represents how prominent the shafts
 * are along this ray.
 *
 * I was going to ray-trace this part, but getting that round top broke my resolve
 * to do so. :/
 */

// Comment this out to disable crepuscular rays.
#define GO_AHEAD_AND_MAKE_ME_CREPES_FOR_BREAKFAST

// Occlusion samples.
#define SFT_STEPS 400
#define MAX_DEPTH 100.0

// iChannel definitions.
#define POS_BUFF iChannel0
#define NRM_BUFF iChannel1

// Some constants for rendering.
#define BUFF_RES iChannelResolution[0].xy
const vec2 TX_CPOS = vec2(2,2);                     // The pixel in which we store the camera position.
const vec3 SUN_COLOR = vec3(1,.95,.9);                  // Sun color.

/* 
    Reads a texel from a sampler2D at a given position.
*/
vec4 readTexel( in sampler2D buff, in vec2 p )
{
    return texture(buff, (p+.5)/BUFF_RES);
}

/*
    Generates a quick rotation matrix.
*/
mat2 rotMat( in float r )
{
    float cr = cos(r), sr = sin(r);
    return mat2(cr,sr,-sr,cr); // Column major.
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
    The base tunnel. It's an infinite box, with the middle hollowed
    out by another.
*/
float baseTunnel( in vec3 p )
{
    float d =  max( zBox(p-vec3(0,6,0),vec2(5,7)),
                   -zBox(p-vec3(0,6,0),vec2(3,6)));
    float f = 0.0;
    return d;
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
    return d;
}

/*
    The subfield that cuts out holes in the side of the tunnel. It's
    also a box intersected with a cylinder.
*/
float windowCutouts( in vec3 p )
{
    // Base transformations to get them into position.
    p.y -= 3.8;
    p.x -= 3.0;
    p.z = mod(p.z, 15.0)-7.5; // Repeat along the Z axis.
    p.xy *= rotMat(.38);
    p.zx *= rotMat(.325);
    
    // Create copies of the position for the cylinder and the cube.
    vec3 c = p, b = p;
    // Do independent transformations for both parts.
    c.y *= .75;
    b.y -= 4.0;
    // Here's the base distance sampling. Notice how we combine the xBox and 
    // the xCapCyl.
    float r =  max(xBox(b,vec2(.95,3.60)),
                   xCapCyl(c,vec2(2.95,20.0)));
    
    return r;
}

/*
    Marches out some sunshafts. It's SUPER EXPENSIVE.
*/
float sunshafts( in vec3 p, vec3 d )
{
    float t = 0.0, r = 0.0;
    vec3 c = p;
    for(int i = 0; i < SFT_STEPS; ++i)
    {
        c = p + t*d;
        if( min(baseTunnel(c),yourPathEndsHere(c)) < 0.0 ) return r;
        r += .00125*step(0.0,-windowCutouts(c));
        t += .125;
    }
    return r;
}

/*
    Shadertoy's entry point.
*/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    #ifndef GO_AHEAD_AND_MAKE_ME_CREPES_FOR_BREAKFAST
    fragColor = vec4(0);return;
    #endif
    
    //fragColor = texture(TEX_BUFF,fragCoord/iResolution.xy);return;
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    uv.x *= iResolution.x/iResolution.y; //fix aspect ratio
    
    // Position, direction, texture, normal, and eye.
    vec3 p,d,e;
    
    // Load the camera position from file.
    p = texture(POS_BUFF,fragCoord/iResolution.xy).xyz*1000.0;
    e = readTexel(POS_BUFF,TX_CPOS).rgb;
    d = normalize(p-e);
    
    // Store the final pixel color.
    fragColor = vec4(sunshafts(e, d)*SUN_COLOR,1);
}

