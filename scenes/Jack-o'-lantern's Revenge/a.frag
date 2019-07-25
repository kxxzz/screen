//     _____                       _____                _           _             
//    / ____|                     |  __ \              | |         (_)            
//   | (___   ___ ___ _ __   ___  | |__) |___ _ __   __| | ___ _ __ _ _ __   __ _ 
//    \___ \ / __/ _ \ '_ \ / _ \ |  _  // _ \ '_ \ / _` |/ _ \ '__| | '_ \ / _` |
//    ____) | (_|  __/ | | |  __/ | | \ \  __/ | | | (_| |  __/ |  | | | | | (_| |
//   |_____/ \___\___|_| |_|\___| |_|  \_\___|_| |_|\__,_|\___|_|  |_|_| |_|\__, |
//                                                                           __/ |
//                                                                          |___/ 

#define ENABLE_TAA_JITTER

#define FLY_CAM_INVERT_Y 1

#define kMaxTraceDist 1000.0
#define kFarDist 1100.0

#define MAT_FG_BEGIN    10

#define PI 3.141592654

#define iChannelCurr        iChannel0
#define iChannelKeyboard    iChannel3

#define DRAW_LAMP 

//    _____ _          ____                
//   |  ___| |_   _   / ___|__ _ _ __ ___  
//   | |_  | | | | | | |   / _` | '_ ` _ \ 
//   |  _| | | |_| | | |__| (_| | | | | | |
//   |_|   |_|\__, |  \____\__,_|_| |_| |_|
//            |___/                        
//

struct FlyCamState
{
    vec3 vPos;
    vec3 vAngles;
    vec4 vPrevMouse;
};

void FlyCam_LoadState( out FlyCamState flyCam, sampler2D sampler, ivec2 addr )
{
    vec4 vPos = LoadVec4( sampler, addr + ivec2(0,0) );
    flyCam.vPos = vPos.xyz;
    vec4 vAngles = LoadVec4( sampler, addr + ivec2(1,0) );
    flyCam.vAngles = vAngles.xyz;
    vec4 vPrevMouse = LoadVec4( sampler, addr + ivec2(2,0) );    
    flyCam.vPrevMouse = vPrevMouse;
}

void FlyCam_StoreState( ivec2 addr, const in FlyCamState flyCam, inout vec4 fragColor, in ivec2 fragCoord )
{
    StoreVec4( addr + ivec2(0,0), vec4( flyCam.vPos, 0 ), fragColor, fragCoord );
    StoreVec4( addr + ivec2(1,0), vec4( flyCam.vAngles, 0 ), fragColor, fragCoord );
    StoreVec4( addr + ivec2(2,0), vec4( iMouse ), fragColor, fragCoord );
}

void FlyCam_GetAxes( FlyCamState flyCam, out vec3 vRight, out vec3 vUp, out vec3 vForwards )
{
    vec3 vAngles = flyCam.vAngles;
    mat3 rotX = mat3(1.0, 0.0, 0.0, 
                     0.0, cos(vAngles.x), sin(vAngles.x), 
                     0.0, -sin(vAngles.x), cos(vAngles.x));
    
    mat3 rotY = mat3(cos(vAngles.y), 0.0, -sin(vAngles.y), 
                     0.0, 1.0, 0.0, 
                     sin(vAngles.y), 0.0, cos(vAngles.y));    

    mat3 rotZ = mat3(cos(vAngles.z), sin(vAngles.z), 0.0,
                     -sin(vAngles.z), cos(vAngles.z), 0.0,
                     0.0, 0.0, 1.0 );
    
    
    mat3 m = rotY * rotX * rotZ;
    
    vRight = m[0];
    vUp = m[1];
    vForwards = m[2];
}

void FlyCam_Update( inout FlyCamState flyCam, vec3 vStartPos, vec3 vStartAngles )
{    
    //float fMoveSpeed = 0.01;
    float fMoveSpeed = iTimeDelta * 0.5;
    float fRotateSpeed = 3.0;
    
    if ( Key_IsPressed( iChannelKeyboard, KEY_SHIFT ) )
    {
        fMoveSpeed *= 4.0;
    }
    
    if ( iFrame == 0 )
    {
        flyCam.vPos = vStartPos;
        flyCam.vAngles = vStartAngles;
        flyCam.vPrevMouse = iMouse;
    }
      
    vec3 vMove = vec3(0.0);
        
    if ( Key_IsPressed( iChannelKeyboard, KEY_W ) )
    {
        vMove.z += fMoveSpeed;
    }
    if ( Key_IsPressed( iChannelKeyboard, KEY_S ) )
    {
        vMove.z -= fMoveSpeed;
    }

    if ( Key_IsPressed( iChannelKeyboard, KEY_A ) )
    {
        vMove.x -= fMoveSpeed;
    }
    if ( Key_IsPressed( iChannelKeyboard, KEY_D ) )
    {
        vMove.x += fMoveSpeed;
    }
    
    vec3 vForwards, vRight, vUp;
    FlyCam_GetAxes( flyCam, vRight, vUp, vForwards );
        
    flyCam.vPos += vRight * vMove.x + vForwards * vMove.z;
    
    vec3 vRotate = vec3(0);
    
    bool bMouseDown = iMouse.z > 0.0;
    bool bMouseWasDown = flyCam.vPrevMouse.z > 0.0;
    
    if ( bMouseDown && bMouseWasDown )
    {
        vRotate.yx += ((iMouse.xy - flyCam.vPrevMouse.xy) / iResolution.xy) * fRotateSpeed;
    }
    
#if FLY_CAM_INVERT_Y    
    vRotate.x *= -1.0;
#endif    
    
    if ( Key_IsPressed( iChannelKeyboard, KEY_E ) )
    {
        vRotate.z -= fRotateSpeed * 0.01;
    }
    if ( Key_IsPressed( iChannelKeyboard, KEY_Q ) )
    {
        vRotate.z += fRotateSpeed * 0.01;
    }
        
    flyCam.vAngles += vRotate;
    
    flyCam.vAngles.x = clamp( flyCam.vAngles.x, -PI * .5, PI * .5 );
}

//    ____                      
//   / ___|  ___ ___ _ __   ___ 
//   \___ \ / __/ _ \ '_ \ / _ \
//    ___) | (_|  __/ | | |  __/
//   |____/ \___\___|_| |_|\___|
//                              

struct SceneResult
{
    float fDist;
    int iObjectId;
    vec3 vUVW;
};
    
SceneResult Scene_Union( SceneResult a, SceneResult b )
{
    if ( b.fDist < a.fDist )
    {
        return b;
    }
    return a;
}

    
SceneResult Scene_Subtract( SceneResult a, SceneResult b )
{
    if ( a.fDist < -b.fDist )
    {
        b.fDist = -b.fDist;
        return b;
    }
    
    return a;
}

