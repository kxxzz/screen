//////////////////////////////////////////////////////////////////////
////
//// Original code from this shader can be used however desired.
//// Code, which is annotated as taken from another place can only
//// be used according to its original license.
////
//// More interactive version outside of shadertoy: https://tom94.net/pages/projects/femto
////
//////////////////////////////////////////////////////////////////////
////
//// Left:  Full (unbiased) light transport.
//// Right: Light propagating through the scene in slow-motion.
////        (Press T to toggle continuous illumination.)
////
//// Controls:
////
////   Mouse Drag = move image split
////
////   T = toggle light-pulse and continuous illumination
////
////   G = move light sources
////
////   H = DO NOT PRESS IF YOU HAVE EPILEPSY PROBLEMS
////       toggle correlation between pixels
////       (looks funny, still converges to right image)
////
////   WASD/Arrows, Q/E, R/F, Ctrl/Shirt
////     = move camera
////
//////////////////////////////////////////////////////////////////////
////
//// Buf B: Handles user input.
//// Buf C: Does the path tracing.
//// Image: Does tonemapping.
////
//////////////////////////////////////////////////////////////////////

// Taken from John Hable's blog ( http://filmicgames.com/archives/75 )
const float A = 0.15;
const float B = 0.50;
const float C = 0.10;
const float D = 0.20;
const float E = 0.02;
const float F = 0.30;
const float W = 11.2;

vec3 tonemapUncharted2Helper(vec3 x)
{
    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 tonemapUncharted2(vec3 x, float exposure)
{
    vec3 whiteScale = vec3(1.0) / tonemapUncharted2Helper(vec3(W));
    vec3 color = tonemapUncharted2Helper(x * exposure * 12.0) / whiteScale;
    
    return pow(color, vec3(1.0 / 2.2));
}

vec3 tonemapReinhard(vec3 color, float exposure)
{
    color *= exposure * 1.5;
    
    float L = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    float tonemapped = (L * (1.0 + L / (2.2 * 2.2))) / (L + 1.0);
    
    color *= tonemapped / L;
    return pow(color, vec3(1.0 / 2.2));
}

vec3 tonemapGamma(vec3 color, float exposure)
{
    color *= exposure;
    return pow(color, vec3(1.0 / 2.2));
}

bool getLightPulse()
{
    return texture(iChannel2, vec2(2.5, 0.5) / iResolution.xy).y < 0.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord.xy / iResolution.xy;

    vec4 val = texture(iChannel0, uv);
    vec3 total = val.a > 0.0 ? (val.rgb / val.a) : vec3(0.0);
    
    float mouseX = iMouse.x > 0.0 ?
        iMouse.x :
        (iResolution.x / 2.0);
            
    float exposure = fragCoord.x > mouseX && getLightPulse() ? 10.0 : 1.0;
            
    if (abs(fragCoord.x - mouseX) < 1.0)
    {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    else
    {
        //fragColor = vec4(tonemapUncharted2(total, exposure), 1.0);
        fragColor = vec4(tonemapReinhard(total, exposure), 1.0);
        //fragColor = vec4(tonemapGamma(total, exposure), 1.0);
    }
}


