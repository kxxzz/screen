// Created by inigo quilez - iq/2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // source
    vec3 col = texelFetch( iChannel0, ivec2(fragCoord), 0 ).xyz;
    
    // burn the highlights
    float g = dot(col,vec3(0.3333));
    col = mix( col, vec3(g), min(g*0.15,1.0) );
    
    // gamma
    col = pow( col, vec3(0.4545) );

    // instafilter
    col = 1.15*pow( col, vec3(0.9,0.95,1.0) ) + vec3(-0.04,-0.04,0.0);

    // vignete     
  vec2 q = fragCoord / iResolution.xy;
    col *= 0.5 + 0.5*pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1 );
    
    // output
    fragColor = vec4( col, 1.0 );
}