float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

SceneResult Scene_SmoothSubtract( SceneResult a, SceneResult b, float k )
{    
    float fA = a.fDist;
    float fB = -b.fDist;        
    
    float fC = -smin( -fA, -fB, k );
    
    a.fDist = fC;
    b.fDist = fC;
    
    if ( fA < (fB + k) )
    {        
        return b;
    }
    
    return a;
}

SceneResult Scene_GetDistance( vec3 vPos );    

vec3 Scene_GetNormal(const in vec3 vPos)
{
    const float fDelta = 0.0001;
    vec2 e = vec2( -1, 1 );
    
    vec3 vNormal = 
        Scene_GetDistance( e.yxx * fDelta + vPos ).fDist * e.yxx + 
        Scene_GetDistance( e.xxy * fDelta + vPos ).fDist * e.xxy + 
        Scene_GetDistance( e.xyx * fDelta + vPos ).fDist * e.xyx + 
        Scene_GetDistance( e.yyy * fDelta + vPos ).fDist * e.yyy;
    
    return normalize( vNormal );
}    
    
SceneResult Scene_Trace( const in vec3 vRayOrigin, const in vec3 vRayDir, float minDist, float maxDist )
{   
    SceneResult result;
    result.fDist = 0.0;
    result.vUVW = vec3(0.0);
    result.iObjectId = -1;
    
    float t = minDist;
    const int kRaymarchMaxIter = 64;
    for(int i=0; i<kRaymarchMaxIter; i++)
    {       
        float epsilon = 0.0001 * t;
        result = Scene_GetDistance( vRayOrigin + vRayDir * t );
        if ( abs(result.fDist) < epsilon )
        {
            break;
        }
                        
        if ( t > maxDist )
        {
            result.iObjectId = -1;
            t = maxDist;
            break;
        }       
        
        if ( result.fDist > 1.0 )
        {
            result.iObjectId = -1;            
        }    
        
        t += result.fDist;        
    }
    
    result.fDist = t;


    return result;
}    

float Scene_TraceShadow( const in vec3 vRayOrigin, const in vec3 vRayDir, const in float fMinDist, const in float fLightDist )
{
    //return 1.0;
    //return ( Scene_Trace( vRayOrigin, vRayDir, 0.1, fLightDist ).fDist < fLightDist ? 0.0 : 1.0;
    
    float res = 1.0;
    float t = fMinDist;
    for( int i=0; i<16; i++ )
    {
        float h = Scene_GetDistance( vRayOrigin + vRayDir * t ).fDist;
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.02, 0.10 );
        if( h<0.0001 || t>fLightDist ) break;
    }
    return clamp( res, 0.0, 1.0 );    
}

float Scene_GetAmbientOcclusion( const in vec3 vPos, const in vec3 vDir )
{
    float fOcclusion = 0.0;
    float fScale = 1.0;
    for( int i=0; i<5; i++ )
    {
        float fOffsetDist = 0.001 + 0.1*float(i)/4.0;
        vec3 vAOPos = vDir * fOffsetDist + vPos;
        float fDist = Scene_GetDistance( vAOPos ).fDist;
        fOcclusion += (fOffsetDist - fDist) * fScale;
        fScale *= 0.4;
    }
    
    return clamp( 1.0 - 30.0*fOcclusion, 0.0, 1.0 );
}

//    _     _       _     _   _             
//   | |   (_) __ _| |__ | |_(_)_ __   __ _ 
//   | |   | |/ _` | '_ \| __| | '_ \ / _` |
//   | |___| | (_| | | | | |_| | | | | (_| |
//   |_____|_|\__, |_| |_|\__|_|_| |_|\__, |
//            |___/                   |___/ 
//                                          
    
struct SurfaceInfo
{
    vec3 vPos;
    vec3 vNormal;
    vec3 vBumpNormal;    
    vec3 vAlbedo;
    vec3 vR0;
    float fGloss;
    vec3 vEmissive;
};
    
SurfaceInfo Scene_GetSurfaceInfo( const in vec3 vRayOrigin,  const in vec3 vRayDir, SceneResult traceResult );

struct SurfaceLighting
{
    vec3 vDiffuse;
    vec3 vSpecular;
};
    
SurfaceLighting Scene_GetSurfaceLighting( const in vec3 vRayDir, in SurfaceInfo surfaceInfo );

float Light_GIV( float dotNV, float k)
{
    return 1.0 / ((dotNV + 0.0001) * (1.0 - k)+k);
}

float AlphaSqrFromGloss( const in float gloss )
{
    float MAX_SPEC = 10.0;
    return 2.0f  / ( 2.0f + exp2( gloss * MAX_SPEC) );
}

void Light_Add(inout SurfaceLighting lighting, SurfaceInfo surface, const in vec3 vViewDir, const in vec3 vLightDir, const in vec3 vLightColour)
{
    float fNDotL = clamp(dot(vLightDir, surface.vBumpNormal), 0.0, 1.0);
    
    lighting.vDiffuse += vLightColour * fNDotL;
    
    vec3 vH = normalize( -vViewDir + vLightDir );
    float fNdotV = clamp(dot(-vViewDir, surface.vBumpNormal), 0.0, 1.0);
    float fNdotH = clamp(dot(surface.vBumpNormal, vH), 0.0, 1.0);
    
    // D

    float alphaSqr = AlphaSqrFromGloss( surface.fGloss );
    float alpha = sqrt( alphaSqr );
    float denom = fNdotH * fNdotH * (alphaSqr - 1.0) + 1.0;
    float d = alphaSqr / (PI * denom * denom);

    float k = alpha / 2.0;
    float vis = Light_GIV(fNDotL, k) * Light_GIV(fNdotV, k);

    float fSpecularIntensity = d * vis * fNDotL;    
    lighting.vSpecular += vLightColour * fSpecularIntensity;    
}

void Light_AddPoint(inout SurfaceLighting lighting, SurfaceInfo surface, const in vec3 vViewDir, const in vec3 vLightPos, const vec3 vLightColour)
{    
    vec3 vPos = surface.vPos;
    vec3 vToLight = vLightPos - vPos;   
    
    vec3 vLightDir = normalize(vToLight);
    float fDistance2 = dot(vToLight, vToLight);
    float fAttenuation = 100.0 / (fDistance2);
    
    float fShadowFactor = Scene_TraceShadow( surface.vPos, vLightDir, 0.1, length(vToLight) );
    
    Light_Add( lighting, surface, vViewDir, vLightDir, vLightColour * fShadowFactor * fAttenuation);
}

