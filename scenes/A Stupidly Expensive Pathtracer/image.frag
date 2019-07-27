void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 col = texelFetch(iChannel0, ivec2(fragCoord.xy), 0);
    fragColor = pow(col / col.w, vec4(1.4));
}

