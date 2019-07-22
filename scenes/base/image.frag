






void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 vUV = fragCoord.xy / iResolution.xy;
    vec3 col = vec3(0,1,0);
    col *= 1.5;
    col = tonemapPMalin(col);
    //col = toGamma(col);
    fragColor.rgb = col;
    fragColor.a = 1.0;
}





























































