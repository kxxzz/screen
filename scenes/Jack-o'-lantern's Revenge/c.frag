//    _____          _   ________   __  _____              
//   |  __ \        | | |  ____\ \ / / |  __ \             
//   | |__) |__  ___| |_| |__   \ V /  | |__) |_ _ ___ ___ 
//   |  ___/ _ \/ __| __|  __|   > <   |  ___/ _` / __/ __|
//   | |  | (_) \__ \ |_| |     / . \  | |  | (_| \__ \__ \
//   |_|   \___/|___/\__|_|    /_/ \_\ |_|   \__,_|___/___/
//                                                         
//                                                         
// Motion blur, Depth of Field


#define ENABLE_DOF
#define ENABLE_MOTION_BLUR

///////////////////////////////



float GetCoC( float fDistance, float fPlaneInFocus )
{
#ifdef ENABLE_DOF    
    // http://http.developer.nvidia.com/GPUGems/gpugems_ch23.html

    float fAperture = min(1.0, fPlaneInFocus * fPlaneInFocus * 0.5);
    float fFocalLength = 0.02;
    
    return abs(fAperture * (fFocalLength * (fDistance - fPlaneInFocus)) /
          (fDistance * (fPlaneInFocus - fFocalLength)));  
#else
    return 0.0f;
#endif    
}

// Depth of field pass

#define BLUR_TAPS 64
float fGolden = 3.141592 * (3.0 - sqrt(5.0));

#define MOD2 vec2(4.438975,3.972973)

float Hash( float p ) 
{
    // https://www.shadertoy.com/view/4djSRW - Dave Hoskins
    vec2 p2 = fract(vec2(p) * MOD2);
    p2 += dot(p2.yx, p2.xy+19.19);
    return fract(p2.x * p2.y);    
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    CameraState camCurr;
    Cam_LoadState( camCurr, iChannel0, ivec2(0) );

    CameraState camPrev;
    Cam_LoadState( camPrev, iChannel0, ivec2(4,0) );
    
    vec2 vUV = fragCoord.xy / iResolution.xy;
    //vUV -= camCurr.vJitter / iResolution.xy;    // TAA has removed jitter

    vec4 vSample = texelFetch( iChannel0, ivec2(fragCoord.xy), 0 ).rgba;
    
    int iObjectId;
    float fDepth = DecodeDepthAndObjectId( vSample.w, iObjectId );
    
    vec3 vRayOrigin, vRayDir;

    float fAspectRatio = iResolution.x / iResolution.y;
    
    Cam_GetCameraRay( vUV, fAspectRatio, camCurr, vRayOrigin, vRayDir );    
    vec3 vWorldPos = vRayOrigin + vRayDir * fDepth;
        
    vec2 vPrevUV = Cam_GetUVFromWindowCoord( Cam_WorldToWindowCoord(vWorldPos, camPrev), fAspectRatio );// - camPrev.vJitter / iResolution.xy;
        
    vec3 vResult = vec3(0.0);
    
    float fTot = 0.0;
    
    float fPlaneInFocus = camCurr.fPlaneInFocus;
        
    float fCoC = GetCoC( fDepth, camCurr.fPlaneInFocus );
        
    float r = 1.0;
    vec2 vangle = vec2(0.0,fCoC); // Start angle
    
    float fWeight = max( 0.001, fCoC );    
    vResult.rgb = vSample.rgb * fWeight;
    fTot += fWeight;
    
#if defined(ENABLE_DOF) || defined(ENABLE_MOTION_BLUR)    
    float fMotionBlurTaps = float(BLUR_TAPS);
    
    float fShutterAngle = 0.5;
    
    float f = 0.0;
    float fIndex = 0.0;
    for(int i=1; i<BLUR_TAPS; i++)
    {
        float fRandomT = Hash( iTime + fIndex + vUV.x + vUV.y * 12.345);
        float fOrderedT = fIndex / fMotionBlurTaps;
        
        float fDofT = fOrderedT;
        float fMotionT = fRandomT;
        
        vec2 vTapUV = vUV;
        #ifdef ENABLE_MOTION_BLUR
        vTapUV = mix( vTapUV, vPrevUV, (fMotionT - 0.5) * fShutterAngle );
        #endif
                
        // http://blog.marmakoide.org/?p=1
        
        float fTheta = fDofT * fGolden * fMotionBlurTaps;
        float fRadius = fCoC * sqrt( fDofT * fMotionBlurTaps ) / sqrt( fMotionBlurTaps );        
        
        vTapUV += vec2( sin(fTheta), cos(fTheta) ) * fRadius;
        
        vec4 vTapSample = textureLod( iChannel0, vTapUV, 0.0 ).rgba;
        //vec4 vTapTexel = texelFetch( iChannel0, ivec2(vTapUV.xy * iResolution.xy), 0 ).rgba;
        
        int iTapObjectId;
        float fTapDepth = DecodeDepthAndObjectId( vTapSample.w, iTapObjectId );
        
        if ( fTapDepth > 0.0 )
        {            
            float fCurrCoC = GetCoC( fTapDepth, fPlaneInFocus );
            
            float fCurrWeight = max( 0.001, fCurrCoC );
            
            vResult += vTapSample.rgb * fCurrWeight;
            fTot += fCurrWeight;
        }
        f += 1.0;
        fIndex += 1.0;
    }
#endif    
    vResult /= fTot;
    
    fragColor = vec4(vResult, 1.0);        
}

