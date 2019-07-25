
//  _   _           _       _____                 _   _                 
// | | | | __ _ ___| |__   |  ___|   _ _ __   ___| |_(_) ___  _ __  ___ 
// | |_| |/ _` / __| '_ \  | |_ | | | | '_ \ / __| __| |/ _ \| '_ \/ __|
// |  _  | (_| \__ \ | | | |  _|| |_| | | | | (__| |_| | (_) | | | \__ \
// |_| |_|\__,_|___/_| |_| |_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
//                                                                      

// From: Hash without Sine by Dave Hoskins
// https://www.shadertoy.com/view/4djSRW

// *** Use this for integer stepped ranges, ie Value-Noise/Perlin noise functions.
//#define HASHSCALE1 .1031
//#define HASHSCALE3 vec3(.1031, .1030, .0973)
//#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)

// For smaller input rangers like audio tick or 0-1 UVs use these...
#define HASHSCALE1 443.8975
#define HASHSCALE3 vec3(443.897, 441.423, 437.195)
#define HASHSCALE4 vec3(443.897, 441.423, 437.195, 444.129)


//----------------------------------------------------------------------------------------
//  1 out, 1 in...
float hash11(float p)
{
    vec3 p3  = fract(vec3(p) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float hash12(vec2 p)
{
    vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

//  2 out, 1 in...
vec2 hash21(float p)
{
    vec3 p3 = fract(vec3(p) * HASHSCALE3);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx+p3.yz)*p3.zy);

}

///  2 out, 3 in...
vec2 hash23(vec3 p3)
{
    p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.xx+p3.yz)*p3.zy);
}

//  1 out, 3 in...
float hash13(vec3 p3)
{
    p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

///  3 out, 3 in...
vec3 hash33(vec3 p3)
{
    p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);

}


//  ____        _          ____  _                             
// |  _ \  __ _| |_ __ _  / ___|| |_ ___  _ __ __ _  __ _  ___ 
// | | | |/ _` | __/ _` | \___ \| __/ _ \| '__/ _` |/ _` |/ _ \
// | |_| | (_| | || (_| |  ___) | || (_) | | | (_| | (_| |  __/
// |____/ \__,_|\__\__,_| |____/ \__\___/|_|  \__,_|\__, |\___|
//                                                  |___/      
//

vec4 LoadVec4( sampler2D sampler, in ivec2 vAddr )
{
    return texelFetch( sampler, vAddr, 0 );
}

vec3 LoadVec3( sampler2D sampler, in ivec2 vAddr )
{
    return LoadVec4( sampler, vAddr ).xyz;
}

bool AtAddress( ivec2 p, ivec2 c ) { return all( equal( p, c ) ); }

void StoreVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in ivec2 fragCoord )
{
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

void StoreVec3( in ivec2 vAddr, in vec3 vValue, inout vec4 fragColor, in ivec2 fragCoord )
{
    StoreVec4( vAddr, vec4( vValue, 0.0 ), fragColor, fragCoord);
}

//
//  ____       _        _   _             
// |  _ \ ___ | |_ __ _| |_(_) ___  _ __  
// | |_) / _ \| __/ _` | __| |/ _ \| '_ \ 
// |  _ < (_) | || (_| | |_| | (_) | | | |
// |_| \_\___/ \__\__,_|\__|_|\___/|_| |_|
//                                        
//

vec3 RotateX( const in vec3 vPos, const in float fAngle )
{
    float s = sin(fAngle);
    float c = cos(fAngle);
    
    vec3 vResult = vec3( vPos.x, c * vPos.y + s * vPos.z, -s * vPos.y + c * vPos.z);
    
    return vResult;
}

vec3 RotateY( const in vec3 vPos, const in float fAngle )
{
    float s = sin(fAngle);
    float c = cos(fAngle);
    
    vec3 vResult = vec3( c * vPos.x + s * vPos.z, vPos.y, -s * vPos.x + c * vPos.z);
    
    return vResult;
}

vec3 RotateZ( const in vec3 vPos, const in float fAngle )
{
    float s = sin(fAngle);
    float c = cos(fAngle);
    
    vec3 vResult = vec3( c * vPos.x + s * vPos.y, -s * vPos.x + c * vPos.y, vPos.z);
    
    return vResult;
}


//   ___              _                  _             
//  / _ \ _   _  __ _| |_ ___ _ __ _ __ (_) ___  _ __  
// | | | | | | |/ _` | __/ _ \ '__| '_ \| |/ _ \| '_ \ 
// | |_| | |_| | (_| | ||  __/ |  | | | | | (_) | | | |
//  \__\_\\__,_|\__,_|\__\___|_|  |_| |_|_|\___/|_| |_|
//                                                     
//

vec4 QuatMul(const in vec4 lhs, const in vec4 rhs) 
{
      return vec4( lhs.y*rhs.z - lhs.z*rhs.y + lhs.x*rhs.w + lhs.w*rhs.x,
                   lhs.z*rhs.x - lhs.x*rhs.z + lhs.y*rhs.w + lhs.w*rhs.y,
                   lhs.x*rhs.y - lhs.y*rhs.x + lhs.z*rhs.w + lhs.w*rhs.z,
                   lhs.w*rhs.w - lhs.x*rhs.x - lhs.y*rhs.y - lhs.z*rhs.z);
}

vec4 QuatFromAxisAngle( vec3 vAxis, float fAngle )
{
    return vec4( normalize(vAxis) * sin(fAngle), cos(fAngle) );    
}

vec4 QuatFromVec3( vec3 vRot )
{
    float l = length( vRot );
    if ( l <= 0.0 )
    {
        return vec4( 0.0, 0.0, 0.0, 1.0 );
    }
    return QuatFromAxisAngle( vRot, l );
}

mat3 QuatToMat3( const in vec4 q )
{
    vec4 qSq = q * q;
    float xy2 = q.x * q.y * 2.0;
    float xz2 = q.x * q.z * 2.0;
    float yz2 = q.y * q.z * 2.0;
    float wx2 = q.w * q.x * 2.0;
    float wy2 = q.w * q.y * 2.0;
    float wz2 = q.w * q.z * 2.0;
 
    return mat3 (   
     qSq.w + qSq.x - qSq.y - qSq.z, xy2 - wz2, xz2 + wy2,
     xy2 + wz2, qSq.w - qSq.x + qSq.y - qSq.z, yz2 - wx2,
     xz2 - wy2, yz2 + wx2, qSq.w - qSq.x - qSq.y + qSq.z );
}

vec3 QuatMul( vec3 v, vec4 q )
{
    // TODO Validate vs other quat code
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
}

//
//  _  __          _                         _ 
// | |/ /___ _   _| |__   ___   __ _ _ __ __| |
// | ' // _ \ | | | '_ \ / _ \ / _` | '__/ _` |
// | . \  __/ |_| | |_) | (_) | (_| | | | (_| |
// |_|\_\___|\__, |_.__/ \___/ \__,_|_|  \__,_|
//           |___/                             
//

const int KEY_SPACE = 32;
const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;
const int KEY_A     = 65;
const int KEY_B     = 66;
const int KEY_C     = 67;
const int KEY_D     = 68;
const int KEY_E     = 69;
const int KEY_F     = 70;
const int KEY_G     = 71;
const int KEY_H     = 72;
const int KEY_I     = 73;
const int KEY_J     = 74;
const int KEY_K     = 75;
const int KEY_L     = 76;
const int KEY_M     = 77;
const int KEY_N     = 78;
const int KEY_O     = 79;
const int KEY_P     = 80;
const int KEY_Q     = 81;
const int KEY_R     = 82;
const int KEY_S     = 83;
const int KEY_T     = 84;
const int KEY_U     = 85;
const int KEY_V     = 86;
const int KEY_W     = 87;
const int KEY_X     = 88;
const int KEY_Y     = 89;
const int KEY_Z     = 90;
const int KEY_COMMA = 188;
const int KEY_PER   = 190;

const int KEY_1 =   49;
const int KEY_2 =   50;
const int KEY_3 =   51;
const int KEY_ENTER = 13;
const int KEY_SHIFT = 16;
const int KEY_CTRL  = 17;
const int KEY_ALT   = 18;
const int KEY_TAB   = 9;

bool Key_IsPressed( sampler2D samp, int key)
{
    return texelFetch( samp, ivec2(key, 0), 0 ).x > 0.0;    
}

bool Key_IsToggled(sampler2D samp, int key)
{
    return texelFetch( samp, ivec2(key, 2), 0 ).x > 0.0;    
}


//
//   ____                               
//  / ___|__ _ _ __ ___   ___ _ __ __ _ 
// | |   / _` | '_ ` _ \ / _ \ '__/ _` |
// | |__| (_| | | | | | |  __/ | | (_| |
//  \____\__,_|_| |_| |_|\___|_|  \__,_|
//                                      


struct CameraState
{
    vec3 vPos;
    vec3 vTarget;
    vec3 vUp;
    float fFov;
    vec2 vJitter;
    float fPlaneInFocus;
};
    
void Cam_LoadState( out CameraState cam, sampler2D sampler, ivec2 addr )
{
    vec4 vPos = LoadVec4( sampler, addr + ivec2(0,0) );
    cam.vPos = vPos.xyz;
    vec4 targetFov = LoadVec4( sampler, addr + ivec2(1,0) );
    cam.vTarget = targetFov.xyz;
    cam.fFov = targetFov.w;
    vec4 vUp = LoadVec4( sampler, addr + ivec2(2,0) );
    cam.vUp = vUp.xyz;
    
    vec4 jitterDof = LoadVec4( sampler, addr + ivec2(3,0) );
    cam.vJitter = jitterDof.xy;
    cam.fPlaneInFocus = jitterDof.z;
}

void Cam_StoreState( ivec2 addr, const in CameraState cam, inout vec4 fragColor, in ivec2 fragCoord )
{
    StoreVec4( addr + ivec2(0,0), vec4( cam.vPos, 0 ), fragColor, fragCoord );
    StoreVec4( addr + ivec2(1,0), vec4( cam.vTarget, cam.fFov ), fragColor, fragCoord );    
    StoreVec4( addr + ivec2(2,0), vec4( cam.vUp, 0 ), fragColor, fragCoord );    
    StoreVec4( addr + ivec2(3,0), vec4( cam.vJitter, cam.fPlaneInFocus, 0 ), fragColor, fragCoord );    
}

mat3 Cam_GetWorldToCameraRotMatrix( const CameraState cameraState )
{
    vec3 vForward = normalize( cameraState.vTarget - cameraState.vPos );
    vec3 vRight = normalize( cross( cameraState.vUp, vForward) );
    vec3 vUp = normalize( cross(vForward, vRight) );
    
    return mat3( vRight, vUp, vForward );
}

vec2 Cam_GetViewCoordFromUV( vec2 vUV, float fAspectRatio )
{
    vec2 vWindow = vUV * 2.0 - 1.0;
    vWindow.x *= fAspectRatio;

    return vWindow; 
}

void Cam_GetCameraRay( const vec2 vUV, const float fAspectRatio, const CameraState cam, out vec3 vRayOrigin, out vec3 vRayDir )
{
    vec2 vView = Cam_GetViewCoordFromUV( vUV, fAspectRatio );
    vRayOrigin = cam.vPos;
    float fPerspDist = 1.0 / tan( radians( cam.fFov ) );
    vRayDir = normalize( Cam_GetWorldToCameraRotMatrix( cam ) * vec3( vView, fPerspDist ) );
}

// fAspectRatio = iResolution.x / iResolution.y;
vec2 Cam_GetUVFromWindowCoord( const in vec2 vWindow, float fAspectRatio )
{
    vec2 vScaledWindow = vWindow;
    vScaledWindow.x /= fAspectRatio;

    return (vScaledWindow * 0.5 + 0.5);
}

vec2 Cam_WorldToWindowCoord(const in vec3 vWorldPos, const in CameraState cameraState )
{
    vec3 vOffset = vWorldPos - cameraState.vPos;
    vec3 vCameraLocal;

    vCameraLocal = vOffset * Cam_GetWorldToCameraRotMatrix( cameraState );
    
    vec2 vWindowPos = vCameraLocal.xy / (vCameraLocal.z * tan( radians( cameraState.fFov ) ));
    
    return vWindowPos;
}

float EncodeDepthAndObject( float depth, int objectId )
{
    //depth = max( 0.0, depth );
    //objectId = max( 0, objectId + 1 );
    //return exp2(-depth) + float(objectId);
    return depth;
}

float DecodeDepthAndObjectId( float value, out int objectId )
{
    objectId = 0;
    return max(0.0, value);
    //objectId = int( floor( value ) ) - 1; 
    //return abs( -log2(fract(value)) );
}

