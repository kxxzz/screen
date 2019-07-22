

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



















































































































