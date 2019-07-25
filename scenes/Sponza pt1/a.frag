float Raymarch(Camera camera, vec2 uv)
{    
    float totalDistance = 0.0;
    
    int bounceFrame = BounceFrame(iFrame);
    
    float maxDistance = MAX_DISTANCE;
    
    if(bounceFrame > 0)
        maxDistance = 15.0;
    
    for(int j = 0; j < MAX_STEPS; ++j)
    {
        vec3 p = camera.origin + camera.direction * totalDistance;
        float d = max(0.0, sdf(p));

        totalDistance += d;
                
        if(d < EPSILON || totalDistance > maxDistance)
            break;
    }
    
    return totalDistance;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    vec2 rawUV = fragCoord / iResolution.xy;
    vec2 uv = (-iResolution.xy + (fragCoord*2.0)) / iResolution.y;    
    
    if(abs(uv.y) > .75)
    {
        fragColor = vec4(0.0);
        
        if(iFrame == 0 || texelFetch(iChannel1, ivec2(32,0), 0).x > 0.0)
            fragColor = vec4(1.0);
        
        return;
    }
    
    Camera camera = GetCamera(uv, .5, iTime);    
    vec4 rawA = texture(iChannel0, rawUV);    
    vec3 normal = vec3(0.0);
    RebuildFrame(iFrame, rawA, camera, normal);
 
    float totalDistance = Raymarch(camera, rawUV);    
    fragColor = vec4(totalDistance, camera.origin);
}
