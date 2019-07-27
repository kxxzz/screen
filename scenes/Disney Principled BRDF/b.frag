void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    fragColor = texture(iChannel1, uv) * (1. - 1./float(iFrame+1)) + texture(iChannel0, uv) * 1./float(iFrame + 1);
}

