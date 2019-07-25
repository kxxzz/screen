// Created by inigo quilez - iq/2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

float hash1( uint n ) 
{
  n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    return 1.0 - float(n&0x7fffffffU)/float(0x7fffffff);
}

vec2 hash2( uint n ) 
{
    // integer hash copied from Hugo Elias
  n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    uvec2 k = n * uvec2(n,n*16807U);
    return vec2( k & 0x7fffffffU)/float(0x7fffffff);
}

uint ihash1( uint n ) 
{
  n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    return n;
}

vec3 uniformVector( in uint seed)
{
    vec2 ab = hash2( seed*7U+11U );
    float a = 3.141593*ab.x;
    float b = 6.283185*ab.y;
    return vec3( sin(b)*sin(a), cos(b)*sin(a), cos(a) );
}

vec3 cosineDirection( in uint seed, in vec3 nor)
{
    vec2 r = hash2( seed*7U+11U );

    // by fizzer: http://www.amietia.com/lambertnotangent.html
    float a = 6.2831853 * r.y;
    float u = 2.0*r.x - 1.0;
    return normalize( nor + vec3(sqrt(1.0-u*u) * vec2(cos(a), sin(a)), u) );
}

float iBox( in vec3 ro, in vec3 rd, in mat4 txx, in vec3 rad ) 
{
    // convert from ray to box space
  vec3 rdd = (txx*vec4(rd,0.0)).xyz;
  vec3 roo = (txx*vec4(ro,1.0)).xyz;

  // ray-box intersection in box space
    vec3 m = 1.0/rdd;
    vec3 n = m*roo;
    vec3 k = abs(m)*rad;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
  float tN = max( max( t1.x, t1.y ), t1.z );
  float tF = min( min( t2.x, t2.y ), t2.z );
  if( tN > tF || tF < 0.0) tN = -1.0;
  return tN;
}

// returns normal, st and face
void nBox( in vec3 ro, in vec3 rd, in mat4 txx, in mat4 txi, in vec3 rad, out vec3 outNor, out vec2 outST, out uint outFaceID ) 
{
    // convert from ray to box space
  vec3 rdd = (txx*vec4(rd,0.0)).xyz;
  vec3 roo = (txx*vec4(ro,1.0)).xyz;

    // intersect and select
    vec3 s = -sign(rdd);
    vec3 t = (-roo + s*rad)/rdd;
    
    // compute normal in world space
         if( t.x>t.y && t.x>t.z ) { outNor = txi[0].xyz*s.x; outST = roo.yz+rdd.yz*t.x; outFaceID=uint(1+int(s.x))/2U; /* 0, 1 */ } 
    else if( t.y>t.z )            { outNor = txi[1].xyz*s.y; outST = roo.zx+rdd.zx*t.y; outFaceID=uint(5+int(s.y))/2U; /* 2, 3 */ }
    else                          { outNor = txi[2].xyz*s.z; outST = roo.xy+rdd.xy*t.z; outFaceID=uint(9+int(s.z))/2U; /* 4, 5 */ }
}

//------------------------

mat4 rotationAxisAngle( vec3 v, float angle )
{
    float s = sin( angle );
    float c = cos( angle );
    float ic = 1.0 - c;

    return mat4( v.x*v.x*ic + c,     v.y*v.x*ic - s*v.z, v.z*v.x*ic + s*v.y, 0.0,
                 v.x*v.y*ic + s*v.z, v.y*v.y*ic + c,     v.z*v.y*ic - s*v.x, 0.0,
                 v.x*v.z*ic - s*v.y, v.y*v.z*ic + s*v.x, v.z*v.z*ic + c,     0.0,
           0.0,                0.0,                0.0,                1.0 );
}

mat4 translate( in vec3 t )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
         0.0, 1.0, 0.0, 0.0,
         0.0, 0.0, 1.0, 0.0,
         t.x, t.y, t.z, 1.0 );
}


#define NUMBOXES 22U

// 7 are manually placed
const vec3 possiz[14] = vec3[14](
    vec3(  0.0, 0.0,  0.0), vec3(10.5,0.1,10.5),
    vec3(  0.0, 0.0,-10.0), vec3(10.5,7.5, 0.1),
    vec3(  0.0, 0.0, 10.0), vec3(10.5,7.5, 0.1),
    vec3( 10.0, 0.0,  0.0), vec3( 0.1,7.5,10.5),
    vec3(-10.0, 0.0,  0.0), vec3( 0.1,7.5,10.5),
    vec3( -7.0,-7.0,  0.0), vec3( 4.0,0.1,10.5),
    vec3(  7.0,-7.0,  0.0), vec3( 4.0,0.1,10.5)
    );

void getLocation( uint id, out mat4 resMat, out vec3 resSiz )
{
    if( id<7U )
    {
        resMat = translate( possiz[2U*id+0U] );
        resSiz = possiz[2U*id+1U];
    }
    else
    {
        resMat = rotationAxisAngle(vec3(0.3,0.4,0.5)*1.41421, -float(id*13U))* translate(vec3(0.0,-2.5,0.0)-vec3(5.0,2.0,5.0)*sin(vec3(id*43U,id*23U,id*137U)));
        resSiz = vec3(1.1,1.6,0.08);
    }
}

