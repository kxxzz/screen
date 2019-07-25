// this buffer has one job - it records how much time passed since the mouse state changed in pixel 0,0.
// this weights lighting contribution (large at first, falling off over time)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    if( fragCoord.x > 1. || fragCoord.y > 1. )
    {
        fragColor = vec4(0.);
        return;
    }
    
    vec4 lastMouseState = textureLod(iChannel0,fragCoord/iResolution.xy,0.);
    
    float timeSinceMouseChanged = lastMouseState.w;
    
    timeSinceMouseChanged += iTimeDelta;
    
    // if mouse state changed or first frame, set timer to 0
    vec3 stateOffset = lastMouseState.xyz - iMouse.xyz;
    if( dot( stateOffset, stateOffset ) > 0.001 || iFrame == 0 )
        timeSinceMouseChanged = 0.;
    
    // record current mouse state and running total time since last change
    fragColor = vec4( iMouse.xyz, timeSinceMouseChanged );
}


