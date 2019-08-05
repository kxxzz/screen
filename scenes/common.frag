
const float PI = 3.14159265359;
const float InvPI = 1.0 / PI;
const float HalfPI = PI * 0.5;

const float DEG2RAD = float(PI / 180.0);
const float RAD2DEG = float(180.0 / PI);









float clamp01(in float x)
{
    return clamp(x, 0.0, 1.0);
}
vec3 clamp01(in vec3 x)
{
    return clamp(x.rgb, 0.0, 1.0);
}
// Remove the [0, amount] tail and linearly rescale (amount, 1].
float linstep(float low, float high, float v)
{
    return clamp01((v-low)/(high-low));
}
float pow2(in float x)
{
    return x*x;
}
float pow3(in float x)
{
    return x*x*x;
}
float pow4(in float x)
{
    return x*x*x*x;
}













// single iteration of Bob Jenkins' One-At-A-Time hashing algorithm:
//  http://www.burtleburtle.net/bob/hash/doobs.html
// suggested by Spatial on stackoverflow:
//  http://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl
uint xorShiftBJ(uint x) 
{
    x += x << 10u;
    x ^= x >> 6u;
    x += x << 3u;
    x ^= x >> 11u;
    x += x << 15u;
    return x;
}

// xor-shift algorithm by George Marsaglia
//  https://www.thecodingforums.com/threads/re-rngs-a-super-kiss.704080/
// suggested by Nathan Reed:
//  http://www.reedbeta.com/blog/quick-and-easy-gpu-random-numbers-in-d3d11/
uint xorShiftGM(uint x)
{
    x ^= x << 13u;
    x ^= x >> 17u;
    x ^= x << 5u;
    return x;
}

// hashing algorithm by Thomas Wang 
// http://www.burtleburtle.net/bob/hash/integer.html
// suggested by Nathan Reed:
// http://www.reedbeta.com/blog/quick-and-easy-gpu-random-numbers-in-d3d11/
uint hashWang(uint x)
{
    x = (x ^ 61u) ^ (x >> 16u);
    x *= 9u;
    x ^= x >> 4u;
    x *= 0x27d4eb2du;
    x ^= x >> 15u;
    return x;
}





// https://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl
// Construct a float with half-open range [0:1] using low 23 bits.
// All zeroes yields 0.0, all ones yields the next smallest representable value below 1.0.
float floatConstruct(uint m)
{
    const uint ieeeMantissa = 0x007FFFFFu; // binary32 mantissa bitmask
    const uint ieeeOne      = 0x3F800000u; // 1.0 in IEEE binary32
    m &= ieeeMantissa;                     // Keep only mantissa bits (fractional part)
    m |= ieeeOne;                          // Add fractional part to 1.0
    float  f = uintBitsToFloat( m );       // Range [1:2]
    return f - 1.0;                        // Range [0:1]
}













vec3 toGamma(in vec3 c)
{
    //return sqrt(color);
    return pow(clamp01(c), vec3(1.0/2.2));
}
vec3 toLinear(in vec3 c)
{
    return pow(clamp01(c), vec3(2.2));
}

















vec3 tonemapReinhard(in vec3 color)
{
    color.rgb = color.rgb / (color.rgb + vec3(1.0f));
    return color.rgb;
}
vec3 tonemapExp(in vec3 color)
{
    color.rgb = 1.0f - exp(-color.rgb);
    return color.rgb;
}
vec3 tonemapUncharted2_F(in vec3 x)
{
    const float A = 0.22f;
    const float B = 0.30f;
    const float C = 0.10f;
    const float D = 0.20f;
    const float E = 0.01f;
    const float F = 0.30f;
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}
vec3 tonemapUncharted2(in vec3 color, in float whitePt)
{
    return tonemapUncharted2_F(1.6f * color) / tonemapUncharted2_F(vec3(whitePt));
}
// http://www.oscars.org/science-technology/sci-tech-projects/aces
// https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 tonemapACESFilm(in vec3 color)
{
    float a = 2.51f;
    float b = 0.03f;
    float c = 2.43f;
    float d = 0.59f;
    float e = 0.14f;
    return (color*(a*color+b)) / (color*(c*color+d)+e);
}