float Light_SpotFactor( vec3 vLightDir, vec3 vSpotDir, float fSpotInnerAngle, float fSpotOuterAngle )   
{
    float fSpotDot = dot( vLightDir, -vSpotDir );
    
    float fTheta = acos(fSpotDot);

    float fAngularAttenuation = clamp( (fTheta - fSpotOuterAngle) / (fSpotInnerAngle - fSpotOuterAngle), 0.0, 1.0 );
    
    float fShapeT = fTheta / fSpotOuterAngle;
    fShapeT = fShapeT * fShapeT * fShapeT;
    float fShape = (sin( (1.0 - fShapeT) * 10.0));
    fShape = fShape * fShape * (fShapeT) + (1.0 - fShapeT);
    
    //return fShape;
    return fAngularAttenuation * fShape;
}
    

void Light_AddSpot( inout SurfaceLighting lighting, SurfaceInfo surface, const in vec3 vViewDir, const vec3 vLightPos, const vec3 vSpotDir, float fSpotInnerAngle, float fSpotOuterAngle, vec3 vLightColour )
{
    vec3 vPos = surface.vPos;
    vec3 vToLight = vLightPos - vPos;   
    
    vec3 vLightDir = normalize(vToLight);
    float fDistance2 = dot(vToLight, vToLight);
    float fAttenuation = 100.0 / (fDistance2);
    
    float fShadowFactor = Scene_TraceShadow( surface.vPos, vLightDir, 0.1, length(vToLight) );
    
    fShadowFactor *= Light_SpotFactor( vLightDir, vSpotDir, fSpotInnerAngle, fSpotOuterAngle );
    
    Light_Add( lighting, surface, vViewDir, vLightDir, vLightColour * fShadowFactor * fAttenuation);    
}

void Light_AddDirectional(inout SurfaceLighting lighting, SurfaceInfo surface, const in vec3 vViewDir, const in vec3 vLightDir, const in vec3 vLightColour)
{   
    float fAttenuation = 1.0;
    float fShadowFactor = Scene_TraceShadow( surface.vPos, vLightDir, 0.1, 10.0 );
    
    Light_Add( lighting, surface, vViewDir, vLightDir, vLightColour * fShadowFactor * fAttenuation);
}

vec3 Light_GetFresnel( vec3 vView, vec3 vNormal, vec3 vR0, float fGloss )
{
    float NdotV = max( 0.0, dot( vView, vNormal ) );

    return vR0 + (vec3(1.0) - vR0) * pow( 1.0 - NdotV, 5.0 ) * pow( fGloss, 20.0 );
}

void Env_AddPointLightFlare(inout vec3 vEmissiveGlow, const in vec3 vRayOrigin, const in vec3 vRayDir, const in float fIntersectDistance, const in vec3 vLightPos, const in vec3 vLightColour)
{
    vec3 vToLight = vLightPos - vRayOrigin;
    float fPointDot = dot(vToLight, vRayDir);
    fPointDot = clamp(fPointDot, 0.0, fIntersectDistance);

    vec3 vClosestPoint = vRayOrigin + vRayDir * fPointDot;
    float fDist = length(vClosestPoint - vLightPos);
    vEmissiveGlow += sqrt(vLightColour * 0.05 / (fDist * fDist));
}

void Env_AddDirectionalLightFlareToFog(inout vec3 vFogColour, const in vec3 vRayDir, const in vec3 vLightDir, const in vec3 vLightColour)
{
    float fDirDot = clamp(dot(vLightDir, vRayDir) * 0.5 + 0.5, 0.0, 1.0);
    float kSpreadPower = 2.0;
    vFogColour += vLightColour * pow(fDirDot, kSpreadPower) * 0.25;
}

//    ____                _           _             
//   |  _ \ ___ _ __   __| | ___ _ __(_)_ __   __ _ 
//   | |_) / _ \ '_ \ / _` |/ _ \ '__| | '_ \ / _` |
//   |  _ <  __/ | | | (_| |  __/ |  | | | | | (_| |
//   |_| \_\___|_| |_|\__,_|\___|_|  |_|_| |_|\__, |
//                                            |___/ 
//                                                  

vec4 Env_GetSkyColor( const vec3 vViewPos, const vec3 vViewDir );
vec3 Env_ApplyAtmosphere( const in vec3 vColor, const in vec3 vRayOrigin,  const in vec3 vRayDir, const in float fDist );
vec3 FX_Apply( in vec3 vColor, const in vec3 vRayOrigin,  const in vec3 vRayDir, const in float fDist);

