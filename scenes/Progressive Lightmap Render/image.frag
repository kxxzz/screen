// gather version of an experiment i did in unity: https://twitter.com/hdb1/status/805887693905391616

// this caches gi in the lightmap (diffuse only). each frame it pumps energy
// into the scene from the light and gathers illumination from surfaces.

// the lightmap is object space, so no screen space artifacts.
// the disadvantage is that there needs to be a geometry raytrace/march on the gpu.

// when lighting changes slowly (time of day comes to mind), a system like this
// could work well (especially if lightmap resolution varied adaptively based
// on distance to viewer) - provided that scene can be efficiently raytraced on gpu..

// i think this implementation is probably suffering badly from incoherent samples from the
// lightmap texture - the performance is not as good as i had hoped. it also
// seems to scale much worse with the amount of geometry than i had hoped.
// i plan to look into these issues when i get access to some proper hardware (instead of
// my crappy laptop).

#define DIST_MAX 1000.
float LM_RES;

#define WHITECOLOR vec3(.7295, .7355, .729)*0.7
#define GREENCOLOR vec3(.117, .4125, .115)*0.7
#define REDCOLOR vec3(.611, .0555, .062)*0.7
#define LIGHTR 0.25

struct Quad
{
    vec3 p;
    vec3 n;
    vec2 scl;
    vec2 uv_c; // uv ceneter
    vec2 uv_wh; // wh of quad in uv space
    int col; // color
};

vec3 l2w( vec3 l,vec3 normal )
{
    vec3 binormal,tangent;
    if( abs(normal.x) > abs(normal.z) )
    {
        binormal.x = -normal.y;binormal.y =  normal.x;binormal.z =  0.;
    }
    else
    {
        binormal.x =  0.;binormal.y = -normal.z;binormal.z =  normal.y;
    }
    binormal = normalize(binormal);
    tangent = cross( binormal, normal );
    return l.x*tangent + l.y*normal + l.z*binormal;
}

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
    LM_RES = .75*iResolution.y;
    
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
    
    // bring in by a FULL pixel on each edge to stop lerping into the lightmap for another quad
    for( int i = 0; i < QUAD_COUNT; i++ )
    {
        quads[i].uv_wh -= 3./LM_RES;
    }
}

void InitScene();
int pickQuad( vec2 lightmapUV );
int pickedQuad = -1;
float castRay( vec3 ro, vec3 rd, out vec2 uv, out vec3 col );
float iSphere( in vec3 ro, in vec3 rd, in vec4 sph );

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    InitScene();
    
    fragColor = vec4(0.);
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    // draw lightmap in corner
    if( iResolution.y > 250. && fragCoord.x<LM_RES/2. && fragCoord.y<LM_RES/2. )
    {
        uv = fragCoord/(LM_RES/2.) * LM_RES/iResolution.xy;
        //uv.x = 1. - uv.x;
        fragColor = textureLod( iChannel0, uv, 0. );
        
        fragColor.xyz = pow( clamp(fragColor.xyz,0.0,1.0), vec3(0.45) );
        return;
    }
    
    /*
    // picking quads from lightmap made it really slow (on my laptop)
    pickedQuad = -1;
    vec2 mlmuv;
    if( iMouse.z > 0. && (mlmuv=iMouse.xy/(LM_RES/2.)).x < 1. && mlmuv.y < 1. )
    {
        pickedQuad = pickQuad( mlmuv );
    }
    //*/

    
    uv.x = .5 + (uv.x-.5)*iResolution.x/iResolution.y;

    vec3 ro = vec3(0.,0.,-35.);
    vec3 rd = normalize(vec3( .35*vec2(uv-.5), 1. ));

    // visualise light
    vec3 lc = vec3(-2.,-3.,-1.5);
    //if( iMouse.z > 0. )
        lc = vec3(22.*(iMouse.x/iResolution.x-.5),-6.+12.*iMouse.y/iResolution.y,-3.+6.*iMouse.x/iResolution.x);
    float sphDist = iSphere( ro, rd, vec4(lc,LIGHTR));
    
    vec2 htuv; vec3 col; float geomDist;
    if( (geomDist=castRay( ro, rd, htuv, col )) < DIST_MAX )
    {
        if( sphDist > 0. && sphDist < geomDist )
        {
            // not tone mapped etc for now - just return white.
            fragColor = vec4(1.); return;
        }
        
        vec2 lmuv = htuv * LM_RES/iResolution.xy;
        fragColor = textureLod( iChannel0, lmuv, 0. );
        fragColor.xyz *= col;
        
        fragColor.xyz = pow( clamp(fragColor.xyz,0.0,1.0), vec3(0.45) );
    }
    else
    {
        if( sphDist > 0. )
        {
            // not tone mapped etc for now - just return white.
            fragColor = vec4(1.); return;
        }
    }

    return;
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

float castRay( vec3 ro, vec3 rd, out vec2 uv, out vec3 col )
{
    uv = vec2(0.);
    
    float rt = DIST_MAX;
    for( int i = 0; i < QUAD_COUNT; i++ )
    {
        vec2 uvi; float rti;
        if( rayQuadUV( ro, rd, quads[i].p, quads[i].n, quads[i].scl, uvi, rti ) 
          && rti < rt )
        {
            uv = quads[i].uv_c + (uvi-.5)*quads[i].uv_wh;
            col = GetColor(quads[i].col);
            rt = rti;
        }
    }
    
    return rt;
}

int pickQuad( vec2 lightmapUV )
{
    for( int i = 0; i < QUAD_COUNT; i++ )
    {
        if( abs(lightmapUV.x-quads[i].uv_c.x) < quads[i].uv_wh.x/2.
         && abs(lightmapUV.y-quads[i].uv_c.y) < quads[i].uv_wh.y/2. )
        {
            return i;
        }
    }
    
    return -1;
}

float iSphere( in vec3 ro, in vec3 rd, in vec4 sph )
{
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