float castRay( in vec3 ro, in vec3 rd, out vec3 oNor, out vec2 oUV, out uint oID )
{
    float tmi = 1e20;
    mat4  cma; 
    vec3  csi; 
    uint  cin = 0xffffffffU;    
    
    for( uint i=0U; i<NUMBOXES; i++ )
    {
        mat4 ma; vec3 si; getLocation(i, ma, si);

        float res = iBox( ro, rd, ma, si );
        if( res>0.0 && res<tmi )
        {
            cma = ma;
            csi = si;
            cin = i;
            tmi = res;
        }
    }

    uint resID;
    nBox( ro, rd, cma, inverse(cma), csi, oNor, oUV, resID );
    oID = cin*6U + resID;
    
    return (cin==0xffffffffU) ? -1.0 : tmi;
}

float castShadowRay( in vec3 ro, in vec3 rd )
{
    for( uint i=0U; i<NUMBOXES; i++ )
    {
        mat4 ma; vec3 si; getLocation(i, ma, si);

        if( iBox( ro, rd, ma, si )>0.0 )
            return 0.0;
    }
  return 1.0;
}

mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
  vec3 cw = normalize(ta-ro);
  vec3 cp = vec3(sin(cr), cos(cr),0.0);
  vec3 cu = normalize( cross(cw,cp) );
  vec3 cv =          ( cross(cu,cw) );
    return mat3( cu, cv, -cw );
}


vec3 sunDir = normalize(vec3(0.5,0.9,-0.2));
vec3 sunCol =  vec3(1.7,0.8,0.6)*10.0; 

vec3 doSkyCol( in vec3 rd )
{
    return vec3(0.3,0.4,1.20);
}    

