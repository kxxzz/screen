//IMAGE

// Created by genis sole - 2017
// License Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec3 c = vec3(0.0);
    if (iFrame > 0) {
        c = texelFetch(iChannel0, ivec2(fragCoord), 0).rgb / float(iFrame);
        c = 1.0 - exp(-c*1.0);
        c = pow(c, vec3(0.4545));
    }        
    
    fragColor = vec4(c, 1.0);
                     
}

