void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float splitCoord = (iMouse.y == 0.0) ? iResolution.y/2. + iResolution.y*cos(iTime*.5) : iMouse.y;
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    if (fragCoord.y < splitCoord) {
        fragColor = texture(iChannel0, uv);
    } else {
        fragColor = texture(iChannel1, uv);
    }
    
    if (abs(fragCoord.y - splitCoord) < 1.0) {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
}
