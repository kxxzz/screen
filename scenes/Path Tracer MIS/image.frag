// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

// Display : average down and do gamma adjustment

float lineDistance(vec2 a, vec2 b, vec2 p) {
    vec2 pa = p-a;
    vec2 ba = b-a;
    float t = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa-ba*t);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;

    vec3 col = vec3(0.0);
    
    if( iFrame>0 )
    {
        col = texture( iChannel0, uv ).xyz;
        col = pow( col, vec3(0.4545) );
    }
    
    
    // color grading and vigneting
    col = pow( col, vec3(0.8,0.85,0.9) );
    
    col *= 0.5 + 0.5*pow( 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.1 );
    
    const vec2 slider_pos = vec2(30.0, 30.0);
    const float slider_size = 200.0;
    const float slider_width = 8.0;
    if (lineDistance(slider_pos + vec2(0.0, -slider_width), slider_pos + vec2(slider_size, -slider_width),  fragCoord.xy) < 1.0 ||
        lineDistance(slider_pos + vec2(0.0, slider_width), slider_pos + vec2(slider_size, slider_width),  fragCoord.xy) < 1.0 ||
        lineDistance(slider_pos + vec2(0.0, -slider_width), slider_pos + vec2(0.0, slider_width),  fragCoord.xy) < 1.0 ||
        lineDistance(slider_pos + vec2(slider_size, -slider_width), slider_pos + vec2(slider_size, slider_width),  fragCoord.xy) < 1.0 
             ) {
        col = vec3(0.3, 0.3, 0.3);
    }
    
    fragColor = vec4( col, 1.0 );
}


