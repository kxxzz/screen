#define SAMPLES_LOCK 8

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 newc = texture(iChannel0, fragCoord.xy / iResolution.xy);
    vec4 xsample = texture(iChannel1, fragCoord.xy / iResolution.xy);
    
    {
        float next = xsample.w + float(1.f);
        float prev = xsample.w;
        float divisor = prev / next;

        xsample.xyz = xsample.xyz * vec3(divisor) + newc.xyz * (1.0f - divisor);
        xsample.w = min(next, float(SAMPLES_LOCK-1));
    }
    
    fragColor = xsample;
}


