// Created by EvilRyu
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;

    vec3 col = vec3(0.0);
    
    if(iFrame>0)
    {
        col = texture(iChannel0, uv).xyz;
        col /= float(iFrame);
        col = pow(col, vec3(0.45));
    }
    
    col = pow(col, vec3(1.,0.85,0.7));
    col=col*0.6+0.4*col*col*(3.0-2.0*col);  // contrast
    col *= 0.5 + 0.5*pow( 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.1 );
    
    fragColor = vec4( col, 1.0 );
}


