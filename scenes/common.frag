
const float PI = 3.14159265359;
const float InvPI = 1.0 / PI;
const float HalfPI = PI * 0.5;

const float DEG2RAD = float(PI / 180.0);
const float RAD2DEG = float(180.0 / PI);


float saturate(in float x)
{
    return clamp(x, 0.0, 1.0);
}
vec3 saturate(in vec3 x)
{
    return clamp(x.rgb, 0.0, 1.0);
}
// Remove the [0, amount] tail and linearly rescale (amount, 1].
float linstep(float low, float high, float v)
{
    return saturate((v-low)/(high-low));
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


vec3 toGamma(in vec3 c)
{
    //return sqrt(color);
    return pow(saturate(c), vec3(1.0/2.2));
}
vec3 toLinear(in vec3 c)
{
    return pow(saturate(c), vec3(2.2));
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








void vec4Store(in ivec2 addr, in vec4 value, inout vec4 fragColor, in ivec2 fragCoord)
{
    if (all(equal(fragCoord, addr)))
    {
        fragColor = value;
    }
}






vec2 viewCoordFromUV(in vec2 uv, in float aspectRatio)
{
    vec2 viewCoord = uv * 2.0 - 1.0;
    viewCoord.x *= aspectRatio;
    return viewCoord; 
}



















float RayCubeIntersect(in vec3 ro, in vec3 rd, vec3 cubePos, vec3 cubeSize, out vec2 hitDist)
{
    ro -= cubePos;

    vec3 m = 1.0 / -rd;
    vec3 o = mix(cubeSize*0.5, -cubeSize*0.5, lessThan(rd, vec3(0.0)));

    vec3 uf = (ro + o) * m;
    vec3 ub = (ro - o) * m;

    hitDist.x = max(uf.x, max(uf.y, uf.z));
    hitDist.y = min(ub.x, min(ub.y, ub.z));

    if (hitDist.x < 0.0 && hitDist.y > 0.0)
    {
        hitDist.xy = hitDist.yx;
        return 1.0;
    }
    return (hitDist.y < hitDist.x) ? 0.0 : (hitDist.x > 0.0 ? 1.0 : -1.0);
}


float RayCubeIntersect
(
    in vec3 ro, in vec3 rd, vec3 cubePos, vec3 cubeSize,
    out vec2 hitDist, out vec3 hitNorm0, out vec3 hitNorm1
)
{
    ro -= cubePos;

    vec3 m = 1.0 / -rd;
    vec3 os = mix(vec3(1.0), vec3(-1.0), lessThan(rd, vec3(0.0)));
    vec3 o = -cubeSize * os * 0.5;

    vec3 uf = (ro + o) * m;
    vec3 ub = (ro - o) * m;

    //hitDist.x = max(uf.x, max(uf.y, uf.z));
    //hitDist.y = min(ub.x, min(ub.y, ub.z));

    if (uf.x > uf.y)
    {
        hitDist.x = uf.x;
        hitNorm0 = vec3(os.x, 0.0, 0.0);
    }
    else
    {
        hitDist.x = uf.y;
        hitNorm0 = vec3(0.0, os.y, 0.0);
    }
    if (uf.z > hitDist.x )
    {
        hitDist.x = uf.z;
        hitNorm0 = vec3(0.0, 0.0, os.z);
    }
    if (ub.x < ub.y)
    {
        hitDist.y = ub.x;
        hitNorm1 = vec3(os.x, 0.0, 0.0);
    }
    else
    {
        hitDist.y = ub.y;
        hitNorm1 = vec3(0.0, os.y, 0.0);
    }
    if (ub.z < hitDist.y)
    {
        hitDist.y = ub.z;
        hitNorm1 = vec3(0.0, 0.0, os.z);
    }

    if (hitDist.x < 0.0 && hitDist.y > 0.0)
    {
        hitDist.xy = hitDist.yx;
        vec3 t = hitNorm1;
        hitNorm1 = hitNorm0;
        hitNorm0 = t;
        return 1.0;
    }
    return (hitDist.y < hitDist.x) ? 0.0 : (hitDist.x > 0.0 ? 1.0 : -1.0);
}





float RaySphereIntersect(in vec3 ro, in vec3 rd, vec3 spherePos, float sr2, out vec2 hitDist)
{
    ro -= spherePos;

    float a = dot(rd, rd);
    float b = 2.0 * dot(ro, rd);
    float c = dot(ro, ro) - sr2;

    float D = b*b - 4.0*a*c;
    if (D < 0.0)
    {
        return 0.0;
    }
    float sqrtD = sqrt(D);
    // hitDist = (-b + (c < 0.0 ? sqrtD : -sqrtD)) / a * 0.5;
    hitDist = (-b + vec2(-sqrtD, sqrtD)) / a * 0.5;

    // if (start == inside) ...
    if (c < 0.0)
    {
        hitDist.xy = hitDist.yx;
    }
    // hitDist.x > 0.0 || start == inside ? infront : behind
    return ((hitDist.x > 0.0) || (c < 0.0)) ? 1.0 : -1.0;
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





















































