vec4 Scene_GetColorAndDepth( vec3 vRayOrigin, vec3 vRayDir )
{
    vec3 vResultColor = vec3(0.0);
            
    SceneResult firstTraceResult;
    
    float fStartDist = 0.0f;
    float fMaxDist = 10.0f;
    
    vec3 vRemaining = vec3(1.0);
    
    for( int iPassIndex=0; iPassIndex < 2; iPassIndex++ )
    {
        SceneResult traceResult = Scene_Trace( vRayOrigin, vRayDir, fStartDist, fMaxDist );

        if ( iPassIndex == 0 )
        {
            firstTraceResult = traceResult;
        }
        
        vec3 vColor = vec3(0);
        vec3 vReflectAmount = vec3(0);
        
        if( traceResult.iObjectId < 0 )
        {
            vColor = Env_GetSkyColor( vRayOrigin, vRayDir ).rgb;
            vColor = Env_ApplyAtmosphere( vColor, vRayOrigin, vRayDir, traceResult.fDist );
        }
        else
        {
            
            SurfaceInfo surfaceInfo = Scene_GetSurfaceInfo( vRayOrigin, vRayDir, traceResult );
            SurfaceLighting surfaceLighting = Scene_GetSurfaceLighting( vRayDir, surfaceInfo );
                
            // calculate reflectance (Fresnel)
            vReflectAmount = Light_GetFresnel( -vRayDir, surfaceInfo.vBumpNormal, surfaceInfo.vR0, surfaceInfo.fGloss );
            
            vColor = (surfaceInfo.vAlbedo * surfaceLighting.vDiffuse + surfaceInfo.vEmissive) * (vec3(1.0) - vReflectAmount); 
            
            vec3 vReflectRayOrigin = surfaceInfo.vPos;
            vec3 vReflectRayDir = normalize( reflect( vRayDir, surfaceInfo.vBumpNormal ) );
            fStartDist = 0.001 / max(0.0000001,abs(dot( vReflectRayDir, surfaceInfo.vNormal ))); 

            vColor += surfaceLighting.vSpecular * vReflectAmount;            

            vColor = Env_ApplyAtmosphere( vColor, vRayOrigin, vRayDir, traceResult.fDist );
            vColor = FX_Apply( vColor, vRayOrigin, vRayDir, traceResult.fDist );
            
            vRayOrigin = vReflectRayOrigin;
            vRayDir = vReflectRayDir;
        }
        
        vResultColor += vColor * vRemaining;
        vRemaining *= vReflectAmount;        
    }
 
    return vec4( vResultColor, EncodeDepthAndObject( firstTraceResult.fDist, firstTraceResult.iObjectId ) );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////

//    ____                        ____                      _       _   _             
//   / ___|  ___ ___ _ __   ___  |  _ \  ___  ___  ___ _ __(_)_ __ | |_(_) ___  _ __  
//   \___ \ / __/ _ \ '_ \ / _ \ | | | |/ _ \/ __|/ __| '__| | '_ \| __| |/ _ \| '_ \ 
//    ___) | (_|  __/ | | |  __/ | |_| |  __/\__ \ (__| |  | | |_) | |_| | (_) | | | |
//   |____/ \___\___|_| |_|\___| |____/ \___||___/\___|_|  |_| .__/ \__|_|\___/|_| |_|
//                                                           |_|                      
//

// Materials

int MAT_DEFAULT = 0,
    MAT_CHROME = 1,
    MAT_CHROME_GLOW = 2,
    MAT_WOOD = 3,
    MAT_CHECKER = 4,
    MAT_GOLD = 5,
    MAT_PUMPKIN = 6,
    MAT_PUMPKIN_STALK = 7,
    MAT_PUMPKIN_INTERIOR = 8;

float Checker(vec2 vUV)
{
    return step(fract((floor(vUV.x) + floor(vUV.y)) * 0.5), 0.25);
}


struct TileInfo
{
    vec2 vTilePos;    
    ivec2 vTileIndex;
    vec2 vTileUV;
    float fHeight;
    bool bGrout;
};

TileInfo Tile( vec2 vUV )
{
    TileInfo result;
    
    result.vTilePos = vUV;
    result.vTileIndex = ivec2( floor( result.vTilePos ) );
    result.vTileUV = fract( result.vTilePos );

    result.fHeight = 0.0;
    result.bGrout = false;

    float fBevelSize = 0.05;
    float fGroutSize = 0.02;
    vec2 vEdge = (abs( fract(result.vTileUV + 0.5) - 0.5) - fGroutSize) / fBevelSize;
    float fEdge = clamp( min( vEdge.x, vEdge.y ), 0.0, 1.0);
    
    float fCurve = 1.0 - fEdge;    
    fCurve *= 0.8;
    result.fHeight -= sqrt( 1.0 - fCurve * fCurve );
    
//    vec2 vRandomUV = vUV * .5;
    //if ( result.vTileUV.x >= 0.95 || result.vTileUV.y >= 0.95 )
    if ( fEdge == 0.0 )
    {
        result.bGrout = true;
        //vRandomUV *= 5.0;
    }
    
//    result.fHeight += textureLod( iChannel2, vRandomUV, 0.5 ).r * 0.2;
    
    return result;
}

float GetInnerDist( vec3 vPos )
{
    vec3 vDim =  normalize( vec3(1.0, 1.5, 1.0) );
    return (length(vPos * vDim ) - 1.3);
}

float Flicker()
{
    return hash11(iTime) * 0.2 + 0.8;
}

vec3 GetGlowCol()
{
    return vec3(1.0, 0.8, 0.5) * Flicker();
}

vec3 GetSpotColor()
{
    return vec3(1, 0.98, 0.95) * step(hash11(iTime), 0.99);    
}

SurfaceInfo Scene_GetSurfaceInfo( const in vec3 vRayOrigin,  const in vec3 vRayDir, SceneResult traceResult )
{
    SurfaceInfo surfaceInfo;
    
    surfaceInfo.vPos = vRayOrigin + vRayDir * (traceResult.fDist);
    
    surfaceInfo.vNormal = Scene_GetNormal( surfaceInfo.vPos ); 
    surfaceInfo.vBumpNormal = surfaceInfo.vNormal;
    surfaceInfo.vAlbedo = vec3(1.0);
    surfaceInfo.vR0 = vec3( 0.02 );
    surfaceInfo.fGloss = 1.0;
    surfaceInfo.vEmissive = vec3( 0.0 );
    
    
    vec3 vBumpUV = vec3(0);
    float fBumpMag = 0.0;
    
    vec3 vLightPos = vec3(0,0.075, 0.0);
    //vec3 vPumpkinDomain = surfaceInfo.vPos - vec3(0,0.1, -0.5);            

    vec3 vLightToPos = surfaceInfo.vPos - vLightPos;
    //vec3 vDir = normalize(vLightToPos);

    float fInnerDist = GetInnerDist( vLightToPos * 30.0 ) / 30.0;

    float fOpticalDepth = length(vLightToPos) - fInnerDist;

    fOpticalDepth = max(0.0000001, fOpticalDepth);
    
    vec3 vGlow = exp2(vec3(0.8, 0.9, 1.0) * fOpticalDepth * -180. );
    vec3 vGlowCol = GetGlowCol();    
    
    if ( traceResult.iObjectId == MAT_DEFAULT )
    {
        surfaceInfo.vAlbedo = vec3(0.75, 0.75, 0.75); 
        surfaceInfo.fGloss = 0.9;
        surfaceInfo.vR0 = vec3( 0.02 );
    }
    

    if ( traceResult.iObjectId == MAT_CHECKER )
    {
        TileInfo tileInfo = Tile( surfaceInfo.vPos.xz * 10.0);
        
        //vec2 vTilePos = surfaceInfo.vPos.xz * 10.0;
        //ivec2 vTileIndex = ivec2( floor( vTilePos ) );
        //vec2 vTileUV = fract( vTilePos );
        
        //surfaceInfo.vAlbedo = Checker( surfaceInfo.vPos.xz * 20.0 ) > 0.5 ? vec3(1.0,0.1,0.1) : vec3(0.9,0.9,0.9);
        
        surfaceInfo.vAlbedo = vec3(0.9, 0.9, 0.9);

        if ( ((tileInfo.vTileIndex.x + tileInfo.vTileIndex.y) % 2) == 0)
        {
            surfaceInfo.vAlbedo = vec3(0.1);
        }
        
        surfaceInfo.fGloss = 1.0;
        surfaceInfo.vR0 = vec3( 0.02 );
        
        vBumpUV = traceResult.vUVW * 5.0;
        fBumpMag = 0.25;
        
        
        if ( tileInfo.bGrout )
        {
            surfaceInfo.vAlbedo = vec3(0.2);
            surfaceInfo.fGloss = 0.1;
            surfaceInfo.vR0 = vec3(0.005);
            
            vBumpUV = traceResult.vUVW * 20.0;
            fBumpMag = 0.2;
        }


        if ( false )
        if ( !tileInfo.bGrout )       
        if( tileInfo.vTileIndex.x > -3 && tileInfo.vTileIndex.x < 3 )
        {            
            float dist = 1.0 - dot( tileInfo.vTileUV - 0.5, tileInfo.vTileUV - 0.5);
            dist = clamp(dist, 0.0, 1.0);
            dist = dist * dist * dist;
            
            float fLight = float( (int(iTime)+tileInfo.vTileIndex.x + tileInfo.vTileIndex.y * 10)  % 3 ) / 3.;            
            surfaceInfo.vEmissive = dist * vec3(1.,8., 10.) * 
                fLight;
            surfaceInfo.vAlbedo = vec3(0.05);
            surfaceInfo.fGloss = 1.0;        
        }        
        
        surfaceInfo.vEmissive = vGlowCol * 500.0 * vGlow;

          
        //vec3 vDirt = mix( vec3(.5, .2, .1), vec3(.2, .1, .1), textureLod( iChannel2, surfaceInfo.vPos.xz, 0.0).r);
        //float fDirt = clamp( (surfaceInfo.vPos.x + 1.0 - surfaceInfo.vPos.y * 1000.0 + vDirt.y) * 10.0, 0.0, 1.0);
        //surfaceInfo.vAlbedo = mix( surfaceInfo.vAlbedo, vDirt, fDirt);                        
    }        

    if ( traceResult.iObjectId == MAT_WOOD )
    {
        surfaceInfo.vR0 = vec3( 0.001 );
        surfaceInfo.vAlbedo = textureLod( iChannel2, traceResult.vUVW.xz * 2.0, 0.0 ).rgb;
        surfaceInfo.vAlbedo = surfaceInfo.vAlbedo * surfaceInfo.vAlbedo;

        surfaceInfo.fGloss = clamp( surfaceInfo.vAlbedo.r * 0.3, 0.0, 1.0);        
    }
    


    
    
    if ( traceResult.iObjectId == MAT_PUMPKIN )
    {
        float fAngle = atan(traceResult.vUVW.x, traceResult.vUVW.z);
        vec2 vUV = vec2(fAngle, traceResult.vUVW.y) * vec2(1.0, 0.2) * 8.0;
        surfaceInfo.vAlbedo = texture(iChannel2, vUV).rgb;
        surfaceInfo.fGloss = clamp(1.0 - surfaceInfo.vAlbedo.r * surfaceInfo.vAlbedo.r * 2.0, 0.0, 1.0);            
        vec3 vCol1 = vec3(1.0, 0.5, 0.0);
        vec3 vCol2 = vec3(0.5, 0.06, 0.0);
        surfaceInfo.vAlbedo = mix(vCol1, vCol2, surfaceInfo.vAlbedo.r * 0.5).rgb;
        surfaceInfo.vR0 = vec3(0.05);     
       
         
        {

            surfaceInfo.vEmissive = vGlowCol * 5000.0 * vGlow;
        }  
        
        vBumpUV = traceResult.vUVW * 20.0;
        fBumpMag = 0.3;
    }    
    
 
  
    
    
   if ( traceResult.iObjectId == MAT_PUMPKIN_STALK )
    {
        surfaceInfo.vAlbedo = vec3(0.6, 0.6, 0.5); 
        surfaceInfo.fGloss = 0.1;
        surfaceInfo.vR0 = vec3( 0.02 );      

        surfaceInfo.vEmissive = vGlowCol * 5000.0 * vGlow * 0.1;
    }       
    
  
    // blood splat
    
    vec2 vProj = surfaceInfo.vPos.xz + vec2(0.0, surfaceInfo.vPos.y * 0.1);
        float bs = texture( iChannel2, vProj ).r;
//
        float fBsDist = length( vProj - vec2(0.0, -0.35));
        fBsDist = fBsDist * fBsDist;
        bs = clamp( bs + fBsDist - 0.2, 0.0, 1.0);
      
     bs = 1.0 - bs;
    
        bs = bs * bs;

        bs = min( iTime * 0.1, bs);
    
        //vec3 vBCol = mix( vec3(1), vec3(0.5, 0.0001, 0.001), bs);
        vec3 vBCol = exp2( -bs * (1.0 - vec3(0.7, 0.001, 0.001)) * 10.0);
        surfaceInfo.vAlbedo *= vBCol;
        surfaceInfo.fGloss = mix( surfaceInfo.fGloss, 0.99, bs);
        surfaceInfo.vR0 = mix( surfaceInfo.vR0, vec3(0.02), bs );   
    
    
    if ( traceResult.iObjectId == MAT_PUMPKIN_INTERIOR )
    {
        surfaceInfo.vAlbedo = vec3(1.0, 0.824, 0.301);
        
        surfaceInfo.fGloss = 0.01;
        surfaceInfo.vR0 = vec3(0.02);   
        surfaceInfo.vEmissive = vGlowCol * 200000.0 * vGlow;
    }  
    
        surfaceInfo.vEmissive *= vBCol;
         

    if ( fBumpMag > 0.0 )
    {
        vec3 vBump;
        vBump.x = textureLod( iChannel2, vBumpUV.xz, 3.0 ).r - 0.5;
        vBump.y = textureLod( iChannel2, vBumpUV.xz + 0.3, 3.0 ).r - 0.5;
        vBump.z = textureLod( iChannel2, vBumpUV.xz + 0.5, 3.0 ).r - 0.5;
        surfaceInfo.vBumpNormal = normalize( surfaceInfo.vBumpNormal + vBump * fBumpMag );
    }
 
    if ( traceResult.iObjectId == MAT_CHROME || traceResult.iObjectId == MAT_CHROME_GLOW)
    {
        surfaceInfo.vAlbedo = vec3(0.01, 0.01, 0.01); 
        surfaceInfo.fGloss = 0.9;
        surfaceInfo.vR0 = vec3( 0.8 );
        
        /*if ( surfaceInfo.vPos.y < 0.1 && surfaceInfo.vPos.y > 0.09)
        {
            surfaceInfo.vEmissive = vec3(0.2, 0.5, 1.0) * 500.0;
        }*/
        
        if ( traceResult.iObjectId == MAT_CHROME_GLOW )
        {
            surfaceInfo.vEmissive = GetSpotColor() * 200.0;
        }
    }    

    if ( traceResult.iObjectId == MAT_GOLD )
    {
        surfaceInfo.vAlbedo = vec3(0.01, 0.01, 0.01); 
        surfaceInfo.fGloss = 0.9;
        surfaceInfo.vR0 = vec3( 0.8, 0.5, 0.1 );
        
        /*if ( surfaceInfo.vPos.y < 0.1 && surfaceInfo.vPos.y > 0.09)
        {
            surfaceInfo.vEmissive = vec3(0.1, 1.0, 0.1) * 500.0;
        }
        */
    }       
    
    return surfaceInfo;
}

// Scene Description

float SmoothMin( float a, float b, float k )
{
    //return min(a,b);
    
    
    //float k = 0.06;
    float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

float UdRoundBox( vec3 p, vec3 b, float r )
{
    //vec3 vToFace = abs(p) - b;
    //vec3 vConstrained = max( vToFace, 0.0 );
    //return length( vConstrained ) - r;
    return length(max(abs(p)-b,0.0))-r;
}

float GetCarving2dDistance(const in vec2 vPos )
{
    //if(fCarving < 0.0)
//        return 10.0;
    
    float fMouthDist = length(vPos.xy + vec2(0.0, -0.5)) - 1.5;
    float fMouthDist2 = length(vPos.xy + vec2(0.0, -1.1 - 0.5)) - 2.0;
    
    if(-fMouthDist2 > fMouthDist )
    {
        fMouthDist = -fMouthDist2;
    }

    float fFaceDist = fMouthDist;

    vec2 vNosePos = vPos.xy + vec2(0.0, -0.5);
    vNosePos.x = abs(vNosePos.x);
    float fNoseDist = dot(vNosePos.xy, normalize(vec2(1.0, 0.5)));
    fNoseDist = max(fNoseDist, -(vNosePos.y + 0.5));
    if(fNoseDist < fFaceDist)
    {
        fFaceDist = fNoseDist;
    }


    vec2 vEyePos = vPos.xy;
    vEyePos.x = abs(vEyePos.x);
    vEyePos.x -= 1.0;
    vEyePos.y -= 1.0;
    float fEyeDist = dot(vEyePos.xy, normalize(vec2(-1.0, 1.5)));
    fEyeDist = max(fEyeDist, dot(vEyePos.xy, normalize(vec2(1.0, 0.5))));
    fEyeDist = max(fEyeDist, -0.5+dot(vEyePos.xy, normalize(vec2(0.0, -1.0))));
    if(fEyeDist < fFaceDist)
    {
        fFaceDist = fEyeDist;
    }
    
    return fFaceDist;
}

float GetCarvingDistance( vec3 vPos )
{
    float fScale = 1.0 / 30.0;
    vPos /= fScale;
    float fDist = GetInnerDist( vPos );

    float fFaceDist = GetCarving2dDistance(vPos.xy);
    
    float fRearDist = vPos.z;
    
    if(fRearDist > fFaceDist)
    {
        fFaceDist = fRearDist;
    }   
    
    if(fFaceDist < fDist )
    {
        fDist = fFaceDist;
    }

    float fR = length(vPos.xz);
    
    float fLidDist = dot( vec2(fR, vPos.y), normalize(vec2(1.0, -1.5)));
    
    fLidDist = abs(fLidDist) - 0.03;
    if(fLidDist < fDist )
    {
        fDist = fLidDist;
    }
    
    return fDist * fScale;
}

SceneResult Scene_GetPumpkinDistance( vec3 vPos )
{
    SceneResult result;
    vec3 vSphereOrigin = vec3(0.0, 0.0, 0.0);
    
    float fScale = 1.0 / 30.0;
    float fSphereRadius = 3.0 * fScale;

    vec3 vOffset = vPos - vSphereOrigin;
    float fFirstDist = length(vOffset);
    
    float fOutDist;
    
    float fAngle1 = atan(vOffset.x, vOffset.z);
    float fSin = sin(fAngle1 * 10.0);
    fSin = 1.0 - sqrt(abs(fSin));
    vOffset *= 1.0 + fSin * vec3(0.05, 0.025, 0.05);
    vOffset.y *= 1.0 + 0.5 * (fSphereRadius - length(vOffset.xz)) / fSphereRadius;
    result.fDist = length(vOffset) - fSphereRadius;
        
    result.vUVW = normalize(vPos - vSphereOrigin);
    
    //result.fDist -= textureLod( iChannel2, result.vUVW.xz * 1.0, 0.5 ).r * 0.001;
        
    result.iObjectId = MAT_PUMPKIN;
    
    
    vec3 vStalkOffset = vPos;
    vStalkOffset.x += -(vStalkOffset.y - fSphereRadius) * 0.1;
    float fDist2d = length(vStalkOffset.xz);
    float fStalkDist = fDist2d - 0.15 * fScale + vStalkOffset.y - 0.075;
    fStalkDist = max(fStalkDist, vPos.y - 2.2 * fScale + vPos.x * 0.25 * fScale);
    fStalkDist = max(fStalkDist, -vPos.y);
    if( fStalkDist < result.fDist )
    {
        result.fDist = fStalkDist;
        result.iObjectId = MAT_PUMPKIN_STALK;
    }

    return result;
}

float SmoothNoise(in vec2 o) 
{
    vec2 p = floor(o);
    vec2 f = fract(o);
        
    //float n = p.x + p.y*57.0;

    float a = hash12(p);
    float b = hash12(p+vec2(1,0));
    float c = hash12(p+vec2(0,1));
    float d = hash12(p+vec2(1,1));
    
    vec2 f2 = f * f;
    vec2 f3 = f2 * f;
    
    vec2 t = 3.0 * f2 - 2.0 * f3;
    
    float u = t.x;
    float v = t.y;

    float res = a + (b-a)*u +(c-a)*v + (a-b+d-c)*u*v;
    
    return res;
}

float FBM( vec2 p, float ps ) {
    float f = 0.0;
    float tot = 0.0;
    float a = 1.0;
    for( int i=0; i<3; i++)
    {
        f += SmoothNoise( p ) * a;
        p *= 2.0;
        tot += a;
        a *= ps;
    }
    return f / tot;
}

void GetSpotState( out vec3 vSpotPos, out vec3 vSpotTarget )
{
    vec3 vSpotPivot = vec3(0.0, 0.75, 0.1);
    vSpotPos = vec3(0.0, 0.25, 0.1);
    vSpotTarget = vec3(0.0, 0, 0.1);
    
    vec3 vSpotOffset = vec3(0);
    vSpotOffset.x = sin(iTime * 2.0) * 0.1;
    vSpotOffset.z = cos(iTime * 2.01) * 0.01;
    
    vSpotTarget += vSpotOffset;    

    vSpotPos = vSpotPivot + normalize(vSpotTarget- vSpotPivot) * 0.5;
}


SceneResult Scene_GetDistance( vec3 vPos )
{
    SceneResult result;

#if 1
    //result.fDist = vPos.y;
    float fBenchBevel = 0.01;    
    result.fDist = max(max(abs(vPos.y + 0.025) - 0.025, abs(vPos.z) - 1.), abs(vPos.x) - 2.);
    //result.fDist = UdRoundBox( vPos - vec3(0,-0.02-fBenchBevel,0.0), vec3(2.0, 0.02, 1.0), fBenchBevel );
    
    TileInfo tileInfo = Tile( vPos.xz * 10.0);
    result.fDist += tileInfo.fHeight * 0.005;
    
    vec2 vRandomUV = vPos.xz;
    float fRandomMag = 0.0005;
  
    if ( tileInfo.bGrout )
    {
        vRandomUV = tileInfo.vTilePos * 10.0;
        fRandomMag = 0.0003;
    }
    else
    {
        vRandomUV = tileInfo.vTilePos * 0.5;
        fRandomMag = 0.0005;
    }
    
    if ( vPos.y > 0.01 )
    {
        vRandomUV = vPos.xz * 15.0;
        fRandomMag = 0.0;
    }
    
    float fRandomDist = 0.0;
    //float fRandomDist = textureLod( iChannel2, vRandomUV, 3.0 ).r;
    //float fRandomDist = FBM( vRandomUV * 30.0, 0.5);
    
    result.fDist += fRandomDist * fRandomMag;
    
    result.vUVW = vPos;
    result.iObjectId = MAT_CHECKER;
    

    //result.fDist = max( vPos.y - 0.1 + textureLod( iChannel2, result.vUVW.xz * 10., 0.5 ).r * 0.12, result.fDist );
    //result.fDist = min ( result.fDist, 0.3 -vPos.z );
    
    float fWallDist = 0.3 -vPos.z;
    if ( result.fDist > fWallDist )
    {
        result.vUVW = vPos.xzy;
        result.fDist = fWallDist;
        result.iObjectId = MAT_WOOD;
    }
    
    vec3 vSetPos = vec3(0.0, 0.0, 0.0);
    vec3 vScreenPos = vSetPos + vec3(0.0, 0.25, 0.00);
    
    //vPos.x = fract( vPos.x - 0.5) - 0.5;
    
    vec2 vScreenWH = vec2(4.0, 3.0) / 25.0;

    vec3 vPumpkinDomain = vPos - vec3(0,0.075, 0.0);
    SceneResult resultPumpkin;        
    resultPumpkin = Scene_GetPumpkinDistance( vPumpkinDomain );
    //resultPumpkin.fDist -= fRandomDist * 0.0005;
    
    SceneResult resultCarving;        
    resultCarving.vUVW = vPos.xyz;
    resultCarving.fDist = GetCarvingDistance( vPumpkinDomain );
    resultCarving.iObjectId = MAT_PUMPKIN_INTERIOR;
    
    resultPumpkin = Scene_Subtract( resultPumpkin, resultCarving );
    //resultPumpkin = Scene_SmoothSubtract( resultPumpkin, resultCarving, 0.001 );
    
    
    /*
    if ( resultPumpkin.fDist < vPos.x )
    {
        resultPumpkin.fDist = vPos.x;
        resultCarving.iObjectId = MAT_PUMPKIN_INTERIOR;
    }
    */
    
    result = Scene_Union( result, resultPumpkin );                
    
#ifdef DRAW_LAMP    
    SceneResult resultLamp;

    vec3 vSpotPos, vSpotTarget;  

    GetSpotState( vSpotPos, vSpotTarget );
    vec3 vLampUp = normalize(vSpotPos - vSpotTarget);
    vec3 vLampPos = vSpotPos + vLampUp * 0.1;

    resultLamp.vUVW = vPos.xzy;
    resultLamp.fDist = length(vPos - vLampPos ) - 0.1;
    resultLamp.iObjectId = MAT_CHROME;

    SceneResult resultLampInner;

    resultLampInner.vUVW = vPos.xzy;
    resultLampInner.fDist = length(vPos - vLampPos + vLampUp * 0.05) - 0.12;
    resultLampInner.iObjectId = MAT_CHROME_GLOW;
    resultLamp = Scene_Subtract( resultLamp, resultLampInner );    

    result = Scene_Union( result, resultLamp );    
#endif    
    
#if 0    
    vec3 vSPos = vPos - vec3(0,0,-.75);
    

    SceneResult resultSphere;
    
    resultSphere.vUVW = vSPos.xzy;
    resultSphere.fDist = length(vSPos - vec3(-0.2,0.075,0.0)) - 0.075;
    resultSphere.iObjectId = MAT_DEFAULT;
    result = Scene_Union( result, resultSphere );    
    
    resultSphere.vUVW = vSPos.xzy;
    resultSphere.fDist = length(vSPos - vec3(0.0,0.075,0.0)) - 0.075;
    resultSphere.iObjectId = MAT_WOOD;
    result = Scene_Union( result, resultSphere );    
    
    resultSphere.vUVW = vSPos.xzy;
    resultSphere.fDist = length(vSPos - vec3(0.2,0.075,0.0)) - 0.075;
    resultSphere.iObjectId = MAT_CHROME;
    result = Scene_Union( result, resultSphere );                

    resultSphere.vUVW = vSPos.xzy;
    resultSphere.fDist = length(vSPos - vec3(0.4,0.075,0.0)) - 0.075;
    resultSphere.iObjectId = MAT_GOLD;
    result = Scene_Union( result, resultSphere );                
#endif    
    
    
#else
    float fScale = 10.0;
    result.vUVW = vPos.xzy;
    vec2 m = map(vPos * fScale);
    result.fDist =    m.x / fScale;
    result.iObjectId = (int(m.y) + 0) % 5;
#endif 
    return result;
}



// Scene Lighting

vec3 g_vSunDir = normalize(vec3(0.3, 0.4, -0.5));
vec3 g_vSunColor = vec3(1, 0.95, 0.8) * 3.0;
vec3 g_vAmbientColor = vec3(0.7, 0.7, 1.0) * 2.0;

SurfaceLighting Scene_GetSurfaceLighting( const in vec3 vViewDir, in SurfaceInfo surfaceInfo )
{
    SurfaceLighting surfaceLighting;
    
    surfaceLighting.vDiffuse = vec3(0.0);
    surfaceLighting.vSpecular = vec3(0.0);    
    
    //Light_AddDirectional( surfaceLighting, surfaceInfo, vViewDir, g_vSunDir, g_vSunColor );
    
    vec3 vSpotPos, vSpotTarget;
    GetSpotState(vSpotPos, vSpotTarget);
    vec3 vSpotDir = normalize( vSpotTarget - vSpotPos );
    
    vec3 vLightCol = GetSpotColor();
    
    Light_AddSpot( surfaceLighting, surfaceInfo, vViewDir, vSpotPos, vSpotDir, radians(10.0), radians(60.0), vLightCol * 0.02 );
    Light_AddPoint( surfaceLighting, surfaceInfo, vViewDir, vSpotPos, vLightCol * 0.001 );
    
    float fAO = Scene_GetAmbientOcclusion( surfaceInfo.vPos, surfaceInfo.vNormal );
    // AO
    surfaceLighting.vDiffuse += fAO * (surfaceInfo.vBumpNormal.y * 0.5 + 0.5) * g_vAmbientColor;
    
    return surfaceLighting;
}

// Environment

vec4 Env_GetSkyColor( const vec3 vViewPos, const vec3 vViewDir )
{
    vec4 vResult = vec4( 0.0, 0.0, 0.0, kFarDist );
   
#if 1
    vec3 vEnvMap = textureLod( iChannel1, vViewDir.zyx, 0.0 ).rgb;
    vEnvMap = vEnvMap * vEnvMap;
    float kEnvmapExposure = 0.999;
    vResult.rgb = -log2(1.0 - vEnvMap * kEnvmapExposure);

#endif
    
    // Sun
    //float NdotV = dot( g_vSunDir, vViewDir );
    //vResult.rgb += smoothstep( cos(radians(.7)), cos(radians(.5)), NdotV ) * g_vSunColor * 5000.0;

    return vResult * 3.5;   
}

float Env_GetFogFactor(const in vec3 vRayOrigin,  const in vec3 vRayDir, const in float fDist )
{    
    float kFogDensity = 0.05;
    return exp(fDist * -kFogDensity);   
}

vec3 Env_GetFogColor(const in vec3 vDir)
{    
    return vec3(0.5, 0.45, 0.4) * 2.0;      
}

vec3 Env_ApplyAtmosphere( const in vec3 vColor, const in vec3 vRayOrigin,  const in vec3 vRayDir, const in float fDist )
{
    //return vColor;
    vec3 vResult = vColor;
    
    
    float fFogFactor = Env_GetFogFactor( vRayOrigin, vRayDir, fDist );
    vec3 vFogColor = Env_GetFogColor( vRayDir );    
    //Env_AddDirectionalLightFlareToFog( vFogColor, vRayDir, g_vSunDir, g_vSunColor * 3.0);    
    vResult = mix( vFogColor, vResult, fFogFactor );

    return vResult;     
}


vec3 FX_Apply( in vec3 vColor, const in vec3 vRayOrigin,  const in vec3 vRayDir, const in float fDist)
{    
    return vColor;
}


vec4 MainCommon( vec3 vRayOrigin, vec3 vRayDir )
{
    vec4 vColorLinAndDepth = Scene_GetColorAndDepth( vRayOrigin, vRayDir );    
    vColorLinAndDepth.rgb = max( vColorLinAndDepth.rgb, vec3(0.0) );
    
    vec4 vFragColor = vColorLinAndDepth;
    
    float fExposure = 2.0f;
    
    vFragColor.rgb *= fExposure;
    
    vFragColor.a = vColorLinAndDepth.w;
    
    return vFragColor;
}


void mainImage( out vec4 vFragColor, in vec2 vFragCoord )
{
    float fReduction = clamp( 60.0 * iTimeDelta - 0.5, 1.0, 4.0 );
    vec2 vReducedResolution = iResolution.xy / fReduction;
    vec2 vUV = vFragCoord.xy / vReducedResolution.xy; 
    
    if ( any( greaterThanEqual( vUV, vec2(1) ) ) )
    {
        discard;
        return;
    }

    FlyCamState flyCam;
    
    FlyCam_LoadState( flyCam, iChannelCurr, ivec2(4,0) );
        
    FlyCam_Update( flyCam, vec3(-0.1, 0.2, -0.4), vec3(.4, .35, 0) );
    
    CameraState cam;

#if 0
    {
        float fDist = 0.01 + 3.0 * (iMouse.y / iResolution.y);

        float fAngle = (iMouse.x / iResolution.x) * radians(360.0);
        //float fElevation = (iMouse.y / iResolution.y) * radians(90.0);
        float fElevation = 0.15f * radians(90.0);    

        if ( iMouse.z <= 0.0 )
        {
            fDist = 2.0;
            fAngle = 3.5f;
            fElevation = 0.2f;
        }
        
        cam.vPos = vec3(sin(fAngle) * fDist * cos(fElevation),sin(fElevation) * fDist,cos(fAngle) * fDist * cos(fElevation));
        cam.vTarget = vec3(0,0.05,0.0);
        cam.vPos +=cam.vTarget;
        cam.fFov = 20.0 / (1.0 + fDist * 0.5);
        cam.vUp = vec3(0,1,0);
        vec3 vFocus = vec3(0,0.05,0.0);     
        cam.fPlaneInFocus = length( vFocus - cam.vPos );
    }
#endif    
    
#if 1
    vec3 vForwards, vRight, vUp;
    FlyCam_GetAxes( flyCam, vRight, vUp, vForwards );
    
    cam.vPos = flyCam.vPos;
    cam.vTarget = flyCam.vPos + vForwards;
    cam.vUp = vUp;
    cam.fFov = 25.0;
    cam.fPlaneInFocus = 1.0;
    
    SceneResult focusTrace = Scene_Trace( flyCam.vPos, vForwards, 0.0, 100.0 );
    cam.fPlaneInFocus = min( focusTrace.fDist, 3.0);
#endif
    
#ifdef ENABLE_TAA_JITTER
    cam.vJitter = hash21( fract( iTime ) ) - 0.5f;
#endif
    
    float fAspectRatio = iResolution.x / iResolution.y;            
    
    vec3 vRayOrigin, vRayDir;
    vec2 vJitterUV = vUV + cam.vJitter / vReducedResolution.xy;
    Cam_GetCameraRay( vJitterUV, fAspectRatio, cam, vRayOrigin, vRayDir );
 
    float fHitDist = 0.0f;
    vFragColor = MainCommon( vRayOrigin, vRayDir );    
    
    FlyCam_StoreState( ivec2(4,0), flyCam, vFragColor, ivec2(vFragCoord.xy) );
    Cam_StoreState( ivec2(0), cam, vFragColor, ivec2(vFragCoord.xy) );    
    
    StoreVec4( ivec2(7,0), vec4( vReducedResolution,0,0 ), vFragColor, ivec2(vFragCoord.xy) );
}

void mainVR( out vec4 vFragColor, in vec2 vFragCoord, in vec3 vRayOrigin, in vec3 vRayDir )
{
    CameraState cam;

    
    float fDist = 0.01 + 3.0 * (iMouse.y / iResolution.y);

    float fAngle = (iMouse.x / iResolution.x) * radians(360.0);
    //float fElevation = (iMouse.y / iResolution.y) * radians(90.0);
    float fElevation = 0.15f * radians(90.0);    

    if ( iMouse.z <= 0.0 )
    {
        fDist = 2.0;
        fAngle = 3.5f;
        fElevation = 0.2f;
    }

    cam.vPos = vec3(sin(fAngle) * fDist * cos(fElevation),sin(fElevation) * fDist,cos(fAngle) * fDist * cos(fElevation));
    cam.vTarget = vec3(0,0.05,0.0);
    cam.vPos +=cam.vTarget;
    cam.fFov = 20.0 / (1.0 + fDist * 0.5);
    cam.vUp = vec3(0,1,0);
           
    vFragColor = MainCommon( vRayOrigin, vRayDir );    

    Cam_StoreState( ivec2(0), cam, vFragColor, ivec2(vFragCoord.xy) );    
}

