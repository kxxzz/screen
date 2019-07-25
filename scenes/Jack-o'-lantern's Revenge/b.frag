//    _______                                   _                        _____              
//   |__   __|                                 | |     /\        /\     |  __ \             
//      | | ___ _ __ ___  _ __   ___  _ __ __ _| |    /  \      /  \    | |__) |_ _ ___ ___ 
//      | |/ _ \ '_ ` _ \| '_ \ / _ \| '__/ _` | |   / /\ \    / /\ \   |  ___/ _` / __/ __|
//      | |  __/ | | | | | |_) | (_) | | | (_| | |  / ____ \  / ____ \  | |  | (_| \__ \__ \
//      |_|\___|_| |_| |_| .__/ \___/|_|  \__,_|_| /_/    \_\/_/    \_\ |_|   \__,_|___/___/
//                       | |                                                                
//                       |_|                                                                


#define ENABLE_TAA

///////////////////////////////


#define iChannelCurr iChannel0
#define iChannelHistory iChannel1

vec3 Tonemap( vec3 x )
{
    float a = 0.010;
    float b = 0.132;
    float c = 0.010;
    float d = 0.163;
    float e = 0.101;

    return ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e );
}

vec3 TAA_ColorSpace( vec3 color )
{
    return Tonemap(color);
}

float minComponent( vec3 a )
{
    return min(a.x, min(a.y, a.z) );
}

// Adapted from https://github.com/gokselgoktas/temporal-anti-aliasing/blob/master/Assets/Resources/Shaders/TemporalAntiAliasing.cginc
// which is adapted from https://github.com/playdeadgames/temporal
// Optimization by Stubbesaurus and epsilon adjustment to avoid division by zero
vec3 clipToAABB(vec3 color, vec3 minimum, vec3 maximum) {
    // note: only clips towards aabb center (but fast!)
    vec3 center  = 0.5 * (maximum + minimum);
    vec3 extents = 0.5 * (maximum - minimum);

    // This is actually `distance`, however the keyword is reserved
    vec3 offset = color - center;

    vec3 ts = abs(extents / (offset + 0.0001));
    float t = clamp(minComponent(ts), 0.0, 1.0);
    return center + offset * t;
}

void mainImage( out vec4 vFragColor, in vec2 vFragCoord )
{
    CameraState camCurr;
    Cam_LoadState( camCurr, iChannelCurr, ivec2(0) );
    
    CameraState camPrev;
    Cam_LoadState( camPrev, iChannelHistory, ivec2(0) );

    vec2 vReducedResolution = LoadVec4( iChannelCurr, ivec2(7,0) ).xy;
            
    vec2 vUV = vFragCoord.xy / iResolution.xy;
    ivec2 vCurrXY = ivec2(floor(vFragCoord.xy));
    
    vec2 vfReducedXY = vFragCoord.xy * vReducedResolution / iResolution.xy;
    ivec2 vReducedXY = ivec2(floor(vfReducedXY));
    //vfReducedXY -= 0.5;

        
    //vec2 vUnJitterUV = vUV - camCurr.vJitter / iResolution.xy;    
    
    //vFragColor = textureLod(iChannelCurr, vUnJitterUV, 0.0);
    //vFragColor = texelFetch( iChannelCurr, vReducedXY, 0);
    vFragColor = textureLod( iChannelCurr, vfReducedXY / iResolution.xy, 0.0);
    
    float fAspectRatio = iResolution.x / iResolution.y;
    
    
#ifdef ENABLE_TAA
    vec3 vRayOrigin, vRayDir;
    Cam_GetCameraRay( vUV, fAspectRatio, camCurr, vRayOrigin, vRayDir );    
    float fDepth;
    int iObjectId;
    //vec4 vCurrTexel = texelFetch( iChannelCurr, vReducedXY, 0);
    vec4 vCurrTexel = texture( iChannelCurr, vfReducedXY / iResolution.xy, 0.0);
    fDepth = DecodeDepthAndObjectId( vCurrTexel.w, iObjectId );
    vec3 vWorldPos = vRayOrigin + vRayDir * fDepth;
    
    vec2 vPrevUV = Cam_GetUVFromWindowCoord( Cam_WorldToWindowCoord(vWorldPos, camPrev), fAspectRatio );
        
    if ( all( greaterThanEqual( vPrevUV, vec2(0) )) && all( lessThan( vPrevUV, vec2(1) )) )
    {
        vec3 vMin = vec3( 10000);
        vec3 vMax = vec3(-10000);
        
        int iNeighborhoodSize = 1;
        for ( int iy=-iNeighborhoodSize; iy<=iNeighborhoodSize; iy++)
        {
            for ( int ix=-iNeighborhoodSize; ix<=iNeighborhoodSize; ix++)
            {
                ivec2 iOffset = ivec2(ix, iy);
                vec3 vTest = texelFetch( iChannelCurr, vReducedXY + iOffset, 0 ).rgb;
                                
                vMin = min( vMin, vTest );
                vMax = max( vMax, vTest );
            }
        }
        
        float epsilon = 0.0;
        vMin -= epsilon;
        vMax += epsilon;
        
        float fBlend = 0.0f;
        
        vec4 vHistory = textureLod( iChannelHistory, vPrevUV, 0.0 );
        vHistory.rgb = clipToAABB( vHistory.rgb, vMin, vMax );

        fBlend = 0.95;
        
        //fBlend = 0.0;
        
        vFragColor.rgb = mix( vFragColor.rgb, vHistory.rgb, fBlend);
    }  
    else
    {
        //vFragColor.gb *= 0.0;
    }

#endif
    
    vFragColor.rgb += (hash13( vec3( vFragCoord, iTime ) ) * 2.0 - 1.0) * 0.03;
    
    Cam_StoreState( ivec2(0), camCurr, vFragColor, ivec2(vFragCoord.xy) );    
    Cam_StoreState( ivec2(4,0), camPrev, vFragColor, ivec2(vFragCoord.xy) );    
}

