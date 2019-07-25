//$INPUT0=KEYBOARD
//$INPUT1=BUFFER_A
//$INPUT2=BUFFER_B
//$INPUT3=BUFFER_C
//$OUTPUT=BUFFER_C
//$OUTPUT_RES_X=-0.25
//$OUTPUT_RES_Y=-0.25
//$OUTPUT_FILTER=OFF

// ===================================
// Buffer C: computes running variance
// ===================================

// http://jonisalonen.com/2013/deriving-welfords-method-for-computing-variance/
// variance(samples):
//   M := 0
//   S := 0
//   for k from 1 to N:
//     x := samples[k]
//     oldM := M
//     M := M + (x-M)/k
//     S := S + (x-M)*(x-oldM)
//   return S/(N-1)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 state = vec3(0);
    if (IS_KEY_TOGGLED(KEY_Z)) {
        ivec2 controlSamplerRes = textureSize(CONTROL_SAMPLER, 0);
        ivec2 frameControlCoord = controlSamplerRes - ivec2(1,1);
        vec3 frameControl = texelFetch(CONTROL_SAMPLER, frameControlCoord, 0).xyz;
        vec2 frames = max(vec2(0), float(iFrame) - frameControl.xy);
        float frame;
    #if LIGHTMAP
        bool lightmapEnabled = IS_KEY_TOGGLED(KEY_L);
        if (lightmapEnabled)
            frame = frames.y;
        else
    #endif // LIGHTMAP
            frame = frames.x;

        if (frame > 0.0)
            state = texelFetch(VARIANCE_SAMPLER, ivec2(fragCoord), 0).xyz;
        if (frame < float(LAST_FRAME)) {
            float M = state.x;
            float S = state.y;
            vec3 c;
        #if LIGHTMAP
            if (lightmapEnabled)
                c = texelFetch(LIGHTMAP_SAMPLER, ivec2(fragCoord), 0).rgb;
            else
        #endif // LIGHTMAP
                c = texelFetch(SCENE_SAMPLER, ivec2(fragCoord), 0).rgb;
            float x = dot(c, vec3(0.30,0.59,0.11));
            float oldM = M;
            M += (x - M)/(frame + 1.0);
            S += (x - M)*(x - oldM);
            float variance = S/max(1.0, frame);
            state = vec3(M, S, variance);
        }
    }
    fragColor = vec4(state, 0);
}


