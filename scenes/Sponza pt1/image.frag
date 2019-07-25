vec3 filmic(vec3 x)
{
    return ((x*(0.15f*x + 0.10f*0.50f) + 0.20f*0.02f) / (x*(0.15f*x + 0.50f) + 0.20f*0.30f)) - 0.02f / 0.30f;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord / iResolution.xy) * 2.0 - 1.0;
    
    if(abs(uv.y) > .75)
    {     
        fragColor = vec4(0.0);   
        return;
    }
    
    vec4 result = texture(iChannel0, fragCoord / iResolution.xy);
    result += vec4(texture(iChannel1, fragCoord / iResolution.xy).rgb, 1.0);
    result /= result.a;
    
    vec3 vignette = mix(vec3(1.0, .8, .96) * .1, vec3(1.3), (1.0 - smoothstep(.0, 1.9, length(uv) / 0.70710678118f)));
    vignette *= vignette;
    
    vec3 whiteScale = 1.0f / filmic(vec3(6.2f));
    result.rgb = filmic(result.rgb * 24.0 * vignette);    
    result.rgb = clamp(result.rgb * whiteScale, vec3(0.0), vec3(1.0));
    fragColor = pow(result, vec4(.4545));
}
