void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = texture(iChannel0, uv).rgb;
    col = 1.0-exp(-1.0*col);
    col = pow(col, vec3(1.0 / 2.2));
    fragColor = vec4(col,1.0);
}

