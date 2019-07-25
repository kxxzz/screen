//$INPUT0=KEYBOARD
//$INPUT1=BUFFER_A
//$INPUT2=BUFFER_B
//$INPUT3=RGBA_NOISE_MEDIUM_TEXTURE
//$INPUT4=PASSIONFLOWER_TEXTURE
//$OUTPUT=BUFFER_A
//$OUTPUT_RES_X=256
//$OUTPUT_RES_Y=200
//$OUTPUT_FILTER=ON

// ==================================
// Buffer A: renders lightmap texture
// ==================================

#if LIGHTMAP_SPHERE_ATLAS
vec4 ColorizeSphereFace(int faceRow, int faceCol)
{
    vec4 colorize = vec4(0,0,0,1);
    if (faceCol == 0)
        colorize.r = 1.0;
    else if (faceCol == 1)
        colorize.g = 1.0;
    else // faceCol == 2
        colorize.b = 1.0;
    if (faceRow == 1)
        colorize.rgb = vec3(1) - colorize.rgb; // cyan,magenta,yellow
    colorize.rgb += (vec3(1) - colorize.rgb)*0.2; // whiten
    return colorize;
}
#endif // LIGHTMAP_SPHERE_ATLAS

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    INIT_SCENE();

    bvec2 frameReset = bvec2(false);
    frameReset.y = IS_KEY_DOWN(KEY_SPACE) || SLIDER_CHANGED;
    if (IS_KEY_PRESSED(KEY_E) || IS_KEY_PRESSED(KEY_H) || IS_KEY_PRESSED(KEY_U))
        frameReset.y = true;
    if (IS_KEY_PRESSED(KEY_I) || IS_KEY_PRESSED(KEY_O))
        frameReset.y = true;
    if (IS_KEY_PRESSED(KEY_P))
        frameReset.y = true;
#if LIGHTMAP
    if (IS_KEY_PRESSED(KEY_L))
        frameReset.y = true;
    if (lightmapEnabled && IS_KEY_PRESSED(KEY_C))
        frameReset.y = true;
    if (lightmapEnabled && IS_KEY_PRESSED(KEY_F))
        frameReset.x = true;
#endif // LIGHTMAP

    mat4 camera;
    vec2 frame;
    if (CAMERA_HANDLER(camera, KEYBOARD_SAMPLER, LIGHTMAP_SAMPLER, frame, frameReset, 1.0))
    {
        vec3 color = vec3(1,0,0); // lightmap atlas background
    #if LIGHTMAP
        if (lightmapEnabled) {
            vec2 offset = texelFetch(NOISE_SAMPLER, ivec2(fragCoord)&255, 0).xy;
            int objId = OBJ_ID_NONE;
            Object obj;
            for (int i = 0; i < NO_UNROLL(NUM_OBJECTS); i++) {
                obj = objects[i];
                if (fragCoord.x >= obj.lightmapBounds.x &&
                    fragCoord.y >= obj.lightmapBounds.y &&
                    fragCoord.x <= obj.lightmapBounds.z &&
                    fragCoord.y <= obj.lightmapBounds.w) {
                    objId = i;
                    break;
                }
            }
            if (objId != OBJ_ID_NONE && IsDiffuse(obj)) {
                vec4 colorize = vec4(0);
                vec3 P;
                if (IsQuad(obj)) {
                    vec3 bx = GetQuadBasisX(obj);
                    vec3 by = GetQuadBasisY(obj);
                    vec4 bounds = obj.lightmapBounds;
                    vec2 uv = (fragCoord.xy - bounds.xy)/(bounds.zw - bounds.xy);
                    vec2 st = uv*2.0 - vec2(1);
                    P = obj.pos + st.x*bx + st.y*by;
                } else { 
                    vec2 sphereAtlasUV = fragCoord.xy - obj.lightmapBounds.xy;
                    float faceRes = GetLightmapSphereFaceRes(obj);
                    int faceRow = int(floor(sphereAtlasUV.y/float(faceRes)));
                    int faceCol = int(floor(sphereAtlasUV.x/float(faceRes)));
                    vec2 faceBoundsMin = vec2(faceCol + 0, faceRow + 0)*faceRes + vec2(LIGHTMAP_SPHERE_FACE_INSET);
                    vec2 faceBoundsMax = vec2(faceCol + 1, faceRow + 1)*faceRes - vec2(LIGHTMAP_SPHERE_FACE_INSET);
                    vec2 faceUV = (sphereAtlasUV - faceBoundsMin)/(faceBoundsMax - faceBoundsMin);
                    vec3 V = normalize(vec3((faceRow == 1) ? -1 : 1, faceUV*2.0 - vec2(1)));
                    if (faceCol == 1)
                        V = V.zxy;
                    else if (faceCol == 2)
                        V = V.yzx;
                    P = obj.pos + V*obj.radius;
                    if (IS_KEY_TOGGLED(KEY_C))
                        colorize = ColorizeSphereFace(faceRow, faceCol);
                }
                vec3 N = GetSurfaceNormal(P, obj);
                vec3 e = vec3(0);
                uint wasSampled = 0U;
                if (directLightSampling && minDepth <= 1)
                    e = SampleLightsInScene(
                        P,
                        N,
                        haltonEnabled,
                        offset,
                        objId,
                        iFrame,
                        NUM_DIRECT_LIGHT_SAMPLES,
                        wasSampled);
                color = vec3(0);
                for (int i = 0; i < NO_UNROLL(NUM_PRIMARY_RAY_SAMPLES); i++) {
                    vec2 s = haltonEnabled ? fract(offset + Halton23(i + iFrame*NUM_PRIMARY_RAY_SAMPLES)) : rand2(seed);
                    vec3 rayDir; // diffuse only!
                    float mask = 1.0;
                    if (diffuseUniformSampling) {
                        rayDir = SampleHemisphereUniform(N, s);
                        mask = dot(N, rayDir)*2.0; // why 2.0?
                    } else
                        rayDir = SampleHemisphereCosineWeighted(N, s);
                    color += mask*ComputeRadiance(
                        Ray(P, rayDir),
                        objId,
                        1, // depth (starts at 1)
                        minDepth,
                        maxDepth,
                        diffuseUniformSampling,
                    #if LIGHTMAP
                        -1, // lightmapDepth
                        LIGHTMAP_SAMPLER,
                    #endif // LIGHTMAP
                        directLightSampling,
                        wasSampled);
                }
                color /= float(NUM_PRIMARY_RAY_SAMPLES);
                color += e;
            #if LIGHTMAP_SPHERE_ATLAS
                color += (colorize.rgb - color)*colorize.a;
            #endif // LIGHTMAP_SPHERE_ATLAS
            }
        }
    #endif // LIGHTMAP

        float f = frame.y;
        if (f > 0.0) {
            float accum = 1.0/(f + 1.0);
            if (f >= float(LAST_FRAME))
                accum = 0.0;
            color = color*accum + texelFetch(LIGHTMAP_SAMPLER, ivec2(fragCoord), 0).rgb*(1.0 - accum);
        }
        fragColor = vec4(color, 1.0);
    }
}

