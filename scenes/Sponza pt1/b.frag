void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 rawUV = fragCoord / iResolution.xy;
    vec2 uv = (-iResolution.xy + (fragCoord*2.0)) / iResolution.y;
    
    if(abs(uv.y) > .75)
    {     
        fragColor = vec4(0.0);   
        return;
    }
    
    Camera camera = GetCamera(uv, .5, iTime);
    vec4 rawA = texture(iChannel0, rawUV);
    
    vec3 oldStartPosition = rawA.yzw;
    vec3 normal = vec3(0.0);
    
    int bounceFrame = BounceFrame(iFrame);    
    vec4 rawB = texture(iChannel1, rawUV);
    
    vec3 totalEnergy = rawB.rgb;
    float throughput = rawB.a;

    if(bounceFrame == 0 || rawA.r > MAX_DISTANCE)
    {
        totalEnergy = vec3(0.0);
        throughput = 1.0;
    }
    else if(length(throughput) > .001) // prune dark rays
    {
        RebuildFrame(iFrame, rawA, camera, normal);
        
        vec3 wo = normalize(camera.origin - oldStartPosition);
        vec3 wi = normalize(camera.direction);

        EvaluateBRDF(wo, wi, normal, oldStartPosition, totalEnergy, throughput);
    }    
    
    fragColor = vec4(totalEnergy, throughput);
}
