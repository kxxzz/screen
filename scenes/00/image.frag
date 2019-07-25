





void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec3 col = textureLod(iChannel0, uv, 0.0).rgb;
    col *= 1.5;
    col = tonemap(col);
    col = toGamma(col);
    fragColor.rgb = col;
    fragColor.a = 1.0;
}





























































