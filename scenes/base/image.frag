





void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec3 col = textureLod(iChannel0, uv, 0.0).rgb;
    col *= 1.5;
    {
        col = 1.0 - exp2(-col * 4.0);
        col = mix(col, (col*col+col*col*col*col)*0.5, 1.0);
    }
    //col = tonemapPMalin(col);
    col = toGamma(col);
    fragColor.rgb = col;
    fragColor.a = 1.0;
}





























