// https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 tonemapACESFitted_ACESInputMat = mat3
(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
);
// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 tonemapACESFitted_ACESOutputMat = mat3
(
     1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
);
vec3 tonemapACESFitted_RRTAndODTFit(vec3 v)
{
    vec3 a = v * (v + 0.0245786f) - 0.000090537f;
    vec3 b = v * (0.983729f * v + 0.4329510f) + 0.238081f;
    return a / b;
}
vec3 tonemapACESFitted(vec3 color)
{
    color = color * tonemapACESFitted_ACESInputMat;
    // Apply RRT and ODT
    color = tonemapACESFitted_RRTAndODTFit(color);
    color = color * tonemapACESFitted_ACESOutputMat;
    return color;
}

// https://twitter.com/jimhejl/status/633777619998130176
vec3 tonemapHejl2015(vec3 color, float whitePt)
{
    vec4 vh = vec4(color, whitePt);
    vec4 va = (1.425 * vh) + 0.05f;
    vec4 vf = (vh * va + 0.004f) / (vh * (va + 0.55f) + 0.0491f) - 0.0821f;
    return vf.rgb / vf.www;
}


// @P_Malin
// https://www.shadertoy.com/view/Mt2yzK
vec3 tonemapPMalin(in vec3 x)
{
    float a = 0.010;
    float b = 0.132;
    float c = 0.010;
    float d = 0.163;
    float e = 0.101;
    return (x * ( a * x + b ) ) / ( x * ( c * x + d ) + e);
}













void anglesToAxes(in vec3 angles, out vec3 right, out vec3 up, out vec3 front)
{
    mat3 rotX = mat3
    (
        1.0, 0.0, 0.0,
        0.0, cos(angles.x), sin(angles.x),
        0.0, -sin(angles.x), cos(angles.x)
    );
    mat3 rotY = mat3
    (
        cos(angles.y), 0.0, -sin(angles.y),
        0.0, 1.0, 0.0,
        sin(angles.y), 0.0, cos(angles.y)
    );
    mat3 rotZ = mat3
    (
        cos(angles.z), sin(angles.z), 0.0,
        -sin(angles.z), cos(angles.z), 0.0,
        0.0, 0.0, 1.0
    );
    mat3 m = rotY * rotX * rotZ;
    right = m[0];
    up = m[1];
    front = m[2];
}






vec2 viewCoordFromUV(in vec2 uv, in float aspectRatio)
{
    vec2 viewCoord = uv * 2.0 - 1.0;
    viewCoord.x *= aspectRatio;
    return viewCoord; 
}






void storeVec4(in ivec2 addr, in vec4 value, inout vec4 fragColor, in ivec2 fragCoord)
{
    if (all(equal(fragCoord, addr)))
    {
        fragColor = value;
    }
}















































































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

bool keyIsPressed(sampler2D samp, int key)
{
    return texelFetch(samp, ivec2(key, 0), 0).x > 0.0;    
}

bool keyIsToggled(sampler2D samp, int key)
{
    return texelFetch(samp, ivec2(key, 2), 0).x > 0.0;    
}
























struct Camera
{
    vec3 pos, target, up;
    float fov;  
};

mat3 cameraWorldToCamera(in Camera cam)
{
    vec3 front = normalize(cam.target - cam.pos);
    vec3 right = normalize(cross(cam.up, front));
    vec3 up = normalize(cross(front, right));
    return mat3(right, up, front);
}

void cameraRayCalc
(
    in Camera cam, in vec2 uv, in float aspectRatio,
    out vec3 rayOrigin, out vec3 rayDir
)
{
    vec2 viewCoord = viewCoordFromUV(uv, aspectRatio);
    rayOrigin = cam.pos;
    float perspDist = 1.0 / tan(cam.fov);
    rayDir = normalize(cameraWorldToCamera(cam) * vec3(viewCoord, perspDist));
}






















struct Material
{
    vec3 albedo;
};






















































































