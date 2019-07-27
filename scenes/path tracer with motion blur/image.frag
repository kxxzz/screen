void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 newc = texture(iChannel0, fragCoord.xy / iResolution.xy);
    fragColor = vec4(pow( clamp(newc.xyz,0.0,1.0), vec3(0.45) ), 1.f);
}