vec4 render( in vec3 ro, in vec3 rd, uint sa, out uint oID )
{
    const float epsilon = 0.001;

    vec3 colorMask = vec3(1.0);
    vec3 accumulatedColor = vec3(0.0);
    vec3 oro = ro;
    vec3 ord = rd;

    oID = (NUMBOXES+10U);
    
    float fdis = 0.0;
    
    const uint numRays = 4U;
    
    for( uint k=0U; k<numRays; k++ )
    {
        ro = oro;
        rd = ord;
        colorMask = vec3(1.0);

        for( uint bounce = 0U; bounce<3U; bounce++ ) // bounces of GI
        {
            vec3 nor;
            vec2 st;
            uint id;
            float t = castRay( ro, rd, nor, st, id );
            if( t < 0.0 )
            {
                if( k==0U && bounce==0U ) 
                { 
                    accumulatedColor = doSkyCol(rd) * float(numRays) * 3.14;
                    oID = (NUMBOXES+10U);
                    fdis = 1000.0;
                }
                break;
            }

            uint obj = id/6U;
            vec3 pos = ro + rd*t;

            if( k==0U && bounce==0U )
            { 
                fdis = t;
                oID = id;
            }



            uint kid = id/6U;

            vec3 surfaceColor = vec3(0.4);
            vec3 tex = texture( iChannel3, st.yx*0.3 ).xyz;
            if( kid>=1U && kid<=4U) tex = texture( iChannel2, st*0.2 ).xyz*vec3(0.7,0.8,0.8);
            surfaceColor *= tex;

            //-----------------------
            // add direct lighitng
            //-----------------------
            colorMask *= surfaceColor;

            vec3 iColor = vec3(0.0);

            #if 1
            // light 1        
            vec3 ssundir = normalize( sunDir + 0.01*uniformVector(sa + 11U + 45U*(bounce+11U*k)) );

            float sunDif =  max(0.0, dot(ssundir, nor));
            float sunSha = 1.0; if( sunDif > 0.00001 ) sunSha = castShadowRay( pos + nor*epsilon, ssundir);
            iColor += sunCol * sunDif * sunSha;
            vec3 h = normalize( sunDir - rd );

            float shl = 0.04 + 0.96*pow( 1.0-clamp(dot(h,-rd),0.0,1.0), 5.0 );
            float spe = tex.x*30.0*pow( clamp( dot( nor, h ), 0.0, 1.0 ), 24.0*tex.x );
            iColor += spe * shl * sunCol * sunSha * sunDif;
            #endif

            #if 1
            // light 2
            for( int i=min(0,iFrame); i<2; i++ )
            {
            vec3 skyPoint = cosineDirection( sa + 7U*uint(iFrame) + 47U*(k) + 13U*uint(i) + bounce*92U, nor);
            float skySha = castShadowRay( pos + nor*epsilon, skyPoint);
            vec3  skyCol = doSkyCol(skyPoint);
            iColor += skyCol * skySha / 2.0;


            vec3 h = normalize( skyPoint - rd );
            float shl = 0.04 + 0.96*pow( 1.0-clamp(dot(h,-rd),0.0,1.0), 5.0 );
            float spe = tex.x*250.0*pow( clamp( dot( nor, h ), 0.0, 1.0 ), 24.0*tex.x );
            iColor += spe * shl * skyCol * skySha / 2.0;
            }
            #endif


            accumulatedColor += colorMask * iColor;

            //-----------------------
            // calculate new ray
            //-----------------------
            float isDif = 0.8;
            if( hash1(sa + 1U + 7U*bounce + 91U*k + 31U*uint(iFrame)) < isDif )
            {
               rd = cosineDirection(76U + 73U*(bounce+5U*k) + sa + 17U*uint(iFrame), nor);
            }
            else
            {
                float glossiness = 0.4;
                rd = normalize(reflect(rd, nor)) + uniformVector(sa + 111U + 65U*(bounce+7U*k)+87U*uint(iFrame)) * glossiness;
            }

            ro = pos + epsilon*nor;
        }
    }
    accumulatedColor /= float(numRays);
   
    return vec4( clamp(accumulatedColor,0.0,10.0), fdis );
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // inputs 
  vec2 off = hash2(uint(iFrame)) - 0.5;
    vec2 p = (2.0*(fragCoord+off)-iResolution.xy)/iResolution.y;
    uint sa = ihash1( uint(iFrame)*11U + uint(fragCoord.x) + uint(fragCoord.y)*113U );
  
    // camera movement
    float time = -2.0 + (iTime-10.0)*0.03;
  float cr = 0.1*cos(0.1);
  vec3 ro = vec3(8.0*cos(time), 1.0, 8.0*sin(time) );
  vec3 ta = vec3(0.0,3.0,0.0);
    float fl = 1.8;

  // camera
    mat3 cam = setCamera( ro, ta, cr );
    vec3 rd = normalize( cam * vec3(p,-fl) );

    // raytrace scene    
    uint id;
    vec4 ren = render( ro, rd, sa, id );
    vec3 col = ren.xyz;
    float t = ren.w;

    
    //------------------------------------------
  // reproject from previous frame and average
    //------------------------------------------

    mat4 oldCam = mat4( texelFetch(iChannel1,ivec2(0,0), 0),
                        texelFetch(iChannel1,ivec2(1,0), 0),
                        texelFetch(iChannel1,ivec2(2,0), 0),
                        0.0, 0.0, 0.0, 1.0 );
    
    // world space
    vec4 wpos = vec4(ro + rd*t,1.0);
    // camera space
    vec3 cpos = (wpos*oldCam).xyz; // note inverse multiply
    // ndc space
    vec2 npos = -fl * cpos.xy / cpos.z;
    // screen space
    vec2 spos = 0.5 + 0.5*npos*vec2(iResolution.y/iResolution.x,1.0);
    // undo dither
    spos -= off/iResolution.xy;
  // raster space
    vec2 rpos = spos * iResolution.xy - .5;
    ivec2 ipos = ivec2(floor(rpos));
    // blend pixel color history
    if( (ipos.y>0 || ipos.x>2) && iFrame>0 )
    {
        #if 1
        vec2 fuv = rpos - vec2(ipos);
        vec4 odata1 = texelFetch( iChannel1, ipos+ivec2(0,0), 0 );
        vec4 odata2 = texelFetch( iChannel1, ipos+ivec2(1,0), 0 );
        vec4 odata3 = texelFetch( iChannel1, ipos+ivec2(0,1), 0 );
        vec4 odata4 = texelFetch( iChannel1, ipos+ivec2(1,1), 0 );
        vec4 ocol = vec4(0.0);
        int n = 0;
        if( id==uint(odata1.w) ) { ocol += vec4( odata1.xyz, 1.0)*(1.0-fuv.x)*(1.0-fuv.y); n++; }
        if( id==uint(odata2.w) ) { ocol += vec4( odata2.xyz, 1.0)*(    fuv.x)*(1.0-fuv.y); n++; }
        if( id==uint(odata3.w) ) { ocol += vec4( odata3.xyz, 1.0)*(1.0-fuv.x)*(    fuv.y); n++; }
        if( id==uint(odata4.w) ) { ocol += vec4( odata4.xyz, 1.0)*(    fuv.x)*(    fuv.y); n++; }
        if( n>2 ) col = mix( max(ocol.xyz/ocol.w,0.0), col, 0.1 );
        else      col = mix( textureLod( iChannel1, spos, 0.0 ).xyz, col, 0.3 );
    #else
        col = mix( textureLod( iChannel1, spos, 0.0 ).xyz, col, 0.1 );
        #endif

    }

    //----------------------------------
    // output
  ivec2 ifc = ivec2(floor(fragCoord));
  if( ifc.y==0 && ifc.x<=2 )
    {
        // camera
        fragColor = vec4( cam[ifc.x], -dot(cam[ifc.x],ro) );
    }
    else
    {
        // color
        fragColor = vec4( col, id );
    }
}

