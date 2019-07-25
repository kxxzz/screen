// Basic PT
// Created by TinyTexel
// Creative Commons Attribution-ShareAlike 4.0 International Public License

/*
basic path tracing setup
camera controls via mouse + shift key
light controls via WASD/Arrow keys
*/

#define Time iTime
#define Frame iGlobalFrame
#define PixelCount iResolution.xy

vec3 GammaEncode(vec3 x) {return pow(x, vec3(1.0 / 2.2));}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //vec2 uv = floor(fragCoord.xy);
    vec2 tex = fragCoord.xy / PixelCount;
    
    vec3 col = textureLod(iChannel0, tex, 0.0).rgb;
    
   // if(false)
    {
        col = 1.0 - exp2(-col * 4.0);
        col = mix(col, (col*col+col*col*col*col)*0.5, 1.0);
    }
    
    fragColor = vec4(GammaEncode(col), 0.0);
    //fragColor = vec4(col, 0.0);
}



