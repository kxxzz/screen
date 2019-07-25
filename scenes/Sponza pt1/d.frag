void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 rawUV = fragCoord / iResolution.xy;
    vec2 uv = (-iResolution.xy + (fragCoord*2.0)) / iResolution.y;
    
    if(abs(uv.y) > .75)
    {     
        fragColor = vec4(0.0);   
        return;
    }
    
    vec4 result = texture(iChannel2, rawUV);
    
    if(iFrame == 0 || texelFetch(iChannel0, ivec2(0), 0).x > 0.0)
        result = vec4(0.0);
    
    int bounceFrame = BounceFrame(iFrame);
    
    if(bounceFrame == BOUNCES - 1)
    {
        result.rgb += texture(iChannel1, rawUV).rgb;
        result.a += 1.0;   
    }    
    
    fragColor = result;
}
