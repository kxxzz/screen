void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec4 col = texelFetch(iChannel0, ivec2(fragCoord.xy), 0);
    
    // This part feels like cheating
    col += texelFetch(iChannel0, ivec2(iResolution.xy-fragCoord.xy), 0).bgra;
    fragCoord.y = iResolution.y - fragCoord.y;
    col += texelFetch(iChannel0, ivec2(fragCoord.xy), 0);
    col += texelFetch(iChannel0, ivec2(iResolution.xy-fragCoord.xy), 0).bgra;
    
    col = clamp(col / col.w, 0.0, 1.0);
    
    //col = pow(1.0 - col, vec4(1.5));
    //col = pow(1.0 - col, vec4(1.2));
    
    fragColor = col;
}

